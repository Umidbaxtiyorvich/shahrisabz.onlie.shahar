import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { makeBuildings } from './buildings.js?v=2';
import { initLife } from './life.js?v=9';
import * as K from './kenney.js?v=6';
import { loadRealCity } from './realcity.js?v=1';

// ---- Koordinatalar: Shahrisabz markazi (Oqsaroy atrofi) ----
const LAT0 = 39.0578, LON0 = 66.8297;
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110540;
const toXZ = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const BBOX = '38.90,66.62,39.22,67.05', CITY_BBOX = '39.00,66.76,39.11,66.89';

const $ = (id) => document.getElementById(id);
const api = async (url, data) => {
  const r = await fetch(url, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Xato');
  return j;
};
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ---- Sahna ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
const MOBILE = innerWidth < 800 || /Mobi|Android/i.test(navigator.userAgent);
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);

$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; // shisha va mashina bo'yog'idagi aks
// Haqiqiy osmon yoritilishi (Poly Haven HDRI, CC0, fps-buildings-env-kit): tabiiy aks va yorug'lik
new RGBELoader().load('./textures/hdri/sky.hdr', (t) => { const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose(); window.__dayEnv = env; if (!life) scene.environment = env; });
// ---- Tabiiy ko'rinish: protsedural teksturalar (internetdan rasm yuklamasdan) ----
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function canvasTex(size, draw, repeat = 1) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function speckle(g, n, size, cols, r0, r1, alpha = 1) { g.globalAlpha = alpha; for (let i = 0; i < n; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; const r = rnd(r0, r1); g.fillRect(Math.random() * size, Math.random() * size, r, r); } g.globalAlpha = 1; }
const TEX = {
  grass: canvasTex(512, (g, s) => { g.fillStyle = '#6fbf3c'; g.fillRect(0, 0, s, s); speckle(g, 40, s, ['#62b032', '#7fcb4c', '#8cc94e', '#69b83a'], 40, 120, .35); speckle(g, 26000, s, ['#4f7a2f', '#8bb65a', '#a0b968', '#5e8c38', '#7a9a44'], 1, 3); speckle(g, 300, s, ['#a39a6b', '#8c7d55'], 2, 6, .5); }),
  asphalt: canvasTex(256, (g, s) => { g.fillStyle = '#4a4d52'; g.fillRect(0, 0, s, s); speckle(g, 9000, s, ['#3c3f43', '#5a5d62', '#444749', '#66696d'], 1, 2); }),
  concrete: canvasTex(256, (g, s) => { g.fillStyle = '#c9c4b8'; g.fillRect(0, 0, s, s); speckle(g, 5000, s, ['#bdb7aa', '#d6d1c6', '#b2ad9f'], 1, 2); g.strokeStyle = '#a9a396'; g.lineWidth = 2; for (let i = 0; i <= s; i += s / 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); } }),
  zebra: canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s); g.fillStyle = '#f7f5ee'; for (let x = 0; x < s; x += 16) g.fillRect(x + 2, 0, 9, s); }),
  dash: canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s); g.fillStyle = '#f4f1e8'; g.fillRect(0, s * .1, s * .55, s * .8); }),
  plaster: canvasTex(256, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); speckle(g, 7000, s, ['#ecebe7', '#f6f5f2', '#e2e0da'], 1, 3); }),
  tiles: canvasTex(256, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? -12 : 0; x < s; x += 24) { g.fillStyle = `hsl(0,0%,${rnd(72, 92)}%)`; g.fillRect(x + 1, y + 1, 22, 13); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + 13, 24, 3); } }),
  brick: canvasTex(256, (g, s) => { g.fillStyle = '#d8d2c8'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < s; x += 32) { g.fillStyle = `hsl(${rnd(10, 22)},${rnd(35, 55)}%,${rnd(40, 55)}%)`; g.fillRect(x + 1.5, y + 1.5, 29, 13); } }),
  bark: canvasTex(64, (g, s) => { g.fillStyle = '#5b4330'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 3) { g.fillStyle = `rgba(30,20,10,${rnd(.1, .4)})`; g.fillRect(x, 0, 1.5, s); } }),
};
TEX.grass.repeat.set(1500, 1500);
// Haqiqiy fotosurat teksturalari (ambientCG, CC0): yuklangach protsedural teksturalar o'rnini egallaydi
const texLoader = new THREE.TextureLoader();
function pbr(name, rx, ry = rx) { const load = (f, srgb) => { const t = texLoader.load(`./textures/pbr/${name}_${f}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = maxAniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }; return { map: load('color', true), normalMap: load('normal', false) }; }
// Osmon: fizik atmosfera modeli (quyosh, ufq, havo rangi)
const sky = new Sky(); sky.scale.setScalar(30000); scene.add(sky);
Object.assign(sky.material.uniforms, {}); sky.material.uniforms.turbidity.value = 6; sky.material.uniforms.rayleigh.value = 1.6; sky.material.uniforms.mieCoefficient.value = .004; sky.material.uniforms.mieDirectionalG.value = .85;
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(200));
sky.material.uniforms.sunPosition.value.copy(sunDir);
scene.fog = new THREE.Fog(0xc9d6e2, 2500, 12000);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 40000);
camera.position.set(0, 900, 620);
const controls = new MapControls(camera, renderer.domElement);
controls.maxPolarAngle = 1.35; controls.minDistance = 30; controls.maxDistance = 7000;
controls.enableDamping = true;
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b7a4a, 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 3.2); sun.position.copy(sunDir).multiplyScalar(200); let life = null; const allWays = []; scene.add(sun); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 500 }); sun.shadow.bias = -.0005;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshStandardMaterial({ ...pbr('grass', 3750), normalScale: new THREE.Vector2(.6, .6), roughness: 1, color: 0xd8f0b0 })); // 8 m plitka
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
// bulutlar
for (let i = 0; i < 18; i++) {
  const c = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: .85, fog: false });
  for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(60 + Math.random() * 50, 10, 8), m); s.position.set(j * 70 - 100, Math.random() * 30, Math.random() * 40); c.add(s); }
  c.position.set((Math.random() - .5) * 14000, 2200 + Math.random() * 600, (Math.random() - .5) * 14000); c.scale.setScalar(2.5); scene.add(c);
}

// ---- Matnli yorliqlar (sprite) ----
function label(text, { size = 28, bg = 'rgba(255,255,255,.92)', fg = '#1d2433', scale = 1 } = {}) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  g.font = `600 ${size}px system-ui,sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + size, h = size * 1.6;
  cv.width = w; cv.height = h;
  g.font = `600 ${size}px system-ui,sans-serif`;
  g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.fill();
  g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, size / 2, h / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(w / h * 10 * scale, 10 * scale, 1); sp.renderOrder = 10;
  return sp;
}

// ---- Yo'llar (OpenStreetMap) ----
const WIDTH = { motorway: 20, trunk: 18, primary: 16, secondary: 13, tertiary: 11, residential: 8, unclassified: 8, road: 7, living_street: 6, service: 5, pedestrian: 5, track: 4, footway: 2.5, path: 2 };
let segments = []; // {ax,az,bx,bz,name}
let places = []; // {name,x,z}
const streetLabels = [], placeLabels = [];
let streetNames = [], officialPlaces = [], realCity = null;
// Mahalla chegaralari: [x,z] ko'pburchaklar
let mahallaPolys = [], officialStreets = [];
// Nomlarni solishtirish: x/h, o'/u, apostroflar farqini e'tiborsiz qoldiradi
const nk = (s) => String(s || '').toLowerCase().replace(/[ʻʼ‘’`']/g, '').replace(/kochasi|ko'chasi|ko‘chasi|ulitsa|улица|street|tor ko.cha|berk ko.cha/g, '').replace(/h/g, 'x').replace(/o/g, 'u').replace(/[^a-zа-я0-9]/g, '');
// Ochiq ma'lumotdagi va admin kiritgan joylar: faqat ma'lumot belgisi (sotilmaydi)
let pois = []; const poiLabels = [];
async function loadPois() {
  try { pois = (await (await fetch('pois.json')).json()).joylar || []; } catch { return; }
  for (const l of poiLabels) scene.remove(l); poiLabels.length = 0;
  for (const p of pois) { const [x, z] = toXZ(p.lat, p.lon); p.x = x; p.z = z;
    const l = label(`${p.i} ${p.n}`, { size: 24, bg: 'rgba(255,255,255,.93)', fg: '#1d2b53', scale: .9 }); l.position.set(x, 14, z); l.visible = false; l.userData = { kind: 'poi', p }; l.renderOrder = 9; scene.add(l); poiLabels.push(l); clickable.push(l); }
}
function openPoi(p) { modal(`<h3>${esc(p.i)} ${esc(p.n)}</h3><div class="muted">${esc(p.c)}${p.a ? ' · 📍 ' + esc(p.a) : ''}</div>${distText(p.x, p.z) ? `<div class="dist">${distText(p.x, p.z)}</div>` : ''}<div class="hint">ℹ️ Bu xaritadagi ma'lumot belgisi — sotilmaydi.${p.admin ? '' : ' Manba: © OpenStreetMap hissadorlari.'}</div><div class="row"><button class="ghost" id="pfly">🔍 Yaqindan</button><button class="ghost" id="nope">Yopish</button></div>`); $('nope').onclick = closeModal; $('pfly').onclick = () => { closeModal(); flyTo(p.x, p.z, 80); }; }
function drawCustomPlaces() {
  for (const c of state.customPlaces || []) { if (c.kind === 'joy') continue;
    const [x, z] = toXZ(c.lat, c.lon);
    const l = c.kind === 'mahalla' ? label('📍 ' + c.n, { size: 32, bg: 'rgba(31,164,99,.9)', fg: '#fff', scale: 2.8 }) : label(c.n, { size: 24, bg: 'rgba(255,255,255,.85)', fg: '#4a5568', scale: 1.1 });
    l.position.set(x, c.kind === 'mahalla' ? 35 : 8, z); scene.add(l); (c.kind === 'mahalla' ? placeLabels : streetLabels).push(l);
    if (c.kind === 'mahalla') places.push({ name: c.n, x, z }); else streetPoints.push({ name: c.n, x, z });
    if (!streetNames.includes(c.n) && c.kind !== 'mahalla') streetNames.push(c.n);
  }
}
let streetPoints = [];
function drawMahallaBorders() {
  const pos = [];
  mahallaPolys = officialPlaces.map((o) => ({ n: o.n, rings: o.rings.map((r) => r.map(([lo, la]) => toXZ(la, lo))) }));
  for (const m of mahallaPolys) for (const r of m.rings) for (let i = 0; i < r.length - 1; i++) pos.push(r[i][0], 1.2, r[i][1], r[i + 1][0], 1.2, r[i + 1][1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18 })));
}
function inRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }
const mahallaAt = (x, z) => mahallaPolys.find((m) => m.rings.some((r) => inRing(x, z, r)))?.n || '';

async function loadOSM() {
  const cached = store.get('osm-shahrisabz-v4');
  if (cached) return cached;
  status('🗺️ Shahrisabz xaritasi yuklanmoqda (birinchi marta 1–3 daqiqa)…');
  try { const r = await fetch('osm.json', { signal: AbortSignal.timeout(240000) }); if (r.ok) { const j = await r.json(); store.set('osm-shahrisabz-v4', j); return j; } } catch {}
  const q = `[out:json][timeout:170];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian|road)$"](${CITY_BBOX});way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${BBOX}););out geom;(nwr["place"~"^(suburb|quarter|neighbourhood|city_block|village|hamlet|isolated_dwelling|locality|town)$"](${BBOX}););out center tags;`;
  const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  for (const u of mirrors) {
    try {
      const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(180000) });
      if (!r.ok) continue;
      const j = await r.json();
      const slim = { ways: [], places: [] };
      for (const e of j.elements) {
        if (e.type === 'way' && e.geometry) slim.ways.push({ t: e.tags.highway, n: e.tags['name:uz'] || e.tags.name || '', g: e.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]) });
        else if (e.tags?.name && (e.lat || e.center)) slim.places.push({ n: e.tags['name:uz'] || e.tags.name, k: e.tags.place || 'mahalla', lat: e.lat ?? e.center.lat, lon: e.lon ?? e.center.lon });
      }
      store.set('osm-shahrisabz-v4', slim);
      return slim;
    } catch {}
  }
  return null;
}

function fallbackGrid() { // internet bo'lmasa — oddiy to'r
  const ways = [], places = [];
  for (let i = -12; i <= 12; i++) {
    ways.push({ t: i % 4 ? 'residential' : 'secondary', n: `${Math.abs(i) + 1}-ko'cha`, xz: [[i * 200, -2500], [i * 200, 2500]] });
    ways.push({ t: i % 4 ? 'residential' : 'secondary', n: `${Math.abs(i) + 13}-ko'cha`, xz: [[-2500, i * 200], [2500, i * 200]] });
  }
  ['Oqsaroy', 'Dorut-tilovat', 'Kesh', 'Navbog\'', 'Ipak yo\'li'].forEach((n, k) => places.push({ n, xz: [Math.cos(k * 1.3) * 1200, Math.sin(k * 1.3) * 1200] }));
  return { ways, places };
}

