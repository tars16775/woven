import type { TierId } from "./site";

export type SpecRow = { label: string; values: Record<TierId, string> };
export type SpecGroup = { title: string; rows: SpecRow[] };

/** Full specification sheet. Values are reference-design targets. */
export const specGroups: SpecGroup[] = [
  {
    title: "Compute module",
    rows: [
      {
        label: "Processor class",
        values: {
          core: "Ryzen AI 9 HX 370 class · 12 cores",
          "core-plus": "Ryzen AI Max 390 class · 12 cores · 32 CU GPU",
          "core-pro": "Ryzen AI Max+ 395 class · 16 cores · 40 CU GPU",
        },
      },
      {
        label: "Unified memory",
        values: { core: "32 GB LPDDR5X", "core-plus": "64 GB LPDDR5X-8000", "core-pro": "128 GB LPDDR5X-8000" },
      },
      {
        label: "NPU",
        values: { core: "50 TOPS", "core-plus": "50 TOPS", "core-pro": "50 TOPS" },
      },
      {
        label: "Resident model, inside",
        values: { core: "8–20B class", "core-plus": "20–32B class", "core-pro": "70B+ class, several at once" },
      },
      {
        label: "Module swap",
        values: { core: "Tool-less, 60 seconds", "core-plus": "Tool-less, 60 seconds", "core-pro": "Tool-less, 60 seconds" },
      },
    ],
  },
  {
    title: "Storage",
    rows: [
      { label: "Included", values: { core: "1 TB NVMe", "core-plus": "2 TB NVMe", "core-pro": "4 TB NVMe" } },
      { label: "Bays", values: { core: "2 × M.2, tool-less", "core-plus": "2 × M.2, tool-less", "core-pro": "2 × M.2, tool-less" } },
      { label: "Maximum", values: { core: "8 TB", "core-plus": "16 TB", "core-pro": "16 TB" } },
      {
        label: "Encryption",
        values: {
          core: "At rest by default, keys in secure element",
          "core-plus": "At rest by default, keys in secure element",
          "core-pro": "At rest by default, keys in secure element",
        },
      },
    ],
  },
  {
    title: "Outside · the router",
    rows: [
      { label: "Wi-Fi", values: { core: "Wi-Fi 7 dual-band", "core-plus": "Wi-Fi 7 tri-band", "core-pro": "Wi-Fi 7 tri-band" } },
      { label: "Internet port", values: { core: "2.5 GbE WAN", "core-plus": "10 GbE WAN", "core-pro": "Dual 10 GbE WAN" } },
      { label: "Wired ports", values: { core: "4 × 1 GbE", "core-plus": "4 × 2.5 GbE", "core-pro": "4 × 2.5 GbE" } },
      { label: "Guest network", values: { core: "Isolated, sees nothing inside", "core-plus": "Isolated, sees nothing inside", "core-pro": "Isolated, sees nothing inside" } },
      { label: "Runs on", values: { core: "Its own network processor", "core-plus": "Its own network processor", "core-pro": "Its own network processor" } },
    ],
  },
  {
    title: "The Gate",
    rows: [
      { label: "Inside to internet", values: { core: "No route. Hardware-isolated.", "core-plus": "No route. Hardware-isolated.", "core-pro": "No route. Hardware-isolated." } },
      { label: "What crosses", values: { core: "Approved tasks, signed updates, your key", "core-plus": "Approved tasks, signed updates, your key", "core-pro": "Approved tasks, signed updates, your key" } },
      { label: "Record", values: { core: "Every crossing, on the screen", "core-plus": "Every crossing, on the screen", "core-pro": "Every crossing, on the screen" } },
      { label: "Remote access", values: { core: "Outbound only, no port forwarding", "core-plus": "Outbound only, no port forwarding", "core-pro": "Outbound only, no port forwarding" } },
    ],
  },
  {
    title: "TV",
    rows: [
      { label: "Output", values: { core: "HDMI 2.1 · 4K at 60", "core-plus": "HDMI 2.1 · 4K at 120 · HDR", "core-pro": "HDMI 2.1 · 4K at 120 · HDR" } },
      { label: "On the screen", values: { core: "Photos, movies, cameras, Ask", "core-plus": "Photos, movies, cameras, Ask", "core-pro": "Photos, movies, cameras, Ask" } },
      { label: "Remote", values: { core: "Your phone, or voice", "core-plus": "Your phone, or voice", "core-pro": "Your phone, or voice" } },
      { label: "Price", values: { core: "Included", "core-plus": "Included", "core-pro": "Included" } },
    ],
  },
  {
    title: "Home radios",
    rows: [
      { label: "Matter / Thread", values: { core: "Built in", "core-plus": "Built in", "core-pro": "Built in" } },
      { label: "Zigbee", values: { core: "Built in", "core-plus": "Built in", "core-pro": "Built in" } },
      { label: "Z-Wave", values: { core: "USB, by region", "core-plus": "USB, by region", "core-pro": "USB, by region" } },
      { label: "Cameras", values: { core: "2–4 streams", "core-plus": "8–12 streams", "core-pro": "16+ streams" } },
    ],
  },
  {
    title: "Ports and display",
    rows: [
      { label: "USB4", values: { core: "2 × 40 Gbps", "core-plus": "2 × 40 Gbps", "core-pro": "2 × 40 Gbps" } },
      { label: "USB-A", values: { core: "2", "core-plus": "2", "core-pro": "2" } },
      { label: "HDMI to TV", values: { core: "2.1", "core-plus": "2.1", "core-pro": "2.1" } },
      { label: "External GPU", values: { core: "None", "core-plus": "OCuLink", "core-pro": "OCuLink" } },
      {
        label: "Front display",
        values: {
          core: '5" 800 × 480 touch',
          "core-plus": '5" 800 × 480 touch',
          "core-pro": '5" 800 × 480 touch',
        },
      },
    ],
  },
  {
    title: "Power, acoustics, size",
    rows: [
      { label: "Adapter", values: { core: "120 W USB-C PD", "core-plus": "180 W USB-C PD", "core-pro": "240 W USB-C PD" } },
      { label: "Idle", values: { core: "8–15 W", "core-plus": "10–18 W", "core-pro": "12–22 W" } },
      { label: "AI load", values: { core: "≈60 W", "core-plus": "≈90 W", "core-pro": "≈140 W" } },
      { label: "Noise", values: { core: "< 25 dBA", "core-plus": "< 25 dBA", "core-pro": "< 28 dBA" } },
      { label: "Dimensions", values: { core: "18 × 18 × 16 cm", "core-plus": "18 × 18 × 16 cm", "core-pro": "18 × 18 × 16 cm" } },
      { label: "Weight", values: { core: "2.2 kg", "core-plus": "2.4 kg", "core-pro": "2.5 kg" } },
    ],
  },
  {
    title: "Security and support",
    rows: [
      {
        label: "Root of trust",
        values: {
          core: "Secure element + TPM 2.0",
          "core-plus": "Secure element + TPM 2.0",
          "core-pro": "Secure element + TPM 2.0",
        },
      },
      { label: "Boot", values: { core: "Secure, measured, signed", "core-plus": "Secure, measured, signed", "core-pro": "Secure, measured, signed" } },
      { label: "Updates", values: { core: "Signed A/B with rollback", "core-plus": "Signed A/B with rollback", "core-pro": "Signed A/B with rollback" } },
      { label: "Warranty", values: { core: "2 years", "core-plus": "2 years", "core-pro": "2 years" } },
      { label: "OS updates", values: { core: "Lifetime", "core-plus": "Lifetime", "core-pro": "Lifetime" } },
    ],
  },
];

