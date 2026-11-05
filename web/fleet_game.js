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
  ],
  moto: [
    { id: 'm_viali', name: 'CIRCUITO DEI VIALI', laps: 3, pts: roadLoop(1, 1, 5, 4, () => 0) },
    { id: 'm_grande', name: 'GRAN GIRO DEL CENTRO', laps: 2, pts: roadLoop(1, 2, 7, 7, () => 0) }
  ],
  hover: [
    { id: 'h_laguna', name: 'LAGUNA VELOCE', laps: 3, pts: LAGOON.map(p => ({ x: p[0], z: p[1], y: 0 })) },
    { id: 'h_strade', name: 'STRADE SCIVOLOSE', laps: 3, pts: roadLoop(1, 1, 4, 3, () => 0) }
  ],
  sub: [
    { id: 's_abissi', name: 'ABISSI DELLA LAGUNA', laps: 2, pts: LAGOON.map((p, i) => ({ x: p[0], z: p[1], y: [-6, -11, -15, -8, -17, -10, -6, -13, -19, -9, -14, -7][i] })) }
  ]
};
for (const k in COURSES) for (const c of COURSES[k]) {
  const P = c.pts, n = P.length;
  P.forEach((p, i) => { const a = P[(i - 1 + n) % n], b = P[(i + 1) % n]; p.h = Math.atan2(wrapD(b.x - a.x), wrapD(b.z - a.z)); });
  c.len = P.reduce((s, p, i) => s + Math.hypot(wrapD(P[(i + 1) % n].x - p.x), wrapD(P[(i + 1) % n].z - p.z)), 0);
}
const GATE_R = { drone: 6.5, boat: 12, galleon: 32, moto: 9, hover: 12, sub: 7 };
const RIVALS = { drone: ['V. KOVAC', 'H. TANAKA', 'R. OYELARAN', 'S. MORAES', 'E. LINDGREN'], boat: ['M. RUSSO', 'C. DUBOIS', 'A. NAKAMURA', 'T. OKONKWO', 'L. HALVORSEN'], galleon: ['CAP. VASQUEZ', 'CAP. IRONWOOD', 'CAP. SØRENSEN'],
  moto: ['K. ARAI', 'D. FERRERO', 'B. OSEI', 'J. KOWALSKI', 'Y. PARK'], hover: ['N. BERG', 'P. ALVES', 'S. NWOSU', 'R. COSTA', 'T. LIND'], sub: ['DR. ISHII', 'DR. MORAU', 'DR. ADEYEMI'] };

/* ===================================================================== physics */
function newState(kind, x, z, h, y) {
  return { kind, x: wrapP(x), y: y || 0, z: wrapP(z), h: h || 0, vx: 0, vy: 0, vz: 0, vF: 0, pitch: 0, roll: 0, rot: 0, prop: 0, blur: 0,
    sail: 0, sailT: kind === 'galleon' ? 1 : 0, sailYaw: 0, sailSide: 1, eff: 0, energy: 1, shake: 0, hit: 0, foil: 0, stun: 0, cool: 0, thrust: 0, vy0: 0 };
}
const DRONE_P = cfg => { const sh = { racer: [36, 1.9], stealth: [39, 1.6], cargo: [29, 2.2] }[cfg.shell] || [36, 1.9], fr = { quad: [1, 1], hexa: [0.97, 1.12], x8: [0.95, 1.25] }[cfg.frame] || [1, 1]; return { vmax: sh[0] * fr[0], acc: sh[1] * fr[1] }; };
const BOAT_P = cfg => { const e = { outboard: [10, 31, 1.0, 2.6], jet: [12, 29, 1.2, 3.2], efan: [8.5, 34, 0.85, 1.8] }[cfg.engine] || [10, 31, 1, 2.6], hl = { offshore: [1, 1, 1], catamaran: [1.0, 1.06, 1.15], hydrofoil: [0.92, 1.0, 0.9] }[cfg.hull] || [1, 1, 1];
  return { acc: e[0] * hl[0], vmax: e[1] * hl[1], turn: e[2] * hl[2], grip: e[3] * hl[2], foil: cfg.hull === 'hydrofoil' }; };

