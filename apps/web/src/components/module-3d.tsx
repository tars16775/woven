"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { ModuleDiagram } from "./three/canvas-fallbacks";
import { CanvasStage } from "./three/canvas-stage";

const ModuleShowcase = dynamic(() => import("./three/module-showcase"), { ssr: false, loading: () => null });

const description =
  "The compute module on a slow turntable, seen from above and slightly in front: a machined graphite tray holding a dark " +
  "green board; the processor under a brushed vapour chamber and a stack of 26 aluminium fins; four memory packages around " +
  "it; six power stages along the back edge; an edge connector with 44 gold contacts along the front; and a pull handle on " +
  "the back. The label on the tray reads Compute Module A1, Ryzen AI Max 390, 64 GB.";

/** The compute module on its own. Give it a sized container. */
export function Module3D({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <CanvasStage className={className} label="The Woven compute module" description={description} fallback={<ModuleDiagram />}>
      {(active) => <ModuleShowcase reduceMotion={reduce} active={active} />}
    </CanvasStage>
  );
}
