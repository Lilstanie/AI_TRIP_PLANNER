import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve("output/e2e/destination-conjunction", process.env.LABEL ?? "after");
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
async function chat(name, body) {
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({ tripId: name, ...body }),
  });
  const text = await response.text();
  writeFileSync(`${out}/${name}.ndjson`, text);
  assert.equal(response.ok, true);
  return text.trim().split("\n").map(JSON.parse).at(-1);
}
const message = (destination) =>
  `Plan a 3-day trip to ${destination} from 2026-12-01 to 2026-12-03 for 2 people, budget AUD 3000.`;
try {
  for (const destination of ["Trinidad and Tobago", "Sydney and Wollongong"]) {
    const frame = await chat(destination.replaceAll(" ", "-"), { message: message(destination) });
    assert.equal(frame.type, "ask_user", JSON.stringify(frame));
    assert.equal(frame.known.destination, destination);
    assert.deepEqual(frame.known.dates, ["2026-12-01", "2026-12-03"]);
    const question = frame.questions.find((question) => question.id === "destination-conjunction");
    assert.ok(question);
    results.push({ destination, clarified: true });
    const skipped = await chat("skipped-confirmation", {
      message: `${question.header}: no preference`,
      known: frame.known,
    });
    assert.equal(skipped.type, "ask_user");
    assert.equal(skipped.known.destination, destination);
    const single = await chat("confirmed-single", {
      message: `${question.header}: ${question.options[0].label}`,
      known: frame.known,
    });
    assert.equal(single.type, "complete");
    assert.equal(single.response.plan.brief.destination, destination);
    assert.equal(single.response.plan.brief.groupSize, 2);
    results.push({ destination, singleConfirmed: true });
    if (destination.startsWith("Sydney")) {
      const multiple = await chat("confirmed-multiple", {
        message: `${question.header}: ${question.options[1].label}`,
        known: frame.known,
      });
      assert.equal(multiple.type, "complete");
      assert.equal(multiple.response.plan.brief.destination, "Sydney & Wollongong");
      assert.ok(
        multiple.response.plan.sections
          .find((s) => s.id === "transport")
          .proposal.items.some((item) => item.location?.includes("Sydney → Wollongong")),
      );
      results.push({ multipleConfirmed: true });
    }
  }
  const explicit = await chat("explicit-cities", { message: message("Sydney & Wollongong") });
  assert.equal(explicit.type, "complete");
  assert.equal(explicit.response.plan.brief.destination, "Sydney & Wollongong");
  const revision = await chat("existing-plan-clarification", {
    message:
      "Plan a 4-day trip to Trinidad and Tobago from 2026-12-05 to 2026-12-08 for 3 people, budget AUD 4000.",
    brief: explicit.response.plan.brief,
    plan: explicit.response.plan,
  });
  assert.equal(revision.type, "ask_user");
  assert.deepEqual(revision.plan, explicit.response.plan);
  const revised = await chat("existing-plan-confirmed", {
    message: `${revision.questions[0].header}: ${revision.questions[0].options[0].label}`,
    known: revision.known,
    brief: revision.plan.brief,
    plan: revision.plan,
  });
  assert.equal(revised.type, "complete");
  assert.equal(revised.response.plan.brief.destination, "Trinidad and Tobago");
  assert.deepEqual(revised.response.plan.brief.dates, ["2026-12-05", "2026-12-08"]);
  assert.equal(revised.response.plan.brief.groupSize, 3);
  assert.equal(revised.response.plan.brief.budgetTotal, 4000);
  const chineseAsk = await chat("chinese-confirmation", {
    message: "请规划去Trinidad and Tobago，2026-12-01 到 2026-12-03，2人，预算3000澳元。",
    interfaceLanguage: "zh",
  });
  assert.equal(chineseAsk.type, "ask_user");
  assert.equal(chineseAsk.questions[0].header, "目的地");
  const chineseConfirmed = await chat("chinese-confirmed", {
    message: `${chineseAsk.questions[0].header}: ${chineseAsk.questions[0].options[0].label}`,
    known: chineseAsk.known,
    interfaceLanguage: "zh",
  });
  assert.equal(chineseConfirmed.type, "complete");
  assert.equal(chineseConfirmed.response.plan.brief.destination, "Trinidad and Tobago");
  const structured = await chat("structured-proper-name", {
    message: "Please plan it.",
    known: {
      destination: "Trinidad and Tobago",
      dates: ["2026-12-01", "2026-12-03"],
      groupSize: 2,
      budgetTotal: 3000,
    },
  });
  assert.equal(structured.type, "complete");
  assert.equal(structured.response.plan.brief.destination, "Trinidad and Tobago");
  const chinese = await chat("chinese-cities", {
    message: "请规划去悉尼、卧龙岗，2026-12-01 到 2026-12-03，2人，预算3000澳元。",
    interfaceLanguage: "zh",
  });
  assert.equal(chinese.type, "complete");
  assert.equal(chinese.response.plan.brief.destination, "悉尼 & 卧龙岗");
  results.push({ explicit: true, structured: true, chinese: true });
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
}
