import http from "node:http";

const WAIT = 5_000;

const deferred = () => {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

export function controlledProxy(BASE, within, WAIT = 5_000) {
  const requests = [];
  const history = [];
  let journey = 1;
  const waiters = new Set();
  const openResponses = new Set();
  const notify = () => {
    for (const waiter of waiters) {
      if (requests.length < waiter.count) continue;
      waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
  };
  const waitForCount = (count, timeout = WAIT) => {
    if (requests.length >= count) return Promise.resolve();
    return new Promise((resolvePromise, reject) => {
      const waiter = {
        count,
        resolve: resolvePromise,
        timer: setTimeout(() => {
          waiters.delete(waiter);
          reject(new Error(`chat request ${count} was not received within ${timeout}ms`));
        }, timeout),
      };
      waiters.add(waiter);
    });
  };
  const forward = (request, response) =>
    new Promise((resolvePromise, reject) => {
      const upstream = http.request(
        {
          protocol: BASE.protocol,
          hostname: BASE.hostname,
          port: BASE.port,
          method: request.method,
          path: request.url,
          headers: { ...request.headers, host: BASE.host },
        },
        (upstreamResponse) => {
          response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
          upstreamResponse.pipe(response);
          upstreamResponse.on("end", resolvePromise);
          upstreamResponse.on("error", reject);
        },
      );
      upstream.on("error", reject);
      request.pipe(upstream);
    });

  const server = http.createServer(async (request, response) => {
    if (request.url !== "/api/chat" || request.method !== "POST") {
      try {
        await forward(request, response);
      } catch (error) {
        if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" });
        response.end(`Proxy failure: ${String(error)}`);
      }
      return;
    }

    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    await within(
      new Promise((resolvePromise, reject) => {
        request.on("end", resolvePromise);
        request.on("error", reject);
      }),
      "chat request body",
    );
    const index = requests.length + 1;
    const settled = deferred();
    const entry = {
      index,
      journey,
      body: JSON.parse(body),
      aborted: false,
      completed: false,
      failed: false,
      progress: [],
      settled: settled.promise,
      release(value, reply) {
        if (entry.aborted) {
          entry.lateReleaseAttempted = true;
          response.end(
            `${JSON.stringify({ type: "complete", response: { reply, plan: value } })}\n`,
          );
          return;
        }
        if (entry.completed || entry.failed) return;
        entry.completed = true;
        response.write(
          `${JSON.stringify({
            type: "coordinator",
            phase: "dispatch",
            round: 1,
            summary: "Controlled progress two",
          })}\n`,
        );
        response.end(`${JSON.stringify({ type: "complete", response: { reply, plan: value } })}\n`);
        settled.resolve();
      },
      releaseNeedsInfo(question, known = {}) {
        if (entry.aborted) {
          entry.lateReleaseAttempted = true;
          response.end(`${JSON.stringify({ type: "needs_info", question, known })}\n`);
          return;
        }
        if (entry.completed || entry.failed) return;
        entry.completed = true;
        response.write(
          `${JSON.stringify({
            type: "coordinator",
            phase: "dispatch",
            round: 1,
            summary: "Controlled progress two",
          })}\n`,
        );
        response.end(`${JSON.stringify({ type: "needs_info", question, known })}\n`);
        settled.resolve();
      },
      fail(message) {
        if (entry.completed || entry.failed || entry.aborted) return;
        entry.failed = true;
        response.end(`${JSON.stringify({ type: "error", error: message })}\n`);
        settled.resolve();
      },
    };
    requests.push(entry);
    history.push(entry);
    openResponses.add(response);
    response.on("close", () => {
      openResponses.delete(response);
      if (!entry.completed && !entry.failed) {
        entry.aborted = true;
        settled.resolve();
      }
    });
    response.writeHead(200, {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    });
    const progress = {
      type: "agent_started",
      agent: "itinerary",
      round: 1,
      summary: "Controlled progress one",
    };
    entry.progress.push(progress);
    response.write(`${JSON.stringify(progress)}\n`);
    const partial = {
      type: "agent_reasoning",
      agent: "itinerary",
      round: 1,
      episode: 0,
      index: 0,
      text: "Controlled partial reasoning",
    };
    entry.progress.push(partial);
    response.write(`${JSON.stringify(partial)}\n`);
    notify();
  });

  server.on("upgrade", (_request, socket) => socket.destroy());
  return {
    requests,
    history,
    waitForCount,
    async listen() {
      await within(
        new Promise((resolvePromise, reject) => {
          server.once("error", reject);
          server.listen(0, "127.0.0.1", resolvePromise);
        }),
        "proxy listen",
      );
      const address = server.address();
      return `http://127.0.0.1:${address.port}`;
    },
    async close() {
      for (const response of openResponses) response.destroy();
      server.closeAllConnections?.();
      await within(
        new Promise((resolvePromise) => server.close(resolvePromise)),
        "proxy close",
      ).catch(() => {});
    },
    reset() {
      requests.length = 0;
      journey += 1;
    },
  };
}

export const stop = (id, day, startTime) => ({
  id,
  kind: "activity",
  day,
  startTime,
  endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
  location: id,
  detail: id,
});

export const plan = ({ id, destination, items }) => ({
  tripId: id,
  brief: {
    tripId: id,
    userId: "local",
    destination,
    dates: ["2031-03-10", "2031-03-12"],
    groupSize: 2,
    budgetTotal: 3000,
  },
  round: 1,
  budgetTotal: 3000,
  estTotal: 100,
  overrunPct: -96.67,
  editVersion: 0,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: `${destination} visit`,
      estCost: 100,
      proposal: {
        agent: "itinerary",
        summary: `${destination} visit`,
        items,
        assumptions: [],
        conflictsWith: [],
      },
    },
  ],
});

