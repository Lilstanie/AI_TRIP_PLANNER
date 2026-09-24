import { describe, it, expect } from "vitest";
import {
  AskUserError,
  blankDraft,
  budgetHint,
  draftFor,
  draftWithKnown,
  knownFromDraft,
  money,
  NeedsInfoError,
  parseDraft,
  parseSnapshot,
  readPlanStream,
  withValidAttachments,
} from "@/lib/workspace/workspace";
import { plan, snapshot } from "@/tests/fixtures/workspace";

describe("workspace boundaries", () => {
  it("rejects impossible dates, empty fields, fractional people and invalid preferences", () => {
    for (const patch of [
      { start: "2026-02-30" },
      { end: "2026-09-30" },
      { destination: " " },
      { groupSize: "1.2" },
      { budgetTotal: "0" },
      { preferences: [" "] },
      { preferences: ["x".repeat(201)] },
    ])
      expect(parseDraft({ ...snapshot.draft, ...patch }, plan.brief).success).toBe(false);
    expect(parseDraft({ ...snapshot.draft, budgetTotal: "0.01" }, plan.brief).success).toBe(true);
    expect(
      parseDraft(
        { ...snapshot.draft, destination: "Sydney & Melbourne", end: "2026-10-02" },
        plan.brief,
      ).success,
    ).toBe(false);
  });
  it("passes the retired accommodation fields through, and cannot be blocked by them", () => {
    const kept = parseDraft(
      { ...snapshot.draft, nationality: "Australian", minRating: "8", freeCancellation: true },
      plan.brief,
    );
    expect(kept.success && kept.data).toMatchObject({
      nationality: "Australian",
      accommodation: { minRating: 8, freeCancellation: true },
    });
    // Nothing edits the rating any more, so a stored value the schema rejects means "no minimum".
    for (const minRating of ["", "11"]) {
      const parsed = parseDraft({ ...snapshot.draft, minRating }, plan.brief);
      expect(parsed.success && parsed.data.accommodation?.minRating).toBe(0);
    }
  });
  it("sends the traveller's preferences with the brief, and clears an emptied list", () => {
    const withList = parseDraft(
      { ...snapshot.draft, preferences: ["Vegetarian food", "No early starts"] },
      plan.brief,
    );
    expect(withList.success && withList.data.preferences).toEqual([
      "Vegetarian food",
      "No early starts",
    ]);
    const cleared = parseDraft(
      { ...snapshot.draft, preferences: [] },
      { ...plan.brief, preferences: ["Old wish"] },
    );
    expect(cleared.success && cleared.data.preferences).toBeUndefined();
    expect(draftFor({ ...plan.brief, preferences: ["Quiet hotels"] }).preferences).toEqual([
      "Quiet hotels",
    ]);
  });
  it("loads a draft stored before the preference list existed", () => {
    const { preferences: _dropped, ...older } = snapshot.draft;
    expect(parseSnapshot(JSON.parse(JSON.stringify({ ...snapshot, draft: older }))).draft).toEqual(
      older,
    );
    expect(() =>
      parseSnapshot({ ...snapshot, draft: { ...snapshot.draft, preferences: "vegetarian" } }),
    ).toThrow();
  });
  it("round-trips unfinished forms while rejecting corrupt or incompatible snapshots", () => {
    const unfinished = { ...snapshot, draft: { ...snapshot.draft, budgetTotal: "" } };
    expect(parseSnapshot(JSON.parse(JSON.stringify(unfinished)))).toMatchObject({
      version: 3,
      draft: unfinished.draft,
    });
    for (const invalid of [
      // Pre-AUD snapshots: their amounts meant USD and their stay candidates carry the
      // old pricePerNightUsd field, so they are rejected rather than migrated.
      { ...snapshot, version: 2 },
      { ...snapshot, plan: {} },
      { ...snapshot, messages: [{ role: "system", text: "bad" }] },
      { ...snapshot, draft: {} },
      { ...snapshot, previousTotal: -1 },
    ])
      expect(() => parseSnapshot(invalid)).toThrow();
  });
  it("drops a removed decision list from a stored plan instead of rejecting it", () => {
    // Plans saved before the decision apparatus was removed still carry `hitl`.
    // The object schema strips unknown keys, so they keep loading rather than
    // throwing away the traveller's saved trips.
    const stored = {
      ...snapshot,
      plan: {
        ...snapshot.plan,
        hitl: [
          {
            id: "confirm-plan",
            type: "confirm_plan",
            title: "Confirm this plan",
            detail: "Confirm the reviewed itinerary.",
            status: "pending",
          },
        ],
      },
    };
    const parsed = parseSnapshot(JSON.parse(JSON.stringify(stored)));
    expect(parsed.plan).not.toHaveProperty("hitl");
    expect(parsed.plan.tripId).toBe(snapshot.plan.tripId);
  });
  it("keeps a stored reply's valid transcript and drops a damaged one without losing the message", () => {
    const good = [{ type: "agent_started", agent: "itinerary", round: 1 }];
    const stored = {
      ...snapshot,
      messages: [
        { role: "agent", text: "Kept", activity: good },
        { role: "agent", text: "Damaged", activity: [{ type: "nonsense" }] },
      ],
    };
    const parsed = parseSnapshot(JSON.parse(JSON.stringify(stored)));
    expect(parsed.messages[0]).toMatchObject({ text: "Kept", activity: good });
    expect(parsed.messages[1]).toEqual({ role: "agent", text: "Damaged" });
  });
  it("parses split NDJSON and a trailing final frame, skipping malformed progress", async () => {
    const payload = JSON.stringify({ type: "complete", response: { plan, reply: "Updated" } });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'broken\n{"type":"agent_started","agent":"itinerary","round":1}\n' +
              payload.slice(0, 40),
          ),
        );
        controller.enqueue(new TextEncoder().encode(payload.slice(40)));
        controller.close();
      },
    });
    const events: unknown[] = [];
    expect(
      (await readPlanStream(new Response(stream), (event) => events.push(event))).plan,
    ).toEqual(plan);
    expect(events).toHaveLength(1);
  });
  it("raises a follow-up question as a question rather than a failed request", async () => {
    const frame = JSON.stringify({
      type: "needs_info",
      question: "你打算哪天出发？",
      known: { destination: "悉尼" },
    });
    const error = await readPlanStream(new Response(frame), () => {}).catch(
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(NeedsInfoError);
    // A question carries only what is still unknown. The traveller answers it
    // by typing, so there is no option list on the wire.
    expect((error as NeedsInfoError).needsInfo).toEqual({
      type: "needs_info",
      question: "你打算哪天出发？",
      known: { destination: "悉尼" },
    });
  });
  it("raises a structured question with its choices and the plan it left untouched", async () => {
    const asked = {
      type: "ask_user",
      questions: [
        {
          id: "pace",
          header: "Pace",
          question: "How full should each day be?",
          options: [
            { label: "Relaxed (Recommended)", description: "Two sights a day." },
            { label: "Packed" },
          ],
        },
      ],
      known: { destination: "Tokyo" },
      plan,
      reply: "One quick choice first.",
    };
    const error = await readPlanStream(new Response(JSON.stringify(asked)), () => {}).catch(
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(AskUserError);
    expect((error as AskUserError).askUser).toEqual(asked);
  });
  it("rejects a structured question with more choices than the contract allows", async () => {
    const frame = JSON.stringify({
      type: "ask_user",
      questions: [
        {
          id: "q",
          question: "Which?",
          options: ["a", "b", "c", "d", "e"].map((label) => ({ label })),
        },
      ],
      known: {},
    });
    await expect(readPlanStream(new Response(frame), () => {})).rejects.toThrow(
      "The assistant's question was invalid",
    );
  });
  it("sends only filled, valid form fields as what the traveller has stated", () => {
    const blank = {
      ...snapshot.draft,
      destination: "",
      start: "",
      end: "",
      groupSize: "",
      budgetTotal: "",
      nationality: "",
    };
    expect(knownFromDraft(blank)).toEqual({});
    // One date alone is not a range, and a half-typed number is not a stated fact.
    expect(knownFromDraft({ ...blank, start: "2026-10-01", groupSize: "0" })).toEqual({});
    expect(
      knownFromDraft({ ...blank, destination: "悉尼", start: "2026-10-01", end: "2026-10-05" }),
    ).toEqual({ destination: "悉尼", dates: ["2026-10-01", "2026-10-05"] });
    // Preferences stated before any plan travel as known; a list the schema rejects is left out
    // rather than dropping the other facts with it.
    expect(
      knownFromDraft({ ...blank, destination: "Lisbon", preferences: ["Vegetarian food"] }),
    ).toEqual({ destination: "Lisbon", preferences: ["Vegetarian food"] });
    expect(knownFromDraft({ ...blank, destination: "Lisbon", preferences: [" "] })).toEqual({
      destination: "Lisbon",
    });
  });
  it("shows what the assistant understood in the form without clearing the rest", () => {
    const draft = { ...snapshot.draft, destination: "", groupSize: "4" };
    expect(
      draftWithKnown(draft, { destination: "悉尼", dates: ["2026-10-01", "2026-10-05"] }),
    ).toMatchObject({
      destination: "悉尼",
      start: "2026-10-01",
      end: "2026-10-05",
      groupSize: "4",
      minRating: draft.minRating,
    });
  });
  it("rejects HTTP errors, truncated streams and invalid final plans", async () => {
    await expect(
      readPlanStream(new Response('{"error":"Bad dates"}', { status: 400 }), () => {}),
    ).rejects.toThrow("Bad dates");
    await expect(readPlanStream(new Response(""), () => {})).rejects.toThrow("before the plan");
    await expect(
      readPlanStream(new Response('{"type":"complete","response":{}}'), () => {}),
    ).rejects.toThrow("invalid");
  });
});

