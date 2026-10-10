import { runLocalCli } from "./local-cli.mjs";
import { runDiscoveryCli } from "./discovery.mjs";

if (process.argv[2] === "run") {
  const args = process.argv.slice(3);
  if (args.includes("--repeat")) {
    const { runLocalRepeatCli } = await import("./repeat-cli.mjs");
    process.exitCode = await runLocalRepeatCli(args);
  } else process.exitCode = await runLocalCli(args);
} else if (process.argv[2] === "report") {
  const { reportLocalCli } = await import("./report-cli.mjs");
  process.exitCode = reportLocalCli(process.argv.slice(3));
} else if (["doctor", "list"].includes(process.argv[2])) {
  process.exitCode = runDiscoveryCli(process.argv[2], process.argv.slice(3));
} else {
  await import("./legacy-runner.mjs");
}
