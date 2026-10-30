# File length check failure inventory

`node scripts/check-file-length.mjs [--base <ref>] [--max <lines>]` reports source files changed since
the merge base with `<ref>` (default `origin/main`) that are longer than `<max>` lines (default 1000).
These failures must be observable:

- An unknown argument, a value flag without a value, or a `--max` that is not a positive integer:
  usage error, exit 2.
- The base ref does not resolve: say so and exit 2, instead of passing because nothing was compared.
- A changed source file over the limit passes; it must be listed with its line count and exit 1.
- A file exactly at the limit, or an unchanged file over the limit, fails the check.
- A file that the diff deletes or renames away is read and crashes the check.
- An untracked or staged new file over the limit is missed.
- Generated or data files (`pnpm-lock.yaml`, `next-env.d.ts`, Markdown, JSON, SVG, snapshots) are
  counted as source.
- A final line without a trailing newline is not counted.
