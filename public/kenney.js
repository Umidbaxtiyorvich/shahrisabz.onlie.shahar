// Kenney.nl modellari (CC0): uylar, tijorat binolari, mashinalar, daraxtlar — public/models/kenney/
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = './models/kenney/';
export const SUBURBAN = 'abcdefghijklmnopqrstu'.split('').map((c) => 'building-type-' + c);
export const COMMERCIAL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'].map((c) => 'c-building-' + c).concat(['a', 'b', 'c', 'd', 'e'].map((c) => 'c-building-skyscraper-' + c));
export const CARS = ['sedan', 'suv', 'suv-luxury', 'sedan-sports', 'hatchback-sports', 'taxi', 'van', 'police', 'ambulance', 'delivery', 'truck'].map((c) => 'car-' + c);
export const TREES = ['tree-oak', 'tree-default', 'tree-fat', 'tree-detailed', 'tree-large', 'tree-small'];
export const QTREES = ['q-tree-a', 'q-tree-b', 'q-pine', 'q-bush']; // Quaternius Stylized Nature (CC0)
// petroulacl/fps-buildings-env-kit (CC0): public/models/fps/ — tabiat, ko'cha chiroqlari, modul binolar, hovli jihozlari
const FPS = './models/fps/';
export const NATURE = ['tree-avoxahrpwe', 'tree-qvoop92wmg', 'pine-zt62gcekxz', 'grass', 'tall-grass', 'grass-wispy', 'bush', 'bush-with-flowers', 'flower-group', 'flower-single', 'plant-big', 'fern', 'clover', 'rock-medium', 'pebble-round'].map((n) => 'n-' + n);
export const MODULAR = ['house-a', 'house-b', 'house-c', 'tower-a', 'tower-b', 'tower-c', 'tower-d'].map((n) => 'm-building-sample-' + n);
export const PROPS = ['r-light-curved', 'r-light-square-double', 'r-construction-cone', 's-planter', 's-fence', 's-driveway-long', 's-path-stones-long'];
const urlOf = (name) => name.startsWith('n-') ? FPS + 'nature/' + name.slice(2) + '.glb' : name.startsWith('m-') ? FPS + 'modular/' + name.slice(2) + '.glb' : name.startsWith('r-') ? FPS + 'roads/' + name.slice(2) + '.glb' : name.startsWith('s-') ? FPS + 'suburban/' + name.slice(2) + '.glb' : BASE + name + '.glb';

const models = new Map();
const loader = new GLTFLoader();
function load(name) {
  return new Promise((ok) => loader.load(urlOf(name), (g) => {
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const mt = o.material; if (mt.map) mt.map.anisotropy = 4;
      if (name.startsWith('q-') || name.startsWith('n-')) { mt.vertexColors = false; mt.metalness = 0; mt.roughness = .9; if (mt.transparent) { mt.transparent = false; mt.alphaTest = .45; mt.side = THREE.DoubleSide; mt.depthWrite = true; } } } }); // Quaternius: barglar metall emas, shaffoflik — alphaTest
    const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3());
    models.set(name, { scene: g.scene, box, size }); ok(true);
  }, undefined, () => ok(false)));
}
// Avval shahar uchun eng kerakli modellar, keyin qolganlari
export const ready = Promise.all([...SUBURBAN, ...COMMERCIAL, ...CARS, ...TREES, ...QTREES, ...NATURE, ...MODULAR, ...PROPS].map(load)).then((r) => r.filter(Boolean).length);
export const has = (name) => models.has(name);

// Modelni nusxalab, eni (x/z bo'yicha kattasi) `width` metr bo'ladigan qilib, yerga (y=0) va markazga qo'yadi
export function place(name, width) {
  const m = models.get(name); if (!m) return null;
  const obj = m.scene.clone(true), s = width / Math.max(m.size.x, m.size.z);
  obj.scale.setScalar(s);
  const c = m.box.getCenter(new THREE.Vector3());
  obj.position.set(-c.x * s, -m.box.min.y * s, -c.z * s);
  const g = new THREE.Group(); g.add(obj); g.userData.height = m.size.y * s;
  return g;
}
// Instancing uchun: modelning barcha qismlarini (dunyo koordinatasida) material bo'yicha birlashtirib beradi
export function parts(name, width) {
  const m = models.get(name); if (!m) return null;
  const s = width / Math.max(m.size.x, m.size.z), c = m.box.getCenter(new THREE.Vector3());
  const fix = new THREE.Matrix4().makeScale(s, s, s).premultiply(new THREE.Matrix4().makeTranslation(-c.x * s, -m.box.min.y * s, -c.z * s));
  const byMat = new Map();
  m.scene.updateMatrixWorld(true);
  m.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(fix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = o.material.uuid; if (!byMat.has(key)) byMat.set(key, { material: o.material, geos: [] }); byMat.get(key).geos.push(g);
  });
  return [...byMat.values()].map(({ material, geos }) => ({ material, geometry: mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))) }));
}
// Balandligi bo'yicha (chiroq ustunlari kabi ingichka modellar uchun)
export function partsH(name, height) { const m = models.get(name); if (!m) return null; return parts(name, height * Math.max(m.size.x, m.size.z) / m.size.y); }
export const placeH = (name, height) => { const m = models.get(name); return m ? place(name, height * Math.max(m.size.x, m.size.z) / m.size.y) : null; };