describe("stored message attachments", () => {
  const good = {
    name: "shrine.jpg",
    mediaType: "image/jpeg",
    kind: "image" as const,
    thumbnail: "data:image/jpeg;base64,AAAA",
    bytes: 2048,
  };

  it("keeps a message whose attachments all match the stored shape", () => {
    const messages = [{ role: "user" as const, text: "Look", attachments: [good] }];
    expect(withValidAttachments(messages)).toEqual(messages);
  });

  it("drops a damaged entry and keeps the message it belonged to", () => {
    const [message] = withValidAttachments([
      {
        role: "user",
        text: "Look",
        attachments: [good, { name: "", mediaType: "image/jpeg", kind: "image" }],
      },
    ]);
    expect(message?.text).toBe("Look");
    expect(message?.attachments).toEqual([good]);
  });

  it("drops the field entirely when nothing in it survives", () => {
    const [message] = withValidAttachments([
      // A thumbnail restored from storage is inert only while it is an inline
      // image; a remote or script-bearing URL is neither.
      { role: "user", text: "Look", attachments: [{ ...good, thumbnail: "javascript:alert(1)" }] },
    ]);
    expect(message).toEqual({ role: "user", text: "Look" });
  });

  it("leaves a message stored before attachments existed alone", () => {
    const messages = [{ role: "agent" as const, text: "Here you go." }];
    expect(withValidAttachments(messages)).toEqual(messages);
  });
});

