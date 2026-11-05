/* KAGE fleet sounds (Web Audio, all synthesised): one voice per vehicle kind.
 * update(kind, st, wind) every frame with the vehicle state (vx, vz, vF, thrust, energy, y, beam); used by NEON RUN and the showroom. */
(function (root) {
'use strict';
function FleetAudio() { this.ctx = null; this.on = false; this.nextPing = 0; this.nextTick = 0; this.nextCreak = 0; }
FleetAudio.prototype.start = function () {
  if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C(), out = this.out = ctx.createGain(); out.gain.value = 0.0; out.connect(ctx.destination);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    this.nf = ctx.createBiquadFilter(); this.nf.type = 'bandpass'; this.nf.Q.value = 0.8; this.ng = ctx.createGain(); this.ng.gain.value = 0;
    ns.connect(this.nf); this.nf.connect(this.ng); this.ng.connect(out); ns.start();
    // saw stack through a soft clipper → engines, rotors, motors
    this.osc = []; this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 1200;
    this.sh = ctx.createWaveShaper(); const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cv[i] = Math.tanh(x * 2.5); } this.sh.curve = cv;
    this.og = ctx.createGain(); this.og.gain.value = 0;
    for (const det of [0, 0.013, -0.009, 0.5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100; o.det = det; o.connect(this.sh); o.start(); this.osc.push(o); }
    this.sh.connect(this.lp); this.lp.connect(this.og); this.og.connect(out);
    // pure sine pair with vibrato → electric whine, sonar hum, the saucer's warble
    this.sg = ctx.createGain(); this.sg.gain.value = 0; this.sg.connect(out);
    this.s1 = ctx.createOscillator(); this.s1.type = 'sine'; this.s2 = ctx.createOscillator(); this.s2.type = 'triangle';
    this.vib = ctx.createOscillator(); this.vib.frequency.value = 5; this.vibG = ctx.createGain(); this.vibG.gain.value = 0; this.vib.connect(this.vibG); this.vibG.connect(this.s1.frequency); this.vibG.connect(this.s2.frequency);
    this.s1.connect(this.sg); this.s2.connect(this.sg); this.s1.start(); this.s2.start(); this.vib.start();
    // slow amplitude pulse (hovercraft skirt flutter, beam hum)
    this.am = ctx.createOscillator(); this.am.frequency.value = 6; this.amG = ctx.createGain(); this.amG.gain.value = 0; this.am.connect(this.amG); this.amG.connect(this.ng.gain); this.am.start();
  } catch (e) { this.ctx = null; }
};
FleetAudio.prototype.blip = function (f0, f1, dur, vol, type) {
  if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur * 1.4); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur * 1.5);
};
FleetAudio.prototype.click = function (f, vol) {
  if (!this.ctx) return; const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = this.noiseBuf; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 12; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
  s.connect(bp); bp.connect(g); g.connect(this.out); s.start(t, Math.random()); s.stop(t + 0.08);
};
FleetAudio.prototype.boom = function () { this.blip(140, 30, 0.5, 0.5); };
FleetAudio.prototype.update = function (kind, st, wind) {
  if (!this.ctx) return; const t = this.ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, t, 0.06);
  set(this.out.gain, this.on && kind ? 0.9 : 0);
  if (!kind) return;
  st = st || {}; wind = wind || { speed: 8 };
  const sp = Math.hypot(st.vx || 0, st.vz || 0), th = st.thrust || 0, vF = Math.abs(st.vF || 0);
  let saw = 0, sine = 0, vib = 0, am = 0;
  const saws = (f, lpF, g) => { this.osc.forEach(o => set(o.frequency, f * (1 + o.det))); set(this.lp.frequency, lpF); saw = g; };
  const noise = (f, q, g) => { set(this.nf.frequency, f); this.nf.Q.value = q; set(this.ng.gain, g); };
  const sines = (f1, f2, g, v, vr) => { set(this.s1.frequency, f1); set(this.s2.frequency, f2); sine = g; vib = v; if (vr) set(this.vib.frequency, vr); };
  if (kind === 'drone') { saws(92 + th * 95 + sp * 0.8, 900 + th * 1500, 0.05 + th * 0.05); noise(1100 + sp * 30, 0.8, 0.03 + sp * 0.002); }
  else if (kind === 'boat') { saws(36 + th * 55 + vF * 1.6, 500 + th * 1400, 0.06 + th * 0.1); noise(500 + sp * 18, 0.8, 0.02 + Math.min(0.12, sp * 0.004)); }
  else if (kind === 'moto') {   // electric superbike: rising whine + gear hum + tyre hiss
    sines(180 + vF * 14 + th * 60, 360 + vF * 28 + th * 120, 0.05 + th * 0.05, 3, 7); saws(40 + vF * 3, 300 + th * 600, 0.025 + th * 0.03); noise(2500 + sp * 40, 1.5, Math.min(0.06, sp * 0.002));
  } else if (kind === 'hover') {   // two big ducted fans + the skirt flapping
    saws(55 + th * 45 + sp * 0.4, 380 + th * 900, 0.05 + th * 0.07); noise(260 + th * 500 + sp * 6, 0.6, 0.07 + th * 0.08); am = 0.03 + th * 0.03; set(this.am.frequency, 8 + th * 10);
  } else if (kind === 'sub') {   // low electric hum, bubbles, a sonar ping every few seconds
    sines(62 + th * 30, 124 + th * 60, 0.05 + th * 0.04, 1.5, 0.6); noise(380 + th * 400, 3, 0.02 + th * 0.04); am = 0.015; set(this.am.frequency, 3 + Math.random() * 4);
    if (t > this.nextPing) { this.nextPing = t + 4 + Math.random() * 3; this.blip(1250, 1180, 0.9, 0.18); }
  } else if (kind === 'ufo') {   // the saucer: warbling theremin pair + deep drone; the beam adds a shimmering hum
    sines(150 + sp * 1.2 + Math.sin(t * 0.7) * 20, 152.5 + sp * 1.2, 0.07, 9, 5.5 + sp * 0.03); saws(38, 160 + sp * 4, 0.05);
    if (st.beam) { noise(1800, 6, 0.05); am = 0.04; set(this.am.frequency, 14); } else noise(600, 1, 0.01);
  } else if (kind === 'chrono') {   // the time cabin: clockwork ticks, gear whirr, a charged hum
    sines(220, 330, 0.02 + th * 0.06, 6 * th, 3); noise(3000, 4, 0.004 + th * 0.03);
    if (t > this.nextTick) { this.nextTick = t + (th > 0.5 ? 0.12 : 0.5); this.click(th > 0.5 ? 3200 : 2400, 0.25); }
  } else if (kind === 'galleon') {   // wind in the sails, the hull through the water, creaking timbers, the fusion assist when on
    saws(48, 200, th > 0.9 ? 0.03 : 0); noise(320 + sp * 20, 0.8, 0.04 + wind.speed * 0.003 + sp * 0.004);
    if (t > this.nextCreak) { this.nextCreak = t + 3 + Math.random() * 5; this.blip(90 + Math.random() * 60, 60, 0.35, 0.07, 'sawtooth'); }
  } else { noise(400, 1, 0.01); }
  set(this.og.gain, saw); set(this.sg.gain, sine); set(this.vibG.gain, vib); set(this.amG.gain, am);
};
root.FleetAudio = FleetAudio;
})(typeof window !== 'undefined' ? window : globalThis);
