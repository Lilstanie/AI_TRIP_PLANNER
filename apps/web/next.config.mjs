const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    tsconfigPath: process.env.NEXT_TSCONFIG_PATH || "tsconfig.json",
  },

  transpilePackages: [
    "@trip/shared",
    "@trip/orchestrator",
    "@trip/agents",
    "@trip/services",
    "@trip/tools",
  ],
};

export default nextConfig;
