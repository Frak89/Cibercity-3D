/* KAGE BUILD · decorate Cybercity from the tablet. Pick a piece in the tablet (🏗 Costruisci): neon signs with your text,
 * street lamps, cyber trees, benches, planters, crates, barriers, holograms, traffic cones, carved monoliths with your own
 * inscription in the Custodians' glyphs, any model of the game, any asset imported with AmpyOBJ. The tablet closes and you
 * are in BUILD MODE: a ghost of the piece floats in front of you on a 0.5 m grid; turn (15°), raise / lower, scale, place,
 * pick up and delete the nearest piece, snap on/off. The whole decorated scene can be exported as one OBJ + MTL + texture zip
 * (each piece its own object, in world coordinates). Pieces are kept in localStorage. Key B in build mode = place. */
(function () {
'use strict';
const NR = window.NeonRun, KF = window.KageFleet, U = window.CarRenderUtil; if (!NR || !KF) return;
const { S, wrapD } = NR, PI = Math.PI, TAU = PI * 2;
const wrapP = v => ((v % S) + S) % S;
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const mat = (c, e, slot, mode, a) => ({ c, e: e || 0, slot: slot || 0, mode: mode || 0, a: a || [0, 0, 0] });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NEON = { ciano: [0, 1, 0.9], magenta: [1, 0.2, 0.75], ambra: [1, 0.62, 0.15], lime: [0.55, 1, 0.2], viola: [0.6, 0.35, 1], bianco: [1, 1, 1], rosso: [1, 0.15, 0.2] };

/* ---------------- text → pixels (any letter, through a tiny canvas) ---------------- */
function textPixels(str) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), H = 9; x.font = 'bold 9px monospace'; const W = Math.max(1, Math.ceil(x.measureText(str).width)) + 2;
  c.width = W; c.height = H + 2; x.font = 'bold 9px monospace'; x.fillStyle = '#fff'; x.textBaseline = 'top'; x.fillText(str, 1, 1);
  const d = x.getImageData(0, 0, c.width, c.height).data, px = []; for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[(j * c.width + i) * 4 + 3] > 110) px.push([i, j]);
  return { px, w: c.width, h: c.height };
}

