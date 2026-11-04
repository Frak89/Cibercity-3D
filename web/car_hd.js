/* AMPY KAGE GT — high-detail procedural model (original design, same lines as the game car).
 * One generator for everything: browser (game + showroom), node (tools/build_car.js → Android asset + OBJ export).
 * Units: metres, +Y up, +Z front, car centred on the origin, wheels on y = 0.
 * Every part has a pivot so the renderer can animate it (hood, butterfly doors, steering wheels, wheel spin, steering wheel). */
(function (root) {
'use strict';
const M = { PAINT: 0, CARBON: 1, TRIM: 2, CHROME: 3, GLASS: 4, HEAD: 5, TAIL: 6, NEON: 7, TIRE: 8, DISC: 9, CALIPER: 10,
  LEATHER: 11, ALCANTARA: 12, DASH: 13, SCREEN: 14, ALU: 15, ENGNEON: 16, INEON: 17, GRILLE: 18, CARPET: 19, TITAN: 20 };
const MAT_NAMES = ['paint', 'carbon', 'trim_black', 'chrome', 'glass', 'headlight', 'taillight', 'neon', 'tyre', 'brake_disc', 'caliper',
  'leather', 'alcantara', 'dashboard', 'screen', 'aluminium', 'engine_neon', 'interior_neon', 'grille', 'carpet', 'titanium'];

/* hinge / hub positions shared with the renderers */
const RIG = {
  hood: { pivot: [0, 0.80, 0.96], axis: 'x', open: -0.95 },
  doorL: { pivot: [-0.98, 0.50, 0.40], open: 1.05, out: 0.22 },
  doorR: { pivot: [0.98, 0.50, 0.40], open: 1.05, out: -0.22 },
  wheels: { FL: [-0.92, 0.36, 1.42], FR: [0.92, 0.36, 1.42], RL: [-0.92, 0.36, -1.45], RR: [0.92, 0.36, -1.45] },
  wheelRadius: 0.365,
  steering: { pivot: [-0.40, 0.84, 0.10], tilt: 0.47 },    // column tilt about x (rad)
  driverEye: [-0.40, 1.02, -0.36],
  // SPIDER: two-panel retractable hard top. Front panel A folds over rear panel B (hinge at the joint),
  // then the stack flips backwards around the B pivot into the well under the rear deck lid (tonneau).
  roof: { pivotB: [0, 0.86, -1.32], joint: [0, 1.235, -0.35], fold: Math.PI - 0.08, flip: Math.PI - 0.10 },
  tonneau: { pivot: [0, 0.85, -2.22], open: -1.15 },
  winDrop: 0.32,
  // levitation spheres (RSQ-style) instead of wheels
  sphere: { r: 0.335, lift: 0.04 },
  // KAGE CHRONO: chrono core between the seats (three counter-rotating rings)
  chrono: { center: [0, 0.80, -0.985] },
  // LEVITA flight: spheres swivel 90° (glow ring horizontal) and tuck up/out
  fly: { alt: 1.9, tuck: [0.05, 0.06] }
};
/** retractable roof timeline: r 0 (closed) → 1 (stowed). Same in car_render.js and CarHd.java */
function roofPhases(r) {
  const sm = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  return { win: sm(r / 0.2), lid: sm((r - 0.12) / 0.2) * (1 - sm((r - 0.80) / 0.18)), fold: sm((r - 0.25) / 0.25), flip: sm((r - 0.42) / 0.40) };
}

/* ---------------------------------------------------------------- mesh parts */
function Part(name, pivot) {
  return { name, pivot: pivot || [0, 0, 0], pos: [], norm: [], uv: [], mat: [], idx: [], gidx: [] };
}
function vert(P, p, n, uv, mat) {
  P.pos.push(p[0], p[1], p[2]); P.norm.push(n[0], n[1], n[2]); P.uv.push(uv[0], uv[1]); P.mat.push(mat);
  return P.pos.length / 3 - 1;
}
function tri(P, a, b, c, mat) { (mat === M.GLASS ? P.gidx : P.idx).push(a, b, c); }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scl(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function rotX(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
function rotY(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
function rotZ(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }

/**
 * Parametric surface on a (nu × nv) grid. fn(u, v) → point. Normals from the analytic derivatives.
 * pick(uc, vc) → { part, mat } | null decides, per quad, which part and material receive it (so one loft can be
 * cut into body / doors / hood…). Vertices are shared per part.
 */
function surface(fn, nu, nv, pick, uvs, opts) {
  opts = opts || {};
  const e = 1e-4, cache = new Map();
  const grid = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = i / nu, v = j / nv;
    const p = fn(u, v);
    const du = sub(fn(Math.min(1, u + e), v), fn(Math.max(0, u - e), v));
    const dv = sub(fn(u, Math.min(1, v + e)), fn(u, Math.max(0, v - e)));
    let n = norm(cross(du, dv));
    if (opts.flip) n = scl(n, -1);
    if (!isFinite(n[0])) n = [0, 1, 0];
    grid.push({ p, n, uv: [u * (uvs ? uvs[0] : 1) + (opts.uvOff ? opts.uvOff[0] : 0), v * (uvs ? uvs[1] : 1) + (opts.uvOff ? opts.uvOff[1] : 0)] });
  }
  const at = (i, j) => grid[i * (nv + 1) + j];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const r = pick((i + 0.5) / nu, (j + 0.5) / nv);
    if (!r) continue;
    const P = r.part, off = r.offset || 0;
    const key = (k, l) => P.name + ':' + (opts.id || '') + ':' + k + ':' + l + ':' + r.mat + ':' + off;
    const ids = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([k, l]) => {
      const kk = key(k, l);
      if (cache.has(kk)) return cache.get(kk);
      const g = at(k, l);
      const id = vert(P, off ? add(g.p, scl(g.n, off)) : g.p, g.n, g.uv, r.mat);
      cache.set(kk, id); return id;
    });
    if (r.reverse) { tri(P, ids[0], ids[2], ids[1], r.mat); tri(P, ids[0], ids[3], ids[2], r.mat); }
    else { tri(P, ids[0], ids[1], ids[2], r.mat); tri(P, ids[0], ids[2], ids[3], r.mat); }
  }
}

/** Lathe around an axis through `c`: profile [[a, r]] (a along the axis, r radius); axis 'x' or 'z'. */
function lathe(P, c, profile, seg, mat, axis, uvRep, a0, a1) {
  a0 = a0 || 0; a1 = a1 === undefined ? Math.PI * 2 : a1;
  const pt = (k, s) => {
    const [a, r] = profile[k], t = a0 + (a1 - a0) * s;
    return axis === 'z' ? [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, c[2] + a] : axis === 'y' ? [c[0] + Math.cos(t) * r, c[1] + a, c[2] + Math.sin(t) * r] : [c[0] + a, c[1] + Math.cos(t) * r, c[2] + Math.sin(t) * r];
  };
  const fn = (u, v) => {
    const f = u * (profile.length - 1), k = Math.min(profile.length - 2, Math.floor(f)), w = f - k;
    const p0 = pt(k, v), p1 = pt(k + 1, v);
    return [lerp(p0[0], p1[0], w), lerp(p0[1], p1[1], w), lerp(p0[2], p1[2], w)];
  };
  surface(fn, (profile.length - 1) * 2, seg, () => ({ part: P, mat }), [1, uvRep || 1], { id: 'lathe' + P.pos.length });
}

/** Superellipsoid (rounded box) centred at c, radii r, exponent e (0.1 = boxy, 1 = ellipsoid), rotation rx (about x). */
function blob(P, c, r, e, mat, rx, ry, nu, nv) {
  const sp = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);
  const fn = (u, v) => {
    const th = (u - 0.5) * Math.PI, ph = v * Math.PI * 2;
    let p = [r[0] * sp(Math.cos(th), e) * sp(Math.cos(ph), e), r[1] * sp(Math.sin(th), e), r[2] * sp(Math.cos(th), e) * sp(Math.sin(ph), e)];
    if (rx) p = rotX(p, rx);
    if (ry) p = rotY(p, ry);
    return add(p, c);
  };
  surface(fn, nu || 14, nv || 20, () => ({ part: P, mat }), [2, 2], { id: 'blob' + P.pos.length });
}

/** Box (axis-aligned in its own frame) – exact flat faces. */
function box(P, c, h, mat, rx, ry, rz) {
  const T = p => { let q = p; if (rz) q = rotZ(q, rz); if (rx) q = rotX(q, rx); if (ry) q = rotY(q, ry); return add(q, c); };
  const R = n => { let q = n; if (rz) q = rotZ(q, rz); if (rx) q = rotX(q, rx); if (ry) q = rotY(q, ry); return q; };
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  for (const [n, a, b] of faces) {
    const ctr = [n[0] * h[0], n[1] * h[1], n[2] * h[2]];
    const A = [a[0] * h[0], a[1] * h[1], a[2] * h[2]], B = [b[0] * h[0], b[1] * h[1], b[2] * h[2]];
    const ps = [sub(sub(ctr, A), B), add(sub(ctr, B), A), add(add(ctr, A), B), add(sub(ctr, A), B)];
    const nn = R(n);
    const ids = ps.map((p, i) => vert(P, T(p), nn, [[0, 0], [1, 0], [1, 1], [0, 1]][i], mat));
    tri(P, ids[0], ids[1], ids[2], mat); tri(P, ids[0], ids[2], ids[3], mat);
  }
}

/** Tube along a polyline. */
function tube(P, pts, r, seg, mat) {
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], d = norm(sub(b, a));
    const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const s = norm(cross(d, up)), t = cross(s, d);
    const ring = (c) => { const out = []; for (let i = 0; i <= seg; i++) { const an = i / seg * Math.PI * 2; const n = add(scl(s, Math.cos(an)), scl(t, Math.sin(an))); out.push([add(c, scl(n, r)), n]); } return out; };
    const ra = ring(a), rb = ring(b);
    for (let i = 0; i < seg; i++) {
      const i0 = vert(P, ra[i][0], ra[i][1], [i / seg, 0], mat), i1 = vert(P, ra[i + 1][0], ra[i + 1][1], [(i + 1) / seg, 0], mat);
      const i2 = vert(P, rb[i + 1][0], rb[i + 1][1], [(i + 1) / seg, 1], mat), i3 = vert(P, rb[i][0], rb[i][1], [i / seg, 1], mat);
      tri(P, i0, i1, i2, mat); tri(P, i0, i2, i3, mat);
    }
  }
}

