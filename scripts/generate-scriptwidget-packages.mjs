import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STARS } from "../src/data/stars.js";
import { CONSTELLATIONS } from "../src/data/constellations.js";
import { MILKY_WAY_RINGS } from "../src/data/milkyWay.js";
import { CITIES } from "../src/data/cities.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = path.join(ROOT, "scriptwidget", "projects");
const EXPORTS = path.join(ROOT, "scriptwidget", "exports");
const RUNTIME = path.join(ROOT, "scriptwidget", "runtime", "planisphere-main.jsx");

const packageDefinitions = [
  {
    folder: "visible-sky",
    name: "CosmosWhisper · 可见天区",
    id: "com.lzq1206.cosmoswhisper.visible-sky",
    description: "网页首页风格的当前位置可见天区星图。",
    readme: "可见天区版沿用 CosmosWhisper 首页的地平投影和蓝金配色，根据设备当前位置和本地时间绘制星空、星座、银河、太阳、月亮、行星及日照外环。",
  },
  {
    folder: "active-planisphere",
    name: "CosmosWhisper · 活动星盘",
    id: "com.lzq1206.cosmoswhisper.active-planisphere",
    description: "网页 Watch 风格的当前位置旋转活动星盘。",
    readme: "活动星盘版沿用 CosmosWhisper 网页 Watch 的极轴旋转投影、蓝金配色、方位网格、二十四节气环、日照外环和动态月相。恒星与天体按设备位置和本地时间计算。",
  },
];

function psQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function simplifyPolyline(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const selected = [];
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round(index * (points.length - 1) / (maxPoints - 1));
    const point = points[sourceIndex];
    if (selected.length === 0 || selected.at(-1)[0] !== point[0] || selected.at(-1)[1] !== point[1]) {
      selected.push(point);
    }
  }
  return selected;
}

function sampleClosedPath(points, count) {
  const lengths = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [ra1, dec1] = points[index - 1];
    const [ra2, dec2] = points[index];
    const deltaRa = (ra2 - ra1) * 15 * Math.cos(((dec1 + dec2) / 2) * Math.PI / 180);
    total += Math.hypot(deltaRa, dec2 - dec1);
    lengths.push(total);
  }
  const samples = [];
  let segment = 1;
  for (let index = 0; index < count; index += 1) {
    const target = total * index / count;
    while (segment < lengths.length - 1 && lengths[segment] < target) segment += 1;
    const before = points[segment - 1];
    const after = points[segment];
    const span = lengths[segment] - lengths[segment - 1];
    const fraction = span > 0 ? (target - lengths[segment - 1]) / span : 0;
    samples.push([
      before[0] + (after[0] - before[0]) * fraction,
      before[1] + (after[1] - before[1]) * fraction,
    ]);
  }
  return samples;
}

function buildMilkyWayCenterline() {
  const [outer, inner] = MILKY_WAY_RINGS;
  const outerSamples = sampleClosedPath(outer, 144);
  const innerSamples = sampleClosedPath(inner, 144);
  return outerSamples.map((point, index) => {
    const other = innerSamples[index];
    return [(point[0] + other[0]) / 2, (point[1] + other[1]) / 2];
  });
}

function replaceData(runtimeTemplate) {
  const start = runtimeTemplate.indexOf("// ==================== 3. 亮星与导航星表");
  const end = runtimeTemplate.indexOf("// ==================== 4. 天文历算核心引擎", start);
  if (start < 0 || end < 0) throw new Error("Could not find the star-data insertion point in the runtime template.");

  const starData = STARS.map(({ ra, dec, magnitude, name, tone }) => ({ ra, dec, magnitude, name, tone }));
  const cityData = CITIES.map(({ name, lat, lon }) => ({ name, lat, lon }));
  const constellationData = CONSTELLATIONS.map((constellation) => ({
    name: constellation.name,
    lines: constellation.lines.map((line) => simplifyPolyline(line, 7)),
    boundaryParts: constellation.boundaryParts.map((part) => simplifyPolyline(part, 7)),
    labels: constellation.labels,
  }));
  const dataDeclarations = [
    "// Star, constellation and galaxy geometry is bundled from the website's source data.",
    `const STARS = ${JSON.stringify(starData)};`,
    `const CONSTELLATIONS = ${JSON.stringify(constellationData)};`,
    `const MILKY_WAY_CENTERLINE = ${JSON.stringify(buildMilkyWayCenterline())};`,
    `const NEARBY_CITIES = ${JSON.stringify(cityData)};`,
    "",
  ].join("\n");
  return runtimeTemplate.slice(0, start) + dataDeclarations + runtimeTemplate.slice(end);
}

