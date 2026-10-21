import { describe, expect, it } from "vitest";
import { replyLanguage } from "../src/reply-language";

describe("reply language", () => {
  it("follows the language of the latest message", () => {
    expect(replyLanguage("去悉尼玩 4 天", "en")).toBe("zh");
    expect(replyLanguage("去 Sydney 玩", "en")).toBe("zh");
    expect(replyLanguage("悉尼", "en")).toBe("zh");
    expect(replyLanguage("Plan 4 days in Sydney", "zh")).toBe("en");
  });

  it("uses the interface language when the message has no language", () => {
    expect(replyLanguage("2026-12-01, 2", "zh")).toBe("zh");
    expect(replyLanguage("", "zh")).toBe("zh");
    expect(replyLanguage("", "en")).toBe("en");
  });

  it("falls back to English with no interface language", () => {
    expect(replyLanguage("2026-12-01", undefined)).toBe("en");
    expect(replyLanguage("", undefined)).toBe("en");
  });
});
