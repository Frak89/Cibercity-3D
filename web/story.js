/* IL SEGNALE DEI CUSTODI · the story campaign that ties Cybercity together. Eight chapters; each objective is checked from the
 * real state of the game (monoliths read and deciphered, KAGE TECH repairs, the badge, the ODYSSEY, warp to the colony, the
 * EPOCH and the past, the NEXUS and ECO). VEGA, the ODYSSEY's science officer (original character), talks to you over the
 * radio between chapters. HUD: current objective + a waypoint arrow with the distance; the tablet has the journal (📜 Missioni)
 * and the Map shows the target. Progress in localStorage. */
(function () {
'use strict';
const NR = window.NeonRun, KF = window.KageFleet; if (!NR) return;
const { S, GP, wrapD } = NR, PI = Math.PI;
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
// the meadow of the past (chapter VII): the camp of the First People, the stone circle where the seed sleeps, the wreck
const CAMP = { x: 72, z: 96 }, CIRCLE = { x: 150, z: 160 }, WRECK = { x: 196, z: 92 }, SEED = { x: 150, z: 160 };
const GUIDES = [0, 3, 6].map(k => { const a = k / 9 * PI * 2; return [CIRCLE.x + Math.sin(a) * 9, CIRCLE.z + Math.cos(a) * 9]; });
const ELDER_LINES = ['Sei arrivato da dentro la cabina che canta. Come dicevano le pietre.', 'Noi siamo i Primi. Custodiamo il seme da quando i Custodi caddero dal cielo, laggiù, oltre la collina.',
  'Il seme dorme nel cerchio di pietre. Per svegliarlo devi accendere le tre pietre-guida: quelle che guardano l’alba, il giorno e la notte.', 'Segui i cervi: sanno sempre dov’è il cerchio. Vai, viaggiatore.'];
// vehicles, gear and places unlocked by the campaign: chapters completed (st.ch) needed
const UNLOCK = { moto: 1, skate: 1, hover: 2, drone: 3, jet: 3, odyssey: 3, boat: 5, sub: 5, galleon: 6, epoch: 6, nexus: 7, ufo: 8 };
const UNAME = { moto: 'KAGE VOLT', skate: 'SKATEBOARD', hover: 'KAGE GLIDE', drone: 'KAGE STRIX', jet: 'JETPACK', odyssey: 'KAGE ODYSSEY', boat: 'KAGE RIPTIDE', sub: 'KAGE ABYSS', galleon: 'KAGE LEVIATHAN', epoch: 'KAGE EPOCH', nexus: 'KAGE NEXUS', ufo: 'KAGE XENO' };
const mat = (c, e, slot, mode, a) => ({ c, e: e || 0, slot: slot || 0, mode: mode || 0, a: a || [0, 0, 0] });

/* ---------------- the campaign ---------------- */
function chapters(S0) {
  const g = S0.g, f = () => g.foot, M = () => g.mono, T = () => g.tech, Y = () => g.star;
  const mono = id => { const m = M(); return m ? m.spots.find(s => s.id === id) : null; }, at = id => () => { const s = mono(id); return s && !s.site && s.deck === undefined ? [s.x, s.z] : null; };
  const read = id => () => !!(M() && M().st.read.includes(id)), solvedAny = () => !!(M() && M().st.solved.some(i => i[0] === 'm'));
  const near = (P, r) => { const p = f(); return g.world === 'meadow' && !!p && p.active && Math.hypot(wrapD(p.x - P.x), wrapD(p.z - P.z)) < r; };
  const aboard = () => { const p = f(); return !!(p && (p.ss === 'in' || p.ss === 'helm')); };
  return [
    { id: 'c1', title: 'CAPITOLO I · LE PIETRE', radio: ['Pilota, mi senti? Sono VEGA, ufficiale scientifica della KAGE ODYSSEY. ARIA mi dice che ti sei svegliato.', 'So che è tutto strano. Ma quello che hai sognato è vero: le pietre esistono, e trasmettono.', 'Prendi il tablet e vai a guardare il monolite qui vicino. Ti guido io.'],
      obj: [{ id: 'foot', t: 'Alzati e muoviti (joystick / WASD)', done: () => !!(f() && f().active) },
        { id: 'tab', t: 'Apri il tablet AmpybiOS (U / 📱 TABLET)', done: () => !!(g.aos && g.aos.isOpen) || S0.flag('tab') },
        { id: 'm1', t: 'Leggi il Monolite I', done: read('m1'), at: at('m1') }] },
    { id: 'c2', title: 'CAPITOLO II · LA VOCE DEI CUSTODI', radio: ['Quei segni… sono gli stessi glifi del portale NEXUS. Non è un caso.', 'Ogni monolite ti regala qualche lettera sicura. Leggine altri due, poi prova a decifrare un’intera iscrizione.', 'Tocca un glifo e scegli la lettera. Le parole corte aiutano: «I», «DEL», «LA»…'],
      obj: [{ id: 'm2', t: 'Leggi il Monolite II (vicino al NEXUS)', done: read('m2'), at: at('m2') },
        { id: 'm3', t: 'Leggi il Monolite III (davanti al garage)', done: read('m3'), at: at('m3') },
        { id: 'dec', t: 'Decifra un’iscrizione completa', done: solvedAny }] },
    { id: 'c3', title: 'CAPITOLO III · IL GUASTO', radio: ['Ottimo lavoro. Ma ho una cattiva notizia: il segnale sta disturbando le centraline di mezza città.', 'Anche la tua KAGE GT segnala un guasto. Usa KAGE TECH: DIAG trova il codice, il MANUALE ti dice la procedura.', 'Se non ripariamo i nostri mezzi non arriveremo mai alla fonte del segnale.'],
      start: s => { s.base.fixed = T() ? T().st.fixed : 0; },
      obj: [{ id: 'diag', t: 'Collegati alla KAGE GT con KAGE TECH', done: () => !!(T() && T().cur && T().cur.id === 'gt') || S0.flag('gt'), at: () => [g.c.x, g.c.z] },
        { id: 'fix', t: 'Ripara un guasto (DIAG → MANUALE → CONSOLE)', done: () => !!(T() && T().st.fixed > (S0.st.base.fixed || 0)) }] },
    { id: 'c4', title: 'CAPITOLO IV · LA NAVE SOPRA LE NUVOLE', radio: ['La terza iscrizione diceva: «cercate la nave sopra le nuvole». Parlano di noi. Della ODYSSEY.', 'Nel KAGE GARAGE c’è il modellino della nave con il tuo badge. Indossalo e premi BEAM IN.', 'Ti aspetto in plancia, capitano.'],
      obj: [{ id: 'badge', t: 'Prendi il badge dal modellino nel garage', done: () => !!(Y() && Y().badge), at: () => [24, 54] },
        { id: 'beam', t: 'Teletrasportati a bordo (✦ BEAM IN)', done: aboard },
        { id: 'helm', t: 'Siediti al posto del capitano (ponte 1)', done: () => !!(f() && f().ss === 'helm') }] },
    { id: 'c5', title: 'CAPITOLO V · IL NUCLEO', radio: ['Benvenuto a bordo. Brutte notizie dall’ingegneria: il segnale ha aperto una perdita nel circuito del nucleo warp.', 'Scendi al ponte 5 con l’ascensore e riparalo con KAGE TECH. Senza nucleo niente warp.', 'Mentre ci sei, dai un’occhiata alle capsule di stasi. Uno dei nostri ospiti parla la lingua dei Custodi.'],
      obj: [{ id: 'deck5', t: 'Scendi al ponte 5 · ingegneria', done: () => !!(f() && f().ss === 'in' && f().deck === 4) },
        { id: 'core', t: 'Ripara il nucleo warp (KAGE TECH · KAGE ODYSSEY)', done: () => !!(T() && !(T().st.faults.odyssey || []).length) },
        { id: 'pod', t: 'Risveglia un ospite della stasi', done: () => !!(Y() && Y().wake) || S0.flag('pod') }] },
    { id: 'c6', title: 'CAPITOLO VI · UN MONDO SENZA SOLE', radio: ['Il nucleo è stabile. Ho triangolato il segnale: viene dalla colonia aliena ZHAR’UL, a 37 anni luce.', 'Imposta la rotta all’Astrolab o dalla plancia, vai in curvatura e scendi sul pianeta col teletrasporto.', 'Laggiù c’è un monolite. «Noi veniamo da un mondo senza sole»… forse è casa loro.'],
      obj: [{ id: 'warp', t: 'Vai in curvatura verso la colonia aliena', done: () => !!(Y() && (Y().ship.loc === 'colonia' || (Y().ship.travel && Y().ship.travel.to === 'colonia'))) },
        { id: 'land', t: 'Scendi sulla colonia (teletrasporto)', done: () => !!(Y() && f() && f().ss === 'planet' && Y().site === 'colonia') },
        { id: 'm8', t: 'Leggi il Monolite VIII della colonia', done: read('m8') }] },
    { id: 'c7', title: 'CAPITOLO VII · LA PRATERIA DEI PRIMI', radio: ['«Su questo mondo dorme il primo seme». Ma il seme non è qui… è stato portato sulla Terra, migliaia di anni fa.', 'Torna a Cybercity. Nel garage c’è l’EPOCH, la stessa cabina che ti ha portato qui: ora può riportarti indietro, al tempo dei Primi.', 'Lì qualcuno ti aspetta. Cerca il loro accampamento.'],
      obj: [{ id: 'home', t: 'Torna a Cybercity (BEAM IN dalla colonia, poi teletrasporto in città)', done: () => g.world === 'city' && !!(f() && f().active && !f().ss) },
        { id: 'past', t: 'Viaggia nel passato con l’EPOCH (nel garage)', done: () => g.world === 'meadow', at: () => g.world === 'city' ? [30, 27] : null },
        { id: 'camp', t: 'Raggiungi l’accampamento dei Primi', done: () => near(CAMP, 9), at: () => g.world === 'meadow' ? [CAMP.x, CAMP.z] : null },
        { id: 'elder', t: 'Parla con l’Anziana vicino al fuoco', done: () => !!S0.st.elder, at: () => g.world === 'meadow' ? [CAMP.x + 3, CAMP.z + 1.5] : null },
        { id: 'circle', t: 'Segui i cervi fino al cerchio di pietre', done: () => near(CIRCLE, 12), at: () => g.world === 'meadow' ? [CIRCLE.x, CIRCLE.z] : null },
        { id: 'guides', t: 'Accendi le tre pietre-guida (avvicinati a ciascuna)', done: () => (S0.st.lit || []).length >= 3, at: () => { if (g.world !== 'meadow') return null; const i = [0, 1, 2].find(k => !(S0.st.lit || []).includes(k)); return i === undefined ? null : GUIDES[i]; } },
        { id: 'seed', t: 'Prendi il seme dei Custodi sull’altare', done: () => !!S0.st.seed, at: () => g.world === 'meadow' ? [SEED.x, SEED.z] : null }] },
    { id: 'c8', title: 'CAPITOLO VIII · OLTRE ECO', radio: ['Ce l’hai! Senti come pulsa? Vuole tornare a casa.', 'Torna al presente e porta il seme al portale NEXUS. Componi la sequenza e attraversalo.', '«Oltre ECO la città sogna se stessa»… è lì che i Custodi ci aspettano.'],
      obj: [{ id: 'now', t: 'Torna al presente con l’EPOCH', done: () => g.world === 'city' || g.world === 'eco' },
        { id: 'dial', t: 'Componi la sequenza al NEXUS (N / 🌀)', done: () => !!(g.nexus && g.nexus.st !== 'idle') || g.world === 'eco', at: () => [4 * GP - 7.5, 2 * GP + 14] },
        { id: 'eco', t: 'Attraversa il portale ed entra in ECO con il seme', done: () => g.world === 'eco' }] }];
}
const EPILOGUE = ['Pilota… il seme si è aperto. ECO si sta illuminando.', 'Ricevo un messaggio. È la lingua dei Custodi, ma ora la capisco tutta: «CHI LEGGE QUESTE PAROLE È GIÀ UNO DI NOI».', 'Ti hanno lasciato un regalo: l’alfabeto completo. Ogni monolite ora è leggibile. Grazie, capitano. — VEGA, KAGE ODYSSEY'];

function Story(game) {
  this.g = game; this.t = 0; this.toastT = 0; this.toastS = ''; this.dlg = null;
  try { this.st = JSON.parse(LS.get('kageStory', '{}')); } catch (e) { this.st = {}; }
  const st = this.st; st.ch = st.ch || 0; st.done = st.done || {}; st.base = st.base || {}; st.flags = st.flags || {}; st.seen = st.seen || {};
  this.C = chapters(this); this.buildUI(); this.meshes = {};
  const q = new URLSearchParams(location.search);
  if (q.has('new')) { const free = this.st.free; this.st = { ch: 0, done: {}, base: {}, flags: {}, seen: {}, free }; this.save(); }
  if (!this.st.prologue && (this.st.ch > 0 || Object.keys(this.st.done || {}).length)) { this.st.prologue = 1; this.save(); }   // saves from before the prologue
  this.gates();
  this.pro = window.KagePrologue ? new KagePrologue(game, this) : null;
  this.cuts = window.KageCuts ? new KageCuts(game) : null;   // illustrated scenes between chapters (web/cutscenes.js)
  if (q.has('shot')) return;
  setTimeout(() => { if (!this.st.prologue && this.pro) this.pro.start(); else if (!this.finished() && !this.st.seen[this.cur().id]) this.radio(); }, 1200);
}
/** is a vehicle / gear / place unlocked by the campaign? */
Story.prototype.can = function (k) { if (this.st.free || UNLOCK[k] === undefined) return true; if (!this.st.prologue) return false; return this.st.ch >= UNLOCK[k]; };
Story.prototype.lockMsg = function (k) { const n = UNLOCK[k]; return '🔒 ' + (UNAME[k] || k.toUpperCase()) + ' · si sblocca ' + (n >= this.C.length ? 'alla fine della campagna' : 'nel ' + (this.C[n] ? this.C[n].title.split(' · ')[0] : 'seguito')); };
Story.prototype.lockSay = function (k) { this.toast(this.lockMsg(k)); if (window.FleetAudio) { if (!this.au) this.au = new FleetAudio(); this.au.start(); this.au.blip(220, 160, 0.2, 0.08, 'square'); } };
/** wrap the actions that use a locked vehicle or place */
Story.prototype.gates = function () {
  const self = this, wrap = (C, name, fn) => { if (C && C.prototype[name]) { const o = C.prototype[name]; C.prototype[name] = function () { return fn.call(this, o, arguments); }; } };
  wrap(window.FleetGame, 'setVehicle', function (o, a) { const k = a[0]; if (k && k !== 'car' && !self.can(k)) { self.lockSay(k); return; } return o.apply(this, a); });
  wrap(window.KageGear, 'toggle', function (o, a) { const k = a[0] === 'jet' ? 'jet' : 'skate', f = this.g.foot; if (f && f.gear !== a[0] && !self.can(k)) { self.lockSay(k); return; } return o.apply(this, a); });
  wrap(window.KageStarGame, 'beamIn', function (o, a) { if (!self.can('odyssey')) { self.lockSay('odyssey'); return; } return o.apply(this, a); });
  wrap(window.KageNexus, 'dial', function (o, a) { if (!self.can('nexus')) { if (this.near) self.lockSay('nexus'); return; } return o.apply(this, a); });
  wrap(window.KageXenoGame, 'enter', function (o, a) { const f = this.g.foot; if (f && f.inEp && !f.xs && !this.tt && !self.can('epoch')) { self.lockSay('epoch'); return true; } return o.apply(this, a); });
};
Story.prototype.unlocks = function (n) { const L = Object.keys(UNLOCK).filter(k => UNLOCK[k] === n); if (L.length && !this.st.free) setTimeout(() => this.toast('🔓 SBLOCCATO · ' + L.map(k => UNAME[k]).join(' · ')), 3600); };
Story.prototype.save = function () { LS.set('kageStory', JSON.stringify(this.st)); };
Story.prototype.flag = function (k, v) { if (v !== undefined) { if (!this.st.flags[k]) { this.st.flags[k] = v; this.save(); } } return !!this.st.flags[k]; };
Story.prototype.cur = function () { return this.C[Math.min(this.st.ch, this.C.length - 1)]; };
Story.prototype.finished = function () { return this.st.ch >= this.C.length; };
const BACK = { id: '_back', t: 'Sei nel passato: torna nell’EPOCH per rientrare a Cybercity', at: () => [30, 27] };
Story.prototype.objective = function () { if (this.g.world === 'meadow' && this.st.ch < 6 && this.st.prologue) return BACK; if (this.finished()) return null; return this.cur().obj.find(o => !this.st.done[o.id]) || null; };
Story.prototype.update = function (dt) {
  this.t += dt; this.toastT = Math.max(0, this.toastT - dt); const g = this.g;
  if (g.aos && g.aos.isOpen) this.flag('tab', 1); if (g.tech && g.tech.cur && g.tech.cur.id === 'gt') this.flag('gt', 1); if (g.star && g.star.wake) this.flag('pod', 1);
  // the meadow of the past: places you discover, the elder, the guide stones, the seed
  if (g.world === 'meadow') { const f = g.foot, p = f && f.active ? f : g.c, d = P => Math.hypot(wrapD(p.x - P.x), wrapD(p.z - P.z)), st = this.st; st.seenM = st.seenM || {};
    for (const [k, P, r, s] of [['camp', CAMP, 14, '⛺ L’ACCAMPAMENTO DEI PRIMI'], ['circle', CIRCLE, 16, '🗿 IL CERCHIO DI PIETRE'], ['wreck', WRECK, 22, '🛸 IL RELITTO DEI CUSTODI · caddero dal cielo, migliaia di anni fa']]) if (!st.seenM[k] && d(P) < r) { st.seenM[k] = 1; this.save(); this.toast(s); this.chime(1); }
    const ch7 = st.ch === 6;
    if (ch7 && !st.elder && f && f.active && d({ x: CAMP.x + 3, z: CAMP.z + 1.5 }) < 2.6 && !this.dlg) { st.elder = 1; this.save(); this.radio(ELDER_LINES, 'L’ANZIANA DEI PRIMI', 'elder'); }
    if (ch7 && st.elder) { st.lit = st.lit || []; GUIDES.forEach((G, i) => { if (!st.lit.includes(i) && d({ x: G[0], z: G[1] }) < 2.2) { st.lit.push(i); this.save(); this.toast('✦ PIETRA-GUIDA ' + ['DELL’ALBA', 'DEL GIORNO', 'DELLA NOTTE'][i] + ' ACCESA (' + st.lit.length + '/3)'); this.chime(3); } }); }
    if (ch7 && (st.lit || []).length >= 3 && !st.seed && d(SEED) < 2.4) { st.seed = 1; this.save(); this.toast('🌱 SEME DEI CUSTODI RACCOLTO'); this.chime(3); } }
  // ARIA at the garage: a word of advice when you walk up to her
  if (this.st.aria && g.world === 'city') { const f = g.foot, A = this.st.aria; if (f && f.active && !f.ss && Math.hypot(wrapD(f.x - A.x), wrapD(f.z - A.z)) < 2.4) { if (!this.ariaNear && !this.dlg && this.st.prologue) { const o = this.objective(); this.radio(['Ciao, pilota.', o ? 'Il tuo prossimo passo: ' + o.t + '.' : 'Hai fatto più di quanto sperassimo. Grazie.'], 'AL GARAGE', 'aria'); } this.ariaNear = true; } else this.ariaNear = false; }
  if ((this.cT = (this.cT || 0) - dt) > 0 || this.finished()) return; this.cT = 0.4;
  const ch = this.cur(); if (ch.start && !this.st.base['_' + ch.id]) { ch.start(this.st); this.st.base['_' + ch.id] = 1; this.save(); }
  let changed = false;
  for (const o of ch.obj) { if (this.st.done[o.id]) continue; let ok = false; try { ok = o.done(); } catch (e) { } if (ok) { this.st.done[o.id] = 1; changed = true; this.toast('✔ ' + o.t); this.chime(1); } else break; }   // in order
  if (changed) this.save();
  if (ch.obj.every(o => this.st.done[o.id])) { this.st.ch++; this.save(); this.chime(2); this.unlocks(this.st.ch);
    const sc = this.cuts && this.cuts.forChapter(this.st.ch);
    if (this.finished()) { this.toast('✦ IL SEGNALE DEI CUSTODI · COMPLETATO ✦'); this.reward(); setTimeout(() => this.radio(EPILOGUE, 'EPILOGO', null, () => { if (sc) this.cuts.play(sc); }), 1800); }
    else { this.toast(ch.title + ' · COMPLETATO'); setTimeout(() => { if (sc) this.cuts.play(sc, () => this.radio()); else this.radio(); }, 1800); } }
};
Story.prototype.reward = function () { const m = this.g.mono; if (m) { m.st.keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; m.save(); } };
Story.prototype.chime = function (k) { if (!window.FleetAudio) return; if (!this.au) this.au = new FleetAudio(); this.au.start(); const N = k === 2 ? [523, 659, 784, 1046] : k === 3 ? [392, 523, 784] : [660, 880];
  N.forEach((n, i) => setTimeout(() => this.au.blip(n, n, 0.3, 0.1, 'triangle'), i * 120)); };
Story.prototype.toast = function (s) { this.toastS = s; this.toastT = 3.2; };
Story.prototype.reset = function () { const free = this.st.free; this.st = { ch: 0, done: {}, base: {}, flags: {}, seen: {}, prologue: 0, free }; this.save(); if (this.pro) this.pro.start(); };

/* ---------------- VEGA on the radio ---------------- */
Story.prototype.buildUI = function () {
  const st = document.createElement('style');
  st.textContent = '#vega{position:fixed;left:50%;top:16vmin;transform:translateX(-50%);width:min(80vw,100vmin);z-index:45;display:none;gap:2vmin;align-items:center;background:rgba(6,10,20,.9);border:2px solid rgba(110,200,255,.7);border-radius:2vmin;padding:1.6vmin 2vmin;color:#e8f6ff;font:2.1vmin system-ui,sans-serif;box-shadow:0 0 3vmin rgba(80,180,255,.3);cursor:pointer}'
    + '#vega .face{flex:none;width:11vmin;height:11vmin;border-radius:50%;background:radial-gradient(circle at 50% 38%,#ffd9c0 0 22%,transparent 23%),radial-gradient(circle at 50% 100%,#2b6dff 0 45%,transparent 46%),radial-gradient(circle at 50% 30%,#2a1a3a 0 34%,transparent 35%),#0c1630;border:2px solid #7fc8ff;position:relative}'
    + '#vega .face::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid #7fc8ff;opacity:.5;animation:vegaP 1.2s ease-out infinite}@keyframes vegaP{to{inset:-14px;opacity:0}}'
    + '#vega.aria{border-color:rgba(255,150,210,.8)} #vega.aria .face{background:radial-gradient(circle at 50% 40%,#d9a27a 0 22%,transparent 23%),radial-gradient(circle at 50% 100%,#1b6fd8 0 45%,transparent 46%),radial-gradient(circle at 50% 32%,#1a1010 0 36%,transparent 37%),#2a0c24;border-color:#ff96d2} #vega.aria b{color:#ffb4e2}'
    + '#vega.elder{border-color:rgba(255,170,80,.85);background:rgba(24,14,6,.92)} #vega.elder .face{background:radial-gradient(circle at 50% 40%,#c99a74 0 22%,transparent 23%),radial-gradient(circle at 50% 100%,#7a4a1c 0 45%,transparent 46%),radial-gradient(circle at 50% 30%,#d8d8d0 0 36%,transparent 37%),#2a1606;border-color:#ffb052} #vega.elder b{color:#ffcf8a}'
    + '#vega b{color:#8fd6ff;letter-spacing:.12em;font-size:1.7vmin} #vega .tx{min-height:6vmin;line-height:1.35} #vega small{opacity:.6;font-size:1.5vmin}';
  document.head.appendChild(st);
  const d = this.ui = document.createElement('div'); d.id = 'vega'; d.innerHTML = '<span class="face"></span><span style="flex:1"><b></b><div class="tx"></div><small>tocca o premi INVIO per continuare</small></span>'; document.body.appendChild(d);
  const next = e => { e.preventDefault(); e.stopPropagation(); this.next(); }; d.addEventListener('click', next); d.addEventListener('touchstart', next);
  addEventListener('keydown', e => { if (this.dlg && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); if (e.code === 'Escape') this.endRadio(); else this.next(); } }, true);
};
const WHO = { vega: '📡 VEGA · KAGE ODYSSEY', aria: '🛠 ARIA · KAGE GARAGE', elder: '🔥 L’ANZIANA DEI PRIMI' };
Story.prototype.radio = function (lines, head, who, onDone) {
  const ch = this.cur(); if (!lines && this.finished()) return;
  this.dlg = { lines: lines || ch.radio, i: 0, head: head || (ch.title), n: 0, onDone }; if (!lines) { this.st.seen[ch.id] = 1; this.save(); }
  this.ui.className = who || 'vega'; this.ui.style.display = 'flex'; this.ui.querySelector('b').textContent = WHO[who || 'vega'] + ' — ' + this.dlg.head; this.type(); this.chime(1);
};
Story.prototype.type = function () { const D = this.dlg, el = this.ui.querySelector('.tx'), s = D.lines[D.i]; D.n = 0; clearInterval(this.tyT);
  this.tyT = setInterval(() => { D.n += 2; el.textContent = s.slice(0, D.n); if (D.n >= s.length) clearInterval(this.tyT); if (this.au && D.n % 6 === 0) this.au.blip(900 + Math.random() * 300, 700, 0.03, 0.03, 'square'); }, 30); };
Story.prototype.next = function () { const D = this.dlg; if (!D) return; const s = D.lines[D.i]; if (D.n < s.length) { D.n = s.length; clearInterval(this.tyT); this.ui.querySelector('.tx').textContent = s; return; } if (++D.i >= D.lines.length) this.endRadio(); else this.type(); };
Story.prototype.endRadio = function () { clearInterval(this.tyT); const D = this.dlg; this.dlg = null; this.ui.style.display = 'none'; if (D && D.onDone) D.onDone(); };

/* ---------------- world: ARIA at the garage; the meadow of the past (camp, circle, wreck, deer, birds, the seed) ---------------- */
const robeM = (c) => mat(c, 0, 0);
function buildCamp() { const mb = new KF.MB(), thatch = mat([0.55, 0.42, 0.22]), wood = mat([0.32, 0.2, 0.1]), hide = mat([0.62, 0.5, 0.36]);
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + 0.4, x = Math.sin(a) * 9, z = Math.cos(a) * 9; mb.part = 'capanna'; mb.push(KF.T(x, 0, z)); mb.cyl(0, 3.2, 2.2, 0.08, 14, thatch); mb.box(Math.sin(a) * -1.8, 0.7, Math.cos(a) * -1.8, 0.9, 1.4, 0.9, mat([0.1, 0.07, 0.04]));
    for (let k = 0; k < 4; k++) { const b = k * 1.57 + 0.3; mb.rod([Math.sin(b) * 0.3, 2.8, Math.cos(b) * 0.3], [Math.sin(b) * 0.7, 4.0, Math.cos(b) * 0.7], 0.05, 5, wood); } mb.pop(); }
  mb.part = 'fuoco'; for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; mb.ellipsoid(Math.sin(a) * 0.9, 0.1, Math.cos(a) * 0.9, 0.22, 0.14, 0.18, 6, 4, mat([0.4, 0.4, 0.38])); }
  for (let k = 0; k < 4; k++) { const a = k * 0.8; mb.rod([Math.sin(a) * 0.6, 0.1, Math.cos(a) * 0.6], [-Math.sin(a) * 0.6, 0.25, -Math.cos(a) * 0.6], 0.08, 6, wood); }
  mb.part = 'rastrelliera'; mb.rod([5, 0, -3], [5, 2.2, -3], 0.06, 5, wood); mb.rod([7, 0, -3], [7, 2.2, -3], 0.06, 5, wood); mb.rod([5, 2, -3], [7, 2, -3], 0.05, 5, wood); mb.box(6, 1.3, -3, 1.6, 1.0, 0.04, hide);
  mb.part = 'tronchi'; mb.rod([2, 0.25, 2.5], [4.2, 0.25, 0.8], 0.25, 8, wood); mb.rod([-2.5, 0.25, 2], [-3.8, 0.25, -0.5], 0.25, 8, wood);
  return mb.finish(); }
