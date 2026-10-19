import {
  formatDate,
  formatHours,
  localSiderealHours,
  planetaryBodies,
  solarAltitude,
} from "./astro.js";
import { SkyRenderer } from "./renderer.js?v=20261017.6";
import { WIDGET_CITIES } from "./data/cities.js";

const DEFAULT_LOCATION = {
  lat: 31.2,
  lon: 121.5,
  name: "默认地平线",
  source: "default",
};
const STORAGE_KEY = "cosmos-whisper-location";
const TWILIGHT_BANDS = [
  { id: "standard", label: "标准晨昏", low: -0.833, high: 0 },
  { id: "civil", label: "民用昏影", low: -6, high: -0.833 },
  { id: "nautical", label: "航海昏影", low: -12, high: -6 },
  { id: "astronomical", label: "天文昏影", low: -18, high: -12 },
];
const canvas = document.querySelector("#sky-canvas");
const canvasStatus = document.querySelector("#canvas-status");
const renderer = new SkyRenderer(canvas);
const snapshotTimestamp = Number(new URLSearchParams(window.location.search).get("at"));
const hasFixedSnapshotDate = Number.isFinite(snapshotTimestamp) && snapshotTimestamp > 0;
const queryParams = new URLSearchParams(window.location.search);
if (queryParams.has("renderScale")) {
  canvas.style.width = "360px";
  canvas.style.height = "360px";
}
const nativeLocationMode = document.body.dataset.nativeLocation === "true";
const queryLatitude = Number(queryParams.get("lat"));
const queryLongitude = Number(queryParams.get("lon"));
const locationFromQuery = queryParams.has("lat") && queryParams.has("lon")
  && Number.isFinite(queryLatitude) && Number.isFinite(queryLongitude)
  && queryLatitude >= -90 && queryLatitude <= 90 && queryLongitude >= -180 && queryLongitude <= 180
  ? { lat: queryLatitude, lon: queryLongitude, name: queryParams.get("name") || "当前位置", source: "device" }
  : null;

const state = {
  date: hasFixedSnapshotDate ? new Date(snapshotTimestamp) : new Date(),
  location: locationFromQuery ?? (nativeLocationMode ? { ...DEFAULT_LOCATION } : loadLocation() ?? { ...DEFAULT_LOCATION }),
  timeRing: null,
  bodies: [],
  homepageMode: document.body.dataset.homepage === "true",
  widgyMode: document.body.dataset.widget === "true",
  layers: {
    stars: true,
    constellations: true,
    boundaries: true,
    milkyWay: true,
    ecliptic: true,
    grid: true,
    labels: true,
  },
  zoom: 1,
  widgetMode: true,
  hoverStarId: null,
  selectedStarId: null,
};

let pointerState = null;
let locationRequestPending = false;
let timeRingCacheKey = "";

function loadLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Number.isFinite(saved.lat) || !Number.isFinite(saved.lon)) return null;
    if (saved.lat < -90 || saved.lat > 90 || saved.lon < -180 || saved.lon > 180) return null;
    return {
      lat: Math.round(saved.lat * 10) / 10,
      lon: Math.round(saved.lon * 10) / 10,
      name: saved.name || "当前位置附近",
      source: saved.source || "browser",
    };
  } catch {
    return null;
  }
}

function saveLocation(location) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      lat: location.lat,
      lon: location.lon,
      name: location.name,
      source: location.source,
    }));
  } catch {
    return;
  }
}

function setLocation(location) {
  state.location = {
    ...location,
    lat: Math.round(location.lat * 10) / 10,
    lon: Math.round(location.lon * 10) / 10,
  };
  saveLocation(state.location);
  timeRingCacheKey = "";
  render();
}

function localDayBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start, end, span: end.getTime() - start.getTime() };
}

function timeRingKey(date, location) {
  const { start, end } = localDayBounds(date);
  return `${start.toISOString()}|${end.toISOString()}|${location.lat}|${location.lon}`;
}

function skyStateAt(date, location) {
  const altitude = solarAltitude(date, location.lat, location.lon);
  if (altitude >= 0) return "day";
  const twilight = TWILIGHT_BANDS.find(({ low, high }) => altitude >= low && altitude < high);
  if (twilight) return twilight.id;
  const moon = planetaryBodies(date, location.lat, location.lon).find((body) => body.id === "moon");
  return moon && moon.horizontal.altitude > 0 && moon.illumination >= 0.08 ? "moon" : "night";
}

