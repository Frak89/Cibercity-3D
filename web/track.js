/* KAGE CIRCUIT — 11 km race track for the AMPY KAGE GT: weather with real grip, tyre compounds and wear,
   fuel, pit lane with refuelling and tyre change, laps / sectors / delta, AI opponents, saved results and race state.
   Uses the NEON RUN physics (NeonRun.stepCar), the HD car (CarHD + CarRender) and the engine / FX module. */
(function () {
'use strict';
const NR = window.NeonRun, U = window.CarRenderUtil;
const LAP_TARGET = 11000, HALF_W = 6.8, KERB_W = 1.6, DS = 4;

/* ------------------------------------------------------------------ circuit layout */
function catmull(P, t) {
  const n = P.length, i = Math.floor(t) % n, f = t - Math.floor(t);
  const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
  const f2 = f * f, f3 = f2 * f;
  return [0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3));
}
function buildCircuit() {
  // control points (km): main straight along +x through the origin, then a mix of hairpins, esses, fast sweepers
  const K = [[0, 0], [0.55, 0], [1.1, 0], [1.38, 0.1], [1.45, 0.38], [1.28, 0.6], [1.02, 0.68], [0.96, 0.93], [1.2, 1.14], [1.65, 1.2], [2.08, 1.04],
    [2.32, 0.72], [2.6, 0.55], [2.95, 0.64], [3.22, 0.95], [3.18, 1.42], [2.88, 1.72], [2.42, 1.86], [1.92, 2.12], [1.5, 2.26], [1.02, 2.1], [0.76, 1.8],
    [0.55, 1.58], [0.24, 1.7], [-0.02, 1.56], [-0.22, 1.22], [-0.12, 0.95], [-0.32, 0.7], [-0.5, 0.36], [-0.42, 0.07], [-0.2, 0]];
  const sample = (scale) => { const pts = []; const N = K.length * 400; for (let i = 0; i < N; i++) { const p = catmull(K, i / 400); pts.push([p[0] * scale, p[1] * scale]); } return pts; };
  const lenOf = pts => { let L = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return L; };
  let scale = 1000; scale *= LAP_TARGET / lenOf(sample(scale));
  const dense = sample(scale);
  // resample at constant DS metres
  const cum = [0]; for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const L = cum[dense.length], N = Math.floor(L / DS), S = [];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = i * L / N; while (cum[j + 1] < s) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length], f = (s - cum[j]) / (cum[j + 1] - cum[j]);
    S.push({ s, x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f });
  }
  for (let i = 0; i < N; i++) {
    const a = S[(i - 1 + N) % N], b = S[(i + 1) % N], p = S[i];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    p.tx = tx; p.tz = tz; p.nx = -tz; p.nz = tx;          // normal points to the left of travel
    p.h = Math.atan2(tx, tz);
  }
  for (let i = 0; i < N; i++) {                            // signed curvature (1/m), smoothed
    const a = S[(i - 3 + N) % N], b = S[(i + 3) % N]; let dh = b.h - a.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    S[i].k = dh / (6 * DS);
  }
  for (let pass = 0; pass < 3; pass++) { const k = S.map(p => p.k); for (let i = 0; i < N; i++) S[i].k = (k[(i - 2 + N) % N] + k[(i - 1 + N) % N] + k[i] + k[(i + 1) % N] + k[(i + 2) % N]) / 5; }
  return { S, N, L: N * (L / N), ds: L / N };
}

/* ------------------------------------------------------------------ geometry helpers */
function MeshB() { return { pos: [], norm: [], col: [], idx: [] }; }
function quad(B, a, b, c, d, col, n) {
  const i = B.pos.length / 3;
  for (const p of [a, b, c, d]) { B.pos.push(p[0], p[1], p[2]); B.norm.push(n[0], n[1], n[2]); B.col.push(col[0], col[1], col[2], col[3] || 0); }
  B.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
}
function boxW(B, cx, cy, cz, hx, hy, hz, h, col) {        // box rotated by heading h around y
  const c = Math.cos(h), s = Math.sin(h);
  const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
  const R = (x, z) => [x * c + z * s, 0, -x * s + z * c];
  const f = [[[hx, -hy, -hz], [hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz], R(1, 0)], [[-hx, -hy, hz], [-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz], R(-1, 0)],
    [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], R(0, 1)], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], R(0, -1)],
    [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [0, 1, 0]]];
  for (const q of f) quad(B, P(...q[0]), P(...q[1]), P(...q[2]), P(...q[3]), col.map(v => v * (q[4][1] ? 1 : 0.8 + 0.2 * Math.abs(q[4][0]))), q[4]);
}

