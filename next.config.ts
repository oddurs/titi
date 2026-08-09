import type { NextConfig } from "next";

/**
 * The calculator is entirely client-side, so it ships as a static export.
 * GitHub Pages serves project sites from a subpath, which the deploy workflow
 * passes in as NEXT_PUBLIC_BASE_PATH (empty for local builds and user sites).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
