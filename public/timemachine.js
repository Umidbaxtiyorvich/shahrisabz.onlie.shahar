// 🕰️ Vaqt mashinasi: 1400 (Amir Temur davri), 1900, 1970, Bugun — shahar o'sha davrdagidek: shahar devori, paxsa uylar, karvonlar, bozor, sovet binolari.
// Har davrda yashirin tarixiy buyumlar topiladi (kolleksiya). Ko'rinish badiiy qayta tiklash — tarixiy manbalarga taxminan mos.
export function initTimeMachine(C) {
  const { THREE, scene, toXZ, history, monuments, ground, sky, roadMat, roadClear, ways, controls, camera, renderer, api, getMe, myRes, toast, modal, closeModal, esc, money, flyTo, markersGroup, onEra } = C;
  const ERAS = {
    1400: { t: '1400 · Amir Temur davri', f: "Kesh (Shahrisabz) — Amir Temurning ona shahri. Oqsaroy qurilmoqda, shahar qal'a devori bilan o'ralgan, Buyuk ipak yo'lidan karvonlar o'tadi.", css: 'sepia(.35) saturate(1.25) contrast(1.05)', mon: ['oqsaroy', 'dorussiyodat', 'dorutilovat'] },
    1900: { t: '1900 · Buxoro amirligi davri', f: "Shahrisabz — Buxoro amirligining bekligi. Paxsa uylar, gumbazli bozorlar, arava va tuyalar. Oqsaroy allaqachon xaroba, Kitobda kenglik stansiyasi yangi ochilgan.", css: 'sepia(.85) contrast(1.1) brightness(.95)', mon: ['oqsaroy', 'dorussiyodat', 'dorutilovat', 'kokgumbaz', 'chorsu', 'kitob'] },
    1970: { t: '1970 · Sovet davri', f: "Shahar kengaydi: besh qavatli uylar, asfalt yo'llar, avtobus va «Volga»lar. Tarixiy obidalar ta'mirlanmoqda.", css: 'saturate(.65) contrast(1.08) sepia(.15)', mon: ['oqsaroy', 'dorussiyodat', 'dorutilovat', 'kokgumbaz', 'chorsu', 'kitob'] },
    now: { t: 'Bugun', f: '', css: '', mon: null },
  };
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
  ];
  let era = 'now', eraGroup = null, got = {}, saved = null, anim = [], items = [];
  const keep = new Set([ground, sky]);
  const isKeep = (o) => keep.has(o) || o === eraGroup || o === monuments || o === markersGroup || o.isLight || o.isSprite || o.isPoints || o.type === 'DirectionalLight' || (o.isMesh && o.material === roadMat);

  // ---- UI: vaqt slayderi ----
  const bar = document.createElement('div'); bar.className = 'tmbar card'; bar.innerHTML = `<span class="tmt">🕰️</span>${['1400', '1900', '1970', 'now'].map((k) => `<button class="ghost" data-era="${k}">${k === 'now' ? 'Bugun' : k}</button>`).join('')}<button class="ghost" id="tminfo" title="Davr haqida">ℹ️</button>`;
  document.body.appendChild(bar);
  bar.querySelectorAll('[data-era]').forEach((b) => (b.onclick = () => setEra(b.dataset.era)));
  bar.querySelector('#tminfo').onclick = () => openInfo();
  const paint = () => bar.querySelectorAll('[data-era]').forEach((b) => b.classList.toggle('on', b.dataset.era === era));

  // ---- Davr sahnasi ----
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .95, ...o });
  const MUD = M(0xc8a77c), MUD2 = M(0xb8956a), ROOF = M(0x9c7b55), WALL = M(0xb08a5c), TENT = [M(0xb8322f), M(0x2f6bb8), M(0xd8a33a), M(0x3f8f3a)], CAMEL = M(0xc09a64), WOOD = M(0x6b4a2b), SOV = M(0xe4ddd0), SOVW = M(0x5f7f9c, { roughness: .3, metalness: .3 }), GREEN = M(0x3f7f35);
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const at = (k, dx = 0, dz = 0) => { const h = history[k]; if (!h) return null; const [x, z] = toXZ(h.lat, h.lon); return [x + dx, z + dz]; };
  const free = (x, z, r = 8) => roadClear(x, z) > r && !Object.keys(history).some((k) => { const p = at(k); return p && Math.hypot(p[0] - x, p[1] - z) < 75; });
  function instanced(geo, mat, list) { const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
    list.forEach(([x, z, sx, sy, sz, r], i) => { m.compose(p.set(x, 0, z), q.setFromAxisAngle(Y, r || 0), s.set(sx, sy, sz)); im.setMatrixAt(i, m); }); im.castShadow = im.receiveShadow = true; return im; }
  const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  function mudCity(g, n, R) { // paxsa uylar: past, tekis tomli, hovlili
    const a = [], b = [], c = []; let tries = 0;
    while (a.length < n && tries++ < n * 8) { const ang = rnd() * 6.283, d = Math.sqrt(rnd()) * R, x = Math.cos(ang) * d, z = Math.sin(ang) * d; if (!free(x, z, 7)) continue; const w = 7 + rnd() * 7, dd = 7 + rnd() * 7, h = 3 + rnd() * 1.6, r = Math.round(rnd() * 4) * Math.PI / 2;
      (rnd() < .5 ? a : b).push([x, z, w, h, dd, r]); if (rnd() < .35) c.push([x + 6, z + 6, 2.2, 3.5 + rnd() * 2, 2.2, 0]); }
    g.add(instanced(unitBox, MUD, a), instanced(unitBox, MUD2, b));
    const tg = new THREE.IcosahedronGeometry(1, 0).translate(0, 1, 0); g.add(instanced(tg, GREEN, c)); // tut va o'rik daraxtlari
  }
  function cityWall(g, R) { // qal'a devori, burjlar va 4 darvoza
    const segs = 72, list = [], towers = [];
    for (let i = 0; i < segs; i++) { const a0 = i / segs * 6.283, a1 = (i + 1) / segs * 6.283; if ([0, 18, 36, 54].includes(i)) continue; const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R, L = Math.hypot(x1 - x0, z1 - z0);
      list.push([(x0 + x1) / 2, (z0 + z1) / 2, L + .5, 9, 3.5, -Math.atan2(z1 - z0, x1 - x0)]); towers.push([x0, z0, 1, 1, 1, 0]); }
    g.add(instanced(unitBox, WALL, list)); g.add(instanced(new THREE.CylinderGeometry(3.6, 4.4, 13, 12).translate(0, 6.5, 0), WALL, towers));
    for (const i of [0, 18, 36, 54]) { const a = (i + .5) / segs * 6.283, gt = new THREE.Group(); gt.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); gt.rotation.y = -a + Math.PI / 2;
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
  function moveAll(dt) { for (const a of anim) { a.t = (a.t + a.speed * dt) % a.L; a.train.forEach((o, i) => { let d = (a.t - i * a.gap + a.L) % a.L; for (let j = 1; j < a.pts.length; j++) { const [x0, z0] = a.pts[j - 1], [x1, z1] = a.pts[j], l = Math.hypot(x1 - x0, z1 - z0); if (d <= l) { const f = d / l; o.position.set(x0 + (x1 - x0) * f, 0, z0 + (z1 - z0) * f); o.rotation.y = -Math.atan2(z1 - z0, x1 - x0); break; } d -= l; } }); } }
  function oqsaroyFull(g) { const p = at('oqsaroy'); if (!p) return; const o = new THREE.Group(); o.position.set(p[0], 0, p[1]); g.add(o); // butun peshtoq: ravoq tepasi, hovli, orqa gumbazli zal
    const tile = monuments?.children.find((c) => c.userData.hist === 'oqsaroy')?.children.find((c) => c.isGroup)?.children[0]?.material || M(0x1f5fa8);
    const top = new THREE.Mesh(new THREE.BoxGeometry(44, 14, 14), tile); top.position.set(0, 45, 0); o.add(top);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(11, 2.2, 8, 24, Math.PI), M(0xd9a640, { metalness: .6, roughness: .3 })); arch.position.set(0, 26, 7.2); o.add(arch);
    for (const [w, d, x, z] of [[100, 4, 0, -60], [4, 70, -50, -25], [4, 70, 50, -25]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 16, d), tile); m.position.set(x, 8, z); m.castShadow = true; o.add(m); }
    const dm = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 16, 0, 6.283, 0, Math.PI / 2), M(0x1f9fb8, { roughness: .35 })); dm.position.set(0, 22, -55); o.add(dm); const dr = new THREE.Mesh(new THREE.BoxGeometry(34, 22, 26), WALL); dr.position.set(0, 11, -55); o.add(dr);
    o.traverse((x) => (x.castShadow = true)); }
  function sovietBlocks(g, n) { const list = []; let tries = 0; const wt = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#e4ddd0'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#5f7f9c'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(4 + i * 15, 4 + j * 15, 9, 9); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const mat = new THREE.MeshStandardMaterial({ map: wt, roughness: .9 });
    while (list.length < n && tries++ < n * 10) { const a = rnd() * 6.283, d = 200 + Math.sqrt(rnd()) * 1500, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 14)) continue; list.push([x, z, 60, 15, 12, Math.round(rnd() * 2) * Math.PI / 2]); }
    g.add(instanced(unitBox, mat, list)); }
  function placeItems(g, e) { items = [];
    for (const [id, ie, k, dx, dz, n, f] of ITEMS) { if (String(ie) !== e) continue; const p = at(k, dx, dz); if (!p) continue;
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,230,140,1)'); gr.addColorStop(1, 'rgba(255,200,60,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); x.font = '64px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n.split(' ')[0], 64, 68);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: got[id] ? .35 : 1 })); sp.scale.setScalar(9); sp.position.set(p[0], 6, p[1]); sp.userData.eraItem = id; g.add(sp); items.push(sp); } }

  function build(e) {
    if (eraGroup) { scene.remove(eraGroup); eraGroup.traverse((o) => { o.geometry?.dispose?.(); }); } anim = []; eraGroup = new THREE.Group(); eraGroup.name = 'era';
    if (e === '1400') { cityWall(eraGroup, 950); mudCity(eraGroup, 900, 900); oqsaroyFull(eraGroup); bazaar(eraGroup, 'dorutilovat'); movers(eraGroup, camel, 6, 3); }
    if (e === '1900') { cityWall(eraGroup, 1100); mudCity(eraGroup, 1500, 1350); bazaar(eraGroup, 'chorsu'); movers(eraGroup, camel, 3, 3); movers(eraGroup, cart, 10, 5); }
    if (e === '1970') { mudCity(eraGroup, 500, 1200); sovietBlocks(eraGroup, 140); movers(eraGroup, bus, 12, 11); }
    placeItems(eraGroup, e); scene.add(eraGroup);
  }
  function applyVisibility() { if (era === 'now') return; for (const o of scene.children) if (!isKeep(o)) o.visible = false; // yangi qo'shilganlar ham yashiriladi
    const ms = ERAS[era].mon; monuments?.children.forEach((c) => (c.visible = ms.includes(c.userData.hist))); }
  function setEra(e) {
    if (e === era) return; const wasNow = era === 'now'; era = e; paint();
    if (wasNow) { saved = new Map(); for (const o of scene.children) saved.set(o, o.visible); saved.road = { c: roadMat.color.clone(), map: roadMat.map }; }
    if (e === 'now') { for (const [o, v] of saved || []) o.visible = v; if (saved?.road) { roadMat.color.copy(saved.road.c); roadMat.map = saved.road.map; roadMat.needsUpdate = true; } if (eraGroup) { scene.remove(eraGroup); eraGroup = null; } monuments?.children.forEach((c) => (c.visible = true)); anim = []; items = []; renderer.domElement.style.filter = ''; onEra?.(e); return; }
    if (e === '1970') { roadMat.color.copy(saved.road.c).multiplyScalar(.85); roadMat.map = saved.road.map; } else { roadMat.color.setHex(e === '1400' ? 0xb89a72 : 0xa88a62); roadMat.map = null; } roadMat.needsUpdate = true;
    build(e); applyVisibility(); renderer.domElement.style.filter = ERAS[e].css; onEra?.(e);
    const d = Math.hypot(controls.target.x, controls.target.z); if (d > 2500) flyTo(0, 0, 900);
    toast('🕰️ ' + ERAS[e].t); openInfo();
  }
  setInterval(applyVisibility, 1000);
  let last = performance.now(); (function loop() { requestAnimationFrame(loop); const n = performance.now(), dt = Math.min(.1, (n - last) / 1000); last = n; if (anim.length) moveAll(dt); const s = 9 + Math.sin(n / 300) * 1.2; for (const it of items) it.scale.setScalar(s); })();

  async function loadGot() { if (!myRes()) return; try { got = (await api('/api/fun/era', { ...getMe(), list: 1 })).got || {}; } catch {} }
  function openInfo() {
    const E = ERAS[era], list = ITEMS.filter((i) => String(i[1]) === era), all = ITEMS.filter((i) => got[i[0]]).length;
    modal(`<h3>🕰️ ${esc(E.t)}</h3>${E.f ? `<div class="hcard got"><div>${esc(E.f)}</div></div>` : '<div class="muted">Yuqoridagi vaqt slayderidan davrni tanlang: 1400, 1900 yoki 1970.</div>'}
      ${list.length ? `<b>🔍 Bu davrda yashiringan buyumlar</b>${list.map(([id, , k, , , n]) => `<div class="hcard ${got[id] ? 'got' : ''}"><div><b>${got[id] ? '✅' : '❔'} ${esc(n)}</b><div class="muted">${got[id] ? 'Topildi' : `«${esc(history[k]?.n || k)}» atrofida — xaritada yaltirab turadi`}</div></div><button class="ghost" data-tgo="${k}">📍</button></div>`).join('')}` : ''}
      <div class="muted">Kolleksiya: ${all}/${ITEMS.length} · har biri +300, hammasi uchun +5 000</div><button class="ghost" id="nope">Yopish</button>`);
    $('nope').onclick = closeModal; document.querySelectorAll('[data-tgo]').forEach((b) => (b.onclick = () => { const p = at(b.dataset.tgo); closeModal(); if (p) flyTo(p[0], p[1], 110); }));
  }
  const $ = (id) => document.getElementById(id);
  const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
  function click(e) { if (era === 'now' || !items.length) return false; mv.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mv, camera);
    const hit = ray.intersectObjects(items, false)[0]; if (!hit) return false; claim(hit); return true; }
  async function claim(hit) { const id = hit.object.userData.eraItem, it = ITEMS.find((i) => i[0] === id);
    if (!myRes()) return alert('Topilmani yig\'ish uchun saytga kiring');
    if (got[id]) { modal(`<h3>${esc(it[5])}</h3><div class="hcard got"><div>${esc(it[6])}</div></div><button class="ghost" id="nope">Yopish</button>`); $('nope').onclick = closeModal; return; }
    try { const j = await api('/api/fun/era', { ...getMe(), item: id }); got = j.got; hit.object.material.opacity = .35; C.setBalance?.(j.balance);
      modal(`<h3>🎉 Topildi: ${esc(it[5])}</h3><div class="hcard got"><div>${esc(it[6])}</div></div><div class="cgoal"><div>+${money(j.reward)}</div>${j.all ? '<b>🏆 Vaqt sayohatchisi — to\'liq kolleksiya!</b>' : ''}</div><button class="ok" id="nope">Davom etish</button>`); $('nope').onclick = closeModal;
    } catch (er) { alert(er.message); } }
  loadGot();
  return { setEra, click, era: () => era, items: ITEMS };
}
