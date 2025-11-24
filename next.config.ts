import type { NextConfig } from "next";

import './lib/env'

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  cacheComponents: true,
  experimental: {
    parallelServerCompiles: true,
    turbopackFileSystemCacheForDev: true,
    // turbopackFileSystemCacheForBuild: true
  },
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  }
};

export default nextConfig;
