import { DEG, TAU, clamp, equatorialToHorizontal, localSiderealHours, planetaryBodies, solarAltitude } from "../../src/astro.js";
import { CONSTELLATIONS } from "../../src/data/constellations.js";
import { MILKY_WAY_RINGS } from "../../src/data/milkyWay.js";
import { STARS } from "../../src/data/stars.js";
import { CITY_BY_ID } from "../../src/data/cities.js";

const canvas = document.querySelector("#watch-canvas");
const status = document.querySelector("#watch-status");
const cityId = new URLSearchParams(window.location.search).get("city") || "beijing";
const city = CITY_BY_ID.get(cityId) || CITY_BY_ID.get("beijing");
const ctx = canvas.getContext("2d");
const state = { date: new Date(), latitudeSign: city.lat >= 0 ? 1 : -1, timeRing: null };
let metrics = null;
let timeRingKey = "";
const WATCH_ROTATION = Math.PI / 2;
const TWILIGHT_BANDS = [
  { id: "standard", low: -0.833, high: 0 },
  { id: "civil", low: -6, high: -0.833 },
  { id: "nautical", low: -12, high: -6 },
  { id: "astronomical", low: -18, high: -12 },
];
const TIME_COLORS = {
  day: "#f4f1df", standard: "#f6e2b4", civil: "#f2c36c", nautical: "#79aeea",
  astronomical: "#d59af4", moon: "#9bcdf7", night: "#1b335e",
};
const COLORS = {
  ink: "#f5f0df", muted: "#9ba9bf", gold: "#dcb870", goldBright: "#f5d68c",
  line: "rgba(122, 199, 214, .62)", boundary: "rgba(220, 157, 166, .28)",
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const edge = Math.min(rect.width, rect.height);
  metrics = { width: rect.width, height: rect.height, cx: rect.width / 2, cy: rect.height / 2, radius: edge / 2 - 20 };
  return true;
}

function declinationLimit() {
  return city.lat >= 0 ? Math.max(-90, city.lat - 90 - 20) : Math.min(90, city.lat + 90 + 20);
}

function outerProject(ra, dec) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  const centerDec = state.latitudeSign * 90;
  const polarDec = state.latitudeSign * horizontal.dec;
  const limit = state.latitudeSign * declinationLimit();
  const normalized = Math.abs(centerDec - polarDec) / Math.abs(centerDec - limit);
  if (!Number.isFinite(normalized) || normalized > 1.04) return null;
  const hourAngle = (localSiderealHours(state.date, city.lon) - horizontal.ra) * state.latitudeSign * 15 * DEG + WATCH_ROTATION;
  return { x: metrics.cx + Math.cos(hourAngle) * metrics.radius * normalized, y: metrics.cy + Math.sin(hourAngle) * metrics.radius * normalized };
}

function visibleProject(ra, dec) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  if (horizontal.altitude < -0.7) return null;
  const radius = metrics.radius * .5;
  const cx = metrics.cx; const cy = metrics.cy + metrics.radius * .25;
  const radial = radius * (1 - clamp(horizontal.altitude, 0, 90) / 90);
  const angle = horizontal.azimuth * DEG + WATCH_ROTATION;
  return { x: cx + Math.sin(angle) * radial, y: cy - Math.cos(angle) * radial };
}

function drawPath(points, project, close = false) {
  let started = false;
  for (const [ra, dec] of points) {
    const point = project(ra, dec);
    if (!point) { started = false; continue; }
    if (!started) { ctx.moveTo(point.x, point.y); started = true; } else ctx.lineTo(point.x, point.y);
  }
  if (close && started) ctx.closePath();
}

function localDayBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { startMs: start.getTime(), span: end.getTime() - start.getTime() };
}

function skyStateAt(date) {
  const altitude = solarAltitude(date, city.lat, city.lon);
  if (altitude >= 0) return "day";
  const twilight = TWILIGHT_BANDS.find(({ low, high }) => altitude >= low && altitude < high);
  if (twilight) return twilight.id;
  const moon = planetaryBodies(date, city.lat, city.lon).find((body) => body.id === "moon");
  return moon && moon.horizontal.altitude > 0 && moon.illumination >= .08 ? "moon" : "night";
}