/* ---------------------------------------------------------------- body definition */
// key stations: z, half width, bottom, shoulder height, top (centre line)
const ST = [
  [-2.34, 0.78, 0.36, 0.60, 0.76], [-2.22, 0.92, 0.30, 0.68, 0.84], [-1.85, 1.00, 0.25, 0.76, 0.88], [-1.45, 1.03, 0.24, 0.81, 0.89],
  [-1.05, 1.00, 0.23, 0.72, 0.89], [-0.40, 0.97, 0.22, 0.61, 0.88], [0.40, 0.97, 0.22, 0.59, 0.84], [1.00, 0.99, 0.22, 0.66, 0.78],
  [1.42, 1.01, 0.23, 0.79, 0.74], [1.85, 0.98, 0.24, 0.68, 0.64], [2.18, 0.90, 0.27, 0.52, 0.54], [2.36, 0.70, 0.31, 0.42, 0.45]];
const Z0 = ST[0][0], Z1 = ST[ST.length - 1][0];
function station(z) {
  // Catmull-Rom through the key stations
  let k = 0; while (k < ST.length - 2 && z > ST[k + 1][0]) k++;
  const p0 = ST[Math.max(0, k - 1)], p1 = ST[k], p2 = ST[k + 1], p3 = ST[Math.min(ST.length - 1, k + 2)];
  const t = clamp((z - p1[0]) / (p2[0] - p1[0]), 0, 1), t2 = t * t, t3 = t2 * t;
  const o = [];
  for (let i = 1; i < 5; i++) o.push(0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
  return o; // W, Yb, Ys, Yt
}
const AXLES = [1.42, -1.45], ARCH_R = 0.43;
/** Body surface point. u: 0 rear → 1 front, v: 0 left sill → 0.5 roof centre line → 1 right sill. */
function bodyPt(u, v) {
  const z = lerp(Z0, Z1, u);
  const [W, Yb, Ys, Yt] = station(z);
  const side = v < 0.5 ? -1 : 1, vv = v < 0.5 ? v * 2 : (1 - v) * 2;
  let x, y;
  if (vv < 0.45) {
    const k = vv / 0.45;
    let yb = Yb;
    for (const ax of AXLES) { const dz = z - ax; if (Math.abs(dz) < ARCH_R) yb = Math.max(yb, 0.36 + Math.sqrt(ARCH_R * ARCH_R - dz * dz) * (1 - 0.0)); }
    yb = Math.min(yb, Ys - 0.07);
    x = side * W * (0.955 + 0.045 * Math.sin(k * Math.PI / 2));
    // feature line: a crisp crease along the doors that catches a sharp reflection
    const cz = smooth((z + 1.9) / 0.5) * (1 - smooth((z - 1.75) / 0.4));
    x += side * W * 0.014 * Math.exp(-Math.pow((k - 0.62) / 0.05, 2)) * cz;
    y = yb + (Ys - yb) * k;
  } else {
    const k = (vv - 0.45) / 0.55, ph = k * Math.PI / 2;
    x = side * W * Math.pow(Math.cos(ph), 0.55);
    y = Ys + (Yt - Ys) * Math.pow(Math.sin(ph), 0.75);
    // hood power bulge between the front fenders
    const hz = smooth((z - 1.0) / 0.25) * (1 - smooth((z - 2.05) / 0.2));
    y += 0.03 * hz * Math.exp(-Math.pow(x / 0.32, 2));
  }
  return [x, y, z];
}
const zOf = u => lerp(Z0, Z1, u);
const uOf = z => (z - Z0) / (Z1 - Z0);

// cabin / greenhouse
const CB = [[-1.30, 0.88], [-0.95, 1.16], [-0.40, 1.235], [0.15, 1.235], [0.42, 1.165], [0.98, 0.76]];
const CZ0 = -1.30, CZ1 = 0.98;
// monotone cubic (Fritsch–Carlson) through the side-view keys: a fair, wave-free windscreen and roof line
const CBm = (() => {
  const n = CB.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((CB[i + 1][1] - CB[i][1]) / (CB[i + 1][0] - CB[i][0]));
  m.push(d[0]); for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2); m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b; if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  return m;
})();
function roofY(z) {
  let k = 0; while (k < CB.length - 2 && z > CB[k + 1][0]) k++;
  const a = CB[k], b = CB[k + 1], h = b[0] - a[0], t = clamp((z - a[0]) / h, 0, 1), t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * h * CBm[k] + (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * h * CBm[k + 1];
}
// height of the body surface where the greenhouse meets it (x = 0.88 W): glass grows out of the body, no slit
function beltY(z) { const [, , Ys, Yt] = station(z); return Ys + (Yt - Ys) * 0.69 - 0.012; }
function cabinPt(u, v) {
  const z = lerp(CZ0, CZ1, u);
  const side = v < 0.5 ? -1 : 1, vv = v < 0.5 ? v * 2 : (1 - v) * 2;   // 0 beltline → 1 roof centre line
  const [W] = station(z);
  const Wb = W * 0.88, yb = beltY(z), Yr = Math.max(yb + 0.01, roofY(z));
  // plan view: roof narrower than the beltline and slightly bowed, tapering into screen and fastback
  const Wr = (0.60 + 0.06 * Math.sin(u * Math.PI)) * (0.9 + 0.1 * smooth(u * 3));
  const ph = vv * Math.PI / 2, c = Math.cos(ph), sn = Math.sin(ph);
  // superellipse (n ≈ 3): flat-ish crown, generous radius at the cant rail, curved side glass (tumblehome)
  const cx = Math.pow(c, 2 / 3.2), sy = Math.pow(sn, 2 / 2.4);
  const w = lerp(Wb, Wr * 1.08, Math.pow(sn, 1.4));
  const bulge = 0.018 * Math.sin(Math.min(1, vv / 0.62) * Math.PI) * (vv < 0.62 ? 1 : 0);   // side glass bows outwards
  const pC = [side * (w * cx + bulge), yb + (Yr - yb) * sy, z];
  // where the canopy would dip under the bodywork (screen base on the cowl, fastback tail) it lies on the skin instead
  const pB = bodyPt((z - Z0) / (Z1 - Z0), side < 0 ? lerp(0.34, 0.5, vv) : lerp(0.66, 0.5, vv));
  const wB = smooth((pB[1] + 0.004 - pC[1]) / 0.012 + 0.5);
  return [lerp(pC[0], pB[0], wB), lerp(pC[1], pB[1] + 0.004, wB), z];
}

/* ---------------------------------------------------------------- build */
function build(opt) {
  opt = opt || {};
  const q = opt.quality === 'low' ? 0.5 : 1;
  const parts = {};
  const P = (name, pivot) => (parts[name] = parts[name] || Part(name, pivot));
  const body = P('body'), hood = P('hood', RIG.hood.pivot), doorL = P('doorL', RIG.doorL.pivot), doorR = P('doorR', RIG.doorR.pivot);
  const roofA = P('roofA', RIG.roof.joint), roofB = P('roofB', RIG.roof.pivotB), tonneau = P('tonneau', RIG.tonneau.pivot);
  const winL = P('winL'), winR = P('winR'), qwinL = P('qwinL'), qwinR = P('qwinR'), exhaust = P('exhaust'), bay = P('bay');
  const engineW = P('engineW'), engineE = P('engineE'), magPads = P('magPads'), magRings = P('magRings');
  const interior = P('interior'), engine = P('engine'), wheel = P('steeringWheel', RIG.steering.pivot);
  const NU = Math.round(170 * q), NV = Math.round(104 * q);
  // cut lines snapped to grid lines so the panels split exactly where the gap lines are drawn
  const snapZ = z => lerp(Z0, Z1, Math.round(uOf(z) * NU) / NU);
  const snapVV = vv => Math.round(vv * NV / 2) / (NV / 2);
  const DZ0 = snapZ(-0.62), DZ1 = snapZ(0.40);            // door cut
  const HZ0 = snapZ(0.96), HZ1 = snapZ(2.16);              // hood cut
  const DV0 = snapVV(0.07), DV1 = snapVV(0.72), HV0 = snapVV(0.80);
  const inDoor = (z, vv) => z > DZ0 && z < DZ1 && vv > DV0 && vv < DV1;
  const TZ0 = snapZ(-2.22), TZ1 = snapZ(-1.32), TV0 = snapVV(0.78);
  const inLid = (z, vv) => z > TZ0 && z < TZ1 && vv > TV0;
  const inHood = (z, vv) => z > HZ0 && z < HZ1 && vv > HV0;
  const CC0 = snapZ(CZ0 + 0.03), CC1 = snapZ(CZ1 - 0.03), CV = snapVV(0.70);
  const inCabin = (u, v) => { const z = zOf(u), vv = v < 0.5 ? v * 2 : (1 - v) * 2; return z > CC0 && z < CC1 && vv > CV; };
  // ---- main body loft, cut into body / doors / hood
  surface(bodyPt, NU, NV, (u, v) => {
    const z = zOf(u), vv = v < 0.5 ? v * 2 : (1 - v) * 2, left = v < 0.5;
    // side skirt carbon strip
    const mat = vv < 0.09 ? M.CARBON : M.PAINT;
    if (inDoor(z, vv)) return { part: left ? doorL : doorR, mat };
    if (inHood(z, vv)) return { part: hood, mat: M.PAINT };
    if (inLid(z, vv)) return { part: tonneau, mat: M.PAINT };
    if (inCabin(u, v)) return null;              // the greenhouse sits here: open the shell
    return { part: body, mat };
  }, [5, 3], { id: 'body' });
  // door cards (inside of the doors) and hood underside
  surface(bodyPt, NU, NV, (u, v) => {
    const z = zOf(u), vv = v < 0.5 ? v * 2 : (1 - v) * 2, left = v < 0.5;
    if (inDoor(z, vv)) {
      const mat = vv > 0.6 ? M.INEON : vv > 0.42 ? M.ALCANTARA : M.LEATHER;
      return { part: left ? doorL : doorR, mat: (vv > 0.6 && vv < 0.64) ? M.INEON : (vv > 0.6 ? M.DASH : mat), offset: -0.07 };
    }
    if (inHood(z, vv)) return { part: hood, mat: M.TRIM, offset: -0.02 };
    if (inLid(z, vv)) return { part: tonneau, mat: M.TRIM, offset: -0.02 };
    return null;
  }, [5, 3], { id: 'inner' });
  // panel gaps: crisp dark ribbons exactly on the cut lines (both sides of the car)
  const bodyN = (u, v) => { const e = 1e-4; return norm(cross(sub(bodyPt(Math.min(1, u + e), v), bodyPt(Math.max(0, u - e), v)), sub(bodyPt(u, Math.min(1, v + e)), bodyPt(u, Math.max(0, v - e))))); };
  const vOf = (vv, left) => left ? vv / 2 : 1 - vv / 2;
  const gap = (part, uvFn, n, w, mat, lift) => {
    const pts = []; for (let i = 0; i <= n; i++) { const [u, v] = uvFn(i / n); pts.push([bodyPt(u, v), bodyN(u, v)]); }
    let prev = -1, prev2 = -1;
    for (let i = 0; i <= n; i++) {
      const [p, nn0] = pts[i], q2 = pts[Math.min(n, i + 1)][0], q0 = pts[Math.max(0, i - 1)][0];
      const nn = scl(nn0, Math.sign(nn0[0] * p[0] + nn0[1] * (p[1] - 0.5) + 1e-6) || 1);
      const side = norm(cross(sub(q2, q0), nn));
      const a1 = vert(part, add(add(p, scl(side, w / 2)), scl(nn, lift)), nn, [i / n, 0], mat), a2 = vert(part, add(sub(p, scl(side, w / 2)), scl(nn, lift)), nn, [i / n, 1], mat);
      if (prev >= 0) { tri(part, prev, a1, a2, mat); tri(part, prev, a2, prev2, mat); }
      prev = a1; prev2 = a2;
    }
  };
  for (const left of [true, false]) {
    const D = left ? doorL : doorR;
    gap(body, t => [uOf(DZ0), vOf(lerp(DV0, DV1, t), left)], 30, 0.006, M.TRIM, 0.0025);
    gap(body, t => [uOf(DZ1), vOf(lerp(DV0, DV1, t), left)], 30, 0.006, M.TRIM, 0.0025);
    gap(D, t => [uOf(lerp(DZ0, DZ1, t)), vOf(DV0, left)], 40, 0.006, M.TRIM, 0.0025);
    gap(D, t => [uOf(lerp(DZ0, DZ1, t)), vOf(DV1, left)], 40, 0.006, M.TRIM, 0.0025);
    gap(hood, t => [uOf(lerp(HZ0, HZ1, t)), vOf(HV0, left)], 50, 0.006, M.TRIM, 0.0025);
    // wheel-arch lips (carbon) following the arch cut-out
    for (const ax of AXLES) {
      const pts = [];
      for (let i = 0; i <= 28; i++) {
        const a = Math.PI * (0.02 + 0.96 * i / 28), z = ax + Math.cos(a) * ARCH_R;
        const [W, , Ys] = station(z), y = Math.min(Ys - 0.07, 0.36 + Math.sin(a) * ARCH_R);
        pts.push([(left ? -1 : 1) * W * 0.962, y, z]);
      }
      tube(body, pts, 0.018, 8, M.CARBON);
    }
  }
  gap(body, t => [uOf(HZ0), lerp(1 - HV0 / 2, HV0 / 2, t) < 0.5 ? lerp(1 - HV0 / 2, HV0 / 2, t) : lerp(1 - HV0 / 2, HV0 / 2, t)], 40, 0.006, M.TRIM, 0.0025);
  gap(body, t => [uOf(HZ1), lerp(1 - HV0 / 2, HV0 / 2, t)], 40, 0.006, M.TRIM, 0.0025);
  gap(tonneau, t => [uOf(TZ0), lerp(1 - TV0 / 2, TV0 / 2, t)], 30, 0.006, M.TRIM, 0.0025);
  gap(body, t => [uOf(TZ1), lerp(1 - TV0 / 2, TV0 / 2, t)], 30, 0.006, M.TRIM, 0.0025);
  for (const left of [true, false]) gap(tonneau, t => [uOf(lerp(TZ0, TZ1, t)), vOf(TV0, left)], 40, 0.006, M.TRIM, 0.0025);
  // roof stowage well under the lid
  box(body, [0, 0.47, -1.78], [0.66, 0.01, 0.44], M.CARPET);
  for (const sx of [-0.67, 0.67]) box(body, [sx, 0.64, -1.78], [0.01, 0.17, 0.44], M.TRIM);
  box(body, [0, 0.64, -2.21], [0.66, 0.17, 0.01], M.TRIM);
  // shoulder neon line, door handles, hood vents
  surface(bodyPt, NU * 2, NV * 4, (u, v) => {
    const z = zOf(u), vv = v < 0.5 ? v * 2 : (1 - v) * 2, left = v < 0.5;
    if (z > -2.1 && z < 2.0 && Math.abs(vv - 0.46) < 0.008) return { part: inDoor(z, vv) ? (left ? doorL : doorR) : body, mat: M.NEON, offset: 0.004 };
    if (z > -0.45 && z < -0.25 && Math.abs(vv - 0.58) < 0.02) return { part: left ? doorL : doorR, mat: M.CHROME, offset: 0.006 };
    if (z > 1.35 && z < 1.85 && vv > 0.86 && vv < 0.94 && Math.floor((z - 1.35) / 0.06) % 2 === 0) return { part: hood, mat: M.NEON, offset: 0.004 };
    return null;
  }, [1, 1], { id: 'details' });
  // headlights (follow the nose surface) and full-width segmented tail light
  surface(bodyPt, NU * 3, NV * 3, (u, v) => {
    const z = zOf(u), vv = v < 0.5 ? v * 2 : (1 - v) * 2;
    // headlight: a dark lens pocket with a thin diagonal LED blade inside
    const blade = Math.abs((z - 2.30) + (vv - 0.62) * 0.42);
    if (z > 2.22 && z < 2.315 && vv > 0.60 && vv < 0.86) return { part: body, mat: blade < 0.007 ? M.HEAD : M.GLASS === 4 && blade < 0.03 ? M.TRIM : M.PAINT, offset: blade < 0.03 ? 0.003 : 0 } ;
    if (z > 2.315 && z < 2.335 && vv > 0.42 && vv < 0.62) return { part: body, mat: M.NEON, offset: 0.004 };   // DRL hook
    if (z < -2.27 && vv > 0.42) return { part: body, mat: M.TAIL, offset: 0.004 };
    return null;
  }, [8, 4], { id: 'lights' });
  // end caps: rear panel (dark, with diffuser) and nose with intake grille
  const capFn = (zc, recess) => (s, t) => { const p = bodyPt(uOf(zc), s); const c = [0, 0.32 + (station(zc)[3] - 0.32) * 0.55, zc + recess]; return [lerp(p[0], c[0], t * 0.98), lerp(p[1], c[1], t * 0.98), lerp(p[2], c[2], t)]; };
  surface(capFn(Z0, -0.02), NV, 10, (s, t) => ({ part: body, mat: M.TRIM }), [4, 1], { id: 'rearcap' });
  surface(capFn(Z1, 0.03), NV, 10, (s, t) => {
    const p = capFn(Z1, 0.03)(s, t);
    return { part: body, mat: p[1] < 0.37 && Math.abs(p[0]) < 0.62 ? M.GRILLE : M.PAINT };
  }, [8, 4], { id: 'frontcap' });
  // floor
  surface((u, v) => { const p0 = bodyPt(u, 0.0001), p1 = bodyPt(u, 0.9999); return [lerp(p0[0], p1[0], v), Math.min(p0[1], 0.25), p0[2]]; }, 40, 4, () => ({ part: body, mat: M.TRIM }), [1, 1], { id: 'floor' });
  // wheel arch liners
  // liners follow the local width and always stay under the fender / hood skin (the fenders rise above the hood centre)
  const skinY = (z, X) => { for (let v = 0.5; v > 0; v -= 0.002) { const p = bodyPt(uOf(z), v); if (Math.abs(p[0]) >= X) return p[1]; } return 0.6; };
  for (const ax of AXLES) for (const sx of [-1, 1]) {
    surface((u, v) => {
      const a = Math.PI * u, z = ax + Math.cos(a) * ARCH_R, [W, , Ys] = station(z), x = lerp(W * 0.72, W * 0.94, v);
      return [sx * x, Math.min(Ys - 0.07, 0.36 + Math.sin(a) * ARCH_R, skinY(z, x) - 0.035), z];
    }, 32, 4, () => ({ part: body, mat: M.TRIM }), [1, 1], { id: 'arch' + ax + sx });
  }
  // ---- greenhouse: glass + carbon roof + pillars; side windows belong to the doors
  surface(cabinPt, Math.round(70 * q), Math.round(48 * q), (u, v) => {
    const z = lerp(CZ0, CZ1, u), vv = v < 0.5 ? v * 2 : (1 - v) * 2, left = v < 0.5;
    if (vv > 0.62 && z > -0.35 && z < 0.32) return { part: roofA, mat: Math.abs(vv - 0.64) < 0.02 ? M.TRIM : M.CARBON };
    if (vv > 0.62 && z > -1.0 && z <= -0.35) return { part: roofB, mat: Math.abs(vv - 0.64) < 0.02 || z > -0.37 ? M.TRIM : M.CARBON };
    if (vv > 0.62 && z <= -1.0) return { part: roofB, mat: z > -1.04 ? M.TRIM : M.GLASS };   // rear screen travels with the roof
    if (z > 0.30 && z < 0.40) return { part: body, mat: M.TRIM };                  // A pillar
    if (z < -0.95 && vv < 0.62) return { part: body, mat: M.PAINT };                // flying-buttress C pillars
    if (z > -0.66 && z < -0.58 && vv < 0.62) return { part: left ? qwinL : qwinR, mat: M.TRIM };   // B pillar (drops with the glass)
    if (z > -0.95 && z <= -0.66 && vv < 0.62) return { part: left ? qwinL : qwinR, mat: M.GLASS };  // rear quarter glass
    if (z > -0.58 && z < 0.30 && vv < 0.62) return { part: left ? winL : winR, mat: M.GLASS };   // drop glass
    return { part: body, mat: M.GLASS };
  }, [3, 3], { id: 'cabin' });
  surface(cabinPt, Math.round(70 * q), Math.round(48 * q), (u, v) => {
    const z = lerp(CZ0, CZ1, u), vv = v < 0.5 ? v * 2 : (1 - v) * 2;
    if (vv > 0.63 && z > -0.34 && z < 0.31) return { part: roofA, mat: M.ALCANTARA, offset: -0.012 };
    if (vv > 0.63 && z > -0.99 && z < -0.36) return { part: roofB, mat: M.ALCANTARA, offset: -0.012 };
    return null;
  }, [3, 3], { id: 'headliner' });
  // ---- spoiler (airfoil) with endplates and neon edge
  const foil = (u, v) => { const x = lerp(-0.92, 0.92, u), a = v * Math.PI * 2, c = 0.34; return [x, 1.10 + Math.sin(a) * 0.03 * (Math.cos(a) > 0 ? 1 : 0.5), -2.06 + Math.cos(a) * c / 2]; };
  surface(foil, 30, 16, () => ({ part: tonneau, mat: M.CARBON }), [6, 1], { id: 'wing' });
  surface((u, v) => { const p = foil(u, 0.5); return [p[0], 1.105 + v * 0.012, -2.23]; }, 30, 1, () => ({ part: tonneau, mat: M.NEON }), [1, 1], { id: 'wingneon' });
  for (const sx of [-0.94, 0.94]) box(tonneau, [sx, 1.08, -2.06], [0.012, 0.09, 0.2], M.CARBON);
  for (const sx of [-0.55, 0.55]) box(tonneau, [sx, 0.98, -2.0], [0.02, 0.12, 0.05], M.TRIM, 0.25);
  // ---- splitter, diffuser, exhausts, side mirrors
  box(body, [0, 0.235, 2.30], [0.78, 0.012, 0.14], M.CARBON);
  box(body, [0, 0.235, 2.445], [0.78, 0.012, 0.006], M.NEON);
  for (let i = -2; i <= 2; i++) box(body, [i * 0.18, 0.29, -2.12], [0.008, 0.06, 0.2], M.TRIM, -0.2);
  const exhaustR = P('exhaustR');
  for (const ex of [-0.40, -0.20, 0.20, 0.40]) {
    lathe(exhaustR, [ex, 0.32, -2.47], [[0, 0.074], [0.03, 0.078], [0.20, 0.078], [0.20, 0.066], [0.02, 0.066]], 40, M.TITAN, 'z', 1);
    lathe(exhaustR, [ex, 0.32, -2.44], [[0, 0.0], [0, 0.064]], 40, M.ENGNEON, 'z');
    lathe(exhaustR, [ex, 0.32, -2.455], [[0, 0.050], [0.002, 0.050], [0.002, 0.060], [0, 0.060]], 40, M.CHROME, 'z');
  }
  // exposed titanium muffler box + heat shield under the diffuser
  blob(exhaustR, [0, 0.30, -2.18], [0.52, 0.07, 0.16], 0.22, M.TITAN, 0, 0, 20, 28);
  box(exhaustR, [0, 0.38, -2.18], [0.50, 0.004, 0.15], M.ALU);
  for (const ex of [-0.38, -0.22, 0.22, 0.38]) {
    lathe(exhaust, [ex, 0.33, -2.38], [[0, 0.052], [0.12, 0.052], [0.12, 0.044], [0.0, 0.044]], 28, M.CHROME, 'z');
    lathe(exhaust, [ex, 0.33, -2.35], [[0, 0.0], [0, 0.044]], 28, M.ENGNEON, 'z');
  }
  // ---- side mirrors: aero housing (paint over carbon), LED repeater, carbon bezel, real mirror glass,
  //      and a swan-neck blade support that grows out of the door top
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const se = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), e);
  const bez = (a, b, c, d, t) => { const m = 1 - t; return [0, 1, 2].map(i => m * m * m * a[i] + 3 * m * m * t * b[i] + 3 * m * t * t * c[i] + t * t * t * d[i]); };
  for (const [door, sx] of [[doorL, -1], [doorR, 1]]) {
    const C = [sx * 1.105, 0.935, 0.235], HW = 0.108, HH = 0.050, HD = 0.085, Z0m = C[2] - HD * 0.28;
    // cross-section of the housing at depth k (0 = rear rim, 1 = nose)
    const sec = (th, k, sc) => {
      const s = Math.pow(Math.max(0, 1 - Math.pow(k, 2.4)), 0.5) * sc, c = Math.cos(th), sn = Math.sin(th);
      const outer = c * sx > 0 ? 1.06 : 0.94;                       // fuller outboard, slimmer towards the glass
      return [C[0] - sx * 0.025 * k * k + se(c, 0.42) * HW * s * outer, C[1] - 0.008 * k + se(sn, 0.62) * HH * s * (sn > 0 ? 1 : 0.85), Z0m + k * HD * 1.28];
    };
    surface((u, v) => sec(u * Math.PI * 2, v, 1), 56, 26, (u, v) => {
      const th = u * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      if (c * sx > 0.55 && Math.abs(sn) < 0.05 && v > 0.14 && v < 0.6) return { part: door, mat: M.NEON, offset: 0.0015 };   // LED repeater
      return { part: door, mat: sn < -0.35 ? M.CARBON : M.PAINT };
    }, [4, 2], { id: 'mirrorShell' + sx, flip: sx > 0 });
    // rolled rear lip, carbon bezel and the glass itself (facing the driver, slightly recessed)
    surface((u, v) => { const p0 = sec(u * Math.PI * 2, 0, 1), p1 = sec(u * Math.PI * 2, 0, 0.93); return [lerp(p0[0], p1[0], v), lerp(p0[1], p1[1], v), lerp(p0[2], p1[2], v) - 0.006 * Math.sin(v * Math.PI / 2)]; },
      56, 3, () => ({ part: door, mat: M.TRIM }), [1, 1], { id: 'mirrorLip' + sx, flip: sx < 0 });
    surface((u, v) => { const p0 = sec(u * Math.PI * 2, 0, 0.93), p1 = sec(u * Math.PI * 2, 0, 0.88); return [lerp(p0[0], p1[0], v), lerp(p0[1], p1[1], v), p0[2] - 0.006 + 0.004 * v]; },
      56, 2, () => ({ part: door, mat: M.CARBON }), [6, 1], { id: 'mirrorBezel' + sx, flip: sx < 0 });
    surface((u, v) => { const p = sec(u * Math.PI * 2, 0, 0.88 * (1 - v)); return [lerp(p[0], C[0], 0) , p[1], Z0m - 0.002 - 0.004 * v * v]; },
      56, 6, () => ({ part: door, mat: M.CHROME }), [1, 1], { id: 'mirrorGlass' + sx, flip: sx < 0 });
    // swan-neck blade: airfoil section swept along a bezier, wide foot blending into the door
    const F = [sx * 0.878, 0.742, 0.305], Hm = [sx * 1.045, C[1] - HH * 0.75, C[2] + 0.01];
    const B1 = [sx * 0.95, 0.80, 0.30], B2 = [sx * 1.02, C[1] - HH * 1.6, C[2] + 0.02];
    surface((u, v) => {
      const t = u, p = bez(F, B1, B2, Hm, t), q = bez(F, B1, B2, Hm, Math.min(1, t + 0.01)), q0 = bez(F, B1, B2, Hm, Math.max(0, t - 0.01));
      const T = norm(sub(q, q0)); let Z = [0, 0, 1]; Z = norm(sub(Z, scl(T, dot(Z, T)))); const X = cross(T, Z);
      const chord = lerp(0.12, 0.068, smooth(t * 1.6)), thick = lerp(0.042, 0.021, smooth(t * 1.8));
      const a = v * Math.PI * 2, cz = Math.cos(a), cx = Math.sin(a);
      // airfoil: round leading edge (front, +z), sharp trailing edge (rear)
      const zz = cz * chord / 2, xx = cx * thick / 2 * (cz > 0 ? 1 : 0.3 + 0.7 * Math.sqrt(Math.max(0, 1 + cz)));
      return add(add(p, scl(Z, zz - chord * 0.08)), scl(X, xx));
    }, 34, 20, (u) => ({ part: door, mat: u < 0.22 ? M.PAINT : M.CARBON }), [1, 3], { id: 'mirrorArm' + sx, flip: sx > 0 });
  }
  // ---- interior
  // floor, firewall, rear bulkhead, tunnel, sills
  box(interior, [0, 0.30, -0.10], [0.86, 0.01, 1.0], M.CARPET);
  box(interior, [0, 0.52, 0.93], [0.80, 0.22, 0.02], M.DASH);
  box(interior, [0, 0.54, -1.07], [0.80, 0.245, 0.02], M.ALCANTARA);      // rear bulkhead: stays below the deck line
  blob(interior, [0, 0.40, -0.05], [0.13, 0.10, 0.9], 0.25, M.CARBON);
  for (const sx of [-0.86, 0.86]) box(interior, [sx, 0.42, -0.1], [0.04, 0.12, 0.62], M.CARBON);
  // dashboard: sculpted leather top, hooded driver binnacle, floating centre display, turbine vents
  {
    const prof = [[0.90, 0.60], [0.80, 0.80], [0.62, 0.865], [0.46, 0.875], [0.37, 0.855], [0.33, 0.80], [0.33, 0.72], [0.37, 0.62], [0.43, 0.50]];
    const pr = v => { const f = v * (prof.length - 1), k = Math.min(prof.length - 2, Math.floor(f)), w = f - k, t = smooth(w);
      return [lerp(prof[k][0], prof[k + 1][0], t), lerp(prof[k][1], prof[k + 1][1], t)]; };
    const hoodAt = x => Math.exp(-Math.pow((x + 0.40) / 0.19, 4));             // driver binnacle brow
    const dash = (u, v) => {
      const x = lerp(-0.78, 0.78, u), zy = pr(v), h = hoodAt(x), wave = 0.012 * Math.cos(x * 4.2);
      const top = smooth((v - 0.15) / 0.3) * (1 - smooth((v - 0.62) / 0.15));
      return [x, zy[1] + h * 0.055 * top + wave * top, zy[0] - h * 0.07 * smooth((v - 0.3) / 0.3) - 0.03 * Math.cos(x * 1.9)];
    };
    surface((u, v) => { const p = dash(u, lerp(0.575, 0.585, v)); return [p[0], p[1], p[2] - 0.003]; }, Math.round(80 * q), 1, () => ({ part: interior, mat: M.INEON }), [1, 1], { id: 'dashline' });
    surface(dash, Math.round(80 * q), Math.round(28 * q), (u, v) => {
      return { part: interior, mat: v < 0.5 ? M.LEATHER : v < 0.75 ? M.ALCANTARA : M.CARBON };
    }, [8, 3], { id: 'dash' });
    // driver display inside the binnacle (uv.x 0..1 → instrument cluster in the shader)
    surface((u, v) => { const x = lerp(-0.60, -0.20, u); return [x, 0.878 + v * 0.072, 0.335 + 0.30 * (x + 0.40) * (x + 0.40) + v * 0.03]; }, 28, 6, () => ({ part: interior, mat: M.SCREEN }), [1, 1], { id: 'cluster' });
    surface((u, v) => { const x = lerp(-0.615, -0.185, u); return [x, 0.87 + v * 0.088, 0.342 + 0.30 * (x + 0.40) * (x + 0.40) + v * 0.03]; }, 28, 2, () => ({ part: interior, mat: M.CARBON }), [4, 1], { id: 'clusterBack' });
    surface((u, v) => { const x = lerp(-0.615, -0.185, u); return [x, 0.868 + v * 0.004, 0.33 + 0.30 * (x + 0.40) * (x + 0.40)]; }, 28, 1, () => ({ part: interior, mat: M.INEON }), [1, 1], { id: 'clusterLine' });
    // floating centre display (uv.x 2..3 → navigation map)
    surface((u, v) => [lerp(-0.07, 0.27, u), 0.745 + v * 0.11, 0.315 + v * 0.03], 16, 6, () => ({ part: interior, mat: M.SCREEN }), [1, 1], { id: 'centre', uvOff: [2, 0] });
    box(interior, [0.10, 0.80, 0.335], [0.18, 0.062, 0.008], M.TRIM, -0.27);
    tube(interior, [[0.10, 0.74, 0.35], [0.10, 0.70, 0.40]], 0.012, 8, M.ALU);
    // turbine vents
    for (const vx of [-0.74, -0.10, 0.36, 0.74]) {
      const mid = vx === -0.10 || vx === 0.36, vc = [vx, mid ? 0.69 : 0.76, mid ? 0.335 : 0.355];
      lathe(interior, vc, [[0, 0.045], [0.02, 0.045], [0.02, 0.038], [0.005, 0.038]], 24, M.ALU, 'z');
      lathe(interior, vc, [[0.012, 0.0], [0.012, 0.037]], 24, M.GRILLE, 'z');
      lathe(interior, vc, [[0.011, 0.0], [0.011, 0.012]], 16, M.CHROME, 'z');
    }
    lathe(interior, [-0.10, 0.62, 0.40], [[0, 0], [0, 0.02], [0.008, 0.02], [0.008, 0]], 16, M.ENGNEON, 'z');
  }
  // centre console rising to the dash, gear selector, start button
  blob(interior, [0, 0.52, 0.45], [0.12, 0.07, 0.25], 0.3, M.CARBON, -0.35);
  tube(interior, [[0, 0.52, 0.22], [0, 0.62, 0.20]], 0.012, 10, M.CHROME);
  blob(interior, [0, 0.64, 0.20], [0.03, 0.025, 0.035], 0.8, M.LEATHER);
  lathe(interior, [0.08, 0.56, 0.35], [[0, 0], [0, 0.018], [0.01, 0.018], [0.01, 0]], 14, M.ENGNEON, 'z');
  // seats: cushion, backrest, bolsters, headrest, accent stripe, harness
  for (const sx of [-0.40, 0.40]) {
    blob(interior, [sx, 0.40, -0.52], [0.25, 0.07, 0.25], 0.35, M.LEATHER, -0.05);
    for (const bx of [-0.21, 0.21]) blob(interior, [sx + bx, 0.47, -0.52], [0.05, 0.07, 0.24], 0.4, M.ALCANTARA, -0.05);
    blob(interior, [sx, 0.73, -0.79], [0.24, 0.32, 0.07], 0.35, M.LEATHER, -0.22);
    for (const bx of [-0.2, 0.2]) blob(interior, [sx + bx, 0.73, -0.75], [0.05, 0.28, 0.08], 0.4, M.ALCANTARA, -0.22, bx > 0 ? -0.35 : 0.35);
    blob(interior, [sx, 1.005, -0.845], [0.12, 0.075, 0.045], 0.4, M.LEATHER, -0.22);
    box(interior, [sx, 0.73, -0.718], [0.012, 0.27, 0.004], M.INEON, -0.22);
    for (const hx of [-0.08, 0.08]) tube(interior, [[sx + hx, 0.98, -0.83], [sx + hx * 0.5, 0.76, -0.71], [sx + hx * 0.2, 0.50, -0.62]], 0.012, 6, M.ALCANTARA);
  }
  // pedals and dead pedal
  for (const [px, w] of [[-0.52, 0.03], [-0.40, 0.05], [-0.30, 0.04]]) box(interior, [px, 0.40, 0.78], [w, 0.06, 0.01], M.ALU, 0.6);
  // roll hoop behind the seats
  for (const sx of [-0.40, 0.40]) {
    const hoop = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI * i / 20; hoop.push([sx + Math.cos(a) * 0.24, 0.78 + Math.sin(a) * 0.235, -0.985 - 0.02 * Math.sin(a)]); }
    tube(interior, hoop, 0.021, 12, M.CARBON);
    for (const fx of [-0.24, 0.24]) lathe(interior, [sx + fx, 0.76, -0.985], [[0, 0.03], [0.04, 0.03], [0.05, 0.022]], 14, M.ALU, 'y');
    surface((u, v) => { const a = Math.PI * (0.15 + 0.7 * u); return [sx + Math.cos(a) * 0.24, 0.78 + Math.sin(a) * 0.235, -0.985 - 0.02 * Math.sin(a) - 0.024 - v * 0.002]; }, 20, 1,
      () => ({ part: interior, mat: M.INEON }), [1, 1], { id: 'hoopL' + sx });
  }
  tube(interior, [[-0.64, 0.84, -1.01], [0.64, 0.84, -1.01]], 0.016, 10, M.ALU);
  // footwell / sill ambient neon
  for (const sx of [-0.83, 0.83]) box(interior, [sx, 0.32, -0.1], [0.004, 0.006, 0.6], M.INEON);
  // ---- steering wheel (own part: rotates with the steering) – built around its local z axis
  const sw = wheel;
  {
    // futuristic open-top yoke: horn → grip → flat carbon bottom → grip → horn, variable section
    const path = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = lerp(Math.PI * 0.80, Math.PI * 2.20, t);        // from upper-left horn round the bottom to upper-right
      const c = Math.cos(a), sn = Math.sin(a);
      const x = Math.sign(c) * Math.pow(Math.abs(c), 0.55) * 0.185, y = Math.sign(sn) * Math.pow(Math.abs(sn), 0.8) * 0.125 * (sn < 0 ? 0.92 : 1.0);
      path.push([x, y, 0.012 * (1 - Math.abs(c))]);
    }
    for (let i = 0; i < 60; i++) {
      const t = (i + 0.5) / 60, grip = Math.exp(-Math.pow((Math.abs(t - 0.5) - 0.30) / 0.09, 2));
      const r = 0.015 + 0.012 * grip, mat = grip > 0.45 ? M.ALCANTARA : (t < 0.04 || t > 0.96) ? M.INEON : M.CARBON;
      tube(sw, [path[i], path[i + 1]], r, 12, mat);
    }
    for (const e of [path[0], path[60]]) blob(sw, e, [0.013, 0.013, 0.013], 0.8, M.NEON);       // glowing horn tips
    // spokes into a carbon centre plate with a small display, rotary dials, buttons and a shift-light bar
    for (const sx of [-1, 1]) surface((u, v) => { const x = sx * lerp(0.05, 0.15, u), y = lerp(-0.028, 0.022, v) - 0.03 * u * u; return [x, y, 0.025 - 0.012 * u]; }, 10, 3, () => ({ part: sw, mat: M.CARBON }), [2, 1], { id: 'spk' + sx });
    blob(sw, [0, -0.005, 0.03], [0.065, 0.055, 0.018], 0.35, M.CARBON);
    surface((u, v) => [lerp(-0.042, 0.042, u), lerp(-0.026, 0.020, v), 0.011], 8, 4, () => ({ part: sw, mat: M.SCREEN }), [1, 1], { id: 'swdisp' });
    for (let k = 0; k < 9; k++) box(sw, [-0.04 + k * 0.01, 0.040, 0.016], [0.0035, 0.0025, 0.003], k < 3 ? M.NEON : k < 6 ? M.ENGNEON : M.TAIL);
    for (const [dx, dy] of [[-0.11, -0.035], [0.11, -0.035]]) {
      lathe(sw, [dx, dy, 0.012], [[0, 0.0], [0, 0.016], [0.012, 0.016], [0.012, 0]], 16, M.ALU, 'z');
      lathe(sw, [dx, dy, 0.011], [[0, 0.0], [0, 0.006]], 12, M.ENGNEON, 'z');
    }
    for (const [dx, dy, m] of [[-0.09, 0.012, M.NEON], [-0.12, 0.012, M.ENGNEON], [0.09, 0.012, M.ENGNEON], [0.12, 0.012, M.NEON]]) box(sw, [dx, dy, 0.012], [0.008, 0.006, 0.004], m);
    // big carbon shift paddles behind the grips
    for (const sx of [-1, 1]) surface((u, v) => { const a = lerp(-0.3, 0.9, u); return [sx * (0.12 + Math.cos(a) * 0.06), 0.02 + Math.sin(a) * 0.06, 0.045 + v * 0.006]; }, 10, 1, () => ({ part: sw, mat: M.CARBON }), [1, 1], { id: 'pad' + sx });
    tube(sw, [[0, 0, 0.06], [0, 0, 0.30]], 0.03, 12, M.DASH);       // column
  }
  // ---- engine bay + twin-turbo V8 hybrid (visible with the hood open)
  box(bay, [0, 0.30, 1.56], [0.86, 0.01, 0.58], M.TRIM);
  // bay walls follow the underside of the hood/fenders so nothing pokes through the bodywork
  const topAt = (z, X) => { for (let v = 0.5; v > 0; v -= 0.002) { const p = bodyPt(uOf(z), v); if (Math.abs(p[0]) >= X) return p[1]; } return 0.6; };
  for (const sx of [-1, 1]) surface((u, v) => { const z = lerp(0.99, 2.12, u); return [sx * 0.84, lerp(0.30, topAt(z, 0.84) - 0.04, v), z]; }, 16, 2, () => ({ part: bay, mat: M.TRIM }), [1, 1], { id: 'bay' + sx });
  surface((u, v) => { const x = lerp(-0.84, 0.84, u); return [x, lerp(0.30, topAt(0.99, Math.abs(x)) - 0.04, v), 0.99]; }, 16, 2, () => ({ part: bay, mat: M.TRIM }), [1, 1], { id: 'bayF' });
  box(bay, [0, 0.42, 2.10], [0.74, 0.11, 0.02], M.GRILLE);                 // radiator
  blob(engine, [0, 0.38, 1.52], [0.24, 0.08, 0.44], 0.2, M.ALU);              // block
  for (const sx of [-1, 1]) {
    blob(engine, [sx * 0.21, 0.47, 1.52], [0.11, 0.05, 0.40], 0.18, M.ALU, 0, 0, 10, 16);
    box(engine, [sx * 0.21, 0.515, 1.52], [0.07, 0.006, 0.36], M.ENGNEON, 0, 0, sx * 0.5);   // valve cover neon
    lathe(engine, [sx * 0.55, 0.42, 1.25], [[-0.07, 0.0], [-0.07, 0.08], [0.07, 0.10], [0.07, 0.0]], 18, M.ALU, 'x');   // turbo
    lathe(engine, [sx * 0.55, 0.42, 1.25], [[0.071, 0.0], [0.071, 0.06]], 18, M.ENGNEON, 'x');
    tube(engine, [[sx * 0.45, 0.43, 1.25], [sx * 0.30, 0.52, 1.30], [sx * 0.12, 0.56, 1.40]], 0.03, 10, M.CHROME);
  }
  // velocity-stack intake trumpets (vertical)
  const trumpet = (c) => {
    const prof = [[0, 0.028], [0.06, 0.028], [0.085, 0.045], [0.09, 0.045]];
    const fn = (u, v) => { const f = u * (prof.length - 1), k = Math.min(prof.length - 2, Math.floor(f)), w = f - k, a = lerp(prof[k][0], prof[k + 1][0], w), r = lerp(prof[k][1], prof[k + 1][1], w), t = v * Math.PI * 2; return [c[0] + Math.cos(t) * r, c[1] + a, c[2] + Math.sin(t) * r]; };
    surface(fn, 6, 14, () => ({ part: engine, mat: M.CHROME }), [1, 1], { id: 'tr' + c.join() });
    surface((u, v) => { const t = v * Math.PI * 2, r = 0.046; return [c[0] + Math.cos(t) * r, c[1] + 0.09 + u * 0.004, c[2] + Math.sin(t) * r]; }, 1, 14, () => ({ part: engine, mat: M.ENGNEON }), [1, 1], { id: 'trn' + c.join() });
  };
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) trumpet([sx * 0.08, 0.52, 1.27 + i * 0.16]);
  box(engine, [0, 0.53, 1.52], [0.05, 0.025, 0.34], M.CARBON);                 // plenum spine
  box(engine, [0.52, 0.40, 1.80], [0.14, 0.07, 0.14], M.ENGNEON);              // hybrid e-motor pack
  box(engine, [-0.55, 0.38, 1.85], [0.12, 0.07, 0.10], M.TRIM);                // battery
  // ---- wheels: 4 spinning wheels (tyre, rim, disc) + 4 calipers that only steer
  const wheels = {};
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const hub = RIG.wheels[key], out = hub[0] > 0 ? 1 : -1;
    const W = P('wheel' + key, hub), C = P('caliper' + key, hub);
    const X = a => a * out;              // local x: outward positive
    const seg = Math.round(64 * q);
    // tyre (tread via uv in the shader)
    lathe(W, [0, 0, 0], [[X(-0.15), 0.245], [X(-0.155), 0.30], [X(-0.14), 0.348], [X(-0.11), 0.365], [X(0.0), 0.367], [X(0.11), 0.365], [X(0.14), 0.348], [X(0.155), 0.30], [X(0.15), 0.245]], seg, M.TIRE, 'x', 40);
    // rim barrel + lip
    lathe(W, [0, 0, 0], [[X(-0.13), 0.235], [X(0.11), 0.235], [X(0.13), 0.245], [X(0.135), 0.235]], seg, M.CHROME, 'x', 1);
    lathe(W, [0, 0, 0], [[X(0.136), 0.226], [X(0.136), 0.236]], seg, M.NEON, 'x', 1);
    // 10 twisted spokes
    for (let s = 0; s < 10; s++) {
      const a = s / 10 * Math.PI * 2;
      const sp = (u, v) => {
        const r = lerp(0.06, 0.228, u), tw = 0.18 * u, w = lerp(0.028, 0.018, u), aa = a + tw + (v - 0.5) * w / r * 2;
        const xo = X(lerp(0.112, 0.126, u * u) + 0.012 * Math.sin(v * Math.PI));
        return [xo, Math.cos(aa) * r, Math.sin(aa) * r];
      };
      surface(sp, 8, 4, () => ({ part: W, mat: M.CHROME }), [1, 1], { id: 'spk' + key + s });
      surface((u, v) => { const p = sp(u, v); return [p[0] - X(0.02), p[1], p[2]]; }, 8, 2, () => ({ part: W, mat: M.TRIM }), [1, 1], { id: 'spkb' + key + s });
    }
    lathe(W, [0, 0, 0], [[X(0.12), 0], [X(0.13), 0.06], [X(0.12), 0.07]], 24, M.CHROME, 'x');
    lathe(W, [X(0.131), 0, 0], [[0, 0.035], [0, 0.045]], 24, M.NEON, 'x');
    for (let n = 0; n < 5; n++) { const a = n / 5 * Math.PI * 2; lathe(W, [X(0.13), Math.cos(a) * 0.045, Math.sin(a) * 0.045], [[0, 0], [0, 0.009], [X(0.012), 0.009], [X(0.012), 0]], 8, M.ALU, 'x'); }
    // drilled brake disc
    lathe(W, [0, 0, 0], [[X(0.03), 0.08], [X(0.03), 0.19], [X(0.0), 0.19], [X(0.0), 0.08]], seg, M.DISC, 'x', 1);
    // caliper (only steers) at the rear-top of the disc
    blob(C, [X(0.035), 0.10, -0.10], [0.03, 0.09, 0.07], 0.25, M.CALIPER, 0.75, 0, 10, 12);
    box(C, [X(0.066), 0.10, -0.10], [0.002, 0.05, 0.02], M.NEON, 0.75);
    wheels[key] = { wheel: W, caliper: C };
  }
  // ---- KAGE R4-H: quad-rotor Wankel 2.6 L (4 × 654 cc) running on hydrogen, hybrid
  {
    const R0 = 0.135, E = 0.022;                      // generating radius / eccentricity of the epitrochoid housing
    const troch = (t, g) => [(E * Math.cos(3 * t) + R0 * Math.cos(t)) * g, (E * Math.sin(3 * t) + R0 * Math.sin(t)) * g * 0.86];
    for (let i = 0; i < 4; i++) {
      const z0 = 1.22 + i * 0.125, cy = 0.44;
      // housing: extruded epitrochoid (axis along z), long axis vertical
      surface((u, v) => { const [a, b] = troch(u * Math.PI * 2, 1); return [b, cy + a * 0.92, z0 + v * 0.095]; }, 64, 4, () => ({ part: engineW, mat: M.ALU }), [8, 1], { id: 'rotH' + i });
      for (const zc of [z0, z0 + 0.095]) surface((u, v) => { const [a, b] = troch(u * Math.PI * 2, 1 - v); return [b, cy + a * 0.92, zc]; }, 64, 2, () => ({ part: engineW, mat: M.ALU }), [1, 1], { id: 'rotF' + i + zc });
      // glowing side plate between rotors + spark plug pairs
      surface((u, v) => { const [a, b] = troch(u * Math.PI * 2, 1.04); return [b, cy + a * 0.92, z0 + 0.1 + v * 0.02]; }, 64, 1, () => ({ part: engineW, mat: M.ENGNEON }), [1, 1], { id: 'rotP' + i });
      for (const sx of [-1, 1]) tube(engineW, [[sx * 0.10, cy + 0.06, z0 + 0.047], [sx * 0.17, cy + 0.09, z0 + 0.047]], 0.009, 8, M.CHROME);
    }
    // eccentric shaft nose, flywheel / e-motor
    lathe(engineW, [0, 0.44, 1.16], [[0, 0.03], [0.06, 0.03]], 20, M.CHROME, 'z');
    lathe(engineW, [0, 0.44, 1.02], [[0, 0.0], [0, 0.15], [0.12, 0.15], [0.12, 0.0]], 40, M.CARBON, 'z');
    lathe(engineW, [0, 0.44, 1.141], [[0, 0.11], [0, 0.15]], 40, M.ENGNEON, 'z');
    // twin carbon-wrapped hydrogen tanks (700 bar) with glowing bands
    for (const sx of [-1, 1]) {
      lathe(engineW, [sx * 0.55, 0.46, 1.10], [[0, 0.0], [0.04, 0.09], [0.12, 0.115], [0.78, 0.115], [0.86, 0.09], [0.90, 0.0]], 36, M.CARBON, 'z', 8);
      for (const zb of [1.30, 1.55, 1.80]) lathe(engineW, [sx * 0.55, 0.46, zb], [[0, 0.117], [0.02, 0.117]], 36, M.ENGNEON, 'z');
      tube(engineW, [[sx * 0.55, 0.46, 2.0], [sx * 0.40, 0.56, 2.02], [sx * 0.15, 0.58, 1.70]], 0.012, 8, M.CHROME);      // H2 line
      tube(engineW, [[sx * 0.16, 0.50, 1.30 + 0.12], [sx * 0.30, 0.56, 1.45], [sx * 0.33, 0.52, 1.75]], 0.028, 10, M.CARBON);  // intake runner
    }
    box(engineW, [0, 0.60, 1.42], [0.06, 0.02, 0.26], M.CARBON);
    box(engineW, [0, 0.623, 1.42], [0.04, 0.004, 0.22], M.ENGNEON);
  }
  // ---- LEVITA: electromagnetic drive (no combustion, no exhaust): flux core + capacitor banks
  {
    lathe(engineE, [0, 0.45, 1.55], [[-0.30, 0.0], [-0.30, 0.16], [-0.26, 0.19], [0.26, 0.19], [0.30, 0.16], [0.30, 0.0]], 48, M.CARBON, 'z', 4);
    for (let i = 0; i < 9; i++) lathe(engineE, [0, 0.45, 1.31 + i * 0.06], [[0, 0.192], [0.02, 0.192], [0.02, 0.2], [0, 0.2]], 48, i % 2 ? M.ALU : M.ENGNEON, 'z');
    lathe(engineE, [0, 0.45, 1.86], [[0, 0.0], [0, 0.13], [0.012, 0.13], [0.012, 0.0]], 40, M.ENGNEON, 'z');
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      box(engineE, [sx * 0.55, 0.40, 1.20 + i * 0.30], [0.13, 0.08, 0.12], M.TRIM);
      box(engineE, [sx * 0.55, 0.485, 1.20 + i * 0.30], [0.11, 0.004, 0.10], M.INEON);
      tube(engineE, [[sx * 0.42, 0.42, 1.20 + i * 0.30], [sx * 0.30, 0.50, 1.30 + i * 0.22], [sx * 0.18, 0.50, 1.40 + i * 0.15]], 0.014, 8, M.ENGNEON);
    }
  }
  // ---- levitation spheres + arch emitters + ground field rings
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const hub = RIG.wheels[key], Sp = P('sphere' + key, hub), r = RIG.sphere.r;
    const sph = (u, v, rr) => { const th = (u - 0.5) * Math.PI, ph = v * Math.PI * 2; return [Math.sin(th) * rr, Math.cos(th) * Math.cos(ph) * rr, Math.cos(th) * Math.sin(ph) * rr]; };
    surface((u, v) => sph(u, v, r), 48, 72, (u, v) => {
      const lat = Math.abs(u - 0.5);
      if (lat < 0.012) return { part: Sp, mat: M.NEON, offset: 0.002 };                    // equator light
      if (Math.abs(lat - 0.16) < 0.008 || Math.abs(lat - 0.30) < 0.006) return { part: Sp, mat: M.ENGNEON, offset: 0.001 };
      const groove = Math.abs(((v * 24) % 1) - 0.5) < 0.06 && lat < 0.36;
      return { part: Sp, mat: groove ? M.TRIM : M.TIRE };
    }, [24, 6], { id: 'sph' + key });
    const out = hub[0] > 0 ? 1 : -1;
    surface((u, v) => { const p = sph(0.5 + out * (0.42 + v * 0.08), u, r * 1.002); return p; }, 40, 3, () => ({ part: Sp, mat: M.CHROME }), [1, 1], { id: 'sphc' + key });
    // emitter ribbon along the top of the arch + glowing field ring on the ground
    const [W] = station(hub[2]);
    surface((u, v) => { const a = Math.PI * (0.2 + 0.6 * u), R = ARCH_R - 0.035; return [out * lerp(W * 0.70, W * 0.93, v), Math.min(station(hub[2] + Math.cos(a) * R)[2] - 0.08, 0.36 + Math.sin(a) * R), hub[2] + Math.cos(a) * R]; },
      32, 2, (u) => ({ part: magPads, mat: Math.floor(u * 12) % 2 ? M.ENGNEON : M.TRIM }), [1, 1], { id: 'mag' + key });
    surface((u, v) => { const a = u * Math.PI * 2, rr = lerp(0.20, 0.27, v); return [hub[0] + Math.cos(a) * rr * 0.55, 0.012, hub[2] + Math.sin(a) * rr]; }, 48, 1, () => ({ part: magRings, mat: M.NEON }), [1, 1], { id: 'magR' + key });
  }
  // ---- KAGE CHRONO: chrono core between the seat backs — glass column, aluminium caps, 3 counter-rotating rings
  {
    const C = RIG.chrono.center, core = P('chrono'), rings = [P('chronoR1', C), P('chronoR2', C), P('chronoR3', C)];
    lathe(core, [C[0], C[1] - 0.19, C[2]], [[0, 0.0], [0, 0.10], [0.03, 0.105], [0.05, 0.08]], 32, M.ALU, 'y');
    lathe(core, [C[0], C[1] + 0.14, C[2]], [[0, 0.08], [0.03, 0.105], [0.05, 0.10], [0.05, 0.0]], 32, M.ALU, 'y');
    lathe(core, [C[0], C[1] - 0.14, C[2]], [[0, 0.075], [0.28, 0.075]], 32, M.GLASS, 'y');
    lathe(core, [C[0], C[1] - 0.10, C[2]], [[0, 0.012], [0.20, 0.012]], 16, M.NEON, 'y');
    for (const sx of [-1, 1]) tube(core, [[C[0] + sx * 0.05, C[1] + 0.17, C[2] - 0.03], [C[0] + sx * 0.10, C[1] + 0.05, C[2] - 0.07], [C[0] + sx * 0.11, 0.42, C[2] - 0.07]], 0.010, 8, M.INEON);
    const ring = (Pr, r, w, mat) => surface((u, v) => { const a = u * Math.PI * 2, b = v * Math.PI * 2, Rr = r + Math.cos(b) * w; return [Math.cos(a) * Rr, Math.sin(b) * w * 1.6, Math.sin(a) * Rr]; }, 48, 8, () => ({ part: Pr, mat }), [8, 1], { id: 'ring' + Pr.name });
    // built around the origin; the renderer places them at the core centre with their own spin
    ring(rings[0], 0.060, 0.006, M.ENGNEON); ring(rings[1], 0.050, 0.005, M.CHROME); ring(rings[2], 0.040, 0.005, M.NEON);
  }
  // ---- orient every quad for exporters (two-sided anyway in our shaders) and pack
  const list = Object.values(parts).filter(p => p.pos.length);
  let tris = 0, verts = 0;
  for (const p of list) { tris += (p.idx.length + p.gidx.length) / 3; verts += p.pos.length / 3; }
  return { parts: list, rig: RIG, stats: { tris, verts, parts: list.length } };
}

