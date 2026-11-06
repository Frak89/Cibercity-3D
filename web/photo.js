/* AmpyCam · photo mode in the game. From the tablet's Camera (📸 MODALITÀ FOTO) or key P on foot: the tablet goes away,
 * the camera flies free around the pilot like a little drone (drag = orbit, two fingers / wheel = distance, ⤒⤓ height,
 * FOV), the HUD disappears, and you take photos with filters inspired by AmpyRAW Cyberdark (Cyberdark, Neon, Noir, VHS,
 * Infrarosso, Pellicola, Naturale), a self-timer (3 / 10 s) and a pose for your pilot (wave, cheer, arms crossed…).
 * Photos go to the tablet's Gallery and, if chosen in the settings, to Pictures/Cybercity on the phone. The same filters
 * are applied live in the tablet's Camera preview. */
(function () {
'use strict';
const NR = window.NeonRun; if (!NR) return;
const { wrapD } = NR, PI = Math.PI;
const FILTERS = {
  naturale: { name: 'Naturale', css: 'none' },
  cyberdark: { name: 'Cyberdark', css: 'contrast(1.25) saturate(1.25) brightness(0.92)', tone: [['rgba(0,90,120,0.22)', 'soft-light'], ['rgba(255,0,140,0.12)', 'overlay']], glow: 0.35, grain: 0.18, vig: 0.65 },
  neon: { name: 'Neon', css: 'contrast(1.12) saturate(1.8)', glow: 0.55, vig: 0.4 },
  noir: { name: 'Noir', css: 'grayscale(1) contrast(1.5) brightness(0.95)', grain: 0.22, vig: 0.75 },
  vhs: { name: 'VHS', css: 'saturate(1.35) contrast(1.05) blur(0.4px)', tone: [['rgba(255,60,200,0.08)', 'screen']], scan: 1, shift: 1, grain: 0.12, vig: 0.4 },
  infrarosso: { name: 'Infrarosso', css: 'hue-rotate(150deg) saturate(2.2) contrast(1.15)', tone: [['rgba(255,40,80,0.18)', 'overlay']], vig: 0.5 },
  pellicola: { name: 'Pellicola', css: 'sepia(0.35) contrast(1.08) saturate(0.9)', tone: [['rgba(255,200,120,0.12)', 'soft-light']], grain: 0.25, vig: 0.55 } };
const POSES = ['in piedi', 'saluto', 'esulta', 'braccia conserte', 'indica', 'mani sui fianchi', 'pensieroso'];
let noise = null;
const grainTex = () => { if (noise) return noise; noise = document.createElement('canvas'); noise.width = noise.height = 256; const x = noise.getContext('2d'), d = x.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return noise; };
/** draw src (a canvas) into ctx (w × h, cover) through filter k */
function render(ctx, src, w, h, k, t) {
  const F = FILTERS[k] || FILTERS.naturale, sw = src.width, sh = src.height, s = Math.max(w / sw, h / sh), dw = sw * s, dh = sh * s, ox = (w - dw) / 2, oy = (h - dh) / 2;
  ctx.save(); ctx.filter = F.css; try { ctx.drawImage(src, ox, oy, dw, dh); } catch (e) { } ctx.filter = 'none';
  if (F.shift) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.25; try { ctx.drawImage(src, ox + w * 0.004, oy, dw, dh); } catch (e) { } ctx.globalAlpha = 1; }
  if (F.glow) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = F.glow; ctx.filter = 'blur(' + Math.round(Math.max(w, h) / 160) + 'px) brightness(1.3) ' + (F.css === 'none' ? '' : F.css); try { ctx.drawImage(src, ox, oy, dw, dh); } catch (e) { } ctx.filter = 'none'; ctx.globalAlpha = 1; }
  for (const [col, op] of F.tone || []) { ctx.globalCompositeOperation = op; ctx.fillStyle = col; ctx.fillRect(0, 0, w, h); }
  ctx.globalCompositeOperation = 'source-over';
  if (F.scan) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1); }
  if (F.grain) { ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = F.grain; const n = grainTex(), o = (t || 0) * 97 % 256; ctx.fillStyle = ctx.createPattern(n, 'repeat'); ctx.translate(-o, -o * 0.7); ctx.fillRect(o, o * 0.7, w, h); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  if (F.vig) { const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + F.vig + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}

function Photo(game) {
  this.g = game; this.on = false; this.cam = { yaw: 0, pit: 0.12, d: 3.6, h: 1.4, fov: 58 }; this.filter = 'cyberdark'; this.pose = 0; this.timer = 0; this.count = 0;
  this.buildUI();
  const OF = window.KageOnFoot; if (OF) { const c0 = OF.prototype.camera, d0 = OF.prototype.draw, self = this;
    OF.prototype.camera = function (view, dt) { const cv = c0.call(this, view, dt); return self.on ? self.camera(this, cv) : cv; };
    OF.prototype.draw = function (ctx) { if (self.on && self.pose) { const a = this.anim; this.anim = POSES[self.pose]; const r = d0.call(this, ctx); this.anim = a; return r; } return d0.call(this, ctx); }; }
}
Photo.prototype.begin = function () { const f = this.g.foot; if (!f || !f.active || this.g.veh) return; this.on = true; this.cam.yaw = (f.camH !== undefined ? f.camH : f.h) + PI; this.ui.style.display = 'block'; document.body.classList.add('photomode'); this.sync(); };
Photo.prototype.end = function () { this.on = false; this.count = 0; this.ui.style.display = 'none'; document.body.classList.remove('photomode'); };
Photo.prototype.key = function (code) { const f = this.g.foot;
  if (code === 'KeyP' && f && f.active && !this.g.veh && !(this.g.aos && this.g.aos.isOpen)) { this.on ? this.end() : this.begin(); return true; }
  if (!this.on) return false; if (code === 'Space' || code === 'Enter') { this.shoot(); return true; } if (code === 'Escape') { this.end(); return true; }
  if (code === 'KeyF') { this.nextFilter(); return true; } return false; };
/** free orbit camera around the pilot (offsets relative to the car, like every on-foot camera) */
Photo.prototype.camera = function (f, cv) {
  const c = this.g.c, C = this.cam, px = wrapD(f.x - c.x), pz = wrapD(f.z - c.z), y = (f.y || 0) + C.h, cp = Math.cos(C.pit);
  const e = [px + Math.sin(C.yaw) * cp * C.d, Math.max(0.25, y + Math.sin(C.pit) * C.d), pz + Math.cos(C.yaw) * cp * C.d];
  return Object.assign({}, cv, { e, l: [px, y - 0.2, pz], fov: C.fov });
};
Photo.prototype.nextFilter = function () { const K = Object.keys(FILTERS); this.filter = K[(K.indexOf(this.filter) + 1) % K.length]; this.sync(); };
Photo.prototype.shoot = function () {
  if (this.count > 0) return; const T = this.timer;
  if (T) { this.count = T; const tick = () => { if (!this.on) return; this.count--; this.beep(this.count ? 880 : 1500); if (this.count > 0) setTimeout(tick, 1000); else this.capture(); }; this.beep(880); setTimeout(tick, 1000); this.sync(); }
  else this.capture();
};
Photo.prototype.capture = function () {
  const gc = this.g.canvas || document.getElementById('c'), A = this.g.aos;
  this.flash = 1; this.ui.style.visibility = 'hidden';
  const g = this.g, once = cv => { g.post.splice(g.post.indexOf(once), 1); this.grab(cv); }; void gc; g.post.push(once);
};
Photo.prototype.grab = function (gc) { const A = this.g.aos; {
    const W = gc.width, H = gc.height, out = document.createElement('canvas'); out.width = W; out.height = H; const x = out.getContext('2d');
    render(x, gc, W, H, this.filter, performance.now() / 1000);
    x.font = '600 ' + Math.round(H * 0.022) + 'px system-ui'; x.fillStyle = 'rgba(255,255,255,.7)'; x.textAlign = 'right'; x.fillText('AmpyCam · ' + FILTERS[this.filter].name + ' · ' + (A ? A.where() : 'Cybercity') + ' · ' + new Date().toLocaleString('it-IT'), W - H * 0.03, H - H * 0.03);
    const url = out.toDataURL('image/jpeg', 0.92); this.ui.style.visibility = ''; this.count = 0; this.sync();
    if (A && A.savePhoto) A.savePhoto(url, 'AmpyCam · ' + FILTERS[this.filter].name); this.beep(1800, 500); if (A) A.vib(25);
    const fl = this.ui.querySelector('.pflash'); fl.style.opacity = 0.9; setTimeout(() => { fl.style.opacity = 0; }, 140);
  }
};
Photo.prototype.beep = function (a, b) { if (!window.FleetAudio) return; if (!this.au) this.au = new FleetAudio(); this.au.start(); this.au.blip(a, b || a, 0.12, 0.1, 'sine'); };
Photo.prototype.buildUI = function () {
  const st = document.createElement('style');
  st.textContent = '#photoUI{position:fixed;inset:0;z-index:50;display:none;pointer-events:none;font:600 2vmin system-ui;color:#fff}#photoUI .pv{position:absolute;inset:0;pointer-events:auto;touch-action:none}'
    + '#photoUI canvas.live{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}'
    + '#photoUI .bar{position:absolute;left:0;right:0;bottom:2.5vmin;display:flex;justify-content:center;align-items:center;gap:1.4vmin;pointer-events:auto;flex-wrap:wrap}'
    + '#photoUI .side{position:absolute;right:2vmin;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:1vmin;pointer-events:auto}'
    + '#photoUI button{font:600 1.9vmin system-ui;color:#fff;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.5);border-radius:3vmin;padding:1vmin 1.6vmin;cursor:pointer}'
    + '#photoUI .shut{width:11vmin;height:11vmin;border-radius:50%;border:.7vmin solid #fff;background:rgba(255,255,255,.25);padding:0;font-size:4vmin}'
    + '#photoUI .count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:200 22vmin system-ui;text-shadow:0 0 3vmin #000}'
    + '#photoUI .pflash{position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .25s} #photoUI .top{position:absolute;top:2vmin;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.4);padding:.6vmin 1.6vmin;border-radius:2vmin}'
    + 'body.photomode #hud,body.photomode #gearUI,body.photomode #techBtn,body.photomode #stUI,body.photomode #joy,body.photomode .tb,body.photomode #fbtn,body.photomode #langPill,body.photomode #vega{visibility:hidden!important}';
  document.head.appendChild(st);
  const ui = this.ui = document.createElement('div'); ui.id = 'photoUI';
  ui.innerHTML = '<canvas class="live"></canvas><div class="pv"></div><div class="top"></div><div class="count"></div><div class="side"><button data-p="up">⤒</button><button data-p="down">⤓</button><button data-p="zin">🔍＋</button><button data-p="zout">🔍－</button></div>'
    + '<div class="bar"><button data-p="filter"></button><button data-p="pose"></button><button class="shut" data-p="shoot">●</button><button data-p="timer"></button><button data-p="gal">🖼</button><button data-p="end">✕</button></div><div class="pflash"></div>';
  document.body.appendChild(ui);
  ['pointerdown', 'touchstart', 'mousedown', 'click', 'wheel'].forEach(ev => ui.addEventListener(ev, e => e.stopPropagation()));
  ui.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; const k = b.dataset.p, C = this.cam;
    if (k === 'shoot') this.shoot(); else if (k === 'end') this.end(); else if (k === 'filter') this.nextFilter();
    else if (k === 'pose') { this.pose = (this.pose + 1) % POSES.length; this.sync(); } else if (k === 'timer') { this.timer = this.timer === 0 ? 3 : this.timer === 3 ? 10 : 0; this.sync(); }
    else if (k === 'up') C.h = Math.min(30, C.h + 0.5); else if (k === 'down') C.h = Math.max(0.3, C.h - 0.5); else if (k === 'zin') C.fov = Math.max(18, C.fov - 6); else if (k === 'zout') C.fov = Math.min(95, C.fov + 6);
    else if (k === 'gal') { this.end(); if (this.g.aos) this.g.aos.open('gallery'); } });
  const pv = ui.querySelector('.pv'), pts = new Map(); let pd = 0;
  pv.addEventListener('pointerdown', e => { pv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); });
  pv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const o = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); const C = this.cam;
    if (pts.size === 1) { C.yaw -= (e.clientX - o[0]) * 0.008; C.pit = Math.max(-0.45, Math.min(1.4, C.pit + (e.clientY - o[1]) * 0.006)); }
    else { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) C.d = Math.max(0.8, Math.min(40, C.d * pd / d)); pd = d; } });
  const up = e => { pts.delete(e.pointerId); pd = 0; }; pv.addEventListener('pointerup', up); pv.addEventListener('pointercancel', up);
  pv.addEventListener('wheel', e => { e.preventDefault(); this.cam.d = Math.max(0.8, Math.min(40, this.cam.d * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  // live filtered preview (drawn over the game canvas)
  const live = ui.querySelector('canvas.live'), loop = gc => { if (!this.on) return; const w = Math.round(innerWidth * 0.5), h = Math.round(innerHeight * 0.5);
    if (live.width !== w) { live.width = w; live.height = h; } if (this.filter === 'naturale' || (this.g.power && !this.g.power.cfg().live)) { live.style.display = 'none'; return; } live.style.display = ''; render(live.getContext('2d'), gc, w, h, this.filter, performance.now() / 1000); };
  this.g.post.push(loop);
};
Photo.prototype.sync = function () { const q = s => this.ui.querySelector(s);
  q('[data-p=filter]').textContent = '🎞 ' + FILTERS[this.filter].name; q('[data-p=pose]').textContent = '🧍 ' + POSES[this.pose]; q('[data-p=timer]').textContent = '⏱ ' + (this.timer ? this.timer + ' s' : '—');
  q('.count').textContent = this.count > 0 ? this.count : ''; q('.top').textContent = '📸 AmpyCam · trascina per girare · due dita / rotella per avvicinarti'; };

window.KagePhoto = Photo; window.AmpyCamFX = { FILTERS, render };
})();
