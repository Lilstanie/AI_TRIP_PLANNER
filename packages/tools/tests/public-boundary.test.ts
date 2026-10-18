/* eslint-disable @typescript-eslint/no-unused-vars -- the type imports below are unused on purpose; each must stay a type error. */

import { describe, expect, it } from "vitest";
import * as publicTools from "@trip/tools";

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
