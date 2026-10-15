import { mkdir, writeFile } from "node:fs/promises";

const DATA_BASE = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/";
const OUTPUT_DIR = new URL("../src/data/", import.meta.url);
const SIMPLIFIED_NAMES = {
  And: "仙女座", Ant: "唧筒座", Aps: "天燕座", Aqr: "宝瓶座", Aql: "天鹰座", Ara: "天坛座", Ari: "白羊座", Aur: "御夫座",
  Boo: "牧夫座", Cae: "雕具座", Cam: "鹿豹座", Cnc: "巨蟹座", CVn: "猎犬座", CMa: "大犬座", CMi: "小犬座", Cap: "摩羯座",
  Car: "船底座", Cas: "仙后座", Cen: "半人马座", Cep: "仙王座", Cet: "鲸鱼座", Cha: "蝘蜓座", Cir: "圆规座", Col: "天鸽座",
  Com: "后发座", CrA: "南冕座", CrB: "北冕座", Crv: "乌鸦座", Crt: "巨爵座", Cru: "南十字座", Cyg: "天鹅座", Del: "海豚座",
  Dor: "剑鱼座", Dra: "天龙座", Equ: "小马座", Eri: "波江座", For: "天炉座", Gem: "双子座", Gru: "天鹤座", Her: "武仙座",
  Hor: "时钟座", Hya: "长蛇座", Hyi: "水蛇座", Ind: "印第安座", Lac: "蝎虎座", Leo: "狮子座", LMi: "小狮座", Lep: "天兔座",
  Lib: "天秤座", Lup: "豺狼座", Lyn: "天猫座", Lyr: "天琴座", Men: "山案座", Mic: "显微镜座", Mon: "麒麟座", Mus: "苍蝇座",
  Nor: "矩尺座", Oct: "南极座", Oph: "蛇夫座", Ori: "猎户座", Pav: "孔雀座", Peg: "飞马座", Per: "英仙座", Phe: "凤凰座",
  Pic: "绘架座", Psc: "双鱼座", PsA: "南鱼座", Pup: "船尾座", Pyx: "罗盘座", Ret: "网罟座", Sge: "天箭座", Sgr: "人马座",
  Sco: "天蝎座", Scl: "玉夫座", Sct: "盾牌座", Ser: "巨蛇座", Sex: "六分仪座", Tau: "金牛座", Tel: "望远镜座", Tri: "三角座",
  TrA: "南三角座", Tuc: "杜鹃座", UMa: "大熊座", UMi: "小熊座", Vel: "船帆座", Vir: "室女座", Vol: "飞鱼座", Vul: "狐狸座",
};

const round = (value, digits = 4) => Number(value.toFixed(digits));
const rightAscension = (longitude) => round((((longitude % 360) + 360) % 360) / 15);
const point = ([longitude, latitude]) => [rightAscension(longitude), round(latitude)];
const path = (points) => points.map(point);
const json = (value) => JSON.stringify(value);

async function loadJson(filename) {
  const response = await fetch(`${DATA_BASE}${filename}`);
  if (!response.ok) throw new Error(`Unable to fetch ${filename}: ${response.status}`);
  return response.json();
}

const [starsSource, boundsSource, linesSource, constellationsSource, namesSource, chineseNamesSource] = await Promise.all([
  loadJson("stars.6.json"),
  loadJson("constellations.bounds.json"),
  loadJson("constellations.lines.json"),
  loadJson("constellations.json"),
  loadJson("starnames.json"),
  loadJson("starnames.cn.json"),
]);

const stars = starsSource.features
  .filter((feature) => Number(feature.properties.mag) <= 5)
  .map((feature) => {
    const id = String(feature.id);
    const named = namesSource[id] ?? {};
    const chinese = chineseNamesSource[id] ?? {};
    const [ra, dec] = point(feature.geometry.coordinates);
    return {
      id,
      ra,
      dec,
      magnitude: round(Number(feature.properties.mag), 2),
      bv: Number.isFinite(Number(feature.properties.bv)) ? round(Number(feature.properties.bv), 3) : null,
      name: chinese.name || named.name || named.desig || `HIP ${id}`,
      constellation: named.c || null,
    };
  })
  .sort((first, second) => first.magnitude - second.magnitude || Number(first.id) - Number(second.id));

const boundaryParts = new Map();
for (const feature of boundsSource.features) {
  const rings = feature.geometry.coordinates ?? [];
  const parts = rings.filter((ring) => ring.length > 2).map(path);
  boundaryParts.set(feature.id, [...(boundaryParts.get(feature.id) ?? []), ...parts]);
}

const lines = new Map();
for (const feature of linesSource.features) {
  const segments = feature.geometry.coordinates ?? [];
  lines.set(feature.id, [...(lines.get(feature.id) ?? []), ...segments.filter((segment) => segment.length > 1).map(path)]);
}

const labels = new Map();
for (const feature of constellationsSource.features) {
  const label = feature.geometry?.coordinates;
  if (!label || label.length < 2) continue;
  labels.set(feature.id, [...(labels.get(feature.id) ?? []), point(label)]);
}

const constellationIds = [...new Set([
  ...constellationsSource.features.map((feature) => feature.id),
  ...boundsSource.features.map((feature) => feature.id),
  ...linesSource.features.map((feature) => feature.id),
])].sort();

const constellations = constellationIds.map((id) => ({
  id,
  name: SIMPLIFIED_NAMES[id] ?? id,
  abbr: id,
  lines: lines.get(id) ?? [],
  boundaryParts: boundaryParts.get(id) ?? [],
  labels: labels.get(id) ?? [],
}));

const starSource = `const star = (id, ra, dec, magnitude, bv, name, constellation) => ({ id, ra, dec, magnitude, bv, name, constellation, tone: bv !== null && bv < 0.2 ? "blue" : bv !== null && bv > 1.15 ? "warm" : "white" });\n\nexport const STARS = [\n${stars.map((entry) => `  star(${json(entry.id)}, ${entry.ra}, ${entry.dec}, ${entry.magnitude}, ${entry.bv}, ${json(entry.name)}, ${json(entry.constellation)}),`).join("\n")}\n];\n\nexport const STAR_BY_ID = new Map(STARS.map((entry) => [entry.id, entry]));\n`;
const constellationSource = `const constellation = (id, name, abbr, lines, boundaryParts, labels) => ({ id, name, abbr, lines, boundaryParts, labels });\n\nexport const CONSTELLATIONS = ${JSON.stringify(constellations, null, 2)};\n\nexport const CONSTELLATION_BY_ID = new Map(CONSTELLATIONS.map((entry) => [entry.id, entry]));\nexport const CONSTELLATION_BY_NAME = new Map(CONSTELLATIONS.map((entry) => [entry.name, entry]));\n`;

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(new URL("stars.js", OUTPUT_DIR), starSource);
await writeFile(new URL("constellations.js", OUTPUT_DIR), constellationSource);
console.log(`Generated ${stars.length} stars and ${constellations.length} constellations.`);
