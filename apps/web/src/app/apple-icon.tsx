import { ImageResponse } from "next/og";

// Home-screen icon. iOS masks its own corners, so the square is filled edge to
// edge in bone and the mark is scaled up from the tab icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          color: "#1a1a1a",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: "#e8b85a",
            boxShadow: "0 0 36px 14px rgba(232,184,90,0.55), 0 0 70px 30px rgba(201,150,46,0.22)",
          }}
        />
        <div style={{ marginTop: 22, fontSize: 84, fontWeight: 600, lineHeight: 1, letterSpacing: -3 }}>w</div>
      </div>
    ),
    size,
  );
}
