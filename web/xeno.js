/* KAGE XENO: the UFO (outside + walkable inside), its tractor beam, the CHRONO time cabin and the time vortex.
 * Original designs, same vertex layout as web/vehicles.js (aPos aNorm aCol aAnim). Every primitive carries a part name (mb.part)
 * so tools/export_obj.js can write each assembly as separate OBJ objects. */
(function (root) {
'use strict';
const KF = root.KageFleet, MB = KF.MB, T = KF.T, RX = KF.RX, RY = KF.RY, RZ = KF.RZ, M = KF.M, PI = Math.PI, TAU = PI * 2;
const mat = (c, e, slot, mode, a) => ({ c, e: e || 0, slot: slot || 0, mode: mode || 0, a: a || [0, 0, 0] });
const lerp = (a, b, t) => a + (b - a) * t;
const Q = lod => lod === 'lo' ? 0.5 : lod === 'ultra' ? 3 : 1.4;

/** surface of revolution about local y: prof = [[r, y], ...] bottom → top; colf(j, k, seg) → material; inward = normals point to the axis */
function lathe(mb, prof, seg, colf, inward, a0, a1, skip) {
  a0 = a0 || 0; a1 = a1 === undefined ? TAU : a1;
  const g = prof.map(([r, y], j) => { const row = []; for (let k = 0; k <= seg; k++) { const a = lerp(a0, a1, k / seg); row.push(mb.v([Math.sin(a) * r, y, Math.cos(a) * r], typeof colf === 'function' ? colf(j, k, seg, a) : colf)); } return row; });
  for (let j = 0; j + 1 < g.length; j++) for (let k = 0; k < seg; k++) {
    if (skip && skip(j, lerp(a0, a1, (k + 0.5) / seg))) continue;
    const a = g[j][k], b = g[j + 1][k], c = g[j + 1][k + 1], d = g[j][k + 1];
    if (inward) { mb.tri(a, b, c); mb.tri(a, c, d); } else { mb.tri(a, c, b); mb.tri(a, d, c); }
  }
}

/* ---------------- UFO ---------------- */
const UFO_OPTS = { hull: ['disco', 'cupola', 'anello'], paint: ['argento', 'nero', 'bianco', 'oro', 'verde', 'viola'], accent: ['nero', 'argento', 'oro', 'ciano'], led: Object.keys(KF.LEDS), legs: [true, false] };
const UFO_NAMES = { hull: { disco: 'DISCO CLASSICO', cupola: 'GRANDE CUPOLA', anello: 'ANELLO ROTANTE' } };
const UFO_DEF = { hull: 'disco', paint: 'argento', accent: 'nero', led: 'lime', legs: true };
/** rig (local metres): deck floor, interior radius, lift pad, pilot seat, emitter */
const UFO_RIG = { floor: 2.0, ceil: 5.2, rIn: 7.8, core: 1.25, lift: [0, -4.2], liftR: 1.3, seat: [0, 5.3], emitY: 1.15, R: 12, legY: 1.15 };
function buildUfo(o, lod) {
  o = Object.assign({}, UFO_DEF, o || {}); lod = lod || o.lod;
  const mb = new MB(), q = Q(lod), N = k => Math.max(8, Math.round(k * q));
  const paint = KF.COLORS[o.paint] || KF.COLORS.argento, acc = KF.COLORS[o.accent] || KF.COLORS.nero, led = KF.LEDS[o.led] || KF.LEDS.lime;
  const P = mat(paint, 0, 1), A = mat(acc, 0, 2), L = mat(led, 1.2, 3), G = mat([0.06, 0.1, 0.12], 0, 4), dark = mat([0.04, 0.045, 0.05]);
  const R = UFO_RIG.R, seg = N(64);
  // lower hull: a shallow lens from the emitter ring out to the rim (panel lines every 30°)
  mb.part = 'scafo_inferiore';
  const panel = (j, k, s, a) => (Math.abs(((a / TAU * 12) % 1) - 0.5) > 0.485 ? mat(paint.map(v => v * 0.55), 0, 1) : P);
  mb.disc(7.2, seg, 1.15, mat(paint.map(v => v * 0.8), 0, 1));
  lathe(mb, [[7.2, 1.15], [8.0, 1.35], [8.9, 1.7], [10.4, 2.35], [11.5, 2.85], [12, 3.15]], seg, panel, true, 0, TAU, (j, a) => j >= 2 && Math.cos(a) > 0.86);   // the bridge window opens the front
  // rim: thick ring, accent band and the running lights (they spin with uRotA: mode 1 about the axis)
  mb.part = 'bordo';
  lathe(mb, [[12, 3.15], [12.35, 3.3], [12.45, 3.55], [12.35, 3.8], [12, 3.95]], seg, A, true, 0, TAU, (j, a) => Math.cos(a) > 0.86);
  mb.part = 'luci_bordo';
  const nl = 24; for (let k = 0; k < nl; k++) { const a = k / nl * TAU; if (Math.cos(a) > 0.86) continue; mb.ellipsoid(Math.sin(a) * 12.47, 3.55, Math.cos(a) * 12.47, 0.28, 0.18, 0.28, N(8), 6, mat(k % 2 ? led : [1, 1, 1], 1.4, 3, 1, [0, 0, 0])); }
  // upper hull
  mb.part = 'scafo_superiore';
  const dome = o.hull === 'cupola';
  lathe(mb, [[12, 3.95], [11.2, 4.35], [9.8, 4.95], [8.2, 5.5], [6.6, 5.9], [dome ? 6.2 : 4.8, dome ? 6.05 : 6.25]], seg, panel, true, 0, TAU, (j, a) => j < 2 && Math.cos(a) > 0.86);
  mb.part = 'cornice_vetrata'; for (const s of [-1, 1]) { const a = s * Math.acos(0.86); mb.rod([Math.sin(a) * 10.4, 2.35, Math.cos(a) * 10.4], [Math.sin(a) * 12.4, 3.55, Math.cos(a) * 12.4], 0.14, 8, A); mb.rod([Math.sin(a) * 12.4, 3.55, Math.cos(a) * 12.4], [Math.sin(a) * 9.8, 4.95, Math.cos(a) * 9.8], 0.14, 8, A); }
  mb.part = 'scafo_superiore';
  // portholes (emissive, the interior lights) on the upper hull
  mb.part = 'oblo';
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * TAU, r = 9.95, y = 4.92;
    mb.push(M(T(Math.sin(a) * r, y, Math.cos(a) * r), RY(a), RX(-0.62))); mb.cyl(-0.02, 0.06, 0.42, 0.36, N(12), mat([0.85, 1, 0.75], 0.9, 3)); mb.pop(); }
  // dome: glass over the bridge, with a cap
  mb.part = 'cupola';
  const dr = dome ? 6.2 : 4.8, dh = dome ? 3.2 : 2.1, dy = dome ? 6.05 : 6.25, dp = [];
  for (let j = 0; j <= 8; j++) { const t = j / 8, a = t * PI / 2; dp.push([Math.cos(a) * dr, dy + Math.sin(a) * dh]); }
  lathe(mb, dp.slice(0, 7), seg, G, true);
  mb.part = 'antenna';
  mb.push(T(0, dy + dh - 0.15, 0)); mb.cyl(0, 0.35, 1.1, 0.7, N(24), A); mb.cyl(0.35, 1.4, 0.12, 0.05, N(10), A); mb.pop();
  mb.ellipsoid(0, dy + dh + 1.3, 0, 0.22, 0.22, 0.22, N(10), 8, mat(led, 1.6, 3, 7));
  // the outer ring of the 'anello' hull: a separate counter-rotating band around the rim
  if (o.hull === 'anello') { mb.part = 'anello_rotante';
    mb.push(T(0, 3.55, 0)); mb.torus(13.5, 0.38, N(72), N(10), mat(acc, 0, 2, 1, [0, 0, 0])); mb.pop();
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; mb.box(Math.sin(a) * 12.9, 3.55, Math.cos(a) * 12.9, 1.1, 0.16, 0.3, mat(acc, 0, 2, 1, [0, 0, 0])); mb.part = 'anello_rotante'; } }
  // emitter: recessed ring + lens under the lift (the beam comes out of it)
  mb.part = 'emettitore';
  const lx = UFO_RIG.lift[0], lz = UFO_RIG.lift[1];
  mb.push(T(lx, UFO_RIG.emitY, lz)); mb.cyl(-0.12, 0.0, 2.0, 2.0, N(40), dark); mb.pop();
  mb.push(T(lx, UFO_RIG.emitY - 0.13, lz)); mb.torus(1.85, 0.12, N(40), 8, L); mb.disc(1.7, N(40), 0.0, mat(led.map(v => v * 0.7 + 0.2), 1.0, 3)); mb.pop();
  // central drive ring (decor)
  mb.push(T(0, UFO_RIG.emitY - 0.02, 0)); mb.torus(5.2, 0.14, N(64), 6, mat(led, 0.9, 3, 1, [0, 0, 0])); mb.torus(2.4, 0.1, N(40), 6, mat(led, 0.7, 3, 2, [0, 0, 0])); mb.pop();
  // landing legs (tripod, with pads)
  if (o.legs) { mb.part = 'carrello'; mb.anim('CARRELLO', [0, 0, 0], [0, 1, 0], 1.55, 1);
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + PI / 3, ax = Math.sin(a), az = Math.cos(a);
      mb.rod([ax * 6.8, 1.75, az * 6.8], [ax * 8.6, 0.12, az * 8.6], 0.26, N(10), A, 0.18);
      mb.rod([ax * 5.2, 1.4, az * 5.2], [ax * 8.0, 0.6, az * 8.0], 0.12, N(8), A);
      mb.push(T(ax * 8.6, 0, az * 8.6)); mb.cyl(0, 0.14, 0.75, 0.6, N(16), dark); mb.cyl(0.14, 0.2, 0.6, 0.6, N(16), L, false); mb.pop(); } mb.animEnd(); }
  // boarding ramp under the lift (hinged at the rear edge, swings down to the ground)
  mb.part = 'rampa'; { const lx = UFO_RIG.lift[0], lz = UFO_RIG.lift[1]; mb.anim('RAMPA', [lx, UFO_RIG.emitY - 0.16, lz - 2.2], [1, 0, 0], 0.62);
    mb.box(lx, UFO_RIG.emitY - 0.2, lz - 4.3, 2.4, 0.1, 4.2, A); for (let i = 0; i < 6; i++) mb.box(lx, UFO_RIG.emitY - 0.14, lz - 2.6 - i * 0.65, 2.0, 0.03, 0.08, L); mb.animEnd(); }
  const m = mb.finish(); m.kind = 'ufo'; return m;
}

