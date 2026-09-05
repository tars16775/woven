"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { DPR_DEFAULT, frameloopFor, Wake } from "./frameloop";
import { ModuleModel } from "./module-model";

function Turntable({ reduceMotion }: { reduceMotion: boolean }) {
  const g = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0, active: false });
  useEffect(() => {
    if (reduceMotion) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1, active: true };
    };
    const leave = () => (pointer.current.active = false);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseleave", leave);
    };
  }, [reduceMotion]);

  useFrame((st, dt) => {
    if (!g.current) return;
    if (reduceMotion) return;
    // Turn by the frame delta rather than the clock: the clock restarts from
    // zero whenever the loop is paused and resumed, and this must not jump.
    const step = Math.min(dt, 0.1) * 0.15;
    const ty = pointer.current.active ? -0.6 + pointer.current.x * 0.5 : g.current.rotation.y + step;
    const tx = 0.15 + (pointer.current.active ? -pointer.current.y * 0.2 : 0);
    g.current.rotation.y = pointer.current.active ? THREE.MathUtils.damp(g.current.rotation.y, ty, 4, dt) : ty;
    g.current.rotation.x = THREE.MathUtils.damp(g.current.rotation.x, tx, 4, dt);
  });

  return (
    <group ref={g} rotation={[0.15, -0.6, 0]} position={[0, -0.12, 0]}>
      <ModuleModel />
    </group>
  );
}

/** The compute module alone, on a turntable, following the pointer. */
export default function ModuleShowcase({ reduceMotion, active }: { reduceMotion: boolean; active: boolean }) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={DPR_DEFAULT}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      frameloop={frameloopFor(active, reduceMotion)}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
    >
      <Wake />
      <PerspectiveCamera makeDefault fov={30} near={0.1} far={30} position={[0, 1.15, 2.7]} onUpdate={(c) => c.lookAt(0, 0.02, 0)} />
      <Suspense fallback={null}>
        <Turntable reduceMotion={reduceMotion} />
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2.6} rotation-x={Math.PI / 2} position={[0, 4, -1]} scale={[10, 10, 1]} />
          <Lightformer intensity={1.8} rotation-y={Math.PI / 2} position={[-5, 1, 1]} scale={[5, 7, 1]} color="#fbf8f1" />
          <Lightformer intensity={1.6} rotation-y={-Math.PI / 2} position={[5, 0.8, 1]} scale={[4, 6, 1]} color="#eef2f7" />
          <Lightformer intensity={1.2} position={[0, 0.5, 6]} scale={[8, 4, 1]} color="#f6f4ee" />
        </Environment>
        <ContactShadows position={[0, -0.13, 0]} opacity={0.5} scale={5} blur={2.2} far={1.5} resolution={512} color="#1a1a1a" />
      </Suspense>
    </Canvas>
  );
}
