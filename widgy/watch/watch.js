import { DEG, TAU, clamp, eclipticToEquatorial, equatorialOfDateToHorizontal, equatorialToHorizontal, localSiderealHours, planetaryBodies } from "../../src/astro.js";
import { CONSTELLATIONS } from "../../src/data/constellations.js";
import { MILKY_WAY_RINGS } from "../../src/data/milkyWay.js";
import { STARS } from "../../src/data/stars.js";
import { CITY_BY_ID } from "../../src/data/cities.js";

const canvas = document.querySelector("#watch-canvas");
const status = document.querySelector("#watch-status");
const cityId = new URLSearchParams(window.location.search).get("city") || "beijing";
const city = CITY_BY_ID.get(cityId) || CITY_BY_ID.get("beijing");
const ctx = canvas.getContext("2d");
const state = { date: new Date(), latitudeSign: city.lat >= 0 ? 1 : -1 };
const WATCH_ROTATION = 90 * DEG;
let metrics = null;

const COLORS = {
  ink: "#f5f0df",
  muted: "#9ba9bf",
  gold: "#dcb870",
  goldBright: "#f5d68c",
  line: "rgba(122, 199, 214, .62)",
  boundary: "rgba(220, 157, 166, .28)",
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

function declinationLimit() {
  return city.lat >= 0 ? Math.max(-90, city.lat - 90 - 20) : Math.min(90, city.lat + 90 + 20);
}

function projectHourAngle(hourAngle, normalized) {
  const angle = WATCH_ROTATION - hourAngle;
  return {
    x: metrics.cx + Math.cos(angle) * metrics.radius * normalized,
    y: metrics.cy + Math.sin(angle) * metrics.radius * normalized,
  };
}

function projectEquatorial(ra, dec) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  const centerDec = state.latitudeSign * 90;
  const polarDec = state.latitudeSign * horizontal.dec;
  const limit = state.latitudeSign * declinationLimit();
  const normalized = Math.abs(centerDec - polarDec) / Math.abs(centerDec - limit);
  if (!Number.isFinite(normalized) || normalized > 1.04) return null;
  const hourAngle = (localSiderealHours(state.date, city.lon) - horizontal.ra) * state.latitudeSign * 15 * DEG;
  return projectHourAngle(hourAngle, normalized);
}

function projectOfDate(ra, dec) {
  const horizontal = equatorialOfDateToHorizontal(ra, dec, state.date, city.lat, city.lon);
  const centerDec = state.latitudeSign * 90;
  const polarDec = state.latitudeSign * dec;
  const limit = state.latitudeSign * declinationLimit();
  const normalized = Math.abs(centerDec - polarDec) / Math.abs(centerDec - limit);
  if (!Number.isFinite(normalized) || normalized > 1.04) return null;
  const hourAngle = (localSiderealHours(state.date, city.lon) - ra) * state.latitudeSign * 15 * DEG;
  return { ...projectHourAngle(hourAngle, normalized), altitude: horizontal.altitude };
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

function drawBackground() {
  const gradient = ctx.createRadialGradient(metrics.cx, metrics.cy, 0, metrics.cx, metrics.cy, metrics.radius);
  gradient.addColorStop(0, "#122f57"); gradient.addColorStop(.68, "#071934"); gradient.addColorStop(1, "#020711");
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, metrics.radius, 0, TAU); ctx.fill();
}

function drawGrid() {
  ctx.save(); ctx.strokeStyle = "rgba(145,174,210,.28)"; ctx.lineWidth = .65; ctx.setLineDash([2, 7]);
  for (let dec = 0; dec <= 80; dec += 20) {
    const centerDec = state.latitudeSign * 90; const limit = state.latitudeSign * declinationLimit();
    const normalized = Math.abs(centerDec - state.latitudeSign * dec) / Math.abs(centerDec - limit);
    ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, metrics.radius * normalized, 0, TAU); ctx.stroke();
  }
  for (let hour = 0; hour < 24; hour += 2) {
    const points = []; for (let dec = 0; dec >= declinationLimit(); dec -= 2) points.push([hour, state.latitudeSign * dec]);
    ctx.beginPath(); drawPath(points, projectEquatorial); ctx.stroke();
  }
  ctx.restore();
}

function drawAuxiliaryPlanes() {
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(244, 238, 209, .68)";
  const equator = [];
  for (let ra = 0; ra <= 24; ra += .25) equator.push([ra, 0]);
  ctx.beginPath(); drawPath(equator, projectEquatorial); ctx.stroke();

  ctx.strokeStyle = "rgba(242, 195, 108, .86)";
  const ecliptic = [];
  for (let longitude = 0; longitude <= 360; longitude += 2) {
    const coordinates = eclipticToEquatorial(longitude, state.date);
    ecliptic.push([coordinates.ra, coordinates.dec]);
  }
  ctx.beginPath(); drawPath(ecliptic, projectOfDate); ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = "10px Segoe UI,sans-serif";
  ctx.fillStyle = "rgba(244,238,209,.85)";
  const equatorLabel = projectEquatorial(6, 0);
  if (equatorLabel) ctx.fillText("天赤道", equatorLabel.x + 5, equatorLabel.y - 5);
  ctx.fillStyle = "rgba(242,195,108,.9)";
  const eclipticLabel = projectOfDate(6, 0);
  if (eclipticLabel) ctx.fillText("黄道", eclipticLabel.x + 5, eclipticLabel.y + 12);
  ctx.restore();
}

