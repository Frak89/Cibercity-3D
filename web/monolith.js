/* The language of the CUSTODI (the NEXUS builders): monoliths carved with the glyphs of the NEXUS dial, word stones scattered
 * around Cybercity, and alien crew who speak it. Every glyph is an alien letter; the alien letters are a substitution of the
 * Italian alphabet (an original cipher, in the spirit of a game "alien alphabet"). Click / tap a monolith (or ACTION · LEGGI
 * when you're next to it) to read it: pick a glyph, guess its letter, and the inscription decodes as you learn. Every monolith
 * read for the first time reveals a few letters for certain (the "chiavi"). Progress is kept in localStorage. */
(function () {
'use strict';
const NR = window.NeonRun, U = window.CarRenderUtil, KF = window.KageFleet;
if (!NR || !KF) return;
const { S, GP, wrapD } = NR, PI = Math.PI, TAU = PI * 2;
const wrapP = v => ((v % S) + S) % S;
const mat = (c, e, slot, mode, a) => ({ c, e: e || 0, slot: slot || 0, mode: mode || 0, a: a || [0, 0, 0] });
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };

/* ---------------- the cipher ---------------- */
const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Italian letter -> alien letter: a fixed derangement (no letter maps to itself), generated once from a seed
const ALIEN = (() => { let h = 20261106; const rnd = () => (h = (h * 16807) % 2147483647) / 2147483647;
  for (;;) { const p = [...AB]; for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    if (p.every((c, i) => c !== AB[i])) { const m = {}; [...AB].forEach((c, i) => { m[c] = p[i]; }); return m; } } })();
const ITAL = {}; for (const k in ALIEN) ITAL[ALIEN[k]] = k;
/** glyph seed of an alien letter: the NEXUS dial uses k * 7 + 3 for k = 0..20 — the first 21 alien letters are the dial glyphs */
const seedOf = a => AB.indexOf(a) * 7 + 3;
const enc = s => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z ]/g, '').replace(/[A-Z]/g, c => ALIEN[c]);

/* ---------------- the inscriptions ---------------- */
// [id, title, Italian text, letters revealed the first time you read it, where]
const MONO = [
  ['m1', 'MONOLITE I · LA STRADA', 'NOI SIAMO I CUSTODI DEL NEXUS', 'EO', { x: 7, z: 50 }],
  ['m2', 'MONOLITE II · IL PORTALE', 'LA PORTA SI APRE CON SETTE SIMBOLI', 'AI', { x: 4 * GP + 12, z: 2 * GP + 24 }],
  ['m3', 'MONOLITE III · IL GARAGE', 'CERCATE LA NAVE SOPRA LE NUVOLE', 'NS', { x: 71, z: 44 }],
  ['m4', 'MONOLITE IV · IL CERCHIO', 'NOI VENIAMO DA UN MONDO SENZA SOLE', 'RT', { x: 98, z: 74 }],
  ['m5', 'MONOLITE V · IL VIALE', 'OLTRE ECO LA CITTA SOGNA SE STESSA', 'LC', { x: 6 * GP + 8, z: 4 * GP + 6 }],
  ['m6', 'MONOLITE VI · LA PIAZZA', 'IL TEMPO E UN FIUME CHE TORNA', 'UM', { x: 2 * GP + 6, z: 7 * GP + 8 }],
  ['m7', 'MONOLITE VII · LA PERIFERIA', 'LE STELLE RICORDANO OGNI NOME', 'DP', { x: 9 * GP + 10, z: 9 * GP + 4 }],
  ['m8', 'MONOLITE VIII · LA COLONIA', 'SU QUESTO MONDO DORME IL PRIMO SEME', 'GQ', { site: 'colonia', x: 10, z: -16 }],
  ['m9', 'MONOLITE IX · ASTROLAB', 'CHI LEGGE QUESTE PAROLE E GIA UNO DI NOI', 'HV', { deck: 2, x: 9.1, z: 23.2 }],
  ['m10', 'MONOLITE X · IL GUARDIANO', 'IL GUARDIANO VEDE CON MILLE OCCHI ANCHE IN ECO', 'FZ', { x: 11 * GP + 6, z: 3 * GP + 10 }]];
