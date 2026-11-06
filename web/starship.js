/* KAGE ODYSSEY (KX-01): an original deep-space starship — long lens-shaped command hull, engineering hull, two warp nacelles —
 * with five walkable decks, the garage miniature, the crew badge, planets, star systems and landing sites.
 * Same vertex layout as web/vehicles.js; every primitive has a part name for the OBJ export. Local metres, +Y up, +Z bow. */
(function (root) {
'use strict';
const KF = root.KageFleet, KX = root.KageXeno, MB = KF.MB, T = KF.T, RX = KF.RX, RY = KF.RY, RZ = KF.RZ, M = KF.M, PI = Math.PI, TAU = PI * 2;
const FM3 = (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
const mat = (c, e, slot, mode, a) => ({ c, e: e || 0, slot: slot || 0, mode: mode || 0, a: a || [0, 0, 0] });
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const Q = lod => lod === 'lo' ? 0.5 : lod === 'ultra' ? 3 : 1.4;
const FONT = { K: '10001100101010011000101001001010001', A: '01110100011000111111100011000110001', G: '01111100001000010111100011000101111', E: '11111100001000011110100001000011111',
  O: '01110100011000110001100011000101110', D: '11110100011000110001100011000111110', Y: '10001100010101000100001000010000100', S: '01111100001000001110000010000111110',
  X: '10001100010101000100010101000110001', '-': '00000000000000011111000000000000000', '0': '01110100111010110101101011100101110', '1': '00100011000010000100001000010001110', ' ': '0'.repeat(35) };
function text(mb, str, x0, y0, z0, px, m, dir) {   // pixel letters on a plane facing +x (dir 1) or -x (dir -1), reading along z
  [...str].forEach((ch, i) => { const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '1') mb.box(x0, y0 + (6 - r) * px, z0 - dir * (i * 6 + c) * px, 0.06, px * 0.9, px * 0.9, m); });
}

/* ---------------- options ---------------- */
const SHIP_OPTS = { hull: ['perla', 'grafite', 'avorio'], accent: ['oro', 'argento', 'nero'], warp: ['ciano', 'viola', 'ambra'], view: ['esterno', 'ponte', 'teletrasporto', 'astrolab', 'mensa', 'ingegneria'] };
const SHIP_NAMES = { hull: { perla: 'PERLA', grafite: 'GRAFITE', avorio: 'AVORIO' }, view: { esterno: 'ESTERNO', ponte: 'PONTE 1 · PLANCIA', teletrasporto: 'PONTE 2 · TELETRASPORTO', astrolab: 'PONTE 3 · ASTROLAB', mensa: 'PONTE 4 · MENSA E PORTELLO', ingegneria: 'PONTE 5 · INGEGNERIA' } };
const SHIP_DEF = { hull: 'perla', accent: 'oro', warp: 'ciano', view: 'esterno' };
const HULLC = { perla: [0.78, 0.8, 0.84], grafite: [0.24, 0.25, 0.28], avorio: [0.86, 0.82, 0.72] };
const WARPC = { ciano: [0.2, 0.85, 1], viola: [0.65, 0.35, 1], ambra: [1, 0.6, 0.15] };
/** decks: floor height, room box, title; the lift is at (0, LIFT_Z) on every deck */
const LIFT_Z = 4;
const DECKS = [
  { id: 'ponte', n: 1, y: 6.6, title: 'PONTE 1 · PLANCIA', round: 10, cz: 14 },
  { id: 'teletrasporto', n: 2, y: 2.8, title: 'PONTE 2 · TELETRASPORTO', box: [-12, 12, 1, 25] },
  { id: 'astrolab', n: 3, y: -0.8, title: 'PONTE 3 · ASTROLAB', box: [-12, 12, 1, 25] },
  { id: 'mensa', n: 4, y: -4.4, title: 'PONTE 4 · MENSA E PORTELLO', box: [-12, 12, 1, 25] },
  { id: 'ingegneria', n: 5, y: -9.2, title: 'PONTE 5 · INGEGNERIA', box: [-10, 10, 1, 25] }];
const RIG = { len: 150, pads: [[0, 21], [-1.6, 20.1], [1.6, 20.1], [-1.6, 22.2], [1.6, 22.2], [0, 23.2]], helm: [0, 12.5], chair: [0, 11.6], astro: [0, 13], airlock: [12, 20], core: [0, 15], H: 3.4 };

/* ---------------- exterior ---------------- */
function buildStarship(o, lod) {
  o = Object.assign({}, SHIP_DEF, o || {}); lod = lod || o.lod;
  const mb = new MB(), q = Q(lod), N = k => Math.max(8, Math.round(k * q));
  const hc = HULLC[o.hull] || HULLC.perla, P = mat(hc, 0, 1), Pd = mat(hc.map(v => v * 0.72), 0, 1), A = mat(KF.COLORS[o.accent] || KF.COLORS.oro, 0, 2), dark = mat([0.05, 0.055, 0.065]);
  const wc = WARPC[o.warp] || WARPC.ciano, W = mat(wc, 1.4, 3), Wm = mat([1, 0.3, 0.75], 1.5, 3), win = mat([1, 0.9, 0.7], 1.1, 3), G = mat([0.06, 0.09, 0.12], 0, 4);
  // command hull: a long lens, pointed bow, wide round stern (sections along z, superellipse ex 2.4)
  mb.part = 'scafo_comando';
  const sec = z => { const t = (z + 40) / 105; const w = 30 * Math.pow(Math.sin(PI * clamp(t, 0, 1) * 0.92 + 0.08), 0.8) * (1 - 0.35 * sstep(0.55, 1, t)), h = 6.6 * Math.pow(Math.sin(PI * clamp(t, 0, 1)), 0.55); return [w, h]; };
  const rows = [], nz = N(36), na = N(48);
  for (let j = 0; j <= nz; j++) { const z = lerp(-40, 65, j / nz), [w, h] = sec(z), row = [];
    for (let k = 0; k <= na; k++) { const a = k / na * TAU, s = Math.sin(a), c = Math.cos(a), e = 2 / 2.6;
      row.push([Math.sign(s) * Math.pow(Math.abs(s), e) * w, Math.sign(c) * Math.pow(Math.abs(c), e) * h * (c > 0 ? 1 : 0.75), z]); }
    rows.push(row); }
  mb.grid(rows, P, false);
  // the upper terrace: a second, narrower lens that gives the hull its stepped two-tier profile
  mb.part = 'terrazza_superiore';
  const yTop = (x, z) => { const [w, h] = sec(z); const u = Math.min(1, Math.abs(x) / w); return h * Math.pow(Math.max(0, 1 - Math.pow(u, 2.6)), 1 / 2.6); };
  const tr = []; for (let j = 0; j <= nz; j++) { const z = lerp(-30, 52, j / nz), tt = j / nz, [w] = sec(z), ww = w * 0.58 * Math.pow(Math.sin(PI * tt), 0.35), row = [];
    for (let k = 0; k <= na / 2; k++) { const a = -PI / 2 + k / (na / 2) * PI, x = Math.sin(a) * ww, c = Math.cos(a); row.push([x, yTop(x, z) - 0.05 + 1.7 * Math.pow(Math.max(0, c), 0.18) * Math.pow(Math.sin(PI * tt), 0.4), z]); } tr.push(row); }
  const PT = mat(hc.map(v => v * 0.86), 0, 1); mb.grid(tr, PT, false); mb.grid(tr, PT, true);
  // a neon seam where the terrace meets the hull (the Cybercity touch)
  mb.part = 'neon_terrazza'; for (const sx of [-1, 1]) { const seam = []; for (let j = 1; j < nz; j++) { const z = lerp(-30, 52, j / nz), tt = j / nz, [w] = sec(z), x = sx * w * 0.58 * Math.pow(Math.sin(PI * tt), 0.35) * 1.01, y = yTop(x, z); seam.push([[x, y + 0.02, z], [x, y + 0.2, z]]); } mb.grid(seam, W, false); mb.grid(seam, W, true); }
  // accent band around the rim (between the two rows of windows) + a thin dark pinstripe above it
  mb.part = 'fascia_bordo';
  for (const sx of [-1, 1]) { const band = [], pin = [];
    for (let j = 1; j < nz; j++) { const z = lerp(-40, 65, j / nz), [w] = sec(z); band.push([[sx * (w + 0.06), 0.35, z], [sx * (w + 0.12), 0, z], [sx * (w + 0.06), -0.35, z]]); pin.push([[sx * (w - 0.1), 0.62, z], [sx * (w - 0.02), 0.5, z]]); }
    mb.grid(band, A, sx < 0); mb.grid(band, A, sx > 0); mb.grid(pin, dark, sx < 0); mb.grid(pin, dark, sx > 0); }
  // rows of lit windows (two decks along the rim, gaps where the bulkheads are)
  mb.part = 'finestrini';
  for (let j = 2; j < nz - 1; j++) { const z = lerp(-40, 65, j / nz), [w, h] = sec(z); if (w < 6 || j % 5 === 0) continue;
    for (const sx of [-1, 1]) for (const yy of [0.17, -0.27]) { const y = yy * h, u = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y) / (yy > 0 ? h : h * 0.75), 2.6)), 1 / 2.6); mb.box(sx * (w * u + 0.03), y, z, 0.14, 0.42, 1.35, win); } }
  // panel lines: longitudinal + transverse grooves that follow the curved top, plus a patchwork of tinted plates
  mb.part = 'linee_pannelli';
  const slope = (x, z) => (yTop(x + 0.15, z) - yTop(x - 0.15, z)) / 0.3;
  const seg = 1.6, groove = mat(hc.map(v => v * 0.45), 0, 1), plateA = mat(hc.map(v => v * 0.78), 0, 1), plateB = mat(hc.map(v => Math.min(1, v * 1.15 + 0.04)), 0, 1);
  for (const lx of [-20, -13, -7, 7, 13, 20]) for (let z = -32; z < 58; z += seg) { const [w] = sec(z); if (Math.abs(lx) > w * 0.82 || (Math.abs(lx) < sec(z)[0] * 0.58 && z > -30 && z < 52)) continue; mb.box(lx, yTop(lx, z) + 0.02, z, 0.09, 0.05, seg * 0.98, groove); }
  for (const lz of [-26, -14, -2, 10, 22, 34, 46, 56]) { const [w] = sec(lz); for (let x = -w * 0.85; x < w * 0.85; x += seg) { const xm = x + seg / 2; mb.push(M(T(xm, yTop(xm, lz) + 0.02, lz), RZ(Math.atan(slope(xm, lz))))); mb.box(0, 0, 0, seg * 1.02, 0.05, 0.09, groove); mb.pop(); } }
  { let s9 = 11; const rnd = () => (s9 = (s9 * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < Math.round(70 * q); k++) { const z = lerp(-30, 58, rnd()), [w] = sec(z), x = (rnd() * 2 - 1) * w * 0.8; if (Math.abs(x) < w * 0.6 && z > -28 && z < 50) continue;
      const pw = 1.2 + rnd() * 2.4, pd = 1 + rnd() * 3, pm = rnd() < 0.5 ? plateA : plateB; if (Math.abs(x) + pw / 2 > w * 0.8) continue; mb.push(M(T(x, yTop(x, z) + 0.015, z), RZ(Math.atan(slope(x, z))))); mb.box(0, 0, 0, pw, 0.03, pd, pm); mb.pop(); } }
  // livery: a swept double chevron on the bow and the dorsal accent spine
  mb.part = 'livrea';
  for (const s of [-1, 1]) for (const [z0, ww] of [[50, 0.7], [54, 0.45]]) for (let k = 0; k < 8; k++) { const x = s * (1 + k * 1.3), z = z0 - k * 1.05; mb.push(M(T(x, yTop(x, z) + 0.04, z), RY(s * 0.9))); mb.box(0, 0, 0, ww, 0.04, 1.75, A); mb.pop(); }
  for (const z of [-20, -4, 12, 28, 42]) { if (z > 2 && z < 26) continue; mb.box(0, yTop(0, z) - 0.05 + 1.7 * Math.pow(Math.sin(PI * (z + 30) / 82), 0.4) + 0.03, z, 0.35, 0.08, 9, A); }
  // bridge dome + sensor ring + a band of windows + mast
  mb.part = 'cupola_plancia';
  mb.push(T(0, 6.2, 14)); KX.lathe(mb, [[10.6, 0], [10.4, 0.9], [9.2, 2.2], [6.5, 3.4], [3, 4.0], [0.01, 4.15]], N(40), (j) => j === 1 ? G : P, true); mb.pop();
  mb.push(T(0, 7.15, 14)); mb.torus(10.45, 0.12, N(48), 6, W); mb.pop();
  mb.push(T(0, 8.55, 14)); for (let k = 0; k < N(28); k++) { const a = k / N(28) * TAU; mb.push(RY(a)); mb.box(0, 0, 8.95, 0.7, 0.28, 0.1, win); mb.pop(); } mb.pop();
  mb.part = 'antenna_sensori'; mb.push(T(0, 10.35, 14)); mb.cyl(0, 0.35, 1.6, 1.2, N(20), Pd); mb.cyl(0.35, 2.8, 0.12, 0.05, 8, A); mb.ellipsoid(0, 2.9, 0, 0.18, 0.18, 0.18, 8, 6, mat([1, 0.2, 0.2], 2, 3, 7, [0, 0.6, 0])); mb.box(0, 1.2, 0, 3.2, 0.08, 0.08, A); mb.pop();
  // ventral sensor dome under the bow
  mb.part = 'sensori_ventrali'; mb.push(T(0, -4.7, 38)); mb.ellipsoid(0, 0, 0, 3.4, 1.2, 3.4, N(24), N(10), G); mb.torus(3.3, 0.1, N(28), 6, W); mb.pop();
  // impulse engines at the stern of the lens (glowing amber vents)
  mb.part = 'motori_impulso';
  for (const s of [-1, 1]) { const z = -37.2, [w, h] = sec(z); mb.box(s * 4.2, 0.6, z, 5.2, 1.5, 1.4, Pd); mb.box(s * 4.2, 0.6, z - 0.72, 4.6, 1.0, 0.06, mat([1, 0.45, 0.12], 2.0, 3)); void w; void h; }
  // RCS thruster quads around the rim
  mb.part = 'propulsori_rcs';
  for (const [z, sy] of [[-24, 1], [0, 1], [24, 1], [46, 1]]) for (const sx of [-1, 1]) { const [w] = sec(z); mb.push(T(sx * (w * 0.93), yTop(w * 0.93, z) + 0.1, z)); mb.box(0, 0, 0, 1.2, 0.25, 1.2, Pd); for (const [dx, dz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) mb.box(dx, 0.15, dz, 0.16, 0.08, 0.16, dark); mb.pop(); void sy; }
  // registry: KAGE ODYSSEY · KX-01 on both flanks
  mb.part = 'scritte';
  for (const s of [-1, 1]) { const zz = s > 0 ? 34 : 34 - 13 * 6 * 0.34;
    text(mb, 'KX-01 ODYSSEY', s * (sec(zz + (s > 0 ? -9 : 9))[0] * 0.995 + 0.04), -0.6, s > 0 ? 30 : 30 - 13 * 6 * 0.2, 0.2, mat(hc.map(v => v * 0.35), 0, 2), s); }
  // swept neck (smooth tapered sections, accent fin on its leading edge)
  mb.part = 'collo';
  { const nr = []; for (let j = 0; j <= N(10); j++) { const t = j / N(10), z = lerp(-20, 6, t), yc = lerp(-7.6, -5.6, t), w = lerp(2.4, 3.4, Math.sin(PI * t)), hh = 2.6, row = [];
      for (let k = 0; k <= N(16); k++) { const a = k / N(16) * TAU; row.push([Math.sin(a) * w, yc + Math.cos(a) * hh, z]); } nr.push(row); }
    mb.grid(nr, Pd, false); }
  mb.push(M(T(0, -6.2, 5.6), RX(-0.5))); mb.box(0, 0, 0, 0.35, 3.6, 1.2, A); mb.pop();
  // engineering hull with the deflector dish, ribs, windows and keel fins
  mb.part = 'scafo_ingegneria';
  const er = []; const eR = t => 7.2 * Math.pow(Math.sin(PI * clamp(t * 0.95 + 0.05, 0, 1)), 0.45) * (1 - 0.2 * t);
  for (let j = 0; j <= N(26); j++) { const t = j / N(26), z = lerp(-48, 18, t), r = eR(t);
    const row = []; for (let k = 0; k <= N(32); k++) { const a = k / N(32) * TAU; row.push([Math.sin(a) * r, -11 + Math.cos(a) * r * 0.85, z]); } er.push(row); }
  mb.grid(er, P, false);
  mb.part = 'costole_ingegneria';
  for (const t of [0.22, 0.42, 0.62, 0.8]) { const z = lerp(-48, 18, t), r = eR(t); mb.push(M(T(0, -11, z), FM3(1, 0.85, 1))); mb.torus(r + 0.04, 0.12, N(32), 6, Pd); mb.pop(); }
  for (let i = 0; i < 18; i++) { const t = 0.12 + i * 0.045, z = lerp(-48, 18, t), r = eR(t); for (const s of [-1, 1]) mb.box(s * (r * 0.97), -11.8, z, 0.1, 0.3, 1.4, win); }
  mb.part = 'pinne_chiglia';
  mb.push(M(T(0, -18.2, -30), RX(0.25))); mb.box(0, 0, 0, 0.5, 3.2, 12, Pd); mb.box(0, -1.65, 0, 0.55, 0.12, 11, A); mb.pop();
  mb.part = 'deflettore';
  mb.push(M(T(0, -11, 17.3), RX(PI / 2))); mb.cyl(-0.4, 0.5, 4.2, 3.6, N(32), A); mb.disc(3.5, N(32), 0.52, mat(wc.map(v => v * 0.7 + 0.25), 1.6, 3)); mb.torus(3.0, 0.15, N(32), 6, mat([1, 0.75, 0.3], 1.4, 3)); mb.torus(1.8, 0.1, N(28), 6, mat([1, 0.75, 0.3], 1.2, 3)); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; mb.box(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.55, 0.12, 0.12, 0.1, A); } mb.pop();
  mb.part = 'hangar_navette';
  mb.box(0, -11, -48.6, 7, 4.5, 0.4, mat([0.16, 0.15, 0.14], 0.12, 3)); for (let k = 0; k < 3; k++) mb.box(0, -12.6 + k * 1.6, -48.82, 6.4, 0.12, 0.05, mat([1, 0.75, 0.35], 1.4, 3)); for (const sx of [-1, 1]) mb.box(sx * 3.3, -11, -48.82, 0.12, 4.2, 0.05, mat([0.3, 0.9, 1], 1.4, 3)); mb.anim('PORTELLONE HANGAR', [0, 0, 0], [0, 1, 0], 4.6, 1); mb.box(0, -11, -48.25, 8, 5.5, 0.3, dark); for (let k = 0; k < 4; k++) mb.box(0, -12.9 + k * 1.25, -48.08, 7.6, 0.05, 0.05, A); mb.animEnd();
  for (const s of [-1, 1]) { mb.box(s * 1.8, -13.3, -48.75, 0.5, 0.2, 0.1, mat([1, 0.6, 0.15], 1.6, 3, 7, [0, s > 0 ? 0 : 0.5, 0])); }
  // swept pylons (airfoil sections with an accent leading edge) and refined warp nacelles
  for (const s of [-1, 1]) {
    mb.part = 'piloni';
    { const R0 = [s * 6.5, -8.4], R1 = [s * 25.2, 4.4], dx = R1[0] - R0[0], dy = R1[1] - R0[1], L = Math.hypot(dx, dy), n = [-dy / L, dx / L], rows = [];
      for (let j = 0; j <= N(8); j++) { const u = j / N(8), x = lerp(R0[0], R1[0], u), y = lerp(R0[1], R1[1], u), zc = lerp(-22, -36, u), ch = lerp(16, 10, u), th = lerp(1.9, 1.0, u), row = [];
        for (let k = 0; k <= N(14); k++) { const a = k / N(14) * TAU, sn = Math.sin(a) * th / 2 * (0.6 + 0.4 * Math.cos(a)); row.push([x + n[0] * sn, y + n[1] * sn, zc + Math.cos(a) * ch / 2]); } rows.push(row); }
      mb.grid(rows, P, s > 0); mb.grid(rows, P, s < 0);
      for (let j = 0; j < N(8); j++) { const u = (j + 0.5) / N(8), x = lerp(R0[0], R1[0], u), y = lerp(R0[1], R1[1], u), zc = lerp(-22, -36, u), ch = lerp(16, 10, u); mb.push(M(T(x, y, zc + ch / 2 - 0.05), RZ(Math.atan2(dy, dx)))); mb.box(0, 0, 0, L / N(8) * 1.02, 0.35, 0.25, A); mb.pop(); } }
    mb.part = s > 0 ? 'gondola_warp_sinistra' : 'gondola_warp_destra';
    const nx = s * 27, ny = 6, nR = t => 3.6 * (t < 0.1 ? 0.55 + 0.45 * Math.sqrt(t / 0.1) : t > 0.86 ? 0.55 + 0.45 * Math.cos((t - 0.86) / 0.14 * PI / 2) : 1 - 0.06 * (t - 0.1)), nrow = [];
    for (let j = 0; j <= N(24); j++) { const t = j / N(24), z = lerp(-62, 2, t), r = nR(t), row = [];
      for (let k = 0; k <= N(28); k++) { const a = k / N(28) * TAU; row.push([nx + Math.sin(a) * r, ny + Math.cos(a) * r * 1.05, z]); } nrow.push(row); }
    mb.grid(nrow, P, false);
    mb.part = 'anelli_gondola'; for (let i = 0; i < 7; i++) { const t = 0.16 + i * 0.1, z = lerp(-62, 2, t); mb.push(T(nx, ny, z)); mb.torus(nR(t) + 0.03, 0.07, N(28), 5, i % 3 ? Pd : A); mb.pop(); }
    mb.part = 'bobine_warp';
    for (let i = 0; i < 9; i++) { const z = -54 + i * 5.6; mb.box(nx - s * 3.45, ny, z, 0.35, 2.9, 4.5, dark); mb.box(nx - s * 3.6, ny, z, 0.3, 2.5, 4.1, W); }
    mb.part = 'pinna_gondola'; mb.push(T(nx, ny + 3.6, -36)); mb.box(0, 0.5, 0, 0.3, 1.2, 30, Pd); mb.box(0, 1.15, -2, 0.34, 0.12, 26, A); mb.pop();
    mb.part = 'scarico_gondola'; mb.push(T(nx, ny, -62.2)); mb.push(RX(PI / 2)); mb.disc(2.0, N(24), 0, mat(wc, 1.5, 3)); mb.torus(2.0, 0.12, N(24), 6, A); for (let k = 0; k < 6; k++) { const a = k / 6 * PI; mb.push(RY(a)); mb.box(0, -0.02, 0, 3.9, 0.05, 0.08, dark); mb.pop(); } mb.pop(); mb.pop();
    mb.part = 'collettori';
    mb.ellipsoid(nx, ny, 2.0, 2.9, 3.0, 2.8, N(24), N(14), Wm);
    mb.push(T(nx, ny, 1.0)); mb.torus(3.25, 0.22, N(28), 8, A); mb.pop();
  }
  // running lights (strobe) at the wing tips and nacelle ends + hull floodlights
  mb.part = 'luci_navigazione';
  for (const s of [-1, 1]) { mb.ellipsoid(s * 29.5, 0, 22, 0.35, 0.35, 0.35, 8, 6, mat(s > 0 ? [1, 0.1, 0.1] : [0.1, 1, 0.3], 1.8, 3, 7, [0, s > 0 ? 0 : 0.5, 0])); mb.ellipsoid(s * 27, 10.4, -60, 0.3, 0.3, 0.3, 8, 6, mat([1, 1, 1], 2, 3, 7, [0, 0.25, 0]));
    for (const z of [-10, 30]) mb.ellipsoid(s * 3.2, -4.6, z, 0.28, 0.14, 0.28, 8, 4, mat([1, 0.95, 0.85], 1.6, 3)); }
  // airlock (starboard side of deck 4) — EVA exit, set flush into the hull side
  mb.part = 'portello_eva';
  { const ax = (() => { const [w, h] = sec(20), c = Math.pow(3.2 / (h * 0.75), 2.6); return w * Math.pow(Math.max(0, 1 - c), 1 / 2.6); })();
    mb.box(ax - 0.15, -3.2, 20, 0.4, 3, 2.4, A); mb.box(ax - 0.02, -3.2, 20, 0.08, 2.4, 1.8, mat([0.2, 1, 0.5], 0.9, 3)); mb.anim('PORTELLO EVA', [0, 0, 0], [0, 0, 1], 2.0, 1); mb.box(ax + 0.12, -3.2, 20, 0.12, 2.5, 1.9, A); mb.animEnd(); }
  const m = mb.finish(); m.kind = 'starship'; return m;
}

