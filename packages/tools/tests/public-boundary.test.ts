/* eslint-disable @typescript-eslint/no-unused-vars -- the type imports below are unused on purpose; each must stay a type error. */
// Boundary failure inventory, recorded before the export change (#131):
// - a raw provider namespace remains reachable through the production package entry point;
// - a future refactor accidentally restores one of those exports;
// - a raw adapter function is re-exported under a new top-level name;
// - closing the raw exports also removes the public gateway or request-mode helpers.
import { describe, expect, it } from "vitest";
import * as publicTools from "@trip/tools";

// These imports must remain type errors. If an adapter is re-exported, tsc rejects
// the now-unused @ts-expect-error directive.
// @ts-expect-error Raw Maps adapters are not part of the package interface.
import type { maps as rawMaps } from "@trip/tools";
// @ts-expect-error Raw Booking adapters are not part of the package interface.
import type { booking as rawBooking } from "@trip/tools";
// @ts-expect-error Raw Weather adapters are not part of the package interface.
import type { weather as rawWeather } from "@trip/tools";

describe("@trip/tools production boundary", () => {
  it("exposes the gateway and mode helpers without raw provider namespaces", () => {
    expect(Object.keys(publicTools).sort()).toEqual([
      "configuredDataMode",
      "createToolGateway",
      "dataMode",
      "mockEnabled",
      "parseDataMode",
      "runWithDataMode",
    ]);
  });
});