describe("budget display", () => {
  it("formats amounts in the base currency", () => {
    expect(money(2000)).toMatch(/AUD\s*2,000\.00/);
  });

  it("explains a converted budget, and says nothing when there is nothing to explain", () => {
    expect(budgetHint({ budgetSource: { amount: 3000, currency: "CNY" } })).toMatch(/¥3,000/);
    expect(budgetHint({})).toBe("");
    // Stated in the base currency: converting it back would be noise.
    expect(budgetHint({ budgetSource: { amount: 3000, currency: "AUD" } })).toBe("");
  });

  it("drops the minor unit for a currency that has none", () => {
    expect(budgetHint({ budgetSource: { amount: 50000, currency: "JPY" } })).not.toMatch(/\./);
  });

  it("does not carry a stale source past a form edit", () => {
    // The preferences form is base-currency only, so a budget typed there has no source.
    const current = { ...plan.brief, budgetSource: { amount: 3000, currency: "CNY" as const } };
    const parsed = parseDraft({ ...draftFor(current), budgetTotal: "900" }, current);
    expect(parsed.success && parsed.data.budgetSource).toBeUndefined();
    expect(parsed.success && parsed.data.budgetTotal).toBe(900);
  });
});

describe("trip origin", () => {
  it("round-trips through the form and treats blank as not stated", () => {
    const withOrigin = parseDraft({ ...snapshot.draft, origin: "Melbourne" }, plan.brief);
    expect(withOrigin.success && withOrigin.data.origin).toBe("Melbourne");

    // Blank must become undefined, not "": TripBrief rejects an empty string,
    // and "no origin stated" is what skips long-haul flight pricing.
    const blank = parseDraft({ ...snapshot.draft, origin: "   " }, plan.brief);
    expect(blank.success).toBe(true);
    expect(blank.success && blank.data.origin).toBeUndefined();

    // And back out again for the form to show.
    expect(draftFor({ ...plan.brief, origin: "Perth" }).origin).toBe("Perth");
    expect(draftFor({ ...plan.brief, origin: undefined }).origin).toBe("");
  });

  it("sends a stated origin to the assistant as a known fact", () => {
    expect(knownFromDraft({ ...blankDraft(), origin: "Perth" }).origin).toBe("Perth");
    expect(knownFromDraft(blankDraft()).origin).toBeUndefined();
  });
});

describe("traveller party", () => {
  const party = { adults: 2, children: 1, infants: 1, seniors: 0, pets: 1 };
  const withParty = { ...snapshot.draft, groupSize: "4", party };
  it("sends the breakdown with the brief and the known facts while it matches groupSize", () => {
    const parsed = parseDraft(withParty, plan.brief);
    expect(parsed.success && parsed.data.party).toEqual(party);
    expect(knownFromDraft(withParty).party).toEqual(party);
    expect(draftFor({ ...plan.brief, groupSize: 4, party }).party).toEqual(party);
  });
  it("leaves out a breakdown that no longer adds up to groupSize", () => {
    const stale = { ...withParty, groupSize: "3" };
    const parsed = parseDraft(stale, { ...plan.brief, party });
    expect(parsed.success && parsed.data.party).toBeUndefined();
    expect(knownFromDraft(stale).party).toBeUndefined();
    expect(draftFor({ ...plan.brief, groupSize: 3, party }).party).toBeUndefined();
  });
  it("drops the breakdown when the chat learns a different head count", () => {
    expect(draftWithKnown(withParty, { groupSize: 3 }).party).toBeUndefined();
    expect(draftWithKnown(withParty, { destination: "Hobart" }).party).toEqual(party);
  });
});
