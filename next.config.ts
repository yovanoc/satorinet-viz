import type { NextConfig } from "next";

import './lib/env'

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
    dynamicIO: true,
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    ppr: true,
    reactCompiler: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  }
};

export default nextConfig;
