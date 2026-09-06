import os from "node:os";

/** IPv4 addresses on real interfaces, the ones a phone on the home Wi-Fi would use. */
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) out.push(a.address);
    }
  }
  return [...new Set(out)];
}

/** Names the certificate must cover: the household name, localhost, and the machine's own .local name. */
export function coreDnsNames(householdName: string): string[] {
  const machine = os.hostname().toLowerCase().replace(/\.local$/, "");
  return [...new Set([householdName.toLowerCase(), "localhost", `${machine}.local`])];
}