/* ---------------- the pieces ---------------- */
const PIECES = {
  insegna: { name: 'Insegna al neon', ic: '🔤', params: { text: 'CYBERCITY', col: 'magenta' }, build(p) { const mb = new KF.MB(), T = textPixels(String(p.text || ' ').slice(0, 24)), s = 0.09, W = T.w * s, H = T.h * s, led = mat(NEON[p.col] || NEON.magenta, 1.6, 3);
    mb.part = 'pannello'; mb.box(0, H / 2 + 0.6, -0.06, W + 0.3, H + 0.3, 0.08, mat([0.04, 0.045, 0.05])); mb.part = 'pali'; for (const sx of [-1, 1]) mb.box(sx * (W / 2 - 0.1), 0.3, -0.06, 0.08, 0.6, 0.08, mat([0.2, 0.21, 0.23], 0, 2));
    mb.part = 'lettere'; for (const [i, j] of T.px) mb.box(-W / 2 + (i + 0.5) * s, 0.6 + H - (j + 0.5) * s, 0, s * 0.82, s * 0.82, 0.05, led);
    mb.part = 'cornice'; mb.box(0, H + 0.73, -0.02, W + 0.3, 0.03, 0.03, led); mb.box(0, 0.47, -0.02, W + 0.3, 0.03, 0.03, led); return mb.finish(); } },
  lampione: { name: 'Lampione', ic: '💡', params: { col: 'ciano' }, build(p) { const mb = new KF.MB(), met = mat([0.16, 0.17, 0.19], 0, 2), L = mat(NEON[p.col] || NEON.ciano, 1.8, 3);
    mb.part = 'base'; mb.cyl(0, 0.3, 0.22, 0.18, 12, met); mb.part = 'palo'; mb.cyl(0.3, 5.2, 0.07, 0.05, 10, met); mb.part = 'braccio'; mb.box(0.55, 5.2, 0, 1.2, 0.08, 0.12, met);
    mb.part = 'lampada'; mb.box(1.05, 5.1, 0, 0.5, 0.12, 0.25, met); mb.box(1.05, 5.03, 0, 0.44, 0.03, 0.2, L); mb.part = 'striscia_led'; mb.box(0.075, 2.8, 0, 0.02, 4.4, 0.02, L); return mb.finish(); } },
  albero: { name: 'Albero cyber', ic: '🌳', params: { col: 'lime' }, build(p) { const mb = new KF.MB(), L = NEON[p.col] || NEON.lime;
    mb.part = 'tronco'; mb.cyl(0, 2.4, 0.18, 0.1, 10, mat([0.2, 0.13, 0.08]));
    mb.part = 'chioma'; for (let k = 0; k < 7; k++) { const a = k * 2.4, r = k ? 0.7 : 0, y = 2.6 + (k % 3) * 0.35; mb.ellipsoid(Math.sin(a) * r, y, Math.cos(a) * r, 0.9, 0.7, 0.9, 12, 8, mat(L.map(v => v * 0.25 + 0.05), 0.12, 0)); }
    mb.part = 'lucciole'; for (let k = 0; k < 18; k++) { const a = k * 1.7, r = 0.6 + (k * 37 % 50) / 60; mb.ellipsoid(Math.sin(a) * r, 2.3 + (k * 53 % 140) / 100, Math.cos(a) * r, 0.04, 0.04, 0.04, 4, 3, mat(L, 1.8, 3, 7, [0, (k * 0.13) % 1, 0])); } return mb.finish(); } },
  panchina: { name: 'Panchina', ic: '🪑', params: {}, build() { const mb = new KF.MB(), w = mat([0.35, 0.22, 0.12]), m2 = mat([0.12, 0.12, 0.13], 0, 2);
    mb.part = 'seduta'; for (let k = 0; k < 3; k++) mb.box(0, 0.45, -0.18 + k * 0.18, 1.8, 0.04, 0.14, w); mb.part = 'schienale'; for (let k = 0; k < 2; k++) mb.box(0, 0.65 + k * 0.18, -0.3, 1.8, 0.12, 0.04, w);
    mb.part = 'gambe'; for (const sx of [-0.8, 0.8]) { mb.box(sx, 0.22, 0, 0.06, 0.45, 0.5, m2); mb.box(sx, 0.7, -0.3, 0.06, 0.5, 0.05, m2); } mb.part = 'led'; mb.box(0, 0.42, 0.2, 1.7, 0.02, 0.02, mat([0, 1, 0.9], 1.4, 3)); return mb.finish(); } },
  fioriera: { name: 'Fioriera', ic: '🪴', params: {}, build() { const mb = new KF.MB(); mb.part = 'vaso'; mb.box(0, 0.35, 0, 1.4, 0.7, 0.7, mat([0.18, 0.19, 0.21])); mb.box(0, 0.72, 0, 1.45, 0.04, 0.75, mat([0, 1, 0.9], 1.2, 3));
    mb.part = 'piante'; for (let k = 0; k < 9; k++) { const x = -0.55 + (k % 5) * 0.27, z = k < 5 ? -0.12 : 0.15; mb.ellipsoid(x, 0.85 + (k % 3) * 0.06, z, 0.16, 0.22, 0.16, 8, 6, mat([0.12 + (k % 3) * 0.05, 0.45, 0.18])); }
    mb.part = 'fiori'; for (let k = 0; k < 6; k++) mb.ellipsoid(-0.5 + k * 0.2, 1.05, (k % 2) * 0.2 - 0.1, 0.05, 0.05, 0.05, 6, 4, mat([[1, 0.3, 0.6], [1, 0.8, 0.2], [0.6, 0.4, 1]][k % 3], 0.4)); return mb.finish(); } },
  cassa: { name: 'Cassa', ic: '📦', params: { col: 'ambra' }, build(p) { const mb = new KF.MB(), b = mat([0.22, 0.23, 0.26], 0, 1), L = mat(NEON[p.col] || NEON.ambra, 1.2, 3);
    mb.part = 'cassa'; mb.box(0, 0.5, 0, 1, 1, 1, b); mb.part = 'spigoli'; for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) mb.box(x, 0.5, z, 0.06, 1.02, 0.06, mat([0.1, 0.1, 0.11]));
    mb.part = 'striscia'; mb.box(0, 0.7, 0.51, 0.8, 0.06, 0.01, L); mb.box(0.51, 0.7, 0, 0.01, 0.06, 0.8, L); return mb.finish(); } },
  barriera: { name: 'Barriera', ic: '🚧', params: { col: 'ambra' }, build(p) { const mb = new KF.MB(), L = mat(NEON[p.col] || NEON.ambra, 1.5, 3, 7, [0, 0, 0]);
    mb.part = 'blocco'; mb.box(0, 0.4, 0, 2, 0.8, 0.45, mat([0.75, 0.76, 0.78])); mb.part = 'bande'; for (let k = 0; k < 5; k++) { mb.push(KF.M(KF.T(-0.8 + k * 0.4, 0.45, 0.23), KF.RZ(0.7))); mb.box(0, 0, 0, 0.12, 0.5, 0.01, mat([0.9, 0.1, 0.1])); mb.pop(); }
    mb.part = 'luce'; mb.ellipsoid(0, 0.88, 0, 0.08, 0.08, 0.08, 8, 6, L); return mb.finish(); } },
  ologramma: { name: 'Ologramma', ic: '✨', params: { col: 'ciano' }, build(p) { const mb = new KF.MB(), L = NEON[p.col] || NEON.ciano;
    mb.part = 'proiettore'; mb.cyl(0, 0.25, 0.5, 0.6, 20, mat([0.1, 0.1, 0.12])); mb.disc(0.42, 20, 0.26, mat(L, 1.4, 3));
    mb.part = 'ologramma'; mb.push(KF.T(0, 1.4, 0)); for (let k = 0; k < 3; k++) { mb.push(KF.RX(k * PI / 3)); mb.torus(0.55, 0.02, 32, 4, mat(L, 1.2, 3, 1, [0, 0, 0])); mb.pop(); } mb.ellipsoid(0, 0, 0, 0.25, 0.25, 0.25, 12, 8, mat(L, 0.8, 3, 2, [0, 0, 0])); mb.pop(); return mb.finish(); } },
  cono: { name: 'Cono stradale', ic: '🔺', params: {}, build() { const mb = new KF.MB(); mb.part = 'base'; mb.box(0, 0.02, 0, 0.4, 0.04, 0.4, mat([0.1, 0.1, 0.1])); mb.part = 'cono'; mb.cyl(0.04, 0.7, 0.16, 0.03, 14, mat([1, 0.4, 0.05]));
    mb.part = 'banda'; mb.cyl(0.35, 0.45, 0.1, 0.085, 14, mat([1, 1, 1], 0.6, 3)); return mb.finish(); } },
  monolite: { name: 'Monolite inciso', ic: '𓂀', params: { text: 'BENVENUTO A CASA' }, build(p) { const KG = window.KageGlyph; return KG ? KG.buildMonolith(String(p.text || '').toUpperCase().slice(0, 60), true) : new KF.MB().finish(); } } };