/** the walkable inside (separate mesh, drawn when you're near or inside the ship) */
function buildUfoInterior(o, lod) {
  o = Object.assign({}, UFO_DEF, o || {}); lod = lod || o.lod;
  const mb = new MB(), q = Q(lod), N = k => Math.max(8, Math.round(k * q)), R = UFO_RIG;
  const led = KF.LEDS[o.led] || KF.LEDS.lime, wall = mat([0.34, 0.36, 0.4]), rib = mat([0.16, 0.17, 0.19]), floorC = [0.2, 0.21, 0.23], dark = mat([0.03, 0.032, 0.036]);
  const L = mat(led, 1.1, 3), soft = mat(led.map(v => v * 0.6 + 0.25), 0.55, 3), glass = mat([0.1, 0.16, 0.16], 0, 4), seg = N(64);
  // deck: hex-pattern floor (tinted per tile) with a glowing ring path
  mb.part = 'pavimento';
  const rings = 10; for (let j = 0; j < rings; j++) { const r0 = j / rings * R.rIn, r1 = (j + 1) / rings * R.rIn, n = Math.max(6, Math.round(seg * (j + 1) / rings));
    for (let k = 0; k < n; k++) { const a0 = k / n * TAU, a1 = (k + 1) / n * TAU, tint = 0.85 + 0.15 * ((j + k) % 2), c = floorC.map(v => v * tint);
      const ring = j === 6 ? soft : mat(c, 0, 0);
      mb.poly([[Math.sin(a0) * r0, R.floor, Math.cos(a0) * r0], [Math.sin(a0) * r1, R.floor, Math.cos(a0) * r1], [Math.sin(a1) * r1, R.floor, Math.cos(a1) * r1], [Math.sin(a1) * r0, R.floor, Math.cos(a1) * r0]].reverse(), ring); } }
  // curved wall, ceiling dome, ribs
  mb.part = 'pareti';
  lathe(mb, [[R.rIn, R.floor], [R.rIn, R.floor + 0.25], [R.rIn - 0.1, R.floor + 2.2], [R.rIn - 0.6, R.ceil - 0.2], [R.rIn - 1.4, R.ceil]], seg, (j, k, s, a) => {
    return wall; }, false, 0, TAU, (j, a) => Math.cos(a) > 0.86 && j >= 1 && j <= 2);
  mb.part = 'cornice_vetrata'; for (const s of [-1, 1]) { const a = s * Math.acos(0.86); mb.rod([Math.sin(a) * R.rIn, R.floor + 0.25, Math.cos(a) * R.rIn], [Math.sin(a) * (R.rIn - 0.6), R.ceil - 0.2, Math.cos(a) * (R.rIn - 0.6)], 0.09, 8, rib); }
  mb.part = 'pareti';
  mb.part = 'soffitto';
  lathe(mb, [[R.rIn - 1.4, R.ceil], [4.5, R.ceil + 0.35], [1.6, R.ceil + 0.5], [0.01, R.ceil + 0.5]], seg, wall, false);
  mb.part = 'costole';
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * TAU; if (Math.cos(a) > 0.8) continue;
    mb.push(RY(a)); mb.box(0, R.floor + 1.6, R.rIn - 0.25, 0.35, 3.2, 0.3, rib); mb.box(0, R.floor + 0.08, R.rIn - 0.4, 0.5, 0.06, 0.2, L); mb.box(0, R.ceil - 0.1, R.rIn - 1.3, 0.3, 0.2, 1.6, rib); mb.pop(); }
  mb.part = 'luci_soffitto';
  mb.push(T(0, R.ceil + 0.32, 0)); mb.torus(4.2, 0.09, N(48), 6, mat([0.9, 1, 0.9], 1.3, 3)); mb.torus(2.4, 0.07, N(40), 6, soft); mb.pop();
  // the power core: glass column, glowing plasma, spinning rings
  mb.part = 'nucleo';
  mb.push(T(0, R.floor, 0)); mb.cyl(0, 0.5, R.core + 0.35, R.core + 0.2, N(32), dark); mb.cyl(R.ceil - R.floor - 0.4, R.ceil - R.floor + 0.5, R.core + 0.2, R.core + 0.5, N(32), dark);
  mb.cyl(0.5, R.ceil - R.floor - 0.4, R.core * 0.55, R.core * 0.55, N(24), mat(led, 1.8, 3, 7), false);
  mb.cyl(0.5, R.ceil - R.floor - 0.4, R.core, R.core, N(32), glass, false); mb.pop();
  mb.part = 'anelli_nucleo';
  for (let k = 0; k < 3; k++) { mb.push(M(T(0, R.floor + 1.2 + k * 0.9, 0), RX(0.3 * (k - 1)))); mb.torus(R.core + 0.12, 0.05, N(36), 6, mat(led, 1.4, 3, k % 2 ? 2 : 1, [0, 0, 0])); mb.pop(); }
  // lift pad (the beam drops you here) + its glow ring
  mb.part = 'pedana_raggio';
  mb.push(T(R.lift[0], R.floor, R.lift[1])); mb.cyl(0, 0.06, R.liftR + 0.25, R.liftR + 0.2, N(32), dark); mb.disc(R.liftR, N(32), 0.065, mat(led.map(v => v * 0.6 + 0.3), 1.2, 3)); mb.torus(R.liftR + 0.1, 0.05, N(32), 6, L); mb.pop();
  // bridge: curved console, three seats facing the front window, holo screens
  mb.part = 'plancia';
  lathe(mb, [[R.seat[1] + 0.75, R.floor], [R.seat[1] + 0.8, R.floor + 0.85], [R.seat[1] + 1.25, R.floor + 1.0], [R.seat[1] + 1.35, R.floor + 0.95]], N(24), (j) => j === 2 ? mat([0.12, 0.13, 0.14]) : dark, true, -0.6, 0.6);
  for (let k = -3; k <= 3; k++) { const a = k * 0.16; mb.push(RY(a)); mb.box(0, R.floor + 1.0, R.seat[1] + 1.05, 0.34, 0.02, 0.24, mat(k % 2 ? led : [0.3, 0.8, 1], 1.1, 3)); mb.pop(); }
  mb.part = 'schermi_olografici';
  for (const k of [-1, 1]) { mb.push(M(RY(k * 0.62), T(0, R.floor + 1.35, R.seat[1] + 1.25), RX(-0.35))); mb.box(0, 0, 0, 0.9, 0.5, 0.02, mat(led.map(v => v * 0.5 + 0.2), 0.8, 3)); mb.pop(); }
  mb.part = 'sedili';
  for (const k of [-1, 0, 1]) { mb.push(M(RY(k * 0.42), T(0, R.floor, R.seat[1] - 0.15))); mb.cyl(0, 0.42, 0.12, 0.1, N(10), dark); mb.box(0, 0.48, 0, 0.55, 0.1, 0.55, mat([0.2, 0.21, 0.23])); mb.box(0, 0.95, -0.27, 0.55, 0.9, 0.1, mat([0.2, 0.21, 0.23]), [0.85, 1]); mb.box(0, 0.5, 0.29, 0.6, 0.03, 0.03, L); mb.pop(); }
  // star-map table with a holographic galaxy (spinning)
  mb.part = 'mappa_stellare';
  mb.push(T(-4.4, R.floor, 0.6)); mb.cyl(0, 0.9, 0.5, 0.7, N(20), dark); mb.cyl(0.9, 1.0, 1.1, 1.1, N(28), mat([0.12, 0.13, 0.14])); mb.disc(1.0, N(28), 1.005, soft); mb.pop();
  mb.part = 'ologramma_galassia';
  for (let k = 0; k < 90; k++) { const arm = k % 3, t = (k / 90), a = arm / 3 * TAU + t * 5, r = 0.1 + t * 0.85;
    mb.ellipsoid(-4.4 + Math.sin(a) * r, R.floor + 1.35 + Math.sin(k * 1.7) * 0.03, 0.6 + Math.cos(a) * r, 0.03, 0.03, 0.03, 4, 3, mat(k % 7 ? [0.7, 0.9, 1] : led, 1.6, 3, 1, [-4.4, 0.6, 0])); }
  // specimen tubes (stasis pods) along the right wall
  mb.part = 'capsule_stasi';
  for (let k = 0; k < 4; k++) { const a = -PI / 2 + (k - 1.5) * 0.36, x = Math.sin(a) * (R.rIn - 1.2), z = Math.cos(a) * (R.rIn - 1.2);
    mb.push(T(x, R.floor, z)); mb.cyl(0, 0.3, 0.75, 0.75, N(20), dark); mb.cyl(0.3, 2.5, 0.6, 0.6, N(20), glass, false); mb.cyl(0.32, 2.48, 0.56, 0.56, N(16), mat([0.4, 1, 0.75], 0.35, 3), false);
    mb.cyl(2.5, 2.85, 0.75, 0.6, N(20), dark); mb.torus(0.62, 0.04, N(20), 6, L); mb.pop(); }
  // engine room grilles + conduits on the left
  mb.part = 'condotti';
  for (let k = 0; k < 5; k++) { const a = PI / 2 + (k - 2) * 0.3; mb.push(RY(a)); mb.box(0, R.floor + 1.2, R.rIn - 0.3, 0.9, 2.0, 0.2, mat([0.1, 0.11, 0.12])); for (let i = 0; i < 6; i++) mb.box(0, R.floor + 0.45 + i * 0.3, R.rIn - 0.42, 0.75, 0.05, 0.04, soft); mb.pop(); }
  mb.push(T(0, R.ceil + 0.15, 0)); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; mb.rod([Math.sin(a) * 1.6, 0, Math.cos(a) * 1.6], [Math.sin(a) * (R.rIn - 1.6), -0.1, Math.cos(a) * (R.rIn - 1.6)], 0.09, N(8), rib); } mb.pop();
  const m = mb.finish(); m.kind = 'ufo_interno'; return m;
}