/* ---------------- decks (walkable interiors; cut = cutaway for the showroom: no ceiling, no near wall) ---------------- */
function buildDeck(id, o, lod) {
  o = Object.assign({}, SHIP_DEF, o || {}); lod = lod || o.lod;
  const D = DECKS.find(d => d.id === id) || DECKS[0], mb = new MB(), q = Q(lod), N = k => Math.max(8, Math.round(k * q)), cut = !!o.cut, y = cut ? 0 : D.y, H = RIG.H;
  const wc = WARPC[o.warp] || WARPC.ciano, wall = mat([0.72, 0.74, 0.78]), wallD = mat([0.42, 0.44, 0.48]), floorC = [0.2, 0.21, 0.24], trim = mat(KF.COLORS[o.accent] || KF.COLORS.oro, 0, 2);
  const L = mat(wc, 1.1, 3), soft = mat(wc.map(v => v * 0.5 + 0.35), 0.6, 3), panel = mat([1, 0.62, 0.2], 0.9, 3), panelB = mat([0.45, 0.7, 1], 0.9, 3), seat = mat([0.12, 0.13, 0.16]), dark = mat([0.06, 0.065, 0.075]);
  const glassC = mat([0.08, 0.12, 0.16], 0, 4);
  const consoleAt = (x, z, h, w, c) => { mb.push(M(T(x, y, z), RY(h))); mb.box(0, 0.5, 0, w, 1.0, 0.7, wallD, [1, 0.8]); mb.box(0, 1.03, -0.05, w * 0.95, 0.04, 0.55, c || panel); mb.pop(); };
  const chairAt = (x, z, h) => { mb.push(M(T(x, y, z), RY(h))); mb.cyl(0, 0.42, 0.1, 0.08, N(10), dark); mb.box(0, 0.48, 0, 0.6, 0.1, 0.6, seat); mb.box(0, 0.95, -0.28, 0.6, 0.85, 0.1, seat, [0.9, 1]); mb.pop(); };
  // lift alcove (same place on every deck)
  const lift = () => { mb.part = 'ascensore'; mb.push(T(0, y, LIFT_Z)); mb.cyl(0, 0.06, 1.3, 1.3, N(24), dark); mb.disc(1.1, N(24), 0.065, soft); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + PI / 4; mb.box(Math.sin(a) * 1.45, H / 2, Math.cos(a) * 1.45, 0.12, H, 0.12, trim); } mb.torus(1.45, 0.05, N(24), 6, L); mb.push(T(0, H - 0.12, 0)); mb.torus(1.45, 0.05, N(24), 6, L); mb.pop(); mb.pop(); };
  if (D.round) {
    // PONTE 1: round bridge with the wide front window, captain's chair, helm and ops, side stations
    const R0 = D.round, cz = D.cz;
    mb.part = 'pavimento';
    mb.push(T(0, y, cz)); mb.disc(R0, N(48), 0, mat(floorC)); mb.torus(R0 * 0.55, 0.06, N(48), 6, soft); mb.pop();
    mb.part = 'pareti';
    mb.push(T(0, y, cz)); KX.lathe(mb, [[R0, 0], [R0, 1.0], [R0, 2.6], [R0 * 0.92, H]], N(48), (j) => j === 1 ? glassC : wall, false, 0, TAU, (j, a) => j === 1 && Math.cos(a) > 0.45); mb.pop();
    if (!cut) { mb.part = 'soffitto'; mb.push(T(0, y + H, cz)); KX.lathe(mb, [[R0 * 0.92, 0], [R0 * 0.6, 0.7], [0.01, 0.9]], N(40), wall, false); mb.torus(R0 * 0.5, 0.08, N(40), 6, L); mb.pop(); }
    mb.part = 'strisce_led'; mb.push(T(0, y + 0.08, cz)); mb.torus(R0 - 0.15, 0.04, N(48), 6, L); mb.pop();
    mb.part = 'sedile_capitano'; chairAt(0, RIG.chair[1], 0); mb.box(0.42, y + 0.65, RIG.chair[1], 0.12, 0.1, 0.5, trim); mb.box(-0.42, y + 0.65, RIG.chair[1], 0.12, 0.1, 0.5, trim);
    mb.part = 'console_timone'; consoleAt(-1.6, cz + 2.8, 0, 1.8, panel); consoleAt(1.6, cz + 2.8, 0, 1.8, panelB); chairAt(-1.6, cz + 2.0, 0); chairAt(1.6, cz + 2.0, 0);
    mb.part = 'stazioni'; for (const s of [-1, 1]) for (const a of [0.9, 1.6, 2.3]) { const h = s * a; consoleAt(Math.sin(h) * (R0 - 1), cz + Math.cos(h) * (R0 - 1), h + PI, 2.2, s > 0 ? panelB : panel); }
    mb.part = 'ringhiera'; mb.push(T(0, y + 0.95, cz - 1.5)); KX.lathe(mb, [[4.2, 0], [4.2, 0.08]], N(40), trim, false, -2.2, 2.2); mb.pop();
    lift();
  } else {
    const [x0, x1, z0, z1] = D.box, cx = (x0 + x1) / 2, czz = (z0 + z1) / 2, Wd = x1 - x0, Dd = z1 - z0;
    mb.part = 'pavimento';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) mb.box(x0 + (i + 0.5) * Wd / 6, y - 0.05, z0 + (j + 0.5) * Dd / 6, Wd / 6 - 0.05, 0.1, Dd / 6 - 0.05, mat(floorC.map(v => v * ((i + j) % 2 ? 1 : 0.88))));
    mb.part = 'pareti';
    const winSide = D.id === 'mensa';
    for (const s of [-1, 1]) { const x = s > 0 ? x1 : x0;
      if (winSide) { mb.box(x, y + 0.5, czz, 0.3, 1.0, Dd, wall); mb.box(x, y + H - 0.4, czz, 0.3, 0.8, Dd, wall); for (let k = 0; k <= 4; k++) mb.box(x, y + 1.6, z0 + k * Dd / 4, 0.3, 1.2, 0.4, wall); }
      else if (!(cut && s < 0)) mb.box(x, y + H / 2, czz, 0.3, H, Dd, wall);
      mb.box(x - s * 0.2, y + 0.1, czz, 0.06, 0.06, Dd, L); }
    mb.box(cx, y + H / 2, z1, Wd, H, 0.3, wall);
    if (!cut) mb.box(cx, y + H / 2, z0, Wd, H, 0.3, wall);
    if (!cut) { mb.part = 'soffitto'; mb.box(cx, y + H, czz, Wd, 0.2, Dd, wall); for (let k = 0; k < 4; k++) mb.box(cx, y + H - 0.12, z0 + 3 + k * (Dd - 6) / 3, Wd - 3, 0.05, 0.35, mat([0.95, 0.97, 1], 1.2, 3)); }
    mb.part = 'colonne'; for (const s of [-1, 1]) for (let k = 1; k < 4; k++) mb.box(cx + s * (Wd / 2 - 0.4), y + H / 2, z0 + k * Dd / 4, 0.5, H, 0.5, wallD);
    if (D.id === 'teletrasporto') {
      mb.part = 'pedana_teletrasporto';
      mb.push(T(0, y, 21.6)); mb.cyl(0, 0.3, 3.6, 3.8, N(40), wallD); mb.pop();
      for (const p of RIG.pads) { mb.push(T(p[0], y + 0.3, p[1])); mb.cyl(0, 0.04, 0.62, 0.62, N(20), dark); mb.disc(0.55, N(20), 0.045, mat([0.85, 0.95, 1], 0.9, 3)); mb.pop();
        if (!cut) { mb.push(T(p[0], y + H - 0.1, p[1])); mb.cyl(-0.1, 0, 0.62, 0.62, N(20), dark); mb.disc(0.55, N(20), -0.11, mat([0.85, 0.95, 1], 0.7, 3)); mb.pop(); } }
      mb.part = 'console_teletrasporto'; consoleAt(0, 15.2, PI, 2.6, panel); for (let k = 0; k < 3; k++) mb.box(-0.7 + k * 0.7, y + 1.06, 15.2, 0.15, 0.02, 0.4, mat([1, 0.3, 0.3], 1.2, 3));
      mb.part = 'stemma'; mb.push(T(0, y + 2.2, z1 - 0.18)); hexBadge(mb, 0.9, trim, L); mb.pop();
    } else if (D.id === 'astrolab') {
      mb.part = 'globo_stellare';
      mb.push(T(0, y, RIG.astro[1])); mb.cyl(0, 0.9, 1.6, 1.9, N(32), wallD); mb.torus(1.7, 0.05, N(32), 6, L); mb.pop();
      let s9 = 7; const rnd = () => (s9 = (s9 * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 260; k++) { const u = rnd() * TAU, v = Math.acos(rnd() * 2 - 1), r = 2.4 * Math.cbrt(rnd()), arm = Math.sin(u * 2 + r * 2) * 0.4;
        mb.ellipsoid(Math.sin(v) * Math.cos(u) * r, y + 2.6 + Math.cos(v) * r * 0.35 + arm * 0.2, RIG.astro[1] + Math.sin(v) * Math.sin(u) * r, 0.03, 0.03, 0.03, 4, 3, mat(k % 9 ? [0.75, 0.9, 1] : [1, 0.7, 0.3], 1.6, 3, 1, [0, RIG.astro[1], 0])); }
      mb.part = 'cartigli_pianeti';
      const cards = DEST_ORDER.map(k => DEST[k]);
      cards.forEach((d, i) => { const s = i % 2 ? 1 : -1, z = 5 + Math.floor(i / 2) * 4.8, x = s * (Wd / 2 - 0.25);
        mb.box(x, y + 1.9, z, 0.08, 1.8, 3.6, mat([0.05, 0.07, 0.1], 0.2, 3)); mb.box(x, y + 1.9, z, 0.09, 1.86, 0.06, trim); mb.box(x, y + 2.83, z, 0.09, 0.05, 3.66, trim);
        mb.ellipsoid(x - s * 0.06, y + 2.05, z, 0.05, 0.6, 0.6, N(14), N(10), mat(d.col[0], 0.7, 3)); mb.box(x - s * 0.06, y + 1.3, z, 0.04, 0.12, 2.6, mat(d.col[1], 0.9, 3)); });
      mb.part = 'console_navigazione'; consoleAt(0, RIG.astro[1] - 3.2, 0, 2.8, panelB);
    } else if (D.id === 'mensa') {
      mb.part = 'tavoli';
      for (const [tx, tz] of [[-6, 8], [-6, 15], [6, 8], [6, 15], [0, 21]]) { mb.push(T(tx, y, tz)); mb.cyl(0, 0.72, 0.1, 0.1, N(10), dark); mb.cyl(0.72, 0.78, 1.0, 1.0, N(24), mat([0.85, 0.86, 0.9])); mb.torus(1.0, 0.03, N(24), 4, L); mb.pop();
        for (let c = 0; c < 4; c++) { const a = c / 4 * TAU + PI / 4; chairAt(tx + Math.sin(a) * 1.5, tz + Math.cos(a) * 1.5, a + PI); } }
      mb.part = 'bancone'; mb.box(-9.5, y + 0.55, 22, 4, 1.1, 1.2, wallD); mb.box(-9.5, y + 1.12, 22, 4.1, 0.05, 1.3, trim);
      mb.part = 'portello_eva'; mb.box(x1 - 0.1, y + 1.3, RIG.airlock[1], 0.35, 2.6, 2.0, trim); mb.box(x1 - 0.2, y + 1.3, RIG.airlock[1], 0.3, 2.2, 1.6, mat([0.2, 1, 0.5], 0.8, 3));
    } else if (D.id === 'ingegneria') {
      mb.part = 'nucleo_warp';
      mb.push(T(RIG.core[0], y, RIG.core[1])); mb.cyl(0, 0.6, 2.4, 2.2, N(32), wallD); mb.cyl(0.6, H, 1.2, 1.2, N(32), glassC, false); mb.cyl(0.6, H, 0.7, 0.7, N(24), mat(wc, 1.8, 3), false);
      for (let k = 0; k < 6; k++) { mb.push(T(0, 0.9 + k * 0.42, 0)); mb.torus(1.25, 0.08, N(32), 6, mat(wc.map(v => v * 0.6 + 0.4), 1.4, 3, k % 2 ? 1 : 2, [RIG.core[0], RIG.core[1], 0])); mb.pop(); }
      mb.pop();
      mb.part = 'condotti_plasma'; for (const s of [-1, 1]) { mb.box(s * 5, y + H - 0.4, RIG.core[1], 7.5, 0.5, 0.5, mat(wc, 1.0, 3)); mb.box(s * 8.5, y + H / 2, RIG.core[1], 0.6, H, 0.6, mat(wc, 0.9, 3)); }
      mb.part = 'console_ingegneria'; consoleAt(-5, 8, 0.4, 2.2, panel); consoleAt(5, 8, -0.4, 2.2, panelB); consoleAt(0, 22, PI, 3, panel);
    }
    lift();
  }
  const m = mb.finish(); m.kind = 'deck'; m.deck = D; return m;
}
/** the crew badge: an original hexagonal KAGE emblem with a forward chevron */
function hexBadge(mb, s, rim, glow) {
  const h = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + PI / 6; h.push([Math.cos(a) * s, Math.sin(a) * s, 0]); }
  mb.poly(h.map(p => [p[0], p[1], 0.02]).reverse(), rim);
  mb.poly([[0, 0.55 * s, 0.05], [-0.42 * s, -0.4 * s, 0.05], [0, -0.15 * s, 0.05]], glow); mb.poly([[0, 0.55 * s, 0.05], [0, -0.15 * s, 0.05], [0.42 * s, -0.4 * s, 0.05]], glow);
}
function buildBadge() { const mb = new MB(); mb.part = 'badge'; hexBadge(mb, 0.028, mat([0.85, 0.65, 0.2], 0.1, 2), mat([0, 1, 0.9], 1.3, 3)); const m = mb.finish(); m.kind = 'badge'; return m; }
/** garage display: pedestal + glass, the miniature on top, the badge on its own little stand */
function buildDisplay() {
  const mb = new MB(); mb.part = 'piedistallo';
  mb.push(T(0, 0, 0)); mb.cyl(0, 1.0, 0.9, 0.75, 24, mat([0.08, 0.085, 0.1])); mb.cyl(1.0, 1.05, 0.8, 0.8, 24, mat([0, 1, 0.9], 1, 3)); mb.pop();
  mb.part = 'supporto_badge'; mb.push(T(0.55, 1.05, 0.45)); mb.cyl(0, 0.12, 0.08, 0.06, 10, mat([0.7, 0.6, 0.3], 0, 2)); mb.pop();
  mb.part = 'targhetta'; mb.box(0, 0.6, 0.78, 0.9, 0.22, 0.03, mat([0.85, 0.65, 0.2], 0.3, 2));
  const m = mb.finish(); m.kind = 'display'; return m;
}

