/* Showroom for the whole KAGE line-up: the KAGE GT (showroom.js) plus the KAGE STRIX drone, the KAGE RIPTIDE speedboat and the
 * KAGE LEVIATHAN galleon. Boats float in a studio basin, the drone hovers over the turntable. Customisation, specs, model resolution. */
(function () {
'use strict';
const KF = window.KageFleet, U = window.CarRenderUtil, SR = window.Showroom;
if (!KF || !SR) return;
function perspective(fovy, aspect, near, far) { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); return new Float32Array([f / aspect,0,0,0, 0,f,0,0, 0,0,(far + near) * nf,-1, 0,0,2 * far * near * nf,0]); }
function lookAt(e, c, up) {
  let fx = c[0] - e[0], fy = c[1] - e[1], fz = c[2] - e[2]; let l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
  let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0]; l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
  const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
  return { m: new Float32Array([sx,ux,-fx,0, sy,uy,-fy,0, sz,uz,-fz,0, -(sx*e[0]+sy*e[1]+sz*e[2]), -(ux*e[0]+uy*e[1]+uz*e[2]), (fx*e[0]+fy*e[1]+fz*e[2]), 1]), f: [fx,fy,fz], r: [sx,sy,sz], u: [ux,uy,uz] };
}
const LOD = { low: 'lo', high: 'hi', ultra: 'ultra' };
const SPECS = {
  drone: c => [['TIPO', 'Drone da corsa e da ripresa · classe 2 m'],
    ['PROPULSIONE', { quad: '4 motori brushless da 9 kW', hexa: '6 motori brushless da 8 kW', x8: '8 motori coassiali da 7 kW' }[c.frame]],
    ['BATTERIA', '18 kWh allo stato solido · boost a supercondensatori'], ['VELOCITÀ MAX', '130 km/h · 210 km/h in boost'],
    ['AUTONOMIA', '38 minuti in volo misto'], ['PESO', { racer: '34 kg', stealth: '31 kg', cargo: '46 kg' }[c.shell]],
    ['DIMENSIONI', '2,2 × 2,2 × 0,6 m'], ['SENSORI', 'gimbal 8K · LiDAR a 360° · radar anticollisione'],
    ['CARICO UTILE', c.shell === 'cargo' ? '25 kg nel vano ventrale' : '5 kg']],
  boat: c => [['TIPO', 'Motoscafo offshore · 10 m'], ['SCAFO', KF.optLabel('boat', 'hull', c.hull)],
    ['MOTORE', { outboard: '2 fuoribordo elettrici da 330 kW', jet: 'idrogetto da 600 kW', efan: 'elica intubata da 520 kW' }[c.engine]],
    ['VELOCITÀ MAX', c.hull === 'hydrofoil' ? '128 km/h sulle ali · 155 con N₂O' : '112 km/h · 140 con N₂O'],
    ['BATTERIA', '220 kWh · ricarica rapida in 30 minuti'], ['DIMENSIONI', 'L 10,0 m · B 2,7 m · pescaggio 0,6 m'],
    ['PESO', '3.200 kg'], ['POSTI', '4']],
  galleon: c => [['TIPO', 'Galeone a tre alberi · rifacimento cyber'], ['LUNGHEZZA', '34 m di scafo · 44 m col bompresso'],
    ['BAGLIO', '9 m · pescaggio 3,0 m'], ['VELATURA', KF.optLabel('galleon', 'sails', c.sails) + ' · 1.150 m²'],
    ['ASSIST', 'reattore a fusione compatto da 2 MW · eliche retrattili'], ['VELOCITÀ', '12 nodi a vela · 21 nodi con assist'],
    ['ARMAMENTO', c.cannons ? '18 cannoni a luce (stordiscono, non distruggono)' : 'disarmato'], ['EQUIPAGGIO', '24 + 6 droni di bordo'], ['DISLOCAMENTO', '480 t']]
};
SPECS.moto = c => [['TIPO', 'Superbike elettrica · ' + KF.optLabel('moto', 'fairing', c.fairing)], ['MOTORE', 'motore assiale da 160 kW · 300 Nm'], ['BATTERIA', '24 kWh · ricarica in 25 minuti'],
  ['VELOCITÀ MAX', '280 km/h'], ['ACCELERAZIONE', '0–100 km/h in 2,6 s'], ['RUOTE', KF.optLabel('moto', 'wheels', c.wheels) + ' · LED integrati'], ['PESO', '198 kg']];