function buildRoads(data) {
  const geos = [], lineGeo = [], walkGeo = [], edgeGeo = [], zebraGeo = []; const nodes = new Map();
  const named = new Map();
  for (const w of data.ways) {
    const pts = w.xz || w.g.map(([la, lo]) => toXZ(la, lo));
    const wd = WIDTH[w.t] || 6; allWays.push({ t: w.t, pts, wd });
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az); if (len < .1) continue;
      segments.push({ ax, az, bx, bz, name: w.n, hw: wd / 2 + 2 });
      const ang = -Math.atan2(bz - az, bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const strip = (L, W, y, uvx, uvy) => { const g = new THREE.PlaneGeometry(L, W); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * uvx, uv.getY(k) * uvy); g.rotateX(-Math.PI / 2); g.rotateY(ang); g.translate(mx, y, mz); return g; };
      geos.push(strip(len + wd * .6, wd, .3 + (wd > 10 ? .1 : 0), (len + wd * .6) / 6, wd / 6));
      if (wd >= 5) walkGeo.push(strip(len + wd, wd + 4, .2, (len + wd) / 3, (wd + 4) / 3)); // trotuar
      if (wd >= 11) lineGeo.push(strip(len, .35, .45, len / 6, 1)); // uzuq chiziq
      if (wd >= 8) for (const sd of [1, -1]) { const g2 = strip(len, .25, .44, 1, 1); g2.translate(-(bz - az) / len * (wd / 2 - .5) * sd, 0, (bx - ax) / len * (wd / 2 - .5) * sd); edgeGeo.push(g2); } // yo'l cheti oq chizig'i
      for (const [px, pz, ox, oz] of [[ax, az, bx, bz], [bx, bz, ax, az]]) { const k = Math.round(px) + ',' + Math.round(pz); const arr = nodes.get(k) || []; arr.push({ px, pz, ux: (ox - px) / len, uz: (oz - pz) / len, wd, len }); nodes.set(k, arr); }
      if (w.n) { const arr = named.get(w.n) || []; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (len > 12 && !arr.some((q) => Math.hypot(q.x - mx, q.z - mz) < 350)) arr.push({ x: mx, z: mz }); named.set(w.n, arr); }
    }
  }
  const addMerged = (arr, mat, shadow) => { for (let i = 0; i < arr.length; i += 4000) { const m = new THREE.Mesh(mergeGeometries(arr.slice(i, i + 4000)), mat); m.receiveShadow = shadow; scene.add(m); } };
  addMerged(walkGeo, new THREE.MeshStandardMaterial({ ...pbr('concrete', 1), roughness: .95, color: 0xf2efe8 }), true);
  addMerged(geos, new THREE.MeshStandardMaterial({ ...pbr('asphalt', 1), roughness: .9, color: 0x9a9a9a }), true);
  addMerged(lineGeo, new THREE.MeshStandardMaterial({ map: TEX.dash, transparent: true, roughness: .6 }), false);
  addMerged(edgeGeo, new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: .6 }), false);
  // Chorrahalarda "zebra" piyoda o'tish joylari (3 va undan ko'p yo'l uchrashgan joyda)
  for (const arr of nodes.values()) {
    if (arr.length < 3) continue; const maxW = Math.max(...arr.map((a) => a.wd));
    for (const a of arr) { if (a.wd < 6 || a.len < maxW + 8) continue;
      const d = maxW / 2 + 3, cx = a.px + a.ux * d, cz = a.pz + a.uz * d;
      const g3 = new THREE.PlaneGeometry(a.wd - 1, 3); const uv = g3.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (a.wd - 1) / 4, uv.getY(k));
      g3.rotateX(-Math.PI / 2); g3.rotateY(-Math.atan2(a.uz, a.ux) + Math.PI / 2); g3.translate(cx, .46, cz); zebraGeo.push(g3);
      if (zebraGeo.length > 8000) break; }
  }
  addMerged(zebraGeo, new THREE.MeshStandardMaterial({ map: TEX.zebra, transparent: true, roughness: .6 }), false);
  streetNames = [...named.keys()];
  for (const o of officialStreets) { // rasmiy ro'yxatdagi ko'cha OSM'da boshqacha yozilgan bo'lsa ham topiladi
    const hit = streetNames.find((n) => nk(n) === nk(o.n)) || streetNames.find((n) => nk(n).includes(nk(o.n)) && nk(o.n).length > 3);
    o.osm = hit || null; if (!hit) streetNames.push(o.n);
  }
  streetNames.sort();
  for (const [n, arr] of named) for (const q of arr) {
    const l = label(n, { size: 24, bg: 'rgba(255,255,255,.8)', fg: '#4a5568', scale: 1.1 });
    l.position.set(q.x, 8, q.z); l.visible = false; scene.add(l); streetLabels.push(l);
  }
  const seenP = new Set();
  // Rasmiy mahallalar (chegaralari bilan) asosiy; OSM'dagi qolgan joy nomlari qo'shimcha
  const offNames = new Set(officialPlaces.map((o) => o.n.toLowerCase()));
  data.places = [...officialPlaces.map((o) => ({ n: o.n, k: o.k === 'tuman' ? 'village' : 'neighbourhood', lat: o.lat, lon: o.lon })), ...data.places.filter((p) => !offNames.has(p.n.toLowerCase()) && !officialPlaces.length)];
  drawMahallaBorders();
  places = data.places.map((p) => { const [x, z] = p.xz || toXZ(p.lat, p.lon); return { name: p.n, k: p.k, x, z }; }).filter((p) => { const key = p.name + Math.round(p.x / 200) + Math.round(p.z / 200); if (seenP.has(key)) return false; seenP.add(key); return true; });
  for (const p of places) { const big = /suburb|town|village/.test(p.k || ''); const l = label('📍 ' + p.name, { size: 32, bg: big ? 'rgba(47,124,246,.92)' : 'rgba(31,164,99,.9)', fg: '#fff', scale: big ? 3.2 : 2.8 }); l.position.set(p.x, big ? 60 : 35, p.z); l.userData.big = big; scene.add(l); placeLabels.push(l); }
  // daraxtlar: ko'chalar bo'ylab qator-qator (trotuar yonida), dumaloq to'la shoxli, har xil yashil tuslarda
  const parts = []; for (const [x, y, z, r] of [[0, 0, 0, 1], [.5, -.15, .25, .72], [-.45, .1, -.3, .7]]) { const sp = new THREE.IcosahedronGeometry(r, 1); sp.translate(x, y, z); parts.push(sp); } // ~240 uchburchak — tez ishlaydi
  const crownG = mergeGeometries(parts), trunkG = new THREE.CylinderGeometry(.16, .26, 1, 7); trunkG.translate(0, .5, 0);
  const spots = [];
  const mid = (sg) => Math.hypot((sg.ax + sg.bx) / 2, (sg.az + sg.bz) / 2); // markazga yaqin ko'chalardan boshlab, har ko'cha bo'lagiga cheklangan son
  for (const sg of [...segments].sort((a, b) => mid(a) - mid(b))) { const L = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az); if (L < 10 || !sg.hw || sg.hw < 4) continue;
    const ux = (sg.bx - sg.ax) / L, uz = (sg.bz - sg.az) / L, off = sg.hw + 3;
    const tc = Math.max(0, Math.min(L, -sg.ax * ux - sg.az * uz)); // markazga eng yaqin nuqta
    for (let t = Math.max(7, tc - 600); t < Math.min(L - 7, tc + 600); t += 15) for (const sd of [1, -1]) { const x = sg.ax + ux * t - uz * off * sd, z = sg.az + uz * t + ux * off * sd; if (Math.hypot(x, z) < 4200) spots.push([x, z]); }
    if (spots.length > 4500) break; }
  const N = Math.max(1, spots.length);
  const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ roughness: .85 }), N);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 1 }), N);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  spots.forEach(([x, z], i) => { const h = rnd(2.4, 3.6), r = rnd(2.2, 3.2);
    mtx.compose(ps.set(x, 0, z), q.identity(), sc.set(r / 3, h, r / 3)); trunks.setMatrixAt(i, mtx);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.3);
    mtx.compose(ps.set(x, h + r * .7, z), q, sc.set(r, r * rnd(.9, 1.15), r)); crowns.setMatrixAt(i, mtx);
    crowns.setColorAt(i, col.setHSL(rnd(.26, .33), rnd(.55, .75), rnd(.26, .36))); });
  const kt = ['tree-oak', 'tree-default', 'tree-fat', 'tree-detailed'].map((n) => K.parts(n, 6.5)).filter(Boolean);
  if (kt.length) { // Kenney daraxtlari: har turi uchun alohida instanced mesh, joylar navbat bilan bo'linadi
    const qt = ['q-tree-a', 'q-tree-b', 'n-tree-avoxahrpwe', 'n-tree-qvoop92wmg', 'q-pine', 'n-pine-zt62gcekxz'].map((n) => K.parts(n, 7)).filter(Boolean);
    spots.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    const nearSpots = qt.length ? spots.splice(0, MOBILE ? 120 : 350) : []; // markaz atrofida — haqiqiyroq Quaternius daraxtlari
    if (qt.length) { const qg = qt.map(() => []); nearSpots.forEach((sp, i) => qg[i % qt.length].push(sp));
      qt.forEach((prts, k) => { const pts = qg[k]; if (!pts.length) return; for (const pr of prts) { const im = new THREE.InstancedMesh(pr.geometry, pr.material, pts.length); im.castShadow = true;
        pts.forEach(([x, z], i) => { const sc2 = rnd(.9, 1.3); mtx.compose(ps.set(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.399) % 6.28), sc.set(sc2, sc2, sc2)); im.setMatrixAt(i, mtx); }); scene.add(im); } }); }
    const groups = kt.map(() => []); spots.forEach((sp, i) => groups[i % kt.length].push(sp));
    kt.forEach((prts, k) => { const pts = groups[k]; if (!pts.length) return;
      for (const pr of prts) { const mt = pr.material.clone(); const hs = {}; mt.color.getHSL(hs); mt.metalness = 0; mt.roughness = .9; mt.envMapIntensity = .3;
        if (hs.l > .12) mt.color.setHSL([.27, .3, .25, .32][k % 4], .7, .17); else mt.color.setHex(0x6b4a2b); // barg — yashil, tana — jigarrang
        const im = new THREE.InstancedMesh(pr.geometry, mt, pts.length); im.castShadow = true;
        pts.forEach(([x, z], i) => { const sc2 = rnd(.85, 1.25); mtx.compose(ps.set(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.399) % 6.28), sc.set(sc2, sc2, sc2)); im.setMatrixAt(i, mtx); });
        scene.add(im); } });
  } else { crowns.castShadow = trunks.castShadow = true; scene.add(crowns, trunks); }
  K.ready2.then(scatterNature);
}
// Tabiat (fps-buildings-env-kit, Quaternius CC0): ko'cha chetlari va bo'sh joylarda o't, gul, buta, paporotnik, tosh
function scatterNature() {
  const kinds = [['n-grass', 1.4, 2600], ['n-tall-grass', 1.6, 900], ['n-grass-wispy', 1.5, 700], ['n-bush', 2.6, 380], ['n-bush-with-flowers', 2.4, 320], ['n-flower-group', 1.6, 420], ['n-flower-single', .9, 300], ['n-fern', 1.5, 300], ['n-plant-big', 1.4, 200], ['n-clover', 1.2, 300], ['n-rock-medium', 2.2, 110], ['n-pebble-round', .8, 160]];
  const spots = []; let seed = 7; const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const sg of [...segments].sort((a, b) => Math.hypot(a.ax, a.az) - Math.hypot(b.ax, b.az))) { const L = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az); if (L < 8 || !sg.hw) continue;
    const ux = (sg.bx - sg.ax) / L, uz = (sg.bz - sg.az) / L;
    for (let t = 3; t < L - 3; t += 4.5) for (const sd of [1, -1]) { const off = sg.hw + 4.5 + rr() * 5, x = sg.ax + ux * t - uz * off * sd + (rr() - .5) * 2, z = sg.az + uz * t + ux * off * sd + (rr() - .5) * 2;
      if (Math.hypot(x, z) < 1600 && roadClearC(x, z) > 2.5 && !state.residents.some((r) => Math.abs(r.x - x) < 13 && Math.abs(r.z - z) < 13)) spots.push([x, z]); }
    if (spots.length > 9000) break; }
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let k0 = 0;
  const kf = MOBILE ? .3 : .6;
  for (const [name, w, n0] of kinds) { const n = Math.round(n0 * kf); const prts = K.parts(name, w); const pts = spots.slice(k0, k0 + n); k0 += n; if (!prts || !pts.length) continue;
    for (const pr of prts) { const im = new THREE.InstancedMesh(pr.geometry, pr.material, pts.length); im.castShadow = w > 2; im.receiveShadow = true;
      pts.forEach(([x, z], i) => { const s2 = .7 + rr() * .7; mtx.compose(ps.set(x, 0, z), q.setFromAxisAngle(Y, rr() * 6.28), sc.set(s2, s2, s2)); im.setMatrixAt(i, mtx); }); scene.add(im); } }
}

function nearestRoad(x, z) {
  let best = null, bd = Infinity;
  for (const s of segments) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
    const px = s.ax + dx * t, pz = s.az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { s, px, pz, d }; }
  }
  return best;
}
// Ko'cha bo'yidagi tartibli uchastka: yo'l chetidan HOUSE_R+2 m, eshigi ko'chaga qaragan; band bo'lsa ko'cha bo'ylab 34 m qadam bilan qidiradi
function lotOnRoad(sg, px, pz, side) {
  const dx = sg.bx - sg.ax, dz = sg.bz - sg.az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz, nz = ux, off = (sg.hw || 5) + HOUSE_R + 2;
  const t0 = Math.max(0, Math.min(L, (px - sg.ax) * ux + (pz - sg.az) * uz));
  for (let k = 0; k < 40; k++) { const step = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 46; for (const sd of [side, -side]) {
    const x = sg.ax + ux * (t0 + step) + nx * off * sd, z = sg.az + uz * (t0 + step) + nz * off * sd;
    if (houseSpotFree(x, z)) return { x, z, rot: Math.atan2(-nx * sd, -nz * sd) };
  } }
  return null;
}
// Yo'l chetigacha masofa (manfiy — yo'l ustida)
const SEGC = 60; let segGrid = null;
function buildSegGrid() { segGrid = new Map(); for (const sg of segments) { const x0 = Math.floor((Math.min(sg.ax, sg.bx) - 30) / SEGC), x1 = Math.floor((Math.max(sg.ax, sg.bx) + 30) / SEGC), z0 = Math.floor((Math.min(sg.az, sg.bz) - 30) / SEGC), z1 = Math.floor((Math.max(sg.az, sg.bz) + 30) / SEGC); for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x + ',' + z; if (!segGrid.has(k)) segGrid.set(k, []); segGrid.get(k).push(sg); } } }
function roadClearC(x, z) { if (!segGrid) buildSegGrid(); let b = Infinity; const cx = Math.floor(x / SEGC), cz = Math.floor(z / SEGC); for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) for (const s of segGrid.get((cx + i) + ',' + (cz + k)) || []) { const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2)); const d = Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) - (s.hw || 5); if (d < b) b = d; } return Math.min(b, 999); }
function rectClearC(cx, cz, half) { for (let x = -half; x <= half + .01; x += 3) for (let z = -half; z <= half + .01; z += 3) if (roadClearC(cx + x, cz + z) < .5) return false; return true; }
const HOUSE_R = 23;
function houseSpotFree(x, z) { return roadClearC(x, z) >= HOUSE_R && !state.residents.some((r) => !r.homeless && r.username !== me?.username && Math.hypot(r.x - x, r.z - z) < HOUSE_R * 2) && !(state.houses || []).some((h) => Math.hypot(h.x - x, h.z - z) < HOUSE_R * 2) && !state.plots.some((p) => x > p.x1 - HOUSE_R && x < p.x2 + HOUSE_R && z > p.z1 - HOUSE_R && z < p.z2 + HOUSE_R); }
function nearestStreetName(x, z) {
  let best = '', bd = Infinity;
  for (const s of segments) { if (!s.name) continue; const d = Math.hypot((s.ax + s.bx) / 2 - x, (s.az + s.bz) / 2 - z); if (d < bd) { bd = d; best = s.name; } }
  return bd < 400 ? best : '';
}
const nearestMahalla = (x, z) => mahallaAt(x, z) || places.reduce((b, p) => { const d = Math.hypot(p.x - x, p.z - z); return d < b.d ? { d, n: p.name } : b; }, { d: Infinity, n: '' }).n;