function Editor(game) {
  this.g = game; this.meshes = {}; this.on = false; this.ghost = null; this.snap = true;
  try { this.items = JSON.parse(LS.get('kageBuild', '[]')); } catch (e) { this.items = []; }
  this.buildUI();
}
Editor.prototype.save = function () { LS.set('kageBuild', JSON.stringify(this.items)); };
Editor.prototype.key = function (d) { return d.type + ':' + JSON.stringify(d.params || {}); };
/** the mesh of a piece: built-in, a game model (type 'model:<id>') */
Editor.prototype.raw = function (d) {
  if (PIECES[d.type]) return PIECES[d.type].build(d.params || {});
  if (d.type.startsWith('model:')) { const L = window.AmpyObjLib; const c = (this.cat = this.cat || (L ? L.catalogue() : [])).find(x => x[0] === d.type.slice(6)); if (c) return c[2](); }
  return null;
};
Editor.prototype.mesh = function (d) { const k = this.key(d); if (!this.meshes[k]) { const m = this.raw(d); if (!m) return null; const vm = this.g.vmesh(m); vm.raw = m; this.meshes[k] = vm; } return this.meshes[k]; };
/** start build mode with a piece */
Editor.prototype.begin = function (type, params) {
  const f = this.g.foot; if (!f || !f.active) return;
  this.on = true; this.ghost = { type, params: params || Object.assign({}, (PIECES[type] || {}).params || {}), h: f.h + PI, s: 1, dy: 0 }; this.ui.style.display = 'flex'; this.say('MODALITÀ COSTRUZIONE · ' + this.title(type));
};
Editor.prototype.title = function (type) { if (PIECES[type]) return PIECES[type].name; if (type.startsWith('model:')) { const c = (this.cat || []).find(x => x[0] === type.slice(6)); return c ? c[1] : type; } return type; };
Editor.prototype.end = function () { this.on = false; this.ghost = null; this.ui.style.display = 'none'; };
Editor.prototype.say = function (s) { this.msg = s; this.msgT = 2.6; };
/** where the ghost goes: in front of the pilot, on the grid */
Editor.prototype.spot = function () { const f = this.g.foot, G = this.ghost, m = this.mesh(G), R = m && m.raw ? Math.max(1.2, Math.hypot(m.raw.bounds[3] - m.raw.bounds[0], m.raw.bounds[5] - m.raw.bounds[2]) * 0.5 * G.s) : 1.5, d = R + 1.6;
  let x = f.x + Math.sin(f.h) * d, z = f.z + Math.cos(f.h) * d; if (this.snap) { x = Math.round(x * 2) / 2; z = Math.round(z * 2) / 2; }
  return { x: wrapP(x), z: wrapP(z), y: Math.max(0, (f.y || 0) + G.dy) }; };
