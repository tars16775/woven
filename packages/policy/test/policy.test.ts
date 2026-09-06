import { describe, expect, it } from "vitest";
import { evaluate, type PolicyRequest } from "../src/index.ts";

const alex = { kind: "person", id: "alex", role: "owner" } as const;
const maya = { kind: "person", id: "maya", role: "adult" } as const;
const guest = { kind: "person", id: "guest", role: "guest" } as const;
const grocer = { kind: "agent", id: "grocer" } as const;

const req = (over: Partial<PolicyRequest>): PolicyRequest => ({
  actor: alex,
  riskClass: "B",
  namespace: "household",
  ...over,
});

describe("@woven/policy", () => {
  it("is deterministic", () => {
    const r = req({ riskClass: "D", presence: false });
    expect(evaluate(r)).toEqual(evaluate(r));
  });

  it("never allows F or G, for anyone", () => {
    expect(evaluate(req({ riskClass: "F" })).outcome).toBe("deny");
    // Class H is the owner's, except rescuing a locked-out person, which any trusted adult may do with a passkey.
    expect(evaluate({ ...req({ riskClass: "H" }), actor: { kind: "person", id: "a", role: "adult" } }).outcome).toBe("deny");
    expect(evaluate({ ...req({ riskClass: "H" }), capability: "person.recover", actor: { kind: "person", id: "a", role: "adult" } })).toMatchObject({ outcome: "approve", requires: { by: "adult", factors: ["strong_auth"] } });
    expect(evaluate({ ...req({ riskClass: "H" }), capability: "person.recover", actor: { kind: "person", id: "c", role: "child" } }).outcome).toBe("deny");
    expect(evaluate(req({ riskClass: "G", actor: maya })).outcome).toBe("deny");
  });

  it("lets adults act on lights automatically", () => {
    expect(evaluate(req({ actor: maya })).outcome).toBe("allow");
  });

  it("unlocks only with presence, otherwise asks an adult", () => {
    expect(evaluate(req({ riskClass: "D", presence: true })).outcome).toBe("allow");
    const d = evaluate(req({ riskClass: "D", presence: false }));
    expect(d.outcome).toBe("approve");
    if (d.outcome === "approve") expect(d.requires.factors).toContain("presence");
    expect(evaluate(req({ riskClass: "D", actor: guest, namespace: "guest" })).outcome).toBe("deny");
  });

  it("applies the spend limit for class E and always asks for agents", () => {
    expect(evaluate(req({ riskClass: "E", amount: 23.4 })).outcome).toBe("allow");
    expect(evaluate(req({ riskClass: "E", amount: 80 })).outcome).toBe("approve");
    expect(evaluate(req({ riskClass: "E", actor: grocer, amount: 10 })).outcome).toBe("approve");
  });

  it("keeps namespaces real", () => {
    expect(evaluate(req({ actor: guest, namespace: "household" })).outcome).toBe("deny");
    expect(evaluate(req({ actor: maya, namespace: "financial", riskClass: "A" })).outcome).toBe("allow");
    expect(evaluate(req({ actor: grocer, namespace: "personal", riskClass: "A" })).outcome).toBe("deny");
  });

  it("reserves class H for the owner with strong authentication", () => {
    expect(evaluate(req({ riskClass: "H", actor: maya })).outcome).toBe("deny");
    const h = evaluate(req({ riskClass: "H" }));
    expect(h.outcome).toBe("approve");
    if (h.outcome === "approve") expect(h.requires.factors).toContain("strong_auth");
    expect(evaluate(req({ riskClass: "H", actor: grocer })).outcome).toBe("deny");
  });
});
