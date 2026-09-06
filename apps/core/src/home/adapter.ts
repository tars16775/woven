import type { HomeDevice, HomeRoom, HomeState } from "@woven/schema";

export type Reading = Record<string, unknown>;

/**
 * A home adapter owns devices and executes capability calls against them.
 * The simulated adapter below is what runs until Home Assistant arrives in
 * track E; the interface is what Home Assistant, Matter and the radios will
 * implement. The engine never talks to a device except through this.
 */
export interface HomeAdapter {
  readonly name: string;
  rooms(): HomeRoom[];
  devices(): HomeDevice[];
  device(id: string): HomeDevice | null;
  /** Apply a capability to a device and return the state the adapter then reads back. */
  apply(deviceId: string, capability: string, params: Reading): Promise<Reading>;
  read(deviceId: string): Promise<Reading>;
}

type Seed = { id: string; roomId: string; name: string; kind: HomeDevice["kind"]; protocol: string; reachable?: boolean; riskClass: HomeDevice["riskClass"]; state: Reading };

const seedRooms: HomeRoom[] = [
  { id: "living", name: "Living room", occupied: true },
  { id: "kitchen", name: "Kitchen", occupied: false },
  { id: "entry", name: "Entry", occupied: false },
  { id: "bed", name: "Bedroom", occupied: true },
  { id: "office", name: "Office", occupied: false },
];

const seedDevices: Seed[] = [
  { id: "living.ceiling", roomId: "living", name: "Ceiling", kind: "light", protocol: "Matter · Thread", riskClass: "B", state: { on: true, brightness: 72 } },
  { id: "living.floor-lamp", roomId: "living", name: "Floor lamp", kind: "light", protocol: "Zigbee", riskClass: "B", state: { on: true, brightness: 40 } },
  { id: "living.speaker", roomId: "living", name: "Speaker", kind: "speaker", protocol: "LAN", riskClass: "B", state: { playing: false } },
  { id: "living.thermostat", roomId: "living", name: "Thermostat", kind: "thermostat", protocol: "Matter", riskClass: "C", state: { setpointC: 21, currentC: 20.8 } },
  { id: "kitchen.main", roomId: "kitchen", name: "Main", kind: "light", protocol: "Matter · Thread", riskClass: "B", state: { on: false, brightness: 0 } },
  { id: "kitchen.under-cabinet", roomId: "kitchen", name: "Under-cabinet", kind: "light", protocol: "Zigbee", riskClass: "B", state: { on: false } },
  { id: "kitchen.kettle", roomId: "kitchen", name: "Kettle plug", kind: "plug", protocol: "Matter", riskClass: "B", state: { on: false } },
  { id: "kitchen.motion", roomId: "kitchen", name: "Motion", kind: "sensor", protocol: "Zigbee", riskClass: "A", state: { motion: false, lastSeen: "2 h ago" } },
  { id: "entry.front-door", roomId: "entry", name: "Front door", kind: "lock", protocol: "Matter", riskClass: "D", state: { locked: true } },
  { id: "entry.porch", roomId: "entry", name: "Porch", kind: "light", protocol: "Matter", riskClass: "B", state: { on: true, brightness: 30 } },
  { id: "entry.contact", roomId: "entry", name: "Door contact", kind: "sensor", protocol: "Thread", riskClass: "A", state: { open: false } },
  { id: "entry.camera", roomId: "entry", name: "Front door camera", kind: "camera", protocol: "RTSP", riskClass: "A", state: { recording: true } },
  { id: "bed.bedside", roomId: "bed", name: "Bedside", kind: "light", protocol: "Zigbee", riskClass: "B", state: { on: true, brightness: 15 } },
  { id: "bed.fan", roomId: "bed", name: "Fan plug", kind: "plug", protocol: "Matter", riskClass: "B", state: { on: true } },
  { id: "bed.temperature", roomId: "bed", name: "Temperature", kind: "sensor", protocol: "Thread", riskClass: "A", state: { temperatureC: 20.5 } },
  { id: "office.desk-lamp", roomId: "office", name: "Desk lamp", kind: "light", protocol: "Matter", reachable: false, riskClass: "B", state: { on: false } },
  { id: "office.vacuum", roomId: "office", name: "Robot vacuum", kind: "robot", protocol: "LAN", riskClass: "B", state: { docked: true, battery: 100 } },
];

export class DeviceError extends Error {
  constructor(
    readonly status: 404 | 409 | 502,
    message: string,
  ) {
    super(message);
    this.name = "DeviceError";
  }
}

/** An in-memory house with the preview's rooms, so every flow can run end to end before radios exist. */
export class SimulatedAdapter implements HomeAdapter {
  readonly name = "simulated";
  private readonly state = new Map<string, HomeDevice>();

  constructor(now: () => Date = () => new Date()) {
    for (const d of seedDevices) {
      this.state.set(d.id, { id: d.id, roomId: d.roomId, name: d.name, kind: d.kind, protocol: d.protocol, reachable: d.reachable ?? true, riskClass: d.riskClass, state: { ...d.state }, updatedAt: now().toISOString() });
    }
  }

  rooms() {
    return seedRooms;
  }
  devices() {
    return [...this.state.values()];
  }
  device(id: string) {
    return this.state.get(id) ?? null;
  }

  async read(deviceId: string): Promise<Reading> {
    const d = this.state.get(deviceId);
    if (!d) throw new DeviceError(404, `No device called ${deviceId}.`);
    return { ...d.state };
  }

  async apply(deviceId: string, capability: string, params: Reading): Promise<Reading> {
    const d = this.state.get(deviceId);
    if (!d) throw new DeviceError(404, `No device called ${deviceId}.`);
    if (!d.reachable) throw new DeviceError(502, `${d.name} is not answering.`);
    const next: Reading = { ...d.state };
    switch (capability) {
      case "device.read_state":
        return next;
      case "light.set":
        if (d.kind !== "light") throw new DeviceError(409, `${d.name} is not a light.`);
        next.on = params.on;
        if (params.brightness !== undefined) next.brightness = params.brightness;
        else if (params.on && Number(next.brightness ?? 0) === 0) next.brightness = 100;
        break;
      case "plug.set":
        if (d.kind !== "plug") throw new DeviceError(409, `${d.name} is not a plug.`);
        next.on = params.on;
        break;
      case "media.set":
        if (d.kind !== "speaker") throw new DeviceError(409, `${d.name} is not a speaker.`);
        next.playing = params.playing;
        break;
      case "climate.set_temperature":
        if (d.kind !== "thermostat") throw new DeviceError(409, `${d.name} is not a thermostat.`);
        next.setpointC = params.setpointC;
        break;
      case "lock.lock":
      case "lock.unlock":
        if (d.kind !== "lock") throw new DeviceError(409, `${d.name} is not a lock.`);
        next.locked = capability === "lock.lock";
        break;
      default:
        throw new DeviceError(409, `${capability} is not something a device does.`);
    }
    this.state.set(deviceId, { ...d, state: next, updatedAt: new Date().toISOString() });
    return { ...next };
  }
}

/** Who is home. Until phones report it (track E), the household says so from the dashboard. */
export class Presence {
  private adultsHome = false;
  private since: string | null = null;
  private source = "unknown";

  set(adultsHome: boolean, source: string) {
    this.adultsHome = adultsHome;
    this.since = new Date().toISOString();
    this.source = source;
  }
  get(): HomeState["presence"] {
    return { adultsHome: this.adultsHome, since: this.since, source: this.source };
  }
}
