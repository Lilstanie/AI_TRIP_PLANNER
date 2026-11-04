import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../web/package.json", import.meta.url));
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "https://elec5620-ai-trip-planner.vercel.app";
const POLICY_FILE =
  process.env.LINK_POLICY ??
  fileURLToPath(new URL("../Resources/link-policy.json", import.meta.url));
const OUT = fileURLToPath(
  new URL(`../../../output/playwright/mac-sign-in/${process.env.LABEL ?? "run"}/`, import.meta.url),
);
mkdirSync(OUT, { recursive: true });

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) TripPlannerMacApp";
const policy = JSON.parse(readFileSync(POLICY_FILE, "utf8"));

const opensInApp = (raw) => {
  const url = new URL(raw);
  if (["about:", "blob:", "data:", "file:"].includes(url.protocol)) return true;
  if (url.protocol !== "https:") return false;
  if (policy.appHosts.includes(url.host)) return true;
  return (policy.signInPaths[url.host] ?? []).some((prefix) => url.pathname.startsWith(prefix));
};

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

async function openSignIn(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    userAgent: MAC_UA,
  });
  const page = await context.newPage();
  const external = [];
  await page.route("**/*", (route) => {
    const request = route.request();
    if (!request.isNavigationRequest() || request.frame() !== page.mainFrame())
      return route.continue();
    if (opensInApp(request.url())) return route.continue();
    const url = new URL(request.url());
    external.push(`${url.host}${url.pathname}`);
    return route.abort();
  });
  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
  return { context, page, external };
}

const where = (page) => {
  const url = new URL(page.url());
  return `${url.host}${url.pathname}`;
};

async function waitForText(page, pattern, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const text = await frame
        .locator("body")
        .innerText({ timeout: 1000 })
        .catch(() => "");
      if (pattern.test(text)) return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

const browser = await chromium.launch();
try {
  {
    const { context, page, external } = await openSignIn(browser);
    check(
      (await page.getByLabel("Email address").count()) > 0 &&
        (await page.getByRole("button", { name: "Continue", exact: true }).count()) > 0,
      "email and password sign-in is on the in-app sign-in page",
      where(page),
    );
    await page.screenshot({ path: `${OUT}/1-sign-in.png` });
    await page.getByRole("link", { name: "Sign up" }).click();
    await page.waitForURL(/\/sign-up/, { timeout: 15_000 }).catch(() => undefined);
    check(/\/sign-up$/.test(where(page)) && external.length === 0, "Sign up stays in the app", {
      at: where(page),
      external,
    });
    await context.close();
  }

  const providers = [
    { name: "Apple", host: "appleid.apple.com", text: /Apple\sAccount/ },
    { name: "GitHub", host: "github.com", text: /Sign\sin\sto\sGitHub/ },
  ];
  for (const provider of providers) {
    const { context, page, external } = await openSignIn(browser);
    await page.getByRole("button", { name: provider.name }).first().click();
    await page
      .waitForURL((url) => url.host === provider.host, { timeout: 20_000 })
      .catch(() => undefined);
    const shown = await waitForText(page, provider.text);
    check(
      new URL(page.url()).host === provider.host && shown && external.length === 0,
      `${provider.name} sign-in opens and stays in the app`,
      { at: where(page), external },
    );
    await page.screenshot({ path: `${OUT}/2-${provider.name}.png` });
    await context.close();
  }

  {
    const { context, page, external } = await openSignIn(browser);
    await page.getByRole("button", { name: "Google" }).first().click();
    await page.waitForTimeout(5000);
    check(
      external.some((step) => step.startsWith("accounts.google.com/")),
      "Google sign-in goes to the default browser, not the app's web view",
      external,
    );
    await context.close();
  }

  const ordinary = [
    "https://github.com/Lilstanie/AI_TRIP_PLANNER",
    "https://github.com/settings/profile",
    "https://appleid.apple.com/account/manage",
    "https://www.google.com/maps/dir/?api=1&destination=1,1",
  ];
  const leaks = ordinary.filter(opensInApp);
  check(
    leaks.length === 0,
    "ordinary GitHub, Apple and Google links still open in the browser",
    leaks,
  );
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/result.json`, `${JSON.stringify({ policy, results }, null, 2)}\n`);
const failed = results.filter((result) => !result.ok);
console.log(
  `${results.length - failed.length}/${results.length} checks passed; evidence in ${OUT}`,
);
process.exitCode = failed.length ? 1 : 0;