Editor.prototype.place = function () { const G = this.ghost; if (!G) return; const p = this.spot(); this.items.push({ type: G.type, params: G.params, x: p.x, y: p.y, z: p.z, h: G.h, s: G.s }); this.save(); this.say('✔ piazzato · ' + this.items.length + ' pezzi'); this.beep(660, 990); };
Editor.prototype.nearest = function (r) { const f = this.g.foot; let bi = -1, bd = r || 4; this.items.forEach((it, i) => { const d = Math.hypot(wrapD(it.x - f.x), wrapD(it.z - f.z)); if (d < bd) { bd = d; bi = i; } }); return bi; };
Editor.prototype.del = function () { const i = this.nearest(5); if (i < 0) { this.say('nessun pezzo vicino'); return; } this.items.splice(i, 1); this.save(); this.say('🗑 rimosso'); this.beep(400, 200); };
Editor.prototype.pick = function () { const i = this.nearest(5); if (i < 0) { this.say('nessun pezzo vicino'); return; } const it = this.items.splice(i, 1)[0]; this.save(); this.ghost = { type: it.type, params: it.params, h: it.h, s: it.s, dy: it.y - (this.g.foot.y || 0) }; this.say('✋ preso: ' + this.title(it.type)); };
Editor.prototype.beep = function (a, b) { if (!window.FleetAudio) return; if (!this.au) this.au = new FleetAudio(); this.au.start(); this.au.blip(a, b, 0.12, 0.08, 'triangle'); };
Editor.prototype.keyDown = function (code) { if (!this.on) return false;
  const G = this.ghost; if (code === 'KeyB' || code === 'Enter') { this.place(); return true; } if (code === 'Escape') { this.end(); return true; }
  if (code === 'KeyR') { G.h -= PI / 12; return true; } if (code === 'KeyF') { G.h += PI / 12; return true; } if (code === 'PageUp' || code === 'KeyT') { G.dy += 0.25; return true; } if (code === 'PageDown' || code === 'KeyG') { G.dy = Math.max(-2, G.dy - 0.25); return true; }
  if (code === 'Equal' || code === 'NumpadAdd') { G.s *= 1.15; return true; } if (code === 'Minus' || code === 'NumpadSubtract') { G.s /= 1.15; return true; } if (code === 'Delete' || code === 'Backspace') { this.del(); return true; } return false; };