function buildFlame() { const mb = new KF.MB(); mb.part = 'fiamme'; for (const [r, h, c, e] of [[0.55, 1.2, [1, 0.45, 0.1], 1.5], [0.35, 1.6, [1, 0.75, 0.25], 1.8], [0.18, 1.9, [1, 0.95, 0.7], 2]]) mb.cyl(0.1, h, r, 0.02, 10, mat(c, e, 3)); return mb.finish(); }
function buildCircle() { const mb = new KF.MB(), stone = mat([0.42, 0.43, 0.41], 0, 1), moss = mat([0.25, 0.36, 0.18]);
  for (let k = 0; k < 9; k++) { const a = k / 9 * PI * 2, x = Math.sin(a) * 9, z = Math.cos(a) * 9, h = 2.6 + (k % 3) * 0.5; mb.part = 'pietra'; mb.push(KF.M(KF.T(x, 0, z), KF.RY(a))); mb.box(0, h / 2, 0, 1.3, h, 0.7, stone); mb.box(0, 0.15, 0, 1.5, 0.3, 0.9, moss);
    KF.glyph(mb, 0, h * 0.6, -0.36, 0.7, (k * 3 % 21) * 7 + 3, mat([0.3, 0.9, 0.7], 0.25, 3), true); mb.pop(); }
  mb.part = 'architrave'; for (const k of [1, 4, 7]) { const a = (k + 0.5) / 9 * PI * 2; mb.push(KF.M(KF.T(Math.sin(a) * 9, 3.3, Math.cos(a) * 9), KF.RY(a + PI / 2))); mb.box(0, 0, 0, 3.4, 0.5, 0.8, stone); mb.pop(); }
  mb.part = 'altare'; mb.cyl(0, 0.9, 1.2, 1.0, 10, stone); mb.cyl(0.9, 1.0, 1.25, 1.25, 10, mat([0.5, 0.5, 0.47]));
  return mb.finish(); }
