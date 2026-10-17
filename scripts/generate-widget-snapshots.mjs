import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";
import { CITIES } from "../src/data/cities.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = (process.env.SNAPSHOT_BASE_URL || "https://lzq1206.github.io/CosmosWhisper").replace(/\/+$/, "");
const OUTPUT_DIR = process.env.WIDGET_SNAPSHOT_OUTPUT || path.join(ROOT, "scriptwidget", "snapshot-stage");
const CONCURRENCY = Math.max(1, Number(process.env.SNAPSHOT_CONCURRENCY || 8));
const IMAGE_SIZE = 512;
const DELAY_AFTER_RENDER_MS = 5000;
const selectedCityIds = process.env.SNAPSHOT_CITY_IDS
  ? new Set(process.env.SNAPSHOT_CITY_IDS.split(",").map((id) => id.trim()).filter(Boolean))
  : null;
const selectedCities = selectedCityIds ? CITIES.filter((city) => selectedCityIds.has(city.id)) : CITIES;

const routes = [
  { kind: "visible-sky", url: (city) => "/widgy/city.html?city=" + encodeURIComponent(city.id), canvas: "#sky-canvas", status: "#canvas-status" },
  { kind: "active-planisphere", url: (city) => "/widgy/watch/?city=" + encodeURIComponent(city.id), canvas: "#watch-canvas", status: "#watch-status" },
];
if (selectedCityIds && selectedCities.length !== selectedCityIds.size) {
  throw new Error("Unknown city id in SNAPSHOT_CITY_IDS.");
}
const jobs = selectedCities.flatMap((city) => routes.map((route) => ({ city, route })));
const errors = [];

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(BASE_URL + "/widgy/city.html");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The chart pages are unavailable at " + BASE_URL);
}

async function captureJob(browser, job, index) {
  const context = await browser.newContext({
    viewport: { width: IMAGE_SIZE, height: IMAGE_SIZE },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const url = BASE_URL + job.route.url(job.city);
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
    await page.waitForFunction((selector) => {
      const status = document.querySelector(selector);
      return status && status.textContent && !status.textContent.includes("加载中");
    }, job.route.status, { timeout: 45000 });
    await page.waitForTimeout(DELAY_AFTER_RENDER_MS);
    if (pageErrors.length) throw new Error(pageErrors.join("; "));

    const canvas = page.locator(job.route.canvas);
    const png = await canvas.screenshot({ type: "png", timeout: 15000 });
    const target = path.join(OUTPUT_DIR, job.route.kind, job.city.id + ".jpg");
    await mkdir(path.dirname(target), { recursive: true });
    await sharp(png)
      .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(target);

    if (index % 10 === 0 || index === jobs.length) {
      process.stdout.write("Captured " + index + " of " + jobs.length + " city chart images\n");
    }
  } catch (error) {
    errors.push(job.route.kind + "/" + job.city.id + ": " + error.message);
  } finally {
    await context.close();
  }
}

await mkdir(OUTPUT_DIR, { recursive: true });
await waitForServer();
const browser = await chromium.launch({ headless: true });
try {
  let nextJob = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const index = nextJob;
      nextJob += 1;
      if (index >= jobs.length) return;
      await captureJob(browser, jobs[index], index + 1);
    }
  });
  await Promise.all(workers);
} finally {
  await browser.close();
}

if (errors.length) {
  throw new Error("Snapshot generation failed:\n" + errors.join("\n"));
}
console.log("Saved " + jobs.length + " city chart images to " + OUTPUT_DIR);