// ---- Uylar va binolar ----
const objects = new THREE.Group(); scene.add(objects); const houseLabelGroups = [];
const clickable = [];
const hsl = (h, s = .65, l = .62) => new THREE.Color().setHSL(h / 360, s, l);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .05, ...o });
const WALL = (c) => new THREE.MeshStandardMaterial({ color: c, map: TEX.plaster, roughness: .9 });
const ROOF = (c) => new THREE.MeshStandardMaterial({ color: c, map: TEX.tiles, roughness: .75 });
const BRICKM = new THREE.MeshStandardMaterial({ ...pbr('bricks', 3), roughness: .95 });
const BRICK = () => BRICKM;
const GLASS = new THREE.MeshStandardMaterial({ color: 0x8fb8d8, roughness: .05, metalness: .9, envMapIntensity: 1.4 });
const FRAME = M(0x2b2f36, { roughness: .4, metalness: .6 });
const WOOD = M(0x9a6b43, { roughness: .8 });
function box(g, w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
// Ramkali deraza: shisha + qora ramka
function win(g, w, h, x, y, z, rotY = 0) { const wg = new THREE.Group(); box(wg, w + .3, h + .3, .15, FRAME); box(wg, w, h, .2, GLASS); box(wg, .12, h, .25, FRAME); wg.position.set(x, y, z); wg.rotation.y = rotY; g.add(wg); return wg; }
function windowsRow(g, w, y, z, n, h = 2.4) { for (let i = 0; i < n; i++) win(g, (w / n) * .62, h, -w / 2 + (w / n) * (i + .5), y, z); }
function railing(g, w, x, y, z) { box(g, w, 1, .1, new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: .35, roughness: .05, metalness: .3 }), x, y, z); box(g, w, .08, .14, FRAME, x, y + 1, z); }
function tree(g, x, z, s = 1) { const qn = ['q-tree-a', 'q-tree-b', 'q-bush'][Math.abs(Math.round(x * 7 + z * 3)) % 3]; if (K.has(qn)) { const m = K.place(qn, (qn === 'q-bush' ? 3 : 6) * s); m.position.set(x, 0, z); g.add(m); return; } const t = new THREE.Mesh(new THREE.SphereGeometry(2.2 * s, 14, 10), M(new THREE.Color().setHSL(rnd(.25, .32), .55, rnd(.24, .32)), { roughness: .85 })); t.position.set(x, 3.6 * s, z); t.castShadow = true; g.add(t); box(g, .4 * s, 2.4 * s, .4 * s, M(0x6b4a2b), x, 0, z); }
const LAWN = new THREE.MeshStandardMaterial({ ...pbr('grass', 4), roughness: 1, color: 0xe0f5b8 });
const GRILLE = new THREE.MeshStandardMaterial({ map: canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s); g.fillStyle = '#2f343b'; for (let x = 0; x < s; x += 8) g.fillRect(x, 0, 2, s); }, 1), transparent: true, alphaTest: .3, side: THREE.DoubleSide });
GRILLE.map.repeat.set(12, 1);
const FENCE = new THREE.MeshStandardMaterial({ color: 0xf3f1ea, roughness: .7 }), BARS = new THREE.MeshStandardMaterial({ color: 0x3b4048, metalness: .6, roughness: .4 }), HEDGE = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: .95 }), STONE = new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: .9 });
// Hovli: maysa + oq devorli panjara (old tomonda darvoza), tosh yo'lak, butalar
function lawn(g, w, d, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, .15, d), LAWN); m.position.set(0, .07, z); m.receiveShadow = true; g.add(m);
  const f = new THREE.Group(), gate = 6, hw = w / 2, hd = d / 2;
  const side = (len, x, zz, rot) => { const s1 = new THREE.Group(); box(s1, len, .55, .3, FENCE, 0, 0, 0); box(s1, len, .08, .08, BARS, 0, 1.45, 0); for (let p = -len / 2; p <= len / 2 + .01; p += 2.4) box(s1, .3, 1.6, .3, FENCE, p, 0, 0); box(s1, len, .9, .03, GRILLE, 0, .55, 0); s1.position.set(x, 0, zz); s1.rotation.y = rot; f.add(s1); };
  side(w, 0, z - hd, 0); side(d, -hw, z, Math.PI / 2); side(d, hw, z, Math.PI / 2);
  const fl = (w - gate) / 2; side(fl, -(gate / 2 + fl / 2), z + hd, 0); side(fl, gate / 2 + fl / 2, z + hd, 0);
  box(f, gate - .4, .12, hd - 4, STONE, 0, .08, z + hd / 2 + 2); // darvozadan uygacha tosh yo'lak
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(fl - 1.6, .9, 1.3), HEDGE); h.position.set(sx * (gate / 2 + fl / 2), .55, z + hd - 1.4); h.castShadow = true; g.add(h); }
  g.add(f);
}
// Uy dizaynlari: oddiy → zamonaviy → kottej → villa → minora
const HOUSE_BUILDERS = {
  oddiy(g, c) {
    lawn(g, 22, 26, 3);
    box(g, 12, 7, 11, WALL(0xf3ecdc));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.6, 4.5, 4), ROOF(c)); roof.position.y = 9.25; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, .95); roof.castShadow = true; g.add(roof);
    box(g, 2.2, 4, .3, WOOD, 0, 0, 5.6); win(g, 2.4, 2, -3.6, 3, 5.6); win(g, 2.4, 2, 3.6, 3, 5.6);
    box(g, 4, .25, 3, M(0xcfc6b5), 0, 0, 7); tree(g, 8, 8, .8);
    return 13;
  },
  zamonaviy(g, c) {
    lawn(g, 30, 30, 3);
    box(g, 17, 6, 12, WALL(0xf6f6f3)); box(g, 11, 5.2, 10, M(c, { roughness: .45 }), 3, 6, -1);
    box(g, 18, .5, 13, M(0x2b2f36), 0, 6); box(g, 12, .5, 11, M(0x2b2f36), 3, 11.2);
    box(g, 9, 4.6, .35, GLASS, -3.6, .6, 6.05); box(g, 9.3, .2, .45, FRAME, -3.6, 5.2, 6.05);
    win(g, 7, 3.2, 3, 8.2, 4.1); railing(g, 7, 3, 6.5, 4.5);
    for (let i = 0; i < 8; i++) box(g, .35, 5.6, .3, WOOD, 3.2 + i * .65, 0, 6.15); // yog'och panel
    box(g, 3, 4.4, .3, M(0x3b2a1e), -1, 0, 6.1);
    box(g, 20, .3, 6, M(0xd9d4c7), 0, 0, 9); tree(g, -12, 8); tree(g, 12, -6, .9);
    return 14;
  },
  kottej(g, c) {
    lawn(g, 30, 32, 3);
    box(g, 16, 5, 13, WALL(0xefe6d6)); box(g, 16, 4.6, 13, BRICK(), 0, 5);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 12.4, 5.5, 4, 1), ROOF(c)); roof.position.y = 12.4; roof.rotation.y = Math.PI / 4; roof.scale.set(1.08, 1, .9); roof.castShadow = true; g.add(roof);
    for (const x of [-5, 0, 5]) win(g, 2.6, 2.6, x, 1.2, 6.6); for (const x of [-5, -1.5, 2, 5.5]) win(g, 2.2, 2.4, x, 6, 6.6);
    box(g, 10, .4, 3, M(0xffffff), 0, 5, 7.8); railing(g, 10, 0, 5.4, 9.2);
    box(g, 2.6, 4.2, .3, WOOD, 0, 0, 6.7); box(g, 2, 3, 2, M(0x9a8f80), 5, 12, 0);
    for (let x = -14; x <= 14; x += 2) box(g, .15, 1.2, .15, M(0xffffff), x, 0, 18); box(g, 28, .12, .12, M(0xffffff), 0, 1, 18);
    tree(g, -11, 10); tree(g, 11, 11, 1.1);
    return 17;
  },
  villa(g, c) {
    lawn(g, 40, 38, 5);
    box(g, 26, 6, 15, WALL(0xfbfaf7)); box(g, 15, 5.4, 12, WALL(0xfbfaf7), -5.5, 6, -1.5);
    box(g, 27.5, .6, 16.5, M(c, { roughness: .4 }), 0, 6); box(g, 16.5, .6, 13.5, M(c, { roughness: .4 }), -5.5, 11.4);
    box(g, 22, 4.8, .35, GLASS, 0, .6, 7.55); for (let x = -10; x <= 10; x += 4.4) box(g, .2, 4.8, .45, FRAME, x, .6, 7.55);
    win(g, 12, 3.6, -5.5, 7.6, 4.55); railing(g, 14, -5.5, 6.6, 6.2);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(13, .3, 6.5), new THREE.MeshStandardMaterial({ color: 0x2fb6ea, roughness: .05, metalness: .2 })); pool.position.set(5, .32, 13.5); g.add(pool);
    box(g, 15.5, .25, 9, M(0xe8e1d2), 5, 0, 13.5);
    for (let i = 0; i < 3; i++) box(g, 1, .5, 2.2, M(0xffffff), -6 + i * 1.6, .25, 13.5);
    for (const x of [-15, 15]) tree(g, x, 12, 1.2); tree(g, -16, -6); tree(g, 16, -6);
    return 15;
  },
  minora(g, c) {
    lawn(g, 30, 30, 3);
    box(g, 16, 4.5, 16, M(0x2b2f36));
    for (let f = 0; f < 12; f++) { box(g, 13.4, 3.4, 13.4, GLASS, 0, 4.5 + f * 3.8); box(g, 14.2, .4, 14.2, M(c, { roughness: .3, metalness: .4 }), 0, 7.9 + f * 3.8); }
    for (const [x, z] of [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]]) box(g, .6, 46, .6, M(c, { roughness: .3, metalness: .4 }), x, 4.5, z);
    box(g, 2, 7, 2, M(0xdddddd), 0, 50); tree(g, -12, 10); tree(g, 12, 10);
    return 60;
  },
};
// ---- Mashinalar: sport — haqiqiy 3D model (Ferrari 458), boshqalari — profil bo'yicha chizilgan ----
// 👑 Sahifa egasining mega-binosi: pog'onali shisha osmono'par (~330 m), shpil, tunda yonadigan chiroqlar
HOUSE_BUILDERS.megaOld = function (g, c) {
  lawn(g, 64, 64, 0);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, .4, 48), M(0xe9e4da, { roughness: .8 })); plaza.position.y = .2; plaza.receiveShadow = true; g.add(plaza);
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9cc7e6, metalness: .95, roughness: .06, envMapIntensity: 1.6, emissive: 0x1b3550, emissiveIntensity: .35 });
  const frameM = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: .9, roughness: .25 });
  const tiers = [[16, 70], [13.5, 60], [11, 55], [8.5, 50], [6.2, 40], [4.2, 30]]; let y = 0;
  tiers.forEach(([r, h], i) => {
    for (let k = 0; k < 3; k++) { // uch qanotli (Y shaklidagi) pog'onalar
      const wing = new THREE.Mesh(new THREE.CylinderGeometry(r * .55, r * .62, h, 6), glassM); const a = k * Math.PI * 2 / 3 + i * .12;
      wing.position.set(Math.cos(a) * r * .55, y + h / 2, Math.sin(a) * r * .55); wing.castShadow = true; g.add(wing);
    }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r * .62, r * .7, h, 24), glassM); core.position.y = y + h / 2; core.castShadow = true; g.add(core);
    for (let f = 4; f < h; f += 4) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * .72, r * .72, .35, 24), frameM); ring.position.y = y + f; g.add(ring); }
    y += h;
  });
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(.25, 2.2, 70, 12), frameM); spire.position.y = y + 35; spire.castShadow = true; g.add(spire);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xff2020, emissiveIntensity: 2 })); beacon.position.y = y + 71; g.add(beacon);
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const f = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 12), M(0x2fb6ea, { metalness: .2, roughness: .05 })); f.position.set(Math.cos(a) * 22, .6, Math.sin(a) * 22); g.add(f); }
  return y + 75;
};
const CAR_PROFILES = { // yon profil [uzunlik bo'yicha x, balandlik y] (metr)
  sedan: [[-2.3, .35], [2.3, .35], [2.35, .8], [1.6, 1], [.9, 1.45], [-.7, 1.5], [-1.6, 1.05], [-2.35, .95]],
  jeep: [[-2.35, .45], [2.35, .45], [2.4, 1.15], [1.7, 1.3], [1.35, 2], [-2.2, 2.05], [-2.4, 1.3]],
  limuzin: [[-3.6, .35], [3.6, .35], [3.65, .8], [2.8, 1], [2.1, 1.45], [-2.4, 1.5], [-3, 1.05], [-3.65, .95]],
  sport: [[-2.2, .3], [2.25, .3], [2.3, .6], [1.2, .85], [.3, 1.2], [-.9, 1.2], [-2.25, .85]],
};
function proceduralCar(t, paint) {
  const g = new THREE.Group(), prof = CAR_PROFILES[t] || CAR_PROFILES.sedan, w = t === 'jeep' ? 2.05 : 1.9;
  const sh = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)));
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: w - .3, bevelEnabled: true, bevelThickness: .15, bevelSize: .12, bevelSegments: 3 }), paint);
  body.position.z = -(w - .3) / 2; body.castShadow = true; g.add(body);
  const top = prof.filter(([, y]) => y > 1.1), xs = top.map(([x]) => x);
  if (xs.length) { const gw = Math.max(...xs) - Math.min(...xs); const gl = new THREE.Mesh(new THREE.BoxGeometry(gw * .92, .42, w + .02), GLASS); gl.position.set((Math.max(...xs) + Math.min(...xs)) / 2, Math.min(...top.map(([, y]) => y)) - .28, 0); g.add(gl); }
  const L = prof.reduce((a, [x]) => Math.max(a, Math.abs(x)), 0) - .75;
  for (const x of [-L, L]) for (const z of [-w / 2, w / 2]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 18), M(0x15171a, { roughness: .8 })); wh.rotation.x = Math.PI / 2; wh.position.set(x, .42, z); g.add(wh); const rim = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .32, 10), M(0xcfd3d8, { metalness: 1, roughness: .2 })); rim.rotation.x = Math.PI / 2; rim.position.set(x, .42, z); g.add(rim); }
  for (const z of [-.6, .6]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(.1, .18, .35), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4cc, emissiveIntensity: 1 })); hl.position.set(prof[1][0] + .05, .75, z); g.add(hl); }
  return g;
}
const BUILD = makeBuildings({ THREE, box, M, GLASS, FRAME, WOOD, WALL, ROOF, BRICK, win, tree, lawn, proceduralCar });
const bInfo = (st) => (String(st || '').startsWith('b:') ? (state.shop?.buildings || wallet.shop?.buildings || {})[st.slice(2)] : null);
// Uy dizayni yoki bino turi bo'yicha chizish
const KH = { oddiy: 'building-type-a', zamonaviy: 'building-type-j', kottej: 'building-type-d', villa: 'building-type-p', minora: 'c-building-skyscraper-a' };
for (const c of 'abcdefghijklmnopqrstu') KH['uy_' + c] = 'building-type-' + c; // 21 ta Kenney uyi
const MB = ['house-a', 'house-b', 'house-c', 'tower-a', 'tower-b', 'tower-c', 'tower-d']; for (const c of MB) KH['mb_' + c] = 'm-building-sample-' + c; // fps-kit: g'ishtli modul uylar va minoralar
const KB = { shop: 'c-building-a', cafe: 'c-building-b', pharmacy: 'c-building-c', market: 'c-building-d', restaurant: 'c-building-e', cinema: 'c-building-f', gym: 'c-building-g', bank: 'c-building-h', carshow: 'c-building-i', garage: 'c-building-k', office: 'c-building-skyscraper-a', hotel: 'c-building-skyscraper-b', hospital: 'c-building-skyscraper-c', bakery: 'c-building-l', guesthouse: 'building-type-m' };
// Kenney modeli bilan: hovli (panjara, yo'lak) + model + daraxt
// Hovli bezagi (fps-kit): gullar, butalar, tosh yo'lak, gultuvak
function yardDecor(g, seed) {
  const add = (n, w, x, z, r = 0) => { if (!K.has(n)) return; const o = K.place(n, w); o.position.set(x, .15, z); o.rotation.y = r; g.add(o); };
  const fl = ['n-flower-group', 'n-bush-with-flowers', 'n-flower-single'];
  for (let i = 0; i < 6; i++) { const x = -12 + i * 4.8; if (Math.abs(x) < 4) continue; add(fl[(seed + i) % 3], 1.6, x, 16.2, i); }
  add('n-bush', 2.4, -12.5, -10); add('n-bush', 2.2, 12.5, -10); add('n-fern', 1.4, -12, 2); add('n-plant-big', 1.4, 12, 3);
  add('s-planter', 1.6, -2.6, 11.5); add('s-planter', 1.6, 2.6, 11.5);
}
function kenneyLot(g, name, w = 16) {
  const big = name.includes('skyscraper'); lawn(g, big ? 30 : 28, big ? 30 : 30, 3);
  const m = K.place(name, big ? 18 : (name.startsWith('m-') ? 14 : w)); g.add(m); tree(g, -11, 9, .9); tree(g, 11, 11, .8);
  yardDecor(g, name.length * 7);
  return m.userData.height + 2;
}
function buildStyle(g, st, c) { const b = bInfo(st); if (b && KB[b.m] && K.has(KB[b.m])) return kenneyLot(g, KB[b.m], 18); if (b) return (BUILD[b.m] || BUILD.shop)(g, c);
  if (KH[st || 'oddiy'] && K.has(KH[st || 'oddiy'])) return kenneyLot(g, KH[st || 'oddiy']); return (HOUSE_BUILDERS[st] || HOUSE_BUILDERS.oddiy)(g, c); }
