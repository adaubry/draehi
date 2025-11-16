import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable cacheComponents for now to avoid prerendering issues with auth routes
  cacheComponents: false,
};

export default nextConfig;
