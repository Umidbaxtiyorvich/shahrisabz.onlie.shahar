// ==UserScript==
// @name         Shahrisabz Online — obunachi kuzatuvchi
// @namespace    shahrisabz-online
// @version      1.0
// @description  Yangi obunachilarga avtomatik uy quradi (Direct'ga link faqat «uy» deb yozganda boradi)
// @match        https://www.instagram.com/*
// @grant        GM_xmlhttpRequest
// @connect      __HOST__
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';
  const SITE = '__SITE__', SECRET = '__SECRET__';
  const EVERY = 20000; // 20 soniya
  if (window.top !== window.self) return;
  // bir nechta tab ochiq bo'lsa — faqat bittasi ishlaydi
  const LOCK = 'shs_lock', me = Math.random().toString(36).slice(2);
  const ck = (n) => (document.cookie.match('(^|; )' + n + '=([^;]*)') || [])[2] || '';
  const site = (path, data) => new Promise((ok, no) => GM_xmlhttpRequest({ method: 'POST', url: SITE + path, headers: { 'Content-Type': 'application/json' }, data: JSON.stringify({ secret: SECRET, ...data }), onload: (r) => { try { ok(JSON.parse(r.responseText)); } catch (e) { no(e); } }, onerror: no }));
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:99999;background:#2f7cf6;color:#fff;font:12px sans-serif;padding:6px 10px;border-radius:10px;opacity:.9';
  document.body.appendChild(box);
  const say = (t) => (box.textContent = '🏠 Shahrisabz: ' + t);
  let seen = new Set(JSON.parse(localStorage.getItem('shs_seen') || '[]'));
  const firstRun = !localStorage.getItem('shs_seen');
  const keep = () => localStorage.setItem('shs_seen', JSON.stringify([...seen].slice(-20000)));

  async function sendDm(pk, text) {
    const form = new URLSearchParams({ recipient_users: JSON.stringify([[String(pk)]]), action: 'send_item', client_context: String(Date.now()) + Math.floor(Math.random() * 9999), text });
    const r = await fetch('/api/v1/direct_v2/threads/broadcast/text/', { method: 'POST', body: form, credentials: 'include', headers: { 'X-CSRFToken': ck('csrftoken'), 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' } });
    const j = await r.json().catch(() => ({}));
    if (j.status !== 'ok') throw new Error('Direct: ' + (j.message || r.status));
  }
  async function followersPage(pk, maxId) {
    const r = await fetch(`/api/v1/friendships/${pk}/followers/?count=50${maxId ? '&max_id=' + maxId : ''}`, { credentials: 'include', headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' } });
    if (!r.ok) throw new Error('Instagram ' + r.status);
    return r.json();
  }
  let pauseUntil = 0, initial = firstRun;
  async function tick() {
    const l = JSON.parse(localStorage.getItem(LOCK) || '{}');
    if (l.id && l.id !== me && Date.now() - l.at < EVERY * 2) return say('boshqa tabda ishlayapti');
    localStorage.setItem(LOCK, JSON.stringify({ id: me, at: Date.now() }));
    if (Date.now() < pauseUntil) return say('Instagram cheklovi — kutilmoqda…');
    const pk = ck('ds_user_id'); if (!pk) return say('Instagram\'ga kiring');
    try {
      let maxId = '', pages = 0, found = 0;
      do {
        const j = await followersPage(pk, maxId);
        const users = j.users || [];
        const fresh = users.filter((u) => !seen.has(u.username));
        for (const u of fresh) {
          const res = await site('/api/follow', { username: u.username, pk: u.pk || u.pk_id, source: 'browser' });
          seen.add(u.username); found++;
        }
        keep();
        maxId = j.next_max_id || '';
        if (!initial && fresh.length < users.length) break; // yangilari tugadi
        pages++; await new Promise((ok) => setTimeout(ok, 2000));
      } while (maxId && pages < 200);
      initial = false;
      say(`ishlayapti ✅ (${seen.size} obunachi${found ? ', +' + found + ' yangi' : ''}) ${new Date().toLocaleTimeString()}`);
      site('/api/follow/heartbeat', { followers: seen.size }).catch(() => {});
    } catch (e) {
      if (/429|401|403/.test(e.message)) pauseUntil = Date.now() + 10 * 60 * 1000;
      say('⚠️ ' + e.message); site('/api/follow/heartbeat', { followers: seen.size, error: e.message }).catch(() => {});
    }
  }
  say('ishga tushdi…'); tick(); setInterval(tick, EVERY);
})();