function buildGuideGlow() { const mb = new KF.MB(); mb.part = 'luce'; mb.cyl(0, 3.4, 0.9, 0.9, 16, mat([0.4, 1, 0.8], 0.5, 3), false); return mb.finish(); }
function buildDeer() { const mb = new KF.MB(), fur = mat([0.5, 0.33, 0.18]), dark = mat([0.2, 0.13, 0.08]), horn = mat([0.75, 0.68, 0.55]);
  mb.part = 'cervo'; mb.ellipsoid(0, 1.15, 0, 0.32, 0.36, 0.8, 12, 8, fur); mb.rod([0, 1.3, 0.6], [0, 1.85, 0.95], 0.11, 6, fur); mb.ellipsoid(0, 1.92, 1.1, 0.12, 0.13, 0.26, 8, 6, fur); mb.ellipsoid(0, 1.88, 1.34, 0.05, 0.05, 0.05, 5, 4, dark);
  for (const [x, z] of [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]]) mb.rod([x, 1.0, z], [x, 0, z], 0.05, 5, fur);
  for (const sx of [-1, 1]) { mb.rod([sx * 0.06, 2.0, 1.02], [sx * 0.3, 2.45, 0.9], 0.025, 4, horn); mb.rod([sx * 0.22, 2.3, 0.94], [sx * 0.42, 2.5, 1.1], 0.02, 4, horn); mb.rod([sx * 0.3, 2.45, 0.9], [sx * 0.36, 2.75, 0.8], 0.02, 4, horn); }
  mb.ellipsoid(0, 1.3, -0.82, 0.07, 0.1, 0.07, 5, 4, mat([0.9, 0.88, 0.85])); return mb.finish(); }
