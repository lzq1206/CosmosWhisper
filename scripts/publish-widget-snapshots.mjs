import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = process.env.WIDGET_SNAPSHOT_OUTPUT || path.join(ROOT, "scriptwidget", "snapshot-stage");
const PUBLISH_DIR = process.env.WIDGET_SNAPSHOT_PUBLISH_DIR
  || path.join(os.tmpdir(), "cosmoswhisper-snapshot-publish-" + process.pid);
const BRANCH = "widget-snapshots";

function git(args, cwd, extraEnv = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error("git " + args.join(" ") + " failed: " + (result.stderr || result.stdout));
  }
  return result.stdout.trim();
}

function localPath(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const result = path.resolve(resolvedRoot, ...relativePath.split("/"));
  const relative = path.relative(resolvedRoot, result);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Snapshot path escaped its directory: " + relativePath);
  }
  return result;
}

async function collectManagedFiles(directory, prefix = "") {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? prefix + "/" + entry.name : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectManagedFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function isManagedSnapshotPath(snapshotPath) {
  return snapshotPath === "manifest.json"
    || /^(visible-sky|active-planisphere)(-large)?\//.test(snapshotPath);
}

const manifest = JSON.parse(await readFile(path.join(OUTPUT_DIR, "manifest.json"), "utf8"));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.snapshots)) {
  throw new Error("The generated snapshot manifest has an unsupported format.");
}

const targetPaths = new Set();
for (const snapshotPath of manifest.snapshots) {
  if (!/^(visible-sky|active-planisphere)\/[a-z0-9-]+\/\d{8}T\d{4}Z\.jpg$/.test(snapshotPath)) {
    throw new Error("Invalid snapshot path in manifest: " + snapshotPath);
  }
  if (targetPaths.has(snapshotPath)) throw new Error("Duplicate snapshot path in manifest: " + snapshotPath);
  targetPaths.add(snapshotPath);
}
targetPaths.add("manifest.json");

let worktreeCreated = false;
try {
  git(["fetch", "--depth=1", "origin", BRANCH], ROOT);
  git(["worktree", "add", "--detach", PUBLISH_DIR, "FETCH_HEAD"], ROOT);
  worktreeCreated = true;

  const currentPaths = new Set(
    (await collectManagedFiles(PUBLISH_DIR)).filter(isManagedSnapshotPath)
  );
  let copiedCount = 0;
  for (const snapshotPath of manifest.snapshots) {
    if (currentPaths.has(snapshotPath)) continue;
    const source = localPath(OUTPUT_DIR, snapshotPath);
    const destination = localPath(PUBLISH_DIR, snapshotPath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(source));
    copiedCount += 1;
  }

  const existingFiles = await collectManagedFiles(PUBLISH_DIR);
  let removedCount = 0;
  for (const snapshotPath of existingFiles) {
    if (!isManagedSnapshotPath(snapshotPath) || targetPaths.has(snapshotPath)) continue;
    await rm(localPath(PUBLISH_DIR, snapshotPath), { force: true });
    removedCount += 1;
  }

  await writeFile(
    localPath(PUBLISH_DIR, "manifest.json"),
    await readFile(localPath(OUTPUT_DIR, "manifest.json"))
  );
  const publishedPaths = new Set(
    (await collectManagedFiles(PUBLISH_DIR)).filter(isManagedSnapshotPath)
  );
  const missingPaths = [...targetPaths].filter((snapshotPath) => !publishedPaths.has(snapshotPath));
  if (missingPaths.length) {
    throw new Error("Snapshot coverage is incomplete: " + missingPaths.slice(0, 10).join(", "));
  }

  git(["add", "--all"], PUBLISH_DIR);
  const tree = git(["write-tree"], PUBLISH_DIR);
  const commit = git(
    ["commit-tree", tree, "-m", "Refresh rolling ScriptWidget chart snapshots"],
    PUBLISH_DIR,
    {
      GIT_AUTHOR_NAME: "github-actions[bot]",
      GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
      GIT_COMMITTER_NAME: "github-actions[bot]",
      GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
    }
  );
  git(["push", "--force", "origin", commit + ":refs/heads/" + BRANCH], PUBLISH_DIR);

  console.log(
    "Published " + manifest.snapshots.length + " scheduled snapshots; added " + copiedCount
    + " new images and removed " + removedCount + " expired or obsolete files."
  );
  console.log("Coverage: " + manifest.coverage.from + " through " + manifest.coverage.through + ".");
} finally {
  if (worktreeCreated) {
    git(["worktree", "remove", "--force", PUBLISH_DIR], ROOT);
  }
}
