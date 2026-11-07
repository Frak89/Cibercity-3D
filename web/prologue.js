/* PROLOGO · "Il risveglio". The story opens in the present, in your flat, on a real morning (today's date and time):
 *  1 CAMERA — you wake up (eyelids, blur), the alarm on the phone, a strange notification in glyphs, the dream notebook.
 *  2 CUCINA — breakfast… but where the fridge should be there's a brass time cabin, humming.
 *  3 CONSOLE — close up, touch puzzle: plug it in, switch it on, set the year from the dream (notebook), light the three
 *    crystals "from dawn to night", pull the lever. Wrong moves buzz; hints come by themselves if you get stuck.
 *  4 VORTICE — glyphs swirling, whispers.
 *  5 RISVEGLIO NEL FUTURO — in Cybercity, lying on the street: eyes opening, blurred double vision, voices around you,
 *    you get up; ARIA (the KAGE GARAGE's attendant, original character) is there and tells you about your mission.
 * Then chapter I starts (VEGA on the radio). Skippable. Shown once (story.st.prologue). */
(function () {
'use strict';
const NR = window.NeonRun, KF = window.KageFleet, U = window.CarRenderUtil; if (!NR) return;
const { wrapD } = NR, PI = Math.PI, TAU = PI * 2;
const VW = 1600, VH = 900;
const YEAR = [2, 0, 8, 7], CRYST = [{ k: 'notte', c: '#a36bff', x: 610 }, { k: 'alba', c: '#ff9a3c', x: 800 }, { k: 'giorno', c: '#46d6ff', x: 990 }], ORDER = ['alba', 'giorno', 'notte'];
const ARIA = { suit: 'blu', hair: 'coda', hairColor: 'nero', skin: 'olivastra', build: 'snello', beard: 'nessuna' };
const ARIA_LINES = ['Piano… respira. Sei al sicuro.', 'Sono ARIA, l’addetta del KAGE GARAGE. Benvenuto a Cybercity. Anno 2087.',
  'Lo so: un attimo fa eri nella tua cucina. L’EPOCH ti ha portato qui, come era previsto.',
  'Non ricordi di aver accettato la missione… ma la conosci già. L’hai sognata: le pietre, i simboli, la voce.',
  'Quella voce sono i Custodi. Da tre notti le loro pietre trasmettono, e tu sei l’unico che riesce a leggerle.',
  'Quella è la tua KAGE GT. Il tablet AmpybiOS è nella tua giacca. Gli altri mezzi te li daremo man mano, quando sarai pronto.',
  'VEGA, dalla nave in orbita, ti guiderà. Io resto qui al garage: se ti perdi, torna da me.'];
const VOICES = ['…sta riprendendo conoscenza…', '…parametri vitali stabili…', '…è lui? È il pilota del sogno…', '…l’EPOCH è rientrata nel garage…', '…non toccatelo, deve svegliarsi da solo…', '…mi senti?…', '…chiamate ARIA…'];

function Prologue(game, story) {
  this.g = game; this.S = story; this.on = false; this.scene = null; this.t = 0; this.msg = ''; this.msgT = 0; this.lines = []; this.st = { plug: 0, power: 0, year: [1, 9, 9, 9], cr: [], lever: 0, notebook: 0, phone: 0, coffee: 0 };
  this.cvs = document.createElement('canvas'); this.cvs.id = 'pro';
  const css = document.createElement('style'); css.textContent = '#pro{position:fixed;inset:0;width:100%;height:100%;z-index:80;display:none;touch-action:none;cursor:pointer;background:#000} #proSkip{position:fixed;right:2vmin;top:2vmin;z-index:81;display:none;font:600 1.8vmin system-ui;color:#fff;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.35);border-radius:2vmin;padding:.8vmin 1.6vmin;cursor:pointer}';
  document.head.appendChild(css); document.body.appendChild(this.cvs);
  const sk = this.skipB = document.createElement('button'); sk.id = 'proSkip'; sk.textContent = 'SALTA IL PROLOGO ⏭'; document.body.appendChild(sk);
  sk.addEventListener('click', e => { e.stopPropagation(); this.finish(true); });
  this.cvs.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.tap(e); });
  this.cvs.addEventListener('pointermove', e => { if (this.drag) this.dragMove(e); });
  this.cvs.addEventListener('pointerup', () => { this.drag = null; });
  addEventListener('keydown', e => { if (!this.on) return; if (this.scene !== 'wake' && this.scene !== 'talk' || this.lock) { e.stopImmediatePropagation(); if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.advance(); } } }, true);
  addEventListener('resize', () => this.fit());
  // during the wake-up the street camera is ours and the pilot is lying (hidden, first person)
  const OF = window.KageOnFoot, self = this;
  if (OF) { const c0 = OF.prototype.camera, u0 = OF.prototype.update, d0 = OF.prototype.draw;
    OF.prototype.camera = function (view, dt) { const cv = c0.call(this, view, dt); return self.camOverride ? self.camOverride(this, cv) : cv; };
    OF.prototype.update = function (dt, inp) { if (self.lock) { this.v = 0; this.anim = 'in piedi'; return { vF: 0 }; } return u0.call(this, dt, inp); };
    OF.prototype.draw = function (ctx) { if (self.hide) return; return d0.call(this, ctx); }; }
}
Prologue.prototype.start = function () {
  this.on = true; this.lock = true; this.scene = 'bed'; this.t = 0; this.cvs.style.display = 'block'; this.skipB.style.display = 'block';
  this.say(['…', 'Ancora quel sogno.', 'Le pietre… quei simboli… e la voce che mi chiama per nome.', 'Che ore sono?']);
  document.body.classList.add('photomode');   // hides the game's HUD and buttons
  this.fit(); this.au(); this.loop();
};
Prologue.prototype.fit = function () { const c = this.cvs, d = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * d; c.height = innerHeight * d; const k = Math.min(c.width / VW, c.height / VH); this.k = k; this.ox = (c.width - VW * k) / 2; this.oy = (c.height - VH * k) / 2; };
Prologue.prototype.au = function () { if (!window.FleetAudio) return null; if (!this.a) this.a = new FleetAudio(); this.a.start(); return this.a; };
Prologue.prototype.blip = function (a, b, d, v, w) { const A = this.au(); if (A) A.blip(a, b, d, v, w || 'sine'); };
Prologue.prototype.say = function (lines) { this.lines = lines.slice(); this.lineT = 0; this.cur = this.lines.shift() || ''; this.shown = 0; };
Prologue.prototype.note = function (s, t) { this.msg = s; this.msgT = t || 3; };
Prologue.prototype.advance = function () { if (this.cur && this.shown < this.cur.length) { this.shown = this.cur.length; return true; } if (this.lines.length) { this.cur = this.lines.shift(); this.shown = 0; return true; } if (this.cur) { this.cur = ''; return true; } return false; };
const V = (P, e) => { const r = P.cvs.getBoundingClientRect(), d = P.cvs.width / r.width; return [((e.clientX - r.left) * d - P.ox) / P.k, ((e.clientY - r.top) * d - P.oy) / P.k]; };
const inR = (p, x, y, w, h) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h;