const styleName = (st) => { const b = bInfo(st); return b ? `${b.i} ${b.n}` : (STYLE_NAMES[st] || '🏠 ' + (st || 'oddiy')); };
const stylePriceC = (st, sh) => { const b = bInfo(st); return b ? b.p : (sh?.houses?.[st] || 0); };
let ferrariP = null;
function loadFerrari() {
  if (!ferrariP) ferrariP = new Promise((ok) => {
    const dl = new DRACOLoader(); dl.setDecoderPath('./vendor/addons/libs/draco/gltf/');
    const ld = new GLTFLoader(); ld.setDRACOLoader(dl);
    ld.load('./models/ferrari.glb', (gl) => ok(gl.scene.children[0]), undefined, () => ok(null));
  });
  return ferrariP;
}
const lodCars = [];
const KC = { sedan: 'car-sedan', jeep: 'car-suv', limuzin: 'car-suv-luxury', sport: 'car-sedan-sports' };
function car(type, hex) {
  if (KC[type] && K.has(KC[type])) { // Kenney mashinasi, tanlangan rangga bo'yaladi
    const m = K.place(KC[type], type === 'limuzin' ? 5.4 : 4.6); m.rotation.y = Math.PI / 2;
    const tint = new THREE.Color(hex || '#c0392b').lerp(new THREE.Color(0xffffff), .35);
    m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.copy(tint); } });
    const g = new THREE.Group(); g.add(m); return g;
  }
  const g = new THREE.Group(), color = new THREE.Color(hex || '#c0392b');
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .9, roughness: .35, clearcoat: 1, clearcoatRoughness: .05 });
  const simple = proceduralCar(type, paint); g.add(simple);
  if (type === 'sport') { // yaqin kelganda haqiqiy model yuklanadi
    g.userData.lod = { simple, real: null, loading: false, paint };
    lodCars.push(g);
  }
  return g;
}
async function upgradeLod(g) {
  const l = g.userData.lod; if (l.real || l.loading) return; l.loading = true;
  const base = await loadFerrari(); if (!base) return;
  const real = base.clone(true);
  real.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material?.name === 'body' || o.name === 'body') o.material = l.paint; } });
  const bodyObj = real.getObjectByName('body'); if (bodyObj) bodyObj.material = l.paint;
  real.rotation.y = Math.PI / 2; real.userData = g.userData; l.real = real; g.add(real); real.visible = false;
}
const CAR_SLOTS = [[-11, 8, 0], [-11, 12, 0], [11, 12, 0], [-14, 4, Math.PI / 2], [14, 4, Math.PI / 2], [-6, 16, 0], [6, 16, 0], [0, 16, 0], [-14, -2, Math.PI / 2], [14, -2, Math.PI / 2], [-11, 16, 0], [11, 16, 0]];
// Avatar: Instagram rasmi (bo'lmasa — bosh harf) dumaloq qilib
const avatarCache = new Map();
function avatarSprite(r) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const draw = (img) => {
    g.clearRect(0, 0, 128, 128);
    g.save(); g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.closePath();
    const grd = g.createLinearGradient(0, 0, 128, 128); grd.addColorStop(0, '#feda75'); grd.addColorStop(.5, '#d62976'); grd.addColorStop(1, '#4f5bd5');
    g.fillStyle = grd; g.fill(); g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.clip();
    if (img) g.drawImage(img, 10, 10, 108, 108);
    else { g.fillStyle = hsl(r.color, .55, .55).getStyle(); g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = 'bold 60px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r.username[0].toUpperCase(), 64, 68); }
    g.restore(); tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; draw(null);
  if (r.avatar) {
    let p = avatarCache.get(r.username);
    if (!p) { p = new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = '/avatar/' + encodeURIComponent(r.username); }); avatarCache.set(r.username, p); }
    p.then((im) => im && draw(im));
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(9, 9, 1); sp.renderOrder = 11;
  return sp;
}
const colorOf = (o, hueDefault) => o.colorHex ? new THREE.Color(o.colorHex) : hsl(o.color ?? hueDefault);
function house(r, opts = {}) {
  const g = new THREE.Group();
  const top = buildStyle(g, r.style, colorOf(r, 20));
  const bi = bInfo(r.style); if (bi) { const sg = label(`${bi.i} ${r.bname || bi.n}`, { size: 28, bg: 'rgba(29,43,83,.92)', fg: '#fff', scale: .85 }); sg.position.y = top + 5.5 + (bi.m === 'office' || bi.m === 'hotel' ? 0 : 0); sg.position.y = top - 1.5; sg.renderOrder = 12; g.add(sg); }
  (r.cars || []).slice(0, CAR_SLOTS.length).forEach((c, i) => { const cg = car(c.t, c.c); const [x, z, ry] = CAR_SLOTS[i]; cg.position.set(x, 0, z); cg.rotation.y = ry + Math.PI / 2; g.add(cg); });
  const av = avatarSprite(r); av.position.y = top + 19.5; av.userData.lod = 1; g.add(av); houseLabelGroups.push(g);
  if (!opts.data) { const bl = label('💰 ' + money(r.balance || 0), { size: 26, bg: 'rgba(255,214,90,.95)', fg: '#3b2f00', scale: .75 }); bl.position.y = top + 27; bl.renderOrder = 12; bl.userData.lod = 2; g.add(bl); } // hamyondagi summa — rasm tepasida
  const l = label(opts.label || (r.owner ? '👑 @' : '@') + r.username, { size: 26, fg: r.owner ? '#b8860b' : '#2f7cf6', scale: r.owner ? 1.6 : .9 }); l.position.y = top + 11.5; l.userData.lod = 1; g.add(l);
  const adr = [r.mahalla && r.mahalla !== 'Shahar chekkasi' ? r.mahalla : '', r.street, r.no && 'uy ' + r.no].filter(Boolean).join(', ');
  if (adr) { const al = label('📍 ' + adr, { size: 24, bg: 'rgba(255,255,255,.95)', fg: '#1d2433', scale: .7 }); al.position.y = top + 3.2; al.renderOrder = 12; al.userData.lod = 2; g.add(al); }
  g.position.set(r.x, 0, r.z);
  if (r.rot) { const body = new THREE.Group(); for (const c of [...g.children]) if (!c.isSprite) body.add(c); body.rotation.y = r.rot; g.add(body); } // butun hovli ko'chaga qaratib buriladi (yozuvlar burilmaydi)
  g.userData = opts.data || { kind: 'house', r };
  g.traverse((o) => { if (o.isMesh || o.isSprite) { o.userData = g.userData; clickable.push(o); } });
  return g;
}
const TYPE_STYLE = { uy: [0xf2ead3, 10], "do'kon": [0xffd36e, 8], kafe: [0xff9f80, 7], ofis: [0x9cc3ff, 30], mehmonxona: [0xc6a7ff, 40], maktab: [0xffe08a, 14], masjid: [0x7fd6c2, 16], "bog'": [0x6fd17c, 1], zavod: [0xb8bec9, 18], boshqa: [0xe7e1cf, 10] };
const TYPE_ICON = { uy: '🏠', "do'kon": '🛒', kafe: '☕', ofis: '🏢', mehmonxona: '🏨', maktab: '🏫', masjid: '🕌', "bog'": '🌳', zavod: '🏭', boshqa: '📍' };
function plotObj(p) {
  const g = new THREE.Group();
  const w = p.x2 - p.x1, d = p.z2 - p.z1, cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2;
  const base = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: p.status === 'sold' ? 0xcfeec0 : 0xffe9a8, transparent: true, opacity: .85 }));
  base.rotation.x = -Math.PI / 2; base.position.set(cx, .6, cz); g.add(base);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, .1, d)), new THREE.LineBasicMaterial({ color: p.status === 'sold' ? 0x1fa463 : 0xe0a100 }));
  edges.position.set(cx, .7, cz); g.add(edges);
  let top = 4;
  if (p.status === 'sold' && p.built === false) { // bo'sh joy: qoziqlar bilan o'ralgan, uy hali qurilmagan
    for (let x = p.x1; x <= p.x2; x += 4) for (const z of [p.z1, p.z2]) box(g, .25, 1.2, .25, WOOD, x, 0, z);
    for (let z = p.z1; z <= p.z2; z += 4) for (const x of [p.x1, p.x2]) box(g, .25, 1.2, .25, WOOD, x, 0, z);
    top = 6;
  } else if (p.status === 'sold') {
    const [col, h] = TYPE_STYLE[p.type] || TYPE_STYLE.boshqa;
    if (p.type === "bog'") {
      for (let i = 0; i < Math.min(30, p.area / 60); i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(4, 12, 6), new THREE.MeshLambertMaterial({ color: 0x4cbf5d })); t.position.set(p.x1 + Math.random() * w, 6, p.z1 + Math.random() * d); g.add(t); }
      top = 16;
    } else {
      const bw = Math.max(4, w * .75), bd = Math.max(4, d * .75);
      if (p.type === 'uy' || (p.style && p.style !== 'oddiy')) { // dizaynli bino: joy o'lchamiga moslab
        const hg = new THREE.Group(); const t = buildStyle(hg, p.style, colorOf(p, 40));
        const sc = Math.max(.6, Math.min(bw / 24, bd / 18, 4)); hg.scale.setScalar(sc); hg.position.set(cx, 0, cz); g.add(hg);
        hg.traverse((o) => { if (o.isMesh) { o.userData = { kind: 'plot', p }; clickable.push(o); } });
        top = t * sc + 6;
      } else {
        const b = box(g, bw, h, bd, M(col), cx, 0, cz);
        box(g, bw + 1, 1.2, bd + 1, M(0x6b7a90), cx, h, cz);
        if (h >= 7) for (let y = 2; y < h - 2; y += 4) box(g, bw * .8, 2, bd + .2, GLASS, cx, y, cz);
        if (p.type === 'masjid') { const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(bw, bd) / 3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2aa3c9)); dome.position.set(cx, h + 1, cz); g.add(dome); }
        b.userData = { kind: 'plot', p }; clickable.push(b);
        top = h + 10;
      }
    }
  }
  base.userData = { kind: 'plot', p }; clickable.push(base);
  const l = label(`${bInfo(p.style)?.i || TYPE_ICON[p.type] || ''} ${p.bname || p.name}${p.status === 'pending' ? ' (kutilmoqda)' : p.built === false ? ' 🏗️ qurilmagan' : ''}`, { size: 26, bg: p.status === 'sold' ? 'rgba(255,255,255,.95)' : 'rgba(255,233,168,.95)', scale: 1 });
  l.position.set(cx, top, cz); g.add(l);
  return g;
}

// ---- Holat ----
let state = { residents: [], plots: [], settings: {}, types: [] };
let me = store.get('me'); // {username,password}
async function refresh() {
  state = await api('/api/state');
  clickable.length = 0; clickable.push(...poiLabels);
  objects.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  objects.clear(); lodCars.length = 0; houseLabelGroups.length = 0;
  state.residents.forEach((r) => { if (!r.homeless) objects.add(house(r)); });
  (state.houses || []).forEach((h) => { const o = state.residents.find((r) => r.username === h.owner) || {}; objects.add(house({ ...h, username: h.owner, avatar: o.avatar, cars: [] }, { label: `@${h.owner} ${h.n}`, data: { kind: 'xhouse', h } })); });
  state.plots.forEach((p) => objects.add(plotObj(p)));
  $('count').textContent = `${state.residents.length} ta uy`;
  renderMe();
  checkUnread();
  loadWallet();
}
const myRes = () => me && state.residents.find((r) => r.username === me.username);
function renderMe() {
  const r = myRes();
  $('guest').classList.toggle('hidden', !!r);
  $('me').classList.toggle('hidden', !r);
  if (r) { $('mename').textContent = '@' + r.username; $('meaddr').textContent = r.homeless ? '🏚️ uysiz' : [r.mahalla, r.street, r.no && 'uy ' + r.no].filter(Boolean).join(', '); }
}
function flyTo(x, z, dist = 160) {
  const from = camera.position.clone(), fromT = controls.target.clone();
  const toT = new THREE.Vector3(x, 0, z), to = new THREE.Vector3(x, dist, z + dist * 1.1);
  const t0 = performance.now(); const step = () => { const t = Math.min(1, (performance.now() - t0) / 900); const e = 1 - Math.pow(1 - t, 3); camera.position.lerpVectors(from, to, e); controls.target.lerpVectors(fromT, toT, e); if (t < 1) requestAnimationFrame(step); }; step(); // vaqt bo'yicha: sekin qurilmada ham 0.9 s
}

// ---- Modal ----
function modal(html) { $('mbox').innerHTML = html; $('modal').classList.remove('hidden'); }
const closeModal = () => $('modal').classList.add('hidden');
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('npok')) closeModal(); });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => Number(v).toLocaleString('ru-RU') + ' ' + (state.settings.currency || "so'm");

// ---- Rejimlar: ko'chish va joy sotib olish ----
let mode = 'view', corner = null, preview = null;
const status = (t) => { $('status').textContent = t; $('status').classList.toggle('hidden', !t); };
function setMode(m) {
  mode = m; corner = null; if (preview) { scene.remove(preview); preview = null; }
  status(m === 'move' ? "🚚 Xaritada yangi uyingiz uchun ko'cha bo'yidagi joyni bosing (Esc — bekor)" : m === 'buy' ? '📐 Xaritada joyni bosib belgilang (Esc — bekor)' : '');
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMode('view'); });

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function groundPoint(e) { mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera); const h = ray.intersectObject(ground)[0]; return h && h.point; }
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) onClick(e); });

