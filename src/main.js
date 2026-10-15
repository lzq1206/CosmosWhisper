import {
  formatDate,
  formatHours,
  localSiderealHours,
  planetaryBodies,
  solarAltitude,
} from "./astro.js";
import { SkyRenderer } from "./renderer.js";

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

const state = {
  date: new Date(),
  location: loadLocation() ?? { ...DEFAULT_LOCATION },
  timeRing: null,
  bodies: [],
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
  ensureTimeRing();
  state.bodies = planetaryBodies(state.date, state.location.lat, state.location.lon);
  const result = renderer.render(state);
  const lst = localSiderealHours(state.date, state.location.lon);
  canvasStatus.textContent = `${formatDate(state.date)}，${state.location.name}。可见 ${result.visibleCount} 颗五等及以上恒星，恒星时 ${formatHours(lst)}，${currentPhase()}。点击恒星选择，滚轮缩放。方位固定不随拖动改变。`;
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
  event.preventDefault();
  adjustZoom(event.deltaY > 0 ? -0.1 : 0.1);
}, { passive: false });
window.addEventListener("keydown", handleShortcut);
window.addEventListener("resize", render);
window.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

setInterval(() => {
  state.date = new Date();
  render();
}, 1000);

requestAnimationFrame(() => {
  render();
  if (!loadLocation()) requestLocation();
});
