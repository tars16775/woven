/**
 * Mock household state for the dashboard. Shapes here are the contract the
 * backend will fulfil in the next phase; nothing in the UI reaches past them.
 */

export type Where = "local" | "cloud" | "device" | "policy";

export type Person = {
  id: string;
  name: string;
  role: "owner" | "adult" | "child" | "guest";
  initial: string;
  devices: number;
  lastBackup: string;
};

export type ActivityItem = {
  id: string;
  time: string; // HH:MM
  day: "today" | "yesterday";
  kind: "tandem" | "cameras" | "backup" | "gate" | "home" | "agent" | "core";
  title: string;
  detail: string;
  where: Where;
  actor: string;
  sent?: string;
};

export type DeviceKind = "light" | "plug" | "thermostat" | "lock" | "sensor" | "camera" | "robot" | "speaker";

export type Device = {
  id: string;
  name: string;
  kind: DeviceKind;
  protocol: string;
  on?: boolean;
  value?: string;
  reachable: boolean;
  riskClass: "A" | "B" | "C" | "D";
};

export type Room = { id: string; name: string; occupied: boolean; devices: Device[] };

export type Routine = {
  id: string;
  name: string;
  trigger: string;
  actions: string;
  lastRun: string;
  enabled: boolean;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  runtime: string;
  scopes: string[];
  state: "active" | "paused";
  actions7d: number;
  lastAction: string;
  limits?: string;
};

export type Folder = { name: string; items: number; size: string; synced: string; kind: "folder" | "device" };

export type Camera = { id: string; name: string; live: boolean; lastEvent: string; retentionDays: number };

export type Suggestion = { id: string; title: string; detail: string; action: string };

export const household = {
  name: "Alex's house",
  city: "Tampa",
  tier: "core-plus" as const,
  screenLabel: "WOVEN CORE+",
};

export const people: Person[] = [
  { id: "alex", name: "Alex", role: "owner", initial: "A", devices: 3, lastBackup: "2 h ago" },
  { id: "maya", name: "Maya", role: "adult", initial: "M", devices: 2, lastBackup: "6 days ago" },
  { id: "sam", name: "Sam", role: "adult", initial: "S", devices: 2, lastBackup: "Today, 14:05" },
];

export const core = {
  version: "Woven OS 0.4.1",
  model: "gpt-oss-20b",
  memoryUsedGb: 38,
  memoryGb: 64,
  storageUsedTb: 1.2,
  storageTb: 2,
  tempC: 41,
  fan: "quiet",
  uptime: "23 days",
  module: { name: "Compute Module A1", soc: "Ryzen AI Max 390 class", memory: "64 GB LPDDR5X", installed: "Aug 12, 2026" },
  drives: [
    { bay: "Bay 1", size: "2 TB", health: "Good", used: 1.2 },
    { bay: "Bay 2", size: "Empty", health: "—", used: 0 },
  ],
  radios: [
    { name: "Thread", state: "Border router · 9 devices" },
    { name: "Zigbee", state: "Coordinator · 11 devices" },
    { name: "Matter", state: "Controller · 14 devices" },
    { name: "Bluetooth", state: "Idle" },
  ],
  /** The four rows of the Core+ network: two networks, one Gate, one way in. */
  network: {
    inside: { label: "Inside", value: "Wired 2.5 GbE ports · no internet route" },
    outside: { label: "Outside", value: "10 GbE WAN up · 1.2 Gbps · 41 ms", second: "Wi-Fi 7 tri-band · 3 clients" },
    gate: { label: "Gate", value: "Open · asks first · 3 crossings this week", closed: "Closed · nothing crosses" },
    remote: { label: "Remote", value: "Through the Gate with your key · outbound only" },
  },
  update: { available: false, channel: "Founding Homes", lastInstalled: "Sep 1, 2026", slot: "A (B ready)" },
  gateOpen: true,
  insideShare7d: 99.6,
  crossings7d: 3,
  bytesCrossedToday: 0,
};

export const suggestions: Suggestion[] = [
  { id: "lease", title: "Your lease renews in 12 days.", detail: "I found the PDF and last year's rent. Want a summary?", action: "Summarise" },
  { id: "backup", title: "Maya's laptop hasn't backed up in 6 days.", detail: "Remind her, or back up over Wi-Fi tonight?", action: "Back up tonight" },
  { id: "storage", title: "Bay 2 is empty.", detail: "Photos are growing 40 GB a month. A second drive would give you four years.", action: "See drives" },
];

