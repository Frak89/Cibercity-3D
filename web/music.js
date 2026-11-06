/* KAGE SOUND · an original soundtrack generated live (Web Audio, no recordings) that follows where you are, plus 3D sounds.
 * Styles: CITTÀ (synthwave, night drive), NOTTE (slower, darker when the real sky is dark), SPAZIO (ambient pads, sparse bells),
 * ECO (dark drones, glitchy percussion), PASSATO (gentle pentatonic, no drums), ODYSSEY (warm pads + ship hum), WARP (driving).
 * Each style has its chord progression, tempo and instruments (bass, pad, arpeggio with echo, kick / snare / hats); sections
 * change every 8 bars. 3D sounds: the NEXUS ring, the KAGE XENO, the EPOCH clockwork and the ODYSSEY warp core, panned and
 * attenuated by your position and the camera heading. Settings in the tablet (🎵 Musica): on / off, volume, style, skip. */
(function () {
'use strict';
const NR = window.NeonRun; if (!NR) return;
const { wrapD } = NR, PI = Math.PI;
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const N2F = n => 440 * Math.pow(2, (n - 69) / 12);
// chords as semitones from the key root; key as MIDI note
const STY = {
  citta: { name: 'CITTÀ · synthwave', bpm: 104, key: 45, prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 3], [-2, 2, 5, 9]], arp: [0, 2, 1, 3, 2, 1, 3, 2], drums: 'four', arpWave: 'square', lp: 2400, swing: 0 },
  notte: { name: 'NOTTE · dark drive', bpm: 88, key: 42, prog: [[0, 3, 7, 11], [-5, -2, 2, 5], [-4, 0, 3, 7], [-2, 2, 5, 8]], arp: [0, 1, 2, 3, 2, 1], drums: 'half', arpWave: 'sawtooth', lp: 1500, swing: 0.08 },
  spazio: { name: 'SPAZIO · ambient', bpm: 64, key: 50, prog: [[0, 7, 14, 16], [-3, 4, 9, 12], [-7, 0, 7, 11], [-5, 2, 7, 14]], arp: [0, 2, 3], drums: 'none', arpWave: 'sine', lp: 3200, bell: 1 },
  eco: { name: 'ECO · glitch drone', bpm: 76, key: 38, prog: [[0, 1, 7, 8], [0, 3, 6, 10], [-1, 2, 6, 9], [0, 1, 6, 7]], arp: [0, 3, 1, 2], drums: 'glitch', arpWave: 'square', lp: 900, crush: 1 },
  passato: { name: 'PASSATO · prateria', bpm: 72, key: 55, prog: [[0, 4, 7, 12], [5, 9, 12, 16], [-3, 0, 4, 9], [7, 11, 14, 19]], arp: [0, 1, 2, 3, 2, 1], drums: 'none', arpWave: 'triangle', lp: 4000, penta: 1 },
  odyssey: { name: 'ODYSSEY · a bordo', bpm: 70, key: 47, prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [-5, -1, 2, 7], [2, 5, 9, 12]], arp: [0, 2, 1, 3], drums: 'soft', arpWave: 'triangle', lp: 2200 },
  warp: { name: 'WARP · curvatura', bpm: 128, key: 48, prog: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -1, 2, 5]], arp: [0, 1, 2, 3, 1, 2, 3, 0], drums: 'four', arpWave: 'sawtooth', lp: 3800 } };

