# @trip/web

The Next.js workspace and its API routes: chat, preferences, trip timeline, map (Google first,
OpenStreetMap fallback), saved trips with optional account sync, the installable app shell and
`/agent-lab`. Owners: E (@WhW0591) for UI, A (@Lilstanie) for `app/api/`.

## Layout

| Path          | Contents                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `app/api/`    | Thin route handlers; formats are in [api.md](../../docs/api.md)                                                          |
| `app/styles/` | Domain stylesheets imported by `app/globals.css`                                                                         |
| `components/` | UI by feature: `workspace`, `chat`, `trip`, `map`, `preferences`, `account`, `agent-lab`, `pwa`, `ui`                    |
| `lib/`        | Domain logic; external clients in `lib/integrations/`, Web map providers in `lib/map-provider/`                          |
| `tests/`      | Tests mirroring `app`, `components` and `lib`; browser journeys in `e2e/`, CLI and CI acceptance in `cli-e2e/` and `ci/` |

Placement rules, Tailwind v4 and shadcn usage, and the 1000-line file limit are in
[development.md](../../docs/development.md#code-organization). Current behaviour is in
[workspace-ui.md](../../docs/workspace-ui.md); visual rules are in
[ui-guidelines.md](../../docs/design/ui-guidelines.md).

## Configuration

Map keys and providers (`MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_*`, `WEB_MAPS_PROVIDER` and the
OpenStreetMap service URLs), the optional Clerk and `DATABASE_URL` account settings and
`NEXT_DIST_DIR` are listed in [development.md](../../docs/development.md#environment-variables); the
packages it calls read their own variables. Next.js loads `.env*` only from this directory, so
`pnpm install` links `apps/web/.env.local` to the root file
([note](../../.agents/notes/implemented/process/2026-09-21-env-local-symlink.md)).

## Commands

`pnpm --filter @trip/web dev` (port 3000), `test`, `typecheck`, `lint`, `build` and `e2e <name>`.
The isolated local runner is described in [local-test-cli.md](../../docs/local-test-cli.md). Verify
visible changes with the [ui-verification skill](../../.agents/skills/ui-verification/SKILL.md).