SPECS.hover = c => [['TIPO', 'Hovercraft anfibio · strada e acqua'], ['PROPULSIONE', c.fans === 1 ? '1 elica intubata da 2,2 m' : '2 eliche intubate da 1,4 m'], ['SOSTENTAMENTO', 'cuscino d\'aria a 0,5 m · gonna in neoprene'],
  ['VELOCITÀ MAX', '95 km/h · 130 in boost'], ['CABINA', c.cabin === 'chiusa' ? 'chiusa, 4 posti' : 'pozzetto aperto, 2 posti'], ['DIMENSIONI', 'L 8,6 m · B 4,6 m'], ['PESO', '1.900 kg']];
SPECS.sub = c => [['TIPO', 'Sottomarino da esplorazione · ' + KF.optLabel('sub', 'hull', c.hull)], ['PROFONDITÀ MAX', '1.200 m (laguna: 24 m)'], ['PROPULSIONE', '2 propulsori elettrici orientabili'],
  ['VELOCITÀ', '32 km/h · 50 km/h in boost'], ['AUTONOMIA', '14 ore'], ['ATTREZZATURA', (c.arms ? '2 bracci robotici · ' : '') + 'fari da 20.000 lm · sonar'], ['EQUIPAGGIO', '2']];
SPECS.ufo = c => [['TIPO', 'Disco volante · ' + KF.optLabel('ufo', 'hull', c.hull)], ['DIAMETRO', '25 m · 3 ponti'], ['PROPULSIONE', 'nucleo a plasma · antigravità'], ['VELOCITÀ MAX', '210 km/h · 430 in boost'],
  ['RAGGIO TRAENTE', 'fino a 90 m · persone e veicoli'], ['A BORDO', 'plancia, nucleo, mappa stellare, capsule di stasi'], ['EQUIPAGGIO', 'grigio, piccolo verde, nordico, ombra']];
SPECS.chrono = c => [['TIPO', 'Cabina del tempo Art Déco · ' + KF.optLabel('chrono', 'metal', c.metal)], ['ALTEZZA', '3,7 m'], ['VETRI', KF.optLabel('chrono', 'glass', c.glass)], ['MECCANISMO', 'due corone di ingranaggi controrotanti'],
  ['DESTINAZIONI', 'Cybercity oggi ⇄ prateria del passato'], ['DOVE', 'KAGE GARAGE · INVIO per partire']];
SPECS.alien = c => [['SPECIE', KF.optLabel('alien', 'species', c.species)], ['ALTEZZA', { grigio: '1,24 m', verde: '1,38 m', nordico: '1,96 m', scuro: '2,08 m' }[c.species]],
  ['ORIGINE', { grigio: 'sistema sconosciuto', verde: 'cintura esterna', nordico: 'ammasso delle Pleiadi (dicono)', scuro: 'nessuno lo sa' }[c.species]], ['DOVE', 'a bordo del KAGE XENO']];
SPECS.pilot = c => [['RUOLO', 'Pilota collaudatore KAGE · auto, drone, mare'], ['ALTEZZA', KagePilot.label('height', c.height)], ['CORPORATURA', KagePilot.label('build', c.build)],
  ['TUTA', 'ignifuga in fibra aramidica · ' + KagePilot.label('suit', c.suit) + ' con LED ' + KagePilot.label('accent', c.accent)],
  ['CASCO', 'integrale in carbonio · visiera a realtà aumentata'], ['LICENZE', 'KAGE GT · STRIX · RIPTIDE · LEVIATHAN'], ['STATO', 'pronto al via']];
SR.FLEET_SPECS = SPECS;

