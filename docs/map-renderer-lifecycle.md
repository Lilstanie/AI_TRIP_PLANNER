# Map renderer lifecycle

`TripMap` disposes marker and route layers, observers, animation frames and pending callbacks before
disposing its renderer. Each renderer owns one full-height child of the map surface. A failed Google
constructor removes that child before fallback; a late SDK response cannot create a map after unmount.
Google authentication subscriptions preserve the existing host callback, snapshot listeners before
dispatch and restore the host callback when the last owner leaves.

Fallback belongs to the mounted map. A new mount follows the configured provider again; failed Trip
identities are not cached. Strict Google mode keeps saved places and an explicit retry action instead
of silently switching providers. OSM disables satellite controls. The phone Trip home map has a fixed
340px height so its renderer can fill a definite containing block.

## Browser fixture

Run from the repository root with real credentials blank:

```bash
env -u BASE_URL LABEL=map-lifecycle-check \
  DEEPSEEK_API_KEY= MINIMAX_API_KEY= MAPS_API_KEY= \
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=fixture-only NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID= \
  SERPAPI_KEY= WEATHER_API_KEY= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= \
  DATABASE_URL= KV_REST_API_URL= KV_REST_API_TOKEN= \
  UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= \
  DATA_MODE=mock USE_MOCK_TOOLS=true E2E_SCRIPT_TIMEOUT_MS=420000 \
  pnpm --filter @trip/web e2e map-renderer-lifecycle --prod
```

The existing raw runner owns an isolated production build and server. The Google SDK is a local
browser fixture; MapLibre is real and uses an empty local style. External browser HTTP is intercepted.
The synthetic browser key is not a credential. Scenarios cover SDK, constructor and authentication
failure, strict retry, successful Google rendering, delayed load after unmount, keyboard marker details
and 520/521 breakpoint transitions in English and Chinese.

Screenshots and assertions are retained under
`output/playwright/map-renderer-lifecycle/<LABEL>/`; runner results are under `output/e2e/runner/`.
Keep red evidence when rerunning with a new label. These fixtures do not verify live Google services,
production login, physical devices or route duration accuracy.
