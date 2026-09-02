import { ImageResponse } from "next/og";

// ブラウザとPWAのホーム画面に表示するアプリアイコンの大きさを定義する。
export const size = {
  width: 512,
  height: 512,
};

// 生成するアプリアイコンの画像形式を定義する。
export const contentType = "image/png";

// 家族で共有する予定を表す、チェック付きカレンダーのアイコンを生成する。
export default function Icon() {
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
          borderRadius: 96,
          display: "flex",
          flexDirection: "column",
          height: 356,
          justifyContent: "center",
          padding: "36px 40px",
          width: 356,
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#4a3f2c",
            borderRadius: 16,
            display: "flex",
            height: 52,
            justifyContent: "space-around",
            marginBottom: 20,
            width: "100%",
          }}
        >
          <div style={{ background: "#fdf8f0", borderRadius: 8, height: 20, width: 20 }} />
          <div style={{ background: "#fdf8f0", borderRadius: 8, height: 20, width: 20 }} />
          <div style={{ background: "#fdf8f0", borderRadius: 8, height: 20, width: 20 }} />
        </div>
        <div
          style={{
            alignItems: "center",
            background: "#fce3d6",
            borderRadius: 32,
            display: "flex",
            height: 164,
            justifyContent: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              borderBottom: "24px solid #e8734a",
              borderRight: "24px solid #e8734a",
              height: 72,
              transform: "rotate(45deg) translate(-12px, -12px)",
              width: 136,
            }}
          />
        </div>
      </div>
    </div>,
    size,
  );
}
