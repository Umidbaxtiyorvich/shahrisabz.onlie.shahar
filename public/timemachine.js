// 🕰️ Vaqt mashinasi: 1400 (Amir Temur davri), 1900, 1970, Bugun — shahar o'sha davrdagidek: shahar devori, paxsa uylar, karvonlar, bozor, sovet binolari.
// Har davrda yashirin tarixiy buyumlar topiladi (kolleksiya). Ko'rinish badiiy qayta tiklash — tarixiy manbalarga taxminan mos.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function initTimeMachine(C) {
  const { THREE, scene, toXZ, history, monuments, ground, sky, roadMat, roadClear, ways, controls, camera, renderer, api, getMe, myRes, toast, modal, closeModal, esc, money, flyTo, markersGroup, onEra } = C;
  // Davrlar jadvali: yil oralig'i → tavsif, ko'rinish (rang), sahna sozlamalari
  const PERIODS = [
    { a: -700, b: -330, t: 'Qadimiy Kesh', f: "Kesh — So'g'diyonaning qadimiy shaharlaridan. Kichik qishloq-shahar, paxsa uylar, tuproq qo'rg'on. Yunon tarixchilari Ksenippa deb atagan bo'lishi mumkin.", css: 'sepia(.9) contrast(1.15) brightness(.9)', mud: 120, R: 380, wall: 'earth', road: 0x9c8462, mov: 'camel' },
    { a: -329, b: 699, t: "So'g'd va Kushon davri", f: "Iskandar Zulqarnayn yurishidan keyin Kesh So'g'd savdo yo'llarida kattalashdi. Karvonlar Xitoy va Hindiston tomon yo'l oladi.", css: 'sepia(.8) contrast(1.1)', mud: 300, R: 550, wall: 'mud', road: 0xa48a64, mov: 'camel' },
    { a: 700, b: 1219, t: 'Arab xalifaligi va Somoniylar', f: "VIII asrdan Kesh islom madaniyati markazlaridan biri. Shaharda masjidlar, madrasalar, bozorlar qurildi.", css: 'sepia(.65) contrast(1.08)', mud: 500, R: 750, wall: 'mud', road: 0xa88c66, mov: 'camel' },
    { a: 1220, b: 1335, t: "Mo'g'ullar davri", f: "1220-yillarda mo'g'ul bosqinidan keyin shahar vayron bo'ldi va sekin tiklandi.", css: 'sepia(.7) saturate(.7) brightness(.85)', mud: 220, R: 700, wall: 'ruin', road: 0x9a8262, mov: 'camel' },
    { a: 1336, b: 1500, t: 'Amir Temur va Temuriylar davri', f: "1336-yilda Amir Temur shu yerda tug'ildi. Kesh «Shahrisabz» — Yashil shahar deb ataldi: Oqsaroy, Dorus-Siyodat, Ko'k gumbaz qurildi.", css: 'sepia(.35) saturate(1.25) contrast(1.05)', mud: 900, R: 950, wall: 'mud', road: 0xb89a72, mov: 'camel', bazaar: 'dorutilovat' },
    { a: 1501, b: 1867, t: "Shayboniylar va Buxoro xonligi", f: "XVI asrda Chorsu bozori qurildi. 1570-yillarda Abdullaxon davrida Oqsaroy vayron qilingan, deb hikoya qilinadi.", css: 'sepia(.6) contrast(1.08)', mud: 1200, R: 1050, wall: 'mud', road: 0xae9068, mov: 'camel', bazaar: 'chorsu' },
    { a: 1868, b: 1919, t: 'Buxoro amirligi (Rossiya protektorati)', f: "Shahrisabz — Buxoro amirligining bekligi. Paxsa uylar, gumbazli bozorlar, arava va tuyalar. 1899-yilda Kitobda kenglik stansiyasi ochildi.", css: 'sepia(.85) contrast(1.1) brightness(.95)', mud: 1500, R: 1100, wall: 'mud', road: 0xa88a62, mov: 'cart', bazaar: 'chorsu' },
    { a: 1920, b: 1949, t: 'Ilk sovet yillari', f: "Shahar devori buzildi, ilk maktablar va kolxozlar tuzildi.", css: 'grayscale(.75) sepia(.3) contrast(1.1)', mud: 1300, R: 0, road: 0xa08868, mov: 'cart' },
    { a: 1950, b: 1990, t: 'Sovet davri', f: "Shahar kengaydi: besh qavatli uylar, asfalt yo'llar, avtobuslar, zavodlar. Obidalar ta'mirlana boshladi.", css: 'saturate(.65) contrast(1.08) sepia(.15)', mud: 600, soviet: 1, road: 'asphalt', mov: 'bus' },
    { a: 1991, b: 2019, t: "Mustaqillik yillari", f: "1991-yildan mustaqil O'zbekiston. 1996-yilda Amir Temur haykali o'rnatildi, 2000-yilda tarixiy markaz UNESCO ro'yxatiga kirdi, 2002-yilda shaharning 2700 yilligi nishonlandi.", css: 'saturate(.85) contrast(1.03)', mud: 300, soviet: 1, road: 'asphalt', mov: 'bus' },
    { a: 2020, b: 2029, t: 'Bugun', f: '', css: '', now: 1 },
    { a: 2030, b: 2150, t: 'Kelajak', f: "Bu — xayoliy kelajak: shisha osmono'parlar, quyosh panellari, uchar mashinalar va yanada yashil Shahrisabz. Qanday bo'lishini siz ham orzu qiling!", css: 'saturate(1.2) contrast(1.05) hue-rotate(-8deg)', now: 1, future: 1 },
  ];
  const BUILT = { dorutilovat: 1373, dorussiyodat: 1376, oqsaroy: 1380, kokgumbaz: 1435, chorsu: 1550, kitob: 1899, temur: 1996 };
  const periodOf = (y) => PERIODS.find((p) => y >= p.a && y <= p.b) || PERIODS[PERIODS.length - 1];
  const monsFor = (y) => Object.keys(BUILT).filter((k) => y >= BUILT[k]);
  // Har davrdagi yashirin buyumlar (obidaga nisbatan joylashuv, metr)
  const ITEMS = [
    ['e1400a', 1400, 'oqsaroy', 30, 25, "🧱 Oqsaroy g'ishti", "Oqsaroy peshtoqiga «Agar qudratimizga shubhang bo'lsa — biz qurgan binolarga boq» degan so'zlar yozilgani rivoyat qilinadi."],
    ['e1400b', 1400, 'dorussiyodat', -28, 10, '📜 Temur farmoni', "Amir Temur Keshni «qubbat ul-ilm val-adab» — ilm va adab gumbazi deb atagan."],
    ['e1400c', 1400, 'dorutilovat', 25, -20, '🐪 Karvon qo\'ng\'irog\'i', "Kesh Samarqand bilan Termiz va Hindistonni bog'lagan karvon yo'lida joylashgan."],
    ['e1900a', 1900, 'chorsu', 24, 18, '🧵 Shahrisabz kashtasi', "Shahrisabz kashtachiligi — o'zbek kashtasining eng mashhur maktablaridan biri."],
    ['e1900b', 1900, 'kitob', 20, 15, '🔭 Kenglik stansiyasi kundaligi', "Kitob stansiyasi 1899-yilda Yerning qutblari harakatini o'rganish uchun ochilgan."],
    ['e1900c', 1900, 'dorutilovat', -26, 18, "🏺 Kulol ko'zasi", "Shamsiddin Kulol — Amir Temur otasining piri bo'lgan shayx; uning nomi «kulol» — kulolchilikdan."],
    ['e1970a', 1970, 'temur', 26, -10, '🚌 Shahar avtobusi', "Sovet davrida Shahrisabz ip-gazlama va konserva zavodlari bilan sanoat shahriga aylandi."],
    ['e1970b', 1970, 'kokgumbaz', -30, 26, '🎬 Kinoteatr chiptasi', "1970-yillarda obidalarni ta'mirlash ishlari boshlangan."],
    ['e1970c', 1970, 'oqsaroy', -32, -24, '📻 Radio', "Shahrisabz 2002-yilda o'zining 2700 yillik yubileyini nishonlagan."],
    ['e0500a', 500, 'unesco', 40, 30, "🪙 So'g'd tangasi", "So'g'd savdogarlari Buyuk ipak yo'lining eng mashhur savdogarlari bo'lgan; ularning tili savdo tili edi."],
    ['e2100a', 2100, 'unesco', -40, 35, '🚀 Kelajak kapsulasi', "Xayoliy kelajak: bu kapsulaga bugungi shahrisabzliklar kelajak avlodga xat qoldirgan, deb tasavvur qiling!"],
    ['e2100b', 2100, 'kokgumbaz', 35, -30, '🤖 Robot-gid', "Xayoliy kelajak: robot-gid sayyohlarga Ko'k gumbaz tarixini 100 tilda aytib beradi."],
  ];
  const itemYear = { 1400: [1336, 1500], 1900: [1868, 1919], 1970: [1950, 1990], 500: [-329, 699], 2100: [2030, 2150] };
  let year = new Date().getFullYear(), sig = 'now', eraGroup = null, got = {}, saved = null, anim = [], items = [], deb = 0;
  const keep = new Set([ground, sky]);
  const isKeep = (o) => keep.has(o) || o === eraGroup || o === monuments || o === markersGroup || o.isLight || o.isSprite || o.isPoints || o.type === 'DirectionalLight' || (o.isMesh && o.material === roadMat);

  // ---- UI: vaqt slayderi (har qanday yil: mil. avv. 700 — 2150) ----
  const yName = (y) => (y < 0 ? `mil. avv. ${-y}` : String(y));
  const bar = document.createElement('div'); bar.className = 'tmbar card';
  bar.innerHTML = `<span class="tmt">🕰️</span><div class="tmmid"><div class="tmtop"><b id="tmy"></b><span id="tmp" class="muted"></span></div><input type="range" id="tmr" min="-700" max="2150" step="10"><div class="tmq">${[[-700, 'Qadim'], [1000, '1000'], [1400, '1400'], [1600, '1600'], [1900, '1900'], [1970, '1970'], [year, 'Bugun'], [2050, '2050'], [2120, '2120']].map(([v, t]) => `<button class="ghost" data-y="${v}">${t}</button>`).join('')}</div></div><button class="ghost" id="tminfo" title="Davr haqida">ℹ️</button>`;
  document.body.appendChild(bar);
  const rng = bar.querySelector('#tmr'); rng.value = year;
  const showY = (y) => { const P = periodOf(y); bar.querySelector('#tmy').textContent = yName(y) + '-yil'; bar.querySelector('#tmp').textContent = ' · ' + P.t; bar.classList.toggle('past', !P.now); bar.classList.toggle('fut', !!P.future); };
  rng.oninput = () => { const y = +rng.value; showY(y); clearTimeout(deb); deb = setTimeout(() => setYear(y), 350); };
  bar.querySelectorAll('[data-y]').forEach((b) => (b.onclick = () => { rng.value = b.dataset.y; showY(+b.dataset.y); setYear(+b.dataset.y, true); }));
  bar.querySelector('#tminfo').onclick = () => openInfo(); showY(year);
  // ---- Davr sahnasi ----
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .95, ...o });
  const MUD = M(0xc8a77c), MUD2 = M(0xb8956a), ROOF = M(0x9c7b55), WALL = M(0xb08a5c), TENT = [M(0xb8322f), M(0x2f6bb8), M(0xd8a33a), M(0x3f8f3a)], CAMEL = M(0xc09a64), WOOD = M(0x6b4a2b), SOV = M(0xe4ddd0), SOVW = M(0x5f7f9c, { roughness: .3, metalness: .3 }), GREEN = M(0x3f7f35);
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const at = (k, dx = 0, dz = 0) => { const h = history[k]; if (!h) return null; const [x, z] = toXZ(h.lat, h.lon); return [x + dx, z + dz]; };
  const free = (x, z, r = 8) => roadClear(x, z) > r && !Object.keys(history).some((k) => { const p = at(k); return p && Math.hypot(p[0] - x, p[1] - z) < 75; });
  function instanced(geo, mat, list) { const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
    list.forEach(([x, z, sx, sy, sz, r], i) => { m.compose(p.set(x, 0, z), q.setFromAxisAngle(Y, r || 0), s.set(sx, sy, sz)); im.setMatrixAt(i, m); }); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; return im; }
  const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  // ---- Batafsil modellar (bir marta yasalib, minglab nusxada chiziladi) ----
  const col = new THREE.Color();
  function kit(parts) { // [w,h,d, x,y,z, rang, burilish?] — rangli qutilardan bitta geometriya
    return mergeGeometries(parts.map(([w, h, d, x, y, z, c, ry = 0]) => { const b = new THREE.BoxGeometry(w, h, d); if (ry) b.rotateY(ry); b.translate(x, y + h / 2, z); col.setHex(c);
      const n = b.attributes.position.count, cl = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const k = .92 + ((i * 7) % 5) * .02; cl[i * 3] = col.r * k; cl[i * 3 + 1] = col.g * k; cl[i * 3 + 2] = col.b * k; } b.setAttribute('color', new THREE.BufferAttribute(cl, 3)); b.deleteAttribute('uv'); return b; }));
  }
  const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
  // Paxsa hovli (O'zbek an'anaviy uyi): xona, ustunli ayvon, to'sinli tekis tom, eshik-derazalar, hovli devori, darvoza, tandir
  const MUDC = 0xc6a57a, MUDD = 0xb08c60, ROOFC = 0x8f7352, WOODC = 0x6b4a2b, DOORC = 0x4a3020, WINC = 0x2b2522, DUVC = 0xc9ab82;
  const houseParts = (wing) => { const P = [
    [10, 3.4, 5, 0, 0, -3.5, MUDC], [10.8, .35, 5.8, 0, 3.4, -3.5, ROOFC], // xona va tom
    [10, .4, 3.4, 0, 0, .7, 0xb39a78], [10.8, .3, 3.8, 0, 3.1, .9, ROOFC], // supa va ayvon tomi
    [1.2, 2.1, .12, -1.5, .4, -.95, DOORC], [1.2, 2.1, .12, 2.2, .4, -.95, DOORC], [.8, .7, .12, -3.8, 1.5, -.95, WINC], [.8, .7, .12, 4.2, 1.5, -.95, WINC],
    ...[-4.6, -1.6, 1.6, 4.6].map((x) => [.28, 2.7, .28, x, .4, 2.3, WOODC]), // ayvon ustunlari
    ...[-4, -2, 0, 2, 4].map((x) => [.22, .22, .9, x, 3.45, -.6, WOODC]), // chiqib turgan to'sinlar
    [16, 2.2, .5, 0, 0, -8, DUVC], [.5, 2.2, 16, -8, 0, 0, DUVC], [.5, 2.2, 16, 8, 0, 0, DUVC], [6, 2.2, .5, -5, 0, 8, DUVC], [6, 2.2, .5, 5, 0, 8, DUVC], // hovli devori
    [4, 2.4, .2, 0, 0, 8, WOODC], [4.6, .4, .7, 0, 2.4, 8, ROOFC], // darvoza
    [1.4, 1, 1.4, 5.5, 0, 4.5, 0xa0805a], [1, .3, 1, 5.5, 1, 4.5, 0x7a6048], // tandir
    [3, .15, 2, -5, 0, 5, 0x6f8f4a], // poliz / gulzor
  ]; if (wing) P.push([4.5, 3.2, 6, -5.5, 0, 2, MUDD], [5.1, .35, 6.6, -5.5, 3.2, 2, ROOFC], [1, 2, .12, -3.2, .3, 2, DOORC]); return P; };
  let HG = null; const houseGeos = () => HG ||= [kit(houseParts(false)), kit(houseParts(true))];
  const treeTrunk = new THREE.CylinderGeometry(.25, .35, 3, 6).translate(0, 1.5, 0), treeCrown = new THREE.IcosahedronGeometry(2.4, 1).translate(0, 4.4, 0);
  function mudCity(g, n, R, scale = 1) {
    const L = [[], []], trees = []; let tries = 0;
    while (L[0].length + L[1].length < n && tries++ < n * 8) { const ang = rnd() * 6.283, d = Math.sqrt(rnd()) * R, x = Math.cos(ang) * d, z = Math.sin(ang) * d; if (!free(x, z, 10)) continue;
      const k = (.85 + rnd() * .3) * scale, r = Math.round(rnd() * 4) * Math.PI / 2; L[rnd() < .4 ? 1 : 0].push([x, z, k, k * (.9 + rnd() * .2), k, r]); if (rnd() < .6) trees.push([x + Math.cos(r) * 4 - Math.sin(r) * 4, z + Math.sin(r) * 4 + Math.cos(r) * 4, 1, .9 + rnd() * .4, 1, 0]); }
    const [g0, g1] = houseGeos(); g.add(instanced(g0, VC, L[0]), instanced(g1, VC, L[1]));
    g.add(instanced(treeTrunk, WOOD, trees), instanced(treeCrown, GREEN, trees)); // tut va o'rik daraxtlari
  }
  // Tuproq yo'l teksturasi
  const dirtTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#b39670'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 45},${45 + Math.random() * 30},${.25 + Math.random() * .4})`; x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    x.strokeStyle = 'rgba(110,85,55,.35)'; x.lineWidth = 3; for (const y of [40, 88]) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y + 3); x.stroke(); } // g'ildirak izlari
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  function cityWall(g, R, kind = 'mud') { // qal'a devori, burjlar va 4 darvoza (qadimda — tuproq qo'rg'on, mo'g'ullardan keyin — xaroba)
    const segs = 72, list = [], towers = [], hk = kind === 'earth' ? .55 : kind === 'ruin' ? .7 : 1;
    for (let i = 0; i < segs; i++) { const a0 = i / segs * 6.283, a1 = (i + 1) / segs * 6.283; if ([0, 18, 36, 54].includes(i) || (kind === 'ruin' && rnd() < .4)) continue; const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R, L = Math.hypot(x1 - x0, z1 - z0);
      list.push([(x0 + x1) / 2, (z0 + z1) / 2, L + .5, 9 * hk * (kind === 'ruin' ? .5 + rnd() * .6 : 1), kind === 'earth' ? 8 : 3.5, -Math.atan2(z1 - z0, x1 - x0)]); if (kind !== 'earth') towers.push([x0, z0, 1, hk, 1, 0]); }
    g.add(instanced(unitBox, kind === 'earth' ? MUD2 : WALL, list)); if (towers.length) g.add(instanced(new THREE.CylinderGeometry(3.6, 4.4, 13, 12).translate(0, 6.5, 0), WALL, towers));
    if (kind === 'mud') { const mer = []; for (let a = 0; a < 6.283; a += 3.2 / R) { const i = Math.floor(a / 6.283 * segs); if ([0, 18, 36, 54].includes(i)) continue; mer.push([Math.cos(a) * R, Math.sin(a) * R, 1, 1, 1, -a]); } // devor tishlari
      g.add(instanced(new THREE.BoxGeometry(1.6, 1.6, 3.6).translate(0, 9.8, 0), WALL, mer)); }
    if (kind === 'earth') return; for (const i of [0, 18, 36, 54]) { const a = (i + .5) / segs * 6.283, gt = new THREE.Group(); gt.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); gt.rotation.y = -a + Math.PI / 2;
      for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 17, 14), WALL); t.position.set(sx * 9, 8.5, 0); t.castShadow = true; gt.add(t); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 7), WALL); top.position.y = 13; gt.add(top); g.add(gt); }
  }
  function bazaar(g, k) { const p = at(k, -55, 0); if (!p) return; const list = TENT.map(() => []);
    for (let i = 0; i < 40; i++) { const x = p[0] + (i % 8) * 7 - 25, z = p[1] + Math.floor(i / 8) * 8 - 18; list[i % 4].push([x, z, 5, 3.2, 5, 0]); }
    const tg = new THREE.ConeGeometry(.75, 1, 4).rotateY(Math.PI / 4).translate(0, 1.6, 0); list.forEach((l, i) => g.add(instanced(tg, TENT[i], l)));
    g.add(instanced(new THREE.CylinderGeometry(.06, .06, 1.6, 4).translate(0, .8, 0), WOOD, list.flat().map(([x, z]) => [x, z, 1, 1, 1, 0]))); }
  function camel() { const c = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, .9), CAMEL); b.position.y = 2.1; c.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(.55, 10, 8), CAMEL); h.position.set(0, 2.7, 0); h.scale.y = .8; c.add(h);
    const n = new THREE.Mesh(new THREE.BoxGeometry(.35, 1.4, .35), CAMEL); n.position.set(1.35, 2.7, 0); n.rotation.z = -.5; c.add(n); const hd = new THREE.Mesh(new THREE.BoxGeometry(.7, .35, .35), CAMEL); hd.position.set(1.8, 3.35, 0); c.add(hd);
    for (const [x, z] of [[-.9, -.3], [-.9, .3], [.9, -.3], [.9, .3]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.2, 1.7, .2), CAMEL); l.position.set(x, .85, z); c.add(l); }
    const load = new THREE.Mesh(new THREE.BoxGeometry(1.2, .7, 1.4), TENT[Math.floor(rnd() * 4)]); load.position.set(-.4, 3, 0); c.add(load); c.traverse((o) => (o.castShadow = true)); return c; }
  function cart() { const c = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, .5, 1.5), WOOD); b.position.y = 1.4; c.add(b);
    for (const z of [-.95, .95]) { const w = new THREE.Mesh(new THREE.TorusGeometry(1.1, .1, 6, 16), WOOD); w.position.set(-.3, 1.1, z); c.add(w); }
    const horse = new THREE.Mesh(new THREE.BoxGeometry(1.8, .8, .6), M(0x4a3122)); horse.position.set(2.4, 1.6, 0); c.add(horse); c.traverse((o) => (o.castShadow = true)); return c; }
  function bus() { const c = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 2.4), M(0xd8b13a, { roughness: .5 })); b.position.y = 1.8; c.add(b);
    const w = new THREE.Mesh(new THREE.BoxGeometry(7.2, .8, 2.45), SOVW); w.position.y = 2.4; c.add(w); c.traverse((o) => (o.castShadow = true)); return c; }
  function movers(g, make, n, speed) { // yo'llar bo'ylab yuruvchilar (karvon / arava / avtobus)
    const long = ways.filter((w) => w.pts.length > 1).map((w) => ({ w, L: w.pts.reduce((a, p, i) => i ? a + Math.hypot(p[0] - w.pts[i - 1][0], p[1] - w.pts[i - 1][1]) : 0, 0) })).filter((x) => x.L > 300).sort((a, b) => Math.hypot(...a.w.pts[0]) - Math.hypot(...b.w.pts[0])).slice(0, n);
    for (const { w, L } of long) { const train = []; const k = make === camel ? 6 : 1; for (let i = 0; i < k; i++) { const o = make(); g.add(o); train.push(o); } anim.push({ pts: w.pts, L, t: rnd() * L, train, speed, gap: make === camel ? 4 : 0 }); }
  }
  function moveAll(dt) { for (const a of anim) { if (a.fly) { a.a += a.sp * dt; a.fly.position.set(Math.cos(a.a) * a.R, a.h, Math.sin(a.a) * a.R); a.fly.rotation.y = -a.a + (a.sp > 0 ? -Math.PI / 2 : Math.PI / 2); continue; } a.t = (a.t + a.speed * dt) % a.L; a.train.forEach((o, i) => { let d = (a.t - i * a.gap + a.L) % a.L; for (let j = 1; j < a.pts.length; j++) { const [x0, z0] = a.pts[j - 1], [x1, z1] = a.pts[j], l = Math.hypot(x1 - x0, z1 - z0); if (d <= l) { const f = d / l; o.position.set(x0 + (x1 - x0) * f, 0, z0 + (z1 - z0) * f); o.rotation.y = -Math.atan2(z1 - z0, x1 - x0); break; } d -= l; } }); } }
  function oqsaroyFull(g) { const p = at('oqsaroy'); if (!p) return; const o = new THREE.Group(); o.position.set(p[0], 0, p[1]); g.add(o); // butun peshtoq: ravoq tepasi, hovli, orqa gumbazli zal
    const tile = monuments?.children.find((c) => c.userData.hist === 'oqsaroy')?.children.find((c) => c.isGroup)?.children[0]?.material || M(0x1f5fa8);
    const top = new THREE.Mesh(new THREE.BoxGeometry(44, 14, 14), tile); top.position.set(0, 45, 0); o.add(top);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(11, 2.2, 8, 24, Math.PI), M(0xd9a640, { metalness: .6, roughness: .3 })); arch.position.set(0, 26, 7.2); o.add(arch);
    for (const [w, d, x, z] of [[100, 4, 0, -60], [4, 70, -50, -25], [4, 70, 50, -25]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 16, d), tile); m.position.set(x, 8, z); m.castShadow = true; o.add(m); }
    const dm = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 16, 0, 6.283, 0, Math.PI / 2), M(0x1f9fb8, { roughness: .35 })); dm.position.set(0, 22, -55); o.add(dm); const dr = new THREE.Mesh(new THREE.BoxGeometry(34, 22, 26), WALL); dr.position.set(0, 11, -55); o.add(dr);
    o.traverse((x) => (x.castShadow = true)); }
  // Sovet "xrushchyovka" uyi: 5 qavat, 4 podyezd, balkonlar, derazalar, tom parapeti
  let SG = null;
  function sovietGeo() { if (SG) return SG; const P = [[60, 15, 12, 0, 0, 0, 0xe2dbcd], [60.6, .7, 12.6, 0, 15, 0, 0x9a948a], [60, 1, 12.2, 0, 0, 0, 0xb8b0a2]];
    for (let f = 0; f < 5; f++) for (let i = 0; i < 12; i++) { const x = -27.5 + i * 5, y = 1.6 + f * 2.8; P.push([2.2, 1.5, .1, x, y, 6.02, 0x55708a], [2.2, 1.5, .1, x, y, -6.02, 0x55708a]); if (i % 3 === 1) P.push([3.4, .15, 1.2, x, y - .5, 6.6, 0xcfc7b8], [3.4, .9, .1, x, y - .35, 7.2, 0xbfb6a6]); }
    for (let e = 0; e < 4; e++) { const x = -22.5 + e * 15; P.push([2, 2.4, .1, x, 1, 6.05, 0x5a4535], [3, .2, 1.6, x, 3.5, 6.8, 0x9a948a]); }
    return SG = kit(P); }
  function sovietBlocks(g, n) { const list = []; let tries = 0;
    for (const w of ways) { if (list.length >= n) break; for (let i = 1; i < w.pts.length && list.length < n; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 80) continue; const ux = (bx - ax) / L, uz = (bz - az) / L, rot = -Math.atan2(uz, ux);
      for (let t = 40; t < L - 40 && list.length < n; t += 75) { const sd = rnd() < .5 ? 1 : -1, off = (w.wd || 6) / 2 + 14, x = ax + ux * t - uz * off * sd, z = az + uz * t + ux * off * sd;
        if (Math.hypot(x, z) > 2200 || Math.hypot(x, z) < 250 || !free(x, z, 12) || list.some((q) => Math.hypot(q[0] - x, q[1] - z) < 55) || tries++ > n * 40) continue; list.push([x, z, 1, 1, 1, rot + (sd < 0 ? Math.PI : 0)]); } } }
    g.add(instanced(sovietGeo(), VC, list)); }
  function placeItems(g, y) { items = [];
    for (const [id, ie, k, dx, dz, n] of ITEMS) { const w = itemYear[ie]; if (!w || y < w[0] || y > w[1]) continue; const p = at(k, dx, dz); if (!p) continue;
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,230,140,1)'); gr.addColorStop(1, 'rgba(255,200,60,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); x.font = '64px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n.split(' ')[0], 64, 68);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: got[id] ? .35 : 1 })); sp.scale.setScalar(9); sp.position.set(p[0], 6, p[1]); sp.userData.eraItem = id; g.add(sp); items.push(sp); } }
  // Kelajak: shisha osmono'parlar (kechasi yonadi), quyosh panelli tomlar, uchar mashinalar
  // Kelajak: ko'chalar bo'ylab tartibli shisha osmono'parlar (kechasi derazalari yonadi), uchar mashinalar
  const glassTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#20384f'; x.fillRect(0, 0, 64, 128);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 4; i++) { x.fillStyle = Math.random() < .55 ? '#9fd4f0' : '#5f9cc4'; x.fillRect(2 + i * 16, 2 + j * 8, 13, 5); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  function future(g, y) { const k = Math.min(1, (y - 2030) / 100), maxN = Math.round(40 + k * 160), R = 700 + k * 1500, list = [];
    const segs = []; for (const w of ways) for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L > 40 && Math.hypot((ax + bx) / 2, (az + bz) / 2) < R) segs.push([ax, az, bx, bz, L, (w.wd || 6) / 2]); }
    segs.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    for (const [ax, az, bx, bz, L, hw] of segs) { if (list.length >= maxN) break; const ux = (bx - ax) / L, uz = (bz - az) / L, rot = -Math.atan2(uz, ux);
      for (let t = 30; t < L - 30 && list.length < maxN; t += 70) for (const sd of [1, -1]) { const off = hw + 26, x = ax + ux * t - uz * off * sd, z = az + uz * t + ux * off * sd;
        if (Math.hypot(x, z) < 140 || !free(x, z, 20) || list.some((q) => Math.hypot(q[0] - x, q[1] - z) < 48)) continue;
        const w = 22 + rnd() * 10, h = 40 + rnd() * (60 + k * 160) * (1 - Math.min(.7, Math.hypot(x, z) / R * .7)); list.push([x, z, w, h, w * (.7 + rnd() * .3), rot]); } }
    const mat = new THREE.MeshStandardMaterial({ map: glassTex, metalness: .6, roughness: .15, emissive: 0xffd9a0, emissiveMap: glassTex, emissiveIntensity: .25 });
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 6);
    g.add(instanced(geo, mat, list));
    g.add(instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: 0x2a3a48, metalness: .5, roughness: .4 }), list.map(([x, z, w, h, d, r]) => [x, z, w * .7, h + 4, d * .7, r]))); // tomdagi texnik qavat
    const garden = list.filter((_, i) => i % 3 === 0).map(([x, z, w, h, d, r]) => [x, z, w * .9, h + 4.6, d * .9, r]); g.add(instanced(new THREE.BoxGeometry(1, .02, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: 0x4f9f3a }), garden)); // tom bog'lari
    const fl = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .7, roughness: .2, emissive: 0x7fe0ff, emissiveIntensity: .6 });
    for (let i = 0; i < 30; i++) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 3, 4, 8), fl); c.rotation.z = Math.PI / 2; const o = new THREE.Group(); o.add(c); g.add(o); anim.push({ fly: o, R: 200 + rnd() * R, h: 50 + rnd() * 90, sp: (rnd() < .5 ? -1 : 1) * (.04 + rnd() * .06), a: rnd() * 6.283 }); } }
  function oqState(y) { return y < 1380 ? 'none' : y < 1404 ? 'build' : y <= 1570 ? 'full' : 'ruin'; }
  function build(P, y) {
    if (eraGroup) { scene.remove(eraGroup); eraGroup.traverse((o) => { o.geometry?.dispose?.(); }); } anim = []; eraGroup = new THREE.Group(); eraGroup.name = 'era';
    if (P.wall) cityWall(eraGroup, P.R, P.wall);
    if (P.mud) mudCity(eraGroup, P.mud, P.R ? P.R * .95 : 1300);
    if (oqState(y) === 'full') oqsaroyFull(eraGroup);
    if (P.bazaar) bazaar(eraGroup, P.bazaar);
    if (P.soviet) sovietBlocks(eraGroup, Math.round(Math.min(200, 30 + (y - 1950) * 3)));
    if (P.mov === 'camel') movers(eraGroup, camel, y < 0 ? 2 : 5, 3); if (P.mov === 'cart') { movers(eraGroup, cart, 10, 5); movers(eraGroup, camel, 2, 3); } if (P.mov === 'bus') movers(eraGroup, bus, 12, 11);
    if (P.future) future(eraGroup, y);
    placeItems(eraGroup, y); scene.add(eraGroup);
  }
  function applyVisibility() { const P = periodOf(year); const ms = monsFor(year);
    monuments?.children.forEach((c) => (c.visible = ms.includes(c.userData.hist)));
    if (P.now) return; for (const o of scene.children) if (!isKeep(o) || (P.a < 1336 && o.isMesh && o.material === roadMat)) o.visible = false; } // yangi qo'shilganlar ham yashiriladi
  function setYear(y, fly) {
    year = y; const P = periodOf(y), ms = monsFor(y);
    const nsig = P.now && !P.future ? 'now' : `${P.a}|${ms.join()}|${oqState(y)}|${P.soviet ? Math.round(y / 10) : ''}|${P.future ? Math.round(y / 20) : ''}`;
    if (nsig === sig) return; sig = nsig;
    if (!saved && !P.now) { saved = new Map(); for (const o of scene.children) saved.set(o, o.visible); saved.road = { c: roadMat.color.clone(), map: roadMat.map }; }
    if (P.now && saved) { for (const [o, v] of saved) o.visible = v; for (const o of scene.children) if (!saved.has(o)) o.visible = true; roadMat.color.copy(saved.road.c); roadMat.map = saved.road.map; roadMat.needsUpdate = true; saved = null; }
    if (!P.now) { if (P.road === 'asphalt') { roadMat.color.copy((saved?.road || { c: roadMat.color }).c).multiplyScalar(.85); roadMat.map = saved?.road.map; } else { roadMat.color.setHex(0xffffff).lerp(new THREE.Color(P.road), .15); roadMat.map = dirtTex; dirtTex.repeat.copy(saved?.road.map?.repeat || new THREE.Vector2(1, 1)); } roadMat.needsUpdate = true; }
    if (P.now && !P.future) { if (eraGroup) { scene.remove(eraGroup); eraGroup = null; } anim = []; items = []; } else build(P, y);
    if (!P.now && P.a >= 1336) for (const o of scene.children) if (o.isMesh && o.material === roadMat) o.visible = true;
    applyVisibility(); renderer.domElement.style.filter = P.css; onEra?.(P.now ? 'now' : 'past');
    if (fly && Math.hypot(controls.target.x, controls.target.z) > 2500) flyTo(0, 0, 900);
    toast(`🕰️ ${yName(y)}-yil · ${P.t}`);
  }
  setInterval(applyVisibility, 1000);
  let last = performance.now(); (function loop() { requestAnimationFrame(loop); const n = performance.now(), dt = Math.min(.1, (n - last) / 1000); last = n; if (anim.length) moveAll(dt); const s = 9 + Math.sin(n / 300) * 1.2; for (const it of items) it.scale.setScalar(s); })();

  async function loadGot() { if (!myRes()) return; try { got = (await api('/api/fun/era', { ...getMe(), list: 1 })).got || {}; } catch {} }
  function openInfo() {
    const P = periodOf(year), list = ITEMS.filter((i) => { const w = itemYear[i[1]]; return w && year >= w[0] && year <= w[1]; }), all = ITEMS.filter((i) => got[i[0]]).length;
    const ms = monsFor(year).map((k) => history[k]?.n).filter(Boolean), oq = oqState(year);
    modal(`<h3>🕰️ ${esc(yName(year))}-yil · ${esc(P.t)}</h3>${P.f ? `<div class="hcard got"><div>${esc(P.f)}</div></div>` : '<div class="muted">Yuqoridagi slayderni surib istalgan yilni tanlang — mil. avv. 700-yildan 2150-yilgacha.</div>'}
      <div class="muted">🏛️ Bu yilda turgan obidalar: ${ms.length ? ms.map(esc).join(', ') : 'hali hech biri qurilmagan'}${oq === 'build' ? ' · Oqsaroy qurilmoqda' : oq === 'full' ? ' · Oqsaroy to\'liq holda' : oq === 'ruin' ? ' · Oqsaroy xaroba' : ''}</div>
      ${list.length ? `<b>🔍 Shu davrda yashiringan buyumlar</b>${list.map(([id, , k, , , n]) => `<div class="hcard ${got[id] ? 'got' : ''}"><div><b>${got[id] ? '✅' : '❔'} ${esc(n)}</b><div class="muted">${got[id] ? 'Topildi' : `«${esc(history[k]?.n || k)}» atrofida — xaritada yaltirab turadi`}</div></div><button class="ghost" data-tgo="${k}">📍</button></div>`).join('')}` : '<div class="muted">Bu yilda yashirin buyum yo\'q. Davrlar: mil. avv. 329–699, 1336–1500, 1868–1919, 1950–1990, 2030–2150.</div>'}
      <div class="muted">Kolleksiya: ${all}/${ITEMS.length} · har biri +300, hammasi uchun +5 000. Ko'rinish — badiiy qayta tiklash.</div><button class="ghost" id="nope">Yopish</button>`);
    $('nope').onclick = closeModal; document.querySelectorAll('[data-tgo]').forEach((b) => (b.onclick = () => { const p = at(b.dataset.tgo); closeModal(); if (p) flyTo(p[0], p[1], 110); }));
  }
  const $ = (id) => document.getElementById(id);
  const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
  function click(e) { if (!items.length) return false; mv.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mv, camera);
    const hit = ray.intersectObjects(items, false)[0]; if (!hit) return false; claim(hit); return true; }
  async function claim(hit) { const id = hit.object.userData.eraItem, it = ITEMS.find((i) => i[0] === id);
    if (!myRes()) return alert('Topilmani yig\'ish uchun saytga kiring');
    if (got[id]) { modal(`<h3>${esc(it[5])}</h3><div class="hcard got"><div>${esc(it[6])}</div></div><button class="ghost" id="nope">Yopish</button>`); $('nope').onclick = closeModal; return; }
    try { const j = await api('/api/fun/era', { ...getMe(), item: id }); got = j.got; hit.object.material.opacity = .35; C.setBalance?.(j.balance);
      modal(`<h3>🎉 Topildi: ${esc(it[5])}</h3><div class="hcard got"><div>${esc(it[6])}</div></div><div class="cgoal"><div>+${money(j.reward)}</div>${j.all ? '<b>🏆 Vaqt sayohatchisi — to\'liq kolleksiya!</b>' : ''}</div><button class="ok" id="nope">Davom etish</button>`); $('nope').onclick = closeModal;
    } catch (er) { alert(er.message); } }
  loadGot();
  return { setYear, click, year: () => year, items: ITEMS };
}