export const activity: ActivityItem[] = [
  { id: "a1", time: "21:40", day: "today", kind: "tandem", title: "Tandem", detail: "Answered Maya: “When is the dentist?” from the household calendar", where: "local", actor: "Maya" },
  { id: "a2", time: "21:12", day: "today", kind: "home", title: "Goodnight scene", detail: "6 lights off · thermostat 19 °C · front door verified locked", where: "device", actor: "Routine" },
  { id: "a3", time: "18:12", day: "today", kind: "cameras", title: "Cameras", detail: "Package at the front door · clip saved inside", where: "local", actor: "Front door" },
  { id: "a4", time: "14:05", day: "today", kind: "backup", title: "Backup", detail: "Sam's laptop: 4.1 GB synced · photos indexed (312 new)", where: "local", actor: "Sam" },
  { id: "a5", time: "11:20", day: "today", kind: "agent", title: "Grocer", detail: "Prepared an order: oat milk, coffee, dish soap · $23.40 · under limit, auto-approved", where: "policy", actor: "Agent" },
  { id: "a6", time: "09:30", day: "today", kind: "gate", title: "Crossing", detail: "Deep research: “compare heat pumps” · 1 task sent, no personal data", where: "cloud", actor: "Alex", sent: "Task text · house size (1,900 sq ft) · city (Tampa)" },
  { id: "a7", time: "07:02", day: "today", kind: "core", title: "Core", detail: "Nightly integrity check passed · 0 errors · 41 °C", where: "local", actor: "Core" },
  { id: "b1", time: "22:31", day: "yesterday", kind: "home", title: "Unlock request", detail: "Sam asked to unlock the front door from outside · approved by Alex on the screen", where: "policy", actor: "Sam" },
  { id: "b2", time: "19:48", day: "yesterday", kind: "gate", title: "Crossing", detail: "Video generation declined · kept inside", where: "local", actor: "Maya" },
  { id: "b3", time: "16:10", day: "yesterday", kind: "agent", title: "Sweep", detail: "Cleaned kitchen and hallway after the house emptied · 34 min", where: "device", actor: "Agent" },
  { id: "b4", time: "08:15", day: "yesterday", kind: "gate", title: "Crossing", detail: "Deep research: “school holiday dates 2027” · 1 task sent", where: "cloud", actor: "Alex", sent: "Task text · county" },
];

