import { describe, expect, it } from "vitest";

import {
  errorNotice,
  failureNotice,
  NoticeError,
  noticeText,
  type Notice,
} from "@/lib/i18n/notice";

describe("noticeText", () => {
  it("shows a keyed notice in the interface language with its values filled in", () => {
    const notice: Notice = {
      key: "only {count} files can be attached to one message",
      params: { count: 4 },
    };

    expect(noticeText("en", notice)).toBe("only 4 files can be attached to one message");
    expect(noticeText("zh", notice)).toBe("每条消息最多添加 4 个文件");
  });

  it("shows provider or model text exactly as received in either language", () => {
    const notice: Notice = { raw: "Upstream said: quota exceeded (429)" };

    expect(noticeText("en", notice)).toBe("Upstream said: quota exceeded (429)");
    expect(noticeText("zh", notice)).toBe("Upstream said: quota exceeded (429)");
  });

  it("does not translate raw text that happens to equal a dictionary key", () => {
    expect(noticeText("zh", { raw: "Route lookup failed." })).toBe("Route lookup failed.");
  });

  it("translates a notice used as a value of another notice", () => {
    const notice: Notice = {
      key: "{name} wasn't attached — {reason}.",
      params: {
        name: "notes.txt",
        reason: { key: "text files over {size} can't be attached", params: { size: "2.0 MB" } },
      },
    };

    expect(noticeText("en", notice)).toBe(
      "notes.txt wasn't attached — text files over 2.0 MB can't be attached.",
    );
    expect(noticeText("zh", notice)).toBe("未添加 notes.txt——无法添加超过 2.0 MB 的文本文件。");
  });

  it("rejects a keyed notice whose parameter is missing at typecheck time", () => {
    // @ts-expect-error `{size}` must be given.
    const missing: Notice = { key: "text files over {size} can't be attached" };
    // @ts-expect-error a key with no placeholders takes no values.
    const extra: Notice = { key: "Route lookup failed.", params: { size: "1 MB" } };
    // @ts-expect-error only dictionary keys can be notices, so untranslated English cannot ship.
    const unknown: Notice = { key: "Something brand new went wrong." };

    expect([missing, extra, unknown]).toHaveLength(3);
  });

  it("leaves the placeholder visible, not `undefined`, when a parameter is missing at run time", () => {
    // A notice parsed from a response is not checked by the compiler.
    const parsed = JSON.parse(
      '{"key":"these files together would pass the {size} one message can carry"}',
    ) as Notice;

    expect(noticeText("en", parsed)).toBe(
      "these files together would pass the {size} one message can carry",
    );
    expect(noticeText("zh", parsed)).toBe("这些文件合计超过单条消息的 {size} 限制");
  });
});

describe("NoticeError", () => {
  it("carries its notice and keeps an English message for logs", () => {
    const error = new NoticeError({
      key: "text files over {size} can't be attached",
      params: { size: "2.0 MB" },
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("text files over 2.0 MB can't be attached");
    expect(noticeText("zh", error.notice)).toBe("无法添加超过 2.0 MB 的文本文件");
  });
});

describe("failureNotice", () => {
  const fallback: Notice = { key: "Request failed ({status}).", params: { status: 502 } };

  it("shows the keyed notice a route returned, in the interface language", () => {
    const body = {
      error: "Enter a place name to search.",
      notice: { key: "Enter a place name to search." },
    };

    expect(noticeText("zh", failureNotice(body, fallback))).toBe("输入地点名称后再搜索。");
  });

  it("shows an error with no notice exactly as received, since nothing says it was authored", () => {
    const notice = failureNotice({ error: "Gateway exploded" }, fallback);

    expect(notice).toEqual({ raw: "Gateway exploded" });
    expect(noticeText("zh", notice)).toBe("Gateway exploded");
  });

  it("falls back when the response had no readable body", () => {
    expect(noticeText("zh", failureNotice(undefined, fallback))).toBe("请求失败（502）。");
    expect(noticeText("zh", failureNotice("<html>", fallback))).toBe("请求失败（502）。");
  });

  it("ignores a malformed notice rather than showing `undefined`", () => {
    expect(failureNotice({ notice: { key: 5 } }, fallback)).toBe(fallback);
    expect(failureNotice({ notice: "plain", error: 7 }, fallback)).toBe(fallback);
  });
});

describe("errorNotice", () => {
  const fallback: Notice = { key: "Route unavailable" };

  it("keeps an authored error's notice", () => {
    const error = new NoticeError({ key: "No verified route was returned." });
    expect(noticeText("zh", errorNotice(error, fallback))).toBe("未返回已核实的路线。");
  });

  it("shows any other error's message exactly as raised", () => {
    expect(errorNotice(new TypeError("Failed to fetch"), fallback)).toEqual({
      raw: "Failed to fetch",
    });
  });

  it("uses the fallback for a thrown value that is not an error", () => {
    expect(errorNotice("nope", fallback)).toBe(fallback);
  });
});
