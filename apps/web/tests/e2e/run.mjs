import { runLocalCli } from "./local-cli.mjs";
import { runDiscoveryCli } from "./discovery.mjs";

if (process.argv[2] === "run") {
  process.exitCode = await runLocalCli(process.argv.slice(3));
} else if (["doctor", "list"].includes(process.argv[2])) {
  process.exitCode = runDiscoveryCli(process.argv[2], process.argv.slice(3));
} else {
  await import("./legacy-runner.mjs");
}
