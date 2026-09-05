"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DPR_DEFAULT, DPR_HERO, frameloopFor, Wake } from "./frameloop";
import { makeGlowTexture, makePerforationTextures, makeScreenTexture, makeWordmarkTexture } from "./textures";

export type CoreModelProps = {
  label: string;
  state: string;
  status: string;
  finish: "bone" | "graphite";
  /** Play the power-on sequence once on mount. */
  ignite: boolean;
  /** Follow the pointer across the window, not just the canvas. */
  track: boolean;
  /** Base yaw in radians. */
  yaw?: number;
  reduceMotion: boolean;
  /** False while the canvas is off-screen or the tab is hidden: the loop stops. */
  active: boolean;
  /** The hero may render sharper than the supporting scenes. */
  hero?: boolean;
};

// Chassis proportions: 18 × 16 × 18 cm.
const W = 1.8;
const H = 1.6;
const D = 1.8;
const R = 0.075;

const finishes = {
  bone: { body: "#ece9e1", fascia: "#f4f2ec", metalness: 0.42, roughness: 0.34, dark: false },
  graphite: { body: "#343432", fascia: "#414140", metalness: 0.6, roughness: 0.4, dark: true },
} as const;

function clock() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function Chassis({ label, state, status, finish, ignite, track, yaw = -0.42, reduceMotion }: CoreModelProps) {
  const group = useRef<THREE.Group>(null);
  const f = finishes[finish];
  const { size } = useThree();

  const screen = useMemo(() => makeScreenTexture(), []);
  const wordmark = useMemo(() => makeWordmarkTexture(f.dark), [f.dark]);
  const perf = useMemo(() => makePerforationTextures(), []);
  const glow = useMemo(() => makeGlowTexture(), []);

  // Pointer over the whole window, normalised to -1..1.
  const pointer = useRef({ x: 0, y: 0, active: false });
  useEffect(() => {
    if (!track || reduceMotion) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      pointer.current.active = true;
    };
    const leave = () => {
      pointer.current.active = false;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    document.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
      document.removeEventListener("mouseleave", leave);
    };
  }, [track, reduceMotion]);

  // Screen animation state
  const t0 = useRef<number | null>(null);
  // Set once the power-on has finished, so a paused-and-resumed loop does not replay it.
  const ignited = useRef(!ignite);
  const lastClock = useRef("");
  const lastDraw = useRef(0);

  useFrame((st, dt) => {
    const g = group.current;
    if (!g) return;
    const t = st.clock.elapsedTime;
    // The clock restarts from zero whenever the render loop is paused and resumed.
    if (t0.current === null || t < t0.current) t0.current = t;
    const since = t - t0.current;

    // Pose: damped follow of the pointer plus a slow idle drift.
    const targetY = yaw + (pointer.current.active ? pointer.current.x * 0.38 : Math.sin(t * 0.25) * 0.04);
    const targetX = 0.1 + (pointer.current.active ? -pointer.current.y * 0.16 : Math.sin(t * 0.31) * 0.015);
    if (reduceMotion) {
      g.rotation.set(0.1, yaw, 0);
    } else {
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 4, dt);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 4, dt);
      g.position.y = Math.sin(t * 0.6) * 0.012;
    }

    // Screen: redraw when something visible changes.
    let power = 1;
    if (!ignited.current && !reduceMotion) {
      power = Math.min(1, Math.max(0, (since - 0.35) / 1.5));
      if (power >= 1) ignited.current = true;
    }
    const breath = reduceMotion ? 0 : (t % 4.2) / 4.2;
    const now = clock();
    const animating = power < 1 || !reduceMotion;
    if (animating && t - lastDraw.current > 1 / 30) {
      screen.draw({ label, state, status, clock: now, power, breath });
      lastDraw.current = t;
      lastClock.current = now;
    } else if (now !== lastClock.current) {
      screen.draw({ label, state, status, clock: now, power: 1, breath });
      lastClock.current = now;
    }
  });

  // Fit: on phones the canvas is narrow but tall, so let the box fill it.
  const scale = size.width < 640 ? Math.min(1.12, Math.max(0.85, size.width / 400)) : Math.min(1, size.width / 560);

  const bodyMat = (
    <meshStandardMaterial color={f.body} metalness={f.metalness} roughness={f.roughness} envMapIntensity={1.35} />
  );

  return (
    <group ref={group} scale={scale} rotation={[0.1, yaw, 0]}>
      {/* Body */}
      <RoundedBox args={[W, H, D]} radius={R} smoothness={6} castShadow receiveShadow>
        {bodyMat}
      </RoundedBox>

      {/* Screen bezel, flush glass, and the lit panel */}
      <RoundedBox args={[1.48, 0.9, 0.03]} radius={0.03} smoothness={4} position={[0, 0.27, D / 2 - 0.006]}>
        <meshStandardMaterial color="#0a0a0a" metalness={0.2} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.27, D / 2 + 0.011]}>
        <planeGeometry args={[1.4, 0.84]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.27, D / 2 + 0.013]}>
        <planeGeometry args={[1.44, 0.87]} />
        <meshPhysicalMaterial
          color="#000000"
          transparent
          opacity={0.22}
          roughness={0.06}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          envMapIntensity={1.6}
        />
      </mesh>
      {/* Light spilling off the screen onto the room */}
      <sprite position={[0, 0.32, D / 2 + 0.05]} scale={[2.1, 1.3, 1]}>
        <spriteMaterial map={glow} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* Fascia with wordmark and the amber line */}
      <RoundedBox args={[1.48, 0.4, 0.02]} radius={0.025} smoothness={4} position={[0, -0.45, D / 2 + 0.002]}>
        <meshStandardMaterial color={f.fascia} metalness={0.35} roughness={0.45} envMapIntensity={0.9} />
      </RoundedBox>
      <mesh position={[0, -0.425, D / 2 + 0.0135]}>
        <planeGeometry args={[0.9, 0.28]} />
        <meshBasicMaterial map={wordmark} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.555, D / 2 + 0.0135]}>
        <planeGeometry args={[0.13, 0.012]} />
        <meshBasicMaterial color="#e8b85a" toneMapped={false} />
      </mesh>

      {/* Perforated sides */}
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * (W / 2 + 0.0015), 0.02, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
          <planeGeometry args={[1.5, 1.34]} />
          <meshStandardMaterial
            map={perf.map}
            bumpMap={perf.bumpMap}
            bumpScale={0.6}
            transparent
            metalness={0.3}
            roughness={0.7}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}

      {/* Feet */}
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, -H / 2 - 0.015, 0]}>
          <boxGeometry args={[0.3, 0.03, 1.1]} />
          <meshStandardMaterial color="#141414" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Rig() {
  const { size } = useThree();
  return (
    <PerspectiveCamera
      makeDefault
      fov={size.width < 640 ? 38 : 28}
      near={0.1}
      far={30}
      position={[0.2, 0.42, 5.2]}
      onUpdate={(c) => c.lookAt(0, -0.04, 0)}
    />
  );
}

