/* AMPY KAGE GT — high-detail procedural model (original design, same lines as the game car).
 * One generator for everything: browser (game + showroom), node (tools/build_car.js → Android asset + OBJ export).
 * Units: metres, +Y up, +Z front, car centred on the origin, wheels on y = 0.
 * Every part has a pivot so the renderer can animate it (hood, butterfly doors, steering wheels, wheel spin, steering wheel). */
(function (root) {
'use strict';
const M = { PAINT: 0, CARBON: 1, TRIM: 2, CHROME: 3, GLASS: 4, HEAD: 5, TAIL: 6, NEON: 7, TIRE: 8, DISC: 9, CALIPER: 10,
  LEATHER: 11, ALCANTARA: 12, DASH: 13, SCREEN: 14, ALU: 15, ENGNEON: 16, INEON: 17, GRILLE: 18, CARPET: 19 };
const MAT_NAMES = ['paint', 'carbon', 'trim_black', 'chrome', 'glass', 'headlight', 'taillight', 'neon', 'tyre', 'brake_disc', 'caliper',
  'leather', 'alcantara', 'dashboard', 'screen', 'aluminium', 'engine_neon', 'interior_neon', 'grille', 'carpet'];

/* hinge / hub positions shared with the renderers */
const RIG = {
  hood: { pivot: [0, 0.80, 0.96], axis: 'x', open: -0.95 },
  doorL: { pivot: [-0.98, 0.50, 0.40], open: 1.05, out: 0.22 },
  doorR: { pivot: [0.98, 0.50, 0.40], open: 1.05, out: -0.22 },
  wheels: { FL: [-0.92, 0.36, 1.42], FR: [0.92, 0.36, 1.42], RL: [-0.92, 0.36, -1.45], RR: [0.92, 0.36, -1.45] },
  wheelRadius: 0.365,
  steering: { pivot: [-0.40, 0.84, 0.10], tilt: 0.47 },    // column tilt about x (rad)
  driverEye: [-0.40, 1.02, -0.36]
};

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
    grid.push({ p, n, uv: [u * (uvs ? uvs[0] : 1), v * (uvs ? uvs[1] : 1)] });
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
    return axis === 'z' ? [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, c[2] + a] : [c[0] + a, c[1] + Math.cos(t) * r, c[2] + Math.sin(t) * r];
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
    y = yb + (Ys - yb) * k;
  } else {
    const k = (vv - 0.45) / 0.55, ph = k * Math.PI / 2;
    x = side * W * Math.pow(Math.cos(ph), 0.55);
    y = Ys + (Yt - Ys) * Math.pow(Math.sin(ph), 0.75);
  }
  return [x, y, z];
}
const zOf = u => lerp(Z0, Z1, u);
const uOf = z => (z - Z0) / (Z1 - Z0);

// cabin / greenhouse
const CB = [[-1.30, 0.88], [-0.95, 1.16], [-0.40, 1.235], [0.15, 1.235], [0.55, 1.10], [0.98, 0.84]];
const CZ0 = -1.30, CZ1 = 0.98;
function roofY(z) {
  let k = 0; while (k < CB.length - 2 && z > CB[k + 1][0]) k++;
  const a = CB[k], b = CB[k + 1], t = smooth((z - a[0]) / (b[0] - a[0]));
  return lerp(a[1], b[1], t);
}
function cabinPt(u, v) {
  const z = lerp(CZ0, CZ1, u);
  const side = v < 0.5 ? -1 : 1, vv = v < 0.5 ? v * 2 : (1 - v) * 2;
  const [W] = station(z);
  const Wb = W * 0.88, Wr = 0.62 + 0.04 * Math.sin(u * Math.PI), yb = 0.86, Yr = Math.max(yb + 0.01, roofY(z));
  let x, y;
  if (vv < 0.6) { const k = vv / 0.6; x = side * lerp(Wb, Wr, Math.pow(k, 0.9)); y = lerp(yb, Yr - 0.05, k); }
  else { const k = (vv - 0.6) / 0.4; x = side * Wr * (1 - k); y = Yr - 0.05 + 0.05 * Math.sin(k * Math.PI / 2); }
  return [x, y, z];
}

