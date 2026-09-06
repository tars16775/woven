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

/** The screen (phase 44): Ready, the code, who is home, the Gate, alerts, recent activity. Served only on loopback. */
export function screenPage(name: string, household: string | null): string {
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(household ?? "Woven")} · screen</title>
<style>
  :root{--amber:#e9b44c;--bone:#f4f4f2;--ash:#8d8d88;--ask:#d98a3b}
  body{margin:0;background:#0b0b0c;color:var(--bone);font:16px/1.4 -apple-system,system-ui,sans-serif;min-height:100vh;display:grid;grid-template-rows:auto 1fr auto}
  header,footer{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.4rem;font:12px/1 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--ash)}
  main{display:grid;grid-template-columns:1.2fr 1fr;gap:1.5rem;padding:0 1.4rem;align-items:center}
  @media (max-width:720px){main{grid-template-columns:1fr}}
  .state{font:600 clamp(40px,8vw,88px)/1 -apple-system,system-ui,sans-serif;letter-spacing:-.02em}
  .code{font:600 clamp(48px,10vw,120px)/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;margin:.3em 0 .1em}
  .orb{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--amber);box-shadow:0 0 24px var(--amber);vertical-align:middle;margin-right:.6em}
  .orb.off{background:#c0392b;box-shadow:0 0 24px #c0392b}
  .bar{height:4px;width:min(60vw,360px);background:#26262a;border-radius:2px;margin:.8rem 0 0;overflow:hidden}.bar i{display:block;height:100%;background:var(--amber);width:100%;transition:width 1s linear}
  ul{list-style:none;margin:0;padding:0}li{padding:.45rem 0;border-top:1px solid #1e1e22;font-size:14px;display:flex;justify-content:space-between;gap:1rem}li span:last-child{color:var(--ash);font:11px/1.6 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}
  .alerts li{border-left:3px solid var(--ask);padding-left:.6rem;display:block}.alerts li.urgent{border-color:#c0392b}.alerts small{display:block;color:var(--ash)}
  .chips{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem}.chip{border:1px solid #2a2a2e;border-radius:999px;padding:.35rem .7rem;font-size:13px;color:#cfcfca}
  .k{font:12px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--ash);margin-bottom:.5rem}
</style>
<header><span><span class="orb" id="orb"></span>${esc(household ?? "Woven Core")}</span><span id="clock"></span></header>
<main>
  <section>
    <div class="state" id="state">Ready.</div>
    <div class="chips" id="chips"></div>
    <div class="k" style="margin-top:1.6rem">Sign in with your name and</div>
    <div class="code" id="code">······</div>
    <div class="bar"><i id="bar"></i></div>
    <ul class="alerts" id="alerts" style="margin-top:1.2rem"></ul>
  </section>
  <section>
    <div class="k">Just now</div>
    <ul id="activity"></ul>
  </section>
</main>
<footer><span>${esc(name)}</span><span>Inside · nothing leaves without a receipt</span></footer>
<script>
  const esc=(s)=>String(s).replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
  async function tick(){
    document.getElementById('clock').textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    try{
      const r=await fetch('/v1/screen/state',{cache:'no-store'});const j=await r.json();
      document.getElementById('code').textContent=j.code.slice(0,3)+' '+j.code.slice(3);
      document.getElementById('bar').style.width=(j.secondsLeft/60*100)+'%';
      document.getElementById('state').textContent=j.state==='attention'?'Needs a look.':j.state==='restarting'?'Restarting.':'Ready.';
      document.getElementById('orb').className='orb'+(j.gate==='closed'||j.camerasPaused?' off':'');
      const chips=[j.presence?'Someone is home':'Nobody home', j.gate==='open'?'Gate open · asks first':j.gate==='closed'?'Gate closed · nothing crosses':'No Gate', j.camerasPaused?'Cameras paused':'Cameras on', j.pendingApprovals?j.pendingApprovals+' waiting for a yes':null].filter(Boolean);
      document.getElementById('chips').innerHTML=chips.map(c=>'<span class="chip">'+esc(c)+'</span>').join('');
      document.getElementById('alerts').innerHTML=j.alerts.map(a=>'<li class="'+esc(a.level)+'">'+esc(a.title)+'<small>'+esc(a.detail)+'</small></li>').join('');
      document.getElementById('activity').innerHTML=j.activity.map(a=>'<li><span>'+esc(a.title)+'</span><span>'+esc(new Date(a.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))+' · '+esc(a.where)+'</span></li>').join('')||'<li><span>Nothing yet</span></li>';
    }catch{document.getElementById('code').textContent='······'}
  }
  tick();setInterval(tick,1000);
</script>`;
}