SR.prototype.initFleet = function () {
  if (this.F) return;
  const gl = this.gl, SH = SHADERS;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, SH[v])); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, SH['common.glsl'] + '\n' + SH[f])); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; };
  const buf = (a, ix) => { const b = gl.createBuffer(); gl.bindBuffer(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, b); gl.bufferData(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, ix ? new Uint16Array(a) : new Float32Array(a), gl.STATIC_DRAW); return b; };
  this.F = { kind: null, veh: prog('vehicle.vert', 'vehicle.frag'), pil: prog('pilot.vert', 'vehicle.frag'), water: prog('water.vert', 'water.frag'), cache: {},
    vmesh: m => { const a = { aPos: [buf(m.pos), 3], aNorm: [buf(m.norm), 3], aCol: [buf(m.col), 4], aAnim: [buf(m.anim), 4] }; if (m.skin) a.aSkin = [buf(m.skin), 4]; return { a, i: buf(m.idx, true), n: m.idx.length, bounds: m.bounds, S: m.S, skin: !!m.skin }; },
    basin: { a: { aPos: [buf([-160, -160, 160, -160, 160, 160, -160, 160]), 2] }, i: buf([0, 1, 2, 0, 2, 3], true), n: 6 } };
};
SR.prototype.drawMesh = function (pr, m) {
  const gl = this.gl, used = [];
  for (const k in m.a) { const loc = gl.getAttribLocation(pr.p, k); if (loc < 0) continue; gl.bindBuffer(gl.ARRAY_BUFFER, m.a[k][0]); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, m.a[k][1], gl.FLOAT, false, 0, 0); used.push(loc); }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i); gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  for (const l of used) gl.disableVertexAttribArray(l);
};
/** kind: null / 'car' = KAGE GT, else drone / boat / galleon */
SR.prototype.setVehicle = function (kind, cfg) {
  if (!kind || kind === 'car') { if (this.F) this.F.kind = null; this.cam.dist = 7.2; this.cam.tgt = null; return; }
  this.initFleet();
  const F = this.F; F.kind = kind; F.cfg = Object.assign({}, cfg || (kind === 'pilot' ? KagePilot.load() : KF.loadCfg(kind))); F.t = 0;
  this.rebuildFleet();
  const b = F.mesh.bounds, R = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  this.cam.dist = { drone: 4.6, boat: 13, galleon: 52, pilot: 3.4, alien: 3.6, moto: 4, hover: 12, sub: 10, ufo: 36, chrono: 6 }[kind] || R * 1.4; this.cam.pitch = kind === 'galleon' ? 0.22 : (kind === 'pilot' || kind === 'alien') ? 0.08 : 0.2;
  if (this.cam.mode !== 'orbit' && this.cam.mode !== 'cockpit') this.cam.mode = 'orbit';
};
SR.prototype.rebuildFleet = function () {
  const F = this.F, key = F.kind + this.quality + JSON.stringify(F.cfg);
  const pc = (F.kind === 'pilot' || F.kind === 'alien') ? Object.assign({}, F.cfg, { pose: undefined }) : F.cfg, key2 = F.kind + this.quality + JSON.stringify(pc);
  if (!F.cache[key2]) F.cache[key2] = F.vmesh((F.kind === 'pilot' || F.kind === 'alien') ? KagePilot.build(pc, LOD[this.quality]) : KF.KINDS[F.kind].build(Object.assign({}, F.cfg, { lod: LOD[this.quality] || 'hi' })));
  F.mesh = F.cache[key2]; void key;
};
/** the pilot (seated pose) for the vehicle being shown */
SR.prototype.pilotSeat = function (kind) {
  if (!window.KagePilot) return null; const c = KagePilot.load(); if (c.inVehicle === false) return null;
  this.initFleet(); const S = KagePilot.SEATS[kind]; if (!S) return null;
  const cc = Object.assign({}, c, { pose: undefined }), key = 'pilot' + this.quality + JSON.stringify(cc);
  if (!this.F.cache[key]) this.F.cache[key] = this.F.vmesh(KagePilot.build(cc, LOD[this.quality]));
  return { mesh: this.F.cache[key], S };
};
/** draw a skinned pilot mesh with pose `pname` (bones from KagePilot.pose) under model matrix Mv */
SR.prototype.drawPilotMesh = function (set, mesh, Mv, pname, opt) {
  const gl = this.gl, pp = this.F.pil, u = pp.u;
  set(pp); gl.uniform1f(u.uLit, this.spots ? 2.1 : 1.2); gl.uniform1f(u.uDay, this.spots ? 0.3 : 0); gl.uniform1f(u.uGlowOnly, 0); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uBlur, 0);
  if (u.uShadow) gl.uniform1f(u.uShadow, 0); if (u.uPortal) gl.uniform1f(u.uPortal, 0);
  gl.uniformMatrix4fv(u.uModel, false, Mv);
  gl.uniformMatrix4fv(u['uBones[0]'] || u.uBones, false, KagePilot.pose(pname, this.t, opt, mesh.S));
  this.drawMesh(pp, mesh);
};
const setQ0 = SR.prototype.setQuality;
SR.prototype.setQuality = function (q) {
  if (this.F && this.F.kind) { this.quality = q; this.rebuildFleet(); return; }
  setQ0.call(this, q);
};
const frame0 = SR.prototype.frame;
/* the pilot sitting in the KAGE GT (car showroom) */
/** studio spotlights: soft light pools on the floor (additive) + three lamp heads on a ring above */
SR.prototype.drawSpots = function (set, R) {
  if (!this.spots) return; this.initFleet(); const F = this.F, gl = this.gl, vp = F.veh, u = vp.u;
  if (!F.spotM) { const mb = new KageFleet.MB(), rings = 14, seg = 48;
    for (const [cx, cz, rr, w] of [[0, 0, 1, 1], [0.9, 0.6, 0.55, 0.55], [-0.9, 0.6, 0.55, 0.55], [0, -1, 0.55, 0.55]]) for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) {
      const r0 = j / rings * rr, r1 = (j + 1) / rings * rr, a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, e = w * 1.15 * Math.pow(1 - j / rings, 1.4), m = { c: [1, 0.97, 0.92], e, slot: 3 };
      mb.poly([[cx + Math.sin(a0) * r0, 0, cz + Math.cos(a0) * r0], [cx + Math.sin(a1) * r0, 0, cz + Math.cos(a1) * r0], [cx + Math.sin(a1) * r1, 0, cz + Math.cos(a1) * r1], [cx + Math.sin(a0) * r1, 0, cz + Math.cos(a0) * r1]], m); }
    F.spotM = F.vmesh(mb.finish()); }
  set(vp); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uGlowOnly, 1);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
  gl.uniformMatrix4fv(u.uModel, false, new Float32Array([R, 0, 0, 0, 0, 1, 0, 0, 0, 0, R, 0, 0, 0.012, 0, 1])); this.drawMesh(vp, F.spotM);
  gl.disable(gl.BLEND); gl.depthMask(true); gl.uniform1f(u.uGlowOnly, 0);
};
SR.prototype.afterOpaque = function (set, carM, eye, mode) {
  this.drawSpots(set, 4.2);
  if (mode === 'cockpit') return;
  const ps = this.pilotSeat('car'); if (!ps) return;
  this.drawPilotMesh(set, ps.mesh, U.mul(carM, U.T(ps.S[0], ps.S[1], ps.S[2])), ps.S[4], { seat: ps.S[5], steer: (this.st && this.st.steerWheel ? this.st.steerWheel / 2.6 * 0.5 : 0) });
};
/** showroom sound demo: idle → hold SPINTA for full power */
SR.prototype.fleetSound = function (dt) {
  const F = this.F; if (!F) return; const A = F.audio || (F.audio = window.FleetAudio ? new FleetAudio() : null); if (!A) return;
  const k = F.kind, voiced = k && !['pilot', 'alien'].includes(k) && this.fleetSnd;
  F.thr = (F.thr || 0) + ((this.fleetRev ? 1 : 0.15) - (F.thr || 0)) * Math.min(1, dt * 3);
  const v = F.thr * ({ moto: 40, hover: 18, drone: 20, boat: 16, sub: 8, galleon: 6, ufo: 30 }[k] || 0);
  if (voiced) A.start(); A.on = !!voiced;
  A.update(voiced ? k : null, { vx: v, vz: 0, vF: v, thrust: F.thr, energy: this.fleetRev ? 0.5 : 1, beam: k === 'ufo' && this.fleetRev, y: 10 }, { speed: 9 });
};
SR.prototype.frame = function (dt) {
  this.fleetSound(dt);
  if (!this.F || !this.F.kind) return frame0.call(this, dt);
  const gl = this.gl, P = this.P, o = this.o, F = this.F, cam = this.cam, k = F.kind, m = F.mesh;
  const pal = CYBER_PALETTES[o.palette] || CYBER_PALETTES.neon;
  this.t += dt; F.t += dt; const t = this.t;
  if (cam.auto && cam.mode === 'orbit') this.turn += dt * (k === 'galleon' ? 0.12 : 0.25);
  const W = this.canvas.width, H = this.canvas.height; gl.viewport(0, 0, W, H);
  const water = k === 'boat' || k === 'galleon' || k === 'sub';
  // pose on the turntable / in the basin
  const b = m.bounds, hover = k === 'drone' ? 0.32 + 0.55 + Math.sin(t * 1.4) * 0.06 : k === 'sub' ? 0.6 : k === 'hover' ? 0.02 : 0;
  if ((k === 'pilot' || k === 'alien') && cam.mode === 'cockpit') cam.mode = 'orbit';
  if (k === 'moto' || k === 'hover') { /* land vehicles on the turntable */ }
  if ((k === 'pilot' || k === 'alien') && (F.cfg.pose === 'cammina' || F.cfg.pose === 'corre')) { /* walking on the spot */ }
  const bob = water ? Math.sin(t * 1.1) * (k === 'galleon' ? 0.12 : 0.05) : 0;
  const still = (k === 'pilot' || k === 'alien');
  const pitch = still ? 0 : water ? Math.sin(t * 0.8) * (k === 'galleon' ? 0.012 : 0.02) : -0.03 + Math.sin(t * 0.9) * 0.015;
  const roll = still ? 0 : water ? Math.sin(t * 0.6 + 1) * (k === 'galleon' ? 0.025 : 0.03) : Math.sin(t * 0.7) * 0.02;
  const Mv = U.mul(U.T(0, hover + bob, 0), U.mul(U.RY(this.turn), U.mul(U.RX(pitch), U.RZ(roll))));
  const toWorld = p => { const c = Math.cos(this.turn), s = Math.sin(this.turn); return [p[0] * c + p[2] * s, p[1] + hover, -p[0] * s + p[2] * c]; };
  const cy = (k === 'pilot' || k === 'alien') ? b[4] * 0.6 : (b[1] + b[4]) / 2 * (k === 'galleon' ? 0.55 : 1) + hover;
  let eye, tgt, fov = 40;
  if (cam.mode === 'cockpit') {
    const E = k === 'drone' ? KF.DRONE_RIG.fpv : k === 'boat' ? [0, 2.15, 1.4] : k === 'moto' ? [0, 1.45, -0.05] : k === 'hover' ? [0, 1.7, 0.9] : k === 'sub' ? [0, 0.3, 2.4] : KF.GALLEON_RIG.eye;
    eye = toWorld(E); const yaw = cam.look, pp = cam.lookP - 0.05;
    tgt = toWorld([E[0] + Math.sin(yaw) * 20, E[1] + Math.sin(pp) * 20, E[2] + Math.cos(yaw) * 20]); fov = k === 'drone' ? 95 : 70;
  } else {
    const d = cam.dist, ce = Math.cos(cam.yaw), se = Math.sin(cam.yaw), T0 = [0, cy, (b[2] + b[5]) / 2 * 0.3];
    eye = [T0[0] + se * d * Math.cos(cam.pitch), Math.max(water ? 0.6 : 0.2, T0[1] + d * Math.sin(cam.pitch)), T0[2] + ce * d * Math.cos(cam.pitch)]; tgt = T0;
  }
  const V = lookAt(eye, tgt, [0, 1, 0]), Pm = perspective(fov * Math.PI / 180, W / H, 0.05, 900), VP = new Float32Array(16);
  { const a = Pm, bb = V.m; for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let q = 0; q < 4; q++) s += a[q * 4 + r] * bb[c * 4 + q]; VP[c * 4 + r] = s; } }
  const set = pr => {
    const u = pr.u, v3 = (n, a) => { if (u[n]) gl.uniform3fv(u[n], a); }, f1 = (n, a) => { if (u[n]) gl.uniform1f(u[n], a); };
    gl.useProgram(pr.p);
    f1('uTime', t % 3600); f1('uL', 1e5); f1('uFar', 900); f1('uFogDen', water ? 0.0035 : 0.004); f1('uFlash', 0); f1('uCamX', 0); f1('uCamZ', 0); f1('uWrapX', 0); f1('uZOff', 0.5);
    v3('uFog', pal.fog.map(x => x * 0.6)); v3('uSkyTop', pal.top); v3('uWinA', pal.winA); v3('uWinB', pal.winB); v3('uWinC', pal.winC);
    v3('uNeonA', pal.neonA); v3('uNeonB', pal.neonB); v3('uEye', eye);
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, VP);
  };
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  const sp = P.sky; set(sp);
  gl.uniform3fv(sp.u.uFwd, V.f); gl.uniform3fv(sp.u.uRight, V.r); gl.uniform3fv(sp.u.uUp, V.u);
  const ty = Math.tan(fov * Math.PI / 360); gl.uniform2f(sp.u.uTan, ty * W / H, ty);
  if (sp.u.uCloud) gl.uniform1f(sp.u.uCloud, 0.4);
  gl.uniform3fv(sp.u.uSunDir, [0.3, 0.25, -1]); gl.uniform3fv(sp.u.uSunCol, pal.sun); gl.uniform1f(sp.u.uSunStripes, pal.stripes);
  this.drawQuad(sp, this.quad);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  const vp = F.veh, vu = vp.u;
  const vehUniforms = () => {
    set(vp); gl.uniform1f(vu.uTraffic, 0); gl.uniform1f(vu.uScale, 1); gl.uniform3f(vu.uTint, -1, 0, 0); gl.uniform1f(vu.uLit, this.spots ? 2.8 : 1.25); gl.uniform1f(vu.uDay, this.spots ? 0.3 : 0); gl.uniform1f(vu.uGlowOnly, 0);
    gl.uniform1f(vu.uRotA, F.t * 42); gl.uniform1f(vu.uBlur, k === 'drone' ? 0.6 : 0); gl.uniform1f(vu.uPropA, F.t * ({ boat: 6, moto: 2.5, hover: 18, sub: 9 }[k] || 0));
    gl.uniform1f(vu.uSail, k === 'galleon' ? 0.75 : 0); gl.uniform1f(vu.uSailYaw, k === 'galleon' ? Math.sin(F.t * 0.15) * 0.25 : 0); gl.uniform1f(vu.uSailSide, 1); gl.uniform1f(vu.uFlut, 0.35);
    if (vu.uLocks) gl.uniform1f(vu.uLocks, 0); if (vu.uPortal) gl.uniform1f(vu.uPortal, 0); if (vu.uSteer) gl.uniform1f(vu.uSteer, Math.sin(F.t * 0.5) * 0.3);
  };
  if (water) {
    const w = F.water; set(w); gl.uniform3f(w.u.uWaterC, 0, 0, 0); gl.uniform1f(w.u.uWaterRel, 1);
    gl.uniform4f(w.u.uWake, 0, 0, 0, 0); this.drawMesh(w, F.basin);
    vehUniforms(); gl.uniformMatrix4fv(vu.uModel, false, Mv); this.drawMesh(vp, m);
    const ps = cam.mode !== 'cockpit' && this.pilotSeat(k);
    if (ps) this.drawPilotMesh(set, ps.mesh, U.mul(Mv, U.mul(U.T(ps.S[0], ps.S[1], ps.S[2]), U.RY(ps.S[3]))), ps.S[4], { seat: ps.S[5], steer: Math.sin(t * 0.5) * 0.15 });
  } else {
    // mirrored drone in the glossy floor, then the floor, then the drone
    const draw1 = M2 => { if ((k === 'pilot' || k === 'alien')) this.drawPilotMesh(set, m, M2, F.cfg.pose || 'in piedi', {}); else { vehUniforms(); gl.uniformMatrix4fv(vu.uModel, false, M2); this.drawMesh(vp, m); } };
    draw1(U.mul(new Float32Array([1,0,0,0, 0,-1,0,0, 0,0,1,0, 0,0,0,1]), Mv));
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    set(P.floor); gl.uniform1f(P.floor.u.uAlpha, 0.86); this.drawQuad(P.floor, this.ground);
    this.drawSpots(set, Math.max(2.2, Math.min(40, (m.bounds[3] - m.bounds[0]) * 0.9)));
    gl.disable(gl.BLEND);
    draw1(Mv);
  }
  gl.depthMask(true); gl.disable(gl.BLEND);
};
})();
