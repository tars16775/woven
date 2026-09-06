import { describe, expect, it } from "vitest";
import { evaluate, type Decision, type PolicyRequest } from "../src/index.ts";

/**
 * Property tests for the permission engine (gap 27): thousands of random
 * requests, a handful of invariants that must hold for every one of them.
 * A small seeded generator keeps the run reproducible without a library.
 */
const ROLES = ["owner", "adult", "child", "guest"] as const;
const KINDS = ["person", "agent", "routine", "core"] as const;
const CLASSES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const NAMESPACES = ["household", "personal", "security", "financial", "health", "work", "children", "guest"] as const;
const CAPABILITIES = [undefined, "light.set", "person.recover", "gate.cross", "household.transfer_ownership"] as const;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

function request(r: () => number): PolicyRequest {
  const kind = pick(r, KINDS);
  const actor: PolicyRequest["actor"] = kind === "person" ? { kind, id: "p", role: pick(r, ROLES) } : { kind, id: "x" };
  const presence = r() < 0.33 ? undefined : r() < 0.5;
  const amount = r() < 0.5 ? undefined : Math.floor(r() * 200);
  const capability = pick(r, CAPABILITIES);
  return { actor, riskClass: pick(r, CLASSES), namespace: pick(r, NAMESPACES), ...(presence !== undefined ? { presence } : {}), ...(amount !== undefined ? { amount } : {}), ...(capability ? { capability } : {}) };
}

const rank = (d: Decision) => (d.outcome === "allow" ? 2 : d.outcome === "approve" ? 1 : 0);

describe("policy invariants over random requests", () => {
  const cases: PolicyRequest[] = [];
  const r = rng(20260906);
  for (let i = 0; i < 5000; i += 1) cases.push(request(r));

  it("is a pure function: the same request always gets the same answer", () => {
    for (const c of cases) expect(evaluate(c)).toEqual(evaluate(c));
  });

  it("never allows F or G, and never lets a non-person near class H", () => {
    for (const c of cases) {
      const d = evaluate(c);
      if (c.riskClass === "F" || c.riskClass === "G") expect(d.outcome).toBe("deny");
      if (c.riskClass === "H" && c.actor.kind !== "person") expect(d.outcome).toBe("deny");
    }
  });

  it("keeps every role inside its namespaces", () => {
    const allowed = { owner: NAMESPACES, adult: ["household", "personal", "security", "financial", "health", "work", "children"], child: ["household", "personal"], guest: ["guest"] } as const;
    for (const c of cases) {
      const d = evaluate(c);
      if (c.actor.kind === "person" && !(allowed[c.actor.role!] as readonly string[]).includes(c.namespace)) expect(d.outcome).toBe("deny");
      if (c.actor.kind !== "person" && c.namespace !== "household") expect(d.outcome).toBe("deny");
    }
  });

  it("an approval always says who, with what, and for how long", () => {
    for (const c of cases) {
      const d = evaluate(c);
      if (d.outcome === "approve") {
        expect(["self", "adult", "owner"]).toContain(d.requires.by);
        expect(d.requires.ttlSeconds).toBeGreaterThan(0);
        expect(d.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it("an adult being present never makes an outcome worse", () => {
    for (const c of cases) {
      const away = evaluate({ ...c, presence: false });
      const home = evaluate({ ...c, presence: true });
      expect(rank(home)).toBeGreaterThanOrEqual(rank(away));
    }
  });

  it("guests never unlock, children never spend, agents never act alone above class C", () => {
    for (const c of cases) {
      const d = evaluate(c);
      if (c.actor.kind === "person" && c.actor.role === "guest" && c.riskClass === "D") expect(d.outcome).toBe("deny");
      if (c.actor.kind === "person" && c.actor.role === "child" && c.riskClass === "E") expect(d.outcome).not.toBe("allow");
      if (c.actor.kind !== "person" && ["D", "E", "H"].includes(c.riskClass)) expect(d.outcome).not.toBe("allow");
    }
  });

  it("class E is automatic only under the limit, and only for adults", () => {
    for (const c of cases) {
      if (c.riskClass !== "E" || c.actor.kind !== "person" || c.namespace !== "household") continue;
      const d = evaluate(c);
      const adult = c.actor.role === "owner" || c.actor.role === "adult";
      if (adult && c.amount !== undefined && c.amount <= 50) expect(d.outcome).toBe("allow");
      if (c.amount !== undefined && c.amount > 50) expect(d.outcome).not.toBe("allow");
    }
  });
});
