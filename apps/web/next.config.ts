import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/engine", "@repo/db"],
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
