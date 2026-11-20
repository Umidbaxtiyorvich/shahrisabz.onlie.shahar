// 🚶 Shahar aholisi: CC0 MakeHuman odamlari (public/models/people, CREDITS.md) ko'chalar bo'ylab yuradi,
// har birining ismi, yoshi, kasbi, kayfiyati va kunlik tartibi bor (Shahrisabz vaqti bo'yicha). Bosilsa — suhbat.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export function initPeople(C) {
  const { THREE, scene, camera, controls, ways, modal, closeModal, esc, toast } = C;
  const group = new THREE.Group(); group.name = 'people'; scene.add(group);
  const NAMES = { m: ['Akmal', 'Bobur', 'Jasur', 'Sardor', 'Otabek', 'Rustam', 'Sherzod', 'Dilshod', 'Anvar', 'Farrux', 'Ulug\'bek', 'Shohruh'], f: ['Malika', 'Dilnoza', 'Nilufar', 'Gulnora', 'Madina', 'Zarina', 'Shahnoza', 'Feruza', 'Mohira', 'Sevara', 'Kamola', 'Nodira'] };
  const JOBS = [['🧑‍🏫', "o'qituvchi", 'maktab'], ['👨‍⚕️', 'shifokor', 'poliklinika'], ['🧵', 'kashtachi', 'ustaxona'], ['🫓', 'novvoy', 'nonvoyxona'], ['🛒', 'sotuvchi', 'Chorsu bozori'], ['🚕', 'haydovchi', 'bekat'], ['💻', 'dasturchi', 'ofis'], ['🎓', 'talaba', 'kollej'], ['🏺', 'kulol', 'ustaxona'], ['🧑‍🍳', 'oshpaz', 'choyxona'], ['🏗️', 'quruvchi', 'qurilish'], ['📚', 'kutubxonachi', 'kutubxona']];
  const MOODS = ['😊 xursand', '🙂 tinch', '😌 xotirjam', '🤔 o\'ychan', '😄 quvnoq', '😴 charchagan'];
  const hour = () => (new Date().getUTCHours() + 5) % 24 + new Date().getUTCMinutes() / 60;
  const activity = (p, h) => h < 6 ? 'uyda dam olyapti' : h < 9 ? `${p.job[2]}ga ketyapti` : h < 13 ? `${p.job[2]}da ishlayapti` : h < 14 ? 'tushlik qilyapti' : h < 18 ? `${p.job[2]}da ishlayapti` : h < 20 ? 'bozordan uyga qaytyapti' : h < 23 ? "do'stlari bilan sayr qilyapti" : 'uyga ketyapti';
  const LINES = {
    hi: (p) => [`Assalomu alaykum! Men ${p.name}, ${p.job[1]}man.`, `Salom! Ismim ${p.name}. Kayfiyatingiz qalay?`, `Vaalaykum assalom! ${p.name} bo'laman, ${p.job[2]}da ishlayman.`],
    how: (p) => [`Rahmat, yaxshi! Bugun ${p.mood.split(' ')[1]} kayfiyatdaman.`, "Shukr, hammasi joyida. Ishlar ko'p, lekin quvonchli.", 'Yaxshi, rahmat! Ob-havo ham chiroyli bugun.'],
    city: () => ["Shahrisabz — Amir Temurning vatani. Oqsaroyni ko'rganmisiz? Peshtoqi juda ulkan!", "Ko'k gumbaz masjidiga albatta boring, gumbazi moviy koshinlar bilan qoplangan.", "Chorsu bozorida eng mazali non va uzum bor. Kashtalarimiz ham mashhur!", 'Shahrimiz 2700 yildan ortiq tarixga ega, qadimgi nomi Kesh bo\'lgan.'],
    where: (p) => [`Hozir ${activity(p, hour())}.`, `${p.job[2]}ga shoshyapman, kechikmay deb.`],
    tip: () => ["Kechqurun Oqsaroy atrofida sayr qiling — juda chiroyli!", "Yangi bo'lsangiz, ✨ Hayot bo'limidan hovlingizdagi hosilni yig'ishni unutmang.", "Qo'shnilaringizga 🎁 sovg'a yuboring — xursand bo'lishadi.", 'Umumiy chatga kirib, boshqa shahrisabzliklar bilan tanishing!'],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---- Modellar ----
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const models = []; let list = [];
  const MAX = innerWidth < 800 ? 10 : 22; // bir vaqtda ko'rinadiganlar (telefon uchun kamroq)
  // Suyakni dunyo o'qi atrofida burish (skelet o'qlari har xil bo'lgani uchun)
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qpi = new THREE.Quaternion(), V = new THREE.Vector3();
  function rotW(b, axis, ang) { if (!b) return; b.parent.getWorldQuaternion(qp); qpi.copy(qp).invert(); qa.setFromAxisAngle(axis, ang); b.quaternion.premultiply(qpi.clone().multiply(qa).multiply(qp)); b.updateMatrixWorld(true); }
  function rig(root) {
    const B = {}; root.traverse((o) => { if (o.isBone) B[o.name] = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    root.updateMatrixWorld(true);
    // qo'llarni pastga tushirish (T/A-pozadan tabiiy holatga)
    for (const s of ['l', 'r']) { const ua = B['upperarm_' + s], la = B['lowerarm_' + s]; if (!ua || !la) continue;
      const a = ua.getWorldPosition(new THREE.Vector3()), c = la.getWorldPosition(new THREE.Vector3()), dir = c.sub(a).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, -1, 0).lerp(new THREE.Vector3(s === 'l' ? .12 : -.12, 0, 0), .5).normalize());
      ua.parent.getWorldQuaternion(qp); qpi.copy(qp).invert(); ua.quaternion.premultiply(qpi.clone().multiply(q).multiply(qp)); ua.updateMatrixWorld(true); }
    const rest = {}; for (const k in B) rest[k] = B[k].quaternion.clone();
    return { B, rest };
  }
  async function loadModels() {
    try { list = await (await fetch('./models/people/list.json')).json(); } catch { return; }
    let n = 0; const want = innerWidth < 800 ? 8 : list.length;
    await Promise.all(list.slice(0, want).map((it) => new Promise((ok) => loader.load('./models/people/' + it.f, (g) => { const b = new THREE.Box3().setFromObject(g.scene); models.push({ scene: g.scene, s: it.s, h: b.max.y - b.min.y, minY: b.min.y });
      if (paths.length) { spawn(n); if (MAX > want && n + want < MAX) spawn(n + want); } n++; if (n === 1) tick(); ok(); }, undefined, ok))));
  }

  // ---- Yo'laklar: markazga yaqin ko'chalar (trotuar bo'ylab) ----
  let paths = [];
  function buildPaths() {
    paths = [];
    for (const w of ways) { if (!w.pts || w.pts.length < 2) continue; let L = 0; for (let i = 1; i < w.pts.length; i++) L += Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1]);
      if (L < 60) continue; let best = 1e9, tb = 0, acc = 0; // ko'chaning markazga eng yaqin nuqtasi
      for (let i = 1; i < w.pts.length; i++) { const [x0, z0] = w.pts[i - 1], [x1, z1] = w.pts[i], l = Math.hypot(x1 - x0, z1 - z0) || 1, f = Math.max(0, Math.min(1, -(x0 * (x1 - x0) + z0 * (z1 - z0)) / (l * l))), d = Math.hypot(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f); if (d < best) { best = d; tb = acc + f * l; } acc += l; }
      if (best < 1400) paths.push({ pts: w.pts, L, off: (w.wd || 6) / 2 + 1.6, d: best, t0: Math.max(0, tb - 200), t1: Math.min(L, tb + 200) }); }
    paths.sort((a, b) => a.d - b.d); paths = paths.slice(0, 160);
  }
  function posOn(p, t, side) { let d = t; for (let i = 1; i < p.pts.length; i++) { const [x0, z0] = p.pts[i - 1], [x1, z1] = p.pts[i], l = Math.hypot(x1 - x0, z1 - z0); if (d <= l || i === p.pts.length - 1) { const f = Math.min(1, d / (l || 1)), ux = (x1 - x0) / (l || 1), uz = (z1 - z0) / (l || 1); return [x0 + (x1 - x0) * f - uz * p.off * side, z0 + (z1 - z0) * f + ux * p.off * side, Math.atan2(ux, uz)]; } d -= l; } return [0, 0, 0]; }

  // ---- Odamlar ----
  const people = [];
  function spawn(i) {
    const m = models[models.length - 1 - (i % Math.min(2, models.length)) * 0] , obj = SkeletonUtils.clone(m.scene), k = 1.72 / m.h * (.92 + Math.random() * .14); obj.scale.setScalar(k); obj.position.y = -m.minY * k;
    const holder = new THREE.Group(); holder.add(obj); group.add(holder);
    const job = JOBS[(i * 5) % JOBS.length], names = NAMES[m.s], p = { holder, obj, rig: rig(obj), name: names[(i * 7) % names.length], age: 19 + ((i * 13) % 50), job, mood: MOODS[i % MOODS.length], sex: m.s,
      path: paths[(i * 3) % Math.max(1, paths.length)], t: 0, dir: Math.random() < .5 ? 1 : -1, side: Math.random() < .5 ? 1 : -1, speed: 1.1 + Math.random() * .5, phase: Math.random() * 6, pause: 0 };
    p.t = p.path ? p.path.t0 + Math.random() * (p.path.t1 - p.path.t0) : 0; people.push(p);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 1.9, 8).translate(0, .95, 0), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.person = p; holder.add(hit); p.hit = hit;
  }
  const RIGHT = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function pose(p, ph, walk) {
    const { B, rest } = p.rig; for (const k in rest) B[k].quaternion.copy(rest[k]); p.obj.updateMatrixWorld(true);
    RIGHT.set(1, 0, 0).applyQuaternion(p.holder.quaternion);
    const s = Math.sin(ph), a = walk ? .45 : 0;
    rotW(B.thigh_l, RIGHT, -s * a); rotW(B.thigh_r, RIGHT, s * a);
    rotW(B.calf_l, RIGHT, Math.max(0, Math.sin(ph + 1.2)) * a * 1.3); rotW(B.calf_r, RIGHT, Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * a * 1.3);
    rotW(B.upperarm_l, RIGHT, s * a * .7); rotW(B.upperarm_r, RIGHT, -s * a * .7);
    rotW(B.spine_02, UP, s * a * .12); rotW(B.head, UP, walk ? 0 : Math.sin(ph * .3) * .25);
    p.obj.position.y = p.obj.position.y; // tana biroz tebranadi
  }
  const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
  function click(e) {
    if (!people.length) return false; mv.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mv, camera);
    const hit = ray.intersectObjects(people.filter((p) => p.holder.visible).map((p) => p.hit), false)[0]; if (!hit) return false; talk(hit.object.userData.person); return true;
  }
  function talk(p) {
    p.pause = 25; const log = [['p', pick(LINES.hi(p))]];
    const render = () => { modal(`<div class="row" style="align-items:center"><div class="pava">${p.job[0]}</div><div><h3>${esc(p.name)}</h3><div class="muted">${p.age} yosh · ${esc(p.job[1])} · ${esc(p.mood)}</div><div class="muted">📍 ${esc(activity(p, hour()))}</div></div></div>
      <div class="ptalk">${log.map(([w, t]) => `<div class="bub ${w === 'me' ? 'mine' : ''}">${esc(t)}</div>`).join('')}</div>
      <div class="row">${[['how', 'Qalaysiz?'], ['city', 'Shahar haqida gapiring'], ['where', 'Qayerga ketyapsiz?'], ['tip', 'Maslahat bering']].map(([k, t]) => `<button class="ghost" data-pq="${k}">${t}</button>`).join('')}</div>
      <button class="ghost" id="nope">Xayr!</button>`);
      document.querySelectorAll('[data-pq]').forEach((b) => (b.onclick = () => { log.push(['me', b.textContent], ['p', pick(LINES[b.dataset.pq](p))]); render(); const t = document.querySelector('.ptalk'); if (t) t.scrollTop = t.scrollHeight; }));
      document.getElementById('nope').onclick = () => { p.pause = 2; closeModal(); toast(`👋 ${p.name}: Xayr, yaxshi boring!`); }; };
    render();
  }

  let last = performance.now(), frame = 0;
  function tick() {
    requestAnimationFrame(tick); const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; if (!people.length) return;
    const cam = camera.position, h = hour(), night = h < 6 || h >= 23, show = night ? Math.ceil(people.length * .25) : people.length;
    frame++;
    people.forEach((p, i) => {
      if (!p.path) return; const far = Math.hypot(p.holder.position.x - cam.x, p.holder.position.z - cam.z) > 450 || cam.y > 520;
      p.holder.visible = i < show && !far;
      if (p.pause > 0) p.pause -= dt; else { p.t += p.dir * p.speed * dt; if (p.t > p.path.t1 || p.t < p.path.t0) { p.dir *= -1; p.t = Math.max(p.path.t0, Math.min(p.path.t1, p.t)); if (Math.random() < .3) p.pause = 3 + Math.random() * 6; } }
      const [x, z, yaw] = posOn(p.path, p.t, p.side); p.holder.position.set(x, 0, z); p.holder.rotation.y = yaw + (p.dir < 0 ? Math.PI : 0);
      if (p.holder.visible && (frame + i) % 2 === 0) { p.phase += dt * 2 * p.speed * 3.1 * 2; pose(p, p.phase, p.pause <= 0); }
    });
    // to'xtaganda yonidagi odamga o'girilib "gaplashadi"
    if (frame % 120 === 0) for (const p of people) { if (p.pause > 0 || Math.random() > .04) continue; const o = people.find((q) => q !== p && q.path === p.path && Math.abs(q.t - p.t) < 6); if (o) { p.pause = o.pause = 5 + Math.random() * 5; } }
  }
  (async () => {
    await new Promise((ok) => { const w = () => (ways.length > 10 ? ok() : setTimeout(w, 1000)); w(); });
    buildPaths(); if (!paths.length) return; await loadModels();
  })();
  return { click, people };
}