async function onClick(e) {
  const p = groundPoint(e);
  if (mode === 'move' && p) {
    const n = nearestRoad(p.x, p.z);
    if (!n || n.d > 80) return status("Yo'lga yaqinroq joyni tanlang (80 m ichida)");
    const dx = n.s.bx - n.s.ax, dz = n.s.bz - n.s.az, L = Math.hypot(dx, dz) || 1;
    const side = ((p.x - n.px) * -dz / L + (p.z - n.pz) * dx / L) >= 0 ? 1 : -1;
    const lot = lotOnRoad(n.s, p.x, p.z, side) || { x: p.x, z: p.z, rot: 0 }; // bo'sh joyni server ham o'zi topadi
    const { x, z, rot } = lot;
    const street = n.s.name || nearestStreetName(x, z), mahalla = nearestMahalla(x, z);
    modal(`<h3>Ko'chib o'tasizmi?</h3><div>📍 ${esc(mahalla || 'Noma\'lum mahalla')}${street ? ', ' + esc(street) : ''}</div><div class="row"><button class="ok" id="yes">Ha, ko'chaman</button><button class="ghost" id="nope">Yo'q</button></div>`);
    $('nope').onclick = closeModal;
    $('yes').onclick = async () => { try { const j = await api('/api/move', { ...me, x, z, rot, street, mahalla }); closeModal(); setMode('view'); await refresh(); flyTo(j.resident.x, j.resident.z); if (Math.hypot(j.resident.x - x, j.resident.z - z) > 3) toast("↔️ Uy yo'lga tushmasligi uchun eng yaqin bo'sh joyga qo'yildi"); } catch (er) { alert(er.message); } };
    return;
  }
  if (mode === 'buy' && p) {
    let cx = p.x, cz = p.z; const per = state.settings.pricePerSotix;
    // joyni yo'ldan chetga surish: belgilangan nuqtaga eng yaqin, yo'lga tegmaydigan markazni topadi
    const fitPlot = (sx) => { const half = Math.sqrt(Math.max(sx, .1) * 100) / 2 + 1; if (rectClearC(p.x, p.z, half)) return [p.x, p.z]; for (let r = 4; r < 260; r += 4) for (let a = 0; a < 6.28; a += 4 / r) { const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (rectClearC(x, z, half)) return [x, z]; } return null; };
    let street = nearestStreetName(cx, cz), mahalla = nearestMahalla(cx, cz);
    const show = (sx) => { // tanlangan sotixni xaritada kvadrat qilib ko'rsatish (yo'lga tegmasligi uchun suriladi)
      const f = fitPlot(sx); if (f) { [cx, cz] = f; street = nearestStreetName(cx, cz); mahalla = mahallaAt(cx, cz) || nearestMahalla(cx, cz); if ($('paddr')) $('paddr').textContent = '📍 ' + [mahalla, street].filter(Boolean).join(', '); }
      if ($('pmoved')) $('pmoved').textContent = !f ? "⚠️ Bu atrofda yo'lga tegmaydigan joy topilmadi — boshqa joyni bosing" : Math.hypot(cx - p.x, cz - p.z) > 2 ? "↔️ Joy yo'lga tushmasligi uchun biroz chetga surildi" : '';
      if (preview) scene.remove(preview);
      const a = Math.sqrt(Math.max(sx, .1) * 100);
      preview = new THREE.Mesh(new THREE.PlaneGeometry(a, a), new THREE.MeshBasicMaterial({ color: 0x2f7cf6, transparent: true, opacity: .45 }));
      preview.rotation.x = -Math.PI / 2; preview.position.set(cx, .8, cz); scene.add(preview);
    };
    modal(`<h3>📐 Joy sotib olish</h3>
      <div class="muted" id="paddr">📍 ${esc(mahalla)}${street ? ', ' + esc(street) : ''}</div><div class="muted" id="pmoved"></div>
      <label>Necha sotix kerak? <span class="muted">(1 sotix = 100 m²)</span><input id="psx" type="number" min="0.5" max="200" step="0.5" value="6"></label>
      <div class="wallet">1 sotix: <b>${money(per)}</b><br>Jami: <b id="ptot"></b><br><span class="muted">Hamyonda: ${money(wallet.balance)}</span></div>
      <label>Nima qurasiz?<select id="ptype">${state.types.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
      <input id="pname" placeholder="Nomi (masalan: Umid market)">
      <input id="pcontact" placeholder="Telefon raqamingiz (admin bog'lanishi uchun)">
      <div id="pnomoney"></div>
      <div class="row"><button class="ok" id="send">Sotib olish</button><button class="ghost" id="nope">Bekor</button></div>`);
    const upd = () => { const sx = Number($('psx').value) || 0, cost = Math.round(sx * per), ok = wallet.balance >= cost && sx > 0 && !!fitPlot(sx);
      $('ptot').textContent = `${sx} sotix (${Math.round(sx * 100)} m²) = ${money(cost)}`; show(sx);
      $('send').disabled = !ok; $('pnomoney').innerHTML = ok ? '' : `<span class="noc">✗ Hamyoningizda pul yetmaydi — yana ${money(cost - wallet.balance)} kerak.</span> <button class="ok" id="ptop2">💳 Balansni to'ldirish</button>`;
      if ($('ptop2')) $('ptop2').onclick = () => { setMode('view'); openTopup(); }; };
    $('psx').oninput = upd; loadWallet().then(upd); upd(); $('psx').focus(); $('psx').select();
    $('nope').onclick = () => { closeModal(); setMode('view'); };
    $('send').onclick = async () => {
      try {
        const j = await api('/api/plots/request', { ...me, x: cx, z: cz, sotix: Number($('psx').value), type: $('ptype').value, name: $('pname').value, contact: $('pcontact').value, street, mahalla });
        modal(`<h3>✅ Joy sizniki!</h3><div>Pul hamyoningizdan yechildi. Endi "🏠 Uyim" bo'limidan u yerga uy qurishingiz mumkin.</div><button id="okk">Yaxshi</button>`);
        $('okk').onclick = closeModal; setMode('view'); await refresh();
      } catch (er) { alert(er.message); }
    };
    return;
  }
  // ko'rish rejimi: uy yoki binoni bosish
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(clickable)[0];
  if (hit?.object.userData.kind === 'house') {
    const r = hit.object.userData.r;
    if (myRes() && r.username === me.username) return openMyPanel();
    return openHouseInfo(r);
  } else if (hit?.object.userData.kind === 'poi') { return openPoi(hit.object.userData.p);
  } else if (hit?.object.userData.kind === 'xhouse') {
    const h = hit.object.userData.h;
    if (myRes() && h.owner === me.username) return openMyPanel();
    return openAssetInfo({ owner: h.owner, kind: 'house', refId: h.id, title: `🏠 @${h.owner} ${h.n}-uyi`, addr: [h.mahalla, h.street, h.no && 'uy ' + h.no].filter(Boolean).join(', '), price: stylePriceC(h.style, state.shop), x: h.x, z: h.z });
  } else if (hit?.object.userData.kind === 'plot') {
    const pl = hit.object.userData.p;
    modal(`<h3>${TYPE_ICON[pl.type] || ''} ${esc(pl.name)}</h3><div>Egasi: <b>@${esc(pl.owner)}</b></div><div class="muted">${pl.sotix} sotix (${pl.area} m²) · ${esc(pl.type)} · ${pl.status === 'sold' ? 'sotilgan' : "to'lov kutilmoqda"}</div><div class="muted">${esc([pl.mahalla, pl.street].filter(Boolean).join(', '))}</div><div class="row">${myRes() && pl.owner === me.username && pl.status === 'sold' ? (pl.built === false ? '<button class="ok" id="pup">🏗️ Uy qurish</button>' : '<button id="pup">🎨 Dizaynni o\'zgartirish</button>') : ''}${myRes() && pl.owner !== me.username ? '<button id="pchat">💬 Egasiga yozish</button>' + (pl.status === 'sold' ? '<button class="ok" id="pofr">💰 Sotib olish taklifi</button>' : '') : ''}<button class="ghost" id="nope">Yopish</button></div>`);
    $('nope').onclick = closeModal; if ($('pup')) $('pup').onclick = () => openDesigner(pl); if ($('pchat')) $('pchat').onclick = () => openChat(pl.owner); if ($('pofr')) $('pofr').onclick = () => openOffer({ owner: pl.owner, kind: 'plot', refId: pl.id, title: pl.name });
  }
}

function askNewPass() {
  modal(`<h3>🔐 Yangi parol qo'ying</h3><div class="hint">Birinchi kirish: umumiy parolni o'zingizning parolingizga almashtiring. Keyin har doim shu yangi parol bilan kirasiz.</div>
    <input id="np1" type="password" placeholder="Yangi parol"><input id="np2" type="password" placeholder="Yangi parolni takrorlang"><button class="ok" id="npok">Saqlash</button>`);
  $('npok').onclick = async () => {
    if ($('np1').value !== $('np2').value) return alert('Parollar bir xil emas');
    try { await api('/api/change-password', { ...me, newPassword: $('np1').value }); me.password = $('np1').value; store.set('me', me); closeModal(); alert('✅ Parol saqlandi'); } catch (e) { alert(e.message); }
  };
}
// ---- Tugmalar ----
$('login').onclick = async () => {
  try { const j = await api('/api/claim', { username: $('lu').value, password: $('lp').value }); me = { username: j.resident.username, password: $('lp').value }; store.set('me', me); await refresh(); if (!j.resident.homeless) flyTo(j.resident.x, j.resident.z); else { const pl = state.plots.find((p) => p.owner === j.resident.username); if (pl) flyTo((pl.x1 + pl.x2) / 2, (pl.z1 + pl.z2) / 2); } if (j.mustChange) askNewPass(); }
  catch (er) { alert(er.message); }
};
$('logout').onclick = () => { me = null; store.set('me', null); renderMe(); setMode('view'); };
$('gohome').onclick = () => { const r = myRes(); if (r && !r.homeless) flyTo(r.x, r.z); openMyPanel(); };
$('move').onclick = openMove;
$('buy').onclick = () => setMode('buy');
// Qidiruv: nik yoki manzil (mahalla, ko'cha, uy raqami) bo'yicha — uylar, qo'shimcha uylar va joylar
function searchAll(q) {
  const t = nk(q.replace(/^@/, '')); if (!t) return [];
  const words = q.toLowerCase().replace(/^@/, '').split(/[\s,]+/).filter(Boolean).map(nk).filter(Boolean);
  const hit = (...f) => { const hay = f.map(nk).join(' '); return words.every((w) => hay.includes(w)); };
  const out = [];
  for (const r of state.residents) if (!r.homeless && hit(r.username, r.mahalla, r.street, r.no, r.no && 'uy' + r.no)) out.push({ t: '@' + r.username, a: [r.mahalla, r.street, r.no && 'uy ' + r.no].filter(Boolean).join(', '), x: r.x, z: r.z, exact: nk(r.username) === t });
  for (const h of state.houses || []) if (hit(h.owner, h.mahalla, h.street, h.no, h.no && 'uy' + h.no)) out.push({ t: `@${h.owner} ${h.n}`, a: [h.mahalla, h.street, h.no && 'uy ' + h.no].filter(Boolean).join(', '), x: h.x, z: h.z });
  for (const p of state.plots) if (hit(p.owner, p.name, p.mahalla, p.street, p.no)) out.push({ t: `📐 ${p.name} (@${p.owner})`, a: [p.mahalla, p.street, p.no && 'uy ' + p.no].filter(Boolean).join(', '), x: (p.x1 + p.x2) / 2, z: (p.z1 + p.z2) / 2 });
  for (const p of pois) if (p.x !== undefined && hit(p.n, p.c, p.a)) out.push({ t: `${p.i} ${p.n}`, a: [p.c, p.a].filter(Boolean).join(' · '), x: p.x, z: p.z });
  return out.sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0)).slice(0, 15);
}
// Mening uyimdan masofa (asosiy uy; u bo'lmasa — birinchi mulkim)
function myBase() {
  const r = myRes(); if (!r) return null;
  if (!r.homeless) return { x: r.x, z: r.z };
  const h = (state.houses || []).find((x) => x.owner === r.username); if (h) return { x: h.x, z: h.z };
  const p = state.plots.find((x) => x.owner === r.username && x.status === 'sold'); return p ? { x: (p.x1 + p.x2) / 2, z: (p.z1 + p.z2) / 2 } : null;
}
const fmtDist = (m) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',') + ' km');
function distText(x, z) { const b = myBase(); if (!b) return ''; const d = Math.hypot(x - b.x, z - b.z); return d < 15 ? '🏠 bu sizning uyingiz' : '📏 uyingizdan ' + fmtDist(d); }
function showResults(list) {
  let box = $('qres'); if (!box) { box = document.createElement('div'); box.id = 'qres'; box.className = 'card qres'; document.querySelector('.search').after(box); }
  if (!list) { box.remove(); return; }
  const sr = document.querySelector('.search').getBoundingClientRect(); box.style.top = sr.bottom + 6 + 'px'; box.style.left = sr.left + 'px'; box.style.width = sr.width + 'px';
  box.innerHTML = list.length ? list.map((r, i) => { const dt = distText(r.x, r.z); return `<div class="qitem" data-i="${i}"><b>${esc(r.t)}</b>${dt ? ` <span class="dist">${dt}</span>` : ''}<div class="muted">📍 ${esc(r.a || '—')}</div></div>`; }).join('') : '<div class="muted">Hech narsa topilmadi</div>';
  box.querySelectorAll('.qitem').forEach((el) => (el.onclick = () => { const r = list[el.dataset.i]; goTo(r); }));
}
function goTo(r) { flyTo(r.x, r.z, 70); showResults(null); const dt = distText(r.x, r.z); toast(`${r.t}${dt ? ' — ' + dt : ''}`); showDistLine(r.x, r.z); }
// Xaritada uyimdan topilgan joygacha chiziq
let distLine = null;
function showDistLine(x, z) {
  if (distLine) { scene.remove(distLine); distLine = null; }
  const b = myBase(); if (!b || Math.hypot(x - b.x, z - b.z) < 15) return;
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(b.x, 3, b.z), new THREE.Vector3(x, 3, z)]);
  distLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xff3b6b, dashSize: 12, gapSize: 8, depthTest: false })); distLine.computeLineDistances(); distLine.renderOrder = 20; scene.add(distLine);
  setTimeout(() => { if (distLine) { scene.remove(distLine); distLine = null; } }, 20000);
}
const doSearch = () => { const list = searchAll($('q').value.trim()); if (list.length === 1) goTo(list[0]); else showResults(list); };
$('q').addEventListener('input', () => { const v = $('q').value.trim(); v.length >= 2 ? showResults(searchAll(v)) : showResults(null); });
document.addEventListener('click', (e) => { if (!e.target.closest('.search, .qres')) showResults(null); });
$('qbtn').onclick = doSearch; $('q').addEventListener('keydown', (e) => e.key === 'Enter' && doSearch());


// ---- Hamyon, uy dizayni, mashina ----
let wallet = { balance: 0, tx: [], shop: { houses: {}, cars: {}, repaint: 0 }, plots: [] };
async function loadWallet() { if (!myRes()) return; try { wallet = await api('/api/me', me); $('bal').textContent = money(wallet.balance); } catch {} }

