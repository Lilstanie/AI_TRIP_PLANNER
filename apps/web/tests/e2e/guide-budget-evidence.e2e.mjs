// requires-env: DEEPSEEK_BASE_URL, DEEPSEEK_API_KEY
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const stubUrl = new URL(process.env.DEEPSEEK_BASE_URL);
const out = resolve("output/e2e/guide-budget-evidence");
await mkdir(out, { recursive: true });

const evidence = [];
let specialistCalls = 0;
const stub = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}");
  const messages = body.messages ?? [];
  const content = messages.find((message) => message.role === "system")?.content ?? "";
  const system = Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content;
  const toolResult = messages.find((message) => message.role === "tool");
  if (String(system).includes("You are the destination specialist")) {
    specialistCalls += 1;
    if (!toolResult) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "stub",
          object: "chat.completion",
          created: 0,
          model: body.model,
          choices: [
            {
              index: 0,
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_evidence",
                    type: "function",
                    function: { name: "read_destination_evidence", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        }),
      );
      return;
    }
    evidence.push(JSON.parse(toolResult.content));
  }
  res.writeHead(400, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: { message: "stub refuses", type: "invalid_request_error" } }));
});
await new Promise((done) => stub.listen(Number(stubUrl.port), stubUrl.hostname, done));

const results = [];
const check = (condition, name) => {
  results.push({ name, passed: Boolean(condition) });
};
try {
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({
      tripId: "guide-budget-evidence",
      message: "Plan this trip.",
      mode: "plan",
      brief: {
        tripId: "guide-budget-evidence",
        userId: "demo-user",
        destination: "Sydney",
        dates: ["2026-11-11", "2026-11-14"],
        groupSize: 2,
        budgetTotal: 4000,
        budgetSource: { amount: 4000, currency: "AUD" },
        displayCurrency: "USD",
      },
      displayCurrency: "USD",
    }),
    signal: AbortSignal.timeout(240_000),
  });
  const frames = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const final = frames.at(-1);
  check(final.type === "complete", `chat completes (got ${JSON.stringify(final).slice(0, 300)})`);
  const guide = final.response?.plan.sections.find((section) => section.id === "destination-guide");
  check(
    guide?.proposal.source.kind === "fallback",
    "guide uses the local fallback after the stub refuses",
  );
  check(specialistCalls >= 2, `destination specialist reached the stub (${specialistCalls} calls)`);
  check(evidence.length >= 1, `stub received the evidence tool result (${evidence.length})`);
  const first = evidence[0] ?? {};
  check(first.brief && !("budgetTotal" in first.brief), "evidence brief holds no budgetTotal");
  check(first.brief && !("budgetSource" in first.brief), "evidence brief holds no budgetSource");
  check(first.brief?.destination === "Sydney", "evidence brief keeps the destination");
  check(first.brief?.dates?.join() === "2026-11-11,2026-11-14", "evidence brief keeps the dates");
  check(typeof first.travelMonth === "string", "evidence keeps the travel month");
  check(Array.isArray(first.places), "evidence keeps the place candidates");
} catch (error) {
  results.push({ name: "execution", passed: false, error: String(error) });
} finally {
  stub.close();
}
await writeFile(`${out}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(`${out}/summary.json`, `${JSON.stringify({ base, results }, null, 2)}\n`);
for (const result of results)
  console.log(
    `${result.passed ? "ok" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`,
  );
if (results.some((result) => !result.passed)) process.exitCode = 1;
