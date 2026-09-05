import type { CSSProperties } from "react";
import { Clock } from "./clock";

type Props = {
  label?: string;
  /** Headline word on the screen. */
  state?: string;
  status?: string;
  /**
   * CSS length for the front-face width. Everything scales from it, so a
   * viewport-relative value keeps the whole device inside one screen.
   */
  size?: string;
  className?: string;
  finish?: "bone" | "graphite";
  /** Play the power-on sequence once on mount (hero only). */
  ignite?: boolean;
  /**
   * Render without its own accessible name, for when a parent already
   * describes the picture (the WebGL fallback).
   */
  decorative?: boolean;
};

const finishes = {
  bone: {
    front: "linear-gradient(160deg, #f1efea 0%, #e3e1da 55%, #d8d6ce 100%)",
    side: "linear-gradient(180deg, #cfcdc5 0%, #b3b1a9 100%)",
    top: "linear-gradient(180deg, #f6f5f1 0%, #e9e7e0 100%)",
    fascia: "rgba(255,255,255,0.3)",
    fasciaText: "text-ink",
    perf: "rgba(20,20,20,0.5)",
    edge: "rgba(255,255,255,0.75)",
  },
  graphite: {
    front: "linear-gradient(160deg, #3b3b39 0%, #2a2a29 55%, #1f1f1e 100%)",
    side: "linear-gradient(180deg, #262625 0%, #151514 100%)",
    top: "linear-gradient(180deg, #454543 0%, #2e2e2c 100%)",
    fascia: "rgba(255,255,255,0.06)",
    fasciaText: "text-bone",
    perf: "rgba(0,0,0,0.8)",
    edge: "rgba(255,255,255,0.14)",
  },
} as const;

const w = (k: number) => `calc(var(--w) * ${k})`;

/**
 * The Woven Core chassis, drawn with real CSS 3D so the geometry is right at
 * any angle and can be tilted by the stage it sits on. Front face carries the
 * glass screen and fascia; right face is perforated; the top catches light.
 */