// scattered word stones (one word each, no keys: you read them with what you've learned)
const WORDS = [['LUCE', 30, 6], ['PORTA', 2 * GP + 10, 2 * GP + 30], ['TEMPO', 5 * GP + 6, GP + 20], ['STELLA', 8 * GP + 30, 2 * GP + 8], ['CASA', 3 * GP + 8, 5 * GP + 40],
  ['AMICO', 7 * GP + 40, 6 * GP + 8], ['PACE', GP + 30, 9 * GP + 8], ['VIAGGIO', 10 * GP + 8, 7 * GP + 30], ['SOGNO', 12 * GP + 40, 11 * GP + 8], ['CHIAVE', 13 * GP + 8, GP + 40],
  ['FUOCO', 4 * GP + 50, 12 * GP + 8], ['ACQUA', 9 * GP + 8, 13 * GP + 30], ['VITA', 0 * GP + 50, 11 * GP + 8], ['CIELO', 11 * GP + 30, 0 * GP + 8]];
// what alien crew say (Italian, shown in the alien letters you haven't learned yet)
const SAYINGS = ['BENVENUTO A BORDO', 'CIAO AMICO TERRESTRE', 'LE STELLE TI SALUTANO', 'HAI GIA LETTO I MONOLITI', 'IL NEXUS TI ASPETTA', 'PACE A TE VIAGGIATORE', 'NON AVERE PAURA'];

