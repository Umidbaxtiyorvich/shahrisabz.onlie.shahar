// Shahrisabzning haqiqiy binolari (OpenStreetMap building=*, © OSM hissadorlari, ODbL).
// Har bir bino o'z shakli bo'yicha ko'tariladi; devorlarga qavat va derazalar (protsedural fasad), ustiga tom.
// Fasad rasmlari: github.com/YusufEminoglu/osm_3d_model (MIT, public/textures/facades/LICENSE-osm_3d_model.txt).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FLOOR = 3.2, BAY = 3.4; // qavat balandligi va deraza oralig'i (m)
// Fasad teksturasi: 1 katak = 1 qavat × 1 deraza; deraza — ramka + shisha, derazasiz joy — oq
function facadeTex(lit) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = lit ? '#000' : '#fff'; g.fillRect(0, 0, 64, 64);
  if (lit) { g.fillStyle = '#ffd27a'; g.fillRect(16, 16, 32, 34); }
  else { g.fillStyle = '#8a8f96'; g.fillRect(13, 13, 38, 40); g.fillStyle = '#5f7f9c'; g.fillRect(16, 16, 32, 34); g.fillStyle = '#9fc0dd'; g.fillRect(16, 16, 14, 34); g.fillStyle = '#d9d4ca'; g.fillRect(10, 52, 44, 4); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const TONES = [0xf1e6d2, 0xe9dcc3, 0xf4efe6, 0xdcc9a8, 0xe6d3b8, 0xd9d2c5, 0xefe3cf, 0xc9b79a, 0xf6f1ea, 0xe2cfb0];
const ROOFS = [0x8e9aa6, 0x7a6f66, 0xa45a45, 0x9b9488, 0x6f7b85, 0xb9b2a6];
const hgt = (b) => b.h || (b.lv ? b.lv * FLOOR + .6 : ({ apartments: 4, residential: 3, commercial: 2, retail: 1, school: 3, hospital: 3, office: 3, mosque: 1, public: 2, industrial: 1, garage: 1, shed: 1, house: 1, detached: 1 }[b.t] || 1) * FLOOR + 1 + (Math.abs(b.g.length * 7) % 2));

// Ko'pburchak yuzasi (soat strelkasiga qarshi bo'lishi shart emas — tekshiramiz)
const area = (p) => p.reduce((a, [x, z], i) => { const [x2, z2] = p[(i + 1) % p.length]; return a + x * z2 - x2 * z; }, 0) / 2;

// Fotofasadlar: [fayl, plitka eni (m), plitka bo'yi (m)] — past binolarga klassik, balandlarga zamonaviy
const FACADES = { low: [['facade3', 7.7, 9.6], ['facade4', 7.7, 9.6]], high: 'abcdef'.split('').map((c) => ['facade_resid_' + c, 16, 19.2]) };
const texCache = new Map();
function facadeMat(name) {
  if (texCache.has(name)) return texCache.get(name);
  const t = new THREE.TextureLoader().load('./textures/facades/' + name + '.webp'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: .8, emissive: 0xffb46b, emissiveIntensity: 0, emissiveMap: t });
  texCache.set(name, m); return m;
}
export async function loadRealCity({ scene, toXZ, glassMat, onReady }) {
  let data; try { data = await (await fetch('buildings.json')).json(); } catch { return null; }
  if (!data?.b?.length) return null;
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
  const cells = new Map(); // 400 m katakchalar — ko'rinmaydiganlari chizilmaydi
  const col = new THREE.Color();
  let n = 0;
  for (const b of data.b) {
    let pts = b.g.map(([la, lo]) => toXZ(la, lo)); if (pts.length < 3) continue;
    const A = area(pts); if (Math.abs(A) < 12) continue; if (A < 0) pts = pts.reverse();
    const H = Math.min(80, hgt(b)), floors = Math.max(1, Math.round(H / FLOOR));
    const set = floors <= 3 ? FACADES.low : FACADES.high, [fname, tw, th] = set[n % set.length];
    const tone = TONES[(n * 7) % TONES.length], roof = ROOFS[(n * 3) % ROOFS.length];
    // devorlar: har bir chekka uchun to'rtburchak, UV metrda (deraza katagiga)
    const pos = [], uv = [], cl = [], idx = []; let v = 0;
    col.setHex(0xffffff).lerp(new THREE.Color(tone), .25);
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, bz - az); if (L < .3) continue;
      const u = Math.max(.5, Math.round(L / tw * 2) / 2), vv = H / th;
      pos.push(ax, 0, az, bx, 0, bz, bx, H, bz, ax, H, az); uv.push(0, 0, u, 0, u, vv, 0, vv);
      for (let k = 0; k < 4; k++) cl.push(col.r, col.g, col.b);
      idx.push(v, v + 2, v + 1, v, v + 3, v + 2); v += 4;
    }
    if (!v) continue;
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wg.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); wg.setIndex(idx); wg.computeVertexNormals();
    // tom: tekis (biroz chekkasi bilan)
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const rg = new THREE.ShapeGeometry(shape); rg.rotateX(-Math.PI / 2); rg.translate(0, H + .05, 0);
    col.setHex(roof); const rc = []; for (let k = 0; k < rg.attributes.position.count; k++) rc.push(col.r, col.g, col.b);
    rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3)); rg.deleteAttribute('uv');
    const [cx, cz] = pts[0], key = Math.floor(cx / 400) + ',' + Math.floor(cz / 400);
    if (!cells.has(key)) cells.set(key, { w: new Map(), r: [] }); const c = cells.get(key); if (!c.w.has(fname)) c.w.set(fname, []); c.w.get(fname).push(wg); c.r.push(rg); n++;
  }
  const group = new THREE.Group();
  for (const { w, r } of cells.values()) {
    for (const [fname, geos] of w) { const wm = new THREE.Mesh(mergeGeometries(geos), facadeMat(fname)); wm.material.vertexColors = true; wm.castShadow = wm.receiveShadow = true; group.add(wm); }
    const rm = new THREE.Mesh(mergeGeometries(r), roofMat); rm.castShadow = rm.receiveShadow = true; group.add(rm);
  }
  scene.add(group);
  onReady?.(n);
  return { count: n, setNight(t) { for (const m of texCache.values()) m.emissiveIntensity = t * .35; } };
}
