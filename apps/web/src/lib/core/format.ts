/** Human units for the numbers the core reports. Binary for memory, decimal for disks, like the OS does. */
export function gb(bytes: number, digits = 1): string {
  return (bytes / 1024 ** 3).toFixed(digits).replace(/\.0$/, "");
}

export function disk(bytes: number): { value: string; unit: "GB" | "TB" } {
  const tb = bytes / 1e12;
  if (tb >= 1) return { value: tb.toFixed(tb >= 10 ? 0 : 1).replace(/\.0$/, ""), unit: "TB" };
  return { value: (bytes / 1e9).toFixed(0), unit: "GB" };
}

/** "23 days", "6 h", "12 min", "just now". */
export function uptime(seconds: number): string {
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} days`;
}

/** Short host for chips: "woven.local" from "https://woven.local:4000". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
