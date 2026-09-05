"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { CanvasStage } from "./three/canvas-stage";
import { CoreDevice } from "./core-device";

const CoreModel = dynamic(() => import("./three/core-model"), { ssr: false, loading: () => null });

type Props = {
  label?: string;
  state?: string;
  status?: string;
  finish?: "bone" | "graphite";
  ignite?: boolean;
  /** Follow the pointer across the whole window. */
  track?: boolean;
  yaw?: number;
  /** Render sharper than the supporting scenes. Defaults to `ignite`. */
  hero?: boolean;
  className?: string;
};

/**
 * The product, rendered in WebGL where the browser allows it and as the CSS
 * device otherwise. Sized by its container: give it a width and a height.
 */
export function Core3D({
  label = "WOVEN CORE+",
  state = "Ready.",
  status = "4 devices · inside · Gate closed",
  finish = "bone",
  ignite = false,
  track = true,
  yaw,
  hero = ignite,
  className = "",
}: Props) {
  const reduce = useReducedMotion() ?? false;
  // The power-on plays once: the scene latches it in a ref on mount, and it
  // stays mounted while the loop is paused and resumed, so nothing replays.

  const description =
    `A ${finish === "bone" ? "bone-white" : "graphite"} Woven Core: an 18 by 16 by 18 centimetre metal box with perforated sides, ` +
    `a small front screen and the woven wordmark on the lower fascia. The screen reads "${label}" and the local time in the ` +
    `header, an amber light in the centre, the word "${state}" beneath it, and the status line "${status}".`;

  return (
    <CanvasStage
      className={className}
      label={`${label} device showing "${state}"`}
      description={description}
      fallback={
        <div className="flex h-full w-full items-center justify-center">
          <CoreDevice label={label} state={state} status={status} finish={finish} size="min(520px, 42vh, 60vw)" decorative />
        </div>
      }
    >
      {(active) => (
        <CoreModel
          label={label}
          state={state}
          status={status}
          finish={finish}
          ignite={ignite}
          track={track}
          yaw={yaw}
          hero={hero}
          active={active}
          reduceMotion={reduce}
        />
      )}
    </CanvasStage>
  );
}
