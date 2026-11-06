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
const SEED = { x: 96, z: 58 };          // where the first seed lies in the meadow of the past
const mat = (c, e, slot, mode, a) => ({ c, e: e || 0, slot: slot || 0, mode: mode || 0, a: a || [0, 0, 0] });

/* ---------------- the campaign ---------------- */
function chapters(S0) {
  const g = S0.g, f = () => g.foot, M = () => g.mono, T = () => g.tech, Y = () => g.star;
  const mono = id => { const m = M(); return m ? m.spots.find(s => s.id === id) : null; }, at = id => () => { const s = mono(id); return s && !s.site && s.deck === undefined ? [s.x, s.z] : null; };
  const read = id => () => !!(M() && M().st.read.includes(id)), solvedAny = () => !!(M() && M().st.solved.some(i => i[0] === 'm'));
  const aboard = () => { const p = f(); return !!(p && (p.ss === 'in' || p.ss === 'helm')); };
  return [
    { id: 'c1', title: 'CAPITOLO I · IL RISVEGLIO', radio: ['Pilota, mi senti? Sono VEGA, ufficiale scientifica della KAGE ODYSSEY.', 'Da tre notti i nostri sensori captano un segnale da Cybercity. Viene da… pietre. Pietre incise.', 'Scendi dall’auto, prendi il tablet e vai a guardare il monolite qui vicino. Ti guido io.'],
      obj: [{ id: 'foot', t: 'Scendi dall’auto (INVIO / AZIONE)', done: () => !!(f() && f().active) },
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
    { id: 'c7', title: 'CAPITOLO VII · IL PRIMO SEME', radio: ['«Su questo mondo dorme il primo seme». Ma il seme non è qui… è stato portato sulla Terra, migliaia di anni fa.', 'Torna a Cybercity. Nel garage c’è l’EPOCH: entra, viaggia nel tempo e cerca il seme nella prateria del passato.', 'Lo riconoscerai: brilla come i glifi.'],
      obj: [{ id: 'home', t: 'Torna a Cybercity (BEAM IN dalla colonia, poi teletrasporto in città)', done: () => g.world === 'city' && !!(f() && f().active && !f().ss) },
        { id: 'past', t: 'Viaggia nel passato con l’EPOCH (nel garage)', done: () => g.world === 'meadow', at: () => g.world === 'city' ? [30, 27] : null },
        { id: 'seed', t: 'Trova il seme dei Custodi nella prateria', done: () => !!S0.st.seed, at: () => g.world === 'meadow' ? [SEED.x, SEED.z] : null }] },
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
  setTimeout(() => { if (!this.finished() && !st.seen[this.cur().id] && !new URLSearchParams(location.search).has('shot')) this.radio(); }, 2500);
}
Story.prototype.save = function () { LS.set('kageStory', JSON.stringify(this.st)); };
Story.prototype.flag = function (k, v) { if (v !== undefined) { if (!this.st.flags[k]) { this.st.flags[k] = v; this.save(); } } return !!this.st.flags[k]; };
Story.prototype.cur = function () { return this.C[Math.min(this.st.ch, this.C.length - 1)]; };
Story.prototype.finished = function () { return this.st.ch >= this.C.length; };
Story.prototype.objective = function () { if (this.finished()) return null; return this.cur().obj.find(o => !this.st.done[o.id]) || null; };
Story.prototype.update = function (dt) {
  this.t += dt; this.toastT = Math.max(0, this.toastT - dt); const g = this.g;
  if (g.aos && g.aos.isOpen) this.flag('tab', 1); if (g.tech && g.tech.cur && g.tech.cur.id === 'gt') this.flag('gt', 1); if (g.star && g.star.wake) this.flag('pod', 1);
  // the seed in the meadow
  if (g.world === 'meadow' && !this.st.seed && this.st.ch === 6) { const f = g.foot, p = f && f.active ? f : g.c; if (Math.hypot(wrapD(p.x - SEED.x), wrapD(p.z - SEED.z)) < 2.2) { this.st.seed = 1; this.save(); this.toast('🌱 SEME DEI CUSTODI RACCOLTO'); this.chime(3); } }
  if ((this.cT = (this.cT || 0) - dt) > 0 || this.finished()) return; this.cT = 0.4;
  const ch = this.cur(); if (ch.start && !this.st.base['_' + ch.id]) { ch.start(this.st); this.st.base['_' + ch.id] = 1; this.save(); }
  let changed = false;
  for (const o of ch.obj) { if (this.st.done[o.id]) continue; let ok = false; try { ok = o.done(); } catch (e) { } if (ok) { this.st.done[o.id] = 1; changed = true; this.toast('✔ ' + o.t); this.chime(1); } else break; }   // in order
  if (changed) this.save();
  if (ch.obj.every(o => this.st.done[o.id])) { this.st.ch++; this.save(); this.chime(2);
    if (this.finished()) { this.toast('✦ IL SEGNALE DEI CUSTODI · COMPLETATO ✦'); this.reward(); setTimeout(() => this.radio(EPILOGUE, 'EPILOGO'), 1800); }
    else { this.toast(ch.title + ' · COMPLETATO'); setTimeout(() => this.radio(), 1800); } }
};
Story.prototype.reward = function () { const m = this.g.mono; if (m) { m.st.keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; m.save(); } };
Story.prototype.chime = function (k) { if (!window.FleetAudio) return; if (!this.au) this.au = new FleetAudio(); this.au.start(); const N = k === 2 ? [523, 659, 784, 1046] : k === 3 ? [392, 523, 784] : [660, 880];
  N.forEach((n, i) => setTimeout(() => this.au.blip(n, n, 0.3, 0.1, 'triangle'), i * 120)); };
Story.prototype.toast = function (s) { this.toastS = s; this.toastT = 3.2; };
Story.prototype.reset = function () { this.st = { ch: 0, done: {}, base: {}, flags: {}, seen: {} }; this.save(); this.radio(); };

/* ---------------- VEGA on the radio ---------------- */
Story.prototype.buildUI = function () {
  const st = document.createElement('style');
  st.textContent = '#vega{position:fixed;left:50%;top:16vmin;transform:translateX(-50%);width:min(80vw,100vmin);z-index:45;display:none;gap:2vmin;align-items:center;background:rgba(6,10,20,.9);border:2px solid rgba(110,200,255,.7);border-radius:2vmin;padding:1.6vmin 2vmin;color:#e8f6ff;font:2.1vmin system-ui,sans-serif;box-shadow:0 0 3vmin rgba(80,180,255,.3);cursor:pointer}'
    + '#vega .face{flex:none;width:11vmin;height:11vmin;border-radius:50%;background:radial-gradient(circle at 50% 38%,#ffd9c0 0 22%,transparent 23%),radial-gradient(circle at 50% 100%,#2b6dff 0 45%,transparent 46%),radial-gradient(circle at 50% 30%,#2a1a3a 0 34%,transparent 35%),#0c1630;border:2px solid #7fc8ff;position:relative}'
    + '#vega .face::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid #7fc8ff;opacity:.5;animation:vegaP 1.2s ease-out infinite}@keyframes vegaP{to{inset:-14px;opacity:0}}'
    + '#vega b{color:#8fd6ff;letter-spacing:.12em;font-size:1.7vmin} #vega .tx{min-height:6vmin;line-height:1.35} #vega small{opacity:.6;font-size:1.5vmin}';
  document.head.appendChild(st);
  const d = this.ui = document.createElement('div'); d.id = 'vega'; d.innerHTML = '<span class="face"></span><span style="flex:1"><b></b><div class="tx"></div><small>tocca o premi INVIO per continuare</small></span>'; document.body.appendChild(d);
  const next = e => { e.preventDefault(); e.stopPropagation(); this.next(); }; d.addEventListener('click', next); d.addEventListener('touchstart', next);
  addEventListener('keydown', e => { if (this.dlg && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); if (e.code === 'Escape') this.endRadio(); else this.next(); } }, true);
};
Story.prototype.radio = function (lines, head) {
  const ch = this.cur(); if (!lines && this.finished()) return;
  this.dlg = { lines: lines || ch.radio, i: 0, head: head || (ch.title), n: 0 }; if (!lines) { this.st.seen[ch.id] = 1; this.save(); }
  this.ui.style.display = 'flex'; this.ui.querySelector('b').textContent = '📡 VEGA · KAGE ODYSSEY — ' + this.dlg.head; this.type(); this.chime(1);
};
Story.prototype.type = function () { const D = this.dlg, el = this.ui.querySelector('.tx'), s = D.lines[D.i]; D.n = 0; clearInterval(this.tyT);
  this.tyT = setInterval(() => { D.n += 2; el.textContent = s.slice(0, D.n); if (D.n >= s.length) clearInterval(this.tyT); if (this.au && D.n % 6 === 0) this.au.blip(900 + Math.random() * 300, 700, 0.03, 0.03, 'square'); }, 30); };
Story.prototype.next = function () { const D = this.dlg; if (!D) return; const s = D.lines[D.i]; if (D.n < s.length) { D.n = s.length; clearInterval(this.tyT); this.ui.querySelector('.tx').textContent = s; return; } if (++D.i >= D.lines.length) this.endRadio(); else this.type(); };
Story.prototype.endRadio = function () { clearInterval(this.tyT); this.dlg = null; this.ui.style.display = 'none'; };

/* ---------------- world: the seed in the meadow, objective beacon ---------------- */
Story.prototype.drawWorld = function (ctx) {
  const g = this.g; this.camX = ctx.camX; this.camZ = ctx.camZ;
  if (g.world !== 'meadow' || this.st.seed || this.st.ch !== 6 || !g.fleet) return;
  const gl = g.gl, P = g.P.veh, u = P.u, U = window.CarRenderUtil;
  if (!this.meshes.seed) { const mb = new KF.MB(); mb.part = 'seme'; mb.ellipsoid(0, 0, 0, 0.22, 0.34, 0.22, 18, 12, mat([0.3, 1, 0.75], 1.4, 3)); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; KF.glyph(mb, Math.sin(a) * 0.6, 0.1, Math.cos(a) * 0.6, 0.18, k * 7 + 3, mat([0.4, 1, 0.8], 1.6, 3)); }
    mb.part = 'basamento'; mb.cyl(-1.2, -0.9, 0.7, 0.9, 16, mat([0.25, 0.25, 0.22])); this.meshes.seed = g.vmesh(mb.finish()); }
  gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uLit, 1.2 + Math.sin(ctx.t * 3) * 0.3);
  gl.uniformMatrix4fv(u.uModel, false, U.mul(U.T(wrapD(SEED.x - ctx.camX), 1.25 + Math.sin(ctx.t * 1.7) * 0.12, wrapD(SEED.z - ctx.camZ)), U.RY(ctx.t * 0.8))); g.draw(P, this.meshes.seed); gl.uniform1f(u.uLit, 1);
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
      + '<button class="btn" data-act="radio">📡 riascolta VEGA</button> <button class="btn" data-act="storyreset">↺ ricomincia la campagna</button></div>'
      + Sg.C.map((c, i) => { const cur = i === st.ch, past = i < st.ch; if (i > st.ch) return '<div class="card" style="opacity:.45"><b>' + c.title + '</b><br><small>bloccato</small></div>';
        return '<div class="card ' + (cur ? 'n' : '') + '"><b>' + (past ? '✔ ' : '◆ ') + c.title + '</b>' + c.obj.map(o => '<div style="margin-top:.5vmin">' + (st.done[o.id] ? '☑' : '☐') + ' ' + o.t + '</div>').join('') + '</div>'; }).join(''));
  };
  const act0 = OS.prototype.act;
  OS.prototype.act = function (a, el) { const Sg = this.g.story;
    if (a === 'radio' && Sg) { this.close(); setTimeout(() => Sg.finished() ? Sg.radio(EPILOGUE, 'EPILOGO') : Sg.radio(), 3000); return; }
    if (a === 'storyreset' && Sg) { if (this.confirmReset) { this.confirmReset = false; Sg.reset(); this.launch('story'); } else { this.confirmReset = true; this.toast('Tocca di nuovo per ricominciare da capo'); setTimeout(() => { this.confirmReset = false; }, 3000); } return; }
    return act0.call(this, a, el); };
}
if (window.AmpyOS) install(window.AmpyOS);
window.KageStory = Story;
})();