export const compareRows: { label: string; key: keyof typeof compareValues }[] = [
  { label: "Unified memory", key: "memory" },
  { label: "Storage included", key: "storage" },
  { label: "Model class, inside", key: "model" },
  { label: "Cameras", key: "cameras" },
  { label: "Wi-Fi router", key: "wifi" },
  { label: "Internet port", key: "ethernet" },
  { label: "TV output", key: "tv" },
  { label: "External GPU", key: "egpu" },
  { label: "Best for", key: "bestFor" },
];

export const compareValues = {
  memory: { core: "32 GB", "core-plus": "64 GB", "core-pro": "128 GB" },
  storage: { core: "1 TB", "core-plus": "2 TB", "core-pro": "4 TB" },
  model: { core: "20B", "core-plus": "32B", "core-pro": "70B+" },
  cameras: { core: "2–4", "core-plus": "8–12", "core-pro": "16+" },
  ethernet: { core: "2.5 GbE", "core-plus": "10 GbE", "core-pro": "Dual 10 GbE" },
  wifi: { core: "Wi-Fi 7 dual-band", "core-plus": "Wi-Fi 7 tri-band", "core-pro": "Wi-Fi 7 tri-band" },
  tv: { core: "4K60", "core-plus": "4K120 HDR", "core-pro": "4K120 HDR" },
  egpu: { core: "None", "core-plus": "OCuLink", "core-pro": "OCuLink" },
  bestFor: {
    core: "Smart home and household files",
    "core-plus": "The whole household",
    "core-pro": "Power users, developers, robots",
  },
} satisfies Record<string, Record<TierId, string>>;
