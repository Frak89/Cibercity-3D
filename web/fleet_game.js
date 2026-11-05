/* KAGE fleet in NEON RUN: fly the KAGE STRIX drone, drive the KAGE RIPTIDE speedboat or sail the KAGE LEVIATHAN galleon,
 * free roam or race against AI rivals on gate courses (city streets, skyline, harbour lagoon, lighthouse regatta).
 * Hooks into NeonRun.Game (web/game.js): update() / camera() / drawWorld() / drawAdditive() / drawHud() / wake(). */
(function () {
'use strict';
const NR = window.NeonRun, KF = window.KageFleet, U = window.CarRenderUtil;
const { S, GP, HARBOR, isWater, wrapD } = NR;
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const wrapP = v => ((v % S) + S) % S;
const ease = (cur, tgt, k, dt) => cur + (tgt - cur) * Math.min(1, dt * k);
const fmt = t => { if (t == null || !isFinite(t)) return '--:--.---'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); };
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

/* ===================================================================== courses */
/** gates around a rectangle of road intersections (block indices), one every half block, altitude from alt(i) */
function roadLoop(bx0, bz0, bx1, bz1, alt) {
  const P = [], corners = [[bx0, bz0], [bx1, bz0], [bx1, bz1], [bx0, bz1]];
  for (let c = 0; c < 4; c++) {
    const a = corners[c], b = corners[(c + 1) % 4], n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let k = 0; k < n; k++) P.push([(a[0] + (b[0] - a[0]) * k / n) * GP, (a[1] + (b[1] - a[1]) * k / n) * GP]);
  }
  return P.map((p, i) => ({ x: p[0], z: p[1], y: alt(i, P.length) }));
}
const LAGOON = [[756, 800], [756, 924], [756, 1048], [800, 1092], [924, 1060], [1048, 1092], [1092, 1048], [1092, 924], [1092, 800], [1048, 756], [924, 788], [800, 756]];
const FARO = [[870, 870], [924, 852], [978, 870], [996, 924], [978, 978], [924, 996], [870, 978], [852, 924]];
const REGATTA = [[924, 812], [1036, 924], [924, 1036], [812, 924]];
const COURSES = {
  drone: [
    { id: 'd_viali', name: 'CIRCUITO DEI VIALI', laps: 3, pts: roadLoop(1, 1, 5, 4, i => [7, 12, 5, 16, 9, 6, 14][i % 7]) },
    { id: 'd_sky', name: 'SKYLINE', laps: 3, pts: roadLoop(3, 3, 7, 7, (i, n) => 70 + 45 * Math.sin(i / n * TAU * 2) + 20 * Math.sin(i * 1.7)) },
    { id: 'd_porto', name: 'PORTO NEON', laps: 3, pts: LAGOON.map((p, i) => ({ x: p[0], z: p[1], y: [6, 4, 9, 5, 12, 5, 8, 4, 10, 6, 14, 5][i] })) }
  ],
  boat: [
    { id: 'b_laguna', name: 'GIRO DELLA LAGUNA', laps: 3, pts: LAGOON.map(p => ({ x: p[0], z: p[1], y: 0 })) },
    { id: 'b_faro', name: 'ANELLO DEL FARO', laps: 4, pts: FARO.map(p => ({ x: p[0], z: p[1], y: 0 })) }
  ],
  galleon: [
    { id: 'g_regata', name: 'REGATA DEL FARO', laps: 2, pts: REGATTA.map(p => ({ x: p[0], z: p[1], y: 0 })) }
  ]
};
for (const k in COURSES) for (const c of COURSES[k]) {
  const P = c.pts, n = P.length;
  P.forEach((p, i) => { const a = P[(i - 1 + n) % n], b = P[(i + 1) % n]; p.h = Math.atan2(wrapD(b.x - a.x), wrapD(b.z - a.z)); });
  c.len = P.reduce((s, p, i) => s + Math.hypot(wrapD(P[(i + 1) % n].x - p.x), wrapD(P[(i + 1) % n].z - p.z)), 0);
}
const GATE_R = { drone: 6.5, boat: 12, galleon: 32 };
const RIVALS = { drone: ['V. KOVAC', 'H. TANAKA', 'R. OYELARAN', 'S. MORAES', 'E. LINDGREN'], boat: ['M. RUSSO', 'C. DUBOIS', 'A. NAKAMURA', 'T. OKONKWO', 'L. HALVORSEN'], galleon: ['CAP. VASQUEZ', 'CAP. IRONWOOD', 'CAP. SØRENSEN'] };

/* ===================================================================== physics */
function newState(kind, x, z, h, y) {
  return { kind, x: wrapP(x), y: y || 0, z: wrapP(z), h: h || 0, vx: 0, vy: 0, vz: 0, vF: 0, pitch: 0, roll: 0, rot: 0, prop: 0, blur: 0,
    sail: 0, sailT: kind === 'galleon' ? 1 : 0, sailYaw: 0, sailSide: 1, eff: 0, energy: 1, shake: 0, hit: 0, foil: 0, stun: 0, cool: 0, thrust: 0, vy0: 0 };
}
const DRONE_P = cfg => { const sh = { racer: [36, 1.9], stealth: [39, 1.6], cargo: [29, 2.2] }[cfg.shell] || [36, 1.9], fr = { quad: [1, 1], hexa: [0.97, 1.12], x8: [0.95, 1.25] }[cfg.frame] || [1, 1]; return { vmax: sh[0] * fr[0], acc: sh[1] * fr[1] }; };
const BOAT_P = cfg => { const e = { outboard: [10, 31, 1.0, 2.6], jet: [12, 29, 1.2, 3.2], efan: [8.5, 34, 0.85, 1.8] }[cfg.engine] || [10, 31, 1, 2.6], hl = { offshore: [1, 1, 1], catamaran: [1.0, 1.06, 1.15], hydrofoil: [0.92, 1.0, 0.9] }[cfg.hull] || [1, 1, 1];
  return { acc: e[0] * hl[0], vmax: e[1] * hl[1], turn: e[2] * hl[2], grip: e[3] * hl[2], foil: cfg.hull === 'hydrofoil' }; };

