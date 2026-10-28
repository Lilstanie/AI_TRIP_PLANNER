import { describe, expect, it } from "vitest";
import type { TripPlan } from "@trip/shared";
import { brief, memoryStore, ReplyOverrideModel, run, scriptedModel } from "./chat-test-fixtures";

const notes = {
  "1": { title: "Arrive" },
  "2": { note: "Pack light" },
  "5": { title: "Fuji" },
  "8": { note: "Fly home" },
};

async function mentionPlan(dates: [string, string], dayNotes?: TripPlan["dayNotes"]) {
  const seed = await run(
    { tripId: brief.tripId, message: "plan it", brief },
    scriptedModel([{ name: "replan_trip", args: {}, id: "c1" }]),
    memoryStore().mem,
  );
  const plan: TripPlan = { ...seed.plan, ...(dayNotes ? { dayNotes } : {}) };
  const result = await run(
    {
      tripId: brief.tripId,
      message: "something vague",
      brief: { ...brief, dates },
      plan,
      mentions: ["itinerary"],
    },
    new ReplyOverrideModel("own"),
    memoryStore().mem,
  );
  return result.plan;
}

describe("day notes through a mention revision", () => {
  it("drops notes beyond the rebuilt plan's last day and keeps the others", async () => {
    const plan = await mentionPlan(["2027-06-15", "2027-06-16"], notes);
    expect(plan.dayNotes).toEqual({ "1": notes["1"], "2": notes["2"] });
  });

  it("keeps every note when the Brief keeps its days", async () => {
    const plan = await mentionPlan(["2027-06-15", "2027-06-22"], notes);
    expect(plan.dayNotes).toEqual(notes);
  });

  it("adds no map to a plan without notes", async () => {
    const plan = await mentionPlan(["2027-06-15", "2027-06-16"]);
    expect(plan.dayNotes).toBeUndefined();
  });
});