/* ------------------------------------------------------------------ the circuit model (track mesh, scenery, lookups) */
function Circuit() {
  const C = buildCircuit(); Object.assign(this, C);
  const S = this.S, N = this.N;
  // pit lane on the right of the main straight (lateral offset negative = right of travel)
  this.pitS0 = this.L - 420; this.pitS1 = 520; this.pitLat = -23; this.boxS = 120; this.pitLimit = 80 / 3.6;
  this.inPitZone = s => s > this.pitS0 || s < this.pitS1;
  this.pitOffset = s => {                                  // centre of the pit lane (lateral) along s, blending in/out
    const d0 = s > this.pitS0 ? s - this.pitS0 : s + this.L - this.pitS0, total = this.L - this.pitS0 + this.pitS1;
    if (d0 < 0 || d0 > total) return null;
    const k = Math.min(1, d0 / 160, (total - d0) / 160); return -HALF_W * 0.2 + (this.pitLat + HALF_W * 0.2) * (k * k * (3 - 2 * k));
  };
  // runoff: kerbs where curvature asks, gravel on the outside of fast corners
  for (const p of S) { const ak = Math.abs(p.k); p.kerb = Math.min(1, Math.max(0, (ak - 1 / 600) * 400)); p.runL = 10 + (p.k < 0 ? ak * 7000 : 0); p.runR = 10 + (p.k > 0 ? ak * 7000 : 0); p.runL = Math.min(p.runL, 38); p.runR = Math.min(p.runR, 38); }
  for (let pass = 0; pass < 4; pass++) for (const key of ['kerb', 'runL', 'runR']) { const a = S.map(p => p[key]); for (let i = 0; i < N; i++) S[i][key] = (a[(i - 3 + N) % N] + a[i] + a[(i + 3) % N]) / 3; }
  // track ribbon: 8 lateral vertices (outer runoff L … asphalt … outer runoff R) + pit lane ribbon
  const T = { pos: [], trk: [], idx: [] };
  const lats = p => [p.runL + HALF_W + KERB_W, HALF_W + KERB_W, HALF_W, 0, -HALF_W, -HALF_W - KERB_W, -HALF_W - KERB_W - p.runR];
  for (let i = 0; i <= N; i++) {
    const p = S[i % N], s = i < N ? p.s : this.L;
    for (const lat of lats(p)) { T.pos.push(p.x + p.nx * lat, 0.02, p.z + p.nz * lat); T.trk.push(s, lat, Math.abs(lat) > HALF_W + KERB_W + 0.1 ? (Math.abs(p.k) > 1 / 300 ? 1 : 0) : p.kerb); }
    if (i > 0) { const a = (i - 1) * 7, b = i * 7; for (let k = 0; k < 6; k++) T.idx.push(a + k, b + k, b + k + 1, a + k, b + k + 1, a + k + 1); }
  }
  // pit lane strip (asphalt) from the track edge out to the pits
  const P0 = T.pos.length / 3; let prev = -1;
  for (let i = 0; i < N; i++) {
    const p = S[i], off = this.pitOffset(p.s); if (off === null) { prev = -1; continue; }
    const base = T.pos.length / 3;
    for (const lat of [-HALF_W - 0.5, off + 7.5, off - 7.5]) { T.pos.push(p.x + p.nx * lat, 0.025, p.z + p.nz * lat); T.trk.push(p.s, Math.max(15.5, -lat + 0.0) * 0 + (-lat < 14 ? 14.2 : -lat), 0); }
    if (prev >= 0) T.idx.push(prev, base, base + 1, prev, base + 1, prev + 1, prev + 1, base + 1, base + 2, prev + 1, base + 2, prev + 2);
    prev = base;
  }
  this.track = T; this.pitVerts = T.pos.length / 3 - P0;
  // scenery (absolute coordinates): armco walls, tyre stacks, grandstands, pit garages, gantry, trees
  const SC = []; let B = MeshB(); SC.push(B);
  const need = () => { if (B.pos.length / 3 > 60000) { B = MeshB(); SC.push(B); } };
  const wall = (side) => {
    for (let i = 0; i < N; i++) {
      const a = S[i], b = S[(i + 1) % N];
      if (side < 0 && this.inPitZone(a.s) && this.pitOffset(a.s) !== null && this.pitOffset(a.s) < -10) continue;   // pit side: no wall over the pit entry
      const la = side > 0 ? a.runL + HALF_W + KERB_W + 1 : -(a.runR + HALF_W + KERB_W + 1), lb = side > 0 ? b.runL + HALF_W + KERB_W + 1 : -(b.runR + HALF_W + KERB_W + 1);
      const A = [a.x + a.nx * la, a.z + a.nz * la], Bp = [b.x + b.nx * lb, b.z + b.nz * lb], n = [-a.nx * side, 0, -a.nz * side];
      for (const [y0, y1, col] of [[0.0, 0.35, [0.25, 0.25, 0.27]], [0.35, 0.75, [0.72, 0.73, 0.76]], [0.75, 0.9, (i >> 2) % 2 ? [0.85, 0.1, 0.1] : [0.9, 0.9, 0.9]]])
        quad(B, [A[0], y0, A[1]], [Bp[0], y0, Bp[1]], [Bp[0], y1, Bp[1]], [A[0], y1, A[1]], col, n);
      need();
    }
  };
  wall(1); wall(-1);
  this.wallL = i => S[i].runL + HALF_W + KERB_W + 0.6; this.wallR = i => S[i].runR + HALF_W + KERB_W + 0.6;
  // pit wall between the track and the pit lane + garages behind the boxes
  for (let i = 0; i < N; i++) {
    const p = S[i], off = this.pitOffset(p.s); if (off === null || off > -14) continue;
    const lat = -HALF_W - 4.2; boxW(B, p.x + p.nx * lat, 0.55, p.z + p.nz * lat, 0.25, 0.55, DS * 0.52, p.h, [0.85, 0.85, 0.88]); need();
  }
  for (let g = 0; g < 16; g++) {
    const s = (this.L - 300 + g * 18 + 9) % this.L, i = Math.floor(s / this.ds) % N, p = S[i], lat = this.pitLat - 14;
    boxW(B, p.x + p.nx * lat, 3.2, p.z + p.nz * lat, 6.5, 3.2, 8.4, p.h, g % 2 ? [0.18, 0.2, 0.24] : [0.22, 0.24, 0.3]);
    boxW(B, p.x + p.nx * (lat + 6.6), 2.6, p.z + p.nz * (lat + 6.6), 0.1, 2.4, 7.6, p.h, [0.04, 0.05, 0.07]);         // open garage door
    boxW(B, p.x + p.nx * (lat + 6.65), 5.7, p.z + p.nz * (lat + 6.65), 0.05, 0.35, 8.0, p.h, g === 7 ? [0.0, 1.0, 0.9] : [0.9, 0.9, 0.95]);   // number board (your box glows)
    need();
  }
  this.boxIndex = 7; this.boxS = (this.L - 300 + 7 * 18 + 9) % this.L;
  { const i = Math.floor(this.boxS / this.ds) % N, p = S[i]; boxW(B, p.x + p.nx * this.pitLat, 0.03, p.z + p.nz * this.pitLat, 3.2, 0.01, 4.6, p.h, [0.0, 0.9, 0.8]);
    for (let g = 0; g < 16; g++) { const s2 = (this.L - 300 + g * 18 + 9) % this.L, j = Math.floor(s2 / this.ds) % N, q = S[j]; if (g === 7) continue; for (const e of [-4.8, 4.8]) boxW(B, q.x + q.nx * this.pitLat + q.tx * e, 0.03, q.z + q.nz * this.pitLat + q.tz * e, 3.4, 0.01, 0.08, q.h, [0.9, 0.9, 0.9]); } }
  // grandstands along the main straight (left) and at three hairpins
  const stand = (s, side, len) => {
    for (let k = -len / 2; k < len / 2; k += 6) {
      const i = Math.floor(((s + k + this.L) % this.L) / this.ds) % N, p = S[i], lat = side * (p.runL + HALF_W + KERB_W + 8);
      for (let r = 0; r < 8; r++) {
        const crowd = [0.3 + Math.random() * 0.7, 0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.7];
        boxW(B, p.x + p.nx * (lat + side * r * 1.2), 0.5 + r * 0.6, p.z + p.nz * (lat + side * r * 1.2), 0.6, 0.5 + r * 0.6 * 0, 3.0, p.h, r % 2 ? [0.55, 0.57, 0.62] : crowd);
      }
      boxW(B, p.x + p.nx * (lat + side * 10.5), 6, p.z + p.nz * (lat + side * 10.5), 0.3, 6, 3.0, p.h, [0.3, 0.32, 0.36]);
      need();
    }
  };
  stand(60, 1, 360);
  [0.18, 0.42, 0.71].forEach(f => { let best = 0, bi = 0; for (let i = Math.floor(N * (f - 0.05)); i < N * (f + 0.05); i++) if (Math.abs(S[i].k) > best) { best = Math.abs(S[i].k); bi = i; } stand(S[bi].s, S[bi].k > 0 ? -1 : 1, 120); });
  // start gantry with the 5 race lights (lights drawn separately)
  { const p = S[0]; for (const sd of [-1, 1]) boxW(B, p.x + p.nx * sd * (HALF_W + 2), 3.5, p.z + p.nz * sd * (HALF_W + 2), 0.25, 3.5, 0.25, p.h, [0.3, 0.3, 0.33]);
    boxW(B, p.x, 6.6, p.z, 0.4, 0.45, HALF_W + 2.2, p.h + Math.PI / 2, [0.12, 0.12, 0.14]); }
  // tyre stacks on the outside of tight corners
  for (let i = 0; i < N; i += 3) { const p = S[i]; if (Math.abs(p.k) < 1 / 220) continue; const side = p.k > 0 ? -1 : 1, lat = side * ((side > 0 ? p.runL : p.runR) + HALF_W + KERB_W + 0.3);
    boxW(B, p.x + p.nx * lat, 0.45, p.z + p.nz * lat, 0.45, 0.45, 1.6, p.h, [0.06, 0.06, 0.06]); need(); }
  // trees around (not on the circuit)
  this.grid = new Map(); const GC = 40;
  for (const p of S) { const k = Math.floor(p.x / GC) + ',' + Math.floor(p.z / GC); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(p); }
  let seed = 911; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let t = 0; t < 1600; t++) {
    const x = -900 + rnd() * 5400, z = -900 + rnd() * 4400;
    if (this.nearest(x, z).d < 60) continue;
    const h = 6 + rnd() * 10, r = 2 + rnd() * 2.5, gcol = [0.12, 0.30 + rnd() * 0.1, 0.10, 1];
    boxW(B, x, h * 0.3, z, 0.3, h * 0.3, 0.3, 0, [0.3, 0.2, 0.12]);
    for (let k = 0; k < 3; k++) boxW(B, x, h * (0.5 + k * 0.17), z, r * (1 - k * 0.28), h * 0.09, r * (1 - k * 0.28), rnd() * 3, gcol);
    need();
  }
  this.scenery = SC;
}
/** nearest centreline sample: index, signed lateral offset (left +), distance along the lap */
Circuit.prototype.nearest = function (x, z, hint) {
  const S = this.S, N = this.N; let bi = -1, bd = 1e9;
  if (hint !== undefined && hint >= 0) { for (let k = -40; k <= 40; k++) { const i = (hint + k + N) % N, p = S[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = i; } } if (bd < 70 * 70) return this.proj(bi, x, z); }
  const GC = 40, cx = Math.floor(x / GC), cz = Math.floor(z / GC);
  for (let r = 0; r < 4 && bi < 0; r++) for (let j = -r - 1; j <= r + 1; j++) for (let i2 = -r - 1; i2 <= r + 1; i2++) { const L = this.grid.get((cx + i2) + ',' + (cz + j)); if (!L) continue; for (const p of L) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = S.indexOf(p); } } }
  if (bi < 0) return { i: 0, lat: 999, s: 0, d: 999 };
  return this.proj(bi, x, z);
};
Circuit.prototype.proj = function (i, x, z) {
  const p = this.S[i], dx = x - p.x, dz = z - p.z, along = dx * p.tx + dz * p.tz, lat = dx * p.nx + dz * p.nz;
  return { i, lat, s: (p.s + along + this.L) % this.L, d: Math.abs(lat) };
};
Circuit.prototype.at = function (s, lat) {
  const f = ((s % this.L) + this.L) % this.L / this.ds, i = Math.floor(f) % this.N, j = (i + 1) % this.N, w = f - Math.floor(f), a = this.S[i], b = this.S[j];
  const x = a.x + (b.x - a.x) * w, z = a.z + (b.z - a.z) * w, nx = a.nx + (b.nx - a.nx) * w, nz = a.nz + (b.nz - a.nz) * w;
  let dh = b.h - a.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
  return { x: x + nx * lat, z: z + nz * lat, h: a.h + dh * w, k: a.k, i };
};

