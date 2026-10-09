# E2E scripts that fail on main

English | [中文](e2e-known-failures.zh.md)

E2E scripts do not run in CI, so a script can fail on `main` for a while before anyone notices. Read this list
before deciding whether a failing script is your regression; update it when you find a script that fails on
`main` or fix one. Each entry says when it was last checked and what fails.

| Script         | Checked on `main` | What fails                                                                                                                                                                                | Issue    |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `liquid-glass` | 2026-10-09        | At phone width, clicking the Chat tab times out: the Next.js dev overlay (`nextjs-portal`) covers it after a dev-server error. Run with `--prod` to tell a real failure from the overlay. | none yet |
| `thinking-orb` | 2026-10-09        | "running subagents show orbs (0)" at 1440 light: no `.thinking-row__leading canvas.thinking-orb` appears, then the next wait times out.                                                   | none yet |

## Not failures

- `installable-app` waits forever under `next dev`, because the service worker registers only in a production
  build. Run it as its header says, `pnpm --filter @trip/web e2e installable-app --prod`; it passes (2026-10-09).

## How to check

```bash
git worktree add ../main-check origin/main && cd ../main-check && pnpm install
DATA_MODE=mock pnpm --filter @trip/web e2e <script>
```

The runner stops a script that runs past `E2E_SCRIPT_TIMEOUT_MS` and reports it as `TIME`; see
[development.md](development.md#testing-approach).
