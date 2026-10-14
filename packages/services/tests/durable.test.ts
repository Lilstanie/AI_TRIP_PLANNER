import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatTurn, UserPreference } from "@trip/shared";
import { createJsonStore } from "../src/durable";
import { memory } from "../src/memory";

describe("durable JSON store", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("keeps the MemoryStore contract when no shared store is configured", async () => {
    const store = createJsonStore();
    const turn: ChatTurn = { role: "user", content: "Plan Sydney", at: new Date().toISOString() };
    const pref: UserPreference = { key: "pace", value: "relaxed", source: "filter" };

    await store.set("test:durable:value", { turn, pref });
    expect(await store.get("test:durable:value")).toEqual({ turn, pref });
    expect(await store.increment("test:durable:counter")).toBe(1);
    expect(await store.increment("test:durable:counter")).toBe(2);
  });

  it("uses the configured Redis REST boundary for reads, writes and counters", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "test-token");
    const calls: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string, init?: RequestInit) => {
        calls.push({ url: String(input), command: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify({ result: "7" }), { status: 200 });
      }),
    );
    const store = createJsonStore();

    await store.set("test:redis:value", { ok: true });
    await store.get("test:redis:value");
    await store.increment("test:redis:counter");

    expect(calls).toEqual([
      { url: "https://redis.example", command: ["set", "test:redis:value", '{"ok":true}'] },
      { url: "https://redis.example", command: ["get", "test:redis:value"] },
      { url: "https://redis.example", command: ["incr", "test:redis:counter"] },
    ]);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("persists chat and preference records through the same boundary", async () => {
    const tripId = `durable-test-${crypto.randomUUID()}`;
    const userId = `durable-user-${crypto.randomUUID()}`;
    await memory.appendShortTerm(tripId, {
      role: "assistant",
      content: "Saved answer",
      at: new Date().toISOString(),
    });
    await memory.setLongTerm(userId, { key: "pace", value: "slow", source: "chat_confirmed" });

    expect((await memory.getShortTerm(tripId)).map(({ content }) => content)).toEqual([
      "Saved answer",
    ]);
    expect(await memory.getLongTerm(userId)).toEqual([
      { key: "pace", value: "slow", source: "chat_confirmed" },
    ]);
  });
  it("retains the latest twenty turns including the current turn", async () => {
    const tripId = crypto.randomUUID();
    for (let i = 0; i < 25; i++)
      await memory.appendShortTerm(tripId, {
        role: "user",
        content: `turn ${i}`,
        at: "2026-10-14T00:00:00.000Z",
      });
    const turns = await memory.getShortTerm(tripId);
    expect(turns).toHaveLength(20);
    expect(turns[0].content).toBe("turn 5");
    expect(turns.at(-1)?.content).toBe("turn 24");
  });
});
