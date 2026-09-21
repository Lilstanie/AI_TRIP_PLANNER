import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Vitest's default assertion budget is 5s. This suite runs a full jsdom per
    // worker, and a handful of its tests drive a cold `next/dynamic` import or a
    // focus cycle; on a loaded machine those have been measured at 3-6s, so they
    // failed intermittently while passing in isolation. 15s still fails a genuine
    // hang, and stops load from deciding the result.
    testTimeout: 15_000,
  },
});