/* ---------------------------------------------------------------- build */
function build(opt) {
  opt = opt || {};
  const q = opt.quality === 'low' ? 0.5 : 1;
  const parts = {};
  const P = (name, pivot) => (parts[name] = parts[name] || Part(name, pivot));
  const body = P('body'), hood = P('hood', RIG.hood.pivot), doorL = P('doorL', RIG.doorL.pivot), doorR = P('doorR', RIG.doorR.pivot);
  const interior = P('interior'), engine = P('engine'), wheel = P('steeringWheel', RIG.steering.pivot);
  const NU = Math.round(110 * q), NV = Math.round(72 * q);
  const DZ0 = -0.62, DZ1 = 0.40;                         // door cut
  const HZ0 = 0.96, HZ1 = 2.16;                           // hood cut
  const inDoor = (z, vv) => z > DZ0 && z < DZ1 && vv > 0.07 && vv < 0.72;
  const inHood = (z, vv) => z > HZ0 && z < HZ1 && vv > 0.80;
  const inCabin = (u, v) => {
    const p = bodyPt(u, v), z = p[2];
    if (z < CZ0 + 0.03 || z > CZ1 - 0.03) return false;
    return Math.abs(p[0]) < station(z)[0] * 0.88 - 0.015 && p[1] > 0.78;
  };
  // ---- main body loft, cut into body / doors / hood
  surface(bodyPt, NU, NV, (u, v) => {
    const z = zOf(u), vv = v < 0.5 ? v * 2 : (1 - v) * 2, left = v < 0.5;
    // side skirt carbon strip
    const mat = vv < 0.09 ? M.CARBON : M.PAINT;
    if (inDoor(z, vv)) return { part: left ? doorL : doorR, mat };
    if (inHood(z, vv)) return { part: hood, mat: M.PAINT };
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
    return null;
  }, [5, 3], { id: 'inner' });
  // panel gaps: thin dark frames around the door and hood cuts (slightly proud of the surface)
  const seam = (z, vv, cut0, cut1, v0, v1) => {
    const du = 0.008, dv = 0.006;
    return (Math.abs(z - cut0) < du || Math.abs(z - cut1) < du) && vv > v0 && vv < v1 || (z > cut0 && z < cut1 && (Math.abs(vv - v0) < dv || Math.abs(vv - v1) < dv));
  };
  surface(bodyPt, NU * 3, NV * 3, (u, v) => {
    const z = zOf(u), vv = v < 0.5 ? v * 2 : (1 - v) * 2;
    if (seam(z, vv, DZ0, DZ1, 0.07, 0.72) || seam(z, vv, HZ0, HZ1, 0.80, 1.01)) return { part: body, mat: M.TRIM, offset: 0.002 };
    return null;
  }, [1, 1], { id: 'seam' });
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
    if (z > 2.24 && z < 2.31 && vv > 0.60 && vv < 0.84) return { part: body, mat: M.HEAD, offset: 0.004 };
    if (z > 2.31 && z < 2.345 && vv > 0.40 && vv < 0.6) return { part: body, mat: M.NEON, offset: 0.004 };   // DRL hook
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
  for (const ax of AXLES) for (const sx of [-1, 1]) {
    const W = station(ax)[0];
    const Ys = station(ax)[2];
    surface((u, v) => { const a = Math.PI * u; return [sx * lerp(W * 0.6, W * 0.95, v), Math.min(Ys - 0.07, 0.36 + Math.sin(a) * ARCH_R), ax + Math.cos(a) * ARCH_R]; }, 24, 3,
      () => ({ part: body, mat: M.TRIM }), [1, 1], { id: 'arch' + ax + sx });
  }
  // ---- greenhouse: glass + carbon roof + pillars; side windows belong to the doors
  surface(cabinPt, Math.round(70 * q), Math.round(48 * q), (u, v) => {
    const z = lerp(CZ0, CZ1, u), vv = v < 0.5 ? v * 2 : (1 - v) * 2, left = v < 0.5;
    if (vv > 0.62 && z > -1.0 && z < 0.32) return { part: body, mat: M.CARBON };
    if (z > 0.30 && z < 0.40) return { part: body, mat: M.TRIM };                  // A pillar
    if (z < -0.95 && vv < 0.62) return { part: body, mat: M.PAINT };                // fastback C pillars
    if (z > -0.66 && z < -0.58 && vv < 0.62) return { part: body, mat: M.TRIM };   // B pillar
    if (z > -0.58 && z < 0.30 && vv < 0.62) return { part: left ? doorL : doorR, mat: M.GLASS };
    return { part: body, mat: M.GLASS };
  }, [3, 3], { id: 'cabin' });
  // ---- spoiler (airfoil) with endplates and neon edge
  const foil = (u, v) => { const x = lerp(-0.92, 0.92, u), a = v * Math.PI * 2, c = 0.34; return [x, 1.10 + Math.sin(a) * 0.03 * (Math.cos(a) > 0 ? 1 : 0.5), -2.06 + Math.cos(a) * c / 2]; };
  surface(foil, 30, 16, () => ({ part: body, mat: M.CARBON }), [6, 1], { id: 'wing' });
  surface((u, v) => { const p = foil(u, 0.5); return [p[0], 1.105 + v * 0.012, -2.23]; }, 30, 1, () => ({ part: body, mat: M.NEON }), [1, 1], { id: 'wingneon' });
  for (const sx of [-0.94, 0.94]) box(body, [sx, 1.08, -2.06], [0.012, 0.09, 0.2], M.CARBON);
  for (const sx of [-0.55, 0.55]) box(body, [sx, 0.98, -2.0], [0.02, 0.12, 0.05], M.TRIM, 0.25);
  // ---- splitter, diffuser, exhausts, side mirrors
  box(body, [0, 0.235, 2.30], [0.78, 0.012, 0.14], M.CARBON);
  box(body, [0, 0.235, 2.445], [0.78, 0.012, 0.006], M.NEON);
  for (let i = -2; i <= 2; i++) box(body, [i * 0.18, 0.29, -2.12], [0.008, 0.06, 0.2], M.TRIM, -0.2);
  for (const ex of [-0.38, -0.22, 0.22, 0.38]) {
    lathe(body, [ex, 0.33, -2.38], [[0, 0.052], [0.12, 0.052], [0.12, 0.044], [0.0, 0.044]], 20, M.CHROME, 'z');
    lathe(body, [ex, 0.33, -2.35], [[0, 0.0], [0, 0.044]], 20, M.ENGNEON, 'z');
  }
  for (const [door, sx] of [[doorL, -1], [doorR, 1]]) {
    blob(door, [sx * 1.04, 0.95, 0.30], [0.09, 0.05, 0.11], 0.6, M.PAINT, 0, 0, 10, 14);
    box(door, [sx * 1.00, 0.92, 0.32], [0.04, 0.012, 0.02], M.TRIM);
    box(door, [sx * 1.115, 0.95, 0.27], [0.004, 0.04, 0.08], M.CHROME);   // mirror glass
  }
  // ---- interior
  // floor, firewall, rear bulkhead, tunnel, sills
  box(interior, [0, 0.30, -0.10], [0.86, 0.01, 1.0], M.CARPET);
  box(interior, [0, 0.55, 0.93], [0.88, 0.25, 0.02], M.DASH);
  box(interior, [0, 0.62, -1.07], [0.88, 0.32, 0.02], M.ALCANTARA);
  blob(interior, [0, 0.40, -0.05], [0.13, 0.10, 0.9], 0.25, M.CARBON);
  for (const sx of [-0.86, 0.86]) box(interior, [sx, 0.42, -0.1], [0.04, 0.12, 0.62], M.CARBON);
  // dashboard: lofted wave across the cabin, screen, vents, binnacle
  surface((u, v) => {
    const x = lerp(-0.9, 0.9, u), a = v * Math.PI;
    const z = 0.62 + Math.cos(a) * 0.28 - 0.04 * Math.cos(x * 3);
    const y = 0.64 + Math.sin(a) * 0.25 + 0.015 * Math.sin(x * 6);
    return [x, y, z];
  }, Math.round(60 * q), Math.round(16 * q), (u, v) => ({ part: interior, mat: v > 0.45 && v < 0.55 ? M.INEON : M.DASH }), [6, 2], { id: 'dash' });
  // wide curved screen in front of the driver and centre
  surface((u, v) => { const x = lerp(-0.78, 0.22, u); return [x, 0.80 + v * 0.09, 0.36 + 0.03 * (x + 0.28) * (x + 0.28) + v * 0.035]; }, 30, 6, () => ({ part: interior, mat: M.SCREEN }), [1, 1], { id: 'screen' });
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
    blob(interior, [sx, 1.08, -0.87], [0.13, 0.09, 0.05], 0.4, M.LEATHER, -0.22);
    box(interior, [sx, 0.73, -0.718], [0.012, 0.27, 0.004], M.INEON, -0.22);
    for (const hx of [-0.08, 0.08]) tube(interior, [[sx + hx, 0.98, -0.83], [sx + hx * 0.5, 0.76, -0.71], [sx + hx * 0.2, 0.50, -0.62]], 0.012, 6, M.CALIPER);
  }
  // pedals and dead pedal
  for (const [px, w] of [[-0.52, 0.03], [-0.40, 0.05], [-0.30, 0.04]]) box(interior, [px, 0.40, 0.78], [w, 0.06, 0.01], M.ALU, 0.6);
  // roll hoop behind the seats
  tube(interior, [[-0.80, 0.30, -1.02], [-0.78, 1.0, -1.02], [-0.6, 1.15, -1.02], [0.6, 1.15, -1.02], [0.78, 1.0, -1.02], [0.80, 0.30, -1.02]], 0.022, 10, M.CALIPER);
  tube(interior, [[-0.6, 1.15, -1.02], [0.75, 0.35, -1.05]], 0.018, 8, M.CALIPER);
  // footwell / sill ambient neon
  for (const sx of [-0.83, 0.83]) box(interior, [sx, 0.32, -0.1], [0.004, 0.006, 0.6], M.INEON);
  // ---- steering wheel (own part: rotates with the steering) – built around its local z axis
  const sw = wheel;
  {
    const R = 0.17, r = 0.022, seg = 48;
    const ring = [];
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; ring.push([Math.cos(a) * R * 1.05, Math.sin(a) * R * (Math.sin(a) < 0 ? 0.88 : 1), 0]); }
    // flat-bottom yoke-ish rim
    for (let i = 0; i < seg; i++) tube(sw, [ring[i], ring[i + 1]], r, 8, (i > seg * 0.2 && i < seg * 0.3) ? M.INEON : M.ALCANTARA);
    for (const a of [Math.PI, 0, -Math.PI / 2]) tube(sw, [[0, 0, 0.02], [Math.cos(a) * R, Math.sin(a) * R * 0.9, 0]], 0.014, 8, M.CARBON);
    lathe(sw, [0, 0, 0.03], [[0, 0], [0, 0.055], [0.02, 0.05], [0.02, 0]], 24, M.CARBON, 'z');
    lathe(sw, [0, 0, 0.051], [[0, 0.03], [0, 0.036]], 24, M.INEON, 'z');
    box(sw, [0.20, 0.03, 0.02], [0.012, 0.05, 0.004], M.ALU);       // shift paddles
    box(sw, [-0.20, 0.03, 0.02], [0.012, 0.05, 0.004], M.ALU);
    tube(sw, [[0, 0, 0.06], [0, 0, 0.30]], 0.03, 12, M.DASH);       // column
  }
  // ---- engine bay + twin-turbo V8 hybrid (visible with the hood open)
  box(engine, [0, 0.30, 1.56], [0.86, 0.01, 0.58], M.TRIM);
  for (const sx of [-0.86, 0.86]) box(engine, [sx, 0.52, 1.56], [0.01, 0.22, 0.58], M.TRIM);
  box(engine, [0, 0.52, 0.99], [0.86, 0.22, 0.01], M.TRIM);
  box(engine, [0, 0.42, 2.10], [0.74, 0.11, 0.02], M.GRILLE);                 // radiator
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

const api = { build, M, MAT_NAMES, RIG, SPECS, bodyPt, station };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.CarHD = api;
})(typeof window !== 'undefined' ? window : globalThis);