/**
 * The Woven Core rendered in WebGL: a metal chassis under studio light, a
 * live screen, and a contact shadow so it sits on the page instead of
 * floating over it. Transparent background so the section colour shows.
 */
export default function CoreModel(props: CoreModelProps) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={props.hero ? DPR_HERO : DPR_DEFAULT}
      gl={{ antialias: true, alpha: true, powerPreference: props.hero ? "high-performance" : "default" }}
      style={{ background: "transparent" }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
      frameloop={frameloopFor(props.active, props.reduceMotion)}
    >
      <Wake />
      <Rig />
      <Suspense fallback={null}>
        <Chassis {...props} />
        {/* Studio: broad soft key from above-left, cool fill from the right, warm floor bounce. */}
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2.6} rotation-x={Math.PI / 2} position={[0, 4, -1]} scale={[10, 10, 1]} />
          <Lightformer intensity={1.8} rotation-y={Math.PI / 2} position={[-5, 1, 1]} scale={[5, 7, 1]} color="#fbf8f1" />
          <Lightformer intensity={1.6} rotation-y={-Math.PI / 2} position={[5, 0.8, 1]} scale={[4, 6, 1]} color="#eef2f7" />
          <Lightformer intensity={1.4} position={[0, 0.5, 6]} scale={[8, 4, 1]} color="#f6f4ee" />
          <Lightformer intensity={0.7} rotation-x={-Math.PI / 2} position={[0, -3, 0]} scale={[10, 10, 1]} color="#efe3c9" />
        </Environment>
        <ContactShadows position={[0, -H / 2 - 0.02, 0]} opacity={0.5} scale={7} blur={2.6} far={2.2} resolution={512} color="#1a1a1a" />
      </Suspense>
    </Canvas>
  );
}
