import { FakeToolCallingModel } from "langchain";
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
  dates: ["2026-06-15", "2026-06-22"],
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
/** Each entry is one model turn; the empty array ends the loop. */
const scriptedModel = (...turns: ToolCall[][]) =>
  new FakeToolCallingModel({ toolCalls: [...turns, []] });

const run = (
  request: Parameters<typeof runTripChat>[0],
  model: FakeToolCallingModel,
  mem: MemoryStore,
  extra: Partial<Parameters<typeof runTripChat>[1]> = {},
) => runTripChat(request, { model, specialists: [itinerary], tools, mem, ...extra });

describe("the conversation agent decides what to do", () => {
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

    // The headline promise of the refactor: a question costs one model call, not a
    // full replan, and the plan comes back untouched.
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
    // Without an ask_user_question call the frame carries prose and what is
    // known; choices only ever arrive in an ask_user frame.
    expect(asked.question.length).toBeGreaterThan(0);
    expect(asked).not.toHaveProperty("asked");
  });

  it("carries what earlier turns stated, so the traveller answers only the question", async () => {
    const { mem } = memoryStore();
    const result = await run(
      {
        tripId: "blank",
        message: "2026-11-02 to 2026-11-06, 3 people, budget 2400",
        known: { destination: "Lisbon" },
      },
      scriptedModel(
        [
          {
            name: "update_trip_brief",
            args: {
              startDate: "2026-11-02",
              endDate: "2026-11-06",
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
      dates: ["2026-11-02", "2026-11-06"],
      groupSize: 3,
      budgetTotal: 2400,
    });
    expect(JSON.stringify(result.plan)).not.toMatch(/Tokyo|Kyoto|demo-trip/);
  });

  it("puts the conversation so far in front of the model", async () => {
    // Without this a follow-up like 「是今年」 has nothing to resolve against.
    const { mem } = memoryStore([
      { role: "user", content: "悉尼三日游", at: "2026-09-20T00:00:00.000Z" },
      { role: "assistant", content: "好的，几号出发？", at: "2026-09-20T00:00:01.000Z" },
    ]);
    const failure = await run({ tripId: "blank", message: "是今年" }, scriptedModel(), mem).catch(
      (error: unknown) => error,
    );

    // FakeToolCallingModel answers with the prior messages joined together, so its
    // reply is a transcript of exactly what the agent was shown.
    expect((failure as IncompleteBriefError).message).toContain("悉尼三日游");
    expect((failure as IncompleteBriefError).message).toContain("是今年");
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
              startDate: "2026-10-06",
              endDate: "2026-10-09",
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

    // The model named the currency; the arithmetic happened in code.
    expect(result.plan.brief.budgetTotal).toBe(toAud(3000, "CNY"));
    expect(result.plan.brief.budgetSource).toEqual({ amount: 3000, currency: "CNY" });
    expect(result.plan.brief.groupSize).toBe(2);
  });

  it("treats an explicit base-currency amount as an identity, not a second conversion", async () => {
    // The preferences form builds its message with an "AUD 3,000.00" total, so the
    // agent sees an explicit AUD and must not shrink it.
    const { mem } = memoryStore();
    const result = await run(
      { tripId: "blank", message: "Sydney, 2026-10-06 to 2026-10-09, 2 people, AUD 3,000.00" },
      scriptedModel(
        [
          {
            name: "update_trip_brief",
            args: {
              destination: "Sydney",
              startDate: "2026-10-06",
              endDate: "2026-10-09",
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
    // This threw before, and the throw fell back silently to the regex parser,
    // which is how "3000 人民币" became a party of 3000.
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

  it("holds back a date range with only one end", async () => {
    const { mem } = memoryStore();
    const result = await run(
      { tripId: brief.tripId, message: "leave on the 6th", brief },
      scriptedModel(
        [{ name: "update_trip_brief", args: { startDate: "2026-10-06" }, id: "c1" }],
        [{ name: "replan_trip", args: {}, id: "c2" }],
      ),
      mem,
    );
    expect(result.plan.brief.dates).toEqual(brief.dates);
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
    // The deterministic summary, not the model's transcript-shaped answer: the
    // agent was never asked to rediscover what the form already stated.
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
      { tripId: "blank", message: "Lisbon, 2026-11-02 to 2026-11-06, 3 people, budget $2400" },
      mem,
    );
    expect(result.plan.brief).toMatchObject({
      tripId: "blank",
      destination: "Lisbon",
      groupSize: 3,
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
    // FakeToolCallingModel never serialises the schema, so nothing above catches
    // this. A real provider call does: a `z.preprocess` here threw "Transforms
    // cannot be represented in JSON Schema" and took the whole turn down.
    expect(() => z.toJSONSchema(BriefUpdate, { io: "input", target: "draft-7" })).not.toThrow();
  });

  it("accepts the shapes a model actually sends for an absent field", () => {
    for (const absent of [null, undefined, "null", "", "N/A"])
      expect(
        BriefUpdate.safeParse({ destination: absent, groupSize: absent, budgetAmount: absent })
          .success,
      ).toBe(true);
    // Numbers arrive as strings often enough to be worth accepting.
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
    // The blank question is gone and the duplicate id was made unique.
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
    // A full brief narrows to the fields a follow-up carries.
    expect(asked.known).toEqual({
      destination: "Tokyo",
      dates: ["2026-06-15", "2026-06-22"],
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
  /** What the agent actually handed the model, across every call of one turn. */
  function recordPrompts() {
    const spy = vi.spyOn(
      FakeToolCallingModel.prototype as unknown as { _generate: (...args: unknown[]) => unknown },
      "_generate",
    );
    return {
      restore: () => spy.mockRestore(),
      /** The content of the last human message the model saw. */
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
      // The JSON envelope is untouched; the image rides beside it.
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
      // No image, so the message stays a plain string as it always was.
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
