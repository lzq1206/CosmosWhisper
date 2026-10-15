import {
  formatDate,
  formatHours,
  localSiderealHours,
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
  twilight: null,
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
  hoverStarId: null,
  selectedStarId: null,
};

let pointerState = null;
let locationRequestPending = false;
let twilightCacheKey = "";

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
  twilightCacheKey = "";
  render();
}

function localDayBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start, end, span: end.getTime() - start.getTime() };
}

function twilightKey(date, location) {
  const { start, end } = localDayBounds(date);
  return `${start.toISOString()}|${end.toISOString()}|${location.lat}|${location.lon}`;
}

function levelForAltitude(altitude) {
  return TWILIGHT_BANDS.find(({ low, high }) => altitude >= low && altitude < high)?.id ?? null;
}

function refineCrossing(startMs, endMs, threshold, location) {
  let low = startMs;
  let high = endMs;
  const altitudeAt = (time) => solarAltitude(new Date(time), location.lat, location.lon) - threshold;
  let lowValue = altitudeAt(low);
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const middle = (low + high) / 2;
    const middleValue = altitudeAt(middle);
    if (Math.sign(lowValue) === Math.sign(middleValue)) {
      low = middle;
      lowValue = middleValue;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

function calculateTwilight(date, location) {
  const { start, end, span } = localDayBounds(date);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const sampleStep = 60 * 1000;
  const sampleTimes = [];
  for (let time = startMs; time < endMs; time += sampleStep) sampleTimes.push(time);
  sampleTimes.push(endMs);

  const events = TWILIGHT_BANDS.map((band) => {
    const crossings = [];
    let previousTime = sampleTimes[0];
    let previousValue = solarAltitude(new Date(previousTime), location.lat, location.lon) - band.low;
    for (let index = 1; index < sampleTimes.length; index += 1) {
      const currentTime = sampleTimes[index];
      const currentValue = solarAltitude(new Date(currentTime), location.lat, location.lon) - band.low;
      if (previousValue === 0 || previousValue * currentValue < 0) {
        crossings.push(refineCrossing(previousTime, currentTime, band.low, location));
      }
      previousTime = currentTime;
      previousValue = currentValue;
    }
    return {
      id: band.id,
      threshold: band.low,
      fractions: crossings.map((time) => (time - startMs) / span),
    };
  });

  const breakpoints = [0, 1, ...events.flatMap((event) => event.fractions)]
    .sort((first, second) => first - second)
    .filter((value, index, values) => index === 0 || value - values[index - 1] > 0.0000001);
  const intervals = TWILIGHT_BANDS.map((band) => ({ id: band.id, label: band.label, intervals: [] }));
  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const from = breakpoints[index];
    const to = breakpoints[index + 1];
    const middle = startMs + ((from + to) / 2) * span;
    const level = levelForAltitude(solarAltitude(new Date(middle), location.lat, location.lon));
    const target = intervals.find((band) => band.id === level);
    if (!target) continue;
    const previous = target.intervals[target.intervals.length - 1];
    if (previous && Math.abs(previous.end - from) < 0.0000001) previous.end = to;
    else target.intervals.push({ start: from, end: to });
  }

  return { startMs, endMs, span, bands: intervals, events };
}

function ensureTwilight() {
  const key = twilightKey(state.date, state.location);
  if (key !== twilightCacheKey) {
    state.twilight = calculateTwilight(state.date, state.location);
    twilightCacheKey = key;
  }
  state.twilight.timeFraction = Math.min(1, Math.max(0, (state.date.getTime() - state.twilight.startMs) / state.twilight.span));
}

function currentPhase() {
  const altitude = solarAltitude(state.date, state.location.lat, state.location.lon);
  if (altitude >= 0) return "白昼";
  const band = TWILIGHT_BANDS.find(({ low, high }) => altitude >= low && altitude < high);
  return band?.label || "夜间";
}

function render() {
  ensureTwilight();
  const result = renderer.render(state);
  const lst = localSiderealHours(state.date, state.location.lon);
  canvasStatus.textContent = `${formatDate(state.date)}，${state.location.name}。可见 ${result.visibleCount} 颗五等及以上恒星，恒星时 ${formatHours(lst)}，当前${currentPhase()}。点击恒星选择，滚轮缩放。方位固定不随拖动改变。`;
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