/** tractor beam: open cone (glow-only) with spiral bands that turn with uRotA; height h, radius r0 at the emitter, r1 at the ground */
function buildBeam(o) {
  o = o || {}; const mb = new MB(), led = KF.LEDS[o.led] || KF.LEDS.lime, H = 30, r0 = 1.8, r1 = 5.5, seg = 40, rows = 24;
  mb.part = 'raggio';
  for (let j = 0; j < rows; j++) for (let k = 0; k < seg; k++) {
    const t0 = j / rows, t1 = (j + 1) / rows, a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU;
    const band = 0.5 + 0.5 * Math.sin((a0 + t0 * 9) * 3), e = (0.35 + 0.65 * band) * (1 - t0 * 0.55);
    const m = mat(led.map(v => v * 0.6 + 0.35), e, 3, 1, [0, 0, 0]), R0 = lerp(r0, r1, t0), R1 = lerp(r0, r1, t1);
    mb.poly([[Math.sin(a0) * R0, -t0 * H, Math.cos(a0) * R0], [Math.sin(a1) * R0, -t0 * H, Math.cos(a1) * R0], [Math.sin(a1) * R1, -t1 * H, Math.cos(a1) * R1], [Math.sin(a0) * R1, -t1 * H, Math.cos(a0) * R1]], m);
  }
  mb.part = 'anelli_raggio';
  for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6; mb.push(T(0, -t * H, 0)); mb.torus(lerp(r0, r1, t) * 0.92, 0.06, 40, 4, mat([1, 1, 1], 0.9, 3, 1, [0, 0, 0])); mb.pop(); }
  const m = mb.finish(); m.H = H; return m;
}

