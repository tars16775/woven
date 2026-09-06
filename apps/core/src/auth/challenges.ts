import { randomBytes } from "node:crypto";

export type Pending<T> = { value: T; expiresAt: number };

/**
 * Short-lived one-time values: WebAuthn challenges, enrolment tokens for a
 * first passkey, pairing codes. In memory on purpose: they must not survive
 * a restart, and a box has exactly one core process.
 */
export class OneTimeStore<T> {
  private readonly items = new Map<string, Pending<T>>();
  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  put(value: T, key = randomBytes(24).toString("base64url")): string {
    this.sweep();
    this.items.set(key, { value, expiresAt: this.now() + this.ttlMs });
    return key;
  }

  /** Read once; the entry is gone afterwards. */
  take(key: string | undefined): T | null {
    if (!key) return null;
    const hit = this.items.get(key);
    if (!hit) return null;
    this.items.delete(key);
    return hit.expiresAt > this.now() ? hit.value : null;
  }

  peek(key: string | undefined): T | null {
    if (!key) return null;
    const hit = this.items.get(key);
    return hit && hit.expiresAt > this.now() ? hit.value : null;
  }

  get size() {
    this.sweep();
    return this.items.size;
  }

  private sweep() {
    const t = this.now();
    for (const [k, v] of this.items) if (v.expiresAt <= t) this.items.delete(k);
  }
}