/* ------------------------------------------------------------------ tyres + weather */
const COMPOUNDS = {
  soft: { name: 'SOFT', col: '#ff3b5c', base: 1.08, wetLoss: 0.58, wear: 0.032 },
  medium: { name: 'MEDIUM', col: '#ffd23b', base: 1.0, wetLoss: 0.52, wear: 0.019 },
  hard: { name: 'HARD', col: '#eeeeee', base: 0.94, wetLoss: 0.48, wear: 0.011 },
  inter: { name: 'INTER', col: '#3bff7a', base: 0.86, wetLoss: 0, wear: 0.022 },
  wet: { name: 'WET', col: '#3b9bff', base: 0.74, wetLoss: 0, wear: 0.020 }
};
function tyreMu(cmp, wet, wear) {
  const c = COMPOUNDS[cmp]; let m;
  if (cmp === 'inter') m = 0.86 - 0.26 * Math.abs(wet - 0.45);
  else if (cmp === 'wet') m = 0.74 + 0.14 * wet - (wet < 0.2 ? 0.06 : 0);
  else m = c.base - c.wetLoss * wet;
  return m * (1 - 0.38 * Math.pow(Math.min(1, wear), 1.6));
}
const WEATHERS = {
  sereno: { name: 'SERENO', wet: 0, rain: 0, fog: 1, cloud: 0.1 }, nuvoloso: { name: 'NUVOLOSO', wet: 0, rain: 0, fog: 1.4, cloud: 0.8 },
  pioggerella: { name: 'PIOGGERELLA', wet: 0.35, rain: 0.3, fog: 1.8, cloud: 0.9 }, pioggia: { name: 'PIOGGIA', wet: 0.7, rain: 0.7, fog: 2.4, cloud: 0.95 },
  temporale: { name: 'TEMPORALE', wet: 1.0, rain: 1.0, fog: 3.0, cloud: 1, light: 1 }, nebbia: { name: 'NEBBIA', wet: 0.12, rain: 0, fog: 7, cloud: 1, mist: 1 },
  variabile: { name: 'VARIABILE', wet: 0, rain: 0, fog: 1.3, cloud: 0.6, variable: true }
};
const AI_NAMES = ['R. VOLKOV', 'S. HAYASHI', 'L. MORETTI', 'D. OKAFOR', 'M. LINDQVIST', 'A. DUARTE', 'K. REYES', 'T. NAKAMURA', 'J. BERGER', 'E. ROSSI'];
const AI_COLS = [[0.9, 0.1, 0.1], [0.1, 0.35, 0.9], [0.95, 0.75, 0.1], [0.1, 0.75, 0.3], [0.9, 0.9, 0.92], [0.55, 0.2, 0.85], [1.0, 0.45, 0.05], [0.05, 0.05, 0.06], [0.0, 0.8, 0.85], [0.8, 0.3, 0.55]];

/* ------------------------------------------------------------------ race */
function Race(canvas, hud, opts) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: !!opts.preserve });
  if (!gl) throw new Error('WebGL non disponibile');
  this.gl = gl; this.canvas = canvas; this.hud = hud; this.o = opts;
  const SH = SHADERS;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, SH[v])); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, SH['common.glsl'] + '\n' + SH[f])); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; };
  this.P = { sky: prog('sky.vert', 'sky.frag'), ground: prog('ground.vert', 'track_ground.frag'), road: prog('track.vert', 'track.frag'), world: prog('world.vert', 'nature.frag'),
    solid: prog('solid.vert', 'solid.frag'), hd: prog('car_hd.vert', 'car_hd.frag'), fx: prog('particle.vert', 'particle.frag'), rain: prog('rain.vert', 'rain.frag'), mist: prog('post.vert', 'mist.frag'), post: prog('post.vert', 'post.frag') };
  const buf = (arr, idx) => { const b = gl.createBuffer(); gl.bindBuffer(idx ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, b); gl.bufferData(idx ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, idx ? (arr.length > 65535 * 3 ? new Uint32Array(arr) : new Uint16Array(arr)) : new Float32Array(arr), gl.STATIC_DRAW); return b; };
  this.ext32 = gl.getExtension('OES_element_index_uint');
  this.mesh = (attrs, idx) => { const big = Math.max(...idx) > 65535; const m = { a: {}, n: idx.length, t: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT }; for (const k in attrs) m.a[k] = { b: buf(attrs[k][0]), s: attrs[k][1] }; const b = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(idx) : new Uint16Array(idx), gl.STATIC_DRAW); m.i = b; return m; };
  const t0 = performance.now();
  const ct = this.ct = new Circuit();
  this.M = {
    road: this.mesh({ aPos: [ct.track.pos, 3], aTrk: [ct.track.trk, 3] }, ct.track.idx),
    scen: ct.scenery.map(B => this.mesh({ aPos: [B.pos, 3], aNorm: [B.norm, 3], aCol: [B.col, 4] }, B.idx)),
    ground: this.mesh({ aPos: [[-3000, -3000, 3000, -3000, 3000, 3000, -3000, 3000], 2] }, [0, 1, 2, 0, 2, 3]),
    quad: this.mesh({ aPos: [[-1, -1, 1, -1, 1, 1, -1, 1], 2] }, [0, 1, 2, 0, 2, 3])
  };
  const rn = NR.buildGameCity(7); this.M.rain = this.mesh({ aSeed: [rn.RN.seed, 3], aCorner: [rn.RN.corner, 2] }, rn.RN.idx);
  // AI car meshes (low-poly, one per colour)
  this.aiMesh = AI_COLS.map(c => { const m = NR.buildCarModel(c, [0, 1, 0.9]); return this.mesh({ aPos: [m.solid.pos, 3], aNorm: [m.solid.norm, 3], aCol: [m.solid.col, 4] }, m.solid.idx); });
  this.hd = new CarRender(gl, this.P.hd, CarHD.build({ quality: opts.quality || 'high' }));
  // rivals: the same HD car (lighter tessellation), each with its own paint, kit and rims, same power unit as yours
  this.hdAI = new CarRender(gl, this.P.hd, CarHD.build({ quality: opts.quality === 'ultra' ? 'high' : 'low' }));
  this.rivalSim = new EngineFX.EngineSim(opts.power || 'v8');
  this.car = kageLoad(); if (this.car.text === 'C') this.hd.replaceParts(CarHD.buildText(this.car.customText || 'KAGE GT'));
  this.eng = new EngineFX.EngineSim(opts.power || 'v8'); this.fx = new EngineFX.ExhaustFX(700); this.fxgl = new EngineFX.ExhaustGL(gl, this.P.fx); this.audio = new EngineFX.EngineAudio();
  this.buildMs = performance.now() - t0;
  this.cam = { h: 0 }; this.view = 0; this.t = 0;
  this.setup(opts);
}
Race.prototype.draw = function (pr, m) {
  const gl = this.gl; gl.useProgram(pr.p); const used = [];
  for (const k in m.a) { const loc = gl.getAttribLocation(pr.p, k); if (loc < 0) continue; gl.bindBuffer(gl.ARRAY_BUFFER, m.a[k].b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, m.a[k].s, gl.FLOAT, false, 0, 0); used.push(loc); }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i); gl.drawElements(gl.TRIANGLES, m.n, m.t || gl.UNSIGNED_SHORT, 0);
  for (const l of used) gl.disableVertexAttribArray(l);
};
/** new race / time attack. opts: mode 'race' | 'tt', laps, weather, tyre, ai (count), fuel (0..1) */
Race.prototype.setup = function (o, resume) {
  const ct = this.ct;
  this.mode = o.mode || 'race'; this.laps = o.laps || 3; this.weatherKey = o.weather || 'sereno'; this.wx = WEATHERS[this.weatherKey] || WEATHERS.sereno;
  this.wet = this.wx.wet; this.wetTarget = this.wx.wet; this.wxTimer = 60;
  this.state = 'grid'; this.lightT = 0; this.raceT = 0; this.finished = false; this.results = null;
  const nAI = Math.max(0, Math.min(9, o.ai === undefined ? 7 : o.ai));
  // grid: player starts from the back half in a race, alone on the line in time attack (AI already on a flying lap)
  this.ai = [];
  const gridPos = k => { const s = (ct.L - 12 - k * 8) % ct.L, lat = k % 2 ? -3.2 : 3.2; return { s, lat }; };
  const pSlot = this.mode === 'race' ? Math.min(nAI, Math.floor(nAI / 2) + 1) : 0;
  for (let k = 0, a = 0; a < nAI; k++) {
    if (k === pSlot && this.mode === 'race') continue;
    const g = this.mode === 'race' ? gridPos(k) : { s: (ct.L * (a + 1) / (nAI + 1)) % ct.L, lat: 0 };
    this.ai.push({ name: AI_NAMES[a], col: a, kit: a % 3, rim: 'ABC'[(a * 2) % 3], livery: a % 4 === 1 ? 1 : a % 4 === 3 ? 2 : 0, skill: 0.955 + ((a * 37) % 10) / 230, s: g.s, lat: g.lat, latT: g.lat, v: this.mode === 'race' ? 0 : 50, lap: this.mode === 'race' ? 0 : 0, lapStart: 0, best: null, last: null,
      cmp: o.tyre || 'medium', wear: 0, fuel: 1, pitLap: Math.max(1, Math.floor(this.laps / 2)), pitted: false, stopT: 0, total: 0, dist: this.mode === 'race' ? g.s - ct.L : 0, finished: false });
    a++;
  }
  const g = this.mode === 'race' ? gridPos(pSlot) : { s: ct.L - 60, lat: 0 }, P0 = ct.at(g.s, g.lat);
  const c = this.c = NR.newCar(); c.x = P0.x; c.z = P0.z; c.h = P0.h; c.world = 'track'; c.trackCollide = cc => this.collide(cc);
  this.cam.h = c.h;
  this.player = { name: 'TU · KAGE 2789 GT', s: g.s, lat: g.lat, lap: 0, lapStart: 0, best: null, last: null, sector: 0, secT: [null, null, null], bestSec: [null, null, null],
    dist: this.mode === 'race' ? g.s - ct.L : 0, cmp: o.tyre || 'medium', wear: 0, hint: -1, trace: [], bestTrace: null, finished: false, pit: null, inPit: false, total: 0 };
  this.eng.setType(o.power || 'v8'); this.eng.refuel(o.fuel === undefined ? 1 : o.fuel);
  // the vmax profile used by the AI (dry, then scaled by the live grip)
  const S = ct.S, N = ct.N, v = new Float32Array(N);
  for (let i = 0; i < N; i++) v[i] = Math.min(80, Math.sqrt(1.0 * 9.81 * 1.55 / Math.max(1e-4, Math.abs(S[i].k))));
  for (let pass = 0; pass < 2; pass++) { for (let i = N - 1; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[(i + 1) % N] ** 2 + 2 * 11 * ct.ds)); for (let i = 0; i < N; i++) v[i] = Math.min(v[i], Math.sqrt(v[(i - 1 + N) % N] ** 2 + 2 * 7 * ct.ds)); }
  this.vprof = v;
  if (resume) this.restore(resume);
  if (this.mode === 'tt') { this.state = 'run'; }
  this.saveT = 0;
};

