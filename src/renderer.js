import {
  DEG,
  TAU,
  clamp,
  eclipticToHorizontal,
  equatorialToHorizontal,
  formatAltitude,
  formatAzimuth,
  formatHours,
} from "./astro.js";
import { CONSTELLATIONS } from "./data/constellations.js";
import { MILKY_WAY_RINGS } from "./data/milkyWay.js";
import { STARS } from "./data/stars.js";

const COLORS = {
  ink: "#f0eee5",
  star: "#f2f0e7",
  starWarm: "#ffd596",
  starBlue: "#c9dcff",
  cyan: "#79c8d2",
  gold: "#f2c36c",
  rose: "#d89b9e",
  grid: "#697791",
  muted: "#8993ab",
  sky: "#071027",
};

const visibleAltitude = (altitude) => altitude >= -0.7;

function pathFromEquatorial(ctx, points, project) {
  let started = false;
  for (const [ra, dec] of points) {
    const point = project(ra, dec);
    if (!point) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(point.x, point.y);
      started = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
}

function starColor(tone) {
  if (tone === "warm") return COLORS.starWarm;
  if (tone === "blue") return COLORS.starBlue;
  return COLORS.star;
}

function localClockFraction(date) {
  return (date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600) / 24;
}

export class SkyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.metrics = null;
    this.hitTargets = [];
    this.pixelRatio = 1;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * pixelRatio);
    const height = Math.round(rect.height * pixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height || this.pixelRatio !== pixelRatio) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.pixelRatio = pixelRatio;
    }
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.metrics = {
      width: rect.width,
      height: rect.height,
      centerX: rect.width / 2,
      centerY: rect.height / 2,
      baseRadius: Math.min(rect.width, rect.height) * 0.34,
    };
  }

  projectHorizontal(horizontal, state) {
    if (!this.metrics || !visibleAltitude(horizontal.altitude)) return null;
    const { baseRadius, centerX, centerY } = this.metrics;
    const radius = baseRadius * state.zoom * (1 - clamp(horizontal.altitude, 0, 90) / 90);
    const angle = horizontal.azimuth * DEG;
    return {
      x: centerX + radius * Math.sin(angle),
      y: centerY - radius * Math.cos(angle),
      radius,
      altitude: horizontal.altitude,
      azimuth: horizontal.azimuth,
    };
  }

  projectEquatorial(ra, dec, state) {
    return this.projectHorizontal(
      equatorialToHorizontal(ra, dec, state.date, state.location.lat, state.location.lon),
      state,
    );
  }

  projectEquatorialUnclipped(ra, dec, state) {
    if (!this.metrics) return null;
    const horizontal = equatorialToHorizontal(ra, dec, state.date, state.location.lat, state.location.lon);
    const { baseRadius, centerX, centerY } = this.metrics;
    const radius = baseRadius * state.zoom * (1 - clamp(horizontal.altitude, -90, 90) / 90);
    const angle = horizontal.azimuth * DEG;
    return {
      x: centerX + radius * Math.sin(angle),
      y: centerY - radius * Math.cos(angle),
    };
  }

  render(state) {
    this.resize();
    if (!this.metrics) return { visibleCount: 0 };
    const { width, height, centerX, centerY, baseRadius } = this.metrics;
    const ctx = this.ctx;
    const center = {
      x: centerX,
      y: centerY,
    };
    const skyRadius = baseRadius * state.zoom;

    ctx.clearRect(0, 0, width, height);
    this.hitTargets = [];
    this.drawSurface(ctx, center, skyRadius, state);

    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, skyRadius, 0, TAU);
    ctx.clip();
    this.drawBackgroundDust(ctx, center, skyRadius);
    if (state.layers.milkyWay) this.drawMilkyWay(ctx, state);
    if (state.layers.grid) this.drawCoordinateGrid(ctx, state);
    if (state.layers.ecliptic) this.drawEcliptic(ctx, state);
    if (state.layers.boundaries) this.drawBoundaries(ctx, state);
    if (state.layers.constellations) this.drawConstellationLines(ctx, state);
    const visibleCount = state.layers.stars ? this.drawStars(ctx, state) : 0;
    this.drawBodies(ctx, state);
    if (state.layers.labels) this.drawConstellationLabels(ctx, state);
    ctx.restore();

    this.drawHorizon(ctx, center, skyRadius, state);
    this.drawTimeRing(ctx, center, skyRadius, state);
    return { visibleCount };
  }

  drawSurface(ctx, center, skyRadius) {
    const gradient = ctx.createRadialGradient(center.x, center.y, skyRadius * 0.02, center.x, center.y, skyRadius * 1.05);
    gradient.addColorStop(0, "#0e2045");
    gradient.addColorStop(0.56, "#091736");
    gradient.addColorStop(1, "#030817");
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center.x, center.y, skyRadius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawBackgroundDust(ctx, center, skyRadius) {
    ctx.save();
    for (let index = 0; index < 170; index += 1) {
      const angle = ((index * 137.508) % 360) * DEG;
      const distance = Math.sqrt(((index * 47) % 997) / 997) * skyRadius * 0.98;
      const x = center.x + Math.sin(angle) * distance;
      const y = center.y - Math.cos(angle) * distance;
      const alpha = 0.12 + ((index * 17) % 8) / 100;
      const radius = 0.35 + ((index * 19) % 11) / 20;
      ctx.fillStyle = `rgba(174, 194, 238, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMilkyWay(ctx, state) {
    ctx.save();
    ctx.beginPath();
    for (const ring of MILKY_WAY_RINGS) {
      pathFromEquatorial(ctx, ring, (ra, dec) => this.projectEquatorialUnclipped(ra, dec, state));
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.11)";
    ctx.fill("evenodd");
    ctx.restore();
  }

  drawCoordinateGrid(ctx, state) {
    ctx.save();
    ctx.lineWidth = 0.65;
    ctx.strokeStyle = "rgba(119, 140, 176, 0.2)";
    ctx.setLineDash([2, 7]);
    for (let hour = 0; hour < 24; hour += 2) {
      const points = [];
      for (let dec = -90; dec <= 90; dec += 2) points.push([hour, dec]);
      ctx.beginPath();
      pathFromEquatorial(ctx, points, (ra, declination) => this.projectEquatorial(ra, declination, state));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let dec = -60; dec <= 60; dec += 30) {
      const points = [];
      for (let hour = 0; hour <= 24; hour += 0.25) points.push([hour, dec]);
      ctx.beginPath();
      pathFromEquatorial(ctx, points, (ra, declination) => this.projectEquatorial(ra, declination, state));
      ctx.strokeStyle = dec === 0 ? "rgba(153, 173, 211, 0.35)" : "rgba(119, 140, 176, 0.2)";
      ctx.stroke();
    }
    ctx.restore();

    const visibleRaLabels = [0, 6, 12, 18];
    ctx.save();
    ctx.fillStyle = "rgba(164, 181, 216, 0.58)";
    ctx.font = "9px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    for (const hour of visibleRaLabels) {
      const point = this.projectEquatorial(hour, 0, state);
      if (!point) continue;
      ctx.fillText(`${String(hour).padStart(2, "0")}h`, point.x, point.y - 8);
    }
    ctx.restore();
  }

  drawEcliptic(ctx, state) {
    const points = [];
    for (let longitude = 0; longitude <= 360; longitude += 2) {
      const horizontal = eclipticToHorizontal(longitude, state.date, state.location.lat, state.location.lon);
      points.push({ horizontal, longitude });
    }
    ctx.save();
    ctx.beginPath();
    let started = false;
    for (const entry of points) {
      const point = this.projectHorizontal(entry.horizontal, state);
      if (!point) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(point.x, point.y);
        started = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.strokeStyle = "rgba(242, 195, 108, 0.72)";
    ctx.lineWidth = 1.05;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.restore();

    const marker = this.projectHorizontal(eclipticToHorizontal(0, state.date, state.location.lat, state.location.lon), state);
    if (marker) {
      ctx.save();
      ctx.fillStyle = "rgba(242, 195, 108, 0.78)";
      ctx.font = "9px Segoe UI, sans-serif";
      ctx.fillText("黄道", marker.x + 6, marker.y - 6);
      ctx.restore();
    }
  }

  drawBoundaries(ctx, state) {
    ctx.save();
    ctx.strokeStyle = "rgba(216, 155, 158, 0.28)";
    ctx.lineWidth = 0.65;
    ctx.setLineDash([3, 5]);
    for (const constellation of CONSTELLATIONS) {
      for (const boundary of constellation.boundaryParts) {
        ctx.beginPath();
        pathFromEquatorial(ctx, boundary, (ra, dec) => this.projectEquatorial(ra, dec, state));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawConstellationLines(ctx, state) {
    ctx.save();
    ctx.strokeStyle = "rgba(121, 200, 210, 0.68)";
    ctx.lineWidth = Math.max(0.7, 0.9 * state.zoom);
    ctx.setLineDash([3, 4]);
    ctx.lineCap = "round";
    for (const constellation of CONSTELLATIONS) {
      for (const line of constellation.lines) {
        ctx.beginPath();
        pathFromEquatorial(ctx, line, (ra, dec) => this.projectEquatorial(ra, dec, state));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawStars(ctx, state) {
    let visibleCount = 0;
    for (const star of STARS) {
      const horizontal = equatorialToHorizontal(star.ra, star.dec, state.date, state.location.lat, state.location.lon);
      const point = this.projectHorizontal(horizontal, state);
      if (!point) continue;
      visibleCount += 1;
      const radius = clamp(1.05 + (3.6 - star.magnitude) * 0.62, 1.05, 4.8) * Math.sqrt(state.zoom);
      const color = starColor(star.tone);
      if (star.magnitude <= 1.55) {
        const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 4.7);
        halo.addColorStop(0, `${color}b8`);
        halo.addColorStop(0.3, `${color}28`);
        halo.addColorStop(1, `${color}00`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 4.7, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.globalAlpha = clamp(1.02 - star.magnitude / 7, 0.42, 1);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      this.hitTargets.push({ star, point, radius: Math.max(radius + 6, 9), horizontal });

      if (state.layers.labels && star.magnitude <= 1.2) {
        ctx.fillStyle = "rgba(240, 238, 229, 0.72)";
        ctx.font = "10px Georgia, serif";
        ctx.textAlign = "left";
        ctx.fillText(star.name, point.x + radius + 4, point.y - radius - 2);
      }
      if (state.hoverStarId === star.id || state.selectedStarId === star.id) {
        ctx.strokeStyle = state.selectedStarId === star.id ? COLORS.gold : COLORS.cyan;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 5, 0, TAU);
        ctx.stroke();
      }
    }
    return visibleCount;
  }

  drawBodies(ctx, state) {
    for (const body of state.bodies ?? []) {
      const point = this.projectHorizontal(body.horizontal, state);
      if (!point) continue;
      const radius = body.size * Math.sqrt(state.zoom);
      ctx.save();
      ctx.fillStyle = body.color;
      ctx.globalAlpha = body.id === "sun" ? 0.95 : 0.9;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, TAU);
      ctx.fill();
      if (body.id === "saturn") {
        ctx.strokeStyle = "rgba(236, 214, 166, 0.8)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, radius * 1.9, radius * 0.65, -0.25, 0, TAU);
        ctx.stroke();
      }
      if (body.id === "moon" && body.illumination < 0.95) {
        ctx.fillStyle = "rgba(7, 16, 38, 0.7)";
        ctx.beginPath();
        ctx.arc(point.x + radius * (1 - body.illumination * 2), point.y, radius * 0.92, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (state.layers.labels) {
        ctx.fillStyle = body.color;
        ctx.font = "9px Segoe UI, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(body.name, point.x + radius + 4, point.y - radius - 2);
      }
      ctx.restore();
    }
  }

  drawConstellationLabels(ctx, state) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "10px Segoe UI, sans-serif";
    for (const constellation of CONSTELLATIONS) {
      for (const label of constellation.labels) {
        const point = this.projectEquatorial(label[0], label[1], state);
        if (!point) continue;
        ctx.fillStyle = "rgba(216, 196, 142, 0.64)";
        ctx.fillText(constellation.name, point.x, point.y);
      }
    }
    ctx.restore();
  }

  drawHorizon(ctx, center, skyRadius) {
    ctx.save();
    ctx.strokeStyle = "rgba(195, 209, 236, 0.56)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, skyRadius, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(242, 195, 108, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, skyRadius + 7, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();

    const cardinal = [
      ["N", 0], ["E", 90], ["S", 180], ["W", 270],
    ];
    ctx.fillStyle = COLORS.ink;
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [label, azimuth] of cardinal) {
      const angle = azimuth * DEG;
      ctx.fillText(label, center.x + Math.sin(angle) * (skyRadius + 20), center.y - Math.cos(angle) * (skyRadius + 20));
    }
    ctx.restore();
  }

  ringLayout(skyRadius) {
    return {
      time: skyRadius + 38,
      timeOuter: skyRadius + 46,
    };
  }

  drawTimeRing(ctx, center, skyRadius, state) {
    const { time, timeOuter } = this.ringLayout(skyRadius);
    const colors = {
      day: "#f4f1df",
      standard: "#f6e2b4",
      civil: "#f2c36c",
      nautical: "#79aeea",
      astronomical: "#d59af4",
      moon: "#9bcdf7",
      night: "#1b335e",
    };
    const labels = {
      day: "白昼",
      standard: "标准",
      civil: "民用",
      nautical: "航海",
      astronomical: "天文",
      moon: "月照",
      night: "无月",
    };
    ctx.save();
    ctx.lineCap = "butt";
    ctx.lineWidth = 10;
    ctx.strokeStyle = colors.night;
    ctx.beginPath();
    ctx.arc(center.x, center.y, time, 0, TAU);
    ctx.stroke();
    for (const segment of state.timeRing?.segments ?? []) {
      if (segment.end - segment.start < 0.00001) continue;
      const startAngle = -Math.PI / 2 + segment.start * TAU;
      const endAngle = -Math.PI / 2 + segment.end * TAU;
      ctx.strokeStyle = colors[segment.id] ?? colors.night;
      ctx.beginPath();
      ctx.arc(center.x, center.y, time, startAngle, endAngle);
      ctx.stroke();
      if (segment.end - segment.start > 0.035) {
        const middle = (segment.start + segment.end) / 2;
        const labelAngle = -Math.PI / 2 + middle * TAU;
        const labelRadius = timeOuter + 7;
        const labelX = center.x + Math.cos(labelAngle) * labelRadius;
        const labelY = center.y + Math.sin(labelAngle) * labelRadius;
        ctx.fillStyle = colors[segment.id] ?? colors.night;
        ctx.font = "8px Segoe UI, sans-serif";
        ctx.textAlign = labelX < center.x ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillText(labels[segment.id] ?? segment.id, labelX, labelY);
      }
    }

    for (let index = 0; index < 96; index += 1) {
      const fraction = index / 96;
      const angle = -Math.PI / 2 + fraction * TAU;
      const length = index % 4 === 0 ? 8 : index % 2 === 0 ? 5 : 3;
      const inner = timeOuter - length;
      ctx.strokeStyle = index % 4 === 0 ? "rgba(240, 238, 229, 0.78)" : "rgba(137, 147, 171, 0.6)";
      ctx.lineWidth = index % 4 === 0 ? 1 : 0.7;
      ctx.beginPath();
      ctx.moveTo(center.x + Math.cos(angle) * inner, center.y + Math.sin(angle) * inner);
      ctx.lineTo(center.x + Math.cos(angle) * timeOuter, center.y + Math.sin(angle) * timeOuter);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(216, 196, 142, 0.86)";
    ctx.font = "9px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [label, fraction] of [["0h", 0], ["6h", 0.25], ["12h", 0.5], ["18h", 0.75]]) {
      const angle = -Math.PI / 2 + fraction * TAU;
      const distance = timeOuter + 5;
      ctx.fillText(label, center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance);
    }

    const fraction = state.timeRing?.timeFraction ?? localClockFraction(state.date);
    const markerAngle = -Math.PI / 2 + fraction * TAU;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x + Math.cos(markerAngle) * (time - 6), center.y + Math.sin(markerAngle) * (time - 6));
    ctx.lineTo(center.x + Math.cos(markerAngle) * (timeOuter + 7), center.y + Math.sin(markerAngle) * (timeOuter + 7));
    ctx.stroke();
    ctx.restore();
  }

  hitTest(x, y) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const target of this.hitTargets) {
      const distance = Math.hypot(x - target.point.x, y - target.point.y);
      if (distance <= target.radius && distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  describeTarget(target) {
    if (!target) return null;
    return {
      name: target.star.name,
      constellation: target.star.constellation,
      magnitude: target.star.magnitude,
      altitude: formatAltitude(target.horizontal.altitude),
      azimuth: formatAzimuth(target.horizontal.azimuth),
      coordinates: `${formatHours(target.star.ra)} · ${target.star.dec >= 0 ? "+" : ""}${target.star.dec.toFixed(1)}°`,
    };
  }
}
