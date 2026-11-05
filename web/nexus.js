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
  // ---- the deeper ECO: an eye in the sky, the city hanging upside down above you, a glyph cathedral, something in the black lagoon,
  //      your own shadow waiting down the street, and twelve shards of a lost address to find
  this.eyeM = game.vmesh(KF.buildEye()); this.shardM = game.vmesh(KF.buildShard()); this.segM = game.vmesh(KF.buildSerpentSeg());
  { const mb = new KF.MB(); mb.cyl(0, 420, 2.6, 0.6, 16, { c: [0.3, 1, 0.6], e: 0.35, slot: 0 }); this.column = game.vmesh(mb.finish()); }
  this.shards = [[2 * GP, 1.6, 6 * GP], [6 * GP, 1.6, GP], [GP, 1.6, 10 * GP], [5 * GP, 1.6, 12 * GP], [14 * GP, 1.6, 3 * GP], [3 * GP, 1.6, 3 * GP],
    [7 * GP, 252, 7 * GP], [4 * GP, 120, 10 * GP], [11 * GP, 90, 5 * GP], [760, -0.2, 1060], [1100, -0.2, 760], [924, -0.2, 962]];
  try { this.found = JSON.parse(localStorage.getItem('ecoShards') || '[]'); } catch (e) { this.found = []; }
  if (this.found.length >= this.shards.length) this.unlock(true);
  this.ghost = { x: 0, z: 0, h: 0, on: false, cool: 12 };
  this.msg = null; this.msgT = 20;
  this.MSGS = ['NON SEI IL PRIMO', 'TI STAVAMO ASPETTANDO', 'QUESTA CITTÀ SI RICORDA DI TE', 'GUARDA IN ALTO', 'IL FARO NON È VUOTO', 'TORNA INDIETRO',
    'SIAMO SEMPRE STATI QUI', 'CHI GUIDA, ADESSO?', 'LE STRADE CAMBIANO QUANDO NON GUARDI', 'DODICI FRAMMENTI · UN INDIRIZZO'];
}
/** all shards found: the ECO palette becomes available everywhere in the game (P cycles it) */
Nexus.prototype.unlock = function (quiet) {
  if (window.CYBER_PALETTES && !CYBER_PALETTES.eco) CYBER_PALETTES.eco = Object.assign({}, CYBER_PALETTES.neon, ECO_PAL, { name: 'ECO' });
  if (!quiet) { this.msg = { text: 'INDIRIZZO PERDUTO RICOMPOSTO · PALETTE ECO SBLOCCATA (P)', t: 0, d: 8 }; this.burst = 0.8; this.whoosh(true); }
};
Nexus.RINGS = RINGS; Nexus.ECO_PAL = ECO_PAL;
Nexus.prototype.player = function () { const g = this.g; if (g.foot && g.foot.active && !g.veh) return { x: g.foot.x, y: g.foot.y + 1, z: g.foot.z, kind: 'car' }; if (g.veh && g.fleet) { const s = g.fleet.st; return { x: s.x, y: s.y + 0.5, z: s.z, kind: s.kind }; } return { x: g.c.x, y: (g.c.y || 0) + 0.7, z: g.c.z, kind: 'car' }; };
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
  if (this.g.world === 'eco') this.updateEco(dt, p);
  this.updateAudio();
};
Nexus.prototype.updateEco = function (dt, p) {
  const g = this.g, t = g.t;
  // shards
  this.shards.forEach((q, i) => {
    if (this.found.includes(i)) return;
    if (Math.hypot(wrapD(q[0] - p.x), wrapD(q[2] - p.z)) < 6.5 && Math.abs(q[1] - p.y) < 6) {
      this.found.push(i); try { localStorage.setItem('ecoShards', JSON.stringify(this.found)); } catch (e) { }
      this.burst = 0.45; this.beep(880); this.beep(1320);
      if (this.found.length >= this.shards.length) this.unlock(false); else this.msg = { text: 'FRAMMENTO ' + this.found.length + '/12', t: 0, d: 3 };
    }
  });
  // watchers creep closer while you are not looking at them
  const hd = g.veh && g.fleet ? g.fleet.camH : g.cam.h, fx = Math.sin(hd), fz = Math.cos(hd);
  for (const w of this.watchers) {
    const dx = wrapD(w.x - p.x), dz = wrapD(w.z - p.z), d = Math.hypot(dx, dz);
    if (d > 70 && d < 500 && dx * fx + dz * fz < 0) { w.x -= dx / d * 2.2 * dt; w.z -= dz / d * 2.2 * dt; }
    if (d < 40) { w.x += dx / d * 260; w.z += dz / d * 260; }       // too close: it is somewhere else now
  }
  // your shadow waits ahead on the street, facing you; it vanishes when you come close
  const G = this.ghost;
  if (p.kind === 'car' || p.kind === 'drone') {
    if (!G.on) { G.cool -= dt; if (G.cool <= 0) {
      const ah = g.veh && g.fleet ? g.fleet.st.h : g.c.h, ax = p.x + Math.sin(ah) * 160, az = p.z + Math.cos(ah) * 160;
      const rx = Math.round(ax / GP) * GP, rz = Math.round(az / GP) * GP, onX = Math.abs(ax - rx) < Math.abs(az - rz);
      G.x = onX ? rx + 4.5 : ax; G.z = onX ? az : rz + 4.5; G.y = p.kind === 'drone' ? p.y - 0.5 : 0; G.on = true; G.kind = p.kind;
      if (NR.isWater(G.x, G.z)) { G.on = false; G.cool = 5; } } }
    if (G.on) { const dx = wrapD(p.x - G.x), dz = wrapD(p.z - G.z); G.h = Math.atan2(dx, dz); if (Math.hypot(dx, dz) < 38) { G.on = false; G.cool = 25 + Math.random() * 25; this.burst = Math.max(this.burst, 0.35); this.whoosh(); } }
  } else G.on = false;
  // whispered messages
  if (this.msg) { this.msg.t += dt; if (this.msg.t > this.msg.d) this.msg = null; }
  else { this.msgT -= dt; if (this.msgT <= 0) { this.msgT = 35 + Math.random() * 30; this.msg = { text: this.MSGS[Math.floor(Math.random() * this.MSGS.length)], t: 0, d: 5 }; } }
  // the thing in the lagoon surfaces every ~50 s
  const ph = (t % 52) / 52; this.serpentUp = ph < 0.45 ? Math.sin(ph / 0.45 * Math.PI) : 0;
  if (this.serpentUp > 0.9 && !this.groaned && Math.hypot(wrapD(924 - p.x), wrapD(924 - p.z)) < 380) { this.groaned = true; this.groan(); }
  if (this.serpentUp < 0.1) this.groaned = false;
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
  const S1 = (x, y, z, h, sc, pitch) => U.mul(M(x, y, z, h, pitch), new Float32Array([sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, 1]));
  // shards: spinning crystals
  this.shards.forEach((q, i) => { if (this.found.includes(i) || far(q[0], q[2], 600)) return;
    gl.uniformMatrix4fv(u.uModel, false, S1(q[0], q[1] + Math.sin(t * 1.7 + i) * 0.5, q[2], t * 1.3 + i, 1.3)); this.g.draw(P, this.shardM); });
  // the glyph cathedral: monoliths spiralling up around a column of light over downtown
  const CX = 7 * GP, CZ = 7 * GP;
  if (!far(CX, CZ, 700)) for (let k = 0; k < 44; k++) {
    const a = k * 0.55 + t * 0.06 * (k % 2 ? 1 : -1), r = 16 + k * 0.55;
    gl.uniformMatrix4fv(u.uModel, false, M(CX + Math.cos(a) * r, 26 + k * 5.2, CZ + Math.sin(a) * r, -a + Math.PI / 2, 0)); this.g.draw(P, this.mono);
  }
  // the thing in the black lagoon
  if (this.serpentUp > 0.01 && !far(924, 924, 650)) {
    const base = t * 0.045;
    for (let k = 0; k < 9; k++) {
      const a = base - k * 0.11, r = 78 + Math.sin(a * 3) * 8, x = 924 + Math.cos(a) * r, z = 924 + Math.sin(a) * r;
      const y = -1.2 - 4.2 + this.serpentUp * 4.6 * Math.sin(Math.min(Math.PI, (k + 1) / 9 * Math.PI + 0.2)) + Math.sin(t * 0.8 - k * 0.7) * 0.4;
      gl.uniformMatrix4fv(u.uModel, false, S1(x, y, z, -a, 1 + (k < 2 ? 0.25 : 0) - k * 0.03, Math.sin(t * 0.8 - k * 0.7) * 0.12)); this.g.draw(P, this.segM);
    }
  }
  // your shadow
  const G = this.ghost;
  if (G.on && Math.sin(t * 9.1) < 0.94) {
    if (G.kind === 'drone' && this.g.fleet && this.g.fleet.pm) {
      gl.uniform1f(u.uShadow, 1); gl.uniform1f(u.uRotA, t * 40); gl.uniform1f(u.uBlur, 0.7);
      gl.uniformMatrix4fv(u.uModel, false, M(G.x, G.y, G.z, G.h)); this.g.draw(P, this.g.fleet.pm);
      gl.uniform1f(u.uShadow, 0); gl.uniform1f(u.uBlur, 0);
    } else if (G.kind === 'car' && this.g.hd) {
      const H = this.P.hd, hd = this.g.hd, car = this.g.car || {};
      gl.useProgram(H.p); ctx.set(H); hd.setMaterials('nero', [1, 0.05, 0.12], [0.7, 0, 0.08], window.kageExtra ? kageExtra(car) : undefined);
      if (H.u.uKey) gl.uniform1f(H.u.uKey, 0.12); if (H.u.uLights) gl.uniform1f(H.u.uLights, 1); if (H.u.uBrake) gl.uniform1f(H.u.uBrake, 1);
      hd.draw(M(G.x, 0, G.z, G.h), { hood: 0, doorL: 0, doorR: 0, wheelSteer: 0, steerWheel: 0, spin: 0, roof: 0, power: this.g.o.power || 'v8', time: t, exhaust: 'serie', chrono: false, chronoPh: 0, fly: 0,
        kit: car.kit, rim: car.rim, livery: car.livery, text: car.text, hand: 0 }, 'opaque');
      gl.useProgram(P.p); ctx.set(P);
    }
  }
  // the eye: far away up in the sky, always looking at you, blinking now and then
  { const d = [0.34, 0.42, 0.84], ex = p.x + d[0] * 520, ey = 230, ez = p.z + d[2] * 520;
    const blink = Math.max(0.06, 1 - Math.pow(Math.max(0, Math.sin(t * 0.21) - 0.96) / 0.04, 0.5));
    const dx = p.x - ex, dz = p.z - ez, dy = p.y - ey, yaw = Math.atan2(dx, dz), pit = -Math.atan2(dy, Math.hypot(dx, dz));
    if (u.uFogDen) gl.uniform1f(u.uFogDen, 0.0006);
    gl.uniformMatrix4fv(u.uModel, false, U.mul(M(ex, ey, ez, yaw, pit), new Float32Array([90, 0, 0, 0, 0, 90 * blink, 0, 0, 0, 0, 90, 0, 0, 0, 0, 1]))); this.g.draw(P, this.eyeM);
    ctx.set(P); }
};
Nexus.prototype.drawAdditive = function (ctx) {
  if (this.g.world !== 'eco') return;
  const gl = this.g.gl, P = this.P.veh, u = P.u;
  gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uGlowOnly, 1); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1);
  gl.uniformMatrix4fv(u.uModel, false, U.T(wrapD(7 * GP - ctx.camX), 0, wrapD(7 * GP - ctx.camZ))); this.g.draw(P, this.column);
  gl.uniform1f(u.uGlowOnly, 0);
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
    // shards counter + nearest shard
    const p = this.player(); let nd = 1e9;
    this.shards.forEach((q, i) => { if (!this.found.includes(i)) nd = Math.min(nd, Math.hypot(wrapD(q[0] - p.x), wrapD(q[2] - p.z))); });
    g.font = (m * 0.018 | 0) + 'px monospace'; g.fillStyle = 'rgba(255,90,200,0.9)';
    g.fillText('FRAMMENTI ' + this.found.length + '/12' + (nd < 1e8 ? ' · il più vicino a ' + Math.round(nd) + ' m' : ' · INDIRIZZO COMPLETO'), W / 2, m * 0.225);
    // local time runs backwards (and lies)
    const d = new Date(), sec = (86400 - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds())) % 86400;
    let tm = [Math.floor(sec / 3600), Math.floor(sec / 60) % 60, sec % 60].map(v => String(v).padStart(2, '0')).join(':');
    tm = tm.replace(/\d/g, c => Math.random() < 0.06 ? String.fromCharCode(0x30A0 + Math.floor(Math.random() * 90)) : c);
    g.textAlign = 'right'; g.fillStyle = A; g.font = 'bold ' + (m * 0.022 | 0) + 'px monospace'; g.fillText('ORA LOCALE ' + tm, W - m * 0.03, m * 0.11);
    g.textAlign = 'center';
  }
  if (this.msg) {
    const a = Math.min(1, this.msg.t * 2, (this.msg.d - this.msg.t) * 1.5); let out = '';
    for (const ch of this.msg.text) out += Math.random() < 0.05 ? String.fromCharCode(0x30A0 + Math.floor(Math.random() * 90)) : ch;
    g.font = 'bold ' + (m * 0.034 | 0) + 'px monospace'; g.fillStyle = 'rgba(255,30,110,' + (0.5 * a) + ')'; g.fillText(out, W / 2 + 3, H * 0.62);
    g.fillStyle = 'rgba(200,255,220,' + (0.9 * a) + ')'; g.fillText(out, W / 2, H * 0.62);
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
Nexus.prototype.groan = function () {
  const c = this.audio.ctx; if (!c) return; const t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(48, t); o.frequency.linearRampToValueAtTime(31, t + 3.5); o.frequency.linearRampToValueAtTime(38, t + 5);
  f.type = 'lowpass'; f.frequency.setValueAtTime(180, t); f.frequency.linearRampToValueAtTime(420, t + 2); f.frequency.linearRampToValueAtTime(120, t + 5);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 1); g.gain.exponentialRampToValueAtTime(0.001, t + 5.5);
  o.connect(f); f.connect(g); g.connect(this.audio.out); o.start(t); o.stop(t + 6);
};
Nexus.prototype.carillon = function () {
  const c = this.audio.ctx; if (!c) return; const t = c.currentTime;
  if (!this.audio.dl) { const dl = this.audio.dl = c.createDelay(2); dl.delayTime.value = 0.45; const fb = c.createGain(); fb.gain.value = 0.45; dl.connect(fb); fb.connect(dl); const wet = c.createGain(); wet.gain.value = 0.5; dl.connect(wet); wet.connect(this.audio.out); }
  const scale = [0, 3, 5, 7, 10, 12, 15], n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const f = 440 * Math.pow(2, (scale[Math.floor(Math.random() * scale.length)] + 12 * Math.floor(Math.random() * 2)) / 12) * (1 + (Math.random() - 0.5) * 0.012), st = t + i * (0.35 + Math.random() * 0.3);
    for (const [type, mul, gn] of [['sine', 1, 0.07], ['triangle', 2.01, 0.025]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(gn, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, st + 2.4);
      o.connect(g); g.connect(this.audio.out); g.connect(this.audio.dl); o.start(st); o.stop(st + 2.5);
    }
  }
};
Nexus.prototype.updateAudio = function () {
  const A = this.audio; if (!A.ctx) { if (this.g.world === 'eco') this.startAudio(); return; }
  const t = A.ctx.currentTime;
  A.eg.gain.setTargetAtTime(this.eco * 0.5, t, 0.5);
  // whispers: the noise band wanders and swells at random
  if (Math.random() < 0.01) { A.bp.frequency.setTargetAtTime(600 + Math.random() * 3000, t, 0.4); A.wg.gain.setTargetAtTime(Math.random() * 0.35 * this.eco, t, 0.6); }
  if (this.eco > 0.9 && Math.random() < 0.0035) this.carillon();
};
window.KageNexus = Nexus;
})();
