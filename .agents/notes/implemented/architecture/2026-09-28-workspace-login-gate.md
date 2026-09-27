# Agent Note: Require sign-in before opening a configured workspace

Status: implemented

## Problem

The account-enabled workspace opened anonymously, and sign-in lived inside Settings. The owner
requests a dedicated login screen and a redirect when a visitor has not signed in.

## Decision

- `apps/web/middleware.ts` checks Clerk sessions before page rendering and redirects signed-out
  visitors to `/sign-in`. Login, registration, Clerk proxy and API routes remain reachable;
  APIs retain their existing authorization and response contracts.
- `/sign-in` and `/sign-up` share `components/account/AuthScreen.tsx`, using Clerk's path-routed
  forms and the workspace's design tokens. OAuth, email, recovery and verification remain with Clerk.
- Successful login or registration opens `/`. Signed-in visitors to the two auth entry pages return
  there. `AccountProvider` hides children and navigates to sign-in when a loaded session disappears;
  explicit sign-out also redirects to `/sign-in`.
- Without a Clerk publishable key, middleware steps aside and auth pages return to `/`, preserving
  the local workspace. No keys or database requirements are added.
- This partly supersedes [optional accounts](2026-09-27-accounts-settings-sync.md): sign-in is
  required for configured page navigation; its persistence and synchronization decisions still apply.

## Alternatives considered

- A client-only redirect would render the workspace before Clerk resolves the session. Middleware
  supplies the initial gate, with a client redirect handling session loss on an already open page.
- Keeping the Settings login modal does not provide the requested independent entry screen.

## Consequences

- Configured deployments require an account to enter the workspace; local clones without Clerk keep
  working. Auth forms remain the provider's responsibility rather than custom credential handling.
- The browser-local catalog is preserved on logout. This gate does not isolate that catalog between
  accounts on a shared browser or add authorization to public planner APIs.
- Login always opens the main workspace, rather than accepting an arbitrary return URL.

## Sources

- [Workspace UI](../../../../docs/workspace-ui.md#accounts-and-settings).
