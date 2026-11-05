/* WebGL renderer for the HD car (CarHD): uploads the parts, animates them (hood, butterfly doors, steering wheels,
 * wheel spin, steering wheel) and draws opaque + glass passes. Mirrored in game/CarHdRenderer.java. */
(function (root) {
'use strict';
const PAINTS = {
  nero: [0.03, 0.03, 0.04], rosso: [0.42, 0.02, 0.04], perla: [0.72, 0.72, 0.76], oro: [0.55, 0.38, 0.08], ciano: [0.0, 0.30, 0.36], viola: [0.20, 0.03, 0.30]
};
/* id → colour, roughness, metalness, emissive, pattern */
/* extra: { stripe:[r,g,b], rim:[r,g,b], disc:[r,g,b], caliper:[r,g,b] } */
function materials(paint, a, b, extra) {
  const X = extra || {};
  return [
    [paint, 0.18, 0.55, 0, 0], [[0.06, 0.06, 0.07], 0.3, 0.2, 0, 1], [[0.02, 0.02, 0.025], 0.6, 0, 0, 0], [[0.30, 0.31, 0.35], 0.12, 1, 0, 0],
    [[0.02, 0.03, 0.05], 0.05, 0, 0, 0], [[0.85, 0.95, 1.0], 0.2, 0, 1, 7], [[1.0, 0.06, 0.12], 0.2, 0, 1, 6], [a, 0.3, 0, 1, 9],
    [[0.025, 0.025, 0.025], 0.9, 0, 0, 3], [X.disc || [0.35, 0.35, 0.37], 0.35, 0.9, 0, 5], [X.caliper || b, 0.35, 0.2, 0.15, 0], [[0.05, 0.045, 0.05], 0.55, 0, 0, 2],
    [[0.035, 0.035, 0.04], 0.95, 0, 0, 0], [[0.025, 0.027, 0.035], 0.7, 0, 0, 0], [[0, 0, 0], 0.3, 0, 1, 4], [[0.6, 0.6, 0.62], 0.35, 1, 0, 0],
    [b, 0.3, 0, 1, 9], [a, 0.3, 0, 0.8, 9], [[0.03, 0.03, 0.035], 0.5, 0.3, 0, 8], [[0.03, 0.03, 0.035], 1, 0, 0, 10],
    [[0.62, 0.58, 0.60], 0.22, 1, 0, 11],
    [X.stripe || [0.9, 0.9, 0.92], 0.2, 0.3, 0, 0], [[0.92, 0.92, 0.88], 0.5, 0, 0.12, 0], [X.rim || [0.75, 0.6, 0.25], 0.18, 1, 0, 0]
  ];
}

/* --- column-major 4x4 helpers --- */
const I = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
const T = (x, y, z) => { const m = I(); m[12] = x; m[13] = y; m[14] = z; return m; };
const RX = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); };
const RY = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); };
const RZ = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); };

