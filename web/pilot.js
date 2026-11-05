/* KAGE pilot v2: a realistic, skinned, animated person.
 * Sculpted head (skull, jaw, cheekbones, eye sockets, eyes with lids, nose, lips, ears), anatomical body lofts (torso, shoulders,
 * arms, hands with fingers, legs, shoes), hair / beard as volumes with strand noise, racing suit with LED piping, optional helmet.
 * 19-bone skeleton, 2-bone skinning (pilot.vert), poses by FK + analytic two-bone IK (seated at the wheel, at the helm, gestures),
 * procedural clips (idle, walk, run, jump). Character faces +z, +x is the character's left. */
(function (root) {
'use strict';
const KF = root.KageFleet;
const { MB } = KF;
const PI = Math.PI, TAU = PI * 2;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => scl(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const gauss = (d2, s) => Math.exp(-d2 / (2 * s * s));
function hash(x) { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); }
function noise3(x, y, z) { return (Math.sin(x * 1.7 + Math.sin(y * 2.3) * 1.3) + Math.sin(y * 1.9 + Math.sin(z * 2.1) * 1.1) + Math.sin(z * 2.2 + Math.sin(x * 1.6) * 1.2)) / 3; }

/* ---------------- options ---------------- */
const SKIN = { pallida: [0.95, 0.85, 0.8], chiara: [0.92, 0.76, 0.66], rosata: [0.9, 0.67, 0.57], olivastra: [0.76, 0.58, 0.43], ambrata: [0.64, 0.45, 0.31], scura: [0.43, 0.29, 0.2], ebano: [0.27, 0.18, 0.13] };
const HAIRC = { platino: [0.92, 0.9, 0.82], nero: [0.025, 0.022, 0.02], castano_scuro: [0.11, 0.065, 0.035], castano: [0.26, 0.15, 0.07], biondo: [0.7, 0.53, 0.28], rosso: [0.5, 0.17, 0.06], grigio: [0.45, 0.45, 0.46], bianco: [0.82, 0.82, 0.8], blu_neon: [0.08, 0.35, 0.95], viola_neon: [0.55, 0.18, 0.95] };
const EYEC = { marroni: [0.24, 0.12, 0.05], nocciola: [0.4, 0.26, 0.1], verdi: [0.2, 0.4, 0.2], azzurri: [0.25, 0.48, 0.78], grigi: [0.43, 0.48, 0.5] };
const OPTS = {
  species: ['umano', 'nordico', 'grigio', 'verde', 'scuro'],
  height: [1.62, 1.68, 1.72, 1.76, 1.80, 1.84, 1.88, 1.94], build: ['snello', 'atletico', 'muscoloso', 'robusto'], skin: Object.keys(SKIN),
  face: ['ovale', 'tondo', 'squadrato', 'allungato'], nose: ['piccolo', 'medio', 'pronunciato'],
  hair: ['corti', 'stempiati', 'rasati', 'ciuffo', 'ricci', 'lunghi', 'coda', 'cresta', 'calvo'], hairColor: Object.keys(HAIRC),
  beard: ['nessuna', 'accennata', 'corta', 'piena', 'pizzetto', 'baffi'], brows: ['normali', 'folte', 'sottili'], eyes: Object.keys(EYEC), glasses: ['nessuno', 'tondi', 'squadrati', 'visore'],
  suit: ['casual', 'tunica', 'nero', 'bianco', 'rosso', 'blu', 'oro', 'viola', 'argento'], accent: ['ciano', 'magenta', 'ambra', 'lime', 'bianco', 'rosso'], helmet: [false, true], hearing: [false, true],
  pose: ['in piedi', 'saluto', 'indica', 'pollice', 'braccia conserte', 'mani sui fianchi', 'esulta', 'pensieroso', 'cammina', 'corre']
};
/** "IL MIO PILOTA": the owner's likeness (from his photos) — also the default */
const MINE = { species: 'umano', height: 1.80, build: 'muscoloso', skin: 'chiara', face: 'allungato', nose: 'pronunciato', hair: 'stempiati', hairColor: 'castano_scuro', beard: 'corta', brows: 'folte', eyes: 'nocciola',
  glasses: 'nessuno', suit: 'casual', accent: 'ciano', helmet: false, hearing: false };
const DEF = Object.assign({}, MINE, { pose: 'in piedi', inVehicle: true });
const TITLES = { species: 'SPECIE', height: 'ALTEZZA', build: 'CORPORATURA', skin: 'CARNAGIONE', face: 'VISO', nose: 'NASO', hair: 'CAPELLI', hairColor: 'COLORE CAPELLI', beard: 'BARBA',
  brows: 'SOPRACCIGLIA', eyes: 'OCCHI', glasses: 'OCCHIALI', suit: 'TUTA', accent: 'COLORE LED', helmet: 'CASCO', hearing: 'APPARECCHIO ACUSTICO', pose: 'POSA' };
function label(key, v) {
  if (key === 'height') return v.toFixed(2).replace('.', ',') + ' m';
  if (key === 'helmet') return v ? 'INDOSSATO' : 'TOLTO';
  if (key === 'hearing') return v ? 'SÌ' : 'NO';
  if (key === 'suit' && v === 'casual') return 'CASUAL · MAGLIONE';
  if (key === 'suit' && v === 'tunica') return 'TUNICA';
  if (key === 'suit' || key === 'accent') return KF.COLOR_NAMES[v] || String(v).toUpperCase();
  return String(v).replace('_', ' ').toUpperCase();
}

/* ---------------- skeleton (bind pose, 1.78 m) ---------------- */
const BN = ['pelvis', 'spine', 'chest', 'neck', 'head', 'clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 2, 9, 10, 11, 0, 13, 14, 0, 16, 17];
const BIND = [[0, 0.97, 0], [0, 1.1, 0], [0, 1.28, 0], [0, 1.47, -0.005], [0, 1.575, 0.0],
  [0.04, 1.44, -0.01], [0.19, 1.415, -0.015], [0.215, 1.13, -0.03], [0.232, 0.885, 0.0],
  [-0.04, 1.44, -0.01], [-0.19, 1.415, -0.015], [-0.215, 1.13, -0.03], [-0.232, 0.885, 0.0],
  [0.092, 0.93, 0.0], [0.1, 0.505, 0.012], [0.106, 0.088, -0.022], [-0.092, 0.93, 0.0], [-0.1, 0.505, 0.012], [-0.106, 0.088, -0.022]];
const B = {}; BN.forEach((n, i) => B[n] = i);

/* ---------------- geometry helpers (all in bind space; every vertex carries a region tag for skinning) ---------------- */
function tagged() { const mb = new MB(); mb.tags = []; mb.tag = 'torso'; const v0 = mb.v; mb.v = function (p, m, lp) { this.tags.push(this.tag); return v0.call(this, p, m, lp); }; return mb; }
/** loft along a path with sections {t, rx, rz, dz, ex} (ex = superellipse exponent), colour by (t, angle) */
function loftPath(mb, p0, p1, secs, n, colf, refSide) {
  const ax = nrm(sub(p1, p0)), side = nrm(cross(refSide || [0, 0, 1], ax).map(v => v)), fwd = nrm(cross(ax, side));
  const rows = secs.map(q => { const c = add(add(p0, scl(sub(p1, p0), q.t)), scl(fwd, q.dz || 0)), r = [];
    for (let k = 0; k <= n; k++) { const a = k / n * PI * 2, ca = Math.cos(a), sa = Math.sin(a), e = q.ex || 2;
      const cx = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e), cz = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e);
      r.push(add(c, add(scl(side, cx * q.rx), scl(fwd, cz * q.rz * (ca > 0 ? (q.front || 1) : (q.back || 1)))))); }
    return { r, q }; });
  const g = rows.map(({ r, q }) => r.map((p, k) => mb.v(p, colf ? colf(q.t, k / n) : mb.curMat)));
  for (let j = 0; j + 1 < g.length; j++) for (let k = 0; k < n; k++) { mb.tri(g[j][k], g[j + 1][k + 1], g[j + 1][k]); mb.tri(g[j][k], g[j][k + 1], g[j + 1][k + 1]); }
  return { rows, side, fwd };
}
const mat = (c, e, slot) => ({ c, e: e || 0, slot: slot || 0, mode: 0 });

/* ---------------- the person ---------------- */
function build(cfg, lod) {
  const o = Object.assign({}, DEF, cfg || {});
  if (o.species === 'grigio' || o.species === 'verde' || o.species === 'scuro') return buildAlien(o, lod);
  if (o.species === 'nordico') Object.assign(o, { suit: 'tunica', skin: 'pallida', hair: 'lunghi', hairColor: 'platino', eyes: 'azzurri', beard: 'nessuna', brows: 'sottili', glasses: 'nessuno', helmet: false,
    face: 'allungato', nose: 'medio', build: 'atletico', height: Math.max(o.height, 1.96) });
  const mb = tagged();
  const Q = lod === 'lo' ? 0.45 : lod === 'ultra' ? 2.6 : 1.3;
  const N = k => Math.max(6, Math.round(k * Q));
  const S = o.height / 1.78, W = { snello: 0.9, atletico: 1, muscoloso: 1.06, robusto: 1.17 }[o.build] || 1;
  const MU = o.build === 'muscoloso', TUN = o.suit === 'tunica', CAS = o.suit === 'casual' || TUN;
  // muscular build: broad shoulders + chest, V taper to the waist, thick arms and thighs
  const SH = y => MU ? (y >= 1.25 ? 1.1 : y >= 1.17 ? 1.04 : y > 0.92 ? 0.97 : 1) : 1, ARM = MU ? 1.16 : 1, LEG = MU ? 1.07 : 1;
  const J = BIND.map(p => scl(p, S));
  const skinC = SKIN[o.skin] || SKIN.chiara, hairC = HAIRC[o.hairColor] || HAIRC.nero, suitC = KF.COLORS[o.suit] || [0.05, 0.05, 0.06], ledC = KF.LEDS[o.accent] || [0, 1, 0.9];
  const SK = c => mat(c, 0, 6), HR = c => mat(c, /neon/.test(o.hairColor) ? 0.25 : 0, 7);
  // casual: knitted dark sweater (rib texture), dark jeans, brown leather shoes, tan suede shoulder patches
  const knitC = TUN ? [0.86, 0.87, 0.9] : [0.075, 0.08, 0.095], jeansC = TUN ? [0.8, 0.81, 0.85] : [0.07, 0.09, 0.14], suedeC = TUN ? [0.62, 0.64, 0.7] : [0.46, 0.32, 0.2];
  const knit = (t, u) => mat(knitC.map(v => v * (0.86 + 0.14 * Math.sin(u * PI * 2 * 70)) * (t < 0.07 || t > 0.95 ? 0.8 : 1)), 0, 1);
  const suitCol0 = (t, u, panel) => { const sideBand = Math.min(Math.abs(u - 0.25), Math.abs(u - 0.75));
    if (sideBand < 0.022) return mat(ledC, 0.9, 3); if (sideBand < 0.05) return mat(ledC.map(v => v * 0.35 + suitC[0] * 0.2), 0.05, 1);
    return mat(panel && (u > 0.4 && u < 0.6) ? suitC.map(v => v * 0.75) : suitC, 0, 1); };
  let legPart = false;
  const suitCol = (t, u, panel) => !CAS ? suitCol0(t, u, panel) : legPart ? mat(jeansC.map(v => v * (0.9 + 0.1 * Math.sin(u * PI * 2 * 3))), 0, 1) : knit(t, u);
  // ---- torso (superelliptic sections; side seams carry the LED piping)
  mb.tag = 'torso';
  const T = (y, rx, rz, dz, front, back) => ({ t: (y - 0.86) / (1.5 - 0.86), rx: rx * W * S * SH(y), rz: rz * W * S * (MU && y > 1.2 && y < 1.42 ? 1.06 : 1), dz: (dz || 0) * S, ex: 2.5,
    front: (front || 1) * (MU && y > 1.22 && y < 1.4 ? 1.1 : 1), back: (back || 1) * (MU && y > 1.25 && y < 1.43 ? 1.05 : 1) });
  loftPath(mb, scl([0, 0.86, 0], S), scl([0, 1.5, -0.01], S), [T(0.86, 0.13, 0.09), T(0.9, 0.165, 0.105, 0, 1, 1.12), T(0.96, 0.172, 0.11, 0, 0.95, 1.2), T(1.03, 0.158, 0.103), T(1.1, 0.15, 0.1),
    T(1.17, 0.157, 0.105, 0.004), T(1.25, 0.175, 0.117, 0.008, 1.06), T(1.32, 0.188, 0.121, 0.012, 1.1), T(1.38, 0.19, 0.115, 0.006, 1.05), T(1.43, 0.176, 0.1), T(1.465, 0.125, 0.08), T(1.5, 0.066, 0.06)],
    N(22), (t, u) => suitCol(t, u, true), [0, 0, 1]);
  // collar ring and chest emblem
  mb.tag = 'neck'; mb.push(KF.T(0, 1.47 * S, -0.008 * S)); mb.torus((CAS ? 0.068 : 0.062) * S * (MU ? 1.04 : 1), (CAS ? 0.014 : 0.012) * S, N(18), 5, CAS ? mat(knitC.map(v => v * 0.8), 0, 1) : mat(suitC.map(v => v * 0.6), 0, 1)); mb.pop();
  mb.tag = 'chest'; if (!CAS) mb.box(0.075 * S, 1.36 * S, 0.123 * W * S, 0.05 * S, 0.028 * S, 0.006, mat(ledC, 1.1, 3)); if (!CAS) mb.box(-0.075 * S, 1.36 * S, 0.122 * W * S, 0.04 * S, 0.012 * S, 0.004, mat([0.8, 0.8, 0.82]));
  if (TUN) { mb.tag = 'torso'; mb.push(KF.T(0, 0.99 * S, 0)); mb.torus(0.15 * S, 0.012 * S, N(24), 5, mat([0.75, 0.78, 0.85], 0, 2)); mb.pop(); mb.box(0, 0.99 * S, 0.15 * S, 0.06 * S, 0.04 * S, 0.012, mat([0.6, 0.85, 1], 0.9, 3)); }
  // ---- deltoids
  for (const s of [1, -1]) { mb.tag = s > 0 ? 'deltL' : 'deltR'; const dx = s * 0.178 * S * (0.6 + 0.4 * W) * (MU ? 1.06 : 1), dm = MU ? 1.1 : 1;
    mb.ellipsoid(dx, 1.405 * S, -0.01 * S, 0.062 * W * S * dm, 0.068 * S * dm, 0.068 * W * S * dm, N(14), N(10), CAS ? knit(0.5, 0.3) : mat(suitC, 0, 1));
    mb.part = 'toppe_spalle'; if (CAS) mb.ellipsoid(dx - s * 0.004 * S, 1.418 * S, -0.01 * S, 0.064 * W * S * dm, 0.066 * S * dm, 0.07 * W * S * dm, N(14), N(10), mat(suedeC.map(v => v * 0.92))); mb.part = '';   // suede patch
  }
  // ---- arms
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', sh = J[B['arm' + L]], el = J[B['fore' + L]], wr = J[B['hand' + L]];
    mb.tag = 'arm' + L;
    loftPath(mb, add(sh, [0, 0.02 * S, 0]), el, [{ t: 0, rx: 0.056 * W * S * ARM, rz: 0.058 * W * S * ARM }, { t: 0.35, rx: 0.05 * W * S * ARM, rz: 0.055 * W * S * ARM * (MU ? 1.08 : 1), front: 1.1 }, { t: 0.8, rx: 0.042 * W * S * ARM, rz: 0.044 * W * S * ARM }, { t: 1, rx: 0.041 * W * S, rz: 0.043 * W * S }],
      N(14), (t, u) => suitCol(t, (u + 0.25) % 1), [1, 0, 0]);
    mb.ellipsoid(el[0], el[1], el[2], 0.043 * W * S, 0.045 * S, 0.044 * W * S, N(10), N(8), CAS ? knit(0.5, 0.1) : mat(suitC, 0, 1));
    loftPath(mb, el, wr, [{ t: 0, rx: 0.042 * W * S, rz: 0.043 * W * S }, { t: 0.28, rx: 0.046 * W * S * ARM, rz: 0.044 * W * S * ARM }, { t: 0.82, rx: 0.033 * S, rz: 0.03 * S }, { t: 1, rx: 0.03 * S, rz: 0.024 * S }],
      N(14), (t, u) => t > 0.86 ? (CAS ? mat(knitC.map(v => v * 0.75), 0, 1) : mat(suitC.map(v => v * 0.55), 0, 1)) : suitCol(t, (u + 0.25) % 1), [1, 0, 0]);
    // hand: palm + four fingers (three phalanges, relaxed curl) + thumb
    mb.tag = 'hand' + L;
    const d = nrm(sub(wr, el)), side = nrm(cross([0, 0, 1], d)).map(v => v * s), fwd = nrm(cross(d, side)).map(v => v * s);
    const P = (a, b, c) => add(wr, add(add(scl(d, a * S), scl(side, b * S)), scl(fwd, c * S)));
    loftPath(mb, P(0.005, 0, 0), P(0.09, 0, 0.004), [{ t: 0, rx: 0.03 * S, rz: 0.016 * S }, { t: 0.5, rx: 0.042 * S, rz: 0.017 * S, ex: 3 }, { t: 1, rx: 0.043 * S, rz: 0.013 * S, ex: 3 }], N(12), () => SK(skinC), [fwd[0] * s, fwd[1] * s, fwd[2] * s]);
    const fl = [[0.046, 0.028, 0.02], [0.05, 0.031, 0.022], [0.047, 0.029, 0.021], [0.038, 0.023, 0.018]];
    if (lod === 'lo') { mb.ellipsoid(...P(0.12, 0, 0.012), 0.04 * S, 0.035 * S, 0.016 * S, 8, 6, SK(skinC)); }
    else for (let f = 0; f < 4; f++) {
      let p = P(0.088, (-0.03 + f * 0.02), 0.004), dir = d, curl = 0.18 + f * 0.04;
      for (let k = 0; k < 3; k++) {
        dir = nrm(add(scl(dir, Math.cos(curl)), scl(fwd, Math.sin(curl))));
        const q = add(p, scl(dir, fl[f][k] * S)), r = (0.0095 - k * 0.0012 - (f === 3 ? 0.0012 : 0)) * S;
        mb.rod(p, q, r, N(6), SK(skinC), r * 0.92); mb.ellipsoid(q[0], q[1], q[2], r * 0.92, r * 0.92, r * 0.92, N(6), 4, SK(skinC));
        p = q; curl = 0.28;
      }
    }
    if (lod !== 'lo') { let p = P(0.025, 0.03, 0.012), dir = nrm(add(add(scl(d, 0.6), scl(side, 0.55)), scl(fwd, 0.55)));
      for (let k = 0; k < 2; k++) { const q = add(p, scl(dir, (k ? 0.03 : 0.035) * S)), r = (0.012 - k * 0.0015) * S; mb.rod(p, q, r, N(6), SK(skinC), r * 0.9); mb.ellipsoid(q[0], q[1], q[2], r * 0.9, r * 0.9, r * 0.9, N(6), 4, SK(skinC)); p = q; dir = nrm(add(dir, scl(fwd, 0.4))); } }
  }
  // ---- legs + shoes
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', hp = J[B['thigh' + L]], kn = J[B['shin' + L]], an = J[B['foot' + L]];
    mb.tag = 'leg' + L; legPart = true;
    loftPath(mb, add(hp, [0, 0.03 * S, 0]), kn, [{ t: 0, rx: 0.09 * W * S * LEG, rz: 0.098 * W * S * LEG }, { t: 0.3, rx: 0.084 * W * S * LEG, rz: 0.088 * W * S * LEG, front: 1.08 }, { t: 0.78, rx: 0.066 * W * S, rz: 0.066 * W * S }, { t: 1, rx: 0.058 * W * S, rz: 0.06 * W * S }],
      N(16), (t, u) => suitCol(t, u), [0, 0, 1]);
    mb.ellipsoid(kn[0], kn[1], kn[2] + 0.008 * S, 0.056 * W * S, 0.055 * S, 0.06 * W * S, N(10), N(8), CAS ? mat(jeansC, 0, 1) : mat(suitC, 0, 1));
    loftPath(mb, kn, add(an, [0, 0.02 * S, 0]), [{ t: 0, rx: 0.056 * W * S, rz: 0.058 * W * S }, { t: 0.28, rx: 0.058 * W * S, rz: 0.064 * W * S, back: 1.15 }, { t: 0.75, rx: 0.04 * S, rz: 0.042 * S }, { t: 1, rx: 0.036 * S, rz: 0.04 * S }],
      N(16), (t, u) => suitCol(t, u), [0, 0, 1]);
    mb.tag = 'foot' + L; legPart = false;
    const sole = mat(TUN ? [0.7, 0.72, 0.76] : CAS ? [0.16, 0.12, 0.09] : [0.04, 0.04, 0.045]), up = TUN ? mat([0.82, 0.83, 0.86]) : CAS ? mat([0.2, 0.11, 0.06]) : mat(suitC.map(v => v * 0.5 + 0.03), 0, 2);
    const F = (z, w, h, y0) => ({ t: (z + 0.07) / 0.27, rx: w * S, rz: h * S, dz: 0, ex: 2.6 });
    // shoe as a loft along +z from heel to toe, sections: half width, half height
    const heel = add(an, [0, -0.035 * S, -0.07 * S]), toe = add(an, [0, -0.05 * S, 0.2 * S]);
    loftPath(mb, heel, toe, [F(-0.07, 0.036, 0.04), F(-0.04, 0.045, 0.055), F(0.03, 0.048, 0.05), F(0.1, 0.05, 0.035), F(0.16, 0.044, 0.026), F(0.2, 0.025, 0.016)], N(12),
      (t, u) => (Math.abs(u - 0.5) < 0.18 ? sole : up), [0, 1, 0]);
    mb.box(an[0], an[1] - 0.075 * S, an[2] + 0.055 * S, 0.1 * S, 0.016 * S, 0.27 * S, sole);
    if (!CAS) mb.box(an[0] + s * 0.05 * S, an[1] - 0.045 * S, an[2] + 0.04 * S, 0.003, 0.008 * S, 0.14 * S, mat(ledC, 0.9, 3));
  }
  // ---- neck
  mb.tag = 'neck';
  loftPath(mb, scl([0, 1.46, -0.012], S), scl([0, 1.62, 0.0], S), [{ t: 0, rx: 0.064 * W * S * (MU ? 1.08 : 1), rz: 0.06 * W * S }, { t: 0.5, rx: 0.054 * S * (MU ? 1.07 : 1), rz: 0.053 * S, front: 1.05 }, { t: 1, rx: 0.052 * S, rz: 0.052 * S }], N(14), () => SK(skinC), [0, 0, 1]);
  // ---- head
  mb.tag = 'head';
  const hs = Math.pow(S, 0.35), HC = [0, 1.662 * S, 0.014 * S];
  const shape = { ovale: [1, 1, 1, 0.84], tondo: [1.07, 0.95, 1.02, 0.9], squadrato: [1.04, 0.98, 1, 0.95], allungato: [0.95, 1.08, 0.98, 0.8] }[o.face] || [1, 1, 1, 0.84];
  const RX = 0.081 * hs * shape[0], RY = 0.109 * hs * shape[1], RZ = 0.1 * hs * shape[2], jaw = shape[3];
  const noseL = { piccolo: 0.016, medio: 0.022, pronunciato: 0.03 }[o.nose] || 0.022;
  const lipC = skinC.map((v, i) => lerp(v, [0.62, 0.3, 0.3][i], 0.45)), cheekC = skinC.map((v, i) => lerp(v, [0.85, 0.45, 0.4][i], 0.14));
  const stubble = !o.helmet && o.beard === 'accennata' ? 0.55 : !o.helmet && o.beard !== 'nessuna' ? 0.3 : 0, stubC = hairC.map((v, i) => lerp(v, skinC[i], 0.35));
  function beardMask(x, y, z, b) { if (z < 0.05) return 0; const ax = Math.abs(x);
    const yt = -0.42 + 0.36 * ax * ax;   // cheek line: high at the sideburns, dips toward the mouth corners
    const jawZone = sstep(yt + 0.07, yt - 0.08, y) * (1 - sstep(0.9, 1.0, ax) * sstep(0.25, 0.05, z)) * sstep(0.0, 0.15, z);
    const mouth = gauss(ax * ax * 0.5 + (y + 0.52) ** 2, 0.035), moust = gauss(ax * ax * 0.6 + (y + 0.425) ** 2, 0.038) * sstep(0.85, 1, z);
    let m = jawZone * (1 - sstep(0.35, 0.7, mouth));
    if (b === 'pizzetto') m = gauss(ax * ax + (y + 0.8) ** 2, 0.13) * (1 - mouth) + moust;
    if (b === 'baffi') m = moust;
    if (b === 'corta' || b === 'piena') m = Math.max(m, moust);
    return clamp(m * 1.3, 0, 1); }
  /** head surface: unit direction (x right=+x left of person, y up, z front) → point + colour */
  const headPt = (x, y, z) => {
    let rx = RX, ry = RY, rz = RZ * (z < 0 ? 1.06 : 1);
    // jaw narrows below the cheeks, chin pushes forward
    const low = sstep(-0.22, -0.98, y);
    rx *= lerp(1, jaw, low); rz *= lerp(1, 0.97, low);
    let p = [x * rx, y * ry, z * rz], off = 0;
    const ax = Math.abs(x);
    off += 0.009 * gauss((ax - 0.62) ** 2 + (y + 0.05) ** 2 + (z - 0.72) ** 2, 0.16);                        // cheekbones
    off -= 0.014 * gauss((ax - 0.36) ** 2 + (y - 0.12) ** 2, 0.11) * sstep(0.6, 0.95, z);                       // eye sockets
    off += 0.006 * gauss((y - 0.27) ** 2, 0.06) * sstep(0.55, 0.95, z) * (1 - sstep(0.5, 0.8, ax));             // brow ridge
    off += 0.004 * sstep(0.2, 0.05, y) * sstep(-0.3, -0.1, y) * gauss(ax * ax, 0.08) * sstep(0.8, 1, z);        // soft base under the nose mesh
    off += 0.007 * gauss((ax - 0.075) ** 2 + (y + 0.3) ** 2, 0.045) * sstep(0.75, 1, z);                       // nostril wings
    off += 0.0075 * gauss(ax * ax * 0.35 + (y + 0.5) ** 2, 0.05) * sstep(0.7, 1, z) * (1 - sstep(0.22, 0.32, ax));  // lips
    off -= 0.003 * gauss((y + 0.535) ** 2, 0.012) * (1 - sstep(0.16, 0.25, ax)) * sstep(0.8, 1, z);               // mouth line
    off += 0.011 * gauss(ax * ax + (y + 0.83) ** 2, 0.12) * sstep(0.5, 0.95, z) * (o.face === 'squadrato' ? 1.4 : 1);   // chin
    off -= 0.004 * gauss((ax - 0.85) ** 2 + (y - 0.25) ** 2, 0.15);                                               // temples
    const n = nrm([x / rx, y / ry, z / rz]);
    p = add(p, scl(n, off * hs));
    // colour: lips, cheeks
    let c = skinC;
    const lip = gauss(ax * ax * 0.35 + (y + 0.5) ** 2, 0.04) * sstep(0.85, 1, z) * (1 - sstep(0.2, 0.3, ax));
    const mline = gauss((y + 0.535) ** 2, 0.009) * (1 - sstep(0.14, 0.22, ax)) * sstep(0.85, 1, z);
    const ck = gauss((ax - 0.5) ** 2 + (y + 0.2) ** 2, 0.15) * sstep(0.6, 0.9, z);
    c = c.map((v, i) => lerp(lerp(lerp(v, cheekC[i], ck), lipC[i], sstep(0.15, 0.45, lip)), lipC[i] * 0.45, mline * 0.8));
    const sock = gauss((ax - 0.36) ** 2 + (y - 0.12) ** 2, 0.1) * sstep(0.6, 0.95, z); c = c.map(v => v * (1 - sock * 0.12));
    if (stubble > 0) { const st = beardMask(x, y, z, 'corta') * stubble; c = c.map((v, i) => lerp(v, stubC[i], st)); }
    return [add(p, HC), c];
  };
  const hu = N(64), hv = N(48);
  { const g = [];
    for (let j = 0; j <= hv; j++) { const th = j / hv * PI, row = [];
      for (let k = 0; k <= hu; k++) { const ph = k / hu * PI * 2, x = Math.sin(th) * Math.sin(ph), y = Math.cos(th), z = Math.sin(th) * Math.cos(ph);
        const [p, c] = headPt(x, y, z); row.push(mb.v(p, SK(c))); }
      g.push(row); }
    for (let j = 0; j < hv; j++) for (let k = 0; k < hu; k++) { mb.tri(g[j][k], g[j + 1][k], g[j + 1][k + 1]); mb.tri(g[j][k], g[j + 1][k + 1], g[j][k + 1]); } }
  mb.part = 'naso';
  // nose: its own loft from the bridge between the eyes to the tip, with nostril wings
  { const top = headPt(0, 0.16, 0.985)[0], tip = headPt(0, -0.28, 0.99)[0], out = noseL * hs;
    const P = t => { const y = lerp(top[1], tip[1], t), zb = lerp(top[2], tip[2], t) - 0.004; return [0, y, zb]; };
    const rows = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8, c = P(t), proj = out * (0.25 + 0.75 * Math.pow(t, 1.4)) + (j === 8 ? -0.002 : 0), w = lerp(0.006, 0.014, Math.pow(t, 1.2)) * hs, row = [];
      for (let k = 0; k <= 10; k++) { const a = (k / 10 - 0.5) * PI; row.push([Math.sin(a) * w, c[1] - Math.max(0, t - 0.85) * 0.01 * Math.cos(a), c[2] + Math.cos(a) * proj]); }
      rows.push(row); }
    // underside closing back to the face
    const und = []; for (let j = 0; j <= 3; j++) { const t = j / 3, row = []; for (let k = 0; k <= 10; k++) { const a = (k / 10 - 0.5) * PI, w = 0.014 * hs * (1 - t * 0.25);
        row.push([Math.sin(a) * w, tip[1] - 0.004 - t * 0.008 * hs, tip[2] - 0.004 + Math.cos(a) * out * (1 - t) ]); } und.push(row); }
    mb.grid(rows, SK(skinC), true); mb.grid(und, SK(skinC.map(v => v * 0.92)), true);
    for (const sx of [1, -1]) mb.ellipsoid(sx * 0.012 * hs, tip[1] - 0.001, tip[2] - 0.002, 0.0065 * hs, 0.0055 * hs, 0.008 * hs, N(8), 6, SK(skinC.map(v => v * 0.97)));
    for (const sx of [1, -1]) mb.ellipsoid(sx * 0.005 * hs, tip[1] - 0.0075 * hs, tip[2] + out * 0.25, 0.0026 * hs, 0.0012 * hs, 0.0035 * hs, 6, 4, mat([0.2, 0.09, 0.08])); }
  // lips
  mb.part = 'labbra';
  { const up = headPt(0, -0.495, 0.99)[0], lo = headPt(0, -0.585, 0.985)[0], lc = SK(lipC);
    mb.ellipsoid(0, up[1], up[2] - 0.0045, 0.019 * hs, 0.0045 * hs, 0.007 * hs, N(14), 6, lc);
    mb.ellipsoid(0, lo[1], lo[2] - 0.0055, 0.017 * hs, 0.0055 * hs, 0.0075 * hs, N(14), 6, lc);
    mb.box(0, (up[1] + lo[1]) / 2, Math.max(up[2], lo[2]) - 0.004, 0.036 * hs, 0.0015, 0.004, mat(lipC.map(v => v * 0.35))); }
  // ears
  mb.part = 'orecchie';
  for (const s of [1, -1]) { const e = headPt(s * 0.98, 0.0, -0.08)[0];
    mb.push(KF.M(KF.T(e[0] + s * 0.004, e[1] - 0.004, e[2]), KF.RY(s * 0.25)));
    mb.ellipsoid(0, 0, 0, 0.009 * hs, 0.031 * hs, 0.021 * hs, N(10), N(8), SK(skinC.map(v => v * 0.96)));
    mb.ellipsoid(s * 0.004, 0, 0.002, 0.005 * hs, 0.02 * hs, 0.012 * hs, N(8), 6, SK(skinC.map(v => v * 0.8))); mb.pop(); }
  // eyes with lids + brows
  mb.part = 'occhi_sopracciglia';
  const eyeCol = EYEC[o.eyes] || EYEC.marroni;
  for (const s of [1, -1]) {
    const ec = add(headPt(s * 0.36, 0.12, 0.93)[0], [0, 0, -0.0055 * hs]), r = 0.0118 * hs;
    mb.ellipsoid(ec[0], ec[1], ec[2], r, r, r, N(14), N(10), mat([0.86, 0.85, 0.82]));
    mb.ellipsoid(ec[0], ec[1], ec[2] + r * 0.84, r * 0.5, r * 0.5, r * 0.2, N(12), 6, mat(eyeCol));
    mb.ellipsoid(ec[0], ec[1], ec[2] + r * 0.99, r * 0.21, r * 0.21, r * 0.05, N(8), 4, mat([0.01, 0.01, 0.01]));
    mb.ellipsoid(ec[0] + r * 0.2, ec[1] + r * 0.22, ec[2] + r * 1.02, r * 0.07, r * 0.07, r * 0.02, 6, 4, mat([1, 1, 1], 0.8));
    // lids: thin shells hugging the eyeball (upper covers the top third)
    const lid = (y0, y1, c) => { const rows = []; for (let j = 0; j <= 4; j++) { const v = lerp(y0, y1, j / 4) * PI, row = [];
        for (let k = 0; k <= 10; k++) { const u = (-0.42 + k / 10 * 0.84) * PI; row.push([ec[0] + Math.sin(u) * Math.sin(v) * r * 1.12, ec[1] + Math.cos(v) * r * 1.12, ec[2] + Math.cos(u) * Math.sin(v) * r * 1.12]); } rows.push(row); }
      mb.grid(rows, SK(c), true); };
    lid(0.06, 0.33, skinC.map(v => v * 0.9)); lid(0.7, 0.86, skinC.map(v => v * 0.95));
    mb.box(ec[0], ec[1] + r * 0.48, ec[2] + r * 0.86, r * 1.7, r * 0.12, r * 0.25, mat(hairC.map(v => v * 0.8)));   // upper lash line
    // brow: a strip of short hair quads along the brow ridge
    const bw = { normali: 0.055, folte: 0.068, sottili: 0.038 }[o.brows] || 0.055, bt = o.brows === 'folte' ? 0.003 : 0.0025;
    const brow = []; for (let k = 0; k <= 8; k++) { const t = k / 8, bx = s * lerp(0.15, 0.6, t), by = 0.29 + 0.06 * Math.sin(t * PI) - t * 0.06, w = bw * (1 - 0.45 * t);
      const a = headPt(bx, by + w * 0.25, Math.sqrt(Math.max(0, 1 - bx * bx - by * by)))[0], b = headPt(bx, by - w + t * 0.02, Math.sqrt(Math.max(0, 1 - bx * bx - (by - 0.05) ** 2)))[0];
      const out = nrm(sub(a, HC)); brow.push([add(a, scl(out, bt)), add(b, scl(out, bt * 0.8))]); }
    mb.grid(brow, HR(hairC.map((v, i) => lerp(v * 1.25, skinC[i], 0.12))), s < 0);
  }
  mb.part = '';
  // ---- hair / beard volumes over the scalp parameterisation
  const shellOver = (mask, thick, colf, su, sv) => {
    const g = [], ok = [];
    for (let j = 0; j <= sv; j++) { const th = j / sv * PI, row = [], okr = [];
      for (let k = 0; k <= su; k++) { const ph = k / su * PI * 2, x = Math.sin(th) * Math.sin(ph), y = Math.cos(th), z = Math.sin(th) * Math.cos(ph);
        const m = mask(x, y, z), [p] = headPt(x, y, z), out = nrm(sub(p, HC)), tk = thick(x, y, z) * m;
        okr.push(m > 0.02); row.push(mb.v(add(p, scl(out, -0.003 + 0.0042 * sstep(0.0, 0.45, m) + tk)), colf(x, y, z, m))); }   // edges taper into the skin (no stair-steps)
      g.push(row); ok.push(okr); }
    for (let j = 0; j < sv; j++) for (let k = 0; k < su; k++) if (ok[j][k] || ok[j + 1][k] || ok[j + 1][k + 1] || ok[j][k + 1]) {
      mb.tri(g[j][k], g[j + 1][k], g[j + 1][k + 1]); mb.tri(g[j][k], g[j + 1][k + 1], g[j][k + 1]); }
  };
  const strands = (x, y, z) => 0.5 + 0.5 * Math.sin(Math.atan2(x, z) * 60 + y * 9 + noise3(x * 8, y * 8, z * 8) * 3);
  const hairCol = (x, y, z, m) => HR(hairC.map(v => v * (0.75 + 0.5 * strands(x, y, z) * 0.6)));
  if (!o.helmet && o.hair !== 'calvo') {
    const st = o.hair; mb.part = 'capelli';
    // hairline: forehead, temples, above the ears, nape
    const recede = st === 'stempiati' ? 0.2 : 0;   // M hairline: temples pushed back, a widow's peak left in the middle
    const mask = (x, y, z) => { const ax = Math.abs(x), front = z > 0.2 ? sstep(0.24, 0.42, y + 0.12 * ax * ax - (ax > 0.45 && ax < 0.75 ? 0.06 : 0) - recede * (0.4 + gauss((ax - 0.55) ** 2, 0.17)) * sstep(0.2, 0.6, z)) : 1;
      const side = Math.abs(x) > 0.75 && z > -0.45 ? sstep(-0.05 + (recede && z > 0.3 ? 0.2 : 0), 0.12 + (recede && z > 0.3 ? 0.2 : 0), y) : 1, nape = z <= 0.25 ? sstep(st === 'lunghi' || st === 'coda' ? -0.65 : -0.42, -0.25, y) : 1;
      let m = Math.min(front, side, nape);
      if (st !== 'rasati' && st !== 'cresta' && ax > 0.8 && z > -0.12 && z < 0.5) m = Math.max(m, sstep(-0.32, -0.18, y) * (1 - sstep(0.3, 0.5, z)) * (1 - sstep(0.1, 0.3, y)));   // sideburns
      if (st === 'cresta') m *= 1 - sstep(0.12, 0.22, Math.abs(x));
      return m; };
    const base = { corti: 0.012, stempiati: 0.006, rasati: 0.0035, ciuffo: 0.012, ricci: 0.022, lunghi: 0.014, coda: 0.01, cresta: 0.004 }[st] || 0.01;
    const thick = (x, y, z) => { let t = base + 0.004 * strands(x, y, z);
      if (st === 'ciuffo') t += 0.03 * sstep(0.3, 0.75, z) * sstep(0.35, 0.8, y);
      if (st === 'ricci') t += 0.014 * (0.5 + 0.5 * noise3(x * 11, y * 11, z * 11));
      if (st === 'cresta') t += 0.05 * sstep(0.2, 0.9, y);
      if (st === 'corti') t += 0.004 * sstep(0.5, 1, y);
      if (st === 'stempiati') t += (0.006 + 0.007 * (0.5 + 0.5 * noise3(x * 9, y * 7, z * 9))) * sstep(0.45, 0.85, y) * sstep(-0.4, 0.3, z) - 0.004 * (1 - sstep(-0.2, 0.3, y));
      return t; };
    shellOver(mask, thick, hairCol, N(46), N(30));
    if (st === 'lunghi') { mb.tag = 'neck';
      for (const sx of [-1, 0, 1]) { const top = headPt(sx * 0.6, -0.35, sx ? -0.2 : -0.95)[0];
        loftPath(mb, top, add(top, [sx * 0.02 * S, -0.2 * S, (sx ? -0.01 : -0.03) * S]), [{ t: 0, rx: (sx ? 0.035 : 0.07) * hs, rz: 0.03 * hs }, { t: 0.6, rx: (sx ? 0.032 : 0.068) * hs, rz: 0.024 * hs }, { t: 1, rx: (sx ? 0.022 : 0.05) * hs, rz: 0.012 * hs }], N(12), () => HR(hairC.map(v => v * 0.9)), [0, 0, 1]); }
      mb.tag = 'head'; }
    if (st === 'coda') { const a = headPt(0, 0.05, -1)[0]; mb.tag = 'neck';
      mb.rod(add(a, [0, 0, -0.005]), add(a, [0, -0.16 * S, -0.05 * S]), 0.02 * hs, N(8), HR(hairC), 0.009 * hs); mb.tag = 'head';
      mb.push(KF.T(a[0], a[1], a[2] - 0.006)); mb.torus(0.016 * hs, 0.005 * hs, N(10), 4, mat(ledC, 0.8, 3)); mb.pop(); }
  }
  if (!o.helmet && o.beard !== 'nessuna' && o.beard !== 'accennata') {
    const b = o.beard; mb.part = 'barba';
    const mask = (x, y, z) => beardMask(x, y, z, b);
    const tk = { accennata: 0.0012, corta: 0.0045, piena: 0.009, pizzetto: 0.005, baffi: 0.005 }[b];
    const bc = hairC.map((v, i) => lerp(v * 1.5, skinC[i], 0.08));
    shellOver(mask, (x, y, z) => tk * (b === 'piena' ? 1 + 0.6 * sstep(-0.6, -0.95, y) : 1) * (0.7 + 0.3 * strands(x, y, z)), (x, y, z) => HR(bc.map(v => v * (0.85 + 0.3 * strands(x, y, z)))), N(46), N(34));
  }
  mb.part = '';
  // hearing aid behind the right ear (skin-toned shell + thin clear tube over the top of the ear)
  if (!o.helmet && o.hearing) { mb.part = 'apparecchio_acustico'; const e = headPt(-0.98, 0.0, -0.08)[0], hc = [0.62, 0.55, 0.5];
    mb.push(KF.M(KF.T(e[0] - 0.006, e[1] + 0.004, e[2] - 0.022 * hs), KF.RX(0.25))); mb.ellipsoid(0, 0, 0, 0.0055 * hs, 0.02 * hs, 0.007 * hs, N(8), 6, mat(hc)); mb.pop();
    mb.rod(add(e, [-0.006, 0.024 * hs, -0.016 * hs]), add(e, [-0.008, 0.03 * hs, 0.004]), 0.0011, 5, mat([0.75, 0.75, 0.75], 0, 4)); }
  // glasses
  mb.part = 'occhiali';
  if (!o.helmet && o.glasses !== 'nessuno') {
    const fr = mat([0.04, 0.04, 0.045]), lens = mat([0.05, 0.07, 0.09], 0, 4);
    const ecL = headPt(0.36, 0.12, 0.93)[0], ecR = headPt(-0.36, 0.12, 0.93)[0], gz = Math.max(ecL[2], ecR[2]) + 0.012 * hs;
    if (o.glasses === 'visore') { mb.box(0, ecL[1], gz, 0.15 * hs, 0.028 * hs, 0.01, mat(ledC, 0.9, 3)); for (const s of [1, -1]) mb.box(s * 0.077 * hs, ecL[1], gz - 0.045 * hs, 0.004, 0.012, 0.09 * hs, fr); }
    else { for (const ec of [ecL, ecR]) {
        if (o.glasses === 'tondi') { mb.push(KF.M(KF.T(ec[0], ec[1], gz), KF.RX(PI / 2))); mb.torus(0.019 * hs, 0.0022, N(16), 4, fr); mb.pop(); }
        else { mb.box(ec[0], ec[1] + 0.016 * hs, gz, 0.044 * hs, 0.004, 0.004, fr); mb.box(ec[0], ec[1] - 0.014 * hs, gz, 0.044 * hs, 0.003, 0.003, fr); for (const d2 of [-1, 1]) mb.box(ec[0] + d2 * 0.022 * hs, ec[1] + 0.001, gz, 0.003, 0.03 * hs, 0.003, fr); }
        mb.box(ec[0], ec[1], gz - 0.001, 0.036 * hs, 0.026 * hs, 0.002, lens); }
      mb.box(0, ecL[1] + 0.004, gz, 0.022 * hs, 0.003, 0.003, fr);
      for (const s of [1, -1]) mb.box(s * 0.079 * hs, ecL[1] + 0.005, gz - 0.05 * hs, 0.003, 0.004, 0.1 * hs, fr); }
  }
  // helmet
  mb.part = 'casco';
  if (o.helmet) {
    const hc = add(HC, [0, 0.008 * S, -0.006 * S]);
    mb.ellipsoid(hc[0], hc[1], hc[2], RX * 1.48, RY * 1.32, RZ * 1.36, N(30), N(22), mat(suitC, 0, 1));
    const rows = []; for (let j = 0; j <= 6; j++) { const v = lerp(0.36, 0.66, j / 6) * PI, row = [];
      for (let k = 0; k <= 16; k++) { const u = (-0.27 + k / 16 * 0.54) * PI; row.push([hc[0] + Math.sin(u) * Math.sin(v) * RX * 1.5, hc[1] + Math.cos(v) * RY * 1.34, hc[2] + Math.cos(u) * Math.sin(v) * RZ * 1.38]); } rows.push(row); }
    mb.grid(rows, mat([0.02, 0.03, 0.05], 0, 4), true);
    mb.box(0, hc[1] + RY * 1.28, hc[2] - 0.01, 0.018, 0.012, RZ * 2.2, mat(ledC, 1, 3));
    for (const s of [1, -1]) mb.box(s * RX * 1.47, hc[1] - 0.01, hc[2], 0.004, 0.03, 0.06, mat(ledC, 1, 3));
  }
  mb.part = '';
  return skinMesh(mb, S, o);
}