/* ---------------- input ---------------- */
Prologue.prototype.tap = function (e) {
  const p = V(this, e); this.au();
  if (this.zoom) { this.zoom = null; return; }
  if (this.cur && this.advance()) return;      // finish / skip the current thought first
  const s = this.scene, st = this.st;
  if (s === 'bed') {
    if (inR(p, 860, 600, 110, 60)) { st.phone = 1; this.blip(880, 1320, 0.15, 0.08); this.zoom = 'phone'; this.say(['Un segnale sconosciuto… di nuovo quei simboli.', 'Non sono un’app. Non sono niente che conosco.']); return; }
    if (inR(p, 700, 640, 140, 50)) { st.notebook = 1; this.blip(500, 700, 0.1, 0.06); this.zoom = 'notebook'; this.say(['Il mio quaderno dei sogni. La mia calligrafia… ma non ricordo di averlo scritto.']); return; }
    if (inR(p, 60, 140, 220, 640)) { if (!st.phone) { this.say(['Prima vediamo che ore sono.']); return; } this.go('kit'); this.say(['Caffè. Mi serve un caffè.', '…', 'Aspetta.', 'Dov’è finito il frigorifero?']); return; }
    this.say([['Il soffitto. La luce dell’alba.', 'Il telefono sul comodino vibra.', 'Il quaderno dei sogni è ancora aperto.'][(this.tapN = (this.tapN || 0) + 1) % 3]]); return; }
  if (s === 'kit') {
    if (inR(p, 1060, 70, 380, 740)) { this.go('con'); this.say(['Una cabina d’ottone, al posto del frigo. Ronza.', 'Sul fianco c’è un pannello pieno di pulsanti.', 'Sembra… una console.']); return; }
    if (inR(p, 380, 470, 160, 130)) { st.coffee++; this.blip(300, 260, 0.4, 0.05, 'triangle'); this.say([st.coffee > 1 ? 'Il caffè è pronto. Ma non riesco a smettere di guardare quella cabina.' : 'La moka borbotta. Almeno qualcosa è normale, stamattina.']); return; }
    if (inR(p, 40, 120, 160, 680)) { this.go('bed'); return; }
    return; }
  if (s === 'con') {
    if (inR(p, 30, 40, 160, 80)) { this.go('kit'); return; }
    if (!st.plug && inR(p, 150, 640, 220, 160)) { st.plug = 1; this.blip(120, 90, 0.25, 0.12, 'square'); this.say(['La spina del frigorifero… ora alimenta la cabina. Ha senso. Credo.']); return; }
    if (inR(p, 200, 280, 140, 220)) { if (!st.plug) { this.buzz(); this.say(['L’interruttore scatta a vuoto. Non c’è corrente.']); return; } st.power = st.power ? 0 : 1; this.blip(st.power ? 200 : 600, st.power ? 900 : 150, 0.6, 0.1, 'sawtooth'); if (st.power) this.say(['Il display si accende. Si sta… avviando.']); return; }
    for (let i = 0; i < 4; i++) { const x = 560 + i * 125;
      if (inR(p, x, 330, 100, 60)) { if (!st.power) return this.buzz(); st.year[i] = (st.year[i] + 1) % 10; this.blip(1200, 1100, 0.04, 0.06, 'square'); this.yearCheck(); return; }
      if (inR(p, x, 500, 100, 60)) { if (!st.power) return this.buzz(); st.year[i] = (st.year[i] + 9) % 10; this.blip(1000, 900, 0.04, 0.06, 'square'); this.yearCheck(); return; } }
    for (const C of CRYST) if (Math.hypot(p[0] - C.x, p[1] - 690) < 62) { if (!st.power) return this.buzz(); if (!this.yearOk()) { this.buzz(); this.note('ANNO NON IMPOSTATO · I CRISTALLI NON RISPONDONO'); return; }
      if (st.cr.includes(C.k)) return; st.cr.push(C.k); const ok = ORDER.slice(0, st.cr.length).every((k, i) => st.cr[i] === k);
      if (!ok) { this.buzz(); st.cr = []; this.note('SEQUENZA ERRATA · CRISTALLI SPENTI'); this.fails = (this.fails || 0) + 1; return; }
      this.blip(400 + st.cr.length * 220, 600 + st.cr.length * 300, 0.5, 0.1, 'triangle'); if (st.cr.length === 3) this.say(['I tre cristalli brillano insieme. La leva sul lato si è sbloccata.']); return; }
    if (inR(p, 1230, 220, 160, 480)) { this.drag = { y0: p[1], v0: st.lever }; if (!this.ready()) { this.buzz(); this.note('LEVA BLOCCATA'); this.drag = null; } return; }
    return; }
  if (s === 'wake' && this.wakeReady) { this.rise(); return; }
};
Prologue.prototype.dragMove = function (e) { const p = V(this, e), D = this.drag; this.st.lever = Math.max(0, Math.min(1, D.v0 + (p[1] - D.y0) / 300)); if (this.st.lever >= 1) { this.drag = null; this.launch(); } };
Prologue.prototype.buzz = function () { this.blip(140, 110, 0.25, 0.12, 'square'); };
Prologue.prototype.yearOk = function () { return this.st.year.every((v, i) => v === YEAR[i]); };
Prologue.prototype.yearCheck = function () { if (this.yearOk() && !this.yearSaid) { this.yearSaid = 1; this.blip(660, 1320, 0.4, 0.1, 'triangle'); this.say(['2087. L’anno del sogno. Il display ha smesso di tremare.']); } };
Prologue.prototype.ready = function () { const s = this.st; return s.plug && s.power && this.yearOk() && s.cr.length === 3; };
Prologue.prototype.go = function (s) { this.scene = s; this.sceneT = 0; this.blip(400, 300, 0.08, 0.04); };