function collideDrone(st, city, prevY) {
  const r = 1.4, bx = Math.floor(st.x / GP), bz = Math.floor(st.z / GP); let hit = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const ix = ((bx + i) % 15 + 15) % 15, iz = ((bz + j) % 15 + 15) % 15, sx = (bx + i) * GP - ix * GP, sz = (bz + j) * GP - iz * GP;
    for (const q of city.blocks[iz * 15 + ix]) {
      const top = q[4] || 8; if (st.y > top + 0.45) continue;
      const x0 = q[0] + sx - r, z0 = q[1] + sz - r, x1 = q[2] + sx + r, z1 = q[3] + sz + r;
      if (st.x <= x0 || st.x >= x1 || st.z <= z0 || st.z >= z1) continue;
      if (prevY >= top + 0.35) { st.y = top + 0.45; st.vy = Math.max(0, st.vy); continue; }   // landed on the roof
      const pl = st.x - x0, pr = x1 - st.x, pb = st.z - z0, pt = z1 - st.z, m = Math.min(pl, pr, pb, pt);
      let nx = 0, nz = 0; if (m === pl) nx = -1; else if (m === pr) nx = 1; else if (m === pb) nz = -1; else nz = 1;
      st.x += nx * m; st.z += nz * m;
      const vn = st.vx * nx + st.vz * nz;
      if (vn < 0) { st.vx -= 1.5 * vn * nx; st.vz -= 1.5 * vn * nz; st.vx *= 0.6; st.vz *= 0.6; hit = Math.max(hit, -vn); }
    }
  }
  // lighthouse tower
  const dx = wrapD(st.x - HARBOR.cx), dz = wrapD(st.z - HARBOR.cz), d = Math.hypot(dx, dz);
  if (d < 4 && st.y < 34) { const nx = dx / (d || 1), nz = dz / (d || 1); st.x += nx * (4 - d); st.z += nz * (4 - d); const vn = st.vx * nx + st.vz * nz; if (vn < 0) { st.vx -= 1.5 * vn * nx; st.vz -= 1.5 * vn * nz; hit = Math.max(hit, -vn); } }
  return hit;
}
function stepDrone(st, inp, dt, city, cfg) {
  const P = DRONE_P(cfg), boosting = inp.boost && st.energy > 0.02;
  const vmax = P.vmax * (boosting ? 1.6 : 1) * (st.stun > 0 ? 0.5 : 1);
  st.energy = boosting ? Math.max(0, st.energy - dt * 0.14) : Math.min(1, st.energy + dt * 0.05);
  st.h = wrapA(st.h + (inp.yaw || 0) * 2.1 * dt);
  const fx = Math.sin(st.h), fz = Math.cos(st.h), rx = -Math.cos(st.h), rz = Math.sin(st.h);   // forward, screen-right
  const dF = (inp.fwd || 0) * vmax, dS = (inp.strafe || 0) * vmax * 0.7;
  const tvx = fx * dF + rx * dS, tvz = fz * dF + rz * dS;
  const vF0 = st.vx * fx + st.vz * fz, vS0 = st.vx * rx + st.vz * rz;
  const k = P.acc * (boosting ? 1.3 : 1);
  st.vx = ease(st.vx, tvx, k, dt); st.vz = ease(st.vz, tvz, k, dt);
  st.vy = ease(st.vy, (inp.lift || 0) * 15, 3, dt);
  const prevY = st.y;
  st.x = wrapP(st.x + st.vx * dt); st.z = wrapP(st.z + st.vz * dt); st.y += st.vy * dt;
  const minY = isWater(st.x, st.z) ? -0.75 : 0.32;
  if (st.y < minY) { st.y = minY; st.vy = 0; }
  if (st.y > 420) { st.y = 420; st.vy = Math.min(0, st.vy); }
  const hit = collideDrone(st, city, prevY);
  if (hit > 2) { st.shake = Math.min(1, st.shake + hit * 0.05); st.hit = Math.min(1, hit * 0.05); }
  st.vF = st.vx * fx + st.vz * fz;
  st.pitch = ease(st.pitch, clamp((dF - vF0) / vmax * 0.55 + st.vF / P.vmax * 0.16, -0.5, 0.55), 5, dt);
  st.roll = ease(st.roll, clamp((dS - vS0) / vmax * 0.55 - (inp.yaw || 0) * clamp(st.vF / P.vmax, 0, 1) * 0.35, -0.6, 0.6), 5, dt);
  st.thrust = clamp(0.55 + Math.abs(dF - vF0) / vmax + Math.max(0, inp.lift || 0) * 0.4, 0, 1.6);
  st.rot += dt * (34 + st.thrust * 30); st.blur = ease(st.blur, st.y > 0.4 || st.thrust > 0.6 ? 0.85 : 0.5, 3, dt);
  st.shake = Math.max(0, st.shake - dt * 3); st.hit = Math.max(0, st.hit - dt * 2.5); st.stun = Math.max(0, st.stun - dt);
}
function waterPush(st, probes) {
  let hit = 0;
  for (const [ox, oz] of probes) {
    const c = Math.cos(st.h), s = Math.sin(st.h);
    const px = st.x + s * oz + c * ox, pz = st.z + c * oz - s * ox;
    if (isWater(px, pz)) continue;
    let nx = (isWater(px + 2.5, pz) ? 1 : 0) - (isWater(px - 2.5, pz) ? 1 : 0), nz = (isWater(px, pz + 2.5) ? 1 : 0) - (isWater(px, pz - 2.5) ? 1 : 0);
    if (!nx && !nz) { const dx = wrapD(HARBOR.cx - px), dz = wrapD(HARBOR.cz - pz), l = Math.hypot(dx, dz) || 1; nx = dx / l; nz = dz / l;
      if (Math.hypot(wrapD(px - HARBOR.cx), wrapD(pz - HARBOR.cz)) < 14) { nx = -nx; nz = -nz; } }
    const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    st.x = wrapP(st.x + nx * 0.6); st.z = wrapP(st.z + nz * 0.6);
    const vn = st.vx * nx + st.vz * nz;
    if (vn < 0) { st.vx -= 1.4 * vn * nx; st.vz -= 1.4 * vn * nz; st.vx *= 0.6; st.vz *= 0.6; hit = Math.max(hit, -vn); }
  }
  return hit;
}
function stepBoat(st, inp, dt, cfg, t) {
  const P = BOAT_P(cfg), boosting = inp.boost && st.energy > 0.02 && st.vF > 3;
  st.energy = boosting ? Math.max(0, st.energy - dt * 0.16) : Math.min(1, st.energy + dt * 0.06);
  const foilK = P.foil ? st.foil : 0, vmax = P.vmax * (boosting ? 1.25 : 1) * (1 + foilK * 0.15) * (st.stun > 0 ? 0.5 : 1), acc = P.acc * (boosting ? 1.6 : 1);
  const fx = Math.sin(st.h), fz = Math.cos(st.h), rx = Math.cos(st.h), rz = -Math.sin(st.h);
  let vF = st.vx * fx + st.vz * fz, vR = st.vx * rx + st.vz * rz;
  const th = inp.fwd || 0;
  if (th > 0) vF += acc * th * (1 - Math.max(0, vF) / vmax) * dt;
  else if (th < 0) vF += th * (vF > 0.5 ? 9 : 4) * dt;
  vF -= vF * (0.06 + (th === 0 ? 0.12 : 0)) * dt;
  vF = clamp(vF, -6, vmax + 3);
  const sp = Math.abs(vF);
  const yr = (inp.yaw || 0) * P.turn * clamp(sp / 5, 0.15, 1) / (1 + sp / 38) * (vF < -0.2 ? -1 : 1) * (cfg.engine === 'efan' ? 0.8 + 0.4 * Math.max(0, th) : 1);
  st.h = wrapA(st.h + yr * dt);
  vR *= Math.exp(-P.grip * dt);
  const nfx = Math.sin(st.h), nfz = Math.cos(st.h), nrx = Math.cos(st.h), nrz = -Math.sin(st.h);
  st.vx = nfx * vF + nrx * vR + (fx - nfx) * vF * 0.55; st.vz = nfz * vF + nrz * vR + (fz - nfz) * vF * 0.55;
  st.x = wrapP(st.x + st.vx * dt); st.z = wrapP(st.z + st.vz * dt);
  const hit = waterPush(st, [[0, 4.6], [0, -4.6], [1.35, 0], [-1.35, 0], [1.2, 3], [-1.2, 3]]);
  if (hit > 2) { st.shake = Math.min(1, st.shake + hit * 0.05); st.hit = Math.min(1, hit * 0.05); }
  st.vF = st.vx * nfx + st.vz * nfz;
  st.foil = ease(st.foil, P.foil && st.vF > 14 ? 1 : 0, 1.5, dt);
  st.y = -1.2 + st.foil * 0.95 + Math.sin(t * 1.7 + st.x * 0.05) * 0.06 * (1 - st.foil * 0.6) + clamp(st.vF / 30, 0, 1) * 0.12;
  st.pitch = ease(st.pitch, -0.07 * clamp(st.vF / 12, 0, 1) + 0.04 * clamp((st.vF - 16) / 12, 0, 1) - th * 0.03 * clamp(1 - st.vF / 25, 0, 1) + Math.sin(t * 1.3) * 0.01, 3, dt);
  st.roll = ease(st.roll, -(inp.yaw || 0) * clamp(st.vF / 18, 0, 1) * (P.foil ? 0.2 : 0.12) + Math.sin(t * 1.1 + 1) * 0.012, 3, dt);
  st.prop += dt * (8 + Math.max(0, th) * 45 + Math.abs(st.vF) * 1.5); st.thrust = Math.max(0, th);
  st.shake = Math.max(0, st.shake - dt * 3); st.hit = Math.max(0, st.hit - dt * 2.5); st.stun = Math.max(0, st.stun - dt);
}
function sailEff(theta) { theta = Math.abs(theta); return theta < 0.72 ? 0 : theta < 1.45 ? (theta - 0.72) / 0.73 : theta < 2.4 ? 1 : 1 - (theta - 2.4) * 0.24; }
function stepGalleon(st, inp, dt, wind, t) {
  st.sailT = clamp(st.sailT + (inp.fwd || 0) * 0.55 * dt, 0, 1);
  st.sail = ease(st.sail, st.sailT, 0.6, dt);
  const windFrom = wind.dir + PI, theta = wrapA(st.h - windFrom), eff = sailEff(theta);
  const assist = inp.boost && st.energy > 0.02;
  st.energy = assist ? Math.max(0, st.energy - dt * 0.08) : Math.min(1, st.energy + dt * 0.03);
  const vT = (wind.speed * 1.05 * eff * st.sail + (assist ? 4.5 : 0)) * (st.stun > 0 ? 0.4 : 1);
  const fx = Math.sin(st.h), fz = Math.cos(st.h), rx = Math.cos(st.h), rz = -Math.sin(st.h);
  let vF = st.vx * fx + st.vz * fz, vR = st.vx * rx + st.vz * rz;
  vF += (vT - vF) * (vT > vF ? 0.2 : 0.12) * dt;
  const yr = (inp.yaw || 0) * 0.3 * clamp(Math.abs(vF) / 2.5, 0.22, 1);
  st.h = wrapA(st.h + yr * dt);
  // leeway: the wind pushes the hull sideways a little
  const relW = wrapA(wind.dir - st.h);
  vR += Math.sin(relW) * wind.speed * 0.012 * st.sail * dt; vR *= Math.exp(-1.0 * dt);
  const nfx = Math.sin(st.h), nfz = Math.cos(st.h), nrx = Math.cos(st.h), nrz = -Math.sin(st.h);
  st.vx = nfx * vF + nrx * vR; st.vz = nfz * vF + nrz * vR;
  st.x = wrapP(st.x + st.vx * dt); st.z = wrapP(st.z + st.vz * dt);
  const hit = waterPush(st, [[0, 16.5], [0, -16.5], [4.4, 0], [-4.4, 0], [3.6, 9], [-3.6, 9], [3.6, -9], [-3.6, -9]]);
  if (hit > 1) { st.shake = Math.min(1, st.shake + hit * 0.08); st.hit = Math.min(1, hit * 0.08); }
  st.vF = st.vx * nfx + st.vz * nfz; st.eff = eff;
  st.y = -1.2 + Math.sin(t * 0.8 + st.z * 0.02) * 0.12;
  st.roll = ease(st.roll, Math.sin(relW) * st.sail * (0.3 + 0.7 * eff) * 0.09 + Math.sin(t * 0.7) * 0.02, 0.8, dt);
  st.pitch = ease(st.pitch, Math.sin(t * 0.9 + 1) * 0.015, 1, dt);
  st.sailYaw = ease(st.sailYaw, clamp(relW * 0.35, -0.55, 0.55), 0.8, dt);
  st.sailSide = ease(st.sailSide, Math.sin(relW) >= 0 ? 1 : -1, 1.2, dt);
  st.prop += dt * (assist ? 30 : 0); st.thrust = st.sail;
  st.cool = Math.max(0, st.cool - dt);
  st.shake = Math.max(0, st.shake - dt * 3); st.hit = Math.max(0, st.hit - dt * 2.5); st.stun = Math.max(0, st.stun - dt);
}