Editor.prototype.update = function (dt) { this.msgT = Math.max(0, (this.msgT || 0) - dt); if (this.on && !(this.g.foot && this.g.foot.active)) this.end(); };
Editor.prototype.drawWorld = function (ctx) {
  const g = this.g; if (g.world !== 'city' || !g.fleet || (!this.items.length && !this.on)) return;
  const gl = g.gl, P = g.P.veh, u = P.u;
  gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uLit, 1); if (u.uDay) gl.uniform1f(u.uDay, g.dayK || 0); if (u.uBlur) gl.uniform1f(u.uBlur, 0); if (u.uRotA) gl.uniform1f(u.uRotA, ctx.t);
  const draw = (d, x, y, z, h, s) => { const m = this.mesh(d); if (!m) return; const rx = wrapD(x - ctx.camX), rz = wrapD(z - ctx.camZ); if (Math.hypot(rx, rz) > 320) return;
    gl.uniformMatrix4fv(u.uModel, false, U.mul(U.T(rx, y, rz), U.mul(U.RY(h), new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1])))); if (m.hinges && m.hinges.length && KF.setHinges) KF.setHinges(gl, u, m.hinges, m.hinges.map(() => 0)); g.draw(P, m); };
  for (const it of this.items) draw(it, it.x, it.y, it.z, it.h, it.s);
  if (this.on && this.ghost) { const p = this.spot(); gl.uniform1f(u.uLit, 1.5 + Math.sin(ctx.t * 6) * 0.4); draw(this.ghost, p.x, p.y, p.z, this.ghost.h, this.ghost.s); gl.uniform1f(u.uLit, 1); }
};
Editor.prototype.drawHud = function (hud) {
  if (!this.on && !(this.msgT > 0)) return; const c2 = hud.getContext('2d'), m = Math.min(hud.width, hud.height);
  const ln = this.on ? '🏗 ' + this.title(this.ghost.type) + ' · ' + Math.round((((this.ghost.h * 180 / PI) % 360) + 360) % 360) + '° · scala ' + this.ghost.s.toFixed(2) + ' · quota ' + this.ghost.dy.toFixed(2) + ' m · pezzi ' + this.items.length + (this.snap ? ' · griglia 0,5 m' : '') : '';
  c2.textAlign = 'center'; c2.font = (m * 0.02 | 0) + 'px system-ui'; if (ln) { const w = c2.measureText(ln).width + m * 0.03; c2.fillStyle = 'rgba(10,6,2,.7)'; c2.fillRect(hud.width / 2 - w / 2, m * 0.03, w, m * 0.04); c2.fillStyle = '#ffd27a'; c2.fillText(ln, hud.width / 2, m * 0.058); }
  if (this.msgT > 0) { c2.font = 'bold ' + (m * 0.026 | 0) + 'px system-ui'; c2.fillStyle = '#fff2c8'; c2.fillText(this.msg, hud.width / 2, m * 0.12); } c2.textAlign = 'left';
};
Editor.prototype.buildUI = function () {
  const st = document.createElement('style');
  st.textContent = '#buildUI{position:fixed;left:50%;bottom:3vmin;transform:translateX(-50%);z-index:25;display:none;gap:1vmin;flex-wrap:wrap;justify-content:center;max-width:94vw}#buildUI button{font:bold 2.1vmin system-ui;color:#fff2c8;background:rgba(14,9,3,.78);border:2px solid rgba(255,190,90,.8);border-radius:1.6vmin;padding:1.1vmin 1.6vmin;cursor:pointer}#buildUI button.big{border-color:#9dff8a;color:#d8ffd0}';
  document.head.appendChild(st);
  const ui = this.ui = document.createElement('div'); ui.id = 'buildUI'; document.body.appendChild(ui);
  const B = (l, fn, c) => { const b = document.createElement('button'); b.textContent = l; if (c) b.className = c; const go = e => { e.preventDefault(); e.stopPropagation(); fn(); }; b.addEventListener('click', go); b.addEventListener('touchstart', go); ui.appendChild(b); return b; };
  B('⟲', () => { this.ghost.h += PI / 12; }); B('⟳', () => { this.ghost.h -= PI / 12; }); B('⤒', () => { this.ghost.dy += 0.25; }); B('⤓', () => { this.ghost.dy = Math.max(-2, this.ghost.dy - 0.25); });
  B('＋', () => { this.ghost.s *= 1.15; }); B('－', () => { this.ghost.s /= 1.15; }); B('✔ PIAZZA', () => this.place(), 'big'); B('✋ PRENDI', () => this.pick()); B('🗑', () => this.del());
  this.bSnap = B('# GRIGLIA', () => { this.snap = !this.snap; this.bSnap.style.opacity = this.snap ? 1 : 0.5; }); B('📱', () => { this.end(); if (this.g.aos) this.g.aos.open('build'); }); B('✕ FINE', () => this.end());
};

