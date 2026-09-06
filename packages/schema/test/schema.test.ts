import { describe, expect, it } from "vitest";
import { CapabilityName, EventEnvelope, RiskClass, Ulid } from "../src/index.ts";

describe("@woven/schema", () => {
  it("accepts a ULID and rejects other ids", () => {
    expect(Ulid.safeParse("01J9Z0G0000000000000000000").success).toBe(true);
    expect(Ulid.safeParse("not-a-ulid").success).toBe(false);
    expect(Ulid.safeParse("01J9Z0G000000000000000000I").success).toBe(false); // I is not in Crockford base32
  });

  it("requires capability names shaped as domain.action", () => {
    expect(CapabilityName.safeParse("light.set_brightness").success).toBe(true);
    expect(CapabilityName.safeParse("home.lock.unlock").success).toBe(true);
    expect(CapabilityName.safeParse("Light").success).toBe(false);
    expect(CapabilityName.safeParse("light.").success).toBe(false);
  });

  it("knows the eight risk classes and nothing else", () => {
    expect(RiskClass.options).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(RiskClass.safeParse("I").success).toBe(false);
  });

  it("defaults sensitivity and payload on the event envelope", () => {
    const parsed = EventEnvelope.parse({
      id: "01J9Z0G0000000000000000000",
      type: "core.started",
      occurredAt: new Date().toISOString(),
      householdId: "01J9Z0G0000000000000000001",
      actor: { kind: "core", id: "core" },
      where: "inside",
    });
    expect(parsed.sensitivity).toBe("normal");
    expect(parsed.payload).toEqual({});
  });
});
