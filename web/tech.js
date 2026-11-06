/* KAGE TECH: the technician's tablet. Connect to the devices around you (the KAGE GT, the vehicle you parked, the KAGE XENO,
 * the EPOCH, the NEXUS console, the systems of the KAGE ODYSSEY), read live telemetry, run functions, write small programs
 * (KAGE SCRIPT: one command per line, ATTENDI, RIPETI n … FINE, # comments) that can start by themselves when you come close,
 * and run diagnostics: devices develop faults (error codes) that you track down and repair with the right procedure from the
 * manual. Key U or 🔧 TECNICO on foot. State (programs, faults, repairs) is kept in localStorage. */
(function () {
'use strict';
const NR = window.NeonRun, KF = window.KageFleet;
if (!NR || !KF) return;
const { S, GP, wrapD } = NR, PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------- fault codes and the manual ---------------- */
const FAULTS = {
  'E-104': { t: 'SENSORE FUORI SCALA', d: 'Un sensore legge valori impossibili.', fix: ['CALIBRA <sensore>'], how: 'Esegui DIAG per sapere quale sensore, poi CALIBRA seguito dalla sigla del sensore (es. CALIBRA TEMP).' },
  'E-221': { t: 'ATTUATORE BLOCCATO', d: 'Porte, portelli e parti mobili non rispondono.', fix: ['RESET ATTUATORI', 'TEST ATTUATORI'], how: 'Prima RESET ATTUATORI, poi TEST ATTUATORI per verificarli e sbloccarli.' },
  'E-330': { t: 'FIRMWARE CORROTTO', d: 'I comandi falliscono a caso.', fix: ['FLASH FIRMWARE'], how: 'FLASH FIRMWARE riscrive il firmware (ci vogliono alcuni secondi: non muoverti dal dispositivo).' },
  'E-412': { t: 'FUSIBILE BRUCIATO', d: 'Luci, raggi e circuiti di potenza spenti.', fix: ['SOSTITUISCI FUSIBILE <n>'], how: 'DIAG ti dice quale fusibile (F1–F8): SOSTITUISCI FUSIBILE seguito dal numero.' },
  'E-509': { t: 'PERDITA DI REFRIGERANTE', d: 'La temperatura sale lentamente.', fix: ['SIGILLA CIRCUITO', 'RABBOCCA'], how: 'Prima SIGILLA CIRCUITO, poi RABBOCCA il refrigerante. Nell’ordine giusto.' },
  'E-618': { t: 'BUS DATI DISTURBATO', d: 'La telemetria salta e mente.', fix: ['RESET BUS'], how: 'RESET BUS riavvia la rete interna del dispositivo.' } };
const CODES = Object.keys(FAULTS);
const HELP = [
  'STATO · telemetria in testo', 'DIAG · diagnosi completa (codici guasto)', 'TEST <modulo> · prova un modulo', 'RESET <ATTUATORI|BUS|TUTTO>', 'CALIBRA <sensore>', 'FLASH FIRMWARE',
  'SOSTITUISCI FUSIBILE <n>', 'SIGILLA CIRCUITO · RABBOCCA', 'ATTENDI <secondi>', 'RIPETI <n> … FINE', 'SUONA · un bip', 'ELENCO · funzioni del dispositivo', '# commento'];

/* ---------------- device catalogue ---------------- */
// each device: id, name, where (in range?), sensors [key, label, unit, lo, hi, value()], funcs { NAME: fn(args) → message }
function catalogue(T) {
  const g = T.g, f = () => g.foot, F = g.fleet, X = g.xeno, Y = g.star, N = g.nexus;
  const near = (x, z, r) => { const p = f(); return p && p.active && !p.ss && !p.xs && g.world === 'city' && Math.hypot(wrapD(x - p.x), wrapD(z - p.z)) < r; };
  const n = (base, amp, sp, ph) => base + Math.sin(g.t * (sp || 0.7) + (ph || 0)) * amp + Math.sin(g.t * 2.3 + (ph || 0) * 3) * amp * 0.3;
  const D = [];
  // the KAGE GT, parked while you're on foot
  D.push({ id: 'gt', name: 'KAGE GT · CENTRALINA', icon: '🏎', range: () => !g.veh && near(g.c.x, g.c.z, 25),
    sensors: [['GIRI', 'GIRI MOTORE', 'rpm', 600, 9000, () => g.eng ? g.eng.rpm : 900], ['TEMP', 'TEMP. OLIO', '°C', 60, 120, () => n(92, 1.5, 0.3)], ['TENS', 'TENSIONE', 'V', 12, 14.8, () => n(13.9, 0.08, 1.1)],
      ['GOMME', 'PRESSIONE GOMME', 'bar', 1.9, 2.6, () => n(2.25, 0.01, 0.2)], ['CARB', 'BATTERIA / CARBURANTE', '%', 5, 100, () => g.eng && g.eng.fuelK !== undefined ? g.eng.fuelK * 100 : 86]],
    funcs: { 'APRI PORTE': () => { g.techDoor = 1; return 'porte aperte'; }, 'CHIUDI PORTE': () => { g.techDoor = 0; return 'porte chiuse'; },
      'APRI COFANO': () => { g.techHood = 1; return 'cofano aperto'; }, 'CHIUDI COFANO': () => { g.techHood = 0; return 'cofano chiuso'; },
      'FARI ON': () => { g.techHL = 1; return 'fari accesi'; }, 'FARI OFF': () => { g.techHL = 0; return 'fari spenti'; }, 'LAMPEGGIA': () => { T.blink = 3; return 'lampeggio fari'; },
      'CLACSON': () => { T.beep(420, 420, 0.35, 0.2, 'square'); T.beep(330, 330, 0.35, 0.2, 'square'); return 'BEEEP'; } },
    power: ['FARI ON', 'LAMPEGGIA'], moving: ['APRI PORTE', 'CHIUDI PORTE', 'APRI COFANO', 'CHIUDI COFANO'] });
  // the vehicle you parked when you got off (drone, moto, hovercraft, sub, boat, galleon)
  D.push({ id: 'parked', name: () => (F && F.parked ? (KF.KINDS[F.parked.kind] || {}).title || F.parked.kind.toUpperCase() : 'VEICOLO') + ' · MODULO DI BORDO', icon: '🛰',
    range: () => !!(F && F.parked && F.parked.st && near(F.parked.st.x, F.parked.st.z, 25)),
    sensors: [['BATT', 'BATTERIA', '%', 10, 100, () => n(78, 0.3, 0.05)], ['TEMP', 'TEMP. MOTORI', '°C', 15, 90, () => n(38, 1, 0.4)], ['GPS', 'SATELLITI GPS', '', 4, 20, () => Math.round(n(14, 1.5, 0.2))], ['ATT', 'ATTUATORI', '%', 60, 100, () => 100]],
    funcs: Object.assign({ 'APRI TUTTO': () => { const P = F.parked; P.ovr = {}; for (const h of (P.model.hinges || [])) P.ovr[h.name] = 1; return 'tutte le parti mobili aperte'; },
      'CHIUDI TUTTO': () => { const P = F.parked; P.ovr = {}; for (const h of (P.model.hinges || [])) P.ovr[h.name] = 0; return 'tutto chiuso'; },
      'AUTOMATICO': () => { F.parked.ovr = null; return 'parti mobili in automatico'; } }),
    dynFuncs: () => { const P = F && F.parked, o = {}; if (!P || !P.model.hinges) return o; for (const h of P.model.hinges) { o['APRI ' + h.name] = () => { P.ovr = P.ovr || {}; P.ovr[h.name] = 1; return h.name + ' aperto'; }; o['CHIUDI ' + h.name] = () => { P.ovr = P.ovr || {}; P.ovr[h.name] = 0; return h.name + ' chiuso'; }; } return o; },
    moving: ['APRI', 'CHIUDI'] });
  // the KAGE XENO parked over the city / its core when you're aboard
  if (X) D.push({ id: 'xeno', name: 'KAGE XENO · NUCLEO ANTIGRAVITÀ', icon: '🛸', range: () => { const p = f(); if (!p || !p.active) return false; if (p.xs === 'in') return true; const pd = X.toWorld(0, -4.2); return near(pd[0], pd[1], 40); },
    sensors: [['GRAV', 'CAMPO ANTIGRAVITÀ', 'g', 0.8, 1.2, () => n(1, 0.01, 0.5)], ['PLASMA', 'PLASMA DEL NUCLEO', 'MK', 2, 9, () => n(6.4, 0.3, 0.8)], ['SCUDO', 'SCUDO', '%', 40, 100, () => n(97, 0.5, 0.3)], ['RAGGIO', 'RAGGIO TRAENTE', '%', 0, 100, () => X.beamA * 100]],
    funcs: { 'RAGGIO ON': () => { X.techBeam = true; return 'raggio traente acceso'; }, 'RAGGIO OFF': () => { X.techBeam = false; return 'raggio spento'; }, 'RAGGIO AUTO': () => { X.techBeam = undefined; return 'raggio in automatico'; },
      'PULSA NUCLEO': () => { T.beep(90, 600, 1.4, 0.18, 'sawtooth'); return 'impulso nel nucleo'; } }, power: ['RAGGIO ON'] });
  // the EPOCH in the garage
  if (X) D.push({ id: 'epoch', name: 'KAGE EPOCH · REGOLATORE CRONOTONICO', icon: '⏳', range: () => near(30, 27, 20),
    sensors: [['FLUSSO', 'FLUSSO CRONOTONICO', 'cT', 1, 10, () => n(4.2, 0.4, 0.35)], ['ANNO', 'ANNO DI DESTINAZIONE', '', -50000, 3000, () => g.world === 'meadow' ? 2026 : -12000], ['MOLLE', 'TENSIONE MOLLE', '%', 30, 100, () => n(88, 0.4, 0.2)], ['PORTA', 'PORTA', '%', 0, 100, () => (X.epDoor || 0) * 100]],
    funcs: { 'APRI PORTA': () => { X.techEp = 1; return 'porta aperta'; }, 'CHIUDI PORTA': () => { X.techEp = 0; return 'porta chiusa'; }, 'PORTA AUTO': () => { X.techEp = undefined; return 'porta in automatico'; },
      'CARICA MOLLE': () => { T.beep(200, 1400, 1.2, 0.12, 'triangle'); return 'molle caricate'; } }, moving: ['APRI PORTA', 'CHIUDI PORTA'] });
  // the NEXUS dial console
  if (N) D.push({ id: 'nexus', name: 'KAGE NEXUS · CONSOLE DI COMPOSIZIONE', icon: '🌀', range: () => { const p = f(); return p && p.active && !p.ss && !p.xs && N.dist < 18; },
    sensors: [['ANELLO', 'ENERGIA DELL’ANELLO', 'TW', 1, 40, () => n(N.st === 'idle' ? 6 : 31, 0.5, 1)], ['SERR', 'SERRATURE', '/7', 0, 7, () => Math.min(7, N.locks || 0)], ['STAB', 'STABILITÀ MEMBRANA', '%', 50, 100, () => n(N.portal > 0 ? 93 : 100, 1, 2)]],
    funcs: { 'COMPONI': () => { N.dial(); return 'sequenza di composizione avviata'; } }, power: ['COMPONI'] });
  // the KAGE ODYSSEY: the ship's network, from any deck or the helm
  if (Y) D.push({ id: 'odyssey', name: 'KAGE ODYSSEY · RETE DI BORDO', icon: '🚀', range: () => { const p = f(); return p && p.active && (p.ss === 'in' || p.ss === 'helm'); },
    sensors: [['NUCLEO', 'NUCLEO WARP', '%', 40, 100, () => n(Y.boostT > 0 ? 99 : 91, 0.6, 0.5)], ['WARP', 'FATTORE WARP', '', 0, 10, () => Y.ship.mode === 'warp' ? window.KageStar.WARP_STEPS[Y.ship.warpI] : 0], ['SCUDI', 'SCUDI', '%', 30, 100, () => n(100, 0.2, 0.2)],
      ['SCAFO', 'INTEGRITÀ SCAFO', '%', 60, 100, () => 100], ['O2', 'OSSIGENO', '%', 18, 23, () => n(20.9, 0.05, 0.1)], ['STASI', 'CAPSULE DI STASI', '/4', 0, 4, () => 4 - (Y.wake ? 1 : 0)]],
    funcs: { 'NUCLEO BOOST': () => { Y.boostT = 8; return 'nucleo warp riequilibrato'; }, 'REPLICA': () => { Y.repT = 9; Y.repK = ((Y.repK || 0) + 1) % 5; return 'replicatore in funzione (ponte 4)'; },
      'RISVEGLIA 1': () => wake(0), 'RISVEGLIA 2': () => wake(1), 'RISVEGLIA 3': () => wake(2), 'RISVEGLIA 4': () => wake(3), 'STASI': () => { Y.wake = null; return 'tutti gli ospiti in stasi'; },
      'PORTE ASCENSORE APRI': () => { Y.techLift = 1; return 'porte ascensore aperte'; }, 'PORTE ASCENSORE CHIUDI': () => { Y.techLift = 0; return 'porte ascensore chiuse'; }, 'PORTE ASCENSORE AUTO': () => { Y.techLift = undefined; return 'porte ascensore in automatico'; },
      'ALLARME': () => { for (let k = 0; k < 4; k++) setTimeout(() => T.beep(880, 440, 0.4, 0.15, 'square'), k * 450); return 'ALLERTA ROSSA (prova)'; } },
    power: ['NUCLEO BOOST', 'REPLICA'], moving: ['PORTE ASCENSORE APRI', 'PORTE ASCENSORE CHIUDI'] });
  function wake(i) { Y.wake = { i, t: 16 }; return 'capsula ' + (i + 1) + ': risveglio in corso (ponte 5)'; }
  return D;
}

/* ---------------- the tablet ---------------- */
function Tech(game) {
  this.g = game; this.D = catalogue(this); this.open = false; this.cur = null; this.tab = 'stato'; this.log = []; this.run = null; this.blink = 0; this.was = {};
  try { this.st = JSON.parse(LS.get('kageTech', '{}')); } catch (e) { this.st = {}; }
  const st = this.st; st.progs = st.progs || {}; st.auto = st.auto || {}; st.faults = st.faults || {}; st.fixed = st.fixed || 0; st.steps = st.steps || {};
  if (!st.seeded) { st.seeded = 1; // a few faults to start with
    st.faults.gt = [{ c: 'E-104', s: 'TEMP' }]; st.faults.odyssey = [{ c: 'E-509' }]; st.faults.xeno = [{ c: 'E-412', n: 3 }]; st.faults.epoch = [{ c: 'E-221' }]; this.save(); }
  this.nextFault = 300 + Math.random() * 240;
  this.buildUI();
}
Tech.prototype.save = function () { LS.set('kageTech', JSON.stringify(this.st)); };
Tech.prototype.beep = function (a, b, d, v, w) { if (!window.FleetAudio) return; if (!this.au) this.au = new FleetAudio(); this.au.start(); this.au.blip(a, b, d, v, w); };
Tech.prototype.dname = function (d) { return typeof d.name === 'function' ? d.name() : d.name; };
Tech.prototype.funcs = function (d) { return Object.assign({}, d.funcs || {}, d.dynFuncs ? d.dynFuncs() : {}); };
Tech.prototype.faults = function (d) { return this.st.faults[d.id] || []; };
Tech.prototype.inRange = function () { return this.D.filter(d => { try { return d.range(); } catch (e) { return false; } }); };
Tech.prototype.free = function () { const f = this.g.foot; return f && f.active && !this.g.veh; };
Tech.prototype.toggle = function () { if (!this.free()) return; this.open = !this.open; this.ui.style.display = this.open ? 'flex' : 'none'; if (this.open) { this.beep(600, 1200, 0.12, 0.1, 'sine'); this.render(true); } };
Tech.prototype.key = function (code) { if (code === 'KeyU' && this.free()) { this.toggle(); return true; } return false; };
Tech.prototype.print = function (s, cls) { this.log.push([s, cls || '']); if (this.log.length > 140) this.log.splice(0, this.log.length - 140); if (this.open && (this.tab === 'console' || this.tab === 'diag' || this.tab === 'prog')) this.renderLog(); };

/* sensor value as the device reports it (faults bend the readings) */
Tech.prototype.read = function (d, s) {
  let v = s[5](); const fl = this.faults(d);
  if (fl.some(q => q.c === 'E-104' && q.s === s[0])) v = s[4] * 4.2 + 999 * Math.abs(Math.sin(this.g.t * 0.3));
  if (fl.some(q => q.c === 'E-618')) v = v * (1 + (Math.random() - 0.5) * 0.6);
  if (s[0] === 'TEMP' && fl.some(q => q.c === 'E-509')) v += 25 + (this.g.t % 600) * 0.05;
  if (s[0] === 'ATT' && fl.some(q => q.c === 'E-221')) v = 0;
  return v;
};
Tech.prototype.state = function (d, s, v) { return v < s[3] || v > s[4] ? 'err' : (v < s[3] + (s[4] - s[3]) * 0.08 || v > s[4] - (s[4] - s[3]) * 0.08) ? 'warn' : 'ok'; };

/* ---------------- KAGE SCRIPT interpreter ---------------- */
Tech.prototype.compile = function (text) {
  const out = [], stack = [];
  text.split('\n').forEach((raw, ln) => { const l = raw.replace(/#.*/, '').trim().toUpperCase().replace(/\s+/g, ' '); if (!l) return;
    if (/^RIPETI \d+$/.test(l)) { stack.push(out.length); out.push({ op: 'rep', n: +l.split(' ')[1], ln }); }
    else if (l === 'FINE') { const s0 = stack.pop(); if (s0 === undefined) throw new Error('riga ' + (ln + 1) + ': FINE senza RIPETI'); out.push({ op: 'end', to: s0, ln }); out[s0].end = out.length; }
    else if (/^ATTENDI [\d.]+$/.test(l)) out.push({ op: 'wait', s: Math.min(60, +l.split(' ')[1]), ln });
    else out.push({ op: 'cmd', l, ln }); });
  if (stack.length) throw new Error('RIPETI senza FINE');
  return out;
};
Tech.prototype.start = function (d, text, why) {
  let code; try { code = this.compile(text); } catch (e) { this.print('✖ ' + e.message, 'err'); return; }
  if (!code.length) { this.print('programma vuoto', 'warn'); return; }
  this.run = { d, code, pc: 0, wait: 0, cnt: {}, steps: 0 }; this.print('▶ ' + this.dname(d) + ' · programma avviato' + (why ? ' (' + why + ')' : ''), 'ok');
};
Tech.prototype.stepRun = function (dt) {
  const R = this.run; if (!R) return;
  if (!this.inRange().includes(R.d)) { this.print('■ collegamento perso: programma fermato', 'err'); this.run = null; return; }
  if (R.wait > 0) { R.wait -= dt; return; }
  for (let k = 0; k < 40 && this.run; k++) {
    if (R.pc >= R.code.length) { this.print('■ programma terminato', 'ok'); this.run = null; return; }
    if (++R.steps > 5000) { this.print('✖ troppi passi: il programma non finisce mai?', 'err'); this.run = null; return; }
    const I = R.code[R.pc];
    if (I.op === 'rep') { R.cnt[R.pc] = I.n; R.pc++; if (I.n <= 0) R.pc = I.end; }
    else if (I.op === 'end') { const c = --R.cnt[I.to]; R.pc = c > 0 ? I.to + 1 : R.pc + 1; }
    else if (I.op === 'wait') { R.wait = I.s; R.pc++; return; }
    else { const r = this.exec(R.d, I.l); R.pc++; if (r && r.wait) { R.wait = r.wait; return; } if (r && r.stop) { this.run = null; return; } }
  }
};
/** one command on a device; prints the result */
Tech.prototype.exec = function (d, line) {
  const L = line.trim().toUpperCase().replace(/\s+/g, ' '), w = L.split(' '), fl = this.faults(d), fx = this.funcs(d), P = (s, c) => this.print(s, c);
  if (!L) return;
  P('› ' + L, 'cmd');
  const has = c => fl.find(q => q.c === c);
  const progress = (c, step) => { const q = has(c); if (!q) { P('nessun guasto ' + c + ' su questo dispositivo: niente da fare', 'warn'); return; }
    const need = FAULTS[c].fix; q.k = q.k || 0;
    if (need[q.k].split(' ')[0] !== step.split(' ')[0] || (need[q.k].indexOf('<') < 0 && need[q.k] !== step)) { P('✖ procedura sbagliata per ' + c + ': passo atteso «' + need[q.k] + '»', 'err'); q.k = 0; this.save(); return; }
    q.k++; if (q.k >= need.length) { this.st.faults[d.id] = fl.filter(x => x !== q); this.st.fixed++; this.save(); P('✔ ' + c + ' ' + FAULTS[c].t + ' · RIPARATO (riparazioni totali: ' + this.st.fixed + ')', 'ok'); this.beep(523, 1046, 0.4, 0.12, 'triangle'); }
    else { this.save(); P('… passo ' + q.k + '/' + need.length + ' fatto · ora: ' + need[q.k], 'warn'); } };
  if (L === 'AIUTO' || L === 'HELP') { HELP.forEach(h => P('  ' + h)); return; }
  if (L === 'ELENCO') { Object.keys(fx).forEach(k => P('  ' + k)); return; }
  if (L === 'SUONA') { this.beep(880, 880, 0.15, 0.12, 'sine'); P('bip'); return; }
  if (L === 'STATO') { for (const s of d.sensors) { const v = this.read(d, s); P('  ' + s[0].padEnd(7) + ' ' + s[1].padEnd(24) + ' ' + fmt(v) + ' ' + s[2] + '  [' + this.state(d, s, v).toUpperCase() + ']', this.state(d, s, v)); } return; }
  if (L === 'DIAG') { P('DIAGNOSI · ' + this.dname(d) + ' …'); const lines = ['memoria ......... OK', 'alimentazione ... ' + (has('E-412') ? 'GUASTO' : 'OK'), 'bus dati ........ ' + (has('E-618') ? 'DISTURBATO' : 'OK'), 'firmware ........ ' + (has('E-330') ? 'CHECKSUM ERRATO' : 'OK'), 'attuatori ....... ' + (has('E-221') ? 'BLOCCATI' : 'OK'), 'circuito termico  ' + (has('E-509') ? 'PERDITA' : 'OK')];
    lines.forEach((s, i) => setTimeout(() => P('  ' + s, /OK$/.test(s) ? '' : 'err'), 120 * (i + 1)));
    setTimeout(() => { if (!fl.length) P('✔ nessun guasto rilevato', 'ok'); else fl.forEach(q => P('✖ ' + q.c + ' · ' + FAULTS[q.c].t + (q.s ? ' · sensore ' + q.s : '') + (q.n ? ' · fusibile F' + q.n : '') + ' — vedi MANUALE', 'err')); }, 120 * (lines.length + 1));
    this.beep(300, 900, 0.8, 0.06, 'triangle'); return { wait: 1 }; }
  if (w[0] === 'CALIBRA') { const q = has('E-104'); if (q && w[1] === q.s) { progress('E-104', 'CALIBRA <sensore>'); } else if (q) P('✖ ' + (w[1] || '?') + ' non è il sensore guasto', 'err'); else if (d.sensors.some(s => s[0] === w[1])) P('sensore ' + w[1] + ' calibrato (era già a posto)'); else P('✖ sensore sconosciuto: ' + (w[1] || '') + ' · sensori: ' + d.sensors.map(s => s[0]).join(' '), 'err'); return { wait: 0.6 }; }
  if (L === 'RESET ATTUATORI') { if (has('E-221')) progress('E-221', 'RESET ATTUATORI'); else P('attuatori riavviati'); return { wait: 0.5 }; }
  if (L === 'TEST ATTUATORI') { if (has('E-221')) progress('E-221', 'TEST ATTUATORI'); else P('attuatori: tutti rispondono ✔', 'ok'); return { wait: 0.5 }; }
  if (L === 'RESET BUS') { if (has('E-618')) progress('E-618', 'RESET BUS'); else P('bus riavviato'); return { wait: 0.8 }; }
  if (L === 'RESET TUTTO') { P('riavvio completo … i guasti hardware restano: serve la procedura giusta', 'warn'); return { wait: 1.5 }; }
  if (L === 'FLASH FIRMWARE') { P('scrittura firmware ▓▓▓▓▓▓▓▓▓▓ (5 s)'); setTimeout(() => { if (has('E-330')) progress('E-330', 'FLASH FIRMWARE'); else P('firmware riscritto (era già integro)'); }, 5000); return { wait: 5.2 }; }
  if (w[0] === 'SOSTITUISCI' && w[1] === 'FUSIBILE') { const q = has('E-412'); if (q && +w[2] === q.n) progress('E-412', 'SOSTITUISCI FUSIBILE <n>'); else if (q) P('✖ F' + (w[2] || '?') + ' era buono. Quello bruciato è un altro (DIAG)', 'err'); else P('fusibile F' + (w[2] || '?') + ' sostituito (era buono)'); return { wait: 0.8 }; }
  if (L === 'SIGILLA CIRCUITO') { if (has('E-509')) progress('E-509', 'SIGILLA CIRCUITO'); else P('circuito sigillato (nessuna perdita)'); return { wait: 0.8 }; }
  if (L === 'RABBOCCA') { if (has('E-509')) progress('E-509', 'RABBOCCA'); else P('refrigerante già al livello giusto'); return { wait: 0.8 }; }
  if (w[0] === 'TEST') { P('test ' + (w.slice(1).join(' ') || 'generale') + ' … ' + (fl.length ? 'ANOMALIE: esegui DIAG' : 'OK'), fl.length ? 'warn' : 'ok'); return { wait: 0.6 }; }
  // device functions
  const fn = fx[L]; if (!fn) { P('✖ comando sconosciuto: ' + L + ' (AIUTO · ELENCO)', 'err'); return; }
  if (has('E-330') && Math.random() < 0.5) { P('✖ E-330 · il firmware non ha eseguito il comando', 'err'); return; }
  if (has('E-221') && (d.moving || []).some(m => L.startsWith(m))) { P('✖ E-221 · attuatore bloccato', 'err'); return; }
  if (has('E-412') && (d.power || []).some(m => L.startsWith(m))) { P('✖ E-412 · nessuna corrente al circuito di potenza', 'err'); return; }
  try { P('✔ ' + fn(w.slice(1)), 'ok'); } catch (e) { P('✖ ' + e.message, 'err'); }
};
const fmt = v => Math.abs(v) >= 1000 ? Math.round(v).toString() : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);

/* ---------------- per frame ---------------- */
Tech.prototype.update = function (dt) {
  const inR = this.inRange();
  // auto-run programs when you come into range of a device
  for (const d of this.D) { const now = inR.includes(d); if (now && !this.was[d.id] && this.st.auto[d.id] && this.st.progs[d.id] && !this.run) { this.start(d, this.st.progs[d.id], 'automatico'); } this.was[d.id] = now; }
  if (this.cur && !inR.includes(this.cur) && this.open) { this.cur = null; this.render(true); }
  this.stepRun(dt);
  if (this.blink > 0) { this.blink -= dt; this.g.techHL = Math.sin(this.blink * 18) > 0 ? 1 : 0; if (this.blink <= 0) this.g.techHL = undefined; }
  // new faults appear from time to time (wear and tear)
  this.nextFault -= dt; if (this.nextFault <= 0) { this.nextFault = 360 + Math.random() * 300; const d = this.D[Math.floor(Math.random() * this.D.length)], c = CODES[Math.floor(Math.random() * CODES.length)];
    const fl = this.st.faults[d.id] = this.faults(d); if (fl.length < 2 && !fl.some(q => q.c === c)) { fl.push({ c, s: c === 'E-104' ? d.sensors[Math.floor(Math.random() * d.sensors.length)][0] : undefined, n: c === 'E-412' ? 1 + Math.floor(Math.random() * 8) : undefined }); this.save(); } }
  if (this.open) { this.uiT = (this.uiT || 0) - dt; if (this.uiT <= 0) { this.uiT = 0.25; this.render(false); } }
  this.btn.style.display = this.free() ? 'block' : 'none';
};
Tech.prototype.drawHud = function (hud) {
  const c2 = hud.getContext('2d'), m = Math.min(hud.width, hud.height); let ln = '';
  if (this.run) ln = '🔧 KAGE TECH · ' + this.dname(this.run.d) + ' · programma in esecuzione';
  else if (!this.open && this.free()) { const n = this.inRange().filter(d => this.faults(d).length).length; if (n) ln = '🔧 ' + n + ' dispositiv' + (n > 1 ? 'i' : 'o') + ' vicin' + (n > 1 ? 'i' : 'o') + ' segnala' + (n > 1 ? 'no' : '') + ' un guasto · U / 🔧 TECNICO'; }
  if (!ln) return; c2.font = (m * 0.019 | 0) + 'px monospace'; c2.textAlign = 'left'; const w = c2.measureText(ln).width + m * 0.03;
  c2.fillStyle = 'rgba(3,10,6,0.65)'; c2.fillRect(m * 0.02, hud.height - m * 0.168, w, m * 0.036); c2.fillStyle = '#9dff8a'; c2.fillText(ln, m * 0.035, hud.height - m * 0.143);
};

/* ---------------- UI ---------------- */
Tech.prototype.buildUI = function () {
  const st = document.createElement('style');
  st.textContent = '#techBtn{position:fixed;right:3vmin;top:31vmin;z-index:20;font:bold 2vmin monospace;color:#eaffe4;background:rgba(7,14,9,.7);border:2px solid rgba(150,255,120,.75);border-radius:2vmin;padding:1vmin 1.6vmin;cursor:pointer;display:none}'
    + '#techUI{position:fixed;right:2vmin;top:8vmin;bottom:8vmin;width:min(62vmin,96vw);z-index:35;background:rgba(2,8,4,.93);border:2px solid rgba(150,255,120,.7);border-radius:1.6vmin;color:#d8ffd0;font:1.8vmin monospace;display:none;flex-direction:column;padding:1.4vmin;box-shadow:0 0 3vmin rgba(120,255,100,.2)}'
    + '#techUI h3{margin:0 0 .6vmin;color:#9dff8a;letter-spacing:.18em;font-size:2.1vmin} #techUI .devs{display:flex;flex-wrap:wrap;gap:.6vmin;margin-bottom:.8vmin} #techUI button{font:bold 1.7vmin monospace;color:#d8ffd0;background:rgba(14,32,16,.9);border:1px solid rgba(150,255,120,.55);border-radius:.9vmin;padding:.6vmin 1vmin;cursor:pointer}'
    + '#techUI button.on{background:rgba(150,255,120,.3)} #techUI .tabs{display:flex;gap:.5vmin;margin-bottom:.8vmin} #techUI .body{flex:1;overflow:auto;min-height:0} #techUI .row{display:flex;align-items:center;gap:1vmin;margin:.35vmin 0} #techUI .lab{width:40%} #techUI .bar{flex:1;height:1.2vmin;background:rgba(255,255,255,.08);border-radius:.6vmin;overflow:hidden} #techUI .bar i{display:block;height:100%}'
    + '#techUI .val{width:24%;text-align:right} .t-ok{color:#9dff8a} .t-warn{color:#ffd166} .t-err{color:#ff6b6b} .t-cmd{color:#8fd8ff} #techUI textarea{width:100%;height:38%;background:#020a04;color:#d8ffd0;border:1px solid rgba(150,255,120,.4);font:1.8vmin monospace;resize:none;box-sizing:border-box}'
    + '#techUI .log{white-space:pre-wrap;background:#010502;border:1px solid rgba(150,255,120,.2);padding:.6vmin;margin-top:.6vmin;height:40%;overflow:auto} #techUI input{flex:1;background:#020a04;color:#d8ffd0;border:1px solid rgba(150,255,120,.4);font:1.8vmin monospace;padding:.6vmin} #techUI .funcs{display:flex;flex-wrap:wrap;gap:.6vmin} #techUI .man p{margin:.3vmin 0 .9vmin}';
  document.head.appendChild(st);
  const b = this.btn = document.createElement('button'); b.id = 'techBtn'; b.textContent = '🔧 TECNICO';
  const go = e => { e.preventDefault(); e.stopPropagation(); this.toggle(); }; b.addEventListener('click', go); b.addEventListener('touchstart', go); document.body.appendChild(b);
  const ui = this.ui = document.createElement('div'); ui.id = 'techUI'; document.body.appendChild(ui);
  ui.innerHTML = '<h3>🔧 KAGE TECH · TABLET DEL TECNICO</h3><div class="devs"></div><div class="tabs"></div><div class="body"></div>';
  ['pointerdown', 'touchstart', 'mousedown', 'click', 'wheel'].forEach(ev => ui.addEventListener(ev, e => e.stopPropagation()));
  ['keydown', 'keyup'].forEach(ev => ui.addEventListener(ev, e => { if (/INPUT|TEXTAREA/.test(e.target.tagName)) { e.stopPropagation(); if (ev === 'keydown' && e.code === 'Escape') e.target.blur(); } }));
  ui.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return; const ds = t.dataset;
    if (ds.dev) { this.cur = this.D.find(d => d.id === ds.dev); this.render(true); }
    else if (ds.tab) { this.tab = ds.tab; this.render(true); }
    else if (ds.fn && this.cur) { this.exec(this.cur, ds.fn); this.render(true); }
    else if (ds.act === 'run' && this.cur) { this.saveProg(); this.start(this.cur, this.st.progs[this.cur.id] || ''); }
    else if (ds.act === 'stop') { if (this.run) this.print('■ fermato', 'warn'); this.run = null; }
    else if (ds.act === 'save' && this.cur) { this.saveProg(); this.print('programma salvato', 'ok'); }
    else if (ds.act === 'auto' && this.cur) { this.st.auto[this.cur.id] = !this.st.auto[this.cur.id]; this.save(); this.render(true); }
    else if (ds.act === 'ex' && this.cur) { const ta = ui.querySelector('textarea'); if (ta) { ta.value = this.example(this.cur); this.saveProg(); } }
    else if (ds.act === 'diag' && this.cur) { this.exec(this.cur, 'DIAG'); }
    else if (ds.act === 'close') this.toggle(); });
};
Tech.prototype.saveProg = function () { const ta = this.ui.querySelector('textarea'); if (ta && this.cur) { this.st.progs[this.cur.id] = ta.value; this.save(); } };
Tech.prototype.example = function (d) {
  const f = Object.keys(this.funcs(d));
  if (d.id === 'gt') return '# benvenuto: quando arrivi la GT ti accoglie\nFARI ON\nAPRI PORTE\nATTENDI 4\nRIPETI 3\n  CLACSON\n  ATTENDI 0.6\nFINE\nCHIUDI PORTE';
  if (d.id === 'odyssey') return '# giro di controllo della nave\nSTATO\nNUCLEO BOOST\nATTENDI 3\nREPLICA\nRISVEGLIA 2\nATTENDI 10\nSTASI';
  return '# programma di prova\nSTATO\n' + f.slice(0, 2).join('\nATTENDI 2\n') + '\nATTENDI 2\nSUONA';
};
Tech.prototype.renderLog = function () { const el = this.ui.querySelector('.log'); if (!el) return; el.innerHTML = this.log.map(([s, c]) => '<div class="' + (c ? 't-' + c : '') + (c === 'cmd' || /«|›/.test(s) || /^  [A-Z]/.test(s) ? ' notr' : '') + '">' + esc(s) + '</div>').join(''); el.scrollTop = el.scrollHeight; };
Tech.prototype.render = function (full) {
  const ui = this.ui, inR = this.inRange();
  if (!this.cur || !inR.includes(this.cur)) this.cur = inR[0] || null;
  if (full) {
    ui.querySelector('.devs').innerHTML = inR.length ? inR.map(d => '<button data-dev="' + d.id + '" class="' + (d === this.cur ? 'on' : '') + '">' + d.icon + ' ' + esc(this.dname(d)) + (this.faults(d).length ? ' ⚠' : '') + '</button>').join('')
      : '<span class="t-warn">Nessun dispositivo in portata. Avvicinati alla KAGE GT, al veicolo parcheggiato, al KAGE XENO, all’EPOCH nel garage, alla console del NEXUS o sali sulla KAGE ODYSSEY.</span>';
    ui.querySelector('.tabs').innerHTML = [['stato', 'TELEMETRIA'], ['funz', 'FUNZIONI'], ['prog', 'PROGRAMMA'], ['diag', 'DIAGNOSI'], ['console', 'CONSOLE'], ['man', 'MANUALE']].map(([k, l]) => '<button data-tab="' + k + '" class="' + (this.tab === k ? 'on' : '') + '">' + l + '</button>').join('') + '<button data-act="close" style="margin-left:auto">✕</button>';
  }
  const body = ui.querySelector('.body'), d = this.cur;
  if (this.tab === 'man') { if (full) body.innerHTML = '<div class="man"><p class="t-ok">Ogni guasto ha un codice. DIAG lo trova, qui trovi la procedura. Riparazioni fatte: ' + this.st.fixed + '</p>' + CODES.map(c => '<p><b class="t-err">' + c + ' · ' + FAULTS[c].t + '</b><br>' + FAULTS[c].d + '<br><span class="t-cmd">' + FAULTS[c].how + '</span></p>').join('') + '<p><b>KAGE SCRIPT</b><br><span class="notr">' + HELP.map(esc).join('<br>') + '</span></p></div>'; return; }
  if (!d) { if (full) body.innerHTML = ''; return; }
  if (this.tab === 'stato') { body.innerHTML = '<div class="t-ok" style="margin-bottom:.6vmin">' + esc(this.dname(d)) + ' · collegato · ' + (this.faults(d).length ? '<span class="t-err">' + this.faults(d).length + ' guasto/i: apri DIAGNOSI</span>' : 'nessun allarme') + '</div>'
    + d.sensors.map(s => { const v = this.read(d, s), stt = this.state(d, s, v), k = clamp((v - s[3]) / (s[4] - s[3]), 0, 1), col = stt === 'ok' ? '#9dff8a' : stt === 'warn' ? '#ffd166' : '#ff6b6b';
      return '<div class="row"><span class="lab">' + esc(s[1]) + ' <small class="notr" style="opacity:.5">' + s[0] + '</small></span><span class="bar"><i style="width:' + (k * 100).toFixed(0) + '%;background:' + col + '"></i></span><span class="val t-' + stt + '">' + fmt(v) + ' ' + esc(s[2]) + '</span></div>'; }).join(''); return; }
  if (!full) { return; }
  if (this.tab === 'funz') { body.innerHTML = '<div class="funcs notr">' + Object.keys(this.funcs(d)).map(k => '<button data-fn="' + esc(k) + '">' + esc(k) + '</button>').join('') + '<button data-fn="SUONA">SUONA</button><button data-fn="STATO">STATO</button></div><div class="log"></div>'; this.renderLog(); return; }
  if (this.tab === 'prog') { body.innerHTML = '<div class="t-cmd" style="margin-bottom:.4vmin">KAGE SCRIPT · un comando per riga · ATTENDI s · RIPETI n … FINE · # commento</div><textarea spellcheck="false"></textarea>'
    + '<div class="row"><button data-act="run">▶ ESEGUI</button><button data-act="stop">■ STOP</button><button data-act="save">💾 SALVA</button><button data-act="ex">ESEMPIO</button><button data-act="auto" class="' + (this.st.auto[d.id] ? 'on' : '') + '">' + (this.st.auto[d.id] ? '◉' : '○') + ' AVVIO AUTOMATICO</button></div>'
    + '<div class="t-cmd notr">' + esc(Object.keys(this.funcs(d)).join(' · ')) + '</div><div class="log"></div>';
    const ta = body.querySelector('textarea'); ta.value = this.st.progs[d.id] || this.example(d); ta.addEventListener('input', () => this.saveProg()); this.renderLog(); return; }
  if (this.tab === 'diag') { body.innerHTML = '<div class="row"><button data-act="diag">🩺 AVVIA DIAGNOSI</button><span>Codici: vedi MANUALE · le riparazioni si fanno dalla CONSOLE</span></div><div class="log" style="height:75%"></div>'; this.renderLog(); return; }
  if (this.tab === 'console') { body.innerHTML = '<div class="log" style="height:82%"></div><div class="row"><span class="t-ok notr">' + esc(d.id) + '›</span><input placeholder="scrivi un comando (AIUTO)" spellcheck="false"></div>'; this.renderLog();
    const inp = body.querySelector('input'); inp.addEventListener('keydown', e => { if (e.code === 'Enter' || e.key === 'Enter') { e.preventDefault(); const v = inp.value; inp.value = ''; if (this.cur) { const r = this.exec(this.cur, v); void r; } } }); setTimeout(() => inp.focus(), 30); return; }
};

window.KageTech = Tech; window.KageTechFaults = FAULTS;
})();