function drawGalaxy() {
  ctx.save(); ctx.beginPath();
  for (const ring of MILKY_WAY_RINGS) drawPath(ring, projectEquatorial, true);
  ctx.fillStyle = "rgba(255,255,255,.09)"; ctx.fill("evenodd"); ctx.restore();
}

function drawConstellations() {
  ctx.save(); ctx.setLineDash([3, 5]);
  for (const constellation of CONSTELLATIONS) {
    for (const boundary of constellation.boundaryParts) { ctx.beginPath(); drawPath(boundary, projectEquatorial); ctx.strokeStyle = COLORS.boundary; ctx.lineWidth = .8; ctx.stroke(); }
    for (const line of constellation.lines) { ctx.beginPath(); drawPath(line, projectEquatorial); ctx.strokeStyle = COLORS.line; ctx.lineWidth = 1; ctx.stroke(); }
  }
  ctx.restore();
}

function drawStars() {
  for (const star of STARS) {
    const point = projectEquatorial(star.ra, star.dec); if (!point) continue;
    const radius = clamp(1 + (3.6 - star.magnitude) * .56, .85, 4.4);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : COLORS.ink;
    ctx.fillStyle = color; ctx.globalAlpha = clamp(1.02 - star.magnitude / 7, .42, 1); ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (star.magnitude <= 1.2) { ctx.fillStyle = "rgba(240,238,229,.8)"; ctx.font = "9px Segoe UI,sans-serif"; ctx.fillText(star.name, point.x + radius + 3, point.y - radius - 2); }
  }
}

function drawBodies() {
  for (const body of planetaryBodies(state.date, city.lat, city.lon)) {
    const point = projectOfDate(body.ra, body.dec); if (!point) continue;
    ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(point.x, point.y, body.size, 0, TAU); ctx.fill();
    ctx.fillStyle = body.color; ctx.font = "9px Segoe UI,sans-serif"; ctx.fillText(body.name, point.x + body.size + 3, point.y - body.size - 2);
  }
}

function horizonEquatorialAtAzimuth(azimuthDegrees, lst) {
  const latitude = city.lat * DEG;
  const azimuth = azimuthDegrees * DEG;
  const sinDec = Math.cos(latitude) * Math.cos(azimuth);
  const dec = Math.asin(clamp(sinDec, -1, 1)) / DEG;
  const cosDec = Math.max(.000001, Math.cos(dec * DEG));
  const sinHourAngle = -Math.sin(azimuth) / cosDec;
  const cosHourAngle = -Math.sin(latitude) * Math.cos(azimuth) / cosDec;
  const hourAngle = Math.atan2(sinHourAngle, cosHourAngle) / DEG / 15;
  return [lst - hourAngle, dec];
}

function horizonEquatorialPath() {
  const points = [];
  const lst = localSiderealHours(state.date, city.lon);
  for (let index = 0; index <= 360; index += 1) points.push(horizonEquatorialAtAzimuth(index, lst));
  return points;
}

function drawHorizonBoundary() {
  const horizon = horizonEquatorialPath();
  ctx.save();
  ctx.strokeStyle = "rgba(245,214,140,.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); drawPath(horizon, projectOfDate, true); ctx.stroke();
  ctx.restore();
}

function drawCompassDirections() {
  ctx.save();
  ctx.font = "bold 12px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(3,8,23,.96)";
  ctx.fillStyle = COLORS.goldBright;
  const lst = localSiderealHours(state.date, city.lon);
  for (const [label, azimuth] of [["北", 0], ["东", 90], ["南", 180], ["西", 270]]) {
    const [ra, dec] = horizonEquatorialAtAzimuth(azimuth, lst);
    const point = projectOfDate(ra, dec);
    if (!point) continue;
    ctx.strokeText(label, point.x, point.y);
    ctx.fillText(label, point.x, point.y);
  }
  ctx.restore();
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
  drawBackground();
  ctx.save(); ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, metrics.radius, 0, TAU); ctx.clip();
  drawGalaxy(); drawGrid(); drawAuxiliaryPlanes(); drawConstellations(); drawStars(); drawBodies();
  ctx.restore();
  drawHorizonBoundary(); drawCompassDirections(); drawBezel(); drawPole();
  status.textContent = `${city.name} · Planisphere · 北极点旋转中心 · 恒星时 ${localSiderealHours(state.date, city.lon).toFixed(2)}h`;
}

window.addEventListener("resize", render);
setInterval(() => { state.date = new Date(); render(); }, 1000);
requestAnimationFrame(render);
