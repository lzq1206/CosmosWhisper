import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WIDGET_CITIES } from "../src/data/cities.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = path.join(ROOT, "scriptwidget", "projects");
const EXPORTS = path.join(ROOT, "scriptwidget", "exports");
const RUNTIME = path.join(ROOT, "scriptwidget", "runtime", "planisphere-main.jsx");

const packageDefinitions = [
  {
    folder: "visible-sky",
    name: "CosmosWhisper · 可见天区",
    id: "com.lzq1206.cosmoswhisper.visible-sky",
    description: "网页首页风格的城市可见天区星图底图。",
    readme: "可见天区版以 CosmosWhisper 城市页面截图作为完整底图，并按设备位置选择最近城市。",
  },
  {
    folder: "active-planisphere",
    name: "CosmosWhisper · 活动星盘",
    id: "com.lzq1206.cosmoswhisper.active-planisphere",
    description: "网页 Watch 风格的城市活动星盘底图。",
    readme: "活动星盘版以 CosmosWhisper Watch 城市页面截图作为完整底图，并按设备位置选择最近城市。",
  },
];

function psQuote(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

async function writeProjectFiles(definition, runtimeTemplate, generatedAt) {
  const project = path.join(PROJECTS, definition.folder);
  const imageDirectory = path.join(project, "image");
  const runtimeSource = runtimeTemplate
    .replace('"__PACKAGE_KIND__"', JSON.stringify(definition.folder))
    .replace("__CITY_CATALOG__", JSON.stringify(WIDGET_CITIES.map(({ id, name, lat, lon }) => ({ id, name, lat, lon }))))
    .trimEnd() + "\n";
  if (runtimeSource.includes("__PACKAGE_KIND__") || runtimeSource.includes("__CITY_CATALOG__")) {
    throw new Error("Could not populate the ScriptWidget runtime template.");
  }

  await mkdir(project, { recursive: true });
  await rm(imageDirectory, { recursive: true, force: true });
  await writeFile(path.join(project, "main.jsx"), runtimeSource);

  const manifest = {
    formatVersion: 2,
    id: definition.id,
    name: definition.name,
    version: "1.10.0",
    runtimeVersion: "1.0",
    entry: "main.jsx",
    supportedFamilies: ["systemSmall", "systemMedium", "systemLarge"],
    permissions: ["location", "network"],
    networkDomains: ["raw.githubusercontent.com"],
    plugins: [],
    description: definition.description,
    category: "Astronomy",
    tags: ["astronomy", "planisphere", "nearest-city", "moon-phase", "solar-terms", "web-snapshot"],
    author: { name: "lzq1206", url: "https://github.com/lzq1206/CosmosWhisper" },
    license: "MIT",
  };

  await writeFile(path.join(project, "widget.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(
    path.join(project, "README.md"),
    "# " + definition.name + "\n\n" + definition.readme
      + "\n\n网页画布加载后等待 5 秒再截图，生成适配大尺寸小组件比例的 1024×1090 高分辨率底图。GitHub Actions 每 3 小时检查未来 12 小时的 15 分钟时刻，只生成缺少的图片；小组件按当前时间选取最近时刻的快照。城市匹配范围为省会、自治区首府、直辖市和台北。小尺寸方形组件填满显示；中尺寸等比适配且保留完整星盘。小组件只显示星盘底图，不叠加指针或数字时间。"
      + "\n\n小组件需要定位和网络权限。定位结果会匹配仓库内最近的城市页面；网络权限用于读取该城市的截图。系统实际刷新小组件的时间由 ScriptWidget 和 WidgetKit 管理。"
      + "\n\n导入文件：scriptwidget/exports/" + definition.folder + ".swt\n"
  );
  await writeFile(
    path.join(project, "generated-at.txt"),
    generatedAt + "\n城市页面截图由 GitHub Actions 每 3 小时检查并补齐未来 12 小时的 15 分钟时刻；ScriptWidget 选择最近时刻的底图。WidgetKit 的实际刷新时间由 ScriptWidget 和系统调度。\n"
  );
}

async function createSwtArchive(definition) {
  const project = path.join(PROJECTS, definition.folder);
  const exportPath = path.join(EXPORTS, definition.folder + ".swt");
  const tempZip = path.join(EXPORTS, definition.folder + "." + process.pid + ".tmp.zip");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem",
    "$source = [System.IO.Path]::GetFullPath(" + psQuote(project) + ")",
    "$target = [System.IO.Path]::GetFullPath(" + psQuote(tempZip) + ")",
    "$final = [System.IO.Path]::GetFullPath(" + psQuote(exportPath) + ")",
    "$archive = [System.IO.Compression.ZipFile]::Open($target, [System.IO.Compression.ZipArchiveMode]::Create)",
    "try { Get-ChildItem -LiteralPath $source -File -Recurse | Sort-Object FullName | ForEach-Object { $relative = $_.FullName.Substring($source.Length).TrimStart([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)).Replace('\\', '/'); $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal); $inputStream = [System.IO.File]::OpenRead($_.FullName); $outputStream = $entry.Open(); try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() } } } finally { $archive.Dispose() }",
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

for (const definition of packageDefinitions) {
  await writeProjectFiles(definition, runtimeTemplate, generatedAt);
}
for (const definition of packageDefinitions) {
  await createSwtArchive(definition);
}

const readme = "# ScriptWidget packages\n\n"
  + "- exports/visible-sky.swt — 可见天区版\n"
  + "- exports/active-planisphere.swt — 活动星盘版\n\n"
  + "星盘底图来自对应网页城市页面的截图；网页画布加载后等待 5 秒，按设备像素导出适配大尺寸小组件的 1024×1090 高分辨率图片。GitHub Actions 每 3 小时检查未来 12 小时的 15 分钟时刻，只生成缺少的图片，并清理已过期图片。ScriptWidget 根据设备定位，在省会、自治区首府、直辖市和台北中选择最近城市；按当前时间使用最近时刻的快照。小组件只显示星盘底图，不叠加指针或数字时间。小尺寸方形组件填满显示；中尺寸等比适配完整星盘。\n\n"
  + "导入时需要允许 ScriptWidget 访问定位和 raw.githubusercontent.com 网络图片。图片计划每 3 小时补齐未来 12 小时；WidgetKit 对小组件本身的刷新由 ScriptWidget 和系统调度。\n\n"
  + "用 npm run generate:scriptwidget 重新生成两个项目目录和 SWT 文件。也可以把 projects/visible-sky 或 projects/active-planisphere 作为文件夹放进 ScriptWidget Scripts 目录。\n";
await writeFile(path.join(ROOT, "scriptwidget", "README.md"), readme);

console.log("Built two ScriptWidget projects and .swt archives in " + EXPORTS);