/* ---------------------------------------------------------------- performance sheet (fictional, consistent with the game physics) */
const SPECS = {
  name: 'AMPY KAGE GT',
  engine: 'V8 4.0 L biturbo ibrido · motore elettrico assiale anteriore',
  power: '780 CV termici + 220 CV elettrici = 1000 CV (735 kW) a 8.200 giri/min',
  torque: '1.150 Nm combinati (800 Nm a 3.200–6.500 giri/min)',
  redline: '9.000 giri/min',
  gearbox: 'Doppia frizione 8 rapporti · trazione integrale e-AWD con torque vectoring',
  accel: '0–100 km/h 2,4 s · 0–200 km/h 6,9 s · 0–300 km/h 17,8 s',
  vmax: '345 km/h (con N₂O) · 260 km/h senza boost',
  braking: '100–0 km/h in 29 m · dischi carboceramici 410/390 mm',
  weight: '1.420 kg · rapporto peso/potenza 1,42 kg/CV',
  aero: 'Deportanza 520 kg a 250 km/h · ala posteriore attiva',
  dims: 'L 4.70 m · L 2.06 m · H 1.24 m · passo 2.87 m',
  tyres: '265/30 R21 ant. · 325/25 R22 post.',
  battery: '6,2 kWh · boost elettrico 18 s · ricarica in frenata'
};

