/* KAGE fleet: procedural models for the KAGE STRIX drone, the KAGE RIPTIDE speedboat and the KAGE LEVIATHAN cyber galleon.
 * Original designs. Every mesh vertex: aPos(3) aNorm(3) aCol(4: rgb + emissive) aAnim(4: code, a, b, c)
 *   code = mode + 8 * slot
 *   mode 0 static · 1 rotor CW / 2 rotor CCW about Y at pivot (a, b) · 3 propeller about Z at pivot (a = x, b = y)
 *        4 sail: yaw about the mast (x = 0, z = c) + billow (a = u, b = v) · 5 fore-aft sail / flag: flutter (a = u, b = v, c = amplitude)
 *        6 rotor blur disc (dithered in with the rotor speed) · 7 strobe light
 *   slot 0 baked colour · 1 paint · 2 accent · 3 LED (emissive) · 4 glass   (traffic copies recolour slots 1 and 3 per instance)
 * Used by the web build directly and by tools/build_vehicles.js to export the Android traffic meshes. */
(function (root) {
'use strict';

/* ---------------- tiny affine helpers: 3x4 row-major [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz] ---------------- */
const I3 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const T = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
const S = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
const RX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; };
const RY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; };
const RZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; };
function mul(a, b) {
  const r = new Array(12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j];
    r[i * 4 + 3] = a[i * 4] * b[3] + a[i * 4 + 1] * b[7] + a[i * 4 + 2] * b[11] + a[i * 4 + 3];
  }
  return r;
}
const M = (...ms) => ms.reduce((a, b) => mul(a, b), I3());
const ap = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------------- mesh builder ---------------- */
function MB() { this.p = []; this.c = []; this.a = []; this.i = []; this.m = I3(); this.stack = []; this.flatN = []; }
MB.prototype.push = function (m) { this.stack.push(this.m); this.m = mul(this.m, m); return this; };
MB.prototype.pop = function () { this.m = this.stack.pop(); return this; };
MB.prototype.tp = function (p) { return ap(this.m, p); };
/** material: { c:[r,g,b], e: emissive, slot, mode, a:[a,b,c] } — a can also be a function of the local point */
MB.prototype.v = function (p, mat, lp) {
  const w = this.tp(p), n = this.p.length / 3;
  this.p.push(w[0], w[1], w[2]);
  this.c.push(mat.c[0], mat.c[1], mat.c[2], mat.e || 0);
  const an = typeof mat.a === 'function' ? mat.a(lp || p, w) : (mat.a || [0, 0, 0]);
  this.a.push((mat.mode || 0) + 8 * (mat.slot || 0), an[0], an[1], an[2]);
  return n;
};
MB.prototype.tri = function (a, b, c) { this.i.push(a, b, c); };
/** flat polygon (convex, ccw seen from outside) */
MB.prototype.poly = function (pts, mat) { const ix = pts.map(p => this.v(p, mat)); for (let k = 1; k + 1 < ix.length; k++) this.tri(ix[0], ix[k], ix[k + 1]); };
MB.prototype.box = function (cx, cy, cz, sx, sy, sz, mat, taper) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2, tx = taper ? taper[0] : 1, ty = taper ? taper[1] : 1;   // taper scales the +z end
  const P = (x, y, z) => [cx + x * (z > 0 ? tx : 1), cy + y * (z > 0 ? ty : 1), cz + z];
  const c = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
  for (const f of [[1, 5, 6, 2], [4, 0, 3, 7], [3, 2, 6, 7], [4, 5, 1, 0], [5, 4, 7, 6], [0, 1, 2, 3]]) this.poly(f.map(k => c[k]), mat);
};
/** cylinder along local y from y0 to y1 */
MB.prototype.cyl = function (y0, y1, r0, r1, seg, mat, caps) {
  const b0 = [], b1 = [];
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2, x = Math.sin(a), z = Math.cos(a);
    b0.push(this.v([x * r0, y0, z * r0], mat)); b1.push(this.v([x * r1, y1, z * r1], mat));
  }
  for (let k = 0; k < seg; k++) { this.tri(b0[k], b0[k + 1], b1[k + 1]); this.tri(b0[k], b1[k + 1], b1[k]); }
  if (caps !== false) {
    const top = [], bot = [];
    for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2; top.push([Math.sin(a) * r1, y1, Math.cos(a) * r1]); bot.unshift([Math.sin(a) * r0, y0, Math.cos(a) * r0]); }
    if (r1 > 1e-4) this.poly(top, mat); if (r0 > 1e-4) this.poly(bot, mat);
  }
};
/** cylinder between two points */
MB.prototype.rod = function (p0, p1, r, seg, mat, r1) {
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(d[0], d[1], d[2]);
  const yaw = Math.atan2(d[0], d[2]), pitch = Math.acos(Math.max(-1, Math.min(1, d[1] / L)));
  this.push(M(T(p0[0], p0[1], p0[2]), RY(yaw), RX(pitch))); this.cyl(0, L, r, r1 === undefined ? r : r1, seg, mat); this.pop();
};
MB.prototype.ellipsoid = function (cx, cy, cz, rx, ry, rz, su, sv, mat) {
  const g = [];
  for (let j = 0; j <= sv; j++) {
    const row = [], v = j / sv * Math.PI, sy = Math.cos(v), sr = Math.sin(v);
    for (let k = 0; k <= su; k++) { const u = k / su * Math.PI * 2; row.push(this.v([cx + Math.sin(u) * sr * rx, cy + sy * ry, cz + Math.cos(u) * sr * rz], mat)); }
    g.push(row);
  }
  for (let j = 0; j < sv; j++) for (let k = 0; k < su; k++) { this.tri(g[j][k], g[j + 1][k], g[j + 1][k + 1]); this.tri(g[j][k], g[j + 1][k + 1], g[j][k + 1]); }
};
/** torus around local y */
MB.prototype.torus = function (R, r, su, sv, mat) {
  const g = [];
  for (let j = 0; j <= su; j++) {
    const row = [], u = j / su * Math.PI * 2;
    for (let k = 0; k <= sv; k++) { const v = k / sv * Math.PI * 2, rr = R + Math.cos(v) * r; row.push(this.v([Math.sin(u) * rr, Math.sin(v) * r, Math.cos(u) * rr], mat)); }
    g.push(row);
  }
  for (let j = 0; j < su; j++) for (let k = 0; k < sv; k++) { this.tri(g[j][k], g[j + 1][k], g[j + 1][k + 1]); this.tri(g[j][k], g[j + 1][k + 1], g[j][k + 1]); }
};
/** surface through rows of points (rows = sections, cols = points across); smooth inside, winding chosen by `flip` */
MB.prototype.grid = function (rows, mat, flip, lpf) {
  const g = rows.map((r, j) => r.map((p, k) => this.v(p, mat, lpf ? lpf(j, k, rows.length, r.length) : p)));
  for (let j = 0; j + 1 < g.length; j++) for (let k = 0; k + 1 < g[j].length; k++) {
    const a = g[j][k], b = g[j + 1][k], c = g[j + 1][k + 1], d = g[j][k + 1];
    if (flip) { this.tri(a, c, b); this.tri(a, d, c); } else { this.tri(a, b, c); this.tri(a, c, d); }
  }
};
/** disc in the local xz plane (both faces) */
MB.prototype.disc = function (r, seg, y, mat) {
  const c0 = this.v([0, y, 0], mat), c1 = this.v([0, y, 0], mat), o = [];
  for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; o.push([this.v([Math.sin(a) * r, y, Math.cos(a) * r], mat), this.v([Math.sin(a) * r, y, Math.cos(a) * r], mat)]); }
  for (let k = 0; k < seg; k++) { this.tri(c0, o[k][0], o[k + 1][0]); this.tri(c1, o[k + 1][1], o[k][1]); }
};
MB.prototype.finish = function () {
  const P = this.p, N = new Float32Array(P.length), I = this.i;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
  }
  for (let k = 0; k < N.length; k += 3) { const l = Math.hypot(N[k], N[k + 1], N[k + 2]) || 1; N[k] /= l; N[k + 1] /= l; N[k + 2] /= l; }
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let k = 0; k < P.length; k += 3) { x0 = Math.min(x0, P[k]); x1 = Math.max(x1, P[k]); y0 = Math.min(y0, P[k + 1]); y1 = Math.max(y1, P[k + 1]); z0 = Math.min(z0, P[k + 2]); z1 = Math.max(z1, P[k + 2]); }
  return { pos: new Float32Array(P), norm: N, col: new Float32Array(this.c), anim: new Float32Array(this.a), idx: I, verts: P.length / 3, bounds: [x0, y0, z0, x1, y1, z1] };
};