/* ---------------- whole-scene export: every piece as its own object, world coordinates ---------------- */
Editor.prototype.sceneMesh = function () {
  const P = [], N = [], C = [], A = [], I = [], parts = []; let base = 0;
  this.items.forEach((it, n) => { const m = this.mesh(it); if (!m || !m.raw) return; const r = m.raw, c = Math.cos(it.h), s = Math.sin(it.h), k = it.s, nm = (PIECES[it.type] ? it.type : this.title(it.type).replace(/[^\w]+/g, '_').toLowerCase()) + '_' + (n + 1);
    for (let v = 0; v < r.pos.length / 3; v++) { const x = r.pos[v * 3] * k, y = r.pos[v * 3 + 1] * k, z = r.pos[v * 3 + 2] * k, nx = r.norm[v * 3], nz = r.norm[v * 3 + 2];
      P.push(it.x + x * c + z * s, it.y + y, it.z - x * s + z * c); N.push(nx * c + nz * s, r.norm[v * 3 + 1], -nx * s + nz * c);
      C.push(r.col[v * 4], r.col[v * 4 + 1], r.col[v * 4 + 2], r.col[v * 4 + 3]); A.push(Math.floor(r.anim[v * 4] / 8) * 8, 0, 0, 0); parts.push(nm + '__' + ((r.parts && r.parts[v]) || 'corpo')); }
    for (const q of r.idx) I.push(q + base); base += r.pos.length / 3; });
  return { pos: new Float32Array(P), norm: new Float32Array(N), col: new Float32Array(C), anim: new Float32Array(A), idx: I, parts, hinges: [] };
};

