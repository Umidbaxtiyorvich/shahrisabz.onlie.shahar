import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';

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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; // shisha va mashina bo'yog'idagi aks
// ---- Tabiiy ko'rinish: protsedural teksturalar (internetdan rasm yuklamasdan) ----
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function canvasTex(size, draw, repeat = 1) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function speckle(g, n, size, cols, r0, r1, alpha = 1) { g.globalAlpha = alpha; for (let i = 0; i < n; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; const r = rnd(r0, r1); g.fillRect(Math.random() * size, Math.random() * size, r, r); } g.globalAlpha = 1; }
const TEX = {
  grass: canvasTex(512, (g, s) => { g.fillStyle = '#6f9a45'; g.fillRect(0, 0, s, s); speckle(g, 40, s, ['#5d8a3a', '#7fac52', '#86a04a', '#6a8f3f'], 40, 120, .35); speckle(g, 26000, s, ['#4f7a2f', '#8bb65a', '#a0b968', '#5e8c38', '#7a9a44'], 1, 3); speckle(g, 300, s, ['#a39a6b', '#8c7d55'], 2, 6, .5); }),
  asphalt: canvasTex(256, (g, s) => { g.fillStyle = '#4a4d52'; g.fillRect(0, 0, s, s); speckle(g, 9000, s, ['#3c3f43', '#5a5d62', '#444749', '#66696d'], 1, 2); }),
  concrete: canvasTex(256, (g, s) => { g.fillStyle = '#c9c4b8'; g.fillRect(0, 0, s, s); speckle(g, 5000, s, ['#bdb7aa', '#d6d1c6', '#b2ad9f'], 1, 2); g.strokeStyle = '#a9a396'; g.lineWidth = 2; for (let i = 0; i <= s; i += s / 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); } }),
  dash: canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s); g.fillStyle = '#f4f1e8'; g.fillRect(0, s * .1, s * .55, s * .8); }),
  plaster: canvasTex(256, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); speckle(g, 7000, s, ['#ecebe7', '#f6f5f2', '#e2e0da'], 1, 3); }),
  tiles: canvasTex(256, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? -12 : 0; x < s; x += 24) { g.fillStyle = `hsl(0,0%,${rnd(72, 92)}%)`; g.fillRect(x + 1, y + 1, 22, 13); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + 13, 24, 3); } }),
  brick: canvasTex(256, (g, s) => { g.fillStyle = '#d8d2c8'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < s; x += 32) { g.fillStyle = `hsl(${rnd(10, 22)},${rnd(35, 55)}%,${rnd(40, 55)}%)`; g.fillRect(x + 1.5, y + 1.5, 29, 13); } }),
  bark: canvasTex(64, (g, s) => { g.fillStyle = '#5b4330'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 3) { g.fillStyle = `rgba(30,20,10,${rnd(.1, .4)})`; g.fillRect(x, 0, 1.5, s); } }),
};
TEX.grass.repeat.set(1500, 1500);
// Osmon: fizik atmosfera modeli (quyosh, ufq, havo rangi)
const sky = new Sky(); sky.scale.setScalar(30000); scene.add(sky);
Object.assign(sky.material.uniforms, {}); sky.material.uniforms.turbidity.value = 6; sky.material.uniforms.rayleigh.value = 1.6; sky.material.uniforms.mieCoefficient.value = .004; sky.material.uniforms.mieDirectionalG.value = .85;
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(200));
sky.material.uniforms.sunPosition.value.copy(sunDir);
scene.fog = new THREE.Fog(0xc9d6e2, 2500, 12000);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 40000);
camera.position.set(0, 1400, 1500);
const controls = new MapControls(camera, renderer.domElement);
controls.maxPolarAngle = 1.35; controls.minDistance = 30; controls.maxDistance = 7000;
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x6b7a4a, 1.5));
const sun = new THREE.DirectionalLight(0xfff1dc, 3.2); sun.position.copy(sunDir).multiplyScalar(200); scene.add(sun); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 500 }); sun.shadow.bias = -.0005;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1, color: 0xd8dccb }));
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
let streetNames = [], officialPlaces = [];
// Mahalla chegaralari: [x,z] ko'pburchaklar
let mahallaPolys = [], officialStreets = [];
// Nomlarni solishtirish: x/h, o'/u, apostroflar farqini e'tiborsiz qoldiradi
const nk = (s) => String(s || '').toLowerCase().replace(/[ʻʼ‘’`']/g, '').replace(/kochasi|ko'chasi|ko‘chasi|ulitsa|улица|street|tor ko.cha|berk ko.cha/g, '').replace(/h/g, 'x').replace(/o/g, 'u').replace(/[^a-zа-я0-9]/g, '');
function drawCustomPlaces() {
  for (const c of state.customPlaces || []) {
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
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .45 })));
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
  const geos = [], lineGeo = [], walkGeo = [];
  const named = new Map();
  for (const w of data.ways) {
    const pts = w.xz || w.g.map(([la, lo]) => toXZ(la, lo));
    const wd = WIDTH[w.t] || 6;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az); if (len < .1) continue;
      segments.push({ ax, az, bx, bz, name: w.n });
      const ang = -Math.atan2(bz - az, bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const strip = (L, W, y, uvx, uvy) => { const g = new THREE.PlaneGeometry(L, W); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * uvx, uv.getY(k) * uvy); g.rotateX(-Math.PI / 2); g.rotateY(ang); g.translate(mx, y, mz); return g; };
      geos.push(strip(len + wd * .6, wd, .3 + (wd > 10 ? .1 : 0), (len + wd * .6) / 6, wd / 6));
      if (wd >= 5) walkGeo.push(strip(len + wd, wd + 4, .2, (len + wd) / 3, (wd + 4) / 3)); // trotuar
      if (wd >= 11) lineGeo.push(strip(len, .35, .45, len / 6, 1)); // uzuq chiziq
      if (w.n) { const arr = named.get(w.n) || []; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (len > 12 && !arr.some((q) => Math.hypot(q.x - mx, q.z - mz) < 350)) arr.push({ x: mx, z: mz }); named.set(w.n, arr); }
    }
  }
  const addMerged = (arr, mat, shadow) => { for (let i = 0; i < arr.length; i += 4000) { const m = new THREE.Mesh(mergeGeometries(arr.slice(i, i + 4000)), mat); m.receiveShadow = shadow; scene.add(m); } };
  addMerged(walkGeo, new THREE.MeshStandardMaterial({ map: TEX.concrete, roughness: .95 }), true);
  addMerged(geos, new THREE.MeshStandardMaterial({ map: TEX.asphalt, roughness: .9, color: 0xd0d0d0 }), true);
  addMerged(lineGeo, new THREE.MeshStandardMaterial({ map: TEX.dash, transparent: true, roughness: .6 }), false);
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
  // daraxtlar: ko'cha bo'ylab, har xil o'lcham va yashil tuslarda (instancing — tez ishlaydi)
  const N = 7000, crownG = new THREE.IcosahedronGeometry(1, 1), trunkG = new THREE.CylinderGeometry(.18, .28, 1, 6);
  crownG.translate(0, 0, 0); trunkG.translate(0, .5, 0);
  const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true }), N);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 1 }), N);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const near = segments.filter((sg) => Math.hypot(sg.ax, sg.az) < 4500);
  for (let i = 0; i < N; i++) {
    const sg = near[(Math.random() * near.length) | 0] || segments[0]; if (!sg) break;
    const t = Math.random(), off = (Math.random() > .5 ? 1 : -1) * rnd(9, 16), dx = sg.bx - sg.ax, dz = sg.bz - sg.az, L = Math.hypot(dx, dz) || 1;
    const x = sg.ax + dx * t - dz / L * off, z = sg.az + dz * t + dx / L * off, h = rnd(3, 6.5), r = rnd(2, 4.2);
    mtx.compose(ps.set(x, 0, z), q.identity(), sc.set(h / 4, h, h / 4)); trunks.setMatrixAt(i, mtx);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.3);
    mtx.compose(ps.set(x, h + r * .55, z), q, sc.set(r, r * rnd(.85, 1.3), r)); crowns.setMatrixAt(i, mtx);
    crowns.setColorAt(i, col.setHSL(rnd(.24, .33), rnd(.45, .7), rnd(.12, .22)));
  }
  crowns.castShadow = trunks.castShadow = true; scene.add(crowns, trunks);
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
function nearestStreetName(x, z) {
  let best = '', bd = Infinity;
  for (const s of segments) { if (!s.name) continue; const d = Math.hypot((s.ax + s.bx) / 2 - x, (s.az + s.bz) / 2 - z); if (d < bd) { bd = d; best = s.name; } }
  return bd < 400 ? best : '';
}
const nearestMahalla = (x, z) => mahallaAt(x, z) || places.reduce((b, p) => { const d = Math.hypot(p.x - x, p.z - z); return d < b.d ? { d, n: p.name } : b; }, { d: Infinity, n: '' }).n;

// ---- Uylar va binolar ----
const objects = new THREE.Group(); scene.add(objects);
const clickable = [];
const hsl = (h, s = .65, l = .62) => new THREE.Color().setHSL(h / 360, s, l);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .05, ...o });
const WALL = (c) => new THREE.MeshStandardMaterial({ color: c, map: TEX.plaster, roughness: .9 });
const ROOF = (c) => new THREE.MeshStandardMaterial({ color: c, map: TEX.tiles, roughness: .75 });
const BRICK = () => new THREE.MeshStandardMaterial({ map: TEX.brick, roughness: .95 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x8fb8d8, roughness: .05, metalness: .9, envMapIntensity: 1.4 });
const FRAME = M(0x2b2f36, { roughness: .4, metalness: .6 });
const WOOD = M(0x9a6b43, { roughness: .8 });
function box(g, w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
// Ramkali deraza: shisha + qora ramka
function win(g, w, h, x, y, z, rotY = 0) { const wg = new THREE.Group(); box(wg, w + .3, h + .3, .15, FRAME); box(wg, w, h, .2, GLASS); box(wg, .12, h, .25, FRAME); wg.position.set(x, y, z); wg.rotation.y = rotY; g.add(wg); return wg; }
function windowsRow(g, w, y, z, n, h = 2.4) { for (let i = 0; i < n; i++) win(g, (w / n) * .62, h, -w / 2 + (w / n) * (i + .5), y, z); }
function railing(g, w, x, y, z) { box(g, w, 1, .1, new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: .35, roughness: .05, metalness: .3 }), x, y, z); box(g, w, .08, .14, FRAME, x, y + 1, z); }
function tree(g, x, z, s = 1) { const t = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 * s, 1), M(new THREE.Color().setHSL(rnd(.24, .32), .5, rnd(.25, .35)), { roughness: .9, flatShading: true })); t.position.set(x, 3.6 * s, z); t.castShadow = true; g.add(t); box(g, .4 * s, 2.4 * s, .4 * s, M(0x6b4a2b), x, 0, z); }
const LAWN = new THREE.MeshStandardMaterial({ map: (() => { const t = TEX.grass.clone(); t.repeat.set(4, 4); t.needsUpdate = true; return t; })(), roughness: 1 });
function lawn(g, w, d, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .15, d), LAWN); m.position.set(0, .07, z); m.receiveShadow = true; g.add(m); }
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
function car(type, hex) {
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
  const top = (HOUSE_BUILDERS[r.style] || HOUSE_BUILDERS.oddiy)(g, colorOf(r, 20));
  (r.cars || []).slice(0, CAR_SLOTS.length).forEach((c, i) => { const cg = car(c.t, c.c); const [x, z, ry] = CAR_SLOTS[i]; cg.position.set(x, 0, z); cg.rotation.y = ry + Math.PI / 2; g.add(cg); });
  const av = avatarSprite(r); av.position.y = top + 19.5; g.add(av);
  const l = label(opts.label || '@' + r.username, { size: 26, fg: '#2f7cf6', scale: .9 }); l.position.y = top + 11.5; g.add(l);
  const adr = [r.mahalla && r.mahalla !== 'Shahar chekkasi' ? r.mahalla : '', r.street, r.no && 'uy ' + r.no].filter(Boolean).join(', ');
  if (adr) { const al = label('📍 ' + adr, { size: 24, bg: 'rgba(255,255,255,.95)', fg: '#1d2433', scale: .7 }); al.position.y = top + 3.2; al.renderOrder = 12; g.add(al); }
  g.position.set(r.x, 0, r.z);
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
        const hg = new THREE.Group(); const t = (HOUSE_BUILDERS[p.style] || HOUSE_BUILDERS.oddiy)(hg, colorOf(p, 40));
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
  const l = label(`${TYPE_ICON[p.type] || ''} ${p.name}${p.status === 'pending' ? ' (kutilmoqda)' : p.built === false ? ' 🏗️ qurilmagan' : ''}`, { size: 26, bg: p.status === 'sold' ? 'rgba(255,255,255,.95)' : 'rgba(255,233,168,.95)', scale: 1 });
  l.position.set(cx, top, cz); g.add(l);
  return g;
}

// ---- Holat ----
let state = { residents: [], plots: [], settings: {}, types: [] };
let me = store.get('me'); // {username,password}
async function refresh() {
  state = await api('/api/state');
  clickable.length = 0;
  objects.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  objects.clear(); lodCars.length = 0;
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
  let t = 0; const step = () => { t = Math.min(1, t + .03); const e = 1 - Math.pow(1 - t, 3); camera.position.lerpVectors(from, to, e); controls.target.lerpVectors(fromT, toT, e); if (t < 1) requestAnimationFrame(step); }; step();
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
    const x = n.px - dz / L * 16 * side, z = n.pz + dx / L * 16 * side;
    const street = n.s.name || nearestStreetName(x, z), mahalla = nearestMahalla(x, z);
    modal(`<h3>Ko'chib o'tasizmi?</h3><div>📍 ${esc(mahalla || 'Noma\'lum mahalla')}${street ? ', ' + esc(street) : ''}</div><div class="row"><button class="ok" id="yes">Ha, ko'chaman</button><button class="ghost" id="nope">Yo'q</button></div>`);
    $('nope').onclick = closeModal;
    $('yes').onclick = async () => { try { await api('/api/move', { ...me, x, z, street, mahalla }); closeModal(); setMode('view'); await refresh(); flyTo(x, z); } catch (er) { alert(er.message); } };
    return;
  }
  if (mode === 'buy' && p) {
    const cx = p.x, cz = p.z, street = nearestStreetName(cx, cz), mahalla = nearestMahalla(cx, cz), per = state.settings.pricePerSotix;
    const show = (sx) => { // tanlangan sotixni xaritada kvadrat qilib ko'rsatish
      if (preview) scene.remove(preview);
      const a = Math.sqrt(Math.max(sx, .1) * 100);
      preview = new THREE.Mesh(new THREE.PlaneGeometry(a, a), new THREE.MeshBasicMaterial({ color: 0x2f7cf6, transparent: true, opacity: .45 }));
      preview.rotation.x = -Math.PI / 2; preview.position.set(cx, .8, cz); scene.add(preview);
    };
    modal(`<h3>📐 Joy sotib olish</h3>
      <div class="muted">📍 ${esc(mahalla)}${street ? ', ' + esc(street) : ''}</div>
      <label>Necha sotix kerak? <span class="muted">(1 sotix = 100 m²)</span><input id="psx" type="number" min="0.5" max="200" step="0.5" value="6"></label>
      <div class="wallet">1 sotix: <b>${money(per)}</b><br>Jami: <b id="ptot"></b><br><span class="muted">Hamyonda: ${money(wallet.balance)}</span></div>
      <label>Nima qurasiz?<select id="ptype">${state.types.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
      <input id="pname" placeholder="Nomi (masalan: Umid market)">
      <input id="pcontact" placeholder="Telefon raqamingiz (admin bog'lanishi uchun)">
      <div class="row"><button class="ok" id="send">Sotib olish</button><button class="ghost" id="nope">Bekor</button></div>`);
    const upd = () => { const sx = Number($('psx').value) || 0; $('ptot').textContent = `${sx} sotix (${Math.round(sx * 100)} m²) = ${money(Math.round(sx * per))}`; show(sx); };
    $('psx').oninput = upd; upd(); $('psx').focus(); $('psx').select();
    $('nope').onclick = () => { closeModal(); setMode('view'); };
    $('send').onclick = async () => {
      try {
        const j = await api('/api/plots/request', { ...me, x: cx, z: cz, sotix: Number($('psx').value), type: $('ptype').value, name: $('pname').value, contact: $('pcontact').value, street, mahalla });
        modal(j.plot.status === 'sold' ? `<h3>✅ Joy sizniki!</h3><div>Pul hamyoningizdan yechildi. Binongiz xaritada qurildi — endi uni zamonaviy dizaynga o'zgartirishingiz mumkin.</div><button id="okk">Yaxshi</button>` : `<h3>✅ So'rov yuborildi</h3><div>Hamyoningizda pul yetarli emas. Admin to'lovni qabul qilgandan keyin joy sizniki bo'ladi.</div><button id="okk">Yaxshi</button>`);
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
  } else if (hit?.object.userData.kind === 'xhouse') {
    const h = hit.object.userData.h;
    if (myRes() && h.owner === me.username) return openMyPanel();
    return openAssetInfo({ owner: h.owner, kind: 'house', refId: h.id, title: `🏠 @${h.owner} ${h.n}-uyi`, addr: [h.mahalla, h.street, h.no && 'uy ' + h.no].filter(Boolean).join(', '), price: state.shop?.houses?.[h.style] || 0, x: h.x, z: h.z });
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
  return out.sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0)).slice(0, 12);
}
function showResults(list) {
  let box = $('qres'); if (!box) { box = document.createElement('div'); box.id = 'qres'; box.className = 'card qres'; document.querySelector('.search').after(box); }
  if (!list) { box.remove(); return; }
  const sr = document.querySelector('.search').getBoundingClientRect(); box.style.top = sr.bottom + 6 + 'px'; box.style.left = sr.left + 'px'; box.style.width = sr.width + 'px';
  box.innerHTML = list.length ? list.map((r, i) => `<div class="qitem" data-i="${i}"><b>${esc(r.t)}</b><div class="muted">📍 ${esc(r.a || '—')}</div></div>`).join('') : '<div class="muted">Hech narsa topilmadi</div>';
  box.querySelectorAll('.qitem').forEach((el) => (el.onclick = () => { const r = list[el.dataset.i]; flyTo(r.x, r.z, 70); showResults(null); }));
}
const doSearch = () => { const list = searchAll($('q').value.trim()); if (list.length === 1) { flyTo(list[0].x, list[0].z, 70); showResults(null); } else showResults(list); };
$('q').addEventListener('input', () => { const v = $('q').value.trim(); v.length >= 2 ? showResults(searchAll(v)) : showResults(null); });
document.addEventListener('click', (e) => { if (!e.target.closest('.search, .qres')) showResults(null); });
$('qbtn').onclick = doSearch; $('q').addEventListener('keydown', (e) => e.key === 'Enter' && doSearch());


// ---- Hamyon, uy dizayni, mashina ----
let wallet = { balance: 0, tx: [], shop: { houses: {}, cars: {}, repaint: 0 }, plots: [] };
async function loadWallet() { if (!myRes()) return; try { wallet = await api('/api/me', me); $('bal').textContent = money(wallet.balance); } catch {} }
const STYLE_NAMES = { oddiy: '🏠 Oddiy', zamonaviy: '🏡 Zamonaviy', kottej: '🏘️ Kottej', villa: '🏝️ Villa', minora: '🏙️ Minora' };
const CAR_NAMES = { yoq: '— Mashinasiz', sedan: '🚗 Sedan', jeep: '🚙 Jip', sport: '🏎️ Sport (Ferrari)', limuzin: '🚘 Limuzin' };
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
    <div class="wallet">💰 Hamyon: <b>${money(wallet.balance)}</b></div>
    ${wallet.homeless ? '<div class="hint" style="background:#fff3e0;padding:8px;border-radius:10px">🏚️ Asosiy uyingizni sotgansiz. Yangi joy sotib olib, unda pulga uy qurishingiz mumkin.</div>' : ''}
    ${wallet.offersIn.length ? '<b>🤝 Sizga kelgan takliflar</b>' + wallet.offersIn.map((o) => `<div class="offer"><div>@${esc(o.initiator === 'buyer' ? o.buyer : o.seller)} — <b>${esc(o.title)}</b> uchun <b>${money(o.price)}</b> ${o.initiator === 'buyer' ? (o.buyerCanPay ? '<span class="okc">✓ puli yetarli</span>' : '<span class="noc">✗ puli yetmaydi</span>') : ''}</div><div class="row"><button class="ok" data-acc="${o.id}">${o.initiator === 'buyer' ? '✅ Sotildi' : '✅ Sotib olaman'}</button><button class="no" data-rej="${o.id}">Rad etish</button></div></div>`).join('') : ''}
    <div class="row"><button id="pdes" ${wallet.homeless ? 'disabled' : ''}>🎨 Uy va mashina</button><button id="pmove" ${wallet.homeless ? 'disabled' : ''}>🚚 Ko'chish</button><button id="pbuy">📐 Joy sotib olish</button></div>
    <b>🏘️ Mening mulklarim</b>
    ${assets.map((a, i) => `<div class="offer"><div><b>${esc(a.title)}</b><div class="muted">📍 ${esc(addr(a.o))}</div></div><div class="row"><button class="ghost" data-fly="${i}">🔍</button><button class="ghost" data-ed="${i}">✏️ Manzil</button><button class="ghost" data-ds="${i}">🎨</button></div></div>`).join('') || '<div class="muted">Mulk yo\'q</div>'}
    ${wallet.offersOut.length ? `<details><summary class="muted">Mening takliflarim (${wallet.offersOut.length})</summary>${wallet.offersOut.map((o) => `<div class="muted">${fmtT(o.at)} · ${esc(o.title)} · ${money(o.price)} · ${o.initiator === 'buyer' ? '@' + esc(o.seller) + ' ga taklif' : '@' + esc(o.buyer) + ' ga sotish'} · ${ST_OFFER[o.status] || esc(o.status)} ${o.status === 'pending' ? `<a href="#" data-cnc="${o.id}">bekor qilish</a>` : ''}</div>`).join('')}</details>` : ''}
    <details><summary class="muted">Hamyon tarixi</summary>${wallet.tx.map((t) => `<div class="muted">${fmtT(t.at)} · <b style="color:${t.amount > 0 ? '#1fa463' : '#e24b4b'}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</b> · ${esc(t.text)}</div>`).join('') || '<div class="muted">Bo\'sh</div>'}</details>
    <button class="ghost" id="nope">Yopish</button>`);
  $('nope').onclick = closeModal; $('pdes').onclick = () => openDesigner(null); $('pmove').onclick = openMove; $('pbuy').onclick = () => { closeModal(); setMode('buy'); };
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
  modal(`<h3>${esc(t.title)}</h3><div class="muted">📍 ${esc(t.addr || '—')}</div><div class="wallet">🏷️ Dizayn qiymati: <b>${money(t.price)}</b></div>
    <div class="row">${myRes() ? `<button class="ok" id="aofr">💰 Sotib olish taklifi</button><button id="achat">💬 Egasiga yozish</button>` : '<div class="hint">Taklif qilish uchun saytga kiring.</div>'}<button class="ghost" id="nope">Yopish</button></div>`);
  $('nope').onclick = closeModal;
  if ($('aofr')) { $('aofr').onclick = () => openOffer(t); $('achat').onclick = () => openChat(t.owner); }
}
const hex = (o, d = '#e9d8b4') => o?.colorHex || (o?.color !== undefined ? '#' + hsl(o.color).getHexString() : d);
async function upgrade(body) { const j = await api('/api/upgrade', { ...me, ...body }); await refresh(); await loadWallet(); return j; }
function openDesigner(plot) {
  const r = myRes(), sh = wallet.shop, cur = plot || r, isHouse = !!plot?.isHouse, unbuilt = plot && !isHouse && plot.built === false;
  let sel = { style: cur.style || 'oddiy', color: hex(cur) };
  const render = () => {
    const cars = plot ? [] : (r.cars || []);
    modal(`<h3>${unbuilt ? '🏗️ Uy qurish' : '🎨'} ${plot ? esc(plot.name || (isHouse ? plot.n + '-uy' : '')) : 'Uyim'}</h3><div class="wallet">💰 Hamyon: <b>${money(wallet.balance)}</b>${unbuilt ? `<br>🏗️ Qurilish: <b>${money(sh.build)}</b> + tanlangan dizayn narxi` : ''}</div>
      <b>🏠 Dizayn</b><div class="picks">${Object.entries(sh.houses).map(([k, v]) => `<button class="pick ${sel.style === k ? 'on' : ''}" data-s="${esc(k)}">${STYLE_NAMES[k] || esc(k)}<small>${k === (cur.style || 'oddiy') && !unbuilt ? '✓ hozirgi' : v ? money(v) : (unbuilt ? '+0' : 'bepul')}</small></button>`).join('')}</div>
      <div class="row" style="align-items:center"><label class="clr">🎨 Rang <input type="color" id="hcol" value="${sel.color}"></label><span class="muted">rang o'zgartirish: ${money(sh.repaint)}</span></div>
      <button class="ok" id="dbuy">Saqlash</button>
      ${plot ? '' : `<hr><b>🚗 Mashinalarim (${cars.length})</b>
      ${cars.map((c, i) => `<div class="carrow"><span>${CAR_NAMES[c.t] || esc(c.t)}</span><input type="color" value="${esc(c.c)}" data-ci="${i}"><button class="ghost" data-cr="${i}">Rangni saqlash</button><button class="no" data-cx="${i}">✕</button></div>`).join('') || '<div class="muted">Hali mashina yo\'q</div>'}
      <b>➕ Yangi mashina sotib olish</b>
      <div class="row" style="align-items:center"><select id="ncar">${Object.entries(sh.cars).filter(([k]) => k !== 'yoq').map(([k, v]) => `<option value="${esc(k)}">${CAR_NAMES[k] || esc(k)} — ${money(v)}</option>`).join('')}</select><label class="clr">Rangi <input type="color" id="ncol" value="#c0392b"></label><button class="ok" id="nbuy">Sotib olish</button></div>
      <div class="muted">🏎️ Sport — haqiqiy 3D model (yaqinlashganda ko'rinadi). Uy oldiga 12 tagacha mashina sig'adi.</div>`}
      <button class="ghost" id="nope">Yopish</button>`);
    document.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { sel.style = b.dataset.s; sel.color = $('hcol').value; render(); }));
    $('nope').onclick = closeModal;
    const go = async (body, msg) => { try { const j = await upgrade(body); toast(`${msg}${j.cost ? ' · −' + money(j.cost) : ''}`); render(); } catch (e) { alert(e.message); } };
    $('dbuy').onclick = () => go(isHouse ? { houseId: plot.id, style: sel.style, color: $('hcol').value } : { plotId: plot?.id, style: sel.style, color: $('hcol').value }, unbuilt ? '🏗️ Uy qurildi!' : '✅ Saqlandi');
    if (!plot) {
      $('nbuy').onclick = () => go({ buyCar: { t: $('ncar').value, c: $('ncol').value } }, '🚗 Mashina uyingiz oldida!');
      document.querySelectorAll('[data-cr]').forEach((b) => (b.onclick = () => go({ recolorCar: { i: +b.dataset.cr, c: document.querySelector(`[data-ci="${b.dataset.cr}"]`).value } }, '🎨 Rang o\'zgardi')));
      document.querySelectorAll('[data-cx]').forEach((b) => (b.onclick = () => confirm('Bu mashinani olib tashlaysizmi? (pul qaytmaydi)') && go({ removeCar: +b.dataset.cx }, 'Olib tashlandi')));
    }
  };
  render();
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
// Boshqa odamning uyi: manzil, narxlar, mashinalar, joylar, yozish
function openHouseInfo(r) {
  const sh = state.shop || { houses: {}, cars: {} };
  const housePrice = sh.houses[r.style || 'oddiy'] || 0;
  const cars = r.cars || [];
  const plots = state.plots.filter((p) => p.owner === r.username && p.status === 'sold');
  const carsTotal = cars.reduce((a, c) => a + (sh.cars[c.t] || 0), 0), plotsTotal = plots.reduce((a, p) => a + (p.price || 0) + (sh.houses[p.style] || 0), 0);
  modal(`<div class="row" style="align-items:center;flex-wrap:nowrap">${ava(r.username, 'ava big')}<div><h3>@${esc(r.username)}</h3><div class="muted">📍 ${esc([r.mahalla, r.street, r.no && 'uy ' + r.no].filter(Boolean).join(', ') || 'Shahar chekkasi')}</div></div></div>
    <div class="wallet">🏷️ Umumiy qiymati: <b>${money(housePrice + carsTotal + plotsTotal)}</b></div>
    <table class="itbl"><tr><td>${STYLE_NAMES[r.style] || '🏠 ' + esc(r.style || 'oddiy')} <span class="sw" style="background:${hex(r)}"></span></td><td>${housePrice ? money(housePrice) : 'boshlang\'ich'}</td></tr>
    ${cars.map((c) => `<tr><td>${CAR_NAMES[c.t] || esc(c.t)} <span class="sw" style="background:${esc(c.c)}"></span></td><td>${money(sh.cars[c.t] || 0)}</td></tr>`).join('')}
    ${plots.map((p) => `<tr><td>📐 ${esc(p.name)} · ${p.sotix} sotix · ${STYLE_NAMES[p.style] || esc(p.style || '')}</td><td>${money((p.price || 0) + (sh.houses[p.style] || 0))}</td></tr>`).join('')}</table>
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
    // band bo'lmagan joy: uylar orasida kamida 25 m
    for (const sg of cand.slice(0, 60)) for (let t = .15; t < 1; t += .2) for (const side of [1, -1]) {
      const dx = sg.bx - sg.ax, dz = sg.bz - sg.az, L = Math.hypot(dx, dz) || 1;
      const x = sg.ax + dx * t - dz / L * 16 * side, z = sg.az + dz * t + dx / L * 16 * side;
      if (state.residents.some((r) => r.username !== me.username && Math.hypot(r.x - x, r.z - z) < 25)) continue;
      try { await api('/api/move', { ...me, x, z, street: sg.name || nearestStreetName(x, z), mahalla: (mh && mp ? mp.name : '') || cpMah || mahallaAt(x, z) || nearestMahalla(x, z) }); closeModal(); await refresh(); flyTo(x, z); } catch (e) { alert(e.message); }
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

// ---- Animatsiya ----
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
let frame = 0;
(function loop() {
  requestAnimationFrame(loop); controls.update();
  if (frame++ % 15 === 0) { const t = controls.target, h = camera.position.y; for (const l of streetLabels) l.visible = h < 1100 && Math.hypot(l.position.x - t.x, l.position.z - t.z) < h * 1.8; for (const l of placeLabels) l.visible = l.userData.big || h < 2600; }
  const t = controls.target; sun.position.set(t.x + sunDir.x * 200, sunDir.y * 200, t.z + sunDir.z * 200); sun.target.position.copy(t);
  if (frame % 20 === 0) { const wp = new THREE.Vector3(); for (const g of lodCars) { if (!g.parent) continue; g.getWorldPosition(wp); const near = wp.distanceTo(camera.position) < 260; const l = g.userData.lod; if (near) upgradeLod(g); if (l.real) { l.real.visible = near; l.simple.visible = !near; } } }
  renderer.render(scene, camera);
})();

// ---- Boshlash ----
(async () => {
  refresh().catch(() => {});
  try { officialPlaces = (await (await fetch('mahallas-geo.json')).json()).mahallalar; } catch {}
  try { officialStreets = (await (await fetch('kochalar.json')).json()).kochalar; } catch {}
  const data = await loadOSM();
  if (data) { buildRoads(data); status(''); }
  else {
    buildRoads(fallbackGrid()); status("⏳ Shahrisabz xaritasi serverda tayyorlanmoqda — tayyor bo'lishi bilan o'zi ochiladi…");
    const t = setInterval(async () => { try { const r = await fetch('osm.json', { method: 'HEAD' }); if (r.ok) { clearInterval(t); location.reload(); } } catch {} }, 30000);
  }
  await refresh().catch(() => status('Server bilan aloqa yo\'q'));
  drawCustomPlaces();
  setInterval(() => mode === 'view' && refresh().catch(() => {}), 30000);
})();
