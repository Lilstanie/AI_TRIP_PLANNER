import { lstatSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const DIST = /^\.next-e2e-([A-Za-z0-9]{6})$/;
const UNOWNED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const lockFor = (web, name) => resolve(web, `${name}.lock`);

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export function removeDist(web, name) {
  const match = DIST.exec(name);
  if (!match) return;
  rmSync(resolve(web, name), { recursive: true, force: true, maxRetries: 3 });
  rmSync(lockFor(web, name), { force: true });
  rmSync(resolve(web, `.tsconfig-e2e-raw-${match[1]}.json`), { force: true });
}

function ownerOf(web, name) {
  try {
    const pid = Number(readFileSync(lockFor(web, name), "utf8"));
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

export function sweepStaleDist(web, now = Date.now()) {
  for (const name of readdirSync(web)) {
    if (!DIST.test(name)) continue;
    try {
      const stat = lstatSync(resolve(web, name));
      if (!stat.isDirectory()) continue;
      const owner = ownerOf(web, name);
      const stale = owner !== undefined ? !alive(owner) : now - stat.mtimeMs > UNOWNED_MAX_AGE_MS;
      if (stale) removeDist(web, name);
    } catch {}
  }
}