/* ---------------- models ---------------- */
function layout(text, perRow) {   // words wrapped into rows of at most perRow letters
  const rows = []; let cur = '';
  for (const w of text.split(' ')) { if (cur && cur.length + 1 + w.length > perRow) { rows.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) rows.push(cur); return rows;
}
function buildMonolith(text, small) {
  const mb = new KF.MB(), k = small ? 0.62 : 1, stone = mat([0.05, 0.055, 0.06], 0, 1), edge = mat([0.12, 0.13, 0.12]), led = mat([0.25, 1, 0.75], 0.85, 3), base = mat([0.09, 0.09, 0.1]);
  const W = 2.3 * k, H = 4.6 * k, D = 0.55 * k;
  mb.part = 'basamento'; mb.box(0, 0.15 * k, 0, W + 0.6 * k, 0.3 * k, D + 0.6 * k, base); mb.box(0, 0.36 * k, 0, W + 0.25 * k, 0.12 * k, D + 0.25 * k, edge);
  mb.part = 'monolite'; mb.box(0, 0.42 * k + H / 2, 0, W, H, D, stone);
  // a slightly tapered cap and chamfer strips along the edges
  mb.box(0, 0.42 * k + H + 0.06 * k, 0, W * 0.94, 0.12 * k, D * 0.9, edge);
  for (const sx of [-1, 1]) mb.box(sx * (W / 2 - 0.02), 0.42 * k + H / 2, D / 2, 0.05, H * 0.98, 0.03, edge);
  mb.part = 'incisioni';
  const rows = layout(enc(text), 9), cell = 0.235 * k, gs = 0.17 * k, y0 = 0.42 * k + H - 0.45 * k;
  rows.forEach((r, j) => { const x0 = -(r.length - 1) / 2 * cell;
    [...r].forEach((c, i) => { if (c !== ' ') KF.glyph(mb, x0 + i * cell, y0 - j * 0.36 * k, D / 2 + 0.005, gs, seedOf(c), led); }); });
  // the back: the 21 dial glyphs in a ring (the CUSTODI alphabet "index")
  for (let i = 0; i < 21; i++) { const a = i / 21 * TAU; KF.glyph(mb, Math.sin(a) * 0.75 * k, 0.42 * k + H * 0.55 + Math.cos(a) * 0.75 * k, -D / 2 - 0.005, 0.13 * k, i * 7 + 3, led, true); }
  mb.part = 'occhio'; mb.box(0, 0.42 * k + H * 0.55, -D / 2 - 0.02, 0.18 * k, 0.18 * k, 0.03, mat([0.4, 1, 0.8], 1.6, 3));
  const m = mb.finish(); m.kind = 'monolith'; return m;
}
function buildStone(word) {
  const mb = new KF.MB(), stone = mat([0.07, 0.075, 0.08], 0, 1), led = mat([0.25, 1, 0.75], 0.85, 3), L = word.length, W = Math.max(0.8, L * 0.2 + 0.3);
  mb.part = 'pietra'; mb.box(0, 0.35, 0, W, 0.7, 0.35, stone); mb.box(0, 0.73, 0, W * 0.92, 0.06, 0.3, mat([0.12, 0.13, 0.12]));
  mb.part = 'incisioni'; const e = enc(word); [...e].forEach((c, i) => KF.glyph(mb, (i - (L - 1) / 2) * 0.2, 0.4, 0.18, 0.14, seedOf(c), led));
  const m = mb.finish(); m.kind = 'stone'; return m;
}

/* ---------------- game side ---------------- */
function Glyphs(game) {
  this.g = game; this.meshes = {}; this.open = null; this.sel = null; this.flash = 0;
  try { this.st = JSON.parse(LS.get('kageGlyph', '{}')); } catch (e) { this.st = {}; }
  this.st.keys = this.st.keys || ''; this.st.g = this.st.g || {}; this.st.read = this.st.read || []; this.st.solved = this.st.solved || [];
  this.spots = [];
  const city = game.city, free = (x, z) => {   // nudge a spot out of buildings and water
    const hit = (x0, z0) => { const bx = Math.floor(x0 / GP), bz = Math.floor(z0 / GP);
      if (NR.isWater && NR.isWater(x0, z0)) return true;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const ix = ((bx + i) % 15 + 15) % 15, iz = ((bz + j) % 15 + 15) % 15, sx = (bx + i) * GP - ix * GP, sz = (bz + j) * GP - iz * GP;
        for (const q of (city && city.blocks ? city.blocks[iz * 15 + ix] : [])) if (x0 > q[0] + sx - 2 && x0 < q[2] + sx + 2 && z0 > q[1] + sz - 2 && z0 < q[3] + sz + 2) return true; }
      return false; };
    if (!hit(x, z)) return [x, z];
    for (let r = 2; r < 40; r += 2) for (let a = 0; a < TAU; a += PI / 8) { const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r; if (!hit(nx, nz)) return [nx, nz]; }
    return [x, z]; };
  for (const [id, title, text, keys, at] of MONO) {
    const sp = { id, title, text, keys, kind: 'mono', site: at.site, deck: at.deck };
    if (at.site || at.deck !== undefined) { sp.x = at.x; sp.z = at.z; } else { const p = free(wrapP(at.x), wrapP(at.z)); sp.x = p[0]; sp.z = p[1]; }
    sp.h = ((id.charCodeAt(1) * 1.7) % TAU); if (at.deck !== undefined) sp.h = -PI / 2;
    this.spots.push(sp); }
  WORDS.forEach(([w, x, z], i) => { const p = free(wrapP(x), wrapP(z)); this.spots.push({ id: 'w' + i, title: 'PIETRA DEI CUSTODI', text: w, kind: 'stone', x: p[0], z: p[1], h: i * 2.1 }); });
  this.buildUI();
}
Glyphs.prototype.save = function () { LS.set('kageGlyph', JSON.stringify(this.st)); };
Glyphs.prototype.mesh = function (k, fn) { if (!this.meshes[k]) this.meshes[k] = this.g.vmesh(fn()); return this.meshes[k]; };
/** what the player currently reads for alien letter a: { c, how: 'key' | 'guess' | '' } */
Glyphs.prototype.know = function (a) { const it = ITAL[a]; if (this.st.keys.includes(it)) return { c: it, how: 'key' }; const g = this.st.g[a]; return g ? { c: g, how: 'guess' } : { c: '', how: '' }; };
/** Italian text as the player reads it: letters you know become Italian, the rest stay alien (lowercase marks a guess) */
Glyphs.prototype.say = function (it) { return [...enc(it)].map(a => { if (a === ' ') return ' '; const k = this.know(a); return k.how === 'key' ? k.c : k.how === 'guess' ? k.c.toLowerCase() : a; }).join('\u2060'); };   // word joiners: the translator never touches the cipher
Glyphs.prototype.solvedText = function (text) { return [...enc(text)].every(a => a === ' ' || this.know(a).c === ITAL[a]); };