/* ===================================================================== AI */
function aiInput(r, course, wind, dt) {
  const st = r.st, P = course.pts, n = P.length, g = P[r.next], g2 = P[(r.next + 1) % n];
  const dx = wrapD(g.x - st.x), dz = wrapD(g.z - st.z), d = Math.hypot(dx, dz);
  // blend towards the following gate when close to cut the corner a little
  const bl = st.kind === 'galleon' ? 0 : clamp(1 - d / 22, 0, 0.6);
  const tx = dx + wrapD(g2.x - g.x) * bl * 0.5, tz = dz + wrapD(g2.z - g.z) * bl * 0.5;
  let want = Math.atan2(tx, tz);
  const inp = { fwd: 0, yaw: 0, strafe: 0, lift: 0, boost: false };
  if (st.kind === 'galleon') {
    const windFrom = wind.dir + PI, off = wrapA(want - windFrom);
    if (Math.abs(off) < 0.85) {                         // dead upwind: beat on alternating tacks
      r.tackT = (r.tackT || 0) + (dt || 1 / 60);
      if (r.tackSide === undefined) r.tackSide = off >= 0 ? 1 : -1;
      if (r.tackT > 28 || Math.abs(wrapA(want - (windFrom + r.tackSide * 0.95))) > 1.2) { r.tackSide = -r.tackSide; r.tackT = 0; }
      want = windFrom + r.tackSide * 0.95;
    } else r.tackSide = undefined;
    const e = wrapA(want - st.h);
    inp.yaw = clamp(e * 2.5, -1, 1); inp.fwd = 1; inp.boost = r.skill > 0.97 && st.energy > 0.5 && d > 80;
    return inp;
  }
  const e = wrapA(want - st.h);
  inp.yaw = clamp(e * 2.6, -1, 1);
  if (st.kind === 'drone') {
    inp.fwd = clamp(1.05 - Math.abs(e) * 1.1, 0.15, 1) * r.skill;
    inp.lift = clamp((g.y + (g2.y - g.y) * bl - st.y) * 0.3, -1, 1);
    inp.boost = Math.abs(e) < 0.15 && d > 60 && st.energy > 0.4 && r.skill > 0.95;
  } else {
    inp.fwd = (Math.abs(e) > 1.1 ? 0.35 : 1) * r.skill;
    inp.boost = Math.abs(e) < 0.12 && d > 70 && st.energy > 0.5;
  }
  return inp;
}

