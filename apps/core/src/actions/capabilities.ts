import type { Capability, RiskClass } from "@woven/schema";
import { z } from "zod";

/**
 * The capability registry (phase 12). Every side effect the core can cause
 * is one of these: a name, a risk class, a parameter schema, a one-sentence
 * preview a person reads before approving, and how to verify it afterwards.
 * Anything not in this table cannot be executed, whoever asks.
 */
export type CapabilitySpec = Capability & {
  params: z.ZodType;
  /** Which adapter executes it: a device kind, the household, the core, or the Gate. */
  executor: "home" | "household" | "core" | "gate";
  /** Approval regardless of class: crossings always ask first. */
  alwaysApprove?: boolean;
  /** Bounds a class C action must stay inside to be automatic. */
  bounds?: (params: Record<string, unknown>) => string | null;
  preview: (target: string, params: Record<string, unknown>) => string;
};

const Brightness = z.number().min(0).max(100);

const spec = <T extends z.ZodType>(c: Omit<CapabilitySpec, "params" | "preview"> & { params: T; preview: (target: string, params: z.infer<T>) => string }): CapabilitySpec =>
  c as unknown as CapabilitySpec;

export const capabilities: readonly CapabilitySpec[] = [
  spec({
    name: "device.read_state",
    riskClass: "A",
    idempotent: true,
    latency: "realtime",
    description: "Read a device's current state.",
    executor: "home",
    params: z.object({}),
    preview: (t) => `Read the state of ${t}.`,
  }),
  spec({
    name: "light.set",
    riskClass: "B",
    idempotent: true,
    readback: "on,brightness",
    latency: "realtime",
    description: "Turn a light on or off, optionally at a brightness.",
    executor: "home",
    params: z.object({ on: z.boolean(), brightness: Brightness.optional() }),
    preview: (t, p) => (p.on ? `Turn ${t} on${p.brightness !== undefined ? ` at ${p.brightness}%` : ""}.` : `Turn ${t} off.`),
  }),
  spec({
    name: "plug.set",
    riskClass: "B",
    idempotent: true,
    readback: "on",
    latency: "realtime",
    description: "Switch a plug.",
    executor: "home",
    params: z.object({ on: z.boolean() }),
    preview: (t, p) => `Turn ${t} ${p.on ? "on" : "off"}.`,
  }),
  spec({
    name: "media.set",
    riskClass: "B",
    idempotent: true,
    readback: "playing",
    latency: "realtime",
    description: "Play or pause a speaker.",
    executor: "home",
    params: z.object({ playing: z.boolean() }),
    preview: (t, p) => `${p.playing ? "Play" : "Pause"} ${t}.`,
  }),
  spec({
    name: "climate.set_temperature",
    riskClass: "C",
    idempotent: true,
    readback: "setpointC",
    latency: "interactive",
    description: "Set a thermostat within the household's bounds.",
    executor: "home",
    params: z.object({ setpointC: z.number() }),
    bounds: (p) => {
      const v = Number(p.setpointC);
      return v >= 15 && v <= 28 ? null : "Thermostats stay between 15 and 28 °C without approval.";
    },
    preview: (t, p) => `Set ${t} to ${p.setpointC} °C.`,
  }),
  spec({
    name: "routine.run",
    riskClass: "C",
    idempotent: false,
    latency: "interactive",
    description: "Run a routine now.",
    executor: "home",
    params: z.object({}),
    preview: (t) => `Run the ${t} routine now.`,
  }),
  spec({
    name: "lock.lock",
    riskClass: "B",
    idempotent: true,
    readback: "locked",
    latency: "realtime",
    description: "Lock a door.",
    executor: "home",
    params: z.object({}),
    preview: (t) => `Lock ${t}.`,
  }),
  spec({
    name: "lock.unlock",
    riskClass: "D",
    idempotent: true,
    readback: "locked",
    latency: "realtime",
    description: "Unlock a door. Presence or an adult's approval.",
    executor: "home",
    params: z.object({}),
    preview: (t) => `Unlock ${t}.`,
  }),
  spec({
    name: "alarm.disarm",
    riskClass: "D",
    idempotent: true,
    readback: "armed",
    latency: "realtime",
    description: "Disarm the alarm.",
    executor: "home",
    params: z.object({}),
    preview: (t) => `Disarm ${t}.`,
  }),
  spec({
    name: "commerce.order",
    riskClass: "E",
    idempotent: false,
    latency: "background",
    description: "Place an order with a merchant the household set up.",
    executor: "gate",
    params: z.object({ amount: z.number().positive(), currency: z.string().length(3).default("USD"), items: z.array(z.string().max(80)).min(1).max(50) }),
    preview: (t, p) => `Order ${p.items.length} ${p.items.length === 1 ? "item" : "items"} from ${t} for ${p.amount.toFixed(2)} ${p.currency}.`,
  }),
  spec({
    name: "gate.cross",
    riskClass: "C",
    idempotent: false,
    latency: "background",
    description: "Send a task outside through the Gate. Always asks first; the receipt says exactly what left.",
    executor: "gate",
    alwaysApprove: true,
    params: z.object({ host: z.string().min(1), purpose: z.string().min(1).max(120), sent: z.string().min(1).max(500), method: z.enum(["GET", "POST"]).default("POST"), path: z.string().default("/"), body: z.string().max(20000).optional() }),
    preview: (t, p) => `Send to ${p.host} for "${p.purpose}": ${p.sent}`,
  }),
  spec({
    name: "model.install",
    riskClass: "C",
    idempotent: true,
    latency: "background",
    description: "Download a model onto the box through the Gate. Always asks first; the receipt says what came in.",
    executor: "gate",
    alwaysApprove: true,
    params: z.object({ model: z.string().min(1).max(40), approxBytes: z.number().int().nonnegative().default(0) }),
    preview: (_t, p) => `Download the ${p.model.replace(/-/g, " ")} model (about ${Math.round(p.approxBytes / 1024 / 1024)} MB) from huggingface.co through the Gate.`,
  }),
  spec({
    name: "gate.set",
    riskClass: "B",
    idempotent: true,
    readback: "state",
    latency: "realtime",
    description: "Open or close the Gate.",
    executor: "gate",
    params: z.object({ open: z.boolean() }),
    preview: (_t, p) => (p.open ? "Open the Gate. It asks before each crossing." : "Close the Gate. Nothing crosses until it is opened."),
  }),
  spec({
    name: "gate.allow",
    riskClass: "H",
    idempotent: true,
    readback: "allowed",
    latency: "realtime",
    description: "Let crossings reach one more host. The owner confirms with a passkey; nothing an agent can do.",
    executor: "gate",
    params: z.object({ host: z.string().trim().min(1).max(253).regex(/^(\*\.)?[a-z0-9.-]+(:\d+)?$/i), reason: z.string().max(120).optional() }),
    preview: (_t, p) => `Allow crossings to ${p.host}${p.reason ? ` (${p.reason})` : ""}. Every crossing there still asks first.`,
  }),
  spec({
    name: "gate.disallow",
    riskClass: "H",
    idempotent: true,
    readback: "allowed",
    latency: "realtime",
    description: "Take a host off the Gate's allow list.",
    executor: "gate",
    params: z.object({ host: z.string().trim().min(1).max(253) }),
    preview: (_t, p) => `Stop crossings to ${p.host}.`,
  }),
  spec({
    name: "household.transfer_ownership",
    riskClass: "H",
    idempotent: false,
    latency: "interactive",
    description: "Make another adult the owner.",
    executor: "household",
    params: z.object({ toPersonId: z.string().min(1) }),
    preview: (_t, p) => `Transfer ownership of the house to ${p.toPersonId}.`,
  }),
  spec({
    name: "core.factory_reset",
    riskClass: "H",
    idempotent: false,
    latency: "background",
    description: "Erase the household from this box.",
    executor: "core",
    params: z.object({ confirm: z.literal("erase everything") }),
    preview: () => "Erase every person, file, key and receipt from this box.",
  }),
];

const byName = new Map(capabilities.map((c) => [c.name, c]));

export function capability(name: string): CapabilitySpec | null {
  return byName.get(name) ?? null;
}

/** For the site and the Developers page: the public table without executors. */
export function publicCapabilities(): Capability[] {
  return capabilities.map(({ name, riskClass, idempotent, readback, latency, description }) => ({ name, riskClass, idempotent, ...(readback ? { readback } : {}), latency, description }));
}

export const classLabel: Record<RiskClass, string> = { A: "Class A · read", B: "Class B · automatic", C: "Class C · within bounds", D: "Class D · asks first", E: "Class E · approval above your limit", F: "Class F · not supported", G: "Class G · not supported", H: "Class H · strong authentication" };