const draft = ({ destination }) => ({
  destination,
  origin: "",
  start: "2031-03-10",
  end: "2031-03-12",
  groupSize: "2",
  budgetTotal: "3000",
  preferences: [],
  nationality: "",
  roomAllocation: "shared",
  minRating: "0",
  freeCancellation: false,
});

const snapshot = ({ id, destination, items, marker }) => ({
  version: 4,
  id,
  savedAt: "2026-10-20T00:00:00.000Z",
  plan: plan({ id, destination, items }),
  draft: draft({ destination }),
  messages: marker ? [{ role: "user", text: marker }] : [],
  input: "",
});

const chat = ({ id, title, tripId, destination, items, marker }) => ({
  id: `conversation:${id}`,
  title,
  renamed: true,
  updatedAt: "2026-10-20T00:00:00.000Z",
  tripId: `trip:${tripId}`,
  messages: marker ? [{ role: "user", text: marker }] : [],
  input: "",
  snapshot: snapshot({ id: tripId, destination, items, marker }),
});

const trip = ({ id, title, destination, items, conversationIds }) => ({
  id: `trip:${id}`,
  title,
  renamed: true,
  updatedAt: "2026-10-20T00:00:00.000Z",
  conversationIds: conversationIds.map((value) => `conversation:${value}`),
  snapshot: snapshot({ id, destination, items }),
});

const alphaItems = [stop("alpha-base", 1, "09:00")];
const gammaItems = [stop("gamma-base", 1, "10:00")];
export const catalog = {
  version: 5,
  activeConversationId: "conversation:alpha",
  activeTripId: "trip:alpha",
  conversations: [
    chat({
      id: "alpha",
      title: "Alpha",
      tripId: "alpha",
      destination: "Alpha",
      items: alphaItems,
      marker: "Alpha marker",
    }),
    chat({
      id: "beta",
      title: "Beta",
      tripId: "alpha",
      destination: "Alpha",
      items: alphaItems,
      marker: "Beta marker",
    }),
    chat({
      id: "rival",
      title: "Rival",
      tripId: "alpha",
      destination: "Alpha",
      items: alphaItems,
    }),
    chat({
      id: "gamma",
      title: "Gamma",
      tripId: "gamma",
      destination: "Gamma",
      items: gammaItems,
      marker: "Gamma marker",
    }),
  ],
  trips: [
    trip({
      id: "alpha",
      title: "Alpha trip",
      destination: "Alpha",
      items: alphaItems,
      conversationIds: ["alpha", "beta", "rival"],
    }),
    trip({
      id: "gamma",
      title: "Gamma trip",
      destination: "Gamma",
      items: gammaItems,
      conversationIds: ["gamma"],
    }),
  ],
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "timeline",
  },
};

export const completedPlan = plan({
  id: "alpha",
  destination: "Alpha",
  items: [stop("generated-alpha", 1, "13:00")],
});
export const completedGammaPlan = plan({
  id: "gamma",
  destination: "Gamma",
  items: [stop("generated-gamma", 1, "15:00")],
});

export const settings = {
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "light",
  language: "en",
  displayCurrency: "AUD",
  updatedAt: "2026-10-05T00:00:00Z",
};