/* ---------------- non-human visitors: grey, green and the tall dark one ---------------- */
const ALIEN = {
  grigio: { h: 1.24, skin: [0.6, 0.62, 0.62], head: [0.15, 0.175, 0.16], limb: 0.62, eye: [0.012, 0.012, 0.016], eyeE: 0, glow: 0 },
  verde: { h: 1.38, skin: [0.32, 0.62, 0.28], head: [0.155, 0.17, 0.16], limb: 0.7, eye: [0.01, 0.012, 0.01], eyeE: 0, glow: 0 },
  scuro: { h: 2.08, skin: [0.035, 0.035, 0.045], head: [0.085, 0.135, 0.13], limb: 0.6, eye: [1, 0.35, 0.08], eyeE: 1.6, glow: 1 } };
function buildAlien(o, lod) {
  const A = ALIEN[o.species], mb = tagged(), Q = lod === 'lo' ? 0.45 : lod === 'ultra' ? 2.6 : 1.3, N = k => Math.max(6, Math.round(k * Q));
  const S = A.h / 1.78, J = BIND.map(p => scl(p, S)), th = A.limb, sk = mat(A.skin, 0, 6), skD = mat(A.skin.map(v => v * 0.82), 0, 6);
  const glossy = o.species === 'scuro' ? mat(A.skin, 0.02, 6) : sk;
  // torso: narrow chest, small waist (dark one: a long ribbed carapace)
  mb.tag = 'torso';
  const sec = (y, rx, rz) => ({ t: (y - 0.86) / (1.5 - 0.86), rx: rx * S * th * 1.25, rz: rz * S * th * 1.25, ex: 2.3 });
  loftPath(mb, scl([0, 0.86, 0], S), scl([0, 1.5, -0.01], S), [sec(0.86, 0.12, 0.08), sec(0.92, 0.13, 0.085), sec(1.02, 0.1, 0.07), sec(1.12, 0.105, 0.075), sec(1.25, 0.13, 0.09), { t: (1.35 - 0.86) / 0.64, rx: 0.15 * S, rz: 0.088 * S * th * 1.25, ex: 2.3 }, { t: (1.42 - 0.86) / 0.64, rx: 0.165 * S, rz: 0.07 * S * th * 1.25, ex: 2.6 }, sec(1.49, 0.06, 0.05)], N(18),
    (t, u) => o.species === 'scuro' && Math.sin(t * 40) > 0.6 ? mat(A.skin.map(v => v * 1.8), 0, 6) : glossy, [0, 0, 1]);
  if (o.species === 'scuro') { mb.tag = 'chest'; mb.box(0, 1.33 * S, 0.11 * S * th * 1.25, 0.03 * S, 0.12 * S, 0.01, mat(A.eye, 1.0, 3)); }
  // limbs: thin, long-handed; three fingers and a thumb
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', sh = J[B['arm' + L]], el = J[B['fore' + L]], wr = J[B['hand' + L]];
    mb.tag = 'delt' + L; mb.ellipsoid(sh[0] - s * 0.01 * S, sh[1], sh[2], 0.045 * S * th, 0.045 * S, 0.045 * S * th, N(10), N(8), sk);
    mb.tag = 'arm' + L;
    loftPath(mb, sh, el, [{ t: 0, rx: 0.04 * S * th, rz: 0.04 * S * th }, { t: 0.5, rx: 0.034 * S * th, rz: 0.036 * S * th }, { t: 1, rx: 0.028 * S * th, rz: 0.03 * S * th }], N(10), () => sk, [1, 0, 0]);
    mb.ellipsoid(el[0], el[1], el[2], 0.03 * S * th, 0.032 * S, 0.03 * S * th, N(8), N(6), sk);
    loftPath(mb, el, wr, [{ t: 0, rx: 0.028 * S * th, rz: 0.03 * S * th }, { t: 1, rx: 0.02 * S, rz: 0.017 * S }], N(10), () => sk, [1, 0, 0]);
    mb.tag = 'hand' + L;
    const d = nrm(sub(wr, el)), side = nrm(cross([0, 0, 1], d)).map(v => v * s), fwd = nrm(cross(d, side)).map(v => v * s);
    const P = (a, b, c) => add(wr, add(add(scl(d, a * S), scl(side, b * S)), scl(fwd, c * S)));
    mb.ellipsoid(...P(0.04, 0, 0.004), 0.03 * S, 0.045 * S, 0.012 * S, N(8), 6, sk);
    for (let f = 0; f < 3; f++) { let p = P(0.075, -0.022 + f * 0.022, 0.004), dir = nrm(add(d, scl(side, (f - 1) * 0.15)));
      for (let k = 0; k < 3; k++) { dir = nrm(add(scl(dir, Math.cos(0.2)), scl(fwd, Math.sin(0.2)))); const qq = add(p, scl(dir, 0.045 * S)), r = (0.0085 - k * 0.0014) * S;
        mb.rod(p, qq, r, N(6), sk, r * 0.9); mb.ellipsoid(qq[0], qq[1], qq[2], r * (k === 2 ? 1.5 : 1), r * (k === 2 ? 1.5 : 1), r * (k === 2 ? 1.5 : 1), N(6), 4, k === 2 ? skD : sk); p = qq; } }
    { const p = P(0.02, 0.03, 0.01), qq = P(0.06, 0.06, 0.03); mb.rod(p, qq, 0.009 * S, N(6), sk, 0.007 * S); }
    // legs + long bare feet
    const hp = J[B['thigh' + L]], kn = J[B['shin' + L]], an = J[B['foot' + L]];
    mb.tag = 'leg' + L;
    loftPath(mb, add(hp, [0, 0.03 * S, 0]), kn, [{ t: 0, rx: 0.065 * S * th, rz: 0.07 * S * th }, { t: 1, rx: 0.042 * S * th, rz: 0.045 * S * th }], N(12), () => glossy, [0, 0, 1]);
    mb.ellipsoid(kn[0], kn[1], kn[2] + 0.005 * S, 0.042 * S * th, 0.045 * S, 0.046 * S * th, N(8), N(6), sk);
    loftPath(mb, kn, add(an, [0, 0.02 * S, 0]), [{ t: 0, rx: 0.042 * S * th, rz: 0.046 * S * th }, { t: 0.3, rx: 0.044 * S * th, rz: 0.05 * S * th }, { t: 1, rx: 0.026 * S, rz: 0.028 * S }], N(12), () => glossy, [0, 0, 1]);
    mb.tag = 'foot' + L;
    mb.ellipsoid(an[0], an[1] - 0.06 * S, an[2] + 0.05 * S, 0.04 * S, 0.028 * S, 0.12 * S, N(10), N(6), sk);
    for (let f = -1; f <= 1; f++) mb.ellipsoid(an[0] + f * 0.022 * S, an[1] - 0.075 * S, an[2] + 0.165 * S, 0.012 * S, 0.012 * S, 0.025 * S, 6, 4, skD);
  }
  // neck: long and thin
  mb.tag = 'neck';
  loftPath(mb, scl([0, 1.45, -0.012], S), scl([0, 1.62, 0.0], S), [{ t: 0, rx: 0.045 * S * th * 1.3, rz: 0.04 * S * th * 1.3 }, { t: 1, rx: 0.03 * S * 1.3, rz: 0.03 * S * 1.3 }], N(10), () => sk, [0, 0, 1]);
  // head: big cranium tapering to a tiny chin (the dark one: tall, narrow, swept back)
  mb.tag = 'head';
  const [hx, hy, hz] = A.head, HC = [0, 1.6 * S + hy * 0.95, 0.01];
  const rows = [], sv = N(28), su = N(36);
  for (let j = 0; j <= sv; j++) { const v = j / sv * PI, y = Math.cos(v), sr = Math.sin(v), row = [];
    for (let k = 0; k <= su; k++) { const u = k / su * TAU, x = Math.sin(u) * sr, z = Math.cos(u) * sr;
      const low = Math.max(0, -y), taper = 1 - 0.62 * Math.pow(low, 1.4), back = o.species === 'scuro' && z < 0 ? 1 + 0.5 * Math.max(0, y + 0.2) : 1;
      let px = x * hx * taper, py = y * hy, pz = z * hz * (z > 0 ? 1 - 0.25 * Math.pow(low, 1.2) : back);
      if (o.species === 'scuro') py += Math.max(0, -z) * Math.max(0, y) * hy * 0.35;
      row.push(add(HC, [px, py, pz])); }
    rows.push(row); }
  mb.grid(rows, sk, true);
  mb.part = 'occhi';
  // eyes: large tilted almonds (black glossy; glowing for the dark one)
  for (const s of [1, -1]) {
    const ec = add(HC, [s * hx * 0.45, -hy * 0.12, hz * 0.84]);
    mb.push(KF.M(KF.T(ec[0], ec[1], ec[2]), KF.RY(s * 0.42), KF.RZ(s * 0.42)));
    mb.ellipsoid(0, 0, 0, hx * 0.34, hy * 0.16, hz * 0.18, N(14), N(10), mat(A.eye, A.eyeE, A.glow ? 3 : 0));
    if (!A.glow) mb.ellipsoid(hx * 0.12, hy * 0.05, hz * 0.17, hx * 0.04, hy * 0.025, 0.003, 6, 4, mat([0.9, 0.95, 1], 0.6));
    mb.pop(); }
  // nostrils + mouth slit
  for (const s of [1, -1]) mb.ellipsoid(HC[0] + s * hx * 0.07, HC[1] - hy * 0.48, HC[2] + hz * 0.67, hx * 0.025, hy * 0.012, 0.004, 6, 4, mat(A.skin.map(v => v * 0.35)));
  mb.box(HC[0], HC[1] - hy * 0.66, HC[2] + hz * 0.52, hx * 0.22, hy * 0.012, 0.006, mat(A.skin.map(v => v * 0.3)));
  mb.part = 'antenne';
  if (o.species === 'verde') for (const s of [1, -1]) { const b = add(HC, [s * hx * 0.35, hy * 0.85, 0]); mb.rod(b, add(b, [s * 0.03, 0.09, 0.01]), 0.004, 6, sk); mb.ellipsoid(b[0] + s * 0.03, b[1] + 0.095, b[2] + 0.01, 0.011, 0.011, 0.011, 8, 6, mat([0.6, 1, 0.4], 1.2, 3)); }
  return skinMesh(mb, S, o);
}

