/* KAGE NEXUS: an original ring portal with its dial console. Dial the seven locks, the membrane opens, cross it and you
 * are in ECO, the glitched parallel Cybercity (alien glyph code, shearing towers, watchers that vanish when you get close,
 * floating monoliths, a wrong sky and a low hum). The twin ring in ECO brings you back. Hooks into NeonRun.Game. */
(function () {
'use strict';
const NR = window.NeonRun, KF = window.KageFleet, U = window.CarRenderUtil;
const { S, GP, wrapD } = NR;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ECO_PAL = { name: 'ECO', fog: [0.012, 0.075, 0.04], top: [0.0, 0.014, 0.008], winA: [0.25, 1.0, 0.45], winB: [0.7, 1.0, 0.3], winC: [1.0, 0.15, 0.55],
  neonA: [0.15, 1.0, 0.45], neonB: [1.0, 0.1, 0.55], sun: [0.55, 1.0, 0.6], sunDir: [0.0, 0.32, 1.0], stripes: 0, fogDen: 0.0065 };
const RINGS = [
  { x: 4 * GP, y: -2.8, z: 2 * GP + 42, h: 0, con: { x: 4 * GP - 7.5, y: 0, z: 2 * GP + 14, h: Math.PI } },                 // on the avenue at x = 336
  { x: 880, y: -3.4, z: 990, h: 0, con: { x: 864, y: -0.9, z: 968, h: 0.6 }, water: true }                                  // floating in the harbour lagoon
];

function Nexus(game) {
  this.g = game;
  this.ring = game.vmesh(KF.buildNexus()); this.console = game.vmesh(KF.buildConsole());
  this.watcher = game.vmesh(KF.buildWatcher()); this.mono = game.vmesh(KF.buildMonolith());
  { const mb = new KF.MB(); mb.box(0, -0.25, 0, 3.4, 0.5, 3.4, { c: [0.05, 0.05, 0.06], e: 0, slot: 0 }); mb.box(0, 0.02, 0, 3.0, 0.04, 3.0, { c: [0.2, 1, 0.75], e: 0.6, slot: 3 }); this.pontoon = game.vmesh(mb.finish()); }
  this.P = game.P; this.st = 'idle'; this.locks = 0; this.portal = 0; this.t = 0; this.spin = 0; this.near = null; this.prevS = {}; this.burst = 0; this.eco = 0;
  // collision: ring sides + console on the avenue
  const add = (x0, z0, x1, z1, top) => { const bx = Math.floor((x0 + x1) / 2 / GP), bz = Math.floor((z0 + z1) / 2 / GP); game.city.blocks[(bz % 15) * 15 + (bx % 15)].push([x0, z0, x1, z1, top]); };
  const A = RINGS[0], R = KF.NEXUS.R;
  add(A.x - R - 0.7, A.z - 0.7, A.x - R + 0.6, A.z + 0.7, 15.4); add(A.x + R - 0.6, A.z - 0.7, A.x + R + 0.7, A.z + 0.7, 15.4);
  add(A.con.x - 1.2, A.con.z - 1.2, A.con.x + 1.2, A.con.z + 1.2, 1.5);
  // the eerie population of ECO: watchers at street corners, glyph monoliths drifting above the roofs
  let a = 1234; const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  this.watchers = []; for (let k = 0; k < 46; k++) { const ix = Math.floor(rnd() * 15), iz = Math.floor(rnd() * 15); if (NR.isWater(ix * GP, iz * GP)) continue; this.watchers.push({ x: ix * GP + (rnd() < 0.5 ? -6.5 : 6.5), z: iz * GP + (rnd() < 0.5 ? -6.5 : 6.5), ph: rnd() * 10 }); }
  this.monos = []; for (let k = 0; k < 24; k++) this.monos.push({ x: rnd() * S, z: rnd() * S, y: 70 + rnd() * 90, ph: rnd() * TAU, sp: 0.05 + rnd() * 0.12 });
  this.audio = { ctx: null };
}
Nexus.RINGS = RINGS; Nexus.ECO_PAL = ECO_PAL;
Nexus.prototype.player = function () { const g = this.g; if (g.veh && g.fleet) { const s = g.fleet.st; return { x: s.x, y: s.y + 0.5, z: s.z, kind: s.kind }; } return { x: g.c.x, y: (g.c.y || 0) + 0.7, z: g.c.z, kind: 'car' }; };
Nexus.prototype.dial = function () {
  if (this.st !== 'idle' || !this.near) return;
  this.st = 'dial'; this.t = 0; this.locks = 0; this.active = this.near; this.startAudio();
};
/** jump next to the nearest console (garage button) */
Nexus.prototype.goTo = function () {
  const g = this.g, k = g.veh ? g.veh.kind : 'car', water = k === 'boat' || k === 'galleon';
  const r = RINGS[water ? 1 : 0];
  if (g.veh && g.fleet) { const s = g.fleet.st; s.x = r.con.x + (water ? 14 : 2); s.z = r.con.z - (water ? 18 : 22); s.vx = s.vz = 0; s.h = 0; if (s.kind === 'drone') s.y = 3; g.fleet.camH = 0; }
  else { g.c.x = r.con.x + 3; g.c.z = r.con.z - 25; g.c.vx = g.c.vz = 0; g.c.h = 0; g.cam.h = 0; }
};
Nexus.prototype.update = function (dt) {
  const g = this.g, p = this.player();
  this.eco = g.world === 'eco' ? Math.min(1, this.eco + dt * 0.8) : Math.max(0, this.eco - dt * 1.5);
  this.burst = Math.max(0, this.burst - dt * 1.4);
  // nearest console in reach
  this.near = null; this.dist = 1e9;
  for (const r of RINGS) { if (r.water !== (p.kind === 'boat' || p.kind === 'galleon') && p.kind !== 'drone') continue;
    const d = Math.hypot(wrapD(r.con.x - p.x), wrapD(r.con.z - p.z)); if (d < this.dist) { this.dist = d; this.nearR = r; } if (d < (r.water ? 30 : 10)) this.near = r; }
  this.t += dt;
  if (this.st === 'dial') {
    this.spin += dt * 2.4 * (this.locks % 2 ? -1 : 1);
    if (this.t > 0.62) { this.t = 0; this.locks++; this.beep(260 + this.locks * 70); if (this.locks >= 7) { this.st = 'open'; this.t = 0; this.whoosh(); } }
  } else if (this.st === 'open') {
    this.portal = Math.min(1, this.portal + dt / 1.3); this.locks = 8;
    if (this.t > 45) { this.st = 'close'; this.t = 0; }
  } else if (this.st === 'close') {
    this.portal = Math.max(0, this.portal - dt / 1.1);
    if (this.portal <= 0) { this.st = 'idle'; this.locks = 0; this.active = null; }
  }
  // crossing the membrane of the open ring
  const r = this.active;
  if (r && this.portal > 0.8) {
    const nx = Math.sin(r.h), nz = Math.cos(r.h), dx = wrapD(p.x - r.x), dz = wrapD(p.z - r.z);
    const s = dx * nx + dz * nz, lat = dx * nz - dz * nx, up = p.y - (r.y + KF.NEXUS.cy);
    const prev = this.prevS[RINGS.indexOf(r)];
    if (prev !== undefined && Math.sign(prev) !== Math.sign(s) && Math.abs(s) < 6 && Math.hypot(lat, up) < KF.NEXUS.inner * 0.98) this.transit();
    this.prevS[RINGS.indexOf(r)] = s;
  } else this.prevS = {};
  this.updateAudio();
};
Nexus.prototype.transit = function () {
  const g = this.g;
  g.world = g.world === 'eco' ? 'city' : 'eco';
  this.burst = 1; this.whoosh(true);
  if (this.st === 'open') this.t = Math.max(this.t, 41);           // the ring shuts a few seconds later
};

/* ---------------- drawing ---------------- */
Nexus.prototype.drawWorld = function (ctx) {
  const gl = this.g.gl, P = this.P.veh, u = P.u, t = ctx.t;
  gl.useProgram(P.p); ctx.set(P);
  gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uDay, 0); gl.uniform1f(u.uBlur, 0); gl.uniform1f(u.uGlowOnly, 0);
  const M = (x, y, z, h, pitch) => U.mul(U.T(wrapD(x - ctx.camX), y, wrapD(z - ctx.camZ)), U.mul(U.RY(h), U.RX(pitch || 0)));
  const far = (x, z, d) => Math.hypot(wrapD(x - ctx.camX), wrapD(z - ctx.camZ)) > d;
  for (const r of RINGS) {
    if (far(r.x, r.z, 640)) continue;
    const act = r === this.active;
    gl.uniform1f(u.uLocks, act ? this.locks : 0); gl.uniform1f(u.uPortal, act ? this.portal : 0); gl.uniform1f(u.uPropA, act ? this.spin : 0);
    gl.uniformMatrix4fv(u.uModel, false, M(r.x, r.y, r.z, r.h)); this.g.draw(P, this.ring);
    gl.uniformMatrix4fv(u.uModel, false, M(r.con.x, r.con.y, r.con.z, r.con.h)); this.g.draw(P, this.console);
    if (r.water) { gl.uniformMatrix4fv(u.uModel, false, M(r.con.x, -0.95, r.con.z, r.con.h)); this.g.draw(P, this.pontoon); }
  }
  gl.uniform1f(u.uLocks, 0); gl.uniform1f(u.uPortal, 0); gl.uniform1f(u.uPropA, 0);
  if (this.g.world !== 'eco') return;
  // watchers: always facing you, only seen from afar, gone when you come close; they flicker
  const p = this.player();
  for (const w of this.watchers) {
    const dx = wrapD(w.x - p.x), dz = wrapD(w.z - p.z), d = Math.hypot(dx, dz);
    if (d < 55 || d > 420) continue;
    if (Math.sin(t * 7.3 + w.ph * 13) > 0.92) continue;
    gl.uniformMatrix4fv(u.uModel, false, M(w.x, 0, w.z, Math.atan2(-dx, -dz))); this.g.draw(P, this.watcher);
  }
  for (const m of this.monos) {
    if (far(m.x, m.z, 600)) continue;
    gl.uniformMatrix4fv(u.uModel, false, M(m.x, m.y + Math.sin(t * 0.3 + m.ph) * 6, m.z, t * m.sp + m.ph, Math.sin(t * 0.2 + m.ph) * 0.3)); this.g.draw(P, this.mono);
  }
};
/** full-screen ECO overlay (glyph code, tearing, dead pixels) + the transit burst; drawn after the post pass */
Nexus.prototype.drawOverlay = function (W, H, set) {
  if (this.eco <= 0.001 && this.burst <= 0.001) return;
  const gl = this.g.gl, E = this.P.eco; if (!E) return;
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(E.p); set(E); gl.uniform2f(E.u.uRes, W, H); gl.uniform1f(E.u.uEco, this.eco); gl.uniform1f(E.u.uBurst, this.burst);
  this.g.draw(E, this.g.M.quad);
};
Nexus.prototype.drawHud = function (hud) {
  const g = hud.getContext('2d'), W = hud.width, H = hud.height, m = Math.min(W, H);
  const A = this.g.world === 'eco' ? 'rgb(40,255,120)' : 'rgb(0,255,226)';
  g.textAlign = 'center';
  if (this.g.world === 'eco') {
    const msg = 'ECO · UNIVERSO PARALLELO', t = this.g.t; let out = '';
    for (let i = 0; i < msg.length; i++) out += Math.random() < 0.08 ? String.fromCharCode(0x30A0 + Math.floor(Math.random() * 90)) : msg[i];
    g.font = 'bold ' + (m * 0.03 | 0) + 'px monospace'; g.fillStyle = 'rgba(255,30,110,0.7)'; g.fillText(out, W / 2 + 2 + Math.sin(t * 40) * 2, m * 0.2);
    g.fillStyle = A; g.fillText(out, W / 2, m * 0.2);
  }
  let line = '';
  if (this.st === 'dial') line = 'COMPOSIZIONE INDIRIZZO · BLOCCO ' + this.locks + '/7';
  else if (this.st === 'open') line = this.g.world === 'eco' ? 'PORTALE APERTO · attraversalo per tornare a casa' : 'PORTALE APERTO · attraversalo per entrare in ECO';
  else if (this.near) line = 'KAGE NEXUS · premi N per comporre l\'indirizzo';
  else if (this.dist < 180) line = 'KAGE NEXUS · ' + Math.round(this.dist) + ' m';
  if (line) {
    g.font = 'bold ' + (m * 0.026 | 0) + 'px monospace';
    const w = g.measureText(line).width + m * 0.04;
    g.fillStyle = 'rgba(7,11,19,0.62)'; g.fillRect(W / 2 - w / 2, m * 0.235, w, m * 0.05);
    g.fillStyle = A; g.fillText(line, W / 2, m * 0.27);
    if (this.st === 'dial' || this.st === 'open') for (let k = 0; k < 7; k++) { g.fillStyle = k < this.locks ? 'rgb(255,80,200)' : 'rgba(255,255,255,0.18)'; g.fillRect(W / 2 + (k - 3.5) * m * 0.035 + m * 0.005, m * 0.295, m * 0.025, m * 0.012); }
  }
  g.textAlign = 'left';
};

/* ---------------- sound: dial beeps, the opening, the hum of ECO ---------------- */
Nexus.prototype.startAudio = function () {
  if (this.audio.ctx) { if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.audio.ctx = new C(), out = this.audio.out = ctx.createGain(); out.gain.value = 0.8; out.connect(ctx.destination);
    // ECO drone: two detuned low sines + a whisper band of noise, all faded in with uEco
    const eg = this.audio.eg = ctx.createGain(); eg.gain.value = 0; eg.connect(out);
    for (const f of [41, 43.7, 61.5]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.3; o.connect(g); g.connect(eg); o.start(); }
    const nb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / 900));
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; const bp = this.audio.bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 9;
    const wg = this.audio.wg = ctx.createGain(); wg.gain.value = 0; ns.connect(bp); bp.connect(wg); wg.connect(eg); ns.start();
  } catch (e) { this.audio.ctx = null; }
};
Nexus.prototype.beep = function (f) {
  const c = this.audio.ctx; if (!c) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.25);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(this.audio.out); o.start(t); o.stop(t + 0.35);
};
Nexus.prototype.whoosh = function (big) {
  const c = this.audio.ctx; if (!c) return; const t = c.currentTime, len = big ? 1.6 : 1.2;
  const nb = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = nb; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
  f.frequency.setValueAtTime(big ? 2400 : 200, t); f.frequency.exponentialRampToValueAtTime(big ? 120 : 2600, t + len * 0.8);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(big ? 0.7 : 0.4, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f); f.connect(g); g.connect(this.audio.out); s.start(t);
  const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(big ? 90 : 55, t); o.frequency.exponentialRampToValueAtTime(big ? 30 : 160, t + len);
  og.gain.setValueAtTime(0.15, t); og.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(og); og.connect(this.audio.out); o.start(t); o.stop(t + len);
};
Nexus.prototype.updateAudio = function () {
  const A = this.audio; if (!A.ctx) { if (this.g.world === 'eco') this.startAudio(); return; }
  const t = A.ctx.currentTime;
  A.eg.gain.setTargetAtTime(this.eco * 0.5, t, 0.5);
  // whispers: the noise band wanders and swells at random
  if (Math.random() < 0.01) { A.bp.frequency.setTargetAtTime(600 + Math.random() * 3000, t, 0.4); A.wg.gain.setTargetAtTime(Math.random() * 0.35, t, 0.6); }
};
window.KageNexus = Nexus;
})();
