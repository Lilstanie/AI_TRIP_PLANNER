import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Several tests dynamically import @trip/orchestrator, which carries
    // LangChain and LangGraph, or a next/dynamic component, inside jsdom. Under
    // the parallel full-suite run those cold imports regularly pass 5s and the
    // tests fail on time rather than on behaviour — they were already flaky on
    // main for this reason. A genuine hang still fails here, just later.
    testTimeout: 20_000,
  },
});
