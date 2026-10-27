# Anonymous model boundary failure inventory

- A deployed anonymous chat may invoke the model in mock or live provider mode.
- A deployment without configured authentication may invoke a model.
- A production server outside Vercel may be mistaken for local development and invoke a model anonymously.
- An anonymous Agent Lab live request may start a model-backed run.
- A rejected live run may still call the provider.
- Signed-in and local no-auth model access may be broken by the gate; these need separate real-session and local tests.

Run a local counting model stub and a dev server with fake credentials, then run the E2E script:

```sh
node apps/web/tests/fixtures/model-counting-server.mjs
VERCEL_ENV=production USE_MOCK_TOOLS=true AGENT_LAB_LIVE_ENABLED=true DEEPSEEK_API_KEY=test-local DEEPSEEK_BASE_URL=http://127.0.0.1:3219 pnpm --filter @trip/web dev --port 3218
env -u VERCEL_ENV USE_MOCK_TOOLS=true AGENT_LAB_LIVE_ENABLED=true DEEPSEEK_API_KEY=test-local DEEPSEEK_BASE_URL=http://127.0.0.1:3219 NEXT_DIST_DIR=.next-local-boundary pnpm --filter @trip/web dev --port 3220
cd apps/web && node tests/e2e/anonymous-model-boundary.e2e.mjs
```

Run the stub and both development servers in separate terminals. Use an isolated Next.js
TypeScript configuration if needed to avoid changes to the checked-in configuration.

The summary is written to `apps/web/output/e2e/anonymous-model-boundary/summary.json`.