/* ---------------- colours shared with the KAGE GT ---------------- */
const COLORS = { bianco: [0.92, 0.92, 0.94], nero: [0.03, 0.03, 0.035], rosso: [0.8, 0.05, 0.08], oro: [0.85, 0.62, 0.18], ciano: [0.0, 0.85, 0.85], viola: [0.55, 0.2, 0.85], arancio: [1.0, 0.45, 0.05],
  blu: [0.05, 0.16, 0.55], verde: [0.05, 0.6, 0.3], argento: [0.62, 0.64, 0.68], legno: [0.22, 0.11, 0.05] };
const LEDS = { ciano: [0.0, 1.0, 0.9], magenta: [1.0, 0.2, 0.75], ambra: [1.0, 0.62, 0.1], viola: [0.6, 0.3, 1.0], lime: [0.5, 1.0, 0.2], bianco: [0.9, 0.95, 1.0], rosso: [1.0, 0.12, 0.15] };
const COLOR_NAMES = { bianco: 'BIANCO', nero: 'NERO', rosso: 'ROSSO', oro: 'ORO', ciano: 'CIANO', viola: 'VIOLA', arancio: 'ARANCIO', blu: 'BLU', verde: 'VERDE', argento: 'ARGENTO', legno: 'LEGNO SCURO',
  magenta: 'MAGENTA', ambra: 'AMBRA', lime: 'LIME' };
const col = (k, set) => (set || COLORS)[k] || COLORS[k] || LEDS[k] || [0.5, 0.5, 0.5];
const mat = (c, e, slot, mode, a) => ({ c, e: e || 0, slot: slot || 0, mode: mode || 0, a });

/* ===================================================================== KAGE STRIX drone */
const DRONE_OPTS = {
  frame: ['quad', 'hexa', 'x8'], shell: ['racer', 'stealth', 'cargo'], blades: [2, 3], guards: [false, true],
  paint: ['nero', 'bianco', 'rosso', 'oro', 'ciano', 'viola', 'arancio', 'blu', 'argento'], accent: ['nero', 'oro', 'argento', 'rosso', 'ciano', 'arancio'],
  led: Object.keys(LEDS)
};
const DRONE_NAMES = { frame: { quad: 'QUAD X', hexa: 'HEXA', x8: 'X8 COASSIALE' }, shell: { racer: 'RACER', stealth: 'STEALTH', cargo: 'CARGO' } };
const DRONE_DEF = { frame: 'quad', shell: 'racer', blades: 3, guards: false, paint: 'nero', accent: 'argento', led: 'ciano' };
/** rig numbers used by the physics, cameras and HUD */
const DRONE_RIG = { armR: 0.95, propY: 0.15, fpv: [0, 0.06, 0.62] };

function buildDrone(o) {
  o = Object.assign({}, DRONE_DEF, o || {});
  const lo = o.lod === 'lo', U = o.lod === 'ultra' ? 3 : 1, mb = new MB();
  const paint = mat(col(o.paint), 0, 1), acc = mat(col(o.accent), 0, 2), carbon = mat([0.035, 0.035, 0.04]), glass = mat([0.02, 0.03, 0.05], 0, 4);
  const led = mat(col(o.led, LEDS), 1, 3), metal = mat([0.5, 0.52, 0.56]);
  const shell = o.shell;
  const L = shell === 'cargo' ? 1.45 : 1.3, Hk = shell === 'cargo' ? 1.35 : shell === 'stealth' ? 0.8 : 1;
  // fuselage: superellipse sections along z
  const ex = shell === 'stealth' ? 1.0 : shell === 'cargo' ? 4.0 : 2.6, ns = lo ? 8 : (shell === 'stealth' ? 8 : 18 * U);
  const st = lo ? [0, 0.3, 0.6, 1] : U > 1 ? Array.from({ length: 23 }, (_, k) => 0.5 - 0.5 * Math.cos(k / 22 * Math.PI)) : [0, 0.08, 0.22, 0.42, 0.6, 0.76, 0.9, 1];
  const prof = t => { // half width, half height, centre y
    const w = t < 0.5 ? lerp(0.08, 0.28, Math.sin(t / 0.5 * Math.PI / 2)) : lerp(0.28, 0.03, Math.pow((t - 0.5) / 0.5, 1.6));
    const h = (t < 0.45 ? lerp(0.05, 0.15, Math.sin(t / 0.45 * Math.PI / 2)) : lerp(0.15, 0.03, Math.pow((t - 0.45) / 0.55, 1.3))) * Hk;
    return [w * (shell === 'cargo' ? 1.1 : 1), h, 0.02 + (t > 0.6 ? (t - 0.6) * -0.08 : 0)];
  };
  const se = (a, e) => { const c = Math.cos(a), s = Math.sin(a); return [Math.sign(s) * Math.pow(Math.abs(s), 2 / e), Math.sign(c) * Math.pow(Math.abs(c), 2 / e)]; };
  const rows = st.map(t => { const [w, h, cy] = prof(t), z = -L * 0.47 + t * L; const r = []; for (let k = 0; k <= ns; k++) { const q = se(k / ns * Math.PI * 2, ex); r.push([q[0] * w, cy + q[1] * h, z]); } return r; });
  mb.grid(rows, paint, true);
  // canopy / sensor glass on the top front
  { const cr = []; for (const t of (lo ? [0.45, 0.85] : [0.42, 0.55, 0.68, 0.8, 0.9])) { const [w, h, cy] = prof(t), z = -L * 0.47 + t * L, r = [];
      for (let k = 0; k <= 8; k++) { const a = -0.9 + k / 8 * 1.8; r.push([Math.sin(a) * w * 0.62, cy + h * (0.55 + 0.5 * Math.cos(a)) + 0.012, z]); } cr.push(r); }
    mb.grid(cr, glass, true); }
  // LED side strips and under-glow
  for (const sx of [-1, 1]) mb.box(sx * 0.27, 0.02, 0.0, 0.012, 0.022, L * 0.55, led);
  if (!lo) { mb.push(T(0, -0.13 * Hk, 0)); mb.torus(0.2, 0.012, 16 * U, 4 * U, mat(col(o.led, LEDS), 0.8, 3)); mb.pop(); }
  // tail fin
  mb.box(0, 0.14 * Hk, -L * 0.36, 0.02, 0.14, 0.22, acc, [1, 0.4]);
  mb.box(0, 0.2 * Hk, -L * 0.38, 0.024, 0.012, 0.2, led);
  // arms + motors + rotors
  const frame = o.frame, nArm = frame === 'hexa' ? 6 : 4, R = DRONE_RIG.armR * (frame === 'hexa' ? 1.05 : 1);
  const angs = []; for (let k = 0; k < nArm; k++) angs.push(frame === 'hexa' ? (30 + k * 60) * Math.PI / 180 : (45 + k * 90) * Math.PI / 180);
  angs.forEach((a, k) => {
    const mx = Math.sin(a) * R, mz = Math.cos(a) * R;
    mb.push(M(RY(a)));
    mb.box(0, 0.0, 0.18 + (R - 0.18) / 2, 0.09, 0.05, R - 0.18, acc, [0.65, 0.8]);       // tapered arm (local +z = outwards)
    if (!lo) mb.box(0, 0.028, 0.18 + (R - 0.18) / 2, 0.02, 0.006, R - 0.3, led);          // LED line along the arm
    mb.pop();
    const levels = frame === 'x8' ? [1, -1] : [1];
    for (const lv of levels) {
      const y0 = lv > 0 ? 0.02 : -0.03;
      mb.push(T(mx, y0, mz));
      mb.cyl(lv > 0 ? 0 : -0.1, lv > 0 ? 0.1 : 0, 0.085, 0.08, lo ? 6 : 14 * U, carbon);
      mb.push(T(0, lv > 0 ? 0.1 : -0.1, 0)); mb.cyl(-0.008, 0.008, 0.083, 0.083, lo ? 6 : 14 * U, led, false); mb.pop();
      const py = lv > 0 ? 0.135 : -0.135, dir = ((k + (lv > 0 ? 0 : 1)) % 2) ? 2 : 1, pv = [mx, mz];
      // hub + blades
      const rot = mat([0.06, 0.06, 0.07], 0, 0, dir, pv), tip = mat(col(o.accent), 0, 2, dir, pv);
      mb.push(T(0, py, 0)); mb.cyl(-0.02, 0.02, 0.03, 0.025, lo ? 4 : 8 * U, rot); mb.pop();
      const nb = lo ? 2 : o.blades;
      for (let b = 0; b < nb; b++) {
        mb.push(M(T(0, py, 0), RY(b / nb * Math.PI * 2 + k), RZ(dir === 1 ? 0.22 : -0.22)));
        mb.box(0.21, 0, 0, 0.36, 0.008, 0.055, rot);
        if (!lo) mb.box(0.405, 0, 0, 0.03, 0.009, 0.045, tip);
        mb.pop();
      }
      if (!lo) { mb.push(T(0, py, 0)); mb.disc(0.43, 20 * U, 0, mat([0.55, 0.6, 0.7], 0.12, 0, 6, pv)); mb.pop(); }
      if (o.guards && lv > 0) {
        mb.push(T(0, py, 0)); mb.torus(0.47, 0.018, lo ? 10 : 24 * U, lo ? 3 : 6 * U, acc); mb.pop();
        for (const ga of [a + Math.PI * 0.75, a - Math.PI * 0.75]) mb.rod([0, 0.06, 0], [Math.sin(ga) * 0.46, py, Math.cos(ga) * 0.46], 0.01, 4, acc);
      }
      // nav lights on the outer side of the motor
      const navC = mz > 0 ? (mx > 0 ? [1, 0.08, 0.06] : [0.1, 1, 0.3]) : [1, 1, 1];
      mb.box(Math.sin(a) * 0.09, 0.05, Math.cos(a) * 0.09, 0.03, 0.03, 0.03, mz > 0 ? mat(navC, 1.2) : mat(navC, 1.6, 0, 7, [k * 0.37, 0, 0]));
      mb.pop();
    }
  });
  // gimbal camera under the nose
  mb.ellipsoid(0, -0.11 * Hk, L * 0.36, 0.075, 0.075, 0.075, lo ? 6 : 14 * U, lo ? 4 : 8 * U, carbon);
  if (!lo) { mb.push(M(T(0, -0.11 * Hk, L * 0.36 + 0.06), RX(Math.PI / 2))); mb.cyl(0, 0.03, 0.04, 0.035, 12 * U, glass); mb.cyl(0.029, 0.034, 0.02, 0.02, 8 * U, mat([0.1, 0.9, 1.0], 1.4)); mb.pop(); }
  // skids
  for (const sx of [-1, 1]) {
    if (!lo) { mb.rod([sx * 0.12, -0.1 * Hk, 0.2], [sx * 0.22, -0.3, 0.22], 0.012, 5, carbon);
    mb.rod([sx * 0.12, -0.1 * Hk, -0.2], [sx * 0.22, -0.3, -0.22], 0.012, 5, carbon); }
    mb.rod([sx * 0.22, -0.3, -0.34], [sx * 0.22, -0.3, 0.34], 0.016, lo ? 3 : 6 * U, acc);
  }
  if (shell === 'cargo') { mb.box(0, -0.2, -0.02, 0.36, 0.14, 0.62, mat(col(o.accent), 0, 2)); mb.box(0, -0.2, -0.02, 0.37, 0.02, 0.5, led); }
  if (shell === 'stealth') { for (const sx of [-1, 1]) mb.box(sx * 0.18, 0.06, -0.32, 0.18, 0.01, 0.25, acc, [0.4, 1]); }
  // headlights
  if (lo) mb.box(0, 0.0, L * 0.5 - 0.02, 0.2, 0.02, 0.02, mat([1, 0.97, 0.9], 1.6)); else for (const sx of [-1, 1]) mb.box(sx * 0.07, 0.0, L * 0.5 - 0.02, 0.06, 0.02, 0.02, mat([1, 0.97, 0.9], 1.6));
  const m = mb.finish(); m.kind = 'drone'; m.opts = o; return m;
}