/** Model matrix of every part for a given state {steer, spin, wheelSteer, hood, doors, steerWheel}. */
const sm = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function roofPhases(r) { return { win: sm(r / 0.2), lid: sm((r - 0.12) / 0.2) * (1 - sm((r - 0.80) / 0.18)), fold: sm((r - 0.25) / 0.25), flip: sm((r - 0.42) / 0.40) }; }
const about = (p, R) => mul(T(p[0], p[1], p[2]), mul(R, T(-p[0], -p[1], -p[2])));
const FOLLOW = { liv1H: 'hood', liv1A: 'roofA', liv1B: 'roofB', liv1T: 'tonneau', liv2L: 'doorL', liv2R: 'doorR' };
function partMatrix(name, rig, car, st) {
  const pv = rig.hood.pivot;
  if (FOLLOW[name]) return partMatrix(FOLLOW[name], rig, car, st);
  if (name.startsWith('txt')) return partMatrix(name.endsWith('L') ? 'doorL' : 'doorR', rig, car, st);
  if (name === 'handbrake') return mul(car, about(rig.handbrake.pivot, RX(rig.handbrake.pull * (st.hand || 0))));
  const ph = roofPhases(st.roof || 0);
  switch (name) {
    case 'roofB': return mul(car, about(rig.roof.pivotB, RX(-rig.roof.flip * ph.flip)));
    case 'roofA': return mul(car, mul(about(rig.roof.pivotB, RX(-rig.roof.flip * ph.flip)), about(rig.roof.joint, RX(-rig.roof.fold * ph.fold))));
    case 'tonneau': return mul(car, about(rig.tonneau.pivot, RX(rig.tonneau.open * ph.lid)));
    case 'winL': return mul(partMatrix('doorL', rig, car, st), T(0, -rig.winDrop * ph.win, 0));
    case 'winR': return mul(partMatrix('doorR', rig, car, st), T(0, -rig.winDrop * ph.win, 0));
    case 'qwinL': case 'qwinR': return mul(car, T(0, -rig.winDrop * ph.win, 0));
    case 'hood': return mul(car, mul(T(pv[0], pv[1], pv[2]), mul(RX(rig.hood.open * st.hood), T(-pv[0], -pv[1], -pv[2]))));
    case 'doorL': case 'doorR': {
      const d = rig[name], k = name === 'doorL' ? st.doorL : st.doorR, p = d.pivot;
      return mul(car, mul(T(p[0], p[1], p[2]), mul(RZ(d.out * k), mul(RX(d.open * k), T(-p[0], -p[1], -p[2])))));
    }
    case 'steeringWheel': { const p = rig.steering.pivot; return mul(car, mul(T(p[0], p[1], p[2]), mul(RX(rig.steering.tilt), RZ(-st.steerWheel)))); }
    default:
      if (name.startsWith('sphere')) {
        const key = name.slice(6), hub0 = rig.wheels[key], steer = key[0] === 'F' ? st.wheelSteer : 0, fl = st.fly || 0, out = hub0[0] > 0 ? 1 : -1, hub = [hub0[0] + out * (rig.kitTrack[st.kit || 0] || 0), hub0[1], hub0[2]];
        const bob = rig.sphere.lift + 0.006 * Math.sin((st.time || 0) * 2.3 + hub[2] * 3 + hub[0]);
        // flight: the pods swivel 90° (glow ring horizontal, thrusting down) and tuck out/up into the arches
        const roll = mul(RZ(-out * fl * Math.PI / 2), fl > 0.5 ? RY((st.time || 0) * 4) : RX(st.spin * 0.365 / rig.sphere.r));
        return mul(car, mul(T(hub[0] + out * rig.fly.tuck[0] * fl, hub[1] + bob + rig.fly.tuck[1] * fl, hub[2]), mul(RY(steer * (1 - fl)), roll)));
      }
      if (name.startsWith('chronoR')) {
        const k = +name[7], c = rig.chrono.center, ph = (st.chronoPh || 0) + (st.time || 0) * 0.8;
        const R = k === 1 ? mul(RY(ph * 1.0), RX(0.35)) : k === 2 ? mul(RX(ph * -1.4), RZ(0.6)) : mul(RZ(ph * 1.9), RX(1.2));
        return mul(car, mul(T(c[0], c[1], c[2]), R));
      }
      if (name.startsWith('wheel') || name.startsWith('caliper') || name.startsWith('rim')) {
        const key = name.slice(name.startsWith('wheel') ? 5 : name.startsWith('rim') ? 4 : 7), hub0 = rig.wheels[key], tw = (rig.kitTrack[st.kit || 0] || 0) * (hub0[0] > 0 ? 1 : -1);
        const steer = key[0] === 'F' ? st.wheelSteer : 0;
        let m = mul(car, mul(T(hub0[0] + tw, hub0[1], hub0[2]), RY(steer)));
        if (!name.startsWith('caliper')) m = mul(m, RX(st.spin));
        return m;
      }
      return car;
  }
}

