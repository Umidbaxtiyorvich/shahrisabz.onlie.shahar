// Shahrisabz online shahar — "jonli shahar": haqiqiy vaqtga ko'ra kun/tun, haqiqiy ob-havo, ko'cha chiroqlari, harakatlanayotgan mashinalar.
// Hamma narsa brauzerda chiziladi; ob-havo serverdan (/api/weather, Open-Meteo) olinadi.
export function initLife(C) {
  const { THREE, scene, sky, sun, hemi, renderer, camera, controls, ways, glass, $, mergeGeometries, carParts } = C;
  const LAT = 39.0578 * Math.PI / 180;
  const state = { elev: 50, weather: null, night: 0, rainOn: false, snowOn: false, overrideHour: null };

  // ---- Quyosh holati: Shahrisabz (UTC+5) mahalliy vaqti bo'yicha taxminiy astronomik hisob ----
  function sunPosition(date) {
    const utcH = date.getUTCHours() + date.getUTCMinutes() / 60;
    const start = Date.UTC(date.getUTCFullYear(), 0, 0), day = Math.floor((date - start) / 864e5);
    const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + day) / 365);
    const solarH = state.overrideHour ?? (utcH + 66.83 / 15); // quyosh vaqti ≈ UTC + uzunlik/15
    const ha = (solarH - 12) * 15 * Math.PI / 180;
    const sinEl = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(ha);
    const el = Math.asin(sinEl);
    const az = Math.atan2(-Math.sin(ha), Math.tan(decl) * Math.cos(LAT) - Math.sin(LAT) * Math.cos(ha)); // 0 = shimol
    return { el, az };
  }
  const sunDir = new THREE.Vector3(); let envMap;
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0); scene.add(moon, moon.target); // oy yorug'i (tunda)
  const dayFog = new THREE.Color(0xc9d6e2), nightFog = new THREE.Color(0x0d1526), duskFog = new THREE.Color(0xe7b48a), rainFog = new THREE.Color(0x9aa4ad);
  function updateSun() {
    const { el, az } = sunPosition(new Date());
    state.elev = el * 180 / Math.PI;
    // three.js: +z — janub (xaritada pastga), +x — sharq
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    sky.material.uniforms.sunPosition.value.copy(sunDir);
    const dayReal = THREE.MathUtils.smoothstep(state.elev, -6, 8);      // 0 — tun, 1 — kun
    const day = .62 + .38 * dayReal; // yorug'lik tunda ham yetarli qoladi (faqat tus va chiroqlar o'zgaradi)
    const dusk = Math.max(0, 1 - Math.abs(state.elev - 2) / 10) * (state.elev > -8 ? 1 : 0);
    const cloudy = state.weather ? THREE.MathUtils.clamp((state.weather.cloud_cover || 0) / 100, 0, 1) : 0;
    const wet = state.rainOn || state.snowOn ? 1 : 0;
    state.night = 1 - dayReal;
    sun.intensity = 3.2 * day * (1 - cloudy * .55) * (1 - wet * .3);
    sun.color.setHSL(.08 + day * .04, .6 - day * .35, .55 + day * .35);
    hemi.intensity = .55 + .95 * day * (1 - cloudy * .3);
    hemi.color.setHSL(.62, .55 - .1 * day, .32 + .48 * day); hemi.groundColor.setHSL(.25, .3, .12 + .13 * day);
    moon.intensity = 1.1 * state.night; moon.position.set(controls.target.x - 120, 160, controls.target.z + 40); moon.target.position.copy(controls.target);
    sky.material.uniforms.turbidity.value = 4 + cloudy * 12 + wet * 6;
    sky.material.uniforms.rayleigh.value = .4 + 1.4 * day + dusk * 1.5;
    renderer.toneMappingExposure = .6 + .45 * day - wet * .12 * day;
    const fog = dayFog.clone().lerp(duskFog, dusk * .6).lerp(nightFog, state.night * .9).lerp(rainFog, wet * .5 * day);
    scene.fog.color.copy(fog); scene.fog.near = wet ? 600 : 2500; scene.fog.far = wet ? 5000 : 12000;
    if (envMap === undefined || (window.__dayEnv && envMap !== window.__dayEnv)) envMap = window.__dayEnv || scene.environment; scene.environment = day > .35 ? envMap : null; // tunda kunduzgi aks yorug'ligi o'chadi
    glass.emissive.setHex(state.night > .5 ? 0xffc46b : 0x1b3a5c); glass.emissiveIntensity = .25 + state.night * 1.1; // kechasi derazalar yonadi
    lampMat.emissiveIntensity = state.night * 2.5;
    lampMat.color.setHex(state.night > .3 ? 0xfff2c4 : 0xdddddd);
    sky.visible = true;
  }

  // ---- Ko'cha chiroqlari: katta ko'chalar bo'ylab har 45 m da ----
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffd27a, emissiveIntensity: 0 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5d636b, metalness: .7, roughness: .4 });
  function buildLamps() {
    const pts = [];
    for (const w of ways) {
      if (!/^(trunk|primary|secondary|tertiary)$/.test(w.t)) continue;
      let acc = 0;
      for (let i = 0; i < w.pts.length - 1; i++) {
        const [ax, az] = w.pts[i], [bx, bz] = w.pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (!L) continue;
        const nx = -(bz - az) / L, nz = (bx - ax) / L, off = w.wd / 2 + 1.2;
        for (let t = (45 - acc) % 45; t < L; t += 45) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, side = pts.length % 2 ? 1 : -1; pts.push([x + nx * off * side, z + nz * off * side, Math.atan2(nx * side, nz * side)]); }
        acc = (acc + L) % 45;
        if (pts.length > 6000) break;
      }
    }
    if (!pts.length) return;
    const poleG = new THREE.CylinderGeometry(.12, .16, 7, 6); poleG.translate(0, 3.5, 0);
    const lampG = new THREE.SphereGeometry(.45, 8, 6); lampG.translate(0, 7.1, 0);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();
    if (C.lampParts?.length) { // fps-kit (Kenney City Kit Roads) egilgan chiroq ustunlari; chiroq boshi yo'l ustida
      const headG = new THREE.SphereGeometry(.45, 8, 6); headG.scale(1.5, .35, 1.5); headG.translate(0, 7.55, -2.3);
      for (const pr of C.lampParts) { const im = new THREE.InstancedMesh(pr.geometry, pr.material, pts.length); im.castShadow = true; pts.forEach(([x, z, r], i) => { m.compose(at.set(x, 0, z), q.setFromAxisAngle(Y, r), one); im.setMatrixAt(i, m); }); scene.add(im); }
      const lamps = new THREE.InstancedMesh(headG, lampMat, pts.length); pts.forEach(([x, z, r], i) => { m.compose(at.set(x, 0, z), q.setFromAxisAngle(Y, r), one); lamps.setMatrixAt(i, m); }); scene.add(lamps);
    } else {
      const poles = new THREE.InstancedMesh(poleG, poleMat, pts.length), lamps = new THREE.InstancedMesh(lampG, lampMat, pts.length);
      pts.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); poles.setMatrixAt(i, m); lamps.setMatrixAt(i, m); });
      scene.add(poles, lamps);
    }
    // tunda yo'llarga yorug'lik dog'lari (arzon "yorug'lik" effekti)
    const glowG = new THREE.CircleGeometry(6, 16); glowG.rotateX(-Math.PI / 2); glowG.translate(0, .6, 0);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcf7a, transparent: true, opacity: 0, depthWrite: false });
    const glows = new THREE.InstancedMesh(glowG, glowMat, pts.length);
    pts.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); glows.setMatrixAt(i, m); });
    scene.add(glows); state.glowMat = glowMat;
  }

  // ---- Harakatlanayotgan mashinalar ----
  const traffic = [];
  let carMesh = null, cabMesh = null, wheelMesh = null, kGroups = null; const kRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  function buildTraffic() {
    const roads = ways.filter((w) => /^(trunk|primary|secondary|tertiary|residential|unclassified)$/.test(w.t) && w.pts.length > 1).map((w) => {
      const seg = []; let tot = 0;
      for (let i = 0; i < w.pts.length - 1; i++) { const L = Math.hypot(w.pts[i + 1][0] - w.pts[i][0], w.pts[i + 1][1] - w.pts[i][1]); seg.push(L); tot += L; }
      return { ...w, seg, tot };
    }).filter((w) => w.tot > 150 && Math.hypot(w.pts[0][0], w.pts[0][1]) < 4500);
    if (!roads.length) return;
    const N = Math.min(260, roads.length * 3);
    // haqiqiy mashina shakli: yon profil bo'yicha silliq burchakli kuzov + oyna + g'ildiraklar
    const prof = [[-2.2, .35], [2.2, .35], [2.25, .75], [1.5, .95], [.85, 1.38], [-.75, 1.42], [-1.55, 1], [-2.25, .9]];
    const bodyG = new THREE.ExtrudeGeometry(new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 1.55, bevelEnabled: true, bevelThickness: .14, bevelSize: .1, bevelSegments: 2 }); bodyG.translate(0, 0, -.78);
    const wheels = []; for (const x of [-1.4, 1.4]) for (const z of [-.86, .86]) { const w = new THREE.CylinderGeometry(.38, .38, .26, 12); w.rotateX(Math.PI / 2); w.translate(x, .38, z); wheels.push(w); }
    const cabG = new THREE.BoxGeometry(1.55, .38, 1.86); cabG.translate(.05, 1.05, 0);
    const wheelG = mergeGeometries(wheels);
    carMesh = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ metalness: .7, roughness: .35 }), N);
    cabMesh = new THREE.InstancedMesh(cabG, glass, N);
    const cols = [0xffffff, 0x111111, 0xc0c4ca, 0x1e3d8f, 0xb3261e, 0xe8e2d0, 0x2c3e50, 0xf1c40f];
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const r = roads[(Math.random() * roads.length) | 0];
      const big = /^(trunk|primary|secondary)$/.test(r.t);
      traffic.push({ r, d: Math.random() * r.tot, dir: Math.random() > .5 ? 1 : -1, v: (big ? 11 : 7) + Math.random() * 5, lane: big ? 2.6 : 1.6 });
      carMesh.setColorAt(i, col.setHex(cols[(Math.random() * cols.length) | 0]));
    }
    wheelMesh = new THREE.InstancedMesh(wheelG, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .8 }), N);
    carMesh.castShadow = true; scene.add(carMesh, cabMesh, wheelMesh);
    if (carParts && carParts.length) { // Kenney mashinalari: har modelga instanced meshlar, mashinalar navbat bilan bo'linadi
      carMesh.visible = cabMesh.visible = wheelMesh.visible = false;
      kGroups = carParts.map((prts, k) => { const idx = traffic.map((_, i) => i).filter((i) => i % carParts.length === k);
        const meshes = prts.map((pr) => { const im = new THREE.InstancedMesh(pr.geometry, pr.material, Math.max(1, idx.length)); im.castShadow = true; scene.add(im); return im; });
        return { idx, meshes }; });
    }
  }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  function moveTraffic(dt) {
    if (!carMesh) return;
    traffic.forEach((c, i) => {
      c.d += c.v * dt * c.dir;
      if (c.d > c.r.tot) { c.d = c.r.tot; c.dir = -1; } else if (c.d < 0) { c.d = 0; c.dir = 1; } // ko'cha oxirida orqaga qaytadi (narigi bo'lakda)
      let d = c.d, k = 0; while (k < c.r.seg.length - 1 && d > c.r.seg[k]) { d -= c.r.seg[k]; k++; }
      const [ax, az] = c.r.pts[k], [bx, bz] = c.r.pts[k + 1], L = c.r.seg[k] || 1, t = Math.min(1, d / L);
      const ux = (bx - ax) / L, uz = (bz - az) / L, side = c.dir; // o'ng tomondan harakat
      pos.set(ax + (bx - ax) * t - uz * c.lane * side, 0, az + (bz - az) * t + ux * c.lane * side);
      q.setFromAxisAngle(up, Math.atan2(-uz * c.dir, ux * c.dir));
      mtx.compose(pos, q, one); carMesh.setMatrixAt(i, mtx); cabMesh.setMatrixAt(i, mtx); wheelMesh.setMatrixAt(i, mtx); c.m = c.m || new THREE.Matrix4(); c.m.compose(pos, q.multiply(kRot), one);
    });
    carMesh.instanceMatrix.needsUpdate = true; cabMesh.instanceMatrix.needsUpdate = true; wheelMesh.instanceMatrix.needsUpdate = true;
    if (kGroups) for (const gp of kGroups) { gp.idx.forEach((ti, j) => { for (const im of gp.meshes) im.setMatrixAt(j, traffic[ti].m); }); for (const im of gp.meshes) im.instanceMatrix.needsUpdate = true; }
  }

  // ---- Yomg'ir / qor: kamera atrofida tushayotgan zarrachalar ----
  const PN = 6000, pGeo = new THREE.BufferGeometry(), pArr = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { pArr[i * 3] = (Math.random() - .5) * 400; pArr[i * 3 + 1] = Math.random() * 220; pArr[i * 3 + 2] = (Math.random() - .5) * 400; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xaecbe8, size: 1, transparent: true, opacity: .7, depthWrite: false });
  const precip = new THREE.Points(pGeo, pMat); precip.visible = false; precip.frustumCulled = false; scene.add(precip);
  function movePrecip(dt) {
    if (!precip.visible) return;
    const t = controls.target, sp = state.snowOn ? 6 : 60;
    for (let i = 0; i < PN; i++) { pArr[i * 3 + 1] -= sp * dt; if (state.snowOn) pArr[i * 3] += Math.sin((pArr[i * 3 + 1] + i) * .05) * dt * 2; if (pArr[i * 3 + 1] < 0) pArr[i * 3 + 1] = 220; }
    precip.position.set(t.x, 0, t.z); pGeo.attributes.position.needsUpdate = true;
  }

  // ---- Ob-havo (serverdan) va ekrandagi soat/ob-havo yorlig'i ----
  const WCODE = (c) => (c === 0 ? ['☀️', 'Ochiq'] : c <= 2 ? ['🌤️', 'Biroz bulutli'] : c === 3 ? ['☁️', 'Bulutli'] : c <= 48 ? ['🌫️', 'Tuman'] : c <= 57 ? ['🌦️', 'Mayda yomg\'ir'] : c <= 67 ? ['🌧️', "Yomg'ir"] : c <= 77 ? ['🌨️', 'Qor'] : c <= 82 ? ['🌧️', 'Jala'] : c <= 86 ? ['🌨️', 'Qor'] : ['⛈️', 'Momaqaldiroq']);
  async function loadWeather() {
    try { const w = await (await fetch('/api/weather')).json(); if (w && w.temperature_2m !== undefined) state.weather = w; } catch {}
    const c = state.weather?.weather_code ?? 0;
    state.rainOn = (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95; state.snowOn = (c >= 71 && c <= 77) || c === 85 || c === 86;
    precip.visible = state.rainOn || state.snowOn; pMat.size = state.snowOn ? 1.8 : 1; pMat.color.setHex(state.snowOn ? 0xffffff : 0xaecbe8);
    renderClock();
  }
  function renderClock() {
    const el = $('wclock'); if (!el) return;
    const now = new Date(), tm = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
    const w = state.weather, [ic, nm] = w ? WCODE(w.weather_code) : ['', ''];
    el.innerHTML = `${state.night > .5 ? '🌙' : '🕒'} ${tm}${w ? ` · ${ic} ${Math.round(w.temperature_2m) > 0 ? '+' : ''}${Math.round(w.temperature_2m)}°C <span class="muted">${nm}</span>` : ''}`;
    el.title = w ? `Shahrisabz: ${nm}, shamol ${w.wind_speed_10m} km/soat` : 'Shahrisabz vaqti';
  }

  buildLamps(); buildTraffic(); updateSun(); loadWeather();
  setInterval(updateSun, 30000); setInterval(loadWeather, 10 * 60 * 1000); setInterval(renderClock, 15000);
  let last = performance.now();
  return {
    tick() {
      const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
      moveTraffic(dt); movePrecip(dt);
      if (state.glowMat) state.glowMat.opacity = state.night * .35;
    },
    night: () => state.night,
    setHour(h) { state.overrideHour = h; updateSun(); renderClock(); }, // sinov uchun
    setWeather(code, temp = 12, cloud = 80) { state.weather = { weather_code: code, temperature_2m: temp, cloud_cover: cloud, wind_speed_10m: 3 }; const c = code; state.rainOn = (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95; state.snowOn = (c >= 71 && c <= 77) || c === 85 || c === 86; precip.visible = state.rainOn || state.snowOn; pMat.size = state.snowOn ? 1.8 : 1; pMat.color.setHex(state.snowOn ? 0xffffff : 0xaecbe8); updateSun(); renderClock(); },
  };
}