/* ---------------- EPOCH (kind 'chrono'): Art Deco time cabin (brass, glass, dials, counter-rotating gear crowns) ---------------- */
const CHRONO_OPTS = { metal: ['ottone', 'rame', 'argento', 'bronzo_scuro'], glass: ['trasparente', 'ambra', 'fumé'], led: ['ambra', 'ciano', 'magenta', 'bianco'] };
const CHRONO_NAMES = { metal: { ottone: 'OTTONE', rame: 'RAME', argento: 'ARGENTO', bronzo_scuro: 'BRONZO SCURO' }, glass: { trasparente: 'TRASPARENTE', ambra: 'AMBRA', 'fumé': 'FUMÉ' } };
const CHRONO_DEF = { metal: 'ottone', glass: 'ambra', led: 'ambra' };
const METALS = { ottone: [0.78, 0.6, 0.26], rame: [0.72, 0.38, 0.22], argento: [0.7, 0.72, 0.75], bronzo_scuro: [0.36, 0.27, 0.16] };
const CHRONO_RIG = { r: 1.05, h: 2.75, door: [0, 1.05] };
function buildChrono(o, lod) {
  o = Object.assign({}, CHRONO_DEF, o || {}); lod = lod || o.lod;
  const mb = new MB(), q = Q(lod), N = k => Math.max(6, Math.round(k * q));
  const met = METALS[o.metal] || METALS.ottone, Mt = mat(met, 0, 2), Md = mat(met.map(v => v * 0.55), 0, 2), led = KF.LEDS[o.led] || KF.LEDS.ambra, L = mat(led, 1.2, 3);
  const gl = { trasparente: [0.08, 0.1, 0.11], ambra: [0.22, 0.13, 0.04], 'fumé': [0.04, 0.04, 0.045] }[o.glass] || [0.08, 0.1, 0.11], Gl = mat(gl, 0, 4), wood = mat([0.2, 0.1, 0.045]);
  const R = CHRONO_RIG.r, H = CHRONO_RIG.h, oct = k => k / 8 * TAU + PI / 8;
  // stepped base and floor
  mb.part = 'basamento';
  mb.push(RY(PI / 8)); mb.cyl(0, 0.12, R * 1.32, R * 1.3, 8, Md); mb.cyl(0.12, 0.22, R * 1.18, R * 1.14, 8, Mt); mb.pop();
  mb.push(RY(PI / 8)); mb.cyl(0.22, 0.24, R * 1.05, R * 1.05, 8, wood); mb.pop();
  mb.push(T(0, 0.245, 0)); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; mb.rod([0, 0, 0], [Math.sin(a) * R * 0.95, 0, Math.cos(a) * R * 0.95], 0.012, 4, Mt); } mb.torus(R * 0.5, 0.012, N(24), 4, Mt); mb.pop();
  // eight pilasters with stepped capitals
  mb.part = 'colonne';
  for (let k = 0; k < 8; k++) { const a = oct(k) - PI / 8 + 0.0, x = Math.sin(a) * R * 1.07, z = Math.cos(a) * R * 1.07;
    mb.push(M(T(x, 0.22, z), RY(a))); mb.box(0, (H - 0.6) / 2, 0, 0.11, H - 0.6, 0.11, Mt); mb.box(0, H - 0.6, 0, 0.16, 0.08, 0.16, Mt); mb.box(0, H - 0.53, 0, 0.13, 0.06, 0.13, Md);
    for (let i = 0; i < 3; i++) mb.box(0, 0.25 + i * 0.05, 0, 0.14 - i * 0.015, 0.03, 0.14 - i * 0.015, Md); mb.pop(); }
  // glass panels with Deco sunburst mullions; the front one is the door (hinged frame + handle)
  mb.part = 'vetrate';
  for (let k = 0; k < 8; k++) { const a = oct(k), w = 2 * R * Math.tan(PI / 8) * 0.95, rr = R * Math.cos(PI / 8) * 1.06;
    mb.push(M(RY(a), T(0, 0.22, rr))); if (k === 0) mb.anim('PORTA', [-w / 2, 0, 0], [0, 1, 0], 1.7);
    mb.box(0, (H - 0.62) / 2 + 0.02, 0, w * 0.92, H - 0.68, 0.02, Gl);
    mb.part = 'telai'; mb.box(0, 0.09, 0.01, w, 0.12, 0.04, Mt); mb.box(0, H - 0.68, 0.01, w, 0.06, 0.04, Mt); mb.box(0, 0.95, 0.012, w, 0.035, 0.03, Mt);
    for (let i = -2; i <= 2; i++) { const ang = i * 0.32; mb.push(M(T(0, 0.95, 0.014), RZ(ang))); mb.box(0, 0.38, 0, 0.018, 0.76, 0.02, Md); mb.pop(); }
    if (k === 0) { mb.part = 'porta'; mb.box(w * 0.4, 0.95, 0.04, 0.03, 0.22, 0.03, Mt); mb.ellipsoid(w * 0.4, 1.08, 0.055, 0.03, 0.03, 0.03, N(8), 6, Mt); }
    mb.animEnd(); mb.part = 'vetrate'; mb.pop(); }
  // cornice, clock faces on four sides, roof lantern
  mb.part = 'cornicione';
  mb.push(M(T(0, H - 0.5, 0), RY(PI / 8))); mb.cyl(0, 0.12, R * 1.18, R * 1.24, 8, Mt); mb.cyl(0.12, 0.3, R * 1.22, R * 1.22, 8, Md); mb.cyl(0.3, 0.38, R * 1.24, R * 1.12, 8, Mt); mb.pop();
  mb.part = 'quadranti';
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU, rr = R * 1.23;
    mb.push(M(RY(a), T(0, H - 0.29, rr), RX(PI / 2))); mb.cyl(0, 0.02, 0.14, 0.14, N(20), mat([0.95, 0.9, 0.78], 0.15)); mb.torus(0.145, 0.012, N(20), 4, Mt);
    for (let i = 0; i < 12; i++) { const b = i / 12 * TAU; mb.box(Math.sin(b) * 0.115, 0.022, Math.cos(b) * 0.115, 0.008, 0.004, 0.02, mat([0.1, 0.08, 0.05])); } mb.pop();
    mb.push(M(RY(a), T(0, H - 0.29, rr + 0.028), RZ(0.9 + k))); mb.box(0, 0.045, 0, 0.012, 0.09, 0.004, mat([0.05, 0.04, 0.03])); mb.pop();
    mb.push(M(RY(a), T(0, H - 0.29, rr + 0.03), RZ(-1.4 + k * 2))); mb.box(0, 0.06, 0, 0.008, 0.12, 0.004, mat([0.05, 0.04, 0.03])); mb.pop(); }
  mb.part = 'cupola';
  const cp = []; for (let j = 0; j <= 8; j++) { const t = j / 8; cp.push([R * 0.82 * Math.cos(t * PI / 2) + 0.02, H - 0.12 + Math.sin(t * PI / 2) * 0.55]); }
  lathe(mb, cp, N(32), (j) => j % 3 === 2 ? Md : Mt, false);
  // two gear crowns spinning in opposite directions (mode 1 / 2 about the axis)
  mb.part = 'corone_ingranaggi';
  for (const [y, r, dir, teeth] of [[H - 0.04, R * 0.98, 1, 32], [H + 0.2, R * 0.74, 2, 24]]) {
    const G = mat(met, 0, 2, dir, [0, 0, 0]); mb.push(T(0, y, 0)); mb.torus(r, 0.035, N(48), 6, G);
    for (let i = 0; i < teeth; i++) { const b = i / teeth * TAU; mb.push(RY(b)); mb.box(0, 0, r + 0.05, 0.05, 0.06, 0.08, G); mb.pop(); }
    for (let i = 0; i < 4; i++) { const b = i / 4 * TAU; mb.rod([0, 0, 0], [Math.sin(b) * r, 0, Math.cos(b) * r], 0.018, 4, G); } mb.pop(); }
  mb.part = 'lanterna';
  mb.push(T(0, H + 0.42, 0)); mb.cyl(0, 0.3, 0.16, 0.12, N(12), Mt); mb.cyl(0.05, 0.28, 0.11, 0.11, N(12), L, false); mb.cyl(0.3, 0.42, 0.14, 0.02, N(12), Mt); mb.pop();
  mb.ellipsoid(0, H + 0.9, 0, 0.05, 0.05, 0.05, N(8), 6, mat(led, 1.8, 3, 7));
  mb.rod([0, H + 0.72, 0], [0, H + 0.86, 0], 0.012, 5, Mt);
  // inside: a leather seat, the time lever on a brass console, glowing date wheels
  mb.part = 'sedile';
  mb.push(T(0, 0.24, -0.35)); mb.box(0, 0.24, 0, 0.5, 0.06, 0.45, mat([0.35, 0.12, 0.08])); mb.box(0, 0.6, -0.21, 0.5, 0.7, 0.06, mat([0.35, 0.12, 0.08])); mb.cyl(0, 0.22, 0.05, 0.05, 8, Mt); mb.pop();
  mb.part = 'console_temporale';
  mb.push(T(0, 0.24, 0.45)); mb.box(0, 0.42, 0, 0.62, 0.84, 0.18, Md, [0.9, 1]); mb.box(0, 0.86, -0.04, 0.66, 0.05, 0.3, Mt);
  for (let i = 0; i < 4; i++) mb.box(-0.21 + i * 0.14, 0.7, -0.095, 0.1, 0.12, 0.01, mat(led, 1.1, 3));
  mb.rod([0.22, 0.88, -0.05], [0.26, 1.18, -0.16], 0.014, 6, Mt); mb.ellipsoid(0.26, 1.2, -0.17, 0.035, 0.035, 0.035, N(8), 6, mat([0.5, 0.05, 0.05])); mb.pop();
  const m = mb.finish(); m.kind = 'chrono'; return m;
}