/* ===================================================================== KAGE RIPTIDE speedboat */
const BOAT_OPTS = {
  hull: ['offshore', 'catamaran', 'hydrofoil'], engine: ['outboard', 'jet', 'efan'],
  paint: ['bianco', 'nero', 'rosso', 'oro', 'ciano', 'viola', 'arancio', 'blu', 'argento'], accent: ['nero', 'oro', 'argento', 'rosso', 'ciano', 'arancio', 'viola'], led: Object.keys(LEDS)
};
const BOAT_NAMES = { hull: { offshore: 'OFFSHORE V', catamaran: 'CATAMARANO', hydrofoil: 'ALISCAFO' }, engine: { outboard: '2 FUORIBORDO', jet: 'IDROGETTO', efan: 'ELICA INTUBATA' } };
const BOAT_DEF = { hull: 'offshore', engine: 'outboard', paint: 'bianco', accent: 'nero', led: 'ciano' };
const BOAT_RIG = { len: 10, beam: 2.7, draft: 0.55, eye: [0, 1.75, -0.6] };

function buildBoat(o) {
  o = Object.assign({}, BOAT_DEF, o || {});
  const lo = o.lod === 'lo', U = o.lod === 'ultra' ? 3 : 1, mb = new MB();
  const paint = mat(col(o.paint), 0, 1), acc = mat(col(o.accent), 0, 2), dark = mat([0.03, 0.03, 0.035]), glass = mat([0.02, 0.03, 0.05], 0, 4);
  const led = mat(col(o.led, LEDS), 1, 3), bottom = mat([0.05, 0.05, 0.06]);
  const Lh = 10, z0 = -5, nst = lo ? 7 : 22 * U;
  const B = t => t < 0.35 ? lerp(1.25, 1.35, t / 0.35) : t < 0.75 ? lerp(1.35, 1.05, (t - 0.35) / 0.4) : 1.05 * Math.pow(Math.max(0, 1 - (t - 0.75) / 0.25), 0.75);
  const Sh = t => lerp(0.55, 0.85, t) + 0.06 * Math.pow(t, 6);
  const K = t => -0.58 + 0.72 * Math.pow(sstep(0.62, 1.0, t), 1.4);
  function hull(ox, bs, nst) {
    const secs = [];
    for (let j = 0; j <= nst; j++) {
      const t = j / nst, b = Math.max(0.004, B(t) * bs), k = K(t), kc = k + b * 0.36, s = Sh(t), z = z0 + t * Lh;
      secs.push({ z, b, k, kc, s });
    }
    const P = (x, y, z) => [ox + x, y, z];
    // bottom panels (keel → chine), sides (chine → rail → sheer) — separate so the chine stays a crisp edge
    for (const sd of [-1, 1]) {
      mb.grid(secs.map(q => [P(0, q.k, q.z), P(sd * q.b * 0.92, q.kc, q.z)]), bottom, sd < 0);
      mb.grid(secs.map(q => [P(sd * q.b * 0.92, q.kc, q.z), P(sd * q.b, q.kc + 0.07, q.z), P(sd * q.b * 0.985, q.s - 0.18, q.z), P(sd * q.b * 0.96, q.s, q.z)]), paint, sd < 0);
      // neon waterline at the spray rail + livery stripe under the sheer
      mb.grid(secs.slice(1, -2).map(q => [P(sd * (q.b + 0.012), q.kc + 0.06, q.z), P(sd * (q.b + 0.012), q.kc + 0.1, q.z)]), led, sd < 0);
      mb.grid(secs.slice(2, -1).map(q => [P(sd * (q.b * 0.99 + 0.01), q.s - 0.3, q.z), P(sd * (q.b * 0.975 + 0.01), q.s - 0.2, q.z)]), acc, sd < 0);
    }
    // transom
    const q = secs[0];
    mb.poly([P(-q.b * 0.96, q.s, q.z), P(q.b * 0.96, q.s, q.z), P(q.b * 0.985, q.s - 0.18, q.z), P(q.b, q.kc + 0.07, q.z), P(q.b * 0.92, q.kc, q.z), P(0, q.k, q.z), P(-q.b * 0.92, q.kc, q.z), P(-q.b, q.kc + 0.07, q.z), P(-q.b * 0.985, q.s - 0.18, q.z)].reverse(), paint);
    return secs;
  }
  let deckL, deckR;
  if (o.hull === 'catamaran') {
    const sL = hull(-0.95, 0.42, nst), sR = hull(0.95, 0.42, nst);
    deckL = sL.map(q => [-0.95 - q.b * 0.96, q.s, q.z]); deckR = sR.map(q => [0.95 + q.b * 0.96, q.s, q.z]);
    // tunnel between the hulls
    mb.grid(sL.map((q, j) => [[-0.95 + q.b * 0.96, q.s - 0.1, q.z], [0.95 - sR[j].b * 0.96, sR[j].s - 0.1, q.z]]), bottom, true);
    // bridge deck covers the full width up to the bow of the hulls
  } else {
    const s = hull(0, 1, nst);
    deckL = s.map(q => [-q.b * 0.96, q.s, q.z]); deckR = s.map(q => [q.b * 0.96, q.s, q.z]);
  }
  // crowned deck
  mb.grid(deckL.map((l, j) => { const r = deckR[j], w = (r[0] - l[0]) / 2, cx = (r[0] + l[0]) / 2, y = l[1]; return [[l[0], y, l[2]], [cx - w * 0.5, y + 0.07, l[2]], [cx, y + 0.1, l[2]], [cx + w * 0.5, y + 0.07, l[2]], [r[0], y, r[2]]]; }), paint, false);
  // deck stripes
  mb.grid(deckL.slice(Math.round(nst * 0.15), Math.round(nst * 0.94)).map((l, j) => { const z = l[2], y = Sh((z - z0) / Lh) + 0.105; return [[-0.18, y, z], [0.18, y, z]]; }), acc, false);
  // cockpit canopy (glass bubble) + frame
  { const rows = []; const tz = lo ? [0.32, 0.45, 0.6] : U > 1 ? Array.from({ length: 14 }, (_, k) => 0.3 + k / 13 * 0.31) : [0.3, 0.36, 0.43, 0.5, 0.56, 0.61];
    for (const t of tz) { const z = z0 + t * Lh, w = (o.hull === 'catamaran' ? 1.15 : B(t) * 0.78), y = Sh(t) + 0.08, hgt = 0.62 * Math.sin((t - 0.29) / 0.33 * Math.PI) + 0.02, r = [];
      const nk = 10 * U; for (let k = 0; k <= nk; k++) { const a = -Math.PI / 2 + k / nk * Math.PI; r.push([Math.sin(a) * w, y + Math.cos(a) * hgt, z]); } rows.push(r); }
    mb.grid(rows, glass, true);
    const zf = z0 + 0.61 * Lh; mb.box(0, Sh(0.61) + 0.12, zf, (o.hull === 'catamaran' ? 2.3 : B(0.61) * 1.56), 0.06, 0.08, acc); }
  // radar arch with LED bar
  { const z = z0 + 0.25 * Lh, w = o.hull === 'catamaran' ? 1.55 : B(0.25) * 0.85, y = Sh(0.25);
    for (const sx of [-1, 1]) mb.rod([sx * w, y, z], [sx * w * 0.8, y + 1.05, z - 0.35], 0.06, lo ? 5 : 8, acc);
    mb.box(0, y + 1.07, z - 0.37, w * 1.7, 0.1, 0.32, acc); mb.box(0, y + 1.0, z - 0.2, w * 1.5, 0.03, 0.03, led);
    mb.box(0, y + 1.3, z - 0.42, 0.04, 0.4, 0.04, dark); mb.box(0, y + 1.52, z - 0.42, 0.07, 0.07, 0.07, mat([1, 1, 1], 1.6, 0, 7, [0.3, 0, 0])); }
  // engines
  const zt = z0;
  if (o.engine === 'outboard') {
    for (const sx of (o.hull === 'catamaran' ? [-0.95, 0.95] : [-0.55, 0.55])) {
      mb.ellipsoid(sx, 0.85, zt - 0.35, 0.28, 0.42, 0.36, lo ? 6 : 14 * U, lo ? 4 : 8 * U, acc);
      mb.box(sx, 0.82, zt - 0.35, 0.58, 0.05, 0.5, led);
      mb.box(sx, 0.05, zt - 0.32, 0.12, 1.2, 0.26, dark);
      mb.box(sx, -0.62, zt - 0.32, 0.16, 0.14, 0.5, dark);
      const pv = [sx, -0.66];
      mb.push(T(sx, -0.66, zt - 0.62));
      for (let b = 0; b < 3; b++) { mb.push(M(RZ(b / 3 * Math.PI * 2), RY(0.35))); mb.box(0, 0.12, 0, 0.1, 0.22, 0.012, mat([0.6, 0.62, 0.66], 0, 0, 3, pv)); mb.pop(); }
      mb.pop();
    }
  } else if (o.engine === 'jet') {
    for (const sx of (o.hull === 'catamaran' ? [-0.95, 0.95] : [-0.5, 0.5])) {
      mb.push(M(T(sx, -0.12, zt + 0.05), RX(-Math.PI / 2))); mb.cyl(0, 0.45, 0.2, 0.16, lo ? 6 : 14, dark); mb.cyl(0.4, 0.46, 0.13, 0.13, lo ? 6 : 14, mat(col(o.led, LEDS), 1.6, 3), false); mb.pop();
    }
    mb.box(0, 0.75, zt - 0.05, 1.4, 0.06, 0.12, led);
  } else {
    const y = Sh(0) + 1.3, z = zt + 0.7, pv = [0, y];
    mb.push(M(T(0, y, z), RX(Math.PI / 2))); mb.torus(0.82, 0.07, lo ? 12 : 28 * U, lo ? 3 : 8 * U, acc); mb.pop();
    mb.push(M(T(0, y, z + 0.02), RX(Math.PI / 2))); mb.torus(0.75, 0.02, lo ? 12 : 28, 3, led); mb.pop();
    for (let b = 0; b < 5; b++) { mb.push(M(T(0, y, z), RZ(b / 5 * Math.PI * 2), RY(0.4))); mb.box(0, 0.38, 0, 0.16, 0.7, 0.02, mat([0.12, 0.12, 0.14], 0, 0, 3, pv)); mb.pop(); }
    mb.push(M(T(0, y, z), RX(Math.PI / 2))); mb.cyl(-0.1, 0.2, 0.14, 0.12, 10, dark); mb.pop();
    for (const sx of [-1, 1]) mb.rod([sx * 0.7, Sh(0) + 0.05, z + 0.4], [sx * 0.5, y - 0.45, z], 0.05, 6, acc);
    mb.box(0, y, z - 0.25, 0.04, 1.4, 0.6, acc, [1, 0.6]);
  }
  // hydrofoil struts and wings
  if (o.hull === 'hydrofoil') {
    for (const [z, w] of [[z0 + 0.72 * Lh, 2.3], [z0 + 0.12 * Lh, 1.7]]) {
      for (const sx of [-1, 1]) mb.box(sx * w * 0.42, -0.75, z, 0.06, 1.1, 0.4, acc);
      mb.box(0, -1.28, z, w, 0.05, 0.42, acc, [1, 1]);
      mb.box(0, -1.25, z + 0.18, w * 0.96, 0.02, 0.03, led);
    }
  }
  // bow lights + nav
  const zb = z0 + 0.86 * Lh;
  for (const sx of [-1, 1]) {
    mb.box(sx * B(0.86) * 0.9, Sh(0.86) - 0.12, zb, 0.04, 0.05, 0.35, mat(sx > 0 ? [1, 0.1, 0.08] : [0.1, 1, 0.3], 1.2));
    mb.box(sx * 0.3, Sh(0.92) + 0.04, z0 + 0.93 * Lh, 0.2, 0.03, 0.1, mat([1, 0.97, 0.9], 1.5));
  }
  const m = mb.finish(); m.kind = 'boat'; m.opts = o; return m;
}