/* ---------------- destinations: real stars and planets (approx. positions in light years) + one fictional colony ---------------- */
const DEST = {
  terra: { name: 'TERRA · CYBERCITY', type: 'Pianeta natale · orbita bassa sopra Cybercity', pos: [0, 0, 0], col: [[0.15, 0.4, 0.85], [0.2, 0.8, 0.4]], R: 1500, land: 'city', g: 1, temp: '15 °C' },
  luna: { name: 'LUNA', type: 'Satellite naturale · 384.400 km', pos: [4.06e-8, 0, 0], col: [[0.62, 0.62, 0.64], [0.85, 0.85, 0.9]], R: 900, land: 'luna', g: 0.17, temp: '−20 °C' },
  marte: { name: 'MARTE', type: 'Pianeta roccioso · 1,5 UA dal Sole', pos: [0, 1.6e-5, 0], col: [[0.8, 0.35, 0.15], [1, 0.6, 0.3]], R: 1100, land: 'marte', g: 0.38, temp: '−60 °C' },
  alpha: { name: 'ALPHA CENTAURI A', type: 'Stella doppia (A+B) · 4,37 anni luce', pos: [-1.64, -1.37, -3.84], col: [[1, 0.9, 0.55], [1, 0.75, 0.35]], R: 900, star: true, temp: '5.800 K' },
  proxima: { name: 'PROXIMA CENTAURI b', type: 'Esopianeta roccioso · 4,24 anni luce · rotazione sincrona', pos: [-1.55, -1.18, -3.77], col: [[0.55, 0.28, 0.2], [1, 0.35, 0.2]], R: 1150, land: 'proxima', g: 1.1, temp: '−40 °C' },
  colonia: { name: 'COLONIA ALIENA ZHAR’UL', type: 'Colonia di quattro specie · 37 anni luce (fittizia)', pos: [14, 22, -26], col: [[0.45, 0.2, 0.7], [0.3, 1, 0.8]], R: 1250, land: 'colonia', g: 0.8, temp: '22 °C' },
  kepler186: { name: 'KEPLER-186f', type: 'Esopianeta nella zona abitabile · 582 anni luce', pos: [-200, 330, 420], col: [[0.5, 0.3, 0.25], [0.9, 0.4, 0.35]], R: 1300, land: 'kepler186', g: 1.2, temp: '−10 °C' },
  kepler452: { name: 'KEPLER-452b', type: '«Cugino della Terra» · 1.400 anni luce', pos: [-480, 820, 1020], col: [[0.3, 0.55, 0.35], [0.95, 0.85, 0.45]], R: 1600, land: 'kepler452', g: 2, temp: '25 °C' } };
