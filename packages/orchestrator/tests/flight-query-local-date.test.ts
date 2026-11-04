import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { ChatRequest } from "@trip/shared";
import { parseFlightQuery } from "../src/chat/flight-query";

type Case = {
  name: string;
  instant: string;
  timeZone?: string;
  message: string;
  depart: string;
  return?: string;
};

const CASES: Case[] = [
  {
    name: "Sydney morning, UTC still on the day before: yesterday rolls to next year",
    instant: "2026-02-28T21:00:00Z",
    timeZone: "Australia/Sydney",
    message: "flights from Sydney to Tokyo on Feb 28",
    depart: "2027-02-28",
  },
  {
    name: "Sydney morning, today stays today",
    instant: "2026-02-28T21:00:00Z",
    timeZone: "Australia/Sydney",
    message: "flights from Sydney to Tokyo on 1 March",
    depart: "2026-03-01",
  },
  {
    name: "Tokyo morning, UTC still on the day before, Chinese month-day",
    instant: "2026-11-03T22:00:00Z",
    timeZone: "Asia/Tokyo",
    message: "东京到上海的机票 11月3日",
    depart: "2027-11-03",
  },
  {
    name: "Los Angeles evening, UTC already on the next day: today stays this year",
    instant: "2026-11-05T03:00:00Z",
    timeZone: "America/Los_Angeles",
    message: "flights from Los Angeles to Tokyo on Nov 4",
    depart: "2026-11-04",
  },
  {
    name: "São Paulo evening, southern hemisphere behind UTC",
    instant: "2026-11-05T01:30:00Z",
    timeZone: "America/Sao_Paulo",
    message: "flights from Sao Paulo to Lima on 4 November",
    depart: "2026-11-04",
  },
  {
    name: "Auckland new year morning, UTC still in the old year",
    instant: "2026-12-31T20:00:00Z",
    timeZone: "Pacific/Auckland",
    message: "flights from Auckland to Sydney on Dec 31",
    depart: "2027-12-31",
  },
  {
    name: "Los Angeles evening, return leg ordered after the local departure",
    instant: "2026-11-05T03:00:00Z",
    timeZone: "America/Los_Angeles",
    message: "flights Los Angeles to Tokyo on Nov 4 back Nov 3",
    depart: "2026-11-04",
    return: "2027-11-03",
  },
  {
    name: "Sydney during daylight saving, the zone and not a fixed offset decides",
    instant: "2026-10-31T13:30:00Z",
    timeZone: "Australia/Sydney",
    message: "flights from Sydney to Tokyo on Oct 31",
    depart: "2027-10-31",
  },
  {
    name: "explicit year ignores the zone",
    instant: "2026-02-28T21:00:00Z",
    timeZone: "Australia/Sydney",
    message: "flights from Sydney to Tokyo on 2026-02-28",
    depart: "2026-02-28",
  },
  {
    name: "no zone keeps the UTC day",
    instant: "2026-02-28T21:00:00Z",
    message: "flights from Sydney to Tokyo on Feb 28",
    depart: "2026-02-28",
  },
];

const evidence: Array<Case & { parsed?: { depart: string; return?: string } }> = [];

afterAll(() => {
  const out = "output";
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/flight-query-local-date.json`, JSON.stringify(evidence, null, 2));
});

describe("parseFlightQuery in the traveller's time zone", () => {
  for (const item of CASES)
    it(item.name, () => {
      const parsed = parseFlightQuery(item.message, new Date(item.instant), item.timeZone);
      evidence.push({
        ...item,
        parsed: parsed && {
          depart: parsed.depart,
          ...(parsed.return ? { return: parsed.return } : {}),
        },
      });
      expect(parsed?.depart).toBe(item.depart);
      expect(parsed?.return).toBe(item.return);
    });
});

describe("ChatRequest.timeZone", () => {
  const base = { tripId: "t", message: "flights from Sydney to Tokyo on Feb 28" };

  it("accepts an IANA zone and an absent zone", () => {
    expect(ChatRequest.safeParse({ ...base, timeZone: "Australia/Sydney" }).success).toBe(true);
    expect(ChatRequest.safeParse({ ...base, timeZone: "UTC" }).success).toBe(true);
    expect(ChatRequest.safeParse(base).success).toBe(true);
  });

  it("rejects a zone name the runtime does not know", () => {
    for (const timeZone of ["Mars/Olympus", "", "+11:00"])
      expect(ChatRequest.safeParse({ ...base, timeZone }).success, timeZone).toBe(false);
  });
});
