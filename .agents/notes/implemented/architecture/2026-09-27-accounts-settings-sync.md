# Agent Note: Optional accounts sync trips, chats and settings to Postgres

Status: implemented

The [workspace login gate](2026-09-28-workspace-login-gate.md) supersedes optional sign-in for
configured deployments. This note continues to own local mode, account storage and synchronization.

## Problem

The workspace was single-user and browser-local: chats and trips lived only in the `localStorage`
catalog, a traveller's defaults were retyped for every trip, and nothing followed them to another
device. The "Local" account button only explained that there was no sign-in, and Language was the
only setting. The deployment is on Vercel under the repository owner's team, which contributors
cannot provision.

## Decision

- **Accounts: Clerk** (`@clerk/nextjs`), enabled only when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is
  set (`apps/web/lib/auth/config.ts`). Without it `apps/web/middleware.ts` steps aside and
  `app/layout.tsx` renders no `ClerkProvider`, so CI, fresh clones and deployments without the
  integration keep the local workspace. Components read `useAccount()`
  (`components/account/AccountProvider.tsx`: `local`, `loading`, `signed-out`, `signed-in`) rather
  than Clerk hooks.
- **Database: Neon Postgres** through Drizzle (`apps/web/lib/db/`), enabled only when
  `DATABASE_URL` is set and created lazily by `getDb()`. Migrations are generated SQL under
  `apps/web/drizzle/`. Tables: `user_settings` (one row per Clerk user id, settings as JSONB), and
  `trips` and `conversations` (primary key user id and record id, the catalog record as JSONB,
  `updated_at`, `deleted_at` as a tombstone). There is no users table: Clerk owns identity.
- **Routes** (`app/api/account/`): settings `GET`/`PUT`, sync `GET`/`POST`, export `GET` and account
  `DELETE`. Each resolves the user with `accountUser()` and filters every query by that id. Writes
  are last-write-wins in SQL (`ON CONFLICT … WHERE excluded.updated_at > updated_at`).
- **Sync** (`lib/account/catalog-sync.ts`, `components/account/useAccountSync.ts`): the
  `localStorage` catalog stays the working store. On sign-in the account's records are merged with
  the catalog per record (newer `updatedAt` wins whole; tombstones newer than an edit delete it),
  remote records pass the catalog's own parsers and the merged catalog is re-validated by
  `parseCatalog`. Afterwards changes are pushed 1.5 s after they happen; the last synced times are
  kept under `trip.sync.v1`, per user. Untouched blank chats and panel layout stay local.
- **Settings** (`lib/account/settings.ts`, `components/account/SettingsProvider.tsx` and
  `SettingsDialog.tsx`): a travel profile (home city, travellers, AUD budget, pace, interests,
  dietary needs, standing preferences), memberships, appearance and default data mode, kept under
  `trip.settings.v1` and, signed in, in `user_settings` (newer copy wins). The travel profile
  prefills a new chat's facts and its trip preference lines (`draftDefaults`), and a chat whose
  facts still equal those defaults counts as untouched. Appearance sets `data-theme` on `<html>`;
  the dark tokens apply under it or under a dark system setting unless Light is chosen.
- **Provisioning:** contributors use their own free Clerk application and a Neon `dev` branch in
  `.env.local`; production uses the owner's Vercel Marketplace integrations, which inject the same
  variable names.

Failure modes, each with a defined outcome: missing Clerk keys → local mode; Clerk without
`DATABASE_URL` → 503 on account routes, data stays local; no session → 401, sync stops, local data
kept; invalid or oversized body → 400, nothing written; another user's record id → never visible,
every query is scoped; network or database failure → changes stay pending and go with the next
push; concurrent edits on two devices → the newer record wins whole; deletion against a later edit
→ the later one wins; client clock skew → accepted for one person's devices; account deletion →
rows first, then Clerk, 502 if Clerk fails; sign-out → this browser's copy stays.

## Alternatives considered

**Supabase (auth and Postgres together).** One vendor, but its auth UI and session model fit the
glass workspace less readily than Clerk's components, and Clerk is Vercel's native auth integration.

**Auth.js with a self-managed user table.** No auth vendor, but password and session security would
be this project's to build and maintain.

**Keep Upstash Redis as the only store.** It already holds the planner's chat turns and SerpApi
quota, but per-user relational data fits Postgres better.

## Consequences

- Travellers can sign in and find their chats, trips and settings on another device; the travel
  profile shapes every new trip.
- Without the integrations nothing changes, so CI and the current deployment are unaffected; the
  production deployment needs the owner to add Clerk and Neon.
- Last-write-wins on whole records loses a concurrent edit made on another device.
- A shared browser keeps the previous user's local catalog after sign-out.
- Signing in goes through Clerk's hosted pages, so automated checks cover the signed-out and local
  paths; the signed-in path is verified by hand.

## Sources

- [Workspace catalog trip storage](2026-09-24-workspace-catalog-trip-storage.md), which remains
  the local store; its "browser-local storage over accounts" choice is superseded here.
- [Session log](../../../session-logs/2026-09-27-accounts-settings.md).