/* track limits: walls, grass, pit lane; returns surface friction */
Race.prototype.collide = function (c) {
  const ct = this.ct, pl = this.player, q = ct.nearest(c.x, c.z, pl.hint); pl.hint = q.i;
  const off = ct.pitOffset(q.s), inPitLane = off !== null && q.lat < -HALF_W - 2 && q.lat > off - 8.5;
  let wl = ct.wallL(q.i), wr = -ct.wallR(q.i);
  if (off !== null && off < -10) wr = off - 8;                 // the pit lane widens the right side
  let push = 0, nlat = q.lat;
  if (q.lat > wl) { push = q.lat - wl; nlat = -1; } else if (q.lat < wr) { push = wr - q.lat; nlat = 1; }
  if (push > 0) {
    const p = ct.S[q.i], nx = p.nx * nlat, nz = p.nz * nlat;
    c.x += nx * push; c.z += nz * push;
    const vn = c.vx * nx + c.vz * nz;
    if (vn < 0) { c.vx -= 1.3 * vn * nx; c.vz -= 1.3 * vn * nz; c.vx *= 0.8; c.vz *= 0.8; c.shake = Math.min(1, c.shake + Math.abs(vn) * 0.04); c.hit = Math.min(1, Math.abs(vn) * 0.05); this.damage = (this.damage || 0) + Math.abs(vn) * 0.002; }
  }
  // the other cars: simple circle contacts
  for (const a of this.ai) {
    const P = ct.at(a.s, a.lat), dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
    if (d > 0.01 && d < 2.3) { const nx = dx / d, nz = dz / d, pen = 2.3 - d; c.x += nx * pen * 0.6; c.z += nz * pen * 0.6; a.lat -= (nx * ct.S[P.i].nx + nz * ct.S[P.i].nz) * pen * 0.4;
      const vn = c.vx * nx + c.vz * nz; if (vn < 0) { c.vx -= vn * nx; c.vz -= vn * nz; c.shake = Math.min(1, c.shake + 0.2); } }
  }
  pl.s = q.s; pl.lat = q.lat; pl.inPit = inPitLane;
  const al = Math.abs(q.lat);
  this.surface = inPitLane ? 'pit' : al <= HALF_W ? 'asfalto' : al <= HALF_W + KERB_W ? 'cordolo' : (Math.abs(ct.S[q.i].k) > 1 / 300 ? 'ghiaia' : 'erba');
};

