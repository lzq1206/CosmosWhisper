import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SkyRenderer } from "../src/renderer.js";
import { planetaryBodies, solarAltitude } from "../src/astro.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = path.join(ROOT, "scriptwidget", "projects");
const EXPORTS = path.join(ROOT, "scriptwidget", "exports");
const SIZE = 1200;
const TAU = Math.PI * 2;
const SHANGHAI = { id: "shanghai", name: "上海", lat: 31.2304, lon: 121.4737 };
const DATE = new Date();

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const formatNumber = (value) => {
  if (Math.abs(value) < 0.0005) return "0";
  return Number(value.toFixed(3)).toString();
};

function transformedPoint(matrix, x, y) {
  const [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}

function multiplyMatrix(first, second) {
  const [a, b, c, d, e, f] = first;
  const [g, h, i, j, k, l] = second;
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
}

function parseColor(value, alpha = 1) {
  if (typeof value !== "string") return { color: "none", opacity: alpha };
  const color = value.trim();
  if (!color || color === "transparent" || color === "clear") return { color: "none", opacity: 0 };
  const rgba = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    return {
      color: `rgb(${rgba[1]},${rgba[2]},${rgba[3]})`,
      opacity: Math.max(0, Math.min(1, Number(rgba[4] ?? 1) * alpha)),
    };
  }
  return { color, opacity: Math.max(0, Math.min(1, alpha)) };
}

class SvgGradient {
  constructor(id, coordinates) {
    this.id = id;
    this.coordinates = coordinates;
    this.stops = [];
  }

  addColorStop(offset, color) {
    this.stops.push({ offset: Math.max(0, Math.min(1, Number(offset))), color });
  }
}

class SvgCanvas2D {
  constructor(width, height, { omitPoleLabel = false } = {}) {
    this.width = width;
    this.height = height;
    this.omitPoleLabel = omitPoleLabel;
    this.path = [];
    this.hasCurrentSubpath = false;
    this.stack = [];
    this.groups = 0;
    this.body = [];
    this.definitions = [];
    this.gradientCount = 0;
    this.clipCount = 0;
    this.matrix = [1, 0, 0, 1, 0, 0];
    this.state = {
      fillStyle: "#000000",
      strokeStyle: "#000000",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      lineDash: [],
      font: "10px sans-serif",
      textAlign: "start",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      shadowBlur: 0,
      shadowColor: "transparent",
    };
    for (const property of Object.keys(this.state)) {
      Object.defineProperty(this, property, {
        get: () => this.state[property],
        set: (value) => { this.state[property] = value; },
      });
    }
  }

  setTransform(a, b, c, d, e, f) {
    this.matrix = [a, b, c, d, e, f];
  }

  translate(x, y) {
    this.matrix = multiplyMatrix(this.matrix, [1, 0, 0, 1, x, y]);
  }

  rotate(angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    this.matrix = multiplyMatrix(this.matrix, [cosine, sine, -sine, cosine, 0, 0]);
  }

  save() {
    this.stack.push({ ...this.state, matrix: [...this.matrix], groups: this.groups });
  }

  restore() {
    const previous = this.stack.pop();
    if (!previous) return;
    while (this.groups > previous.groups) {
      this.body.push("</g>");
      this.groups -= 1;
    }
    const { matrix, groups, ...state } = previous;
    this.state = state;
    this.matrix = matrix;
  }

  beginPath() {
    this.path = [];
    this.hasCurrentSubpath = false;
  }

  moveTo(x, y) {
    const point = transformedPoint(this.matrix, x, y);
    this.path.push(`M${formatNumber(point[0])},${formatNumber(point[1])}`);
    this.hasCurrentSubpath = true;
  }

  lineTo(x, y) {
    const point = transformedPoint(this.matrix, x, y);
    this.path.push(`${this.hasCurrentSubpath ? "L" : "M"}${formatNumber(point[0])},${formatNumber(point[1])}`);
    this.hasCurrentSubpath = true;
  }