function Music(game) {
  this.g = game; this.on = LS.get('kageMusic', '1') === '1'; this.vol = +LS.get('kageMusicVol', '0.55'); this.force = LS.get('kageMusicStyle', '') || null;
  this.sfx3d = LS.get('kageSfx3d', '1') === '1'; this.style = null; this.step = 0; this.bar = 0; this.next = 0; this.seed = 1;
  const unlock = () => { this.ensure(); }; ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
}
Music.prototype.ensure = function () {
  if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = this.ctx = new AC();
  this.master = c.createGain(); this.master.gain.value = this.on ? this.vol * 0.85 : 0; this.master.connect(c.destination);
  this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -18; this.comp.ratio.value = 4; this.comp.connect(this.master);
  this.mus = c.createGain(); this.mus.gain.value = 1; this.mus.connect(this.comp);
  // echo for the arpeggio, a long reverb-ish delay for pads
  this.dl = c.createDelay(1.5); this.dl.delayTime.value = 0.375; this.fb = c.createGain(); this.fb.gain.value = 0.38; this.dlf = c.createBiquadFilter(); this.dlf.type = 'lowpass'; this.dlf.frequency.value = 2200;
  this.dl.connect(this.dlf); this.dlf.connect(this.fb); this.fb.connect(this.dl); this.dlf.connect(this.mus);
  const len = c.sampleRate * 2.4, ir = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  this.rev = c.createConvolver(); this.rev.buffer = ir; this.revG = c.createGain(); this.revG.gain.value = 0.35; this.rev.connect(this.revG); this.revG.connect(this.mus);
  this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate); { const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  this.sfx = c.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.comp); this.emit = {};
  this.next = c.currentTime + 0.1; this.timer = setInterval(() => this.schedule(), 25);
};
Music.prototype.setOn = function (v) { this.on = v; LS.set('kageMusic', v ? '1' : '0'); this.ensure(); if (this.master) this.master.gain.setTargetAtTime(v ? this.vol * 0.85 : 0, this.ctx.currentTime, 0.3); };
Music.prototype.setVol = function (v) { this.vol = v; LS.set('kageMusicVol', String(v)); if (this.master && this.on) this.master.gain.setTargetAtTime(v * 0.85, this.ctx.currentTime, 0.1); };
Music.prototype.setStyle = function (k) { this.force = k || null; LS.set('kageMusicStyle', k || ''); };
/** where am I → style */
Music.prototype.want = function () {
  if (this.force) return this.force; const g = this.g, f = g.foot, Y = g.star;
  if (Y && Y.ship && Y.ship.mode === 'warp' && Y.aboard && Y.aboard()) return 'warp';
  if (f && (f.ss === 'in' || f.ss === 'helm')) return g.world === 'space' ? 'spazio' : 'odyssey';
  if (g.world === 'space' || g.world === 'planet' || (f && f.ss === 'eva')) return 'spazio';
  if (g.world === 'eco') return 'eco'; if (g.world === 'meadow') return 'passato';
  return (g.dayK || 0) < 0.3 ? 'notte' : 'citta';
};
Music.prototype.skip = function () { this.seed = (this.seed * 16807) % 2147483647; this.bar = 0; this.section = (this.section || 0) + 1; };
const rnd = s => { let h = s; return () => (h = (h * 16807) % 2147483647) / 2147483647; };
Music.prototype.schedule = function () {
  const c = this.ctx; if (!c || c.state !== 'running') return;
  const w = this.want(); if (w !== this.style) { this.fadeTo = w; }
  if (this.fadeTo && this.step % 4 === 0) { this.style = this.fadeTo; this.fadeTo = null; this.bar = 0; this.step = 0; const S = STY[this.style]; this.dl.delayTime.setTargetAtTime(60 / S.bpm * 0.75, c.currentTime, 0.1); }
  const S = STY[this.style || 'citta']; const st = 60 / S.bpm / 4;   // 16th notes
  while (this.next < c.currentTime + 0.12) { if (this.on) this.play(S, this.step, this.next, st); this.step++; if (this.step % 16 === 0) { this.bar++; } this.next += st * (1 + (this.step % 2 ? -S.swing || 0 : S.swing || 0)); }
};
Music.prototype.play = function (S, s, t, st) {
  const c = this.ctx, bar = this.bar, sec = Math.floor(bar / 8) % 4 + (this.section || 0), R = rnd(this.seed + bar * 13 + s), ch = S.prog[Math.floor(bar / 2) % S.prog.length], root = S.key, i16 = s % 16;
  const full = sec % 4 !== 0, arpOn = sec % 4 !== 3 || S.drums === 'none';
  // pad: on the bar, long attack
  if (i16 === 0 && bar % 2 === 0) for (const n of ch) this.voice({ f: N2F(root + 12 + n), t, d: st * 32, a: st * 6, r: st * 10, wave: 'sawtooth', det: 9, g: 0.05, lp: S.lp * 0.6, rev: 0.8 });
  // bass
  const bpat = S.drums === 'none' ? [0] : S.drums === 'glitch' ? [0, 3, 7, 10, 14] : S.drums === 'half' ? [0, 6, 8, 14] : [0, 2, 4, 6, 8, 10, 12, 14];
  if (bpat.includes(i16)) this.voice({ f: N2F(root - 12 + ch[0] + (i16 === 14 && R() < 0.3 ? 7 : 0)), t, d: st * (S.drums === 'none' ? 14 : 1.6), a: 0.005, r: 0.08, wave: S.crush ? 'square' : 'sawtooth', g: 0.12, lp: 420 + 300 * Math.sin(bar * 0.7), q: 6 });
  // arpeggio with echo
  if (arpOn && (S.drums === 'none' ? i16 % 4 === 0 : i16 % 2 === 0)) { const k = S.arp[(s / 2 | 0) % S.arp.length], n = S.penta ? [0, 2, 4, 7, 9][k % 5] + (ch[0] % 12) : ch[k % ch.length], oct = full && R() < 0.25 ? 24 : 12;
    this.voice({ f: N2F(root + oct + n), t, d: st * 1.2, a: 0.004, r: 0.12, wave: S.arpWave, g: S.drums === 'none' ? 0.05 : 0.045, lp: S.lp, echo: 0.6 }); }
  if (S.bell && i16 === 8 && R() < 0.5) this.voice({ f: N2F(root + 24 + ch[(R() * 4) | 0]), t, d: 2.5, a: 0.002, r: 2, wave: 'sine', g: 0.05, rev: 1, fm: 3.5 });
  // drums
  const D = S.drums; if (D === 'none' || !full && D !== 'four') return;
  if ((D === 'four' && i16 % 4 === 0) || (D === 'half' && (i16 === 0 || i16 === 10)) || (D === 'soft' && i16 === 0) || (D === 'glitch' && (i16 === 0 || i16 === 7 || (i16 === 11 && R() < 0.5)))) this.kick(t);
  if ((D === 'four' || D === 'half') && (i16 === 4 || i16 === 12)) this.snare(t, D === 'half' ? 0.7 : 1);
  if (D === 'glitch' && R() < 0.22) this.hat(t, 0.5, 9000 * (0.5 + R()), st * R());
  if ((D === 'four' && i16 % 2 === 1) || (D === 'half' && i16 % 4 === 2) || (D === 'soft' && i16 % 8 === 4)) this.hat(t, D === 'soft' ? 0.35 : 0.6);
};
Music.prototype.voice = function (o) {
  const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp || 3000; f.Q.value = o.q || 0.7;
  g.gain.setValueAtTime(0, o.t); g.gain.linearRampToValueAtTime(o.g, o.t + o.a); g.gain.setValueAtTime(o.g, o.t + Math.max(o.a, o.d - o.r)); g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.d + o.r);
  const osc = []; for (const dt of o.det ? [-o.det, o.det] : [0]) { const s = c.createOscillator(); s.type = o.wave; s.frequency.value = o.f; s.detune.value = dt; s.connect(f); osc.push(s); }
  if (o.fm) { const m = c.createOscillator(), mg = c.createGain(); m.frequency.value = o.f * o.fm; mg.gain.setValueAtTime(o.f * 2, o.t); mg.gain.exponentialRampToValueAtTime(1, o.t + o.d); m.connect(mg); mg.connect(osc[0].frequency); m.start(o.t); m.stop(o.t + o.d + o.r + 0.05); }
  f.connect(g); g.connect(this.mus); if (o.echo) { const e = c.createGain(); e.gain.value = o.echo; g.connect(e); e.connect(this.dl); } if (o.rev) { const e = c.createGain(); e.gain.value = o.rev; g.connect(e); e.connect(this.rev); }
  for (const s of osc) { s.start(o.t); s.stop(o.t + o.d + o.r + 0.05); }
};
Music.prototype.kick = function (t) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + 0.4); };
Music.prototype.snare = function (t, k) { const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); n.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8; g.gain.setValueAtTime(0.22 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  n.connect(f); f.connect(g); g.connect(this.mus); const e = c.createGain(); e.gain.value = 0.5; g.connect(e); e.connect(this.rev); n.start(t); n.stop(t + 0.25); };
Music.prototype.hat = function (t, k, fr, off) { const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); t += off || 0; n.buffer = this.noise; f.type = 'highpass'; f.frequency.value = fr || 7000; g.gain.setValueAtTime(0.07 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); n.connect(f); f.connect(g); g.connect(this.mus); n.start(t, Math.random() * 0.5); n.stop(t + 0.07); };

