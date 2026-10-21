import { FakeToolCallingModel } from "langchain";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { toAud } from "@trip/shared";
import type { MemoryStore, TripPlan } from "@trip/shared";
import {
  AskUserError,
  AskUserQuestionInput,
  BriefUpdate,
  IncompleteBriefError,
  runTripChat,
  toQuestions,
} from "../src/chat";
import { brief, itinerary, memoryStore, run, scriptedModel, tools } from "./chat-test-fixtures";

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

describe("a trip length the traveller states in days", () => {
  const datesFor = async (
    message: string,
    args: Record<string, unknown>,
    request: Partial<Parameters<typeof runTripChat>[0]> = {},
  ) => {
    const { mem } = memoryStore();
    const result = await run(
      { tripId: "blank", message, ...request },
      scriptedModel(
        [{ name: "update_trip_brief", args, id: "c1" }],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      mem,
    );
    return result.plan.brief.dates;
  };
  const hobart = { destination: "Hobart", groupSize: 2, budgetAmount: 5000 };

  it("ends on the last of those days when the model adds a departure day", async () => {
    expect(
      await datesFor("3 days in Hobart from 1 Mar 2027, 2 adults, budget AUD 5000", {
        ...hobart,
        startDate: "2027-03-01",
        endDate: "2027-03-04",
      }),
    ).toEqual(["2027-03-01", "2027-03-03"]);
  });

  it("reads hyphenated and Chinese day counts", async () => {
    const args = { ...hobart, startDate: "2027-03-01", endDate: "2027-03-08" };
    expect(await datesFor("a 5-day trip to Hobart from 1 Mar 2027", args)).toEqual([
      "2027-03-01",
      "2027-03-05",
    ]);
    expect(await datesFor("2027年3月1日出发，霍巴特五日游，预算5000", args)).toEqual([
      "2027-03-01",
      "2027-03-05",
    ]);
    expect(await datesFor("霍巴特玩4天，3月1日出发", args)).toEqual(["2027-03-01", "2027-03-04"]);
  });

  it("adds up the days of each city in a multi-city trip", async () => {
    expect(
      await datesFor("3 days in Hobart and 2 days in Launceston from 1 Mar 2027", {
        ...hobart,
        destination: "Hobart & Launceston",
        startDate: "2027-03-01",
        endDate: "2027-03-07",
      }),
    ).toEqual(["2027-03-01", "2027-03-05"]);
  });

  it("crosses a month and a leap day by the calendar", async () => {
    expect(
      await datesFor("4 days in Hobart from 27 Feb 2028", {
        ...hobart,
        startDate: "2028-02-27",
        endDate: "2028-03-02",
      }),
    ).toEqual(["2028-02-27", "2028-03-01"]);
  });

  it("keeps an explicit date range over a day count", async () => {
    expect(
      await datesFor("3 days in Hobart, 2027-03-01 to 2027-03-05", {
        ...hobart,
        startDate: "2027-03-01",
        endDate: "2027-03-05",
      }),
    ).toEqual(["2027-03-01", "2027-03-05"]);
  });

  it("does not read a start offset or a one-day trip as a length", async () => {
    const args = { ...hobart, startDate: "2027-03-01", endDate: "2027-03-04" };
    expect(await datesFor("Hobart, leaving in 3 days, back 4 Mar 2027", args)).toEqual([
      "2027-03-01",
      "2027-03-04",
    ]);
    expect(await datesFor("1 day in Hobart from 1 Mar 2027", args)).toEqual([
      "2027-03-01",
      "2027-03-04",
    ]);
  });

  it("measures from the trip's existing start when only the length changes", async () => {
    expect(
      await datesFor("make it 3 days", { endDate: "2027-06-18" }, { tripId: brief.tripId, brief }),
    ).toEqual(["2027-06-15", "2027-06-17"]);
  });
});
