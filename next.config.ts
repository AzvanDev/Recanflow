import type { NextConfig } from "next";
import path from "node:path";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(process.cwd()),
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }] },
  // pdf-parse (via pdfjs-dist) and mammoth assume a plain CJS `require`/`exports` environment;
  // Next.js's default webpack bundling for API routes breaks that. Marking them "external"
  // makes Next.js load them with Node's own require at runtime instead of bundling them.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
};
export default nextConfig;
