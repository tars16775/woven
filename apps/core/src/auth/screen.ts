import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The code on the screen (phase 9). Six digits derived from a per-boot
 * secret and the current minute, so the screen and the verifier agree
 * without storing anything. Only someone who can see the box's screen can
 * read it; the verifier accepts the current and the previous minute, and
 * five wrong guesses in a window lock that window.
 */
export class ScreenCode {
  private readonly secret = randomBytes(32);
  private readonly failures = new Map<number, number>();

  constructor(
    private readonly windowMs = 60_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private window(at = this.now()): number {
    return Math.floor(at / this.windowMs);
  }

  private codeFor(window: number): string {
    const mac = createHmac("sha256", this.secret).update(String(window)).digest();
    const n = mac.readUInt32BE(0) % 1_000_000;
    return String(n).padStart(6, "0");
  }

  /** What the screen shows now, and how many seconds until it changes. */
  current(): { code: string; secondsLeft: number } {
    const w = this.window();
    return { code: this.codeFor(w), secondsLeft: Math.ceil(((w + 1) * this.windowMs - this.now()) / 1000) };
  }

  /** True for the current or previous minute's code. Locks the window after five misses. */
  verify(input: string): boolean {
    const digits = input.replace(/\D/g, "");
    if (digits.length !== 6) return false;
    const w = this.window();
    for (const k of [...this.failures.keys()]) if (k < w - 1) this.failures.delete(k);
    if ((this.failures.get(w) ?? 0) >= 5) return false;
    const ok = [w, w - 1].some((win) => timingSafeEqual(Buffer.from(this.codeFor(win)), Buffer.from(digits)));
    if (!ok) this.failures.set(w, (this.failures.get(w) ?? 0) + 1);
    return ok;
  }
}

/** The screen page: large code, a countdown, nothing else. Served only on loopback. */
export function screenPage(name: string, household: string | null): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(household ?? "Woven")} · screen</title>
<style>
  body{margin:0;background:#0b0b0c;color:#f4f4f2;font:16px/1.4 -apple-system,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}
  main{text-align:center;padding:2rem}
  .k{font:12px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:#8d8d88}
  .code{font:600 clamp(64px,18vw,160px)/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;margin:.4em 0 .2em}
  .orb{display:inline-block;width:12px;height:12px;border-radius:50%;background:#e9b44c;box-shadow:0 0 24px #e9b44c;vertical-align:middle;margin-right:.6em}
  .bar{height:4px;width:min(60vw,420px);background:#26262a;border-radius:2px;margin:1.2rem auto 0;overflow:hidden}
  .bar i{display:block;height:100%;background:#e9b44c;width:100%;transition:width 1s linear}
  p{color:#b5b5b0;max-width:32rem;margin:1rem auto 0}
</style>
<main>
  <div class="k"><span class="orb"></span>${esc(household ?? "Woven Core")} · ${esc(name)}</div>
  <div class="code" id="code">······</div>
  <div class="bar"><i id="bar"></i></div>
  <p>Enter this code with your name on any device on the home network to sign it in. It changes every minute and never leaves the house.</p>
</main>
<script>
  async function tick(){
    try{
      const r=await fetch('/v1/screen/code',{cache:'no-store'});const j=await r.json();
      document.getElementById('code').textContent=j.code.slice(0,3)+' '+j.code.slice(3);
      document.getElementById('bar').style.width=(j.secondsLeft/60*100)+'%';
    }catch{document.getElementById('code').textContent='······'}
  }
  tick();setInterval(tick,1000);
</script>`;
}