/* ===================================================================== audio (rotor buzz, outboard growl, wind & water) */
function FleetAudio() { this.ctx = null; this.on = false; }
FleetAudio.prototype.start = function () {
  if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C(), out = this.out = ctx.createGain(); out.gain.value = 0.0; out.connect(ctx.destination);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    this.nf = ctx.createBiquadFilter(); this.nf.type = 'bandpass'; this.nf.Q.value = 0.8; this.ng = ctx.createGain(); this.ng.gain.value = 0;
    ns.connect(this.nf); this.nf.connect(this.ng); this.ng.connect(out); ns.start();
    this.osc = []; this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 1200;
    this.sh = ctx.createWaveShaper(); const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cv[i] = Math.tanh(x * 2.5); } this.sh.curve = cv;
    this.og = ctx.createGain(); this.og.gain.value = 0;
    for (const det of [0, 0.013, -0.009, 0.5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100; o.det = det; o.connect(this.sh); o.start(); this.osc.push(o); }
    this.sh.connect(this.lp); this.lp.connect(this.og); this.og.connect(out);
  } catch (e) { this.ctx = null; }
};
FleetAudio.prototype.boom = function () {
  if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.8);
};
FleetAudio.prototype.update = function (kind, st, wind) {
  if (!this.ctx) return; const t = this.ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, t, 0.06);
  set(this.out.gain, this.on && kind ? 0.9 : 0);
  if (!kind) return;
  const sp = Math.hypot(st.vx, st.vz);
  if (kind === 'drone') {
    const f = 92 + st.thrust * 95 + sp * 0.8;
    this.osc.forEach(o => set(o.frequency, f * (1 + o.det) * (o.det === 0.5 ? 1 : 1)));
    set(this.lp.frequency, 900 + st.thrust * 1500); set(this.og.gain, 0.05 + st.thrust * 0.05);
    set(this.nf.frequency, 1100 + sp * 30); set(this.ng.gain, 0.03 + sp * 0.002);
  } else if (kind === 'boat') {
    const f = 36 + st.thrust * 55 + Math.abs(st.vF) * 1.6;
    this.osc.forEach(o => set(o.frequency, f * (1 + o.det)));
    set(this.lp.frequency, 500 + st.thrust * 1400); set(this.og.gain, 0.06 + st.thrust * 0.1);
    set(this.nf.frequency, 500 + sp * 18); set(this.ng.gain, 0.02 + Math.min(0.12, sp * 0.004));
  } else {
    this.osc.forEach(o => set(o.frequency, 48 * (1 + o.det)));
    set(this.og.gain, st.energy < 0.999 && st.thrust > 0 ? 0.0 : 0.0);
    set(this.nf.frequency, 320 + sp * 20); set(this.ng.gain, 0.04 + wind.speed * 0.003 + sp * 0.004);
  }
};

