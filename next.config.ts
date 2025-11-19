import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents disabled: conflicts with dynamic routes needed for workspace viewer
  cacheComponents: false,
};

export default nextConfig;