/* ===================================================================== KAGE LEVIATHAN cyber galleon */
const GALLEON_OPTS = {
  sails: ['neon', 'classic', 'solar'], cannons: [true, false],
  paint: ['nero', 'legno', 'rosso', 'blu', 'bianco', 'oro', 'viola'], accent: ['oro', 'argento', 'rosso', 'ciano', 'nero'], led: Object.keys(LEDS)
};
const GALLEON_NAMES = { sails: { neon: 'VELE NEON A PANNELLI', classic: 'VELE CLASSICHE', solar: 'VELE SOLARI' } };
const GALLEON_DEF = { sails: 'neon', cannons: true, paint: 'nero', accent: 'oro', led: 'ciano' };
const GALLEON_RIG = { len: 34, beam: 9, deckY: 2.6, masts: [[9, 24], [0.5, 28], [-9, 18]], eye: [0, 7.6, -13.5] };

function buildGalleon(o) {
  o = Object.assign({}, GALLEON_DEF, o || {});
  const lo = o.lod === 'lo', U = o.lod === 'ultra' ? 3 : 1, mb = new MB();
  const paint = mat(col(o.paint), 0, 1), acc = mat(col(o.accent), 0, 2), dark = mat([0.03, 0.025, 0.02]), rope = mat([0.09, 0.08, 0.07]);
  const led = mat(col(o.led, LEDS), 1, 3), wood = mat([0.16, 0.09, 0.05]), glass = mat([0.02, 0.03, 0.05], 0, 4);
  const Lh = 34, z0 = -17, nst = lo ? 9 : 26 * U;
  const B = t => t < 0.4 ? lerp(3.5, 4.5, Math.sin(t / 0.4 * Math.PI / 2)) : t < 0.78 ? lerp(4.5, 3.8, (t - 0.4) / 0.38) : 3.8 * Math.pow(Math.max(0, 1 - (t - 0.78) / 0.22), 0.8);
  const Sh = t => t < 0.22 ? 4.3 : t < 0.32 ? lerp(4.3, 3.3, (t - 0.22) / 0.1) : t < 0.78 ? 3.3 : lerp(3.3, 4.8, sstep(0.78, 1, t));
  const Kd = t => -2.8 + 2.0 * Math.pow(sstep(0.7, 1.0, t), 1.6) + 0.6 * Math.pow(1 - sstep(0, 0.12, t), 2);
  const secs = [];
  for (let j = 0; j <= nst; j++) { const t = j / nst; secs.push({ t, z: z0 + t * Lh, b: Math.max(0.01, B(t)), k: Kd(t), s: Sh(t) }); }
  const sect0 = q => { const b = q.b, k = q.k; return [[0, k], [b * 0.55, k + 0.25], [b * 0.88, k * 0.55], [b, 0], [b * 0.98, q.s * 0.45], [b * 0.9, q.s]]; };
  const sect = q => { const s = sect0(q); if (U < 2) return s; const o = [s[0]]; for (let i = 0; i + 1 < s.length; i++) { const a = s[i], c = s[i + 1], pm = i > 0 ? s[i - 1] : a, pn = i + 2 < s.length ? s[i + 2] : c;
    for (const t of [0.5, 1]) { const t2 = t * t, t3 = t2 * t; o.push([0, 1].map(d => 0.5 * ((2 * a[d]) + (-pm[d] + c[d]) * t + (2 * pm[d] - 5 * a[d] + 4 * c[d] - pn[d]) * t2 + (-pm[d] + 3 * a[d] - 3 * c[d] + pn[d]) * t3))); } } return o; };
  for (const sd of [-1, 1]) {
    mb.grid(secs.map(q => sect(q).map(p => [sd * p[0], p[1], q.z])), paint, sd < 0);
    // wales (accent) and neon waterline
    for (const [y0, y1, m] of [[0.55, 0.75, acc], [2.25, 2.45, acc], [-0.05, 0.08, led]])
      mb.grid(secs.slice(1, -1).map(q => { const f = y => { const s = sect(q); for (let i = 0; i + 1 < s.length; i++) if (y >= s[i][1] && y <= s[i + 1][1]) return lerp(s[i][0], s[i + 1][0], (y - s[i][1]) / (s[i + 1][1] - s[i][1] || 1)); return q.b; };
        return [[sd * (f(y0) + 0.04), y0, q.z], [sd * (f(y1) + 0.04), y1, q.z]]; }), m, sd < 0);
    // gun ports: emissive light-cannon ports in a row
    if (!lo || true) for (let g = 0; g < 9; g++) {
      const t = 0.3 + g * 0.055, z = z0 + t * Lh, x = sd * (B(t) * 0.995 + 0.05);
      mb.box(x, 1.45, z, 0.06, 0.5, 0.55, mat(col(o.led, LEDS), 1.2, 3));
      if (o.cannons && !lo) mb.rod([x, 1.45, z], [x + sd * 0.9, 1.45, z], 0.14, 8, mat([0.1, 0.1, 0.11]), 0.12);
    }
  }
  // transom with lit stern windows
  { const q = secs[0], s = sect(q); mb.poly(s.map(p => [-p[0], p[1], q.z]).reverse().concat(s.map(p => [p[0], p[1], q.z])).reverse(), paint); }
  // decks
  const deckAt = (t0, t1, y, m) => mb.grid(secs.filter(q => q.t >= t0 - 1e-6 && q.t <= t1 + 1e-6).map(q => [[-q.b * 0.88, y, q.z], [0, y + 0.05, q.z], [q.b * 0.88, y, q.z]]), m, false);
  deckAt(0, 1, GALLEON_RIG.deckY, wood);
  // stern castle (quarterdeck) and forecastle
  { const zA = z0 - 0.2, zB = z0 + 0.3 * Lh, yB = 4.3, yT = 6.6, wA = 3.3, wB = 4.2;
    const C = [[-wA, yB, zA], [wA, yB, zA], [wA, yT + 0.6, zA], [-wA, yT + 0.6, zA], [-wB, yB, zB], [wB, yB, zB], [wB, yT, zB], [-wB, yT, zB]];
    for (const f of [[1, 5, 6, 2], [4, 0, 3, 7], [3, 2, 6, 7], [5, 4, 7, 6], [0, 1, 2, 3]]) mb.poly(f.map(k => C[k]), f[0] === 0 ? paint : f[0] === 3 ? wood : paint);
    for (let w = 0; w < 5; w++) mb.box(-2.4 + w * 1.2, 5.3, zA - 0.05, 0.75, 0.9, 0.08, mat([1.0, 0.65, 0.3], 1.1));       // stern windows
    for (let w = 0; w < 4; w++) mb.box(-1.8 + w * 1.2, 6.45, zA - 0.05, 0.7, 0.35, 0.08, mat(col(o.led, LEDS), 1.3, 3));
    mb.box(0, yT + 0.75, zA + 0.05, wA * 2 + 0.3, 0.2, 0.3, acc);
    for (const sx of [-1, 1]) mb.box(sx * (wB + 0.05), yT - 0.3, (zA + zB) / 2, 0.08, 0.15, zB - zA, led);
    // stern lanterns
    for (const sx of [-2.6, 0, 2.6]) { mb.rod([sx, yT + 0.8, zA + 0.1], [sx, yT + 2.0, zA - 0.4], 0.05, 5, dark); mb.ellipsoid(sx, yT + 2.2, zA - 0.45, 0.3, 0.42, 0.3, 8, 6, mat([1, 0.8, 0.45], 1.6)); }
    const zF = z0 + 0.84 * Lh, zG = z0 + 0.98 * Lh; deckAt(0.84, 0.97, 4.4, wood);
    mb.box(0, 3.9, zF, 7.2, 1.0, 0.25, paint);
  }
  // bulwark rails (accent caps)
  for (const sd of [-1, 1]) mb.grid(secs.slice(Math.round(nst * 0.28), nst).map(q => [[sd * q.b * 0.9, q.s, q.z], [sd * q.b * 0.9, q.s + 0.18, q.z]]), acc, sd < 0);
  // bowsprit + neon spire figurehead
  const zBow = z0 + Lh;
  mb.rod([0, 4.2, zBow - 3], [0, 8.2, zBow + 9], 0.32, 8, wood, 0.14);
  mb.rod([0, 2.6, zBow - 0.4], [0, 3.6, zBow + 2.2], 0.25, 8, mat(col(o.led, LEDS), 1.4, 3), 0.02);
  // masts, tops, yards, sails
  const D = GALLEON_RIG.deckY, sailM = o.sails;
  const sailCol = sailM === 'classic' ? [0.86, 0.81, 0.69] : sailM === 'solar' ? [0.04, 0.09, 0.2] : [0.05, 0.055, 0.08];
  function squareSail(mz, yTop, yBot, wTop, wBot, nu, nv) {
    const rows = [];
    for (let j = 0; j <= nv; j++) { const v = j / nv, y = lerp(yTop, yBot, v), w = lerp(wTop, wBot, v), r = []; for (let k = 0; k <= nu; k++) { const u = k / nu; r.push([(u - 0.5) * w, y, mz + 0.55]); } rows.push(r); }
    const sm = (c, e, slot) => mat(c, e || 0, slot || 0, 4, lp => { const u = (lp[0] / lerp(wTop, wBot, (yTop - lp[1]) / (yTop - yBot)) + 0.5), v = (yTop - lp[1]) / (yTop - yBot); return [u, v, mz]; });
    if (sailM === 'solar' && !lo) {
      // solar cells: each cell its own quad with a slightly different tint, silver seams
      for (let j = 0; j < nv; j++) for (let k = 0; k < nu; k++) {
        const h = Math.sin((j * 7 + k * 13 + mz) * 12.9898) * 43758.5453, f = h - Math.floor(h);
        const c = [0.03 + f * 0.04, 0.08 + f * 0.06, 0.2 + f * 0.12];
        mb.poly([rows[j][k], rows[j][k + 1], rows[j + 1][k + 1], rows[j + 1][k]].map(p => p), sm(c, 0.05));
        mb.poly([rows[j + 1][k], rows[j + 1][k + 1], rows[j][k + 1], rows[j][k]].map(p => [p[0], p[1], p[2] - 0.01]), sm(c, 0.05));
      }
    } else {
      mb.grid(rows, sm(sailCol, sailM === 'neon' ? 0.02 : 0), false);
      mb.grid(rows.map(r => r.map(p => [p[0], p[1], p[2] - 0.01])), sm(sailCol, 0), true);
    }
    // seams / neon panel lines (follow the billow because they carry the same u, v)
    if (sailM !== 'classic' || !lo) {
      const lm = sailM === 'neon' ? sm(col(o.led, LEDS), 1.3, 3) : sailM === 'solar' ? sm([0.7, 0.75, 0.8], 0.2) : sm([0.55, 0.5, 0.42], 0);
      const th = sailM === 'neon' ? 0.09 : 0.05, step = (sailM === 'neon' ? 2 : 1) * U;
      for (let j = 0; j <= nv; j += step) { const y = lerp(yTop, yBot, j / nv), w = lerp(wTop, wBot, j / nv); const seg = [];
        for (let k = 0; k <= nu; k++) { const u = k / nu; seg.push([[(u - 0.5) * w, y - th, mz + 0.62], [(u - 0.5) * w, y + th, mz + 0.62]]); }
        mb.grid(seg, lm, true); }
      for (let k = 0; k <= nu; k += (sailM === 'neon' ? 2 * U : nu)) { const seg = [];
        for (let j = 0; j <= nv; j++) { const v = j / nv, y = lerp(yTop, yBot, v), w = lerp(wTop, wBot, v), x = (k / nu - 0.5) * w; seg.push([[x - th, y, mz + 0.62], [x + th, y, mz + 0.62]]); }
        mb.grid(seg, lm, false); }
    }
  }
  const nu = lo ? 2 : 6 * U, nv = lo ? 2 : 4 * U;
  GALLEON_RIG.masts.forEach(([mz, h], mi) => {
    mb.push(T(0, D, mz)); mb.cyl(0, h, 0.42, 0.16, lo ? 6 : 12 * U, wood); mb.pop();
    // tops (platforms) with LED rim
    for (const f of [0.42, 0.72]) { if (mi === 2 && f > 0.6) continue; mb.push(T(0, D + h * f, mz)); mb.cyl(-0.1, 0.1, 1.3 - f, 1.3 - f, lo ? 6 : 14, dark); mb.cyl(0.1, 0.16, 1.32 - f, 1.32 - f, lo ? 6 : 14, led, false); mb.pop(); }
    const yawm = (mat0) => Object.assign({}, mat0, { mode: 4, a: lp => [0.5, 0, mz] });
    if (mi < 2) {
      const yards = [[0.38, 12 - mi * 0], [0.66, 9.5], [0.9, 6.5]].map(([f, w]) => [D + h * f, w * (mi === 1 ? 1.08 : 1)]);
      for (const [y, w] of yards) { mb.push(M(T(0, y, mz + 0.45), RZ(Math.PI / 2))); mb.cyl(-w / 2, w / 2, 0.16, 0.16, lo ? 5 : 8, yawm(wood)); mb.pop(); }
      for (let s = 0; s + 1 < yards.length; s++) squareSail(mz, yards[s + 1][0] - 0.3, yards[s][0] + 0.5 - (s === 0 ? -0.0 : 0), yards[s + 1][1] * 0.95, yards[s][1] * 0.98, nu, nv);
      squareSail(mz, yards[0][0] - 0.3, D + h * 0.12, yards[0][1] * 0.98, yards[0][1] * 1.02, nu, nv);
      // flag
      { const fy = D + h + 0.2; mb.rod([0, D + h - 0.2, mz], [0, fy + 1.2, mz], 0.05, 5, dark);
        mb.grid([0, 1, 2, 3, 4].map(k => [[0, fy + 1.1, mz - k * 0.5], [0, fy + 0.4, mz - k * 0.5]]), mat(col(o.accent), 0.15, 2, 5, lp => [(mz - lp[2]) / 2, 0, 0.35]), false);
        mb.grid([0, 1, 2, 3, 4].map(k => [[0.01, fy + 1.1, mz - k * 0.5], [0.01, fy + 0.4, mz - k * 0.5]]), mat(col(o.accent), 0.15, 2, 5, lp => [(mz - lp[2]) / 2, 0, 0.35]), true); }
    } else {
      // mizzen: lateen sail (fore-aft) on a diagonal yard
      const yA = D + h * 0.95, yB = D + h * 0.25, zA = mz + 4.5, zB = mz - 6;
      mb.rod([0, yB - 0.6, zB - 0.4], [0, yA + 0.8, zA + 0.6], 0.15, lo ? 5 : 8, wood);
      const rows = []; for (let j = 0; j <= nv; j++) { const v = j / nv, r = []; for (let k = 0; k <= nu; k++) { const u = k / nu, za = lerp(zB, zA, u), ya = lerp(yB, yA, u); r.push([0.0, lerp(ya, D + 1.6 + (za - zB) * 0.02, v * (1 - Math.abs(u - 0.35) * 0.6)), za]); } rows.push(r); }
      const fm = (c, e, slot) => mat(c, e || 0, slot || 0, 5, lp => [Math.max(0, (lp[2] - zB) / (zA - zB)), 0, 0.5]);
      mb.grid(rows, fm(sailCol, 0), false); mb.grid(rows.map(r => r.map(p => [p[0] - 0.02, p[1], p[2]])), fm(sailCol, 0), true);
      if (sailM === 'neon') mb.grid(rows[0].map((p, k) => [[0.04, p[1] - 0.1, p[2]], [0.04, p[1] + 0.06, p[2]]]), fm(col(o.led, LEDS), 1.3, 3), true);
    }
  });
  // jibs from the foremast to the bowsprit (fore-aft sails, flutter)
  for (const [ya, yb, zb] of [[D + 19, D + 5.6, zBow + 6.8], [D + 15, D + 4.0, zBow + 3.0]]) {
    const zA = GALLEON_RIG.masts[0][0] + 0.6, rows = [];
    for (let j = 0; j <= (lo ? 1 : 3); j++) { const v = j / (lo ? 1 : 3), r = []; for (let k = 0; k <= nu; k++) { const u = k / nu; r.push([0, lerp(lerp(ya, D + 3.2, u * 0.9), yb, v * u), lerp(zA, zb, u)]); } rows.push(r); }
    const fm = (c, e, slot) => mat(c, e || 0, slot || 0, 5, lp => [Math.max(0, (lp[2] - zA) / (zb - zA)), 0, 0.4]);
    mb.grid(rows, fm(sailCol, sailM === 'neon' ? 0.02 : 0), false); mb.grid(rows.map(r => r.map(p => [p[0] - 0.02, p[1], p[2]])), fm(sailCol, 0), true);
    if (sailM === 'neon') mb.grid(rows[rows.length - 1].map(p => [[0.03, p[1] - 0.08, p[2]], [0.03, p[1] + 0.08, p[2]]]), fm(col(o.led, LEDS), 1.3, 3), true);
  }
  // rigging: shrouds to the rails and stays between mast tops
  if (!lo) {
    for (const [mz, h] of GALLEON_RIG.masts) for (const sd of [-1, 1]) for (let r = 0; r < 3; r++) {
      const t = (mz - z0) / Lh, b = B(Math.max(0, Math.min(1, t))) * 0.9;
      mb.rod([sd * b, Sh(Math.max(0, Math.min(1, t))) + 0.1, mz - 1.2 + r * 1.2], [sd * 0.35, D + h * 0.7, mz], 0.035, 3, rope);
    }
    const [f, m2, z3] = GALLEON_RIG.masts;
    mb.rod([0, D + f[1] * 0.95, f[0]], [0, 7.8, zBow + 8.5], 0.04, 3, rope);
    mb.rod([0, D + m2[1] * 0.95, m2[0]], [0, D + f[1] * 0.8, f[0]], 0.04, 3, rope);
    mb.rod([0, D + z3[1] * 0.95, z3[0]], [0, D + m2[1] * 0.7, m2[0]], 0.04, 3, rope);
    // rudder + bow lamps
    mb.box(0, -0.8, z0 - 0.4, 0.3, 4.2, 1.4, dark);
  }
  for (const sd of [-1, 1]) mb.box(sd * 3.0, 5.2, z0 + 0.9 * Lh, 0.25, 0.25, 0.25, mat(sd > 0 ? [1, 0.1, 0.08] : [0.1, 1, 0.3], 1.4));
  mb.box(0, GALLEON_RIG.deckY + GALLEON_RIG.masts[1][1] + 1.6, GALLEON_RIG.masts[1][0], 0.3, 0.3, 0.3, mat([1, 1, 1], 1.8, 0, 7, [0.6, 0, 0]));
  const m = mb.finish(); m.kind = 'galleon'; m.opts = o; return m;
}