/** where the player is: city / planet colony / ODYSSEY deck */
Glyphs.prototype.ctx = function () {
  const g = this.g, f = g.foot; if (!f || !f.active || g.veh) return null;
  if (!f.ss && !f.xs && g.world === 'city') return { w: 'city', x: f.x, z: f.z };
  if (f.ss === 'planet' && g.star) return { w: 'planet', site: g.star.site, x: f.px, z: f.pz };
  if (f.ss === 'in') return { w: 'deck', deck: f.deck, x: f.lx, z: f.lz };
  return null;
};
Glyphs.prototype.visible = function (sp, c) {
  if (!c) return false;
  if (c.w === 'city') return !sp.site && sp.deck === undefined;
  if (c.w === 'planet') return sp.site === c.site;
  if (c.w === 'deck') return sp.deck === c.deck;
  return false;
};
Glyphs.prototype.dist = function (sp, c) { return c.w === 'city' ? Math.hypot(wrapD(sp.x - c.x), wrapD(sp.z - c.z)) : Math.hypot(sp.x - c.x, sp.z - c.z); };
Glyphs.prototype.nearest = function (r) { const c = this.ctx(); if (!c) return null; let best = null, bd = r;
  for (const sp of this.spots) if (this.visible(sp, c)) { const d = this.dist(sp, c); if (d < bd) { bd = d; best = sp; } } return best; };