export const rooms: Room[] = [
  {
    id: "living",
    name: "Living room",
    occupied: true,
    devices: [
      { id: "l1", name: "Ceiling", kind: "light", protocol: "Matter · Thread", on: true, value: "72%", reachable: true, riskClass: "B" },
      { id: "l2", name: "Floor lamp", kind: "light", protocol: "Zigbee", on: true, value: "40%", reachable: true, riskClass: "B" },
      { id: "s1", name: "Speaker", kind: "speaker", protocol: "LAN", on: false, reachable: true, riskClass: "B" },
      { id: "t1", name: "Thermostat", kind: "thermostat", protocol: "Matter", value: "21 °C", reachable: true, riskClass: "C" },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    occupied: false,
    devices: [
      { id: "k1", name: "Main", kind: "light", protocol: "Matter · Thread", on: false, value: "0%", reachable: true, riskClass: "B" },
      { id: "k2", name: "Under-cabinet", kind: "light", protocol: "Zigbee", on: false, reachable: true, riskClass: "B" },
      { id: "k3", name: "Kettle plug", kind: "plug", protocol: "Matter", on: false, reachable: true, riskClass: "B" },
      { id: "k4", name: "Motion", kind: "sensor", protocol: "Zigbee", value: "Clear · 2 h", reachable: true, riskClass: "A" },
    ],
  },
  {
    id: "entry",
    name: "Entry",
    occupied: false,
    devices: [
      { id: "e1", name: "Front door", kind: "lock", protocol: "Matter", value: "Locked", reachable: true, riskClass: "D" },
      { id: "e2", name: "Porch", kind: "light", protocol: "Matter", on: true, value: "30%", reachable: true, riskClass: "B" },
      { id: "e3", name: "Door contact", kind: "sensor", protocol: "Thread", value: "Closed", reachable: true, riskClass: "A" },
      { id: "e4", name: "Front door camera", kind: "camera", protocol: "RTSP", reachable: true, riskClass: "A" },
    ],
  },
  {
    id: "bed",
    name: "Bedroom",
    occupied: true,
    devices: [
      { id: "b1", name: "Bedside", kind: "light", protocol: "Zigbee", on: true, value: "15%", reachable: true, riskClass: "B" },
      { id: "b2", name: "Fan plug", kind: "plug", protocol: "Matter", on: true, reachable: true, riskClass: "B" },
      { id: "b3", name: "Temperature", kind: "sensor", protocol: "Thread", value: "20.5 °C", reachable: true, riskClass: "A" },
    ],
  },
  {
    id: "office",
    name: "Office",
    occupied: false,
    devices: [
      { id: "o1", name: "Desk lamp", kind: "light", protocol: "Matter", on: false, reachable: false, riskClass: "B" },
      { id: "o2", name: "Robot vacuum", kind: "robot", protocol: "LAN", value: "Docked · 100%", reachable: true, riskClass: "B" },
    ],
  },
];

export const routines: Routine[] = [
  { id: "r1", name: "Goodnight", trigger: "22:30, or “goodnight”", actions: "Lights off · thermostat 19 °C · lock front door", lastRun: "Today 21:12", enabled: true },
  { id: "r2", name: "Leaving", trigger: "Everyone away · or “I'm leaving”", actions: "Lights off · thermostat 18 °C · lock · cameras armed", lastRun: "Yesterday 08:40", enabled: true },
  { id: "r3", name: "Arrive", trigger: "First person home", actions: "Porch on · hallway 40% · thermostat 21 °C", lastRun: "Yesterday 17:55", enabled: true },
  { id: "r4", name: "Clean while empty", trigger: "House empty for 30 min · weekdays", actions: "Sweep cleans kitchen and hallway", lastRun: "Yesterday 16:10", enabled: true },
  { id: "r5", name: "Movie", trigger: "“movie time”", actions: "Living room 10% · blinds down · speaker on", lastRun: "3 days ago", enabled: false },
];

export const agents: Agent[] = [
  { id: "tandem", name: "Tandem", role: "Household assistant", runtime: "built in", scopes: ["Calendar", "Files", "Photos", "Home", "Memory"], state: "active", actions7d: 184, lastAction: "21:40 · answered Maya" },
  { id: "grocer", name: "Grocer", role: "Reorders staples under a limit", runtime: "openclaw@2", scopes: ["Shopping list", "Approved merchants"], state: "active", actions7d: 3, lastAction: "11:20 · prepared an order", limits: "$50 per order · approved merchants only" },
  { id: "sweep", name: "Sweep", role: "Robot vacuum planner", runtime: "openclaw@2", scopes: ["Rooms", "Occupancy", "Robot API"], state: "active", actions7d: 5, lastAction: "Yesterday 16:10 · cleaned", limits: "Only while the house is empty" },
  { id: "ledger", name: "Ledger", role: "Bills and budgets, read only", runtime: "openclaw@2", scopes: ["Financial namespace (read)"], state: "paused", actions7d: 0, lastAction: "Paused Aug 30", limits: "Read only · no external calls" },
];

export const folders: Folder[] = [
  { name: "Alex's MacBook", items: 128_402, size: "412 GB", synced: "2 h ago", kind: "device" },
  { name: "Maya's laptop", items: 61_220, size: "188 GB", synced: "6 days ago", kind: "device" },
  { name: "Sam's laptop", items: 74_911, size: "231 GB", synced: "Today 14:05", kind: "device" },
  { name: "Home", items: 412, size: "3.1 GB", synced: "Shared", kind: "folder" },
  { name: "Photos", items: 48_210, size: "296 GB", synced: "Indexed", kind: "folder" },
  { name: "Media", items: 1_930, size: "88 GB", synced: "Shared", kind: "folder" },
  { name: "Camera archive", items: 2_114, size: "19 GB", synced: "30-day retention", kind: "folder" },
];

export const cameras: Camera[] = [
  { id: "front", name: "Front door", live: true, lastEvent: "18:12 · Package", retentionDays: 30 },
  { id: "back", name: "Back garden", live: true, lastEvent: "Yesterday 19:02 · Person", retentionDays: 30 },
  { id: "drive", name: "Driveway", live: true, lastEvent: "Today 08:31 · Car", retentionDays: 14 },
  { id: "hall", name: "Hallway", live: true, lastEvent: "Today 21:10 · Person", retentionDays: 7 },
];

export const photoStats = { total: 48_210, newThisWeek: 312, people: 14, places: 62, indexed: "100%" };

export const privacyCategories = [
  { id: "voice", label: "Voice & conversations", rule: "local", pinned: true, events7d: 61 },
  { id: "home", label: "Home control & automations", rule: "local", pinned: true, events7d: 240 },
  { id: "cameras", label: "Cameras & clips", rule: "local", pinned: true, events7d: 18 },
  { id: "files", label: "Files, photos, memory", rule: "local", pinned: true, events7d: 903 },
  { id: "research", label: "Deep research & big jobs", rule: "ask", pinned: false, events7d: 3 },
  { id: "video", label: "Video generation", rule: "ask", pinned: false, events7d: 0 },
] as const;

export type NetDevice = { name: string; kind: string; link: string; since: string };

export const network = {
  inside: {
    ssid: "Imran home",
    devices: [
      { name: "Alex's MacBook", kind: "Laptop", link: "Wi-Fi 7 · 2.1 Gbps", since: "2 h" },
      { name: "Living room TV", kind: "TV · HDMI", link: "Wired", since: "23 d" },
      { name: "Front door camera", kind: "Camera", link: "Wired", since: "23 d" },
      { name: "Thread border router", kind: "Radio", link: "Internal", since: "23 d" },
      { name: "Robot vacuum", kind: "Robot", link: "Wi-Fi · 2.4 GHz", since: "4 d" },
      { name: "Sam's laptop", kind: "Laptop", link: "Wi-Fi 7 · 1.4 Gbps", since: "6 h" },
    ] as NetDevice[],
  },
  outside: {
    wan: "10 GbE · 1.2 Gbps down · 41 ms",
    ssid: "Imran guest",
    devices: [
      { name: "Maya's phone", kind: "Phone", link: "Wi-Fi 7 · 5 GHz", since: "40 m" },
      { name: "Game console", kind: "Console", link: "Wired 2.5 GbE", since: "1 h" },
      { name: "Guest · Priya's phone", kind: "Guest", link: "Guest Wi-Fi", since: "20 m" },
    ] as NetDevice[],
    rules: [
      { name: "Console bedtime", detail: "Off 22:00–07:00 on school nights", on: true },
      { name: "Guest isolation", detail: "Guests see the internet and nothing else", on: true },
      { name: "Streaming priority", detail: "TV first when the line is busy", on: true },
    ],
  },
  gate: [
    { time: "09:30", kind: "Crossing", detail: "Deep research · approved by Alex · 1 task out, 1 answer in", bytes: "3.1 KB out" },
    { time: "07:00", kind: "Update", detail: "Woven OS 0.4.1 · signature verified on the Outside, installed Inside", bytes: "412 MB in" },
    { time: "Yesterday", kind: "Your key", detail: "Alex reached Files from the office · nothing stored outside", bytes: "encrypted" },
  ],
};

/** Things Tandem remembers about people. Each can be deleted from Privacy. */
export const memories = [
  { id: "m1", text: "Maya takes oat milk in coffee", learned: "From the shopping list · Aug 3" },
  { id: "m2", text: "The office lamp stays off after 22:00", learned: "From three evenings of corrections · Aug 19" },
  { id: "m3", text: "Alex's dentist is Dr Ortega on Kennedy Blvd", learned: "From the household calendar · Jul 28" },
];

/** Agents the household can install. They arrive paused with their scopes listed. */
export const catalogue: Agent[] = [
  { id: "pantry", name: "Pantry", role: "Tracks staples from receipts and reminds before you run out", runtime: "openclaw@2", scopes: ["Receipts (read)", "Shopping list"], state: "paused", actions7d: 0, lastAction: "Not yet run", limits: "Read only · no purchases" },
  { id: "charger", name: "Charger", role: "Charges the car when power is cheapest", runtime: "openclaw@2", scopes: ["Tariff", "Charger API"], state: "paused", actions7d: 0, lastAction: "Not yet run", limits: "Only between 23:00 and 06:00" },
  { id: "gardener", name: "Gardener", role: "Waters from the forecast and the soil sensors", runtime: "openclaw@2", scopes: ["Weather", "Soil sensors", "Irrigation valves"], state: "paused", actions7d: 0, lastAction: "Not yet run", limits: "20 minutes a day at most" },
];

export const tv = {
  name: "Living room TV",
  connected: "HDMI 2.1 · 4K 120 · HDR",
  now: { kind: "Photos", title: "Lake trip, July", detail: "38 photos · 12 s each" },
  rails: [
    { title: "Continue watching", items: ["The Bear · S3E4", "Planet Earth III", "Home movies · 2024"] },
    { title: "Photos", items: ["Lake trip", "Maya's birthday", "Garden", "This week"] },
    { title: "Cameras", items: ["Front door", "Back garden", "Driveway", "Hallway"] },
  ],
};
