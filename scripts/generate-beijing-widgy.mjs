import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { CONSTELLATIONS } from "../src/data/constellations.js";
import { MILKY_WAY_RINGS } from "../src/data/milkyWay.js";
import { planetaryBodies, equatorialToHorizontal, solarAltitude, clamp, DEG, TAU } from "../src/astro.js";
import { STARS } from "../src/data/stars.js";

const OUTPUT_DIR = new URL("../widgy/", import.meta.url);
const DATE = process.env.WIDGY_DATE ? new Date(process.env.WIDGY_DATE) : new Date();
const LOCATION = { lat: 39.9042, lon: 116.4074, name: "北京" };
const SIZE = 1600;
const CENTER = SIZE / 2;
const SKY_RADIUS = 570;
const TIME_RADIUS = 640;
const TIME_OUTER = 690;
const DEGREE = Math.PI / 180;

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

function project(horizontal, unclipped = false) {
  if (!unclipped && horizontal.altitude < -0.7) return null;
  const altitude = unclipped ? clamp(horizontal.altitude, -90, 90) : clamp(horizontal.altitude, 0, 90);
  const radius = SKY_RADIUS * (1 - altitude / 90);
  const angle = horizontal.azimuth * DEGREE;
  return {
    x: CENTER + radius * Math.sin(angle),
    y: CENTER - radius * Math.cos(angle),
  };
}

function projectEquatorial(ra, dec, unclipped = false) {
  return project(equatorialToHorizontal(ra, dec, DATE, LOCATION.lat, LOCATION.lon), unclipped);
}

function beijingClockFraction(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hour + minute / 60) / 24;
}

function pathData(points, projectPoint, close = false) {
  let data = "";
  let started = false;
  for (const point of points) {
    const projected = projectPoint(point[0], point[1]);
    if (!projected) {
      started = false;
      continue;
    }
    data += `${started ? "L" : "M"}${projected.x.toFixed(2)},${projected.y.toFixed(2)} `;
    started = true;
  }
  return close && started ? `${data}Z` : data;
}

function toneColor(tone) {
  return tone === "warm" ? "#ffd596" : tone === "blue" ? "#c9dcff" : "#f2f0e7";
}

function fixedSkyTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(DATE);
}

const stars = STARS.flatMap((star) => {
  const horizontal = equatorialToHorizontal(star.ra, star.dec, DATE, LOCATION.lat, LOCATION.lon);
  const point = project(horizontal);
  if (!point) return [];
  const radius = clamp(1.15 + (3.6 - star.magnitude) * 0.72, 1.1, 5.2);
  const label = star.magnitude <= 1.1
    ? `<text x="${(point.x + radius + 5).toFixed(1)}" y="${(point.y - radius - 3).toFixed(1)}" class="star-label">${escapeXml(star.name)}</text>`
    : "";
  return [`<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${toneColor(star.tone)}" opacity="${Math.max(0.42, 1.02 - star.magnitude / 7).toFixed(2)}"/>${label}`];
}).join("");

const constellationLines = CONSTELLATIONS.flatMap((constellation) => constellation.lines.map((line) => {
  const data = pathData(line, (ra, dec) => projectEquatorial(ra, dec));
  return data ? `<path d="${data}" class="constellation-line"/>` : "";
})).join("");

const constellationBoundaries = CONSTELLATIONS.flatMap((constellation) => constellation.boundaryParts.map((boundary) => {
  const data = pathData(boundary, (ra, dec) => projectEquatorial(ra, dec));
  return data ? `<path d="${data}" class="boundary-line"/>` : "";
})).join("");

const galaxyPath = MILKY_WAY_RINGS.map((ring) => pathData(ring, (ra, dec) => projectEquatorial(ra, dec, true), true)).join("");
const bodies = planetaryBodies(DATE, LOCATION.lat, LOCATION.lon).flatMap((body) => {
  const point = project(body.horizontal);
  if (!point) return [];
  const radius = body.size * 1.35;
  return [`<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${body.color}" class="body-dot"/><text x="${(point.x + radius + 5).toFixed(1)}" y="${(point.y - radius - 3).toFixed(1)}" class="body-label">${escapeXml(body.name)}</text>`];
}).join("");

