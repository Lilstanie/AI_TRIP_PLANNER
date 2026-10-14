import { expect, it } from "vitest";
import { emptySynced, mergeCatalog } from "@/lib/account/catalog-sync";
import { createCatalog } from "@/lib/workspace/catalog";
import { snapshot } from "../../fixtures/workspace";

it("keeps an unacknowledged local edit when a fast-clock remote record arrives", () => {
  const local = createCatalog(snapshot);
  const remote = JSON.parse(JSON.stringify(local.trips[0]));
  remote.title = "Older edit from fast clock";
  remote.updatedAt = "2099-01-01T00:00:00.000Z";
  local.trips[0].title = "Unacknowledged local edit";
  const result = mergeCatalog(
    local,
    {
      trips: [{ id: remote.id, updatedAt: remote.updatedAt, revision: 2, record: remote }],
      conversations: [],
    },
    emptySynced(),
  );
  expect(result.catalog.trips[0].title).toBe("Unacknowledged local edit");
  expect(result.push.trips[0]).toMatchObject({ id: remote.id, revision: 0 });
});

it("keeps rejected edits through persisted checkpoints and accepts sequential edits", async () => {
  const { acknowledge, parseSynced, pendingChanges } = await import("@/lib/account/catalog-sync");
  const local = createCatalog(snapshot);
  const trip = local.trips[0];
  const remote = {
    id: trip.id,
    revision: 1,
    updatedAt: trip.updatedAt,
    record: JSON.parse(JSON.stringify(trip)),
  };
  const checkpoint = acknowledge(emptySynced(), { trips: [remote], conversations: [] });
  trip.title = "Offline edit";
  trip.updatedAt = "2000-01-01T00:00:00.000Z";
  const persisted = parseSynced(JSON.parse(JSON.stringify(checkpoint)));
  const next = pendingChanges(local, persisted);
  expect(next.trips[0].revision).toBe(1);
  const conflict = mergeCatalog(
    local,
    {
      trips: [{ ...remote, revision: 2, record: { ...remote.record, title: "Concurrent edit" } }],
      conversations: [],
    },
    persisted,
  );
  expect(conflict.catalog.trips[0].title).toBe("Offline edit");
  expect(conflict.push.trips[0].revision).toBe(1);
  const acknowledged = acknowledge(persisted, {
    trips: [{ ...next.trips[0], revision: 2 }],
    conversations: [],
  });
  expect(pendingChanges(local, acknowledged).trips).toEqual([]);
  local.trips = [];
  expect(pendingChanges(local, acknowledged).trips[0]).toMatchObject({
    deleted: true,
    revision: 2,
  });
});
