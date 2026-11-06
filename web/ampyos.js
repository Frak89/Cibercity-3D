/* AmpybiOS · the pilot's tablet as an in-game app. 📱 TABLET (or U): the tablet comes up from the pilot's hands and fills
 * the phone's screen, running an AmpybiOS-style shell (themes, organic corners and the rotating radar border from the
 * AmpybiOS theme profiles). Every app that can be either says whether it's SIMULATED (the game world) or REAL (your phone),
 * and you choose in Impostazioni:
 *   KAGE TECH (devices, programs, diagnostics) · Fotocamera (in-game view or the phone's real camera) · Galleria (photos
 *   kept in the game, optionally saved to Pictures/Cybercity) · Mappa · Custodi · Dispositivo (pilot's suit or the real
 *   phone) · Notifiche (game or the real ones) · Sensori (game compass or the real motion sensors / GPS) · Torcia ·
 *   App Ampy (your AmpyXXX apps installed on the phone, tap to open) · Impostazioni.
 * Real functions use the Android bridge (window.AmpyBridge, app only) or standard web APIs when the page runs in a browser. */
(function () {
'use strict';
const NR = window.NeonRun; if (!NR) return;
const { S, GP, wrapD } = NR, PI = Math.PI;
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BR = () => window.AmpyBridge || null;
const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };

// AmpybiOS theme profiles (config/themes in Android-AmpybiOS): colours + per-corner radii in dp
const THEMES = {
  cyberpunk: { bg: '#080916', sf: '#151929', fg: '#EBF6FF', ac: '#CF4EFF', sc: '#234EFF', r: [28, 8, 32, 12] },
  fusion: { bg: '#071222', sf: '#151929', fg: '#EBF6FF', ac: '#13DFF9', sc: '#8638E8', r: [30, 10, 30, 10] },
  futuristic: { bg: '#101725', sf: '#151929', fg: '#EBF6FF', ac: '#F2BA57', sc: '#43D0C3', r: [40, 6, 25, 8] },
  minimal: { bg: '#101319', sf: '#151929', fg: '#EBF6FF', ac: '#A6B7C9', sc: '#53657B', r: [8, 8, 8, 8] } };
// functions that exist both ways: what "simulato" and "reale" mean for each
const DUAL = {
  camera: ['Fotocamera', 'vista dentro il gioco', 'fotocamera vera del telefono'],
  status: ['Stato e batteria', 'tuta del pilota', 'batteria e rete del telefono'],
  notif: ['Notifiche', 'messaggi del gioco', 'notifiche vere del telefono'],
  sensors: ['Sensori', 'bussola e posizione nel gioco', 'giroscopio, accelerometro e GPS veri'],
  torch: ['Torcia', 'schermo luminoso', 'flash vero del telefono'] };

/* ---------------- photo store (IndexedDB) ---------------- */
const DB = { db: null,
  open() { if (this.db) return Promise.resolve(this.db); return new Promise((ok, ko) => { try { const r = indexedDB.open('ampybios', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' }); r.onsuccess = () => { this.db = r.result; ok(this.db); }; r.onerror = () => ko(r.error); } catch (e) { ko(e); } }); },
  put(p) { return this.open().then(db => new Promise(ok => { const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').put(p); t.oncomplete = () => ok(); })); },
  all() { return this.open().then(db => new Promise(ok => { const q = db.transaction('photos').objectStore('photos').getAll(); q.onsuccess = () => ok((q.result || []).sort((a, b) => b.id - a.id)); q.onerror = () => ok([]); })).catch(() => []); },
  del(id) { return this.open().then(db => new Promise(ok => { const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').delete(id); t.oncomplete = () => ok(); })); } };

function AmpyOS(game) {
  this.g = game; this.isOpen = false; this.app = null; this.timers = [];
  this.cfg = Object.assign({ theme: 'cyberpunk', savePhone: true, mode: { camera: 'sim', status: 'real', notif: 'real', sensors: 'real', torch: 'real' } }, J(LS.get('ampyos', '{}')) || {});
  this.cfg.mode = Object.assign({ camera: 'sim', status: 'real', notif: 'real', sensors: 'real', torch: 'real' }, this.cfg.mode || {});
  this.APPS = [
    { id: 'story', name: 'Missioni', ic: '📜', tag: 'sim' }, { id: 'tech', name: 'KAGE TECH', ic: '🔧', tag: 'sim' }, { id: 'camera', name: 'Fotocamera', ic: '📷', dual: 'camera' }, { id: 'gallery', name: 'Galleria', ic: '🖼', tag: 'sim' },
    { id: 'map', name: 'Mappa', ic: '🗺', tag: 'sim' }, { id: 'glyphs', name: 'Custodi', ic: '𓂀', tag: 'sim' }, { id: 'device', name: 'Dispositivo', ic: '📟', dual: 'status' },
    { id: 'notif', name: 'Notifiche', ic: '🔔', dual: 'notif' }, { id: 'sensors', name: 'Sensori', ic: '🧭', dual: 'sensors' }, { id: 'torch', name: 'Torcia', ic: '🔦', dual: 'torch' },
    { id: 'ampy', name: 'App Ampy', ic: '◈', tag: 'real' }, { id: 'obj', name: 'AmpyOBJ', ic: '◳', tag: 'real' }, { id: 'build', name: 'Costruisci', ic: '🏗', tag: 'sim' }, { id: 'settings', name: 'Impostazioni', ic: '⚙', tag: 'sim' }];
  this.build(); this.theme();
}
AmpyOS.prototype.save = function () { LS.set('ampyos', JSON.stringify(this.cfg)); };
AmpyOS.prototype.real = function (k) { return this.cfg.mode[k] === 'real'; };
AmpyOS.prototype.theme = function () { const T = THEMES[this.cfg.theme] || THEMES.cyberpunk, st = this.root.style;
  st.setProperty('--bg', T.bg); st.setProperty('--sf', T.sf); st.setProperty('--fg', T.fg); st.setProperty('--ac', T.ac); st.setProperty('--sc', T.sc);
  ['tl', 'tr', 'br', 'bl'].forEach((k, i) => st.setProperty('--r' + k, T.r[i] + 'px')); };

/* ---------------- shell ---------------- */
AmpyOS.prototype.build = function () {
  const css = document.createElement('style');
  css.textContent = `
#aos{position:fixed;inset:0;z-index:60;display:none;background:rgba(2,3,8,.0);transition:background .6s;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg)}
#aos.on{background:rgba(2,3,8,.6)}
#aos .tab{position:absolute;left:-2.4vmin;top:-2.4vmin;width:calc(100vw + 4.8vmin);height:calc(100vh + 4.8vmin);transform-origin:50% 50%;border-radius:4vmin;
  background:#05060a;padding:2.4vmin;box-sizing:border-box;overflow:hidden;transition:transform .9s cubic-bezier(.2,.75,.15,1),opacity .45s,border-radius .9s;box-shadow:0 3vmin 8vmin rgba(0,0,0,.7)}
#aos .tab.far{transform:translate(0,30vh) perspective(900px) rotateX(55deg) scale(.22);opacity:0}
#aos .tab.near{transform:scale(.72)}
#aos .tab.full{transform:none;border-radius:0} #aos .tab.full .scr{border-radius:0}
#aos .tab.full .cam{display:none}
#aos .scr.off .view,#aos .scr.off .sb,#aos .scr.off .nav,#aos .scr.off .wall{opacity:0;transition:opacity .35s}
#aos .scr .view,#aos .scr .sb,#aos .scr .nav,#aos .scr .wall{transition:opacity .5s}
#aos .boot{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;pointer-events:none;opacity:0;transition:opacity .4s}
#aos .boot.on{opacity:1} #aos .boot b{font:300 7vmin system-ui;letter-spacing:.3em;background:linear-gradient(90deg,var(--sc),var(--ac));-webkit-background-clip:text;background-clip:text;color:transparent}
#aos .boot small{margin-top:1.4vmin;letter-spacing:.3em;opacity:.7} #aos .boot i{display:block;width:30vmin;height:.4vmin;margin-top:3vmin;background:rgba(255,255,255,.12);overflow:hidden;border-radius:1vmin}
#aos .boot i::after{content:"";display:block;height:100%;width:40%;background:linear-gradient(90deg,var(--sc),var(--ac));animation:aosLoad 1.1s ease-in-out infinite}
@keyframes aosLoad{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
#aos .blackout{position:absolute;inset:0;z-index:6;background:#000;pointer-events:none;transform:scaleY(0);transform-origin:50% 50%}
#aos .blackout.go{animation:aosOff .55s ease-in forwards}
@keyframes aosOff{0%{transform:scaleY(0);opacity:1}55%{transform:scaleY(1)}100%{transform:scaleY(1)}}
#aos .line{position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;z-index:7;background:#fff;box-shadow:0 0 2vmin #fff;transform:scaleX(0);opacity:0;pointer-events:none}
#aos .line.go{animation:aosLine .7s ease-out forwards}
@keyframes aosLine{0%{opacity:1;transform:scaleX(1)}60%{opacity:1;transform:scaleX(.02)}100%{opacity:0;transform:scaleX(0)}}
#aos .sess{background:none;border:1px solid color-mix(in srgb,var(--ac) 60%,transparent);color:var(--fg);border-radius:2vmin;padding:.3vmin 1.2vmin;font:inherit;font-size:1.5vmin;cursor:pointer}
body.aosfull #langPill{display:none}
#aos .tab::before{content:"";position:absolute;inset:-60%;background:conic-gradient(from 0deg,transparent 0 62%,var(--sc) 82%,var(--ac) 99%,transparent 100%);animation:aosSpin 3.6s linear infinite}
@keyframes aosSpin{to{transform:rotate(360deg)}}
#aos .cam{position:absolute;left:50%;top:.45vmin;width:.8vmin;height:.8vmin;margin-left:-.4vmin;border-radius:50%;background:#1b1f2a;z-index:3}
#aos .scr{position:relative;width:100%;height:100%;background:var(--bg);border-radius:var(--rtl) var(--rtr) var(--rbr) var(--rbl);overflow:hidden;display:flex;flex-direction:column;z-index:2}
#aos .sb{display:flex;justify-content:space-between;align-items:center;padding:.8vmin 2.4vmin;font-size:1.7vmin;opacity:.92;letter-spacing:.04em}
#aos .sb b{color:var(--ac)} #aos .view{flex:1;min-height:0;position:relative;overflow:auto}
#aos .nav{display:flex;justify-content:center;gap:5vmin;padding:.7vmin 0 1vmin} #aos .nav button{background:none;border:none;color:var(--fg);font-size:2.4vmin;opacity:.8;cursor:pointer}
#aos .wall{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0} #aos .sb,#aos .view,#aos .nav{position:relative;z-index:1} #aos .blob{position:absolute;border-radius:42% 58% 63% 37%/41% 44% 56% 59%;filter:blur(2vmin);opacity:.35;animation:aosBlob 14s ease-in-out infinite alternate}
@keyframes aosBlob{0%{transform:translate(0,0) rotate(0) scale(1)}50%{border-radius:60% 40% 33% 67%/55% 30% 70% 45%}100%{transform:translate(8vmin,-5vmin) rotate(70deg) scale(1.2)}}
#aos .home{position:relative;padding:2vmin 4vmin;display:flex;flex-direction:column;height:100%;box-sizing:border-box}
#aos .clock{font-size:7vmin;font-weight:200;letter-spacing:.05em} #aos .date{opacity:.7;font-size:1.9vmin;margin-bottom:2vmin}
#aos .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(13vmin,1fr));gap:2.2vmin;align-content:start}
#aos .ico{display:flex;flex-direction:column;align-items:center;gap:.7vmin;cursor:pointer;background:none;border:none;color:var(--fg);font:inherit;font-size:1.6vmin}
#aos .ico i{font-style:normal;display:flex;align-items:center;justify-content:center;width:9vmin;height:9vmin;font-size:4.4vmin;background:linear-gradient(145deg,var(--sf),color-mix(in srgb,var(--sf) 70%,var(--ac)));border-radius:var(--rtl) var(--rtr) var(--rbr) var(--rbl);box-shadow:0 0 0 1px color-mix(in srgb,var(--ac) 45%,transparent),0 0 2vmin color-mix(in srgb,var(--ac) 30%,transparent)}
#aos .ico img{width:9vmin;height:9vmin;border-radius:var(--rtl) var(--rtr) var(--rbr) var(--rbl)}
#aos .tag{font-size:1.15vmin;padding:.1vmin .7vmin;border-radius:1vmin;letter-spacing:.08em} #aos .tag.sim{background:color-mix(in srgb,var(--sc) 45%,transparent)} #aos .tag.real{background:color-mix(in srgb,var(--ac) 55%,transparent);color:#fff}
#aos .app{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--bg);animation:aosIn .28s ease-out}
@keyframes aosIn{from{transform:scale(.94)}to{transform:none}}
#aos .bar{display:flex;align-items:center;gap:1.2vmin;padding:.8vmin 2vmin;font-size:2vmin;border-bottom:1px solid color-mix(in srgb,var(--ac) 30%,transparent)} #aos .bar .t{flex:1;font-weight:600}
#aos .body{flex:1;min-height:0;overflow:auto;padding:1.6vmin 2.4vmin;font-size:1.8vmin;position:relative}
#aos .btn{background:var(--sf);color:var(--fg);border:1px solid color-mix(in srgb,var(--ac) 60%,transparent);border-radius:var(--rtl) var(--rtr) var(--rbr) var(--rbl);padding:.9vmin 1.6vmin;font:inherit;font-size:1.7vmin;cursor:pointer}
#aos .btn.on{background:color-mix(in srgb,var(--ac) 40%,var(--sf))} #aos .card{background:var(--sf);border-radius:var(--rtl) var(--rtr) var(--rbr) var(--rbl);padding:1.4vmin 1.8vmin;margin:0 0 1.2vmin}
#aos .kv{display:grid;grid-template-columns:auto 1fr;gap:.5vmin 2vmin} #aos .kv span:nth-child(odd){opacity:.65}
#aos .meter{height:1vmin;background:rgba(255,255,255,.08);border-radius:1vmin;overflow:hidden;margin:.4vmin 0 1vmin} #aos .meter i{display:block;height:100%;background:linear-gradient(90deg,var(--sc),var(--ac))}
#aos .shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(18vmin,1fr));gap:1vmin} #aos .shots img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:1vmin;cursor:pointer}
#aos video,#aos .prev{width:100%;height:100%;object-fit:cover;background:#000;display:block} #aos .shut{position:absolute;bottom:2vmin;left:50%;transform:translateX(-50%);width:9vmin;height:9vmin;border-radius:50%;border:.6vmin solid #fff;background:rgba(255,255,255,.25);cursor:pointer}
#aos .camtools{position:absolute;top:1.4vmin;right:1.4vmin;display:flex;gap:1vmin} #aos .flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s}
#aos #techUI{position:absolute!important;inset:0!important;width:auto!important;top:0!important;right:0!important;bottom:0!important;border:none!important;border-radius:0!important;box-shadow:none!important;display:flex!important;background:var(--bg)!important}
#aos canvas{position:static;inset:auto} #aos .n{border-left:.4vmin solid var(--ac)} #aos small{opacity:.65}`;
  document.head.appendChild(css);
  const r = this.root = document.createElement('div'); r.id = 'aos';
  r.innerHTML = '<div class="tab far"><span class="cam"></span><div class="scr"><div class="wall"><span class="blob" style="width:60vmin;height:60vmin;left:-10vmin;top:-12vmin;background:var(--ac)"></span><span class="blob" style="width:50vmin;height:50vmin;right:-8vmin;bottom:-14vmin;background:var(--sc);animation-delay:-6s"></span></div>'
    + '<div class="sb"><span class="st-l"></span><span><b>AmpybiOS</b></span><span class="st-r"></span></div><div class="view"></div>'
    + '<div class="nav"><button data-nav="back" title="indietro">◁</button><button data-nav="home" title="home">○</button><button class="sess" data-nav="close" title="chiudi la sessione e spegni lo schermo">⏻ CHIUDI SESSIONE</button></div>'
    + '<div class="boot"><b>AmpybiOS</b><small>KAGE NET · SESSIONE</small><i></i></div><div class="blackout"></div><div class="line"></div></div></div>';
  document.body.appendChild(r);
  ['pointerdown', 'touchstart', 'mousedown', 'wheel', 'click'].forEach(ev => r.addEventListener(ev, e => e.stopPropagation()));
  r.addEventListener('click', e => { const b = e.target.closest('[data-nav],[data-app],[data-act]'); if (!b) return;
    if (this.busy) return; if (b.dataset.nav === 'home' || b.dataset.nav === 'back') this.home(); else if (b.dataset.nav === 'close') this.close();
    else if (b.dataset.app) this.launch(b.dataset.app); else if (b.dataset.act) this.act(b.dataset.act, b); });
  // while the tablet is out the game doesn't get the keyboard (inputs in the tablet still do)
  addEventListener('keydown', e => { if (!this.isOpen) return; if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.app ? this.home() : this.close(); return; }
    if (!r.contains(e.target)) { e.stopImmediatePropagation(); if (e.code === 'Space') e.preventDefault(); } }, true);
  addEventListener('keyup', e => { if (this.isOpen && !r.contains(e.target)) e.stopImmediatePropagation(); }, true);
  setInterval(() => { if (this.isOpen) this.status(); }, 1000);
};
AmpyOS.prototype.toggle = function (app) { if (this.isOpen) this.close(); else this.open(app); };
/** attach: the tablet comes up from the pilot's hands, grows until its screen IS the phone's screen (bezel past the edges), AmpybiOS boots */
AmpyOS.prototype.open = function (app) {
  const f = this.g.foot; if (this.isOpen || this.busy || !f || !f.active || this.g.veh) return;
  this.isOpen = true; this.busy = true; const r = this.root, tab = r.querySelector('.tab'), scr = r.querySelector('.scr'), boot = r.querySelector('.boot');
  tab.className = 'tab far'; scr.classList.add('off'); boot.classList.remove('on'); r.querySelector('.blackout').className = 'blackout'; r.querySelector('.line').className = 'line';
  r.style.display = 'block'; document.body.classList.add('aosfull');
  try { if (!window.AmpyBridge && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { }
  this.beep(300, 600, 0.4, 0.06); this.vib(10);
  const T = (ms, fn) => setTimeout(fn, ms);
  requestAnimationFrame(() => requestAnimationFrame(() => { r.classList.add('on'); tab.className = 'tab near'; }));
  T(650, () => { tab.className = 'tab full'; this.beep(520, 1040, 0.2, 0.07); });
  T(1250, () => { boot.classList.add('on'); this.vib(18); });
  T(2350, () => { if (app) this.launch(app); else this.home(); this.status(); scr.classList.remove('off'); boot.classList.remove('on'); this.busy = false; });
};
/** end the session: apps close, the screen switches off (collapse to a line), then the tablet detaches from the real screen and goes back into the pilot's hands */
AmpyOS.prototype.close = function () {
  if (!this.isOpen || this.busy) return; this.busy = true; this.leave(); if (this.torchOn) this.setTorch(false);
  const r = this.root, tab = r.querySelector('.tab'), scr = r.querySelector('.scr'), boot = r.querySelector('.boot'), T = (ms, fn) => setTimeout(fn, ms);
  this.view().innerHTML = ''; boot.querySelector('small').textContent = 'SESSIONE CHIUSA'; boot.querySelector('i').style.display = 'none'; boot.classList.add('on'); scr.classList.add('off');
  this.beep(700, 300, 0.35, 0.06);
  T(900, () => { r.querySelector('.blackout').className = 'blackout go'; r.querySelector('.line').className = 'line go'; this.beep(1200, 60, 0.45, 0.08); this.vib(25); });
  T(1650, () => { boot.classList.remove('on'); tab.className = 'tab near'; r.classList.remove('on'); });
  T(2250, () => { tab.className = 'tab far'; });
  T(2900, () => { r.style.display = 'none'; document.body.classList.remove('aosfull'); this.isOpen = false; this.busy = false;
    boot.querySelector('small').textContent = 'KAGE NET · SESSIONE'; boot.querySelector('i').style.display = '';
    try { if (!window.AmpyBridge && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { }); } catch (e) { } });
};
AmpyOS.prototype.beep = function (a, b, d, v) { if (!window.FleetAudio) return; if (!this.au) this.au = new FleetAudio(); this.au.start(); this.au.blip(a, b, d, v, 'sine'); };
AmpyOS.prototype.vib = function (ms) { const B = BR(); try { if (B) B.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } };
AmpyOS.prototype.view = function () { return this.root.querySelector('.view'); };
AmpyOS.prototype.status = function () {
  const d = new Date(), hh = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), L = this.root.querySelector('.st-l'), R = this.root.querySelector('.st-r');
  L.textContent = hh + (this.real('status') ? '' : ' · KAGE NET');
  if (this.real('status')) { const B = BR(), dv = B ? J(B.device()) : null;
    if (dv) R.textContent = dv.net + ' · ' + (dv.charging ? '⚡' : '🔋') + ' ' + dv.battery + '%';
    else if (navigator.getBattery) navigator.getBattery().then(b => { R.textContent = (navigator.onLine ? 'online' : 'offline') + ' · ' + (b.charging ? '⚡' : '🔋') + ' ' + Math.round(b.level * 100) + '%'; }).catch(() => { R.textContent = navigator.onLine ? 'online' : 'offline'; });
    else R.textContent = navigator.onLine ? 'online' : 'offline'; }
  else R.textContent = '◈ tuta ' + this.suitBattery() + '%';
  const ck = this.root.querySelector('.clock'); if (ck) { ck.textContent = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); this.root.querySelector('.date').textContent = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + this.where(); }
};
AmpyOS.prototype.suitBattery = function () { return Math.max(12, Math.round(100 - (this.g.t / 60) % 88)); };
AmpyOS.prototype.where = function () { const g = this.g, f = g.foot, Y = g.star;
  if (f && f.ss === 'in' && Y) return 'KAGE ODYSSEY · ' + window.KageStar.DECKS[f.deck].title; if (f && f.ss === 'planet' && Y) return 'sul pianeta · ' + Y.site; if (f && f.xs === 'in') return 'a bordo del KAGE XENO';
  return g.world === 'meadow' ? 'prateria del passato' : g.world === 'eco' ? 'ECO' : 'Cybercity'; };

/* ---------------- home ---------------- */
AmpyOS.prototype.home = function () {
  this.leave();
  const tagOf = a => a.dual ? (this.real(a.dual) ? 'real' : 'sim') : a.tag;
  this.view().innerHTML = '<div class="home"><div class="clock"></div><div class="date"></div><div class="grid">'
    + this.APPS.map(a => '<button class="ico" data-app="' + a.id + '"><i>' + a.ic + '</i>' + esc(a.name) + '<span class="tag ' + tagOf(a) + '">' + (tagOf(a) === 'real' ? 'REALE' : 'SIMULATO') + '</span></button>').join('') + '</div></div>';
  this.status();
};
AmpyOS.prototype.leave = function () {
  this.timers.forEach(t => clearInterval(t)); this.timers = []; this.liveCam = false;
  if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  if (this.motion) { removeEventListener('devicemotion', this.motion); removeEventListener('deviceorientation', this.orient); this.motion = null; }
  if (this.geoW !== undefined && navigator.geolocation) { navigator.geolocation.clearWatch(this.geoW); this.geoW = undefined; }
  const T = this.g.tech; if (T && this.app === 'tech') { T.open = false; T.ui.style.display = 'none'; document.body.appendChild(T.ui); }
  this.app = null;
};
AmpyOS.prototype.frame = function (title, body, tools) {
  this.view().innerHTML = '<div class="app"><div class="bar"><button class="btn" data-nav="home">◁</button><span class="t">' + title + '</span>' + (tools || '') + '</div><div class="body">' + body + '</div></div>';
  return this.view().querySelector('.body');
};
AmpyOS.prototype.launch = function (id) {
  this.leave(); this.app = id; this.vib(8); const A = this.APPS.find(a => a.id === id); if (!A) return this.home();
  const fn = this['app_' + id]; if (fn) fn.call(this, A);
};

/* ---------------- apps ---------------- */
AmpyOS.prototype.app_tech = function () { const T = this.g.tech; const b = this.frame('🔧 KAGE TECH', '');
  if (!T) { b.innerHTML = 'non disponibile'; return; } b.style.padding = '0'; b.appendChild(T.ui); T.open = true; T.ui.style.display = 'flex'; T.render(true); };

AmpyOS.prototype.app_camera = function () {
  const real = this.real('camera');
  const b = this.frame('📷 Fotocamera · ' + (real ? 'REALE' : 'SIMULATA'), '', '<button class="btn" data-act="cammode">' + (real ? 'passa al gioco' : 'passa al telefono') + '</button>');
  b.style.padding = '0';
  b.innerHTML = (real ? '<video autoplay playsinline muted></video>' : '<canvas class="prev"></canvas>') + '<div class="camtools">' + (real ? '<button class="btn" data-act="flip">⟲ fronte/retro</button>' : '<span class="btn">trascina per girarti</span>') + '</div><button class="shut" data-act="shoot"></button><div class="flash"></div>';
  if (real) this.startCam(b.querySelector('video'));
  else { const cv = b.querySelector('canvas'), gc = this.g.canvas || document.getElementById('c'), hud = document.getElementById('hud');
    this.liveCam = true; const tick = () => { if (!this.liveCam) return; requestAnimationFrame(() => { if (!this.liveCam) return; const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== w) { cv.width = w; cv.height = h; }
      const c2 = cv.getContext('2d'), sw = gc.width, sh = gc.height, k = Math.max(w / sw, h / sh); try { c2.drawImage(gc, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k); } catch (e) { } tick(); }); }; tick();
    let dx0 = null; cv.addEventListener('pointerdown', e => { dx0 = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (dx0 === null) return; const f = this.g.foot, d = (e.clientX - dx0) * 0.006; dx0 = e.clientX; if (f) { f.h -= d; if (f.camH !== undefined) f.camH -= d; } });
    cv.addEventListener('pointerup', () => { dx0 = null; }); }
};
AmpyOS.prototype.startCam = function (video) {
  const msg = t => { const b = this.view().querySelector('.body'); if (b) { const d = document.createElement('div'); d.className = 'card'; d.style.cssText = 'position:absolute;left:2vmin;right:2vmin;top:2vmin'; d.textContent = t; b.appendChild(d); } };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg('Fotocamera vera non disponibile qui. Nell’app Android funziona dopo aver dato il permesso.'); return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: this.facing || 'environment' }, width: { ideal: 1920 } }, audio: false })
    .then(s => { if (this.app !== 'camera') { s.getTracks().forEach(t => t.stop()); return; } this.stream = s; video.srcObject = s; video.style.transform = this.facing === 'user' ? 'scaleX(-1)' : ''; })
    .catch(e => msg('Permesso fotocamera negato o non disponibile (' + (e.name || e) + ').'));
};
AmpyOS.prototype.shoot = function () {
  const b = this.view().querySelector('.body'), fl = b && b.querySelector('.flash'); if (fl) { fl.style.opacity = 0.9; setTimeout(() => { fl.style.opacity = 0; }, 120); }
  this.beep(1800, 600, 0.12, 0.1); this.vib(20);
  const done = (url, src) => { const p = { id: Date.now(), t: new Date().toISOString(), src, where: this.where(), url };
    DB.put(p).then(() => { const B = BR(); let saved = ''; if (this.cfg.savePhone && B) saved = B.saveImage(url, 'cybercity_' + p.id);
      this.toast(saved ? 'Foto salvata nel gioco e in ' + saved : 'Foto salvata nella Galleria del gioco'); }); };
  if (this.real('camera')) { const v = b.querySelector('video'); if (!v || !v.videoWidth) { this.toast('fotocamera non pronta'); return; }
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const x = c.getContext('2d'); if (this.facing === 'user') { x.translate(c.width, 0); x.scale(-1, 1); } x.drawImage(v, 0, 0); done(c.toDataURL('image/jpeg', 0.9), 'telefono'); }
  else { const gc = this.g.canvas || document.getElementById('c'), hud = document.getElementById('hud');
    requestAnimationFrame(() => requestAnimationFrame(() => { const c = document.createElement('canvas'); c.width = gc.width; c.height = gc.height; const x = c.getContext('2d'); try { x.drawImage(gc, 0, 0); if (hud) x.drawImage(hud, 0, 0, c.width, c.height); } catch (e) { }
      x.font = 'bold ' + Math.round(c.height * 0.025) + 'px monospace'; x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText('CYBERCITY 3D · ' + this.where() + ' · ' + new Date().toLocaleString('it-IT'), c.height * 0.03, c.height * 0.96);
      done(c.toDataURL('image/jpeg', 0.9), 'gioco'); })); }
};
AmpyOS.prototype.toast = function (t) { const d = document.createElement('div'); d.className = 'card'; d.style.cssText = 'position:absolute;left:50%;bottom:9vmin;transform:translateX(-50%);z-index:9;max-width:80%;box-shadow:0 0 2vmin rgba(0,0,0,.6)'; d.textContent = t;
  this.root.querySelector('.scr').appendChild(d); setTimeout(() => d.remove(), 2600); };

AmpyOS.prototype.app_gallery = function () {
  const b = this.frame('🖼 Galleria', '<small>caricamento…</small>');
  DB.all().then(ps => { if (this.app !== 'gallery') return; this.photos = ps;
    b.innerHTML = ps.length ? '<div class="shots">' + ps.map(p => '<img src="' + p.url + '" data-act="ph:' + p.id + '" title="' + esc(p.where) + '">').join('') + '</div>' : 'Nessuna foto. Usa la Fotocamera (nel gioco o quella vera del telefono).'; });
};
AmpyOS.prototype.photo = function (id) { const p = (this.photos || []).find(q => q.id === +id); if (!p) return;
  const b = this.frame('🖼 ' + esc(new Date(p.t).toLocaleString('it-IT')), '<img src="' + p.url + '" style="width:100%;border-radius:1vmin"><p><small>' + esc(p.where) + ' · fotocamera ' + esc(p.src) + '</small></p>'
    + '<button class="btn" data-act="phsave:' + p.id + '">💾 salva sul telefono</button> <a class="btn" download="cybercity_' + p.id + '.jpg" href="' + p.url + '">⬇ scarica</a> <button class="btn" data-act="phdel:' + p.id + '">🗑 elimina</button>');
  void b; this.app = 'photo'; };

AmpyOS.prototype.app_map = function () {
  const b = this.frame('🗺 Mappa · ' + esc(this.where()), '<canvas style="width:100%;height:100%;display:block"></canvas>', '<button class="btn" data-act="zin">＋</button><button class="btn" data-act="zout">－</button>'); b.style.padding = '0';
  this.zoom = this.zoom || 1.6; const cv = b.querySelector('canvas');
  const draw = () => { if (this.app !== 'map') return; const g = this.g, f = g.foot, w = cv.clientWidth, h = cv.clientHeight; if (!w) return; cv.width = w; cv.height = h; const c = cv.getContext('2d'), k = this.zoom * Math.min(w, h) / 400;
    const px = f ? f.x : g.c.x, pz = f ? f.z : g.c.z, X = x => w / 2 + wrapD(x - px) * k, Z = z => h / 2 + wrapD(z - pz) * k;
    c.fillStyle = getComputedStyle(this.root).getPropertyValue('--bg') || '#080916'; c.fillRect(0, 0, w, h);
    const city = g.city; c.fillStyle = 'rgba(120,160,255,.22)'; c.strokeStyle = 'rgba(160,200,255,.35)';
    if (city && city.blocks && g.world === 'city') for (let iz = 0; iz < 15; iz++) for (let ix = 0; ix < 15; ix++) for (const q of city.blocks[iz * 15 + ix]) {
      const bx = q[0], bz = q[1], ex = q[2], ez = q[3]; const sx = X(bx), sz = Z(bz); if (sx < -200 || sx > w + 200 || sz < -200 || sz > h + 200) continue; c.fillRect(sx, sz, (ex - bx) * k, (ez - bz) * k); }
    const mark = (x, z, col, lab) => { const sx = X(x), sz = Z(z); if (sx < -20 || sx > w + 20 || sz < -20 || sz > h + 20) return; c.fillStyle = col; c.beginPath(); c.arc(sx, sz, 5, 0, 7); c.fill(); c.font = '11px system-ui'; c.fillStyle = '#fff'; c.fillText(lab, sx + 8, sz + 4); };
    if (g.world === 'city') { mark(g.c.x, g.c.z, '#ff4f7a', 'KAGE GT'); if (g.fleet && g.fleet.parked) mark(g.fleet.parked.st.x, g.fleet.parked.st.z, '#ffd166', 'veicolo'); mark(30, 27, '#f2ba57', 'EPOCH'); mark(24, 54, '#13dff9', 'ODYSSEY (garage)');
      if (g.xeno) { const pd = g.xeno.toWorld(0, -4.2); mark(pd[0], pd[1], '#7cff6b', 'XENO'); } mark(4 * GP, 2 * GP + 42, '#43d0c3', 'NEXUS');
      if (g.story) { const tg = g.story.target(); if (tg) mark(tg[0], tg[1], '#ffe08a', '◆ OBIETTIVO'); }
      if (g.mono) for (const sp of g.mono.spots) if (!sp.site && sp.deck === undefined) mark(sp.x, sp.z, g.mono.st.solved.includes(sp.id) ? '#9dff8a' : '#57ffbf', sp.kind === 'mono' ? sp.title.split(' · ')[0].replace('MONOLITE ', 'M') : '·'); }
    c.save(); c.translate(w / 2, h / 2); c.rotate(-(f ? f.h : g.c.h) + PI); c.fillStyle = getComputedStyle(this.root).getPropertyValue('--ac') || '#cf4eff'; c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.restore();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '12px system-ui'; c.fillText('x ' + Math.round(px) + ' · z ' + Math.round(pz) + '  ·  ' + this.where(), 10, h - 10); };
  draw(); this.timers.push(setInterval(draw, 250));
};

AmpyOS.prototype.app_glyphs = function () {
  const M = this.g.mono, KG = window.KageGlyph; if (!M || !KG) { this.frame('𓂀 Custodi', 'non disponibile'); return; }
  const st = M.st, mono = M.spots.filter(s => s.kind === 'mono');
  this.frame('𓂀 Lingua dei Custodi', '<div class="card"><div class="kv"><span>Chiavi sicure</span><span>' + st.keys.length + ' / 26 · ' + esc([...st.keys].join(' ')) + '</span><span>Tue ipotesi</span><span>' + Object.keys(st.g).length + '</span>'
    + '<span>Iscrizioni decifrate</span><span>' + st.solved.filter(i => i[0] === 'm').length + ' / ' + mono.length + '</span><span>Pietre</span><span>' + st.solved.filter(i => i[0] === 'w').length + ' / ' + (M.spots.length - mono.length) + '</span></div></div>'
    + mono.map(s => { const done = st.solved.includes(s.id), read = st.read.includes(s.id); return '<div class="card n"><b>' + esc(s.title) + '</b> ' + (done ? '✦ decifrata' : read ? '· letta' : '· da trovare') + '<br><small class="notr">' + esc(read ? M.say(s.text) : '???') + '</small></div>'; }).join(''));
};

AmpyOS.prototype.app_device = function () {
  const real = this.real('status'), b = this.frame('📟 Dispositivo · ' + (real ? 'REALE' : 'SIMULATO'), '', '<button class="btn" data-act="mode:status">' + (real ? 'mostra la tuta' : 'mostra il telefono') + '</button>');
  const gb = v => (v / 1073741824).toFixed(1) + ' GB', up = s => Math.floor(s / 86400) + 'g ' + Math.floor(s / 3600) % 24 + 'h ' + Math.floor(s / 60) % 60 + 'm';
  const draw = () => { if (this.app !== 'device') return; const B = BR();
    if (real) { const d = B ? J(B.device()) : null;
      if (d) b.innerHTML = '<div class="card"><b>' + esc(d.maker + ' ' + d.model) + '</b> <small>(' + esc(d.device) + ')</small><br><small>Android ' + esc(d.android) + ' · API ' + d.sdk + (d.security ? ' · patch ' + esc(d.security) : '') + '</small></div>'
        + '<div class="card">Batteria ' + d.battery + '% ' + (d.charging ? '⚡ in carica' : '') + '<div class="meter"><i style="width:' + d.battery + '%"></i></div><small>' + d.batTemp + ' °C · ' + d.batVolt + ' V' + (d.powerSave ? ' · risparmio energetico' : '') + '</small></div>'
        + '<div class="card">Memoria ' + gb(d.storageTotal - d.storageFree) + ' / ' + gb(d.storageTotal) + '<div class="meter"><i style="width:' + ((1 - d.storageFree / d.storageTotal) * 100).toFixed(0) + '%"></i></div>RAM ' + gb(d.ramTotal - d.ramFree) + ' / ' + gb(d.ramTotal) + '<div class="meter"><i style="width:' + ((1 - d.ramFree / d.ramTotal) * 100).toFixed(0) + '%"></i></div></div>'
        + '<div class="card kv"><span>Rete</span><span>' + esc(d.net) + '</span><span>Schermo</span><span>' + esc(d.screen) + '</span><span>Stato termico</span><span>' + (['normale', 'leggero', 'moderato', 'alto', 'critico', 'emergenza', 'spegnimento'][d.thermal] || '—') + '</span><span>Acceso da</span><span>' + up(d.uptime) + '</span></div>';
      else b.innerHTML = '<div class="card">Nel browser: ' + esc(navigator.userAgent) + '<br>CPU ' + (navigator.hardwareConcurrency || '?') + ' core · RAM ~' + (navigator.deviceMemory || '?') + ' GB · ' + (navigator.onLine ? 'online' : 'offline') + '<br><small>Nell’app Android vedi batteria, memoria, rete e temperatura veri.</small></div>'; }
    else { const g = this.g, f = g.foot, bt = this.suitBattery();
      b.innerHTML = '<div class="card"><b>Tuta del pilota KAGE</b><br><small>firmware AmpybiOS · KAGE NET</small></div><div class="card">Batteria tuta ' + bt + '%<div class="meter"><i style="width:' + bt + '%"></i></div>Ossigeno 100%<div class="meter"><i style="width:100%"></i></div></div>'
        + '<div class="card kv"><span>Dove</span><span>' + esc(this.where()) + '</span><span>Posizione</span><span>x ' + Math.round(f.x) + ' · z ' + Math.round(f.z) + '</span><span>Equipaggiamento</span><span>' + (f.gear === 'jet' ? 'jetpack' : f.gear === 'skate' ? 'skateboard' : 'a piedi') + '</span>'
        + '<span>Badge ODYSSEY</span><span>' + (g.star && g.star.badge ? 'indossato' : 'no') + '</span><span>Riparazioni KAGE TECH</span><span>' + (g.tech ? g.tech.st.fixed : 0) + '</span></div>'; } };
  draw(); this.timers.push(setInterval(draw, 2000));
};

AmpyOS.prototype.app_notif = function () {
  const real = this.real('notif'), b = this.frame('🔔 Notifiche · ' + (real ? 'REALI' : 'DEL GIOCO'), '', '<button class="btn" data-act="mode:notif">' + (real ? 'messaggi del gioco' : 'notifiche vere') + '</button>');
  const draw = () => { if (this.app !== 'notif') return; const B = BR();
    if (real) { if (!B) { b.innerHTML = '<div class="card">Le notifiche vere si vedono nell’app Android di Cybercity 3D.</div>'; return; }
      const n = J(B.notifications()) || {};
      if (!n.granted) { b.innerHTML = '<div class="card">Per vedere le notifiche del telefono dai a Cybercity 3D l’accesso alle notifiche (resta tutto sul telefono).<br><br><button class="btn" data-act="notifaccess">Apri le impostazioni di Android</button></div>'; return; }
      const it = (n.items || []).sort((a, c) => c.time - a.time);
      b.innerHTML = it.length ? it.map(x => '<div class="card n"><small>' + esc(x.app) + ' · ' + new Date(x.time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + '</small><br><b>' + esc(x.title) + '</b><br>' + esc(x.text) + '</div>').join('') : '<div class="card">Nessuna notifica ' + (n.connected ? '' : '(servizio in avvio)') + '</div>'; }
    else { const g = this.g, L = [];
      if (g.tech) for (const d of g.tech.D) for (const q of g.tech.faults(d)) L.push(['KAGE TECH', g.tech.dname(d) + ' · ' + q.c + ' ' + window.KageTechFaults[q.c].t]);
      if (g.star) L.push(['KAGE ODYSSEY', g.star.badge ? 'Badge attivo: premi BEAM IN per salire a bordo' : 'Il tuo badge ti aspetta sul modellino nel KAGE GARAGE']);
      if (g.mono) { const m = g.mono.st; L.push(['CUSTODI', m.read.length ? 'Hai letto ' + m.read.length + ' iscrizioni · ' + m.keys.length + ' chiavi' : 'Un monolite inciso ti aspetta in strada, vicino al punto di partenza']); }
      L.push(['KAGE XENO', 'Avvistamento sopra il quartiere est: mettiti sotto il raggio']);
      b.innerHTML = L.map(x => '<div class="card n"><small>' + esc(x[0]) + '</small><br>' + esc(x[1]) + '</div>').join(''); } };
  draw(); this.timers.push(setInterval(draw, 3000));
};

AmpyOS.prototype.app_sensors = function () {
  const real = this.real('sensors'), b = this.frame('🧭 Sensori · ' + (real ? 'REALI' : 'DEL GIOCO'), '<div class="card kv" id="aosS"></div><canvas style="width:100%;height:42vmin;display:block"></canvas>', '<button class="btn" data-act="mode:sensors">' + (real ? 'sensori del gioco' : 'sensori veri') + '</button>');
  const S2 = { a: [0, 0, 0], r: [0, 0, 0], o: [0, 0, 0], geo: null }, hist = [];
  if (real) { this.motion = e => { const a = e.accelerationIncludingGravity || {}, r = e.rotationRate || {}; S2.a = [a.x || 0, a.y || 0, a.z || 0]; S2.r = [r.alpha || 0, r.beta || 0, r.gamma || 0]; };
    this.orient = e => { S2.o = [e.alpha || 0, e.beta || 0, e.gamma || 0]; }; addEventListener('devicemotion', this.motion); addEventListener('deviceorientation', this.orient);
    try { if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) DeviceMotionEvent.requestPermission().catch(() => { }); } catch (e) { }
    if (navigator.geolocation) this.geoW = navigator.geolocation.watchPosition(p => { S2.geo = p.coords; }, () => { }, { enableHighAccuracy: true }); }
  const draw = () => { if (this.app !== 'sensors') return; const g = this.g, f = g.foot, el = b.querySelector('#aosS'), cv = b.querySelector('canvas'); let head, rows;
    if (real) { head = S2.o[0]; rows = [['Accelerometro', S2.a.map(v => v.toFixed(2)).join(' · ') + ' m/s²'], ['Giroscopio', S2.r.map(v => v.toFixed(1)).join(' · ') + ' °/s'], ['Orientamento', S2.o.map(v => v.toFixed(0)).join(' · ') + ' °'],
      ['GPS', S2.geo ? S2.geo.latitude.toFixed(5) + ', ' + S2.geo.longitude.toFixed(5) + ' ± ' + Math.round(S2.geo.accuracy) + ' m' : 'in attesa…']]; hist.push(Math.hypot(...S2.a)); }
    else { head = ((-(f.h) * 180 / PI) % 360 + 360) % 360; const sp = Math.abs(f.v || 0); rows = [['Bussola', Math.round(head) + '°'], ['Velocità', (sp * 3.6).toFixed(1) + ' km/h'], ['Posizione', 'x ' + Math.round(f.x) + ' · z ' + Math.round(f.z)], ['Quota', (f.y || 0).toFixed(1) + ' m'], ['Mondo', this.where()]]; hist.push(sp); }
    if (hist.length > 120) hist.shift();
    el.innerHTML = rows.map(r => '<span>' + r[0] + '</span><span>' + esc(r[1]) + '</span>').join('');
    const w = cv.clientWidth, h = cv.clientHeight; cv.width = w; cv.height = h; const c = cv.getContext('2d'), ac = getComputedStyle(this.root).getPropertyValue('--ac'), sc = getComputedStyle(this.root).getPropertyValue('--sc');
    const R = h * 0.4; c.strokeStyle = sc; c.lineWidth = 2; c.beginPath(); c.arc(h / 2, h / 2, R, 0, 7); c.stroke(); c.save(); c.translate(h / 2, h / 2); c.rotate(-head * PI / 180); c.fillStyle = ac; c.beginPath(); c.moveTo(0, -R * 0.9); c.lineTo(R * 0.12, 0); c.lineTo(-R * 0.12, 0); c.fill(); c.fillStyle = '#fff'; c.font = '12px system-ui'; c.fillText('N', -4, -R - 4); c.restore();
    const mx = Math.max(1, ...hist); c.strokeStyle = ac; c.beginPath(); hist.forEach((v, i) => { const x = h + 10 + i / 120 * (w - h - 20), y = h - 10 - v / mx * (h - 20); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); };
  draw(); this.timers.push(setInterval(draw, 120));
};

AmpyOS.prototype.app_torch = function () {
  const real = this.real('torch'), on = !!this.torchOn;
  const b = this.frame('🔦 Torcia · ' + (real ? 'REALE' : 'SIMULATA'), '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:2vmin"><button class="btn ' + (on ? 'on' : '') + '" data-act="torch" style="width:24vmin;height:24vmin;border-radius:50%;font-size:8vmin">' + (on ? '💡' : '🔦') + '</button><small>' + (real ? (BR() ? 'accende il flash vero del telefono' : 'nel browser: lo schermo si illumina') : 'lo schermo del tablet si illumina') + '</small></div>', '<button class="btn" data-act="mode:torch">' + (real ? 'simulata' : 'reale') + '</button>');
  b.style.background = on && (!real || !BR()) ? '#fff' : '';
};

AmpyOS.prototype.app_ampy = function () {
  const B = BR(), b = this.frame('◈ App Ampy · sul telefono', '', '<button class="btn" data-act="allapps">' + (this.allApps ? 'solo Ampy' : 'tutte le app') + '</button>');
  if (!B) { b.innerHTML = '<div class="card">Qui compaiono le tue app AmpyXXX installate sul telefono (AmpyCam, AmpyMaps, AmpyPad, AmpyTube…) e si aprono con un tocco. Funziona nell’app Android di Cybercity 3D.</div>'; return; }
  const L = J(B.apps(!!this.allApps)) || [];
  b.innerHTML = L.length ? '<div class="grid">' + L.sort((x, y) => x.label.localeCompare(y.label)).map(a => '<button class="ico" data-act="run:' + esc(a.pkg) + '">' + (a.icon ? '<img src="' + a.icon + '">' : '<i>◈</i>') + esc(a.label) + '</button>').join('') + '</div>'
    : '<div class="card">Nessuna app “Ampy” trovata sul telefono. Prova “tutte le app”.</div>';
};

AmpyOS.prototype.app_settings = function () {
  const c = this.cfg;
  this.frame('⚙ Impostazioni · AmpyCore', '<div class="card"><b>Tema AmpybiOS</b><br>' + Object.keys(THEMES).map(k => '<button class="btn ' + (c.theme === k ? 'on' : '') + '" data-act="theme:' + k + '">' + k + '</button>').join(' ') + '</div>'
    + '<div class="card"><b>Funzioni simulate o reali</b><br><small>Scegli per ogni funzione se usare il mondo del gioco o il tuo telefono.</small>'
    + Object.keys(DUAL).map(k => '<div style="display:flex;align-items:center;gap:1vmin;margin-top:1vmin"><span style="flex:1">' + DUAL[k][0] + '<br><small>' + (this.real(k) ? DUAL[k][2] : DUAL[k][1]) + '</small></span><button class="btn ' + (!this.real(k) ? 'on' : '') + '" data-act="set:' + k + ':sim">SIMULATO</button><button class="btn ' + (this.real(k) ? 'on' : '') + '" data-act="set:' + k + ':real">REALE</button></div>').join('') + '</div>'
    + '<div class="card"><b>Foto</b><br><button class="btn ' + (c.savePhone ? 'on' : '') + '" data-act="savephone">' + (c.savePhone ? '◉' : '○') + ' salva anche in Pictures/Cybercity sul telefono</button></div>'
    + '<div class="card"><small>Collegamento al telefono: ' + (BR() ? 'attivo (app Android)' : 'non disponibile nel browser: le funzioni reali usano solo le API web') + '. Nessun dato lascia il telefono.</small></div>');
};

AmpyOS.prototype.act = function (a, el) {
  const [k, v, w] = a.split(':');
  if (k === 'shoot') this.shoot();
  else if (k === 'flip') { this.facing = this.facing === 'user' ? 'environment' : 'user'; this.launch('camera'); }
  else if (k === 'cammode') { this.cfg.mode.camera = this.real('camera') ? 'sim' : 'real'; this.save(); this.launch('camera'); }
  else if (k === 'mode') { this.cfg.mode[v] = this.real(v) ? 'sim' : 'real'; this.save(); this.launch(this.app); }
  else if (k === 'set') { this.cfg.mode[v] = w; this.save(); if (v === 'torch') this.setTorch(false); this.launch('settings'); }
  else if (k === 'theme') { this.cfg.theme = v; this.save(); this.theme(); this.launch('settings'); }
  else if (k === 'savephone') { this.cfg.savePhone = !this.cfg.savePhone; this.save(); this.launch('settings'); }
  else if (k === 'torch') { this.setTorch(!this.torchOn); this.launch('torch'); }
  else if (k === 'zin' || k === 'zout') this.zoom = Math.max(0.4, Math.min(8, (this.zoom || 1.6) * (k === 'zin' ? 1.4 : 1 / 1.4)));
  else if (k === 'ph') this.photo(v);
  else if (k === 'phdel') DB.del(+v).then(() => this.launch('gallery'));
  else if (k === 'phsave') { const p = (this.photos || []).find(q => q.id === +v), B = BR(); if (p && B) { const s = B.saveImage(p.url, 'cybercity_' + p.id); this.toast(s ? 'salvata in ' + s : 'non riuscito'); } else this.toast('Nel browser usa “scarica”'); }
  else if (k === 'notifaccess') { const B = BR(); if (B) B.openNotificationAccess(); }
  else if (k === 'allapps') { this.allApps = !this.allApps; this.launch('ampy'); }
  else if (k === 'run') { const B = BR(); if (B && B.launch(a.slice(4))) { this.toast('apro l’app…'); } else this.toast('impossibile aprire l’app'); }
  void el;
};
AmpyOS.prototype.setTorch = function (on) { this.torchOn = on; if (this.real('torch') && BR()) { if (!BR().torch(on)) this.toast('nessun flash disponibile'); } };

window.AmpyOS = AmpyOS;
})();
