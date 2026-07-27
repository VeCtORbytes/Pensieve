import { ImageResponse } from "next/og";

export const alt = "Pensieve — a grounded notebook for your sources";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          background: "#FAF9F6",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 20,
            background: "#2C4A7C",
            color: "#FAF9F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontFamily: "Georgia, serif",
            marginBottom: 36,
          }}
        >
          P
        </div>
        <div style={{ fontSize: 76, color: "#1A1D26", fontFamily: "Georgia, serif" }}>
          Pensieve
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#6B6F76",
            marginTop: 18,
            fontFamily: "sans-serif",
          }}
        >
          Ask grounded questions about your sources
        </div>
      </div>
    ),
    { ...size }
  );
}