/* ===================================================================== the fleet in the game */
function FleetGame(game) {
  this.g = game; this.gl = game.gl;
  this.quality = game.o.quality || 'high';
  this.wind = { dir: 1.1, speed: 11, t: 0 };
  this.kind = null; this.cfg = null; this.models = {};
  this.light = game.vmesh(KF.buildLighthouse());
  this.gates = { drone: game.vmesh(KF.buildGate('drone')), boat: game.vmesh(KF.buildGate('boat')), galleon: game.vmesh(KF.buildGate('galleon')) };
  { const mb = new KF.MB(), m = { c: [1, 0.82, 0.5], e: 0.12, slot: 0 }; for (let k = 0; k < 10; k++) { const a0 = k / 10 * TAU, a1 = (k + 1) / 10 * TAU; mb.poly([[0, 0, 0], [Math.sin(a0) * 4, Math.cos(a0) * 4, 150], [Math.sin(a1) * 4, Math.cos(a1) * 4, 150]], m); } this.beam = game.vmesh(mb.finish()); }
  { const mb = new KF.MB(); mb.box(0, 0, 0, 0.5, 0.5, 4.5, { c: [1, 0.4, 0.9], e: 1.5, slot: 3 }); this.boltM = game.vmesh(mb.finish()); }
  this.bolts = [];
  this.audio = new FleetAudio();
  this.race = null; this.camH = 0; this.cinT = 0;
  // ambient traffic in the lagoon: speedboats and a galleon doing laps (rebuilt with fresh liveries now and then)
  this.ambient = [];
  const rnd = (() => { let a = 77; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  const mk = (kind, course, start, skill) => { const P = course.pts[start], st = newState(kind, P.x, P.z, P.h); st.sail = 1; return { st, kind, course, next: (start + 1) % course.pts.length, skill, cfg: Object.assign(KF.randomCfg(kind, rnd), { lod: 'lo' }), lap: 0 }; };
  this.ambient.push(mk('boat', COURSES.boat[0], 0, 0.7), mk('boat', COURSES.boat[0], 6, 0.65), mk('boat', COURSES.boat[1], 2, 0.6), mk('galleon', COURSES.galleon[0], 1, 1));
  for (const a of this.ambient) a.model = this.model(a.kind, a.cfg);
  this.records = LS.get('kageFleetRec', {});
}
FleetGame.COURSES = COURSES;
FleetGame.prototype.model = function (kind, cfg) {
  const key = kind + JSON.stringify(cfg);
  if (!this.models[key]) this.models[key] = this.g.vmesh(KF.KINDS[kind].build(cfg));
  return this.models[key];
};
const LOD = { low: 'lo', high: 'hi', ultra: 'ultra' };
FleetGame.prototype.setQuality = function (q) { this.quality = q; if (this.kind) this.pm = this.model(this.kind, Object.assign({}, this.cfg, { lod: LOD[q] || 'hi' })); };
FleetGame.prototype.applyCfg = function (cfg) { if (!this.kind) return; this.cfg = Object.assign({}, cfg); KF.saveCfg(this.kind, this.cfg); this.pm = this.model(this.kind, Object.assign({}, this.cfg, { lod: LOD[this.quality] || 'hi' })); };
/** switch the player between the KAGE GT ('car') and the fleet */
FleetGame.prototype.setVehicle = function (kind) {
  const g = this.g;
  if (kind === 'car' || !kind) {
    if (this.carSave) Object.assign(g.c, this.carSave); this.carSave = null;
    this.kind = null; g.veh = null; this.race = null; this.audio.on = false; this.audio.update(null); if (g.audio) g.audio.on = true; return;
  }
  if (!this.kind) this.carSave = Object.assign({}, g.c);
  this.kind = kind; this.cfg = KF.loadCfg(kind); this.race = null;
  this.pm = this.model(kind, Object.assign({}, this.cfg, { lod: LOD[this.quality] || 'hi' }));
  this.respawn(); g.veh = { kind }; this.audio.on = true;
};
FleetGame.prototype.respawn = function () {
  const g = this.g, k = this.kind;
  if (k === 'drone') { const c = this.carSave || g.c; this.st = newState('drone', c.x, c.z, c.h, 2.5); }
  else if (k === 'boat') { const P = COURSES.boat[0].pts[1]; this.st = newState('boat', P.x, P.z, P.h); }
  else { const P = COURSES.galleon[0].pts[3]; this.st = newState('galleon', P.x - 20, P.z, P.h); this.st.sail = this.st.sailT = 0.6; }
  if (this.race) { const r = this.race.me; r.st = this.st; }
  this.camH = this.st.h;
};

/* ---------------- races ---------------- */
FleetGame.prototype.startRace = function (courseId) {
  const k = this.kind; if (!k) return;
  const course = COURSES[k].find(c => c.id === courseId) || COURSES[k][0];
  const P = course.pts, g0 = P[0], fx = Math.sin(g0.h), fz = Math.cos(g0.h), rx = Math.cos(g0.h), rz = -Math.sin(g0.h);
  const names = RIVALS[k], n = names.length + 1, racers = [];
  const rnd = Math.random;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 2), side = i % 2 ? 1 : -1, back = (k === 'galleon' ? 48 : k === 'boat' ? 16 : 8) * (row + 1), lat = (k === 'galleon' ? 14 : k === 'boat' ? 4.5 : 3.5) * side;
    const x = g0.x - fx * back + rx * lat, z = g0.z - fz * back + rz * lat;
    const st = newState(k, x, z, g0.h, k === 'drone' ? g0.y : 0);
    if (i === 0) this.st = st;
    if (k === 'galleon') { st.sail = st.sailT = 1; }
    const cfg = i === 0 ? this.cfg : Object.assign(KF.randomCfg(k, rnd), { lod: this.quality === 'ultra' ? 'hi' : 'lo' });
    racers.push({ name: i === 0 ? 'TU · ' + KF.KINDS[k].title : names[i - 1], me: i === 0, st, cfg, next: 1, lap: 0, laps: [], lapStart: 0, done: false, total: null, skill: i === 0 ? 1 : 0.86 + rnd() * 0.13,
      model: i === 0 ? null : this.model(k, cfg) });
  }
  this.race = { course, racers, me: racers[0], state: 'countdown', t: -3.5, kind: k, finishOrder: [] };
  this.camH = g0.h;
};
FleetGame.prototype.stopRace = function () { this.race = null; };
FleetGame.prototype.progress = function (r) {
  const P = this.race.course.pts, n = P.length, g = P[r.next], gp = P[(r.next - 1 + n) % n];
  const seg = Math.hypot(wrapD(g.x - gp.x), wrapD(g.z - gp.z)) || 1, d = Math.hypot(wrapD(g.x - r.st.x), wrapD(g.z - r.st.z));
  return (r.done ? 1e6 - r.total : 0) + r.lap * n + ((r.next - 1 + n) % n) + clamp(1 - d / seg, 0, 1);
};
FleetGame.prototype.updateRace = function (dt, inpMe) {
  const R = this.race, P = R.course.pts, n = P.length, k = R.kind, t0 = R.t;
  R.t += dt;
  for (const r of R.racers) {
    let inp = r.me && !this.autoMe ? inpMe : aiInput(r, R.course, this.wind, dt);
    if (R.state === 'countdown' || r.done && !r.me) inp = { fwd: 0, yaw: 0, strafe: 0, lift: r.st.kind === 'drone' ? clamp((P[0].y - r.st.y) * 0.3, -1, 1) : 0, boost: false };
    if (R.state === 'countdown' && k === 'galleon') { r.st.vx = r.st.vz = 0; }
    this.stepOne(r.st, inp, dt, r.cfg);
    if (R.state === 'countdown') { if (k !== 'drone') { r.st.vx *= 0.9; r.st.vz *= 0.9; } continue; }
    if (r.done) continue;
    const g = P[r.next], d = Math.hypot(wrapD(g.x - r.st.x), wrapD(g.z - r.st.z)), dy = Math.abs(r.st.y - g.y);
    if (d < GATE_R[k] && (k !== 'drone' || dy < 4)) {
      if (r.next === 0) {
        const lt = R.t - r.lapStart; r.laps.push(lt); r.lapStart = R.t; r.lap++;
        if (r.lap >= R.course.laps) { r.done = true; r.total = R.t; R.finishOrder.push(r); }
      }
      r.next = (r.next + 1) % n;
      if (r.me) this.flashGate = 1;
    }
  }
  if (R.state === 'countdown' && R.t >= 0) { R.state = 'race'; for (const r of R.racers) r.lapStart = 0; }
  // collisions between racers (soft)
  const rr = k === 'galleon' ? 13 : k === 'boat' ? 3.2 : 1.8;
  for (let i = 0; i < R.racers.length; i++) for (let j = i + 1; j < R.racers.length; j++) {
    const a = R.racers[i].st, b = R.racers[j].st, dx = wrapD(b.x - a.x), dz = wrapD(b.z - a.z), dy = k === 'drone' ? b.y - a.y : 0, d = Math.hypot(dx, dz, dy);
    if (d > 0 && d < rr * 2) { const p = (rr * 2 - d) / 2, nx = dx / d, nz = dz / d; a.x = wrapP(a.x - nx * p); a.z = wrapP(a.z - nz * p); b.x = wrapP(b.x + nx * p); b.z = wrapP(b.z + nz * p);
      const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (vn < 0) { a.vx += vn * nx * 0.5; a.vz += vn * nz * 0.5; b.vx -= vn * nx * 0.5; b.vz -= vn * nz * 0.5; } }
  }
  if (R.me.done && R.state !== 'finished') {
    R.state = 'finished';
    const rec = this.records[R.course.id] || {}; const best = Math.min(...R.me.laps);
    if (!rec.lap || best < rec.lap) rec.lap = best; if (!rec.total || R.me.total < rec.total) rec.total = R.me.total;
    this.records[R.course.id] = rec; LS.set('kageFleetRec', this.records);
  }
  void t0;
};
FleetGame.prototype.stepOne = function (st, inp, dt, cfg) {
  if (st.kind === 'drone') stepDrone(st, inp, dt, this.g.city, cfg);
  else if (st.kind === 'boat') stepBoat(st, inp, dt, cfg, this.g.t);
  else {
    stepGalleon(st, inp, dt, this.wind, this.g.t);
    if (inp.fire && st.cool <= 0) this.fire(st);
  }
};
FleetGame.prototype.fire = function (st) {
  st.cool = 3.5; const c = Math.cos(st.h), s = Math.sin(st.h);
  for (const sd of [-1, 1]) for (let g = 0; g < 9; g++) {
    const lz = -17 + (0.3 + g * 0.055) * 34, lx = sd * 4.6;
    this.bolts.push({ x: st.x + s * lz + c * lx, y: 0.3, z: st.z + c * lz - s * lx, vx: c * sd * 85 + st.vx, vz: -s * sd * 85 + st.vz, life: 1.1, h: st.h + PI / 2, from: st });
  }
  if (st === this.st) this.audio.boom();
};

