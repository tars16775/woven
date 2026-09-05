import * as THREE from "three";

/** Family name of a next/font variable, resolved from the document. */
export function fontFamily(varName: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

export type ScreenState = {
  label: string;
  state: string;
  status: string;
  clock: string;
  /** 0..1 power-on progress; 1 = fully lit. */
  power: number;
  /** 0..1 breathing phase for the orb. */
  breath: number;
};

/** The 5-inch front screen, 5:3, drawn at 2x for crisp type. */
export function makeScreenTexture() {
  const W = 1600;
  const H = 960;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const display = fontFamily("--font-display", "system-ui, sans-serif");
  const sans = fontFamily("--font-sans", "system-ui, sans-serif");
  const mono = fontFamily("--font-mono", "ui-monospace, monospace");

  const draw = (s: ScreenState) => {
    const p = Math.max(0, Math.min(1, s.power));
    ctx.clearRect(0, 0, W, H);

    // Panel black with a faint vertical falloff
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#151515");
    bg.addColorStop(1, "#0e0e0e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Amber wash behind the orb
    const cx = W / 2;
    const oy = H * 0.36;
    const wash = ctx.createRadialGradient(cx, oy, 0, cx, oy, W * 0.34);
    wash.addColorStop(0, `rgba(201,150,46,${0.22 * p})`);
    wash.addColorStop(1, "rgba(201,150,46,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.globalAlpha = p;
    ctx.fillStyle = "#8f8d87";
    ctx.font = `500 ${H * 0.028}px ${mono}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    // letterSpacing is widely supported in modern Chromium/Safari; harmless elsewhere.
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0.18em";
    ctx.fillText(s.label.toUpperCase(), W * 0.045, H * 0.06);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0em";
    ctx.textAlign = "right";
    ctx.fillText(`Local · ${s.clock}`, W * 0.955, H * 0.06);

    // Orb with glow
    const breathe = 1 + 0.12 * Math.sin(s.breath * Math.PI * 2);
    const r = H * 0.03 * breathe * (0.35 + 0.65 * p);
    const glow = ctx.createRadialGradient(cx, oy, 0, cx, oy, r * 6);
    glow.addColorStop(0, `rgba(232,184,90,${0.55 * p})`);
    glow.addColorStop(0.35, `rgba(232,184,90,${0.18 * p})`);
    glow.addColorStop(1, "rgba(232,184,90,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 6, oy - r * 6, r * 12, r * 12);
    ctx.fillStyle = "#e8b85a";
    ctx.beginPath();
    ctx.arc(cx, oy, r, 0, Math.PI * 2);
    ctx.fill();

    // State word
    const t2 = Math.max(0, Math.min(1, (p - 0.45) / 0.55));
    ctx.globalAlpha = t2;
    ctx.fillStyle = "#f3f2ee";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 ${H * 0.2}px ${display}`;
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "-0.02em";
    ctx.fillText(s.state, cx, H * 0.665);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0em";

    // Status line
    ctx.fillStyle = "#9b9993";
    ctx.font = `400 ${H * 0.042}px ${sans}`;
    ctx.fillText(s.status, cx, H * 0.755);

    ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  };

  return { tex, draw };
}

/** Lower fascia: the wordmark. Amber bar is a separate emissive mesh. */
export function makeWordmarkTexture(dark: boolean) {
  const W = 1024;
  const H = 320;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const display = fontFamily("--font-display", "system-ui, sans-serif");
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = dark ? "#f3f2ee" : "#1a1a1a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${H * 0.5}px ${display}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "-0.02em";
  ctx.fillText("woven", W / 2, H * 0.5);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Perforation for the side panel: dark holes with a hairline highlight on
 * their lower edge so they read as drilled, not printed. Returns a colour map
 * (transparent between holes) and a matching bump map.
 */
export function makePerforationTextures() {
  const S = 1024;
  const step = 34;
  const radius = 8.5;
  const margin = 70;

  const color = document.createElement("canvas");
  color.width = S;
  color.height = S;
  const c = color.getContext("2d")!;
  c.clearRect(0, 0, S, S);

  const bump = document.createElement("canvas");
  bump.width = S;
  bump.height = S;
  const b = bump.getContext("2d")!;
  b.fillStyle = "#808080";
  b.fillRect(0, 0, S, S);

  for (let y = margin; y <= S - margin; y += step) {
    for (let x = margin; x <= S - margin; x += step) {
      // highlight rim
      c.fillStyle = "rgba(255,255,255,0.22)";
      c.beginPath();
      c.arc(x, y + 1.6, radius, 0, Math.PI * 2);
      c.fill();
      // hole
      c.fillStyle = "rgba(8,8,8,0.92)";
      c.beginPath();
      c.arc(x, y, radius, 0, Math.PI * 2);
      c.fill();
      // bump: holes are low
      b.fillStyle = "#101010";
      b.beginPath();
      b.arc(x, y, radius, 0, Math.PI * 2);
      b.fill();
    }
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bump);
  return { map, bumpMap };
}

/** Soft radial sprite used for the light spill in front of the screen. */
export function makeGlowTexture() {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(232,184,90,0.9)");
  g.addColorStop(0.4, "rgba(232,184,90,0.25)");
  g.addColorStop(1, "rgba(232,184,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
