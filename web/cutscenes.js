/* KAGE SCENES · illustrated 2D scenes between the chapters (the same style as the prologue), each with something to touch:
 *  II→III  L’OFFICINA DI ARIA   — night workshop, the GT with the bonnet up, a fault on the hologram, the toolbox
 *  III→IV  IL LUCERNARIO        — the garage at night, the ODYSSEY crossing the clouds above the skylight, the badge
 *  V→VI    LA ROTTA             — on the ODYSSEY bridge: trace the signal's glyph on the star map to find the colony
 *  VII→VIII IL QUADERNO         — a dream: your bedroom, the journal writes itself in the Custodians' letters
 *  FINE    L’ALBA SU CYBERCITY  — the garage roof at dawn, ECO blooming, credits, and a choice: stay, or go home
 * Each scene: thoughts / dialogue at the bottom, hotspots to tap, a skip button. Replayable from 📜 Missioni. */
(function () {
'use strict';
const KF = window.KageFleet, PI = Math.PI, TAU = PI * 2, VW = 1600, VH = 900;
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const inR = (p, x, y, w, h) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
const glyph = (c, seed, cx, cy, size, col) => { if (!KF || !KF.glyphStrokes) return; const G = KF.glyphStrokes(seed), u = size / 3; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(2, size * 0.09); c.lineCap = 'round'; c.beginPath(); for (const [ax, ay, bx, by] of G.segs) { c.moveTo(cx + (ax - 1) * u, cy - (ay - 1.5) * u); c.lineTo(cx + (bx - 1) * u, cy - (by - 1.5) * u); } c.stroke(); if (G.dot) c.fillRect(cx - u * 0.25, cy - (G.dot[1] - 1.5) * u - u * 0.25, u * 0.5, u * 0.5); };
// a person in silhouette (ARIA, VEGA): body + head + hair, facing the viewer
const person = (c, x, y, s, col, hair, extra) => { c.fillStyle = col; rr(c, x - 34 * s, y - 150 * s, 68 * s, 150 * s, 26 * s); c.fill(); c.fillStyle = '#d9a27a'; c.beginPath(); c.arc(x, y - 178 * s, 26 * s, 0, TAU); c.fill(); c.fillStyle = hair; c.beginPath(); c.arc(x, y - 186 * s, 27 * s, PI, 0); c.fill(); if (extra) extra(c, x, y, s); };

const SCENES = {
  officina: { title: 'L’OFFICINA DI ARIA', at: 2,
    intro: ['ARIA: Eccoti. Guarda la tua GT: il segnale le ha mandato in tilt la centralina.', 'ARIA: Non sono solo le pietre a parlare. Il segnale entra in tutto ciò che ha un cervello elettronico.', 'Sul banco c’è una cassetta degli attrezzi. E un ologramma lampeggia, rosso.'],
    init: s => { s.holo = 0; s.box = 0; s.hood = 0; },
    tap(p, s, R) {
      if (inR(p, 1010, 180, 300, 200)) { s.holo = 1; R.blip(880, 440, 0.2, 0.08, 'square'); R.say(['E-104 · SENSORE FUORI SCALA. La temperatura dell’olio dice 544 gradi.', 'ARIA: Impossibile, il motore è freddo. È il sensore che mente: va calibrato.']); return; }
      if (inR(p, 250, 560, 260, 150)) { s.box = 1; R.blip(400, 800, 0.3, 0.1, 'triangle'); R.say(['Dentro la cassetta c’è un modulo nuovo per il tablet: KAGE TECH.', 'ARIA: Con quello parli con le macchine. Diagnosi, funzioni, programmi. Te lo installo.']); return; }
      if (inR(p, 600, 360, 420, 260)) { s.hood = 1; R.say(['Il motore della GT. Pulito, freddo, perfetto. Eppure qualcosa dentro di lei crede di bruciare.']); return; }
      R.say(['Il banco, gli attrezzi, l’ologramma, la GT col cofano alzato.']); },
    done: s => s.holo && s.box, outro: ['ARIA: Ora tocca a te. Apri KAGE TECH, fai DIAG e segui il manuale.'],
    draw(c, t, s) {
      let g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#12141f'); g.addColorStop(1, '#262033'); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      c.fillStyle = '#1b1a24'; c.fillRect(0, 700, VW, 200); c.strokeStyle = 'rgba(0,255,226,.15)'; c.lineWidth = 2; for (let x = -200; x < VW; x += 120) { c.beginPath(); c.moveTo(x, 700); c.lineTo(x + 260, 900); c.stroke(); }
      // pegboard with tools
      c.fillStyle = '#2b2a36'; c.fillRect(80, 120, 520, 360); c.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) c.fillRect(100 + i * 42, 140 + j * 42, 6, 6);
      c.strokeStyle = '#9aa3b5'; c.lineWidth = 8; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(150 + k * 90, 180); c.lineTo(150 + k * 90, 300 + (k % 2) * 60); c.stroke(); }
      // lamp cone
      glow(c, 800, 120, 520, 'rgba(255,220,160,0.16)'); c.fillStyle = '#3a3a44'; c.beginPath(); c.moveTo(760, 60); c.lineTo(840, 60); c.lineTo(870, 110); c.lineTo(730, 110); c.fill();
      // the GT, side view, bonnet up
      c.fillStyle = '#0d0f16'; c.beginPath(); c.moveTo(560, 600); c.lineTo(620, 520); c.lineTo(760, 470); c.lineTo(980, 460); c.lineTo(1100, 520); c.lineTo(1140, 600); c.closePath(); c.fill();
      c.strokeStyle = '#ff4fa0'; c.lineWidth = 4; c.beginPath(); c.moveTo(600, 560); c.lineTo(1120, 560); c.stroke(); c.strokeStyle = '#00ffe2'; c.beginPath(); c.moveTo(640, 590); c.lineTo(1110, 590); c.stroke();
      c.fillStyle = '#1a1d27'; c.save(); c.translate(1000, 470); c.rotate(-0.9 - (s.hood ? 0.1 : 0)); c.fillRect(0, -6, 150, 12); c.restore();
      for (const x of [680, 1030]) { c.fillStyle = '#05060a'; c.beginPath(); c.arc(x, 610, 52, 0, TAU); c.fill(); c.strokeStyle = '#00ffe2'; c.lineWidth = 3; c.beginPath(); c.arc(x, 610, 34, 0, TAU); c.stroke(); }
      // hologram with the fault
      const hp = 0.6 + 0.4 * Math.sin(t * 6); c.fillStyle = s.holo ? 'rgba(80,255,200,.12)' : 'rgba(255,60,80,' + 0.14 * hp + ')'; rr(c, 1010, 180, 300, 200, 18); c.fill(); c.strokeStyle = s.holo ? '#5effc8' : 'rgba(255,90,100,' + hp + ')'; c.lineWidth = 3; c.stroke();
      c.font = 'bold 34px monospace'; c.fillStyle = c.strokeStyle; c.textAlign = 'center'; c.fillText(s.holo ? 'E-104' : '⚠', 1160, 270); c.font = '20px monospace'; c.fillText(s.holo ? 'SENSORE · TEMP' : 'GUASTO', 1160, 320);
      // toolbox
      c.fillStyle = '#b8282e'; c.fillRect(250, 600, 260, 110); c.fillStyle = '#8a1c20'; c.fillRect(250, 590, 260, 22); c.fillStyle = '#ddd'; c.fillRect(350, 570, 60, 14); if (!s.box) glow(c, 380, 640, 120, 'rgba(0,255,226,' + 0.12 * hp + ')');
      // ARIA
      person(c, 1380, 700, 1.25, '#1b4fc2', '#120c0c', (c2, x, y, k) => { c2.fillStyle = '#ff96d2'; c2.fillRect(x - 34 * k, y - 120 * k, 68 * k, 6 * k); });
    } },
  lucernario: { title: 'IL LUCERNARIO', at: 3,
    intro: ['È notte. Il KAGE GARAGE è vuoto, a parte il ronzio dell’EPOCH.', 'Sopra il lucernario le nuvole si muovono. E qualcosa, sopra le nuvole, si muove con loro.'],
    init: s => { s.sky = 0; s.badge = 0; },
    tap(p, s, R) {
      if (inR(p, 380, 40, 840, 300)) { s.sky = 1; R.blip(200, 300, 0.6, 0.05, 'sine'); R.say(['Luci di posizione. Una sagoma lunga, lentissima.', '«Cercate la nave sopra le nuvole.» È lei. La KAGE ODYSSEY.']); return; }
      if (inR(p, 640, 470, 320, 300)) { if (!s.sky) { R.say(['Una teca col modellino di una nave. E una spilla esagonale che brilla.']); return; } s.badge = 1; R.blip(660, 1320, 0.5, 0.1, 'triangle'); R.say(['La spilla è calda. Al centro c’è un chevron di luce.', 'Appena la tocco, un sussurro nell’orecchio: «Teletrasporto pronto».']); return; }
      R.say(['La teca, il modellino, il lucernario.']); },
    done: s => s.badge, outro: ['VEGA: Ti vedo, pilota. Indossa il badge e premi BEAM IN. Ti aspetto in plancia.'], end: g => { if (g.star) { g.star.badge = true; LS.set('kageBadge', '1'); } },
    draw(c, t, s) {
      c.fillStyle = '#07080e'; c.fillRect(0, 0, VW, VH);
      // skylight: night sky, clouds, the ship crossing
      c.save(); rr(c, 380, 40, 840, 300, 10); c.clip(); let g = c.createLinearGradient(0, 40, 0, 340); g.addColorStop(0, '#04081a'); g.addColorStop(1, '#1b2550'); c.fillStyle = g; c.fillRect(380, 40, 840, 300);
      for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.7 * ((i * 37) % 10) / 10) + ')'; c.fillRect(380 + (i * 131) % 840, 40 + (i * 71) % 200, 2, 2); }
      const sx = 380 + ((t * 18) % 1300) - 220; c.fillStyle = '#c8ccd6'; c.beginPath(); c.ellipse(sx, 150, 130, 22, 0, 0, TAU); c.fill(); c.fillRect(sx - 160, 170, 70, 10); c.fillRect(sx + 90, 170, 70, 10); c.fillStyle = '#3ad8ff'; c.fillRect(sx - 160, 168, 70, 4); c.fillRect(sx + 90, 168, 70, 4);
      for (const [dx, col] of [[-130, '#ff3a3a'], [130, '#3aff7a']]) { c.fillStyle = Math.sin(t * 5) > 0 ? col : 'rgba(0,0,0,0)'; c.beginPath(); c.arc(sx + dx, 150, 5, 0, TAU); c.fill(); }
      for (let k = 0; k < 6; k++) { const cx = 380 + ((k * 260 + t * 30) % 1200) - 120; c.fillStyle = 'rgba(160,170,200,.35)'; c.beginPath(); c.ellipse(cx, 260 + (k % 2) * 30, 200, 40, 0, 0, TAU); c.fill(); }
      c.restore(); c.strokeStyle = '#2a3040'; c.lineWidth = 16; rr(c, 380, 40, 840, 300, 10); c.stroke(); c.lineWidth = 8; for (const x of [590, 800, 1010]) { c.beginPath(); c.moveTo(x, 40); c.lineTo(x, 340); c.stroke(); }
      glow(c, 800, 340, 600, 'rgba(90,120,220,0.18)');
      // walls, neon strip, the EPOCH glow far right
      c.fillStyle = '#0c0e16'; c.fillRect(0, 400, VW, 500); c.fillStyle = '#00ffe2'; c.fillRect(0, 760, VW, 4); glow(c, 1450, 600, 300, 'rgba(255,170,60,0.18)');
      // the display case with the miniature and the badge
      c.fillStyle = '#1a1d27'; c.fillRect(660, 700, 280, 80); c.fillStyle = 'rgba(160,220,255,.12)'; c.fillRect(640, 470, 320, 240); c.strokeStyle = 'rgba(160,220,255,.4)'; c.lineWidth = 3; c.strokeRect(640, 470, 320, 240);
      c.fillStyle = '#c8ccd6'; c.beginPath(); c.ellipse(800, 560, 90, 16, Math.sin(t * 0.5) * 0.1, 0, TAU); c.fill();
      if (!s.badge) { const b = 0.6 + 0.4 * Math.sin(t * 3); glow(c, 800, 650, 90, 'rgba(0,255,220,' + 0.35 * b + ')'); c.fillStyle = '#d8a43a'; c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + PI / 6; c.lineTo(800 + Math.cos(a) * 26, 650 + Math.sin(a) * 26); } c.fill(); c.fillStyle = 'rgba(0,255,220,' + b + ')'; c.beginPath(); c.moveTo(800, 634); c.lineTo(786, 660); c.lineTo(800, 652); c.lineTo(814, 660); c.fill(); }
    } },
  rotta: { title: 'LA ROTTA', at: 5,
    intro: ['VEGA: Il nucleo regge. Adesso dobbiamo capire da dove viene il segnale.', 'VEGA: I sensori vedono solo stelle. Ma il segnale ha una forma: è un glifo. Se lo ritrovi tra le stelle, abbiamo la rotta.', 'Tocca le stelle una dopo l’altra per ridisegnare il glifo del segnale.'],
    init: s => { s.seq = []; s.ok = 0; s.seed = 5 * 7 + 3; },
    tap(p, s, R) {
      if (s.ok) return; if (inR(p, 1240, 700, 220, 80)) { s.seq = []; R.blip(300, 200, 0.1, 0.05); return; }
      const P = STARS.findIndex(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 46); if (P < 0) return;
      if (s.seq.length && s.seq[s.seq.length - 1] === P) return; s.seq.push(P); R.blip(700 + P * 60, 900 + P * 60, 0.1, 0.06, 'triangle');
      const want = segsOf(s.seed), have = new Set(); for (let i = 1; i < s.seq.length; i++) { const a = s.seq[i - 1], b = s.seq[i]; have.add(Math.min(a, b) + '-' + Math.max(a, b)); }
      if ([...have].some(k => !want.has(k))) { R.buzz(); R.note('NON È LA FORMA DEL SEGNALE · RIPROVA'); s.seq = [P]; s.fails = (s.fails || 0) + 1; return; }
      if (have.size === want.size) { s.ok = 1; R.blip(520, 1560, 0.8, 0.12, 'triangle'); R.say(['VEGA: Eccola! Il glifo indica un sistema a 37 anni luce.', 'VEGA: La colonia aliena ZHAR’UL. Imposto la rotta.']); } },
    done: s => s.ok, outro: ['VEGA: Rotta impostata. Quando vuoi, dalla plancia: INGRANA.'], end: g => { if (g.star && g.star.ship) g.star.ship.course = 'colonia'; },
    draw(c, t, s) {
      c.fillStyle = '#03040a'; c.fillRect(0, 0, VW, VH); for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(255,255,255,' + (0.2 + 0.6 * ((i * 53) % 10) / 10) + ')'; c.fillRect((i * 97) % VW, (i * 61) % 660, 2, 2); }
      // the viewscreen frame + the bridge's consoles below
      c.strokeStyle = '#d8a43a'; c.lineWidth = 10; rr(c, 60, 40, 1480, 640, 30); c.stroke(); c.fillStyle = '#10131c'; c.fillRect(0, 690, VW, 210); c.fillStyle = '#ffb060'; for (let k = 0; k < 20; k++) { c.globalAlpha = 0.4 + 0.6 * (Math.sin(t * 3 + k) > 0); c.fillRect(120 + k * 70, 740, 30, 8); } c.globalAlpha = 1;
      // the signal's glyph (reference), with a hint after a while
      c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, 1210, 80, 280, 260, 20); c.fill(); c.font = 'bold 18px monospace'; c.fillStyle = '#7fffd0'; c.textAlign = 'center'; c.fillText('FIRMA DEL SEGNALE', 1350, 115); glyph(c, s.seed, 1350, 225, 120, '#7fffd0');
      // the stars you connect
      const want = segsOf(s.seed);
      if (!s.ok && (s.fails || 0) >= 2) { c.strokeStyle = 'rgba(127,255,208,.12)'; c.lineWidth = 3; for (const k of want) { const [a, b] = k.split('-').map(Number); c.beginPath(); c.moveTo(...STARS[a]); c.lineTo(...STARS[b]); c.stroke(); } }
      c.strokeStyle = s.ok ? '#7fffd0' : '#ffd27a'; c.lineWidth = 5; c.beginPath(); s.seq.forEach((i, k) => k ? c.lineTo(...STARS[i]) : c.moveTo(...STARS[i])); c.stroke();
      STARS.forEach((q, i) => { glow(c, q[0], q[1], 46, s.seq.includes(i) ? 'rgba(255,220,140,.5)' : 'rgba(180,210,255,.3)'); c.fillStyle = '#fff'; c.beginPath(); c.arc(q[0], q[1], 7 + Math.sin(t * 2 + i) * 1.5, 0, TAU); c.fill(); });
      if (s.ok) { glow(c, 800, 360, 300, 'rgba(160,90,255,.35)'); c.font = 'bold 40px system-ui'; c.fillStyle = '#e8d8ff'; c.fillText('ZHAR’UL · 37 anni luce', 800, 620); }
      c.fillStyle = 'rgba(255,255,255,.12)'; rr(c, 1240, 700, 220, 80, 16); c.fill(); c.fillStyle = '#fff'; c.font = '22px system-ui'; c.fillText('↺ ricomincia', 1350, 748);
      person(c, 220, 900, 1.3, '#d8a43a', '#2a1a3a');
    } },
  quaderno: { title: 'IL QUADERNO', at: 7,
    intro: ['…', 'È la mia camera. Ma la luce è sbagliata: azzurra, come i glifi.', 'Il quaderno dei sogni è aperto sul letto. Le pagine si muovono da sole.'],
    init: s => { s.open = 0; s.w = 0; },
    tap(p, s, R) { if (!s.open && inR(p, 500, 420, 600, 360)) { s.open = 1; s.w = 0; s.t0 = R.t; R.blip(300, 900, 1.2, 0.08, 'sine'); R.say(['Una frase si scrive da sola, lettera per lettera.', 'Prima in glifi… poi, piano, le lettere diventano le mie.']); return; } if (s.open && s.w < 1) { s.t0 = R.t - 6; return; } if (s.open) { s.read = 1; R.say(['«CHI LEGGE QUESTE PAROLE È GIÀ UNO DI NOI.»', 'Non è un messaggio per me. È un messaggio che ho scritto io.']); } },
    done: s => s.read, outro: ['Mi sveglio. Ho il seme in mano, e pulsa come un cuore.'],
    draw(c, t, s) {
      if (window.KagePrologue) { try { const o = Object.create(KagePrologue.prototype); o.st = { phone: 1 }; o.drawBed(c, t); } catch (e) { } }
      c.fillStyle = 'rgba(20,80,120,.55)'; c.fillRect(0, 0, VW, VH); glow(c, 800, 600, 700, 'rgba(80,255,210,.18)');
      for (let i = 0; i < 40; i++) { const a = t * 0.2 + i, x = 800 + Math.cos(a * 1.3) * (200 + i * 15), y = 400 + Math.sin(a) * (120 + i * 5); glyph(c, (i % 21) * 7 + 3, x, y, 16, 'rgba(120,255,220,' + (0.15 + 0.15 * Math.sin(t + i)) + ')'); }
      // the journal, big and open
      c.fillStyle = '#efe6cf'; c.save(); c.translate(800, 600); c.rotate(-0.04); rr(c, -300, -180, 600, 360, 10); c.fill(); c.strokeStyle = '#c9bea2'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -180); c.lineTo(0, 180); c.stroke();
      if (s.open) { s.w = Math.min(1, (t - (s.t0 || 0)) / 5); const M = window.KageGlyph, txt = 'CHI LEGGE QUESTE PAROLE E GIA UNO DI NOI', n = Math.floor(txt.length * s.w), rows = ['CHI LEGGE QUESTE', 'PAROLE E GIA', 'UNO DI NOI'];
        let k = 0; rows.forEach((row, j) => { [...row].forEach((ch, i) => { const x = -270 + i * 34 + (j ? 0 : 0), y = -110 + j * 70; if (k++ >= n) return; if (ch === ' ') return; const age = (n - k) / txt.length;
          if (age < 0.25 && M) glyph(c, M.seedOf(M.ALIEN[ch]), x + 12, y, 26, '#2d7a6a'); else { c.fillStyle = '#2d3a7a'; c.font = 'italic 32px Georgia,serif'; c.fillText(ch, x, y + 12); } }); }); }
      else { c.fillStyle = 'rgba(45,58,122,.35)'; c.font = 'italic 26px Georgia,serif'; c.textAlign = 'center'; c.fillText('tocca il quaderno', 0, 10); }
      c.restore();
    } },
  alba: { title: 'L’ALBA SU CYBERCITY', at: 8,
    intro: ['L’alba. Siamo sul tetto del KAGE GARAGE.', 'ARIA: Guarda verso ECO. Si sta illuminando: il seme ha attecchito.', 'VEGA (ologramma): I Custodi non chiedevano aiuto. Chiedevano qualcuno che sapesse leggere.', 'ARIA: E adesso? L’EPOCH può riportarti a casa. Oppure…'],
    init: s => { s.choice = null; s.cred = 0; },
    tap(p, s, R) { if (s.choice) { if (s.choice === 'casa' && !s.home) { s.home = 1; R.say(['La mia cucina. Il frigorifero è tornato al suo posto.', 'Sullo sportello c’è una calamita a forma di glifo. Non ce l’avevo mai messa.', 'Sorrido. La cabina tornerà, quando servirà.']); return; } s.fin = 1; return; }
      if (inR(p, 380, 720, 360, 100)) { s.choice = 'resta'; R.blip(523, 1046, 0.5, 0.1, 'triangle'); R.say(['Resto. C’è ancora tanto da leggere in questa città.', 'ARIA: Allora benvenuto davvero, pilota.']); return; }
      if (inR(p, 860, 720, 360, 100)) { s.choice = 'casa'; R.blip(392, 784, 0.5, 0.1, 'triangle'); R.say(['Torno a casa. Per un po’.', 'ARIA: L’EPOCH ti aspetterà nel garage. Sempre.']); return; } },
    done: s => s.fin || (s.choice === 'resta' && !R0.cur), outro: ['✦ FINE · IL SEGNALE DEI CUSTODI ✦', 'Cybercity è tua: tutto è sbloccato. Grazie per aver giocato.'], end: g => { if (g.story) { g.story.st.free = 1; g.story.save(); } },
    draw(c, t, s) {
      if (s.choice === 'casa' && s.home && window.KagePrologue) { try { const o = Object.create(KagePrologue.prototype); o.st = { coffee: 1 }; o.drawCabin = () => { }; o.drawKitchen(c, t); c.fillStyle = '#e8e6e0'; c.fillRect(1080, 70, 340, 740); c.fillStyle = '#cfcbc0'; c.fillRect(1090, 360, 320, 6); c.fillStyle = '#bbb'; c.fillRect(1100, 200, 14, 120); glyph(c, 38, 1250, 250, 46, '#18b38a'); } catch (e) { } return; }
      let g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#2a3c7a'); g.addColorStop(0.5, '#f08a6a'); g.addColorStop(0.75, '#ffd08a'); g.addColorStop(1, '#ffe8b8'); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      // ECO blooming: green aurora
      for (let k = 0; k < 5; k++) { c.strokeStyle = 'rgba(80,255,170,' + (0.12 + 0.06 * Math.sin(t + k)) + ')'; c.lineWidth = 40; c.beginPath(); for (let x = 0; x <= VW; x += 40) c.lineTo(x, 120 + k * 30 + Math.sin(x * 0.006 + t * 0.6 + k) * 40); c.stroke(); }
      glow(c, 1150, 520, 260, 'rgba(255,230,160,.9)');
      // the skyline with neon
      c.fillStyle = '#16142a'; for (let i = 0; i < 26; i++) { const x = i * 64, h = 90 + ((i * 97) % 170) * (Math.abs(i - 18) < 3 ? 0.4 : 1); c.fillRect(x, 640 - h, 58, h); c.fillStyle = ['#ff4fa0', '#00ffe2', '#ffb060'][i % 3]; c.globalAlpha = 0.6; c.fillRect(x + 6, 640 - h + 20, 46, 3); c.globalAlpha = 1; c.fillStyle = '#16142a'; }
      c.fillStyle = '#0e0c18'; c.fillRect(0, 640, VW, 260); c.fillStyle = '#00ffe2'; c.fillRect(0, 640, VW, 4);
      person(c, 300, 640, 1.4, '#1b4fc2', '#120c0c'); c.globalAlpha = 0.55 + 0.15 * Math.sin(t * 8); person(c, 1300, 640, 1.3, '#4fb4ff', '#2a1a3a'); c.globalAlpha = 1;
      if (!s.choice && !R0.cur) { for (const [x, l] of [[380, '🌆 RESTA A CYBERCITY'], [860, '🏠 TORNA A CASA']]) { c.fillStyle = 'rgba(6,10,20,.75)'; rr(c, x, 720, 360, 100, 22); c.fill(); c.strokeStyle = '#ffd27a'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#fff2c8'; c.font = 'bold 30px system-ui'; c.textAlign = 'center'; c.fillText(l, x + 180, 782); } }
    } } };
let R0 = null;   // the runner (scenes read R0.cur)
// star map: the glyph grid (3 × 3 points of the 3 × 4 glyph grid) spread over the viewscreen, plus decoy stars
const GRID = [[0, 0], [1, 0], [2, 0], [0, 1.5], [1, 1.5], [2, 1.5], [0, 3], [1, 3], [2, 3]];
const STARS = GRID.map(([x, y], i) => [460 + x * 230 + ((i * 37) % 40) - 20, 560 - y * 150 + ((i * 53) % 30) - 15]);
const segsOf = seed => { const G = KF.glyphStrokes(seed), out = new Set(); for (const [ax, ay, bx, by] of G.segs) { const a = GRID.findIndex(q => q[0] === ax && q[1] === ay), b = GRID.findIndex(q => q[0] === bx && q[1] === by); if (a >= 0 && b >= 0 && a !== b) out.add(Math.min(a, b) + '-' + Math.max(a, b)); } return out; };

function Cuts(game) {
  this.g = game; this.on = false; R0 = this;
  this.cvs = document.createElement('canvas'); this.cvs.id = 'cut';
  const css = document.createElement('style'); css.textContent = '#cut{position:fixed;inset:0;width:100%;height:100%;z-index:82;display:none;touch-action:none;background:#000;cursor:pointer} #cutSkip{position:fixed;right:2vmin;top:2vmin;z-index:83;display:none;font:600 1.8vmin system-ui;color:#fff;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.35);border-radius:2vmin;padding:.8vmin 1.6vmin;cursor:pointer}';
  document.head.appendChild(css); document.body.appendChild(this.cvs);
  const sk = this.skip = document.createElement('button'); sk.id = 'cutSkip'; sk.textContent = 'SALTA LA SCENA ⏭'; document.body.appendChild(sk); sk.addEventListener('click', e => { e.stopPropagation(); this.finish(); });
  this.cvs.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.tap(e); });
  addEventListener('keydown', e => { if (!this.on) return; e.stopImmediatePropagation(); if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.advance(); } if (e.code === 'Escape') this.finish(); }, true);
  addEventListener('resize', () => this.fit());
}
Cuts.prototype.has = function (id) { return !!SCENES[id]; };
Cuts.prototype.forChapter = function (n) { return Object.keys(SCENES).find(k => SCENES[k].at === n) || null; };
Cuts.prototype.list = function () { return Object.entries(SCENES).map(([k, v]) => ({ id: k, title: v.title, at: v.at })); };
Cuts.prototype.play = function (id, done) {
  const S = SCENES[id]; if (!S) { if (done) done(); return; } this.id = id; this.S = S; this.st = {}; S.init(this.st); this.doneCb = done; this.on = true; this.ended = false; this.t = 0;
  this.cvs.style.display = 'block'; this.skip.style.display = 'block'; document.body.classList.add('photomode'); this.fit(); this.say(S.intro); this.titleT = 2.6; this.loop();
  try { const seen = JSON.parse(LS.get('kageScenes', '[]')); if (!seen.includes(id)) { seen.push(id); LS.set('kageScenes', JSON.stringify(seen)); } } catch (e) { }
};
Cuts.prototype.seen = function () { try { return JSON.parse(LS.get('kageScenes', '[]')); } catch (e) { return []; } };
Cuts.prototype.fit = function () { const c = this.cvs, d = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * d; c.height = innerHeight * d; const k = Math.min(c.width / VW, c.height / VH); this.k = k; this.ox = (c.width - VW * k) / 2; this.oy = (c.height - VH * k) / 2; };
Cuts.prototype.say = function (L) { this.lines = (L || []).slice(); this.cur = this.lines.shift() || ''; this.shown = 0; this.lineT = 0; };
Cuts.prototype.note = function (s) { this.msg = s; this.msgT = 2.4; };
Cuts.prototype.blip = function (a, b, d, v, w) { if (!window.FleetAudio) return; if (!this.au) this.au = new FleetAudio(); this.au.start(); this.au.blip(a, b, d, v, w || 'sine'); };
Cuts.prototype.buzz = function () { this.blip(140, 110, 0.25, 0.12, 'square'); };
Cuts.prototype.advance = function () { if (this.cur && this.shown < this.cur.length) { this.shown = this.cur.length; return true; } if (this.lines.length) { this.cur = this.lines.shift(); this.shown = 0; return true; } if (this.cur) { this.cur = ''; this.check(); return true; } return false; };
Cuts.prototype.tap = function (e) { const r = this.cvs.getBoundingClientRect(), d = this.cvs.width / r.width, p = [((e.clientX - r.left) * d - this.ox) / this.k, ((e.clientY - r.top) * d - this.oy) / this.k];
  if (this.ended) { if (!this.advance()) this.finish(); return; }
  if (this.cur && this.advance()) return; this.S.tap(p, this.st, this); this.check(); };
