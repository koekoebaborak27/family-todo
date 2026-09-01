import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/shared はビルド前のTypeScriptソースをそのまま公開しているため、
  // Next.js のバンドラーにトランスパイル対象として明示する。
  transpilePackages: ["shared"],
};

export default nextConfig;
