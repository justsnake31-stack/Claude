#!/usr/bin/env node
// OCR regression test: loads the real app (index.html) in headless Chromium with an iPhone viewport,
// feeds every photo from tests/photos through the normal "Из галереи" input and compares the result
// with tests/truth.json.
//
//   node tests/run.cjs              all photos
//   node tests/run.cjs r04.jpg s4.jpg   only these
//   VERBOSE=1 node tests/run.cjs    also print the raw OCR text for misses
//
// Exit code 1 if fewer dates/names are right than tests/baseline.json says, or if a wrong expiry was
// accepted silently (the dangerous case: a date shown as real that is not on the label).
const { chromium, devices } = require("playwright");
const fs = require("fs"), path = require("path"), http = require("http");

const ROOT = path.resolve(__dirname, "..");
const truth = JSON.parse(fs.readFileSync(path.join(__dirname, "truth.json"), "utf8"));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "baseline.json"), "utf8"));
const only = process.argv.slice(2);
const files = Object.keys(truth).filter(f => !only.length || only.includes(f));
// The labels were photographed on this day; the app judges dates relative to "now", so freeze it.
const TODAY = new Date(baseline.today || "2026-11-02T12:00:00").getTime();

const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".html": "text/html",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg" };
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html";
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT)) { r.statusCode = 403; return r.end(); }
  fs.readFile(f, (e, b) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream"); r.end(b); });
}).listen(0);

(async () => {
  const port = srv.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.addInitScript(t => {
    const RealDate = Date, off = t - RealDate.now();
    class FakeDate extends RealDate { constructor(...a) { a.length ? super(...a) : super(RealDate.now() + off); } static now() { return RealDate.now() + off; } }
    window.Date = FakeDate;
  }, TODAY);
  // nothing from the internet: fonts and the Tesseract fallback are not needed for the main engine
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.fulfill({ status: 200, body: "" }));
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => /PaddleOCR|Tesseract|не загрузи/.test(document.getElementById("engineName")?.textContent || ""), null, { timeout: 180000 });
  const engine = await page.textContent("#engineName");

  const t0 = Date.now();
  await page.setInputFiles("#file", files.map(f => path.join(__dirname, "photos", f)));
  await page.waitForFunction(n => { try { return JSON.parse(localStorage.getItem("srok-results-v1") || "[]").length >= n; } catch (e) { return false; } }, files.length, { timeout: 60000 * files.length });
  const res = await page.evaluate(() => JSON.parse(localStorage.getItem("srok-results-v1")));
  const secs = (Date.now() - t0) / 1000;

  let dates = 0, names = 0, silentWrong = 0;
  const rows = [];
  for (const r of res) {
    const t = truth[r.src]; if (!t) continue;
    const okD = r.expires === t.expires, okN = r.name === t.name;
    const manual = !r.expires;                           // went to "впишите вручную" — safe
    const wrong = !okD && !manual;                       // a wrong date shown as real — dangerous
    dates += okD; names += okN; silentWrong += wrong;
    rows.push(`${okD ? "OK " : wrong ? "!!!" : "man"} ${okN ? "N" : "n"} ${r.src.padEnd(8)} ${(r.expires || "—").padEnd(16)} ${(r.name || "").slice(0, 32).padEnd(32)} | ждём ${t.expires} ${t.name}` +
      ((!okD || !okN) && process.env.VERBOSE ? `\n      ${r.note || ""}\n      ${r.raw || ""}` : ""));
  }
  rows.sort().forEach(l => console.log(l));
  console.log(`\nДвижок: ${engine}`);
  console.log(`Сроки: ${dates}/${files.length} (эталон ${baseline.dates})  ·  Названия: ${names}/${files.length} (эталон ${baseline.names})  ·  Ложных сроков: ${silentWrong}  ·  ${secs.toFixed(0)} с, ${(secs / files.length).toFixed(1)} с/фото`);
  if (errors.length) console.log("Ошибки страницы:", errors);
  await browser.close(); srv.close();

  const full = !only.length;
  const fail = silentWrong > 0 || errors.length > 0 || (full && (dates < baseline.dates || names < baseline.names));
  console.log(fail ? "РЕЗУЛЬТАТ: ХУЖЕ ЭТАЛОНА" : "РЕЗУЛЬТАТ: не хуже эталона");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); srv.close(); process.exit(2); });