/* ---------------- skin weights from region tag + bind position ---------------- */
function skinMesh(mb, S, o) {
  const m = mb.finish(), n = m.verts, sk = new Float32Array(n * 4);
  const J = BIND.map(p => scl(p, S));
  const segT = (p, a, b) => { const ab = sub(J[b], J[a]); return clamp(dot(sub(p, J[a]), ab) / dot(ab, ab), 0, 1); };
  for (let i = 0; i < n; i++) {
    const p = [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]], y = p[1] / S, tg = mb.tags[i];
    let b0 = 0, b1 = 0, w = 1;
    const L = tg.endsWith('L') ? 'L' : 'R';
    if (tg === 'torso') {
      if (y < 1.0) { b0 = 0; b1 = 1; w = 1 - sstep(0.96, 1.06, y) * 0.5; }
      else if (y < 1.2) { b0 = 1; b1 = y < 1.1 ? 0 : 2; w = y < 1.1 ? 0.5 + 0.5 * sstep(1.0, 1.1, y) : 1 - 0.5 * sstep(1.1, 1.22, y); }
      else if (y < 1.43) { b0 = 2; b1 = 1; w = 0.5 + 0.5 * sstep(1.18, 1.28, y); }
      else { b0 = 2; b1 = 3; w = 1 - 0.5 * sstep(1.43, 1.5, y); }
      // the shoulder corners follow the arms a little
      const ax = Math.abs(p[0]) / S; if (y > 1.33 && ax > 0.14) { b1 = B[(p[0] > 0 ? 'arm' : 'arm') + (p[0] > 0 ? 'L' : 'R')]; w = 1 - 0.45 * sstep(0.14, 0.2, ax) * sstep(1.33, 1.42, y); b0 = 2; }
    } else if (tg === 'chest') { b0 = 2; }
    else if (tg === 'neck') { b0 = 3; b1 = y < 1.52 ? 2 : 4; w = y < 1.52 ? 0.5 + 0.5 * sstep(1.46, 1.52, y) : 1 - 0.5 * sstep(1.55, 1.62, y); if (y < 1.43) { b0 = 2; w = 1; } }
    else if (tg === 'head') { b0 = 4; }
    else if (tg.startsWith('delt')) { b0 = B['arm' + L]; b1 = 2; w = 0.6; }
    else if (tg.startsWith('arm')) {
      const a = B['arm' + L], f = B['fore' + L], h = B['hand' + L];
      const t1 = segT(p, a, f), t2 = segT(p, f, h), d1 = len(sub(p, add(J[a], scl(sub(J[f], J[a]), t1)))), d2 = len(sub(p, add(J[f], scl(sub(J[h], J[f]), t2))));
      if (d1 <= d2 && t1 < 0.999) { b0 = a; b1 = f; w = 1 - 0.5 * sstep(0.86, 1.0, t1); if (t1 < 0.12) { b1 = 2; w = 0.75 + 0.25 * sstep(0, 0.12, t1); } }
      else { b0 = f; b1 = t2 < 0.5 ? a : h; w = t2 < 0.5 ? 0.5 + 0.5 * sstep(0.0, 0.14, t2) : 1 - 0.5 * sstep(0.85, 1, t2); }
    } else if (tg.startsWith('hand')) { b0 = B['hand' + L]; }
    else if (tg.startsWith('leg')) {
      const a = B['thigh' + L], k = B['shin' + L], f = B['foot' + L];
      const t1 = segT(p, a, k), t2 = segT(p, k, f), d1 = len(sub(p, add(J[a], scl(sub(J[k], J[a]), t1)))), d2 = len(sub(p, add(J[k], scl(sub(J[f], J[k]), t2))));
      if (d1 <= d2 && t1 < 0.999) { b0 = a; b1 = t1 < 0.15 ? 0 : k; w = t1 < 0.15 ? 0.6 + 0.4 * sstep(0, 0.15, t1) : 1 - 0.5 * sstep(0.85, 1, t1); }
      else { b0 = k; b1 = t2 < 0.5 ? a : f; w = t2 < 0.5 ? 0.5 + 0.5 * sstep(0, 0.12, t2) : 1 - 0.5 * sstep(0.88, 1, t2); }
    } else if (tg.startsWith('foot')) { b0 = B['foot' + L]; }
    sk[i * 4] = b0; sk[i * 4 + 1] = b1; sk[i * 4 + 2] = w;
  }
  m.skin = sk; m.kind = 'pilot'; m.opts = o; m.S = S;
  return m;
}