function collideDrone(st, city, prevY, rad) {
  const r = rad || 1.4, bx = Math.floor(st.x / GP), bz = Math.floor(st.z / GP); let hit = 0;
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
/* KAGE XENO: a heavy, floaty saucer (slow to start, slow to stop), yaws in place, banks gently; F = tractor beam */
function stepUfo(st, inp, dt, city) {
  const boosting = inp.boost && st.energy > 0.02, vmax = boosting ? 120 : 58;
  st.energy = boosting ? Math.max(0, st.energy - dt * 0.1) : Math.min(1, st.energy + dt * 0.05);
  st.h = wrapA(st.h + (inp.yaw || 0) * 1.1 * dt);
  const fx = Math.sin(st.h), fz = Math.cos(st.h), rx = -Math.cos(st.h), rz = Math.sin(st.h);
  const dF = (inp.fwd || 0) * vmax, dS = (inp.strafe || 0) * vmax * 0.6;
  const vF0 = st.vx * fx + st.vz * fz, vS0 = st.vx * rx + st.vz * rz;
  st.vx = ease(st.vx, fx * dF + rx * dS, 0.9, dt); st.vz = ease(st.vz, fz * dF + rz * dS, 0.9, dt);
  st.vy = ease(st.vy, (inp.lift || 0) * 14, 1.6, dt);
  const prevY = st.y;
  st.x = wrapP(st.x + st.vx * dt); st.z = wrapP(st.z + st.vz * dt); st.y += st.vy * dt;
  if (st.y < 0) { st.y = 0; st.vy = 0; }
  if (st.y > 600) { st.y = 600; st.vy = Math.min(0, st.vy); }
  const hit = collideDrone(st, city, prevY, 9);
  if (hit > 2) st.shake = Math.min(1, st.shake + hit * 0.03);
  st.vF = st.vx * fx + st.vz * fz;
  st.pitch = ease(st.pitch, clamp((dF - vF0) / vmax * 0.18, -0.15, 0.15), 2, dt);
  st.roll = ease(st.roll, clamp((dS - vS0) / vmax * 0.2 - (inp.yaw || 0) * 0.08, -0.2, 0.2), 2, dt);
  st.rot += dt * (1.2 + Math.hypot(st.vx, st.vz) * 0.02 + (st.beam ? 2.5 : 0));
  st.beam = !!inp.fire && st.y > 2;
  st.shake = Math.max(0, st.shake - dt * 3);
}
/* KAGE VOLT: the NEON RUN car physics on a lighter, lower, quicker chassis; the body leans into the corners */
function stepMoto(st, inp, dt, city) {
  const c = st.car || (st.car = Object.assign(NR.newCar(), { x: st.x, z: st.z, h: st.h }));
  c.pk = 1.06 * (st.stun > 0 ? 0.6 : 1);
  NR.stepCar(c, { gas: (inp.fwd || 0) > 0, brake: (inp.fwd || 0) < 0, steer: (inp.yaw || 0), hand: false, boost: !!inp.boost }, dt, city);
  st.x = c.x; st.z = c.z; st.h = c.h; st.vx = c.vx; st.vz = c.vz; st.vF = c.vx * Math.sin(c.h) + c.vz * Math.cos(c.h); st.y = 0;
  const sp = Math.hypot(c.vx, c.vz);
  st.roll = ease(st.roll, -c.steer * Math.min(1, sp / 14) * 0.62, 5, dt);
  st.pitch = ease(st.pitch, ((inp.fwd || 0) > 0 ? -0.025 : (inp.fwd || 0) < 0 ? 0.03 : 0) * Math.min(1, sp / 8 + 0.3), 4, dt);
  st.prop += st.vF * dt / 0.33; st.thrust = Math.max(0, inp.fwd || 0); st.energy = c.boost;
  st.shake = c.shake; st.hit = c.hit; st.stun = Math.max(0, st.stun - dt);
}
/* KAGE GLIDE: floats on an air cushion over streets AND water, slides a lot, hops up the quays */
function stepHover(st, inp, dt, city) {
  const boosting = inp.boost && st.energy > 0.02;
  st.energy = boosting ? Math.max(0, st.energy - dt * 0.15) : Math.min(1, st.energy + dt * 0.06);
  const fx = Math.sin(st.h), fz = Math.cos(st.h), th = inp.fwd || 0, vmax = (boosting ? 36 : 26) * (st.stun > 0 ? 0.5 : 1);
  const vF = st.vx * fx + st.vz * fz;
  st.vx += fx * th * (boosting ? 13 : 8.5) * (1 - Math.max(0, vF) / vmax) * dt; st.vz += fz * th * (boosting ? 13 : 8.5) * (1 - Math.max(0, vF) / vmax) * dt;
  const drag = Math.exp(-(th === 0 ? 0.55 : 0.25) * dt); st.vx *= drag; st.vz *= drag;
  st.h = wrapA(st.h + (inp.yaw || 0) * (0.9 + Math.min(1.2, Math.abs(vF) / 10)) * dt);
  const prevX = st.x, prevZ = st.z, prevY = st.y;
  st.x = wrapP(st.x + st.vx * dt); st.z = wrapP(st.z + st.vz * dt);
  const ground = isWater(st.x, st.z) ? -1.2 : 0;
  if (ground > prevY + 0.2 && Math.hypot(st.vx, st.vz) < 5) { st.x = prevX; st.z = prevZ; st.vx *= -0.3; st.vz *= -0.3; }   // too slow to hop the quay
  st.y = ease(st.y, (isWater(st.x, st.z) ? -1.2 : 0) + 0.05 + Math.sin(st.x * 0.3 + st.z * 0.2) * 0.02, ground > prevY ? 9 : 4, dt);
  const hit = collideDrone(st, city, st.y, 2.2);
  if (hit > 2) { st.shake = Math.min(1, st.shake + hit * 0.05); st.hit = Math.min(1, hit * 0.05); }
  st.vF = st.vx * Math.sin(st.h) + st.vz * Math.cos(st.h);
  const vS = st.vx * Math.cos(st.h) - st.vz * Math.sin(st.h);
  st.roll = ease(st.roll, vS * 0.012 - (inp.yaw || 0) * 0.05, 3, dt); st.pitch = ease(st.pitch, -th * 0.04 + (isWater(st.x, st.z) ? Math.sin(st.x * 0.2) * 0.01 : 0), 3, dt);
  st.prop += dt * (12 + Math.abs(th) * 40); st.thrust = Math.abs(th);
  st.shake = Math.max(0, st.shake - dt * 3); st.hit = Math.max(0, st.hit - dt * 2.5); st.stun = Math.max(0, st.stun - dt);
}
/* KAGE ABYSS: free 3D under the lagoon, between the floor (-24 m) and the surface */
const SEABED = -24;
function stepSub(st, inp, dt) {
  const boosting = inp.boost && st.energy > 0.02;
  st.energy = boosting ? Math.max(0, st.energy - dt * 0.1) : Math.min(1, st.energy + dt * 0.04);
  const vmax = (boosting ? 14 : 9) * (st.stun > 0 ? 0.5 : 1), fx = Math.sin(st.h), fz = Math.cos(st.h);
  st.h = wrapA(st.h + (inp.yaw || 0) * 0.9 * dt);
  const tv = (inp.fwd || 0) * vmax;
  st.vF = ease(st.vF, tv, tv > st.vF ? 0.8 : 1.4, dt);
  st.vx = fx * st.vF; st.vz = fz * st.vF;
  st.vy = ease(st.vy, (inp.lift || 0) * 4, 1.5, dt);
  st.x = wrapP(st.x + st.vx * dt); st.z = wrapP(st.z + st.vz * dt); st.y += st.vy * dt;
  st.y = clamp(st.y, SEABED + 1.3, -1.6);
  const hit = waterPush(st, [[0, 3.2], [0, -3.2], [1.2, 0], [-1.2, 0]]);
  if (hit > 1) { st.shake = Math.min(1, st.shake + hit * 0.1); st.hit = Math.min(1, hit * 0.1); st.vF *= 0.5; }
  st.pitch = ease(st.pitch, -st.vy * 0.08, 2, dt); st.roll = ease(st.roll, -(inp.yaw || 0) * clamp(st.vF / 8, 0, 1) * 0.15, 2, dt);
  st.prop += dt * (6 + Math.abs(st.vF) * 6); st.thrust = Math.abs(inp.fwd || 0);
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
  if (st.kind === 'sub') { inp.fwd = clamp(1.05 - Math.abs(e) * 0.9, 0.2, 1) * r.skill; inp.lift = clamp((g.y - st.y) * 0.35, -1, 1); return inp; }
  if (st.kind === 'moto') { inp.fwd = Math.abs(e) > 0.7 && Math.hypot(st.vx, st.vz) > 14 ? -0.5 : r.skill > 0.9 || Math.abs(e) < 0.5 ? 1 : 0.6; inp.boost = Math.abs(e) < 0.1 && d > 60 && r.skill > 0.95; return inp; }
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
const FleetAudio = window.FleetAudio;   // web/fleet_audio.js

/* ===================================================================== the fleet in the game */
function FleetGame(game) {
  this.g = game; this.gl = game.gl;
  this.quality = game.o.quality || 'high';
  this.wind = { dir: 1.1, speed: 11, t: 0 };
  this.kind = null; this.cfg = null; this.models = {};
  this.light = game.vmesh(KF.buildLighthouse());
  this.gates = { drone: game.vmesh(KF.buildGate('drone')), boat: game.vmesh(KF.buildGate('boat')), galleon: game.vmesh(KF.buildGate('galleon')) };
  this.gates.sub = this.gates.drone; this.gates.moto = this.gates.boat; this.gates.hover = this.gates.boat;
  { const mb = new KF.MB(), m = { c: [1, 0.82, 0.5], e: 0.12, slot: 0 }; for (let k = 0; k < 10; k++) { const a0 = k / 10 * TAU, a1 = (k + 1) / 10 * TAU; mb.poly([[0, 0, 0], [Math.sin(a0) * 4, Math.cos(a0) * 4, 150], [Math.sin(a1) * 4, Math.cos(a1) * 4, 150]], m); } this.beam = game.vmesh(mb.finish()); }
  { const mb = new KF.MB(); mb.box(0, 0, 0, 0.5, 0.5, 4.5, { c: [1, 0.4, 0.9], e: 1.5, slot: 3 }); this.boltM = game.vmesh(mb.finish()); }
  this.bolts = [];
  // under the lagoon: kelp forests, rocks with glowing coral, jellyfish, fish schools and an old wreck
  this.U = { kelp: [0, 1, 2].map(i => game.vmesh(KF.buildKelp(i + 1))), rock: [0, 1, 2, 3].map(i => game.vmesh(KF.buildRock(i + 3))), jelly: game.vmesh(KF.buildJelly()), fish: game.vmesh(KF.buildFish()),
    wreck: game.vmesh(KF.buildGalleon({ lod: 'lo', paint: 'legno', sails: 'classic', led: 'verde' })) };
  { let a2 = 99; const rr = () => { a2 = (a2 * 16807) % 2147483647; return a2 / 2147483647; }, pick = n => { for (let k = 0; k < 40; k++) { const x = HARBOR.x0 + rr() * (HARBOR.x1 - HARBOR.x0), z = HARBOR.z0 + rr() * (HARBOR.z1 - HARBOR.z0); if (isWater(x, z) && isWater(x + 4, z + 4) && isWater(x - 4, z - 4)) return [x, z]; } return null; };
    this.U.items = [];
    for (let k = 0; k < 46; k++) { const p = pick(); if (p) this.U.items.push({ m: this.U.kelp[k % 3], x: p[0], y: SEABED, z: p[1], h: rr() * 6.28, s: 0.8 + rr() * 0.6 }); }
    for (let k = 0; k < 30; k++) { const p = pick(); if (p) this.U.items.push({ m: this.U.rock[k % 4], x: p[0], y: SEABED + 0.3, z: p[1], h: rr() * 6.28, s: 0.8 + rr() * 1.2 }); }
    this.U.jellies = []; for (let k = 0; k < 14; k++) { const p = pick(); if (p) this.U.jellies.push({ x: p[0], z: p[1], y: -6 - rr() * 14, ph: rr() * 6.28 }); }
    this.U.schools = []; for (let k = 0; k < 5; k++) { const p = pick(); if (p) this.U.schools.push({ x: p[0], z: p[1], y: -5 - rr() * 14, r: 14 + rr() * 20, sp: (rr() < 0.5 ? -1 : 1) * (0.1 + rr() * 0.15), ph: rr() * 6.28 }); } }
  // KAGE GARAGE (block 0,0): the whole fleet on display, your pilot at the door
  this.garage = game.vmesh(KF.buildGarage());
  this.gm = { moto: this.model('moto', Object.assign(KF.loadCfg('moto'), { lod: 'lo' })), hover: this.model('hover', Object.assign(KF.loadCfg('hover'), { lod: 'lo' })), drone: this.model('drone', Object.assign(KF.loadCfg('drone'), { lod: 'lo' })),
    sub: this.model('sub', Object.assign(KF.loadCfg('sub'), { lod: 'lo' })), boat: this.model('boat', Object.assign(KF.loadCfg('boat'), { lod: 'lo' })), galleon: this.model('galleon', Object.assign(KF.loadCfg('galleon'), { lod: 'lo' })) };
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
  else if (k === 'moto' || k === 'hover') { const c = this.carSave || g.c; this.st = newState(k, c.x - Math.cos(c.h) * 3, c.z + Math.sin(c.h) * 3, c.h, 0); }
  else if (k === 'sub') { const P = COURSES.sub[0].pts[0]; this.st = newState('sub', P.x, P.z, P.h, -4); }
  else if (k === 'ufo') { const X = this.g.xeno, sp = X ? X.ship : null, c = this.carSave || g.c; this.st = sp ? newState('ufo', sp.x, sp.z, sp.h, sp.y) : newState('ufo', c.x, c.z, c.h, 30); }
  else if (k === 'boat') { const P = COURSES.boat[0].pts[1]; this.st = newState('boat', P.x, P.z, P.h); }
  else { const P = COURSES.galleon[0].pts[3]; this.st = newState('galleon', P.x - 20, P.z, P.h); this.st.sail = this.st.sailT = 0.6; }
  if (this.race) { const r = this.race.me; r.st = this.st; }
  this.camH = this.st.h;
};

/* ---------------- races ---------------- */
FleetGame.prototype.startRace = function (courseId) {
  const k = this.kind; if (!k || !COURSES[k]) return;
  const course = COURSES[k].find(c => c.id === courseId) || COURSES[k][0];
  const P = course.pts, g0 = P[0], fx = Math.sin(g0.h), fz = Math.cos(g0.h), rx = Math.cos(g0.h), rz = -Math.sin(g0.h);
  const names = RIVALS[k], n = names.length + 1, racers = [];
  const rnd = Math.random;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 2), side = i % 2 ? 1 : -1, back = (k === 'galleon' ? 48 : k === 'boat' || k === 'hover' ? 16 : k === 'sub' ? 12 : 8) * (row + 1), lat = (k === 'galleon' ? 14 : k === 'boat' || k === 'hover' ? 4.5 : 3.5) * side;
    const x = g0.x - fx * back + rx * lat, z = g0.z - fz * back + rz * lat;
    const st = newState(k, x, z, g0.h, k === 'drone' || k === 'sub' ? g0.y : 0);
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
    if (R.state === 'countdown' || r.done && !r.me) inp = { fwd: 0, yaw: 0, strafe: 0, lift: r.st.kind === 'drone' || r.st.kind === 'sub' ? clamp((P[0].y - r.st.y) * 0.3, -1, 1) : 0, boost: false };
    if (R.state === 'countdown' && (k === 'moto' || k === 'hover')) { r.st.vx = r.st.vz = 0; if (r.st.car) r.st.car.vx = r.st.car.vz = 0; }
    if (R.state === 'countdown' && k === 'galleon') { r.st.vx = r.st.vz = 0; }
    this.stepOne(r.st, inp, dt, r.cfg);
    if (R.state === 'countdown') { if (k !== 'drone') { r.st.vx *= 0.9; r.st.vz *= 0.9; } continue; }
    if (r.done) continue;
    const g = P[r.next], d = Math.hypot(wrapD(g.x - r.st.x), wrapD(g.z - r.st.z)), dy = Math.abs(r.st.y - g.y);
    if (d < GATE_R[k] && ((k !== 'drone' && k !== 'sub') || dy < 4.5)) {
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
  const rr = k === 'galleon' ? 13 : k === 'boat' || k === 'hover' ? 3.2 : k === 'sub' ? 2.2 : 1.8;
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
  st.steerA = ease(st.steerA || 0, clamp(inp.yaw || 0, -1, 1) * (st.kind === 'moto' ? 0.35 : 0.5), 6, dt);
  if (st.kind === 'moto') stepMoto(st, inp, dt, this.g.city);
  else if (st.kind === 'hover') stepHover(st, inp, dt, this.g.city);
  else if (st.kind === 'sub') stepSub(st, inp, dt);
  else if (st.kind === 'ufo') stepUfo(st, inp, dt, this.g.city);
  else if (st.kind === 'drone') stepDrone(st, inp, dt, this.g.city, cfg);
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
  const D = { drone: [5.5, 1.8, 12, 5], boat: [13, 4.2, 26, 9], galleon: [52, 20, 95, 38], moto: [4.6, 1.8, 10, 4], hover: [11, 4.2, 22, 9], sub: [10, 2.6, 18, 5], ufo: [34, 11, 70, 26] }[k];
  let e, l, fov = 62 + Math.min(16, sp * 0.25), drawCar = true;
  const yb = k === 'drone' || k === 'sub' || k === 'ufo' ? st.y : Math.max(st.y, 0);
  // on the water the chase camera never backs into the buildings on the quays: pull it in over land
  const back = d0 => { if (k === 'drone' || k === 'moto' || k === 'sub' || k === 'ufo') return d0; let d = d0; while (d > 8 && !isWater(st.x - fx * d, st.z - fz * d)) d -= 3; return d; };
  if (v === 0) { const d = back(D[0]); e = [-fx * d, yb + D[1] * (0.6 + 0.4 * d / D[0]), -fz * d]; l = [fx * 4, yb + D[1] * 0.35, fz * 4]; }
  else if (v === 1) { const d = back(D[2]); e = [-fx * d, yb + D[3] * (0.6 + 0.4 * d / D[2]), -fz * d]; l = [fx * 8, yb + 1, fz * 8]; }
  else if (v === 2) {
    const c = Math.cos(st.h), s = Math.sin(st.h);
    const E = k === 'drone' ? KF.DRONE_RIG.fpv : k === 'boat' ? [0, 2.15, 1.4] : k === 'moto' ? [0, 1.45, -0.05] : k === 'hover' ? [0, 1.7, 0.9] : k === 'sub' ? [0, 0.3, 2.4] : k === 'ufo' ? [0, KF.KINDS.ufo.rig.floor + 1.4, 5.15] : KF.GALLEON_RIG.eye;
    const look = st.h, pc = Math.cos(st.pitch * (k === 'drone' ? 0.6 : 1));
    e = [s * E[2] + c * E[0], st.y + E[1], c * E[2] - s * E[0]];
    l = [e[0] + Math.sin(look) * 30 * pc, e[1] - Math.sin(st.pitch * (k === 'drone' ? 0.6 : 1)) * 30 + (k === 'drone' ? 0 : -1.5), e[2] + Math.cos(look) * 30 * pc];
    fov = k === 'drone' ? 98 : k === 'ufo' ? 80 : 72; drawCar = k !== 'drone';
  } else if (v === 3) { this.cinT += dt * 0.22; const r = D[2] * 0.9, a = this.cinT; e = [Math.sin(a) * r, yb + D[3] * 0.7 + Math.sin(this.cinT * 1.7) * D[1], Math.cos(a) * r]; l = [0, yb + D[1] * 0.3, 0]; fov = 50; }
  else { e = [-fx * 2, yb + (k === 'galleon' ? 180 : 75), -fz * 2]; l = [fx * 3, yb, fz * 3]; fov = 60; }
  if (k !== 'sub') { e[1] = Math.max(e[1], -0.4); if (k !== 'drone' && v !== 2) e[1] = Math.max(e[1], 1.5); } else e[1] = Math.min(e[1], -1.5);
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
  gl.uniform1f(u.uRotA, st.rot || 0); gl.uniform1f(u.uPropA, st.prop || 0); gl.uniform1f(u.uBlur, st.blur || 0); if (u.uSteer) gl.uniform1f(u.uSteer, st.steerA || 0);
  gl.uniform1f(u.uSail, st.kind === 'galleon' ? st.sail * (0.3 + 0.7 * (st.eff || 0)) : 0); gl.uniform1f(u.uSailYaw, st.sailYaw || 0); gl.uniform1f(u.uSailSide, st.sailSide || 1); gl.uniform1f(u.uFlut, st.kind === 'galleon' ? 0.3 + (1 - (st.eff || 0)) * st.sail : 0.4);
  if (extra) extra(u);
  this.g.draw(P, m);
  return M;
};
/* ---------------- the player's own pilot (web/pilot.js, customised in the showroom) ---------------- */
FleetGame.prototype.pilotCfg = function () {
  const now = Date.now(); if (!this._pc || now - this._pcT > 1500) { this._pc = window.KagePilot ? KagePilot.load() : null; this._pcT = now; }
  return this._pc;
};
FleetGame.prototype.pilotMesh = function (any) {
  const c = this.pilotCfg(); if (!c || (c.inVehicle === false && !any)) return null;
  const cc = Object.assign({}, c, { pose: undefined, inVehicle: undefined }), key = 'pilot' + this.quality + JSON.stringify(cc);
  if (!this.models[key]) { const m = KagePilot.build(cc, LOD[this.quality]); this.models[key] = this.g.vmesh(m); this.models[key].S = m.S; }
  return this.models[key];
};
/** skinned draw: pose name + options, model matrix Mv (camera relative) */
FleetGame.prototype.drawPilotPose = function (set, Mv, pname, opt, mesh, tt) {
  const pm = mesh || this.pilotMesh(true); if (!pm) return;
  const gl = this.gl, P = this.g.P.pil, u = P.u;
  gl.useProgram(P.p); set(P);
  gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uDay, this.g.dayK || 0); gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uBlur, 0);
  if (u.uShadow) gl.uniform1f(u.uShadow, 0); if (u.uPortal) gl.uniform1f(u.uPortal, 0);
  gl.uniformMatrix4fv(u.uModel, false, Mv);
  gl.uniformMatrix4fv(u['uBones[0]'] || u.uBones, false, KagePilot.pose(pname, tt === undefined ? this.g.t : tt, opt, pm.S));
  this.g.draw(P, pm);
};
/** draw the pilot in vehicle `kind` whose model matrix is Mv (camera-relative) */
FleetGame.prototype.drawPilot = function (set, Mv, kind) {
  const S = window.KagePilot && KagePilot.SEATS[kind]; if (!S) return;
  const pm = this.pilotMesh(); if (!pm) return;
  const g = this.g, st = kind === 'car' || !this.st ? g.c : this.st, sp = kind === 'car' ? Math.abs((g.phys && g.phys.vF) || Math.hypot(g.c.vx, g.c.vz)) : Math.abs(st.vF || 0);
  const now = g.t, dtt = Math.max(1e-3, now - (this._pvT || now - 0.016)); this._acc = ((this._acc || 0) * 0.85) + 0.15 * clamp((sp - (this._pv || 0)) / dtt, -15, 15); this._pv = sp; this._pvT = now;
  this.drawPilotPose(set, U.mul(Mv, U.mul(U.T(S[0], S[1], S[2]), U.RY(S[3]))), S[4], { seat: S[5], steer: kind === 'car' ? (g.c.steer || 0) * 0.4 : kind === 'galleon' ? -(g.c.steer || 0) * 0.3 : (g.c.steer || 0) * 0.4,
    speed: sp, accel: this._acc, lean: kind === 'moto' ? -(st.roll || 0) : 0, boost: !!(g.inp && g.inp.boost) || (kind !== 'car' && st.energy < 0.99 && (st.thrust || 0) > 0.9) }, pm);
};
FleetGame.prototype.drawWorld = function (ctx) {
  const gl = this.gl, P = this.g.P.veh, u = P.u, pal = ctx.pal;
  gl.useProgram(P.p); ctx.set(P);
  gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uDay, this.g.dayK || 0);
  // lighthouse
  this.drawModel(this.light, { x: HARBOR.cx, y: 0, z: HARBOR.cz, h: 0 }, ctx);
  // garage + its display
  { const G = KF.GARAGE, gx = (G.x0 + G.x1) / 2, gz = (G.z0 + G.z1) / 2;
    if (Math.hypot(wrapD(gx - ctx.camX), wrapD(gz - ctx.camZ)) < 420) {
      this.drawModel(this.garage, { x: 0, y: 0, z: 0, h: 0 }, ctx);
      const W = -Math.PI / 2, t = ctx.t;
      this.drawModel(this.gm.moto, { x: G.x1 - 12, y: 0, z: G.z0 + 9, h: W, rot: 0, prop: 0 }, ctx);
      this.drawModel(this.gm.hover, { x: G.x1 - 12, y: 0.03, z: G.z0 + 22, h: W, prop: t * 2 }, ctx);
      this.drawModel(this.gm.drone, { x: G.x0 + 26, y: 1.25 + Math.sin(t * 1.4) * 0.08, z: G.z1 - 10, h: t * 0.2, rot: t * 30, blur: 0.6 }, ctx);
      this.drawModel(this.gm.sub, { x: G.x1 - 12, y: 1.05, z: G.z1 - 20, h: W }, ctx);
      this.drawModel(this.gm.boat, { x: G.x1 - 12, y: 0.75, z: G.z1 - 7, h: W }, ctx);
      const Mg = U.mul(U.T(wrapD(gx - ctx.camX), 1.3, wrapD(gz - ctx.camZ)), U.mul(U.RY(t * 0.15), new Float32Array([0.11, 0, 0, 0, 0, 0.11, 0, 0, 0, 0, 0.11, 0, 0, 0, 0, 1])));
      const gl = this.gl, u = this.g.P.veh.u; gl.uniformMatrix4fv(u.uModel, false, Mg); gl.uniform1f(u.uSail, 0.6); this.g.draw(this.g.P.veh, this.gm.galleon);
      // your pilot at the door: waves when you come close
      const pp = this.playerPos(), near = Math.hypot(wrapD(pp.x - (G.x0 + 5)), wrapD(pp.z - gz)) < 22;
      this.drawPilotPose(ctx.set, U.mul(U.T(wrapD(G.x0 + 5 - ctx.camX), 0, wrapD(gz + 6 - ctx.camZ)), U.RY(W)), near ? 'saluto' : ['in piedi', 'braccia conserte', 'mani sui fianchi'][Math.floor(t / 9) % 3], {});
      gl.useProgram(this.g.P.veh.p); ctx.set(this.g.P.veh);
    } }
  // lagoon traffic
  if (!this.race || this.race.kind === 'drone') for (const a of this.ambient) this.drawModel(a.model, a.st, ctx);
  // race gates
  const R = this.race;
  if (R) {
    const Pp = R.course.pts, n = Pp.length, me = R.me, gm = this.gates[R.kind];
    Pp.forEach((p, i) => {
      const tint = i === me.next ? pal.neonA.map(v => v * (1 + (this.flashGate || 0))) : i === (me.next + 1) % n ? pal.neonB : i === 0 ? [1, 1, 1] : [0.25, 0.25, 0.32];
      this.drawModel(gm, { x: p.x, y: R.kind === 'drone' || R.kind === 'sub' ? p.y : R.kind === 'moto' || (R.kind === 'hover' && !isWater(p.x, p.z)) ? 0.2 : -1.0, z: p.z, h: p.h }, ctx, uu => gl.uniform3fv(uu.uTint, tint));
    });
    gl.uniform3f(u.uTint, -1, 0, 0);
    for (const r of R.racers) if (!r.me) this.drawModel(r.model, r.st, ctx);
  }
  // the player's vehicle
  if (this.kind && this.cv && this.cv.drawCar) {
    const Mv = this.drawModel(this.pm, this.st, ctx);
    if (Mv && this.kind !== 'drone' && this.g.view % 5 !== 2) this.drawPilot(ctx.set, Mv, this.kind);
  }
};
/** seabed + life under the lagoon (only when the camera is below the surface or you pilot the submarine) */
FleetGame.prototype.drawUnder = function (ctx) {
  if (!ctx.under && this.kind !== 'sub') return;
  const g = this.g, gl = this.gl, sb = g.P.seabed;
  if (sb) { gl.useProgram(sb.p); ctx.set(sb); gl.uniform3f(sb.u.uWaterC, HARBOR.cx, SEABED, HARBOR.cz); gl.uniform1f(sb.u.uWaterRel, 0); g.draw(sb, g.M.water); }
  const P = g.P.veh, u = P.u, t = ctx.t;
  gl.useProgram(P.p); ctx.set(P);
  gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uDay, this.g.dayK || 0); gl.uniform1f(u.uBlur, 0); gl.uniform1f(u.uSail, 0); gl.uniform1f(u.uFlut, 0.6); gl.uniform1f(u.uSailSide, 1);
  const M = (x, y, z, h, sc, pitch, roll) => U.mul(U.T(wrapD(x - ctx.camX), y, wrapD(z - ctx.camZ)), U.mul(U.RY(h), U.mul(U.RX(pitch || 0), U.mul(U.RZ(roll || 0), new Float32Array([sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, 1])))));
  const near = (x, z, d) => Math.hypot(wrapD(x - ctx.camX), wrapD(z - ctx.camZ)) < d;
  for (const it of this.U.items) if (near(it.x, it.z, 160)) { gl.uniformMatrix4fv(u.uModel, false, M(it.x, it.y, it.z, it.h, it.s)); g.draw(P, it.m); }
  if (u.uShadow) gl.uniform1f(u.uShadow, 1);
  if (near(1010, 1050, 220)) { gl.uniformMatrix4fv(u.uModel, false, M(1010, SEABED + 2.6, 1050, 2.2, 1, 0.12, 0.42)); g.draw(P, this.U.wreck); }
  if (u.uShadow) gl.uniform1f(u.uShadow, 0);
  for (const sc of this.U.schools) if (near(sc.x, sc.z, 200)) { gl.uniformMatrix4fv(u.uModel, false, M(sc.x + Math.cos(t * sc.sp + sc.ph) * sc.r, sc.y + Math.sin(t * 0.3 + sc.ph) * 1.5, sc.z + Math.sin(t * sc.sp + sc.ph) * sc.r, -(t * sc.sp + sc.ph) + (sc.sp > 0 ? Math.PI : 0), 1)); g.draw(P, this.U.fish); }
  for (const j of this.U.jellies) if (near(j.x, j.z, 140)) { const p = 0.5 + 0.5 * Math.sin(t * 1.3 + j.ph); gl.uniformMatrix4fv(u.uModel, false, U.mul(M(j.x, j.y + Math.sin(t * 0.4 + j.ph) * 2, j.z, t * 0.1, 1), new Float32Array([1 + p * 0.15, 0, 0, 0, 0, 1 - p * 0.15, 0, 0, 0, 0, 1 + p * 0.15, 0, 0, 0, 0, 1]))); g.draw(P, this.U.jelly); }
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

