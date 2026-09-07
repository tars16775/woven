import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claimIds, claims, claimsByStatus } from "@/lib/claims";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * The claims registry is what keeps the marketing copy from saying more than
 * the software does. These tests guard the mechanism, not the wording.
 */
describe("the claims registry", () => {
  it("gives every claim a status and a note that says something", () => {
    for (const id of claimIds) {
      const c = claims[id];
      expect(["now", "box", "target"], `${id} has an odd status`).toContain(c.status);
      expect(c.claim.length, `${id} has no claim`).toBeGreaterThan(10);
      expect(c.note.length, `${id} has no note`).toBeGreaterThan(40);
    }
    expect(claimsByStatus("now").length).toBeGreaterThan(5);
    expect(claimsByStatus("box").length).toBeGreaterThan(5);
    expect(claimsByStatus("target").length).toBeGreaterThan(3);
  });

  it("never claims the box exists", () => {
    // Anything that needs hardware has to be "box" or "target", never "now".
    for (const id of ["radios", "cameras", "router", "secureElement", "moduleSwap", "voice", "agents", "homeAssistant"] as const) {
      expect(claims[id].status, `${id} is claimed as shipping`).not.toBe("now");
    }
    // Prices and dates are never presented as settled.
    for (const id of ["price", "delivery", "warranty", "support"] as const) {
      expect(claims[id].status).toBe("target");
    }
  });

  it("keeps every footnote a page references, in the order it is used", () => {
    // Every marketing page that uses the system, found rather than listed.
    const pages = readdirSync(join(root, "src/app/(marketing)"), { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? [`src/app/(marketing)/${e.name}/page.tsx`] : e.name === "page.tsx" ? ["src/app/(marketing)/page.tsx"] : []))
      .filter((p) => existsSync(join(root, p)) && read(p).includes("<Fn notes={notes}"));
    expect(pages.length, "no page uses the footnote system").toBeGreaterThanOrEqual(3);
    for (const page of pages) {
      const src = read(page);
      const declared = /const notes = \[([\s\S]*?)\] as const/.exec(src);
      expect(declared, `${page} declares no notes`).not.toBeNull();
      const ids = [...declared![1]!.matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]!);
      expect(new Set(ids).size, `${page} lists a note twice`).toBe(ids.length);
      for (const id of ids) expect(claimIds, `${page} cites an unknown claim: ${id}`).toContain(id);

      // Every marker in the page body points at a note the page declared.
      for (const m of src.matchAll(/<Fn notes=\{notes\} id="([a-zA-Z]+)"/g)) {
        expect(ids, `${page} marks ${m[1]} without listing it`).toContain(m[1]);
      }
      // Every tag names a real claim.
      for (const m of src.matchAll(/<ClaimTag id="([a-zA-Z]+)"/g)) {
        expect(claimIds, `${page} tags an unknown claim: ${m[1]}`).toContain(m[1]);
      }
    }
  });

  it("says on the landing page that the box is not built", () => {
    const src = read("src/app/(marketing)/page.tsx");
    expect(src).toMatch(/not built yet/);
    expect(src).toMatch(/reservation takes no money/);
    expect(src).toContain('href="/mac"');
    expect(src).toContain('href="/status"');
  });
});
