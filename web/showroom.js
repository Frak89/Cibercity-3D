/* AMPY KAGE GT showroom: turntable, hood, butterfly doors, interior / cockpit / engine cameras, steering demo, lights, specs. */
(function () {
'use strict';
const U = window.CarRenderUtil;
function perspective(fovy, aspect, near, far) { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); return new Float32Array([f / aspect,0,0,0, 0,f,0,0, 0,0,(far + near) * nf,-1, 0,0,2 * far * near * nf,0]); }
function lookAt(e, c, up) {
  let fx = c[0] - e[0], fy = c[1] - e[1], fz = c[2] - e[2]; let l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
  let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0]; l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
  const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
  return { m: new Float32Array([sx,ux,-fx,0, sy,uy,-fy,0, sz,uz,-fz,0, -(sx*e[0]+sy*e[1]+sz*e[2]), -(ux*e[0]+uy*e[1]+uz*e[2]), (fx*e[0]+fy*e[1]+fz*e[2]), 1]), f: [fx,fy,fz], r: [sx,sy,sz], u: [ux,uy,uz] };
}
function Showroom(canvas, opts) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: !!opts.preserve });
  if (!gl) throw new Error('WebGL non disponibile');
  this.gl = gl; this.canvas = canvas; this.o = opts;
  const SH = SHADERS;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(v, f) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, SH[v])); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, SH['common.glsl'] + '\n' + SH[f]));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  this.P = { sky: prog('sky.vert', 'sky.frag'), floor: prog('ground.vert', 'studio_floor.frag'), car: prog('car_hd.vert', 'car_hd.frag'), glow: prog('glow.vert', 'glow.frag') };
  const t0 = performance.now();
  this.model = CarHD.build();
  this.buildMs = performance.now() - t0;
  this.car = new CarRender(gl, this.P.car, this.model);
  const F = window.EngineFX;
  this.P.fx = prog('particle.vert', 'particle.frag');
  this.eng = new F.EngineSim(); this.fx = new F.ExhaustFX(700); this.fxgl = new F.ExhaustGL(gl, this.P.fx); this.audio = new F.EngineAudio();
  const b = (arr, ix) => { const x = gl.createBuffer(); gl.bindBuffer(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, x); gl.bufferData(ix ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, ix ? new Uint16Array(arr) : new Float32Array(arr), gl.STATIC_DRAW); return x; };
  this.quad = { a: b([-1, -1, 1, -1, 1, 1, -1, 1]), i: b([0, 1, 2, 0, 2, 3], true) };
  this.ground = { a: b([-40, -40, 40, -40, 40, 40, -40, 40]), i: b([0, 1, 2, 0, 2, 3], true) };
  this.st = { hood: 0, doorL: 0, doorR: 0, wheelSteer: 0, steerWheel: 0, spin: 0, roof: 0, power: opts.power || 'v8', time: 0 };
  this.tg = { hood: 0, doors: 0, steerDemo: false, lights: 1, engine: true, rev: 0, roof: 0, fly: 0 };
  this.chronoPh = 0; this.flyK = 0;
  this.eng.setType(this.st.power);
  this.cam = { yaw: 0.7, pitch: 0.18, dist: 7.2, mode: 'orbit', auto: true, look: 0, lookP: 0 };
  this.t = 0; this.turn = 0;
}
Showroom.prototype.drawQuad = function (pr, m) {
  const gl = this.gl, loc = gl.getAttribLocation(pr.p, 'aPos');
  gl.bindBuffer(gl.ARRAY_BUFFER, m.a); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); gl.disableVertexAttribArray(loc);
};
Showroom.prototype.frame = function (dt) {
  const gl = this.gl, P = this.P, o = this.o, st = this.st, tg = this.tg, cam = this.cam;
  const pal = CYBER_PALETTES[o.palette] || CYBER_PALETTES.neon;
  this.t += dt; const t = this.t;
  const ease = (cur, target, k) => cur + (target - cur) * Math.min(1, dt * k);
  st.time = t; st.power = o.power || 'v8'; st.exhaust = o.exhaust || 'serie'; st.chrono = !!o.chrono;
  this.flyK += Math.max(-dt * 0.7, Math.min(dt * 0.7, (st.power === 'mag' && tg.fly ? 1 : 0) - this.flyK)); st.fly = this.flyK * this.flyK * (3 - 2 * this.flyK);
  this.chronoPh += dt * (1 + (tg.rev || 0) * 10); st.chronoPh = this.chronoPh; this.eng.race = st.exhaust === 'race'; if (this.eng.type !== st.power) this.eng.setType(st.power);
  // the roof moves at constant speed (≈ 14 s like a real folding hard top… shortened to 5 s)
  st.roof += Math.max(-dt / 5, Math.min(dt / 5, tg.roof - st.roof));
  if (st.power === 'mag') st.spin += dt * (eng => eng.rpm / 22000 * 9)(this.eng);
  st.hood = ease(st.hood, tg.hood, 3); st.doorL = ease(st.doorL, tg.doors, 2.6); st.doorR = ease(st.doorR, tg.doors, 2.4);
  const steer = tg.steerDemo ? Math.sin(t * 1.4) : 0;
  st.wheelSteer = ease(st.wheelSteer, steer * 0.55, 6); st.steerWheel = ease(st.steerWheel, steer * 2.6, 6);
  if (cam.auto && cam.mode === 'orbit') this.turn += dt * 0.25;
  const W = this.canvas.width, H = this.canvas.height; gl.viewport(0, 0, W, H);
  // camera
  let eye, tgt, fov = 40;
  // engine: idles by itself, SU DI GIRI holds the throttle (neutral)
  const eng = this.eng;
  if (tg.engine) { eng.off = false; eng.update(dt, { free: true, throttle: tg.rev }); }
  else { eng.off = true; eng.pops = 0; eng.rpm = Math.max(0, eng.rpm - dt * 4000); eng.load = 0; }
  this.audio.on = tg.engine; this.audio.feed(eng);
  // the body rocks on its mounts with the torque, and shivers at idle
  const rk = tg.engine ? Math.min(1, Math.max(0, (eng.rpm - 900) / 8000)) : 0;
  const shiver = tg.engine ? Math.sin(t * eng.rpm / 60 * 0.5 * 6.283) * 0.0012 * (1 - rk * 0.6) : 0;
  const body = U.mul(U.T(0, shiver + rk * 0.004, 0), U.RZ(rk * eng.load * 0.012 + shiver * 0.6));
  const hover = st.fly * 1.2, bank = st.fly * 0.06 * Math.sin(t * 0.9);
  const carM = U.mul(U.T(0, hover, 0), U.mul(U.RY(this.turn), U.mul(U.RZ(bank), body)));
  const toWorld = p => { const c = Math.cos(this.turn), s = Math.sin(this.turn); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  if (cam.mode === 'cockpit') {
    const e = CarHD.RIG.driverEye; eye = toWorld(e);
    const yaw = cam.look, pitch = cam.lookP - 0.08;
    tgt = toWorld([e[0] + Math.sin(yaw) * 2, e[1] + Math.sin(pitch) * 2, e[2] + Math.cos(yaw) * 2]); fov = 72;
  } else if (cam.mode === 'interior') {
    eye = toWorld([1.9, 1.75, -0.2]); tgt = toWorld([-0.2, 0.55, -0.1]); fov = 55;
  } else if (cam.mode === 'engine') {
    eye = toWorld([0.9, 2.0, 3.4]); tgt = toWorld([0, 0.45, 1.5]); fov = 45;
  } else {
    const d = cam.dist, ce = Math.cos(cam.yaw), se = Math.sin(cam.yaw);
    const T0 = cam.tgt || [0, 0.55, 0]; eye = [T0[0] + se * d * Math.cos(cam.pitch), T0[1] + 0.05 + d * Math.sin(cam.pitch), T0[2] + ce * d * Math.cos(cam.pitch)]; tgt = T0;
  }
  const V = lookAt(eye, tgt, [0, 1, 0]), Pm = perspective(fov * Math.PI / 180, W / H, 0.03, 200), VP = new Float32Array(16);
  { const a = Pm, bb = V.m; for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * bb[c * 4 + k]; VP[c * 4 + r] = s; } }
  const set = (pr) => {
    const u = pr.u, v3 = (n, a) => { if (u[n]) gl.uniform3fv(u[n], a); }, f1 = (n, a) => { if (u[n]) gl.uniform1f(u[n], a); };
    gl.useProgram(pr.p);
    f1('uTime', t % 3600); f1('uL', 1e5); f1('uFar', 400); f1('uFogDen', 0.004); f1('uFlash', 0);
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
  const cp = P.car;
  set(cp); this.car.setMaterials(o.paint, pal.neonA, pal.neonB);
  gl.uniform1f(cp.u.uKey, 1.15); gl.uniform1f(cp.u.uLights, tg.lights); gl.uniform1f(cp.u.uBrake, tg.lights * 0.3);
  // mirrored car = floor reflection
  const mir = U.mul(new Float32Array([1,0,0,0, 0,-1,0,0, 0,0,1,0, 0,0,0,1]), carM);
  if (cam.mode !== 'cockpit') this.car.draw(mir, st, 'opaque');
  // floor (semi-transparent over the reflection)
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  set(P.floor); gl.uniform1f(P.floor.u.uAlpha, 0.86); this.drawQuad(P.floor, this.ground);
  gl.disable(gl.BLEND);
  set(cp);
  this.car.draw(carM, st, 'opaque');
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  this.car.draw(carM, st, 'glass');
  const tp = EngineFX.tipsFrom(carM, st.exhaust === 'race');
  this.fx.update(dt, tp.tips, tp.dir, [0, 0, 0], eng, tp.hubs);
  set(P.fx); this.fxgl.draw(this.fx, H / (2 * Math.tan(fov * Math.PI / 360)));
  gl.depthMask(true); gl.disable(gl.BLEND);
};
window.Showroom = Showroom;
})();