function ensureTimeRing() {
  const bounds = localDayBounds(state.date);
  const key = `${bounds.startMs}|${bounds.span}|${city.lat}|${city.lon}`;
  if (key !== timeRingKey) {
    const segments = [];
    let previous = null; let start = 0;
    const steps = Math.ceil(bounds.span / (2 * 60 * 1000));
    for (let index = 0; index < steps; index += 1) {
      const from = bounds.startMs + index / steps * bounds.span;
      const to = bounds.startMs + (index + 1) / steps * bounds.span;
      const next = skyStateAt(new Date((from + to) / 2));
      const fromFraction = index / steps;
      if (next !== previous) {
        if (previous !== null) segments.push({ id: previous, start, end: fromFraction });
        previous = next; start = fromFraction;
      }
      if (index === steps - 1) segments.push({ id: next, start, end: 1 });
    }
    state.timeRing = { ...bounds, segments, timeFraction: 0 };
    timeRingKey = key;
  }
  state.timeRing.timeFraction = clamp((state.date.getTime() - state.timeRing.startMs) / state.timeRing.span, 0, 1);
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(metrics.cx, metrics.cy, 0, metrics.cx, metrics.cy, metrics.radius);
  gradient.addColorStop(0, "#122f57"); gradient.addColorStop(.68, "#071934"); gradient.addColorStop(1, "#020711");
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, metrics.radius, 0, TAU); ctx.fill();
}

