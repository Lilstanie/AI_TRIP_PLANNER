# App shell sign-in link failure modes

Written before the fix (2026-11-04), from the deployed sign-in page with the `TripPlannerMacApp` user
agent and the app's link rules.

- Apple sign-in sends `appleid.apple.com/auth/authorize` to the default browser, so the session ends
  up in Safari and the app stays signed out (seen on the old rules).
- GitHub sign-in sends `github.com/login/oauth/authorize` to the default browser (seen on the old
  rules).
- A step later in the provider's flow (GitHub's `/login` page, its `/session` form) leaves the app
  even though the first step stayed.
- Letting the provider hosts in also keeps ordinary links to them in the app: a repository page on
  `github.com`, or the Apple Account management pages.
- Email and password, the admin passcode and Sign up stop working in the app.
- Google sign-in starts loading inside the app, against Google's embedded web view policy.
- The Swift code and the test read different rules, so the test passes while the app still fails.

Added for the iOS app before its fix (2026-11-04), with the `TripPlannerIOSApp` user agent and the
rules Capacitor applies (`server.url`, `server.allowNavigation`, then the `TripLinks` plugin):

- The iOS app sends Apple and GitHub sign-in to Safari, as the Mac app did.
- Adding `appleid.apple.com` or `github.com` to `server.allowNavigation` would keep every page on those
  hosts in the app, because Capacitor matches hosts, not paths.
- The plugin reads its paths from a config key that `capacitor.config.json` does not have, so it
  allows nothing and the test, which reads the file, still passes.
