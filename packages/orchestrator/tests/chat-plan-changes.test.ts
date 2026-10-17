import { FakeToolCallingModel } from "langchain";
import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it, vi } from "vitest";
import { AskUserError, IncompleteBriefError, runTripChat } from "../src/chat";
import { groundedReply } from "../src/chat-grounding";
import {
  brief,
  itinerary,
  memoryStore,
  ReplyOverrideModel,
  run,
  scriptedModel,
  tools,
} from "./chat-test-fixtures";

describe("the conversation agent decides what to do", () => {
  it("does not confirm removal of a day that was absent before an unrelated replan", async () => {
    const before = await runTripChat(
      { tripId: brief.tripId, mode: "plan", message: "Plan it", brief },
      { specialists: [itinerary], tools, mem: memoryStore().mem },
    );
    const after = structuredClone(before.plan);
    const activity = after.sections[0]?.proposal?.items[0];
    if (!activity) throw new Error("Expected the itinerary fixture to contain an activity");
    activity.detail = "A changed activity";

    expect(
      groundedReply(
        {
          tripId: brief.tripId,
          message: "Remove day 3.",
          brief,
          plan: before.plan,
        },
        after,
        "Day 3 has been removed.",
      ),
    ).toBe("I can’t verify that requested change from the resulting itinerary.");
  });

  it("asks before planning a new trip with dates that have already passed", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const { mem } = memoryStore();

    await expect(
      runTripChat(
        {
          tripId: "fresh-hobart",
          message: "Plan 2 days in Hobart for 1 person, budget AUD 800, from 2025-01-10",
          interfaceLanguage: "en",
        },
        {
          model: scriptedModel(
            [
              {
                name: "update_trip_brief",
                args: {
                  destination: "Hobart",
                  startDate: "2025-01-10",
                  endDate: "2025-01-11",
                  groupSize: 1,
                  budgetAmount: 800,
                  budgetCurrency: "AUD",
                },
                id: "update",
              },
            ],
            [{ name: "replan_trip", args: {}, id: "replan" }],
          ),
          specialists: [itinerary],
          tools,
          mem,
          clock: () => new Date("2026-10-17T12:00:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      askUser: {
        type: "ask_user",
        questions: [expect.objectContaining({ question: expect.stringMatching(/past|passed/i) })],
      },
    });

    expect(itinerary.invoke).not.toHaveBeenCalled();
  });

  it.each([
    { label: "yesterday", dates: ["2026-10-16", "2026-10-17"], asks: true },
    { label: "today", dates: ["2026-10-17", "2026-10-18"], asks: false },
    { label: "tomorrow", dates: ["2026-10-18", "2026-10-19"], asks: false },
  ])(
    "uses the UTC calendar boundary for a fresh mode=plan brief starting $label",
    async ({ dates, asks }) => {
      vi.mocked(itinerary.invoke).mockClear();
      const freshBrief = {
        ...brief,
        tripId: `fresh-${dates[0]}`,
        dates: dates as [string, string],
      };
      const execute = () =>
        runTripChat(
          {
            tripId: freshBrief.tripId,
            mode: "plan",
            message: "Plan this trip",
            brief: freshBrief,
          },
          {
            specialists: [itinerary],
            tools,
            mem: memoryStore().mem,
            clock: () => new Date("2026-10-17T23:30:00.000Z"),
          },
        );

      if (asks) {
        await expect(execute()).rejects.toMatchObject({
          askUser: {
            type: "ask_user",
            questions: [
              expect.objectContaining({ question: expect.stringMatching(/past|passed/i) }),
            ],
          },
        });
        expect(itinerary.invoke).not.toHaveBeenCalled();
      } else {
        await expect(execute()).resolves.toMatchObject({ plan: { brief: { dates } } });
        expect(itinerary.invoke).toHaveBeenCalled();
      }
    },
  );

  it.each([
    {
      label: "Sydney after midnight locally while UTC is still the previous date",
      dates: ["2026-10-17", "2026-10-18"],
      now: "2026-10-17T14:30:00.000Z",
      destinationLocation: { destination: "Sydney", latitude: -33.8688, longitude: 151.2093 },
      asks: true,
    },
    {
      label: "Honolulu before midnight while UTC is already the next date",
      dates: ["2026-10-16", "2026-10-17"],
      now: "2026-10-17T06:30:00.000Z",
      destinationLocation: { destination: "Honolulu", latitude: 21.3069, longitude: -157.8583 },
      asks: false,
    },
  ])(
    "checks fresh trip dates using verified destination coordinates: $label",
    async ({ dates, now, destinationLocation, asks }) => {
      vi.mocked(itinerary.invoke).mockClear();
      const freshBrief = {
        ...brief,
        destination: destinationLocation.latitude < 0 ? "Sydney" : "Honolulu",
        tripId: `fresh-local-date-${dates[0]}`,
        dates: dates as [string, string],
      };
      const request = {
        tripId: freshBrief.tripId,
        mode: "plan" as const,
        message: "Plan this trip",
        brief: freshBrief,
        destinationLocation,
      } as unknown as Parameters<typeof runTripChat>[0];
      const execute = () =>
        runTripChat(request, {
          specialists: [itinerary],
          tools,
          mem: memoryStore().mem,
          clock: () => new Date(now),
        });

      if (asks) {
        await expect(execute()).rejects.toMatchObject({
          askUser: {
            type: "ask_user",
            questions: [
              expect.objectContaining({ question: expect.stringMatching(/past|passed/i) }),
            ],
          },
        });
        expect(itinerary.invoke).not.toHaveBeenCalled();
      } else {
        await expect(execute()).resolves.toMatchObject({ plan: { brief: { dates } } });
        expect(itinerary.invoke).toHaveBeenCalled();
      }
    },
  );

  it("does not reuse old selected coordinates after a chat changes the destination", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const changedDestination = {
      ...brief,
      tripId: "changed-destination-dates",
      destination: "Honolulu",
      dates: ["2026-10-17", "2026-10-18"] as [string, string],
    };

    await expect(
      runTripChat(
        {
          tripId: changedDestination.tripId,
          mode: "plan",
          message: "Plan this trip",
          brief: changedDestination,
          destinationLocation: {
            destination: "Sydney",
            latitude: -33.8688,
            longitude: 151.2093,
          },
        } as unknown as Parameters<typeof runTripChat>[0],
        {
          specialists: [itinerary],
          tools,
          mem: memoryStore().mem,
          clock: () => new Date("2026-10-17T14:30:00.000Z"),
        },
      ),
    ).resolves.toMatchObject({ plan: { brief: { destination: "Honolulu" } } });
    expect(itinerary.invoke).toHaveBeenCalled();
  });

  it("does not treat a fresh submitted brief as proof of an existing historical trip", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const freshBrief = {
      ...brief,
      tripId: "fresh-brief-past-date",
      dates: ["2026-10-16", "2026-10-18"] as [string, string],
    };

    await expect(
      run(
        { tripId: freshBrief.tripId, mode: "chat", message: "Plan this trip", brief: freshBrief },
        scriptedModel([{ name: "replan_trip", args: {}, id: "replan" }]),
        memoryStore().mem,
        { clock: () => new Date("2026-10-17T12:00:00.000Z") },
      ),
    ).rejects.toMatchObject({
      askUser: {
        questions: [expect.objectContaining({ question: expect.stringMatching(/past|passed/i) })],
      },
    });
    expect(itinerary.invoke).not.toHaveBeenCalled();
  });

  it("applies corrected dates to a submitted fresh brief before the past-date check", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const tripId = "correct-old-submitted-dates";
    const oldBrief = {
      ...brief,
      tripId,
      dates: ["2025-01-10", "2025-01-11"] as [string, string],
    };
    const corrected = await runTripChat(
      {
        tripId,
        message: "Use dates 2027-04-05 to 2027-04-07 instead",
        brief: oldBrief,
      },
      {
        model: scriptedModel(
          [
            {
              name: "update_trip_brief",
              args: { startDate: "2027-04-05", endDate: "2027-04-07" },
              id: "update-dates",
            },
          ],
          [{ name: "replan_trip", args: {}, id: "replan" }],
        ),
        specialists: [itinerary],
        tools,
        mem: memoryStore().mem,
        clock: () => new Date("2026-10-17T12:00:00.000Z"),
      },
    );

    expect(corrected.plan.brief.dates).toEqual(["2027-04-05", "2027-04-07"]);
    expect(itinerary.invoke).toHaveBeenCalled();
  });

  it("confirms a historical trip only after the matching date clarification", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const historicalBrief = {
      ...brief,
      tripId: "confirm-historical-dates",
      dates: ["2026-10-16", "2026-10-18"] as [string, string],
    };
    const { mem } = memoryStore();
    const options = {
      specialists: [itinerary],
      tools,
      mem,
      clock: () => new Date("2026-10-17T12:00:00.000Z"),
    };
    await expect(
      runTripChat(
        {
          tripId: historicalBrief.tripId,
          mode: "plan",
          message: "Plan this trip",
          brief: historicalBrief,
        },
        options,
      ),
    ).rejects.toMatchObject({
      askUser: { questions: [expect.objectContaining({ id: "past-trip-dates" })] },
    });
    await expect(
      runTripChat(
        {
          tripId: historicalBrief.tripId,
          mode: "plan",
          message: "Yes",
          brief: historicalBrief,
        },
        options,
      ),
    ).rejects.toMatchObject({
      askUser: { questions: [expect.objectContaining({ id: "past-trip-dates" })] },
    });
    const confirmed = await runTripChat(
      {
        tripId: historicalBrief.tripId,
        mode: "plan",
        message: "Dates: Confirm historical trip",
        brief: historicalBrief,
      },
      options,
    );
    expect(confirmed.plan.brief.dates).toEqual(historicalBrief.dates);
    expect(itinerary.invoke).toHaveBeenCalled();
  });

  it("keeps the date-bound confirmation visible when the model discovers a past trip", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const tripId = "model-found-past-trip";
    const { mem, turns } = memoryStore();
    const options = {
      specialists: [itinerary],
      tools,
      mem,
      clock: () => new Date("2026-10-17T12:00:00.000Z"),
    };

    await expect(
      runTripChat(
        {
          tripId,
          message: "Plan two days in Hobart from 2025-01-10 for one person, budget AUD 800",
        },
        {
          ...options,
          model: scriptedModel(
            [
              {
                name: "update_trip_brief",
                args: {
                  destination: "Hobart",
                  startDate: "2025-01-10",
                  endDate: "2025-01-11",
                  groupSize: 1,
                  budgetAmount: 800,
                  budgetCurrency: "AUD",
                },
                id: "update",
              },
            ],
            [{ name: "replan_trip", args: {}, id: "replan" }],
          ),
        },
      ),
    ).rejects.toMatchObject({ askUser: { type: "ask_user" } });
    expect(turns.at(-1)?.content).toContain(
      "Reply “Confirm historical trip” to keep these dates: 2025-01-10 to 2025-01-11.",
    );

    const confirmed = await runTripChat(
      {
        tripId,
        message: "Confirm historical trip",
      },
      {
        ...options,
        model: scriptedModel(
          [
            {
              name: "update_trip_brief",
              args: {
                destination: "Hobart",
                startDate: "2025-01-10",
                endDate: "2025-01-11",
                groupSize: 1,
                budgetAmount: 800,
                budgetCurrency: "AUD",
              },
              id: "update",
            },
          ],
          [{ name: "replan_trip", args: {}, id: "replan" }],
        ),
      },
    );

    expect(confirmed.plan.brief.dates).toEqual(["2025-01-10", "2025-01-11"]);
    expect(itinerary.invoke).toHaveBeenCalled();
  });

  it("allows edits to a persisted historical plan", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const historicalBrief = { ...brief, dates: ["2026-06-15", "2026-06-22"] as [string, string] };
    const { mem } = memoryStore();
    const existing = await runTripChat(
      {
        tripId: historicalBrief.tripId,
        mode: "plan",
        message: "Plan this trip",
        brief: historicalBrief,
      },
      { specialists: [itinerary], tools, mem, clock: () => new Date("2026-06-14T12:00:00.000Z") },
    );

    const edited = await run(
      {
        tripId: historicalBrief.tripId,
        message: "Change the destination to Osaka",
        brief: historicalBrief,
        plan: existing.plan,
      },
      scriptedModel(
        [{ name: "update_trip_brief", args: { destination: "Osaka" }, id: "update" }],
        [{ name: "replan_trip", args: {}, id: "replan" }],
      ),
      mem,
      { clock: () => new Date("2026-10-17T12:00:00.000Z") },
    );

    expect(edited.plan.brief.destination).toBe("Osaka");
    expect(itinerary.invoke).toHaveBeenCalled();
  });

  it("does not report an unchanged replan as a completed edit", async () => {
    const { mem } = memoryStore();
    const before = await runTripChat(
      { tripId: brief.tripId, mode: "plan", message: "Plan it", brief },
      { specialists: [itinerary], tools, mem },
    );

    const after = await run(
      {
        tripId: brief.tripId,
        message: "Remove day 3 and add a harbour cruise on day 2",
        brief,
        plan: before.plan,
      },
      scriptedModel([{ name: "replan_trip", args: {}, id: "replan" }]),
      mem,
    );

    expect(
      after.plan.sections.map(({ label, estCost, proposal }) => ({
        label,
        estCost,
        items: proposal?.items.map(({ kind, day, startTime, endTime, location, estCost }) => ({
          kind,
          day,
          startTime,
          endTime,
          location,
          estCost,
        })),
      })),
    ).toEqual(
      before.plan.sections.map(({ label, estCost, proposal }) => ({
        label,
        estCost,
        items: proposal?.items.map(({ kind, day, startTime, endTime, location, estCost }) => ({
          kind,
          day,
          startTime,
          endTime,
          location,
          estCost,
        })),
      })),
    );
    expect(after.reply).toMatch(/no change|unchanged/i);
    expect(after.reply).not.toMatch(/\bdone\b|removed day 3|added.*cruise/i);
  });

  it("does not claim an unrelated plan delta fulfilled an edit or booked anything", async () => {
    const { mem } = memoryStore();
    const before = await runTripChat(
      { tripId: brief.tripId, mode: "plan", message: "Plan it", brief },
      { specialists: [itinerary], tools, mem },
    );
    vi.mocked(itinerary.invoke).mockImplementationOnce(async ({ brief: updated }) => ({
      agent: "itinerary",
      summary: `Plan for ${updated.destination}`,
      items: [{ kind: "activity", detail: "Unrelated museum visit", estCost: 120 }],
      assumptions: [],
      conflictsWith: [],
    }));
    class OverclaimingModel extends FakeToolCallingModel {
      bindTools(_tools: Parameters<FakeToolCallingModel["bindTools"]>[0]) {
        return this;
      }

      async _generate(...args: Parameters<FakeToolCallingModel["_generate"]>) {
        const result = await super._generate(...args);
        const message = result.generations[0]?.message;
        if (message instanceof AIMessage && (message.tool_calls?.length ?? 0) === 0)
          return {
            ...result,
            generations: [
              {
                ...result.generations[0],
                message: new AIMessage("Done — I moved the harbour cruise to day 2 and booked it."),
              },
            ],
          };
        return result;
      }
    }
    const after = await run(
      {
        tripId: brief.tripId,
        message: "Move the harbour cruise to day 2 and book it",
        brief,
        plan: before.plan,
      },
      new OverclaimingModel({
        toolCalls: [[{ name: "replan_trip", args: {}, id: "replan" }], []],
      }),
      mem,
    );

    expect(after.plan.sections[0]?.proposal?.items[0]?.detail).toBe("Unrelated museum visit");
    expect(after.reply).not.toMatch(/\bdone\b|moved the harbour cruise|booked it/i);
    expect(after.reply).toContain(
      "I can’t verify that requested change from the resulting itinerary.",
    );
  });

  it.each([
    { label: "plain completion", reply: "Done.", message: "Change the plan." },
    {
      label: "a passive completed change",
      reply: "Day 3 has been removed.",
      message: "Remove day 3.",
    },
    {
      label: "a standalone booking claim",
      reply: "The hotel is booked.",
      message: "Change the hotel.",
    },
    {
      label: "a Chinese booking claim",
      reply: "已完成，酒店已预订，机票已出票。",
      message: "查询酒店。",
      interfaceLanguage: "zh" as const,
    },
    {
      label: "a Chinese completed change",
      reply: "我已经把第二天的行程改好了。",
      message: "改一下第二天。",
      interfaceLanguage: "zh" as const,
    },
  ])(
    "does not return an ungrounded $label from an existing plan without a replan",
    async ({ reply, message, interfaceLanguage }) => {
      const { mem } = memoryStore();
      const before = await runTripChat(
        { tripId: brief.tripId, mode: "plan", message: "Plan it", brief },
        { specialists: [itinerary], tools, mem },
      );

      const after = await run(
        {
          tripId: brief.tripId,
          message,
          brief,
          plan: before.plan,
          ...(interfaceLanguage ? { interfaceLanguage } : {}),
        },
        new ReplyOverrideModel(reply),
        mem,
      );

      expect(after.plan).toEqual(before.plan);
      expect(after.reply).toBe(
        interfaceLanguage === "zh"
          ? "我无法从更新后的行程确认这项修改已生效。"
          : "I can’t verify that requested change from the resulting itinerary.",
      );
    },
  );

  it("does not return a completion claim when a brief update was not replanned", async () => {
    const { mem } = memoryStore();
    const before = await runTripChat(
      { tripId: brief.tripId, mode: "plan", message: "Plan it", brief },
      { specialists: [itinerary], tools, mem },
    );

    const after = await run(
      {
        tripId: brief.tripId,
        message: "Change the destination to Melbourne",
        brief,
        plan: before.plan,
      },
      new ReplyOverrideModel("Done — I changed the destination to Melbourne."),
      mem,
    );

    expect(after.plan.brief.destination).toBe("Tokyo");
    expect(after.reply).toBe("I can’t verify that requested change from the resulting itinerary.");
  });

  it("does not let a new plan claim a booking without evidence", async () => {
    const { mem } = memoryStore();
    const after = await run(
      { tripId: brief.tripId, message: "Plan this trip", brief },
      new ReplyOverrideModel("Done — I've booked your stay and ticketed your flights."),
      mem,
    );

    expect(after.reply).toBe("I can’t verify that requested change from the resulting itinerary.");
  });

  it("does not let a booked stay support an unsupported flight ticket claim", async () => {
    const { mem } = memoryStore();
    const bookedStay = { ...brief, bookedStay: { name: "Park Hyatt" } };
    const after = await run(
      { tripId: brief.tripId, message: "Are the flights sorted?", brief: bookedStay },
      new ReplyOverrideModel("Your Park Hyatt stay is booked, and your flights are ticketed."),
      mem,
    );

    expect(after.reply).toBe("I can’t verify that requested change from the resulting itinerary.");
  });

  it("grounds model text attached to an ask-user error", async () => {
    const { mem } = memoryStore();
    const before = await runTripChat(
      { tripId: brief.tripId, mode: "plan", message: "Plan it", brief },
      { specialists: [itinerary], tools, mem },
    );
    const failure = await run(
      {
        tripId: brief.tripId,
        message: "Which flights should I take?",
        brief: { ...brief, bookedStay: { name: "Park Hyatt" } },
        plan: before.plan,
      },
      new ReplyOverrideModel("The hotel is booked and your flights are ticketed.", [
        [
          {
            name: "ask_user_question",
            args: { questions: [{ id: "flight", question: "Which dates work?" }] },
            id: "ask",
          },
        ],
        [],
      ]),
      mem,
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AskUserError);
    expect((failure as AskUserError).askUser.reply).toBe(
      "I can’t verify that requested change from the resulting itinerary.",
    );
  });

  it("keeps a completion claim backed by the requested itinerary delta", async () => {
    const { mem } = memoryStore();
    const before = await runTripChat(
      { tripId: brief.tripId, mode: "plan", message: "Plan it", brief },
      { specialists: [itinerary], tools, mem },
    );
    vi.mocked(itinerary.invoke).mockImplementationOnce(async ({ brief: updated }) => ({
      agent: "itinerary",
      summary: `Plan for ${updated.destination}`,
      items: [{ kind: "activity", detail: "Harbour cruise", day: 2, estCost: 100 }],
      assumptions: [],
      conflictsWith: [],
    }));

    const after = await run(
      {
        tripId: brief.tripId,
        message: "Add the harbour cruise to day 2",
        brief,
        plan: before.plan,
      },
      new ReplyOverrideModel("Done — I added the harbour cruise to day 2.", [
        [{ name: "replan_trip", args: {}, id: "replan" }],
        [],
      ]),
      mem,
    );

    expect(after.plan.sections[0]?.proposal?.items[0]?.detail).toBe("Harbour cruise");
    expect(after.reply).toBe("Done — I added the harbour cruise to day 2.");
  });

  it("allows a booking claim grounded in the traveller's message", async () => {
    const { mem } = memoryStore();
    const before = await runTripChat(
      { tripId: brief.tripId, mode: "plan", message: "Plan it", brief },
      { specialists: [itinerary], tools, mem },
    );

    const after = await run(
      {
        tripId: brief.tripId,
        message: "I already booked the Park Hyatt for us.",
        brief,
        plan: before.plan,
      },
      new ReplyOverrideModel("The Park Hyatt is booked."),
      mem,
    );

    expect(after.reply).toBe("The Park Hyatt is booked.");
  });

  it("records what the traveller stated and replans when asked", async () => {
    const { mem, turns } = memoryStore();
    const model = scriptedModel(
      [{ name: "update_trip_brief", args: { destination: "Melbourne" }, id: "c1" }],
      [{ name: "replan_trip", args: {}, id: "c2" }],
    );

    const result = await run(
      { tripId: brief.tripId, message: "Change the destination to Melbourne", brief },
      model,
      mem,
    );

    expect(result.plan.brief).toMatchObject({ destination: "Melbourne", budgetTotal: 4000 });
    expect(turns.map((turn) => turn.role)).toEqual(["user", "assistant"]);
  });

  it("answers a question without running any specialist", async () => {
    const { mem } = memoryStore();
    const planned = await run(
      { tripId: brief.tripId, message: "plan it", brief },
      scriptedModel([{ name: "replan_trip", args: {}, id: "c1" }]),
      mem,
    );
    vi.mocked(itinerary.invoke).mockClear();

    const asked = await run(
      {
        tripId: brief.tripId,
        message: "东京11月天气怎么样？",
        brief,
        plan: planned.plan,
      },
      scriptedModel(),
      memoryStore().mem,
    );

    expect(itinerary.invoke).not.toHaveBeenCalled();
    expect(asked.plan).toBe(planned.plan);
  });

  it("does not plan a trip that is still missing required fields", async () => {
    const { mem } = memoryStore();
    const failure = await run(
      { tripId: "blank", message: "悉尼三日游" },
      scriptedModel(
        [{ name: "update_trip_brief", args: { destination: "悉尼" }, id: "c1" }],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      mem,
    ).catch((error: unknown) => error);

    expect(itinerary.invoke).not.toHaveBeenCalled();
    expect(failure).toBeInstanceOf(IncompleteBriefError);
    const incomplete = failure as IncompleteBriefError;
    expect(incomplete.known).toEqual({ destination: "悉尼" });
    expect(incomplete.missing).toEqual([
      "start and end dates",
      "number of travellers",
      "total budget",
    ]);
    expect(incomplete.needsInfo).toMatchObject({
      type: "needs_info",
      known: { destination: "悉尼" },
    });
  });

  it("asks the traveller in the coordinator's own words, with no structured question", async () => {
    const { mem } = memoryStore();
    const failure = await run(
      { tripId: "blank", message: "Plan a trip in March 2027" },
      scriptedModel(),
      mem,
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(IncompleteBriefError);
    const asked = (failure as IncompleteBriefError).needsInfo;
    expect(asked.type).toBe("needs_info");

    expect(asked.question.length).toBeGreaterThan(0);
    expect(asked).not.toHaveProperty("asked");
  });

  it("carries what earlier turns stated, so the traveller answers only the question", async () => {
    const { mem } = memoryStore();
    const result = await run(
      {
        tripId: "blank",
        message: "2027-11-02 to 2027-11-06, 3 people, budget 2400",
        known: { destination: "Lisbon" },
      },
      scriptedModel(
        [
          {
            name: "update_trip_brief",
            args: {
              startDate: "2027-11-02",
              endDate: "2027-11-06",
              groupSize: 3,
              budgetAmount: 2400,
            },
            id: "c1",
          },
        ],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      mem,
    );

    expect(result.plan.brief).toMatchObject({
      destination: "Lisbon",
      dates: ["2027-11-02", "2027-11-06"],
      groupSize: 3,
      budgetTotal: 2400,
    });
    expect(JSON.stringify(result.plan)).not.toMatch(/Tokyo|Kyoto|demo-trip/);
  });

  it("puts the conversation so far in front of the model", async () => {
    const { mem } = memoryStore([
      { role: "user", content: "悉尼三日游", at: "2026-09-20T00:00:00.000Z" },
      { role: "assistant", content: "好的，几号出发？", at: "2026-09-20T00:00:01.000Z" },
    ]);
    const failure = await run({ tripId: "blank", message: "是今年" }, scriptedModel(), mem).catch(
      (error: unknown) => error,
    );

    expect((failure as IncompleteBriefError).message).toContain("悉尼三日游");
    expect((failure as IncompleteBriefError).message).toContain("是今年");
  });
});
