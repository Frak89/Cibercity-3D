/* KAGE TROFEI · achievements checked from the real state of the game, with a toast and a chime when you unlock one, and the
 * trophy case in the tablet (🏆 Trofei) with your progress on each. Kept in localStorage (and in the KAGE SAVE backups). */
(function () {
'use strict';
const NR = window.NeonRun; if (!NR) return;
const { wrapD } = NR;
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VEH = ['moto', 'hover', 'drone', 'boat', 'sub', 'galleon', 'ufo'];
const PLANETS = ['luna', 'marte', 'colonia', 'proxima', 'kepler452', 'kepler186'];
// id, icon, title, description, target, value(T) → number
const LIST = [
  ['passi', '👟', 'Primi passi', 'Scendi dall’auto e cammina per 100 m', 100, T => T.c.walk],
  ['sprint', '🏃', 'Velocista', 'Corri per 2 km in totale', 2000, T => T.c.sprint],
  ['flotta', '🚀', 'Pilota della flotta', 'Guida tutti i veicoli KAGE (moto, hover, drone, barca, sottomarino, galeone, XENO)', VEH.length, T => VEH.filter(k => T.c.veh[k]).length],
  ['jet', '🔥', 'Uomo razzo', 'Vola 60 secondi col jetpack', 60, T => T.c.jet],
  ['skate', '🛹', 'Re dello skate', 'Percorri 1 km in skateboard', 1000, T => T.c.skate],
  ['raggio', '🛸', 'Rapito!', 'Fatti prelevare dal raggio del KAGE XENO', 1, T => T.c.beam],
  ['tempo', '⏳', 'Viaggiatore del tempo', 'Viaggia nel passato con l’EPOCH', 1, T => T.c.past],
  ['eco', '🌀', 'Oltre il portale', 'Entra in ECO attraverso il NEXUS', 1, T => T.c.eco],
  ['bordo', '✦', 'Benvenuto a bordo', 'Teletrasportati sulla KAGE ODYSSEY', 1, T => T.c.aboard],
  ['capitano', '🧑‍✈️', 'Capitano', 'Siediti al posto del capitano', 1, T => T.c.helm],
  ['warp10', '⚡', 'Warp 10', 'Vai in curvatura al massimo fattore', 10, T => T.c.warp],
  ['pianeti', '🪐', 'Esploratore', 'Scendi su tutti i pianeti e le lune', PLANETS.length, T => PLANETS.filter(k => T.c.planet[k]).length],
  ['eva', '👨‍🚀', 'Passeggiata spaziale', 'Esci nello spazio dal portello EVA', 1, T => T.c.eva],
  ['stasi', '🧊', 'Risveglio', 'Risveglia un ospite dalla stasi', 1, T => T.c.wake],
  ['letture', '𓂀', 'Lettore di pietre', 'Leggi tutti e 10 i monoliti', 10, T => { const m = T.g.mono; return m ? m.st.read.filter(i => i[0] === 'm').length : 0; }],
  ['decifra', '🔓', 'Decifratore', 'Decifra 5 iscrizioni', 5, T => { const m = T.g.mono; return m ? m.st.solved.length : 0; }],
  ['tecnico', '🔧', 'Tecnico esperto', 'Ripara 5 guasti con KAGE TECH', 5, T => T.g.tech ? T.g.tech.st.fixed : 0],
  ['regole', '🤖', 'Automazione', 'Fai scattare una regola QUANDO di KAGE SCRIPT', 1, T => T.c.rule],
  ['foto', '📸', 'Fotografo', 'Scatta 10 foto', 10, T => T.c.photo],
  ['costruttore', '🏗', 'Architetto', 'Piazza 15 pezzi con KAGE BUILD', 15, T => T.g.editor ? T.g.editor.items.length : 0],
  ['amici', '🌐', 'Non sei solo', 'Incontra un altro pilota su KAGE NET', 1, T => T.c.peer],
  ['corsa', '🏁', 'Campione', 'Vinci una sfida di corsa su KAGE NET', 1, T => T.c.race],
  ['campagna', '🌱', 'Il Segnale dei Custodi', 'Completa la campagna', 8, T => T.g.story ? Math.min(8, T.g.story.st.ch) : 0],
  ['tutto', '🏆', 'Leggenda di Cybercity', 'Sblocca tutti gli altri trofei', 23, T => LIST.filter(x => x[0] !== 'tutto' && T.st.done[x[0]]).length]];

function Trophies(game) {
  this.g = game; this.t = 0;
  try { this.st = JSON.parse(LS.get('kageTrofei', '{}')); } catch (e) { this.st = {}; }
  this.st.done = this.st.done || {}; this.c = this.st.c = Object.assign({ walk: 0, sprint: 0, jet: 0, skate: 0, beam: 0, past: 0, eco: 0, aboard: 0, helm: 0, warp: 0, eva: 0, wake: 0, rule: 0, photo: 0, peer: 0, race: 0, veh: {}, planet: {} }, this.st.c || {});
  this.c.veh = this.c.veh || {}; this.c.planet = this.c.planet || {};
  const self = this, OS = window.AmpyOS;
  if (OS && OS.prototype.savePhoto) { const s0 = OS.prototype.savePhoto; OS.prototype.savePhoto = function (u, s) { self.c.photo++; self.save(); return s0.call(this, u, s); }; }
  if (window.KageTech) { const t0 = window.KageTech.prototype.start; window.KageTech.prototype.start = function (d, text, why, code) { if (why && String(why).startsWith('QUANDO')) self.c.rule = 1; return t0.apply(this, arguments); }; }
}
Trophies.prototype.save = function () { LS.set('kageTrofei', JSON.stringify(this.st)); };
Trophies.prototype.update = function (dt) {
  const g = this.g, f = g.foot, c = this.c, Y = g.star, N = g.net;
  if (f && f.active && !f.ss && !f.xs && !g.veh && !f.trans) { const v = Math.abs(f.v || 0); if (f.gear === 'skate') c.skate += Math.abs(f.gv || 0) * dt; else if (f.gear === 'jet' && (f.y || 0) > 0.5) c.jet += dt; else if (v > 6) c.sprint += v * dt; else c.walk += v * dt; }
  if (g.veh && VEH.includes(g.veh.kind)) c.veh[g.veh.kind] = 1;
  if (f && f.xs === 'up') c.beam = 1; if (g.world === 'meadow') c.past = 1; if (g.world === 'eco') c.eco = 1;
  if (f && (f.ss === 'in' || f.ss === 'helm')) c.aboard = 1; if (f && f.ss === 'helm') c.helm = 1; if (f && f.ss === 'eva') c.eva = 1; if (Y && Y.wake) c.wake = 1;
  if (Y && Y.ship && Y.ship.mode === 'warp' && window.KageStar) c.warp = Math.max(c.warp, window.KageStar.WARP_STEPS[Y.ship.warpI] || 0);
  if (Y && f && f.ss === 'planet' && Y.site) c.planet[Y.site] = 1;
  if (N && N.on && Object.keys(N.peers).length) c.peer = 1; if (N && N.race && N.race.win === N.name) c.race = 1;
  if ((this.t -= dt) > 0) return; this.t = 1;
  let any = false;
  for (const [id, ic, title, , target, val] of LIST) { if (this.st.done[id]) continue; let v = 0; try { v = val(this); } catch (e) { } if (v >= target) { this.st.done[id] = Date.now(); any = true; this.unlock(ic, title); } }
  this.save(); void any;
};
Trophies.prototype.unlock = function (ic, title) {
  if (this.g.story) this.g.story.toast('🏆 TROFEO · ' + ic + ' ' + title);
  if (window.FleetAudio) { if (!this.au) this.au = new FleetAudio(); this.au.start(); [784, 988, 1175, 1568].forEach((n, i) => setTimeout(() => this.au.blip(n, n, 0.25, 0.09, 'triangle'), i * 110)); }
  if (this.g.aos) this.g.aos.vib(40);
};

function install(OS) {
  OS.prototype.app_trophy = function () {
    const T = this.g.trophies; if (!T) { this.frame('🏆 Trofei', 'non disponibile'); return; } const n = LIST.filter(x => T.st.done[x[0]]).length;
    this.frame('🏆 Trofei · ' + n + ' / ' + LIST.length, '<div class="card"><div class="meter"><i style="width:' + Math.round(n / LIST.length * 100) + '%"></i></div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(32vmin,1fr));gap:1.2vmin">' + LIST.map(([id, ic, title, desc, target, val]) => { const d = T.st.done[id]; let v = 0; try { v = Math.min(target, val(T)); } catch (e) { }
        return '<div class="card' + (d ? ' n' : '') + '" style="margin:0;' + (d ? '' : 'opacity:.62') + '"><span style="font-size:3.6vmin">' + (d ? ic : '🔒') + '</span> <b>' + esc(title) + '</b><br><small>' + esc(desc) + '</small>'
          + (d ? '<br><small>✔ ' + new Date(d).toLocaleDateString('it-IT') + '</small>' : '<div class="meter"><i style="width:' + Math.round(v / target * 100) + '%"></i></div><small>' + (target >= 100 ? Math.round(v) + ' / ' + target : Math.floor(v) + ' / ' + target) + '</small>') + '</div>'; }).join('') + '</div>');
  };
}
if (window.AmpyOS) install(window.AmpyOS);
window.KageTrophies = Trophies; window.KageTrophyList = LIST;
})();
