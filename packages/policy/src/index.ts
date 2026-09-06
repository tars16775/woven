/**
 * @woven/policy
 *
 * The deterministic policy engine. A prompt, a plan or a tool suggestion is
 * never a security boundary; this module is. Given who is asking, what they
 * want, and the state of the house, it returns exactly one decision, and the
 * same inputs always return the same decision.
 *
 * Phase 13 fills in bounds, spend limits and per-household overrides. The
 * class table and the shape of a decision are fixed here so every later
 * phase builds on the same contract.
 */
import type { Namespace, RiskClass, Role } from "@woven/schema";

export type Decision =
  | { outcome: "allow"; reason: string }
  | { outcome: "approve"; reason: string; requires: ApprovalRequirement }
  | { outcome: "deny"; reason: string };

export type ApprovalRequirement = {
  /** Who can approve: any adult, an owner, or the requesting person themselves. */
  by: "self" | "adult" | "owner";
  /** Extra factors the approval must carry. */
  factors: Array<"presence" | "strong_auth">;
  /** How long an approval stays valid, in seconds. */
  ttlSeconds: number;
};

export type PolicyRequest = {
  actor: { kind: "person" | "agent" | "routine" | "core"; id: string; role?: Role };
  riskClass: RiskClass;
  namespace: Namespace;
  /** Whether a household adult is physically present, when known. */
  presence?: boolean | undefined;
  /** For class E: the amount in the household's currency, if any. */
  amount?: number | undefined;
};

export type PolicyContext = {
  /** Class E automatic threshold for adults, in whole currency units. */
  autoApproveAmountUpTo: number;
};

export const defaultContext: PolicyContext = { autoApproveAmountUpTo: 50 };

/** The class table the site publishes. Kept here so code and copy agree. */
export const riskClassTable: Record<RiskClass, { example: string; defaultPolicy: string }> = {
  A: { example: "Read a temperature or device state", defaultPolicy: "Automatic" },
  B: { example: "Lights, media", defaultPolicy: "Automatic" },
  C: { example: "Thermostat within bounds, routines", defaultPolicy: "Automatic within bounds" },
  D: { example: "Unlock a door, disarm", defaultPolicy: "Presence or approval" },
  E: { example: "Place an order", defaultPolicy: "Approval above your limit" },
  F: { example: "Move money", defaultPolicy: "Not supported" },
  G: { example: "Robot uses a dangerous tool", defaultPolicy: "Not supported" },
  H: { example: "Keys, ownership, factory reset", defaultPolicy: "Strong authentication" },
};

/** Namespaces a role may act in without an explicit grant. */
const namespaceAccess: Record<Role, ReadonlySet<Namespace>> = {
  owner: new Set(["household", "personal", "security", "financial", "health", "work", "children", "guest"]),
  adult: new Set(["household", "personal", "security", "financial", "health", "work", "children"]),
  child: new Set(["household", "personal"]),
  guest: new Set(["guest"]),
};

export function evaluate(req: PolicyRequest, ctx: PolicyContext = defaultContext): Decision {
  // Unsupported classes are refused for everyone, always.
  if (req.riskClass === "F") return { outcome: "deny", reason: "Moving money is not supported. Money moves through your bank." };
  if (req.riskClass === "G") return { outcome: "deny", reason: "Dangerous robot actions are not supported. Robots keep their own safety controls." };

  // Non-person actors never get more than a person would, and never class H.
  const role: Role | undefined = req.actor.kind === "person" ? req.actor.role : undefined;
  if (req.actor.kind !== "person" && req.riskClass === "H") {
    return { outcome: "deny", reason: "Administrative actions require a person with strong authentication." };
  }

  // Namespace access.
  if (role && !namespaceAccess[role].has(req.namespace)) {
    return { outcome: "deny", reason: `A ${role} cannot act in the ${req.namespace} namespace.` };
  }
  if (!role && req.namespace !== "household") {
    return { outcome: "deny", reason: `Agents and routines act only in the household namespace unless granted otherwise.` };
  }

  switch (req.riskClass) {
    case "A":
    case "B":
      return { outcome: "allow", reason: "Automatic for this class." };
    case "C":
      return { outcome: "allow", reason: "Automatic within the configured bounds." };
    case "D":
      if (role === "guest") return { outcome: "deny", reason: "Guests cannot unlock or disarm." };
      if (req.presence === true && (role === "owner" || role === "adult")) {
        return { outcome: "allow", reason: "An adult is present." };
      }
      return { outcome: "approve", reason: "Nobody is confirmed present.", requires: { by: "adult", factors: ["presence"], ttlSeconds: 30 } };
    case "E":
      if (role === "guest" || role === "child") return { outcome: "deny", reason: "Purchases are for adults." };
      if (req.actor.kind !== "person") return { outcome: "approve", reason: "Agents prepare orders; a person approves them.", requires: { by: "adult", factors: [], ttlSeconds: 600 } };
      if (req.amount !== undefined && req.amount <= ctx.autoApproveAmountUpTo) {
        return { outcome: "allow", reason: `Under the automatic limit of ${ctx.autoApproveAmountUpTo}.` };
      }
      return { outcome: "approve", reason: "Above the automatic limit.", requires: { by: "self", factors: [], ttlSeconds: 600 } };
    case "H":
      if (role !== "owner") return { outcome: "deny", reason: "Only the owner can change keys, ownership or reset the box." };
      return { outcome: "approve", reason: "Administrative action.", requires: { by: "owner", factors: ["strong_auth"], ttlSeconds: 120 } };
    default:
      return { outcome: "deny", reason: "Unknown risk class." };
  }
}