/* ===================================================================== posing */
// 3x3 rotation helpers (row-major)
const RotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const RotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const RotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (a, b) => { const r = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return r; };
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const eul = (x, y, z) => mm(RotY(y || 0), mm(RotX(x || 0), RotZ(z || 0)));
/** rotation taking unit vector a onto unit vector b */
function align(a, b) {
  const v = cross(a, b), c = dot(a, b);
  if (c < -0.9999) return mm(RotX(PI), I3);
  const k = 1 / (1 + c);
  return [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1], v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0], v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c];
}
/** elbow / knee position for a two-bone chain from s to target t with lengths l1, l2 bending towards pole */
function ik2(s, t, l1, l2, pole) {
  let d = sub(t, s), D = len(d); const maxR = (l1 + l2) * 0.999; if (D > maxR) { t = add(s, scl(d, maxR / D)); d = sub(t, s); D = maxR; }
  D = Math.max(D, Math.abs(l1 - l2) + 1e-3);
  const a = (l1 * l1 - l2 * l2 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), dn = scl(d, 1 / D);
  let pp = sub(pole, scl(dn, dot(pole, dn))); pp = len(pp) < 1e-5 ? [0, 0, 1] : nrm(pp);
  return { e: add(add(s, scl(dn, a)), scl(pp, h)), t };
}