const SPECS_BY = {
  v8: SPECS,
  wankel: Object.assign({}, SPECS, {
    name: 'AMPY KAGE GT R4-H',
    engine: 'Wankel quadrirotore 2.616 cc (4 × 654 cc) a idrogeno · ibrido con motore elettrico assiale',
    power: '860 CV a idrogeno + 260 CV elettrici = 1120 CV (824 kW) a 10.200 giri/min',
    torque: '1.020 Nm combinati (rotori 640 Nm a 7.800 giri/min + coppia istantanea elettrica)',
    redline: '10.500 giri/min',
    accel: '0–100 km/h 2,3 s · 0–200 km/h 6,5 s · 0–300 km/h 16,4 s',
    vmax: '352 km/h (con N₂O) · 268 km/h senza boost',
    weight: '1.390 kg · serbatoi H₂ a 700 bar in fibra di carbonio (6,4 kg)',
    battery: '5,0 kWh · allo scarico solo vapore acqueo'
  }),
  mag: Object.assign({}, SPECS, {
    name: 'AMPY KAGE GT LEVITA',
    engine: 'Propulsione elettromagnetica · 4 sfere a levitazione con motori a flusso assiale integrati',
    power: '4 × 320 kW = 1280 kW (1740 CV) · nessuno scarico',
    torque: '2.400 Nm istantanei · vettorializzazione su 360° (le sfere rotolano in ogni direzione)',
    redline: '22.000 giri/min (motori-sfera)',
    gearbox: 'Presa diretta · controllo di campo per ogni sfera',
    accel: '0–100 km/h 1,8 s · 0–200 km/h 5,2 s · 0–300 km/h 12,9 s',
    vmax: '380 km/h (boost di campo) · 290 km/h di serie',
    weight: '1.480 kg · altezza di levitazione 4 cm',
    tyres: 'Sfere Ø 670 mm con battistrada in elastomero a grafene',
    battery: '28 kWh a stato solido · ronzio elettrostatico di serie'
  })
};
const POWER = { v8: 'V8 BITURBO IBRIDO', wankel: 'WANKEL 4 ROTORI H₂', mag: 'LEVITA ELETTRICA' };
const api = { build, M, MAT_NAMES, RIG, SPECS, SPECS_BY, POWER, bodyPt, station, roofPhases, cabinPt };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.CarHD = api;
})(typeof window !== 'undefined' ? window : globalThis);
