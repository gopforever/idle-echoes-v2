import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/engine", "@repo/db"],
  experimental: {
    serverComponentsExternalPackages: ["postgres"],
  },
};

export default nextConfig;
