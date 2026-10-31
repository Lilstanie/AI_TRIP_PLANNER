# Real Clerk authentication failure inventory

- Anonymous protected API requests redirect to HTML instead of returning 401 JSON.
- New API routes become public without an explicit allowlist decision.
- A genuine Clerk session cannot reach account storage or enable live mode.
- A second account reads or overwrites the first account's trip, including forged userId input.
- Invalid or expired session credentials are accepted.
- Public mock routes spend provider allowance while signed out.
- Missing account migrations fail after test accounts have already been provisioned.
- Temporary test users or their database rows survive test failure.
- Database cleanup failure prevents deletion of the temporary Clerk account.
- Test secrets, session tokens or personal data enter retained evidence.
- Constant, aliased or re-exported HTTP handlers are silently omitted from anonymous checks.
- HEAD/OPTIONS exports are omitted, or comments and type-only exports become false handlers.
- Discovery executes route modules and causes application or provider side effects.
- Route groups become literal URL segments, or private folders are treated as routes.
- HEAD refusals are incorrectly required to carry a JSON body, or body-bearing methods lose their notice check.

Scope: public mock policy from PR #443. Missing-Clerk deployments remain mock-only.
Daily quota enforcement remains pending #440; this suite must not claim it is implemented.
Expired valid JWTs and missing-Clerk production boot remain uncovered by this suite.
