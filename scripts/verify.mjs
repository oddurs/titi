import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * The checks a test suite cannot make.
 *
 * `npm test` runs the engine, the store and the panel without a browser, which
 * is what keeps it fast. It cannot tell you whether the page hydrates, whether
 * anything spills off a phone screen, whether the service worker really works
 * with the network gone, or how long a keystroke takes to appear. Those need a
 * real browser and the real build, so they live here.
 *
 *   npm run verify
 *
 * Wants a build in ./out and Chrome on the machine. Screenshots land in
 * .verify/, which is not committed. Exits non-zero if anything fails, so it
 * can be trusted in a pipeline rather than read by eye.
 */

const ROOT = "out";
const SHOTS = ".verify";
const PORT = 4173;

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900, mobile: false },
  { tag: "phone", width: 390, height: 844, mobile: true },
];

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain",
  ".json": "application/json",
};

const results = [];
const check = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? "✓" : "✗"} ${name}${detail ? `  ${detail}` : ""}`);
};

if (!existsSync(ROOT)) {
  console.error(`No build in ./${ROOT} — run \`npm run build\` first.`);
  process.exit(2);
}
mkdirSync(SHOTS, { recursive: true });

/** Serve the static export the way a host would. */
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  let file = join(ROOT, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));
const origin = `http://localhost:${PORT}/`;

let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch {
  console.error("Could not launch Chrome. Install it, or run the tests only.");
  server.close();
  process.exit(2);
}

// -- it renders, at both sizes, without complaint ---------------------------

for (const v of VIEWPORTS) {
  console.log(`\n${v.tag} ${v.width}×${v.height}`);
  const page = await browser.newPage({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: 2,
    isMobile: v.mobile,
    hasTouch: v.mobile,
  });
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // Do something, so this covers hydration rather than just the markup.
  await page.getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "÷", exact: true }).click();
  await page.getByRole("button", { name: "8", exact: true }).click();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const spoken = (await page.locator("[aria-live]").first().textContent()) ?? "";
  check(`${v.tag}: the panel answers`, spoken.includes(".875"), spoken.trim().slice(-24));

  const painted = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return false;
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) lit++;
    return lit > 1000;
  });
  check(`${v.tag}: the glass is lit`, painted);

  const box = await page.evaluate(() => {
    const d = document.documentElement;
    return { sw: d.scrollWidth, cw: d.clientWidth, sh: d.scrollHeight, ch: d.clientHeight };
  });
  check(`${v.tag}: nothing spills sideways`, box.sw <= box.cw + 1, `${box.sw} ≤ ${box.cw}`);
  check(`${v.tag}: nor downwards`, box.sh <= box.ch + 1, `${box.sh} ≤ ${box.ch}`);
  check(`${v.tag}: no page errors`, errors.length === 0, errors[0] ?? "");
  check(`${v.tag}: nothing failed to load`, failed.length === 0, failed[0] ?? "");

  await page.screenshot({ path: `${SHOTS}/${v.tag}.png` });
  await page.close();
}

// -- the keypad is one tab stop, and the arrows move inside it --------------

console.log("\nkeyboard");
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const tabbable = await page.evaluate(
    () => [...document.querySelectorAll("button, [tabindex]")].filter((e) => e.tabIndex >= 0).length,
  );
  check("the keypad is a single tab stop", tabbable === 1, `${tabbable} tabbable`);

  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.getAttribute("data-key"));
  await page.keyboard.press("ArrowRight");
  const moved = await page.evaluate(() => document.activeElement?.getAttribute("data-key"));
  check("arrows move between keys", !!first && !!moved && first !== moved, `${first} → ${moved}`);

  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  const after = (await page.locator("[aria-live]").first().textContent()) ?? "";
  check("and enter presses one", after.trim().length > 0);
  await page.close();
}

// -- it works with the network gone -----------------------------------------

console.log("\noffline");
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  const worker = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r ? !!r.active : false;
  });
  check("a service worker is running", worker);

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    if (!names.length) return 0;
    const c = await caches.open(names[0]);
    return (await c.keys()).length;
  });
  check("it precached the build", cached > 5, `${cached} entries`);

  await context.setOffline(true);
  const second = await context.newPage();
  const offlineErrors = [];
  second.on("pageerror", (e) => offlineErrors.push(String(e)));
  await second.goto(origin, { waitUntil: "domcontentloaded" });
  await second.waitForTimeout(2000);
  const alive = await second.evaluate(() => ({
    canvas: !!document.querySelector("canvas"),
    keys: document.querySelectorAll("button.key").length,
  }));
  check("it opens with the network gone", alive.canvas && alive.keys > 40, `${alive.keys} keys`);
  check("and without errors", offlineErrors.length === 0, offlineErrors[0] ?? "");
  await second.screenshot({ path: `${SHOTS}/offline.png` });
  await context.close();
}

// -- what it costs -----------------------------------------------------------

console.log("\nweight and speed");
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const size = await page.evaluate(() => {
    let decoded = 0;
    for (const e of performance.getEntriesByType("resource")) decoded += e.decodedBodySize;
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByType("paint")
      .find((p) => p.name === "first-contentful-paint")?.startTime ?? 0;
    return { kb: Math.round(decoded / 1024), fcp: Math.round(fcp), interactive: Math.round(nav.domInteractive) };
  });
  // Served from localhost without compression, so this is the decoded size —
  // a host will gzip it to roughly a third.
  check("the build stays under a megabyte decoded", size.kb < 1024, `${size.kb}KB`);
  check("and paints quickly", size.fcp < 2000, `first paint ${size.fcp}ms, interactive ${size.interactive}ms`);

  const frames = await page.evaluate(async () => {
    const key = [...document.querySelectorAll("button.key")]
      .find((b) => b.getAttribute("aria-label") === "7");
    const times = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      key.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      times.push(performance.now() - t0);
    }
    return times.sort((a, b) => a - b);
  });
  const median = frames[Math.floor(frames.length / 2)];
  check("a keystroke shows within two frames", median < 34, `median ${median.toFixed(1)}ms`);
  await page.close();
}

await browser.close();
server.close();

const failedCount = results.filter((r) => !r.passed).length;
console.log(
  `\n${results.length - failedCount} passed, ${failedCount} failed  —  screenshots in ${SHOTS}/`,
);
process.exit(failedCount ? 1 : 0);
