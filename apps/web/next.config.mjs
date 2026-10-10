const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",

  transpilePackages: [
    "@trip/shared",
    "@trip/orchestrator",
    "@trip/agents",
    "@trip/services",
    "@trip/tools",
  ],
};

export default nextConfig;