Race.prototype.frame = function (dt, inp) {
  const gl = this.gl, P = this.P, ct = this.ct, c = this.c, pl = this.player, e = this.eng;
  dt = Math.min(dt, 0.05); this.t += dt; const t = this.t;
  // weather evolution (variable): rain fronts come and go; the track dries / gets wet slowly
  if (this.wx.variable) { this.wxTimer -= dt; if (this.wxTimer <= 0) { this.wxTimer = 60 + Math.random() * 120; this.wetTarget = Math.random() < 0.45 ? Math.random() * 0.9 : 0; } }
  else this.wetTarget = this.wx.wet;
  this.wet += (this.wetTarget - this.wet) * Math.min(1, dt / (this.wetTarget > this.wet ? 25 : 90));
  const rainNow = this.wx.variable ? Math.max(0, (this.wetTarget - 0.15)) : this.wx.rain;
  // grip: tyre compound × wetness × wear × surface
  const surfMu = { asfalto: 1, pit: 1, cordolo: 0.92, erba: 0.55, ghiaia: 0.45 }[this.surface || 'asfalto'];
  c.mu = tyreMu(pl.cmp, this.wet, pl.wear) * surfMu;
  c.drag = this.surface === 'ghiaia' ? 1.4 : this.surface === 'erba' ? 0.5 : 0;
  // race control: lights, pit limiter, pit service
  let ctl = Object.assign({}, inp);
  if (this.state === 'grid') { this.lightT += dt; ctl.gas = false; ctl.brake = false; ctl.steer = 0; c.vx = c.vz = 0; this.gridHold = true; if (this.lightT > 5.6 + (this.goDelay || (this.goDelay = 0.2 + Math.random() * 1.2))) { this.state = 'run'; this.raceT = 0; } }
  if (pl.pit && pl.pit.phase === 'service') { ctl.gas = false; ctl.brake = true; c.vx *= 0.8; c.vz *= 0.8; }
  if (pl.finished) { ctl.gas = false; ctl.brake = Math.hypot(c.vx, c.vz) > 15; }
  const spd0 = Math.hypot(c.vx, c.vz);
  if (pl.inPit && spd0 > ct.pitLimit) { ctl.gas = false; const k = ct.pitLimit / spd0; c.vx *= Math.max(k, 0.97); c.vz *= Math.max(k, 0.97); }
  c.pk = { v8: 1, wankel: 1.03, mag: 1.1 }[this.o.power || 'v8'];
  const prevS = pl.s;
  const phys = NR.stepCar(c, ctl, dt, null);
  if (this.state === 'grid') { c.vx = c.vz = 0; phys.vF = 0; }      // engine revs on the line, the car stays put
  if (this.state === 'grid' && inp.gas) { ctl.gas = true; }
  this.phys = phys;
  // engine, fuel, sound
  e.race = this.o.exhaust === 'race';
  e.update(dt, { speed: phys.vF, throttle: ctl.gas ? 1 : 0, boost: phys.boosting, slip: phys.slip * (this.surface === 'erba' || this.surface === 'ghiaia' ? 0.3 : 1), wheelspin: phys.wheelspin * (1.2 - Math.min(1, c.mu)), brakeHard: phys.brakeHard && c.mu < 0.9, brake: ctl.brake });
  this.audio.feed(e);
  // tyre wear: distance × compound rate × (slip, wet on slicks, dry on wets)
  const ds = Math.abs(phys.vF) * dt / 1000, cmp = COMPOUNDS[pl.cmp];
  pl.wear = Math.min(1.2, pl.wear + ds * cmp.wear * (1 + phys.slip * 0.06 + (pl.cmp === 'wet' && this.wet < 0.25 ? 1.5 : 0) + (pl.cmp === 'inter' && this.wet < 0.1 ? 0.8 : 0)));
  // laps / sectors / delta
  const sNow = pl.s;
  if (this.state === 'run' && !pl.finished) {
    this.raceT += dt; pl.total = this.raceT;
    let dS = sNow - prevS; if (dS < -ct.L / 2) dS += ct.L; if (dS > ct.L / 2) dS -= ct.L;
    pl.dist += dS;
    const lapT = this.raceT - pl.lapStart;
    if (Math.floor(sNow / 20) !== Math.floor(prevS / 20) && dS > 0) pl.trace.push([sNow, lapT]);
    const sec = Math.min(2, Math.floor(sNow / (ct.L / 3)));
    if (sec !== pl.sector && dS > 0 && (sec === pl.sector + 1)) { pl.secT[pl.sector] = lapT - (pl.sector ? pl.secT.slice(0, pl.sector).reduce((a, b) => a + (b || 0), 0) : 0); pl.sector = sec; }
    if (prevS > ct.L - 60 && sNow < 60 && dS > 0) { if (!pl.started) { pl.started = true; pl.lapStart = this.raceT; pl.trace = []; pl.sector = 0; } else this.lapDone(pl, lapT); }
  }
  if (pl.pit === null && pl.inPit) {
    // stop in your box (the glowing one) to call the crew
    const dBox = Math.abs(((sNow - ct.boxS + ct.L * 1.5) % ct.L) - ct.L / 2), off = ct.pitOffset(sNow);
    if (dBox < 7 && off !== null && Math.abs(pl.lat - off) < 6 && spd0 < 1.2) { pl.pit = { phase: 'menu' }; if (this.onPit) this.onPit(); }
  }
  if (pl.pit && pl.pit.phase === 'service') {
    pl.pit.t -= dt; e.fuel = Math.min(e.T.tank, e.fuel + pl.pit.rate * dt);
    if (pl.pit.t <= 0) { pl.cmp = pl.pit.cmp || pl.cmp; if (pl.pit.cmp) pl.wear = 0; pl.pit = { phase: 'done' }; }
  }
  if (pl.pit && pl.pit.phase === 'done' && !pl.inPit) pl.pit = null;
  // AI
  this.stepAI(dt);
  // the nearest rival is heard: its own engine (same power unit) with distance attenuation
  { let best = null, bd = 1e9; for (const a of this.ai) { const q = ct.at(a.s, a.lat), d = Math.hypot(q.x - c.x, q.z - c.z); if (d < bd) { bd = d; best = a; } }
    if (best) { const rs = this.rivalSim; if (rs.type !== (this.o.power || 'v8')) rs.setType(this.o.power || 'v8'); rs.race = this.o.exhaust === 'race';
      rs.update(dt, { speed: best.v, throttle: best.accel ? 1 : best.braking ? 0 : 0.45 }); this.audio.feedOther(rs, Math.min(0.8, 9 / (bd + 6))); } }
  // positions
  const all = [pl, ...this.ai];
  if (this.mode === 'race') all.sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.total - b.total : b.dist - a.dist));
  else all.sort((a, b) => (a.best || 1e9) - (b.best || 1e9));
  this.order = all;
  // autosave race state every 5 s
  this.saveT += dt; if (this.saveT > 5 && this.state === 'run') { this.saveT = 0; this.save(); }
  this.render(dt, ctl, rainNow);
  this.drawHud(ctl);
};
Race.prototype.lapDone = function (pl, lapT) {
  pl.secT[2] = lapT - (pl.secT[0] || 0) - (pl.secT[1] || 0);
  pl.last = lapT; pl.lap++;
  const clean = true;
  if (clean && (!pl.best || lapT < pl.best)) { pl.best = lapT; pl.bestTrace = pl.trace.slice(); this.flashMsg = 'GIRO VELOCE ' + fmt(lapT); }
  for (let k = 0; k < 3; k++) if (pl.secT[k] && (!pl.bestSec[k] || pl.secT[k] < pl.bestSec[k])) pl.bestSec[k] = pl.secT[k];
  pl.lapStart = this.raceT; pl.trace = []; pl.sector = 0; pl.secT = [null, null, null];
  saveBest(this, lapT);
  if (this.mode === 'race' && pl.lap >= this.laps) { pl.finished = true; pl.total = this.raceT; this.finishRace(); }
};
Race.prototype.stepAI = function (dt) {
  const ct = this.ct, mu = tyreMu('medium', this.wet, 0) / 1.0;
  for (const a of this.ai) {
    if (this.state === 'grid' || a.finished && a.v < 1) { if (a.finished) a.v = Math.max(0, a.v - 8 * dt); continue; }
    const i = Math.floor(a.s / ct.ds) % ct.N, ahead = Math.floor((a.s + 40) / ct.ds) % ct.N;
    const muA = tyreMu(a.cmp, this.wet, a.wear);
    const pk = { v8: 1, wankel: 1.03, mag: 1.1 }[this.o.power || 'v8'];
    let vt = Math.min(this.vprof[i] * pk, this.vprof[ahead] * pk, 72 * pk + 6) * Math.sqrt(muA) * a.skill;
    // pit stop at mid race: into the pit lane at the limiter, stop at the box, back out
    const off = ct.pitOffset(a.s);
    if (this.mode === 'race' && !a.pitted && a.lap >= a.pitLap && off !== null) {
      a.latT = off; vt = Math.min(vt, ct.pitLimit);
      const myBox = (ct.boxS + (a.col - 7) * 18 + ct.L) % ct.L, d = ((a.s - myBox + ct.L * 1.5) % ct.L) - ct.L / 2;
      if (Math.abs(d) < 8 && a.stopT === 0) { a.stopT = 7 + Math.random() * 3; }
      if (a.stopT > 0) { vt = 0; a.stopT -= dt; if (a.stopT <= 0) { a.stopT = -1; a.pitted = true; a.wear = 0; a.fuel = 1; if (this.wet > 0.45) a.cmp = this.wet > 0.75 ? 'wet' : 'inter'; } }
    } else {
      // racing line: drift to the inside of corners, overtaking: move aside when someone slower is ahead
      a.latT = Math.max(-4.5, Math.min(4.5, -Math.sign(ct.S[ahead].k) * Math.min(4, Math.abs(ct.S[ahead].k) * 900)));
      for (const b of [this.player, ...this.ai]) { if (b === a) continue; let d = b.s - a.s; if (d < -ct.L / 2) d += ct.L; if (d > 0 && d < 14 && Math.abs(b.lat - a.lat) < 2.6) { a.latT = b.lat > 0 ? b.lat - 3.4 : b.lat + 3.4; vt = Math.min(vt, (b.v || Math.hypot(this.c.vx, this.c.vz)) + 2.5); } }
    }
    const acc = vt > a.v ? 7.5 * Math.min(1, muA + 0.1) : -12 * muA;
    a.braking = vt < a.v - 1; a.accel = vt > a.v + 0.5;
    a.v = Math.max(0, a.v + Math.max(-12 * dt, Math.min(acc * dt, vt - a.v)));
    a.lat += (a.latT - a.lat) * Math.min(1, dt * 0.9);
    const prev = a.s; a.s = (a.s + a.v * dt) % ct.L; a.dist += a.v * dt;
    a.wear = Math.min(1.2, a.wear + a.v * dt / 1000 * COMPOUNDS[a.cmp].wear);
    if (this.state === 'run') {
      if (prev > ct.L - 60 && a.s < 60) {
        const lt = this.raceT - a.lapStart; if (a.started) { a.last = lt; if (!a.best || lt < a.best) a.best = lt; } a.started = true;
        a.lap++; a.lapStart = this.raceT;
        if (this.mode === 'race' && a.lap > this.laps && !a.finished) { a.finished = true; a.total = this.raceT; }
      }
    }
    a.spin = (a.spin || 0) + a.v * dt / 0.365;
  }
};
Race.prototype.finishRace = function () {
  const res = this.order.map((r, k) => ({ pos: k + 1, name: r.name, total: r.finished ? r.total : null, best: r.best, laps: r.lap }));
  const mine = res.find(r => r.name === this.player.name);
  const rec = loadTrack(); rec.results = [{ date: new Date().toISOString(), mode: this.mode, laps: this.laps, weather: this.wx.name, power: this.o.power || 'v8', pos: mine ? mine.pos : 0, of: res.length, total: this.player.total, best: this.player.best, table: res.slice(0, 10) }, ...(rec.results || [])].slice(0, 20);
  rec.save = null; storeTrack(rec);
  this.results = res;
  if (this.onFinish) this.onFinish(res);
};
/* saved race state ("salvataggio posizioni gara") */
Race.prototype.save = function () {
  const rec = loadTrack(), pl = this.player, c = this.c;
  rec.save = { mode: this.mode, laps: this.laps, weather: this.weatherKey, power: this.o.power, raceT: this.raceT, wet: this.wet,
    car: { x: c.x, z: c.z, h: c.h, vx: c.vx, vz: c.vz }, fuel: this.eng.fuel,
    pl: { lap: pl.lap, lapStart: pl.lapStart, best: pl.best, last: pl.last, dist: pl.dist, cmp: pl.cmp, wear: pl.wear, bestSec: pl.bestSec },
    ai: this.ai.map(a => ({ s: a.s, lat: a.lat, v: a.v, lap: a.lap, lapStart: a.lapStart, best: a.best, last: a.last, dist: a.dist, cmp: a.cmp, wear: a.wear, pitted: a.pitted, finished: a.finished, total: a.total })) };
  storeTrack(rec);
};
Race.prototype.restore = function (sv) {
  this.raceT = sv.raceT; this.wet = sv.wet; this.state = 'run';
  Object.assign(this.c, sv.car); this.eng.fuel = sv.fuel; Object.assign(this.player, sv.pl);
  sv.ai.forEach((d, k) => { if (this.ai[k]) Object.assign(this.ai[k], d); });
};
Race.prototype.pitService = function (fuelAdd, cmp) {
  const pl = this.player, e = this.eng, add = Math.max(0, Math.min(e.T.tank - e.fuel, fuelAdd));
  const rate = e.T.unit === 'L' ? 3.0 : e.T.unit === 'kWh' ? 6.0 : 0.12;   // L/s, kWh/s (fast charger), kg/s
  const tFuel = add / rate, tTyre = cmp ? 3.4 : 0;
  pl.pit = { phase: 'service', t: Math.max(2.2, tFuel, tTyre) + 0.8, rate: add / Math.max(0.1, Math.max(2.2, tFuel, tTyre)), cmp };
};