Cuts.prototype.check = function () { if (!this.ended && !this.cur && this.S.done(this.st)) { this.ended = true; this.say(this.S.outro || []); if (!this.cur) this.finish(); } };
Cuts.prototype.finish = function () { if (!this.on) return; this.on = false; this.cvs.style.display = 'none'; this.skip.style.display = 'none'; document.body.classList.remove('photomode'); if (this.S.end) try { this.S.end(this.g); } catch (e) { } const cb = this.doneCb; this.doneCb = null; if (cb) cb(); };
Cuts.prototype.loop = function () {
  if (!this.on) return; requestAnimationFrame(() => this.loop()); const now = performance.now(), dt = Math.max(0, Math.min(0.05, (now - (this.last || now)) / 1000)); this.last = now; this.t += dt; this.titleT -= dt; this.msgT = (this.msgT || 0) - dt;
  if (this.cur && this.shown < this.cur.length) this.shown = Math.min(this.cur.length, this.shown + dt * 38); else if (this.cur && this.lines.length) { this.lineT += dt; if (this.lineT > 2.4) { this.lineT = 0; this.cur = this.lines.shift(); this.shown = 0; } }
  if (this.ended && !this.cur && !this.lines.length) { this.endT = (this.endT || 0) + dt; if (this.endT > 1.2) { this.endT = 0; this.finish(); return; } } else this.endT = 0;
  this.draw();
};
Cuts.prototype.draw = function () {
  const c = this.cvs.getContext('2d'), W = this.cvs.width, H = this.cvs.height; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(this.ox, this.oy); c.scale(this.k, this.k); c.beginPath(); c.rect(0, 0, VW, VH); c.clip(); c.textAlign = 'left'; this.S.draw(c, this.t, this.st); c.restore();
  if (this.titleT > 0) { const a = Math.min(1, this.titleT); c.globalAlpha = a; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, H * 0.06, W, H * 0.11); c.fillStyle = '#ffe08a'; c.textAlign = 'center'; c.font = '300 ' + Math.round(H * 0.06) + 'px Georgia,serif'; c.fillText(this.S.title, W / 2, H * 0.14); c.globalAlpha = 1; }
  if (this.cur) { const txt = this.cur.slice(0, Math.floor(this.shown)), m = this.cur.match(/^([A-Z][A-Z ()a-zà]+): /), name = m ? m[1] : '', body = m ? txt.slice(m[0].length) : txt;
    c.textAlign = 'center'; c.font = (m ? '' : 'italic ') + Math.round(H * 0.034) + 'px Georgia,serif'; const w = Math.min(W * 0.92, c.measureText(m ? this.cur.slice(m[0].length) : this.cur).width + H * 0.08);
    c.fillStyle = 'rgba(0,0,0,.62)'; c.fillRect(W / 2 - w / 2, H * 0.84, w, H * 0.1); if (name) { c.font = 'bold ' + Math.round(H * 0.022) + 'px system-ui'; c.fillStyle = name.startsWith('ARIA') ? '#ffb4e2' : name.startsWith('VEGA') ? '#8fd6ff' : '#ffcf8a'; c.fillText(name, W / 2, H * 0.865); }
    c.font = (m ? '' : 'italic ') + Math.round(H * 0.034) + 'px Georgia,serif'; c.fillStyle = '#f4ecdc'; c.fillText(body, W / 2, H * (name ? 0.915 : 0.9)); }
  if (this.msgT > 0) { c.textAlign = 'center'; c.font = 'bold ' + Math.round(H * 0.03) + 'px monospace'; c.fillStyle = '#ff7060'; c.fillText(this.msg, W / 2, H * 0.22); }
  c.textAlign = 'left';
};
window.KageCuts = Cuts; window.KageCutScenes = SCENES;
})();
