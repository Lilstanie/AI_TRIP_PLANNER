import { setTimeout as sleep } from "node:timers/promises";

// Shared deterministic trip setup; scenario-specific request handling stays with each journey.
export const settle = (page, ms = 500) => page.waitForTimeout(ms);
export { sleep };

export function placeFor(text) {
  return {
    id: `stub:${text}`,
    displayName: { text },
    formattedAddress: `${text}, Sydney NSW, Australia`,
    location: { latitude: -33.8568, longitude: 151.2153 },
    googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(text)}`,
  };
}

/** Polls `test` for up to `ms`; resolves to whether it passed. */
export async function waitUntil(test, ms = 8000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (await test()) return true;
    await sleep(200);
  }
  return test();
}

export async function openMockWorkspace(page, base) {
  await page.goto(base);
  await page.waitForSelector(".workspace-app");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: /^(Live|Mock) data/ })
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    await live.click();
    await settle(page, 400);
  }
}

export async function planSuggestedTrip(page) {
  const chatTab = page.getByRole("tab", { name: /^Chat/ });
  if (await chatTab.count()) {
    await chatTab.click();
    await settle(page, 500);
  }
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1500);
  const tripTab = page.getByRole("tab", { name: /^Trip/ });
  if (await tripTab.count()) await tripTab.click();
  else await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);
  await page.getByRole("region", { name: "Trip timeline" }).waitFor({ timeout: 30_000 });
  await settle(page, 700);
}

export function seededDayItems(days, plannerWalkMin) {
  const seeded = [];
  for (const [dayNumber, stops] of Object.entries(days)) {
    stops.forEach((stop, index) => {
      seeded.push({
        id: `seed-d${dayNumber}-${index + 1}`,
        kind: "activity",
        day: Number(dayNumber),
        startTime: stop.start,
        endTime: stop.end,
        location: stop.name,
        detail: stop.name,
        ...(stop.saved ? { placeId: `stub:${stop.name}` } : {}),
        ...(index > 0 && stop.arriveBy !== false
          ? {
              arriveBy: {
                mode: "walk",
                durationMin: plannerWalkMin,
                from: stops[index - 1].name,
              },
            }
          : {}),
      });
    });
  }
  return seeded;
}

export async function installSeededItinerary(page, items) {
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        const section = frame.response?.plan?.sections.find((s) => s.id === "itinerary");
        if (!section?.proposal) return line;
        section.proposal.items = [
          ...section.proposal.items.filter((item) => item.kind !== "activity"),
          ...items,
        ];
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body });
  });
}

/** Waits until no save is running and the number of saves has stopped changing. */
export async function waitForQuiet(page, stub) {
  let last = -1;
  for (let round = 0; round < 120; round += 1) {
    const busy = (await page.getByText("Saving place…").count()) > 0 || stub.inFlight > 0;
    if (!busy && stub.saves.length === last) return;
    last = busy ? -1 : stub.saves.length;
    await settle(page, 250);
  }
}