function calculateTimeRing(date, location) {
  const { start, end, span } = localDayBounds(date);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const sampleStep = 60 * 1000;
  const segments = [];
  let previousState = null;
  let previousStart = 0;
  for (let time = startMs; time < endMs; time += sampleStep) {
    const nextTime = Math.min(time + sampleStep, endMs);
    const middle = new Date((time + nextTime) / 2);
    const currentState = skyStateAt(middle, location);
    const currentStart = (time - startMs) / span;
    const currentEnd = (nextTime - startMs) / span;
    if (currentState !== previousState) {
      if (previousState !== null) segments.push({ id: previousState, start: previousStart, end: currentStart });
      previousState = currentState;
      previousStart = currentStart;
    }
    if (nextTime === endMs) segments.push({ id: currentState, start: previousStart, end: currentEnd });
  }
  return { startMs, endMs, span, segments, timeFraction: 0 };
}

function ensureTimeRing() {
  const key = timeRingKey(state.date, state.location);
  if (key !== timeRingCacheKey) {
    state.timeRing = calculateTimeRing(state.date, state.location);
    timeRingCacheKey = key;
  }
  state.timeRing.timeFraction = Math.min(1, Math.max(0, (state.date.getTime() - state.timeRing.startMs) / state.timeRing.span));
}

function currentPhase() {
  const phase = skyStateAt(state.date, state.location);
  return {
    day: "白昼",
    standard: "标准晨昏",
    civil: "民用昏影",
    nautical: "航海昏影",
    astronomical: "天文昏影",
    moon: "月照夜",
    night: "无月夜",
  }[phase];
}

function render() {
  if (nativeLocationMode && !locationFromQuery) return;
  ensureTimeRing();
  state.bodies = planetaryBodies(state.date, state.location.lat, state.location.lon);
  const result = renderer.render(state);
  const lst = localSiderealHours(state.date, state.location.lon);
  canvasStatus.textContent = `${formatDate(state.date)}，${state.location.name}。可见 ${result.visibleCount} 颗五等及以上恒星，恒星时 ${formatHours(lst)}，${currentPhase()}。点击恒星选择，滚轮缩放。方位固定不随拖动改变。`;
  window.CosmosWhisperRenderReady = true;
}

function coordinatesForPointer(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function updateHover(event) {
  const { x, y } = coordinatesForPointer(event);
  const target = renderer.hitTest(x, y);
  const nextId = target?.star.id ?? null;
  if (nextId !== state.hoverStarId) {
    state.hoverStarId = nextId;
    render();
  }
}

function startPointer(event) {
  const { x, y } = coordinatesForPointer(event);
  pointerState = {
    pointerId: event.pointerId,
    startX: x,
    startY: y,
    moved: false,
  };
  canvas.setPointerCapture(event.pointerId);
}

function movePointer(event) {
  if (!pointerState || pointerState.pointerId !== event.pointerId) {
    updateHover(event);
    return;
  }
  const { x, y } = coordinatesForPointer(event);
  if (Math.abs(x - pointerState.startX) > 3 || Math.abs(y - pointerState.startY) > 3) pointerState.moved = true;
}

function endPointer(event) {
  if (!pointerState || pointerState.pointerId !== event.pointerId) return;
  const { x, y } = coordinatesForPointer(event);
  if (!pointerState.moved) {
    const target = renderer.hitTest(x, y);
    state.selectedStarId = target?.star.id ?? null;
    state.hoverStarId = state.selectedStarId;
    render();
  }
  pointerState = null;
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    return;
  }
}

function adjustZoom(amount) {
  state.zoom = Math.round(Math.min(1.75, Math.max(0.78, state.zoom + amount)) * 100) / 100;
  render();
}

function resetView() {
  state.zoom = 1;
  state.selectedStarId = null;
  state.hoverStarId = null;
  render();
}

function requestLocation() {
  if (locationRequestPending || !navigator.geolocation) return;
  locationRequestPending = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setLocation({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        name: "当前位置附近",
        source: "browser",
      });
      locationRequestPending = false;
    },
    () => {
      locationRequestPending = false;
      render();
    },
    {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 10000,
    },
  );
}

