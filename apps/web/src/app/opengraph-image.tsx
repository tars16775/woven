import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Woven. One box for the whole house.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f3f2ee",
          color: "#1a1a1a",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", left: 72, top: 64, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -1 }}>woven</div>
          <div style={{ marginTop: 6, width: 34, height: 4, borderRadius: 2, background: "#c9962e" }} />
        </div>

        <div style={{ position: "absolute", left: 72, bottom: 72, display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <div style={{ fontSize: 22, color: "#6e6c66" }}>One box for the whole house</div>
          <div style={{ marginTop: 10, fontSize: 64, fontWeight: 500, letterSpacing: -2, lineHeight: 1.02 }}>
            Everything in your world, woven together.
          </div>
        </div>

        {/* The box */}
        <div
          style={{
            position: "absolute",
            right: 96,
            top: 110,
            width: 400,
            height: 360,
            borderRadius: 26,
            background: "linear-gradient(160deg, #f1efea 0%, #e3e1da 55%, #d8d6ce 100%)",
            boxShadow: "0 40px 80px -30px rgba(20,20,20,0.35)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              marginTop: 40,
              width: 300,
              height: 160,
              borderRadius: 14,
              background: "#141414",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#f3f2ee",
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#e8b85a", boxShadow: "0 0 30px 12px rgba(232,184,90,0.45)" }} />
            <div style={{ marginTop: 22, fontSize: 40, fontWeight: 600, letterSpacing: -1.5 }}>Ready.</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#9b9993" }}>4 devices · inside · Gate closed</div>
          </div>
          <div
            style={{
              marginTop: 32,
              width: 300,
              height: 78,
              borderRadius: 10,
              background: "rgba(255,255,255,0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -1 }}>woven</div>
            <div style={{ marginTop: 4, width: 28, height: 3, borderRadius: 2, background: "#c9962e" }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