// 👑 Profil egasining binosi: Burj Khalifa modeli ("( FREE ) Burj Khalifa Dubai", SDC PERFORMANCE, Sketchfab, CC-BY-4.0)
let burjP = null;
HOUSE_BUILDERS.mega = function (g, c) {
  const tmp = new THREE.Group(); g.add(tmp); const h = HOUSE_BUILDERS.megaOld(tmp, c); // model yuklanguncha vaqtinchalik
  burjP ||= new Promise((ok) => new GLTFLoader().load('./models/burj-khalifa.glb', (gl) => ok(gl.scene), undefined, () => ok(null)));
  burjP.then((sc) => {
    if (!sc) return; const m = sc.clone(true), box = new THREE.Box3().setFromObject(m), sz = box.getSize(new THREE.Vector3()), k = 600 / sz.y, cn = box.getCenter(new THREE.Vector3());
    m.scale.setScalar(k); m.position.set(-cn.x * k, -box.min.y * k, -cn.z * k);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color(0xdfe8f2), .55); o.material.metalness = .7; o.material.roughness = .22; o.material.envMapIntensity = 1.6; } } });
    g.remove(tmp); lawn(g, 120, 120, 0); g.add(m);
  });
  return Math.max(h, 600);
};
const STYLE_NAMES_EXTRA = {};
const STYLE_NAMES = { oddiy: '🏠 Oddiy', zamonaviy: '🏡 Zamonaviy', kottej: '🏘️ Kottej', villa: '🏝️ Villa', minora: '🏙️ Minora' };
const UY_NAMES = ["Ikki tomli hovli uy", "Quyosh panelli uy", "Ikki qavatli oilaviy uy", "Mo'rili ikki qavatli uy", "Katta ikki qavatli uy", "Keng tomli uy", "Bir qavatli shinam uy", "Uzun bir qavatli uy", "Bir qavatli kottej", "Mo'rili kottej", "Qiya tomli zamonaviy uy", "Qora-oq zamonaviy uy", "Burchakli bir qavatli uy", "Ayvonli ikki qavatli uy", "Terassali uy", "Tekis tomli villa", "Ayvonli zamonaviy villa", "Gulzorli ikki qavatli uy", "Ayvonli qishloq uyi", "Uch qavatli katta uy", "Terassali kichik uy"];
'abcdefghijklmnopqrstu'.split('').forEach((c, i) => { STYLE_NAMES['uy_' + c] = '🏡 ' + UY_NAMES[i]; });
Object.assign(STYLE_NAMES, { 'mb_house-a': "🧱 Bir qavatli g'isht uy", 'mb_house-b': "🧱 Ikki qavatli g'isht uy", 'mb_house-c': "🧱 Balkonli g'isht uy", 'mb_tower-a': '🏢 Ayvonli 4 qavatli bino', 'mb_tower-b': '🏢 Balkonli 3 qavatli bino', 'mb_tower-c': "🏢 Do'konli 4 qavatli bino", 'mb_tower-d': '🏢 5 qavatli turar-joy' });
STYLE_NAMES.mega = '👑 Mega-bino';
const CAR_NAMES = { yoq: '— Mashinasiz', sedan: '🚗 Sedan', jeep: '🚙 Jip', sport: '🏎️ Sport (Ferrari)', limuzin: '🚘 Limuzin' };
// ---- 💳 Balansni to'ldirish ----
const TST = { pending: '⏳ tekshirilmoqda', approved: '✅ tushdi', rejected: '❌ rad etildi' };
async function openTopup() {
  if (!myRes()) return alert('Avval saytga kiring');
  let info; try { info = await api('/api/topup/info', me); } catch (e) { return alert(e.message); }
  let file = null;
  const cards = info.cards;
  modal(`<h3>💳 Balansni to'ldirish</h3>
    <div class="wallet">💰 Hozirgi balans: <b>${money(wallet.balance)}</b></div>
    <label>1. Qancha summa kerak?<input id="tamt" type="number" min="${info.min || 1}" step="1000" placeholder="masalan 50000"></label>
    ${cards.length ? `<b>2. Shu kartaga o'tkazing</b> <span class="muted">(Click, Payme yoki bank ilovasi orqali)</span>
      ${cards.map((c, i) => `<div class="paycard"><div><div class="muted">${esc(c.bank || 'Karta')}</div><div class="cnum">${esc(c.number)}</div><div class="muted">${esc(c.holder || '')}</div></div><div class="row"><button class="ghost" data-cp="${i}">📋 Nusxa</button>${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener"><button class="ok">To'lash →</button></a>` : ''}</div></div>`).join('')}`
      : '<div class="hint" style="background:#fff3e0;padding:8px;border-radius:10px">Admin hali karta raqamini kiritmagan. Keyinroq urinib ko\'ring.</div>'}
    <label>3. To'lov cheki skrinshoti<input id="tfile" type="file" accept="image/*"></label>
    <img id="tprev" class="mimg hidden" style="max-height:180px">
    <div class="muted">${esc(info.note || '')}</div>
    <div class="row"><button class="ok" id="tsend" ${cards.length ? '' : 'disabled'}>Yuborish</button><button class="ghost" id="nope">Yopish</button></div>
    ${info.my.length ? `<details open><summary class="muted">Mening so'rovlarim</summary>${info.my.map((t) => `<div class="muted">${fmtT(t.at)} · <b>${money(t.amount)}</b> · ${TST[t.status] || t.status}${t.reason ? ' — ' + esc(t.reason) : ''}</div>`).join('')}</details>` : ''}`);
  $('nope').onclick = closeModal;
  document.querySelectorAll('[data-cp]').forEach((b) => (b.onclick = async () => { const n = cards[b.dataset.cp].number.replace(/ /g, ''); try { await navigator.clipboard.writeText(n); toast('📋 Karta raqami nusxalandi'); } catch { prompt('Karta raqami:', n); } }));
  $('tfile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 10e6) { alert('Rasm 10 MB dan katta'); e.target.value = ''; return; }
    const rd = new FileReader(); rd.onload = () => { file = { type: f.type, data: rd.result }; $('tprev').src = rd.result; $('tprev').classList.remove('hidden'); }; rd.readAsDataURL(f);
  };
  $('tsend').onclick = async () => {
    const amount = Number($('tamt').value);
    if (!(amount >= (info.min || 1))) return alert(`Summani yozing (kamida ${money(info.min || 1)})`);
    if (!file) return alert("To'lov cheki skrinshotini yuklang");
    $('tsend').disabled = true; $('tsend').textContent = '⏳ Yuborilmoqda…';
    try { await api('/api/topup/request', { ...me, amount, file, card: cards[0]?.number }); closeModal(); toast("✅ So'rov yuborildi — admin tasdiqlagach balansingizga tushadi"); }
    catch (e) { alert(e.message); $('tsend').disabled = false; $('tsend').textContent = 'Yuborish'; }
  };
}
const ST_OFFER = { pending: '⏳ kutilmoqda', sotildi: '✅ sotildi', 'rad etildi': '❌ rad etildi', bekor: 'bekor qilindi', eskirgan: 'eskirgan' };
async function openMyPanel() {
  await loadWallet(); const r = myRes(); if (!r) return;
  const addr = (o) => [o.mahalla, o.street, o.no && 'uy ' + o.no].filter(Boolean).join(', ') || '—';
  const assets = [
    ...(wallet.homeless ? [] : [{ kind: 'main', refId: '', title: '🏠 Asosiy uyim', o: r, x: r.x, z: r.z, design: () => openDesigner(null) }]),
    ...wallet.houses.map((h) => ({ kind: 'house', refId: h.id, title: `🏠 ${h.n}-uyim`, o: h, x: h.x, z: h.z, design: () => openDesigner({ ...h, isHouse: true }) })),
    ...wallet.plots.filter((p) => p.status === 'sold').map((p) => ({ kind: 'plot', refId: p.id, title: `📐 ${p.name} (${p.sotix} sotix)${p.built === false ? ' · 🏗️ qurilmagan' : ''}`, o: p, x: (p.x1 + p.x2) / 2, z: (p.z1 + p.z2) / 2, design: () => openDesigner(p) })),
  ];
  modal(`<div class="row" style="align-items:center">${ava(r.username)}<div><h3>@${esc(r.username)}</h3></div></div>
    <div class="wallet row" style="justify-content:space-between;align-items:center"><span>💰 Hamyon: <b>${money(wallet.balance)}</b></span><button class="ok" id="ptop">💳 To'ldirish</button></div>
    ${wallet.homeless ? '<div class="hint" style="background:#fff3e0;padding:8px;border-radius:10px">🏚️ Asosiy uyingizni sotgansiz. Yangi joy sotib olib, unda pulga uy qurishingiz mumkin.</div>' : ''}
    ${wallet.offersIn.length ? '<b>🤝 Sizga kelgan takliflar</b>' + wallet.offersIn.map((o) => `<div class="offer"><div>@${esc(o.initiator === 'buyer' ? o.buyer : o.seller)} — <b>${esc(o.title)}</b> uchun <b>${money(o.price)}</b> ${o.initiator === 'buyer' ? (o.buyerCanPay ? '<span class="okc">✓ puli yetarli</span>' : '<span class="noc">✗ puli yetmaydi</span>') : ''}</div><div class="row"><button class="ok" data-acc="${o.id}">${o.initiator === 'buyer' ? '✅ Sotildi' : '✅ Sotib olaman'}</button><button class="no" data-rej="${o.id}">Rad etish</button></div></div>`).join('') : ''}
    <div class="row"><button id="pdes" ${wallet.homeless ? 'disabled' : ''}>🎨 Uy dizayni</button><button id="pcar" ${wallet.homeless ? 'disabled' : ''}>🚗 Mashinalar</button><button id="pmove" ${wallet.homeless ? 'disabled' : ''}>🚚 Ko'chish</button><button id="pbuy">📐 Joy sotib olish</button><button class="ghost" id="ppass">🔑 Parol</button></div>
    <b>🏘️ Mening mulklarim</b>
    ${assets.map((a, i) => `<div class="offer"><div><b>${esc(a.title)}</b><div class="muted">📍 ${esc(addr(a.o))}</div></div><div class="row"><button class="ghost" data-fly="${i}">🔍</button><button class="ghost" data-ed="${i}">✏️ Manzil</button><button class="ghost" data-ds="${i}">🎨</button></div></div>`).join('') || '<div class="muted">Mulk yo\'q</div>'}
    ${wallet.offersOut.length ? `<details><summary class="muted">Mening takliflarim (${wallet.offersOut.length})</summary>${wallet.offersOut.map((o) => `<div class="muted">${fmtT(o.at)} · ${esc(o.title)} · ${money(o.price)} · ${o.initiator === 'buyer' ? '@' + esc(o.seller) + ' ga taklif' : '@' + esc(o.buyer) + ' ga sotish'} · ${ST_OFFER[o.status] || esc(o.status)} ${o.status === 'pending' ? `<a href="#" data-cnc="${o.id}">bekor qilish</a>` : ''}</div>`).join('')}</details>` : ''}
    <details><summary class="muted">Hamyon tarixi</summary>${wallet.tx.map((t) => `<div class="muted">${fmtT(t.at)} · <b style="color:${t.amount > 0 ? '#1fa463' : '#e24b4b'}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</b> · ${esc(t.text)}</div>`).join('') || '<div class="muted">Bo\'sh</div>'}</details>
    <button class="ghost" id="nope">Yopish</button>`);
  $('ptop').onclick = openTopup; $('ppass').onclick = askNewPass;
  $('nope').onclick = closeModal; $('pdes').onclick = () => openDesigner(null); $('pcar').onclick = () => openDesigner(null, 'c'); $('pmove').onclick = openMove; $('pbuy').onclick = () => { closeModal(); setMode('buy'); };
  document.querySelectorAll('[data-fly]').forEach((b) => (b.onclick = () => { const a = assets[b.dataset.fly]; closeModal(); flyTo(a.x, a.z, 70); }));
  document.querySelectorAll('[data-ds]').forEach((b) => (b.onclick = () => assets[b.dataset.ds].design()));
  document.querySelectorAll('[data-ed]').forEach((b) => (b.onclick = () => openEditAddr(assets[b.dataset.ed])));
  const act = async (url, offerId, msg) => { try { await api(url, { ...me, offerId }); toast(msg); await refresh(); openMyPanel(); } catch (e) { alert(e.message); } };
  document.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => confirm('Tasdiqlaysizmi? Mulk va pul darhol o\'tadi.') && act('/api/sell/accept', b.dataset.acc, '✅ Sotildi!')));
  document.querySelectorAll('[data-rej]').forEach((b) => (b.onclick = () => act('/api/sell/cancel', b.dataset.rej, 'Rad etildi')));
  document.querySelectorAll('[data-cnc]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); act('/api/sell/cancel', b.dataset.cnc, 'Bekor qilindi'); }));
}
function openEditAddr(a) {
  const mahs = [...new Set([...places.map((p) => p.name), ...officialPlaces.map((o) => o.n)])].sort();
  modal(`<h3>✏️ ${esc(a.title)} — manzil</h3>
    <label>Mahalla<input id="emah" list="emahl" value="${esc(a.o.mahalla || '')}"></label><datalist id="emahl">${mahs.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <label>Ko'cha<input id="estr" list="estrl" value="${esc(a.o.street || '')}"></label><datalist id="estrl">${streetNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <label>Uy raqami<input id="eno" value="${esc(a.o.no || '')}" placeholder="masalan 12 yoki 12A"></label>
    <div class="row"><button class="ok" id="esave">Saqlash</button><button class="ghost" id="nope">Bekor</button></div>`);
  $('nope').onclick = openMyPanel;
  $('esave').onclick = async () => { try { await api('/api/house/edit', { ...me, kind: a.kind, refId: a.refId, mahalla: $('emah').value, street: $('estr').value, no: $('eno').value }); toast('✅ Manzil saqlandi'); await refresh(); openMyPanel(); } catch (e) { alert(e.message); } };
}
// Xaridor: boshqa odamning uyiga narx taklif qiladi (hamyondagi puldan ko'p yozib bo'lmaydi)
async function openOffer(t) {
  if (!myRes()) return alert('Taklif qilish uchun avval saytga kiring');
  await loadWallet(); const bal = wallet.balance;
  modal(`<h3>💰 Sotib olish taklifi</h3><div><b>${esc(t.title)}</b> · egasi @${esc(t.owner)}</div>
    <div class="wallet">Hamyoningizda: <b>${money(bal)}</b></div>
    <label>Qancha taklif qilasiz?<input id="oprice" type="number" min="1" max="${bal}" step="1000" placeholder="summa"></label>
    <div class="muted" id="ohint"></div>
    <div class="row"><button class="ok" id="osend" ${bal > 0 ? '' : 'disabled'}>Taklif yuborish</button><button class="ghost" id="nope">Bekor</button></div>`);
  const chk = () => { const v = Number($('oprice').value); const bad = !(v > 0) || v > bal; $('osend').disabled = bad; $('ohint').innerHTML = v > bal ? `<span class="noc">✗ Hamyoningizda buncha pul yo'q (bor: ${money(bal)})</span>` : v > 0 ? `<span class="okc">✓ ${money(v)} — egasi tasdiqlasa uy sizga o'tadi</span>` : bal > 0 ? '' : '<span class="noc">Hamyoningiz bo\'sh</span>'; };
  $('oprice').oninput = chk; chk();
  $('nope').onclick = closeModal;
  $('osend').onclick = async () => { try { await api('/api/buy/offer', { ...me, owner: t.owner, kind: t.kind, refId: t.refId, price: Number($('oprice').value) }); closeModal(); toast(`📨 Taklif @${t.owner} ga yuborildi`); } catch (e) { alert(e.message); } };
}
function openAssetInfo(t) {
  modal(`<h3>${esc(t.title)}</h3><div class="muted">📍 ${esc(t.addr || '—')}</div>${t.x !== undefined && distText(t.x, t.z) ? `<div class="dist">${distText(t.x, t.z)}</div>` : ''}<div class="wallet">🏷️ Dizayn qiymati: <b>${money(t.price)}</b></div>
    <div class="row">${myRes() ? `<button class="ok" id="aofr">💰 Sotib olish taklifi</button><button id="achat">💬 Egasiga yozish</button>` : '<div class="hint">Taklif qilish uchun saytga kiring.</div>'}<button class="ghost" id="nope">Yopish</button></div>`);
  $('nope').onclick = closeModal;
  if ($('aofr')) { $('aofr').onclick = () => openOffer(t); $('achat').onclick = () => openChat(t.owner); }
}
const hex = (o, d = '#e9d8b4') => o?.colorHex || (o?.color !== undefined ? '#' + hsl(o.color).getHexString() : d);
async function upgrade(body) { const j = await api('/api/upgrade', { ...me, ...body }); await refresh(); await loadWallet(); return j; }
function openDesigner(plot, startTab) {
  const r = myRes(), sh = wallet.shop, cur = plot || r, isHouse = !!plot?.isHouse, unbuilt = plot && !isHouse && plot.built === false;
  let sel = { style: cur.style || 'oddiy', color: hex(cur) }, tab = startTab || (String(sel.style).startsWith('b:') ? 'b' : 'h');
  const render = () => {
    const cars = plot ? [] : (r.cars || []);
    modal(`<h3>${unbuilt ? '🏗️ Uy qurish' : '🎨'} ${plot ? esc(plot.name || (isHouse ? plot.n + '-uy' : '')) : 'Uyim'}</h3><div class="wallet">💰 Hamyon: <b>${money(wallet.balance)}</b>${unbuilt ? `<br>🏗️ Qurilish: <b>${money(sh.build)}</b> + tanlangan dizayn narxi` : ''}</div>
      <div class="tabs">${[['h', '🏠 Uy dizayni'], ['b', '🏪 Bino turlari'], ...(plot ? [] : [['c', `🚗 Mashinalar (${cars.length})`]])].map(([k, t]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>
      ${tab !== 'c' ? `<div class="pv" id="pv"><div class="pvcap"><b>${esc(styleName(sel.style))}</b> · ${(() => { const p = stylePriceC(sel.style, sh); return p ? money(p) : 'bepul'; })()}<br><small>🔄 aylantirib ko'ring</small></div></div>` : ''}
      ${tab === 'h' ? `<div class="picks">${Object.entries(sh.houses).map(([k, v]) => `<button class="pick ${sel.style === k ? 'on' : ''}" data-s="${esc(k)}">${STYLE_NAMES[k] || esc(k)}<small>${k === (cur.style || 'oddiy') && !unbuilt ? '✓ hozirgi' : v ? money(v) : (unbuilt ? '+0' : 'bepul')}</small></button>`).join('')}</div>` : ''}
      ${tab === 'b' ? `<span class="muted">Uyingizni yoki joyingizni do'kon, bozor, kafe… ga aylantiring</span><div class="picks">${Object.entries(sh.buildings || {}).map(([k, v]) => `<button class="pick ${sel.style === 'b:' + k ? 'on' : ''}" data-s="b:${esc(k)}">${esc(v.i)} ${esc(v.n)}<small>${'b:' + k === (cur.style || 'oddiy') && !unbuilt ? '✓ hozirgi' : money(v.p)}</small></button>`).join('')}</div>` : ''}
      ${tab !== 'c' ? `${String(sel.style).startsWith('b:') ? `<label>Bino nomi (peshlavhada)<input id="bname" maxlength="40" value="${esc(cur.bname || '')}" placeholder="masalan: Umid market"></label>` : ''}
      <div class="row" style="align-items:center"><label class="clr">🎨 Rang <input type="color" id="hcol" value="${sel.color}"></label><span class="muted">rang o'zgartirish: ${money(sh.repaint)}</span></div>
      <button class="ok" id="dbuy">Saqlash</button>` : ''}
      ${plot || tab !== 'c' ? '' : `<b>➕ Yangi mashina sotib olish</b>
      <div class="row" style="align-items:center"><select id="ncar">${Object.entries(sh.cars).filter(([k]) => k !== 'yoq').map(([k, v]) => `<option value="${esc(k)}">${CAR_NAMES[k] || esc(k)} — ${money(v)}</option>`).join('')}</select><label class="clr">Rangi <input type="color" id="ncol" value="#c0392b"></label><button class="ok" id="nbuy">Sotib olish</button></div>
      <hr><b>🚗 Mashinalarim (${cars.length})</b>
      ${cars.map((c, i) => `<div class="carrow"><span>${CAR_NAMES[c.t] || esc(c.t)}</span><input type="color" value="${esc(c.c)}" data-ci="${i}"><button class="ghost" data-cr="${i}">Rangni saqlash</button><button class="no" data-cx="${i}">✕</button></div>`).join('') || '<div class="muted">Hali mashina yo\'q</div>'}
      <div class="muted">🏎️ Sport — haqiqiy 3D model (yaqinlashganda ko'rinadi). Uy oldiga 12 tagacha mashina sig'adi.</div>`}
      <button class="ghost" id="nope">Yopish</button>`);
    document.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { const keep = $('bname')?.value; sel.style = b.dataset.s; sel.color = $('hcol').value; if (keep !== undefined) cur.bname = keep; render(); }));
    if ($('pv')) showPreview($('pv'), sel.style, $('hcol')?.value);
    document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
    $('nope').onclick = closeModal;
    const go = async (body, msg) => { try { const j = await upgrade(body); toast(`${msg}${j.cost ? ' · −' + money(j.cost) : ''}`); render(); } catch (e) { alert(e.message); } };
    const bn = () => ($('bname') ? { bname: $('bname').value } : {});
    if ($('dbuy')) $('dbuy').onclick = () => go(isHouse ? { houseId: plot.id, style: sel.style, color: $('hcol').value, ...bn() } : { plotId: plot?.id, style: sel.style, color: $('hcol').value, ...bn() }, unbuilt ? '🏗️ Uy qurildi!' : '✅ Saqlandi');
    if (!plot && tab === 'c') {
      $('nbuy').onclick = () => go({ buyCar: { t: $('ncar').value, c: $('ncol').value } }, '🚗 Mashina uyingiz oldida!');
      document.querySelectorAll('[data-cr]').forEach((b) => (b.onclick = () => go({ recolorCar: { i: +b.dataset.cr, c: document.querySelector(`[data-ci="${b.dataset.cr}"]`).value } }, '🎨 Rang o\'zgardi')));
      document.querySelectorAll('[data-cx]').forEach((b) => (b.onclick = () => confirm('Bu mashinani olib tashlaysizmi? (pul qaytmaydi)') && go({ removeCar: +b.dataset.cx }, 'Olib tashlandi')));
    }
  };
  render();
}
// 🔍 Sotib olishdan oldin 3D ko'rinish (alohida kichik sahna, aylanib turadi, sichqoncha/barmoq bilan buriladi)
let pvR = null, pvScene = null, pvCam = null, pvObj = null, pvAng = .6, pvDrag = null;
function showPreview(el, style, color) {
  if (!pvR) {
    pvR = new THREE.WebGLRenderer({ antialias: true, alpha: true }); pvR.setPixelRatio(Math.min(devicePixelRatio, 2)); pvR.toneMapping = THREE.ACESFilmicToneMapping; pvR.outputColorSpace = THREE.SRGBColorSpace;
    pvScene = new THREE.Scene(); pvScene.environment = scene.environment; pvScene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a70, 1.6)); const d = new THREE.DirectionalLight(0xfff1dc, 2.4); d.position.set(40, 80, 60); pvScene.add(d);
    pvCam = new THREE.PerspectiveCamera(35, 1, .5, 5000);
    const c = pvR.domElement; c.style.touchAction = 'none';
    c.onpointerdown = (e) => (pvDrag = e.clientX); addEventListener('pointerup', () => (pvDrag = null)); c.onpointermove = (e) => { if (pvDrag !== null) { pvAng -= (e.clientX - pvDrag) * .01; pvDrag = e.clientX; } };
    (function spin() { requestAnimationFrame(spin); const c = pvR.domElement; if (!c.isConnected || !pvObj) return; if (pvDrag === null) pvAng += .006;
      const b = pvObj.userData.box, R = b.r; pvCam.position.set(Math.sin(pvAng) * R * 1.9, R * .9 + b.h * .2, Math.cos(pvAng) * R * 1.9); pvCam.lookAt(0, b.h * .35, 0); pvR.render(pvScene, pvCam); })();
  }
  el.prepend(pvR.domElement); const w = el.clientWidth || 300, h = Math.round(Math.min(220, w * .6)); pvR.setSize(w, h); pvCam.aspect = w / h; pvCam.updateProjectionMatrix();
  if (pvObj) pvScene.remove(pvObj);
  const g = new THREE.Group(); try { buildStyle(g, style, color ? new THREE.Color(color) : hsl(20)); } catch {}
  const bx = new THREE.Box3().setFromObject(g), sz = bx.getSize(new THREE.Vector3()); g.userData.box = { r: Math.max(18, Math.max(sz.x, sz.z) * .75, sz.y * .6), h: sz.y };
  pvObj = g; pvScene.add(g);
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
// Boshqa odamning uyi: manzil, narxlar, mashinalar, joylar, yozish
function openHouseInfo(r) {
  const sh = state.shop || { houses: {}, cars: {} };
  const housePrice = stylePriceC(r.style || 'oddiy', sh);
  const cars = r.cars || [];
  const plots = state.plots.filter((p) => p.owner === r.username && p.status === 'sold');
  const carsTotal = cars.reduce((a, c) => a + (sh.cars[c.t] || 0), 0), plotsTotal = plots.reduce((a, p) => a + (p.price || 0) + (p.built === false ? 0 : stylePriceC(p.style, sh)), 0);
  modal(`<div class="row" style="align-items:center;flex-wrap:nowrap">${ava(r.username, 'ava big')}<div><h3>@${esc(r.username)}</h3><div class="muted">📍 ${esc([r.mahalla, r.street, r.no && 'uy ' + r.no].filter(Boolean).join(', ') || 'Shahar chekkasi')}</div>${distText(r.x, r.z) ? `<div class="dist">${distText(r.x, r.z)}</div>` : ''}</div></div>
    <div class="wallet">🏷️ Umumiy qiymati: <b>${money(housePrice + carsTotal + plotsTotal)}</b></div>
    <table class="itbl"><tr><td>${esc(styleName(r.style))}${r.bname ? ' «' + esc(r.bname) + '»' : ''} <span class="sw" style="background:${hex(r)}"></span></td><td>${housePrice ? money(housePrice) : 'boshlang\'ich'}</td></tr>
    ${cars.map((c) => `<tr><td>${CAR_NAMES[c.t] || esc(c.t)} <span class="sw" style="background:${esc(c.c)}"></span></td><td>${money(sh.cars[c.t] || 0)}</td></tr>`).join('')}
    ${plots.map((p) => `<tr><td>📐 ${esc(p.bname || p.name)} · ${p.sotix} sotix · ${esc(p.built === false ? '🏗️ qurilmagan' : styleName(p.style))}</td><td>${money((p.price || 0) + (p.built === false ? 0 : stylePriceC(p.style, sh)))}</td></tr>`).join('')}</table>
    <div class="row">${myRes() ? `<button id="hchat">💬 Xabar yozish</button><button class="ok" id="hofr">💰 Sotib olish taklifi</button>` : '<div class="hint">Yozishish va taklif uchun saytga kiring.</div>'}<button class="ghost" id="hfly">🔍 Yaqindan ko'rish</button><button class="ghost" id="nope">Yopish</button></div>`);
  $('nope').onclick = closeModal; $('hfly').onclick = () => { closeModal(); flyTo(r.x, r.z, 45); };
  if ($('hchat')) { $('hchat').onclick = () => openChat(r.username); $('hofr').onclick = () => openOffer({ owner: r.username, kind: 'main', refId: '', title: `@${r.username} ning uyi` }); }
}
// ---- Ko'chish: xaritadan yoki manzil bo'yicha ----
function openMove() {
  const mahs = [...new Set([...places.map((p) => p.name), ...officialPlaces.map((o) => o.n)])].sort();
  modal(`<h3>🚚 Qayerga ko'chasiz?</h3>
    <button id="mmap">🗺️ Xaritadan tanlash</button>
    <div class="muted" style="text-align:center">yoki manzilni kiriting</div>
    <input id="mmah" list="mahl" placeholder="Mahalla"><datalist id="mahl">${mahs.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <input id="mstr" list="strl" placeholder="Ko'cha nomi"><datalist id="strl">${streetNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row"><button class="ok" id="maddr">Shu manzilga ko'chish</button><button class="ghost" id="nope">Bekor</button></div>`);
  $('nope').onclick = closeModal;
  $('mmap').onclick = () => { closeModal(); setMode('move'); flyTo(controls.target.x, controls.target.z, 900); };
  $('maddr').onclick = async () => {
    const st = $('mstr').value.trim().toLowerCase(); let mh = $('mmah').value.trim().toLowerCase();
    const os = officialStreets.find((o) => nk(o.n) === nk(st));
    const stName = os?.osm || st;
    let cand = st ? segments.filter((s) => s.name && (s.name.toLowerCase() === stName.toLowerCase() || nk(s.name) === nk(stName))) : [];
    const cp = st && streetPoints.find((q) => nk(q.name) === nk(st));
    const cpMah = (state.customPlaces || []).find((c) => c.kind === 'kocha' && nk(c.n) === nk(st))?.mahalla || os?.mahalla || '';
    if (!cand.length && cp) { const n = nearestRoad(cp.x, cp.z); if (n) cand = [{ ...n.s, name: cp.name }]; }
    if (!cand.length && os?.mahalla && !mh) mh = os.mahalla.toLowerCase();
    if (st && !cand.length) cand = segments.filter((s) => s.name && s.name.toLowerCase().includes(st));
    let mp = mh && (places.find((p) => nk(p.name) === nk(mh)) || places.find((p) => p.name.toLowerCase().includes(mh)));
    if (mh && !mp) { const o = officialPlaces.find((q) => nk(q.n) === nk(mh) || q.n.toLowerCase().includes(mh)); if (o) mp = { name: o.n, x: toXZ(o.lat, o.lon)[0], z: toXZ(o.lat, o.lon)[1] }; }
    if (!cand.length && mp) { const n = nearestRoad(mp.x, mp.z); if (n) cand = [n.s]; }
    if (!cand.length && st && !mp) return alert(`«${$('mstr').value}» ko'chasining xaritadagi joyi hali kiritilmagan. Mahallasini ham tanlang yoki xaritadan tanlab ko'ching.`);
    if (!cand.length) return alert("Bunday ko'cha yoki mahalla topilmadi");
    if (mp) cand.sort((a, b) => Math.hypot((a.ax + a.bx) / 2 - mp.x, (a.az + a.bz) / 2 - mp.z) - Math.hypot((b.ax + b.bx) / 2 - mp.x, (b.az + b.bz) / 2 - mp.z));
    // ko'cha bo'yidagi tartibli bo'sh uchastka
    for (const sg of cand.slice(0, 60)) {
      const lot = lotOnRoad(sg, (sg.ax + sg.bx) / 2, (sg.az + sg.bz) / 2, 1) || (sg === cand[0] ? { x: (sg.ax + sg.bx) / 2, z: (sg.az + sg.bz) / 2, rot: 0 } : null); if (!lot) continue;
      const { x, z, rot } = lot;
      try { const j = await api('/api/move', { ...me, keepStreet: true, x, z, rot, street: sg.name || nearestStreetName(x, z), mahalla: (mh && mp ? mp.name : '') || cpMah || mahallaAt(x, z) || nearestMahalla(x, z) }); closeModal(); await refresh(); flyTo(j.resident.x, j.resident.z); } catch (e) { alert(e.message); }
      return;
    }
    alert("Bu ko'chada bo'sh joy qolmagan — xaritadan tanlang");
  };
}
// ---- CHAT (Instagram uslubida) ----
let chatWith = null, chatTimer = null, chatCount = -1;
const fmtT = (t) => new Date(t).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const ava = (u, cls = 'ava') => `<img class="${cls}" src="/avatar/${encodeURIComponent(u)}" onerror="this.outerHTML='<span class=&quot;${cls} ph&quot;>${esc(u[0] || '?').toUpperCase()}</span>'">`;
function msgHtml(m) {
  const mine = m.from === me.username;
  let body = esc(m.text || '');
  if (m.type === 'image') body = `<a href="${esc(m.url)}" target="_blank"><img class="mimg" src="${esc(m.url)}" loading="lazy"></a>` + (m.text ? `<div>${esc(m.text)}</div>` : '');
  if (m.type === 'video') body = `<video class="mimg" src="${esc(m.url)}" controls preload="metadata"></video>` + (m.text ? `<div>${esc(m.text)}</div>` : '');
  if (m.type === 'location') body = `<a class="mloc" href="https://maps.google.com/?q=${m.lat},${m.lon}" target="_blank" rel="noopener">📍 <b>Lokatsiya</b><br><small>${esc(m.label || `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}`)}</small><br><small>Xaritada ochish →</small></a>`;
  return `<div class="bub ${mine ? 'mine' : ''} ${m.type !== 'text' ? 'media' : ''}">${body}<small>${fmtT(m.at)}${mine ? (m.read ? ' · ✓✓' : ' · ✓') : ''}</small></div>`;
}
async function loadChat(scroll) {
  if (!chatWith || !$('msgs')) return;
  const { messages } = await api('/api/chat/history', { ...me, with: chatWith });
  if (messages.length === chatCount && !scroll) return; chatCount = messages.length;
  const box = $('msgs'), atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
  box.innerHTML = messages.map(msgHtml).join('') || `<div class="empty">${ava(chatWith, 'ava big')}<b>@${esc(chatWith)}</b><div class="muted">Hali xabar yo'q — birinchi bo'lib yozing!</div></div>`;
  if (scroll || atBottom) box.scrollTop = box.scrollHeight;
}
function openChat(u) {
  if (!myRes()) return alert('Yozishish uchun avval saytga kiring');
  chatWith = u; chatCount = -1;
  const r = state.residents.find((x) => x.username === u);
  $('chat').innerHTML = `<div class="chead"><button class="ghost" id="cback">←</button>${ava(u)}<div><b>@${esc(u)}</b><div class="muted">${esc([r?.mahalla, r?.street].filter(Boolean).join(', '))}</div></div><button class="ghost" id="cfly" title="Uyini ko'rish">🏠</button><button class="ghost" id="cclose">✕</button></div>
    <div class="msgs" id="msgs"></div>
    <div class="cbar"><label class="cbtn" title="Rasm yoki video">📷<input type="file" id="cfile" accept="image/*,video/*" hidden></label><button class="cbtn" id="cloc" title="Lokatsiya">📍</button><input id="mtext" placeholder="Xabar yozing…" maxlength="2000"><button id="msend">➤</button></div>`;
  $('chat').classList.remove('hidden'); closeModal();
  const send = async (extra) => { try { await api('/api/chat/send', { ...me, to: u, text: $('mtext').value.trim(), ...extra }); $('mtext').value = ''; await loadChat(true); } catch (e) { alert(e.message); } };
  $('msend').onclick = () => $('mtext').value.trim() && send();
  $('mtext').addEventListener('keydown', (e) => e.key === 'Enter' && $('mtext').value.trim() && send());
  $('cfile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 20e6) return alert('Fayl 20 MB dan katta');
    const rd = new FileReader(); $('msend').textContent = '⏳';
    rd.onload = async () => { await send({ file: { type: f.type, data: rd.result } }); $('msend').textContent = '➤'; $('cfile').value = ''; };
    rd.readAsDataURL(f);
  };
  $('cloc').onclick = () => {
    if (!navigator.geolocation) return alert('Brauzer lokatsiyani bermaydi');
    navigator.geolocation.getCurrentPosition((p) => send({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'Mening joylashuvim' }), () => alert('Lokatsiyaga ruxsat berilmadi'), { enableHighAccuracy: true, timeout: 15000 });
  };
  $('cback').onclick = () => { closeChat(); openInbox(); };
  $('cclose').onclick = closeChat;
  $('cfly').onclick = () => { if (r) { closeChat(); flyTo(r.x, r.z, 90); } };
  loadChat(true); clearInterval(chatTimer); chatTimer = setInterval(() => loadChat(), 3000);
  $('mtext').focus();
}
function closeChat() { $('chat').classList.add('hidden'); clearInterval(chatTimer); chatWith = null; checkUnread(); }
async function openInbox() {
  const { conversations } = await api('/api/chat/inbox', me);
  modal(`<h3>💬 Xabarlar</h3><input id="isearch" placeholder="🔍 Nik bo'yicha qidirish va yozish">
    <div id="ilist">${conversations.map((c) => `<div class="conv row" style="align-items:center;flex-wrap:nowrap" data-u="${esc(c.with)}">${ava(c.with)}<div style="flex:1;min-width:0"><b>@${esc(c.with)}</b> ${c.unread ? `<span class="count">${c.unread}</span>` : ''}<div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.last.slice(0, 80))} · ${fmtT(c.at)}</div></div></div>`).join('') || '<div class="muted">Hali yozishmalar yo\'q. Xaritadagi istalgan uyni bosing yoki yuqorida nikni qidiring.</div>'}</div>
    <button class="ghost" id="nope">Yopish</button>`);
  $('nope').onclick = closeModal;
  document.querySelectorAll('.conv[data-u]').forEach((el) => (el.onclick = () => openChat(el.dataset.u)));
  $('isearch').oninput = (e) => {
    const q = e.target.value.trim().replace(/^@/, '').toLowerCase(); if (!q) return;
    const found = state.residents.filter((r) => r.username.includes(q) && r.username !== me.username).slice(0, 8);
    $('ilist').innerHTML = found.map((r) => `<div class="conv row" style="align-items:center" data-u="${esc(r.username)}">${ava(r.username)}<b>@${esc(r.username)}</b></div>`).join('') || '<div class="muted">Topilmadi</div>';
    document.querySelectorAll('.conv[data-u]').forEach((el) => (el.onclick = () => openChat(el.dataset.u)));
  };
}
async function checkUnread() {
  if (!myRes()) return;
  try { const { conversations } = await api('/api/chat/inbox', me); const n = conversations.reduce((a, c) => a + c.unread, 0); $('unr').textContent = n; $('unr').classList.toggle('hidden', !n); } catch {}
}
setInterval(checkUnread, 10000);
$('inbox').onclick = openInbox;
$('topup').onclick = openTopup;

// ---- 👥 Umumiy chat (@shahrisabz.online.shahar) ----
let roadGraph = null;
function buildGraph() { // yo'llar grafi: har 12 m nuqta, yaqin nuqtalar bitta tugunga birlashadi (chorrahalar)
  const N = new Map(), key = (x, z) => Math.round(x / 10) + ',' + Math.round(z / 10);
  const node = (x, z) => { const k = key(x, z); if (!N.has(k)) N.set(k, { x, z, e: [] }); return N.get(k); };
  const link = (a, b) => { if (a === b) return; const d = Math.hypot(a.x - b.x, a.z - b.z); a.e.push([b, d]); b.e.push([a, d]); };
  for (const w of allWays) for (let i = 1; i < w.pts.length; i++) {
    const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 12)); let pr = node(ax, az);
    for (let k = 1; k <= n; k++) { const c = node(ax + (bx - ax) * k / n, az + (bz - az) * k / n); link(pr, c); pr = c; }
  }
  for (const [k, a] of N) { const [cx, cz] = k.split(',').map(Number); // chorrahalar: 9 m dan yaqin tugunlarni ulaymiz
    for (let dx = 0; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { if (!dx && dz < 1) continue; const b = N.get((cx + dx) + ',' + (cz + dz)); if (b && !a.e.some(([m]) => m === b) && Math.hypot(a.x - b.x, a.z - b.z) < 9) link(a, b); } }
  return [...N.values()];
}
function routePath(x1, z1, x2, z2) {
  roadGraph ||= buildGraph(); if (!roadGraph.length) return null;
  const near = (x, z) => { let best = null, bd = 1e18; for (const n of roadGraph) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } } return best; };
  const s = near(x1, z1), t = near(x2, z2); if (!s || !t) return null;
  const dist = new Map([[s, 0]]), prev = new Map(), done = new Set(), H = [[0, s]];
  const push = (it) => { H.push(it); let i = H.length - 1; while (i) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
  const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
  while (H.length) {
    const [d, n] = pop(); if (done.has(n)) continue; done.add(n); if (n === t) break;
    for (const [m, w] of n.e) { const nd = d + w; if (nd < (dist.get(m) ?? 1e18)) { dist.set(m, nd); prev.set(m, n); push([nd, m]); } }
  }
  if (!done.has(t)) return null;
  const out = [[x2, z2]]; for (let n = t; n; n = prev.get(n)) out.push([n.x, n.z]); out.push([x1, z1]); return { pts: out.reverse(), len: dist.get(t) };
}
window.routePath = routePath; let routeLine = null;
function showRoute(x, z, label) {
  const b = myBase(); if (!b) { flyTo(x, z, 80); return toast('Yo\'l ko\'rsatish uchun saytga kiring'); }
  if (routeLine) scene.remove(routeLine);
  const r = routePath(b.x, b.z, x, z); if (!r) { showDistLine(x, z); flyTo(x, z, 90); return; }
  const curve = new THREE.CatmullRomCurve3(r.pts.map(([px, pz]) => new THREE.Vector3(px, 2.5, pz)), false, 'centripetal', 0);
  routeLine = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(2000, r.pts.length * 4), 2.2, 6), new THREE.MeshBasicMaterial({ color: 0x1e88ff, depthTest: false, transparent: true, opacity: .85 }));
  routeLine.renderOrder = 21; scene.add(routeLine);
  flyTo((b.x + x) / 2, (b.z + z) / 2, Math.min(1800, Math.max(150, Math.hypot(b.x - x, b.z - z) * .9)));
  toast(`🧭 ${label || 'Manzil'} — yo'l bo'ylab ${r.len > 1000 ? (r.len / 1000).toFixed(1) + ' km' : Math.round(r.len) + ' m'}`);
}
let groupMsgs = [], groupTimer = null, groupLast = 0;
function gMsgHtml(m) {
  const mine = me && m.from === me.username;
  let body = esc(m.text || '');
  if (m.type === 'image') body = `<a href="${esc(m.url)}" target="_blank"><img class="mimg" src="${esc(m.url)}" loading="lazy"></a>` + (m.text ? `<div>${esc(m.text)}</div>` : '');
  if (m.type === 'video') body = `<video class="mimg" src="${esc(m.url)}" controls preload="metadata"></video>`;
  if (m.type === 'audio') body = `<audio src="${esc(m.url)}" controls preload="metadata" style="max-width:230px"></audio>`;
  if (m.type === 'home' || m.type === 'sell' || m.type === 'loc') {
    const head = m.type === 'home' ? '🏠 Mening uyim' : m.type === 'sell' ? '🏷️ Uy sotiladi!' : '📍 Uyimning lokatsiyasi';
    body = `<div class="gcard"><b>${head}</b><div>${esc(styleName(m.style))}</div><div class="muted">📍 ${esc(m.addr || '—')}</div>
      ${m.type !== 'loc' ? `<div>💎 Qiymati: <b>${money(m.value || 0)}</b></div>` : ''}${m.type === 'sell' ? `<div style="color:#e24b4b">💰 Narxi: <b>${money(m.price)}</b></div>` : ''}
      <div class="row"><button class="ghost" data-gr="${m.id}">🧭 Yo'l ko'rsat</button>${m.type === 'sell' && !mine ? `<button class="ok" data-gb="${m.id}">💰 Sotib olish taklifi</button>` : ''}</div></div>`;
  }
  return `<div class="bub ${mine ? 'mine' : ''} ${m.type !== 'text' ? 'media' : ''}">${mine ? '' : `<a href="#" class="gfrom" data-gu="${esc(m.from)}">@${esc(m.from)}</a>`}${body}<small>${fmtT(m.at)}</small></div>`;
}
function bindGroup(box) {
  box.querySelectorAll('[data-gr]').forEach((b) => (b.onclick = () => { const m = groupMsgs.find((x) => x.id === b.dataset.gr); if (m) { closeGroup(); showRoute(m.x, m.z, '@' + m.from); } }));
  box.querySelectorAll('[data-gb]').forEach((b) => (b.onclick = () => { const m = groupMsgs.find((x) => x.id === b.dataset.gb); if (m) openOffer({ owner: m.from, kind: m.houseKind || 'main', refId: m.houseId || '', title: `@${m.from} uyi` }); }));
  box.querySelectorAll('[data-gu]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); if (myRes() && a.dataset.gu !== me.username) openChat(a.dataset.gu); }));
}
async function loadGroup() {
  if (!$('gmsgs')) return;
  try { const { messages } = await api('/api/group/list', { after: groupLast }); if (!messages.length && groupMsgs.length) return;
    groupMsgs.push(...messages); if (messages.length) groupLast = messages[messages.length - 1].at;
    const box = $('gmsgs'), atB = box.scrollTop + box.clientHeight >= box.scrollHeight - 60;
    box.innerHTML = groupMsgs.map(gMsgHtml).join('') || '<div class="empty"><b>👥 Umumiy chat</b><div class="muted">Birinchi bo\'lib yozing!</div></div>';
    bindGroup(box); if (atB || messages.length) box.scrollTop = box.scrollHeight; } catch {}
}
function closeGroup() { $('chat').classList.add('hidden'); clearInterval(groupTimer); }
let recorder = null;
function openGroup() {
  closeChat(); groupMsgs = []; groupLast = 0;
  $('chat').innerHTML = `<div class="chead">${ava('shahrisabz.online.shahar')}<div style="flex:1"><b>@shahrisabz.online.shahar</b><div class="muted">👥 Umumiy chat — hamma uchun</div></div><button class="ghost" id="gclose">✕</button></div>
    <div class="msgs" id="gmsgs"></div>
    ${myRes() ? `<div class="row" style="padding:4px 8px;gap:4px;flex-wrap:wrap"><button class="ghost" id="ghome">🏠 Uyimni ko'rsat</button><button class="ghost" id="gsell">🏷️ Uyimni sotaman</button><button class="ghost" id="gloc">📍 Lokatsiyam</button></div>
    <div class="cbar"><label class="cbtn" title="Rasm yoki video">📷<input type="file" id="gfile" accept="image/*,video/*" hidden></label><button class="cbtn" id="gmic" title="Ovozli xabar">🎤</button><input id="gtext" placeholder="Hammaga yozing…" maxlength="2000"><button id="gsend">➤</button></div>`
    : '<div class="muted" style="padding:10px">✍️ Yozish uchun saytga kiring</div>'}`;
  $('chat').classList.remove('hidden'); closeModal();
  $('gclose').onclick = closeGroup;
  loadGroup(); clearInterval(groupTimer); groupTimer = setInterval(loadGroup, 3000);
  if (!myRes()) return;
  const send = async (extra) => { try { await api('/api/group/send', { ...me, text: $('gtext').value.trim(), ...extra }); $('gtext').value = ''; await loadGroup(); } catch (e) { alert(e.message); } };
  $('gsend').onclick = () => $('gtext').value.trim() && send();
  $('gtext').addEventListener('keydown', (e) => e.key === 'Enter' && $('gtext').value.trim() && send());
  const fileSend = (f) => { if (f.size > 20e6) return alert('Fayl 20 MB dan katta'); const rd = new FileReader(); $('gsend').textContent = '⏳'; rd.onload = async () => { await send({ file: { type: f.type, data: rd.result } }); $('gsend').textContent = '➤'; }; rd.readAsDataURL(f); };
  $('gfile').onchange = (e) => { const f = e.target.files[0]; if (f) fileSend(f); e.target.value = ''; };
  $('ghome').onclick = () => send({ kind: 'home' });
  $('gloc').onclick = () => send({ kind: 'loc' });
  $('gsell').onclick = () => { const p = prompt('Uyingizni necha so\'mga sotasiz?'); if (p) send({ kind: 'sell', price: Number(String(p).replace(/\D/g, '')) }); };
  $('gmic').onclick = async () => {
    if (recorder) { recorder.stop(); return; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = [];
      recorder = new MediaRecorder(st); recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => { st.getTracks().forEach((t) => t.stop()); $('gmic').textContent = '🎤'; const bl = new Blob(chunks, { type: (recorder.mimeType || 'audio/webm').split(';')[0] }); recorder = null; if (bl.size > 500) fileSend(bl); };
      recorder.start(); $('gmic').textContent = '⏹️'; toast('🎙️ Yozilmoqda… to\'xtatish uchun ⏹️ ni bosing');
    } catch { alert('Mikrofonga ruxsat berilmadi'); }
  };
}
$('group').onclick = openGroup;

// ---- Animatsiya ----
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
let frame = 0;
(function loop() {
  requestAnimationFrame(loop); controls.update();
  if (frame++ % 15 === 0) { const t = controls.target, h = camera.position.y; for (const l of streetLabels) l.visible = h < 600 && Math.hypot(l.position.x - t.x, l.position.z - t.z) < h * 1.8; for (const l of placeLabels) l.visible = l.userData.big || h < 2600; for (const l of poiLabels) l.visible = h < 450 && Math.hypot(l.position.x - t.x, l.position.z - t.z) < h * 1.6;
    // uy yozuvlari: uzoqdan ko'rinmaydi (rasm toza turadi), yaqinda nik, juda yaqinda balans va manzil
    for (const g of houseLabelGroups) { const d = Math.hypot(g.position.x - camera.position.x, g.position.z - camera.position.z) + h; for (const c of g.children) if (c.isSprite && c.userData.lod) c.visible = c.userData.lod === 1 ? d < 420 : d < 190; } }
  const t = controls.target; const sd = sky.material.uniforms.sunPosition.value; sun.position.set(t.x + sd.x * 200, Math.max(20, sd.y * 200), t.z + sd.z * 200); if (life) { life.tick(); if (realCity && frame % 60 === 0) realCity.setNight(life.night ? life.night() : 0); } sun.target.position.copy(t);
  if (frame % 20 === 0) { const wp = new THREE.Vector3(); for (const g of lodCars) { if (!g.parent) continue; g.getWorldPosition(wp); const near = wp.distanceTo(camera.position) < 260; const l = g.userData.lod; if (near) upgradeLod(g); if (l.real) { l.real.visible = near; l.simple.visible = !near; } } }
  renderer.render(scene, camera);
})();

// ---- Boshlash ----
(async () => {
  refresh().catch(() => {});
  try { officialPlaces = (await (await fetch('mahallas-geo.json')).json()).mahallalar; } catch {}
  try { officialStreets = (await (await fetch('kochalar.json')).json()).kochalar; } catch {}
  await Promise.race([K.ready, new Promise((ok) => setTimeout(ok, 12000))]); // 3D modellar (Kenney)
  const data = await loadOSM();
  if (data) { buildRoads(data); status(''); }
  else {
    buildRoads(fallbackGrid()); status("⏳ Shahrisabz xaritasi serverda tayyorlanmoqda — tayyor bo'lishi bilan o'zi ochiladi…");
    const t = setInterval(async () => { try { const r = await fetch('osm.json', { method: 'HEAD' }); if (r.ok) { clearInterval(t); location.reload(); } } catch {} }, 30000);
  }
  await refresh().catch(() => status('Server bilan aloqa yo\'q'));
  drawCustomPlaces(); loadPois(); setInterval(loadPois, 10 * 60 * 1000);
  life = initLife({ THREE, scene, sky, sun, hemi, renderer, camera, controls, ways: allWays, glass: GLASS, $, mergeGeometries, carParts: K.CARS.map((n) => K.parts(n, 4.5)).filter(Boolean), lampParts: K.partsH('r-light-curved', 8) });
  // Egasiz (OSM) haqiqiy binolar o'chirilgan: shaharda faqat obunachilarning uylari va sotib olingan binolar turadi
  const qp = new URLSearchParams(location.search); // ko'rish uchun: ?soat=22 yoki ?havo=61 (yomg'ir) / 73 (qor)
  if (qp.has('soat')) life.setHour(+qp.get('soat')); if (qp.has('havo')) life.setWeather(+qp.get('havo'));
  setInterval(() => mode === 'view' && refresh().catch(() => {}), 30000);
})();