/**
 * Bone matrices for a pose. spec = { root: [x,y,z], yaw, rot: {bone: [rx,ry,rz]}, ik: {handL:{t,pole}, handR, footL, footR}, look }
 * Returns Float32Array(19 * 16) column-major skinning matrices (bind → posed, in the character's local space).
 */
function bones(spec, S) {
  S = S || 1;
  const Jb = BIND.map(p => scl(p, S)), Rw = new Array(19), Pw = new Array(19);
  const rot = spec.rot || {};
  for (let i = 0; i < 19; i++) {
    const r = rot[BN[i]], Rl = r ? eul(r[0], r[1], r[2]) : I3, par = PARENT[i];
    if (par < 0) { Rw[i] = mm(RotY(spec.yaw || 0), Rl); Pw[i] = add(Jb[i], spec.root || [0, 0, 0]); }
    else { Rw[i] = mm(Rw[par], Rl); Pw[i] = add(Pw[par], mv(Rw[par], sub(Jb[i], Jb[par]))); }
  }
  // two-bone IK on arms / legs (targets in character space)
  const ik = spec.ik || {};
  const chain = (a, b, c, tgt, pole) => {
    const l1 = len(sub(Jb[b], Jb[a])), l2 = len(sub(Jb[c], Jb[b]));
    const s = Pw[a], r = ik2(s, tgt, l1, l2, pole);
    const Ra = mm(align(nrm(mv(Rw[a], nrm(sub(Jb[b], Jb[a])))), nrm(sub(r.e, s))), Rw[a]);
    Rw[a] = Ra; Pw[b] = r.e;
    const Rb = mm(align(nrm(mv(Ra, nrm(sub(Jb[c], Jb[b])))), nrm(sub(r.t, r.e))), Ra);
    Rw[b] = Rb; Pw[c] = r.t;
    // end bone keeps the forearm / shin orientation (plus its own local rotation)
    const rl = rot[BN[c]]; Rw[c] = rl ? mm(Rb, eul(rl[0], rl[1], rl[2])) : Rb;
    if (tgt.world !== undefined) Rw[c] = mm(RotY(spec.yaw || 0), RotX(-tgt.world));   // foot pitch in character space (flat on the ground)
  };
  if (ik.handL) chain(B.armL, B.foreL, B.handL, ik.handL.t, ik.handL.pole || [0.6, -0.6, -0.4]);
  if (ik.handR) chain(B.armR, B.foreR, B.handR, ik.handR.t, ik.handR.pole || [-0.6, -0.6, -0.4]);
  if (ik.footL) chain(B.thighL, B.shinL, B.footL, Object.assign(ik.footL.t.slice(), { world: ik.footL.world }), ik.footL.pole || [0, 0.2, 1]);
  if (ik.footR) chain(B.thighR, B.shinR, B.footR, Object.assign(ik.footR.t.slice(), { world: ik.footR.world }), ik.footR.pole || [0, 0.2, 1]);
  // matrices: x' = Rw (x - Jb) + Pw
  const out = new Float32Array(19 * 16);
  for (let i = 0; i < 19; i++) {
    const R = Rw[i], t = sub(Pw[i], mv(R, Jb[i])), o = i * 16;
    out[o] = R[0]; out[o + 1] = R[3]; out[o + 2] = R[6]; out[o + 3] = 0;
    out[o + 4] = R[1]; out[o + 5] = R[4]; out[o + 6] = R[7]; out[o + 7] = 0;
    out[o + 8] = R[2]; out[o + 9] = R[5]; out[o + 10] = R[8]; out[o + 11] = 0;
    out[o + 12] = t[0]; out[o + 13] = t[1]; out[o + 14] = t[2]; out[o + 15] = 1;
  }
  out.Pw = Pw; out.Rw = Rw;
  return out;
}