/* ---------------- the jump and the future ---------------- */
Prologue.prototype.launch = function () {
  this.scene = 'vortex'; this.sceneT = 0; this.say([]); this.cur = '';
  const A = this.au(); if (A) { A.blip(80, 1600, 3.5, 0.2, 'sawtooth'); A.blip(60, 40, 4.5, 0.15, 'square'); }
  this.whispers = 0;
};
Prologue.prototype.toFuture = function () {
  const g = this.g, f = g.foot; g.world = 'city';
  if (f && !f.active) { f.toggle(); f.trans = null; f.y = 0; g.doorT = 0; }
  if (f) { f.v = 0; this.h0 = f.h; }
  this.scene = 'wake'; this.sceneT = 0; this.hide = true; this.wakeReady = false; this.vi = 0;
  this.camOverride = (o, cv) => this.wakeCam(o, cv);
  this.say([]); this.cur = '';
};
Prologue.prototype.wakeCam = function (o, cv) {
  const c = this.g.c, px = wrapD(o.x - c.x), pz = wrapD(o.z - c.z), t = this.sceneT, k = this.riseK || 0, sway = Math.sin(t * 0.7) * 0.15 * (1 - k);
  // lying: eyes 0.3 m above the ground looking at the sky; rising: blend into the normal third-person camera
  const fx = Math.sin(o.h + sway), fz = Math.cos(o.h + sway), e0 = [px - fx * 0.2, 0.32, pz - fz * 0.2], l0 = [px + fx * 2.5, 6 + Math.sin(t * 0.5) * 0.6, pz + fz * 2.5];
  const L = (a, b) => a.map((v, i) => v + (b[i] - v) * k), s = k * k * (3 - 2 * k);
  return Object.assign({}, cv, { e: s ? L(e0, cv.e).map((v, i) => e0[i] + (cv.e[i] - e0[i]) * s) : e0, l: l0.map((v, i) => v + (cv.l[i] - v) * s), fov: 70 - 10 * s, roll: (1 - s) * 0.12 * Math.sin(t * 0.4) });
};
Prologue.prototype.rise = function () { if (this.rising) return; this.rising = true; this.riseK = 0; this.blip(200, 400, 0.6, 0.06, 'triangle'); };
Prologue.prototype.ariaPos = function () { const f = this.g.foot; return [f.x + Math.sin(f.h) * 2.7, f.z + Math.cos(f.h) * 2.7]; };
Prologue.prototype.talk = function () {
  this.scene = 'talk'; const S = this.S; const ap = this.ariaPos(); S.st.aria = { x: ap[0], z: ap[1] }; S.save();
  this.cvs.style.display = 'none'; this.skipB.style.display = 'none'; document.body.classList.remove('photomode'); this.camOverride = null; this.hide = false;
  const f = this.g.foot; if (f) { f.camH = f.h; f.camP = 0.15; }
  S.radio(ARIA_LINES, 'IL RISVEGLIO', 'aria', () => this.finish(false));
};
Prologue.prototype.finish = function (skipped) {
  const S = this.S, g = this.g; this.on = false; this.lock = false; this.hide = false; this.camOverride = null; this.cvs.style.display = 'none'; this.skipB.style.display = 'none'; document.body.classList.remove('photomode');
  if (this.g.canvas) { this.g.canvas.style.filter = ''; }
  if (skipped && S.dlg) S.endRadio(); if (g.world !== 'city') g.world = 'city';
  const f = g.foot; if (f && !f.active) { f.toggle(); f.trans = null; }
  if (!S.st.aria && f) { S.st.aria = { x: f.x + Math.sin(f.h) * 2.7, z: f.z + Math.cos(f.h) * 2.7 }; }
  S.st.prologue = 1; S.save(); S.toast('🔓 SBLOCCATA · KAGE GT');
  setTimeout(() => S.radio(), skipped ? 600 : 1500);
};