function buildBird() { const mb = new KF.MB(), c = mat([0.12, 0.12, 0.14]); mb.part = 'uccello'; mb.ellipsoid(0, 0, 0, 0.08, 0.06, 0.2, 6, 4, c); mb.box(0.32, 0.02, 0, 0.6, 0.02, 0.14, c); mb.box(-0.32, 0.02, 0, 0.6, 0.02, 0.14, c); return mb.finish(); }
function buildRobe(c) { const mb = new KF.MB(); mb.part = 'tunica'; mb.cyl(0.05, 1.42, 0.36, 0.2, 14, mat(c, 0, 0)); mb.cyl(1.38, 1.5, 0.22, 0.22, 12, mat(c.map(v => v * 0.8), 0, 0)); return mb.finish(); }
function buildSeed() { const mb = new KF.MB(); mb.part = 'seme'; mb.ellipsoid(0, 0, 0, 0.22, 0.34, 0.22, 18, 12, mat([0.3, 1, 0.75], 1.4, 3)); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; KF.glyph(mb, Math.sin(a) * 0.6, 0.1, Math.cos(a) * 0.6, 0.18, k * 7 + 3, mat([0.4, 1, 0.8], 1.6, 3)); } return mb.finish(); }
const FIRST = [[{ suit: 'oro', hair: 'lunghi', hairColor: 'grigio', skin: 'ambrata', beard: 'nessuna', build: 'snello' }, [0.55, 0.42, 0.3], 3, 1.5, -1.9, 'in piedi', 1],
  [{ suit: 'rosso', hair: 'ricci', hairColor: 'nero', skin: 'scura', beard: 'piena' }, [0.45, 0.3, 0.18], -3, 2, 2.2, 'braccia conserte'], [{ suit: 'oro', hair: 'coda', hairColor: 'castano', skin: 'olivastra', build: 'snello' }, [0.6, 0.5, 0.35], 1.5, -3.2, 0.3, 'pensieroso'],
  [{ suit: 'blu', hair: 'rasati', hairColor: 'nero', skin: 'ambrata', build: 'robusto' }, [0.4, 0.34, 0.26], -2, -2.5, 0.8, 'indica']];