/* ---------------- clips ---------------- */
/** pose spec for a named pose / clip at time t (seconds). opt.speed for walk/run, opt.seat for vehicles. */
function poseSpec(name, t, opt) {
  opt = opt || {}; const S = opt.S || 1;
  const br = Math.sin(t * 1.5) * 0.025, sway = Math.sin(t * 0.4) * 0.03;
  const rot = { spine: [br * 0.4, 0, 0], chest: [br, 0, 0], neck: [0, 0, 0], head: [-br * 0.6, Math.sin(t * 0.33) * 0.12, 0],
    armL: [0, 0, 0.09], armR: [0, 0, -0.09], foreL: [-0.18, 0, 0], foreR: [-0.18, 0, 0], handL: [0, -1.25, 0], handR: [0, 1.25, 0], pelvis: [0, sway * 0.5, sway * 0.3] };
  const spec = { root: [0, 0, 0], rot, ik: {} };
  const at = (x, y, z) => scl([x, y, z], S);
  switch (name) {
    case 'saluto': { const w = Math.sin(t * 7); spec.ik.handR = { t: at(-0.34 + w * 0.06, 1.78, 0.06), pole: [-1, -0.3, -0.2] }; rot.handR = [0, 0, -0.3 + w * 0.3]; rot.head = [0, -0.12, 0]; break; }
    case 'indica': spec.ik.handR = { t: at(-0.2, 1.42, 0.62), pole: [-1, -0.5, 0] }; rot.chest = [0, -0.15, 0]; rot.head = [0, -0.12, 0]; break;
    case 'pollice': spec.ik.handR = { t: at(-0.16, 1.22, 0.3), pole: [-1, -1, 0] }; rot.handR = [-1.3, 0, 0.2]; break;
    case 'braccia conserte': spec.ik.handL = { t: at(-0.07, 1.25, 0.17), pole: [1, -0.6, 0.3] }; spec.ik.handR = { t: at(0.07, 1.28, 0.15), pole: [-1, -0.6, 0.3] }; rot.handL = [0, -1.4, 0]; rot.handR = [0, 1.4, 0]; break;
    case 'mani sui fianchi': { const w = opt.W || 1; spec.ik.handL = { t: at(0.235 * w, 1.0, -0.05), pole: [1.2, 0.1, -0.8] }; spec.ik.handR = { t: at(-0.235 * w, 1.0, -0.05), pole: [-1.2, 0.1, -0.8] }; rot.handL = [0.2, -0.9, 0.9]; rot.handR = [0.2, 0.9, -0.9]; rot.chest = [-0.04, 0, 0]; break; }
    case 'esulta': { const j = Math.abs(Math.sin(t * 4)) * 0.04; spec.root = at(0, j, 0); spec.ik.handL = { t: at(0.3, 1.95 + j, 0.05), pole: [1, 0, -0.3] }; spec.ik.handR = { t: at(-0.3, 1.95 + j, 0.05), pole: [-1, 0, -0.3] }; rot.head = [-0.2, 0, 0]; break; }
    case 'pensieroso': spec.ik.handR = { t: at(-0.02, 1.53, 0.12), pole: [-1, -1, 0] }; spec.ik.handL = { t: at(-0.05, 1.18, 0.12), pole: [1, -1, 0] }; rot.head = [0.12, -0.2, 0.05]; break;
    case 'cammina': case 'corre': {
      // gait with planted feet: each ankle follows a stance (on the ground, sliding back at walking speed) + swing (lifted arc) path,
      // knees by IK; heel strike → flat foot → toe-off; pelvis bobs, sways over the stance leg and yaws; shoulders counter-rotate
      const run = name === 'corre' || (opt.speed || 0) > 3, f = run ? 1.45 : 0.95, cyc = t * f, L = (run ? 3.79 : 1.526) * S, beta = run ? 0.36 : 0.62, half = L * beta * 0.5;
      const leg = off => { const p = ((cyc + off) % 1 + 1) % 1; let z, y, pitch;
        if (p < beta) { const u = p / beta; z = half - u * 2 * half; y = 0;
          pitch = u < 0.15 ? 0.3 * (1 - u / 0.15) : u > 0.72 ? -(run ? 0.85 : 0.65) * sstep(0.72, 1, u) : 0;
          if (u > 0.72) y = 0.035 * S * sstep(0.72, 1, u); }
        else { const u = (p - beta) / (1 - beta), e = 0.5 - 0.5 * Math.cos(u * PI); z = -half + e * 2 * half;
          y = Math.pow(Math.sin(u * PI), run ? 0.7 : 1.3) * (run ? 0.3 : 0.11) * S + (1 - sstep(0, 0.35, u)) * 0.035 * S;
          pitch = u < 0.5 ? lerp(run ? -0.85 : -0.65, 0.05, u / 0.5) : lerp(0.05, 0.32, (u - 0.5) / 0.5); }
        return { z, y, pitch, a: z / half }; };
      const lL = leg(0), lR = leg(0.5), ph2 = cyc * TAU;
      const bob = run ? -0.035 * S * Math.cos(2 * ph2 - 0.3) - 0.05 * S : 0.018 * S * Math.cos(2 * (ph2 - 0.31 * TAU)) - 0.022 * S;
      const swayX = (run ? 0.01 : 0.022) * S * Math.cos(ph2 - 0.31 * TAU);
      spec.root = [swayX, bob, 0];
      const ank = (sx, l) => [sx * 0.106 * S, 0.088 * S + l.y, -0.022 * S + l.z];
      spec.ik.footL = { t: ank(1, lL), pole: [0.05, 0.1, 1], world: lL.pitch }; spec.ik.footR = { t: ank(-1, lR), pole: [-0.05, 0.1, 1], world: lR.pitch };
      const lean = run ? 0.16 : 0.04, py = (run ? 0.14 : 0.09) * lL.a;
      rot.pelvis = [lean * 0.5, -py, -swayX / S * 1.5]; rot.spine = [lean * 0.4, py * 0.6, 0]; rot.chest = [lean * 0.3 + br * 0.5, py * 1.1, swayX / S]; rot.neck = [0, 0, 0];
      rot.head = [lean * 0.3 + 0.03, -py * 0.5 + Math.sin(t * 0.33) * 0.03, -swayX / S * 0.8];
      // arms: counter-swing (left arm with the right leg), elbows bend more on the forward swing
      const aL = -lR.a, aR = -lL.a, A = run ? 0.75 : 0.36;
      rot.armL = [-A * aL, 0, run ? 0.18 : 0.1]; rot.armR = [-A * aR, 0, run ? -0.18 : -0.1];
      rot.foreL = [run ? -1.15 - 0.3 * Math.max(0, aL) : -0.22 - 0.3 * Math.max(0, aL), run ? 0.3 : 0.05, 0]; rot.foreR = [run ? -1.15 - 0.3 * Math.max(0, aR) : -0.22 - 0.3 * Math.max(0, aR), run ? -0.3 : -0.05, 0];
      rot.handL = [0, -1.25, run ? 0.2 : 0]; rot.handR = [0, 1.25, run ? -0.2 : 0];
      break; }
    case 'salta': rot.thighL = [-0.9, 0, 0.05]; rot.thighR = [-0.4, 0, -0.05]; rot.shinL = [1.3, 0, 0]; rot.shinR = [0.9, 0, 0]; rot.armL = [-0.6, 0, 0.6]; rot.armR = [-0.6, 0, -0.6]; break;
    case 'seduto': case 'barca': {
      // seat geometry in vehicle-local coordinates relative to the seat origin (x = 0 on the seat centre line)
      const st = opt.seat || {}, hip = st.hip || [0, 0.52, -0.56];
      spec.root = sub(hip, scl(BIND[0], S)).map((v, i) => i === 1 ? v + 0.0 : v);
      rot.pelvis = [-0.08, 0, 0]; rot.spine = [0.18, 0, 0]; rot.chest = [0.12 + br * 0.3, 0, 0]; rot.neck = [-0.1, 0, 0]; rot.head = [-0.12, Math.sin(t * 0.5) * 0.06, 0];
      spec.ik.footL = { t: st.footL || [0.12, 0.43, 0.6], pole: [0, 1, 0.4] }; spec.ik.footR = { t: st.footR || [-0.12, 0.43, 0.6], pole: [0, 1, 0.4] };
      rot.footL = [-0.4, 0, 0]; rot.footR = [-0.4, 0, 0];
      const steer = opt.steer || 0, wc = st.wheel || [0, 0.86, 0.05], wr = st.wheelR || 0.165;
      const hand = (s) => { const a = (s > 0 ? 0.15 : PI - 0.15) + steer * 1.3; return add(wc, [Math.cos(a) * wr, Math.sin(a) * wr * 0.95, -Math.sin(a) * wr * 0.4]); };
      spec.ik.handL = { t: hand(1), pole: [1, -0.8, -0.3] }; spec.ik.handR = { t: hand(-1), pole: [-1, -0.8, -0.3] };
      rot.handL = [0.2, 0, 0.3]; rot.handR = [0.2, 0, -0.3];
      // driving: head turns into the corner and glances around, the body is pushed back by acceleration and sideways by the turn
      const sp = opt.speed || 0, acc = clamp(opt.accel || 0, -12, 12), lat = clamp(steer * Math.min(1, sp / 15), -1, 1);
      const glance = Math.sin(t * 0.23) > 0.85 ? Math.sin(t * 0.23 * 7) * 0.5 : 0;
      rot.head = [-0.12 + Math.sin(t * 0.9) * 0.02, steer * 0.45 + glance + Math.sin(t * 0.5) * 0.06, -lat * 0.08];
      rot.spine = [0.18 - acc * 0.012, 0, lat * 0.1]; rot.chest = [0.12 + br * 0.3 - acc * 0.008, steer * 0.08, lat * 0.08];
      // stopped for a while: one hand leaves the wheel (adjusts the collar, then a little wave)
      if (sp < 0.5) { const ph = (t % 14) / 14; if (ph > 0.78) { const k = Math.sin((ph - 0.78) / 0.22 * PI), w = Math.sin(t * 8) * 0.04;
        spec.ik.handR = { t: add(scl(hand(-1), 1 - k), scl(add(hip, [-0.28 + w, 0.75, 0.18]), k)), pole: [-1, -0.3, -0.4] }; rot.head = [-0.1, -0.35 * k, 0]; } }
      delete rot.armL; delete rot.armR;
      break; }
    case 'moto': {
      // racing crouch on the KAGE VOLT: hip on the seat, feet on the pegs, hands on the grips, chin down behind the screen
      spec.root = sub([0, 0.88 * 1, -0.34], scl(BIND[0], S));
      rot.pelvis = [0.45, 0, 0]; rot.spine = [0.3, 0, 0]; rot.chest = [0.22 + br * 0.3, 0, 0]; rot.neck = [-0.45, 0, 0]; rot.head = [-0.35, Math.sin(t * 0.6) * 0.05, 0];
      const steer = opt.steer || 0;
      spec.ik.footL = { t: [0.19, 0.42, -0.3], pole: [0.3, 1, 0.6] }; spec.ik.footR = { t: [-0.19, 0.42, -0.3], pole: [-0.3, 1, 0.6] };
      spec.ik.handL = { t: [0.33, 1.02, 0.42 - steer * 0.05], pole: [1, -0.4, -0.6] }; spec.ik.handR = { t: [-0.33, 1.02, 0.42 + steer * 0.05], pole: [-1, -0.4, -0.6] };
      rot.handL = [0.4, 0, 0.6]; rot.handR = [0.4, 0, -0.6]; rot.footL = [-0.3, 0, 0]; rot.footR = [-0.3, 0, 0];
      // hang off into the corners, tuck in on the boost, sit up and put a foot down when stopped
      const sp = opt.speed || 0, lean = clamp(opt.lean || 0, -0.8, 0.8), tuck = opt.boost ? 1 : 0;
      rot.pelvis = [0.45 + tuck * 0.12, 0, -lean * 0.35]; rot.spine = [0.3 + tuck * 0.1, 0, -lean * 0.25]; rot.chest = [0.22 + br * 0.3 + tuck * 0.08, 0, 0];
      rot.neck = [-0.45 - tuck * 0.15, steer * 0.2, lean * 0.3]; rot.head = [-0.35 - tuck * 0.1, steer * 0.3 + Math.sin(t * 0.6) * 0.05, lean * 0.35];
      spec.root = add(spec.root, [-lean * 0.08, -tuck * 0.03, 0]);
      if (sp < 0.6) { rot.pelvis = [0.18, 0, 0]; rot.spine = [0.1, 0, 0]; rot.neck = [-0.15, 0, 0]; rot.head = [-0.1, Math.sin(t * 0.4) * 0.3, 0];
        spec.ik.footL = { t: [0.36, 0.03, -0.12], pole: [0.5, 1, 0.6] }; }
      delete rot.armL; delete rot.armR;
      break; }
    case 'timone': {
      const steer = opt.steer || 0, wc = [0, 1.22 * S, 0.42 * S], a1 = 0.3 + steer * 2, a2 = PI - 0.3 + steer * 2;
      spec.ik.handL = { t: add(wc, [Math.cos(a1) * 0.2, Math.sin(a1) * 0.2, 0]), pole: [1, -0.7, -0.5] };
      spec.ik.handR = { t: add(wc, [Math.cos(a2) * 0.2, Math.sin(a2) * 0.2, 0]), pole: [-1, -0.7, -0.5] };
      rot.thighL = [-0.12, 0, 0.06]; rot.thighR = [0.08, 0, -0.06]; rot.shinL = [0.1, 0, 0]; rot.shinR = [0.18, 0, 0];
      // the captain rides the swell and looks up at the sails now and then
      const sw = Math.sin(t * 0.7) * 0.05, up = Math.sin(t * 0.17) > 0.8 ? -0.35 : -0.05;
      rot.pelvis = [0, 0, sw]; rot.spine = [0.05, 0, -sw * 0.6]; rot.head = [up, Math.sin(t * 0.3) * 0.25 + steer * 0.3, -sw * 0.4];
      break; }
  }
  return spec;
}
function pose(name, t, opt, S) { return bones(poseSpec(name, t, Object.assign({ S: S || 1 }, opt || {})), S || 1); }

