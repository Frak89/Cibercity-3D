/* AMPY KAGE GT — engine simulation, synthesized V8 sound and exhaust effects (smoke + backfire flames).
   Shared by the NEON RUN web game and the web showroom. The Android app has a line-by-line Java port
   (EngineSim.java, EngineSound.java, ExhaustFx.java): keep the numbers in sync. */
(function (root) {
  'use strict';
  const ENG = {
    idle: 900, red: 8900, limiter: 9100,
    ratios: [3.30, 2.35, 1.80, 1.45, 1.20, 1.02, 0.88, 0.76], final: 4.70, wheelR: 0.365,
    tips: [[-0.38, 0.33, -2.40], [-0.22, 0.33, -2.40], [0.22, 0.33, -2.40], [0.38, 0.33, -2.40]]
  };
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  /* ------------------------------------------------------------------ engine state */
  function EngineSim() {
    this.rpm = ENG.idle; this.gear = 0; this.load = 0; this.boost = 0; this.shift = 0;
    this.thr = 0; this.prevThr = 0; this.crackle = 0; this.crackleT = 0; this.cut = 0;
    this.pops = 0;          // pops fired this frame (consumed by sound + fx)
    this.popStrength = 0;
  }
  EngineSim.prototype.firePop = function (s) { this.pops++; this.popStrength = Math.max(this.popStrength, s); };
  /** o: { speed (m/s, along the car), throttle 0..1, boost bool, free bool (neutral: showroom revs) } */
  EngineSim.prototype.update = function (dt, o) {
    this.pops = 0; this.popStrength = 0;
    const thrIn = Math.max(0, Math.min(1, o.throttle || 0));
    this.thr += (thrIn - this.thr) * Math.min(1, dt * (thrIn > this.thr ? 14 : 9));
    let target;
    if (o.free) {
      // neutral: the engine spins up fast and falls back with its own inertia
      target = ENG.idle + Math.pow(this.thr, 1.15) * (ENG.limiter + 200 - ENG.idle);
      const k = target > this.rpm ? 7.5 : 2.6;
      this.rpm += (target - this.rpm) * Math.min(1, dt * k);
      this.gear = -1;
    } else {
      const v = Math.abs(o.speed || 0), wheelRpm = v / (2 * Math.PI * ENG.wheelR) * 60;
      if (this.gear < 0) this.gear = 0;
      let r = wheelRpm * ENG.ratios[this.gear] * ENG.final;
      if (this.shift <= 0) {
        if (r > ENG.red - 250 && this.gear < 7) { this.gear++; this.shift = 0.14; if (this.thr > 0.6) this.firePop(0.9); }
        else if (this.gear > 0 && r < 3300) { this.gear--; this.shift = 0.10; }
      }
      r = wheelRpm * ENG.ratios[this.gear] * ENG.final;
      // clutch slip at low speed: the revs stay up with the throttle
      const slip = Math.max(0, 1 - v / 9);
      target = Math.max(ENG.idle + this.thr * 600, r, ENG.idle + slip * this.thr * 3600);
      if (this.shift > 0) { this.shift -= dt; target *= 0.93; }
      this.rpm += (target - this.rpm) * Math.min(1, dt * 12);
    }
    // rev limiter: fuel cut bounces the needle and spits pops
    if (this.cut > 0) this.cut -= dt;
    if (this.rpm > ENG.limiter) { this.rpm = ENG.limiter - 350; this.cut = 0.06; if (rnd() < 0.6) this.firePop(0.55); }
    this.rpm = Math.max(ENG.idle * 0.92, this.rpm);
    this.load = this.cut > 0 ? 0 : this.thr;
    const boostT = o.boost ? 1 : Math.max(0, (this.rpm - 2500) / 6000) * this.thr;
    this.boost += (boostT - this.boost) * Math.min(1, dt * 3);
    // overrun crackle: lifting off at high revs lights the unburnt fuel in the hot exhaust
    if (this.thr > 0.6 && this.rpm > 4200) this.armed = true;          // latched: we were on the throttle at high revs
    if (this.armed && this.thr < 0.3) { this.armed = false; if (this.rpm > 3800) { this.crackle = 0.55 + rnd() * 0.6; this.crackleT = 0.02; this.firePop(1); } }
    if (this.crackle > 0) {
      this.crackle -= dt; this.crackleT -= dt;
      if (this.crackleT <= 0 && this.thr < 0.3 && this.rpm > 2400) { this.firePop(0.35 + rnd() * 0.65); this.crackleT = 0.03 + rnd() * 0.11; }
    }
    return this;
  };

  /* ------------------------------------------------------------------ synthesizer (same as EngineSound.java) */
  const PAT = [1.0, 0.68, 0.94, 0.58, 0.9, 0.74, 1.0, 0.55];   // cross-plane V8 firing unevenness → burble
  function EngineSynth(sr) {
    this.sr = sr; this.ph = 0; this.cyl = 0; this.amp = 0; this.rpm = ENG.idle; this.load = 0; this.boost = 0;
    this.low = 0; this.band = 0; this.low2 = 0; this.tph = 0; this.hiss = 0;
    this.popEnv = 0; this.popPh = 0; this.popQ = 0; this.popGap = 0; this.popAmp = 0; this.vol = 0.8; this.n = 1;
  }
  EngineSynth.prototype.noise = function () { this.n = (this.n * 16807) % 2147483647; return this.n / 1073741823.5 - 1; };
  EngineSynth.prototype.render = function (out, rpmT, loadT, boostT, pops, popS) {
    const sr = this.sr, len = out.length;
    if (pops > 0) { this.popQ += pops; this.popAmp = Math.max(this.popAmp, popS); }
    for (let i = 0; i < len; i++) {
      this.rpm += (rpmT - this.rpm) * 0.0016; this.load += (loadT - this.load) * 0.002; this.boost += (boostT - this.boost) * 0.0008;
      const rpm = this.rpm, load = this.load;
      this.ph += rpm / 60 * 4 / sr;                       // 4 firings per revolution
      if (this.ph >= 1) {
        this.ph -= 1; this.cyl = (this.cyl + 1) & 7;
        this.amp = PAT[this.cyl] * (0.42 + 0.58 * load) * (0.9 + 0.2 * (this.noise() * 0.5 + 0.5));
      }
      const p = this.ph, a = this.amp;
      let x = a * (Math.exp(-p * 6) - Math.exp(-p * 38)) * 1.6;
      x += this.noise() * a * Math.exp(-p * 4) * (0.12 + 0.4 * load);
      // exhaust resonance (state-variable filter), opens with revs and throttle
      const fc = Math.min(sr * 0.2, 110 + rpm * 0.085 + load * 1100);
      const f1 = 2 * Math.sin(Math.PI * fc / sr);
      this.low += f1 * this.band; const high = x - this.low - 0.55 * this.band; this.band += f1 * high;
      // muffler body: heavy low pass for the deep rumble
      this.low2 += (x - this.low2) * (2 * Math.PI * 70 / sr);
      let y = this.low * 0.85 + this.band * 0.35 + this.low2 * 1.4;
      // turbo whistle + blow-off hiss
      this.tph += (2200 + rpm * 0.55) / sr; if (this.tph > 1) this.tph -= 1;
      y += Math.sin(this.tph * 6.2831853) * 0.035 * this.boost * (0.3 + load);
      this.hiss += (this.noise() - this.hiss) * 0.25; y += this.hiss * 0.03 * this.boost * (1 - load);
      // backfire pops: sharp crack + low thump
      if (this.popEnv < 0.05 && this.popQ > 0 && this.popGap <= 0) { this.popQ--; this.popEnv = 0.6 + 0.4 * this.popAmp; this.popPh = 0; this.popGap = sr * 0.025; if (this.popQ === 0) this.popAmp = 0; }
      if (this.popGap > 0) this.popGap--;
      if (this.popEnv > 0.001) {
        this.popPh += 85 / sr;
        y += this.popEnv * (this.noise() * 0.9 + Math.sin(this.popPh * 6.2831853) * 0.9);
        this.popEnv *= 1 - 32 / sr * 1.0;
      }
      out[i] = Math.tanh(y * 1.1) * this.vol;
    }
  };

  /* ------------------------------------------------------------------ WebAudio output */
  function EngineAudio() { this.ctx = null; this.on = true; this.sim = null; this.master = 0.8; }
  EngineAudio.prototype.start = function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const syn = this.syn = new EngineSynth(ctx.sampleRate);
    const node = ctx.createScriptProcessor(1024, 0, 1);
    const pend = { pops: 0, s: 0 }; this.pend = pend;
    node.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0), s = this.sim;
      if (!s || !this.on) { out.fill(0); return; }
      syn.vol = this.master;
      syn.render(out, s.rpm, s.load, s.boost, pend.pops, pend.s); pend.pops = 0; pend.s = 0;
    };
    node.connect(ctx.destination); this.node = node;
  };
  /** call once per frame after sim.update */
  EngineAudio.prototype.feed = function (sim) { this.sim = sim; if (this.pend && sim.pops) { this.pend.pops += sim.pops; this.pend.s = Math.max(this.pend.s, sim.popStrength); } };
  EngineAudio.prototype.toggle = function () { this.on = !this.on; return this.on; };

  /* ------------------------------------------------------------------ exhaust particles */
  const STRIDE = 9;   // x y z  r g b a  size info
  function ExhaustFX(max) { this.max = max || 700; this.p = []; this.data = new Float32Array(this.max * STRIDE); this.smokeN = 0; this.flameN = 0; this.acc = 0; }
  ExhaustFX.prototype.shift = function (dx, dy, dz) { for (const q of this.p) { q.x += dx; q.y += dy; q.z += dz; } };
  /** tips: world positions of the 4 pipes; dir: world exhaust direction (unit); vel: car velocity (m/s) */
  ExhaustFX.prototype.update = function (dt, tips, dir, vel, sim) {
    const P = this.p, speed = Math.hypot(vel[0], vel[2]);
    // smoke: light haze at idle, thicker under load, thinner at speed (it is spread out by the airflow)
    const rate = sim.off ? 0 : (6 + sim.load * 22 + Math.max(0, sim.rpm - 3000) / 6000 * 6) / (1 + speed * 0.06);
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      for (const t of tips) {
        if (P.length >= this.max) break;
        const ex = 0.8 + sim.load * 2.6 + rnd() * 0.6;
        P.push({ k: 0, x: t[0] + (rnd() - 0.5) * 0.03, y: t[1] + (rnd() - 0.5) * 0.03, z: t[2] + (rnd() - 0.5) * 0.03,
          vx: vel[0] + dir[0] * ex + (rnd() - 0.5) * 0.3, vy: vel[1] + dir[1] * ex + 0.15 + rnd() * 0.2, vz: vel[2] + dir[2] * ex + (rnd() - 0.5) * 0.3,
          age: 0, life: 1.3 + rnd() * 1.3 - Math.min(0.8, speed * 0.02), s0: 0.07, s1: 0.75 + rnd() * 0.55 + sim.load * 0.4,
          c: 0.55 + rnd() * 0.15 - sim.load * 0.12, a: 0.13 + sim.load * 0.08, seed: rnd() });
      }
    }
    // flames for every pop
    if (sim.pops > 0) {
      const st = Math.max(0.35, sim.popStrength);
      for (const t of tips) {
        if (rnd() < 0.25 && st < 0.7) continue;
        const n = 3 + Math.floor(rnd() * 3 + st * 3);
        for (let i = 0; i < n && P.length < this.max; i++) {
          const ex = 3 + rnd() * 5 * st, off = rnd() * 0.12;
          P.push({ k: 1, x: t[0] + dir[0] * off, y: t[1] + dir[1] * off, z: t[2] + dir[2] * off,
            vx: vel[0] + dir[0] * ex + (rnd() - 0.5) * 0.8, vy: vel[1] + dir[1] * ex + (rnd() - 0.3) * 0.6, vz: vel[2] + dir[2] * ex + (rnd() - 0.5) * 0.8,
            age: 0, life: 0.05 + rnd() * 0.09 * (0.6 + st), s0: 0.06 + 0.07 * st, s1: 0.13 + 0.17 * st * rnd(), seed: rnd(), hot: rnd() });
        }
        if (P.length < this.max) P.push({ k: 0, x: t[0], y: t[1], z: t[2], vx: vel[0] + dir[0] * 2, vy: vel[1] + 0.3, vz: vel[2] + dir[2] * 2, age: 0, life: 0.9 + rnd() * 0.6,
          s0: 0.15, s1: 0.9, c: 0.3, a: 0.32, seed: rnd() });
      }
    }
    // integrate: air drag pulls the gas to rest in the world, smoke rises a little
    let sN = 0, fN = 0;
    const d = this.data;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.age += dt;
      if (q.age >= q.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const drag = Math.exp(-(q.k ? 7 : 2.6) * dt);
      q.vx *= drag; q.vz *= drag; q.vy = q.vy * drag + (q.k ? 0.6 : 0.35) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.05) { q.y = 0.05; q.vy = Math.abs(q.vy) * 0.2; }
    }
    // pack: smoke first (alpha blended), then flames (additive)
    for (let pass = 0; pass < 2; pass++) for (const q of P) {
      if (q.k !== pass) continue;
      const f = q.age / q.life, o = (sN + fN) * STRIDE;
      d[o] = q.x; d[o + 1] = q.y; d[o + 2] = q.z;
      if (q.k === 0) {
        const a = q.a * Math.min(1, f * 6) * (1 - f) * (1 - f);
        d[o + 3] = q.c; d[o + 4] = q.c; d[o + 5] = q.c * 1.05; d[o + 6] = a;
        d[o + 7] = q.s0 + (q.s1 - q.s0) * Math.sqrt(f); d[o + 8] = 0 + q.seed * 0.9; sN++;
      } else {
        // white-blue at birth → orange → dark red
        const r = 1.0, g = 0.5 - f * 0.32 + q.hot * 0.12, b = Math.max(0, 0.35 - f * 1.6) + 0.03;
        d[o + 3] = r; d[o + 4] = g; d[o + 5] = b; d[o + 6] = 0.75 * (1 - f) * (1 - f * 0.5);
        d[o + 7] = q.s0 + (q.s1 - q.s0) * f; d[o + 8] = 1 + q.seed * 0.9; fN++;
      }
    }
    this.smokeN = sN; this.flameN = fN;
  };

  /** WebGL renderer for ExhaustFX (point sprites, shaders particle.vert / particle.frag). */
  function ExhaustGL(gl, prog) { this.gl = gl; this.pr = prog; this.buf = gl.createBuffer(); }
  ExhaustGL.prototype.draw = function (fx, scale) {
    const gl = this.gl, pr = this.pr, n = fx.smokeN + fx.flameN; if (!n) return;
    gl.useProgram(pr.p);
    gl.uniform1f(pr.u.uScale, scale);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, fx.data.subarray(0, n * STRIDE), gl.DYNAMIC_DRAW);
    const L = ['aPos', 'aCol', 'aInfo'].map(k => gl.getAttribLocation(pr.p, k));
    const S = STRIDE * 4;
    gl.enableVertexAttribArray(L[0]); gl.vertexAttribPointer(L[0], 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(L[1]); gl.vertexAttribPointer(L[1], 4, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(L[2]); gl.vertexAttribPointer(L[2], 2, gl.FLOAT, false, S, 28);
    gl.enable(gl.BLEND); gl.depthMask(false);
    if (fx.smokeN) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.POINTS, 0, fx.smokeN); }
    if (fx.flameN) { gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, fx.smokeN, fx.flameN); }
    for (const l of L) gl.disableVertexAttribArray(l);
    gl.depthMask(true);
  };
  /** car model matrix (column major) → world tips + exhaust direction */
  function tipsFrom(M) {
    const tr = (x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
    const tips = ENG.tips.map(t => tr(t[0], t[1], t[2]));
    const dir = [-M[8], -M[9] + 0.04, -M[10]];
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    return { tips, dir: [dir[0] / l, dir[1] / l, dir[2] / l] };
  }

  const api = { ENG, EngineSim, EngineSynth, EngineAudio, ExhaustFX, ExhaustGL, tipsFrom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EngineFX = api;
})(typeof window !== 'undefined' ? window : this);
