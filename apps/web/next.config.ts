import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/engine", "@repo/db"],
  serverExternalPackages: ["postgres"],
  webpack(config) {
    // Allow TypeScript ESM packages to use `.js` extensions in imports
    // (tsc convention) while webpack resolves them to actual `.ts` files.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