function load() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem('kagePilot') || '{}')); } catch (e) { return Object.assign({}, DEF); } }
function save(c) { try { localStorage.setItem('kagePilot', JSON.stringify(c)); } catch (e) { } }
/** where the pilot sits / stands in each vehicle: [x, y, z, yaw, pose, seat geometry] (vehicle-local) */
const SEATS = {
  car: [-0.40, 0, 0, 0, 'seduto', { hip: [0, 0.52, -0.56], footL: [0.12, 0.43, 0.6], footR: [-0.12, 0.43, 0.6], wheel: [0, 0.86, 0.06], wheelR: 0.165 }],
  boat: [0.34, 0.1, -0.5, 0, 'seduto', { hip: [0, 0.62, -0.5], footL: [0.13, 0.48, 0.25], footR: [-0.13, 0.48, 0.25], wheel: [0, 1.0, 0.0], wheelR: 0.18 }],
  galleon: [0, 6.62, -12.4, 0, 'timone', null],
  moto: [0, 0, 0, 0, 'moto', null],
  hover: [0, 0.12, 0.25, 0, 'seduto', { hip: [0, 0.98, -0.15], footL: [0.13, 0.72, 0.42], footR: [-0.13, 0.72, 0.42], wheel: [0, 1.28, 0.38], wheelR: 0.17 }],
  sub: [0, -0.92, 2.25, 0, 'seduto', { hip: [0, 0.55, -0.38], footL: [0.13, 0.42, 0.3], footR: [-0.13, 0.42, 0.3], wheel: [0, 0.86, 0.12], wheelR: 0.12 }]
};
SEATS.ufo = [0, 1.57, 5.3, 0, 'seduto', SEATS.hover[5]];

const MAX_BONES = 19;
root.KagePilot = { ALIEN, MINE, build, pose, poseSpec, bones, OPTS, DEF, TITLES, label, load, save, SEATS, SKIN, HAIRC, BN, MAX_BONES };
})(typeof window !== 'undefined' ? window : globalThis);