Story.prototype.drawWorld = function (ctx) {
  const g = this.g, F = g.fleet; this.camX = ctx.camX; this.camZ = ctx.camZ; if (!F) return;
  const gl = g.gl, P = g.P.veh, u = P.u, U = window.CarRenderUtil, M = (k, fn) => this.meshes[k] || (this.meshes[k] = g.vmesh(fn())), st = this.st;
  const rel = (x, z) => [wrapD(x - ctx.camX), wrapD(z - ctx.camZ)], prep = () => { gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uLit, 1); if (u.uBlur) gl.uniform1f(u.uBlur, 0); if (u.uDay) gl.uniform1f(u.uDay, g.dayK || 0); };
  const put = (m, x, y, z, h, s) => { const r = rel(x, z); if (Math.hypot(r[0], r[1]) > 420) return; gl.uniformMatrix4fv(u.uModel, false, U.mul(U.T(r[0], y, r[1]), U.mul(U.RY(h || 0), new Float32Array([s || 1, 0, 0, 0, 0, s || 1, 0, 0, 0, 0, s || 1, 0, 0, 0, 0, 1])))); g.draw(P, m); };
  // ARIA, the garage attendant (after the prologue she stays where you woke up)
  if (g.world === 'city' && st.aria && window.KagePilot) { const A = st.aria, r = rel(A.x, A.z); if (Math.hypot(r[0], r[1]) < 140) { const f = g.foot, nr = f && f.active && Math.hypot(wrapD(f.x - A.x), wrapD(f.z - A.z)) < 7;
      this.ariaM = this.ariaM || (() => { const m = KagePilot.build(Object.assign({}, window.KageAriaLook || { suit: 'blu' }), 'hi'), vm = g.vmesh(m); vm.S = m.S; return vm; })();
      const h = f && f.active ? Math.atan2(wrapD(f.x - A.x), wrapD(f.z - A.z)) : 0; F.drawPilotPose(ctx.set, U.mul(U.T(r[0], 0, r[1]), U.RY(h)), nr ? (this.dlg && this.ui.className === 'aria' ? 'indica' : 'saluto') : 'mani sui fianchi', { key: 'aria' }, this.ariaM, ctx.t); } }
  if (g.world !== 'meadow') return;
  prep();
  put(M('camp', buildCamp), CAMP.x, 0, CAMP.z, 0, 1);
  put(M('circle', buildCircle), CIRCLE.x, 0, CIRCLE.z, 0, 1);
  if (window.KageXeno) { const m = M('wreck', () => KageXeno.buildUfo(Object.assign({}, KageXeno.UFO_DEF || {}, { paint: 'nero', legs: false }), 'hi')), r = rel(WRECK.x, WRECK.z);
    if (Math.hypot(r[0], r[1]) < 420) { gl.uniform1f(u.uLit, 0.4); gl.uniformMatrix4fv(u.uModel, false, U.mul(U.T(r[0], -3.4, r[1]), U.mul(U.RY(0.7), U.mul(U.RZ(0.38), U.RX(-0.15))))); g.draw(P, m); gl.uniform1f(u.uLit, 1); } }
  // deer grazing along a path between the camp and the circle; birds circling
  const dm = M('deer', buildDeer), t = ctx.t;
  for (let i = 0; i < 5; i++) { const k = (Math.sin(t * 0.05 + i * 1.3) * 0.5 + 0.5), x = CAMP.x + (CIRCLE.x - CAMP.x) * (0.3 + 0.45 * k) + Math.sin(i * 2.1) * 8, z = CAMP.z + (CIRCLE.z - CAMP.z) * (0.3 + 0.45 * k) + Math.cos(i * 1.7) * 8, h = Math.atan2(CIRCLE.x - CAMP.x, CIRCLE.z - CAMP.z) + (Math.cos(t * 0.05 + i * 1.3) < 0 ? PI : 0);
    put(dm, x, Math.abs(Math.sin(t * 2 + i)) * 0.04, z, h + Math.sin(t * 0.7 + i) * 0.2, i === 0 ? 1.1 : 0.85 + i * 0.03); }
  const bm = M('bird', buildBird); for (let i = 0; i < 7; i++) { const a = t * 0.25 + i * 0.9, R = 30 + i * 4; put(bm, CIRCLE.x - 40 + Math.cos(a) * R, 26 + Math.sin(t * 0.6 + i) * 3, CIRCLE.z - 30 + Math.sin(a) * R, a + PI / 2, 1 + 0.25 * Math.sin(t * 9 + i)); }
  // the First People: robes, the elder with her staff
  if (window.KagePilot) FIRST.forEach(([cfg, rc, dx, dz, h, pose, elder], i) => { const x = CAMP.x + dx, z = CAMP.z + dz, r = rel(x, z); if (Math.hypot(r[0], r[1]) > 160) return;
    const key = 'first' + i; this[key] = this[key] || (() => { const m = KagePilot.build(cfg, 'hi'), vm = g.vmesh(m); vm.S = m.S; return vm; })();
    const f = g.foot, talk = elder && this.dlg && this.ui.className === 'elder', hh = (elder && f && f.active && Math.hypot(wrapD(f.x - x), wrapD(f.z - z)) < 8) ? Math.atan2(wrapD(f.x - x), wrapD(f.z - z)) : h;
    F.drawPilotPose(ctx.set, U.mul(U.T(r[0], 0, r[1]), U.RY(hh)), talk ? 'indica' : pose, { key }, this[key], t + i); prep();
    put(M('robe' + i, () => buildRobe(rc)), x, 0, z, hh, 1);
    if (elder) { const st2 = M('staff', () => { const mb = new KF.MB(); mb.part = 'bastone'; mb.rod([0.35, 0, 0.15], [0.42, 1.9, 0.2], 0.03, 6, mat([0.35, 0.22, 0.1])); mb.ellipsoid(0.42, 1.95, 0.2, 0.07, 0.07, 0.07, 6, 4, mat([0.3, 1, 0.75], 1.2, 3)); return mb.finish(); }); put(st2, x, 0, z, hh, 1); } });
  // the fire flickers (and lights its corner)
  gl.uniform1f(u.uLit, 0.85 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.1); put(M('flame', buildFlame), CAMP.x, 0, CAMP.z, t * 0.5, 1 + Math.sin(t * 9) * 0.06); gl.uniform1f(u.uLit, 1);
  // the guide stones light up as you reach them; the seed on the altar once all three are lit
  const lit = st.lit || []; GUIDES.forEach((G, i) => { if (!lit.includes(i) && st.ch !== 6) return; gl.uniform1f(u.uGlowOnly, 1); gl.uniform1f(u.uLit, lit.includes(i) ? 1.2 + Math.sin(t * 3 + i) * 0.3 : 0.25 + 0.2 * Math.sin(t * 2 + i)); put(M('guide', buildGuideGlow), G[0], 0, G[1], 0, 1); gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uLit, 1); });
  if (!st.seed && (st.ch !== 6 || lit.length >= 3)) { gl.uniform1f(u.uLit, 1.2 + Math.sin(t * 3) * 0.3); const sm = M('seed', buildSeed), r = rel(SEED.x, SEED.z);
    gl.uniformMatrix4fv(u.uModel, false, U.mul(U.T(r[0], 1.45 + Math.sin(t * 1.7) * 0.1, r[1]), U.RY(t * 0.8))); g.draw(P, sm); gl.uniform1f(u.uLit, 1); }
  void robeM;
};
Story.prototype.target = function () { const o = this.objective(); if (!o || !o.at) return null; try { return o.at(); } catch (e) { return null; } };
Story.prototype.drawHud = function (hud) {
  const g = this.g, c2 = hud.getContext('2d'), W = hud.width, H = hud.height, m = Math.min(W, H);
  if (g.aos && g.aos.isOpen) return;
  const o = this.objective(), f = g.foot;
  if (o) { const ln = '◆ ' + o.t; c2.font = 'bold ' + (m * 0.022 | 0) + 'px system-ui,sans-serif'; c2.textAlign = 'left'; const w = c2.measureText(ln).width + m * 0.04, y = m * 0.13;
    c2.fillStyle = 'rgba(6,10,20,0.62)'; c2.fillRect(m * 0.02, y - m * 0.032, w, m * 0.046); c2.fillStyle = '#8fd6ff'; c2.fillText(ln, m * 0.04, y);
    c2.font = (m * 0.016 | 0) + 'px system-ui,sans-serif'; c2.fillStyle = 'rgba(200,230,255,.7)'; c2.fillText(this.cur().title, m * 0.04, y - m * 0.04);
    // waypoint: arrow at the screen edge or a marker over the target, with the distance
    const tg = this.target(), VP = g.VP; if (tg && VP && this.camX !== undefined && (g.world === 'city' || g.world === 'meadow') && !(f && f.ss)) {
      const rx = wrapD(tg[0] - this.camX), rz = wrapD(tg[1] - this.camZ), p = [rx, 2, rz, 1], q = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q[i] += VP[j * 4 + i] * p[j];
      const me = f && f.active ? f : g.c, dist = Math.hypot(wrapD(tg[0] - me.x), wrapD(tg[1] - me.z));
      let sx = q[3] > 0 ? (0.5 + 0.5 * q[0] / q[3]) * W : W / 2, sy = q[3] > 0 ? (0.5 - 0.5 * q[1] / q[3]) * H : H, off = q[3] <= 0 || sx < m * 0.06 || sx > W - m * 0.06 || sy < m * 0.06 || sy > H - m * 0.06;
      if (q[3] <= 0) { sx = W - sx; }
      const cx = Math.max(m * 0.06, Math.min(W - m * 0.06, sx)), cy = Math.max(m * 0.1, Math.min(H - m * 0.12, sy)), pulse = 1 + Math.sin(this.t * 4) * 0.12;
      c2.save(); c2.translate(cx, cy); c2.fillStyle = '#8fd6ff'; c2.strokeStyle = 'rgba(6,10,20,.8)'; c2.lineWidth = 3;
      if (off) { c2.rotate(Math.atan2(sy - H / 2, sx - W / 2)); c2.beginPath(); c2.moveTo(m * 0.03 * pulse, 0); c2.lineTo(-m * 0.015, m * 0.018); c2.lineTo(-m * 0.015, -m * 0.018); c2.closePath(); c2.stroke(); c2.fill(); }
      else { c2.beginPath(); c2.moveTo(0, -m * 0.02 * pulse); c2.lineTo(m * 0.014, 0); c2.lineTo(0, m * 0.02 * pulse); c2.lineTo(-m * 0.014, 0); c2.closePath(); c2.stroke(); c2.fill(); }
      c2.restore(); c2.textAlign = 'center'; c2.font = 'bold ' + (m * 0.018 | 0) + 'px system-ui'; c2.fillStyle = '#e8f6ff'; c2.fillText(dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km', cx, cy + m * 0.045); c2.textAlign = 'left'; } }
  if (this.st.seed && this.st.ch === 7) { c2.font = (m * 0.018 | 0) + 'px system-ui'; c2.fillStyle = '#7fffd0'; c2.fillText('🌱 il seme dei Custodi è con te', m * 0.04, m * 0.18); }
  if (this.toastT > 0) { const a = Math.min(1, this.toastT * 2); c2.globalAlpha = a; c2.textAlign = 'center'; c2.font = 'bold ' + (m * 0.032 | 0) + 'px system-ui'; const w = c2.measureText(this.toastS).width + m * 0.06;
    c2.fillStyle = 'rgba(6,10,20,.8)'; c2.fillRect(W / 2 - w / 2, H * 0.3 - m * 0.045, w, m * 0.065); c2.fillStyle = '#ffe08a'; c2.fillText(this.toastS, W / 2, H * 0.3); c2.textAlign = 'left'; c2.globalAlpha = 1; }
};

/* ---------------- the journal in the tablet ---------------- */
function install(OS) {
  OS.prototype.app_story = function () {
    const Sg = this.g.story; if (!Sg) { this.frame('📜 Missioni', 'non disponibile'); return; }
    const st = Sg.st, done = Sg.finished();
    this.frame('📜 Missioni · IL SEGNALE DEI CUSTODI', '<div class="card"><b>' + (done ? '✦ Campagna completata' : 'Capitolo ' + (st.ch + 1) + ' / ' + Sg.C.length) + '</b><div class="meter"><i style="width:' + Math.round(st.ch / Sg.C.length * 100) + '%"></i></div>'
      + '<button class="btn" data-act="radio">📡 riascolta VEGA</button> <button class="btn" data-act="storyreset">↺ nuova partita (dal prologo)</button> <button class="btn ' + (st.free ? 'on' : '') + '" data-act="storyfree">' + (st.free ? '🔓 modalità libera: tutto sbloccato' : '🔒 sblocco con la storia') + '</button></div>'
      + Sg.C.map((c, i) => { const cur = i === st.ch, past = i < st.ch; if (i > st.ch) return '<div class="card" style="opacity:.45"><b>' + c.title + '</b><br><small>bloccato</small></div>';
        return '<div class="card ' + (cur ? 'n' : '') + '"><b>' + (past ? '✔ ' : '◆ ') + c.title + '</b>' + c.obj.map(o => '<div style="margin-top:.5vmin">' + (st.done[o.id] ? '☑' : '☐') + ' ' + o.t + '</div>').join('') + '</div>'; }).join('')
      + (Sg.cuts ? '<div class="card"><b>🎬 Scene della storia</b><br>' + (Sg.st.prologue ? '<button class="btn" data-act="cut" data-id="prologo">▶ IL RISVEGLIO</button> ' : '') + Sg.cuts.list().map(x => (Sg.cuts.seen().includes(x.id) || st.free || st.ch >= x.at) ? '<button class="btn" data-act="cut" data-id="' + x.id + '">▶ ' + x.title + '</button> ' : '<button class="btn" disabled style="opacity:.4">🔒 ' + x.title + '</button> ').join('') + '</div>' : ''));
  };
  const act0 = OS.prototype.act;
  OS.prototype.act = function (a, el) { const Sg = this.g.story;
    if (a === 'radio' && Sg) { this.close(); setTimeout(() => Sg.finished() ? Sg.radio(EPILOGUE, 'EPILOGO') : Sg.radio(), 3000); return; }
    if (a === 'cut' && Sg && el) { const id = el.dataset.id; this.close(); setTimeout(() => { if (id === 'prologo') { if (Sg.pro) Sg.pro.replay ? Sg.pro.replay() : Sg.pro.start(); } else if (Sg.cuts) Sg.cuts.play(id); }, 2600); return; }
    if (a === 'storyfree' && Sg) { Sg.st.free = !Sg.st.free; Sg.save(); this.launch('story'); return; }
    if (a === 'storyreset' && Sg) { if (this.confirmReset) { this.confirmReset = false; this.close(); setTimeout(() => Sg.reset(), 3000); } else { this.confirmReset = true; this.toast('Tocca di nuovo per ricominciare da capo'); setTimeout(() => { this.confirmReset = false; }, 3000); } return; }
    return act0.call(this, a, el); };
}
if (window.AmpyOS) install(window.AmpyOS);
window.KageStory = Story;
})();