/* ---------------- time vortex: a long glowing tunnel along local -z (spiral bands; two layers that turn opposite ways) ---------------- */
function buildVortex(lod) {
  const mb = new MB(), q = Q(lod), seg = Math.round(48 * q), rows = Math.round(90 * q), Lz = 600;
  const cols = [[0.2, 0.45, 1], [0.7, 0.25, 1], [1, 0.45, 0.2], [0.25, 1, 0.85]];
  for (const [layer, R, mode] of [[0, 16, 1], [1, 11, 2]]) {
    mb.part = layer ? 'vortice_interno' : 'vortice_esterno';
    // the tube runs along local y (so the rotor modes spin it about its own axis); the game turns it to face the flight
    const g = []; for (let j = 0; j <= rows; j++) { const t = j / rows, y = -t * Lz, row = [];
      for (let k = 0; k <= seg; k++) { const a = k / seg * TAU, sw = a * 2 + t * 40 * (layer ? -1 : 1), b = Math.pow(0.5 + 0.5 * Math.sin(sw), 3);
        const c = cols[(Math.floor((sw / TAU) + 8) + layer) % 4], rr = R * (1 + 0.18 * Math.sin(t * 30 + a * 3)), e = 0.25 + 1.3 * b;
        row.push(mb.v([Math.sin(a) * rr, y, Math.cos(a) * rr], mat(c.map(v => v * (0.4 + 0.6 * b)), e, 3, mode, [0, 0, 0]))); }
      g.push(row); }
    for (let j = 0; j < rows; j++) for (let k = 0; k < seg; k++) { mb.tri(g[j][k], g[j + 1][k], g[j + 1][k + 1]); mb.tri(g[j][k], g[j + 1][k + 1], g[j][k + 1]); }
  }
  // drifting sparks along the axis
  mb.part = 'scintille';
  for (let k = 0; k < 160; k++) { const a = k * 2.39, r = 2 + (k * 37 % 80) / 10, y = -(k * 97 % 600);
    mb.ellipsoid(Math.sin(a) * r, y, Math.cos(a) * r, 0.12, 0.6, 0.12, 4, 3, mat([1, 0.95, 0.85], 1.6, 3, 1, [0, 0, 0])); }
  const m = mb.finish(); m.kind = 'vortex'; m.L = Lz; return m;
}

