import { runLocalCli } from "./local-cli.mjs";

if (process.argv[2] === "run") {
  process.exitCode = await runLocalCli(process.argv.slice(3));
} else {
  await import("./legacy-runner.mjs");
}
