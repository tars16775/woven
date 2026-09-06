import type Database from "better-sqlite3-multiple-ciphers";
import type { Namespace, Person, SearchResult } from "@woven/schema";
import { isNull } from "drizzle-orm";
import type { Db } from "./db/index.ts";
import { files, memories, routines } from "./db/schema.ts";
import type { HouseholdService } from "./household.ts";

type Row = { kind: "file" | "memory" | "routine"; id: string; household_id: string; owner_id: string; namespace: string; title: string; extra: string; snippet: string; rank: number };

/**
 * Search on the box (gap 18): one FTS5 table over file names and paths,
 * memories and routines, in the encrypted database like everything else.
 * Results are filtered by the same rules as the screens: a file only if the
 * reader may open it, a memory only for the person it belongs to. Nothing
 * reads inside documents yet; that arrives with the on-box model.
 */
export class SearchIndex {
  private readonly put: Database.Statement;
  private readonly del: Database.Statement;
  private readonly find: Database.Statement;
  private readonly countKind: Database.Statement;

  constructor(
    private readonly sqlite: Database.Database,
    private readonly db: Db,
    private readonly household: HouseholdService,
  ) {
    sqlite.exec("CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(kind UNINDEXED, id UNINDEXED, household_id UNINDEXED, owner_id UNINDEXED, namespace UNINDEXED, title, body, extra UNINDEXED, tokenize='unicode61 remove_diacritics 2')");
    this.put = sqlite.prepare("INSERT INTO search (kind, id, household_id, owner_id, namespace, title, body, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    this.del = sqlite.prepare("DELETE FROM search WHERE kind = ? AND id = ?");
    this.find = sqlite.prepare("SELECT kind, id, household_id, owner_id, namespace, title, extra, snippet(search, -1, '[', ']', '…', 10) AS snippet, bm25(search, 0, 0, 0, 0, 0, 3.0, 1.0) AS rank FROM search WHERE search MATCH ? AND household_id = ? ORDER BY rank LIMIT ?");
    this.countKind = sqlite.prepare("SELECT count(*) AS n FROM search WHERE kind = ?");
  }

  indexFile(f: { id: string; householdId: string; ownerId: string; namespace: string; name: string; path: string; source: string | null; mime: string | null }): void {
    this.del.run("file", f.id);
    this.put.run("file", f.id, f.householdId, f.ownerId, f.namespace, f.name, `${f.path.replace(/\//g, " ")} ${f.source ?? ""} ${f.mime ?? ""}`.trim(), JSON.stringify({ path: f.path }));
  }
  removeFile(id: string): void {
    this.del.run("file", id);
  }
  indexMemory(m: { id: string; householdId: string; personId: string; text: string; kind: string }): void {
    this.del.run("memory", m.id);
    this.put.run("memory", m.id, m.householdId, m.personId, "personal", m.text, m.kind, "{}");
  }
  removeMemory(id: string): void {
    this.del.run("memory", id);
  }
  indexRoutine(r: { id: string; householdId: string; createdBy: string; name: string; trigger: string; steps: string }): void {
    this.del.run("routine", r.id);
    let body = "";
    try {
      const t = JSON.parse(r.trigger) as { kind?: string; phrase?: string };
      const steps = JSON.parse(r.steps) as { capability?: string; target?: string }[];
      body = [t.kind, t.phrase, ...steps.flatMap((s) => [s.capability, s.target])].filter(Boolean).join(" ");
    } catch {
      // an older row; the name still indexes
    }
    this.put.run("routine", r.id, r.householdId, r.createdBy, "household", r.name, body, "{}");
  }
  removeRoutine(id: string): void {
    this.del.run("routine", id);
  }

  /** Rebuild from the tables when the index is empty or has drifted; safe at every start. */
  reindexIfNeeded(): { files: number; memories: number; routines: number } | null {
    const liveFiles = this.db.select({ id: files.id }).from(files).where(isNull(files.deletedAt)).all().length;
    const liveMemories = this.db.select({ id: memories.id }).from(memories).where(isNull(memories.deletedAt)).all().length;
    const liveRoutines = this.db.select({ id: routines.id }).from(routines).all().length;
    const n = (kind: string) => (this.countKind.get(kind) as { n: number }).n;
    if (n("file") === liveFiles && n("memory") === liveMemories && n("routine") === liveRoutines) return null;
    return this.reindex();
  }

  reindex(): { files: number; memories: number; routines: number } {
    const tx = this.sqlite.transaction(() => {
      this.sqlite.exec("DELETE FROM search");
      const fs = this.db.select().from(files).where(isNull(files.deletedAt)).all();
      for (const f of fs) this.indexFile(f);
      const ms = this.db.select().from(memories).where(isNull(memories.deletedAt)).all();
      for (const m of ms) this.indexMemory(m);
      const rs = this.db.select().from(routines).all();
      for (const r of rs) this.indexRoutine(r);
      return { files: fs.length, memories: ms.length, routines: rs.length };
    });
    return tx();
  }

  search(reader: Person, query: string, limit = 20): SearchResult[] {
    const match = toMatch(query);
    if (!match) return [];
    const rows = this.find.all(match, reader.householdId, limit * 4) as Row[];
    const out: SearchResult[] = [];
    for (const r of rows) {
      if (r.kind === "file" && !this.household.canRead(reader, r.namespace as Namespace, r.owner_id)) continue;
      if (r.kind === "memory" && r.owner_id !== reader.id) continue;
      if (r.kind === "routine" && reader.role === "guest") continue;
      const extra = JSON.parse(r.extra || "{}") as { path?: string };
      out.push({
        kind: r.kind,
        id: r.id,
        title: r.title,
        snippet: r.snippet,
        namespace: r.kind === "file" ? (r.namespace as Namespace) : null,
        href: r.kind === "file" ? `/dashboard/files?ns=${r.namespace}&path=${encodeURIComponent(extra.path ?? "/")}` : r.kind === "memory" ? "/dashboard/privacy" : "/dashboard/home",
      });
      if (out.length >= limit) break;
    }
    return out;
  }
}

/** Words become prefix terms, so "lea" finds "Lease"; FTS syntax characters are dropped rather than interpreted. */
export function toMatch(query: string): string | null {
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (!words.length) return null;
  return words.map((w) => `"${w}"*`).join(" ");
}
