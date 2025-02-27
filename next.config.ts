import type { NextConfig } from "next";

import './lib/env'

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    reactCompiler: true,
    // dynamicIO: true,
    // ppr: true,
    // viewTransition: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  }
};

export default nextConfig;
