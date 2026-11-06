/* KAGE gear for the pilot on foot: the JET jetpack (J or 🚀) and the BOARD skateboard (K or 🛹).
 * Jetpack: SPACE / X thrust up and down, stick / WASD fly where you push, SHIFT boost, lands on streets and roofs, twin flames + roar.
 * Skateboard: push to accelerate, carve where you push, coast, SPACE ollie, rolling + clack sounds. Models are original. */
(function () {
'use strict';
const NR = window.NeonRun, U = window.CarRenderUtil, KF = window.KageFleet, KP = window.KagePilot, OF = window.KageOnFoot;
if (!NR || !OF) return;
const { S, GP, wrapD, isWater } = NR, PI = Math.PI, TAU = PI * 2;
const wrapP = v => ((v % S) + S) % S, wrapA = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (c, t, k, dt) => c + (t - c) * Math.min(1, dt * k);
const mat = (c, e, slot, mode, a) => ({ c, e: e || 0, slot: slot || 0, mode: mode || 0, a: a || [0, 0, 0] });

/* ---------------- models ---------------- */
function buildJetpack() {
  const mb = new KF.MB(), shell = mat([0.12, 0.13, 0.15], 0, 1), acc = mat([0.85, 0.65, 0.2], 0, 2), led = mat([0, 1, 0.9], 1.2, 3), dark = mat([0.04, 0.04, 0.05]);
  mb.part = 'zaino'; mb.box(0, 0, 0, 0.34, 0.44, 0.14, shell); mb.box(0, 0.02, -0.075, 0.28, 0.36, 0.02, dark); mb.box(0, 0.16, 0.071, 0.2, 0.03, 0.01, led);
  mb.part = 'serbatoi';
  for (const s of [-1, 1]) { mb.push(KF.T(s * 0.13, -0.02, -0.1)); mb.cyl(-0.22, 0.22, 0.075, 0.075, 16, acc); mb.ellipsoid(0, 0.22, 0, 0.075, 0.05, 0.075, 12, 6, acc); mb.pop();
    mb.part = 'ugelli'; mb.push(KF.T(s * 0.13, -0.24, -0.1)); mb.cyl(-0.12, 0, 0.055, 0.075, 16, dark); mb.cyl(-0.125, -0.11, 0.05, 0.05, 16, mat([1, 0.5, 0.2], 1, 3), false); mb.pop(); mb.part = 'serbatoi'; }
  mb.part = 'cinghie'; for (const s of [-1, 1]) { mb.box(s * 0.12, 0.12, 0.09, 0.05, 0.3, 0.03, dark); mb.box(s * 0.12, -0.16, 0.09, 0.05, 0.12, 0.03, dark); }
  mb.part = 'impugnature'; for (const s of [-1, 1]) { mb.rod([s * 0.17, -0.12, 0.0], [s * 0.26, -0.18, 0.3], 0.018, 8, shell); mb.box(s * 0.26, -0.18, 0.31, 0.04, 0.09, 0.04, dark); mb.box(s * 0.26, -0.14, 0.31, 0.02, 0.02, 0.02, led); }
  const m = mb.finish(); m.kind = 'jetpack'; return m;
}
function buildFlame() {   // glow cone along -y, length 1 (scaled by the thrust)
  const mb = new KF.MB(); mb.part = 'fiamma';
  for (const [r, e, c] of [[0.07, 1.6, [1, 0.85, 0.5]], [0.11, 0.9, [1, 0.45, 0.15]], [0.16, 0.45, [0.4, 0.6, 1]]]) { mb.push(KF.T(0, 0, 0)); mb.cyl(-1, 0, 0.005, r, 14, mat(c, e, 3), false); mb.pop(); }
  return mb.finish();
}
function buildBoard() {
  const mb = new KF.MB(), deck = mat([0.08, 0.08, 0.09], 0, 1), grip = mat([0.03, 0.03, 0.035]), metal = mat([0.6, 0.62, 0.66], 0, 2), led = mat([1, 0.2, 0.75], 1.2, 3);
  const wheel = (z) => mat([0.95, 0.9, 0.8], 0, 0, 3, [0.055, z, 1]);
  mb.part = 'tavola';
  const rows = []; for (let j = 0; j <= 24; j++) { const t = j / 24, z = (t - 0.5) * 0.8, up = Math.pow(Math.max(0, Math.abs(z) - 0.3) / 0.1, 2) * 0.05, w = 0.105 * Math.sqrt(1 - Math.pow(Math.max(0, Math.abs(z) - 0.28) / 0.13, 2));
    rows.push([[-w, 0.105 + up, z], [w, 0.105 + up, z]]); }
  mb.grid(rows, grip, false); mb.grid(rows.map(r => r.map(p => [p[0], p[1] - 0.014, p[2]])), deck, true);
  mb.grid(rows.map(r => [[r[0][0], r[0][1], r[0][2]], [r[0][0], r[0][1] - 0.014, r[0][2]]]), deck, false); mb.grid(rows.map(r => [[r[1][0], r[1][1] - 0.014, r[1][2]], [r[1][0], r[1][1], r[1][2]]]), deck, false);
  mb.part = 'led'; mb.box(0, 0.088, 0, 0.12, 0.004, 0.5, led);
  for (const z of [-0.25, 0.25]) { mb.part = 'carrelli'; mb.box(0, 0.083, z, 0.06, 0.025, 0.08, metal); mb.box(0, 0.06, z, 0.03, 0.03, 0.04, metal); mb.rod([-0.1, 0.055, z], [0.1, 0.055, z], 0.008, 6, metal);
    mb.part = 'ruote'; for (const s of [-1, 1]) { mb.push(KF.M(KF.T(s * 0.11, 0.055, z), KF.RZ(PI / 2))); mb.cyl(-0.018, 0.018, 0.028, 0.028, 16, wheel(z)); mb.pop(); } }
  const m = mb.finish(); m.kind = 'board'; return m;
}

/* ---------------- gear game logic ---------------- */
function Gear(game) {
  this.g = game; this.meshes = {}; this.au = null; this.clack = 0;
  const st = document.createElement('style'); st.textContent = '#gearUI{position:fixed;right:3vmin;top:12vmin;display:flex;flex-direction:column;gap:1vmin;z-index:20}#gearUI button{font:bold 2vmin monospace;color:#ecfcff;background:rgba(7,11,19,.65);border:2px solid rgba(255,80,200,.7);border-radius:2vmin;padding:1vmin 1.6vmin;cursor:pointer}#gearUI button.on{background:rgba(255,80,200,.35)}';
  document.head.appendChild(st);
  const ui = this.ui = document.createElement('div'); ui.id = 'gearUI'; ui.style.display = 'none'; document.body.appendChild(ui);
  const B = (label, fn) => { const b = document.createElement('button'); b.textContent = label; const go = e => { e.preventDefault(); e.stopPropagation(); fn(); }; b.addEventListener('click', go); b.addEventListener('touchstart', go); ui.appendChild(b); return b; };
  this.bJet = B('🚀 JETPACK', () => this.toggle('jet')); this.bSk = B('🛹 SKATE', () => this.toggle('skate'));
}
Gear.prototype.mesh = function (k, fn) { if (!this.meshes[k]) { const m = fn(); this.meshes[k] = this.g.vmesh(m); } return this.meshes[k]; };
Gear.prototype.free = function (f) { return f && f.active && !f.ss && !f.xs && !f.trans && !this.g.veh; };
Gear.prototype.toggle = function (k) {
  const f = this.g.foot; if (!this.free(f)) return;
  f.gear = f.gear === k ? null : k; f.gv = 0; f.gvy = 0; f.air = false;
  if (!this.au && window.FleetAudio) this.au = new FleetAudio(); if (this.au) { this.au.start(); this.au.blip(f.gear ? 500 : 300, f.gear ? 900 : 200, 0.25, 0.15, 'triangle'); }
};
/** street (0) or the roof you're over */
Gear.prototype.groundAt = function (x, z, y) {
  if (this.g.world !== 'city') return 0;
  const bx = Math.floor(x / GP), bz = Math.floor(z / GP), city = this.g.city; let gnd = isWater(x, z) ? -0.9 : 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const ix = ((bx + i) % 15 + 15) % 15, iz = ((bz + j) % 15 + 15) % 15, sx = (bx + i) * GP - ix * GP, sz = (bz + j) * GP - iz * GP;
    for (const q of city.blocks[iz * 15 + ix]) { const top = q[4] || 8; if (x > q[0] + sx && x < q[2] + sx && z > q[1] + sz && z < q[3] + sz && y >= top - 0.6) gnd = Math.max(gnd, top); } }
  return gnd;
};
Gear.prototype.footUpdate = function (f, dt, inp) {
  if (!f.gear || !this.free(f)) return false;
  f.t += dt; const run = !!inp.boost;
  if (f.gear === 'jet') {
    const lift = inp.lift || 0, gnd = this.groundAt(f.x, f.z, f.y);
    const tv = OF.dirMove(f, inp, dt, 'h', 'camH', run) * (f.y > gnd + 0.3 ? (run ? 2.3 : 1.6) : 1);
    f.gv = ease(f.gv || 0, tv, f.y > gnd + 0.3 ? 1.4 : 8, dt);
    f.thr = ease(f.thr || 0, lift > 0 ? 1 : f.y > gnd + 0.2 ? (lift < 0 ? 0.25 : 0.55) : 0, 6, dt);
    f.gvy = (f.gvy || 0) + (f.thr * 15.5 - 9.81) * dt; f.gvy = clamp(f.gvy, -14, 9); if (f.thr > 0.5 && lift === 0) f.gvy = ease(f.gvy, 0, 2.5, dt);
    const fx = Math.sin(f.h), fz = Math.cos(f.h); f.x = wrapP(f.x + fx * f.gv * dt); f.z = wrapP(f.z + fz * f.gv * dt); f.y = Math.min(160, f.y + f.gvy * dt);
    const g2 = this.groundAt(f.x, f.z, f.y + 0.6);
    if (f.y <= g2) { if (f.gvy < -7 && this.au) this.au.blip(120, 40, 0.3, 0.3); f.y = g2; f.gvy = Math.max(0, f.gvy); }
    f.v = f.gv; OF.prototype.collide.call(f);
    const airb = f.y > g2 + 0.25; f.air = airb;
    const sp = Math.abs(f.gv); f.ph += dt * (sp > 3 ? sp / 5.5 : sp / 1.45);
    f.anim = airb ? 'jetpack' : sp > 3.2 ? 'corre' : sp > 0.25 ? 'cammina' : 'in piedi';
    f.tilt = ease(f.tilt || 0, airb ? clamp(f.gv / 14, -0.2, 0.45) : 0, 3, dt);
  } else {
    // skateboard: push with the stick to accelerate, the board carves toward where you push, friction slows you down
    const mag = Math.min(1, Math.hypot(inp.mx || 0, inp.my || 0));
    f.camH = wrapA((f.camH || 0) - (inp.cam || 0) * 2.2 * dt);
    if (mag > 0.15) { const c = f.camH, vx = Math.sin(c) * (inp.my || 0) - Math.cos(c) * (inp.mx || 0), vz = Math.cos(c) * (inp.my || 0) + Math.sin(c) * (inp.mx || 0), tgt = Math.atan2(vx, vz), d = wrapA(tgt - f.h);
      f.lean = ease(f.lean || 0, clamp(d, -0.6, 0.6) * 0.6, 4, dt); f.h = wrapA(f.h + clamp(d, -1, 1) * Math.min(1.8, 0.8 + (f.gv || 0) * 0.25) * dt);
      if (Math.cos(d) > 0.3 && !f.air) { f.gv = Math.min((run ? 10 : 7), (f.gv || 0) + (run ? 3.6 : 2.6) * dt * mag); f.pushing = true; } else f.pushing = false; }
    else { f.pushing = false; f.lean = ease(f.lean || 0, 0, 3, dt); }
    f.gv = Math.max(0, (f.gv || 0) - (0.35 + (f.gv || 0) * 0.03) * dt);
    const back = Math.cos(f.h - f.camH); if (back > 0.2 && f.gv > 1) f.camH = wrapA(f.camH + wrapA(f.h - f.camH) * Math.min(1, dt * 1.6));
    if (!f.air && (inp.lift || 0) > 0.5) { f.gvy = 4.4; f.air = true; f.ollie = 0; if (this.au) this.au.click(1400, 0.35); }
    if (f.air) { f.gvy -= 13 * dt; f.y += f.gvy * dt; f.ollie = (f.ollie || 0) + dt; if (f.y <= 0) { f.y = 0; f.air = false; f.gvy = 0; if (this.au) { this.au.click(900, 0.5); this.au.click(500, 0.4); } } }
    const fx = Math.sin(f.h), fz = Math.cos(f.h), ox = f.x, oz = f.z; f.x = wrapP(f.x + fx * f.gv * dt); f.z = wrapP(f.z + fz * f.gv * dt);
    if (isWater(f.x, f.z)) { f.x = ox; f.z = oz; f.gv = 0; }
    const px = f.x, pz = f.z; OF.prototype.collide.call(f); if (Math.hypot(wrapD(px - f.x), wrapD(pz - f.z)) > 0.01) { if (f.gv > 3 && this.au) this.au.blip(200, 60, 0.2, 0.3); f.gv *= 0.3; }
    f.v = f.gv; f.ph += dt * 1.2;
    f.anim = f.pushing && f.gv < (run ? 9.5 : 6.6) ? 'skate_push' : 'skate';
    // expansion joints in the pavement go clack-clack
    this.clack -= dt * f.gv; if (this.clack < 0 && !f.air) { this.clack = 2.6; if (this.au && f.gv > 0.5) this.au.click(700 + Math.random() * 300, 0.18); }
  }
  this.sound(f);
  return true;
};
Gear.prototype.sound = function (f) {
  if (!this.au || !this.au.ctx) return;
  this.au.on = !!f.gear; this.au.update(f.gear === 'jet' ? 'jetpack' : f.gear === 'skate' ? 'skate' : null, { thrust: f.thr || 0, vx: f.gv || 0, vz: 0, vF: f.gv || 0, air: f.air });
};
Gear.prototype.update = function () {
  const f = this.g.foot, show = this.free(f) && this.g.world !== 'space' && this.g.world !== 'planet';
  const v = show ? 'flex' : 'none'; if (this.ui.style.display !== v) this.ui.style.display = v;
  if (show) { this.bJet.classList.toggle('on', f.gear === 'jet'); this.bSk.classList.toggle('on', f.gear === 'skate'); }
  if (f && !f.active && f.gear) { f.gear = null; if (this.au) { this.au.on = false; this.au.update(null); } }
};
Gear.prototype.key = function (code) {
  const f = this.g.foot; if (!this.free(f)) return false;
  if (code === 'KeyJ') { this.toggle('jet'); return true; } if (code === 'KeyK') { this.toggle('skate'); return true; } return false;
};
/** the board under the feet, the jetpack on the back (follows the chest bone), and in the additive pass the flames */
Gear.prototype.drawWorld = function (ctx) {
  const g = this.g, f = g.foot, F = g.fleet; if (!f || !f.active || !f.gear || !F || f.ss) return;
  const gl = g.gl, P = g.P.veh, u = P.u, rx = wrapD(f.x - ctx.camX), rz = wrapD(f.z - ctx.camZ);
  gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uDay, g.dayK || 0); gl.uniform1f(u.uBlur, 0); gl.uniform1f(u.uSail, 0);
  const base = U.mul(U.T(rx, f.y, rz), U.RY(f.h));
  if (f.gear === 'skate') {
    const pop = f.air ? Math.max(0, 0.45 - (f.ollie || 0) * 1.6) : 0;
    gl.uniform1f(u.uPropA, (f.wheelA = (f.wheelA || 0) + (f.gv || 0) * 0.016 / 0.028));
    gl.uniformMatrix4fv(u.uModel, false, U.mul(base, U.mul(U.T(0, 0, -0.25), U.mul(U.RX(-pop), U.mul(U.T(0, 0, 0.25), U.RZ(-(f.lean || 0) * 0.35)))))); g.draw(P, this.mesh('board', buildBoard));
  } else {
    const pm = F.pilotMesh(true); if (!pm) return; const Sx = pm.S || 1;
    const B = KP.pose(f.anim || 'in piedi', f.anim === 'cammina' || f.anim === 'corre' ? f.ph : f.t, { speed: Math.abs(f.v || 0), fwd: (f.gv || 0) / 12 }, Sx);
    const bm = new Float32Array(B.buffer, B.byteOffset + 2 * 16 * 4, 16), M0 = base;
    gl.uniformMatrix4fv(u.uModel, false, U.mul(M0, U.mul(bm, U.T(0, 1.24 * Sx, -0.2 * Sx)))); g.draw(P, this.mesh('jet', buildJetpack));
    this.jetM = U.mul(M0, U.mul(bm, U.T(0, 1.24 * Sx, -0.2 * Sx)));
  }
};
Gear.prototype.drawAdditive = function (ctx) {
  const g = this.g, f = g.foot; if (!f || !f.active || f.gear !== 'jet' || !this.jetM || (f.thr || 0) < 0.05 || f.ss) return;
  const gl = g.gl, P = g.P.veh, u = P.u; gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uGlowOnly, 1); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0);
  const L = (0.35 + f.thr * 0.9) * (0.85 + Math.random() * 0.3);
  gl.uniform1f(u.uLit, 0.6 + f.thr);
  for (const s of [-1, 1]) { gl.uniformMatrix4fv(u.uModel, false, U.mul(this.jetM, U.mul(U.T(s * 0.13, -0.36, -0.1), new Float32Array([1, 0, 0, 0, 0, L, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])))); g.draw(P, this.mesh('flame', buildFlame)); }
  gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uLit, 1);
};

/* ---------------- OnFoot extension (outermost: runs before the UFO / starship ones) ---------------- */
{ const up0 = OF.prototype.update;
  OF.prototype.update = function (dt, inp) { const G = this.g.gear; if (G && G.footUpdate(this, dt, inp)) return { vF: this.v }; return up0.call(this, dt, inp); }; }
window.KageGear = Gear; window.KageGearModels = { buildJetpack, buildBoard, buildFlame };
})();
