import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useAccountSync } from "@/components/account/useAccountSync";
import { acknowledge, emptySynced } from "@/lib/account/catalog-sync";
import { createCatalog } from "@/lib/workspace/catalog";
import { snapshot } from "../../fixtures/workspace";

vi.mock("@/components/account/AccountProvider", () => ({
  useAccount: () => ({ status: "signed-in", userId: "alice" }),
}));
afterEach(() => vi.useRealTimers());

it("serializes edits during a pending push and persists the latest accepted revision", async () => {
  vi.useFakeTimers();
  const initial = createCatalog(snapshot);
  const record = {
    id: initial.trips[0].id,
    updatedAt: initial.trips[0].updatedAt,
    revision: 1,
    record: initial.trips[0],
  };
  const remote = {
    trips: [record],
    conversations: initial.conversations.map((conversation) => ({
      id: conversation.id,
      updatedAt: conversation.updatedAt,
      revision: 1,
      record: conversation,
    })),
  };
  localStorage.setItem(
    "trip.sync.v1",
    JSON.stringify({ userId: "alice", synced: acknowledge(emptySynced(), remote) }),
  );
  const requests: Array<{ body: any; resolve: (response: Response) => void }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, init) => {
      if (!init) return Promise.resolve(Response.json(remote));
      return new Promise<Response>((resolve) =>
        requests.push({ body: JSON.parse(init.body), resolve }),
      );
    }),
  );
  const { result } = renderHook(() => {
    const [catalog, setCatalog] = useState(initial);
    const status = useAccountSync({ catalog, setCatalog, storageEnabled: true });
    return { catalog, setCatalog, status };
  });
  await act(async () => {});
  const edit = (title: string) =>
    act(() =>
      result.current.setCatalog((catalog) => ({
        ...catalog,
        trips: catalog.trips.map((trip) => ({ ...trip, title })),
      })),
    );
  edit("First offline edit");
  await act(async () => vi.advanceTimersByTimeAsync(1600));
  expect(requests).toHaveLength(1);
  edit("Second offline edit");
  await act(async () => vi.advanceTimersByTimeAsync(1600));
  expect(requests).toHaveLength(1);
  await act(async () =>
    requests[0].resolve(
      Response.json({
        accepted: { trips: [{ ...requests[0].body.trips[0], revision: 2 }], conversations: [] },
        conflicts: { trips: [], conversations: [] },
      }),
    ),
  );
  expect(requests).toHaveLength(2);
  expect(requests[1].body.trips[0]).toMatchObject({
    revision: 2,
    record: { title: "Second offline edit" },
  });
  await act(async () =>
    requests[1].resolve(
      Response.json({
        accepted: { trips: [{ ...requests[1].body.trips[0], revision: 3 }], conversations: [] },
        conflicts: { trips: [], conversations: [] },
      }),
    ),
  );
  expect(result.current.status).toBe("synced");
  expect(JSON.parse(localStorage.getItem("trip.sync.v1")!).synced.trips[record.id].revision).toBe(
    3,
  );
  expect(result.current.catalog.trips[0].title).toBe("Second offline edit");
});