/* ------------------------------------------------------------------ rendering */
Race.prototype.render = function (dt, inp, rainNow) {
  const gl = this.gl, P = this.P, ct = this.ct, c = this.c, o = this.o;
  const cv = this.cv = NR.cameraFor(this.view, c, this.cam, dt, this.t);
  const W = this.canvas.width, H = this.canvas.height; gl.viewport(0, 0, W, H);
  const origin = [c.x + cv.e[0], 0, c.z + cv.e[2]], eye = [0, cv.e[1], 0];
  const V = NR.lookAt(eye, [cv.l[0] - cv.e[0], cv.l[1], cv.l[2] - cv.e[2]], [0, 1, 0]);
  const fov = cv.fov * Math.PI / 180, Pm = NR.perspective(fov, W / H, 0.15, 1400), VP = NR.mul(Pm, V.m);
  const wx = this.wx, night = !!o.night;
  const pal = night ? { fog: [0.10, 0.11, 0.16], top: [0.01, 0.015, 0.04], sun: [0.75, 0.8, 1.0], sunDir: [0.3, 0.35, 0.9] }
    : { fog: [0.66 - 0.25 * wx.cloud, 0.74 - 0.22 * wx.cloud, 0.84 - 0.2 * wx.cloud], top: [0.20 + 0.3 * wx.cloud, 0.45 + 0.1 * wx.cloud, 0.85 - 0.15 * wx.cloud], sun: [1.0 - 0.4 * wx.cloud, 0.95 - 0.4 * wx.cloud, 0.82 - 0.3 * wx.cloud], sunDir: [0.45, 0.6, 0.62] };
  const neonA = [0.0, 1.0, 0.89], neonB = [1.0, 0.23, 0.78];
  const fogDen = 0.0012 * (wx.fog || 1) * (night ? 1.5 : 1);
  // lightning
  this.flash = Math.max(0, (this.flash || 0) - dt * 3.5); if (wx.light) { this.nextFlash = (this.nextFlash || 4) - dt; if (this.nextFlash <= 0) { this.flash = 1; this.nextFlash = Math.random() < 0.35 ? 0.15 : 5 + Math.random() * 9; } }
  const carRel = [c.x - origin[0], 0, c.z - origin[2]];
  const set = pr => {
    const u = pr.u, v3 = (n, a) => { if (u[n]) gl.uniform3fv(u[n], a); }, f1 = (n, a) => { if (u[n]) gl.uniform1f(u[n], a); };
    gl.useProgram(pr.p);
    f1('uTime', this.t % 3600); f1('uFar', 1300); f1('uFogDen', fogDen); f1('uFlash', this.flash); f1('uL', 1e6); f1('uWrapX', 0); f1('uZOff', 0.5); f1('uCamZ', 0); f1('uCamX', 0);
    v3('uFog', pal.fog); v3('uSkyTop', pal.top); v3('uNeonA', neonA); v3('uNeonB', neonB); v3('uEye', eye); v3('uOrigin', origin); v3('uSunDir', pal.sunDir); v3('uSunCol', pal.sun);
    v3('uWinA', [1, 0.8, 0.5]); v3('uWinB', [0.5, 0.8, 1]); v3('uWinC', [1, 0.4, 0.8]);
    f1('uWet', this.wet); f1('uHalfW', HALF_W); f1('uLapLen', ct.L);
    if (u.uHL) { const fx = Math.sin(c.h), fz = Math.cos(c.h); gl.uniform4f(u.uHL, carRel[0] + fx * 2.3, carRel[2] + fz * 2.3, fx, fz); f1('uHLOn', night ? 1 : 0.25); }
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, VP); if (u.uV) gl.uniformMatrix4fv(u.uV, false, V.m); if (u.uP) gl.uniformMatrix4fv(u.uP, false, Pm); f1('uRainCenter', 1);
  };
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  const sp = P.sky; set(sp); gl.uniform3fv(sp.u.uFwd, V.f); gl.uniform3fv(sp.u.uRight, V.r); gl.uniform3fv(sp.u.uUp, V.u);
  const ty = Math.tan(fov / 2); gl.uniform2f(sp.u.uTan, ty * W / H, ty); if (sp.u.uCloud) gl.uniform1f(sp.u.uCloud, wx.cloud); if (sp.u.uDay) gl.uniform1f(sp.u.uDay, night ? 0 : 1);
  gl.uniform3fv(sp.u.uSunCol, pal.sun); gl.uniform1f(sp.u.uSunStripes, 0); this.draw(sp, this.M.quad);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  set(P.ground); this.draw(P.ground, this.M.ground);
  set(P.road); this.draw(P.road, this.M.road);
  set(P.world); for (const m of this.M.scen) this.draw(P.world, m);
  // rivals: HD cars up close (same model and power unit as yours), low-poly far away
  const U0 = CarRenderUtil, nearAI = [];
  set(P.solid); gl.uniform1f(P.solid.u.uGloss, 1);
  for (const a of this.ai) {
    const q = ct.at(a.s, a.lat); const dx = q.x - origin[0], dz = q.z - origin[2], d2 = dx * dx + dz * dz; if (d2 > 900 * 900) continue;
    if (d2 < 170 * 170) { nearAI.push([a, q, dx, dz]); continue; }
    gl.uniformMatrix4fv(P.solid.u.uModel, false, NR.model(q.h, dx, 0, dz)); this.draw(P.solid, this.aiMesh[a.col % this.aiMesh.length]);
  }
  const aiState = (a, q) => ({ hood: 0, doorL: 0, doorR: 0, wheelSteer: Math.max(-0.5, Math.min(0.5, q.k * 30)), steerWheel: 0, spin: a.spin || 0, roof: 0, power: o.power || 'v8', time: this.t,
    exhaust: o.exhaust || 'serie', chrono: false, fly: 0, kit: a.kit, rim: a.rim, livery: a.livery, text: 'none', hand: 0 });
  if (nearAI.length) {
    set(P.hd); gl.uniform1f(P.hd.u.uKey, night ? 0.4 : 1.0); gl.uniform1f(P.hd.u.uLights, night || wx.rain > 0.3 ? 1 : 0.3); if (P.hd.u.uSpd) gl.uniform1f(P.hd.u.uSpd, 0);
    for (const [a, q, dx, dz] of nearAI) {
      this.hdAI.setMaterials(AI_COLS[a.col % AI_COLS.length], neonA, neonB, { stripe: [0.92, 0.92, 0.94], rim: [0.75, 0.6, 0.25] });
      gl.uniform1f(P.hd.u.uBrake, a.braking ? 1 : 0);
      a.M = U0.mul(U0.T(dx, 0, dz), U0.RY(q.h)); this.hdAI.draw(a.M, aiState(a, q), 'opaque');
    }
  }
  // player HD car
  const U = CarRenderUtil;
  this.bank = (this.bank || 0) + (-c.steer * 0.1 * Math.min(1, Math.abs(this.phys.vF) / 15) - (this.bank || 0)) * Math.min(1, dt * 4);
  const carM = U.mul(U.T(carRel[0], 0, carRel[2]), U.mul(U.RY(c.h), U.RZ(this.bank)));
  const st = { hood: 0, doorL: 0, doorR: 0, wheelSteer: c.steer * 0.5, steerWheel: c.steer * 2.6, spin: c.spin, roof: o.roof ? 1 : 0, power: o.power || 'v8', time: this.t, exhaust: o.exhaust || 'serie',
    chrono: false, fly: 0, kit: this.car.kit, rim: this.car.rim, livery: this.car.livery, text: this.car.text, hand: inp.hand ? 1 : 0 };
  if (cv.drawCar) {
    set(P.hd); this.hd.setMaterials(o.paint || 'rosso', neonA, neonB, kageExtra(this.car));
    gl.uniform1f(P.hd.u.uKey, night ? 0.4 : 1.0); gl.uniform1f(P.hd.u.uLights, night || wx.rain > 0.3 || wx.mist ? 1 : 0.3); gl.uniform1f(P.hd.u.uBrake, inp.brake ? 1 : 0);
    const e = this.eng, u = P.hd.u; if (u.uSpd) { gl.uniform1f(u.uSpd, Math.abs(this.phys.vF) * 3.6); gl.uniform1f(u.uRpmK, e.rpm / e.T.limiter); gl.uniform1f(u.uGear, e.gear); gl.uniform1f(u.uFuelK, e.fuelK || 0); gl.uniform1f(u.uGx, 0); }
    this.hd.draw(carM, st, 'opaque');
  }
  gl.enable(gl.BLEND); gl.depthMask(false);
  if (cv.drawCar) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); set(P.hd); this.hd.draw(carM, st, 'glass'); }
  if (nearAI.length) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); set(P.hd); for (const [a, q] of nearAI) this.hdAI.draw(a.M, aiState(a, q), 'glass'); }
  // exhaust, tyre smoke, rain spray (fx live in the camera frame: follow the origin)
  if (this.fxO) this.fx.shift(-(origin[0] - this.fxO[0]), 0, -(origin[2] - this.fxO[2])); this.fxO = origin;
  const tp = EngineFX.tipsFrom(carM, o.exhaust === 'race');
  this.fx.update(dt, tp.tips, tp.dir, [c.vx, 0, c.vz], this.eng, tp.hubs);
  this.fx.tyreSmoke(dt, carM, Math.max(this.eng.burn || 0, (this.eng.tyre || 0) * 0.7, this.wet > 0.3 ? Math.min(1, Math.hypot(c.vx, c.vz) / 60) * this.wet * 0.5 : 0, (this.surface === 'ghiaia' || this.surface === 'erba') ? Math.min(1, Math.hypot(c.vx, c.vz) / 25) * 0.6 : 0), [c.vx, 0, c.vz], CarHD.RIG.kitTrack[this.car.kit || 0]);
  set(P.fx); this.fxgl.draw(this.fx, H / (2 * Math.tan(fov / 2)));
  gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
  if (rainNow > 0.02) { set(P.rain); gl.uniform1f(P.rain.u.uCamZ, 0); gl.uniform1f(P.rain.u.uRain, rainNow); gl.uniform1f(P.rain.u.uRainSpeed, 28); if (P.rain.u.uSnow) gl.uniform1f(P.rain.u.uSnow, 0); if (P.rain.u.uWind) gl.uniform1f(P.rain.u.uWind, wx.light ? 4 : 1); this.draw(P.rain, this.M.rain); }
  gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (wx.mist) { set(P.mist); gl.uniform1f(P.mist.u.uMist, 0.6); gl.uniform2f(P.mist.u.uRes, W, H); this.draw(P.mist, this.M.quad); }
  set(P.post); gl.uniform1f(P.post.u.uFade, c.hit * 0.25); gl.uniform1f(P.post.u.uScan, 0); gl.uniform2f(P.post.u.uRes, W, H); this.draw(P.post, this.M.quad);
  gl.depthMask(true); gl.disable(gl.BLEND);
};

