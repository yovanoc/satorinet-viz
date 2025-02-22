import type { NextConfig } from "next";

import './lib/env'

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
    // webpackBuildWorker: true,
    // parallelServerCompiles: true,
    ppr: true,
    reactCompiler: true,
  },
};

export default nextConfig;