Object.assign(KF.KINDS, {
  ufo: { build: buildUfo, opts: UFO_OPTS, names: UFO_NAMES, def: UFO_DEF, rig: UFO_RIG, title: 'KAGE XENO', extra: true },
  chrono: { build: buildChrono, opts: CHRONO_OPTS, names: CHRONO_NAMES, def: CHRONO_DEF, rig: CHRONO_RIG, title: 'KAGE EPOCH', extra: true },
  ufoin: { build: buildUfoInterior, opts: UFO_OPTS, names: UFO_NAMES, def: UFO_DEF, rig: UFO_RIG, title: 'KAGE XENO · INTERNO', hidden: true },
  vortex: { build: (o, lod) => buildVortex(lod || (o && o.lod)), opts: {}, names: {}, def: {}, rig: {}, title: 'VORTICE TEMPORALE', hidden: true },
  beam: { build: buildBeam, opts: {}, names: {}, def: {}, rig: {}, title: 'RAGGIO TRAENTE', hidden: true }
});
KF.KINDS.alien = { build: (o, lod) => root.KagePilot.build(o, lod || (o && o.lod)), opts: { species: ['grigio', 'verde', 'nordico', 'scuro'], pose: ['in piedi', 'saluto', 'indica', 'braccia conserte', 'mani sui fianchi', 'pensieroso', 'esulta', 'cammina'] },
  names: { species: { grigio: 'GRIGIO', verde: 'PICCOLO VERDE', nordico: 'NORDICO', scuro: 'OMBRA' } }, def: { species: 'grigio', pose: 'in piedi' }, rig: {}, title: 'VISITATORI', extra: true };
Object.assign(KF.OPT_TITLES, { legs: 'CARRELLO', metal: 'METALLO', glass: 'VETRI', species: 'SPECIE', pose: 'POSA' });
root.KageXeno = { buildUfo, buildUfoInterior, buildBeam, buildChrono, buildVortex, lathe, UFO_RIG, CHRONO_RIG, UFO_DEF, CHRONO_DEF };
})(typeof window !== 'undefined' ? window : globalThis);