/* ------------------------------------------------------------------ HUD */
function fmt(t) { if (t === null || t === undefined || !isFinite(t)) return '--:--.---'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); }
Race.prototype.deltaNow = function () {
  const pl = this.player, B = pl.bestTrace; if (!B || B.length < 2) return null;
  const s = pl.s, lt = this.raceT - pl.lapStart; let k = 0; while (k < B.length - 2 && B[k + 1][0] < s) k++;
  const a = B[k], b = B[k + 1]; if (s < a[0] || s > b[0] + 30) return null;
  const ref = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, (s - a[0]) / Math.max(1, b[0] - a[0]))); return lt - ref;
};
Race.prototype.drawHud = function (inp) {
  const h = this.hud, g = h.getContext('2d'), W = h.width, H = h.height, m = Math.min(W, H), pl = this.player, e = this.eng, ct = this.ct, c = this.c;
  g.clearRect(0, 0, W, H);
  const A = '#00ffe3', txt = (s, x, y, size, col, al) => { g.font = (al && al.b ? 'bold ' : '') + (m * size | 0) + 'px monospace'; g.fillStyle = col || '#ecfcff'; g.textAlign = (al && al.a) || 'left'; g.fillText(s, x, y); };
  const pos = this.order.indexOf(pl) + 1, n = this.order.length;
  // top-left: position, lap, times
  g.fillStyle = 'rgba(7,11,19,0.6)'; g.fillRect(m * 0.02, m * 0.02, m * 0.42, m * 0.25);
  if (this.mode === 'race') txt('P' + pos + '/' + n, m * 0.035, m * 0.085, 0.06, A, { b: 1 }); else txt('SFIDA A TEMPO', m * 0.035, m * 0.075, 0.03, A, { b: 1 });
  txt(this.mode === 'race' ? 'GIRO ' + Math.min(this.laps, pl.lap + 1) + '/' + this.laps : 'GIRO ' + (pl.lap + 1), m * 0.24, m * 0.075, 0.028, '#ecfcff', { b: 1 });
  const lt = this.state === 'run' ? this.raceT - pl.lapStart : 0, d = this.deltaNow();
  txt('ATTUALE ' + fmt(lt), m * 0.035, m * 0.125, 0.024);
  txt('ULTIMO  ' + fmt(pl.last), m * 0.035, m * 0.155, 0.02, '#c8d6e0');
  txt('MIGLIORE ' + fmt(pl.best), m * 0.035, m * 0.183, 0.02, '#c58bff');
  if (d !== null) txt((d > 0 ? '+' : '') + d.toFixed(2), m * 0.33, m * 0.125, 0.026, d > 0 ? '#ff5470' : '#43ff8a', { b: 1 });
  for (let k = 0; k < 3; k++) { const st = pl.secT[k], b = pl.bestSec[k]; g.fillStyle = k < pl.sector ? (b && st <= b + 1e-6 ? '#c58bff' : '#43ff8a') : k === pl.sector ? A : 'rgba(255,255,255,0.2)'; g.fillRect(m * (0.035 + k * 0.13), m * 0.205, m * 0.12, m * 0.012); txt('S' + (k + 1) + ' ' + (st ? st.toFixed(2) : '--'), m * (0.035 + k * 0.13), m * 0.24, 0.016); }
  // standings (top 6 around the player)
  const i0 = Math.max(0, Math.min(n - 6, pos - 3));
  g.fillStyle = 'rgba(7,11,19,0.55)'; g.fillRect(m * 0.02, m * 0.29, m * 0.42, m * 0.035 * Math.min(6, n) + m * 0.01);
  for (let k = i0; k < Math.min(n, i0 + 6); k++) {
    const r = this.order[k], me = r === pl, y = m * 0.32 + (k - i0) * m * 0.035;
    let gap = '';
    if (this.mode === 'race' && k > 0) { const dd = this.order[k - 1].dist - r.dist; gap = '+' + (dd / Math.max(20, Math.hypot(c.vx, c.vz))).toFixed(1) + 's'; }
    else if (this.mode === 'tt') gap = fmt(r.best);
    txt((k + 1) + '. ' + r.name.slice(0, 18), m * 0.035, y, 0.018, me ? A : '#ecfcff', { b: me });
    txt(gap, m * 0.43, y, 0.016, '#c8d6e0', { a: 'right' });
  }
  // right: speed, fuel, tyres, grip, weather
  const kmh = Math.abs(this.phys ? this.phys.vF : 0) * 3.6, cx = W - m * 0.17, cy = H - m * 0.16;
  txt(Math.round(kmh), cx, cy, 0.075, '#ecfcff', { a: 'center', b: 1 }); txt('KM/H', cx, cy + m * 0.03, 0.018, '#ecfcff', { a: 'center' });
  txt((e.gear === -2 ? 'E' : e.gear < 0 ? 'N' : e.gear + 1) + '  ' + Math.round(e.rpm / 100) * 100 + ' RPM', cx, cy - m * 0.07, 0.022, '#ecfcff', { a: 'center' });
  const rk = Math.min(1, e.rpm / e.T.limiter); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(cx - m * 0.14, cy - m * 0.11, m * 0.28, m * 0.012); g.fillStyle = rk > 0.9 ? '#ff3b5c' : A; g.fillRect(cx - m * 0.14, cy - m * 0.11, m * 0.28 * rk, m * 0.012);
  const ff = EngineFX.fmtFuel(e), cmp = COMPOUNDS[pl.cmp];
  g.fillStyle = 'rgba(7,11,19,0.6)'; g.fillRect(W - m * 0.42, m * 0.02, m * 0.4, m * 0.2);
  txt('⛽ ' + ff.tank, W - m * 0.4, m * 0.06, 0.02, ff.k < 0.1 ? '#ff3b5c' : '#ecfcff'); txt(ff.cons, W - m * 0.4, m * 0.088, 0.017, '#c8d6e0');
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(W - m * 0.4, m * 0.098, m * 0.36, m * 0.01); g.fillStyle = ff.k < 0.1 ? '#ff3b5c' : A; g.fillRect(W - m * 0.4, m * 0.098, m * 0.36 * ff.k, m * 0.01);
  g.fillStyle = cmp.col; g.beginPath(); g.arc(W - m * 0.385, m * 0.135, m * 0.012, 0, Math.PI * 2); g.fill();
  txt(cmp.name + ' · USURA ' + Math.round(pl.wear * 100) + '%', W - m * 0.365, m * 0.142, 0.018);
  txt('ADERENZA ' + Math.round(this.c.mu * 100) + '% · ' + (this.surface || '').toUpperCase(), W - m * 0.4, m * 0.172, 0.017, this.c.mu < 0.7 ? '#ffb13b' : '#c8d6e0');
  txt(this.wx.name + ' · PISTA ' + (this.wet < 0.08 ? 'ASCIUTTA' : this.wet < 0.4 ? 'UMIDA' : this.wet < 0.75 ? 'BAGNATA' : 'ALLAGATA'), W - m * 0.4, m * 0.2, 0.017, '#c8d6e0');
  // minimap
  const mmR = m * 0.16, mx = m * 0.2, my = H - m * 0.2; let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  if (!this.mmBox) { for (const p of ct.S) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); } this.mmBox = [minX, maxX, minZ, maxZ]; }
  const [x0, x1, z0, z1] = this.mmBox, sc = mmR * 2 / Math.max(x1 - x0, z1 - z0), MX = x => mx - mmR + (x - x0) * sc, MZ = z => my + mmR - (z - z0) * sc;
  g.fillStyle = 'rgba(7,11,19,0.5)'; g.fillRect(mx - mmR - m * 0.01, my - mmR - m * 0.01, mmR * 2 + m * 0.02, mmR * 2 + m * 0.02);
  g.strokeStyle = 'rgba(230,240,255,0.8)'; g.lineWidth = m * 0.006; g.beginPath(); ct.S.forEach((p, k) => { if (k % 4) return; k ? g.lineTo(MX(p.x), MZ(p.z)) : g.moveTo(MX(p.x), MZ(p.z)); }); g.closePath(); g.stroke();
  for (const a of this.ai) { const q = ct.at(a.s, 0); g.fillStyle = 'rgb(' + AI_COLS[a.col].map(v => v * 255 | 0) + ')'; g.beginPath(); g.arc(MX(q.x), MZ(q.z), m * 0.007, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = A; g.beginPath(); g.arc(MX(c.x), MZ(c.z), m * 0.011, 0, Math.PI * 2); g.fill();
  // race lights
  if (this.state === 'grid') {
    const on = Math.min(5, Math.floor(this.lightT)), out = this.lightT > 5.6 + (this.goDelay || 0);
    for (let k = 0; k < 5; k++) { g.fillStyle = k < on && !out ? '#ff1f3a' : 'rgba(40,40,40,0.9)'; g.beginPath(); g.arc(W / 2 + (k - 2) * m * 0.08, H * 0.2, m * 0.03, 0, Math.PI * 2); g.fill(); }
    txt('PARTENZA DA FERMO · TIENI IL FRENO', W / 2, H * 0.28, 0.022, '#ecfcff', { a: 'center' });
  } else if (this.raceT < 2 && this.mode === 'race') txt('VIA!', W / 2, H * 0.25, 0.08, '#43ff8a', { a: 'center', b: 1 });
  if (pl.inPit) txt('PIT LANE · LIMITATORE 80 KM/H' + (pl.pit ? '' : ' · FERMATI NEL BOX ILLUMINATO'), W / 2, H * 0.14, 0.022, '#ffd23b', { a: 'center', b: 1 });
  if (pl.pit && pl.pit.phase === 'service') txt('🔧 SERVIZIO BOX  ' + pl.pit.t.toFixed(1) + ' s', W / 2, H * 0.2, 0.035, '#ffd23b', { a: 'center', b: 1 });
  if (e.fuel <= 0) txt('SERBATOIO VUOTO · RIENTRA AI BOX', W / 2, H * 0.32, 0.03, '#ff3b5c', { a: 'center', b: 1 });
  if (this.flashMsg) { this.flashT = (this.flashT || 0) + 1 / 60; txt(this.flashMsg, W / 2, H * 0.36, 0.03, '#c58bff', { a: 'center', b: 1 }); if (this.flashT > 3) { this.flashMsg = null; this.flashT = 0; } }
};

/* ------------------------------------------------------------------ saved data */
function loadTrack() { try { return JSON.parse(localStorage.getItem('kageTrack') || '{}'); } catch (e) { return {}; } }
function storeTrack(r) { try { localStorage.setItem('kageTrack', JSON.stringify(r)); } catch (e) { } }
function saveBest(race, t) {
  const r = loadTrack(); r.best = r.best || {}; const key = (race.o.power || 'v8') + '|' + race.weatherKey;
  if (!r.best[key] || t < r.best[key].t) r.best[key] = { t, cmp: race.player.cmp, date: new Date().toISOString() };
  storeTrack(r);
}

window.KageTrack = { Race, Circuit, COMPOUNDS, WEATHERS, fmt, loadTrack, storeTrack };
})();