function drawOuterSky() {
  ctx.save(); ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, metrics.radius - 5, 0, TAU); ctx.clip();
  ctx.beginPath(); for (const ring of MILKY_WAY_RINGS) drawPath(ring, outerProject, true);
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(126,168,209,.25)"; ctx.lineWidth = .6; ctx.setLineDash([2, 7]);
  for (let dec = 0; dec <= 80; dec += 20) {
    const centerDec = state.latitudeSign * 90; const limit = state.latitudeSign * declinationLimit();
    const radius = Math.abs(centerDec - state.latitudeSign * dec) / Math.abs(centerDec - limit) * metrics.radius;
    ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, radius, 0, TAU); ctx.stroke();
  }
  for (const constellation of CONSTELLATIONS) {
    for (const boundary of constellation.boundaryParts) { ctx.beginPath(); drawPath(boundary, outerProject); ctx.strokeStyle = COLORS.boundary; ctx.stroke(); }
    for (const line of constellation.lines) { ctx.beginPath(); drawPath(line, outerProject); ctx.strokeStyle = "rgba(121,200,210,.35)"; ctx.stroke(); }
  }
  ctx.setLineDash([]);
  for (const star of STARS) {
    const point = outerProject(star.ra, star.dec); if (!point) continue;
    const radius = clamp(1 + (3.6 - star.magnitude) * .5, .8, 3.7);
    const color = star.tone === "warm" ? "#e8bd7b" : star.tone === "blue" ? "#a9cbe7" : "#dce3ee";
    ctx.fillStyle = color; ctx.globalAlpha = .52; ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawVisibleWindow() {
  const cx = metrics.cx; const cy = metrics.cy + metrics.radius * .25; const radius = metrics.radius * .5;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.clip();
  ctx.strokeStyle = "rgba(243,210,138,.62)"; ctx.lineWidth = 1;
  for (const altitude of [30, 60]) { const radial = radius * (1 - altitude / 90); ctx.beginPath(); ctx.arc(cx, cy, radial, 0, TAU); ctx.stroke(); }
  for (let az = 0; az < 360; az += 30) { const angle = az * DEG + WATCH_ROTATION; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius); ctx.stroke(); }
  for (const constellation of CONSTELLATIONS) {
    for (const line of constellation.lines) { ctx.beginPath(); drawPath(line, visibleProject); ctx.strokeStyle = "rgba(121,200,210,.62)"; ctx.setLineDash([3,5]); ctx.stroke(); }
  }
  ctx.setLineDash([]);
  for (const star of STARS) {
    const point = visibleProject(star.ra, star.dec); if (!point) continue;
    const size = clamp(1.1 + (3.6 - star.magnitude) * .62, 1, 4.8);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : COLORS.ink;
    ctx.fillStyle = color; ctx.globalAlpha = clamp(1.02 - star.magnitude / 7, .45, 1); ctx.beginPath(); ctx.arc(point.x, point.y, size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (star.magnitude <= 1.2) { ctx.fillStyle = "rgba(240,238,229,.8)"; ctx.font = "10px Segoe UI,sans-serif"; ctx.fillText(star.name, point.x + size + 3, point.y - size - 2); }
  }
  for (const body of planetaryBodies(state.date, city.lat, city.lon)) {
    const point = visibleProject(body.ra, body.dec); if (!point) continue;
    ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(point.x, point.y, body.size, 0, TAU); ctx.fill();
    ctx.font = "10px Segoe UI,sans-serif"; ctx.fillText(body.name, point.x + body.size + 4, point.y - body.size - 2);
  }
  ctx.restore();
  ctx.strokeStyle = COLORS.goldBright; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.stroke();
  ctx.fillStyle = COLORS.ink; ctx.font = "10px Segoe UI,sans-serif"; ctx.textAlign = "center"; ctx.fillText("当前可见范围", cx, cy + radius - 11);
}

function drawBezel() {
  const { cx, cy, radius } = metrics; ctx.save();
  ctx.strokeStyle = "rgba(218,182,112,.85)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, radius + 3, 0, TAU); ctx.stroke();
  ctx.strokeStyle = "rgba(217,182,110,.38)"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, radius + 10, 0, TAU); ctx.stroke();
  for (let index = 0; index < 72; index += 1) {
    const angle = -Math.PI / 2 + index / 72 * TAU; const length = index % 6 === 0 ? 10 : index % 3 === 0 ? 6 : 3;
    ctx.strokeStyle = index % 6 === 0 ? "rgba(240,224,178,.9)" : "rgba(154,174,204,.6)"; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (radius + 13 - length), cy + Math.sin(angle) * (radius + 13 - length)); ctx.lineTo(cx + Math.cos(angle) * (radius + 13), cy + Math.sin(angle) * (radius + 13)); ctx.stroke();
  }
  ctx.fillStyle = COLORS.ink; ctx.font = "10px Segoe UI,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [label, fraction] of [["0h",0],["6h",.25],["12h",.5],["18h",.75]]) { const angle = -Math.PI / 2 + fraction * TAU; const distance = radius + 28; ctx.fillText(label, cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance); }
  const fraction = localSiderealHours(state.date, city.lon) / 24; const angle = -Math.PI / 2 + fraction * TAU;
  ctx.strokeStyle = COLORS.goldBright; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * (radius + 2), cy + Math.sin(angle) * (radius + 2)); ctx.lineTo(cx + Math.cos(angle) * (radius + 19), cy + Math.sin(angle) * (radius + 19)); ctx.stroke();
  ctx.font = "10px Segoe UI,sans-serif"; ctx.fillStyle = COLORS.gold; ctx.fillText("PLANISPHERE", cx, cy - radius - 35); ctx.fillStyle = COLORS.muted; ctx.fillText(city.name, cx, cy + radius + 36);
  ctx.restore();
}

function drawPole() {
  ctx.save(); ctx.fillStyle = COLORS.goldBright; ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(245,214,140,.65)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, 13, 0, TAU); ctx.stroke(); ctx.fillStyle = COLORS.ink; ctx.font = "10px Segoe UI,sans-serif"; ctx.textAlign = "center"; ctx.fillText("北极点", metrics.cx, metrics.cy + 28); ctx.restore();
}

function render() {
  if (!resize()) return;
  ctx.clearRect(0, 0, metrics.width, metrics.height);
  drawBackground(); drawOuterSky(); drawVisibleWindow(); drawBezel(); drawPole();
  status.textContent = `${city.name} · Planisphere · 北极点旋转中心 · 恒星时 ${localSiderealHours(state.date, city.lon).toFixed(2)}h`;
}

window.addEventListener("resize", render);
setInterval(() => { state.date = new Date(); render(); }, 1000);
requestAnimationFrame(render);
