import { DEG, TAU, clamp, equatorialToHorizontal, localSiderealHours, planetaryBodies } from "../src/astro.js";
import { CONSTELLATIONS } from "../src/data/constellations.js";
import { MILKY_WAY_RINGS } from "../src/data/milkyWay.js";
import { STARS } from "../src/data/stars.js";
import { CITY_BY_ID } from "../src/data/cities.js";

const canvas = document.querySelector("#astrodea-canvas");
const status = document.querySelector("#astrodea-status");
const cityId = new URLSearchParams(window.location.search).get("city") || "beijing";
const city = CITY_BY_ID.get(cityId) || CITY_BY_ID.get("beijing");
const ctx = canvas.getContext("2d");
const state = { date: new Date(), zoom: 1, latitudeSign: city.lat >= 0 ? 1 : -1 };
let metrics = null;

const COLORS = {
  ink: "#f1ebdc",
  steel: "rgba(152, 174, 211, .44)",
  gold: "#d9b66e",
  goldBright: "#f3d28a",
  blue: "#7bb9db",
  boundary: "rgba(215, 150, 157, .24)",
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const edge = Math.min(rect.width, rect.height);
  metrics = { width: rect.width, height: rect.height, cx: rect.width / 2, cy: rect.height / 2, radius: edge / 2 - 20 };
  return true;
}

function horizonScale() {
  return Math.max(.25, Math.tan(Math.abs(city.lat) * DEG / 2));
}

function outerProject(ra, dec) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  const polarDec = state.latitudeSign * horizontal.dec;
  const radial = Math.tan((90 - polarDec) * DEG / 2) / horizonScale();
  if (!Number.isFinite(radial) || radial > 1.04) return null;
  const hourAngle = (localSiderealHours(state.date, city.lon) - horizontal.ra) * state.latitudeSign * 15 * DEG;
  return {
    x: metrics.cx + Math.sin(hourAngle) * metrics.radius * radial,
    y: metrics.cy - Math.cos(hourAngle) * metrics.radius * radial,
  };
}

function visibleProject(ra, dec) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  if (horizontal.altitude < -0.7) return null;
  const window = { cx: metrics.cx, cy: metrics.cy + metrics.radius * .25, radius: metrics.radius * .5 };
  const radial = window.radius * (1 - clamp(horizontal.altitude, 0, 90) / 90);
  const angle = horizontal.azimuth * DEG;
  return { x: window.cx + Math.sin(angle) * radial, y: window.cy - Math.cos(angle) * radial };
}

function drawPath(points, project, close = false) {
  let started = false;
  for (const [ra, dec] of points) {
    const point = project(ra, dec);
    if (!point) { started = false; continue; }
    if (!started) { ctx.moveTo(point.x, point.y); started = true; }
    else ctx.lineTo(point.x, point.y);
  }
  if (close && started) ctx.closePath();
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(metrics.cx, metrics.cy, 0, metrics.cx, metrics.cy, metrics.radius);
  gradient.addColorStop(0, "#122c54");
  gradient.addColorStop(.7, "#07172f");
  gradient.addColorStop(1, "#020711");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(metrics.cx, metrics.cy, metrics.radius, 0, TAU);
  ctx.fill();
}

