import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- Koordinatalar: Shahrisabz markazi (Oqsaroy atrofi) ----
const LAT0 = 39.0578, LON0 = 66.8297;
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110540;
const toXZ = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const BBOX = '39.015,66.775,39.105,66.885';

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
renderer.shadowMap.enabled = false;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
scene.fog = new THREE.Fog(0xbfe3ff, 4000, 9000);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 20000);
camera.position.set(0, 1400, 1500);
const controls = new MapControls(camera, renderer.domElement);
controls.maxPolarAngle = 1.35; controls.minDistance = 30; controls.maxDistance = 7000;
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfa0, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(800, 1500, 600); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshLambertMaterial({ color: 0xf4efcc }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
// bulutlar
for (let i = 0; i < 18; i++) {
  const c = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(60 + Math.random() * 50, 10, 8), m); s.position.set(j * 70 - 100, Math.random() * 30, Math.random() * 40); c.add(s); }
  c.position.set((Math.random() - .5) * 9000, 900 + Math.random() * 300, (Math.random() - .5) * 9000); scene.add(c);
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
const WIDTH = { trunk: 18, primary: 16, secondary: 13, tertiary: 11, residential: 8, unclassified: 8, living_street: 6, service: 5 };
let segments = []; // {ax,az,bx,bz,name}
let places = []; // {name,x,z}
const streetLabels = [];

async function loadOSM() {
  const cached = store.get('osm-shahrisabz-v1');
  if (cached) return cached;
  status('🗺️ Shahrisabz xaritasi yuklanmoqda (birinchi marta 1–2 daqiqa)…');
  try { const r = await fetch('osm.json', { signal: AbortSignal.timeout(150000) }); if (r.ok) { const j = await r.json(); store.set('osm-shahrisabz-v1', j); return j; } } catch {}
  const q = `[out:json][timeout:90];(way["highway"~"^(trunk|primary|secondary|tertiary|residential|unclassified|living_street|service)$"](${BBOX});node["place"~"^(neighbourhood|suburb|quarter|village|hamlet)$"](${BBOX}););out geom;`;
  const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  for (const u of mirrors) {
    try {
      const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(60000) });
      if (!r.ok) continue;
      const j = await r.json();
      const slim = { ways: [], places: [] };
      for (const e of j.elements) {
        if (e.type === 'way' && e.geometry) slim.ways.push({ t: e.tags.highway, n: e.tags['name:uz'] || e.tags.name || '', g: e.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]) });
        else if (e.type === 'node' && e.tags?.name) slim.places.push({ n: e.tags['name:uz'] || e.tags.name, lat: e.lat, lon: e.lon });
      }
      store.set('osm-shahrisabz-v1', slim);
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
  const geos = [], lineGeo = [];
  const named = new Map();
  for (const w of data.ways) {
    const pts = w.xz || w.g.map(([la, lo]) => toXZ(la, lo));
    const wd = WIDTH[w.t] || 6;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az); if (len < .1) continue;
      segments.push({ ax, az, bx, bz, name: w.n });
      const g = new THREE.PlaneGeometry(len + wd * .6, wd);
      g.rotateX(-Math.PI / 2); g.rotateY(-Math.atan2(bz - az, bx - ax)); g.translate((ax + bx) / 2, .3 + (wd > 10 ? .1 : 0), (az + bz) / 2);
      geos.push(g);
      if (wd >= 11) { const m = new THREE.PlaneGeometry(len * .9, .6); m.rotateX(-Math.PI / 2); m.rotateY(-Math.atan2(bz - az, bx - ax)); m.translate((ax + bx) / 2, .5, (az + bz) / 2); lineGeo.push(m); }
      if (w.n) { const s = named.get(w.n) || { len: 0, best: null }; s.len += len; if (!s.best || len > s.best.len) s.best = { len, x: (ax + bx) / 2, z: (az + bz) / 2 }; named.set(w.n, s); }
    }
  }
  for (let i = 0; i < geos.length; i += 4000) scene.add(new THREE.Mesh(mergeGeometries(geos.slice(i, i + 4000)), new THREE.MeshLambertMaterial({ color: 0xd3d7de })));
  for (let i = 0; i < lineGeo.length; i += 4000) scene.add(new THREE.Mesh(mergeGeometries(lineGeo.slice(i, i + 4000)), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  for (const [n, s] of named) {
    if (s.len < 80) continue;
    const l = label(n, { size: 24, bg: 'rgba(255,255,255,.75)', fg: '#4a5568', scale: 1.2 });
    l.position.set(s.best.x, 8, s.best.z); l.visible = false; scene.add(l); streetLabels.push(l);
  }
  places = data.places.map((p) => { const [x, z] = p.xz || toXZ(p.lat, p.lon); return { name: p.n, x, z }; });
  for (const p of places) { const l = label('📍 ' + p.name, { size: 32, bg: 'rgba(47,124,246,.9)', fg: '#fff', scale: 4 }); l.position.set(p.x, 60, p.z); scene.add(l); }
  // daraxtlar (bo'sh joylar uchun bezak)
  const treeG = new THREE.ConeGeometry(5, 14, 6); treeG.translate(0, 9, 0);
  const trees = new THREE.InstancedMesh(treeG, new THREE.MeshLambertMaterial({ color: 0x5cc96b }), 1500);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 1500; i++) { const s = segments[(Math.random() * segments.length) | 0]; const t = Math.random(), off = (Math.random() > .5 ? 1 : -1) * 14; const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz) || 1; mtx.makeTranslation(s.ax + dx * t - dz / L * off, 0, s.az + dz * t + dx / L * off); trees.setMatrixAt(i, mtx); }
  scene.add(trees);
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
const nearestMahalla = (x, z) => places.reduce((b, p) => { const d = Math.hypot(p.x - x, p.z - z); return d < b.d ? { d, n: p.name } : b; }, { d: Infinity, n: '' }).n;

