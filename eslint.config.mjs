// Shared ESLint flat config for packages/*. apps/web keeps its own `next lint` config

import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.turbo/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
  {
    basePath: fileURLToPath(new URL("packages/agents", import.meta.url)),
    files: ["src/**/*.ts"],
    ignores: ["src/place-lookup.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='places'][callee.object.property.name='maps']",
          message:
            "Call lookupPlaces from place-lookup.ts so a provider failure degrades to unavailable evidence instead of failing the plan.",
        },
      ],
    },
  },
  {
    files: ["**/tests/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