function drawOuterSky() {
  ctx.save();
  ctx.beginPath();
  ctx.arc(metrics.cx, metrics.cy, metrics.radius - 5, 0, TAU);
  ctx.clip();
  ctx.beginPath();
  for (const ring of MILKY_WAY_RINGS) drawPath(ring, outerProject, true);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(126,168,209,.25)";
  ctx.lineWidth = .6;
  ctx.setLineDash([2, 7]);
  for (let dec = 0; dec <= 80; dec += 20) {
    const points = [];
    for (let ra = 0; ra <= 24; ra += .25) points.push([ra, state.latitudeSign * dec]);
    ctx.beginPath(); drawPath(points, outerProject); ctx.stroke();
  }
  for (const constellation of CONSTELLATIONS) {
    for (const boundary of constellation.boundaryParts) { ctx.beginPath(); drawPath(boundary, outerProject); ctx.strokeStyle = COLORS.boundary; ctx.stroke(); }
    for (const line of constellation.lines) { ctx.beginPath(); drawPath(line, outerProject); ctx.strokeStyle = "rgba(121,200,210,.35)"; ctx.stroke(); }
  }
  ctx.setLineDash([]);
  for (const star of STARS) {
    const point = outerProject(star.ra, star.dec);
    if (!point) continue;
    const radius = clamp(1 + (3.6 - star.magnitude) * .5, .8, 3.7);
    const color = star.tone === "warm" ? "#e8bd7b" : star.tone === "blue" ? "#a9cbe7" : "#dce3ee";
    ctx.fillStyle = color;
    ctx.globalAlpha = .52;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawVisibleWindow() {
  const window = { cx: metrics.cx, cy: metrics.cy + metrics.radius * .25, radius: metrics.radius * .5 };
  ctx.save();
  ctx.beginPath(); ctx.arc(window.cx, window.cy, window.radius, 0, TAU); ctx.clip();
  ctx.fillStyle = "rgba(3, 8, 20, .62)"; ctx.fill();
  ctx.strokeStyle = "rgba(243,210,138,.62)"; ctx.lineWidth = 1;
  for (const dec of [30,60]) {
    const radial = window.radius * (1 - dec / 90);
    ctx.beginPath(); ctx.arc(window.cx, window.cy, radial, 0, TAU); ctx.stroke();
  }
  for (let az = 0; az < 360; az += 30) {
    const angle = az * DEG;
    ctx.beginPath(); ctx.moveTo(window.cx, window.cy); ctx.lineTo(window.cx + Math.sin(angle) * window.radius, window.cy - Math.cos(angle) * window.radius); ctx.stroke();
  }
  for (const constellation of CONSTELLATIONS) {
    for (const line of constellation.lines) { ctx.beginPath(); drawPath(line, visibleProject); ctx.strokeStyle = "rgba(121,200,210,.62)"; ctx.setLineDash([3,5]); ctx.stroke(); }
  }
  ctx.setLineDash([]);
  for (const star of STARS) {
    const point = visibleProject(star.ra, star.dec);
    if (!point) continue;
    const radius = clamp(1.1 + (3.6 - star.magnitude) * .62, 1, 4.8);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : COLORS.ink;
    ctx.fillStyle = color; ctx.globalAlpha = clamp(1.02 - star.magnitude / 7, .45, 1);
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (star.magnitude <= 1.2) { ctx.fillStyle = "rgba(240,238,229,.8)"; ctx.font = "10px Segoe UI,sans-serif"; ctx.fillText(star.name, point.x + radius + 3, point.y - radius - 2); }
  }
  for (const body of planetaryBodies(state.date, city.lat, city.lon)) {
    const point = visibleProject(body.ra, body.dec);
    if (!point) continue;
    ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(point.x, point.y, body.size, 0, TAU); ctx.fill();
    ctx.font = "10px Segoe UI,sans-serif"; ctx.fillText(body.name, point.x + body.size + 4, point.y - body.size - 2);
  }
  ctx.restore();
  ctx.strokeStyle = COLORS.goldBright; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(window.cx, window.cy, window.radius, 0, TAU); ctx.stroke();
  ctx.fillStyle = COLORS.ink; ctx.font = "10px Segoe UI,sans-serif"; ctx.textAlign = "center"; ctx.fillText("当前可见范围", window.cx, window.cy + window.radius - 11);
}

function drawBezel() {
  const { cx, cy, radius } = metrics;
  ctx.save();
  ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, radius + 3, 0, TAU); ctx.stroke();
  ctx.strokeStyle = "rgba(217,182,110,.4)"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, radius + 10, 0, TAU); ctx.stroke();
  for (let index = 0; index < 72; index += 1) {
    const angle = -Math.PI / 2 + index / 72 * TAU;
    const length = index % 6 === 0 ? 10 : index % 3 === 0 ? 6 : 3;
    ctx.strokeStyle = index % 6 === 0 ? "rgba(240,224,178,.82)" : "rgba(154,174,204,.6)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (radius + 13 - length), cy + Math.sin(angle) * (radius + 13 - length));
    ctx.lineTo(cx + Math.cos(angle) * (radius + 13), cy + Math.sin(angle) * (radius + 13));
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.ink; ctx.font = "10px Segoe UI,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [label, fraction] of [["0h",0],["6h",.25],["12h",.5],["18h",.75]]) {
    const angle = -Math.PI / 2 + fraction * TAU; const distance = radius + 27;
    ctx.fillText(label, cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance);
  }
  const fraction = localSiderealHours(state.date, city.lon) / 24; const angle = -Math.PI / 2 + fraction * TAU;
  ctx.strokeStyle = COLORS.goldBright; ctx.lineWidth = 2.4; ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle) * (radius + 2), cy + Math.sin(angle) * (radius + 2));
  ctx.lineTo(cx + Math.cos(angle) * (radius + 19), cy + Math.sin(angle) * (radius + 19)); ctx.stroke();
  ctx.font = "10px Segoe UI,sans-serif"; ctx.fillStyle = COLORS.gold; ctx.fillText("CELESTIAL DIAL", cx, cy - radius - 35);
  ctx.fillStyle = COLORS.muted; ctx.fillText(city.name, cx, cy + radius + 36);
  ctx.restore();
}

function render() {
  if (!resize()) return;
  ctx.clearRect(0, 0, metrics.width, metrics.height);
  drawBackground(); drawOuterSky(); drawVisibleWindow(); drawBezel();
  status.textContent = `${city.name} · Astrodea 风格活动星图 · 恒星时 ${localSiderealHours(state.date, city.lon).toFixed(2)}h`;
}

window.addEventListener("resize", render);
setInterval(() => { state.date = new Date(); render(); }, 1000);
requestAnimationFrame(render);
