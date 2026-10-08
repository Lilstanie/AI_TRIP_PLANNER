// Shared ESLint flat config for packages/*. apps/web keeps its own `next lint` config
// (apps/web/.eslintrc.json).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// apps/web bans `.toFixed(2)` so UI amounts go through its Money module. It is not repeated here:
// the packages build agent prompt and tool text with it in about 30 places, and that module lives
// in apps/web.
export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.turbo/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // A leading underscore marks a parameter kept only to match an interface.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Plain Node scripts, such as the tools mock server, have no TypeScript globals.
    files: ["**/*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
  {
    // Tests build loose event fixtures; typing each one adds noise without catching bugs.
    files: ["**/tests/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
