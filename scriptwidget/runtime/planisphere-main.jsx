/**
 * CosmosWhisper ScriptWidget packages.
 * The dial image is captured from the matching city page at quarter-hour times.
 * City screenshot with contained bounds, displayed without clock hands.
 */
const PACKAGE_KIND = "__PACKAGE_KIND__";
const CITY_ID = "__CITY_ID__";
const CITY_NAME = "__CITY_NAME__";

async function availableSnapshotURL(url) {
  try {
    // Location is selected on the download page, so use the time budget for
    // network latency. Two seconds per host keeps the sequential fallback
    // within ScriptWidget's five-second execution limit.
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
  const imageKind = PACKAGE_KIND === "visible-sky" ? "visible-sky" : "active-planisphere";
  const isLargeFamily = family.includes("large");
  const isSmallFamily = family.includes("small");
  const slotMilliseconds = 15 * 60 * 1000;
  const nearestSnapshot = Math.round(Date.now() / slotMilliseconds) * slotMilliseconds;
  const snapshotKey = new Date(nearestSnapshot).toISOString().slice(0, 16).replace(/[-:]/g, "") + "Z";
  const snapshotPath = imageKind + "/" + CITY_ID + "/" + snapshotKey + ".jpg?v=" + snapshotKey;
  const pagesURL = "https://lzq1206.github.io/CosmosWhisper/widget-snapshots/" + snapshotPath;
  const customDomainURL = "https://cosmos.rainywhisper.com/widget-snapshots/" + snapshotPath;
  const imageURL = (await availableSnapshotURL(pagesURL))
    || (await availableSnapshotURL(customDomainURL));
  // Every image includes the large-family background extension. Square widgets
  // crop only that extra background; large widgets show the complete dial.
  const imageMode = isSmallFamily || isLargeFamily ? "fill" : "fit";
  if (imageURL) {
    $render(
      <zstack frame="max" alignment="center" background="#030817">
        <image
          url={imageURL}
          frame="max"
          mode={imageMode}
          clip="rect"
          accentedRenderingMode="fullColor"
        />
      </zstack>
    );
  } else {
    $render(
      <vstack frame="max" background="#030817" alignment="center" spacing="6" padding="16">
        <icon systemName="wifi.slash" size="24" color="#f5d68c" />
        <text font="caption" color="#9ba9bf">{CITY_NAME}星图暂不可用，请稍后刷新</text>
      </vstack>
    );
  }
}