Glyphs.prototype.action = function () { return !this.open && this.nearest(3.2) ? 'LEGGI' : ''; };
Glyphs.prototype.enter = function () { if (this.open) { this.close(); return true; } const sp = this.nearest(3.2); if (!sp) return false; this.read(sp); return true; };
Glyphs.prototype.update = function (dt) {
  this.flash = Math.max(0, this.flash - dt);
  // collisions: monoliths and stones are solid
  const c = this.ctx(), f = this.g.foot; if (!c) return;
  for (const sp of this.spots) { if (!this.visible(sp, c)) continue; const r = sp.kind === 'mono' ? (sp.deck !== undefined ? 1.0 : 1.7) : 0.6;
    const dx = c.w === 'city' ? wrapD(c.x - sp.x) : c.x - sp.x, dz = c.w === 'city' ? wrapD(c.z - sp.z) : c.z - sp.z, d = Math.hypot(dx, dz);
    if (d < r && d > 1e-3) { const k = (r - d) / d; if (c.w === 'city') { f.x = wrapP(f.x + dx * k); f.z = wrapP(f.z + dz * k); } else if (c.w === 'planet') { f.px += dx * k; f.pz += dz * k; } else { f.lx += dx * k; f.lz += dz * k; if (this.g.star) this.g.star.syncFoot(f); } } }
};
/** model matrix (render space) of a spot */
Glyphs.prototype.model = function (sp, ctx) {
  const g = this.g;
  if (sp.deck !== undefined) { const S2 = g.star, D = window.KageStar.DECKS[sp.deck]; return U.mul(S2.shipM(ctx), U.mul(U.T(sp.x, D.y, sp.z), U.RY(sp.h))); }
  if (sp.site) { const S2 = g.star, y = window.KageStar.siteHeight(sp.site, sp.x, sp.z); return U.mul(U.T(...S2.rel([sp.x, y, sp.z], ctx)), U.RY(sp.h)); }
  return U.mul(U.T(wrapD(sp.x - ctx.camX), 0, wrapD(sp.z - ctx.camZ)), U.RY(sp.h));
};
Glyphs.prototype.drawWorld = function (ctx) {
  const g = this.g, gl = g.gl, P = g.P.veh, u = P.u, c = this.ctx(); if (!c || !g.fleet) return;
  gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uGlowOnly, 0); if (u.uDay) gl.uniform1f(u.uDay, g.dayK || 0); if (u.uBlur) gl.uniform1f(u.uBlur, 0);
  this.drawn = [];
  for (const sp of this.spots) { if (!this.visible(sp, c) || this.dist(sp, c) > 260) continue;
    const solved = this.st.solved.includes(sp.id); gl.uniform1f(u.uLit, solved ? 1.35 : 1);
    const m = this.mesh(sp.id, () => sp.kind === 'mono' ? buildMonolith(sp.text, sp.deck !== undefined) : buildStone(sp.text)), M = this.model(sp, ctx);
    gl.uniformMatrix4fv(u.uModel, false, M); g.draw(P, m); this.drawn.push([sp, M]); }
  gl.uniform1f(u.uLit, 1);
};
/** click / tap: pick a monolith on screen (within 30 m) */
Glyphs.prototype.pick = function (cx, cy) {
  const g = this.g, VP = g.VP; if (!VP || !this.drawn || this.open) return false; const c = this.ctx(); if (!c) return false;
  const W = innerWidth, H = innerHeight; let best = null, bd = 1e9;
  for (const [sp, M] of this.drawn) { if (this.dist(sp, c) > 30) continue; const hy = sp.kind === 'mono' ? (sp.deck !== undefined ? 1.6 : 2.6) : 0.4;
    const p = [M[12] + M[4] * hy, M[13] + M[5] * hy, M[14] + M[6] * hy, 1], q = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q[i] += VP[j * 4 + i] * p[j];
    if (q[3] < 0.5) continue; const sx = (0.5 + 0.5 * q[0] / q[3]) * W, sy = (0.5 - 0.5 * q[1] / q[3]) * H, rad = Math.max(40, (sp.kind === 'mono' ? 2.6 : 0.8) * g.Pm5 / q[3] * H * 0.5), d = Math.hypot(cx - sx, cy - sy);
    if (d < rad && q[3] < bd) { bd = q[3]; best = sp; } }
  if (best) { this.read(best); return true; } return false;
};

