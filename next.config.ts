import type { NextConfig } from "next";
import path from "node:path";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(process.cwd()),
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }] },
};
export default nextConfig;
