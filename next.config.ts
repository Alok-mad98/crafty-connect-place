import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force all pages to render client-side only — eliminates SSR "rendering" flash
  reactStrictMode: true,
};

export default nextConfig;