const DEST_ORDER = ['terra', 'luna', 'marte', 'alpha', 'proxima', 'colonia', 'kepler186', 'kepler452'];
const dist = (a, b) => { const p = DEST[a].pos, q = DEST[b].pos; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
/** warp factor → multiples of c (TNG-style scale; warp 10 = infinite) */
const WARP_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 9.5, 9.9, 9.99, 9.9999, 10];
function warpC(w) { if (w >= 10) return Infinity; if (w <= 9) return Math.pow(w, 10 / 3); const t = { 9.5: 2000, 9.9: 3053, 9.99: 7912, 9.9999: 199516 }; return t[w] || 1516 + (w - 9) * 4000; }

/** planet sphere with baked day/night shading toward sunDir */
function buildPlanet(id, lod) {
  const d = DEST[id], mb = new MB(), q = Q(lod), su = Math.round(64 * q), sv = Math.round(36 * q), R = 1;
  let s9 = id.length * 977; const rnd = () => (s9 = (s9 * 16807) % 2147483647) / 2147483647;
  const blobs = []; for (let k = 0; k < 22; k++) { const u = rnd() * TAU, v = Math.acos(rnd() * 2 - 1); blobs.push([Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u), 0.25 + rnd() * 0.4]); }
  const field = (x, y, z) => { let f = 0; for (const b of blobs) { const dd = (x - b[0]) ** 2 + (y - b[1]) ** 2 + (z - b[2]) ** 2; f += Math.exp(-dd / (b[3] * b[3])); } return f + 0.15 * Math.sin(x * 9 + y * 7) * Math.sin(z * 8); };
  const sun = [0.6, 0.35, 0.72], g = [];
  mb.part = 'pianeta';
  for (let j = 0; j <= sv; j++) { const v = j / sv * PI, row = []; for (let k = 0; k <= su; k++) { const u = k / su * TAU, x = Math.sin(v) * Math.cos(u), y = Math.cos(v), z = Math.sin(v) * Math.sin(u);
      const f = field(x, y, z), land = f > 0.55, lit = Math.max(0.04, x * sun[0] + y * sun[1] + z * sun[2] + 0.15);
      let c = d.star ? d.col[0] : land ? d.col[1] : d.col[0];
      if (id === 'terra' || id === 'kepler452') { const cloud = Math.sin(u * 5 + v * 7) * Math.sin(u * 11 - v * 3) > 0.45; if (cloud) c = [0.95, 0.96, 1]; if (Math.abs(y) > 0.88) c = [0.95, 0.97, 1]; }
      if (id === 'marte' && Math.abs(y) > 0.9) c = [0.95, 0.92, 0.9];
      if (id === 'luna') c = c.map(w => w * (0.75 + 0.25 * Math.sin(f * 20)));
      if (id === 'proxima' && x * sun[0] + y * sun[1] + z * sun[2] < -0.2) c = [0.75, 0.82, 0.9];
      const e = d.star ? 1.6 : Math.max(0, 0.9 * lit);
      row.push(mb.v([x * R, y * R, z * R], mat(c, e, 3))); }
    g.push(row); }
  for (let j = 0; j < sv; j++) for (let k = 0; k < su; k++) { mb.tri(g[j][k], g[j + 1][k + 1], g[j + 1][k]); mb.tri(g[j][k], g[j][k + 1], g[j + 1][k + 1]); }
  if (id === 'colonia') { mb.part = 'anelli'; mb.push(RX(0.35)); mb.torus(1.7, 0.18, su, 4, mat([0.6, 0.4, 0.9], 0.4, 3)); mb.pop(); }
  const m = mb.finish(); m.kind = 'planet'; return m;
}
/** star field shell (glow) and warp streaks */
function buildStars() {
  const mb = new MB(); let s9 = 4242; const rnd = () => (s9 = (s9 * 16807) % 2147483647) / 2147483647; mb.part = 'stelle';
  for (let k = 0; k < 1400; k++) { const u = rnd() * TAU, v = Math.acos(rnd() * 2 - 1), r = 4200, s = 3 + rnd() * 6, c = rnd() < 0.15 ? [1, 0.8, 0.6] : rnd() < 0.2 ? [0.7, 0.8, 1] : [1, 1, 1];
    mb.ellipsoid(Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r, Math.sin(v) * Math.sin(u) * r, s, s, s, 4, 2, mat(c, 0.6 + rnd() * 1.2, 3)); }
  return mb.finish();
}
function buildStreaks() {
  const mb = new MB(); let s9 = 99; const rnd = () => (s9 = (s9 * 16807) % 2147483647) / 2147483647; mb.part = 'scie_warp';
  for (let k = 0; k < 420; k++) { const a = rnd() * TAU, r = 40 + rnd() * 380, z = (rnd() - 0.5) * 1600, L = 60 + rnd() * 260, c = rnd() < 0.3 ? [0.6, 0.8, 1] : [1, 1, 1];
    mb.box(Math.cos(a) * r, Math.sin(a) * r, z, 0.6, 0.6, L, mat(c, 1.2, 3)); }
  return mb.finish();
}
/** cloud deck under the ship (above Cybercity) */
function buildClouds() {
  const mb = new MB(); let s9 = 5150; const rnd = () => (s9 = (s9 * 16807) % 2147483647) / 2147483647; mb.part = 'nuvole';
  for (let k = 0; k < 260; k++) { const x = (rnd() - 0.5) * 1260, z = (rnd() - 0.5) * 1260, r = 40 + rnd() * 90;
    mb.ellipsoid(x, rnd() * 25, z, r, 12 + rnd() * 14, r * (0.6 + rnd() * 0.6), 10, 5, mat([0.92, 0.93, 0.97], 0.55, 3)); }
  return mb.finish();
}

