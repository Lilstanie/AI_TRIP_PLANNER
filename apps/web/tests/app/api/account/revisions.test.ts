import { expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/account/server", () => ({
  accountUser: async () => ({ userId: "user-a" }),
  badRequest: () => Response.json({ error: "invalid" }, { status: 400 }),
  noStore: { "Cache-Control": "no-store" },
}));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
import { POST } from "@/app/api/account/sync/route";

it("reports a compare-and-set rejection instead of acknowledging a stale write", async () => {
  const returning = vi.fn(async () => []);
  db.update.mockReturnValue({ set: () => ({ where: () => ({ returning }) }) });
  db.insert.mockReturnValue({ values: () => ({ onConflictDoUpdate: () => ({ returning }) }) });
  const edit = {
    id: "trip",
    revision: 2,
    updatedAt: "2099-01-01T00:00:00.000Z",
    record: { title: "pending" },
  };
  const response = await POST(
    new Request("http://local/api/account/sync", {
      method: "POST",
      body: JSON.stringify({ trips: [edit], conversations: [] }),
    }),
  );
  expect(await response.json()).toMatchObject({
    accepted: { trips: [] },
    conflicts: { trips: [edit] },
  });
});

it("rejects stale settings explicitly without returning success", async () => {
  const { PUT } = await import("@/app/api/account/settings/route");
  const { defaultSettings } = await import("@/lib/account/settings");
  db.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => [] }) }) });
  const response = await PUT(
    new Request("http://local/api/account/settings", {
      method: "PUT",
      body: JSON.stringify({ settings: defaultSettings(), revision: 1 }),
    }),
  );
  expect(response.status).toBe(409);
});
