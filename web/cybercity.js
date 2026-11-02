/* Cybercity 3D — web engine (WebGL 1). Same shaders and city generator as the Android DreamService.
 * SHADERS is injected by tools/build_web.py from app/src/main/assets/shaders. */
(function () {
'use strict';
const L = 420, CELL = 14, ROWS = 30, COLS = 13;

const PALETTES = {
  neon:      { name: 'NEON TOKYO',    fog: [0.17,0.08,0.26], top: [0.012,0.008,0.035], winA: [1.0,0.72,0.42], winB: [0.35,0.9,1.0], winC: [1.0,0.3,0.82], neonA: [0.0,1.0,0.89], neonB: [1.0,0.23,0.78], sun: [0.9,0.85,1.0], sunDir: [0.25,0.32,1], stripes: 0, fogDen: 0.0062 },
  blade:     { name: 'BLADE RUNNER',  fog: [0.42,0.19,0.06], top: [0.06,0.025,0.012], winA: [1.0,0.62,0.25], winB: [0.3,0.85,0.85], winC: [1.0,0.85,0.6], neonA: [0.1,0.95,0.9], neonB: [1.0,0.45,0.1], sun: [1.0,0.6,0.25], sunDir: [-0.2,0.18,1], stripes: 0, fogDen: 0.0085 },
  matrix:    { name: 'MATRIX',        fog: [0.02,0.11,0.05], top: [0.0,0.015,0.005], winA: [0.35,1.0,0.45], winB: [0.6,1.0,0.6], winC: [0.15,0.7,0.3], neonA: [0.2,1.0,0.4], neonB: [0.6,1.0,0.2], sun: [0.5,1.0,0.6], sunDir: [0.3,0.4,1], stripes: 0, fogDen: 0.007 },
  synthwave: { name: 'SYNTHWAVE',     fog: [0.36,0.08,0.3], top: [0.03,0.01,0.09], winA: [1.0,0.55,0.85], winB: [0.4,0.85,1.0], winC: [1.0,0.85,0.4], neonA: [1.0,0.25,0.8], neonB: [0.25,0.85,1.0], sun: [1.0,0.8,0.25], sunDir: [0,0.1,1], stripes: 1, fogDen: 0.0058 },
  bloodmoon: { name: 'BLOOD MOON',    fog: [0.2,0.02,0.04], top: [0.025,0.0,0.006], winA: [1.0,0.35,0.3], winB: [1.0,0.7,0.3], winC: [1.0,0.15,0.3], neonA: [1.0,0.17,0.3], neonB: [1.0,0.69,0.0], sun: [1.0,0.15,0.12], sunDir: [-0.3,0.35,1], stripes: 0, fogDen: 0.0068 },
  glass:     { name: 'FUTURISTIC GLASS', fog: [0.08,0.14,0.26], top: [0.01,0.015,0.05], winA: [0.75,0.9,1.0], winB: [0.6,0.9,1.0], winC: [0.78,0.6,1.0], neonA: [0.6,0.9,1.0], neonB: [0.78,0.59,1.0], sun: [0.85,0.95,1.0], sunDir: [0.2,0.3,1], stripes: 0, fogDen: 0.006 }
};
const PAL_KEYS = Object.keys(PALETTES);
/* Weather presets — identical to Weather.java: rain, snow, fogMul, cloud, mist, lightning, wind */
const WEATHER = {
  clear:   { name: 'SERENO',       rain: 0,    snow: 0,   fog: 1.0, cloud: 0,    mist: 0,    light: 0, wind: 0 },
  cloudy:  { name: 'NUVOLOSO',     rain: 0,    snow: 0,   fog: 1.15, cloud: 0.85, mist: 0.15, light: 0, wind: 2 },
  fog:     { name: 'NEBBIA',       rain: 0,    snow: 0,   fog: 3.6, cloud: 0.9,  mist: 1.0, light: 0, wind: 0 },
  drizzle: { name: 'PIOGGERELLA',  rain: 0.3,  snow: 0,   fog: 1.3, cloud: 0.8,  mist: 0.25, light: 0, wind: 2 },
  rain:    { name: 'PIOGGIA',      rain: 0.85, snow: 0,   fog: 1.4, cloud: 0.95, mist: 0.3,  light: 0, wind: 5 },
  storm:   { name: 'TEMPORALE',    rain: 1.0,  snow: 0,   fog: 1.5, cloud: 1.0,  mist: 0.3,  light: 1, wind: 9 },
  snow:    { name: 'NEVE',         rain: 0.9,  snow: 1,   fog: 1.6, cloud: 0.9,  mist: 0.35, light: 0, wind: 1 }
};
const MODES = ['avenue', 'glide', 'drone', 'skyline'];
const MODE_NAMES = { avenue: 'VOLO SUL VIALE', glide: 'PLANATA', drone: 'DRONE A BASSA QUOTA', skyline: 'SOPRA I TETTI' };

/* deterministic PRNG identical to the Java one (mulberry32) */
function rng(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- city generation ---------- */
function buildCity(seed) {
  const R = rng(seed);
  const B = { pos: [], center: [], norm: [], uv: [], misc: [], idx: [] };
  const BB = { pos: [], center: [], uv: [], misc: [], idx: [] };
  function box(cx, cz, w, d, y0, y1, s, kind) {
    const hw = w / 2, hd = d / 2;
    const faces = [
      // normal, 4 corners (local x,y,z), face width
      [[1,0,0], [[hw,y0,-hd],[hw,y0,hd],[hw,y1,hd],[hw,y1,-hd]], d],
      [[-1,0,0], [[-hw,y0,hd],[-hw,y0,-hd],[-hw,y1,-hd],[-hw,y1,hd]], d],
      [[0,0,1], [[hw,y0,hd],[-hw,y0,hd],[-hw,y1,hd],[hw,y1,hd]], w],
      [[0,0,-1], [[-hw,y0,-hd],[hw,y0,-hd],[hw,y1,-hd],[-hw,y1,-hd]], w]
    ];
    for (const [n, cs, fw] of faces) {
      const b = B.pos.length / 3;
      const us = [0, fw, fw, 0];
      for (let i = 0; i < 4; i++) {
        B.pos.push(cs[i][0], cs[i][1], cs[i][2]); B.center.push(cx, cz); B.norm.push(n[0], n[1], n[2]);
        B.uv.push(us[i], cs[i][1]); B.misc.push(s, kind, fw, y1);
      }
      B.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const b = B.pos.length / 3;
    const top = [[-hw,y1,-hd],[hw,y1,-hd],[hw,y1,hd],[-hw,y1,hd]];
    for (const c of top) { B.pos.push(c[0], c[1], c[2]); B.center.push(cx, cz); B.norm.push(0,1,0); B.uv.push(c[0], c[2]); B.misc.push(s, kind, w, y1); }
    B.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  function board(cx, cz, lx, y0, y1, z0, z1, s, kind, facing) {
    const b = BB.pos.length / 3;
    const ratio = (y1 - y0) / Math.abs(z1 - z0);
    const cs = facing > 0 ? [[lx,y0,z1],[lx,y0,z0],[lx,y1,z0],[lx,y1,z1]] : [[lx,y0,z0],[lx,y0,z1],[lx,y1,z1],[lx,y1,z0]];
    const uvs = [[0,0],[1,0],[1,1],[0,1]];
    for (let i = 0; i < 4; i++) { BB.pos.push(...cs[i]); BB.center.push(cx, cz); BB.uv.push(...uvs[i]); BB.misc.push(s, kind, ratio, 0); }
    BB.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  for (const side of [-1, 1]) {
    for (let col = 0; col < COLS; col++) {
      const cx = side * (16 + CELL / 2 + col * CELL);
      for (let r = 0; r < ROWS; r++) {
        if (r % 6 === 0) continue;
        const cz = r * CELL + CELL / 2;
        const s = R();
        const w = 7 + R() * 5, d = 7 + R() * 5;
        let kind = R() < 0.35 ? 1 : 0;
        let h = 12 + Math.pow(R(), 2.4) * 105 * (col < 3 ? 1.5 : 1.0);
        if (col >= 2 && R() < 0.05) { h = 170 + R() * 120; kind = 2; }
        box(cx, cz, w, d, 0, h, s, kind);
        if (h > 55 && R() < 0.55) {
          const h2 = h + h * (0.15 + R() * 0.25);
          box(cx, cz, w * 0.68, d * 0.68, h, h2, fract(s * 7.7), kind === 2 ? 2 : 1);
          if (R() < 0.5) box(cx, cz, 0.7, 0.7, h2, h2 + 10 + R() * 25, fract(s * 3.3), 1);
        }
        if (col === 0 && R() < 0.6) {
          const bw = 2.5 + R() * 3, bh = Math.min(h - 6, 6 + R() * 16);
          if (bh > 4) {
            const y0 = 5 + R() * Math.max(0, h - bh - 8);
            const lx = -side * (w / 2 + 0.3);
            const z0 = -bw / 2, z1 = bw / 2;
            board(cx, cz, lx, y0, y0 + bh, z0, z1, R(), Math.floor(R() * 3), side);
          }
        }
      }
    }
  }
  // cars
  const C = { lane: [], dir: [], corner: [], idx: [] };
  function car(ox, oy, oz, speed, dx, dz, len, s) {
    const b = C.lane.length / 4;
    const cs = [[0,-1],[0,1],[1,1],[1,-1]];
    for (const c of cs) { C.lane.push(ox, oy, oz, speed); C.dir.push(dx, dz, len, s); C.corner.push(c[0], c[1]); }
    C.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const xl = [-10, -6, 6, 10], yl = [13, 24, 37, 55, 78];
  for (const x of xl) for (const y of yl) {
    const dir = x > 0 ? 1 : -1;
    const n = 6 + Math.floor(R() * 6);
    for (let i = 0; i < n; i++) car(x + (R() - 0.5), y + (R() - 0.5) * 3, 0, 22 + R() * 25, 0, dir, 4 + R() * 6, R());
  }
  for (const x of [-7, -3, 3, 7]) {
    const n = 10;
    for (let i = 0; i < n; i++) car(x, 0.7, 0, 12 + R() * 10, 0, x > 0 ? 1 : -1, 2.5 + R() * 2, R());
  }
  for (let r = 0; r < ROWS; r += 6) {
    const cz = r * CELL + CELL / 2;
    for (const [y, off] of [[0.7, -2.5], [0.7, 2.5], [21, 0], [34, 2]]) {
      const n = 6;
      for (let i = 0; i < n; i++) car(0, y, cz + off, 14 + R() * 18, off >= 0 ? 1 : -1, 0, 3 + R() * 5, R());
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = (R() < 0.5 ? -1 : 1) * (40 + R() * 120), y = 110 + R() * 60;
    const n = 5;
    for (let k = 0; k < n; k++) car(x, y, 0, 30 + R() * 20, 0, x > 0 ? 1 : -1, 6 + R() * 8, R());
  }
  // rain
  const RN = { seed: [], corner: [], idx: [] };
  for (let i = 0; i < 2600; i++) {
    const b = RN.seed.length / 3, sx = R(), sy = R(), sz = R();
    for (const c of [[0,-1],[0,1],[1,1],[1,-1]]) { RN.seed.push(sx, sy, sz); RN.corner.push(c[0], c[1]); }
    RN.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { B, BB, C, RN };
}
function fract(x) { return x - Math.floor(x); }

/* ---------- tiny matrix helpers (column major) ---------- */
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect,0,0,0, 0,f,0,0, 0,0,(far + near) * nf,-1, 0,0,2 * far * near * nf,0]);
}
function lookAt(e, c, up) {
  let fx = c[0] - e[0], fy = c[1] - e[1], fz = c[2] - e[2];
  let l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
  let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0];
  l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
  const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
  return { m: new Float32Array([sx,ux,-fx,0, sy,uy,-fy,0, sz,uz,-fz,0,
    -(sx*e[0]+sy*e[1]+sz*e[2]), -(ux*e[0]+uy*e[1]+uz*e[2]), (fx*e[0]+fy*e[1]+fz*e[2]), 1]),
    f: [fx,fy,fz], r: [sx,sy,sz], u: [ux,uy,uz] };
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
  }
  return o;
}

/* ---------- camera paths ---------- */
function cameraFor(mode, t) {
  // returns eye (x,y), look target offset (x,y,z ahead), roll, speed
  switch (mode) {
    case 'glide': {
      const y = 70 + Math.sin(t * 0.045) * 35;
      return { eye: [Math.sin(t * 0.06) * 5, y], look: [Math.sin(t * 0.06 + 0.8) * 9, y - 22 - Math.sin(t * 0.03) * 10, 70], roll: Math.sin(t * 0.06) * 0.12, speed: 14 };
    }
    case 'drone': {
      const x = Math.sin(t * 0.21) * 6.5, y = 7 + Math.sin(t * 0.13) * 3.5;
      return { eye: [x, y], look: [Math.sin(t * 0.21 + 0.6) * 7, y + 2 + Math.sin(t * 0.17) * 3, 40], roll: -Math.cos(t * 0.21) * 0.18, speed: 32 };
    }
    case 'skyline': {
      const y = 215 + Math.sin(t * 0.03) * 25;
      return { eye: [Math.sin(t * 0.04) * 4, y], look: [Math.sin(t * 0.04 + 1.2) * 40, y - 70, 160], roll: Math.sin(t * 0.04) * 0.05, speed: 20 };
    }
    default: {
      const y = 19 + Math.sin(t * 0.05) * 7;
      return { eye: [Math.sin(t * 0.07) * 3.5, y], look: [Math.sin(t * 0.07 + 0.5) * 2, y - 2 + Math.sin(t * 0.11) * 3, 60], roll: Math.sin(t * 0.07) * 0.06, speed: 18 };
    }
  }
}

/* ---------- WebGL setup ---------- */
function Cybercity(canvas, opts) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: !!opts.preserve });
  if (!gl) throw new Error('WebGL non disponibile');
  this.gl = gl; this.canvas = canvas; this.opts = opts;
  const S = SHADERS;
  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  function prog(v, f) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, S[v]));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, S['common.glsl'] + '\n' + S[f]));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  this.P = {
    sky: prog('sky.vert', 'sky.frag'), building: prog('building.vert', 'building.frag'), ground: prog('ground.vert', 'ground.frag'),
    board: prog('billboard.vert', 'billboard.frag'), car: prog('car.vert', 'car.frag'), rain: prog('rain.vert', 'rain.frag'), post: prog('post.vert', 'post.frag'), mist: prog('post.vert', 'mist.frag')
  };
  const city = buildCity(opts.seed || 2077);
  function buf(arr, idx) { const b = gl.createBuffer(); gl.bindBuffer(idx ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, b); gl.bufferData(idx ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, idx ? new Uint16Array(arr) : new Float32Array(arr), gl.STATIC_DRAW); return b; }
  function mesh(attrs, idx) { const m = { a: {}, n: idx.length }; for (const k in attrs) m.a[k] = { b: buf(attrs[k][0]), s: attrs[k][1] }; m.i = buf(idx, true); return m; }
  const c = city;
  if (c.B.pos.length / 3 > 65535) console.warn('too many vertices');
  this.M = {
    building: mesh({ aPos: [c.B.pos, 3], aCenter: [c.B.center, 2], aNorm: [c.B.norm, 3], aUV: [c.B.uv, 2], aMisc: [c.B.misc, 4] }, c.B.idx),
    board: mesh({ aPos: [c.BB.pos, 3], aCenter: [c.BB.center, 2], aUV: [c.BB.uv, 2], aMisc: [c.BB.misc, 4] }, c.BB.idx),
    car: mesh({ aLane: [c.C.lane, 4], aDir: [c.C.dir, 4], aCorner: [c.C.corner, 2] }, c.C.idx),
    rain: mesh({ aSeed: [c.RN.seed, 3], aCorner: [c.RN.corner, 2] }, c.RN.idx),
    ground: mesh({ aPos: [[-420,-40, 420,-40, 420,L, -420,L], 2] }, [0,1,2,0,2,3]),
    quad: mesh({ aPos: [[-1,-1, 1,-1, 1,1, -1,1], 2] }, [0,1,2,0,2,3])
  };
  this.camZ = 0; this.t = 0; this.flash = 0; this.nextFlash = 3; this.modeT = 0; this.modeIdx = 0; this.fade = 1;
  this.stats = { verts: c.B.pos.length / 3, cars: c.C.lane.length / 16 };
}
Cybercity.prototype.draw = function (pr, m) {
  const gl = this.gl; gl.useProgram(pr.p);
  const used = [];
  for (const k in m.a) {
    const loc = gl.getAttribLocation(pr.p, k); if (loc < 0) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.a[k].b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, m.a[k].s, gl.FLOAT, false, 0, 0); used.push(loc);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i); gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  for (const l of used) gl.disableVertexAttribArray(l);
};
Cybercity.prototype.frame = function (dt) {
  const gl = this.gl, o = this.opts, P = this.P;
  const pal = PALETTES[o.palette] || PALETTES.neon;
  const wx = WEATHER[o.weather] || null;
  this.t += dt;
  // lightning: random double flashes
  this.flash = Math.max(0, this.flash - dt * 3.5);
  if (wx && wx.light > 0) { this.nextFlash -= dt; if (this.nextFlash <= 0) { this.flash = 1; this.nextFlash = Math.random() < 0.35 ? 0.15 : 4 + Math.random() * 9; } }
  const rainAmt = wx ? wx.rain : o.rain, fogDen = pal.fogDen * (wx ? wx.fog : 1);
  const t = this.t;
  // mode handling
  let mode = o.mode;
  if (mode === 'auto') {
    this.modeT += dt;
    const period = o.cycle || 45;
    if (this.modeT > period) { this.modeT = 0; this.modeIdx = (this.modeIdx + 1) % MODES.length; }
    mode = MODES[this.modeIdx];
    const edge = Math.min(this.modeT, period - this.modeT);
    this.fade = Math.max(0, 1 - edge / 1.2);
  } else this.fade = Math.max(0, this.fade - dt);
  this.curMode = mode;
  const cam = cameraFor(mode, t);
  this.camZ = (this.camZ + cam.speed * (o.speed || 1) * dt) % L;
  const W = this.canvas.width, H = this.canvas.height;
  gl.viewport(0, 0, W, H);
  const eye = [cam.eye[0], cam.eye[1], 0];
  const tgt = [cam.look[0], cam.look[1], cam.look[2]];
  const up = [Math.sin(cam.roll), Math.cos(cam.roll), 0];
  const V = lookAt(eye, tgt, up);
  const fov = (o.fov || 62) * Math.PI / 180;
  const Pm = perspective(fov, W / H, 0.3, L * 0.95);
  const VP = mul(Pm, V.m);
  const set = (pr) => {
    const u = pr.u;
    const v3 = (n, a) => { if (u[n]) gl.uniform3fv(u[n], a); };
    const f1 = (n, a) => { if (u[n]) gl.uniform1f(u[n], a); };
    f1('uTime', t % 3600); f1('uL', L); f1('uCamZ', this.camZ); f1('uFogDen', fogDen); f1('uFlash', this.flash);
    v3('uFog', pal.fog); v3('uSkyTop', pal.top); v3('uWinA', pal.winA); v3('uWinB', pal.winB); v3('uWinC', pal.winC);
    v3('uNeonA', pal.neonA); v3('uNeonB', pal.neonB); v3('uEye', eye);
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, VP);
    if (u.uV) gl.uniformMatrix4fv(u.uV, false, V.m);
    if (u.uP) gl.uniformMatrix4fv(u.uP, false, Pm);
  };
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // sky
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  const sp = P.sky; gl.useProgram(sp.p); set(sp);
  gl.uniform3fv(sp.u.uFwd, V.f); gl.uniform3fv(sp.u.uRight, V.r); gl.uniform3fv(sp.u.uUp, V.u);
  const ty = Math.tan(fov / 2); gl.uniform2f(sp.u.uTan, ty * W / H, ty);
  if (sp.u.uCloud) gl.uniform1f(sp.u.uCloud, wx ? wx.cloud : 0); gl.uniform3fv(sp.u.uSunDir, pal.sunDir); gl.uniform3fv(sp.u.uSunCol, pal.sun); gl.uniform1f(sp.u.uSunStripes, pal.stripes);
  this.draw(sp, this.M.quad);
  // opaque
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  gl.useProgram(P.ground.p); set(P.ground); this.draw(P.ground, this.M.ground);
  gl.useProgram(P.building.p); set(P.building); this.draw(P.building, this.M.building);
  gl.useProgram(P.board.p); set(P.board); this.draw(P.board, this.M.board);
  // additive lights
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
  gl.useProgram(P.car.p); set(P.car); gl.uniform1f(P.car.u.uWidth, 0.32 * (o.traffic === 0 ? 0 : 1)); if (o.traffic !== 0) this.draw(P.car, this.M.car);
  if (rainAmt > 0) { gl.useProgram(P.rain.p); set(P.rain); gl.uniform1f(P.rain.u.uRain, rainAmt); gl.uniform1f(P.rain.u.uRainSpeed, 28);
    if (P.rain.u.uSnow) gl.uniform1f(P.rain.u.uSnow, wx ? wx.snow : 0); if (P.rain.u.uWind) gl.uniform1f(P.rain.u.uWind, wx ? wx.wind : 0); this.draw(P.rain, this.M.rain); }
  if (wx && wx.mist > 0) { gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(P.mist.p); set(P.mist);
    gl.uniform1f(P.mist.u.uMist, wx.mist); gl.uniform2f(P.mist.u.uRes, W, H); this.draw(P.mist, this.M.quad); }
  // post
  gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(P.post.p); gl.uniform1f(P.post.u.uFade, this.fade); gl.uniform1f(P.post.u.uScan, o.scanlines ? 1 : 0); gl.uniform2f(P.post.u.uRes, W, H);
  this.draw(P.post, this.M.quad);
  gl.depthMask(true); gl.disable(gl.BLEND);
};

window.Cybercity = Cybercity;
window.CYBER_PALETTES = PALETTES;
window.CYBER_WEATHER = WEATHER;
window.CYBER_MODES = MODES;
window.CYBER_MODE_NAMES = MODE_NAMES;
})();