/* ---------------- per-frame update (called by Game.frame) ---------------- */
FleetGame.prototype.update = function (dt, inp) {
  const g = this.g, t = g.t;
  this.wind.t += dt; this.wind.dir = 1.1 + Math.sin(this.wind.t * 0.013) * 0.6; this.wind.speed = 11 + Math.sin(this.wind.t * 0.031) * 2.5;
  if (this.race) this.updateRace(dt, inp); else if (this.st) this.stepOne(this.st, inp, dt, this.cfg);
  // ambient lagoon traffic (not while racing on the water)
  if (!this.race || this.race.kind === 'drone') for (const a of this.ambient) {
    const P = a.course.pts;
    this.stepOne(a.st, aiInput(a, a.course, this.wind, dt), dt, a.cfg);
    if (Math.hypot(wrapD(P[a.next].x - a.st.x), wrapD(P[a.next].z - a.st.z)) < GATE_R[a.kind] * 1.5) a.next = (a.next + 1) % P.length;
  }
  // light-cannon bolts
  for (const b of this.bolts) {
    b.x = wrapP(b.x + b.vx * dt); b.z = wrapP(b.z + b.vz * dt); b.life -= dt;
    const targets = this.race ? this.race.racers.map(r => r.st) : this.ambient.map(a => a.st);
    for (const s2 of targets) if (s2 !== b.from && s2.kind === 'galleon' && Math.hypot(wrapD(s2.x - b.x), wrapD(s2.z - b.z)) < 12) { s2.stun = 2.5; s2.hit = 1; b.life = 0; }
  }
  this.bolts = this.bolts.filter(b => b.life > 0);
  this.flashGate = Math.max(0, (this.flashGate || 0) - dt * 2);
  // the game's car object mirrors the vehicle (camera, post FX, minimap)
  const st = this.st, c = g.c;
  c.x = st.x; c.z = st.z; c.h = st.h; c.y = st.y; c.vx = st.vx; c.vz = st.vz; c.shake = st.shake; c.hit = st.hit; c.steer = inp.yaw || 0;
  this.audio.update(this.kind, st, this.wind);
  return { vF: st.vF, boosting: false, slip: 0, wheelspin: 0, brakeHard: false };
};
FleetGame.prototype.camera = function (view, dt, t) {
  const st = this.st, k = this.kind, v = view % 5;
  this.camH += wrapA(st.h - this.camH) * Math.min(1, dt * (k === 'galleon' ? 1.5 : v === 1 ? 2.5 : 4));
  const fx = Math.sin(this.camH), fz = Math.cos(this.camH), sp = Math.hypot(st.vx, st.vz);
  const D = { drone: [5.5, 1.8, 12, 5], boat: [13, 4.2, 26, 9], galleon: [52, 20, 95, 38] }[k];
  let e, l, fov = 62 + Math.min(16, sp * 0.25), drawCar = true;
  const yb = Math.max(st.y, k === 'drone' ? st.y : 0);
  // on the water the chase camera never backs into the buildings on the quays: pull it in over land
  const back = d0 => { if (k === 'drone') return d0; let d = d0; while (d > 8 && !isWater(st.x - fx * d, st.z - fz * d)) d -= 3; return d; };
  if (v === 0) { const d = back(D[0]); e = [-fx * d, yb + D[1] * (0.6 + 0.4 * d / D[0]), -fz * d]; l = [fx * 4, yb + D[1] * 0.35, fz * 4]; }
  else if (v === 1) { const d = back(D[2]); e = [-fx * d, yb + D[3] * (0.6 + 0.4 * d / D[2]), -fz * d]; l = [fx * 8, yb + 1, fz * 8]; }
  else if (v === 2) {
    const c = Math.cos(st.h), s = Math.sin(st.h);
    const E = k === 'drone' ? KF.DRONE_RIG.fpv : k === 'boat' ? [0, 2.15, 1.4] : KF.GALLEON_RIG.eye;
    const look = st.h, pc = Math.cos(st.pitch * (k === 'drone' ? 0.6 : 1));
    e = [s * E[2] + c * E[0], st.y + E[1], c * E[2] - s * E[0]];
    l = [e[0] + Math.sin(look) * 30 * pc, e[1] - Math.sin(st.pitch * (k === 'drone' ? 0.6 : 1)) * 30 + (k === 'drone' ? 0 : -1.5), e[2] + Math.cos(look) * 30 * pc];
    fov = k === 'drone' ? 98 : 72; drawCar = k !== 'drone';
  } else if (v === 3) { this.cinT += dt * 0.22; const r = D[2] * 0.9, a = this.cinT; e = [Math.sin(a) * r, yb + D[3] * 0.7 + Math.sin(this.cinT * 1.7) * D[1], Math.cos(a) * r]; l = [0, yb + D[1] * 0.3, 0]; fov = 50; }
  else { e = [-fx * 2, yb + (k === 'galleon' ? 180 : 75), -fz * 2]; l = [fx * 3, yb, fz * 3]; fov = 60; }
  e[1] = Math.max(e[1], -0.4); if (k !== 'drone' && v !== 2) e[1] = Math.max(e[1], 1.5);
  const sh = st.shake * 0.25; e[0] += (Math.random() - 0.5) * sh; e[1] += (Math.random() - 0.5) * sh;
  this.cv = { e, l, fov, drawCar, cockpit: false, roll: v === 2 && k === 'drone' ? st.roll : 0 };
  return this.cv;
};
FleetGame.prototype.wake = function (camX, camZ) {
  const st = this.st; if (!this.kind || this.kind === 'drone' || !st) return [0, 0, 0, 0];
  const sp = Math.abs(st.vF), k = this.kind === 'galleon' ? clamp(sp / 9, 0, 0.7) : clamp(sp / 24, 0, 1) * (1 - st.foil * 0.5);
  const back = this.kind === 'galleon' ? 15 : 4.5;
  return [wrapD(st.x - Math.sin(st.h) * back - camX), wrapD(st.z - Math.cos(st.h) * back - camZ), k, st.h];
};

/* ---------------- drawing ---------------- */
FleetGame.prototype.drawModel = function (m, st, ctx, extra) {
  const gl = this.gl, P = this.g.P.veh, u = P.u, rx = wrapD(st.x - ctx.camX), rz = wrapD(st.z - ctx.camZ);
  if (Math.hypot(rx, rz) > 640) return;
  const M = U.mul(U.T(rx, st.y, rz), U.mul(U.RY(st.h), U.mul(U.RX(st.pitch || 0), U.RZ(st.roll || 0))));
  gl.uniformMatrix4fv(u.uModel, false, M);
  gl.uniform1f(u.uRotA, st.rot || 0); gl.uniform1f(u.uPropA, st.prop || 0); gl.uniform1f(u.uBlur, st.blur || 0);
  gl.uniform1f(u.uSail, st.kind === 'galleon' ? st.sail * (0.3 + 0.7 * (st.eff || 0)) : 0); gl.uniform1f(u.uSailYaw, st.sailYaw || 0); gl.uniform1f(u.uSailSide, st.sailSide || 1); gl.uniform1f(u.uFlut, st.kind === 'galleon' ? 0.3 + (1 - (st.eff || 0)) * st.sail : 0.4);
  if (extra) extra(u);
  this.g.draw(P, m);
};
FleetGame.prototype.drawWorld = function (ctx) {
  const gl = this.gl, P = this.g.P.veh, u = P.u, pal = ctx.pal;
  gl.useProgram(P.p); ctx.set(P);
  gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uDay, 0);
  // lighthouse
  this.drawModel(this.light, { x: HARBOR.cx, y: 0, z: HARBOR.cz, h: 0 }, ctx);
  // lagoon traffic
  if (!this.race || this.race.kind === 'drone') for (const a of this.ambient) this.drawModel(a.model, a.st, ctx);
  // race gates
  const R = this.race;
  if (R) {
    const Pp = R.course.pts, n = Pp.length, me = R.me, gm = this.gates[R.kind];
    Pp.forEach((p, i) => {
      const tint = i === me.next ? pal.neonA.map(v => v * (1 + (this.flashGate || 0))) : i === (me.next + 1) % n ? pal.neonB : i === 0 ? [1, 1, 1] : [0.25, 0.25, 0.32];
      this.drawModel(gm, { x: p.x, y: R.kind === 'drone' ? p.y : -1.0, z: p.z, h: p.h }, ctx, uu => gl.uniform3fv(uu.uTint, tint));
    });
    gl.uniform3f(u.uTint, -1, 0, 0);
    for (const r of R.racers) if (!r.me) this.drawModel(r.model, r.st, ctx);
  }
  // the player's vehicle
  if (this.kind && this.cv && this.cv.drawCar) this.drawModel(this.pm, this.st, ctx);
};
FleetGame.prototype.drawAdditive = function (ctx) {
  const gl = this.gl, P = this.g.P.veh, u = P.u;
  gl.useProgram(P.p); ctx.set(P);
  gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uBlur, 0); gl.uniform1f(u.uGlowOnly, 1);
  // rotating lighthouse beams
  for (const off of [0, PI]) this.drawModel(this.beam, { x: HARBOR.cx, y: 30.4, z: HARBOR.cz, h: ctx.t * 0.55 + off, pitch: -0.06 }, ctx);
  for (const b of this.bolts) this.drawModel(this.boltM, { x: b.x, y: b.y + 1.2, z: b.z, h: b.h }, ctx);
  gl.uniform1f(u.uGlowOnly, 0);
};

