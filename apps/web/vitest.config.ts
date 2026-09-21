import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Vitest's default assertion budget is 5s. This suite runs a full jsdom per
    // worker, and several tests dynamically import @trip/orchestrator, which
    // carries LangChain and LangGraph, or drive a focus cycle. Under the parallel
    // full-suite run those cold imports regularly pass 5s and fail on time rather
    // than on behaviour. A genuine hang still fails here, just later.
    testTimeout: 20_000,
  },
});
