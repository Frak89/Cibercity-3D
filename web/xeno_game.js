/* KAGE XENO in NEON RUN: the saucer hovering over the crossroads by the KAGE GARAGE, its tractor beam (people and vehicles go up),
 * the walkable inside with its crew (grey, green, Nordic and the tall dark one), the helm (ENTER at the pilot seat = fly it),
 * and the KAGE EPOCH time cabin in the garage: ENTER → the time vortex → the other era (Cybercity ⇄ the meadow of the past).
 * Hooks: Game (game.js) calls update / camera / drawWorld / drawAdditive / drawHud; OnFoot is extended below. */
(function () {
'use strict';
const NR = window.NeonRun, U = window.CarRenderUtil, KF = window.KageFleet, KX = window.KageXeno, KP = window.KagePilot;
if (!NR || !KX) return;
const { S, GP, wrapD, isWater } = NR;
const PI = Math.PI, TAU = PI * 2, R = KX.UFO_RIG;
const wrapP = v => ((v % S) + S) % S, wrapA = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (c, t, k, dt) => c + (t - c) * Math.min(1, dt * k);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const CREW = [
  { sp: 'grigio', x: -1.9, z: 4.55, h: 0.3, pose: 'pensieroso' }, { sp: 'verde', x: 2.1, z: 4.5, h: -0.25, pose: 'indica', wave: true },
  { sp: 'nordico', x: -4.4, z: -0.95, h: 0, pose: 'braccia conserte' }, { sp: 'scuro', x: 5.0, z: 0.4, h: -PI / 2, pose: 'in piedi' }];
const PODS = [0, 1, 2, 3].map(k => { const a = -PI / 2 + (k - 1.5) * 0.36; return [Math.sin(a) * (R.rIn - 1.2), Math.cos(a) * (R.rIn - 1.2)]; });
const EPOCH = { x: 30, z: 27, h: -PI / 2 };            // inside the KAGE GARAGE, door facing the opening
const PEOPLE = [{ hair: 'lunghi', hairColor: 'biondo', suit: 'rosso', beard: 'nessuna', build: 'snello' }, { hair: 'ricci', hairColor: 'nero', suit: 'blu', skin: 'scura', beard: 'corta' },
  { hair: 'coda', hairColor: 'castano', suit: 'bianco', skin: 'olivastra', beard: 'nessuna' }, { hair: 'calvo', suit: 'oro', skin: 'ambrata', beard: 'piena', build: 'robusto' }];

function XenoGame(game) {
  this.g = game; this.gl = game.gl;
  this.ship = { x: GP * 1, z: GP * 1, y: 20, h: 0.6 };   // hovering over the crossroads by the garage
  this.count = 0; this.items = []; this.ambT = 6; this.beamA = 0; this.tt = null; this.meshes = {};
  this.lod = 'ultra';
  this.epoch = game.vmesh(KX.buildChrono(Object.assign(KF.loadCfg('chrono'), { lod: this.lod })));
  this.vortex = game.vmesh(KX.buildVortex(this.lod));
  this.beam = game.vmesh(KX.buildBeam(KF.loadCfg('ufo')));
  this.cfgKey = ''; this.refresh();
}
XenoGame.prototype.refresh = function () {
  const cfg = KF.loadCfg('ufo'), key = JSON.stringify(cfg); if (key === this.cfgKey) return; this.cfgKey = key;
  this.ext = this.g.vmesh(KX.buildUfo(cfg, this.lod)); this.int = this.g.vmesh(KX.buildUfoInterior(cfg, this.lod));
};
XenoGame.prototype.person = function (cfg) {
  const key = JSON.stringify(cfg); if (!this.meshes[key]) { const m = KP.build(cfg, this.lod); this.meshes[key] = this.g.vmesh(m); this.meshes[key].S = m.S; } return this.meshes[key];
};
XenoGame.prototype.flying = function () { const F = this.g.fleet; return !!(F && this.g.veh && F.kind === 'ufo' && F.st); };
XenoGame.prototype.state = function () { return this.flying() ? this.g.fleet.st : this.ship; };
XenoGame.prototype.toWorld = function (lx, lz) { const s = this.state(), c = Math.cos(s.h), n = Math.sin(s.h); return [wrapP(s.x + lx * c + lz * n), wrapP(s.z - lx * n + lz * c)]; };
XenoGame.prototype.toLocal = function (x, z) { const s = this.state(), c = Math.cos(s.h), n = Math.sin(s.h), dx = wrapD(x - s.x), dz = wrapD(z - s.z); return [dx * c - dz * n, dx * n + dz * c]; };
XenoGame.prototype.shipM = function (ctx) { const s = this.state();
  return U.mul(U.T(wrapD(s.x - ctx.camX), s.y, wrapD(s.z - ctx.camZ)), U.mul(U.RY(s.h), U.mul(U.RX(s.pitch || 0), U.RZ(s.roll || 0)))); };

/* ---------------- per frame ---------------- */
XenoGame.prototype.update = function (dt, inp) {
  const g = this.g, f = g.foot, s = this.state(), fly = this.flying();
  if (!fly && g.t % 2 < dt) this.refresh();
  // beam: when flying it's yours (F); parked, it switches on while someone is being lifted or you walk near it
  const pad = this.toWorld(R.lift[0], R.lift[1]);
  const nearFoot = f && f.active && !f.xs && Math.hypot(wrapD(f.x - pad[0]), wrapD(f.z - pad[1])) < 16;
  const want = fly ? !!s.beam : (this.items.length > 0 || nearFoot || (f && (f.xs === 'up' || f.xs === 'down')));
  this.beamA = ease(this.beamA, want ? 1 : 0, 4, dt);
  if (!fly) { this.ambT -= dt; if (this.ambT <= 0 && !this.items.length) { this.ambT = 18 + Math.random() * 16; this.spawn(pad); } }
  else if (s.beam && !this.items.length && s.y < 90 && s.y > 3) this.spawn(pad);
  for (const it of this.items) { it.x = pad[0]; it.z = pad[1]; it.y += dt * (2.2 + it.y * 0.06); it.h += dt * 1.4; it.top = s.y + R.emitY; }
  const n0 = this.items.length; this.items = this.items.filter(it => it.y < it.top - 0.6); this.count += n0 - this.items.length;
  // time travel
  const T = this.tt;
  if (T) { T.t += dt;
    if (T.phase === 'in' && T.t > 1.3) { T.phase = 'vortex'; T.t = 0; }
    else if (T.phase === 'vortex' && T.t > 6.5) { T.phase = 'out'; T.t = 0; g.world = g.world === 'meadow' ? 'city' : 'meadow'; if (g.fx) g.fx.p.length = 0; if (g.tj) { g.tj.white = 1; g.tj.arrive = 1; } }
    else if (T.phase === 'out' && T.t > 1.2) { this.tt = null; if (f) { const fx = Math.sin(EPOCH.h), fz = Math.cos(EPOCH.h); f.x = wrapP(EPOCH.x + fx * 1.9); f.z = wrapP(EPOCH.z + fz * 1.9); f.h = EPOCH.h; } } }
};
/** time vortex camera: high above the city, flying down the tunnel */
XenoGame.prototype.camera = function (cv, dt) {
  const T = this.tt; if (!T || T.phase !== 'vortex') return cv;
  const a = T.t * 0.35, w = Math.sin(T.t * 1.3) * 0.6;
  return { e: [0, 340, 0], l: [Math.cos(a) * 10, 340 + w, Math.sin(a) * 10], fov: 96 + Math.sin(T.t * 0.8) * 8, drawCar: false, cockpit: false, roll: Math.sin(T.t * 0.7) * 0.3 };
};
XenoGame.prototype.spawn = function (pad) {
  const land = !isWater(pad[0], pad[1]), r = Math.random();
  const it = { x: pad[0], z: pad[1], y: 0, h: Math.random() * TAU, top: 20 };
  if (!land) it.kind = 'boat'; else if (r < 0.3) it.kind = 'moto'; else { it.kind = 'person'; it.cfg = Object.assign({}, PEOPLE[(Math.random() * PEOPLE.length) | 0]); }
  if (!land) it.y = -0.3;
  this.items.push(it);
};

/* ---------------- ENTER ---------------- */
XenoGame.prototype.enter = function () {
  const g = this.g, f = g.foot, F = g.fleet;
  if (this.tt) return true;
  if (this.flying()) { this.leaveHelm(); return true; }
  if (!f || !f.active || g.veh) return false;
  if (f.xs === 'in') {
    const dp = Math.hypot(f.lx - R.lift[0], f.lz - R.lift[1]), ds = Math.hypot(f.lx - R.seat[0], f.lz - (R.seat[1] - 0.15));
    if (dp < 1.2) { f.xs = 'down'; f.xp = 0; return true; }
    if (ds < 1.3 && F) { f.xs = null; f.active = false; F.setVehicle('ufo'); return true; }
    return true;
  }
  if (f.xs) return true;
  const pad = this.toWorld(R.lift[0], R.lift[1]);
  if (Math.hypot(wrapD(f.x - pad[0]), wrapD(f.z - pad[1])) < 3.2) { f.xs = 'up'; f.xp = 0; f.x0 = f.x; f.z0 = f.z; return true; }
  if (Math.hypot(wrapD(f.x - EPOCH.x), wrapD(f.z - EPOCH.z)) < 2.6) { this.tt = { phase: 'in', t: 0 }; return true; }
  return false;
};
XenoGame.prototype.leaveHelm = function () {
  const g = this.g, F = g.fleet, st = F.st;
  Object.assign(this.ship, { x: st.x, z: st.z, y: Math.max(st.y, 0), h: st.h, pitch: 0, roll: 0 });
  F.setVehicle('car');
  const f = g.foot; if (!f) return;
  f.active = true; f.xs = 'in'; f.lx = 0; f.lz = R.seat[1] - 1.3; f.h = st.h + PI; f.camH = f.h; f.v = 0; f.vs = 0; this.syncFoot(f);
};
XenoGame.prototype.syncFoot = function (f) { const w = this.toWorld(f.lx, f.lz); f.x = w[0]; f.z = w[1]; f.y = this.state().y + R.floor; };

/* ---------------- walking inside + the beam lift (OnFoot extension) ---------------- */
XenoGame.prototype.footUpdate = function (f, dt, inp) {
  if (this.tt) {
    const T = this.tt; f.anim = 'in piedi'; f.v = 0;
    if (T.phase === 'in') { f.x = wrapP(f.x + wrapD(EPOCH.x - f.x) * Math.min(1, dt * 3)); f.z = wrapP(f.z + wrapD(EPOCH.z - f.z) * Math.min(1, dt * 3)); f.h = ease(f.h, EPOCH.h + PI, 4, dt); }
    return true;
  }
  if (f.xs === 'up' || f.xs === 'down') {
    f.xp = Math.min(1, f.xp + dt / 2.8); const s = this.state(), e = sstep(0, 1, f.xp), top = s.y + R.floor, pad = this.toWorld(R.lift[0], R.lift[1]);
    f.x = wrapP(pad[0] + wrapD((f.x0 === undefined ? pad[0] : f.x0) - pad[0]) * (f.xs === 'up' ? 1 - e : 0)); f.z = wrapP(pad[1] + wrapD((f.z0 === undefined ? pad[1] : f.z0) - pad[1]) * (f.xs === 'up' ? 1 - e : 0));
    f.y = f.xs === 'up' ? e * top : (1 - e) * top; f.h += dt * 0.9; f.anim = 'in piedi'; f.v = 0;
    if (f.xp >= 1) { if (f.xs === 'up') { f.xs = 'in'; f.lx = R.lift[0]; f.lz = R.lift[1]; this.syncFoot(f); } else { f.xs = null; f.y = 0; f.x0 = f.z0 = undefined; const fw = this.toWorld(R.lift[0], R.lift[1] - 4.5); f.x = fw[0]; f.z = fw[1]; } }
    return true;
  }
  if (f.xs !== 'in') {
    // the EPOCH cabin is solid from outside
    const dx = wrapD(f.x - EPOCH.x), dz = wrapD(f.z - EPOCH.z), d = Math.hypot(dx, dz);
    if (d < 1.45 && d > 1e-3) { f.x = wrapP(EPOCH.x + dx / d * 1.45); f.z = wrapP(EPOCH.z + dz / d * 1.45); }
    return false;
  }
  // inside: same controls as on the street, in the ship's frame
  f.t += dt;
  const run = !!inp.boost, s = this.state();
  f.h = wrapA(f.h + (inp.yaw || 0) * 2.6 * dt);
  f.v = ease(f.v, (inp.fwd || 0) * (run ? 4.2 : 1.9), 8, dt); f.vs = ease(f.vs || 0, (inp.strafe || 0) * 1.4, 8, dt);
  const lh = f.h - s.h, fx = Math.sin(lh), fz = Math.cos(lh), rx = -Math.cos(lh), rz = Math.sin(lh);
  f.lx += (fx * f.v + rx * f.vs) * dt; f.lz += (fz * f.v + rz * f.vs) * dt;
  const push = (cx, cz, r, out) => { const dx = f.lx - cx, dz = f.lz - cz, d = Math.hypot(dx, dz) || 1e-3;
    if (out ? d < r : d > r) { f.lx = cx + dx / d * r; f.lz = cz + dz / d * r; } };
  push(0, 0, R.rIn - 0.6, false); push(0, 0, R.core + 0.6, true); push(-4.4, 0.6, 1.45, true); for (const p of PODS) push(p[0], p[1], 1.05, true);
  for (const c of CREW) push(c.x, c.z, 0.45, true);
  { const r = Math.hypot(f.lx, f.lz), a = Math.atan2(f.lx, f.lz); if (Math.abs(a) < 0.62 && r > R.seat[1] + 0.55) { f.lx = Math.sin(a) * (R.seat[1] + 0.55); f.lz = Math.cos(a) * (R.seat[1] + 0.55); } }
  this.syncFoot(f);
  const sp = Math.abs(f.v) + Math.abs(f.vs) * 0.6;
  f.ph += dt * (sp > 3 ? sp / 5.5 : sp / 1.45); f.air = false;
  f.anim = sp > 3.2 ? 'corre' : sp > 0.25 ? 'cammina' : 'in piedi';
  return true;
};
/** keep the inside camera inside the hull */
XenoGame.prototype.footCamera = function (f, cv) {
  if (f.xs !== 'in' && f.xs !== 'up' && f.xs !== 'down') return cv;
  const c = this.g.c, fpx = wrapD(f.x - c.x), fpz = wrapD(f.z - c.z);
  if (f.xs === 'in') {
    const s = this.state(); let e = cv.e;
    for (let k = 0; k < 12; k++) { const wl = this.toLocal(wrapP(c.x + e[0]), wrapP(c.z + e[2])); if (Math.hypot(wl[0], wl[1]) < R.rIn - 0.5) break;
      e = [fpx + (e[0] - fpx) * 0.82, e[1], fpz + (e[2] - fpz) * 0.82]; }
    e[1] = Math.min(e[1], s.y + R.ceil - 0.3);
    return Object.assign({}, cv, { e, l: [cv.l[0], Math.min(cv.l[1], s.y + R.ceil - 0.5), cv.l[2]], fov: 70 });
  }
  // riding the beam: watch from the side
  const a = this.g.t * 0.3;
  return Object.assign({}, cv, { e: [fpx + Math.sin(a) * 9, f.y + 2.5, fpz + Math.cos(a) * 9], l: [fpx, f.y + 1, fpz], fov: 62 });
};

/* ---------------- drawing ---------------- */
XenoGame.prototype.drawWorld = function (ctx) {
  const g = this.g, gl = this.gl, F = g.fleet; if (!F) return;
  const P = g.P.veh, u = P.u, s = this.state(), t = ctx.t, fly = this.flying();
  const near = Math.hypot(wrapD(s.x - ctx.camX), wrapD(s.z - ctx.camZ));
  gl.useProgram(P.p); ctx.set(P);
  gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uGlowOnly, 0);
  const st = { x: s.x, y: s.y, z: s.z, h: s.h, pitch: s.pitch || 0, roll: s.roll || 0, rot: fly ? s.rot : t * 0.8 };
  if (!fly && near < 900) F.drawModel(this.ext, st, ctx);
  if (near < 60) { gl.uniform1f(u.uLit, 1.9); F.drawModel(this.int, Object.assign({}, st, { rot: t * 0.9 }), ctx); gl.uniform1f(u.uLit, 1); }
  // crew
  if (near < 60) { const Ms = this.shipM(ctx), f = g.foot, inside = f && f.active && f.xs === 'in';
    for (const c of CREW) {
      const waves = c.wave && inside && Math.hypot(f.lx - c.x, f.lz - c.z) < 3.5;
      F.drawPilotPose(ctx.set, U.mul(Ms, U.mul(U.T(c.x, R.floor, c.z), U.RY(c.h))), waves ? 'saluto' : c.pose, {}, this.person({ species: c.sp }), t + c.x);
    }
    gl.useProgram(P.p); ctx.set(P); }
  // whatever is going up the beam
  for (const it of this.items) {
    if (it.kind === 'person') { F.drawPilotPose(ctx.set, U.mul(U.T(wrapD(it.x - ctx.camX), it.y, wrapD(it.z - ctx.camZ)), U.mul(U.RY(it.h), U.RZ(Math.sin(it.y) * 0.3))), 'salta', {}, this.person(it.cfg), t); gl.useProgram(P.p); ctx.set(P); }
    else F.drawModel(F.gm[it.kind], { x: it.x, y: it.y, z: it.z, h: it.h, roll: Math.sin(it.y * 0.7) * 0.4, pitch: Math.cos(it.y * 0.5) * 0.3 }, ctx);
  }
  // KAGE EPOCH (only in the garage of either era)
  const T = this.tt;
  if (Math.hypot(wrapD(EPOCH.x - ctx.camX), wrapD(EPOCH.z - ctx.camZ)) < 300) F.drawModel(this.epoch, { x: EPOCH.x, y: 0, z: EPOCH.z, h: EPOCH.h, rot: t * (T ? 4 + T.t * 3 : 0.35) }, ctx);
  // the vortex itself (glow shading, but opaque, so it hides the world)
  if (T && T.phase === 'vortex') {
    const cv = g.cv, fx = cv.l[0] - cv.e[0], fz = cv.l[2] - cv.e[2], hd = Math.atan2(fx, fz), d = T.t * 85 + 6;
    gl.uniform1f(u.uGlowOnly, 1);
    F.drawModel(this.vortex, { x: ctx.camX - Math.sin(hd) * d, y: cv.e[1], z: ctx.camZ - Math.cos(hd) * d, h: hd, pitch: -PI / 2, rot: T.t * 1.6 }, ctx);
    gl.uniform1f(u.uGlowOnly, 0);
  }
};
XenoGame.prototype.drawAdditive = function (ctx) {
  if (this.beamA < 0.02 || !this.g.fleet) return;
  const g = this.g, gl = this.gl, P = g.P.veh, u = P.u, s = this.state();
  gl.useProgram(P.p); ctx.set(P);
  gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, this.beamA); gl.uniform1f(u.uGlowOnly, 1);
  gl.uniform1f(u.uRotA, ctx.t * 2.2); gl.uniform1f(u.uBlur, 0); gl.uniform1f(u.uSail, 0); gl.uniform1f(u.uPropA, 0);
  const h = Math.max(0.5, s.y + R.emitY + (isWater(s.x, s.z) ? 0.4 : 0)), sc = h / 30;
  const M = U.mul(this.shipM(ctx), U.mul(U.T(R.lift[0], R.emitY - 0.1, R.lift[1]), new Float32Array([this.beamA, 0, 0, 0, 0, sc, 0, 0, 0, 0, this.beamA, 0, 0, 0, 0, 1])));
  gl.uniformMatrix4fv(u.uModel, false, M); g.draw(P, this.beam);
  gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uLit, 1);
};
XenoGame.prototype.drawHud = function (hud) {
  const g = this.g, f = g.foot, ctx2 = hud.getContext('2d'), W = hud.width, H = hud.height, m = Math.min(W, H);
  let line = '', big = '';
  const T = this.tt;
  if (T) { big = T.phase === 'vortex' ? 'VORTICE TEMPORALE' : 'KAGE EPOCH'; line = T.phase === 'vortex' ? (g.world === 'meadow' ? 'verso CYBERCITY · OGGI' : 'verso la PRATERIA DEL PASSATO') : T.phase === 'in' ? 'chiudi la porta… si parte' : 'ARRIVO'; }
  else if (f && f.active && !g.veh) {
    if (f.xs === 'in') {
      const dp = Math.hypot(f.lx - R.lift[0], f.lz - R.lift[1]), ds = Math.hypot(f.lx - R.seat[0], f.lz - (R.seat[1] - 0.15));
      line = dp < 1.2 ? 'INVIO · scendi col raggio' : ds < 1.3 ? 'INVIO · ai comandi del KAGE XENO' : 'A BORDO DEL KAGE XENO · esplora la nave · plancia davanti, raggio dietro il nucleo';
    } else if (f.xs === 'up' || f.xs === 'down') line = 'RAGGIO TRAENTE…';
    else {
      const pad = this.toWorld(R.lift[0], R.lift[1]);
      if (Math.hypot(wrapD(f.x - pad[0]), wrapD(f.z - pad[1])) < 3.2) line = 'INVIO · fatti prelevare dal raggio';
      else if (Math.hypot(wrapD(f.x - EPOCH.x), wrapD(f.z - EPOCH.z)) < 2.6) line = 'INVIO · KAGE EPOCH: viaggia nel tempo';
      else if (Math.hypot(wrapD(f.x - pad[0]), wrapD(f.z - pad[1])) < 16) line = 'KAGE XENO · mettiti sotto il raggio';
    }
  }
  if (!line && !big) return;
  if (T && T.phase === 'vortex') ctx2.clearRect(0, 0, W, H);
  ctx2.textAlign = 'center';
  if (big) { ctx2.font = 'bold ' + (m * 0.06 | 0) + 'px monospace'; ctx2.fillStyle = 'rgba(255,220,150,0.95)'; ctx2.fillText(big, W / 2, H * 0.22); }
  ctx2.font = 'bold ' + (m * 0.024 | 0) + 'px monospace';
  const w = ctx2.measureText(line).width + m * 0.04; ctx2.fillStyle = 'rgba(7,11,19,0.62)'; ctx2.fillRect(W / 2 - w / 2, m * 0.4, w, m * 0.048);
  ctx2.fillStyle = 'rgb(150,255,120)'; ctx2.fillText(line, W / 2, m * 0.434); ctx2.textAlign = 'left';
};

/* ---------------- OnFoot extension ---------------- */
const OF = window.KageOnFoot;
if (OF) {
  const up0 = OF.prototype.update, cam0 = OF.prototype.camera, nc0 = OF.prototype.nearCar;
  OF.prototype.update = function (dt, inp) { const X = this.g.xeno; if (X && X.footUpdate(this, dt, inp)) return { vF: this.v }; return up0.call(this, dt, inp); };
  OF.prototype.camera = function (view, dt) { const X = this.g.xeno, inside = this.xs === 'in'; const cv = cam0.call(this, inside ? view - view % 3 : view, dt); return X ? X.footCamera(this, cv) : cv; };
  OF.prototype.nearCar = function () { return !this.xs && nc0.call(this); };
}
window.KageXenoGame = XenoGame;
})();