  closePath() {
    this.path.push("Z");
    this.hasCurrentSubpath = false;
  }

  appendEllipse(cx, cy, rx, ry, rotation, startAngle, endAngle, anticlockwise = false) {
    let delta = endAngle - startAngle;
    if (anticlockwise) {
      while (delta > 0) delta -= TAU;
      if (delta < -TAU) delta = -TAU;
    } else {
      while (delta < 0) delta += TAU;
      if (delta > TAU) delta = TAU;
    }
    if (Math.abs(delta) < 1e-12) return;
    const radius = Math.max(Math.abs(rx), Math.abs(ry));
    const stepsPerRadian = Math.max(2, Math.min(80, Math.sqrt(radius) * 3.2));
    const steps = Math.max(1, Math.ceil(Math.abs(delta) * stepsPerRadian));
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);
    for (let index = 0; index <= steps; index += 1) {
      const angle = startAngle + delta * index / steps;
      const localX = cx + rx * Math.cos(angle) * cosRotation - ry * Math.sin(angle) * sinRotation;
      const localY = cy + rx * Math.cos(angle) * sinRotation + ry * Math.sin(angle) * cosRotation;
      const point = transformedPoint(this.matrix, localX, localY);
      const command = (index === 0 && !this.hasCurrentSubpath) ? "M" : "L";
      this.path.push(`${command}${formatNumber(point[0])},${formatNumber(point[1])}`);
      this.hasCurrentSubpath = true;
    }
  }

  arc(cx, cy, radius, startAngle, endAngle, anticlockwise = false) {
    this.appendEllipse(cx, cy, radius, radius, 0, startAngle, endAngle, anticlockwise);
  }

  ellipse(cx, cy, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise = false) {
    this.appendEllipse(cx, cy, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise);
  }

  fill() {
    if (!this.path.length) return;
    const fill = this.state.fillStyle;
    const isGradient = fill instanceof SvgGradient;
    const parsed = isGradient ? { color: `url(#${fill.id})`, opacity: this.state.globalAlpha } : parseColor(fill, this.state.globalAlpha);
    this.body.push(`<path d="${this.path.join("")}" fill="${escapeXml(parsed.color)}" fill-opacity="${formatNumber(parsed.opacity)}"/>`);
  }

  stroke() {
    if (!this.path.length) return;
    const parsed = parseColor(this.state.strokeStyle, this.state.globalAlpha);
    const dash = this.state.lineDash.length ? ` stroke-dasharray="${this.state.lineDash.map(formatNumber).join(" ")}"` : "";
    this.body.push(`<path d="${this.path.join("")}" fill="none" stroke="${escapeXml(parsed.color)}" stroke-opacity="${formatNumber(parsed.opacity)}" stroke-width="${formatNumber(this.state.lineWidth)}" stroke-linecap="${escapeXml(this.state.lineCap)}" stroke-linejoin="${escapeXml(this.state.lineJoin)}"${dash}/>`);
  }

  clip() {
    if (!this.path.length) return;
    const id = `clip-${++this.clipCount}`;
    this.definitions.push(`<clipPath id="${id}"><path d="${this.path.join("")}"/></clipPath>`);
    this.body.push(`<g clip-path="url(#${id})">`);
    this.groups += 1;
  }

  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    const id = `gradient-${++this.gradientCount}`;
    const gradient = new SvgGradient(id, { x0, y0, r0, x1, y1, r1 });
    this.definitions.push(gradient);
    return gradient;
  }

  addText(text, mode) {
    if (this.omitPoleLabel && String(text) === "北极点") return;
    const [a, b, c, d, e, f] = this.matrix;
    const transform = `matrix(${[a, b, c, d, e, f].map(formatNumber).join(" ")})`;
    const textAnchor = this.state.textAlign === "center" ? "middle" : ["right", "end"].includes(this.state.textAlign) ? "end" : "start";
    const baseline = this.state.textBaseline === "middle" ? "central"
      : this.state.textBaseline === "top" ? "text-before-edge"
        : this.state.textBaseline === "bottom" ? "text-after-edge"
          : this.state.textBaseline === "hanging" ? "hanging" : "alphabetic";
    const font = String(this.state.font);
    const fontSize = font.match(/([\d.]+)px/i)?.[1] ?? "10";
    const fontWeight = font.match(/(^|\s)(bold|[1-9]00)(?=\s)/i)?.[2];
    const fontFamily = font.replace(/^.*?[\d.]+px\s*/i, "").trim() || "sans-serif";
    const alpha = this.state.globalAlpha;
    if (mode === "fill") {
      const fill = this.state.fillStyle;
      const parsed = fill instanceof SvgGradient ? { color: `url(#${fill.id})`, opacity: alpha } : parseColor(fill, alpha);
      this.body.push(`<text transform="${transform}" x="0" y="0" text-anchor="${textAnchor}" dominant-baseline="${baseline}" font-size="${fontSize}px" font-family="${escapeXml(fontFamily)}"${fontWeight ? ` font-weight="${fontWeight}"` : ""} fill="${escapeXml(parsed.color)}" fill-opacity="${formatNumber(parsed.opacity)}">${escapeXml(text)}</text>`);
      return;
    }
    const parsed = parseColor(this.state.strokeStyle, alpha);
    this.body.push(`<text transform="${transform}" x="0" y="0" text-anchor="${textAnchor}" dominant-baseline="${baseline}" font-size="${fontSize}px" font-family="${escapeXml(fontFamily)}"${fontWeight ? ` font-weight="${fontWeight}"` : ""} fill="none" stroke="${escapeXml(parsed.color)}" stroke-opacity="${formatNumber(parsed.opacity)}" stroke-width="${formatNumber(this.state.lineWidth)}" stroke-linejoin="${escapeXml(this.state.lineJoin)}">${escapeXml(text)}</text>`);
  }

  fillText(text, x, y) {
    this.save();
    this.translate(x, y);
    this.addText(String(text), "fill");
    this.restore();
  }

  strokeText(text, x, y) {
    this.save();
    this.translate(x, y);
    this.addText(String(text), "stroke");
    this.restore();
  }

  clearRect() {}

  setLineDash(values) {
    this.state.lineDash = [...values];
  }

  toSvg() {
    while (this.groups > 0) {
      this.body.push("</g>");
      this.groups -= 1;
    }
    const definitions = this.definitions.map((definition) => {
      if (definition instanceof SvgGradient) {
        const { x0, y0, r0, x1, y1, r1 } = definition.coordinates;
        const stops = definition.stops.length
          ? definition.stops.map(({ offset, color }) => `<stop offset="${formatNumber(offset * 100)}%" stop-color="${escapeXml(color)}"/>`).join("")
          : `<stop offset="0%" stop-color="#000000"/>`;
        return `<radialGradient id="${definition.id}" gradientUnits="userSpaceOnUse" cx="${formatNumber(x1)}" cy="${formatNumber(y1)}" r="${formatNumber(r1)}" fx="${formatNumber(x0)}" fy="${formatNumber(y0)}" fr="${formatNumber(r0)}">${stops}</radialGradient>`;
      }
      return definition;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}"><defs>${definitions}</defs>${this.body.join("")}</svg>`;
  }
}

