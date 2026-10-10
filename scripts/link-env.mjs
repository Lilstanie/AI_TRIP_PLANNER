#!/usr/bin/env node

import { existsSync, lstatSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootEnvLocal = resolve(repoRoot, ".env.local");
const target = resolve(repoRoot, "apps/web/.env.local");
const relativeTarget = relative(dirname(target), rootEnvLocal);

if (!existsSync(rootEnvLocal)) {
  process.exit(0);
}

const existingStat = lstatSync(target, { throwIfNoEntry: false });
if (existingStat) {
  if (existingStat.isSymbolicLink() && readlinkSync(target) === relativeTarget) {
    process.exit(0);
  }
  if (!existingStat.isSymbolicLink()) {
    console.warn(
      `[link-env] apps/web/.env.local already exists and is not a symlink; leaving it as is. ` +
        `Remove it and re-run "pnpm install" to link it to the root .env.local instead.`,
    );
    process.exit(0);
  }
  unlinkSync(target);
}

try {
  symlinkSync(relativeTarget, target);
} catch (error) {
  console.warn(
    `[link-env] Could not symlink apps/web/.env.local -> ${relativeTarget} (${error.code ?? error.message}). ` +
      `On Windows this needs Developer Mode or an elevated shell. Create it manually:\n` +
      `  ln -s ../../.env.local apps/web/.env.local`,
  );
}