/* ---------------- per frame ---------------- */
Prologue.prototype.loop = function () {
  if (!this.on) return; requestAnimationFrame(() => this.loop());
  const now = performance.now(), dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now; this.t += dt; this.sceneT = (this.sceneT || 0) + dt; this.msgT -= dt;
  if (this.cur && this.shown < this.cur.length) this.shown = Math.min(this.cur.length, this.shown + dt * 38);
  else if (this.cur && this.lines.length) { this.lineT += dt; if (this.lineT > 2.2) { this.lineT = 0; this.cur = this.lines.shift(); this.shown = 0; } }
  // hints if you're stuck on the console
  if (this.scene === 'con') { this.stuck = (this.stuck || 0) + dt; if (this.stuck > 35 && !this.cur) { this.stuck = 0; this.hint(); } } else this.stuck = 0;
  const s = this.scene;
  if (s === 'vortex' && this.sceneT > 4.6) this.toFuture();
  if (s === 'wake') { this.wakeStep(dt); }
  if (this.cvs.style.display !== 'none') this.draw();
};
Prologue.prototype.hint = function () { const s = this.st;
  const H = !s.plug ? 'Senza corrente non farà niente. La spina del frigo è lì per terra…' : !s.power ? 'C’è un interruttore con scritto ENERGIA.' : !this.yearOk() ? (this.st.notebook ? 'L’anno… l’avevo scritto nel quaderno dei sogni: le pietre contano 2087.' : 'Un anno. Il quaderno dei sogni in camera… forse c’è scritto lì.')
    : s.cr.length < 3 ? 'L’incisione dice: DALL’ALBA ALLA NOTTE. Arancione, azzurro, viola?' : 'La leva. Tirala giù.'; this.say([H]); };
Prologue.prototype.wakeStep = function (dt) {
  const t = this.sceneT, gc = this.g.canvas;
  // eyes: closed → flutter → open; heavy blur that clears; voices around
  const blur = this.rising ? 0 : Math.max(0, 9 - t * 0.9); if (gc) gc.style.filter = blur > 0.2 ? 'blur(' + blur.toFixed(1) + 'px) saturate(' + (0.6 + Math.min(0.4, t * 0.05)) + ')' : '';
  if (t > this.vi * 2.1 + 1.2 && this.vi < VOICES.length && !this.rising) { this.voice(VOICES[this.vi]); this.vi++; }
  if (t > 13 && !this.wakeReady) { this.wakeReady = true; this.say(['…dove sono?', 'Questa non è la mia cucina.', 'Devo alzarmi.']); }
  if (this.rising) { this.riseK = Math.min(1, this.riseK + dt / 2.4); if (this.riseK > 0.35) this.hide = false; if (this.riseK >= 1) { this.rising = false; this.talk(); } }
};
Prologue.prototype.voice = function (s) {
  this.vfx = this.vfx || []; this.vfx.push({ s, t: 0, x: 0.2 + Math.random() * 0.6, y: 0.25 + Math.random() * 0.45 });
  try { if (window.speechSynthesis && speechSynthesis.getVoices().length) { const u = new SpeechSynthesisUtterance(s.replace(/…/g, ' ')); u.lang = 'it-IT'; u.rate = 0.8; u.pitch = 0.6 + Math.random() * 0.8; u.volume = 0.5; speechSynthesis.speak(u); return; } } catch (e) { }
  // no speech voices (Android WebView): a muffled murmur
  const A = this.au(); if (A) for (let k = 0; k < 6; k++) setTimeout(() => A.blip(150 + Math.random() * 120, 120 + Math.random() * 80, 0.12, 0.05, 'triangle'), k * 120);
};

