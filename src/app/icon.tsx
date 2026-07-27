import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2C4A7C",
          color: "#FAF9F6",
          fontFamily: "Georgia, serif",
          fontSize: 22,
          borderRadius: 7,
        }}
      >
        P
      </div>
    ),
    { ...size }
  );
}
