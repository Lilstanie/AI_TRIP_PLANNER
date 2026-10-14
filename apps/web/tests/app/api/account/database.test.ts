import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { defaultSettings } from "@/lib/account/settings";

const identity = vi.hoisted(() => ({ userId: "alice" as string | null, enabled: true }));
let db: ReturnType<typeof drizzle>;
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: identity.userId }) }));
vi.mock("@/lib/auth/config", () => ({ authEnabled: true }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db, dbEnabled: () => identity.enabled }));
import { GET, POST } from "@/app/api/account/sync/route";
import { GET as settingsGet, PUT } from "@/app/api/account/settings/route";

const engine = new PGlite();
beforeAll(async () => {
  await engine.exec(await readFile(resolve("drizzle/0000_fantastic_doomsday.sql"), "utf8"));
  await engine.exec(
    `INSERT INTO trips(user_id,id,record,updated_at) VALUES ('alice','legacy','{"title":"legacy"}','2099-01-01');`,
  );
  await engine.exec(await readFile(resolve("drizzle/0001_ambitious_micromacro.sql"), "utf8"));
  db = drizzle(engine);
});
afterAll(() => engine.close());
const body = (value: unknown, method = "POST") =>
  new Request("http://local/api/account/sync", { method, body: JSON.stringify(value) });
const send = async (trips: unknown[] = [], conversations: unknown[] = []) =>
  (await POST(body({ trips, conversations }))).json();

it("enforces revisions through authenticated routes, migrated SQL, skew, concurrent edits, deletion and retry", async () => {
  expect(await (await GET()).json()).toMatchObject({ trips: [{ id: "legacy", revision: 1 }] });
  const edit = {
    id: "legacy",
    revision: 1,
    updatedAt: "2000-01-01T00:00:00.000Z",
    record: { title: "Later edit from slow clock" },
  };
  const first = await send([edit]);
  expect(first.accepted.trips[0]).toMatchObject({ revision: 2, record: edit.record });
  const stale = {
    ...edit,
    updatedAt: "2099-01-01T00:00:00.000Z",
    record: { title: "Stale fast clock" },
  };
  expect((await send([stale])).conflicts.trips).toEqual([stale]);
  expect((await send([stale])).conflicts.trips).toEqual([stale]);
  expect(await (await GET()).json()).toMatchObject({
    trips: [{ revision: 2, record: edit.record }],
  });
  const deletion = { id: "legacy", revision: 2, deleted: true, updatedAt: edit.updatedAt };
  expect((await send([deletion])).accepted.trips[0]).toMatchObject({ deleted: true, revision: 3 });
  expect((await send([{ ...edit, revision: 2 }])).conflicts.trips).toHaveLength(1);
  const conversation = { ...edit, id: "conversation", revision: 0 };
  expect((await send([], [conversation])).accepted.conversations[0].revision).toBe(1);
  const concurrent = await Promise.all([
    send([], [{ ...conversation, revision: 1 }]),
    send([], [{ ...conversation, revision: 1, record: { title: "Concurrent" } }]),
  ]);
  expect(concurrent.map((result) => result.accepted.conversations.length).sort()).toEqual([0, 1]);
  expect(concurrent.map((result) => result.conflicts.conversations.length).sort()).toEqual([0, 1]);
  identity.userId = "bob";
  expect(await (await GET()).json()).toEqual({ trips: [], conversations: [] });
  expect((await send([{ ...edit, revision: 3 }])).conflicts.trips).toHaveLength(1);
  expect((await send([{ ...edit, revision: 0 }])).accepted.trips[0].revision).toBe(1);
  identity.userId = "alice";
  expect(await (await GET()).json()).toMatchObject({ trips: [{ deleted: true, revision: 3 }] });
  const legacy = { ...edit };
  delete (legacy as Partial<typeof edit>).revision;
  expect((await POST(body({ trips: [legacy], conversations: [] }))).status).toBe(400);
  const settings = {
    ...defaultSettings(),
    appearance: "dark",
    updatedAt: "2099-01-01T00:00:00.000Z",
  };
  expect(await (await PUT(body({ settings, revision: 0 }, "PUT"))).json()).toMatchObject({
    revision: 1,
  });
  expect(
    (await PUT(body({ settings: { ...settings, appearance: "light" }, revision: 0 }, "PUT")))
      .status,
  ).toBe(409);
  expect((await PUT(body(settings, "PUT"))).status).toBe(400);
  expect(
    await (
      await PUT(
        body(
          {
            settings: { ...settings, appearance: "light", updatedAt: edit.updatedAt },
            revision: 1,
          },
          "PUT",
        ),
      )
    ).json(),
  ).toMatchObject({ revision: 2 });
  expect(await (await settingsGet()).json()).toMatchObject({
    settings: { appearance: "light" },
    revision: 2,
  });
  identity.userId = null;
  expect((await GET()).status).toBe(401);
  identity.enabled = false;
  expect((await GET()).status).toBe(503);
});