/** parts hidden for a power unit: 'v8' | 'wankel' | 'mag' */
const SKIP = {
  v8: new Set(['engineW', 'engineE', 'magPads', 'sphereFL', 'sphereFR', 'sphereRL', 'sphereRR']),
  wankel: new Set(['engine', 'engineE', 'magPads', 'sphereFL', 'sphereFR', 'sphereRL', 'sphereRR']),
  mag: new Set(['engine', 'engineW', 'exhaust', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR', 'caliperFL', 'caliperFR', 'caliperRL', 'caliperRR'])
};
function CarRender(gl, prog, model) {
  this.gl = gl; this.prog = prog; this.rig = model.rig;
  const buf = (arr, ix) => { const b = gl.createBuffer(); gl.bindBuffer(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, b); gl.bufferData(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, ix ? new Uint16Array(arr) : new Float32Array(arr), gl.STATIC_DRAW); return b; };
  this.parts = model.parts.map(p => ({ name: p.name, pos: buf(p.pos), norm: buf(p.norm), uv: buf(p.uv), mat: buf(p.mat),
    idx: p.idx.length ? buf(p.idx, true) : null, n: p.idx.length, gidx: p.gidx.length ? buf(p.gidx, true) : null, gn: p.gidx.length }));
  this.loc = { aPos: gl.getAttribLocation(prog.p, 'aPos'), aNorm: gl.getAttribLocation(prog.p, 'aNorm'), aUV: gl.getAttribLocation(prog.p, 'aUV'), aMat: gl.getAttribLocation(prog.p, 'aMat') };
}
CarRender.prototype.setMaterials = function (paint, a, b, extra) {
  const gl = this.gl, u = this.prog.u, mats = materials(Array.isArray(paint) ? paint : (PAINTS[paint] || PAINTS.nero), a, b, extra);
  const col = new Float32Array(72), par = new Float32Array(96);
  mats.forEach((m, i) => { col.set(m[0], i * 3); par.set([m[1], m[2], m[3], m[4]], i * 4); });
  gl.useProgram(this.prog.p);
  gl.uniform3fv(u['uMatCol[0]'], col); gl.uniform4fv(u['uMatPar[0]'], par);
};
/** pass: 'opaque' | 'glass'. car: base model matrix. skip: set of part names not to draw. */
CarRender.prototype.draw = function (car, st, pass, skip) {
  const gl = this.gl, L = this.loc, u = this.prog.u;
  gl.useProgram(this.prog.p);
  gl.uniform1f(u.uGlassPass, pass === 'glass' ? 1 : 0);
  if (!skip) skip = SKIP[st.power || 'v8'];
  const race = st.exhaust === 'race', chrono = !!st.chrono, flying = (st.fly || 0) > 0.25;
  for (const p of this.parts) {
    if (skip && skip.has(p.name)) continue;
    const n0 = p.name;
    if ((n0 === 'exhaust' && race) || (n0 === 'exhaustR' && (!race || st.power === 'mag'))) continue;
    if (n0.startsWith('chrono') && !chrono) continue;
    if (n0 === 'magRings' && (flying || st.power !== 'mag')) continue;
    if (n0 === 'kit1' && st.kit !== 1 || n0 === 'kit2' && st.kit !== 2) continue;
    if (n0.startsWith('rim') && n0[3] !== (st.rim || 'A')) continue;
    if (n0.startsWith('liv1') && st.livery !== 1 || n0.startsWith('liv2') && st.livery !== 2) continue;
    if (n0.startsWith('txt') && n0.slice(3, -1) !== String(st.text === undefined ? 'none' : st.text)) continue;
    const ib = pass === 'glass' ? p.gidx : p.idx, n = pass === 'glass' ? p.gn : p.n;
    if (!ib) continue;
    gl.uniformMatrix4fv(u.uModel, false, partMatrix(p.name, this.rig, car, st));
    const bind = (loc, b, s) => { if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, s, gl.FLOAT, false, 0, 0); };
    bind(L.aPos, p.pos, 3); bind(L.aNorm, p.norm, 3); bind(L.aUV, p.uv, 2); bind(L.aMat, p.mat, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);
  }
  for (const k in L) if (L[k] >= 0) gl.disableVertexAttribArray(L[k]);
};

/** add / replace parts at runtime (custom lettering) */
CarRender.prototype.replaceParts = function (list) {
  const gl = this.gl, buf = (arr, ix) => { const b = gl.createBuffer(); gl.bindBuffer(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, b); gl.bufferData(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, ix ? new Uint16Array(arr) : new Float32Array(arr), gl.STATIC_DRAW); return b; };
  for (const p of list) {
    this.parts = this.parts.filter(q => q.name !== p.name);
    if (!p.idx.length) continue;
    this.parts.push({ name: p.name, pos: buf(p.pos), norm: buf(p.norm), uv: buf(p.uv), mat: buf(p.mat), idx: buf(p.idx, true), n: p.idx.length, gidx: null, gn: 0 });
  }
};
/* ===================================================================== car customisation shared by showroom + game (localStorage) */
const KAGE_COLORS = { bianco: [0.92, 0.92, 0.94], nero: [0.03, 0.03, 0.035], rosso: [0.8, 0.05, 0.08], oro: [0.85, 0.62, 0.18], ciano: [0.0, 0.85, 0.85], viola: [0.55, 0.2, 0.85], arancio: [1.0, 0.45, 0.05] };
const KAGE_BRAKES = [
  { name: 'ACCIAIO · PINZE NEON', disc: [0.35, 0.35, 0.37], caliper: null },
  { name: 'CARBOCERAMICA · GIALLO', disc: [0.10, 0.10, 0.11], caliper: [0.95, 0.75, 0.05] },
  { name: 'ORO · ROSSO', disc: [0.62, 0.48, 0.20], caliper: [0.80, 0.04, 0.06] },
  { name: 'BLU ANODIZZATO', disc: [0.18, 0.28, 0.55], caliper: [0.10, 0.35, 0.95] }
];
function kageLoad() { try { return Object.assign({ kit: 0, rim: 'A', livery: 0, text: 'none', customText: 'KAGE GT', stripe: 'bianco', rimcol: 'oro', brakes: 0 }, JSON.parse(localStorage.getItem('kageCar') || '{}')); } catch (e) { return { kit: 0, rim: 'A', livery: 0, text: 'none', customText: 'KAGE GT', stripe: 'bianco', rimcol: 'oro', brakes: 0 }; } }
function kageSave(c) { try { localStorage.setItem('kageCar', JSON.stringify(c)); } catch (e) { } }
function kageExtra(c) { const b = KAGE_BRAKES[c.brakes || 0] || KAGE_BRAKES[0]; return { stripe: KAGE_COLORS[c.stripe] || KAGE_COLORS.bianco, rim: KAGE_COLORS[c.rimcol] || KAGE_COLORS.oro, disc: b.disc, caliper: b.caliper || undefined }; }
root.kageLoad = kageLoad; root.kageSave = kageSave; root.kageExtra = kageExtra; root.KAGE_COLORS = KAGE_COLORS; root.KAGE_BRAKES = KAGE_BRAKES;
root.CarRender = CarRender;
root.CarRenderUtil = { materials, PAINTS, mul, T, RX, RY, RZ, I, partMatrix, roofPhases, SKIP };
})(typeof window !== 'undefined' ? window : globalThis);