/* ---------------- landing sites: terrain + props (all at the origin, ±300 m) ---------------- */
const SITES = {
  luna: { ground: [[0.42, 0.42, 0.44], [0.62, 0.62, 0.64]], amp: 9, fog: [0, 0, 0.005], top: [0, 0, 0], sun: [1, 1, 0.95], day: 0, fogDen: 0.0006, sky: 'terra' },
  marte: { ground: [[0.55, 0.22, 0.1], [0.78, 0.42, 0.22]], amp: 22, fog: [0.78, 0.55, 0.38], top: [0.55, 0.36, 0.26], sun: [1, 0.85, 0.7], day: 1, fogDen: 0.0035 },
  proxima: { ground: [[0.25, 0.14, 0.12], [0.62, 0.66, 0.72]], amp: 16, fog: [0.32, 0.1, 0.08], top: [0.08, 0.01, 0.02], sun: [1, 0.35, 0.2], day: 0.25, fogDen: 0.003 },
  colonia: { ground: [[0.25, 0.12, 0.35], [0.2, 0.75, 0.6]], amp: 12, fog: [0.42, 0.22, 0.55], top: [0.12, 0.05, 0.25], sun: [0.8, 1, 0.9], day: 0.6, fogDen: 0.0028 },
  kepler186: { ground: [[0.42, 0.12, 0.1], [0.25, 0.2, 0.18]], amp: 18, fog: [0.62, 0.35, 0.3], top: [0.32, 0.18, 0.2], sun: [1, 0.6, 0.45], day: 0.7, fogDen: 0.0032 },
  kepler452: { ground: [[0.3, 0.5, 0.2], [0.75, 0.65, 0.4]], amp: 14, fog: [0.7, 0.8, 0.85], top: [0.3, 0.5, 0.85], sun: [1, 0.97, 0.85], day: 1, fogDen: 0.0028, water: true } };
