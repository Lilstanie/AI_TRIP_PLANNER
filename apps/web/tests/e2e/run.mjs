import { runLocalCli } from "./local-cli.mjs";

if (process.argv[2] === "run") {
  const args = process.argv.slice(3);
  if (args.includes("--repeat")) {
    const { runLocalRepeatCli } = await import("./repeat-cli.mjs");
    process.exitCode = await runLocalRepeatCli(args);
  } else process.exitCode = await runLocalCli(args);
} else {
  await import("./legacy-runner.mjs");
}
