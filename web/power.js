/* KAGE POWER · battery and heat aware performance. Modes: PIENA (full resolution, 60 fps, every effect), BILANCIATA, RISPARMIO
 * (lower render resolution, 30 fps, no warp lensing, no live photo filter, shorter view distance, quieter 3D sound).
 * AUTO (default) reads the real phone: below 20 % battery and not charging, in the system power saver, or when the phone is
 * getting hot (thermal status ≥ moderate) it drops to RISPARMIO; on the charger or cool again it goes back. Also measures the
 * real frame rate and steps down the resolution if the phone can't keep up. Chosen in the tablet (⚡ Energia). */
(function () {
'use strict';
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const MODES = { piena: { name: 'PIENA', scale: 1, fps: 60, lens: true, live: true, far: 1 }, bilanciata: { name: 'BILANCIATA', scale: 0.8, fps: 60, lens: true, live: true, far: 0.85 },
  risparmio: { name: 'RISPARMIO', scale: 0.6, fps: 30, lens: false, live: false, far: 0.65 } };
function Power(game) {
  this.g = game; this.pref = LS.get('kagePower', 'auto'); this.mode = this.pref === 'auto' ? 'piena' : this.pref; this.why = ''; this.fpsA = 60; this.dyn = 1; this.chkT = 0; this.info = null; this.last = 0;
  this.check(); this.apply();
}
Power.prototype.cfg = function () { return MODES[this.mode]; };
Power.prototype.set = function (p) { this.pref = p; LS.set('kagePower', p); this.dyn = 1; this.check(); this.apply(); };
/** read the real phone (Android bridge, else the browser Battery API) and pick the mode */
Power.prototype.check = function () {
  const B = window.AmpyBridge, done = (bat, chg, saver, therm) => { this.info = { bat, chg, saver, therm };
    let m = this.pref === 'auto' ? 'piena' : this.pref, why = this.pref === 'auto' ? '' : 'scelta manuale';
    if (this.pref === 'auto') { if (therm >= 2) { m = 'risparmio'; why = 'il telefono si sta scaldando'; } else if (saver) { m = 'risparmio'; why = 'risparmio energetico di Android'; } else if (bat !== null && bat < 20 && !chg) { m = 'risparmio'; why = 'batteria al ' + bat + '%'; } else if (bat !== null && bat < 35 && !chg) { m = 'bilanciata'; why = 'batteria al ' + bat + '%'; } else if (therm === 1) { m = 'bilanciata'; why = 'telefono tiepido'; } }
    if (m !== this.mode) { this.mode = m; this.why = why; this.apply(); if (this.g.story) this.g.story.toast('⚡ modalità ' + MODES[m].name + (why ? ' · ' + why : '')); } else this.why = why; };
  try { if (B && B.device) { const d = JSON.parse(B.device()); done(d.battery >= 0 ? d.battery : null, !!d.charging, !!d.powerSave, d.thermal || 0); return; } } catch (e) { }
  if (navigator.getBattery) navigator.getBattery().then(b => done(Math.round(b.level * 100), b.charging, false, 0)).catch(() => done(null, true, false, 0)); else done(null, true, false, 0);
};
/** resolution: the page's resize() reads window.__kageScale */
Power.prototype.apply = function () { const C = this.cfg(); window.__kageScale = C.scale * this.dyn; if (window.__kageResize) window.__kageResize(); };
/** called every frame by the page loop with the real time: returns false when this frame should be skipped (30 fps cap) */
Power.prototype.tick = function (now) {
  const C = this.cfg(), minDt = 1000 / C.fps - 2; if (now - this.last < minDt) return false;
  const dt = now - this.last; this.last = now; if (dt < 200) this.fpsA += (1000 / dt - this.fpsA) * 0.05;
  this.chkT -= dt / 1000; if (this.chkT <= 0) { this.chkT = 20; this.check();
    // can't keep up: step the resolution down (and back up when there's room)
    if (this.fpsA < C.fps * 0.7 && this.dyn > 0.55) { this.dyn = Math.max(0.55, this.dyn - 0.1); this.apply(); } else if (this.fpsA > C.fps * 0.95 && this.dyn < 1) { this.dyn = Math.min(1, this.dyn + 0.05); this.apply(); } }
  return true;
};

function install(OS) {
  OS.prototype.app_power = function () {
    const P = this.g.power; if (!P) { this.frame('⚡ Energia', 'non disponibile'); return; } P.check(); const I = P.info || {}, C = P.cfg();
    this.frame('⚡ Energia · KAGE POWER', '<div class="card"><b>Ora: ' + C.name + '</b>' + (P.why ? ' · ' + P.why : '') + '<br><small>risoluzione ' + Math.round(C.scale * P.dyn * 100) + '% · ' + C.fps + ' fps max · misurati ' + Math.round(P.fpsA) + ' fps</small>'
      + '<div class="meter"><i style="width:' + Math.round(Math.min(1, P.fpsA / 60) * 100) + '%"></i></div><small>Batteria ' + (I.bat === null || I.bat === undefined ? '—' : I.bat + '%') + (I.chg ? ' ⚡ in carica' : '') + (I.saver ? ' · risparmio Android' : '') + ' · temperatura ' + (['normale', 'tiepido', 'calda', 'alta', 'critica'][I.therm || 0] || '—') + '</small></div>'
      + '<div class="card"><b>Modalità</b><br>' + [['auto', '✦ AUTOMATICA · segue la batteria vera'], ['piena', '🔥 PIENA'], ['bilanciata', '⚖ BILANCIATA'], ['risparmio', '🔋 RISPARMIO']].map(([k, l]) => '<button class="btn ' + (P.pref === k ? 'on' : '') + '" data-act="pow:' + k + '" style="margin:.3vmin">' + l + '</button>').join('')
      + '<br><small>RISPARMIO: risoluzione 60%, 30 fps, niente distorsione warp né filtro foto dal vivo, vista più corta.</small></div>');
  };
  const act0 = OS.prototype.act;
  OS.prototype.act = function (a, el) { const P = this.g.power; if (!P || !a.startsWith('pow:')) return act0.call(this, a, el); P.set(a.slice(4)); this.launch('power'); };
}
if (window.AmpyOS) install(window.AmpyOS);
window.KagePower = Power; window.KagePowerModes = MODES;
})();
