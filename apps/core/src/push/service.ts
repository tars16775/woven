import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Alert, Person, PushSubscriptionView } from "@woven/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { Logger } from "pino";
import type { Db } from "../db/index.ts";
import { pushSubscriptions } from "../db/schema.ts";
import { GateError, type GateClient } from "../gate/client.ts";
import type { HouseholdService } from "../household.ts";
import type { Ledger } from "../ledger.ts";
import { openSecret, sealSecret } from "../remote/frames.ts";
import { openPrivateKey, sealPrivateKey } from "../tls.ts";
import { audienceOf, encryptPayload, generateVapid, subscriptionId, vapidAuthorization, type PushSubscription, type VapidKeys } from "./webpush.ts";

export type PushMessage = { title: string; body: string; url?: string; tag?: string };
export type PushOutcome = { sent: number; failed: number; dropped: number; skipped: string | null };

/**
 * Notifications (gaps 17 and 25). A browser subscribes with its push
 * service's endpoint and keys; the box keeps them sealed under the
 * household key. A message is encrypted for that browser (RFC 8291) and
 * leaves through the Gate like any other crossing, with a receipt that
 * says a notification with such a title went to such a host, and nothing
 * else. Urgent alerts go to every adult; a subscription the push service
 * rejects is dropped.
 */
