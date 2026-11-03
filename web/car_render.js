/* WebGL renderer for the HD car (CarHD): uploads the parts, animates them (hood, butterfly doors, steering wheels,
 * wheel spin, steering wheel) and draws opaque + glass passes. Mirrored in game/CarHdRenderer.java. */
(function (root) {
'use strict';
const PAINTS = {
  nero: [0.03, 0.03, 0.04], rosso: [0.42, 0.02, 0.04], perla: [0.72, 0.72, 0.76], oro: [0.55, 0.38, 0.08], ciano: [0.0, 0.30, 0.36], viola: [0.20, 0.03, 0.30]
};
/* id → colour, roughness, metalness, emissive, pattern */
function materials(paint, a, b) {
  return [
    [paint, 0.18, 0.55, 0, 0], [[0.06, 0.06, 0.07], 0.3, 0.2, 0, 1], [[0.02, 0.02, 0.025], 0.6, 0, 0, 0], [[0.30, 0.31, 0.35], 0.12, 1, 0, 0],
    [[0.02, 0.03, 0.05], 0.05, 0, 0, 0], [[0.85, 0.95, 1.0], 0.2, 0, 1, 7], [[1.0, 0.06, 0.12], 0.2, 0, 1, 6], [a, 0.3, 0, 1, 9],
    [[0.025, 0.025, 0.025], 0.9, 0, 0, 3], [[0.35, 0.35, 0.37], 0.35, 0.9, 0, 5], [b, 0.35, 0.2, 0.15, 0], [[0.05, 0.045, 0.05], 0.55, 0, 0, 2],
    [[0.035, 0.035, 0.04], 0.95, 0, 0, 0], [[0.025, 0.027, 0.035], 0.7, 0, 0, 0], [[0, 0, 0], 0.3, 0, 1, 4], [[0.6, 0.6, 0.62], 0.35, 1, 0, 0],
    [b, 0.3, 0, 1, 9], [a, 0.3, 0, 0.8, 9], [[0.03, 0.03, 0.035], 0.5, 0.3, 0, 8], [[0.03, 0.03, 0.035], 1, 0, 0, 10]
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
function partMatrix(name, rig, car, st) {
  const pv = rig.hood.pivot;
  switch (name) {
    case 'hood': return mul(car, mul(T(pv[0], pv[1], pv[2]), mul(RX(rig.hood.open * st.hood), T(-pv[0], -pv[1], -pv[2]))));
    case 'doorL': case 'doorR': {
      const d = rig[name], k = name === 'doorL' ? st.doorL : st.doorR, p = d.pivot;
      return mul(car, mul(T(p[0], p[1], p[2]), mul(RZ(d.out * k), mul(RX(d.open * k), T(-p[0], -p[1], -p[2])))));
    }
    case 'steeringWheel': { const p = rig.steering.pivot; return mul(car, mul(T(p[0], p[1], p[2]), mul(RX(rig.steering.tilt), RZ(-st.steerWheel)))); }
    default:
      if (name.startsWith('wheel') || name.startsWith('caliper')) {
        const key = name.slice(name.startsWith('wheel') ? 5 : 7), hub = rig.wheels[key];
        const steer = key[0] === 'F' ? st.wheelSteer : 0;
        let m = mul(car, mul(T(hub[0], hub[1], hub[2]), RY(steer)));
        if (name.startsWith('wheel')) m = mul(m, RX(st.spin));
        return m;
      }
      return car;
  }
}

function CarRender(gl, prog, model) {
  this.gl = gl; this.prog = prog; this.rig = model.rig;
  const buf = (arr, ix) => { const b = gl.createBuffer(); gl.bindBuffer(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, b); gl.bufferData(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, ix ? new Uint16Array(arr) : new Float32Array(arr), gl.STATIC_DRAW); return b; };
  this.parts = model.parts.map(p => ({ name: p.name, pos: buf(p.pos), norm: buf(p.norm), uv: buf(p.uv), mat: buf(p.mat),
    idx: p.idx.length ? buf(p.idx, true) : null, n: p.idx.length, gidx: p.gidx.length ? buf(p.gidx, true) : null, gn: p.gidx.length }));
  this.loc = { aPos: gl.getAttribLocation(prog.p, 'aPos'), aNorm: gl.getAttribLocation(prog.p, 'aNorm'), aUV: gl.getAttribLocation(prog.p, 'aUV'), aMat: gl.getAttribLocation(prog.p, 'aMat') };
}
CarRender.prototype.setMaterials = function (paint, a, b) {
  const gl = this.gl, u = this.prog.u, mats = materials(PAINTS[paint] || PAINTS.nero, a, b);
  const col = new Float32Array(60), par = new Float32Array(80);
  mats.forEach((m, i) => { col.set(m[0], i * 3); par.set([m[1], m[2], m[3], m[4]], i * 4); });
  gl.useProgram(this.prog.p);
  gl.uniform3fv(u['uMatCol[0]'], col); gl.uniform4fv(u['uMatPar[0]'], par);
};
/** pass: 'opaque' | 'glass'. car: base model matrix. skip: set of part names not to draw. */
CarRender.prototype.draw = function (car, st, pass, skip) {
  const gl = this.gl, L = this.loc, u = this.prog.u;
  gl.useProgram(this.prog.p);
  gl.uniform1f(u.uGlassPass, pass === 'glass' ? 1 : 0);
  for (const p of this.parts) {
    if (skip && skip.has(p.name)) continue;
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

root.CarRender = CarRender;
root.CarRenderUtil = { materials, PAINTS, mul, T, RX, RY, RZ, I, partMatrix };
})(typeof window !== 'undefined' ? window : globalThis);
