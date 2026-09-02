import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/shared はビルド前のTypeScriptソースをそのまま公開しているため、
  // Next.js のバンドラーにトランスパイル対象として明示する。
  transpilePackages: ["shared"],
};

export default nextConfig;

// `next dev` でもCloudflareのbinding（KV・R2等）をローカルで使えるようにする。
// 今のところbindingは使っていないが、OpenNextの標準セットアップとして入れておく。
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