/* ---------------- 3D sounds: looping emitters panned by position and camera heading ---------------- */
Music.prototype.emitter = function (id, mk) { if (this.emit[id]) return this.emit[id]; const c = this.ctx, g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null; g.gain.value = 0;
  if (p) { g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx); const src = mk(c, g); return (this.emit[id] = { g, p, src }); };
Music.prototype.update = function () {
  const c = this.ctx; if (!c || c.state !== 'running') return; const g = this.g, f = g.foot, cv = g.cv, on = this.sfx3d;
  const lis = f && f.active && !f.ss ? [f.x, f.z] : [g.c.x, g.c.z], head = cv ? Math.atan2(cv.l[0] - cv.e[0], cv.l[2] - cv.e[2]) : 0;
  const place = (E, x, z, near, vol) => { const dx = wrapD(x - lis[0]), dz = wrapD(z - lis[1]), d = Math.hypot(dx, dz), k = on && g.world === 'city' ? vol * Math.max(0, 1 - d / near) ** 2 : 0;
    E.g.gain.setTargetAtTime(k, c.currentTime, 0.15); if (E.p) { const a = Math.atan2(dx, dz) - head; E.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, -Math.sin(a))), c.currentTime, 0.1); } };
  const hum = (f0, type, lp, lfo) => (cx, out) => { const o = cx.createOscillator(), o2 = cx.createOscillator(), fl = cx.createBiquadFilter(), l = cx.createOscillator(), lg = cx.createGain(); o.type = type; o.frequency.value = f0; o2.type = 'sine'; o2.frequency.value = f0 * 1.503;
    fl.type = 'lowpass'; fl.frequency.value = lp; l.frequency.value = lfo; lg.gain.value = lp * 0.4; l.connect(lg); lg.connect(fl.frequency); o.connect(fl); o2.connect(fl); fl.connect(out); o.start(); o2.start(); l.start(); return [o, o2, l]; };
  if (g.nexus) place(this.emitter('nexus', hum(55, 'sawtooth', 380, 0.25)), 4 * NR.GP, 2 * NR.GP + 42, 70, g.nexus.st === 'idle' ? 0.12 : 0.3);
  if (g.xeno) { const pd = g.xeno.toWorld(0, 0); place(this.emitter('xeno', hum(73, 'triangle', 700, 0.6)), pd[0], pd[1], 90, 0.2); }
  if (g.xeno) { const E = this.emitter('epoch', (cx, out) => { const o = cx.createOscillator(), gg = cx.createGain(), l = cx.createOscillator(), lg = cx.createGain(); o.type = 'square'; o.frequency.value = 2600; l.type = 'square'; l.frequency.value = 2; lg.gain.value = 0.5; gg.gain.value = 0.5; l.connect(lg); lg.connect(gg.gain); const fl = cx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 2600; fl.Q.value = 18; o.connect(fl); fl.connect(gg); gg.connect(out); o.start(); l.start(); return [o, l]; });
    place(E, 30, 27, 14, 0.12); }
  // the warp core when you're on deck 5
  { const E = this.emitter('core', hum(41, 'sawtooth', 260, 0.4)), aboard = f && f.ss === 'in' && f.deck === 4 && on; let k = 0, pan = 0;
    if (aboard) { const dx = f.lx, dz = f.lz - 15, d = Math.hypot(dx, dz); k = 0.35 * Math.max(0, 1 - d / 18); const a = Math.atan2(dx, dz) - (f.lcam !== undefined ? f.lcam : f.lh) - PI; pan = Math.sin(a); }
    E.g.gain.setTargetAtTime(k, c.currentTime, 0.2); if (E.p) E.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), c.currentTime, 0.1); }
};

