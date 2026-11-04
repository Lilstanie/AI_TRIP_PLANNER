import { describe, expect, it } from "vitest";
import type { ChatTurn } from "@trip/shared";
import { accountMemoryStore } from "@/lib/account/memory";

const turn = (content: string): ChatTurn => ({
  role: "user",
  content,
  at: new Date().toISOString(),
});

describe("short-term chat memory per account", () => {
  it("never shows one account's turns to another account with the same trip id", async () => {
    await accountMemoryStore("user-a").appendShortTerm("shared-trip", turn("A's hotel is in Ueno"));
    expect(await accountMemoryStore("user-b").getShortTerm("shared-trip")).toEqual([]);
    expect(await accountMemoryStore().getShortTerm("shared-trip")).toEqual([]);
  });

  it("keeps an account's own turns for its trip", async () => {
    await accountMemoryStore("user-c").appendShortTerm("own-trip", turn("Plan Hobart"));
    const turns = await accountMemoryStore("user-c").getShortTerm("own-trip");
    expect(turns.map((entry) => entry.content)).toEqual(["Plan Hobart"]);
  });
});
