import type { NextConfig } from "next";

import './lib/env'

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  cacheComponents: true,
  experimental: {
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    turbopackFileSystemCacheForDev: true
  },
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  }
};

export default nextConfig;
