import {
  formatDate,
  formatHours,
  localSiderealHours,
} from "./astro.js";
import { SkyRenderer } from "./renderer.js";

const DEFAULT_LOCATION = {
  lat: 31.2,
  lon: 121.5,
  name: "默认地平线",
  source: "default",
};
const STORAGE_KEY = "cosmos-whisper-location";
const canvas = document.querySelector("#sky-canvas");
const canvasStatus = document.querySelector("#canvas-status");
const renderer = new SkyRenderer(canvas);

const state = {
  date: new Date(),
  location: loadLocation() ?? { ...DEFAULT_LOCATION },
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
  rotation: 0,
  pan: { x: 0, y: 0 },
  hoverStarId: null,
  selectedStarId: null,
};

let pointerState = null;
let locationRequestPending = false;

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
  render();
}

function render() {
  const result = renderer.render(state);
  const lst = localSiderealHours(state.date, state.location.lon);
  canvasStatus.textContent = `${formatDate(state.date)}，${state.location.name}。可见 ${result.visibleCount} 颗亮星，恒星时 ${formatHours(lst)}。拖动旋转，滚轮缩放。`;
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
    startRotation: state.rotation,
    moved: false,
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
}

function movePointer(event) {
  if (!pointerState || pointerState.pointerId !== event.pointerId) {
    updateHover(event);
    return;
  }
  const { x, y } = coordinatesForPointer(event);
  if (Math.abs(x - pointerState.startX) > 3 || Math.abs(y - pointerState.startY) > 3) pointerState.moved = true;
  if (pointerState.moved) {
    state.rotation = pointerState.startRotation + (x - pointerState.startX) / (renderer.metrics?.baseRadius || 250);
    render();
  }
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
  canvas.classList.remove("is-dragging");
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
  state.rotation = 0;
  state.pan = { x: 0, y: 0 };
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
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    state.rotation -= 0.08;
    render();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    state.rotation += 0.08;
    render();
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