/* ---------------- lighthouse + race furniture (static props) ---------------- */
function buildLighthouse() {
  const mb = new MB(), w = mat([0.75, 0.76, 0.8]), r = mat([0.7, 0.05, 0.08]), led = mat([0, 1, 0.9], 1, 3), rock = mat([0.07, 0.07, 0.08]);
  mb.cyl(-3, 1.2, 12.5, 11, 18, rock);
  mb.cyl(1.2, 2.0, 11, 11, 18, mat([0.12, 0.12, 0.14]));
  for (let k = 0; k < 6; k++) { mb.push(T(0, 2 + k * 4.4, 0)); mb.cyl(0, 4.4, 2.6 - k * 0.16, 2.6 - (k + 1) * 0.16, 16, k % 2 ? r : w); mb.pop(); }
  mb.push(T(0, 28.4, 0)); mb.cyl(0, 0.5, 2.4, 2.4, 16, mat([0.1, 0.1, 0.12])); mb.cyl(0.5, 3.4, 1.4, 1.4, 16, mat([1, 0.95, 0.8], 1.5)); mb.cyl(3.4, 4.6, 1.7, 0.2, 16, mat([0.1, 0.1, 0.12])); mb.pop();
  mb.push(T(0, 2.05, 0)); mb.torus(10.8, 0.12, 40, 4, led); mb.pop();
  return mb.finish();
}
/** neon race gate: square frame (drone) or arch on floats (water). Emissive parts carry slot 3 → tinted by uLed (current / next / done). */
function buildGate(kind) {
  const mb = new MB(), frame = mat([0.04, 0.04, 0.05]), glow = mat([1, 1, 1], 1.4, 3);
  if (kind === 'drone') {
    const W = 7, H = 5, t = 0.35;
    for (const [x, y, sx, sy] of [[0, H / 2, W + t, t], [0, -H / 2, W + t, t], [W / 2, 0, t, H], [-W / 2, 0, t, H]]) { mb.box(x, y, 0, sx, sy, 0.3, frame); mb.box(x, y, 0.17, sx * (sx > sy ? 0.98 : 0.6), sy * (sy > sx ? 0.98 : 0.6), 0.04, glow); mb.box(x, y, -0.17, sx * (sx > sy ? 0.98 : 0.6), sy * (sy > sx ? 0.98 : 0.6), 0.04, glow); }
  } else {
    const W = kind === 'galleon' ? 26 : 13, H = kind === 'galleon' ? 9 : 5.5;
    for (const sx of [-1, 1]) { mb.push(T(sx * W / 2, -0.4, 0)); mb.cyl(-0.8, 0.6, 1.1, 1.1, 14, frame); mb.cyl(0.6, 0.8, 1.15, 1.15, 14, glow, false); mb.cyl(0.6, H, 0.25, 0.2, 8, frame); mb.pop(); }
    const n = 16, pts = []; for (let k = 0; k <= n; k++) { const a = Math.PI * k / n; pts.push([-Math.cos(a) * W / 2, H + Math.sin(a) * (kind === 'galleon' ? 5 : 2.5), 0]); }
    for (let k = 0; k < n; k++) { mb.rod(pts[k], pts[k + 1], 0.28, 6, frame); mb.rod([pts[k][0], pts[k][1] - 0.05, 0.3], [pts[k + 1][0], pts[k + 1][1] - 0.05, 0.3], 0.1, 4, glow); mb.rod([pts[k][0], pts[k][1] - 0.05, -0.3], [pts[k + 1][0], pts[k + 1][1] - 0.05, -0.3], 0.1, 4, glow); }
  }
  return mb.finish();
}

