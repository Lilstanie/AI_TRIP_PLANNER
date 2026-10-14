import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
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

  it("round-trips large Unicode plan and chat content through a Redis REST-compatible HTTP service", async () => {
    vi.stubEnv("KV_REST_API_TOKEN", "test-token");
    const values = new Map<string, string>();
    const requests: {
      url: string;
      body: string;
      authorization: string | undefined;
      contentType: string | undefined;
    }[] = [];
    const service = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({
        url: request.url ?? "",
        body,
        authorization: request.headers.authorization,
        contentType: request.headers["content-type"],
      });
      const [operation, key, value] = JSON.parse(body) as string[];
      let result: string | null = "OK";
      if (operation === "set") values.set(key!, value!);
      if (operation === "get") result = values.get(key!) ?? null;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ result }));
    });
    await new Promise<void>((resolve, reject) => {
      service.once("error", reject);
      service.listen(0, "127.0.0.1", resolve);
    });
    const address = service.address();
    if (!address || typeof address === "string") throw new Error("HTTP test service did not bind.");
    vi.stubEnv("KV_REST_API_URL", `http://127.0.0.1:${address.port}`);
    const plan = {
      title: "東京・京都 family itinerary",
      days: Array.from({ length: 18 }, (_, day) => ({
        day,
        notes: "家族で楽しむ旅程 🗾 café — 🚆 ".repeat(900),
      })),
    };
    const chat = Array.from({ length: 48 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: `第${index + 1}条消息：请保留東京・京都的所有旅行细节。`.repeat(240),
    }));
    const store = createJsonStore();

    try {
      await store.set("plan:large-unicode", plan);
      await store.set("chat:large-unicode", chat);

      expect(await store.get("plan:large-unicode")).toEqual(plan);
      expect(await store.get("chat:large-unicode")).toEqual(chat);
      expect(requests).toHaveLength(4);
      expect(requests.every(({ url }) => url === "/")).toBe(true);
      expect(requests.every(({ authorization }) => authorization === "Bearer test-token")).toBe(
        true,
      );
      expect(requests.every(({ contentType }) => contentType === "application/json")).toBe(true);
      expect(requests.some(({ body }) => Buffer.byteLength(body) > 100_000)).toBe(true);
      expect(requests.every(({ url }) => url.length < 100)).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        service.close((error) => (error ? reject(error) : resolve())),
      );
    }
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
  it("retains the latest twenty of hundreds of turns including the current turn", async () => {
    const tripId = crypto.randomUUID();
    for (let i = 0; i < 300; i++)
      await memory.appendShortTerm(tripId, {
        role: "user",
        content: `第 ${i} 轮规划 🧭`,
        at: "2026-10-14T00:00:00.000Z",
      });
    const turns = await memory.getShortTerm(tripId);
    expect(turns).toHaveLength(20);
    expect(turns[0].content).toBe("第 280 轮规划 🧭");
    expect(turns.at(-1)?.content).toBe("第 299 轮规划 🧭");
  });
});
