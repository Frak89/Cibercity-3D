/* AMPY KAGE GT — engine simulation, synthesized V8 sound and exhaust effects (smoke + backfire flames).
   Shared by the NEON RUN web game and the web showroom. The Android app has a line-by-line Java port
   (EngineSim.java, EngineSound.java, ExhaustFx.java): keep the numbers in sync. */
(function (root) {
  'use strict';
  const ENG = {
    idle: 900, red: 8900, limiter: 9100,
    ratios: [3.30, 2.35, 1.80, 1.45, 1.20, 1.02, 0.88, 0.76], final: 4.70, wheelR: 0.365,
    tips: [[-0.38, 0.33, -2.40], [-0.22, 0.33, -2.40], [0.22, 0.33, -2.40], [0.38, 0.33, -2.40]],
    hubs: [[-0.92, 0.36, 1.42], [0.92, 0.36, 1.42], [-0.92, 0.36, -1.45], [0.92, 0.36, -1.45]]
  };
  /* power units: V8 biturbo hybrid, quad-rotor Wankel on hydrogen (hybrid), LEVITA electromagnetic (no gears) */
  const TYPES = {
    v8: { idle: 900, red: 8900, limiter: 9100, final: 4.70, gears: true },
    wankel: { idle: 1150, red: 10200, limiter: 10500, final: 5.40, gears: true },
    mag: { idle: 600, red: 21000, limiter: 22000, final: 0, gears: false }
  };
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  /* ------------------------------------------------------------------ engine state */
  function EngineSim(type) {
    this.setType(type || 'v8');
    this.rpm = this.T.idle; this.gear = 0; this.load = 0; this.boost = 0; this.shift = 0;
    this.thr = 0; this.prevThr = 0; this.crackle = 0; this.crackleT = 0; this.cut = 0;
    this.pops = 0;          // pops fired this frame (consumed by sound + fx)
    this.popStrength = 0;
  }
  EngineSim.prototype.setType = function (t) { this.type = TYPES[t] ? t : 'v8'; this.T = TYPES[this.type]; };
  EngineSim.prototype.firePop = function (s) { this.pops++; this.popStrength = Math.max(this.popStrength, s); };
  /** o: { speed (m/s, along the car), throttle 0..1, boost bool, free bool (neutral: showroom revs) } */
  EngineSim.prototype.update = function (dt, o) {
    this.pops = 0; this.popStrength = 0;
    const T = this.T, idle = T.idle;
    const thrIn = Math.max(0, Math.min(1, o.throttle || 0));
    this.thr += (thrIn - this.thr) * Math.min(1, dt * (thrIn > this.thr ? 14 : 9));
    let target;
    const v = Math.abs(o.speed || 0), wheelRpm = v / (2 * Math.PI * ENG.wheelR) * 60;
    if (!T.gears) {
      // electromagnetic: motor speed follows the spheres; free = spinning the field up in the showroom
      target = o.free ? idle + Math.pow(this.thr, 1.1) * (T.limiter - idle) : Math.max(idle + this.thr * 2500, wheelRpm * 6.9);
      this.rpm += (target - this.rpm) * Math.min(1, dt * (target > this.rpm ? 4 : 2));
      this.gear = -2;
    } else if (o.free) {
      // neutral: the engine spins up fast and falls back with its own inertia
      target = idle + Math.pow(this.thr, 1.15) * (T.limiter + 200 - idle);
      const k = target > this.rpm ? (this.type === 'wankel' ? 9.5 : 7.5) : (this.type === 'wankel' ? 3.4 : 2.6);
      this.rpm += (target - this.rpm) * Math.min(1, dt * k);
      this.gear = -1;
    } else {
      if (this.gear < 0) this.gear = 0;
      let r = wheelRpm * ENG.ratios[this.gear] * T.final;
      if (this.shift <= 0) {
        if (r > T.red - 250 && this.gear < 7) { this.gear++; this.shift = 0.14; if (this.thr > 0.6) this.firePop(0.9); }
        else if (this.gear > 0 && r < T.red * 0.37) { this.gear--; this.shift = 0.10; }
      }
      r = wheelRpm * ENG.ratios[this.gear] * T.final;
      const slip = Math.max(0, 1 - v / 9);
      target = Math.max(idle + this.thr * 600, r, idle + slip * this.thr * T.red * 0.4);
      if (this.shift > 0) { this.shift -= dt; target *= 0.93; }
      this.rpm += (target - this.rpm) * Math.min(1, dt * 12);
    }
    if (this.cut > 0) this.cut -= dt;
    if (T.gears && this.rpm > T.limiter) { this.rpm = T.limiter - 350; this.cut = 0.06; if (rnd() < 0.6) this.firePop(0.55); }
    this.rpm = Math.max(idle * 0.92, this.rpm);
    this.load = this.cut > 0 ? 0 : this.thr;
    const boostT = o.boost ? 1 : Math.max(0, (this.rpm - idle * 2.6) / (T.red * 0.68)) * this.thr;
    this.boost += (boostT - this.boost) * Math.min(1, dt * 3);
    this.speed = v;
    // overrun crackle (combustion) / field discharge zaps (LEVITA)
    const hi = T.red * 0.47;
    if (this.thr > 0.6 && this.rpm > hi) this.armed = true;
    if (this.armed && this.thr < 0.3) { this.armed = false; if (this.rpm > hi * 0.9) { this.crackle = 0.55 + rnd() * 0.6; this.crackleT = 0.02; this.firePop(1); } }
    if (this.crackle > 0) {
      this.crackle -= dt; this.crackleT -= dt;
      if (this.crackleT <= 0 && this.thr < 0.3 && this.rpm > T.red * 0.27) { this.firePop(0.35 + rnd() * 0.65); this.crackleT = 0.03 + rnd() * 0.11; }
    }
    return this;
  };

  /* ------------------------------------------------------------------ synthesizer (same as EngineSound.java) */
  const PAT = [1.0, 0.68, 0.94, 0.58, 0.9, 0.74, 1.0, 0.55];   // cross-plane V8 firing unevenness → burble
  function EngineSynth(sr, type) {
    this.type = type || 'v8'; this.lump = 1; this.zap = 0; this.zph = 0; this.hum = 0; this.eph = 0; this.crk = 0; this.bp1 = 0; this.bp2 = 0;
    this.sr = sr; this.ph = 0; this.cyl = 0; this.amp = 0; this.rpm = ENG.idle; this.load = 0; this.boost = 0;
    this.low = 0; this.band = 0; this.low2 = 0; this.tph = 0; this.hiss = 0;
    this.popEnv = 0; this.popPh = 0; this.popQ = 0; this.popGap = 0; this.popAmp = 0; this.vol = 0.8; this.n = 1;
  }
  EngineSynth.prototype.noise = function () { this.n = (this.n * 16807) % 2147483647; return this.n / 1073741823.5 - 1; };
  EngineSynth.prototype.render = function (out, rpmT, loadT, boostT, pops, popS, speed) {
    if (pops > 0) { this.popQ += pops; this.popAmp = Math.max(this.popAmp, popS); }
    if (this.type === 'mag') return this.renderMag(out, rpmT, loadT, boostT, speed || 0);
    const sr = this.sr, len = out.length, W = this.type === 'wankel';
    for (let i = 0; i < len; i++) {
      this.rpm += (rpmT - this.rpm) * (W ? 0.0022 : 0.0016); this.load += (loadT - this.load) * 0.002; this.boost += (boostT - this.boost) * 0.0008;
      const rpm = this.rpm, load = this.load;
      this.ph += rpm / 60 * 4 / sr;                       // V8: 4 firings / rev · quad rotor: 4 rotor faces / rev, evenly spaced
      if (this.ph >= 1) {
        this.ph -= 1; this.cyl = (this.cyl + 1) & 7;
        if (W) {
          // bridge-ported rotary: lumpy "brap-brap" idle that smooths out with revs and load
          const lumpy = Math.max(0, 1 - (rpm - 1100) / 2500) * (1 - load);
          if ((this.cyl & 3) === 0) this.lump = 1 - lumpy * (0.55 + 0.45 * (this.noise() * 0.5 + 0.5));
          this.amp = (0.5 + 0.5 * load) * this.lump * (0.95 + 0.1 * (this.noise() * 0.5 + 0.5));
        } else this.amp = PAT[this.cyl] * (0.42 + 0.58 * load) * (0.9 + 0.2 * (this.noise() * 0.5 + 0.5));
      }
      const p = this.ph, a = this.amp;
      let x;
      if (W) {
        x = a * (Math.exp(-p * 2.6) - Math.exp(-p * 70)) * 1.25 - a * 0.25;   // sharp sawtooth-like exhaust port opening: the rotary buzz
        x += this.noise() * a * Math.exp(-p * 3) * (0.2 + 0.55 * load);
      } else {
        x = a * (Math.exp(-p * 6) - Math.exp(-p * 38)) * 1.6;
        x += this.noise() * a * Math.exp(-p * 4) * (0.12 + 0.4 * load);
      }
      const fc = Math.min(sr * 0.22, W ? 220 + rpm * 0.13 + load * 1700 : 110 + rpm * 0.085 + load * 1100);
      const f1 = 2 * Math.sin(Math.PI * fc / sr);
      this.low += f1 * this.band; const high = x - this.low - (W ? 0.42 : 0.55) * this.band; this.band += f1 * high;
      this.low2 += (x - this.low2) * (2 * Math.PI * (W ? 110 : 70) / sr);
      let y = this.low * 0.85 + this.band * (W ? 0.5 : 0.35) + this.low2 * (W ? 0.8 : 1.4);
      this.tph += (2200 + rpm * 0.55) / sr; if (this.tph > 1) this.tph -= 1;
      y += Math.sin(this.tph * 6.2831853) * 0.035 * this.boost * (0.3 + load);
      this.hiss += (this.noise() - this.hiss) * 0.25; y += this.hiss * 0.03 * this.boost * (1 - load);
      if (W) {   // hybrid e-motor whine on top of the rotors
        this.eph += (600 + (speed || 0) * 95) / sr; if (this.eph > 1) this.eph -= 1;
        y += Math.sin(this.eph * 6.2831853) * 0.03 * Math.min(1, (speed || 0) / 20 + load * 0.3);
      }
      if (this.popEnv < 0.05 && this.popQ > 0 && this.popGap <= 0) { this.popQ--; this.popEnv = 0.6 + 0.4 * this.popAmp; this.popPh = 0; this.popGap = sr * (W ? 0.018 : 0.025); if (this.popQ === 0) this.popAmp = 0; }
      if (this.popGap > 0) this.popGap--;
      if (this.popEnv > 0.001) {
        this.popPh += (W ? 140 : 85) / sr;
        y += this.popEnv * (this.noise() * (W ? 1.1 : 0.9) + Math.sin(this.popPh * 6.2831853) * (W ? 0.6 : 0.9));
        this.popEnv *= 1 - (W ? 45 : 32) / sr;
      }
      out[i] = Math.tanh(y * 1.1) * this.vol;
    }
  };
  /* LEVITA: electrostatic hum (100 Hz buzz + harmonics), rising field whine, crackling micro-discharges, zaps */
  EngineSynth.prototype.renderMag = function (out, rpmT, loadT, boostT, speed) {
    const sr = this.sr, len = out.length;
    for (let i = 0; i < len; i++) {
      this.rpm += (rpmT - this.rpm) * 0.0012; this.load += (loadT - this.load) * 0.002; this.boost += (boostT - this.boost) * 0.001;
      const k = Math.min(1, this.rpm / 22000), load = this.load;
      this.hum += 100 / sr; if (this.hum > 1) this.hum -= 1;
      const h = this.hum * 6.2831853;
      // mains-like buzz: odd-rich, slightly clipped, swelling with the field strength
      let buzz = Math.sin(h) + 0.55 * Math.sin(2 * h + 0.3) + 0.4 * Math.sin(3 * h) + 0.22 * Math.sin(5 * h + 1.1) + 0.12 * Math.sin(7 * h);
      buzz = Math.tanh(buzz * 1.6) * (0.16 + 0.22 * k + 0.12 * load);
      // field whine: two detuned sines gliding up with the sphere speed
      this.eph += (180 + this.rpm * 0.075) / sr; if (this.eph > 1) this.eph -= 1;
      this.zph += (183 + this.rpm * 0.0756) / sr; if (this.zph > 1) this.zph -= 1;
      const whine = (Math.sin(this.eph * 6.2831853) + Math.sin(this.zph * 6.2831853 * 2) * 0.4) * (0.03 + 0.10 * k) * (0.6 + 0.4 * load);
      // crackle: sparse micro-discharges, more under load
      if (this.noise() * 0.5 + 0.5 < (3 + load * 45 + k * 20) / sr) this.crk = 0.6 + 0.4 * (this.noise() * 0.5 + 0.5);
      const n = this.noise();
      this.bp1 += (n - this.bp1) * 0.45; const hp = n - this.bp1;
      let y = buzz + whine + hp * this.crk * 0.5 + this.hiss * 0.02;
      this.hiss += (n - this.hiss) * 0.1;
      this.crk *= 1 - 400 / sr;
      // big zaps on throttle lift (field discharge)
      if (this.zap < 0.05 && this.popQ > 0 && this.popGap <= 0) { this.popQ--; this.zap = 0.7 + 0.3 * this.popAmp; this.popGap = sr * 0.03; if (this.popQ === 0) this.popAmp = 0; }
      if (this.popGap > 0) this.popGap--;
      if (this.zap > 0.001) { this.popPh += (900 + 2400 * this.zap) / sr; y += this.zap * (hp * 1.2 + Math.sign(Math.sin(this.popPh * 6.2831853)) * 0.25); this.zap *= 1 - 60 / sr; }
      this.low2 += (y - this.low2) * 0.5;
      out[i] = Math.tanh(this.low2 * 1.3) * this.vol;
    }
  };

  /* ------------------------------------------------------------------ WebAudio output */
  function EngineAudio() { this.ctx = null; this.on = true; this.sim = null; this.master = 0.8; }
  EngineAudio.prototype.start = function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const syn = this.syn = new EngineSynth(ctx.sampleRate, this.type || 'v8');
    const node = ctx.createScriptProcessor(1024, 0, 1);
    const pend = { pops: 0, s: 0 }; this.pend = pend;
    node.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0), s = this.sim;
      if (!s || !this.on) { out.fill(0); return; }
      syn.vol = this.master;
      if (syn.type !== s.type) { syn.type = s.type; syn.rpm = s.rpm; }
      syn.render(out, s.rpm, s.load, s.boost, pend.pops, pend.s, s.speed || 0); pend.pops = 0; pend.s = 0;
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
  ExhaustFX.prototype.update = function (dt, tips, dir, vel, sim, hubs) {
    const P = this.p, speed = Math.hypot(vel[0], vel[2]), ty = sim.type || 'v8', H2 = ty === 'wankel';
    if (ty === 'mag') { this.sparks(dt, hubs || [], vel, sim); return this.integrate(dt); }
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
          c: H2 ? 0.86 + rnd() * 0.1 : 0.55 + rnd() * 0.15 - sim.load * 0.12, a: H2 ? 0.08 + sim.load * 0.05 : 0.13 + sim.load * 0.08, seed: rnd() });
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
            age: 0, life: 0.05 + rnd() * 0.09 * (0.6 + st), s0: 0.06 + 0.07 * st, s1: 0.13 + 0.17 * st * rnd(), seed: rnd(), hot: rnd(), h2: H2 });
        }
        if (P.length < this.max) P.push({ k: 0, x: t[0], y: t[1], z: t[2], vx: vel[0] + dir[0] * 2, vy: vel[1] + 0.3, vz: vel[2] + dir[2] * 2, age: 0, life: 0.9 + rnd() * 0.6,
          s0: 0.15, s1: 0.9, c: H2 ? 0.9 : 0.3, a: H2 ? 0.16 : 0.32, seed: rnd() });
      }
    }
    this.integrate(dt);
  };
  /* LEVITA: blue-white sparks crawling between the spheres and the arch emitters; bursts on discharges */
  ExhaustFX.prototype.sparks = function (dt, hubs, vel, sim) {
    const P = this.p, k = Math.min(1, sim.rpm / 22000);
    this.acc += (4 + sim.load * 30 + k * 12) * dt;
    const burst = sim.pops > 0 ? 6 + Math.floor(sim.popStrength * 10) : 0;
    const emit = (h, big) => {
      if (P.length >= this.max) return;
      const a = rnd() * Math.PI * 2, r = 0.30 + rnd() * 0.06, ring = rnd() < 0.5;
      const x = h[0] + (ring ? Math.cos(a) * 0.15 : (rnd() - 0.5) * 0.25), y = ring ? 0.03 : h[1] + Math.sin(a) * r * 0.9 + 0.04, z = h[2] + (ring ? Math.sin(a) * r * 0.8 : Math.cos(a) * r);
      P.push({ k: 1, x, y, z, vx: vel[0] * 0.9 + (rnd() - 0.5) * 1.5, vy: (rnd() - 0.3) * 1.2, vz: vel[2] * 0.9 + (rnd() - 0.5) * 1.5,
        age: 0, life: 0.04 + rnd() * (big ? 0.16 : 0.08), s0: big ? 0.08 : 0.04, s1: big ? 0.02 : 0.01, seed: rnd(), hot: 1, mag: true });
    };
    while (this.acc >= 1) { this.acc -= 1; emit(hubs[Math.floor(rnd() * hubs.length)] || [0, 0.4, 0], false); }
    for (let i = 0; i < burst; i++) for (const h of hubs) emit(h, true);
  };
  ExhaustFX.prototype.integrate = function (dt) {
    const P = this.p;
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
        // white-blue at birth → orange → dark red · hydrogen: pale violet-blue · LEVITA sparks: electric blue-white
        let r = 1.0, g = 0.5 - f * 0.32 + q.hot * 0.12, b = Math.max(0, 0.35 - f * 1.6) + 0.03;
        if (q.h2) { r = 0.35 + 0.25 * (1 - f); g = 0.45 + 0.2 * (1 - f); b = 1.0; }
        if (q.mag) { r = 0.55 + 0.45 * (1 - f); g = 0.8 + 0.2 * (1 - f); b = 1.0; }
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
    const tips = ENG.tips.map(t => tr(t[0], t[1], t[2])), hubs = ENG.hubs.map(t => tr(t[0], t[1] + 0.04, t[2]));
    const dir = [-M[8], -M[9] + 0.04, -M[10]];
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    return { tips, hubs, dir: [dir[0] / l, dir[1] / l, dir[2] / l] };
  }

  const api = { ENG, TYPES, EngineSim, EngineSynth, EngineAudio, ExhaustFX, ExhaustGL, tipsFrom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EngineFX = api;
})(typeof window !== 'undefined' ? window : this);
