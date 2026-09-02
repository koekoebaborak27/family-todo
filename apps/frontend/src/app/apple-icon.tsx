import { ImageResponse } from "next/og";

// iPhoneとiPadのホーム画面に表示するアプリアイコンの大きさを定義する。
export const size = {
  width: 180,
  height: 180,
};

// iPhoneとiPad向けに生成するアプリアイコンの画像形式を定義する。
export const contentType = "image/png";

// 家族で共有する予定を表す、チェック付きカレンダーのアイコンを生成する。
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#e8734a",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "#fdf8f0",
          borderRadius: 34,
          display: "flex",
          flexDirection: "column",
          height: 126,
          justifyContent: "center",
          padding: "13px 14px",
          width: 126,
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#4a3f2c",
            borderRadius: 6,
            display: "flex",
            height: 18,
            justifyContent: "space-around",
            marginBottom: 7,
            width: "100%",
          }}
        >
          <div style={{ background: "#fdf8f0", borderRadius: 3, height: 7, width: 7 }} />
          <div style={{ background: "#fdf8f0", borderRadius: 3, height: 7, width: 7 }} />
          <div style={{ background: "#fdf8f0", borderRadius: 3, height: 7, width: 7 }} />
        </div>
        <div
          style={{
            alignItems: "center",
            background: "#fce3d6",
            borderRadius: 12,
            display: "flex",
            height: 58,
            justifyContent: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              borderBottom: "9px solid #e8734a",
              borderRight: "9px solid #e8734a",
              height: 27,
              transform: "rotate(45deg) translate(-5px, -5px)",
              width: 48,
            }}
          />
        </div>
      </div>
    </div>,
    size,
  );
}
