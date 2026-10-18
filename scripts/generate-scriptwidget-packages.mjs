import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WIDGET_CITIES } from "../src/data/cities.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = path.join(ROOT, "scriptwidget", "projects");
const EXPORTS = path.join(ROOT, "scriptwidget", "exports");
const RUNTIME = path.join(ROOT, "scriptwidget", "runtime", "planisphere-main.jsx");
const VERSION = "1.11.0";

const packageTypes = [
  {
    folder: "visible-sky",
    name: "CosmosWhisper · 可见天区",
    id: "com.lzq1206.cosmoswhisper.visible-sky",
    description: "网页首页风格的城市可见天区星图底图。",
  },
  {
    folder: "active-planisphere",
    name: "CosmosWhisper · 活动星盘",
    id: "com.lzq1206.cosmoswhisper.active-planisphere",
    description: "网页 Watch 风格的城市活动星盘底图。",
  },
];

function psQuote(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

function buildDefinition(type, city) {
  return {
    ...type,
    city,
    folder: type.folder + "-" + city.id,
    projectFolder: city.id === "beijing" ? type.folder : null,
    name: type.name + " · " + city.name,
    id: type.id + "." + city.id,
    description: type.description + "城市已固定为" + city.name + "。",
    filename: type.folder + "-" + city.id + ".swt",
  };
}

async function writeProjectFiles(definition, runtimeTemplate, generatedAt, project) {
  const runtimeSource = runtimeTemplate
    .replace('"__PACKAGE_KIND__"', JSON.stringify(definition.folder.startsWith("visible-sky") ? "visible-sky" : "active-planisphere"))
    .replace('"__CITY_ID__"', JSON.stringify(definition.city.id))
    .replace('"__CITY_NAME__"', JSON.stringify(definition.city.name))
    .trimEnd() + "\n";
  if (/__PACKAGE_KIND__|__CITY_ID__|__CITY_NAME__/.test(runtimeSource)) {
    throw new Error("Could not populate the ScriptWidget runtime template for " + definition.filename);
  }

  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, "main.jsx"), runtimeSource);

  const manifest = {
    formatVersion: 2,
    id: definition.id,
    name: definition.name,
    version: VERSION,
    runtimeVersion: "1.0",
    entry: "main.jsx",
    supportedFamilies: ["systemSmall", "systemMedium", "systemLarge"],
    permissions: ["network"],
    networkDomains: ["lzq1206.github.io", "cosmos.rainywhisper.com"],
    plugins: [],
    description: definition.description,
    category: "Astronomy",
    tags: ["astronomy", "planisphere", "moon-phase", "solar-terms", "web-snapshot", definition.city.id],
    author: { name: "lzq1206", url: "https://github.com/lzq1206/CosmosWhisper" },
    license: "MIT",
  };

  await writeFile(path.join(project, "widget.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(
    path.join(project, "README.md"),
    "# " + definition.name + "\n\n"
      + "这是固定使用" + definition.city.name + "星图的版本。城市在网页下载时匹配或手动选择；组件运行时不再请求定位。\n\n"
      + "星图来自对应网页城市画布截图，截图在页面绘制完成 5 秒后生成，图像为适配大尺寸小组件比例的 1024×1090 底图。快照每 15 分钟一个时刻，由 GitHub Actions 每 3 小时补齐未来 12 小时。小组件读取最近时刻的图片，优先使用 GitHub Pages，失败时回退到 cosmos.rainywhisper.com。\n\n"
      + "小尺寸方形组件填满显示；大尺寸等比适配完整星盘。该包只显示星盘底图，不叠加指针或数字时间。ScriptWidget 只需要网络权限。\n\n"
      + "在 iCloud ScriptWidget Scripts 中使用文件夹形式时，可直接放入此项目目录；入口文件是 main.jsx，widget.json 是导入清单，不要把它当作脚本运行。\n"
  );
  await writeFile(
    path.join(project, "generated-at.txt"),
    generatedAt + "\n固定城市：" + definition.city.name + "。组件读取 GitHub Actions 维护的滚动星图截图。\n"
  );
}

