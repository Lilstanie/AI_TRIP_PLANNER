import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const MMD = "/tmp/claude-0/mmd";
const req = createRequire(MMD + "/package.json");
const { marked } = req("marked");
const puppeteer = req("puppeteer");
const dir = path.dirname(new URL(import.meta.url).pathname);
const parts = fs
  .readdirSync(dir + "/parts")
  .filter((f) => f.endsWith(".md"))
  .sort();
let md = parts.map((f) => fs.readFileSync(dir + "/parts/" + f, "utf8")).join("\n\n");
fs.mkdirSync(dir + "/img/gen", { recursive: true });
let n = 0;
md = md.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
  n++;
  const base = `${dir}/img/gen/fig-${String(n).padStart(2, "0")}`;
  fs.writeFileSync(base + ".mmd", code);
  if (
    !fs.existsSync(base + ".svg") ||
    !fs.existsSync(base + ".mmd.done") ||
    fs.readFileSync(base + ".mmd.done", "utf8").toString() !== code
  ) {
    execFileSync(
      MMD + "/node_modules/.bin/mmdc",
      ["-p", MMD + "/pc.json", "-i", base + ".mmd", "-o", base + ".svg", "-b", "white"],
      { stdio: "inherit" },
    );
    fs.writeFileSync(base + ".mmd.done", code);
  }
  return `<div class="fig"><img src="img/gen/${path.basename(base)}.svg"></div>`;
});
md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="fig"><img alt="$1" src="$2"></div>');
const css = fs.readFileSync(dir + "/report.css", "utf8");
const html = `<!doctype html><html><head><meta charset="utf-8"><title>ELEC5620 Stage 1 Report</title><style>${css}</style></head><body>${marked.parse(md)}</body></html>`;
fs.writeFileSync(dir + "/report.html", html);
const b = await puppeteer.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const p = await b.newPage();
await p.goto("file://" + dir + "/report.html", { waitUntil: "networkidle0" });
const out = process.argv[2] || dir + "/../ELEC5620_Stage1_Report.pdf";
await p.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate:
    '<div style="font-size:8px;width:100%;text-align:center;color:#666">ELEC5620 Stage 1 · AI Trip Planner · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});
await b.close();
console.log("wrote", out, "figures", n);