export function CoreDevice({
  label = "WOVEN CORE+",
  state = "Ready.",
  status = "4 devices · inside · Gate closed",
  size = "min(560px, 46vh, 60vw)",
  className = "",
  finish = "bone",
  ignite = false,
  decorative = false,
}: Props) {
  const f = finishes[finish];
  const H = 0.9; // height / width
  const D = 0.82; // depth / width

  const face: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    backfaceVisibility: "hidden",
  };

  return (
    <div
      className={`device-stage relative select-none ${className}`}
      style={
        {
          "--w": size,
          width: w(1.36),
          height: w(H + 0.28),
          perspective: w(3.2),
        } as CSSProperties
      }
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${label} device showing "${state}". ${status}`}
      aria-hidden={decorative || undefined}
    >
      {/* Ground shadow and the light spilling from the screen */}
      <div
        className="absolute left-1/2 rounded-[50%]"
        style={{
          width: w(1.25),
          height: w(0.22),
          bottom: w(-0.02),
          transform: "translateX(-46%)",
          background:
            "radial-gradient(ellipse at center, rgba(20,20,20,0.22) 0%, rgba(20,20,20,0.08) 40%, transparent 70%)",
          filter: "blur(8px)",
        }}
      />
      <div
        className="absolute left-1/2 rounded-[50%]"
        style={{
          width: w(0.9),
          height: w(0.18),
          bottom: w(0.0),
          transform: "translateX(-50%)",
          background: "radial-gradient(ellipse at center, rgba(201,150,46,0.22) 0%, transparent 65%)",
          filter: "blur(12px)",
        }}
      />

      {/* The cube */}
      <div
        className="device-cube absolute"
        style={{
          left: "50%",
          top: "50%",
          width: w(1),
          height: w(H),
          marginLeft: w(-0.57),
          marginTop: w(-H / 2 - 0.02),
          transformStyle: "preserve-3d",
          transform:
            "rotateX(calc(7deg + var(--rx, 0deg))) rotateY(calc(-24deg + var(--ry, 0deg)))",
          transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Top face */}
        <div
          style={{
            ...face,
            width: w(1),
            height: w(D),
            marginLeft: w(-0.5),
            marginTop: w(-D / 2),
            transform: `translateY(${w(-H / 2)}) rotateX(90deg)`,
            backgroundImage: f.top,
            borderRadius: w(0.035),
            boxShadow: `inset 0 0 0 1px ${f.edge}`,
          }}
        />

        {/* Right face */}
        <div
          className="overflow-hidden"
          style={{
            ...face,
            width: w(D),
            height: w(H),
            marginLeft: w(-D / 2),
            marginTop: w(-H / 2),
            transform: `translateX(${w(0.5)}) rotateY(90deg)`,
            backgroundImage: f.side,
            borderRadius: w(0.03),
          }}
        >
          <div
            className="absolute"
            style={{
              inset: `${w(0.09)} ${w(0.08)} ${w(0.12)} ${w(0.08)}`,
              backgroundImage: `radial-gradient(circle, ${f.perf} 1.3px, transparent 1.5px)`,
              backgroundSize: "10px 10px",
            }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.22), rgba(0,0,0,0) 60%)" }}
          />
        </div>

        {/* Front face */}
        <div
          className="overflow-hidden"
          style={{
            ...face,
            width: w(1),
            height: w(H),
            marginLeft: w(-0.5),
            marginTop: w(-H / 2),
            transform: `translateZ(${w(D / 2)})`,
            backgroundImage: f.front,
            borderRadius: w(0.04),
            boxShadow: `inset 0 1px 0 ${f.edge}, inset 0 -2px 6px rgba(0,0,0,0.06)`,
          }}
        >
          {/* Screen */}
          <div
            className={`absolute overflow-hidden bg-graphite text-bone ${ignite ? "ignite" : ""}`}
            style={{
              left: w(0.12),
              right: w(0.12),
              top: w(0.1),
              height: w(0.4),
              borderRadius: w(0.025),
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 6px 18px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="ignite-glow absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse at 50% 42%, rgba(201,150,46,0.18) 0%, rgba(20,20,20,0) 55%)",
              }}
            />
            <div
              className="ignite-text absolute flex w-full items-center justify-between font-mono uppercase text-ash-2"
              style={{
                top: w(0.028),
                paddingInline: w(0.035),
                fontSize: `max(8px, ${w(0.016)})`,
                letterSpacing: "0.18em",
              }}
            >
              <span>{label}</span>
              <span className="normal-case tracking-normal">
                Local · <Clock />
              </span>
            </div>

            <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: w(0.08) }}>
              <span className="orb ignite-orb" style={{ ["--orb" as string]: `max(8px, ${w(0.03)})` }} />
              <span
                className="ignite-text font-display font-semibold leading-none tracking-[-0.02em]"
                style={{ fontSize: w(0.082), marginTop: w(0.058) }}
              >
                {state}
              </span>
              <span
                className="ignite-text text-ash-2"
                style={{ fontSize: `max(9px, ${w(0.019)})`, marginTop: w(0.018) }}
              >
                {status}
              </span>
            </div>

            {/* Glass */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(112deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 28%, rgba(255,255,255,0) 46%)",
              }}
            />
          </div>

          {/* Seam */}
          <div
            className="absolute inset-x-[12%]"
            style={{
              top: w(0.585),
              height: 1,
              backgroundImage: "linear-gradient(90deg, transparent, rgba(0,0,0,0.12), transparent)",
            }}
          />

          {/* Fascia with wordmark */}
          <div
            className="absolute flex flex-col items-center justify-center"
            style={{
              left: w(0.12),
              right: w(0.12),
              top: w(0.615),
              height: w(0.19),
              borderRadius: w(0.02),
              background: f.fascia,
              boxShadow: `inset 0 1px 0 ${f.edge}`,
            }}
          >
            <span
              className={`font-display font-semibold ${f.fasciaText}`}
              style={{ fontSize: w(0.06), letterSpacing: "-0.02em" }}
            >
              woven
            </span>
            <span
              className="mt-1 block rounded-full bg-amber"
              style={{ width: w(0.07), height: `max(2px, ${w(0.006)})` }}
            />
          </div>

          {/* Feet */}
          <div className="absolute rounded-full bg-graphite" style={{ left: w(0.08), bottom: -1, width: w(0.1), height: w(0.012) }} />
          <div className="absolute rounded-full bg-graphite" style={{ right: w(0.08), bottom: -1, width: w(0.1), height: w(0.012) }} />
        </div>
      </div>
    </div>
  );
}
