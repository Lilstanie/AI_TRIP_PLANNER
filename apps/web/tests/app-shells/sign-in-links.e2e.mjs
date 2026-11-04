import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "https://elec5620-ai-trip-planner.vercel.app";
const repo = (path) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const OUT = repo(`output/playwright/app-sign-in/${process.env.LABEL ?? "run"}/`);
mkdirSync(OUT, { recursive: true });
const readJson = (path) => JSON.parse(readFileSync(repo(path), "utf8"));
const withoutSignInPaths = process.env.RULES === "app-hosts-only";

const mac = readJson("apps/macos/Resources/link-policy.json");
const ios = readJson("apps/ios/capacitor.config.json");
const SHELLS = [
  {
    name: "mac",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) TripPlannerMacApp",
    viewport: { width: 1280, height: 820 },
    appHosts: mac.appHosts,
    signInPaths: mac.signInPaths,
  },
  {
    name: "ios",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TripPlannerIOSApp",
    viewport: { width: 390, height: 844 },
    appHosts: [new URL(ios.server.url).host, ...(ios.server.allowNavigation ?? [])],
    signInPaths: ios.plugins?.TripLinks?.signInPaths ?? {},
  },
].filter((shell) => !process.env.SHELL_NAME || shell.name === process.env.SHELL_NAME);

const rulesFor = (shell) => (raw) => {
  const url = new URL(raw);
  if (["about:", "blob:", "data:", "file:"].includes(url.protocol)) return true;
  if (url.protocol !== "https:") return false;
  if (shell.appHosts.includes(url.host)) return true;
  const paths = withoutSignInPaths ? {} : shell.signInPaths;
  return (paths[url.host] ?? []).some((prefix) => url.pathname.startsWith(prefix));
};

const results = [];
let current = "";
const check = (ok, name, observed) => {
  name = `${current}: ${name}`;
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

async function openSignIn(browser, shell, opensInApp) {
  const context = await browser.newContext({
    viewport: shell.viewport,
    userAgent: shell.userAgent,
    isMobile: shell.name === "ios",
    hasTouch: shell.name === "ios",
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

const source = (path) => readFileSync(repo(path), "utf8");
current = "wiring";
check(
  source("apps/macos/Sources/TripPlannerMac/LinkPolicy.swift").includes(
    'forResource: "link-policy", withExtension: "json"',
  ) && source("apps/macos/scripts/build-app.sh").includes("Resources/link-policy.json"),
  "the Mac app bundles and reads the link-policy.json this test reads",
);
check(
  /jsName = "TripLinks"/.test(source("apps/ios/ios/App/App/TripShell.swift")) &&
    /getObject\("signInPaths"\)/.test(source("apps/ios/ios/App/App/TripShell.swift")) &&
    /registerPluginInstance\(links\)/.test(source("apps/ios/ios/App/App/TripShell.swift")),
  "the iOS app registers TripLinks and reads plugins.TripLinks.signInPaths, which this test reads",
);

const browser = await chromium.launch();
try {
  for (const shell of SHELLS) {
    const opensInApp = rulesFor(shell);
    current = shell.name;
    {
      const { context, page, external } = await openSignIn(browser, shell, opensInApp);
      check(
        (await page.getByLabel("Email address").count()) > 0 &&
          (await page.getByRole("button", { name: "Continue", exact: true }).count()) > 0,
        "email and password sign-in is on the in-app sign-in page",
        where(page),
      );
      await page.screenshot({ path: `${OUT}/${shell.name}-1-sign-in.png` });
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
      const { context, page, external } = await openSignIn(browser, shell, opensInApp);
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
      await page.screenshot({ path: `${OUT}/${shell.name}-2-${provider.name}.png` });
      await context.close();
    }

    {
      const { context, page, external } = await openSignIn(browser, shell, opensInApp);
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
  }
} finally {
  await browser.close();
}

writeFileSync(
  `${OUT}/result.json`,
  `${JSON.stringify({ rules: withoutSignInPaths ? "app-hosts-only" : "repository", shells: SHELLS, results }, null, 2)}\n`,
);
const failed = results.filter((result) => !result.ok);
console.log(
  `${results.length - failed.length}/${results.length} checks passed; evidence in ${OUT}`,
);
process.exitCode = failed.length ? 1 : 0;
