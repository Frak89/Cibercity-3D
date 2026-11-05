/* KAGE pilot: a parametric, stylised driver / pilot / captain (body, face, hair, beard, glasses, racing suit, helmet) built
 * from a joint skeleton so the same person can stand in the showroom or sit in the KAGE GT, the RIPTIDE and at the LEVIATHAN's helm.
 * Meshes use the KAGE fleet vertex layout (vehicle.vert / vehicle.frag). Character faces +z; +x is the character's left. */
(function (root) {
'use strict';
const KF = root.KageFleet;
const { MB, M, T, RX, RY, RZ } = KF;
const lerp = (a, b, t) => a + (b - a) * t, add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s], len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => scl(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mat = (c, e, slot) => ({ c, e: e || 0, slot: slot || 0, mode: 0 });

const SKIN = { chiara: [0.93, 0.78, 0.68], rosata: [0.9, 0.68, 0.58], olivastra: [0.78, 0.6, 0.45], ambrata: [0.66, 0.46, 0.32], scura: [0.45, 0.3, 0.2], ebano: [0.28, 0.18, 0.13] };
const HAIRC = { nero: [0.03, 0.025, 0.02], castano_scuro: [0.13, 0.07, 0.04], castano: [0.3, 0.17, 0.08], biondo: [0.75, 0.58, 0.32], rosso: [0.55, 0.18, 0.06], grigio: [0.5, 0.5, 0.5], bianco: [0.86, 0.86, 0.84], blu_neon: [0.1, 0.4, 1.0], viola_neon: [0.6, 0.2, 1.0] };
const EYEC = { marroni: [0.25, 0.13, 0.05], nocciola: [0.42, 0.28, 0.1], verdi: [0.2, 0.42, 0.2], azzurri: [0.25, 0.5, 0.8], grigi: [0.45, 0.5, 0.52] };
const OPTS = {
  height: [1.62, 1.68, 1.72, 1.76, 1.80, 1.84, 1.88, 1.94], build: ['snello', 'atletico', 'robusto'], skin: Object.keys(SKIN),
  face: ['ovale', 'tondo', 'squadrato', 'allungato'], nose: ['piccolo', 'medio', 'pronunciato'],
  hair: ['corti', 'rasati', 'ciuffo', 'ricci', 'lunghi', 'coda', 'cresta', 'calvo'], hairColor: Object.keys(HAIRC),
  beard: ['nessuna', 'accennata', 'corta', 'piena', 'pizzetto', 'baffi'], eyes: Object.keys(EYEC), glasses: ['nessuno', 'tondi', 'squadrati', 'visore'],
  suit: ['nero', 'bianco', 'rosso', 'blu', 'oro', 'viola', 'argento'], accent: ['ciano', 'magenta', 'ambra', 'lime', 'bianco', 'rosso'], helmet: [false, true],
  pose: ['in piedi', 'mani sui fianchi', 'braccia conserte', 'saluto']
};
const DEF = { height: 1.80, build: 'atletico', skin: 'chiara', face: 'ovale', nose: 'medio', hair: 'corti', hairColor: 'castano_scuro', beard: 'accennata', eyes: 'marroni',
  glasses: 'nessuno', suit: 'nero', accent: 'ciano', helmet: false, pose: 'in piedi', inVehicle: true };
const TITLES = { height: 'ALTEZZA', build: 'CORPORATURA', skin: 'CARNAGIONE', face: 'VISO', nose: 'NASO', hair: 'CAPELLI', hairColor: 'COLORE CAPELLI', beard: 'BARBA',
  eyes: 'OCCHI', glasses: 'OCCHIALI', suit: 'TUTA', accent: 'COLORE LED', helmet: 'CASCO', pose: 'POSA' };
function label(key, v) {
  if (key === 'height') return v.toFixed(2).replace('.', ',') + ' m';
  if (key === 'helmet') return v ? 'INDOSSATO' : 'TOLTO';
  if (key === 'suit') return KF.COLOR_NAMES[v] || v.toUpperCase();
  if (key === 'accent') return KF.COLOR_NAMES[v] || v.toUpperCase();
  return String(v).replace('_', ' ').toUpperCase();
}

/* ---------------- skeleton ---------------- */
// joints for a 1.78 m person; poses override arms / legs; seated poses are absolute (they fit the seats)
function skeleton(pose) {
  const J = {
    pelvis: [0, 0.98, 0], chest: [0, 1.34, 0.0], neck: [0, 1.5, 0.0], head: [0, 1.645, 0.01],
    hipL: [0.1, 0.95, 0], kneeL: [0.105, 0.52, 0.025], ankleL: [0.11, 0.09, -0.01], toeL: [0.11, 0.03, 0.15],
    shL: [0.2, 1.44, -0.01], elL: [0.25, 1.16, -0.02], wrL: [0.27, 0.9, 0.03]
  };
  const mir = k => { const s = J[k + 'L']; J[k + 'R'] = [-s[0], s[1], s[2]]; };
  ['hip', 'knee', 'ankle', 'toe', 'sh', 'el', 'wr'].forEach(mir);
  if (pose === 'mani sui fianchi') { J.elL = [0.34, 1.14, -0.05]; J.wrL = [0.17, 0.99, 0.02]; J.elR = [-0.34, 1.14, -0.05]; J.wrR = [-0.17, 0.99, 0.02]; }
  if (pose === 'braccia conserte') { J.elL = [0.24, 1.18, 0.13]; J.wrL = [-0.12, 1.28, 0.17]; J.elR = [-0.24, 1.2, 0.12]; J.wrR = [0.13, 1.3, 0.15]; }
  if (pose === 'saluto') { J.elR = [-0.38, 1.5, 0.02]; J.wrR = [-0.42, 1.8, 0.05]; }
  if (pose === 'timone') { J.elL = [0.25, 1.2, 0.25]; J.wrL = [0.17, 1.22, 0.45]; J.elR = [-0.25, 1.2, 0.25]; J.wrR = [-0.17, 1.22, 0.45]; J.kneeL[2] = 0.06; J.ankleR[2] = -0.12; J.kneeR[2] = -0.05; }
  if (pose === 'seduto') {         // KAGE GT driver seat (origin = seat centre line at floor level of the cabin model)
    Object.assign(J, { pelvis: [0, 0.52, -0.56], chest: [0, 0.84, -0.66], neck: [0, 0.98, -0.6], head: [0, 1.05, -0.47],
      hipL: [0.1, 0.5, -0.54], kneeL: [0.11, 0.6, -0.08], ankleL: [0.12, 0.42, 0.58], toeL: [0.12, 0.44, 0.74],
      shL: [0.2, 0.93, -0.66], elL: [0.27, 0.74, -0.38], wrL: [0.17, 0.86, 0.04] });
    ['hip', 'knee', 'ankle', 'toe', 'sh', 'el', 'wr'].forEach(mir);
  }
  return J;
}

/* ---------------- mesh helpers ---------------- */
/** tapered limb between two joints with rounded ends */
function limb(mb, a, b, r0, r1, m, seg) {
  mb.rod(a, b, r0, seg, m, r1);
  mb.ellipsoid(a[0], a[1], a[2], r0, r0, r0, seg, Math.max(4, seg / 2), m);
  mb.ellipsoid(b[0], b[1], b[2], r1, r1, r1, seg, Math.max(4, seg / 2), m);
}
/** loft along the axis p0 → p1 with elliptic sections (w = half width along x-ish, d = half depth) */
function trunk(mb, p0, p1, secs, m, n) {
  const ax = nrm(sub(p1, p0)), side = nrm(cross([0, 0, 1], ax)), fwd = nrm(cross(ax, side));
  const rows = secs.map(([t, w, d, dz]) => { const c = add(add(p0, scl(sub(p1, p0), t)), scl(fwd, dz || 0)), r = [];
    for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2; r.push(add(c, add(scl(side, Math.sin(a) * w), scl(fwd, Math.cos(a) * d)))); } return r; });
  mb.grid(rows, m, false);
  // caps
  const cap = (row, c) => { const ci = mb.v(c, m); const ix = row.map(p => mb.v(p, m)); for (let k = 0; k + 1 < ix.length; k++) mb.tri(ci, ix[k], ix[k + 1]); };
  cap(rows[0], add(p0, scl(fwd, secs[0][3] || 0))); cap(rows[rows.length - 1], add(p1, scl(fwd, secs[secs.length - 1][3] || 0)));
}
/** part of an ellipsoid: v from v0 to v1 (0 = top, 1 = bottom), u full turn; optional back-only / front-only via u range */
function shell(mb, c, r, v0, v1, m, su, sv, u0, u1) {
  u0 = u0 === undefined ? 0 : u0; u1 = u1 === undefined ? 1 : u1;
  const rows = [];
  for (let j = 0; j <= sv; j++) { const v = lerp(v0, v1, j / sv) * Math.PI, row = [];
    for (let k = 0; k <= su; k++) { const u = lerp(u0, u1, k / su) * Math.PI * 2; row.push([c[0] + Math.sin(u) * Math.sin(v) * r[0], c[1] + Math.cos(v) * r[1], c[2] + Math.cos(u) * Math.sin(v) * r[2]]); }
    rows.push(row); }
  mb.grid(rows, m, true);
}

function buildPilot(cfg, pose, lod) {
  const o = Object.assign({}, DEF, cfg || {}), mb = new MB(), lo = lod === 'lo', U = lod === 'ultra' ? 2 : 1;
  const seg = lo ? 6 : 10 * U, J = skeleton(pose || o.pose);
  const seated = (pose || o.pose) === 'seduto';
  const S = seated ? 1 : o.height / 1.78;            // seated: fixed to the seat (the cabin does not grow)
  const B = { snello: 0.88, atletico: 1, robusto: 1.18 }[o.build] || 1;
  for (const k in J) J[k] = seated ? J[k] : scl(J[k], S);
  const skin = mat(KF.COLORS[o.skin] || SKIN[o.skin] || SKIN.chiara), suitC = KF.COLORS[o.suit] || [0.05, 0.05, 0.06];
  const suit = mat(suitC, 0, 1), dark = mat([0.04, 0.04, 0.045]), ledC = KF.LEDS[o.accent] || [0, 1, 0.9], led = mat(ledC, 1.0, 3), stripe = mat(ledC.map(v => v * 0.7), 0.25, 3);
  const hairM = mat(HAIRC[o.hairColor] || HAIRC.nero, /neon/.test(o.hairColor) ? 0.35 : 0);
  // legs (suit), boots
  for (const s of ['L', 'R']) {
    limb(mb, J['hip' + s], J['knee' + s], 0.085 * B, 0.062 * B, suit, seg);
    limb(mb, J['knee' + s], J['ankle' + s], 0.06 * B, 0.045, suit, seg);
    mb.rod(add(J['hip' + s], [s === 'L' ? 0.07 * B : -0.07 * B, 0, 0]), add(J['knee' + s], [s === 'L' ? 0.055 * B : -0.055 * B, 0, 0]), 0.012, 4, stripe);
    const a = J['ankle' + s], t = J['toe' + s];
    mb.push(M(T((a[0] + t[0]) / 2, (a[1] + t[1]) / 2 - 0.02, (a[2] + t[2]) / 2), RY(0), RX(-Math.atan2(t[1] - a[1], t[2] - a[2]))));
    mb.box(0, 0, 0, 0.1, 0.09, len(sub(t, a)) + 0.12, dark); mb.pop();
  }
  // torso: hips → waist → chest → shoulders, along pelvis → neck
  trunk(mb, J.pelvis, J.neck, [[0, 0.16 * B, 0.11 * B], [0.22, 0.15 * B, 0.1 * B], [0.45, 0.165 * B, 0.115 * B, 0.01], [0.72, 0.2 * B, 0.12 * B, 0.01], [0.92, 0.17 * B, 0.1 * B], [1, 0.07, 0.06]], suit, seg + 4);
  // chest badge + LED piping on the suit
  { const c = add(scl(add(J.chest, J.neck), 0.5), [0, -0.04, 0.12 * B + 0.004]); mb.push(T(c[0], c[1], c[2])); mb.box(0.07, 0, 0, 0.06, 0.035, 0.008, led); mb.pop();
    mb.rod(add(J.pelvis, [0.15 * B, 0, 0.02]), add(J.shL, [-0.03, -0.02, 0.06 * B]), 0.009, 4, stripe); mb.rod(add(J.pelvis, [-0.15 * B, 0, 0.02]), add(J.shR, [0.03, -0.02, 0.06 * B]), 0.009, 4, stripe); }
  // arms, gloves
  for (const s of ['L', 'R']) {
    limb(mb, J['sh' + s], J['el' + s], 0.058 * B, 0.048 * B, suit, seg);
    limb(mb, J['el' + s], J['wr' + s], 0.046 * B, 0.036, suit, seg);
    const w = J['wr' + s], d = nrm(sub(w, J['el' + s]));
    mb.ellipsoid(w[0] + d[0] * 0.06, w[1] + d[1] * 0.06, w[2] + d[2] * 0.06, 0.045, 0.05, 0.045, seg, Math.max(4, seg / 2), dark);
    mb.rod(add(J['sh' + s], [0, 0.04, 0]), add(J['el' + s], [0, 0.035, 0]), 0.01, 4, stripe);
  }
  // neck
  mb.rod(J.neck, add(J.head, [0, -0.07, -0.02]), 0.052, seg, skin);
  // head
  const h = J.head, shape = { ovale: [0.088, 0.112, 0.1], tondo: [0.095, 0.104, 0.1], squadrato: [0.094, 0.108, 0.1], allungato: [0.084, 0.122, 0.098] }[o.face] || [0.088, 0.112, 0.1];
  const hs = seated ? 1 : Math.sqrt(S);
  const r = scl(shape, hs);
  if (o.helmet) {
    mb.ellipsoid(h[0], h[1] + 0.01, h[2] - 0.005, r[0] * 1.45, r[1] * 1.35, r[2] * 1.4, seg + 6, seg, mat(suitC, 0, 1));
    shell(mb, [h[0], h[1] + 0.005, h[2] + 0.012], [r[0] * 1.42, r[1] * 0.62, r[2] * 1.4], 0.32, 0.68, mat([0.02, 0.03, 0.05], 0, 4), seg, 4, -0.2, 0.2);
    mb.box(h[0], h[1] + r[1] * 1.15, h[2] - 0.02, 0.02, 0.02, r[2] * 2.2, led);
    return finish(mb, o);
  }
  mb.ellipsoid(h[0], h[1], h[2], r[0], r[1], r[2], seg + 6, seg, skin);
  if (o.face === 'squadrato') mb.box(h[0], h[1] - r[1] * 0.62, h[2] + r[2] * 0.25, r[0] * 1.5, r[1] * 0.45, r[2] * 1.2, skin);
  // jaw / chin
  mb.ellipsoid(h[0], h[1] - r[1] * 0.72, h[2] + r[2] * 0.38, r[0] * 0.55, r[1] * 0.3, r[2] * 0.5, seg, 6, skin);
  // ears
  for (const sx of [-1, 1]) mb.ellipsoid(h[0] + sx * r[0] * 0.98, h[1] - 0.005, h[2] - 0.005, 0.014, 0.03, 0.022, 6, 5, skin);
  // nose
  { const nl = { piccolo: 0.026, medio: 0.034, pronunciato: 0.044 }[o.nose] || 0.034;
    mb.ellipsoid(h[0], h[1] - r[1] * 0.16, h[2] + r[2] * 0.9 + nl * 0.25, 0.013, 0.032, nl * 0.55, 8, 6, skin);
    mb.ellipsoid(h[0], h[1] - r[1] * 0.36, h[2] + r[2] * 0.9 + nl * 0.42, 0.017, 0.013, 0.013, 8, 5, skin); }
  // eyes, brows, mouth
  const eyeC = mat(EYEC[o.eyes] || EYEC.marroni);
  for (const sx of [-1, 1]) {
    const ex = h[0] + sx * r[0] * 0.38, ey = h[1] + r[1] * 0.12, ez = h[2] + r[2] * 0.82;
    mb.ellipsoid(ex, ey, ez, 0.016, 0.01, 0.008, 8, 5, mat([0.92, 0.92, 0.9]));
    mb.ellipsoid(ex, ey, ez + 0.006, 0.0075, 0.0075, 0.004, 8, 5, eyeC);
    mb.push(M(T(ex, ey + 0.026, ez + 0.006), RZ(sx * 0.12))); mb.box(0, 0, 0, 0.034, 0.008, 0.01, hairM); mb.pop();
  }
  mb.box(h[0], h[1] - r[1] * 0.5, h[2] + r[2] * 0.9, 0.038, 0.006, 0.006, mat([0.5, 0.22, 0.2]));
  // hair
  const hr = [r[0] * 1.07, r[1] * 1.06, r[2] * 1.07], top = [h[0], h[1] + 0.006, h[2] - 0.004];
  const capV = o.hair === 'rasati' ? 0.34 : 0.38;
  if (o.hair !== 'calvo') {
    const scal = o.hair === 'rasati' ? [r[0] * 1.02, r[1] * 1.02, r[2] * 1.02] : hr;
    shell(mb, top, scal, 0, capV, hairM, seg + 6, Math.max(3, seg / 2));
    shell(mb, top, scal, capV, 0.62, hairM, seg + 6, 2, 0.32, 0.68);                     // back of the head
    if (o.hair !== 'rasati' && o.hair !== 'cresta') for (const sx of [-1, 1]) shell(mb, top, scal, capV, 0.56, hairM, 4, 2, sx > 0 ? 0.2 : 0.7, sx > 0 ? 0.3 : 0.8);   // sideburns
  }
  if (o.hair === 'ciuffo') mb.ellipsoid(h[0] + 0.01, h[1] + r[1] * 0.9, h[2] + r[2] * 0.55, r[0] * 0.75, r[1] * 0.32, r[2] * 0.45, seg, 6, hairM);
  if (o.hair === 'ricci') for (let k = 0; k < (lo ? 8 : 26); k++) { const a = k * 2.39996, v = 0.15 + (k % 7) / 7 * 0.32; const p = [top[0] + Math.sin(a) * Math.sin(v * Math.PI) * hr[0], top[1] + Math.cos(v * Math.PI) * hr[1], top[2] + Math.cos(a) * Math.sin(v * Math.PI) * hr[2]];
    mb.ellipsoid(p[0], p[1], p[2], 0.03, 0.028, 0.03, 6, 4, hairM); }
  if (o.hair === 'lunghi') { mb.ellipsoid(h[0], h[1] - 0.09, h[2] - r[2] * 0.75, r[0] * 1.08, 0.17, 0.06, seg, 6, hairM); for (const sx of [-1, 1]) mb.ellipsoid(h[0] + sx * r[0] * 0.92, h[1] - 0.08, h[2] - 0.01, 0.03, 0.13, 0.07, 6, 5, hairM); }
  if (o.hair === 'coda') { mb.rod([h[0], h[1] + 0.02, h[2] - r[2] * 1.02], [h[0], h[1] - 0.17, h[2] - r[2] * 1.4], 0.024, 6, hairM, 0.012); mb.box(h[0], h[1] + 0.02, h[2] - r[2] * 1.03, 0.04, 0.02, 0.02, led); }
  if (o.hair === 'cresta') mb.box(h[0], h[1] + r[1] * 1.02, h[2], 0.03, 0.07, r[2] * 1.9, hairM, [1, 0.6]);
  // beard
  if (o.beard !== 'nessuna') {
    const bc = o.beard === 'accennata' ? mat((HAIRC[o.hairColor] || HAIRC.nero).map((v, i) => lerp(v, skin.c[i], 0.68))) : hairM;
    if (o.beard === 'accennata' || o.beard === 'corta' || o.beard === 'piena') {
      const f = o.beard === 'piena' ? 1.1 : o.beard === 'corta' ? 1.04 : 1.012;
      shell(mb, [h[0], h[1] - 0.01, h[2] + 0.004], [r[0] * f, r[1] * f, r[2] * f], 0.6, 0.98, bc, seg + 4, 3, -0.27, 0.27);
      mb.ellipsoid(h[0], h[1] - r[1] * 0.74, h[2] + r[2] * 0.42, r[0] * 0.6 * f, r[1] * 0.33 * f, r[2] * 0.55 * f, seg, 5, bc);
      if (o.beard === 'piena') mb.ellipsoid(h[0], h[1] - r[1] * 0.95, h[2] + r[2] * 0.42, r[0] * 0.5, r[1] * 0.22, r[2] * 0.4, seg, 5, bc);
    }
    if (o.beard === 'pizzetto') mb.ellipsoid(h[0], h[1] - r[1] * 0.8, h[2] + r[2] * 0.62, r[0] * 0.28, r[1] * 0.22, r[2] * 0.3, 8, 5, bc);
    if (o.beard !== 'accennata') mb.box(h[0], h[1] - r[1] * 0.4, h[2] + r[2] * 0.92, 0.055, 0.012, 0.012, bc);
  }
  // glasses
  if (o.glasses !== 'nessuno') {
    const gy = h[1] + r[1] * 0.12, gz = h[2] + r[2] * 0.93, fr = mat([0.05, 0.05, 0.06]);
    if (o.glasses === 'visore') { mb.box(h[0], gy, gz, r[0] * 2.05, 0.034, 0.012, led); }
    else for (const sx of [-1, 1]) {
      const cx = h[0] + sx * r[0] * 0.38;
      if (o.glasses === 'tondi') { mb.push(M(T(cx, gy, gz), RX(Math.PI / 2))); mb.torus(0.019, 0.0025, 14, 3, fr); mb.pop(); }
      else { mb.box(cx, gy + 0.016, gz, 0.042, 0.004, 0.004, fr); mb.box(cx, gy - 0.016, gz, 0.042, 0.004, 0.004, fr); mb.box(cx + 0.021, gy, gz, 0.004, 0.034, 0.004, fr); mb.box(cx - 0.021, gy, gz, 0.004, 0.034, 0.004, fr); }
      mb.box(cx, gy, gz + 0.001, 0.036, 0.028, 0.002, mat([0.05, 0.08, 0.1], 0, 4));
      mb.box(h[0] + sx * r[0] * 0.98, gy, h[2] + 0.01, 0.004, 0.004, r[2] * 1.7, fr);
    }
    if (o.glasses !== 'visore') mb.box(h[0], gy, gz, 0.02, 0.004, 0.004, fr);
  }
  return finish(mb, o);
}
function finish(mb, o) { const m = mb.finish(); m.kind = 'pilot'; m.opts = o; return m; }
function load() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem('kagePilot') || '{}')); } catch (e) { return Object.assign({}, DEF); } }
function save(c) { try { localStorage.setItem('kagePilot', JSON.stringify(c)); } catch (e) { } }
/** where the pilot sits / stands in each vehicle (vehicle-local transform: x, y, z, yaw, pose) */
const SEATS = { car: [-0.40, 0, 0, 0, 'seduto'], boat: [0.34, 0.12, -0.55, 0, 'seduto'], galleon: [0, 6.62, -12.4, 0, 'timone'] };
root.KagePilot = { build: buildPilot, OPTS, DEF, TITLES, label, load, save, SEATS, SKIN, HAIRC };
})(typeof window !== 'undefined' ? window : globalThis);
