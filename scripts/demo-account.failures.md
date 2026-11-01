# Demo account failure inventory

`node --env-file=apps/web/.env.local scripts/demo-account.mjs` creates the shared demo account in the
Clerk development instance, or resets its password when it already exists, and prints the password once.
These failures must be observable:

- `CLERK_SECRET_KEY` is missing: exit 1 before any request.
- The key is a live key (`sk_live_`): exit 1 before any request; the demo account must never reach a
  production instance.
- Clerk rejects the request (wrong key, password sign-in disabled, network failure): exit 1 with the
  Clerk status and error code, never the key.
- A second run creates a duplicate account instead of resetting the existing one's password.
- The password is written to a file, the repository or the shell history.