const ticks = Array.from({ length: 96 }, (_, index) => {
  const fraction = index / 96;
  const angle = -Math.PI / 2 + fraction * TAU;
  const length = index % 4 === 0 ? 15 : index % 2 === 0 ? 9 : 5;
  const inner = TIME_OUTER - length;
  const x1 = CENTER + Math.cos(angle) * inner;
  const y1 = CENTER + Math.sin(angle) * inner;
  const x2 = CENTER + Math.cos(angle) * TIME_OUTER;
  const y2 = CENTER + Math.sin(angle) * TIME_OUTER;
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="time-tick"/>`;
}).join("");
const localTimeFraction = beijingClockFraction(DATE);
const pointerAngle = -Math.PI / 2 + localTimeFraction * TAU;
const pointer = `<line x1="${(CENTER + Math.cos(pointerAngle) * (TIME_RADIUS - 7)).toFixed(1)}" y1="${(CENTER + Math.sin(pointerAngle) * (TIME_RADIUS - 7)).toFixed(1)}" x2="${(CENTER + Math.cos(pointerAngle) * (TIME_OUTER + 10)).toFixed(1)}" y2="${(CENTER + Math.sin(pointerAngle) * (TIME_OUTER + 10)).toFixed(1)}" class="time-pointer"/>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <style>
    .star-label{font:18px "Noto Sans CJK SC","Noto Sans CJK TC",-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:#f0eee5;opacity:.8}.body-label{font:20px "Noto Sans CJK SC","Noto Sans CJK TC",-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:#f6d890}.body-dot{stroke:#06102a;stroke-width:3}.constellation-line{fill:none;stroke:#78c7d4;stroke-width:1.6;stroke-dasharray:5 7;opacity:.62}.boundary-line{fill:none;stroke:#d89b9e;stroke-width:1;stroke-dasharray:4 8;opacity:.32}.time-tick{stroke:#d9dfee;stroke-width:2;opacity:.7}.time-pointer{stroke:#f2c36c;stroke-width:5}.sky-label{font:24px "Noto Sans CJK SC","Noto Sans CJK TC",-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:#f0eee5;letter-spacing:3px}.meta-label{font:16px "Noto Sans CJK SC","Noto Sans CJK TC",-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:#9da9c2;letter-spacing:2px}
  </style>
  <rect width="${SIZE}" height="${SIZE}" fill="#030817"/>
  <circle cx="${CENTER}" cy="${CENTER}" r="${SKY_RADIUS}" fill="#07142e"/>
  <clipPath id="skyClip"><circle cx="${CENTER}" cy="${CENTER}" r="${SKY_RADIUS}"/></clipPath>
  <g clip-path="url(#skyClip)">
    <path d="${galaxyPath}" fill="#ffffff" opacity=".13" fill-rule="evenodd"/>
    ${constellationBoundaries}
    ${constellationLines}
    ${stars}
    ${bodies}
  </g>
  <circle cx="${CENTER}" cy="${CENTER}" r="${SKY_RADIUS}" fill="none" stroke="#dce2f1" stroke-width="2" opacity=".75"/>
  <circle cx="${CENTER}" cy="${CENTER}" r="${TIME_RADIUS}" fill="none" stroke="#172c52" stroke-width="18"/>
  <circle cx="${CENTER}" cy="${CENTER}" r="${TIME_RADIUS}" fill="none" stroke="#a4b2ca" stroke-width="2" opacity=".7"/>
  ${ticks}
  ${pointer}
  <text x="${CENTER}" y="${CENTER - TIME_OUTER - 25}" text-anchor="middle" class="sky-label">北京星图</text>
  <text x="${CENTER}" y="${CENTER + TIME_OUTER + 38}" text-anchor="middle" class="meta-label">北京 · ${escapeXml(fixedSkyTime())} · 北纬 39.9° 东经 116.4°</text>
</svg>
`;

const widgyOutput = new URL("../widgy/cosmoswhisper-beijing.widgy.json", import.meta.url);
const widgy = JSON.parse(await readFile(widgyOutput, "utf8"));
widgy["3"] = "CosmosWhisper · 北京";
widgy["5"] = "CosmosWhisper";
widgy["4"] = "北京本地天空星图 · 静态快照";
const webLayer = (widgy["1"] ?? []).find((layer) => layer["1"] === "Web URL");
if (!webLayer) throw new Error("The Widgy template has no Web URL layer.");
webLayer["2"] = "https://lzq1206.github.io/CosmosWhisper/widgy/beijing-sky.png";

const generatedAt = new Date().toISOString();
const imageUrl = `https://lzq1206.github.io/CosmosWhisper/widgy/beijing-sky.png?v=${encodeURIComponent(generatedAt)}`;
const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>CosmosWhisper · 北京星图</title>
    <link>https://lzq1206.github.io/CosmosWhisper/widgy/beijing.html</link>
    <description>北京本地天空星图 PNG 快照</description>
    <lastBuildDate>${new Date(generatedAt).toUTCString()}</lastBuildDate>
    <ttl>15</ttl>
    <image>
      <url>${imageUrl}</url>
      <title>CosmosWhisper · 北京</title>
      <link>https://lzq1206.github.io/CosmosWhisper/widgy/beijing.html</link>
    </image>
    <item>
      <title>北京天空 · ${escapeXml(fixedSkyTime())}</title>
      <guid isPermaLink="false">cosmoswhisper-beijing-${generatedAt}</guid>
      <pubDate>${new Date(generatedAt).toUTCString()}</pubDate>
      <description><![CDATA[北京星图，生成时间：${escapeXml(fixedSkyTime())}（UTC+8）]]></description>
      <enclosure url="${imageUrl}" type="image/png" length="${imageBuffer.length}"/>
      <media:content url="${imageUrl}" medium="image" type="image/png" width="1600" height="1600"/>
    </item>
  </channel>
</rss>
`;

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(new URL("beijing-sky.svg", OUTPUT_DIR), svg);
await writeFile(new URL("beijing-sky.png", OUTPUT_DIR), imageBuffer);
await writeFile(new URL("beijing.xml", OUTPUT_DIR), rss);
await writeFile(widgyOutput, `${JSON.stringify(widgy, null, 2)}\n`);
console.log(`Generated Beijing Widgy PNG/RSS snapshot for ${DATE.toISOString()}.`);