// ---- Uylar va binolar ----
const objects = new THREE.Group(); scene.add(objects);
const clickable = [];
const hsl = (h, s = .65, l = .62) => new THREE.Color().setHSL(h / 360, s, l);
function house(r) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 12), new THREE.MeshLambertMaterial({ color: 0xf2ead3 }));
  body.position.y = 4.5; g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 6, 4), new THREE.MeshLambertMaterial({ color: hsl(r.color) }));
  roof.position.y = 12; roof.rotation.y = Math.PI / 4; g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(3, 5, .4), new THREE.MeshLambertMaterial({ color: 0x8a5a2b })); door.position.set(0, 2.5, 6.1); g.add(door);
  const l = label('@' + r.username, { size: 26, fg: '#2f7cf6', scale: .9 }); l.position.y = 22; g.add(l);
  g.position.set(r.x, 0, r.z);
  g.userData = { kind: 'house', r };
  body.userData = roof.userData = l.userData = g.userData;
  clickable.push(body, roof, l);
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
  if (p.status === 'sold') {
    const [col, h] = TYPE_STYLE[p.type] || TYPE_STYLE.boshqa;
    if (p.type === "bog'") {
      for (let i = 0; i < Math.min(30, p.area / 60); i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(4, 12, 6), new THREE.MeshLambertMaterial({ color: 0x4cbf5d })); t.position.set(p.x1 + Math.random() * w, 6, p.z1 + Math.random() * d); g.add(t); }
      top = 16;
    } else {
      const bw = Math.max(4, w * .75), bd = Math.max(4, d * .75);
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), new THREE.MeshLambertMaterial({ color: col })); b.position.set(cx, h / 2, cz); g.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 1, 1.2, bd + 1), new THREE.MeshLambertMaterial({ color: 0x6b7a90 })); roof.position.set(cx, h + .6, cz); g.add(roof);
      if (p.type === 'masjid') { const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(bw, bd) / 3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2aa3c9 })); dome.position.set(cx, h + 1, cz); g.add(dome); }
      b.userData = { kind: 'plot', p }; clickable.push(b);
      top = h + 10;
    }
  }
  base.userData = { kind: 'plot', p }; clickable.push(base);
  const l = label(`${TYPE_ICON[p.type] || ''} ${p.name}${p.status === 'pending' ? ' (kutilmoqda)' : ''}`, { size: 26, bg: p.status === 'sold' ? 'rgba(255,255,255,.95)' : 'rgba(255,233,168,.95)', scale: 1 });
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
  objects.clear();
  state.residents.forEach((r) => objects.add(house(r)));
  state.plots.forEach((p) => objects.add(plotObj(p)));
  $('count').textContent = `${state.residents.length} ta uy`;
  renderMe();
  checkUnread();
}
const myRes = () => me && state.residents.find((r) => r.username === me.username);
function renderMe() {
  const r = myRes();
  $('guest').classList.toggle('hidden', !!r);
  $('me').classList.toggle('hidden', !r);
  if (r) { $('mename').textContent = '@' + r.username; $('meaddr').textContent = [r.mahalla, r.street].filter(Boolean).join(', '); }
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
  status(m === 'move' ? "🚚 Xaritada yangi uyingiz uchun ko'cha bo'yidagi joyni bosing (Esc — bekor)" : m === 'buy' ? '📐 Joyning birinchi burchagini bosing (Esc — bekor)' : '');
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMode('view'); });

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function groundPoint(e) { mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera); const h = ray.intersectObject(ground)[0]; return h && h.point; }
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) onClick(e); });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (mode !== 'buy' || !corner) return; const p = groundPoint(e); if (!p) return;
  if (preview) scene.remove(preview);
  const w = Math.abs(p.x - corner.x), d = Math.abs(p.z - corner.z);
  preview = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, 1), Math.max(d, 1)), new THREE.MeshBasicMaterial({ color: 0x2f7cf6, transparent: true, opacity: .4 }));
  preview.rotation.x = -Math.PI / 2; preview.position.set((p.x + corner.x) / 2, .8, (p.z + corner.z) / 2); scene.add(preview);
  status(`📐 ${Math.round(w * d)} m² — ${money(Math.round(w * d) * state.settings.pricePerM2)}. Ikkinchi burchakni bosing`);
});

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
    if (!corner) { corner = p.clone(); return status('📐 Endi qarama-qarshi burchakni bosing'); }
    const x1 = corner.x, z1 = corner.z, x2 = p.x, z2 = p.z;
    const area = Math.round(Math.abs(x2 - x1) * Math.abs(z2 - z1));
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, street = nearestStreetName(cx, cz), mahalla = nearestMahalla(cx, cz);
    modal(`<h3>📐 Joy sotib olish</h3>
      <div>Maydon: <b>${area} m²</b> · Narx: <b>${money(area * state.settings.pricePerM2)}</b><div class="muted">(1 m² = ${money(state.settings.pricePerM2)})</div></div>
      <div class="muted">📍 ${esc(mahalla)}${street ? ', ' + esc(street) : ''}</div>
      <label>Nima qurasiz?<select id="ptype">${state.types.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
      <input id="pname" placeholder="Nomi (masalan: Umid market)">
      <input id="pcontact" placeholder="Telefon raqamingiz (admin bog'lanishi uchun)">
      <div class="row"><button class="ok" id="send">Sotib olish so'rovini yuborish</button><button class="ghost" id="nope">Bekor</button></div>`);
    $('nope').onclick = () => { closeModal(); setMode('view'); };
    $('send').onclick = async () => {
      try {
        await api('/api/plots/request', { ...me, x1, z1, x2, z2, type: $('ptype').value, name: $('pname').value, contact: $('pcontact').value, street, mahalla });
        modal(`<h3>✅ So'rov yuborildi</h3><div>Admin to'lovni qabul qilgandan keyin joy sizniki bo'ladi va binongiz xaritada paydo bo'ladi.</div><button id="okk">Yaxshi</button>`);
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
    if (myRes() && r.username !== me.username) return openChat(r.username);
    modal(`<h3>🏠 @${esc(r.username)}</h3><div class="muted">${esc([r.mahalla, r.street].filter(Boolean).join(', '))}</div>${myRes() ? '' : '<div class="hint">Uy egasi bilan yozishish uchun pastdan kiring.</div>'}<div class="row"><a href="${esc(r.link)}" target="_blank" rel="noopener"><button>Instagram sahifasi</button></a><button class="ghost" id="nope">Yopish</button></div>`);
    $('nope').onclick = closeModal;
  } else if (hit?.object.userData.kind === 'plot') {
    const pl = hit.object.userData.p;
    modal(`<h3>${TYPE_ICON[pl.type] || ''} ${esc(pl.name)}</h3><div>Egasi: <a href="https://instagram.com/${esc(pl.owner)}" target="_blank" rel="noopener">@${esc(pl.owner)}</a></div><div class="muted">${pl.area} m² · ${esc(pl.type)} · ${pl.status === 'sold' ? 'sotilgan' : "to'lov kutilmoqda"}</div><div class="muted">${esc([pl.mahalla, pl.street].filter(Boolean).join(', '))}</div><button class="ghost" id="nope">Yopish</button>`);
    $('nope').onclick = closeModal;
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
  try { const j = await api('/api/claim', { username: $('lu').value, password: $('lp').value }); me = { username: j.resident.username, password: $('lp').value }; store.set('me', me); await refresh(); flyTo(j.resident.x, j.resident.z); if (j.mustChange) askNewPass(); }
  catch (er) { alert(er.message); }
};
$('logout').onclick = () => { me = null; store.set('me', null); renderMe(); setMode('view'); };
$('gohome').onclick = () => { const r = myRes(); if (r) flyTo(r.x, r.z); };
$('move').onclick = () => { setMode('move'); flyTo(controls.target.x, controls.target.z, 900); };
$('buy').onclick = () => setMode('buy');
const doSearch = () => { const u = $('q').value.trim().replace(/^@/, '').toLowerCase(); const r = state.residents.find((x) => x.username === u) || state.residents.find((x) => x.username.includes(u)); if (r && u) flyTo(r.x, r.z); else alert('Topilmadi'); };
$('qbtn').onclick = doSearch; $('q').addEventListener('keydown', (e) => e.key === 'Enter' && doSearch());


// ---- CHAT ----
let chatWith = null, chatTimer = null;
const fmtT = (t) => new Date(t).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
async function loadChat(scroll) {
  if (!chatWith || !$('msgs')) return;
  const { messages } = await api('/api/chat/history', { ...me, with: chatWith });
  const box = $('msgs'), atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
  box.innerHTML = messages.map((m) => `<div class="msg ${m.from === me.username ? 'mine' : ''}">${esc(m.text)}<small>${fmtT(m.at)}</small></div>`).join('') || '<div class="muted">Hali xabar yo\'q — birinchi bo\'lib yozing!</div>';
  if (scroll || atBottom) box.scrollTop = box.scrollHeight;
}
function openChat(u) {
  chatWith = u;
  const r = state.residents.find((x) => x.username === u);
  modal(`<h3>💬 @${esc(u)}</h3><div class="muted">${esc([r?.mahalla, r?.street].filter(Boolean).join(', '))} · <a href="https://instagram.com/${esc(u)}" target="_blank" rel="noopener">Instagram</a></div>
    <div class="msgs" id="msgs"></div>
    <div class="row" style="flex-wrap:nowrap"><input id="mtext" placeholder="Xabar yozing…" maxlength="2000"><button id="msend">Yuborish</button></div>
    <div class="row"><button class="ghost" id="mback">← Xabarlar</button><button class="ghost" id="nope">Yopish</button></div>`);
  const sendIt = async () => { const t = $('mtext').value.trim(); if (!t) return; $('mtext').value = ''; try { await api('/api/chat/send', { ...me, to: u, text: t }); await loadChat(true); } catch (e) { alert(e.message); } };
  $('msend').onclick = sendIt; $('mtext').addEventListener('keydown', (e) => e.key === 'Enter' && sendIt());
  $('nope').onclick = closeModal; $('mback').onclick = openInbox;
  loadChat(true); clearInterval(chatTimer); chatTimer = setInterval(() => { if ($('modal').classList.contains('hidden')) { clearInterval(chatTimer); chatWith = null; } else loadChat(); }, 3000);
  $('mtext').focus();
}
async function openInbox() {
  chatWith = null; clearInterval(chatTimer);
  const { conversations } = await api('/api/chat/inbox', me);
  modal(`<h3>💬 Xabarlar</h3><div class="hint">Yozishish uchun xaritadagi istalgan uy ustidagi @nikni bosing.</div>
    ${conversations.map((c) => `<div class="conv" data-u="${esc(c.with)}"><b>@${esc(c.with)}</b> ${c.unread ? `<span class="count">${c.unread}</span>` : ''}<div class="muted">${esc(c.last.slice(0, 60))} · ${fmtT(c.at)}</div></div>`).join('') || '<div class="muted">Hali yozishmalar yo\'q</div>'}
    <button class="ghost" id="nope">Yopish</button>`);
  $('nope').onclick = closeModal;
  document.querySelectorAll('.conv').forEach((el) => (el.onclick = () => openChat(el.dataset.u)));
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
  if (frame++ % 15 === 0) { const t = controls.target, near = camera.position.y < 900; for (const l of streetLabels) l.visible = near && Math.hypot(l.position.x - t.x, l.position.z - t.z) < camera.position.y * 1.6; }
  renderer.render(scene, camera);
})();

// ---- Boshlash ----
(async () => {
  refresh().catch(() => {});
  const data = await loadOSM();
  if (data) { buildRoads(data); status(''); }
  else { buildRoads(fallbackGrid()); status("⚠️ OpenStreetMap ma'lumoti yuklanmadi — namunaviy to'r ko'rsatilmoqda"); }
  await refresh().catch(() => status('Server bilan aloqa yo\'q'));
  setInterval(() => mode === 'view' && refresh().catch(() => {}), 30000);
})();