/* ---------------- the reading overlay ---------------- */
Glyphs.prototype.buildUI = function () {
  const st = document.createElement('style');
  st.textContent = '#glyUI{position:fixed;inset:4vmin;z-index:40;background:rgba(3,8,8,.94);border:2px solid rgba(80,255,190,.75);border-radius:2vmin;color:#dfffee;font:2vmin monospace;display:none;flex-direction:column;padding:2vmin;box-shadow:0 0 4vmin rgba(60,255,180,.25)}'
    + '#glyUI h3{margin:0;color:#7fffd0;letter-spacing:.2em;font-size:2.4vmin} #glyUI .sub{opacity:.75;margin:.6vmin 0 1vmin} #glyUI .cw{flex:1;position:relative;min-height:0} #glyUI canvas{position:absolute;inset:0;width:100%;height:100%;cursor:pointer}'
    + '#glyUI .keys{display:flex;flex-wrap:wrap;gap:.6vmin;justify-content:center;margin-top:1vmin} #glyUI button{font:bold 2vmin monospace;color:#dfffee;background:rgba(10,30,24,.9);border:1px solid rgba(80,255,190,.6);border-radius:1vmin;padding:.8vmin 1.2vmin;cursor:pointer;min-width:4.4vmin}'
    + '#glyUI button.sel{background:rgba(80,255,190,.35)} #glyUI .bar{display:flex;gap:1vmin;justify-content:space-between;align-items:center;margin-top:1vmin} #glyUI .msg{color:#ffd27a;min-height:2.4vmin;text-align:center}';
  document.head.appendChild(st);
  const ui = this.ui = document.createElement('div'); ui.id = 'glyUI';
  ui.innerHTML = '<h3></h3><div class="sub"></div><div class="cw"><canvas></canvas></div><div class="msg"></div><div class="keys"></div><div class="bar"><span class="prog"></span><span><button data-a="codex">ALFABETO</button> <button data-a="clear">CANCELLA</button> <button data-a="close">✕ CHIUDI</button></span></div>';
  document.body.appendChild(ui);
  const stop = e => e.stopPropagation(); ['pointerdown', 'touchstart', 'keydown', 'mousedown'].forEach(ev => ui.addEventListener(ev, stop));
  this.cv = ui.querySelector('canvas'); this.kb = ui.querySelector('.keys');
  for (const L of AB) { const b = document.createElement('button'); b.textContent = L; b.dataset.l = L; this.kb.appendChild(b); }
  const click = e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault();
    if (b.dataset.l) this.guess(b.dataset.l); else if (b.dataset.a === 'close') this.close(); else if (b.dataset.a === 'clear') this.guess(''); else if (b.dataset.a === 'codex') { this.codex = !this.codex; this.render(); } };
  ui.addEventListener('click', click);
  this.cv.addEventListener('click', e => { const r = this.cv.getBoundingClientRect(), x = (e.clientX - r.left) * this.cv.width / r.width, y = (e.clientY - r.top) * this.cv.height / r.height;
    for (const h of this.hits || []) if (x > h[0] && x < h[2] && y > h[1] && y < h[3]) { this.sel = h[4]; this.render(); return; } });
  addEventListener('keydown', e => { if (!this.open) return; if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
    if (/^Key[A-Z]$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); this.guess(e.code.slice(3)); }
    if (e.code === 'Backspace' || e.code === 'Delete') { e.preventDefault(); e.stopImmediatePropagation(); this.guess(''); }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); this.step(e.code === 'ArrowRight' ? 1 : -1); } }, true);
  addEventListener('resize', () => { if (this.open) this.render(); });
};
Glyphs.prototype.letters = function () { return [...new Set([...enc(this.open.text)].filter(c => c !== ' '))]; };
Glyphs.prototype.step = function (d) { const L = this.codex ? [...AB] : this.letters(); const i = L.indexOf(this.sel); this.sel = L[((i < 0 ? 0 : i + d) + L.length) % L.length]; this.render(); };
Glyphs.prototype.read = function (sp) {
  this.open = sp; this.codex = false; this.ui.style.display = 'flex'; let msg = '';
  if (!this.st.read.includes(sp.id)) { this.st.read.push(sp.id);
    if (sp.keys) { const nw = [...sp.keys].filter(k => !this.st.keys.includes(k)); this.st.keys += nw.join('');
      if (nw.length) msg = 'CHIAVE TROVATA · ' + nw.map(k => '«' + ALIEN[k] + '» = ' + k).join(' · ') + ' (le chiavi sono sicure: in azzurro)'; }
    this.save(); }
  this.msg = msg || (sp.kind === 'stone' ? 'Una sola parola. Usa le lettere che conosci.' : 'Tocca un glifo, poi scegli la lettera che pensi rappresenti.');
  this.sel = this.letters().find(a => !this.know(a).c) || this.letters()[0];
  if (window.FleetAudio) { if (!this.au) this.au = new FleetAudio(); this.au.start(); this.au.blip(330, 660, 0.6, 0.1, 'sine'); }
  this.render();
};
Glyphs.prototype.close = function () { this.open = null; this.ui.style.display = 'none'; };
Glyphs.prototype.guess = function (L) {
  const a = this.sel; if (!a || !this.open) return;
  if (this.know(a).how === 'key') { this.msg = 'Questo glifo è una chiave: è già sicuro.'; this.render(); return; }
  if (L) { // one Italian letter per glyph: free it from any other glyph first
    for (const k in this.st.g) if (this.st.g[k] === L) delete this.st.g[k];
    if (this.st.keys.includes(L)) { this.msg = 'La lettera ' + L + ' appartiene già a una chiave.'; this.render(); return; }
    this.st.g[a] = L; } else delete this.st.g[a];
  this.save(); this.msg = '';
  // solved?
  const sp = this.open;
  if (!this.st.solved.includes(sp.id) && this.solvedText(sp.text)) { this.st.solved.push(sp.id); this.save(); this.msg = '✦ DECIFRATA! ✦  «' + sp.text + '»';
    if (this.au) { this.au.blip(523, 523, 0.25, 0.12, 'triangle'); setTimeout(() => this.au.blip(659, 659, 0.25, 0.12, 'triangle'), 140); setTimeout(() => this.au.blip(784, 784, 0.5, 0.12, 'triangle'), 280); } }
  else if (L) { this.step(1); return; }
  this.render();
};
function drawGlyph(c2, seed, cx, cy, size, col, lw) {
  const G = KF.glyphStrokes(seed), u = size / 3; c2.strokeStyle = col; c2.fillStyle = col; c2.lineWidth = lw; c2.lineCap = 'round';
  c2.beginPath(); for (const [ax, ay, bx, by] of G.segs) { c2.moveTo(cx + (ax - 1) * u, cy - (ay - 1.5) * u); c2.lineTo(cx + (bx - 1) * u, cy - (by - 1.5) * u); } c2.stroke();
  if (G.dot) { const r = u * 0.26; c2.fillRect(cx - r, cy - (G.dot[1] - 1.5) * u - r, r * 2, r * 2); }
}
Glyphs.prototype.render = function () {
  const sp = this.open; if (!sp) return; const ui = this.ui, cv = this.cv, dpr = Math.min(2, devicePixelRatio || 1);
  ui.querySelector('h3').textContent = this.codex ? 'ALFABETO DEI CUSTODI' : sp.title;
  { const sub = ui.querySelector('.sub'); sub.innerHTML = '';
    const add = (t, cls) => { const e = document.createElement('span'); e.textContent = t; if (cls) e.className = cls; sub.appendChild(e); };
    if (this.codex) add('I 26 glifi (i primi 21 sono quelli del NEXUS). Azzurro = chiave sicura · ambra = tua ipotesi.');
    else { add('Pronuncia aliena: '); add(enc(sp.text), 'notr'); add('   ·   Come la leggi tu: '); add(this.say(sp.text), 'notr'); } }
  { const me = ui.querySelector('.msg'), mm = this.msg || '', k = mm.indexOf('«'); me.innerHTML = ''; const a1 = document.createElement('span'), a2 = document.createElement('span'); a2.className = 'notr';
    a1.textContent = k >= 0 ? mm.slice(0, k) : mm; a2.textContent = k >= 0 ? mm.slice(k) : ''; me.appendChild(a1); me.appendChild(a2); }
  const nk = this.st.keys.length, ng = Object.keys(this.st.g).filter(a => this.st.g[a] === ITAL[a]).length;
  ui.querySelector('.prog').textContent = 'Chiavi ' + nk + '/26 · ipotesi ' + Object.keys(this.st.g).length + ' · iscrizioni decifrate ' + this.st.solved.filter(i => i[0] === 'm').length + '/' + MONO.length + ' · pietre ' + this.st.solved.filter(i => i[0] === 'w').length + '/' + WORDS.length;
  void ng;
  const r = cv.getBoundingClientRect(); cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
  const c2 = cv.getContext('2d'), Wc = cv.width, Hc = cv.height; c2.clearRect(0, 0, Wc, Hc); this.hits = [];
  const cellOf = (a, x, y, cw) => { const k = this.know(a), selc = a === this.sel;
    if (selc) { c2.fillStyle = 'rgba(80,255,190,.18)'; c2.fillRect(x - cw * 0.45, y - cw * 0.75, cw * 0.9, cw * 1.7); }
    drawGlyph(c2, seedOf(a), x, y - cw * 0.12, cw * 0.62, selc ? '#b9ffe6' : '#57ffbf', Math.max(2, cw * 0.07));
    c2.textAlign = 'center'; c2.font = (cw * 0.2 | 0) + 'px monospace'; c2.fillStyle = 'rgba(200,255,230,.55)'; c2.fillText(a, x, y + cw * 0.46);
    c2.font = 'bold ' + (cw * 0.32 | 0) + 'px monospace'; c2.fillStyle = k.how === 'key' ? '#7fdcff' : k.how === 'guess' ? '#ffc35a' : 'rgba(255,255,255,.3)'; c2.fillText(k.c || '·', x, y + cw * 0.82);
    this.hits.push([x - cw * 0.45, y - cw * 0.75, x + cw * 0.45, y + cw * 0.95, a]); };
  if (this.codex) { const cols = 9, cw = Math.min(Wc / (cols + 0.5), Hc / 3.4 / 1.05);
    [...AB].forEach((a, i) => cellOf(a, (i % cols + 0.75) * cw * (Wc / ((cols + 0.5) * cw)), (Math.floor(i / cols) + 0.6) * cw * 1.1, cw)); }
  else { const rows = layout(enc(sp.text), sp.kind === 'stone' ? 12 : 12), maxL = Math.max(...rows.map(s => s.length)), cw = Math.min(Wc / (maxL + 1), Hc / (rows.length * 1.25 + 0.3));
    rows.forEach((row, j) => { const y = (j + 0.6) * cw * 1.25, x0 = Wc / 2 - (row.length - 1) / 2 * cw; [...row].forEach((a, i) => { if (a !== ' ') cellOf(a, x0 + i * cw, y, cw); }); }); }
  [...this.kb.children].forEach(b => { const L = b.dataset.l, used = Object.values(this.st.g).includes(L) || this.st.keys.includes(L); b.style.opacity = used ? 0.45 : 1; b.className = this.sel && this.know(this.sel).c === L ? 'sel' : ''; });
};
Glyphs.prototype.drawHud = function (hud) {
  if (this.open) return; const sp = this.nearest(3.2); if (!sp) return;
  const c2 = hud.getContext('2d'), m = Math.min(hud.width, hud.height), ln = sp.kind === 'mono' ? sp.title + ' · INVIO o tocca il monolite per leggere' : 'PIETRA DEI CUSTODI · «' + this.say(sp.text) + '» · INVIO per leggere';
  c2.font = (m * 0.022 | 0) + 'px monospace'; c2.textAlign = 'center'; const w = c2.measureText(ln).width + m * 0.03, y = hud.height - m * 0.2;
  c2.fillStyle = 'rgba(3,12,10,0.7)'; c2.fillRect(hud.width / 2 - w / 2, y - m * 0.03, w, m * 0.042); c2.fillStyle = '#7fffd0'; c2.fillText(ln, hud.width / 2, y); c2.textAlign = 'left';
};

window.KageGlyphs = Glyphs;
window.KageGlyph = { ALIEN, ITAL, enc, SAYINGS, MONO, WORDS, seedOf, buildMonolith, buildStone, say: t => { const g = window.__game && window.__game.mono; return g ? g.say(t) : enc(t); } };
})();
