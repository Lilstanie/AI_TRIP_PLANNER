import { describe, it, expect } from "vitest";
import { parseFlightQuery } from "../src/chat/flight-query";

describe("parseFlightQuery", () => {
  it("reads the question this feature exists for", () => {
    expect(
      parseFlightQuery("what is sydney to seoul flight on 11/25/2026 on cheapest price"),
    ).toEqual({
      from: "sydney",
      to: "seoul",
      depart: "2026-11-25",
      passengers: 1,
      cheapestFirst: true,
    });
  });

  it("reads the other ways people ask", () => {
    expect(parseFlightQuery("cheapest flight from Melbourne to Tokyo on 2 Nov 2026")).toMatchObject(
      { from: "Melbourne", to: "Tokyo", depart: "2026-11-02", cheapestFirst: true },
    );
    expect(parseFlightQuery("flights Sydney to Singapore 2026-11-02 for 3 people")).toMatchObject({
      from: "Sydney",
      to: "Singapore",
      passengers: 3,
    });
    expect(parseFlightQuery("悉尼到首尔的机票 2026-11-02")).toMatchObject({
      from: "悉尼",
      to: "首尔",
      depart: "2026-11-02",
    });
  });

  it("treats a second date as the return leg", () => {
    expect(parseFlightQuery("flight from Sydney to Tokyo 2026-11-02 to 2026-11-09")).toMatchObject({
      depart: "2026-11-02",
      return: "2026-11-09",
    });
  });

  it("leaves a message with any ambiguous date to the chat model", () => {
    for (const message of [
      "flights from Sydney to Tokyo on 15/11/2026 returning 05/12/2026",
      "flights from Sydney to Tokyo on 05/11/2026 returning 2026-11-20",
      "flights from Sydney to Tokyo on 05/11/2026 returning 06/12/2026",
    ])
      expect(parseFlightQuery(message), message).toBeUndefined();
  });

  it("keeps a slash date when both of its parts can be told apart", () => {
    expect(
      parseFlightQuery("flights from Sydney to Tokyo on 15/11/2026 returning 2026-11-20"),
    ).toMatchObject({ depart: "2026-11-15", return: "2026-11-20" });
  });

  it("leaves planning requests to the planner", () => {
    expect(
      parseFlightQuery("Plan a 4-day trip to Sydney for 2 people from 2026-11-02 to 2026-11-06"),
    ).toBeUndefined();
    expect(
      parseFlightQuery("Plan a trip to Tokyo on 2026-11-02 and book the cheapest flight"),
    ).toBeUndefined();
  });

  it("leaves an edit to an open trip with the planner", () => {
    for (const message of [
      "change the flight from Sydney to Tokyo on 25 Nov 2026",
      "swap the flight from Sydney to Tokyo on 25 Nov 2026 for a cheaper one",
      "把 2026-11-25 悉尼到东京的机票换成更便宜的",
    ])
      expect(parseFlightQuery(message), message).toBeUndefined();
  });

  const today = new Date("2026-11-01T12:00:00.000Z");

  it("reads a Chinese round trip that crosses New Year", () => {
    expect(parseFlightQuery("看一下 12 月 15 ， 悉尼到上海，1 月 5往返的航班", today)).toEqual({
      from: "悉尼",
      to: "上海",
      depart: "2026-12-15",
      return: "2027-01-05",
      passengers: 1,
      cheapestFirst: false,
    });
  });

  it("keeps lead-ins, dates and trip words out of Chinese city names", () => {
    expect(
      parseFlightQuery("帮我查一下悉尼到上海往返的机票，12月15日去，1月5日回", today),
    ).toMatchObject({
      from: "悉尼",
      to: "上海",
      depart: "2026-12-15",
      return: "2027-01-05",
    });
    expect(parseFlightQuery("2027年3月2号从北京飞东京的航班 2人", today)).toMatchObject({
      from: "北京",
      to: "东京",
      depart: "2027-03-02",
      passengers: 2,
    });
  });

  it("finds a multi-word origin after a long English lead-in", () => {
    for (const [message, from, to] of [
      ["cheapest flight from Los Angeles to Tokyo on Nov 4", "Los Angeles", "Tokyo"],
      [
        "what is the cheapest one way flight from Rio de Janeiro to Lisbon on Nov 4",
        "Rio de Janeiro",
        "Lisbon",
      ],
      [
        "can you find me the cheapest flights from New York City to Tokyo on Nov 4",
        "New York City",
        "Tokyo",
      ],
      ["I want to fly from Sydney to Tokyo on Nov 4", "Sydney", "Tokyo"],
      ["flights from Los Angeles to Rio de Janeiro on Nov 4", "Los Angeles", "Rio de Janeiro"],
      ["cheapest Los Angeles to Tokyo flight on Nov 4", "Los Angeles", "Tokyo"],
    ] as const)
      expect(parseFlightQuery(message, today), message).toMatchObject({
        from,
        to,
        depart: "2026-11-04",
      });
  });

  it("finds the origin after a long Chinese lead-in", () => {
    for (const [message, from] of [
      ["请帮我查一下最便宜的从里约热内卢到东京的机票 11月4日", "里约热内卢"],
      ["帮我查一下最便宜的从洛杉矶到东京的机票 11月4日", "洛杉矶"],
      ["最便宜的洛杉矶到东京的机票 11月4日", "洛杉矶"],
    ] as const)
      expect(parseFlightQuery(message, today), message).toMatchObject({
        from,
        to: "东京",
        depart: "2026-11-04",
        cheapestFirst: true,
      });
  });

  it("finds a known city after an unlisted Chinese lead-in", () => {
    for (const [message, from, to] of [
      ["你好洛杉矶到东京的机票 11月4日", "洛杉矶", "东京"],
      ["您好里约热内卢到东京的航班 11月4日", "里约热内卢", "东京"],
      ["早上好悉尼到首尔的机票 11月4日", "悉尼", "首尔"],
      ["请问一下北京到东京的航班 11月4日", "北京", "东京"],
      ["你好布宜诺斯艾利斯到东京的机票 11月4日", "布宜诺斯艾利斯", "东京"],
    ] as const)
      expect(parseFlightQuery(message, today), message).toMatchObject({
        from,
        to,
        depart: "2026-11-04",
      });
  });

  it("keeps a Chinese origin the airport table does not know", () => {
    expect(parseFlightQuery("你好火星基地到东京的机票 11月4日", today)?.from).toBe("你好火星基地");
  });

  it("declines unlisted Chinese lead-ins that are not a dated flight question", () => {
    for (const message of [
      "你好东京到东京的机票 11月4日",
      "你好洛杉矶到东京的机票",
      "你好帮我规划洛杉矶到东京的行程 11月4日",
      "你好把洛杉矶到东京的机票换成更便宜的 11月4日",
    ])
      expect(parseFlightQuery(message, today), message).toBeUndefined();
  });

  it("still declines long lead-ins that are not a dated flight question", () => {
    for (const message of [
      "Plan a trip from Los Angeles to Tokyo on Nov 4 with the cheapest flight",
      "please change the cheapest flight from Los Angeles to Tokyo on Nov 4",
      "what is the cheapest one way flight from Rio de Janeiro to Lisbon",
      "can you find me the cheapest hotels from New York City to Tokyo on Nov 4",
      "cheapest flight from Los Angeles to Los Angeles on Nov 4",
      "帮我规划一下从洛杉矶到东京的行程 11月4日",
      "请帮我查一下最便宜的从洛杉矶到东京的机票",
    ])
      expect(parseFlightQuery(message, today), message).toBeUndefined();
  });

  it("reads English dates without a year", () => {
    expect(parseFlightQuery("flights Sydney to Tokyo on Dec 15th back Jan 5", today)).toMatchObject(
      {
        from: "Sydney",
        to: "Tokyo",
        depart: "2026-12-15",
        return: "2027-01-05",
      },
    );
    expect(
      parseFlightQuery("cheapest flight from Sydney to Tokyo on 15 December", today),
    ).toMatchObject({ depart: "2026-12-15", cheapestFirst: true });
  });

  it("moves a passed date to next year and keeps an impossible one out", () => {
    expect(parseFlightQuery("悉尼到上海的航班 3月1日", today)?.depart).toBe("2027-03-01");
    expect(parseFlightQuery("悉尼到上海的航班 13月40日", today)).toBeUndefined();
  });

  it("declines anything it cannot answer outright", () => {
    expect(parseFlightQuery("what is the cheapest flight from Sydney to Seoul")).toBeUndefined();

    expect(parseFlightQuery("Sydney to Seoul on 2026-11-02")).toBeUndefined();

    expect(parseFlightQuery("cheapest flight on 2026-11-02")).toBeUndefined();

    expect(parseFlightQuery("flight from Sydney to Sydney on 2026-11-02")).toBeUndefined();

    expect(parseFlightQuery("flight Sydney to Seoul on 11/02/2026")).toBeUndefined();
  });
});
