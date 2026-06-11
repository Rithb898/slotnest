import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  typedRoutes: true,
  logging: {
    browserToTerminal: true,
  },
};

export default nextConfig;
