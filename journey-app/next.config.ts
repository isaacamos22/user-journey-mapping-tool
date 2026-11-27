import type { NextConfig } from "next";
import path from "node:path";

const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_LOCAL_WORKBENCH: process.env.LOCAL_MODE !== "false" ? "true" : "false",
  },
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      const ignored = [
        "**/node_modules/**",
        path.join(projectRoot, ".next", "**"),
        path.join(projectRoot, "src", "generated", "**"),
        path.join(projectRoot, ".cursor-import", "**"),
      ];
      config.watchOptions = {
        ...config.watchOptions,
        ignored,
        aggregateTimeout: 800,
      };
    }
    return config;
  },
};

export default nextConfig;