/* ---------------- the tablet app ---------------- */
function install(OS) {
  OS.prototype.app_build = function () {
    const E = this.g.editor; if (!E) { this.frame('🏗 Costruisci', 'non disponibile'); return; }
    const L = window.AmpyObjLib; E.cat = E.cat || (L ? L.catalogue() : []);
    const imported = this.g.ampyobj ? this.g.ampyobj.assets : [];
    this.frame('🏗 Costruisci · KAGE BUILD', '<div class="card"><b>Decora Cybercity</b><br><small>Scegli un pezzo: il tablet si chiude e lo piazzi davanti a te (griglia 0,5 m, rotazione 15°). Pezzi tuoi in città: ' + E.items.length + '.</small><br><br>'
      + '<span style="display:inline-flex;gap:1vmin;align-items:center;flex-wrap:wrap">Testo <input id="bTxt" value="' + esc(this.bTxt || 'CYBERCITY') + '" maxlength="24" style="background:var(--sf);color:var(--fg);border:1px solid var(--ac);border-radius:1vmin;padding:.6vmin;font:inherit;width:22vmin"> Colore '
      + Object.keys(NEON).map(k => '<button class="btn ' + ((this.bCol || 'magenta') === k ? 'on' : '') + '" data-act="bcol:' + k + '" style="color:rgb(' + NEON[k].map(v => Math.round(v * 255)).join(',') + ')">●</button>').join('') + '</span></div>'
      + '<div class="card"><b>Pezzi</b><div class="grid" style="margin-top:1vmin">' + Object.entries(PIECES).map(([k, p]) => '<button class="ico" data-act="bnew:' + k + '"><i>' + p.ic + '</i>' + esc(p.name) + '</button>').join('') + '</div></div>'
      + (imported.length ? '<div class="card"><b>Asset importati (AmpyOBJ)</b><br>' + imported.map(A => '<button class="btn" data-act="bimp:' + A.id + '">◳ ' + esc(A.rec.name) + '</button>').join(' ') + '</div>' : '')
      + '<div class="card"><b>Modelli del gioco</b><br>' + E.cat.map(c => '<button class="btn" data-act="bmod:' + esc(c[0]) + '" style="margin:.3vmin">' + esc(c[1]) + '</button>').join('') + '</div>'
      + '<div class="card"><b>La tua scena</b><br><button class="btn" data-act="bexp">⬆ esporta la scena (OBJ + MTL + texture)</button> <button class="btn" data-act="bclear">🗑 svuota tutto</button><div id="bLog"></div></div>');
    const ti = this.view().querySelector('#bTxt'); ti.addEventListener('input', () => { this.bTxt = ti.value; });
  };
  const act0 = OS.prototype.act;
  OS.prototype.act = function (a, el) { const E = this.g.editor, [k, v] = [a.split(':')[0], a.slice(a.indexOf(':') + 1)];
    if (!E || !/^b(col|new|imp|mod|exp|clear)$/.test(k)) return act0.call(this, a, el);
    if (k === 'bcol') { this.bCol = v; this.launch('build'); return; }
    const go = (type, params) => { this.close(); setTimeout(() => E.begin(type, params), 3000); };
    if (k === 'bnew') { const P = Object.assign({}, PIECES[v].params); if ('text' in P) P.text = (this.bTxt || P.text).toUpperCase(); if ('col' in P && this.bCol) P.col = this.bCol; go(v, P); }
    if (k === 'bmod') go('model:' + v, {});
    if (k === 'bimp') { const A = this.g.ampyobj.assets.find(x => x.id === +v); if (A) { this.close(); setTimeout(() => { this.g.ampyobj.placeFront(A); }, 3000); this.toast('lo trovi davanti a te: spostalo da AmpyOBJ'); } }
    if (k === 'bclear') { if (this.bSure) { E.items = []; E.save(); this.bSure = false; this.launch('build'); } else { this.bSure = true; this.toast('Tocca di nuovo per svuotare la scena'); setTimeout(() => { this.bSure = false; }, 3000); } }
    if (k === 'bexp') { const log = this.view().querySelector('#bLog'), L = window.AmpyObjLib; if (!E.items.length) { log.textContent = 'nessun pezzo da esportare'; return; } log.textContent = 'esportazione…';
      setTimeout(async () => { try { const r = await L.exportMesh(E.sceneMesh(), 'cybercity_scena', 'La mia Cybercity · scena KAGE BUILD (coordinate del mondo)'), z = L.zip(r.files), where = await L.saveZip(z, 'cybercity_scena.zip');
          log.innerHTML = '✓ ' + E.items.length + ' pezzi · ' + r.tris.toLocaleString('it-IT') + ' triangoli · salvato in ' + esc(where); this.vib(25); } catch (er) { log.textContent = '✖ ' + er.message; } }, 30); }
  };
}
if (window.AmpyOS) install(window.AmpyOS);
window.KageEditor = Editor; window.KageBuildPieces = PIECES;
})();
