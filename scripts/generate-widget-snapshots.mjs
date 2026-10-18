import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";
import { WIDGET_CITIES } from "../src/data/cities.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = (process.env.SNAPSHOT_BASE_URL || "https://lzq1206.github.io/CosmosWhisper").replace(/\/+$/, "");
const OUTPUT_DIR = process.env.WIDGET_SNAPSHOT_OUTPUT || path.join(ROOT, "scriptwidget", "snapshot-stage");
const MANIFEST_URL = process.env.SNAPSHOT_MANIFEST_URL
  || "https://raw.githubusercontent.com/lzq1206/CosmosWhisper/widget-snapshots/manifest.json";
const CONCURRENCY = Math.max(1, Number(process.env.SNAPSHOT_CONCURRENCY || 10));
const SLOT_INTERVAL_MS = 15 * 60 * 1000;
const COVERAGE_HOURS = 12;
const VIEWPORT_SIZE = 512;
const DEVICE_SCALE_FACTOR = 2;
const IMAGE_SIZE = VIEWPORT_SIZE * DEVICE_SCALE_FACTOR;
// Extend the square webpage capture to the large iPhone widget ratio without
// stretching or cropping the circular chart.
const LARGE_WIDGET_ASPECT_RATIO = 0.94;
const LARGE_IMAGE_HEIGHT = Math.ceil(IMAGE_SIZE / LARGE_WIDGET_ASPECT_RATIO);
const LARGE_IMAGE_EXTRA_HEIGHT = LARGE_IMAGE_HEIGHT - IMAGE_SIZE;
const LARGE_IMAGE_TOP_EXTENSION = Math.floor(LARGE_IMAGE_EXTRA_HEIGHT / 2);
const LARGE_IMAGE_BOTTOM_EXTENSION = LARGE_IMAGE_EXTRA_HEIGHT - LARGE_IMAGE_TOP_EXTENSION;
const DELAY_AFTER_RENDER_MS = 5000;

const routes = [
  {
    kind: "visible-sky",
    url: (city, timestamp) => "/widgy/city.html?city=" + encodeURIComponent(city.id) + "&at=" + timestamp,
    canvas: "#sky-canvas",
    status: "#canvas-status",
  },
  {
    kind: "active-planisphere",
    url: (city, timestamp) => "/widgy/watch/?city=" + encodeURIComponent(city.id) + "&at=" + timestamp,
    canvas: "#watch-canvas",
    status: "#watch-status",
  },
];

function slotKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 16).replace(/[-:]/g, "") + "Z";
}

function snapshotPath(kind, cityId, key) {
  return kind + "/" + cityId + "/" + key + ".jpg";
}

async function readPreviousSnapshotPaths() {
  const response = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (response.status === 404) {
    console.log("No existing snapshot manifest; preparing the initial 12-hour image set.");
    return new Set();
  }
  if (!response.ok) {
    throw new Error("Could not read the existing snapshot manifest (" + response.status + ").");
  }
  const manifest = await response.json();
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.snapshots)) {
    throw new Error("The existing snapshot manifest has an unsupported format.");
  }
  return new Set(manifest.snapshots);
}

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

async function captureJob(browser, job, index, total, errors) {
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_SIZE, height: VIEWPORT_SIZE },
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: "dark",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const url = BASE_URL + job.route.url(job.city, job.timestamp);
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
    await page.waitForFunction((selector) => {
      const status = document.querySelector(selector);
      return status && status.textContent && !status.textContent.includes("加载中");
    }, job.route.status, { timeout: 45000 });
    await page.waitForTimeout(DELAY_AFTER_RENDER_MS);
    if (pageErrors.length) throw new Error(pageErrors.join("; "));

    const canvas = page.locator(job.route.canvas);
    const png = await canvas.screenshot({ type: "png", scale: "device", timeout: 15000 });
    const target = path.join(OUTPUT_DIR, job.route.kind, job.city.id, job.key + ".jpg");
    await mkdir(path.dirname(target), { recursive: true });
    await sharp(png)
      .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
      .extend({
        top: LARGE_IMAGE_TOP_EXTENSION,
        bottom: LARGE_IMAGE_BOTTOM_EXTENSION,
        left: 0,
        right: 0,
        background: "#030817",
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(target);

    if (index % 10 === 0 || index === total) {
      process.stdout.write("Captured " + index + " of " + total + " missing chart snapshots\n");
    }
  } catch (error) {
    errors.push(job.route.kind + "/" + job.city.id + "/" + job.key + ": " + error.message);
  } finally {
    await context.close();
  }
}

const now = Date.now();
const firstSlot = Math.floor(now / SLOT_INTERVAL_MS) * SLOT_INTERVAL_MS;
const lastSlot = Math.ceil(now / SLOT_INTERVAL_MS) * SLOT_INTERVAL_MS + COVERAGE_HOURS * 60 * 60 * 1000;
const slots = [];
for (let timestamp = firstSlot; timestamp <= lastSlot; timestamp += SLOT_INTERVAL_MS) {
  slots.push({ timestamp, key: slotKey(timestamp) });
}

const allSnapshotPaths = [];
const jobs = [];
for (const slot of slots) {
  for (const city of WIDGET_CITIES) {
    for (const route of routes) {
      const relativePath = snapshotPath(route.kind, city.id, slot.key);
      allSnapshotPaths.push(relativePath);
      jobs.push({ city, route, timestamp: slot.timestamp, key: slot.key, relativePath });
    }
  }
}

await mkdir(OUTPUT_DIR, { recursive: true });
const existingPaths = await readPreviousSnapshotPaths();
const missingJobs = jobs.filter((job) => !existingPaths.has(job.relativePath));
console.log(
  "Coverage: " + slots[0].key + " through " + slots[slots.length - 1].key
  + "; " + WIDGET_CITIES.length + " cities; " + jobs.length + " expected images; "
  + missingJobs.length + " missing images."
);

await waitForServer();
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  let nextJob = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const index = nextJob;
      nextJob += 1;
      if (index >= missingJobs.length) return;
      await captureJob(browser, missingJobs[index], index + 1, missingJobs.length, errors);
    }
  });
  await Promise.all(workers);
} finally {
  await browser.close();
}

if (errors.length) {
  throw new Error("Snapshot generation failed:\n" + errors.join("\n"));
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  coverage: {
    from: slots[0].key,
    through: slots[slots.length - 1].key,
    slotMinutes: 15,
    rollingHours: COVERAGE_HOURS,
  },
  cities: WIDGET_CITIES.map(({ id, name, lat, lon }) => ({ id, name, lat, lon })),
  snapshots: allSnapshotPaths,
};
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("Prepared " + missingJobs.length + " missing snapshots and the coverage manifest in " + OUTPUT_DIR);
