#!/usr/bin/env node
// Fails when an E2E script ends without writing an artifact (a JSON summary, a screenshot or a report).
// CLAUDE.md requires every E2E check to leave a verifiable, repeatable artifact; review caught a script that
// created its output directory and never wrote to it, so this check makes the rule mechanical.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const E2E_DIR = join(ROOT, "apps/web/tests/e2e");
const WRITES_ARTIFACT = /writeFileSync\(|writeFile\(|\.screenshot\(/;

const scripts = readdirSync(E2E_DIR).filter((file) => file.endsWith(".e2e.mjs"));
const missing = scripts.filter(
  (file) => !WRITES_ARTIFACT.test(readFileSync(join(E2E_DIR, file), "utf8")),
);

if (missing.length > 0) {
  console.error("E2E scripts that write no artifact (writeFileSync, writeFile or screenshot):");
  for (const file of missing) console.error(`  apps/web/tests/e2e/${file}`);
  process.exit(1);
}
console.log(`All ${scripts.length} E2E scripts write an artifact.`);
