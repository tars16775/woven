"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { Suspense, useRef, type RefObject } from "react";
import * as THREE from "three";
import { DPR_DEFAULT, frameloopFor, Wake } from "./frameloop";
import { ModuleModel } from "./module-model";

const W = 1.8;
const H = 1.6;
const D = 1.8;

function ramp(p: number, a: number, b: number, from: number, to: number) {
  if (p <= a) return from;
  if (p >= b) return to;
  return from + ((p - a) / (b - a)) * (to - from);
}

type Props = { progress: RefObject<number>; reduceMotion: boolean; active: boolean };

function Scene({ progress, reduceMotion }: Props) {
  const lid = useRef<THREE.Group>(null);
  const lidMat = useRef<THREE.MeshStandardMaterial>(null);
  const oldMod = useRef<THREE.Group>(null);
  const newMod = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const stay = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((st, dt) => {
    const p = reduceMotion ? 1 : progress.current ?? 0;
    // Lid lifts and fades while the box "powers down".
    if (lid.current) lid.current.position.y = H / 2 + ramp(p, 0.03, 0.25, 0, 1.3);
    if (lidMat.current) lidMat.current.opacity = ramp(p, 0.12, 0.28, 1, 0);
    // Old module out to the right, new module in.
    if (oldMod.current) {
      oldMod.current.position.x = 0.2 + ramp(p, 0.28, 0.58, 0, 2.9);
      oldMod.current.visible = p < 0.62;
    }
    if (newMod.current) {
      newMod.current.position.x = 0.2 + ramp(p, 0.6, 0.88, 2.9, 0);
      newMod.current.visible = p > 0.56;
    }
    if (stay.current) stay.current.opacity = ramp(p, 0.32, 0.45, 0, 0.9);
    // The whole scene turns a little as the reader scrolls, and breathes.
    if (rig.current) {
      const targetY = -0.55 + ramp(p, 0, 1, 0, 0.35);
      rig.current.rotation.y = reduceMotion ? -0.4 : THREE.MathUtils.damp(rig.current.rotation.y, targetY, 4, dt);
      rig.current.position.y = reduceMotion ? 0 : Math.sin(st.clock.elapsedTime * 0.5) * 0.01;
    }
  });

  const shell = <meshStandardMaterial color="#e8e5dd" metalness={0.4} roughness={0.35} transparent opacity={0.16} depthWrite={false} />;

  return (
    <group ref={rig} rotation={[0.08, -0.55, 0]} position={[0, -0.1, 0]}>
      {/* Base plate and glass walls */}
      <RoundedBox args={[W, 0.08, D]} radius={0.03} smoothness={4} position={[0, -H / 2 + 0.04, 0]}>
        <meshStandardMaterial color="#e6e3db" metalness={0.45} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[W, H, D]} radius={0.075} smoothness={4}>
        {shell}
      </RoundedBox>

      {/* Lid */}
      <group ref={lid} position={[0, H / 2, 0]}>
        <RoundedBox args={[W, 0.08, D]} radius={0.03} smoothness={4}>
          <meshStandardMaterial ref={lidMat} color="#ece9e1" metalness={0.42} roughness={0.34} transparent />
        </RoundedBox>
      </group>

      {/* Backplane */}
      <mesh position={[0, -H / 2 + 0.09, -D / 2 + 0.12]}>
        <boxGeometry args={[W - 0.2, 0.02, 0.14]} />
        <meshStandardMaterial color="#0f1713" roughness={0.6} />
      </mesh>

      {/* Two drive sleds on the left */}
      {[-0.62, -0.34].map((x, i) => (
        <group key={x} position={[x, -H / 2 + 0.42, 0.05]}>
          <RoundedBox args={[0.22, 0.66, 1.1]} radius={0.02} smoothness={3}>
            <meshStandardMaterial color={i === 0 ? "#2a2a29" : "#3a3a38"} metalness={0.7} roughness={0.4} transparent opacity={i === 0 ? 1 : 0.35} />
          </RoundedBox>
          <mesh position={[0.12, 0.2, 0.2]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.5, 0.08]} />
            <meshBasicMaterial color={i === 0 ? "#e8b85a" : "#6e6c66"} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Radios: three small modules with antenna leads */}
      {[-0.35, 0.05, 0.45].map((x) => (
        <group key={x} position={[x, -H / 2 + 0.16, -D / 2 + 0.28]}>
          <mesh>
            <boxGeometry args={[0.22, 0.06, 0.18]} />
            <meshStandardMaterial color="#1e1e1d" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.06, -0.02]}>
            <cylinderGeometry args={[0.008, 0.008, 0.08, 8]} />
            <meshStandardMaterial color="#8f8d86" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Secure element */}
      <mesh position={[0.7, -H / 2 + 0.115, -D / 2 + 0.3]}>
        <boxGeometry args={[0.1, 0.03, 0.1]} />
        <meshStandardMaterial color="#c9962e" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* "Stays put" marker plane above the drives */}
      <mesh position={[-0.48, -H / 2 + 0.82, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.02]} />
        <meshBasicMaterial ref={stay} color="#e8b85a" transparent opacity={0} toneMapped={false} />
      </mesh>

      {/* Modules in the bay */}
      <group ref={oldMod} position={[0.2, -H / 2 + 0.09, 0.05]}>
        <ModuleModel label="Compute Module A1" sub="Ryzen AI Max 390 · 64 GB" />
      </group>
      <group ref={newMod} position={[3.1, -H / 2 + 0.09, 0.05]} visible={false}>
        <ModuleModel label="Compute Module B2" sub="Next generation · 128 GB" fresh />
      </group>
    </group>
  );
}

/** Exploded view of the chassis, driven by a scroll progress ref from 0 to 1. */
export default function InsideScene(props: Props) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={DPR_DEFAULT}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      frameloop={frameloopFor(props.active, props.reduceMotion)}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
    >
      <Wake />
      <PerspectiveCamera makeDefault fov={30} near={0.1} far={40} position={[2.6, 1.9, 4.6]} onUpdate={(c) => c.lookAt(0.4, -0.2, 0)} />
      <Suspense fallback={null}>
        <Scene {...props} />
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2.6} rotation-x={Math.PI / 2} position={[0, 4, -1]} scale={[10, 10, 1]} />
          <Lightformer intensity={1.8} rotation-y={Math.PI / 2} position={[-5, 1, 1]} scale={[5, 7, 1]} color="#fbf8f1" />
          <Lightformer intensity={1.6} rotation-y={-Math.PI / 2} position={[5, 0.8, 1]} scale={[4, 6, 1]} color="#eef2f7" />
          <Lightformer intensity={1.2} position={[0, 0.5, 6]} scale={[8, 4, 1]} color="#f6f4ee" />
        </Environment>
        <ContactShadows position={[0, -H / 2 - 0.1, 0]} opacity={0.45} scale={9} blur={2.6} far={2.5} resolution={512} color="#1a1a1a" />
      </Suspense>
    </Canvas>
  );
}
