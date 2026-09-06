import { ImageResponse } from "next/og";
export const dynamic = "force-static";

// Woven tab icon: a bone rounded square, the amber "Ready." light with a soft
// glow, and the lowercase wordmark's first letter.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f2ee",
          borderRadius: 14,
          color: "#1a1a1a",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: "#e8b85a",
            boxShadow: "0 0 14px 6px rgba(232,184,90,0.55), 0 0 26px 12px rgba(201,150,46,0.22)",
          }}
        />
        <div style={{ marginTop: 8, fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: -1 }}>w</div>
      </div>
    ),
    size,
  );
}