export class PushService {
  private vapid: VapidKeys | null = null;
  private readonly urgent = new Set<string>();

  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly gate: GateClient,
    private readonly household: HouseholdService,
    private readonly keysDir: string,
    private readonly sealKey: Buffer,
    private readonly logger: Logger,
    private readonly subject = "mailto:core@woven.local",
  ) {}

  /** The VAPID pair, made once and sealed in keys/vapid.json. */
  async keys(): Promise<VapidKeys> {
    if (this.vapid) return this.vapid;
    const file = join(this.keysDir, "vapid.json");
    try {
      const saved = JSON.parse(await readFile(file, "utf8")) as { publicKey: string; privateKey: string };
      this.vapid = { publicKey: saved.publicKey, privateKeyPem: openPrivateKey(saved.privateKey, this.sealKey) };
    } catch {
      this.vapid = generateVapid();
      await mkdir(this.keysDir, { recursive: true, mode: 0o700 });
      await writeFile(file, JSON.stringify({ publicKey: this.vapid.publicKey, privateKey: sealPrivateKey(this.vapid.privateKeyPem, this.sealKey) }), { mode: 0o600 });
    }
    return this.vapid;
  }

  subscribe(person: Person, sub: PushSubscription, label: string | null): PushSubscriptionView {
    const id = subscriptionId(sub.endpoint);
    const now = new Date().toISOString();
    const existing = this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, id)).get();
    const sealed = sealSecret(this.sealKey, Buffer.from(JSON.stringify(sub)));
    if (existing) {
      this.db.update(pushSubscriptions).set({ personId: person.id, householdId: person.householdId, sealed, label, revokedAt: null, failures: 0 }).where(eq(pushSubscriptions.id, id)).run();
    } else {
      this.db.insert(pushSubscriptions).values({ id, personId: person.id, householdId: person.householdId, host: new URL(sub.endpoint).host, sealed, label, createdAt: now, failures: 0 }).run();
    }
    return this.view(this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, id)).get()!);
  }

  list(person: Person): PushSubscriptionView[] {
    return this.db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.personId, person.id), isNull(pushSubscriptions.revokedAt)))
      .all()
      .map((r) => this.view(r));
  }

  unsubscribe(person: Person, id: string): boolean {
    const row = this.db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.id, id), isNull(pushSubscriptions.revokedAt))).get();
    if (!row || (row.personId !== person.id && person.role !== "owner")) return false;
    this.db.update(pushSubscriptions).set({ revokedAt: new Date().toISOString() }).where(eq(pushSubscriptions.id, id)).run();
    return true;
  }

  /** Send to one person's devices. */
  async send(person: Person, message: PushMessage): Promise<PushOutcome> {
    const rows = this.db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.personId, person.id), isNull(pushSubscriptions.revokedAt))).all();
    return this.deliver(rows, message, person.householdId);
  }

  /** Send to every adult in the household (urgent alerts). */
  async sendToAdults(message: PushMessage): Promise<PushOutcome> {
    const house = this.household.household();
    if (!house) return { sent: 0, failed: 0, dropped: 0, skipped: "no household" };
    const adults = new Set(
      this.household
        .people(house.id)
        .filter((p) => p.role === "owner" || p.role === "adult")
        .map((p) => p.id),
    );
    const rows = this.db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.householdId, house.id), isNull(pushSubscriptions.revokedAt)))
      .all()
      .filter((r) => adults.has(r.personId));
    return this.deliver(rows, message, house.id);
  }

  /** Alerts changed: a newly urgent one goes out once; it is not repeated while it stays raised. */
  async onAlerts(alerts: Alert[]): Promise<void> {
    const now = new Set(alerts.filter((a) => a.level === "urgent").map((a) => a.id));
    for (const id of this.urgent) if (!now.has(id)) this.urgent.delete(id);
    for (const a of alerts) {
      if (a.level !== "urgent" || this.urgent.has(a.id)) continue;
      this.urgent.add(a.id);
      const r = await this.sendToAdults({ title: `Woven: ${a.title}`, body: a.detail, url: "/dashboard/core", tag: `alert-${a.id}` });
      this.logger.info({ alert: a.id, ...r }, "urgent alert pushed");
    }
  }

  private async deliver(rows: (typeof pushSubscriptions.$inferSelect)[], message: PushMessage, householdId: string): Promise<PushOutcome> {
    if (!rows.length) return { sent: 0, failed: 0, dropped: 0, skipped: "no devices" };
    const keys = await this.keys();
    const payload = Buffer.from(JSON.stringify({ title: message.title, body: message.body, url: message.url ?? "/dashboard", tag: message.tag ?? null }));
    let sent = 0;
    let failed = 0;
    let dropped = 0;
    for (const row of rows) {
      let sub: PushSubscription;
      try {
        sub = JSON.parse(openSecret(this.sealKey, row.sealed).toString("utf8")) as PushSubscription;
      } catch {
        dropped += 1;
        this.db.update(pushSubscriptions).set({ revokedAt: new Date().toISOString() }).where(eq(pushSubscriptions.id, row.id)).run();
        continue;
      }
      const url = new URL(sub.endpoint);
      try {
        const enc = encryptPayload(sub, payload);
        const r = await this.gate.cross({
          actionId: `push:${row.id}`,
          host: url.host,
          method: "POST",
          path: `${url.pathname}${url.search}`,
          headers: { ...enc.headers, authorization: vapidAuthorization(keys, audienceOf(sub.endpoint), this.subject) },
          bodyBase64: enc.body.toString("base64"),
        });
        // The receipt: which host, how many bytes, and the title. Never the body.
        this.ledger.append({ type: "gate.crossing", householdId, actor: { kind: "core", id: "notifications" }, where: "gate", sensitivity: "normal", target: url.host, sent: `A notification titled "${message.title}" to ${url.host}: ${enc.body.length} encrypted bytes, nothing readable there.`, payload: { capability: "push.send", observed: { status: r.status, bytesOut: r.bytesOut } } });
        if (r.status === 404 || r.status === 410) {
          dropped += 1;
          this.db.update(pushSubscriptions).set({ revokedAt: new Date().toISOString(), failures: row.failures + 1 }).where(eq(pushSubscriptions.id, row.id)).run();
        } else if (r.status >= 200 && r.status < 300) {
          sent += 1;
          this.db.update(pushSubscriptions).set({ lastSentAt: new Date().toISOString(), failures: 0 }).where(eq(pushSubscriptions.id, row.id)).run();
        } else {
          failed += 1;
          this.db.update(pushSubscriptions).set({ failures: row.failures + 1 }).where(eq(pushSubscriptions.id, row.id)).run();
        }
      } catch (err) {
        failed += 1;
        this.db.update(pushSubscriptions).set({ failures: row.failures + 1 }).where(eq(pushSubscriptions.id, row.id)).run();
        this.logger.warn({ host: url.host, err: err instanceof GateError ? err.message : String(err) }, "a notification could not leave");
        if (err instanceof GateError && err.status === 403) return { sent, failed, dropped, skipped: `${url.host} is not on the Gate's allow list` };
        if (err instanceof GateError && err.status === 423) return { sent, failed, dropped, skipped: "the Gate is closed" };
      }
    }
    return { sent, failed, dropped, skipped: null };
  }

  private view(r: typeof pushSubscriptions.$inferSelect): PushSubscriptionView {
    return { id: r.id, host: r.host, label: r.label, createdAt: r.createdAt, lastSentAt: r.lastSentAt, failures: r.failures };
  }
}