function siteHeight(id, x, z) {
  const S0 = SITES[id]; if (!S0) return 0;
  const n = Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 - 0.4) + 0.5 * Math.sin(x * 0.027 - z * 0.021) + 0.25 * Math.sin(x * 0.07 + z * 0.05);
  const flat = 1 - Math.exp(-(x * x + z * z) / (2 * 45 * 45));      // a flat landing area in the middle
  let h = n * S0.amp * flat;
  if (id === 'luna' || id === 'marte') { for (const [cx, cz, r] of [[120, -80, 40], [-150, 60, 60], [60, 170, 30]]) { const d = Math.hypot(x - cx, z - cz) / r; if (d < 1.3) h += d < 1 ? -10 * (1 - d * d) : 4 * Math.sin((d - 1) / 0.3 * PI); } }
  return h;
}
function buildSite(id, lod) {
  const S0 = SITES[id], mb = new MB(), q = Q(lod), n = Math.round(80 * q), half = 300, step = half * 2 / n;
  let s9 = id.length * 131; const rnd = () => (s9 = (s9 * 16807) % 2147483647) / 2147483647;
  mb.part = 'terreno';
  const rows = []; for (let j = 0; j <= n; j++) { const z = -half + j * step, row = []; for (let i = 0; i <= n; i++) { const x = -half + i * step, h = siteHeight(id, x, z);
      const t = clamp(0.5 + h / (S0.amp * 2) + 0.15 * Math.sin(x * 0.3) * Math.sin(z * 0.27), 0, 1); let c = S0.ground[0].map((v, k) => lerp(v, S0.ground[1][k], t));
      if (id === 'proxima' && x > 60) c = c.map((v, k) => lerp(v, [0.75, 0.82, 0.9][k], sstep(60, 160, x)));   // the frozen night side
      if (S0.water && h < -4) c = [0.12, 0.3, 0.45];
      row.push([x, h, z]); row.c = row.c || []; row.c.push(c); }
    rows.push(row); }
  const vi = rows.map(r => r.map((p, i) => mb.v(p, mat(r.c[i]))));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = vi[j][i], b = vi[j + 1][i], c = vi[j + 1][i + 1], d = vi[j][i + 1]; mb.tri(a, c, b); mb.tri(a, d, c); }
  if (S0.water) { mb.part = 'mare'; mb.poly([[-half, -4.2, -half], [-half, -4.2, half], [half, -4.2, half], [half, -4.2, -half]], mat([0.1, 0.35, 0.5], 0.15, 4)); }
  mb.part = 'rocce';
  for (let k = 0; k < 70; k++) { const x = (rnd() - 0.5) * 560, z = (rnd() - 0.5) * 560; if (Math.hypot(x, z) < 30) continue; const r = 0.6 + rnd() * 3.5, h = siteHeight(id, x, z);
    mb.ellipsoid(x, h + r * 0.3, z, r, r * 0.6, r * (0.7 + rnd() * 0.6), 7, 5, mat(S0.ground[0].map(v => v * 0.7))); }
  // per-site landmarks
  if (id === 'marte') { mb.part = 'base_marziana';
    for (const [x, z, r] of [[-28, 22, 7], [-14, 34, 5], [-36, 38, 4]]) { const h = siteHeight(id, x, z); mb.push(T(x, h, z)); KX.lathe(mb, [[r, 0], [r * 0.96, r * 0.4], [r * 0.7, r * 0.75], [0.01, r * 0.85]], 32, mat([0.88, 0.88, 0.9]), false); mb.torus(r, 0.15, 32, 6, mat([0, 1, 0.9], 1, 3)); mb.pop(); }
    mb.rod([-21, siteHeight(id, -21, 28), 28], [-21, siteHeight(id, -21, 28) + 6, 28], 0.06, 6, mat([0.8, 0.8, 0.8]));
    mb.box(-20.2, siteHeight(id, -21, 28) + 5.4, 28, 1.6, 1.0, 0.03, mat([0, 0.9, 0.85], 0.6, 3));
    mb.part = 'rover'; { const x = 18, z = -14, h = siteHeight(id, x, z); mb.box(x, h + 1.1, z, 2.4, 0.6, 3.6, mat([0.85, 0.85, 0.88])); for (const sx of [-1, 1]) for (const sz of [-1.3, 0, 1.3]) { mb.push(M(T(x + sx * 1.35, h + 0.45, z + sz), RZ(PI / 2))); mb.cyl(-0.2, 0.2, 0.45, 0.45, 12, mat([0.1, 0.1, 0.1])); mb.pop(); } mb.rod([x + 0.6, h + 1.4, z + 1.2], [x + 0.6, h + 2.6, z + 1.2], 0.05, 6, mat([0.8, 0.8, 0.8])); }
  } else if (id === 'colonia') { mb.part = 'cupole_colonia';
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, r = 60 + (k % 3) * 25, x = Math.cos(a) * r, z = Math.sin(a) * r, h = siteHeight(id, x, z), R0 = 8 + (k % 4) * 3;
      mb.push(T(x, h, z)); KX.lathe(mb, [[R0, 0], [R0 * 0.9, R0 * 0.5], [R0 * 0.55, R0 * 0.85], [0.01, R0 * 0.95]], 28, mat([0.3, 0.2, 0.45], 0, 4), false); mb.torus(R0, 0.3, 28, 6, mat([0.3, 1, 0.8], 1.1, 3)); mb.pop(); }
    mb.part = 'torri_cristallo';
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.3, r = 120, x = Math.cos(a) * r, z = Math.sin(a) * r, h = siteHeight(id, x, z), Hh = 40 + k * 9;
      mb.push(T(x, h, z)); mb.cyl(0, Hh, 4, 0.4, 6, mat([0.5, 0.95, 0.85], 0.45, 3)); mb.pop(); }
    mb.part = 'piazza'; mb.push(T(0, 0.05, 0)); mb.disc(22, 48, 0, mat([0.2, 0.12, 0.3])); mb.torus(22, 0.25, 48, 6, mat([0.3, 1, 0.8], 1.1, 3)); mb.pop();
  } else if (id === 'kepler452' || id === 'kepler186') { mb.part = 'alberi';
    const red = id === 'kepler186';
    for (let k = 0; k < 140; k++) { const x = (rnd() - 0.5) * 560, z = (rnd() - 0.5) * 560; if (Math.hypot(x, z) < 40) continue; const h = siteHeight(id, x, z); if (SITES[id].water && h < -3) continue; const Hh = 6 + rnd() * 10;
      mb.push(T(x, h, z)); mb.cyl(0, Hh * 0.4, 0.35, 0.25, 6, mat([0.3, 0.2, 0.12])); mb.cyl(Hh * 0.3, Hh, Hh * 0.28, 0.1, 8, mat(red ? [0.55, 0.12, 0.12] : [0.2, 0.45, 0.18])); mb.pop(); }
  } else if (id === 'proxima') { mb.part = 'pinnacoli_ghiaccio';
    for (let k = 0; k < 40; k++) { const x = 70 + rnd() * 220, z = (rnd() - 0.5) * 560, h = siteHeight(id, x, z), Hh = 4 + rnd() * 14; mb.push(T(x, h, z)); mb.cyl(0, Hh, 1.5 + rnd() * 2, 0.1, 5, mat([0.75, 0.88, 1], 0.2, 4)); mb.pop(); }
  } else if (id === 'luna') { mb.part = 'bandiera_lander';
    mb.box(25, siteHeight(id, 25, -20) + 1.6, -20, 3, 1.4, 3, mat([0.85, 0.7, 0.3])); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.rod([25 + sx * 1.4, siteHeight(id, 25, -20) + 1, -20 + sz * 1.4], [25 + sx * 2.4, siteHeight(id, 25, -20), -20 + sz * 2.4], 0.08, 6, mat([0.7, 0.7, 0.72]));
  }
  // landing pad
  mb.part = 'piazzola'; mb.push(T(0, 0.06, 0)); mb.torus(16, 0.2, 48, 6, mat([1, 0.6, 0.2], 1, 3, 7, [0, 0.3, 0])); mb.pop();
  const m = mb.finish(); m.kind = 'site'; return m;
}

KF.KINDS.starship = { build: (o, lod) => { o = Object.assign({}, SHIP_DEF, o || {}); return o.view && o.view !== 'esterno' ? buildDeck(o.view, Object.assign({}, o, { cut: true }), lod || o.lod) : buildStarship(o, lod || o.lod); },
  opts: SHIP_OPTS, names: SHIP_NAMES, def: SHIP_DEF, rig: RIG, title: 'KAGE ODYSSEY', extra: true };
Object.assign(KF.OPT_TITLES, { view: 'VISTA', warp: 'GONDOLE WARP' });
root.KageStar = { buildStarship, buildDeck, buildBadge, buildDisplay, buildPlanet, buildStars, buildStreaks, buildClouds, buildSite, siteHeight, hexBadge,
  DECKS, LIFT_Z, RIG, DEST, DEST_ORDER, SITES, WARP_STEPS, warpC, dist, SHIP_DEF };
})(typeof window !== 'undefined' ? window : globalThis);
