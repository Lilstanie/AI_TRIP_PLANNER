import { FakeToolCallingModel } from "langchain";
import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it, vi } from "vitest";
import { toAud } from "@trip/shared";
import type {
  ChatTurn,
  MemoryStore,
  Specialist,
  ToolGateway,
  TripBrief,
  TripPlan,
} from "@trip/shared";
import { z } from "zod/v4";
import {
  AskUserError,
  AskUserQuestionInput,
  BriefUpdate,
  IncompleteBriefError,
  runTripChat,
  toQuestions,
} from "../src/chat";

const brief: TripBrief = {
  tripId: "chat-test",
  userId: "chat-user",
  destination: "Tokyo",
  dates: ["2027-06-15", "2027-06-22"],
  groupSize: 2,
  budgetTotal: 4000,
};

const tools: ToolGateway = {
  maps: { route: vi.fn(async () => []), places: vi.fn(async () => []) },
  booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
};
const itinerary: Specialist = {
  name: "itinerary",
  label: "Day plan",
  invoke: vi.fn(async ({ brief: updated }) => ({
    agent: "itinerary" as const,
    summary: `Plan for ${updated.destination}`,
    items: [{ kind: "activity", detail: "Walk", estCost: 100 }],
    assumptions: [],
    conflictsWith: [],
  })),
};

function memoryStore(history: ChatTurn[] = []) {
  const turns: ChatTurn[] = [];
  const mem: MemoryStore = {
    getShortTerm: vi.fn(async () => [...history, ...turns]),
    appendShortTerm: vi.fn(async (_tripId, turn) => {
      turns.push(turn);
    }),
    getLongTerm: vi.fn(async () => []),
    setLongTerm: vi.fn(async () => {}),
    promote: vi.fn(async () => {}),
  };
  return { mem, turns };
}

type ToolCall = { name: string; args: Record<string, unknown>; id: string };

const scriptedModel = (...turns: ToolCall[][]) =>
  new FakeToolCallingModel({ toolCalls: [...turns, []] });

class ReplyOverrideModel extends FakeToolCallingModel {
  constructor(
    readonly reply: string,
    toolCalls: ToolCall[][] = [[]],
  ) {
    super({ toolCalls: [...toolCalls, []] });
  }

  bindTools(_tools: Parameters<FakeToolCallingModel["bindTools"]>[0]) {
    return this;
  }

  async _generate(...args: Parameters<FakeToolCallingModel["_generate"]>) {
    const result = await super._generate(...args);
    const message = result.generations[0]?.message;
    if (!(message instanceof AIMessage) || (message.tool_calls?.length ?? 0) > 0) return result;
    return {
      ...result,
      generations: [
        {
          ...result.generations[0],
          message: new AIMessage(this.reply),
        },
      ],
    };
  }
}

const run = (
  request: Parameters<typeof runTripChat>[0],
  model: FakeToolCallingModel,
  mem: MemoryStore,
  extra: Partial<Parameters<typeof runTripChat>[1]> = {},
) => runTripChat(request, { model, specialists: [itinerary], tools, mem, ...extra });

