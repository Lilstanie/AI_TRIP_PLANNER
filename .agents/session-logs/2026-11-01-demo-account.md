---
date: 2026-11-01
author: Claude Code (for Joey)
branch: feature/TP-232-demo-account
pr: pending
area: scripts, docs
contract-impact: none
---

# Shared demo account for the Week 13 demo (TP-232)

## What changed

- `scripts/demo-account.mjs`: creates `demo+clerk_test@example.com` in the Clerk development instance, or
  resets its password, and prints the password once. Refuses a missing or live key.
- `scripts/demo-account.failures.md`: failure inventory written before the script.
- `docs/demo-runbook.md` and `.zh.md`: new Demo account section.

## Why

The demo needs a signed-in session for the model and live data; a shared account avoids a personal one.
The `+clerk_test` address lets Clerk accept the fixed code `424242` on a new device without sending email.
The password stays out of the repository and is passed to the team privately.

## Validation

- Missing key, `sk_live_` key and an invalid `sk_test_` key each exit 1 with the expected message
  (the last reports `Clerk GET /users: 401 (clerk_key_invalid)`).
- `pnpm verify:docs`, translation pair check, Prettier, `check-file-length`: pass.
- The real account was not created from the cloud session; it needs Joey's local key.

## Notes for the next person

Run the script again to rotate the password after the demo.
