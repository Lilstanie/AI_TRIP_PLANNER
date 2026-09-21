# @trip/web

The Next.js workspace and its API routes: chat, preferences, trip timeline, Google map and saved
trips. Owners: E (@WhW0591) for UI, A (@Lilstanie) for `app/api/`.

## Layout

| Path          | Contents                                                               |
| ------------- | ---------------------------------------------------------------------- |
| `app/api/`    | Thin route handlers; formats are in [api.md](../../docs/api.md)        |
| `app/styles/` | Domain stylesheets imported by `app/globals.css`                       |
| `components/` | UI by feature: `workspace`, `chat`, `trip`, `map`, `preferences`, `ui` |
| `lib/`        | Browser-safe domain logic; external clients in `lib/integrations/`     |
| `tests/`      | Tests mirroring `app`, `components` and `lib`, plus fixtures and setup |

Placement rules, Tailwind v4 and shadcn usage, and the 1000-line file limit are in
[development.md](../../docs/development.md#code-organization). Current behaviour is in
[workspace-ui.md](../../docs/workspace-ui.md); visual rules are in
[ui-guidelines.md](../../docs/design/ui-guidelines.md).

## Configuration

Reads `MAPS_API_KEY` on the server, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` in the browser, and `NEXT_DIST_DIR` for the build directory; the
packages it calls read their own variables. Next.js loads `.env*` only from this directory, so
`pnpm install` links `apps/web/.env.local` to the root file
([note](../../.agents/notes/implemented/process/2026-09-21-env-local-symlink.md)).

## Commands

`pnpm --filter @trip/web dev` (port 3000), `test`, `typecheck`, `lint` and `build`. Verify visible
changes with the [ui-verification skill](../../.agents/skills/ui-verification/SKILL.md).
