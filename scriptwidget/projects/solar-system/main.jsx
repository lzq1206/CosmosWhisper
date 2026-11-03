// CosmosWhisper solar system dial, using quarter-hour snapshots.
async function availableSnapshotURL(url) {
  try {
    const signature = await fetch(url, {
      headers: { Range: "bytes=0-2" },
      responseType: "base64",
      timeoutInterval: 2
    });
    return typeof signature === "string" && signature.startsWith("/9j/") ? url : null;
  } catch (error) {
    return null;
  }
}

{
  const family = typeof $getenv === "function"
    ? String($getenv("widget-size") || "systemLarge").toLowerCase()
    : "systemLarge";
  const interval = 15 * 60 * 1000;
  const slot = Math.round(Date.now() / interval) * interval;
  const key = new Date(slot).toISOString().slice(0, 16).replace(/[-:]/g, "") + "Z";
  const path = "solar-system/beijing/" + key + ".jpg?v=" + key;
  const primary = "https://lzq1206.github.io/CosmosWhisper/widget-snapshots/" + path;
  const fallback = "https://cosmos.rainywhisper.com/widget-snapshots/" + path;
  const url = (await availableSnapshotURL(primary)) || (await availableSnapshotURL(fallback));
  const mode = family.includes("small") || family.includes("large") ? "fill" : "fit";
  if (url) {
    $render(
      <zstack frame="max" alignment="center" background="#030817">
        <image url={url} frame="max" mode={mode} clip="rect" accentedRenderingMode="fullColor" />
      </zstack>
    );
  } else {
    $render(
      <vstack frame="max" background="#030817" alignment="center" spacing="6" padding="16">
        <icon systemName="wifi.slash" size="24" color="#f5d68c" />
        <text font="caption" color="#9ba9bf">太阳系表盘暂不可用，请稍后刷新</text>
      </vstack>
    );
  }
}