/* ---------------- tablet app ---------------- */
function install(OS) {
  OS.prototype.app_music = function () {
    const M = this.g.music; if (!M) { this.frame('🎵 Musica', 'non disponibile'); return; } M.ensure();
    const cur = STY[M.style || M.want()];
    this.frame('🎵 Musica · KAGE SOUND', '<div class="card"><b>Ora suona: ' + cur.name + '</b> · ' + cur.bpm + ' bpm<br><small>Colonna sonora originale generata dal vivo: cambia con il mondo, l’ora e il cielo vero.</small><br><br>'
      + '<button class="btn ' + (M.on ? 'on' : '') + '" data-act="mus:on">' + (M.on ? '♫ musica accesa' : '♪ musica spenta') + '</button> <button class="btn" data-act="mus:skip">⏭ variazione</button> '
      + '<button class="btn ' + (M.sfx3d ? 'on' : '') + '" data-act="mus:3d">🔊 suoni 3D ' + (M.sfx3d ? 'sì' : 'no') + '</button><br><br>Volume <input type="range" min="0" max="1" step="0.05" value="' + M.vol + '" id="musVol" style="width:40vmin;vertical-align:middle"></div>'
      + '<div class="card"><b>Stile</b><br><button class="btn ' + (!M.force ? 'on' : '') + '" data-act="mus:auto">✦ automatico</button> ' + Object.entries(STY).map(([k, s]) => '<button class="btn ' + (M.force === k ? 'on' : '') + '" data-act="mus:' + k + '" style="margin:.3vmin">' + s.name + '</button>').join('') + '</div>');
    this.view().querySelector('#musVol').addEventListener('input', e => M.setVol(+e.target.value));
  };
  const act0 = OS.prototype.act;
  OS.prototype.act = function (a, el) { const M = this.g.music; if (!M || !a.startsWith('mus:')) return act0.call(this, a, el); const v = a.slice(4);
    if (v === 'on') M.setOn(!M.on); else if (v === 'skip') M.skip(); else if (v === '3d') { M.sfx3d = !M.sfx3d; LS.set('kageSfx3d', M.sfx3d ? '1' : '0'); } else if (v === 'auto') M.setStyle(null); else M.setStyle(v);
    this.launch('music'); };
}
if (window.AmpyOS) install(window.AmpyOS);
window.KageMusic = Music;
})();