/* ---------------- HUD ---------------- */
FleetGame.prototype.drawHud = function (hud) {
  const g = hud.getContext('2d'), W = hud.width, H = hud.height, m = Math.min(W, H), st = this.st, k = this.kind, R = this.race;
  const pal = CYBER_PALETTES[this.g.o.palette] || CYBER_PALETTES.neon, A = 'rgb(' + pal.neonA.map(v => v * 255 | 0) + ')', B = 'rgb(' + pal.neonB.map(v => v * 255 | 0) + ')';
  g.clearRect(0, 0, W, H);
  const box = (x, y, w, h) => { g.fillStyle = 'rgba(7,11,19,0.62)'; g.fillRect(x, y, w, h); };
  g.textBaseline = 'alphabetic';
  // speed block
  const sp = Math.hypot(st.vx, st.vz), kmh = sp * 3.6;
  box(W - m * 0.36, H - m * 0.27, m * 0.33, m * 0.24);
  g.textAlign = 'right'; g.fillStyle = '#ecfcff'; g.font = 'bold ' + (m * 0.085 | 0) + 'px monospace';
  g.fillText(k === 'galleon' ? (sp * 1.944).toFixed(1) : Math.round(kmh), W - m * 0.06, H - m * 0.12);
  g.font = (m * 0.022 | 0) + 'px monospace'; g.fillStyle = A; g.fillText(k === 'galleon' ? 'NODI' : 'KM/H', W - m * 0.06, H - m * 0.085);
  g.textAlign = 'left'; g.fillStyle = '#ecfcff'; g.font = (m * 0.02 | 0) + 'px monospace';
  const l1 = k === 'drone' ? 'ALT ' + st.y.toFixed(1) + ' m' : k === 'boat' ? (st.foil > 0.5 ? 'SUI FOIL' : 'IN PLANATA ' + Math.round(clamp(st.vF / 14, 0, 1) * 100) + '%') : 'VELE ' + Math.round(st.sailT * 100) + '% · RESA ' + Math.round((st.eff || 0) * 100) + '%';
  g.fillText(l1, W - m * 0.34, H - m * 0.225);
  g.fillText((k === 'galleon' ? 'ASSIST. FUSIONE ' : k === 'drone' ? 'BATTERIA BOOST ' : 'N₂O ') + Math.round(st.energy * 100) + '%', W - m * 0.34, H - m * 0.195);
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(W - m * 0.34, H - m * 0.05, m * 0.3, m * 0.012); g.fillStyle = A; g.fillRect(W - m * 0.34, H - m * 0.05, m * 0.3 * st.energy, m * 0.012);
  if (k === 'galleon') {   // wind rose: arrow = where the wind blows, relative to the bow
    const cx = W - m * 0.43, cy = H - m * 0.15, r = m * 0.06, a = wrapA(this.wind.dir - st.h);
    box(cx - r * 1.3, cy - r * 1.4, r * 2.6, r * 2.8); g.strokeStyle = 'rgba(236,252,255,0.4)'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    g.strokeStyle = B; g.lineWidth = m * 0.006; g.beginPath(); g.moveTo(cx - Math.sin(a) * r * 0.8, cy + Math.cos(a) * r * 0.8); g.lineTo(cx + Math.sin(a) * r * 0.8, cy - Math.cos(a) * r * 0.8); g.stroke();
    g.fillStyle = B; g.beginPath(); g.arc(cx + Math.sin(a) * r * 0.8, cy - Math.cos(a) * r * 0.8, m * 0.008, 0, TAU); g.fill(); g.lineWidth = 1;
    g.fillStyle = '#ecfcff'; g.textAlign = 'center'; g.font = (m * 0.016 | 0) + 'px monospace'; g.fillText('VENTO ' + this.wind.speed.toFixed(0) + ' m/s', cx, cy + r * 1.3); g.textAlign = 'left';
    if (st.cool > 0) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText('CANNONI ' + st.cool.toFixed(1) + ' s', W - m * 0.34, H - m * 0.165); }
    else { g.fillStyle = A; g.fillText('CANNONI PRONTI', W - m * 0.34, H - m * 0.165); }
  }
  g.fillStyle = 'rgba(236,252,255,0.55)'; g.font = (m * 0.017 | 0) + 'px monospace';
  g.fillText(KF.KINDS[k].title + ' · ' + ['INSEGUIMENTO', 'LONTANA', k === 'drone' ? 'FPV' : 'PLANCIA', 'CINEMATICA', "DALL'ALTO"][this.g.view % 5], m * 0.03, m * 0.045);
  const help = k === 'drone' ? 'W/S avanti-indietro · A/D ruota · Q/E laterale · SPAZIO su · X giù · SHIFT boost · C vista · G flotta · INVIO gara'
    : k === 'boat' ? 'W gas · S retro · A/D timone · SHIFT N₂O · C vista · G flotta · INVIO gara'
    : 'W/S issa-ammaina vele · A/D timone · SHIFT assist · SPAZIO cannoni · C vista · G flotta · INVIO regata';
  g.fillText(help, m * 0.03, H - m * 0.02);
  if (!R) { g.fillStyle = A; g.fillText('GIRO LIBERO · premi INVIO per una gara (' + COURSES[k][0].name + ')', m * 0.03, m * 0.075); this.minimap(g, W, H, m, A, B, null); return; }
  // race panel
  const me = R.me, rank = R.racers.slice().sort((a, b) => this.progress(b) - this.progress(a)), pos = rank.indexOf(me) + 1;
  box(m * 0.02, m * 0.09, m * 0.42, m * 0.2);
  g.fillStyle = A; g.font = 'bold ' + (m * 0.06 | 0) + 'px monospace'; g.fillText('P' + pos + '/' + R.racers.length, m * 0.035, m * 0.155);
  g.fillStyle = '#ecfcff'; g.font = 'bold ' + (m * 0.03 | 0) + 'px monospace'; g.fillText((R.kind === 'galleon' ? 'BORDO ' : 'GIRO ') + Math.min(me.lap + 1, R.course.laps) + '/' + R.course.laps, m * 0.24, m * 0.15);
  g.font = (m * 0.022 | 0) + 'px monospace';
  const cur = R.state === 'race' && !me.done ? R.t - me.lapStart : null, rec = this.records[R.course.id] || {};
  g.fillText('ATTUALE ' + fmt(cur), m * 0.035, m * 0.195); g.fillText('ULTIMO  ' + fmt(me.laps[me.laps.length - 1]), m * 0.035, m * 0.225);
  g.fillStyle = B; g.fillText('RECORD  ' + fmt(rec.lap), m * 0.035, m * 0.255);
  g.fillStyle = 'rgba(236,252,255,0.7)'; g.fillText(R.course.name, m * 0.035, m * 0.28);
  box(m * 0.02, m * 0.3, m * 0.42, m * 0.032 * rank.length + m * 0.02);
  rank.forEach((r, i) => { g.fillStyle = r.me ? A : '#ecfcff'; g.fillText((i + 1) + '. ' + r.name + (r.done ? '  ' + fmt(r.total) : ''), m * 0.035, m * 0.335 + i * m * 0.032); });
  // next gate arrow
  if (R.state !== 'finished') {
    const gq = R.course.pts[me.next], a = wrapA(Math.atan2(wrapD(gq.x - st.x), wrapD(gq.z - st.z)) - st.h), d = Math.hypot(wrapD(gq.x - st.x), wrapD(gq.z - st.z));
    const cx = W / 2, cy = m * 0.09;
    g.save(); g.translate(cx, cy); g.rotate(-a); g.fillStyle = A; g.beginPath(); g.moveTo(0, -m * 0.035); g.lineTo(m * 0.025, m * 0.02); g.lineTo(-m * 0.025, m * 0.02); g.closePath(); g.fill(); g.restore();
    g.textAlign = 'center'; g.fillStyle = '#ecfcff'; g.font = (m * 0.02 | 0) + 'px monospace'; g.fillText(Math.round(d) + ' m' + (R.kind === 'drone' ? ' · Δ ' + (gq.y - st.y).toFixed(0) + ' m' : ''), cx, cy + m * 0.05); g.textAlign = 'left';
  }
  if (R.state === 'countdown') {
    const n = Math.ceil(-R.t); g.textAlign = 'center'; g.font = 'bold ' + (m * 0.16 | 0) + 'px monospace'; g.fillStyle = n <= 1 ? '#ffd23f' : '#ff3b5c';
    g.fillText(n > 3 ? 'PRONTI' : String(n), W / 2, H * 0.45); g.textAlign = 'left';
  } else if (R.t < 1.2) { g.textAlign = 'center'; g.font = 'bold ' + (m * 0.14 | 0) + 'px monospace'; g.fillStyle = '#39ff8f'; g.fillText('VIA!', W / 2, H * 0.45); g.textAlign = 'left'; }
  if (R.state === 'finished') {
    const w = m * 0.7, x = (W - w) / 2, y = H * 0.22; box(x, y, w, m * 0.06 + R.racers.length * m * 0.04 + m * 0.1);
    g.textAlign = 'center'; g.fillStyle = A; g.font = 'bold ' + (m * 0.045 | 0) + 'px monospace'; g.fillText('ARRIVO · P' + (R.finishOrder.indexOf(me) + 1), W / 2, y + m * 0.055);
    g.font = (m * 0.024 | 0) + 'px monospace';
    rank.forEach((r, i) => { g.fillStyle = r.me ? A : '#ecfcff'; g.fillText((i + 1) + '. ' + r.name + '   ' + (r.done ? fmt(r.total) : 'in gara…'), W / 2, y + m * 0.1 + i * m * 0.04); });
    g.fillStyle = B; g.fillText('MIGLIOR GIRO ' + fmt(Math.min(...me.laps)) + ' · RECORD ' + fmt(rec.lap) + ' · INVIO = rivincita', W / 2, y + m * 0.12 + R.racers.length * m * 0.04);
    g.textAlign = 'left';
  }
  this.minimap(g, W, H, m, A, B, R);
};
FleetGame.prototype.minimap = function (g, W, H, m, A, B, R) {
  const st = this.st, sz = m * 0.24, x0 = m * 0.03, y0 = H - sz - m * 0.05, sc = sz / (R ? 420 : 600);
  g.fillStyle = 'rgba(7,11,19,0.55)'; g.fillRect(x0, y0, sz, sz);
  const cx = x0 + sz / 2, cy = y0 + sz / 2;
  const px = wx => cx - wrapD(wx - st.x) * sc, pz = wz => cy - wrapD(wz - st.z) * sc;
  g.save(); g.beginPath(); g.rect(x0, y0, sz, sz); g.clip();
  // lagoon outline
  g.strokeStyle = 'rgba(80,150,220,0.6)'; g.strokeRect(px(HARBOR.x1), pz(HARBOR.z1), (HARBOR.x1 - HARBOR.x0) * sc, (HARBOR.z1 - HARBOR.z0) * sc);
  if (R) {
    const P = R.course.pts; g.strokeStyle = 'rgba(236,252,255,0.5)'; g.lineWidth = 2; g.beginPath();
    P.forEach((p, i) => { const X = px(p.x), Y = pz(p.z); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.stroke(); g.lineWidth = 1;
    g.fillStyle = A; const gq = P[R.me.next]; g.beginPath(); g.arc(px(gq.x), pz(gq.z), m * 0.008, 0, TAU); g.fill();
    for (const r of R.racers) if (!r.me) { g.fillStyle = B; g.beginPath(); g.arc(px(r.st.x), pz(r.st.z), m * 0.006, 0, TAU); g.fill(); }
  }
  g.fillStyle = '#ecfcff'; g.save(); g.translate(cx, cy); g.rotate(st.h + PI); g.beginPath(); g.moveTo(0, -m * 0.012); g.lineTo(m * 0.008, m * 0.01); g.lineTo(-m * 0.008, m * 0.01); g.closePath(); g.fill(); g.restore();
  g.restore();
};

/* ---------------- garage panel (HTML) ---------------- */
FleetGame.prototype.buildUI = function (el, onChange) {
  const self = this, kinds = ['car', 'drone', 'boat', 'galleon'], titles = { car: '🏎 KAGE GT', drone: '🚁 DRONE', boat: '🚤 BARCA', galleon: '⛵ GALEONE' };
  const render = () => {
    const k = self.kind || 'car';
    let h = '<b>FLOTTA KAGE</b><div class="frow">' + kinds.map(x => '<button data-v="' + x + '" class="' + (x === k ? 'on' : '') + '">' + titles[x] + '</button>').join('') + '</div>';
    h += '<div class="frow"><span>RISOLUZIONE MODELLI</span>' + ['low', 'high', 'ultra'].map(q => '<button data-q="' + q + '" class="' + (self.quality === q ? 'on' : '') + '">' + { low: 'BASSA', high: 'ALTA', ultra: 'ALTISSIMA' }[q] + '</button>').join('') + '</div>';
    if (k !== 'car') {
      const K = KF.KINDS[k];
      h += '<div class="ftitle">' + K.title + ' · PERSONALIZZA</div><div class="fgrid">';
      for (const key in K.opts) h += '<button data-o="' + key + '">' + KF.OPT_TITLES[key] + ': ' + KF.optLabel(k, key, self.cfg[key]) + '</button>';
      h += '<button data-rnd="1">🎲 CASUALE</button></div><div class="ftitle">GARE</div><div class="fgrid">';
      for (const c of COURSES[k]) { const r = self.records[c.id] || {}; h += '<button data-race="' + c.id + '">🏁 ' + c.name + ' · ' + c.laps + ' GIRI' + (r.lap ? ' · REC ' + fmt(r.lap) : '') + '</button>'; }
      h += '<button data-free="1">GIRO LIBERO</button></div>';
    }
    el.innerHTML = h;
    el.querySelectorAll('button').forEach(b => b.onclick = e => {
      e.stopPropagation(); const d = b.dataset;
      if (d.v) { self.setVehicle(d.v); onChange && onChange('vehicle', d.v); }
      if (d.q) { self.g.setQuality(d.q); self.setQuality(d.q); onChange && onChange('quality', d.q); }
      if (d.o) { const O = KF.KINDS[self.kind].opts[d.o], i = O.indexOf(self.cfg[d.o]); self.cfg[d.o] = O[(i + 1) % O.length]; self.applyCfg(self.cfg); }
      if (d.rnd) self.applyCfg(KF.randomCfg(self.kind));
      if (d.race) { self.startRace(d.race); el.classList.remove('open'); }
      if (d.free) { self.stopRace(); el.classList.remove('open'); }
      render();
    });
  };
  this.renderUI = render; render();
};
window.FleetGame = FleetGame;
})();
