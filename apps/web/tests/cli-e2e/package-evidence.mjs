import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve(import.meta.dirname, "../../../../output");
const destination = resolve(output, "cli-evidence");
const archive = resolve(destination, "evidence.tar.gz");
let temporary;
try {
  rmSync(archive, { force: true });
  if (process.argv.length !== 2) throw new Error("Evidence packaging accepts no arguments");
  const sources = ["e2e", "playwright"].filter((name) => existsSync(resolve(output, name)));
  if (!sources.length) throw new Error("No owned CLI evidence trees found");
  if (sources.some((name) => !lstatSync(resolve(output, name)).isDirectory()))
    throw new Error("Owned evidence roots must be directories");
  mkdirSync(destination, { recursive: true });
  temporary = mkdtempSync(resolve(destination, "package-"));
  const pending = resolve(temporary, "evidence.tar.gz");
  const result = spawnSync("tar", ["-czf", pending, "--", ...sources], {
    cwd: output,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.status !== 0)
    throw new Error(
      result.error?.message ||
        result.stderr.trim() ||
        `Evidence packaging failed: exit ${result.status}, signal ${result.signal}`,
    );
  renameSync(pending, archive);
  console.log(`CLI evidence archive: ${archive}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
