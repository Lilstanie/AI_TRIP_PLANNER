// Failure inventory: old settings rejected, absent currency not AUD, unsupported currency accepted.
import { describe, expect, it } from "vitest";
import { defaultSettings, UserSettings } from "@/lib/account/settings";

describe("display currency settings", () => {
  it("loads old settings with AUD and keeps an explicit supported choice", () => {
    const { displayCurrency: _absent, ...old } = defaultSettings();
    expect(UserSettings.parse(old).displayCurrency).toBe("AUD");
    expect(UserSettings.parse({ ...old, displayCurrency: "JPY" }).displayCurrency).toBe("JPY");
    expect(UserSettings.safeParse({ ...old, displayCurrency: "GBP" }).success).toBe(false);
  });
});