function makeCanvas(context) {
  return {
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ width: SIZE, height: SIZE }),
    getContext: () => context,
    addEventListener() {},
  };
}

function localDayStart(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), -8));
}

function skyStateAt(date) {
  const altitude = solarAltitude(date, SHANGHAI.lat, SHANGHAI.lon);
  if (altitude >= 0) return "day";
  const bands = [
    ["standard", -0.833, 0],
    ["civil", -6, -0.833],
    ["nautical", -12, -6],
    ["astronomical", -18, -12],
  ];
  const twilight = bands.find(([, low, high]) => altitude >= low && altitude < high);
  if (twilight) return twilight[0];
  const moon = planetaryBodies(date, SHANGHAI.lat, SHANGHAI.lon).find((body) => body.id === "moon");
  return moon && moon.horizontal.altitude > 0 && moon.illumination >= 0.08 ? "moon" : "night";
}

function calculateTimeRing(date) {
  const start = localDayStart(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const span = end.getTime() - start.getTime();
  const step = 5 * 60 * 1000;
  const segments = [];
  let previousState = null;
  let previousStart = 0;
  for (let time = start.getTime(); time < end.getTime(); time += step) {
    const nextTime = Math.min(time + step, end.getTime());
    const currentState = skyStateAt(new Date((time + nextTime) / 2));
    const currentStart = (time - start.getTime()) / span;
    const currentEnd = (nextTime - start.getTime()) / span;
    if (currentState !== previousState) {
      if (previousState !== null) segments.push({ id: previousState, start: previousStart, end: currentStart });
      previousState = currentState;
      previousStart = currentStart;
    }
    if (nextTime === end.getTime()) segments.push({ id: currentState, start: previousStart, end: currentEnd });
  }
  return {
    segments,
    timeFraction: Math.min(1, Math.max(0, (date.getTime() - start.getTime()) / span)),
  };
}

async function writePng(context, destination) {
  const svg = context.toSvg();
  await sharp(Buffer.from(svg)).png().toFile(destination);
}

async function generateVisibleSky() {
  const project = path.join(PROJECTS, "visible-sky");
  const imageDirectory = path.join(project, "image");
  await mkdir(imageDirectory, { recursive: true });
  const context = new SvgCanvas2D(SIZE, SIZE);
  const canvas = makeCanvas(context);
  globalThis.window = { devicePixelRatio: 1 };
  const renderer = new SkyRenderer(canvas);
  renderer.render({
    date: DATE,
    location: SHANGHAI,
    layers: { stars: true, constellations: true, boundaries: true, milkyWay: true, ecliptic: true, grid: true, labels: true },
    zoom: 1,
    widgetMode: true,
    homepageMode: false,
    widgyMode: true,
    timeRing: calculateTimeRing(DATE),
    bodies: planetaryBodies(DATE, SHANGHAI.lat, SHANGHAI.lon),
  });
  await writePng(context, path.join(imageDirectory, "chart.png"));
  await writeFile(path.join(project, "generated-at.txt"), `${DATE.toISOString()}\n上海 · 可见天区静态图面；时钟指针由 ScriptWidget 实时驱动。\n`);
}

async function generateActivitySky() {
  const project = path.join(PROJECTS, "active-planisphere");
  const imageDirectory = path.join(project, "image");
  await mkdir(imageDirectory, { recursive: true });
  const context = new SvgCanvas2D(SIZE, SIZE, { omitPoleLabel: true });
  const canvas = makeCanvas(context);
  const status = { textContent: "" };
  globalThis.window = {
    devicePixelRatio: 1,
    location: { search: "?city=shanghai" },
    addEventListener() {},
  };
  globalThis.document = {
    hidden: false,
    querySelector(selector) {
      return selector === "#watch-canvas" ? canvas : status;
    },
  };
  globalThis.setInterval = () => 0;
  globalThis.requestAnimationFrame = (callback) => callback();
  await import("../widgy/watch/watch.js");
  await writePng(context, path.join(imageDirectory, "chart.png"));
  await writeFile(path.join(project, "generated-at.txt"), `${DATE.toISOString()}\n上海 · 活动星盘静态图面；星盘图面为生成时快照，时钟指针由 ScriptWidget 实时驱动。\n`);
}

function packageMain() {
  return `// CosmosWhisper · ScriptWidget
// Chart image is bundled locally. The three hands use WidgetKit's clock-hand animation.
$render(
  <vstack frame="max,center" background="#030817">
    <zstack>
      <image name="chart" mode="fit" frame="max" />

      <vstack animation="clockHour">
        <rect frame="2.4,27" color="#f4e8c6" corner="1.2" />
        <rect frame="2.4,27" color="clear" />
      </vstack>

      <vstack animation="clockMinute">
        <rect frame="1.7,41" color="#fff4dd" corner="0.85" />
        <rect frame="1.7,41" color="clear" />
      </vstack>

      <vstack animation="clockSecond">
        <rect frame="0.9,52" color="#ff4b50" corner="0.45" />
        <rect frame="0.9,52" color="clear" />
      </vstack>

      <circle frame="6,6" color="#f5d68c" />
    </zstack>
  </vstack>
);
`;
}

const packageDefinitions = [
  {
    folder: "visible-sky",
    name: "CosmosWhisper · 可见天区",
    id: "com.lzq1206.cosmoswhisper.visible-sky",
    description: "上海本地可见天区星图快照，中央时针、分针与扫秒秒针。",
    readme: "上海本地可见天区视图。星图、日照圈和行星为打包时的天空快照；时针、分针与连续扫动秒针由 WidgetKit 时钟动画驱动。",
  },
  {
    folder: "active-planisphere",
    name: "CosmosWhisper · 活动星盘",
    id: "com.lzq1206.cosmoswhisper.active-planisphere",
    description: "上海活动星盘快照，中央时针、分针与扫秒秒针。",
    readme: "上海活动星盘视图，沿用 Watch 版星盘布局。星空底图为打包时快照；时针、分针与连续扫动秒针由 WidgetKit 时钟动画驱动。",
  },
];

async function writeProjectFiles(definition) {
  const project = path.join(PROJECTS, definition.folder);
  await mkdir(project, { recursive: true });
  const manifest = {
    formatVersion: 2,
    id: definition.id,
    name: definition.name,
    version: "1.0.0",
    runtimeVersion: "1.0",
    entry: "main.jsx",
    supportedFamilies: ["systemSmall", "systemMedium", "systemLarge"],
    permissions: [],
    networkDomains: [],
    description: definition.description,
    author: { name: "lzq1206", url: "https://github.com/lzq1206/CosmosWhisper" },
    license: "MIT",
  };
  await writeFile(path.join(project, "widget.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(project, "main.jsx"), packageMain());
  await writeFile(path.join(project, "README.md"), `# ${definition.name}\n\n${definition.readme}\n\n导入文件：\`scriptwidget/exports/${definition.folder}.swt\`\n`);
}

async function createSwtArchive(definition) {
  const project = path.join(PROJECTS, definition.folder);
  const exportPath = path.join(EXPORTS, `${definition.folder}.swt`);
  const tempZip = path.join(EXPORTS, `${definition.folder}.${process.pid}.tmp.zip`);
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$source = [System.IO.Path]::GetFullPath(${quote(project)})`,
    `$target = [System.IO.Path]::GetFullPath(${quote(tempZip)})`,
    `$final = [System.IO.Path]::GetFullPath(${quote(exportPath)})`,
    "$archive = [System.IO.Compression.ZipFile]::Open($target, [System.IO.Compression.ZipArchiveMode]::Create)",
    "try { Get-ChildItem -LiteralPath $source -File -Recurse | Sort-Object FullName | ForEach-Object { $relative = $_.FullName.Substring($source.Length).TrimStart([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)).Replace('\\', '/'); $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal); $inputStream = [System.IO.File]::OpenRead($_.FullName); $outputStream = $entry.Open(); try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() } } } finally { $archive.Dispose() }",
    "Move-Item -LiteralPath $target -Destination $final -Force",
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  try {
    if (result.status !== 0) {
      throw new Error(`Could not package ${definition.name}: ${result.stderr || result.stdout}`);
    }
  } finally {
    await rm(tempZip, { force: true });
  }
}

await mkdir(EXPORTS, { recursive: true });
for (const definition of packageDefinitions) await writeProjectFiles(definition);
await generateVisibleSky();
await generateActivitySky();
for (const definition of packageDefinitions) await createSwtArchive(definition);
console.log(`Built two ScriptWidget .swt packages in ${EXPORTS}`);
