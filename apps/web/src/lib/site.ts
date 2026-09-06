export type TierId = "core" | "core-plus" | "core-pro";

export type Tier = {
  id: TierId;
  name: string;
  screenLabel: string;
  eyebrow: string;
  tagline: string;
  priceFrom: number;
  memoryGb: number;
  storageTb: number;
  ethernet: string;
  wifi: string;
  idleWatts: string;
  loadWatts: string;
  modelClass: string;
  households: string;
  cameras: string;
  description: string;
  stats: { label: string; value: string; note?: string }[];
};

export const tiers: Record<TierId, Tier> = {
  core: {
    id: "core",
    name: "Woven Core",
    screenLabel: "WOVEN CORE",
    eyebrow: "32 GB · For one to three people",
    tagline: "Your files, photos, smart home, TV and Wi-Fi, kept inside the house.",
    priceFrom: 899,
    memoryGb: 32,
    storageTb: 1,
    ethernet: "2.5 GbE WAN · 4 × 1 GbE",
    wifi: "Wi-Fi 7 dual-band",
    idleWatts: "8–15 W",
    loadWatts: "≈60 W",
    modelClass: "8–20B",
    households: "1–3 people",
    cameras: "2–4",
    description:
      "Everything a small household keeps and controls, on a box the size of a book. Runs a 20B-class assistant inside, keeps cameras home, and is your router too.",
    stats: [
      { label: "Unified memory", value: "32 GB" },
      { label: "Storage", value: "1 TB", note: "expandable" },
      { label: "Model inside", value: "20B", note: "class" },
      { label: "Wi-Fi", value: "7" },
    ],
  },
  "core-plus": {
    id: "core-plus",
    name: "Woven Core+",
    screenLabel: "WOVEN CORE+",
    eyebrow: "64 GB · For the whole household",
    tagline: "Room for a real assistant, a photo library, a dozen cameras and every screen in the house.",
    priceFrom: 1499,
    memoryGb: 64,
    storageTb: 2,
    ethernet: "10 GbE WAN · 4 × 2.5 GbE",
    wifi: "Wi-Fi 7 tri-band",
    idleWatts: "10–18 W",
    loadWatts: "≈90 W",
    modelClass: "20–32B",
    households: "2–5 people",
    cameras: "8–12",
    description:
      "The box most homes will buy. Sixty-four gigabytes runs 30B-class models with headroom for photo indexing and camera events at the same time, and the router side carries the whole house on Wi-Fi 7.",
    stats: [
      { label: "Unified memory", value: "64 GB" },
      { label: "Storage", value: "2 TB", note: "up to 16 TB" },
      { label: "Model inside", value: "32B", note: "class" },
      { label: "Wi-Fi", value: "7", note: "tri-band" },
    ],
  },
  "core-pro": {
    id: "core-pro",
    name: "Woven Core Pro",
    screenLabel: "WOVEN CORE PRO",
    eyebrow: "128 GB · For 70B-class models, developers and robots",
    tagline: "Several resident models, sixteen cameras, a 10 GbE backbone and a brain for robots.",
    priceFrom: 2499,
    memoryGb: 128,
    storageTb: 4,
    ethernet: "Dual 10 GbE · 4 × 2.5 GbE",
    wifi: "Wi-Fi 7 tri-band",
    idleWatts: "12–22 W",
    loadWatts: "≈140 W",
    modelClass: "70B+",
    households: "5+ / power use",
    cameras: "16+",
    description:
      "One hundred twenty-eight gigabytes for 70B-class models, several agents resident at once, and an endpoint on the inside network that home robots can think against.",
    stats: [
      { label: "Unified memory", value: "128 GB" },
      { label: "Storage", value: "4 TB", note: "up to 16 TB" },
      { label: "Model inside", value: "70B", note: "class" },
      { label: "Ethernet", value: "10", note: "GbE ×2" },
    ],
  },
};

export const tierOrder: TierId[] = ["core", "core-plus", "core-pro"];

export const nav = {
  center: [
    { label: "Core", href: "/core-plus" },
    { label: "Tandem", href: "/tandem" },
    { label: "Home", href: "/home" },
    { label: "Privacy", href: "/privacy" },
    { label: "Shop", href: "/order" },
  ],
  right: [
    { label: "Support", href: "/support" },
    { label: "Sign in", href: "/login" },
  ],
};

export const footerLinks = [
  { label: "Woven © 2026", href: "/" },
  { label: "Privacy & Legal", href: "/legal" },
  { label: "Founding Homes", href: "/founding-homes" },
  { label: "Support", href: "/support" },
  { label: "Press", href: "/press" },
  { label: "Careers", href: "/careers" },
  { label: "Developers", href: "/developers" },
  { label: "Woven on your Mac", href: "/mac" },
  { label: "Contact", href: "/contact" },
];

/** The architectural claim the whole pitch rests on. */
export const sides = {
  inside: {
    title: "Inside",
    line: "Has no path to the internet.",
    items: ["Your files and backups", "Photos, indexed by what is in them", "Cameras and their clips", "Lights, locks, sensors, routines", "Tandem and its memory", "Woven on your TV"],
  },
  gate: {
    title: "The Gate",
    line: "Only what you approve crosses, and it is written down.",
    items: ["Crossings you approve, one at a time", "Signed updates, verified before they cross", "Your key, when you reach home from away"],
  },
  outside: {
    title: "Outside",
    line: "Is your router.",
    items: ["Wi-Fi 7 for the whole house", "10 GbE to the internet", "A guest network that sees nothing inside", "Per-device rules and schedules"],
  },
};

export function formatPrice(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