/* ---------------- KAGE NEXUS portal ring, its dial console, and the eerie inhabitants of ECO ---------------- */
// glyph: a few emissive strokes on a 3 x 4 grid chosen from the seed (invented symbols)
function glyph(mb, cx, cy, z, size, seed, matE, flip) {
  let h = seed * 9301 + 49297; const rnd = () => { h = (h * 9301 + 49297) % 233280; return h / 233280; };
  const pts = [[0, 0], [1, 0], [2, 0], [0, 1.5], [1, 1.5], [2, 1.5], [0, 3], [1, 3], [2, 3]], n = 3 + Math.floor(rnd() * 3), u = size / 3;
  let cur = pts[Math.floor(rnd() * 9)];
  for (let k = 0; k < n; k++) {
    const nx = pts[Math.floor(rnd() * 9)]; if (nx === cur) continue;
    const x0 = cx + (cur[0] - 1) * u, y0 = cy + (cur[1] - 1.5) * u, x1 = cx + (nx[0] - 1) * u, y1 = cy + (nx[1] - 1.5) * u, L = Math.hypot(x1 - x0, y1 - y0);
    mb.push(M(T((x0 + x1) / 2, (y0 + y1) / 2, z), RZ(Math.atan2(y1 - y0, x1 - x0)))); mb.box(0, 0, flip ? -0.02 : 0.02, L + u * 0.18, u * 0.18, 0.04, matE); mb.pop();
    cur = nx;
  }
  if (rnd() < 0.5) { mb.push(T(cx, cy + (rnd() - 0.5) * size * 0.6, z)); mb.box(0, 0, 0, u * 0.42, u * 0.42, 0.05, matE); mb.pop(); }
}
const NEXUS = { R: 7.6, cy: 7.0, inner: 6.55 };
function buildNexus() {
  const mb = new MB(), dark = mat([0.05, 0.055, 0.065]), metal = mat([0.16, 0.17, 0.19]), led = mat([0, 1, 0.9], 0.9, 3);
  const R = NEXUS.R, cy = NEXUS.cy, segs = 42;
  // outer ring: faceted segments with a groove, LED lining on the inner edge
  for (let k = 0; k < segs; k++) {
    const a = (k + 0.5) / segs * TAU;
    mb.push(M(T(Math.cos(a) * (R - 0.3), cy + Math.sin(a) * (R - 0.3), 0), RZ(a)));
    mb.box(0, 0, 0, 1.05, TAU * R / segs * 0.96, 1.3, k % 2 ? dark : metal);
    mb.box(-0.56, 0, 0, 0.06, TAU * R / segs * 0.9, 0.5, led);
    mb.pop();
  }
  // inner glyph ring (rotates about z while dialing: mode 3 pivot (0, cy))
  const rot = c => mat(c[0], c[1] || 0, c[2] || 0, 3, [0, cy, 0]);
  for (let k = 0; k < 21; k++) {
    const a = k / 21 * TAU;
    mb.push(M(T(Math.cos(a) * (R - 1.25), cy + Math.sin(a) * (R - 1.25), 0), RZ(a - PI / 2)));
    mb.box(0, 0, 0, TAU * (R - 1.25) / 21 * 0.92, 0.8, 0.7, rot([[0.08, 0.085, 0.1]]));
    glyph(mb, 0, 0, 0.36, 0.62, k * 7 + 3, rot([[0.2, 1, 0.75], 0.55, 3])); glyph(mb, 0, 0, -0.36, 0.62, k * 7 + 3, rot([[0.2, 1, 0.75], 0.55, 3]), true);
    mb.pop();
  }
  // seven lock clamps: their lights carry the lock index in aAnim.a (lit when uLocks >= index)
  for (let k = 0; k < 7; k++) {
    const a = PI / 2 - k / 7 * TAU, x = Math.cos(a) * R, y = cy + Math.sin(a) * R, lk = { c: [1, 0.3, 0.8], e: 0.85, slot: 3, mode: 0, a: [k + 1, 0, 0] };
    mb.push(M(T(x, y, 0), RZ(a - PI / 2)));
    mb.box(0, 0.2, 0, 1.6, 0.9, 1.6, metal, [0.7, 1]); mb.box(0, -0.35, 0, 0.5, 0.9, 1.7, dark);
    mb.box(0, 0.05, 0.82, 0.9, 0.35, 0.05, lk); mb.box(0, 0.05, -0.82, 0.9, 0.35, 0.05, lk); mb.box(0, -0.55, 0, 0.35, 0.35, 1.75, lk);
    mb.pop();
  }
  // footing: two buttress blocks sunk into the street
  for (const sx of [-1, 1]) { mb.box(sx * 7.4, 0.2, 0, 2.2, 1.6, 2.6, dark, [0.8, 1]); mb.box(sx * 7.4, 1.02, 0, 1.8, 0.05, 2.2, led); }
  // the surface (event membrane): slot 5 is shaded procedurally in vehicle.frag (uPortal opens it from the rim inwards)
  const memb = { c: [0.2, 1, 0.8], e: 1, slot: 5, mode: 0, a: [0, 0, 0] }, n = 48, ri = NEXUS.inner;
  const c0 = mb.v([0, cy, 0], memb), o = []; for (let k = 0; k <= n; k++) { const a = k / n * TAU; o.push(mb.v([Math.cos(a) * ri, cy + Math.sin(a) * ri, 0], memb)); }
  for (let k = 0; k < n; k++) mb.tri(c0, o[k], o[k + 1]);
  return mb.finish();
}
function buildConsole() {
  const mb = new MB(), dark = mat([0.05, 0.05, 0.06]), metal = mat([0.2, 0.21, 0.24]), led = mat([0, 1, 0.9], 0.8, 3);
  mb.cyl(0, 0.35, 1.2, 1.15, 6, dark); mb.cyl(0.35, 0.95, 0.75, 0.6, 6, metal); mb.cyl(0.95, 1.05, 0.62, 1.15, 6, dark);
  // sloped hexagonal face with 7 key plates (index in aAnim.a → lit while dialing) and a central dome
  mb.push(M(T(0, 1.12, 0), RX(-0.28)));
  mb.cyl(-0.04, 0.04, 1.18, 1.18, 6, metal);
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * TAU, x = Math.sin(a) * 0.78, z = Math.cos(a) * 0.78, lk = { c: [1, 0.3, 0.8], e: 0.85, slot: 3, mode: 0, a: [k + 1, 0, 0] };
    mb.box(x, 0.06, z, 0.34, 0.05, 0.34, mat([0.07, 0.08, 0.1])); mb.box(x, 0.095, z, 0.26, 0.02, 0.26, lk);
  }
  mb.ellipsoid(0, 0.05, 0, 0.32, 0.22, 0.32, 14, 7, { c: [0.2, 1, 0.75], e: 1.3, slot: 3, mode: 0, a: [8, 0, 0] });
  mb.pop();
  mb.push(T(0, 0.36, 0)); mb.cyl(-0.02, 0.02, 0.78, 0.78, 6, led, false); mb.pop();
  return mb.finish();
}
function buildWatcher() {
  const mb = new MB(), sk = mat([0.012, 0.014, 0.016]), eye = mat([1, 0.1, 0.12], 2.2);
  mb.rod([-0.35, 0, 0], [-0.3, 6.5, 0], 0.22, 6, sk, 0.3); mb.rod([0.35, 0, 0], [0.3, 6.5, 0], 0.22, 6, sk, 0.3);
  mb.ellipsoid(0, 8.4, 0, 0.85, 2.4, 0.45, 10, 8, sk);
  mb.rod([-0.8, 10.2, 0], [-1.25, 3.2, 0.25], 0.14, 5, sk, 0.08); mb.rod([0.8, 10.2, 0], [1.25, 3.2, 0.25], 0.14, 5, sk, 0.08);
  mb.ellipsoid(0, 11.6, 0.05, 0.55, 0.8, 0.5, 10, 8, sk);
  for (const sx of [-1, 1]) mb.box(sx * 0.2, 11.75, 0.5, 0.12, 0.05, 0.05, eye);
  return mb.finish();
}
function buildMonolith() {
  const mb = new MB(), sk = mat([0.01, 0.012, 0.012]), led = mat([0.2, 1, 0.5], 1.2, 3);
  mb.box(0, 0, 0, 4, 18, 1.2, sk);
  for (let k = 0; k < 6; k++) glyph(mb, 0, 6 - k * 2.4, 0.62, 1.7, k * 13 + 5, led);
  for (let k = 0; k < 6; k++) glyph(mb, 0, 6 - k * 2.4, -0.62, 1.7, k * 17 + 2, led, true);
  return mb.finish();
}
/** the eye in ECO's sky: flattened sclera, glowing iris, black pupil, heavy lids (facing +z) */
function buildEye() {
  const mb = new MB();
  mb.ellipsoid(0, 0, 0, 1, 0.62, 0.35, 28, 16, mat([0.55, 0.62, 0.5], 0.35));
  mb.push(T(0, 0, 0.3)); mb.push(RX(Math.PI / 2));
  mb.cyl(0, 0.04, 0.42, 0.42, 32, mat([0.15, 1, 0.45], 1.1, 3)); mb.cyl(0.04, 0.08, 0.18, 0.18, 24, mat([0, 0, 0], 0));
  mb.cyl(0.02, 0.05, 0.47, 0.44, 32, mat([1, 0.1, 0.5], 0.9), false);
  mb.pop(); mb.pop();
  for (const sy of [-1, 1]) { mb.push(T(0, sy * 0.5, 0.05)); mb.ellipsoid(0, 0, 0, 1.1, 0.25, 0.42, 20, 8, mat([0.02, 0.03, 0.025])); mb.pop(); }
  return mb.finish();
}
function buildShard() {
  const mb = new MB(), m = mat([1, 0.25, 0.8], 1.3, 3), r = 0.9, h = 1.6;
  const P = [[0, h, 0], [r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r], [0, -h, 0]];
  for (const f of [[0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [5, 1, 2], [5, 2, 3], [5, 3, 4], [5, 4, 1]]) mb.poly(f.map(i => P[i]), m);
  mb.push(T(0, 0, 0)); mb.torus(1.5, 0.05, 24, 4, mat([0.2, 1, 0.6], 1.2, 3)); mb.pop();
  return mb.finish();
}
/** one segment of the thing in the black lagoon: a ridged hump with spines (along +z) */
function buildSerpentSeg() {
  const mb = new MB(), skin = mat([0.02, 0.025, 0.022]), glow = mat([0.2, 1, 0.5], 0.7, 3);
  mb.ellipsoid(0, 0, 0, 2.4, 1.6, 4.2, 16, 10, skin);
  for (let k = -2; k <= 2; k++) { mb.push(M(T(0, 1.3, k * 1.4), RX(-0.35))); mb.cyl(0, 2.2 - Math.abs(k) * 0.4, 0.35, 0.02, 6, skin); mb.pop();
    mb.box(0, 0.9, k * 1.4, 0.15, 0.3, 0.6, glow); }
  for (const sx of [-1, 1]) for (let k = -1; k <= 1; k++) mb.box(sx * 2.25, 0.2, k * 1.6, 0.05, 0.25, 0.25, glow);
  return mb.finish();
}
const TAU = Math.PI * 2, PI = Math.PI;

const KINDS = { drone: { build: buildDrone, opts: DRONE_OPTS, names: DRONE_NAMES, def: DRONE_DEF, rig: DRONE_RIG, title: 'KAGE STRIX' },
  boat: { build: buildBoat, opts: BOAT_OPTS, names: BOAT_NAMES, def: BOAT_DEF, rig: BOAT_RIG, title: 'KAGE RIPTIDE' },
  galleon: { build: buildGalleon, opts: GALLEON_OPTS, names: GALLEON_NAMES, def: GALLEON_DEF, rig: GALLEON_RIG, title: 'KAGE LEVIATHAN' } };
function optLabel(kind, key, v) {
  const n = KINDS[kind].names[key];
  if (n && n[v]) return n[v];
  if (key === 'blades') return v + ' PALE';
  if (key === 'guards') return v ? 'PARAELICHE: SÌ' : 'PARAELICHE: NO';
  if (key === 'cannons') return v ? 'CANNONI A LUCE: SÌ' : 'CANNONI A LUCE: NO';
  return COLOR_NAMES[v] || String(v).toUpperCase();
}
const OPT_TITLES = { frame: 'TELAIO', shell: 'SCOCCA', blades: 'ELICHE', guards: 'PROTEZIONI', paint: 'COLORE', accent: 'COLORE ACCENTI', led: 'COLORE LED', hull: 'SCAFO', engine: 'MOTORE', sails: 'VELE', cannons: 'ARMAMENTO' };
function loadCfg(kind) { try { return Object.assign({}, KINDS[kind].def, JSON.parse(localStorage.getItem('kageFleet_' + kind) || '{}')); } catch (e) { return Object.assign({}, KINDS[kind].def); } }
function saveCfg(kind, c) { try { localStorage.setItem('kageFleet_' + kind, JSON.stringify(c)); } catch (e) { } }
function randomCfg(kind, rnd) { rnd = rnd || Math.random; const o = {}, O = KINDS[kind].opts; for (const k in O) o[k] = O[k][Math.floor(rnd() * O[k].length)]; return o; }

/** bake N copies of a model into lane-instanced chunks for vehicle.vert (uTraffic = 1).
 *  inst: array of [ox, oy, oz, speed, dx, dz, phase, seed] */
function bakeTraffic(m, inst, maxV) {
  maxV = maxV || 64000;
  const per = Math.max(1, Math.floor(maxV / m.verts)), out = [];
  for (let s0 = 0; s0 < inst.length; s0 += per) {
    const part = inst.slice(s0, s0 + per), nv = m.verts * part.length;
    const ch = { pos: new Float32Array(nv * 3), norm: new Float32Array(nv * 3), col: new Float32Array(nv * 4), anim: new Float32Array(nv * 4), lane: new Float32Array(nv * 4), dir: new Float32Array(nv * 4), idx: [] };
    part.forEach((q, k) => {
      const o = k * m.verts;
      ch.pos.set(m.pos, o * 3); ch.norm.set(m.norm, o * 3); ch.col.set(m.col, o * 4); ch.anim.set(m.anim, o * 4);
      for (let v = 0; v < m.verts; v++) { ch.lane.set([q[0], q[1], q[2], q[3]], (o + v) * 4); ch.dir.set([q[4], q[5], q[6], q[7]], (o + v) * 4); }
      for (const ix of m.idx) ch.idx.push(ix + o);
    });
    out.push(ch);
  }
  return out;
}
root.KageFleet = { bakeTraffic, buildEye, buildShard, buildSerpentSeg, buildNexus, buildConsole, buildWatcher, buildMonolith, NEXUS, MB, buildDrone, buildBoat, buildGalleon, buildLighthouse, buildGate, KINDS, COLORS, LEDS, COLOR_NAMES, OPT_TITLES, optLabel, loadCfg, saveCfg, randomCfg, DRONE_RIG, BOAT_RIG, GALLEON_RIG, M, T, RX, RY, RZ, S, ap };
})(typeof window !== 'undefined' ? window : globalThis);