/* ---------------- drawing ---------------- */
Prologue.prototype.draw = function () {
  const c = this.cvs.getContext('2d'), W = this.cvs.width, H = this.cvs.height, s = this.scene, t = this.t;
  if (s === 'wake') { c.clearRect(0, 0, W, H); this.cvs.style.background = 'transparent'; this.cvs.style.pointerEvents = 'auto'; }
  else { this.cvs.style.background = '#000'; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); }
  c.save(); c.translate(this.ox, this.oy); c.scale(this.k, this.k);
  if (s === 'bed') this.drawBed(c, t); else if (s === 'kit') this.drawKitchen(c, t); else if (s === 'con') this.drawConsole(c, t); else if (s === 'vortex') this.drawVortex(c, t);
  if (this.zoom === 'phone') this.drawPhoneZoom(c, t); if (this.zoom === 'notebook') this.drawNotebook(c);
  c.restore();
  // eyelids (wake up in the bedroom and in the future)
  const lid = s === 'bed' ? this.lidK(this.sceneT || this.t) : s === 'wake' ? this.lidK(this.sceneT * 0.55) : 1;
  if (lid < 1) { c.fillStyle = '#000'; const h = H * 0.5 * (1 - lid); c.beginPath(); c.ellipse(W / 2, -H * 0.1 + h * 0.2, W * 0.9, h + H * 0.05, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(W / 2, H * 1.1 - h * 0.2, W * 0.9, h + H * 0.05, 0, 0, TAU); c.fill(); }
  if (s === 'wake') { const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.hypot(W, H) * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + Math.max(0.2, 0.9 - this.sceneT * 0.05) + ')'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (const v of this.vfx || []) { v.t += 1 / 60; const a = Math.max(0, Math.min(1, v.t * 1.5) * (1 - v.t / 4)); if (a <= 0) continue; c.globalAlpha = a * 0.8; c.font = 'italic ' + Math.round(H * 0.032) + 'px Georgia,serif'; c.fillStyle = '#dfefff'; c.textAlign = 'center'; c.fillText(v.s, W * v.x, H * v.y - v.t * H * 0.01); c.globalAlpha = 1; }
    if (this.wakeReady && !this.rising) { c.textAlign = 'center'; c.font = '600 ' + Math.round(H * 0.03) + 'px system-ui'; c.fillStyle = 'rgba(255,255,255,' + (0.55 + 0.45 * Math.sin(t * 3)) + ')'; c.fillText('tocca per alzarti', W / 2, H * 0.84); } }
  // inner thoughts
  if (this.cur) { const txt = this.cur.slice(0, Math.floor(this.shown)); c.textAlign = 'center'; c.font = 'italic ' + Math.round(H * 0.036) + 'px Georgia,serif'; const w = Math.min(W * 0.9, c.measureText(this.cur).width + H * 0.06);
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(W / 2 - w / 2, H * 0.86, w, H * 0.075); c.fillStyle = '#f4ecdc'; c.fillText(txt, W / 2, H * 0.91); }
  if (this.msgT > 0) { c.textAlign = 'center'; c.font = 'bold ' + Math.round(H * 0.03) + 'px monospace'; c.fillStyle = '#ff7060'; c.fillText(this.msg, W / 2, H * 0.08); }
  c.textAlign = 'left';
};
Prologue.prototype.lidK = function (t) { if (t < 0.6) return 0; if (t < 2) return (t - 0.6) / 1.4 * 0.5; if (t < 2.3) return 0.15; if (t < 3.2) return 0.15 + (t - 2.3) / 0.9 * 0.7; if (t < 3.4) return 0.3; return Math.min(1, 0.3 + (t - 3.4) / 1.2 * 0.7); };
function roomLight(c, x, y, r, col) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
Prologue.prototype.drawBed = function (c, t) {
  // wall + floor
  let g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#2b2f48'); g.addColorStop(1, '#433b55'); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  c.fillStyle = '#2a2430'; c.fillRect(0, 760, VW, 140);
  // window at dawn with the rooftops and a dome
  g = c.createLinearGradient(0, 120, 0, 560); g.addColorStop(0, '#5a6fb0'); g.addColorStop(0.55, '#f2a07a'); g.addColorStop(1, '#ffd59a'); c.fillStyle = g; c.fillRect(1060, 120, 400, 440);
  c.fillStyle = '#1d1a26'; for (let i = 0; i < 9; i++) { const x = 1060 + i * 46, h = 60 + ((i * 37) % 70); c.fillRect(x, 560 - h, 44, h); } c.beginPath(); c.arc(1300, 470, 55, PI, 0); c.fill(); c.fillRect(1296, 395, 8, 24);
  c.strokeStyle = '#d9d2c4'; c.lineWidth = 14; c.strokeRect(1060, 120, 400, 440); c.lineWidth = 6; c.beginPath(); c.moveTo(1260, 120); c.lineTo(1260, 560); c.moveTo(1060, 340); c.lineTo(1460, 340); c.stroke();
  roomLight(c, 1260, 380, 700, 'rgba(255,190,140,0.22)');
  // a framed drawing (a car, drawn as a kid)
  c.fillStyle = '#d8cfba'; c.fillRect(420, 170, 230, 160); c.fillStyle = '#f4efe2'; c.fillRect(434, 184, 202, 132); c.strokeStyle = '#d63a6a'; c.lineWidth = 5; c.beginPath(); c.moveTo(460, 280); c.lineTo(500, 245); c.lineTo(590, 245); c.lineTo(615, 280); c.closePath(); c.stroke(); c.beginPath(); c.arc(495, 285, 12, 0, TAU); c.arc(585, 285, 12, 0, TAU); c.stroke();
  // door
  c.fillStyle = '#5b4636'; c.fillRect(60, 140, 220, 640); c.fillStyle = '#4a382c'; c.fillRect(85, 170, 170, 250); c.fillRect(85, 450, 170, 300); c.fillStyle = '#d6b36a'; c.beginPath(); c.arc(240, 470, 10, 0, TAU); c.fill();
  // bed
  c.fillStyle = '#3b2e2a'; c.fillRect(330, 560, 470, 220); c.fillStyle = '#e9e4da'; c.fillRect(350, 520, 200, 70);
  g = c.createLinearGradient(330, 560, 800, 800); g.addColorStop(0, '#4f64a0'); g.addColorStop(1, '#36457a'); c.fillStyle = g; c.beginPath(); c.moveTo(330, 600); c.quadraticCurveTo(560, 540, 820, 610); c.lineTo(840, 800); c.lineTo(300, 800); c.closePath(); c.fill();
  // nightstand, notebook and phone
  c.fillStyle = '#5a4433'; c.fillRect(690, 660, 300, 140); c.fillStyle = '#6b5240'; c.fillRect(680, 650, 320, 18);
  c.fillStyle = '#efe6cf'; c.fillRect(705, 640, 120, 16); c.fillStyle = '#9b2d2d'; c.fillRect(705, 652, 120, 4);
  const ph = 0.6 + 0.4 * Math.sin(t * 6) * (this.st.phone ? 0 : 1); c.fillStyle = '#111'; c.fillRect(865, 628, 100, 26); c.fillStyle = 'rgba(120,200,255,' + ph + ')'; c.fillRect(870, 631, 90, 20);
  if (!this.st.phone) roomLight(c, 915, 640, 90, 'rgba(120,200,255,' + 0.35 * ph + ')');
  // arrow hints
  c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '22px system-ui'; c.textAlign = 'center'; if (this.st.phone) c.fillText('➜ cucina', 170, 120);
};
Prologue.prototype.drawPhoneZoom = function (c, t) {
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, VW, VH); c.fillStyle = '#0c0d12'; this.rr(c, 610, 60, 380, 760, 46); c.fill(); c.fillStyle = '#121a2c'; this.rr(c, 625, 80, 350, 720, 36); c.fill();
  const d = new Date(); c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '200 96px system-ui'; c.fillText(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), 800, 250);
  c.font = '24px system-ui'; c.fillStyle = '#c8d4ff'; c.fillText(d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }), 800, 290);
  c.fillStyle = 'rgba(255,255,255,.1)'; this.rr(c, 650, 360, 300, 170, 22); c.fill(); c.textAlign = 'left'; c.fillStyle = '#9fd8ff'; c.font = 'bold 20px system-ui'; c.fillText('📡  Segnale sconosciuto', 672, 395); c.fillStyle = '#e8eefc'; c.font = '16px system-ui'; c.fillText('ora · mittente non identificato', 672, 420);
  if (KF && KF.glyphStrokes) for (let i = 0; i < 7; i++) this.glyph2d(c, KF.glyphStrokes(((i * 5 + 2) % 21) * 7 + 3), 690 + i * 37, 480, 28, 'rgba(120,255,210,' + (0.6 + 0.4 * Math.sin(t * 4 + i)) + ')');
  c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '18px system-ui'; c.fillText('tocca per chiudere', 800, 770);
};
Prologue.prototype.drawNotebook = function (c) {
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, VW, VH); c.fillStyle = '#f1e8d0'; c.fillRect(380, 90, 840, 700); c.strokeStyle = '#c9bea2'; c.lineWidth = 2; for (let y = 170; y < 760; y += 44) { c.beginPath(); c.moveTo(420, y); c.lineTo(1180, y); c.stroke(); }
  c.fillStyle = '#2d3a7a'; c.font = 'italic 34px "Segoe Script","Bradley Hand",cursive'; c.textAlign = 'left';
  ['Quaderno dei sogni', '', 'Le pietre parlano. Mi chiamano per nome.', 'Contano un anno, sempre lo stesso: 2 0 8 7.', 'Una cabina d’ottone che ronza.', 'Una voce: «dall’alba alla notte».', 'E una città di luci che non ho mai visto.'].forEach((s, i) => c.fillText(s, 430, 160 + i * 88));
  c.textAlign = 'center'; c.font = '18px system-ui'; c.fillStyle = 'rgba(0,0,0,.45)'; c.fillText('tocca per chiudere', 800, 770);
};
Prologue.prototype.drawKitchen = function (c, t) {
  let g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#e9e2d3'); g.addColorStop(1, '#cfc4ad'); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 2; for (let x = 0; x < VW; x += 60) { c.beginPath(); c.moveTo(x, 300); c.lineTo(x, 470); c.stroke(); } for (let y = 300; y <= 470; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(1060, y); c.stroke(); }
  c.fillStyle = '#8f7a63'; c.fillRect(0, 800, VW, 100);
  // doorway back to the bedroom
  c.fillStyle = '#3a3040'; c.fillRect(40, 120, 160, 680); c.fillStyle = 'rgba(255,255,255,.4)'; c.font = '22px system-ui'; c.textAlign = 'center'; c.fillText('◀ camera', 120, 100);
  // small window with morning light
  g = c.createLinearGradient(0, 90, 0, 270); g.addColorStop(0, '#9cc0ff'); g.addColorStop(1, '#ffe0b0'); c.fillStyle = g; c.fillRect(260, 90, 260, 180); c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(260, 90, 260, 180);
  // counter, stove, moka, cup, a plate with a croissant
  c.fillStyle = '#5c6b74'; c.fillRect(220, 600, 840, 200); c.fillStyle = '#e8e8e8'; c.fillRect(210, 585, 860, 22); c.fillStyle = '#2a2a2a'; c.fillRect(380, 560, 170, 26);
  c.fillStyle = '#b9b9c2'; c.beginPath(); c.moveTo(420, 560); c.lineTo(500, 560); c.lineTo(490, 500); c.lineTo(470, 490); c.lineTo(450, 490); c.lineTo(430, 500); c.closePath(); c.fill(); c.fillStyle = '#222'; c.fillRect(498, 515, 20, 10);
  if (this.st.coffee) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(460 + k * 10, 485); c.bezierCurveTo(450 + k * 10 + Math.sin(t * 2 + k) * 10, 450, 475 + k * 10, 430, 460 + k * 10, 400); c.stroke(); } }
  c.fillStyle = '#fff'; c.fillRect(640, 548, 50, 40); c.fillStyle = '#f0f0f0'; c.beginPath(); c.ellipse(820, 585, 80, 14, 0, 0, TAU); c.fill(); c.fillStyle = '#d99a4a'; c.beginPath(); c.ellipse(820, 570, 52, 18, 0.1, 0, TAU); c.fill();
  // the fridge niche… with the EPOCH in it
  c.fillStyle = '#b8ab92'; c.fillRect(1050, 60, 400, 760);
  this.drawCabin(c, 1080, 70, 340, 740, t);
  c.fillStyle = '#1a1a1a'; c.lineWidth = 6; c.strokeStyle = '#222'; c.beginPath(); c.moveTo(1460, 700); c.bezierCurveTo(1500, 760, 1420, 790, 1380, 800); c.stroke();   // the fridge's plug
};
Prologue.prototype.drawCabin = function (c, x, y, w, h, t) {
  const cx = x + w / 2; roomLight(c, cx, y + h * 0.5, w * 1.3, 'rgba(255,170,60,' + (0.25 + 0.08 * Math.sin(t * 2)) + ')');
  const brass = c.createLinearGradient(x, 0, x + w, 0); brass.addColorStop(0, '#6b4a1c'); brass.addColorStop(0.3, '#d6a64a'); brass.addColorStop(0.55, '#f2cf7a'); brass.addColorStop(1, '#7a5520'); c.fillStyle = brass;
  c.fillRect(x, y + h - 60, w, 60); c.fillRect(x + 10, y + 110, w - 20, 30);
  for (const f of [0, 0.33, 0.66, 1]) c.fillRect(x + f * (w - 24), y + 130, 24, h - 190);
  // glass with a swirling amber light inside
  for (let i = 0; i < 3; i++) { const gx = x + 24 + i * (w - 48) / 3 + 4, gw = (w - 48) / 3 - 8; const gg = c.createLinearGradient(0, y + 140, 0, y + h - 60); gg.addColorStop(0, 'rgba(255,200,120,.35)'); gg.addColorStop(1, 'rgba(120,60,20,.5)'); c.fillStyle = gg; c.fillRect(gx, y + 140, gw, h - 200);
    c.strokeStyle = 'rgba(255,230,170,.5)'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 40; k++) { const a = t * 1.5 + k * 0.35 + i, r = 6 + k * 0.9; c.lineTo(gx + gw / 2 + Math.cos(a) * r * 0.6, y + h * 0.5 + Math.sin(a) * r * 1.2); } c.stroke(); }
  // dome, clock face, lantern
  c.fillStyle = brass; c.beginPath(); c.moveTo(x, y + 112); c.quadraticCurveTo(cx, y - 30, x + w, y + 112); c.closePath(); c.fill();
  c.fillStyle = '#f4ead0'; c.beginPath(); c.arc(cx, y + 70, 26, 0, TAU); c.fill(); c.strokeStyle = '#3a2a12'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, y + 70); c.lineTo(cx + Math.sin(t) * 18, y + 70 - Math.cos(t) * 18); c.moveTo(cx, y + 70); c.lineTo(cx + Math.sin(t / 12) * 12, y + 70 - Math.cos(t / 12) * 12); c.stroke();
  c.fillStyle = 'rgba(255,190,90,' + (0.6 + 0.4 * Math.sin(t * 5)) + ')'; c.beginPath(); c.arc(cx, y + 6, 9, 0, TAU); c.fill();
  // side console panel (what you tap)
  c.fillStyle = '#3a2a14'; c.fillRect(x + w - 70, y + 300, 54, 150); for (let k = 0; k < 6; k++) { c.fillStyle = ['#ff9a3c', '#46d6ff', '#a36bff', '#7cff6b'][k % 4]; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + k); c.beginPath(); c.arc(x + w - 43, y + 320 + k * 22, 6, 0, TAU); c.fill(); } c.globalAlpha = 1;
};
Prologue.prototype.rr = function (c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
Prologue.prototype.glyph2d = function (c, G, cx, cy, size, col) { const u = size / 3; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(2, size * 0.09); c.lineCap = 'round'; c.beginPath(); for (const [ax, ay, bx, by] of G.segs) { c.moveTo(cx + (ax - 1) * u, cy - (ay - 1.5) * u); c.lineTo(cx + (bx - 1) * u, cy - (by - 1.5) * u); } c.stroke(); if (G.dot) c.fillRect(cx - u * 0.25, cy - (G.dot[1] - 1.5) * u - u * 0.25, u * 0.5, u * 0.5); };
Prologue.prototype.drawConsole = function (c, t) {
  const st = this.st, brass = c.createLinearGradient(0, 0, VW, VH); brass.addColorStop(0, '#4a3212'); brass.addColorStop(0.45, '#a87a32'); brass.addColorStop(0.6, '#c99a48'); brass.addColorStop(1, '#3e2a10');
  c.fillStyle = brass; c.fillRect(0, 0, VW, VH); c.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 60; x < VW; x += 220) for (const y of [30, 870]) { c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '24px system-ui'; c.textAlign = 'left'; c.fillText('◀ cucina', 40, 80);
  c.fillStyle = '#2a1c0a'; c.font = 'bold 26px Georgia,serif'; c.textAlign = 'center'; c.fillText('KAGE EPOCH · REGOLATORE CRONOTONICO', 800, 60);
  // display
  c.fillStyle = '#071407'; this.rr(c, 500, 100, 600, 200, 14); c.fill(); c.strokeStyle = '#2a1c0a'; c.lineWidth = 8; c.stroke();
  c.font = '28px monospace'; c.fillStyle = st.power ? '#7dff9a' : '#173a1c'; c.textAlign = 'left';
  const yr = st.year.join(''), L = !st.plug ? ['NESSUNA CORRENTE'] : !st.power ? ['IN ATTESA · ENERGIA OFF'] : ['SISTEMA PRONTO', 'ANNO DESTINAZIONE  ' + yr + (this.yearOk() ? '  ✓ STABILE' : '  · INSTABILE'), 'CRISTALLI  ' + ORDER.map((k, i) => st.cr[i] ? '◆' : '◇').join(' '), this.ready() ? '>> TIRA LA LEVA <<' : ''];
  L.forEach((s, i) => { if (st.power && !this.yearOk() && i === 1) c.fillStyle = Math.sin(t * 12) > 0 ? '#ffd27a' : '#7dff9a'; else if (st.power) c.fillStyle = '#7dff9a'; c.fillText(s, 530, 150 + i * 40 + (st.power && !this.yearOk() ? Math.sin(t * 30) * 1.5 : 0)); });
  // year rollers
  for (let i = 0; i < 4; i++) { const x = 560 + i * 125; c.fillStyle = '#2a1c0a'; this.rr(c, x, 330, 100, 60, 10); c.fill(); this.rr(c, x, 500, 100, 60, 10); c.fill(); c.fillStyle = '#e9c77a'; c.font = '30px system-ui'; c.textAlign = 'center'; c.fillText('▲', x + 50, 372); c.fillText('▼', x + 50, 542);
    c.fillStyle = '#f4ead0'; this.rr(c, x + 8, 398, 84, 96, 8); c.fill(); c.fillStyle = '#2a1c0a'; c.font = 'bold 64px Georgia,serif'; c.fillText(st.year[i], x + 50, 470); }
  // crystals (engraving: from dawn to night)
  c.fillStyle = 'rgba(40,25,8,.7)'; c.font = 'italic 22px Georgia,serif'; c.fillText('— dall’alba alla notte —', 800, 790);
  for (const C of CRYST) { const lit = st.cr.includes(C.k); c.fillStyle = '#2a1c0a'; c.beginPath(); c.arc(C.x, 690, 64, 0, TAU); c.fill(); roomLight(c, C.x, 690, lit ? 130 : 70, lit ? C.c + 'cc' : C.c + '33');
    c.fillStyle = lit ? C.c : C.c + '66'; c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * (lit ? 1 : 0.2); c.lineTo(C.x + Math.cos(a) * 44, 690 + Math.sin(a) * 44); } c.closePath(); c.fill(); }
  // power: socket, plug and cable; main switch
  c.fillStyle = '#e8e2d2'; this.rr(c, 170, 660, 120, 120, 14); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(210, 720, 8, 0, TAU); c.arc(250, 720, 8, 0, TAU); c.fill();
  c.strokeStyle = '#111'; c.lineWidth = 10; c.beginPath(); if (st.plug) { c.moveTo(230, 720); c.bezierCurveTo(260, 830, 420, 860, 520, 900); } else { c.moveTo(340, 800); c.bezierCurveTo(400, 850, 460, 870, 520, 900); } c.stroke();
  c.fillStyle = '#1c1c1c'; if (st.plug) this.rr(c, 205, 698, 50, 44, 8); else this.rr(c, 315, 778, 54, 44, 8); c.fill(); if (!st.plug) { c.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(t * 4)) + ')'; c.font = '20px system-ui'; c.fillText('spina', 342, 760); }
  c.fillStyle = '#2a1c0a'; this.rr(c, 200, 280, 140, 220, 16); c.fill(); c.fillStyle = st.power ? '#7dff9a' : '#552'; c.beginPath(); c.arc(270, 310, 9, 0, TAU); c.fill();
  c.fillStyle = '#d8d0b8'; this.rr(c, 245, st.power ? 340 : 410, 50, 70, 10); c.fill(); c.fillStyle = '#e9c77a'; c.font = 'bold 20px system-ui'; c.fillText('ENERGIA', 270, 530);
  // lever
  c.fillStyle = '#2a1c0a'; this.rr(c, 1290, 220, 40, 480, 16); c.fill(); const ly = 240 + st.lever * 420; c.strokeStyle = '#9a9a9a'; c.lineWidth = 16; c.beginPath(); c.moveTo(1310, 460); c.lineTo(1310, ly); c.stroke();
  c.fillStyle = this.ready() ? '#ff5a3c' : '#7a2a1c'; c.beginPath(); c.arc(1310, ly, 40, 0, TAU); c.fill(); if (this.ready()) { roomLight(c, 1310, ly, 120, 'rgba(255,90,60,' + (0.3 + 0.2 * Math.sin(t * 5)) + ')'); c.fillStyle = '#fff'; c.font = '20px system-ui'; c.fillText('trascina giù', 1310, 740); }
};
Prologue.prototype.drawVortex = function (c, t) {
  const T = this.sceneT; c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 80; i++) { const a = i * 2.39 + T * (1 + i % 3) * 0.6, r = ((i * 37) % 400 + T * 180 * (1 + (i % 5) * 0.2)) % 700, x = 800 + Math.cos(a) * r, y = 450 + Math.sin(a) * r * 0.6;
    if (KF && KF.glyphStrokes) this.glyph2d(c, KF.glyphStrokes((i % 21) * 7 + 3), x, y, 10 + r * 0.08, 'hsla(' + (30 + (i * 17) % 260) + ',90%,65%,' + Math.min(1, r / 200) + ')'); }
  roomLight(c, 800, 450, 300 + T * 120, 'rgba(255,220,160,' + Math.min(1, T / 4) + ')');
  if (T > 3.8) { c.fillStyle = 'rgba(255,255,255,' + Math.min(1, (T - 3.8) / 0.6) + ')'; c.fillRect(0, 0, VW, VH); }
  if (!this.whispers || T > this.whispers * 1.2) { this.whispers = (this.whispers || 0) + 1; if (this.whispers < 4) this.voice(['…pilota…', '…ti stavamo aspettando…', '…dall’alba alla notte…'][this.whispers - 1]); }
};

window.KagePrologue = Prologue; window.KageAriaLook = ARIA;
})();
