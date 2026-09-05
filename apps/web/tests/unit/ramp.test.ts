import { describe, expect, it } from "vitest";

/**
 * The scroll-driven scenes (module-swap.tsx, three/inside-scene.tsx) each
 * carry this private helper. It is not exported, so the contract is pinned
 * here verbatim: clamp outside [a, b], interpolate linearly inside.
 */
function ramp(p: number, a: number, b: number, from: number, to: number) {
  if (p <= a) return from;
  if (p >= b) return to;
  return from + ((p - a) / (b - a)) * (to - from);
}

describe("ramp", () => {
  it("holds the start value before the window opens", () => {
    expect(ramp(0, 0.22, 0.28, 1, 0)).toBe(1);
    expect(ramp(0.22, 0.22, 0.28, 1, 0)).toBe(1);
  });

  it("holds the end value after the window closes", () => {
    expect(ramp(0.28, 0.22, 0.28, 1, 0)).toBe(0);
    expect(ramp(1, 0.22, 0.28, 1, 0)).toBe(0);
  });

  it("interpolates linearly inside the window", () => {
    expect(ramp(0.25, 0.2, 0.3, 0, 1)).toBeCloseTo(0.5);
    expect(ramp(0.275, 0.2, 0.3, 0, 1)).toBeCloseTo(0.75);
    expect(ramp(0.5, 0, 1, 10, 20)).toBeCloseTo(15);
  });

  it("runs downhill as happily as uphill", () => {
    expect(ramp(0.5, 0, 1, 1, 0)).toBeCloseTo(0.5);
    expect(ramp(0.75, 0.5, 1, 2.9, 0)).toBeCloseTo(1.45);
  });

  it("composes: a fade-in times a fade-out gives a plateau", () => {
    const shape = (p: number) => ramp(p, 0.25, 0.3, 0, 1) * ramp(p, 0.55, 0.6, 1, 0);
    expect(shape(0.2)).toBe(0);
    expect(shape(0.4)).toBe(1);
    expect(shape(0.7)).toBe(0);
    expect(shape(0.275)).toBeCloseTo(0.5);
  });
});
