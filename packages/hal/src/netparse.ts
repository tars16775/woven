/** Parsers for what the operating system says about the network, kept pure so they can be tested on fixtures. */

/** macOS `route -n get default`. */
export function parseRouteGet(out: string): { gateway: string | null; iface: string | null } {
  const gateway = /^\s*gateway:\s*(\S+)/m.exec(out)?.[1] ?? null;
  const iface = /^\s*interface:\s*(\S+)/m.exec(out)?.[1] ?? null;
  return { gateway, iface };
}

/** macOS/BSD `arp -a`: "name (ip) at mac on en1 ..." */
export function parseArp(out: string): { ip: string; mac: string | null; name: string | null }[] {
  const rows: { ip: string; mac: string | null; name: string | null }[] = [];
  for (const line of out.split("\n")) {
    const m = /^(\S+)\s+\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+(\S+)/.exec(line.trim());
    if (!m) continue;
    const mac = m[3] === "(incomplete)" ? null : normaliseMac(m[3]!);
    if (!mac) continue;
    if (m[2]!.endsWith(".255") || mac === "ff:ff:ff:ff:ff:ff") continue;
    rows.push({ ip: m[2]!, mac, name: m[1] === "?" ? null : m[1]! });
  }
  return rows;
}

/** Linux `ip route show default`. */
export function parseIpRoute(out: string): { gateway: string | null; iface: string | null } {
  const m = /default via (\S+) dev (\S+)/.exec(out);
  return { gateway: m?.[1] ?? null, iface: m?.[2] ?? null };
}

/** Linux `ip neigh`: "ip dev en0 lladdr mac REACHABLE" */
export function parseIpNeigh(out: string): { ip: string; mac: string | null; name: string | null }[] {
  const rows: { ip: string; mac: string | null; name: string | null }[] = [];
  for (const line of out.split("\n")) {
    const m = /^(\d+\.\d+\.\d+\.\d+)\s+dev\s+\S+\s+lladdr\s+(\S+)\s+(\S+)/.exec(line.trim());
    if (!m || m[3] === "FAILED") continue;
    rows.push({ ip: m[1]!, mac: normaliseMac(m[2]!), name: null });
  }
  return rows;
}

/** "0:58:28:6c:94:db" becomes "00:58:28:6c:94:db". */
export function normaliseMac(mac: string): string | null {
  const parts = mac.toLowerCase().split(":");
  if (parts.length !== 6 || parts.some((p) => !/^[0-9a-f]{1,2}$/.test(p))) return null;
  return parts.map((p) => p.padStart(2, "0")).join(":");
}
