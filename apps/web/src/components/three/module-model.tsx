"use client";

import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { fontFamily } from "./textures";

/** Module footprint in scene units: 13 × 9 cm, about 3.5 cm tall with fins. */
export const MODULE = { w: 1.3, d: 0.9, h: 0.36 };

function makeLabelTexture(text: string, sub: string) {
  const W = 1024;
  const H = 160;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const mono = fontFamily("--font-mono", "ui-monospace, monospace");
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(243,242,238,0.9)";
  ctx.font = `500 44px ${mono}`;
  ctx.textBaseline = "middle";
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0.18em";
  ctx.fillText(text.toUpperCase(), 0, 50);
  ctx.fillStyle = "rgba(243,242,238,0.5)";
  ctx.font = `400 36px ${mono}`;
  ctx.fillText(sub, 0, 112);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * The compute module as a physical object: a machined tray, the board, the
 * SoC under a vapour chamber and a fin stack, four memory packages, power
 * stages, a gold edge connector, and the handle you pull it out by.
 */
export function ModuleModel({
  label = "Compute Module A1",
  sub = "Ryzen AI Max 390 · 64 GB",
  fresh = false,
}: {
  label?: string;
  sub?: string;
  fresh?: boolean;
}) {
  const { w, d } = MODULE;
  const labelTex = useMemo(() => makeLabelTexture(label, sub), [label, sub]);

  const finCount = 26;
  const fins = useMemo(() => {
    const span = 0.96;
    return Array.from({ length: finCount }, (_, i) => -span / 2 + (i * span) / (finCount - 1));
  }, []);
  const pins = useMemo(() => Array.from({ length: 44 }, (_, i) => -0.55 + i * (1.1 / 43)), []);
  const finColor = fresh ? "#c9c6bd" : "#b3b0a7";

  return (
    <group>
      {/* Tray */}
      <RoundedBox args={[w + 0.06, 0.05, d + 0.06]} radius={0.02} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color="#2a2a29" metalness={0.75} roughness={0.35} />
      </RoundedBox>

      {/* Board */}
      <mesh position={[0, 0.036, 0]}>
        <boxGeometry args={[w - 0.06, 0.022, d - 0.06]} />
        <meshStandardMaterial color="#0f1713" metalness={0.15} roughness={0.55} />
      </mesh>

      {/* Traces: a faint grid on the board */}
      <mesh position={[0, 0.048, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.1, d - 0.1]} />
        <meshStandardMaterial color="#1a2a22" metalness={0.3} roughness={0.5} transparent opacity={0.55} />
      </mesh>

      {/* SoC and lid */}
      <mesh position={[0.05, 0.075, 0]}>
        <boxGeometry args={[0.38, 0.05, 0.38]} />
        <meshStandardMaterial color="#151515" metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh position={[0.05, 0.104, 0]}>
        <boxGeometry args={[0.3, 0.008, 0.3]} />
        <meshStandardMaterial color="#c8c6bf" metalness={0.95} roughness={0.25} />
      </mesh>

      {/* Memory packages around the SoC */}
      {[
        [-0.28, 0.16],
        [-0.28, -0.16],
        [0.38, 0.16],
        [0.38, -0.16],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.063, z]}>
          <boxGeometry args={[0.2, 0.028, 0.14]} />
          <meshStandardMaterial color="#111213" metalness={0.3} roughness={0.35} />
        </mesh>
      ))}

      {/* Power stages along the back edge */}
      {Array.from({ length: 6 }, (_, i) => -0.45 + i * 0.18).map((x) => (
        <mesh key={x} position={[x, 0.08, -d / 2 + 0.11]}>
          <boxGeometry args={[0.09, 0.07, 0.09]} />
          <meshStandardMaterial color="#232323" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => -0.5 + i * 0.14).map((x) => (
        <mesh key={x} position={[x, 0.07, d / 2 - 0.16]}>
          <cylinderGeometry args={[0.022, 0.022, 0.045, 16]} />
          <meshStandardMaterial color="#2f3b45" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}

      {/* Vapour chamber over SoC and memory */}
      <RoundedBox args={[1.02, 0.03, 0.62]} radius={0.012} smoothness={3} position={[0.05, 0.125, 0]}>
        <meshStandardMaterial color="#b9b5aa" metalness={0.95} roughness={0.22} />
      </RoundedBox>

      {/* Fin stack */}
      {fins.map((x) => (
        <mesh key={x} position={[0.05 + x, 0.235, 0]}>
          <boxGeometry args={[0.02, 0.19, 0.6]} />
          <meshStandardMaterial color={finColor} metalness={0.9} roughness={0.3} />
        </mesh>
      ))}

      {/* Edge connector: body and gold pins */}
      <mesh position={[0, 0.06, d / 2 + 0.02]}>
        <boxGeometry args={[1.14, 0.05, 0.07]} />
        <meshStandardMaterial color="#0c0c0c" metalness={0.2} roughness={0.5} />
      </mesh>
      {pins.map((x) => (
        <mesh key={x} position={[x, 0.06, d / 2 + 0.058]}>
          <boxGeometry args={[0.011, 0.034, 0.012]} />
          <meshStandardMaterial color="#d6a63a" metalness={1} roughness={0.22} />
        </mesh>
      ))}

      {/* Handle on the back edge */}
      <RoundedBox args={[0.56, 0.05, 0.08]} radius={0.02} smoothness={4} position={[0, 0.05, -d / 2 - 0.05]}>
        <meshStandardMaterial color="#8f8d86" metalness={0.7} roughness={0.35} />
      </RoundedBox>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.04, -d / 2 - 0.015]}>
          <boxGeometry args={[0.04, 0.03, 0.05]} />
          <meshStandardMaterial color="#5a5955" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* Captive screws */}
      {[
        [-w / 2 + 0.07, d / 2 - 0.07],
        [w / 2 - 0.07, d / 2 - 0.07],
        [-w / 2 + 0.07, -d / 2 + 0.07],
        [w / 2 - 0.07, -d / 2 + 0.07],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.05, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.012, 20]} />
          <meshStandardMaterial color="#6e6c66" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}

      {/* Label on the tray's front lip */}
      <mesh position={[-0.12, 0.052, d / 2 - 0.035]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.84, 0.13]} />
        <meshBasicMaterial map={labelTex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}