FleetGame.prototype.playerPos = function () { const g = this.g; if (g.veh && this.st) return this.st; if (g.foot && g.foot.active) return g.foot; return g.c; };
FleetGame.prototype.inGarage = function () { const p = this.playerPos(), G = KF.GARAGE, x = ((p.x % S) + S) % S, z = ((p.z % S) + S) % S; return x > G.x0 - 6 && x < G.x1 && z > G.z0 && z < G.z1 && (p.y || 0) < 6; };
FleetGame.prototype.drawGarageHud = function (hud) {
  if (!this.inGarage()) return;
  const g = hud.getContext('2d'), W = hud.width, m = Math.min(W, hud.height), line = 'KAGE GARAGE · premi G per scegliere il veicolo';
  g.font = 'bold ' + (m * 0.024 | 0) + 'px monospace'; g.textAlign = 'center';
  const w = g.measureText(line).width + m * 0.04; g.fillStyle = 'rgba(7,11,19,0.62)'; g.fillRect(W / 2 - w / 2, m * 0.33, w, m * 0.048);
  g.fillStyle = 'rgb(255,80,200)'; g.fillText(line, W / 2, m * 0.364); g.textAlign = 'left';
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
  const l1 = k === 'ufo' ? 'ALT ' + st.y.toFixed(0) + ' m' + (st.beam ? ' · RAGGIO ATTIVO' : '') + ' · ×' + ((this.g.xeno && this.g.xeno.count) || 0) : k === 'sub' ? 'PROFONDITÀ ' + Math.max(0, -1.2 - st.y).toFixed(1) + ' m' : k === 'moto' ? 'PIEGA ' + Math.round(Math.abs(st.roll) * 57) + '°' : k === 'hover' ? (isWater(st.x, st.z) ? 'IN ACQUA' : 'IN STRADA') : k === 'drone' ? 'ALT ' + st.y.toFixed(1) + ' m' : k === 'boat' ? (st.foil > 0.5 ? 'SUI FOIL' : 'IN PLANATA ' + Math.round(clamp(st.vF / 14, 0, 1) * 100) + '%') : 'VELE ' + Math.round(st.sailT * 100) + '% · RESA ' + Math.round((st.eff || 0) * 100) + '%';
  g.fillText(l1, W - m * 0.34, H - m * 0.225);
  g.fillText((k === 'galleon' ? 'ASSIST. FUSIONE ' : k === 'drone' || k === 'sub' ? 'BATTERIA BOOST ' : k === 'ufo' ? 'ENERGIA ' : 'N₂O ') + Math.round(st.energy * 100) + '%', W - m * 0.34, H - m * 0.195);
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
  g.fillText(KF.KINDS[k].title + ' · ' + ['INSEGUIMENTO', 'LONTANA', k === 'drone' ? 'FPV' : k === 'moto' ? 'IN SELLA' : 'PLANCIA', 'CINEMATICA', "DALL'ALTO"][this.g.view % 5], m * 0.03, m * 0.045);
  const help = k === 'ufo' ? 'W/S avanti-indietro · A/D gira · Q/E laterale · SPAZIO sali · X scendi · F raggio traente · SHIFT boost · C vista · INVIO lascia i comandi' : k === 'sub' ? 'W/S avanti-indietro · A/D timone · SPAZIO sali · X scendi · SHIFT boost · C vista · G flotta · INVIO gara' : k === 'moto' ? 'W gas · S freno · A/D piega · SHIFT boost · C vista · G flotta · INVIO gara' : k === 'hover' ? 'W spinta · S retro · A/D timone · SHIFT boost · passa da strada ad acqua · C vista · G flotta · INVIO gara' : k === 'drone' ? 'W/S avanti-indietro · A/D ruota · Q/E laterale · SPAZIO su · X giù · SHIFT boost · C vista · G flotta · INVIO gara'
    : k === 'boat' ? 'W gas · S retro · A/D timone · SHIFT N₂O · C vista · G flotta · INVIO gara'
    : 'W/S issa-ammaina vele · A/D timone · SHIFT assist · SPAZIO cannoni · C vista · G flotta · INVIO regata';
  g.fillText(help, m * 0.03, H - m * 0.02);
  if (!R) { g.fillStyle = A; g.fillText(COURSES[k] ? 'GIRO LIBERO · premi INVIO per una gara (' + COURSES[k][0].name + ')' : 'VOLO LIBERO · F raggio traente sopra strade e persone', m * 0.03, m * 0.075); this.minimap(g, W, H, m, A, B, null); return; }
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
  const self = this, kinds = ['car', 'moto', 'drone', 'hover', 'boat', 'sub', 'galleon', 'ufo'], titles = { ufo: '🛸 UFO', car: '🏎 KAGE GT', moto: '🏍 MOTO', drone: '🚁 DRONE', hover: '🛸 HOVERCRAFT', boat: '🚤 BARCA', sub: '🤿 SOTTOMARINO', galleon: '⛵ GALEONE' };
  const render = () => {
    const k = self.kind || 'car';
    let h = '<b>FLOTTA KAGE</b><div class="frow">' + kinds.map(x => '<button data-v="' + x + '" class="' + (x === k ? 'on' : '') + '">' + titles[x] + '</button>').join('') + '</div>';
    if (window.getRealSky) { const RS = getRealSky(); h += '<div class="frow"><span>LUCE E METEO REALI</span><button data-real="1" class="' + (RS.enabled ? 'on' : '') + '">' + (RS.enabled ? 'ON' : 'OFF') + '</button></div>'; }
    h += '<div class="frow"><span>RISOLUZIONE MODELLI</span>' + ['low', 'high', 'ultra'].map(q => '<button data-q="' + q + '" class="' + (self.quality === q ? 'on' : '') + '">' + { low: 'BASSA', high: 'ALTA', ultra: 'ALTISSIMA' }[q] + '</button>').join('') + '</div>';
    if (k !== 'car') {
      const K = KF.KINDS[k];
      h += '<div class="ftitle">' + K.title + ' · PERSONALIZZA</div><div class="fgrid">';
      for (const key in K.opts) h += '<button data-o="' + key + '">' + KF.OPT_TITLES[key] + ': ' + KF.optLabel(k, key, self.cfg[key]) + '</button>';
      h += '<button data-rnd="1">🎲 CASUALE</button></div><div class="ftitle">GARE</div><div class="fgrid">';
      for (const c of COURSES[k] || []) { const r = self.records[c.id] || {}; h += '<button data-race="' + c.id + '">🏁 ' + c.name + ' · ' + c.laps + ' GIRI' + (r.lap ? ' · REC ' + fmt(r.lap) : '') + '</button>'; }
      h += '<button data-free="1">GIRO LIBERO</button></div>';
    }
    if (self.g.nexus) h += '<div class="ftitle">KAGE NEXUS</div><div class="fgrid"><button data-nexus="1">🌀 VAI AL PORTALE (N = componi)</button>' + (self.g.world === 'eco' ? '<button data-home="1">⟲ TORNA SUBITO IN CITTÀ</button>' : '') + '</div>';
    el.innerHTML = h;
    el.querySelectorAll('button').forEach(b => b.onclick = e => {
      e.stopPropagation(); const d = b.dataset;
      if (d.v) { self.setVehicle(d.v); onChange && onChange('vehicle', d.v); }
      if (d.real && window.getRealSky) { const RS = getRealSky(); RS.setEnabled(!RS.enabled); }
      if (d.q) { self.g.setQuality(d.q); self.setQuality(d.q); onChange && onChange('quality', d.q); }
      if (d.o) { const O = KF.KINDS[self.kind].opts[d.o], i = O.indexOf(self.cfg[d.o]); self.cfg[d.o] = O[(i + 1) % O.length]; self.applyCfg(self.cfg); }
      if (d.rnd) self.applyCfg(KF.randomCfg(self.kind));
      if (d.race) { self.startRace(d.race); el.classList.remove('open'); }
      if (d.free) { self.stopRace(); el.classList.remove('open'); }
      if (d.nexus) { self.g.nexus.goTo(); el.classList.remove('open'); }
      if (d.home) { self.g.world = 'city'; self.g.nexus.burst = 1; el.classList.remove('open'); }
      render();
    });
  };
  this.renderUI = render; render();
};
window.FleetGame = FleetGame;
})();