function nearestWidgetCity(latitude, longitude) {
  let nearest = WIDGET_CITIES[0];
  let nearestDistance = Infinity;
  const degrees = Math.PI / 180;
  for (const city of WIDGET_CITIES) {
    const latitude1 = latitude * degrees;
    const latitude2 = city.lat * degrees;
    const deltaLatitude = (city.lat - latitude) * degrees;
    const deltaLongitude = (city.lon - longitude) * degrees;
    const a = Math.sin(deltaLatitude / 2) ** 2
      + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
    const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distance < nearestDistance) {
      nearest = city;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function initializeScriptWidgetDownloads() {
  const citySelect = document.querySelector("#widget-city-select");
  const locateButton = document.querySelector("#widget-detect-city");
  const status = document.querySelector("#widget-city-status");
  const packageLinks = [...document.querySelectorAll("[data-city-package]")];
  if (!citySelect || !locateButton || !status || packageLinks.length === 0) return;

  const citiesById = new Map(WIDGET_CITIES.map((city) => [city.id, city]));
  for (const city of WIDGET_CITIES) {
    const option = document.createElement("option");
    option.value = city.id;
    option.textContent = city.name;
    citySelect.append(option);
  }

  let selectedCityId = "beijing";
  try {
    const savedCityId = localStorage.getItem("cosmos-whisper-scriptwidget-city");
    if (citiesById.has(savedCityId)) selectedCityId = savedCityId;
  } catch {
    selectedCityId = "beijing";
  }

  function selectCity(cityId, message) {
    const city = citiesById.get(cityId) || citiesById.get("beijing");
    citySelect.value = city.id;
    for (const link of packageLinks) {
      const kind = link.dataset.cityPackage;
      link.href = "./scriptwidget/exports/" + kind + "-" + city.id + ".swt";
      const label = link.querySelector(".widget-download-label");
      if (label) label.textContent = "下载" + (kind === "visible-sky" ? "可见天区版" : "活动星盘版") + " · " + city.name;
    }
    try {
      localStorage.setItem("cosmos-whisper-scriptwidget-city", city.id);
    } catch {
      // The selected city remains active for this page even if storage is unavailable.
    }
    if (message) status.textContent = message;
  }

  selectCity(selectedCityId, "当前选择" + citiesById.get(selectedCityId).name + "；可请求定位或从列表手动选择。");
  citySelect.addEventListener("change", () => {
    const city = citiesById.get(citySelect.value);
    selectCity(city.id, "已选择" + city.name + "；下方下载文件已更新。");
  });

  locateButton.addEventListener("click", () => {
    if (state.location.source === "browser") {
      const city = nearestWidgetCity(state.location.lat, state.location.lon);
      selectCity(city.id, "定位匹配到" + city.name + "；下方下载文件已更新。城市仅在此网页选择，不会写入组件定位权限。");
      return;
    }
    if (!navigator.geolocation) {
      status.textContent = "当前浏览器无法提供定位；请从城市列表手动选择。";
      return;
    }
    locateButton.disabled = true;
    locateButton.textContent = "正在定位…";
    status.textContent = "正在根据浏览器定位匹配附近代表城市…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const city = nearestWidgetCity(position.coords.latitude, position.coords.longitude);
        selectCity(city.id, "定位匹配到" + city.name + "；下方下载文件已更新。城市仅在此网页选择，不会写入组件定位权限。");
        locateButton.disabled = false;
        locateButton.textContent = "匹配当前位置";
      },
      () => {
        status.textContent = "浏览器未能定位；请从城市列表手动选择（当前" + citiesById.get(citySelect.value).name + "）。";
        locateButton.disabled = false;
        locateButton.textContent = "匹配当前位置";
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 12000 },
    );
  });
}

function handleShortcut(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  const layerKeys = { s: "stars", c: "constellations", b: "boundaries", m: "milkyWay", e: "ecliptic", g: "grid", l: "labels" };
  if (layerKeys[key]) {
    state.layers[layerKeys[key]] = !state.layers[layerKeys[key]];
    render();
    return;
  }
  if (key === "p") {
    requestLocation();
    return;
  }
  if (key === "r") {
    event.preventDefault();
    resetView();
    return;
  }
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    adjustZoom(0.12);
  } else if (event.key === "-") {
    event.preventDefault();
    adjustZoom(-0.12);
  }
}

canvas.addEventListener("pointerdown", startPointer);
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", () => {
  if (!pointerState) {
    state.hoverStarId = null;
    render();
  }
});
canvas.addEventListener("wheel", (event) => {
  if (state.homepageMode && !event.shiftKey) return;
  event.preventDefault();
  adjustZoom(event.deltaY > 0 ? -0.1 : 0.1);
}, { passive: false });
window.addEventListener("keydown", handleShortcut);
window.addEventListener("resize", render);
window.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

initializeScriptWidgetDownloads();

if (!hasFixedSnapshotDate) {
  setInterval(() => {
    state.date = new Date();
    render();
  }, 1000);
}

if (nativeLocationMode && !locationFromQuery) {
  canvasStatus.textContent = "等待手机位置以绘制本地星图。";
  window.CosmosWhisperRenderReady = false;
} else {
  requestAnimationFrame(() => {
    render();
    window.CosmosWhisperRenderReady = true;
    if (!nativeLocationMode && !loadLocation() && !locationFromQuery) requestLocation();
  });
}