async function createSwtArchive(definition, project) {
  const exportPath = path.join(EXPORTS, definition.filename);
  const tempZip = path.join(EXPORTS, definition.folder + "." + process.pid + ".tmp.zip");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem",
    "$source = [System.IO.Path]::GetFullPath(" + psQuote(project) + ")",
    "$target = [System.IO.Path]::GetFullPath(" + psQuote(tempZip) + ")",
    "$final = [System.IO.Path]::GetFullPath(" + psQuote(exportPath) + ")",
    "$rootName = " + psQuote(definition.folder),
    "$archive = [System.IO.Compression.ZipFile]::Open($target, [System.IO.Compression.ZipArchiveMode]::Create)",
    "try { Get-ChildItem -LiteralPath $source -File -Recurse | Sort-Object FullName | ForEach-Object { $relative = $_.FullName.Substring($source.Length).TrimStart([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)).Replace([char]92, [char]47); $entry = $archive.CreateEntry(($rootName + '/' + $relative), [System.IO.Compression.CompressionLevel]::Optimal); $inputStream = [System.IO.File]::OpenRead($_.FullName); $outputStream = $entry.Open(); try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() } } } finally { $archive.Dispose() }",
    "Move-Item -LiteralPath $target -Destination $final -Force",
  ].join("; ");

  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  try {
    if (result.status !== 0) throw new Error("Could not package " + definition.name + ": " + (result.stderr || result.stdout));
  } finally {
    await rm(tempZip, { force: true });
  }
}

const runtimeTemplate = await readFile(RUNTIME, "utf8");
const generatedAt = new Date().toISOString();
await mkdir(PROJECTS, { recursive: true });
await mkdir(EXPORTS, { recursive: true });
await rm(path.join(EXPORTS, "visible-sky.swt"), { force: true });
await rm(path.join(EXPORTS, "active-planisphere.swt"), { force: true });

const definitions = WIDGET_CITIES.flatMap((city) => packageTypes.map((type) => buildDefinition(type, city)));
for (const definition of definitions) {
  const project = definition.projectFolder
    ? path.join(PROJECTS, definition.projectFolder)
    : await mkdtemp(path.join(os.tmpdir(), "cosmoswhisper-scriptwidget-"));
  try {
    await writeProjectFiles(definition, runtimeTemplate, generatedAt, project);
    await createSwtArchive(definition, project);
  } finally {
    if (!definition.projectFolder) await rm(project, { recursive: true, force: true });
  }
}

const readme = "# ScriptWidget packages\n\n"
  + "下载文件按 `visible-sky-{city}.swt`、`active-planisphere-{city}.swt` 命名。首页可请求浏览器定位并匹配最近的区域代表城市，也可以手动选择；浏览器不允许定位时默认北京。\n\n"
  + "组件不再请求定位，避免把定位延迟挤进 ScriptWidget 的 5 秒运行限制。每个下载包的城市已固定；运行时只检查 GitHub Pages 和备用站点上的图片。两次图片检查各最多等待 2 秒。\n\n"
  + "每天的快照按 15 分钟间隔滚动生成，GitHub Actions 每 3 小时检查并补齐未来 12 小时的缺图；网页版截图在页面绘制完成 5 秒后采集。优先读取 GitHub Pages，失败时回退 cosmos.rainywhisper.com。\n\n"
  + "文件夹形式的北京版：`projects/visible-sky` 和 `projects/active-planisphere`。复制这两个项目文件夹到 ScriptWidget 的 Scripts 目录即可；脚本入口是 `main.jsx`，不要直接运行 `widget.json`。\n";
await writeFile(path.join(ROOT, "scriptwidget", "README.md"), readme);

console.log("Built " + definitions.length + " city-specific ScriptWidget SWT packages; Beijing project folders are in " + PROJECTS);