describe("the conversation agent decides what to do", () => {
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

describe("the reply language", () => {
  const shown = (request: Parameters<typeof runTripChat>[0]) =>
    run(request, scriptedModel(), memoryStore().mem)
      .catch((error: unknown) => error)
      .then((failure) => (failure as IncompleteBriefError).message);

  it("falls back to the interface language when the client sends one", async () => {
    const prompt = await shown({ tripId: "blank", message: "Tokyo", interfaceLanguage: "zh" });
    expect(prompt).toContain(
      "Reply language: the language of the traveller's latest message, else Simplified Chinese",
    );
  });

  it("adds no fallback for a client that does not send the field", async () => {
    const prompt = await shown({ tripId: "blank", message: "Tokyo" });
    expect(prompt).toContain("reply in that exact same language");
    expect(prompt).not.toContain("Reply language:");
  });
});

describe("currency in the brief update tool", () => {
  it("converts what the traveller said and keeps the original for display", async () => {
    const { mem } = memoryStore();
    const result = await run(
      { tripId: "blank", message: "悉尼三日游，2 人，预算 3000 人民币" },
      scriptedModel(
        [
          {
            name: "update_trip_brief",
            args: {
              destination: "悉尼",
              startDate: "2027-10-06",
              endDate: "2027-10-09",
              groupSize: 2,
              budgetAmount: 3000,
              budgetCurrency: "CNY",
            },
            id: "c1",
          },
        ],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      mem,
    );

    expect(result.plan.brief.budgetTotal).toBe(toAud(3000, "CNY"));
    expect(result.plan.brief.budgetSource).toEqual({ amount: 3000, currency: "CNY" });
    expect(result.plan.brief.groupSize).toBe(2);
  });

  it("treats an explicit base-currency amount as an identity, not a second conversion", async () => {
    const { mem } = memoryStore();
    const result = await run(
      { tripId: "blank", message: "Sydney, 2027-10-06 to 2027-10-09, 2 people, AUD 3,000.00" },
      scriptedModel(
        [
          {
            name: "update_trip_brief",
            args: {
              destination: "Sydney",
              startDate: "2027-10-06",
              endDate: "2027-10-09",
              groupSize: 2,
              budgetAmount: 3000,
              budgetCurrency: "AUD",
            },
            id: "c1",
          },
        ],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      mem,
    );

    expect(result.plan.brief.budgetTotal).toBe(3000);
    expect(result.plan.brief.budgetSource).toBeUndefined();
  });
});

describe("tolerating what models actually emit", () => {
  it('accepts the literal string "null" instead of an omitted field', async () => {
    const { mem } = memoryStore();
    const result = await run(
      { tripId: brief.tripId, message: "10.6-10.9，预算 3000 人民币", brief },
      scriptedModel(
        [
          {
            name: "update_trip_brief",
            args: {
              destination: "null",
              startDate: "null",
              endDate: "null",
              groupSize: "null",
              budgetAmount: 3000,
              budgetCurrency: "CNY",
            },
            id: "c1",
          },
        ],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      mem,
    );

    expect(result.plan.brief).toMatchObject({
      destination: "Tokyo",
      groupSize: 2,
      budgetTotal: toAud(3000, "CNY"),
    });
  });

  it("applies a one-sided correction to an existing date range", async () => {
    const { mem } = memoryStore();
    const result = await run(
      { tripId: brief.tripId, message: "leave on the 6th", brief },
      scriptedModel(
        [{ name: "update_trip_brief", args: { startDate: "2027-06-16" }, id: "c1" }],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      mem,
    );
    expect(result.plan.brief.dates).toEqual(["2027-06-16", "2027-06-22"]);
  });
});

describe("the preferences form path", () => {
  it("plans a submitted brief without spending a model call on it", async () => {
    const { mem } = memoryStore();
    const result = await runTripChat(
      { tripId: brief.tripId, mode: "plan", message: "Update my trip", brief },
      { model: scriptedModel(), specialists: [itinerary], tools, mem },
    );
    expect(result.plan.brief).toEqual(brief);

    expect(result.reply).toContain("Plan for Tokyo");
    expect(result.reply).not.toContain("Update my trip");
  });

  it("still refuses to plan without a brief", async () => {
    await expect(
      runTripChat({ tripId: brief.tripId, mode: "plan", message: "go" }, { specialists: [] }),
    ).rejects.toThrow("A brief is required to plan.");
  });
});

describe("without a provider key", () => {
  const offline = (request: Parameters<typeof runTripChat>[0], mem: MemoryStore) =>
    runTripChat(request, { specialists: [itinerary], tools, mem });

  it("reports missing fields as a plain list", async () => {
    const { mem } = memoryStore();
    await expect(
      offline({ tripId: "blank", message: "I want to visit Lisbon" }, mem),
    ).rejects.toThrow("include the start and end dates, number of travellers, total budget");
  });

  it("plans from what the patterns can read", async () => {
    const { mem } = memoryStore();
    const result = await offline(
      { tripId: "blank", message: "Lisbon, 2027-11-02 to 2027-11-06, 3 people, budget $2400" },
      mem,
    );
    expect(result.plan.brief).toMatchObject({
      tripId: "blank",
      destination: "Lisbon",
      groupSize: 3,
      budgetTotal: 2400,
    });
  });

  it("carries Chinese party sizes from offline chat into the planned brief", async () => {
    const { mem } = memoryStore();
    const result = await offline(
      {
        tripId: "blank",
        message: "Tokyo, 2027-11-02 to 2027-11-06, 十三个人, budget $2400",
      },
      mem,
    );

    expect(result.plan.brief).toMatchObject({
      destination: "Tokyo",
      groupSize: 13,
      budgetTotal: 2400,
    });
  });

  it("uses an injected extractor when one is supplied", async () => {
    const { mem } = memoryStore();
    const extract = vi.fn(async () => ({ destination: "Melbourne" }));
    const result = await runTripChat(
      { tripId: brief.tripId, message: "Change the destination", brief },
      { extractor: { extract }, specialists: [itinerary], tools, mem },
    );
    expect(extract).toHaveBeenCalledWith("Change the destination", brief);
    expect(result.plan.brief).toMatchObject({ destination: "Melbourne" });
  });
});

describe("a question keeps the plan it was given", () => {
  it("returns the client's plan unchanged rather than rebuilding one", async () => {
    const { mem } = memoryStore();
    const seed = await run(
      { tripId: brief.tripId, message: "plan it", brief },
      scriptedModel([{ name: "replan_trip", args: {}, id: "c1" }]),
      mem,
    );
    const plan: TripPlan = seed.plan;
    vi.mocked(itinerary.invoke).mockClear();

    const answered = await run(
      { tripId: brief.tripId, message: "Can you book the flights?", brief, plan },
      scriptedModel(),
      memoryStore().mem,
    );
    expect(answered.plan).toBe(plan);
    expect(itinerary.invoke).not.toHaveBeenCalled();
  });
});

describe("the tool schema the provider actually receives", () => {
  it("renders to JSON Schema", () => {
    expect(() => z.toJSONSchema(BriefUpdate, { io: "input", target: "draft-7" })).not.toThrow();
  });

  it("accepts the shapes a model actually sends for an absent field", () => {
    for (const absent of [null, undefined, "null", "", "N/A"])
      expect(
        BriefUpdate.safeParse({ destination: absent, groupSize: absent, budgetAmount: absent })
          .success,
      ).toBe(true);

    expect(BriefUpdate.safeParse({ groupSize: "2", budgetAmount: "3000" }).success).toBe(true);
  });
});

describe("asking the traveller a structured question", () => {
  const ask = (questions: unknown[], id = "ask") => ({
    name: "ask_user_question",
    args: { questions },
    id,
  });
  const choice = {
    id: "pace",
    header: "Pace",
    question: "How full should each day be?",
    options: [
      { label: "Relaxed (Recommended)", description: "Two sights a day." },
      { label: "Packed", description: "Everything on the list." },
    ],
  };
  const caught = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  it("ends the turn with the question and what is known, without planning", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const failure = await caught(
      run(
        { tripId: "blank", message: "Sydney sometime next year for a few people" },
        scriptedModel(
          [{ name: "update_trip_brief", args: { destination: "Sydney" }, id: "c1" }],
          [ask([choice])],
        ),
        memoryStore().mem,
      ),
    );

    expect(itinerary.invoke).not.toHaveBeenCalled();
    expect(failure).toBeInstanceOf(AskUserError);
    const asked = (failure as AskUserError).askUser;
    expect(asked).toMatchObject({
      type: "ask_user",
      known: { destination: "Sydney" },
      questions: [choice],
    });
    expect(asked).not.toHaveProperty("plan");
    expect(typeof asked.reply).toBe("string");
  });

  it("remembers the question it asked, so the next turn does not ask it again", async () => {
    const { mem, turns } = memoryStore();
    await caught(
      run(
        { tripId: "blank", message: "Somewhere in Japan next spring" },
        scriptedModel([ask([choice])]),
        mem,
      ),
    );

    const assistant = turns.filter((turn) => turn.role === "assistant");
    expect(assistant).toHaveLength(1);
    expect(assistant[0]?.content).toContain("How full should each day be?");

    expect(assistant[0]?.content).toContain("Relaxed (Recommended)");
  });

  it("caps questions and options, drops blanks and maps multi_select", async () => {
    const many = Array.from({ length: 6 }, (_v, i) => ({
      id: i === 1 ? "q0" : `q${i}`,
      question: i === 2 ? "   " : `Question ${i}?`,
      options: [
        { label: "A" },
        { label: " " },
        { label: "B" },
        { label: "C" },
        { label: "D" },
        { label: "E" },
      ],
      multi_select: true,
    }));
    const failure = await caught(
      run(
        { tripId: "blank", message: "somewhere warm" },
        scriptedModel([ask(many)]),
        memoryStore().mem,
      ),
    );

    const { questions } = (failure as AskUserError).askUser;
    expect(questions).toHaveLength(4);

    expect(questions.map((question) => question.question)).toEqual([
      "Question 0?",
      "Question 1?",
      "Question 3?",
      "Question 4?",
    ]);
    expect(new Set(questions.map((question) => question.id)).size).toBe(4);
    for (const question of questions) {
      expect(question.options?.map((option) => option.label)).toEqual(["A", "B", "C", "D"]);
      expect(question.multiSelect).toBe(true);
    }
  });

  it("keeps the client's plan unchanged while the traveller answers", async () => {
    const seed = await run(
      { tripId: brief.tripId, message: "plan it", brief },
      scriptedModel([{ name: "replan_trip", args: {}, id: "c1" }]),
      memoryStore().mem,
    );
    vi.mocked(itinerary.invoke).mockClear();

    const failure = await caught(
      run(
        { tripId: brief.tripId, message: "Make it better", brief, plan: seed.plan },
        scriptedModel([ask([choice])]),
        memoryStore().mem,
      ),
    );

    expect(itinerary.invoke).not.toHaveBeenCalled();
    const asked = (failure as AskUserError).askUser;
    expect(asked.plan).toBe(seed.plan);

    expect(asked.known).toEqual({
      destination: "Tokyo",
      dates: ["2027-06-15", "2027-06-22"],
      groupSize: 2,
      budgetTotal: 4000,
    });
  });

  it("does not build a plan for an older client that sent only the brief", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const failure = await caught(
      run(
        { tripId: brief.tripId, message: "Make it better", brief },
        scriptedModel([ask([choice])]),
        memoryStore().mem,
      ),
    );

    expect(failure).toBeInstanceOf(AskUserError);
    expect(itinerary.invoke).not.toHaveBeenCalled();
  });

  it("lets a plan built in the same turn win over the question", async () => {
    const result = await run(
      { tripId: brief.tripId, message: "plan it", brief },
      scriptedModel([ask([choice])], [{ name: "replan_trip", args: {}, id: "c2" }]),
      memoryStore().mem,
    );

    expect(result.plan.brief).toMatchObject({ destination: "Tokyo" });
  });

  it("shows nothing when every question is blank", async () => {
    const failure = await caught(
      run(
        { tripId: "blank", message: "somewhere" },
        scriptedModel([ask([{ id: "q", question: " " }])]),
        memoryStore().mem,
      ),
    );

    expect(failure).toBeInstanceOf(IncompleteBriefError);
  });

  it("is never asked without a provider key", async () => {
    const failure = await caught(
      runTripChat(
        { tripId: "blank", message: "Sydney sometime next year for a few people" },
        { specialists: [itinerary], tools, mem: memoryStore().mem },
      ),
    );

    expect(failure).toBeInstanceOf(IncompleteBriefError);
    expect(failure).not.toBeInstanceOf(AskUserError);
  });

  it("renders its tool schema to JSON Schema and tolerates null fields", () => {
    expect(() =>
      z.toJSONSchema(AskUserQuestionInput, { io: "input", target: "draft-7" }),
    ).not.toThrow();
    expect(
      toQuestions({
        questions: [
          { id: "q", question: "Which?", header: null, options: null, multi_select: null },
        ],
      }),
    ).toEqual([{ id: "q", question: "Which?" }]);
  });
});

describe("attachments reach the coordinator", () => {
  function recordPrompts() {
    const spy = vi.spyOn(
      FakeToolCallingModel.prototype as unknown as { _generate: (...args: unknown[]) => unknown },
      "_generate",
    );
    return {
      restore: () => spy.mockRestore(),

      lastHuman: () => {
        const messages = (spy.mock.calls.at(-1)?.[0] ?? []) as { content: unknown }[];
        return messages.at(-1)?.content;
      },
    };
  }

  const png = {
    name: "hotel.png",
    mediaType: "image/png" as const,
    kind: "image" as const,
    data: "iVBORw0KGgo=",
  };
  const note = {
    name: "booking.txt",
    mediaType: "text/plain" as const,
    kind: "text" as const,
    data: "Confirmation 12345 for the Harbour Hotel",
  };

  it("sends an image as an image_url content block beside the envelope", async () => {
    const prompts = recordPrompts();
    try {
      await run(
        { tripId: brief.tripId, message: "Is this our hotel?", brief, attachments: [png] },
        scriptedModel(),
        memoryStore().mem,
      );
      const content = prompts.lastHuman() as {
        type: string;
        text?: string;
        image_url?: { url: string };
      }[];
      expect(Array.isArray(content)).toBe(true);
      expect(content[0]?.type).toBe("text");

      expect(JSON.parse(content[0]?.text ?? "{}")).toMatchObject({
        message: "Is this our hotel?",
        knownSoFar: { destination: "Tokyo" },
      });
      expect(content[1]).toEqual({
        type: "image_url",
        image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
      });
    } finally {
      prompts.restore();
    }
  });

  it("inlines a text file into the message under a delimiter that names it", async () => {
    const prompts = recordPrompts();
    try {
      await run(
        { tripId: brief.tripId, message: "What does this say?", brief, attachments: [note] },
        scriptedModel(),
        memoryStore().mem,
      );

      const content = prompts.lastHuman();
      expect(typeof content).toBe("string");
      const message = JSON.parse(content as string).message as string;
      expect(message).toContain("What does this say?");
      expect(message).toContain("--- attached file: booking.txt (text/plain) ---");
      expect(message).toContain("Confirmation 12345 for the Harbour Hotel");
      expect(message).toContain("--- end of booking.txt ---");
    } finally {
      prompts.restore();
    }
  });

  it("changes nothing when the traveller attached nothing", async () => {
    const prompts = recordPrompts();
    try {
      await run(
        { tripId: brief.tripId, message: "Is Tokyo warm in June?", brief },
        scriptedModel(),
        memoryStore().mem,
      );
      const content = prompts.lastHuman();
      expect(typeof content).toBe("string");
      expect(JSON.parse(content as string).message).toBe("Is Tokyo warm in June?");
    } finally {
      prompts.restore();
    }
  });
});

describe("the traveller's trip preferences reach the planner", () => {
  const preferences = ["Vegetarian food", "No early starts"];
  const plannedBrief = () => vi.mocked(itinerary.invoke).mock.lastCall?.[0].brief;

  it("carries them from `known` into the brief the specialists plan", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const { mem } = memoryStore();
    const result = await run(
      {
        tripId: "blank",
        message: "2027-11-02 to 2027-11-06, 3 people, budget 2400",
        known: { destination: "Lisbon", preferences },
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
    expect(result.plan.brief.preferences).toEqual(preferences);
    expect(plannedBrief()?.preferences).toEqual(preferences);
  });

  it("keeps them through an edit the coordinator records on a planned trip", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const result = await run(
      { tripId: brief.tripId, message: "Make it 3 people", brief: { ...brief, preferences } },
      scriptedModel(
        [{ name: "update_trip_brief", args: { groupSize: 3 }, id: "c1" }],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      memoryStore().mem,
    );
    expect(result.plan.brief).toMatchObject({ groupSize: 3, preferences });
    expect(plannedBrief()?.preferences).toEqual(preferences);
  });

  it("plans a submitted brief with them", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const result = await runTripChat(
      {
        tripId: brief.tripId,
        mode: "plan",
        message: "Plan trip",
        brief: { ...brief, preferences },
      },
      { specialists: [itinerary], tools, mem: memoryStore().mem },
    );
    expect(result.plan.brief.preferences).toEqual(preferences);
    expect(plannedBrief()?.preferences).toEqual(preferences);
  });

  it("carries them without a provider key too", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const result = await runTripChat(
      {
        tripId: "blank",
        message: "Lisbon, 2027-11-02 to 2027-11-06, 3 people, budget $2400",
        known: { preferences },
      },
      { specialists: [itinerary], tools, mem: memoryStore().mem },
    );
    expect(result.plan.brief.preferences).toEqual(preferences);
  });
});

describe("replacement budget provenance", () => {
  const foreign = {
    ...brief,
    budgetTotal: toAud(500000, "JPY"),
    budgetSource: { amount: 500000, currency: "JPY" as const },
  };
  it.each(["budget AUD 3000", "budget 3000"])(
    "removes old JPY provenance for offline %s",
    async (message) => {
      const result = await runTripChat(
        { tripId: brief.tripId, brief: foreign, message },
        { specialists: [itinerary], tools, mem: memoryStore().mem },
      );
      expect(result.plan.brief.budgetTotal).toBe(3000);
      expect(result.plan.brief.budgetSource).toBeUndefined();
    },
  );
  it("removes old provenance when the coordinator replaces the amount", async () => {
    const result = await run(
      { tripId: brief.tripId, brief: foreign, message: "budget AUD 3000" },
      scriptedModel(
        [
          {
            name: "update_trip_brief",
            args: { budgetAmount: 3000, budgetCurrency: "AUD" },
            id: "budget",
          },
        ],
        [{ name: "replan_trip", args: {}, id: "plan" }],
      ),
      memoryStore().mem,
    );
    expect(result.plan.brief.budgetSource).toBeUndefined();
  });
  it("removes old provenance while collecting missing trip fields", async () => {
    const failure = await runTripChat(
      {
        tripId: "blank",
        known: { budgetTotal: foreign.budgetTotal, budgetSource: foreign.budgetSource },
        message: "budget 3000",
      },
      { specialists: [itinerary], tools, mem: memoryStore().mem },
    ).catch((error) => error);
    expect(failure.needsInfo.known.budgetTotal).toBe(3000);
    expect(failure.needsInfo.known.budgetSource).toBeUndefined();
  });
});