async function writeProjectFiles(definition, sharedRuntimeSource, generatedAt) {
  const project = path.join(PROJECTS, definition.folder);
  const imageDirectory = path.join(project, "image");
  const runtimeSource = sharedRuntimeSource.replace(
    'const PACKAGE_KIND = "__PACKAGE_KIND__";',
    `const PACKAGE_KIND = "${definition.folder}";`,
  );
  if (runtimeSource === sharedRuntimeSource) throw new Error(`Could not set the ScriptWidget view for ${definition.folder}.`);
  await mkdir(project, { recursive: true });

  // Remove assets from the earlier Beijing-style package. The new chart is
  // built from CosmosWhisper's live renderer logic and catalog data.
  for (const stalePath of [
    path.join(project, "star_plate.png"),
    path.join(imageDirectory, "star_plate.png"),
    path.join(imageDirectory, "chart.png"),
  ]) await rm(stalePath, { force: true });
  await writeFile(path.join(project, "main.jsx"), runtimeSource);

  const manifest = {
    formatVersion: 2,
    id: definition.id,
    name: definition.name,
    version: "1.3.0",
    runtimeVersion: "1.0",
    entry: "main.jsx",
    supportedFamilies: ["systemSmall", "systemMedium", "systemLarge", "accessoryCircular", "accessoryRectangular", "accessoryInline"],
    permissions: ["location"],
    networkDomains: [],
    plugins: [],
    description: definition.description,
    category: "Astronomy",
    tags: ["astronomy", "planisphere", "local-location", "moon-phase", "solar-terms", "web-style"],
    author: { name: "lzq1206", url: "https://github.com/lzq1206/CosmosWhisper" },
    license: "MIT",
  };

  await writeFile(path.join(project, "widget.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    path.join(project, "README.md"),
    `# ${definition.name}\n\n${definition.readme}\n\n圆盘按你提供截图中的近满幅方形占比制作，中央时针、分针和扫秒针随组件大小缩放。组件用设备坐标计算天空；系统未提供城市名时，从内置城市表匹配附近城市，不请求外部定位服务。\n\n导入文件：\`scriptwidget/exports/${definition.folder}.swt\`\n`
  );
  await writeFile(
    path.join(project, "generated-at.txt"),
    `${generatedAt}\n使用 ScriptWidget 定位缓存和设备本地时间；WidgetKit 刷新时重新计算天体、星座投影、节气与日照状态。城市名优先使用设备提供的地名，缺失时按位置匹配内置城市表。\n`
  );
}

async function createSwtArchive(definition) {
  const project = path.join(PROJECTS, definition.folder);
  const exportPath = path.join(EXPORTS, `${definition.folder}.swt`);
  const tempZip = path.join(EXPORTS, `${definition.folder}.${process.pid}.tmp.zip`);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$source = [System.IO.Path]::GetFullPath(${psQuote(project)})`,
    `$target = [System.IO.Path]::GetFullPath(${psQuote(tempZip)})`,
    `$final = [System.IO.Path]::GetFullPath(${psQuote(exportPath)})`,
    "$archive = [System.IO.Compression.ZipFile]::Open($target, [System.IO.Compression.ZipArchiveMode]::Create)",
    "try { Get-ChildItem -LiteralPath $source -File -Recurse | Sort-Object FullName | ForEach-Object { $relative = $_.FullName.Substring($source.Length).TrimStart([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)).Replace('\\', '/'); $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal); $inputStream = [System.IO.File]::OpenRead($_.FullName); $outputStream = $entry.Open(); try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() } } } finally { $archive.Dispose() }",
    "Move-Item -LiteralPath $target -Destination $final -Force",
  ].join("; ");

  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  try {
    if (result.status !== 0) throw new Error(`Could not package ${definition.name}: ${result.stderr || result.stdout}`);
  } finally {
    await rm(tempZip, { force: true });
  }
}

const runtimeTemplate = await readFile(RUNTIME, "utf8");
const sharedRuntimeSource = replaceData(runtimeTemplate);
const generatedAt = new Date().toISOString();
await mkdir(PROJECTS, { recursive: true });
await mkdir(EXPORTS, { recursive: true });

for (const definition of packageDefinitions) await writeProjectFiles(definition, sharedRuntimeSource, generatedAt);
for (const definition of packageDefinitions) await createSwtArchive(definition);

await rm(path.join(ROOT, "scriptwidget", "assets", "star-plate.png"), { force: true });

const readme = `# ScriptWidget packages\n\n` +
  `- \`exports/visible-sky.swt\` — 可见天区版\n` +
  `- \`exports/active-planisphere.swt\` — 活动星盘版\n\n` +
  `可见天区版沿用网页首页投影，活动星盘版沿用网页 Watch 极轴投影；两者使用相应网页样式、配色与外圈。组件中的圆盘接近方形边缘，比例参考你提供的截图。它们按设备坐标与本地时间重新计算，不使用北京静态底图，也不向外发送定位；中心三针随尺寸缩放，秒针使用 ScriptWidget 原生时钟动画。\n\n` +
  `星盘与天体按 WidgetKit 刷新时重新计算。首次使用前，请在 ScriptWidget 中授权定位并刷新定位缓存。当地城市名优先使用设备提供的地名，缺失时从内置城市表匹配附近城市。\n\n` +
  `用 \`npm run generate:scriptwidget\` 重新生成。通过 iOS 分享菜单导入 \`.swt\` 文件并选择 ScriptWidget。\n`;
await writeFile(path.join(ROOT, "scriptwidget", "README.md"), readme);

console.log(`Built two ScriptWidget .swt packages in ${EXPORTS}`);
