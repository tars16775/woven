import type { TierId } from "./site";

export type StorageOption = { id: string; label: string; tb: number; price: number };
export type CloudPlan = { id: string; label: string; detail: string; monthly: number };
export type Addon = { id: string; label: string; detail: string; price: number };

export const storageOptions: Record<TierId, StorageOption[]> = {
  core: [
    { id: "1tb", label: "1 TB", tb: 1, price: 0 },
    { id: "2tb", label: "2 TB", tb: 2, price: 120 },
    { id: "4tb", label: "4 TB", tb: 4, price: 320 },
  ],
  "core-plus": [
    { id: "2tb", label: "2 TB", tb: 2, price: 0 },
    { id: "4tb", label: "4 TB", tb: 4, price: 200 },
    { id: "8tb", label: "8 TB", tb: 8, price: 520 },
  ],
  "core-pro": [
    { id: "4tb", label: "4 TB", tb: 4, price: 0 },
    { id: "8tb", label: "8 TB", tb: 8, price: 320 },
    { id: "16tb", label: "16 TB", tb: 16, price: 900 },
  ],
};

export const cloudPlans: CloudPlan[] = [
  { id: "none", label: "Local only", detail: "No cloud account. Everything stays on the box.", monthly: 0 },
  {
    id: "burst",
    label: "Gate crossings",
    detail: "Frontier models for deep research and big jobs, each crossing approved by you and recorded. First year included.",
    monthly: 8,
  },
];

export const addons: Addon[] = [
  { id: "zwave", label: "Z-Wave radio", detail: "USB coordinator for installed-base devices.", price: 69 },
  { id: "ups", label: "Backup power", detail: "Clean shutdown through a power cut. 600 VA.", price: 129 },
  { id: "setup", label: "Home setup visit", detail: "A person comes and pairs everything. Select cities.", price: 249 },
];

export const finishes = [
  { id: "bone", label: "Bone", swatch: "#e2e0da" },
  { id: "graphite", label: "Graphite", swatch: "#2a2a29" },
] as const;

export type FinishId = (typeof finishes)[number]["id"];

/** Refundable deposit, taken only when reservations open. Nothing is charged today. */
export const deposit = 100;

/**
 * Per-model delivery estimates. Core+ and Pro ship in the first run (Q3 2027,
 * see the Founding Homes plan); Core follows on the same board once the first
 * thousand are out.
 */
export const estimatedDelivery: Record<TierId, string> = {
  core: "Q4 2027",
  "core-plus": "Q3 2027",
  "core-pro": "Q3 2027",
};
