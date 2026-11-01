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
- The refusal checker rejects the current `signInToUseYour` notice key after an interface-copy migration.
- An expiry test starts with an already invalid token, modifies its signature, refreshes it, or revokes the session instead of observing natural expiry.
- A production build without Clerk permits live data or model calls instead of the accepted public mock-only policy.
- A deployed probe follows redirects, sends credentials, invokes a mutating method or treats a Vercel access wall as application acceptance.
- A deployment receipt claims protection for untested methods or a different source revision.

Scope: the public mock policy from PR #443 and the implemented model-access decision.
Missing-Clerk production runs use `--without-clerk` with a local counting model stub;
`--deployment` sends only anonymous GET requests and does not prove the hosted source revision.
The genuine-session journey freezes a freshly accepted bearer token, waits beyond its natural expiry
and clock-skew window, then requires uncached 401 from the same token without renewal or sign-out.
A prepared journey is not evidence of a successful real-session run. Daily per-user quotas remain
deferred by the model-access decision; this suite does not claim quota enforcement.
