/* KAGE ODYSSEY in NEON RUN.
 * Garage: the miniature + the crew badge (ACTION). With the badge on: BEAM IN (button or B) → dematerialise → rematerialise on the
 * transporter pads of deck 2, the crew waves. Walk five decks (lift = ACTION), Astrolab cartouches = choose the destination,
 * captain's chair = the helm: impulse, take off from Cybercity above the clouds into space, warp 1 → 10, land on the planet,
 * beam down and walk on it, EVA from the deck-4 airlock. Worlds: 'city' (the ship hovers over the clouds), 'space', 'planet'.
 * Hooks from Game (game.js): update / camera / pal / drawWorld / drawAdditive / drawHud / key / action / enter. */
(function () {
'use strict';
const NR = window.NeonRun, U = window.CarRenderUtil, KF = window.KageFleet, KS = window.KageStar, KP = window.KagePilot;
if (!NR || !KS) return;
const { S, wrapD } = NR, PI = Math.PI, TAU = PI * 2, D = KS.DECKS, RIG = KS.RIG;
const wrapP = v => ((v % S) + S) % S, wrapA = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (c, t, k, dt) => c + (t - c) * Math.min(1, dt * k), sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mixv = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const mv = (M, v) => [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]];
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const CITY = { x: 630, y: 640, z: 630, h: 0 };
const DISPLAY = { x: 24, z: 54 };          // inside the KAGE GARAGE
const FM = (s) => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
const HUMANS = [{ suit: 'rosso', hair: 'corti', hairColor: 'nero', beard: 'corta' }, { suit: 'blu', hair: 'coda', hairColor: 'castano', beard: 'nessuna', skin: 'olivastra', build: 'snello' },
  { suit: 'oro', hair: 'rasati', hairColor: 'nero', beard: 'nessuna', skin: 'scura' }, { suit: 'blu', hair: 'lunghi', hairColor: 'rosso', beard: 'nessuna', build: 'snello' },
  { suit: 'oro', hair: 'ricci', hairColor: 'biondo', beard: 'accennata' }, { suit: 'rosso', hair: 'calvo', beard: 'piena', skin: 'ambrata', build: 'robusto' }];
// crew: deck index, local x, z, heading, who, pose (wave = greets you when you come close; path = walks between two points)
const CREW = [
  { d: 1, x: 2.6, z: 15.6, h: PI, who: 0, pose: 'in piedi', wave: true, greet: true }, { d: 1, x: -3.5, z: 18.5, h: 2.6, who: 'verde', pose: 'in piedi', wave: true, greet: true },
  { d: 1, x: 7, z: 10, h: -1.2, who: 4, pose: 'braccia conserte', wave: true },
  { d: 0, x: -1.6, z: 15.9, h: 0, who: 1, pose: 'seduto_c' }, { d: 0, x: 1.6, z: 15.9, h: 0, who: 'nordico', pose: 'seduto_c' }, { d: 0, x: -7.2, z: 12, h: -1.9, who: 'grigio', pose: 'pensieroso', wave: true },
  { d: 0, x: 6.6, z: 18.5, h: 2.4, who: 2, pose: 'indica', wave: true },
  { d: 2, x: 2.2, z: 10.2, h: -0.4, who: 'scuro', pose: 'pensieroso', wave: true }, { d: 2, x: -6, z: 20, h: 1.6, who: 3, pose: 'indica', wave: true }, { d: 2, path: [[-8, 6], [8, 6]], who: 'grigio', wave: true },
  { d: 3, x: -6, z: 9.6, h: PI, who: 5, pose: 'braccia conserte', wave: true }, { d: 3, x: 6, z: 16.6, h: 0, who: 'verde', pose: 'esulta' }, { d: 3, x: -9.4, z: 20.8, h: 0, who: 4, pose: 'in piedi', wave: true },
  { d: 3, path: [[3, 4], [3, 23]], who: 'nordico', wave: true },
  { d: 4, x: -5, z: 9, h: 0.4, who: 0, pose: 'mani sui fianchi', wave: true }, { d: 4, x: 5, z: 9, h: -0.4, who: 'grigio', pose: 'pensieroso' }, { d: 4, x: 2.8, z: 20.5, h: PI, who: 2, pose: 'indica', wave: true },
  { d: 4, path: [[-7, 12], [-7, 22]], who: 'scuro', wave: true },
  // more life: officers walking a round between consoles and stopping to work at each end
  { d: 0, path: [[-5.6, 9.2], [5.6, 9.2]], who: 3, dwell: true, hA: -2.2, hB: 2.2, work: 'indica', wave: true },
  { d: 1, path: [[-9, 8], [-9, 20]], who: 'verde', dwell: true, hA: -PI / 2, hB: -PI / 2, work: 'pensieroso', wave: true },
  { d: 4, path: [[-5, 9.3], [5, 9.3]], who: 'nordico', dwell: true, hA: PI, hB: PI, work: 'indica', wave: true },
  { d: 4, path: [[0, 20.6], [-6.2, 21.2]], who: 5, dwell: true, hA: PI, hB: -PI / 2, work: 'pensieroso', wave: true },
  // a coffee break in the mess
  { d: 3, x: 4.94, z: 6.94, h: PI / 4, who: 'grigio', pose: 'seduto_m' }, { d: 3, x: -4.94, z: 16.06, h: PI + PI / 4, who: 1, pose: 'seduto_m' }, { d: 3, x: 1.06, z: 22.06, h: PI + PI / 4, who: 'verde', pose: 'seduto_m' }];
// sleepers in the stasis bay (deck 5): who + the pod they occupy
const SLEEPERS = ['nordico', 0, 'grigio', 'scuro'];
const REPLI_MENU = ['CAFFÈ KAGE · CALDO', 'TÈ ALLA MENTA DI MARTE', 'ZUPPA DI ALGHE DI PROXIMA', 'SUCCO DI BACCHE DI KEPLER', 'CIOCCOLATA DELLA COLONIA'];
const MESS_SEAT = { hip: [0, 0.55, -0.1], footL: [0.12, 0.05, 0.45], footR: [-0.12, 0.05, 0.45], wheel: [0, 0.82, 0.5], wheelR: 0.22 };
const SITE_CREW = { colonia: [['grigio', 8, 0], ['verde', -6, 9], ['nordico', 12, -10], ['scuro', -14, -6], ['verde', 3, 18], ['grigio', -18, 14]] };

function Star(game) {
  this.g = game; this.gl = game.gl; this.lod = 'ultra'; this.meshes = {};
  this.ship = { world: 'city', x: CITY.x, y: CITY.y, z: CITY.z, h: CITY.h, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, imp: 0, loc: 'terra', course: null, warpI: 8, mode: null, mt: 0, landed: null };
  this.badge = LS.get('kageBadge', '0') === '1';
  this.greetT = 0; this.flash = 0; this.msg = ''; this.msgT = 0; this.t = 0; this.E = [0, 0, 0];
  this.buildUI();
}
Star.prototype.mesh = function (key, fn) { if (!this.meshes[key]) { const m = fn(); this.meshes[key] = this.g.vmesh(m); this.meshes[key].src = m; } return this.meshes[key]; };
Star.prototype.cfg = function () { return KF.loadCfg('starship'); };
Star.prototype.person = function (who) {
  const cfg = typeof who === 'string' ? { species: who } : Object.assign({ species: 'umano', glasses: 'nessuno', helmet: false, accent: 'ciano' }, HUMANS[who % HUMANS.length]);
  const key = 'p' + JSON.stringify(cfg); if (!this.meshes[key]) { const m = KP.build(cfg, 'hi'); this.meshes[key] = this.g.vmesh(m); this.meshes[key].S = m.S; } return this.meshes[key];
};
Star.prototype.say = function (s, t) { this.msg = s; this.msgT = t || 3; };

/* ---------------- state helpers ---------------- */
Star.prototype.foot = function () { return this.g.foot; };
Star.prototype.aboard = function () { const f = this.foot(); return !!(f && f.active && (f.ss === 'in' || f.ss === 'helm' || f.ss === 'beamin')); };
Star.prototype.involved = function () { const f = this.foot(); return !!(f && f.active && f.ss); };
Star.prototype.R4 = function () { const s = this.ship; return U.mul(U.RY(s.h), U.mul(U.RX(s.pitch || 0), U.RZ(s.roll || 0))); };
/** ship-local point → world point (city: torus coords; space / planet: scene coords) */
Star.prototype.toW = function (p) { const s = this.ship, q = mv(this.R4(), p), w = [s.x + q[0], s.y + q[1], s.z + q[2]]; if (s.world === 'city') { w[0] = wrapP(w[0]); w[2] = wrapP(w[2]); } return w; };
Star.prototype.rel = function (p, ctx) { return this.g.world === 'city' ? [wrapD(p[0] - ctx.camX), p[1], wrapD(p[2] - ctx.camZ)] : [p[0] - this.E[0], p[1] - this.E[1], p[2] - this.E[2]]; };
Star.prototype.shipM = function (ctx) { const r = this.rel([this.ship.x, this.ship.y, this.ship.z], ctx); return U.mul(U.T(r[0], r[1], r[2]), this.R4()); };
Star.prototype.deckY = function (i) { return D[i].y; };
Star.prototype.SPACE = function () { return this.g.world === 'space' || this.g.world === 'planet'; };
Star.prototype.shipVisible = function () { const s = this.ship; return (s.world === 'city' && this.g.world === 'city') || (s.world === this.g.world); };

/* ---------------- per frame ---------------- */
Star.prototype.update = function (dt, inp) {
  const g = this.g, s = this.ship, f = this.foot(); this.t += dt;
  this.greetT = Math.max(0, this.greetT - dt); this.flash = Math.max(0, this.flash - dt * 1.2); this.msgT = Math.max(0, this.msgT - dt);
  // the ship: impulse / climb / descent / warp
  if (s.mode === 'ascent') { s.mt += dt; s.vy = ease(s.vy, 70, 0.6, dt); s.y += s.vy * dt; s.pitch = ease(s.pitch, -0.3, 1, dt);
    const fx = Math.sin(s.h), fz = Math.cos(s.h); s.x += fx * 30 * dt; s.z += fz * 30 * dt; if (s.world === 'city') { s.x = wrapP(s.x); s.z = wrapP(s.z); }
    const top = s.world === 'city' ? 3200 : 1500;
    if (s.y > top) { this.toSpace(); this.say('IN ORBITA · ' + KS.DEST[s.loc].name, 4); }
  } else if (s.mode === 'descent') { s.mt += dt; const tgt = s.world === 'city' ? CITY.y : 60; s.y = ease(s.y, tgt, 0.55, dt); s.pitch = ease(s.pitch, 0, 1.5, dt);
    if (Math.abs(s.y - tgt) < 3) { s.mode = null; s.vy = 0; s.landed = s.world === 'planet' ? this.site : null; this.say(s.world === 'city' ? 'SOPRA LE NUVOLE DI CYBERCITY' : 'ATTERRATI · ' + KS.DEST[this.site].name, 4); }
  } else if (s.mode === 'warp') {
    const w = KS.WARP_STEPS[s.warpI], c = KS.warpC(w), d = s.travel;
    d.done += c * 0.0004 * dt; d.t += dt;
    if (d.done >= d.total || !isFinite(c)) this.arrive();
  } else if (f && f.ss === 'helm') {
    // impulse: W/S throttle, A/D yaw, SPACE/X climb/dive (pitch in space), SHIFT = full impulse
    // a 150 m ship has mass: the throttle sets the impulse, the speed follows slowly; turns build up and the hull banks into them
    s.imp = clamp(s.imp + (inp.fwd || 0) * dt * 0.5, -0.25, 1); if (inp.boost) s.imp = ease(s.imp, 1, 2, dt);
    const vmax = s.world === 'space' ? 260 : 70; s.v = ease(s.v || 0, s.imp * vmax, 0.35, dt); const v = s.v, vk = clamp(Math.abs(v) / vmax + 0.25, 0, 1);
    s.yr = ease(s.yr || 0, (inp.yaw || 0) * 0.32 * vk, 1.1, dt); s.h = wrapA(s.h + s.yr * dt);
    s.pr = ease(s.pr || 0, -(inp.lift || 0) * 0.35, 1.2, dt);
    if (s.world === 'space') s.pitch = clamp(s.pitch + s.pr * dt, -0.9, 0.9); else s.pitch = ease(s.pitch, -(inp.lift || 0) * 0.12, 1.2, dt);
    s.roll = ease(s.roll, -s.yr * 1.4 + Math.sin(this.t * 0.4) * 0.006, 1.5, dt);
    const fwd = mv(this.R4(), [0, 0, 1]);
    s.x += fwd[0] * v * dt; s.z += fwd[2] * v * dt; s.y += (s.world === 'space' ? fwd[1] * v : (inp.lift || 0) * 18) * dt;
    if (s.world === 'city') { s.x = wrapP(s.x); s.z = wrapP(s.z); s.y = clamp(s.y, 520, 1500); }
    if (s.world === 'planet') s.y = clamp(s.y, 50, 900);
    if (s.world === 'space') { const r = Math.hypot(s.x, s.y, s.z); if (r > 5500) { const k = 5500 / r; s.x *= k; s.y *= k; s.z *= k; } }
  } else { s.imp = ease(s.imp, 0, 1, dt); s.roll = ease(s.roll, 0, 1, dt); }
  // warp-field lensing strength: follows the warp factor while in curvature (and a short swell on engage / drop-out)
  { const tgt = s.mode === 'warp' ? clamp(0.25 + 0.75 * KS.WARP_STEPS[s.warpI] / 10, 0, 1) : 0; this.lensK = ease(this.lensK || 0, tgt, tgt > (this.lensK || 0) ? 1.4 : 2.2, dt); }
  // the crew on the move
  for (const c of CREW) if (c.path) { c.ph = (c.ph || Math.random() * 10) + dt * (c.dwell ? 0.05 : 0.08); }
  this.wake = this.wake && this.wake.t > 0 ? (this.wake.t -= dt, this.wake) : null; this.repT = Math.max(0, (this.repT || 0) - dt); this.boostT = Math.max(0, (this.boostT || 0) - dt);
  { const f2 = this.foot(), nearLift = f2 && f2.ss === 'in' && Math.hypot(f2.lx, f2.lz - KS.LIFT_Z) < 3 && !(f2.rideT > 0); this.liftK = ease(this.liftK || 0, nearLift ? 1 : 0, 6, dt); }
  // audio
  if (this.au && this.au.ctx) { {
    this.au.on = this.aboard() || (f && f.ss === 'eva'); this.au.update(this.au.on ? 'starship' : null, { thrust: s.mode === 'warp' ? 1 : Math.abs(s.imp), vx: 0, vz: 0, warp: s.mode === 'warp' ? KS.WARP_STEPS[s.warpI] : 0 }); } }
  this.updateUI();
};
Star.prototype.toSpace = function () {
  const s = this.ship, g = this.g;
  s.world = 'space'; s.mode = null; s.x = 0; s.y = 0; s.z = 0; s.vy = 0; s.pitch = 0; s.roll = 0; s.imp = 0.2; s.landed = null; g.world = 'space'; this.flash = 0.8;
};
Star.prototype.arrive = function () {
  const s = this.ship; s.loc = s.travel.to; s.mode = null; s.travel = null; s.x = 0; s.y = 0; s.z = 0; s.pitch = 0; s.imp = 0.1; this.flash = 1.2;
  this.say('USCITA DALLA CURVATURA · ' + KS.DEST[s.loc].name, 5); if (this.au) this.au.blip(900, 120, 0.9, 0.4);
};
Star.prototype.engage = function () {
  const s = this.ship;
  if (s.world !== 'space') { this.say('PRIMA DECOLLA: IL WARP SI ATTIVA SOLO NELLO SPAZIO', 4); return; }
  if (!s.course || s.course === s.loc) { this.say('IMPOSTA UNA ROTTA NELL’ASTROLAB O CON «ROTTA»', 4); return; }
  const total = Math.max(1e-6, KS.dist(s.loc, s.course)), w = KS.WARP_STEPS[s.warpI];
  s.travel = { to: s.course, total, done: 0, t: 0 }; s.mode = 'warp'; this.flash = 0.6;
  if (w >= 10) { this.say('WARP 10 · VELOCITÀ INFINITA: SEI OVUNQUE NELLO STESSO ISTANTE', 5); }
  else this.say('WARP ' + w + ' · INGRANA!', 3);
  if (this.au) this.au.blip(80, 1400, 1.2, 0.35, 'sawtooth');
};
Star.prototype.takeoff = function () {
  const s = this.ship; if (s.mode) return;
  if (s.world === 'space') { this.say('SEI GIÀ IN ORBITA', 3); return; }
  s.mode = 'ascent'; s.mt = 0; s.vy = 5; s.landed = null; this.say('DECOLLO · VERSO LO SPAZIO', 4);
};
Star.prototype.land = function () {
  const s = this.ship, d = KS.DEST[s.loc]; if (s.mode) return;
  if (s.world !== 'space') { this.say(s.world === 'city' ? 'SEI SOPRA CYBERCITY' : 'SEI GIÀ ATTERRATO', 3); return; }
  if (d.star) { this.say(d.name + ' È UNA STELLA: SI PUÒ SOLO ORBITARE', 4); return; }
  if (d.land === 'city') { s.world = 'city'; this.g.world = 'city'; s.x = CITY.x; s.z = CITY.z; s.y = 3200; s.h = CITY.h; }
  else { this.site = d.land; s.world = 'planet'; this.g.world = 'planet'; s.x = 0; s.z = 0; s.y = 1200; s.h = 0; }
  s.mode = 'descent'; s.mt = 0; s.pitch = 0.2; this.flash = 0.7; this.say('INGRESSO IN ATMOSFERA · ' + d.name, 4);
};

/* ---------------- the avatar (OnFoot extension) ---------------- */
Star.prototype.footUpdate = function (f, dt, inp) {
  if (!f.ss) {
    // the garage display is solid; the badge is picked up with ACTION
    const dx = wrapD(f.x - DISPLAY.x), dz = wrapD(f.z - DISPLAY.z), d = Math.hypot(dx, dz);
    if (d < 1.1 && d > 1e-3 && this.g.world === 'city') { f.x = wrapP(DISPLAY.x + dx / d * 1.1); f.z = wrapP(DISPLAY.z + dz / d * 1.1); }
    return false;
  }
  f.t += dt; const s = this.ship;
  if (f.ss === 'beamout' || f.ss === 'beamin' || f.ss === 'beamdown' || f.ss === 'beamup') {
    f.bt += dt; f.anim = 'in piedi'; f.v = 0;
    if (f.bt > 1.9) {
      if (f.ss === 'beamout' || f.ss === 'beamup') {   // → transporter pad
        if (f.from === 'city') { f.cityX = f.x; f.cityZ = f.z; }
        f.ss = 'beamin'; f.bt = 0; f.deck = 1; f.lx = RIG.pads[0][0]; f.lz = RIG.pads[0][1]; f.lh = PI; f.lcam = PI; f.ly = 0.3; this.greetT = 7;
        if (this.g.world !== s.world && !(s.world === 'city' && this.g.world === 'city')) this.g.world = s.world === 'city' ? 'city' : s.world;
        this.syncFoot(f);
      } else if (f.ss === 'beamin') { f.ss = 'in'; }
      else if (f.ss === 'beamdown') {                 // → city street or planet surface
        f.bt = 0;
        if (s.world === 'city' || (s.world === 'space' && KS.DEST[s.loc].land === 'city')) { this.g.world = 'city'; f.ss = null; f.x = f.cityX !== undefined ? f.cityX : 30; f.z = f.cityZ !== undefined ? f.cityZ : 45; f.y = 0; f.h = 0; f.vis = 1;
          if (s.world === 'space') { /* the ship stays in orbit */ } }
        else { const site = s.world === 'planet' ? this.site : KS.DEST[s.loc].land; this.site = site; this.g.world = 'planet'; f.ss = 'planetin'; f.px = 6; f.pz = -6; f.ph = 0; f.h = 0; f.pcam = 0; f.py = KS.siteHeight(site, 6, -6); }
        this.flash = 0.3;
      }
    }
    return true;
  }
  if (f.ss === 'planetin') { f.bt += dt; f.anim = 'in piedi'; if (f.bt > 1.9) f.ss = 'planet'; return true; }
  const run = !!inp.boost;
  if (f.ss === 'in' && f.rideT > 0) {   // riding the lift: doors shut, a hum, the deck changes half way
    const was = f.rideT; f.rideT -= dt; f.v = 0; f.anim = 'in piedi';
    if (was > 0.7 && f.rideT <= 0.7) { f.deck = f.rideTo; f.lx = 0; f.lz = KS.LIFT_Z; this.syncFoot(f); this.say(D[f.deck].title, 2); }
    if (f.rideT <= 0) { f.rideT = 0; } this.syncFoot(f); return true; }
  if (f.ss === 'in' && f.sit) { f.v = 0; f.anim = 'seduto'; f.lx = f.sit[0]; f.lz = f.sit[1]; f.lh = f.sit[2]; this.syncFoot(f);
    if ((inp.my || 0) > 0.6 || (inp.fwd || 0) > 0.6) this.enter(); return true; }
  if (f.ss === 'in') {
    if (f.lcam === undefined) f.lcam = f.lh;
    f.v = ease(f.v, Math.min(4.2, window.KageOnFoot.dirMove(f, inp, dt, 'lh', 'lcam', run)), 8, dt); f.vs = 0;
    const fx = Math.sin(f.lh), fz = Math.cos(f.lh), rx = -Math.cos(f.lh), rz = Math.sin(f.lh);
    f.lx += (fx * f.v + rx * f.vs) * dt; f.lz += (fz * f.v + rz * f.vs) * dt;
    this.collideDeck(f); this.syncFoot(f);
    const sp = Math.abs(f.v) + Math.abs(f.vs) * 0.6; f.ph += dt * (sp > 3 ? sp / 5.5 : sp / 1.45);
    f.anim = sp > 3.2 ? 'corre' : sp > 0.25 ? 'cammina' : 'in piedi';
    return true;
  }
  if (f.ss === 'helm') { f.anim = 'seduto'; this.syncFoot(f); return true; }
  if (f.ss === 'eva') {   // zero-g suit thrusters in the ship frame
    f.lh = wrapA(f.lh + (inp.yaw || 0) * 1.6 * dt);
    const fx = Math.sin(f.lh), fz = Math.cos(f.lh), rx = -Math.cos(f.lh), rz = Math.sin(f.lh), a = run ? 6 : 3;
    f.evx = ease(f.evx || 0, (fx * (inp.fwd || 0) + rx * (inp.strafe || 0)) * a, 1.2, dt); f.evz = ease(f.evz || 0, (fz * (inp.fwd || 0) + rz * (inp.strafe || 0)) * a, 1.2, dt); f.evy = ease(f.evy || 0, (inp.lift || 0) * a, 1.2, dt);
    f.ex += f.evx * dt; f.ey += f.evy * dt; f.ez += f.evz * dt;
    const r = Math.hypot(f.ex, f.ey * 3, f.ez - 5); if (r > 160) { const k = 160 / r; f.ex *= k; f.ey *= k; f.ez = 5 + (f.ez - 5) * k; }
    // don't go through the hull (a lens: |y| < 6.6·profile)
    const inHull = Math.abs(f.ex) < 28 && f.ez > -40 && f.ez < 65 && Math.abs(f.ey) < 6.6 * (1 - Math.abs(f.ex) / 32);
    if (inHull) { f.ex += Math.sign(f.ex || 1) * 0.5; f.evx = Math.abs(f.evx) * Math.sign(f.ex); }
    f.anim = 'salta'; const w = this.toW([f.ex, f.ey, f.ez]); f.x = w[0]; f.y = w[1]; f.z = w[2]; return true;
  }
  if (f.ss === 'planet') {
    const site = this.site, gr = (KS.DEST[Object.keys(KS.DEST).find(k => KS.DEST[k].land === site)] || {}).g || 1;
    if (f.pcam === undefined) f.pcam = f.h;
    f.v = ease(f.v, window.KageOnFoot.dirMove(f, inp, dt, 'h', 'pcam', run), 8, dt); f.vs = 0;
    const fx = Math.sin(f.h), fz = Math.cos(f.h), rx = -Math.cos(f.h), rz = Math.sin(f.h);
    f.px = clamp(f.px + (fx * f.v + rx * f.vs) * dt, -280, 280); f.pz = clamp(f.pz + (fz * f.v + rz * f.vs) * dt, -280, 280);
    const gh = KS.siteHeight(site, f.px, f.pz);
    if (!f.pair && (inp.lift || 0) > 0.5) { f.pvy = 4.8; f.pair = true; }
    if (f.pair) { f.pvy -= 9.8 * gr * dt; f.py += f.pvy * dt; if (f.py <= gh) { f.py = gh; f.pair = false; } } else f.py = gh;
    const sp = Math.abs(f.v) + Math.abs(f.vs) * 0.6; f.ph += dt * (sp > 3 ? sp / 5.5 : sp / 1.45);
    f.anim = f.pair ? 'salta' : sp > 3.2 ? 'corre' : sp > 0.25 ? 'cammina' : 'in piedi';
    return true;
  }
  return false;
};
Star.prototype.freeChair = function (f) { let best = null, bd = 1.0;
  for (const c of KS.messChairs()) { const d = Math.hypot(f.lx - c[0], f.lz - c[1]); if (d < bd && !CREW.some(k => k.d === 3 && k.pose === 'seduto_m' && Math.hypot(k.x - c[0], k.z - c[1]) < 0.3)) { bd = d; best = c; } } return best; };
Star.prototype.nearPod = function (f) { let bi = -1, bd = 2.1; KS.STASIS.forEach((q, i) => { const d = Math.hypot(f.lx - q[0], f.lz - q[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };
Star.prototype.syncFoot = function (f) { const w = this.toW([f.lx, D[f.deck].y + (f.ly || 0), f.lz]); f.x = w[0]; f.y = w[1]; f.z = w[2]; };
Star.prototype.collideDeck = function (f) {
  const d = D[f.deck];
  if (d.round) { const dx = f.lx, dz = f.lz - d.cz, r = Math.hypot(dx, dz), m = d.round - 0.6; if (r > m) { f.lx = dx / r * m; f.lz = d.cz + dz / r * m; } }
  else { f.lx = clamp(f.lx, d.box[0] + 0.6, d.box[1] - 0.6); f.lz = clamp(f.lz, d.box[2] + 0.6, d.box[3] - 0.6); }
  const push = (cx, cz, r) => { const dx = f.lx - cx, dz = f.lz - cz, dd = Math.hypot(dx, dz) || 1e-3; if (dd < r) { f.lx = cx + dx / dd * r; f.lz = cz + dz / dd * r; } };
  if (d.id === 'ponte') { push(-1.6, 16.8, 1.1); push(1.6, 16.8, 1.1); }
  if (d.id === 'astrolab') push(0, RIG.astro[1], 2.1);
  if (d.id === 'mensa') for (const [tx, tz] of [[-6, 8], [-6, 15], [6, 8], [6, 15], [0, 21]]) push(tx, tz, 1.25);
  if (d.id === 'ingegneria') { push(RIG.core[0], RIG.core[1], 2.6); for (const q of KS.STASIS) push(q[0], q[1], 1.15); }
  if (d.id === 'mensa') push(KS.REPLI[0], KS.REPLI[1], 0.7);
  for (const c of CREW) if (c.d === f.deck && !c.path && c.pose !== 'seduto_m') push(c.x, c.z, 0.45);
  f.ly = d.id === 'teletrasporto' && Math.hypot(f.lx, f.lz - 21.6) < 3.6 ? 0.3 : 0;
};

/* ---------------- ACTION / buttons ---------------- */
Star.prototype.where = function () {
  const f = this.foot(); if (!f || !f.active || this.g.veh) return '';
  if (!f.ss) { if (this.g.world === 'city' && Math.hypot(wrapD(f.x - DISPLAY.x), wrapD(f.z - DISPLAY.z)) < 2.9) return this.badge ? 'badge_off' : 'badge'; return ''; }
  if (f.ss === 'in') { const d = D[f.deck];
    if (Math.hypot(f.lx, f.lz - KS.LIFT_Z) < 1.3) return 'lift';
    if (d.id === 'ponte' && Math.hypot(f.lx - RIG.chair[0], f.lz - RIG.chair[1]) < 1.3) return 'chair';
    if (d.id === 'teletrasporto' && Math.hypot(f.lx, f.lz - 21.6) < 3.2) return 'pad';
    if (d.id === 'astrolab' && Math.hypot(f.lx, f.lz - (RIG.astro[1] - 3.2)) < 1.6) return 'astro';
    if (d.id === 'mensa' && Math.hypot(f.lx - RIG.airlock[0], f.lz - RIG.airlock[1]) < 2.2) return 'airlock';
    if (f.sit) return 'stand';
    if (d.id === 'mensa' && Math.hypot(f.lx - KS.REPLI[0], f.lz - KS.REPLI[1]) < 1.6) return 'replic';
    if (d.id === 'mensa' && this.freeChair(f)) return 'sit';
    if (d.id === 'ingegneria') { const i = this.nearPod(f); if (i >= 0) return 'pod'; if (Math.hypot(f.lx + 5, f.lz - 8) < 1.7 || Math.hypot(f.lx - 5, f.lz - 8) < 1.7) return 'core'; }
    return ''; }
  if (f.ss === 'helm') return 'leave';
  if (f.ss === 'eva') return Math.hypot(f.ex - 24.5, f.ey + 3.2, f.ez - 20) < 5 ? 'reenter' : '';
  return '';
};
const ACT_LABEL = { stand: 'ALZATI', replic: 'REPLICA', sit: 'SIEDITI', pod: 'STASI', core: 'NUCLEO', badge: 'BADGE', badge_off: 'BADGE', lift: 'PONTI', chair: 'COMANDO', pad: 'TELETRASP.', astro: 'ROTTA', airlock: 'EVA', leave: 'ALZATI', reenter: 'RIENTRA' };
Star.prototype.action = function () { return ACT_LABEL[this.where()] || ''; };
Star.prototype.enter = function () {
  const f = this.foot(), w = this.where(); if (w) this.beamSound(true); if (!w) return !!(f && f.ss && f.ss !== 'planet');
  if (w === 'badge') { this.badge = true; LS.set('kageBadge', '1'); this.say('BADGE KAGE ODYSSEY INDOSSATO · premi BEAM IN', 4); }
  else if (w === 'badge_off') { this.badge = false; LS.set('kageBadge', '0'); this.say('BADGE RIMESSO AL SUO POSTO', 3); }
  else if (w === 'lift') this.menu('decks');
  else if (w === 'sit') { const c = this.freeChair(f); f.sit = c; f.v = 0; this.say('SEDUTO IN MENSA · INVIO o avanti per alzarti', 3); }
  else if (w === 'stand') { const c = f.sit; f.sit = null; f.lx = c[0] - Math.sin(c[2]) * 0.7; f.lz = c[1] - Math.cos(c[2]) * 0.7; f.lh = c[2] + PI; f.lcam = f.lh; this.syncFoot(f); }
  else if (w === 'replic') { this.repK = ((this.repK || 0) + 1) % REPLI_MENU.length; this.repT = 9; this.say('REPLICATORE · ' + REPLI_MENU[this.repK], 4); if (this.au) this.au.blip(500, 1600, 0.9, 0.12, 'sine'); }
  else if (w === 'pod') { const i = this.nearPod(f), who = SLEEPERS[i];
    if (this.wake && this.wake.i === i) { this.wake = null; this.say('CAPSULA ' + (i + 1) + ' · OSPITE DI NUOVO IN STASI', 3); }
    else { this.wake = { i, t: 16 }; this.say('CAPSULA ' + (i + 1) + ' · RISVEGLIO · ' + (typeof who === 'string' ? 'OSPITE ' + who.toUpperCase() : 'MEMBRO DELL’EQUIPAGGIO') + ' · tornerà in stasi tra poco', 5); } }
  else if (w === 'core') { this.boostT = 8; const wf = KS.WARP_STEPS[this.ship.warpI]; this.say('NUCLEO WARP · RIEQUILIBRATO · MATERIA/ANTIMATERIA 1:1 · PRONTO PER WARP ' + wf, 5); if (this.au) this.au.blip(120, 900, 2.4, 0.16, 'sawtooth'); }
  else if (w === 'chair') { f.ss = 'helm'; f.lx = RIG.chair[0]; f.lz = RIG.chair[1]; f.lh = 0; this.g.view = 0; this.say('AI COMANDI · W/S impulso · A/D virata · SPAZIO/X quota · 1-9 · 0 = WARP 10', 5); }
  else if (w === 'leave') { f.ss = 'in'; f.lz = RIG.chair[1] - 1.2; f.lh = PI; f.lcam = PI; }
  else if (w === 'pad') this.beamDown();
  else if (w === 'astro') this.menu('course');
  else if (w === 'airlock') { f.ss = 'eva'; f.ex = 25.5; f.ey = -3.2; f.ez = 20; f.lh = PI / 2; f.evx = f.evy = f.evz = 0; this.say('ATTIVITÀ EXTRAVEICOLARE · W/S/Q/E propulsori · SPAZIO/X su e giù', 5); }
  else if (w === 'reenter') { f.ss = 'in'; f.deck = 3; f.lx = RIG.airlock[0] - 1.5; f.lz = RIG.airlock[1]; f.lh = -PI / 2; f.lcam = -PI / 2; this.syncFoot(f); }
  return true;
};
Star.prototype.beamIn = function () {
  const f = this.foot(); if (!f || !f.active || this.g.veh) return;
  if (!this.badge) { this.say('PRIMA PRENDI IL BADGE DAL MODELLINO NEL KAGE GARAGE', 4); return; }
  if (f.ss === 'planet') { f.ss = 'beamup'; f.bt = 0; f.from = 'planet'; }
  else if (!f.ss) {
    if (this.g.world !== 'city') { this.say('QUI IL TELETRASPORTO NON RAGGIUNGE LA NAVE', 3); return; }
    if (this.ship.world !== 'city' && !(this.ship.world === 'space' && this.ship.loc === 'terra')) { this.say('LA NAVE È LONTANA: È IN ORBITA ALTROVE', 4); return; }
    f.ss = 'beamout'; f.bt = 0; f.from = 'city';
  } else return;
  this.beamSound();
};
Star.prototype.beamDown = function () {
  const f = this.foot(), s = this.ship, d = KS.DEST[s.loc];
  if (s.mode) { this.say('ATTENDI: LA NAVE È IN MANOVRA', 3); return; }
  if (s.world === 'space' && d.star) { this.say('NIENTE SU CUI SCENDERE: ' + d.name + ' È UNA STELLA', 4); return; }
  f.ss = 'beamdown'; f.bt = 0; this.beamSound();
};
Star.prototype.beamSound = function (quiet) { if (!this.au && window.FleetAudio) this.au = new FleetAudio(); if (this.au) { this.au.start(); this.au.on = true; if (!quiet) { this.au.blip(300, 2400, 1.8, 0.18, 'triangle'); this.au.blip(1800, 600, 1.8, 0.1); } } };
Star.prototype.key = function (code) {
  const f = this.foot(); if (!f || !f.active) return false;
  if (code === 'KeyB') { if (!f.ss || f.ss === 'planet') { this.beamIn(); return true; } }
  if (f.ss !== 'helm') return false;
  const s = this.ship;
  if (/^Digit[0-9]$/.test(code)) { const n = +code.slice(5); s.warpI = n === 0 ? KS.WARP_STEPS.length - 1 : Math.min(n - 1, 8); this.say('FATTORE WARP ' + KS.WARP_STEPS[s.warpI], 2); return true; }
  if (code === 'Equal' || code === 'NumpadAdd') { s.warpI = Math.min(KS.WARP_STEPS.length - 1, s.warpI + 1); return true; }
  if (code === 'Minus' || code === 'NumpadSubtract') { s.warpI = Math.max(0, s.warpI - 1); return true; }
  if (code === 'KeyT') { this.takeoff(); return true; } if (code === 'KeyL') { this.land(); return true; }
  if (code === 'KeyJ') { this.engage(); return true; } if (code === 'KeyN') { this.menu('course'); return true; }
  if (code === 'KeyX' && s.mode === 'warp') { s.mode = null; s.travel = null; this.say('USCITA DALLA CURVATURA · ROTTA INTERROTTA', 3); return true; }
  return false;
};

/* ---------------- on-screen UI: BEAM IN, helm buttons, deck + cartouche menus ---------------- */
Star.prototype.buildUI = function () {
  const st = document.createElement('style');
  st.textContent = '#stUI{position:fixed;left:50%;transform:translateX(-50%);bottom:8vmin;display:flex;gap:1.2vmin;z-index:20;flex-wrap:wrap;justify-content:center;max-width:80vw}'
    + '#stUI button,#stMenu button{font:bold 2.2vmin monospace;color:#ecfcff;background:rgba(7,11,19,.72);border:2px solid rgba(255,200,90,.8);border-radius:2vmin;padding:1.2vmin 2vmin;cursor:pointer}'
    + '#stUI button.big{font-size:3vmin;border-color:#7ff;box-shadow:0 0 2vmin rgba(120,255,255,.6)} #stUI button.on{background:rgba(255,190,80,.35)}'
    + '#stMenu{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;background:rgba(5,8,16,.92);border:2px solid rgba(255,200,90,.8);border-radius:2vmin;padding:2vmin;display:none;max-height:80vh;overflow:auto;min-width:50vmin;color:#ecfcff;font:2vmin monospace}'
    + '#stMenu .card{display:block;width:100%;text-align:left;margin:.8vmin 0} #stMenu .card small{display:block;font-weight:normal;opacity:.8;margin-top:.4vmin} #stMenu h3{margin:0 0 1vmin;letter-spacing:.2em;color:#ffcf70}';
  document.head.appendChild(st);
  const ui = this.ui = document.createElement('div'); ui.id = 'stUI'; document.body.appendChild(ui);
  const mn = this.mn = document.createElement('div'); mn.id = 'stMenu'; document.body.appendChild(mn);
  const B = (id, label, fn, cls) => { const b = document.createElement('button'); b.id = id; b.textContent = label; if (cls) b.className = cls; b.style.display = 'none';
    const go = e => { e.preventDefault(); e.stopPropagation(); fn(); }; b.addEventListener('click', go); b.addEventListener('touchstart', go); ui.appendChild(b); return b; };
  this.btn = {
    beam: B('stBeam', '✦ BEAM IN', () => this.beamIn(), 'big'),
    up: B('stUp', '⇧ DECOLLA', () => this.takeoff()), down: B('stDown', '⇩ ATTERRA', () => this.land()),
    wm: B('stWm', 'WARP −', () => { this.ship.warpI = Math.max(0, this.ship.warpI - 1); }), wp: B('stWp', 'WARP +', () => { this.ship.warpI = Math.min(KS.WARP_STEPS.length - 1, this.ship.warpI + 1); }),
    go: B('stGo', '⚡ INGRANA', () => this.engage(), 'big'), stop: B('stStop', '■ ESCI DAL WARP', () => this.key('KeyX')), nav: B('stNav', '🧭 ROTTA', () => this.menu('course')) };
};
Star.prototype.updateUI = function () {
  const f = this.foot(), s = this.ship, show = (b, on) => { const v = on ? 'inline-block' : 'none'; if (b.style.display !== v) b.style.display = v; };
  const foot = f && f.active && !this.g.veh, helm = foot && f.ss === 'helm';
  show(this.btn.beam, foot && this.badge && (!f.ss || f.ss === 'planet'));
  show(this.btn.up, helm && !s.mode && s.world !== 'space'); show(this.btn.down, helm && !s.mode && s.world === 'space');
  for (const k of ['wm', 'wp', 'nav']) show(this.btn[k], helm && s.mode !== 'warp'); show(this.btn.go, helm && s.world === 'space' && !s.mode); show(this.btn.stop, helm && s.mode === 'warp');
  const lab = 'WARP ' + KS.WARP_STEPS[s.warpI]; if (this.btn.go.dataset.l !== lab) { this.btn.go.dataset.l = lab; this.btn.go.textContent = window.tr ? tr('⚡ INGRANA') + ' · ' + lab : '⚡ INGRANA · ' + lab; }
  if (this.mn.style.display !== 'none' && !(f && f.active && (f.ss === 'in' || f.ss === 'helm'))) this.mn.style.display = 'none';
};
Star.prototype.menu = function (kind) {
  const mn = this.mn, s = this.ship, f = this.foot(); let h = '';
  if (kind === 'decks') { h = '<h3>ASCENSORE · PONTI</h3>' + D.map((d, i) => '<button class="card" data-deck="' + i + '">' + (i === f.deck ? '▶ ' : '') + d.title + '</button>').join(''); }
  else { h = '<h3>ASTROLAB · CARTIGLI DI NAVIGAZIONE</h3><div style="opacity:.8;margin-bottom:1vmin">Posizione: ' + KS.DEST[s.loc].name + ' · fattore warp ' + KS.WARP_STEPS[s.warpI] + '</div>';
    for (const k of KS.DEST_ORDER) { const d = KS.DEST[k], dl = KS.dist(s.loc, k), c = KS.warpC(KS.WARP_STEPS[s.warpI]), eta = isFinite(c) ? dl / (c * 0.0004) : 0, real = isFinite(c) ? dl / c * 365.25 : 0;
      h += '<button class="card" data-dest="' + k + '"' + (k === s.loc ? ' disabled style="opacity:.5"' : '') + '>' + (s.course === k ? '◆ ' : '') + d.name + '<small>' + d.type + ' · ' + fmtLy(dl) + (d.temp ? ' · ' + d.temp : '') + (d.g ? ' · gravità ' + d.g + ' g' : '')
        + (k !== s.loc ? ' · ETA ' + (isFinite(c) ? fmtT(eta) + ' (reale ' + fmtDays(real) + ')' : 'ISTANTANEA') : '') + '</small></button>'; } }
  h += '<button data-close="1" style="margin-top:1vmin">✕ CHIUDI</button>';
  mn.innerHTML = h; mn.style.display = 'block';
  mn.querySelectorAll('button').forEach(b => { const go = e => { e.preventDefault(); e.stopPropagation(); const d = b.dataset;
      if (d.deck !== undefined) { if (+d.deck !== f.deck) { f.rideT = 1.4; f.rideTo = +d.deck; f.lx = 0; f.lz = KS.LIFT_Z; f.lh = 0; f.lcam = 0; this.syncFoot(f); if (this.au) this.au.blip(220, 140, 1.3, 0.12, 'sine'); } }
      if (d.dest) { s.course = d.dest; this.say('ROTTA IMPOSTATA · ' + KS.DEST[d.dest].name + ' · ' + fmtLy(KS.dist(s.loc, d.dest)), 4); }
      mn.style.display = 'none'; };
    b.addEventListener('click', go); b.addEventListener('touchstart', go); });
};
const fmtLy = ly => ly >= 1 ? ly.toLocaleString('it-IT', { maximumFractionDigits: 2 }) + ' anni luce' : ly > 1e-6 ? (ly * 63241).toLocaleString('it-IT', { maximumFractionDigits: 2 }) + ' UA' : (ly * 9.461e12).toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' km';
const fmtT = s => s < 1 ? '<1 s' : s < 120 ? Math.round(s) + ' s' : Math.round(s / 60) + ' min';
const fmtDays = d => d < 1 / 24 ? Math.max(1, Math.round(d * 1440)) + ' min' : d < 2 ? Math.round(d * 24) + ' ore' : d < 730 ? Math.round(d) + ' giorni' : Math.round(d / 365.25) + ' anni';

/* ---------------- camera ---------------- */
Star.prototype.camera = function (cv, dt) {
  const f = this.foot(), g = this.g, s = this.ship; if (!f || !f.active || !f.ss) { this.far = this.SPACE() ? 9000 : 700; return cv; }
  let E, L, fov = 62;
  const W = p => this.toW(p);
  if (f.ss === 'in' || f.ss === 'beamin') {
    const d = D[f.deck], y = d.y + (f.ly || 0), ch = f.lcam === undefined ? f.lh : f.lcam, fx = Math.sin(ch), fz = Math.cos(ch);
    let ex = f.lx - fx * 3.0, ez = f.lz - fz * 3.0;
    if (d.round) { const r = Math.hypot(ex, ez - d.cz), m = d.round - 0.4; if (r > m) { ex = ex / r * m; ez = d.cz + (ez - d.cz) / r * m; } }
    else { ex = clamp(ex, d.box[0] + 0.35, d.box[1] - 0.35); ez = clamp(ez, d.box[2] + 0.35, d.box[3] - 0.35); }
    E = W([ex, y + 1.95, ez]); L = W([f.lx + fx * 2, y + 1.4, f.lz + fz * 2]); fov = 70;
  } else if (f.ss === 'helm') {
    if (g.view % 2 === 0) { const y = D[0].y; E = W([0, y + 1.75, RIG.chair[1] - 0.6]); L = W([0, y + 1.4, 40]); fov = 78; }
    else { this.cin = (this.cin || 0) + dt * 0.05; E = W([Math.sin(this.cin) * 60, 38, -170]); L = W([0, 0, 25]); fov = 55;
      const off = [E[0] - s.x, E[1] - s.y, E[2] - s.z]; if (!this.camOff) this.camOff = off; const a = Math.min(1, dt * 1.8);
      this.camOff = this.camOff.map((c, i) => c + (off[i] - c) * a); E = [s.x + this.camOff[0], s.y + this.camOff[1], s.z + this.camOff[2]]; }
    if (s.mode === 'warp' && s.travel) { const k = Math.min(1, s.travel.t / 1.2); fov += 38 * Math.sin(k * PI) + 10 * k; }
    this.camRoll = -(s.roll || 0) * (g.view % 2 === 0 ? 1 : 0.5);
  } else if (f.ss === 'eva') {
    const fx = Math.sin(f.lh), fz = Math.cos(f.lh); E = W([f.ex - fx * 5, f.ey + 1.8, f.ez - fz * 5]); L = W([f.ex + fx * 3, f.ey + 0.8, f.ez + fz * 3]); fov = 66;
  } else if (f.ss === 'beamout') { return cv; }
  else if (f.ss === 'beamdown') { const d = D[1]; E = W([0, d.y + 2.6, 15.5]); L = W([0, d.y + 1.2, 21.6]); }
  else if (f.ss === 'planet' || f.ss === 'planetin' || f.ss === 'beamup') {
    const ch = f.pcam === undefined ? f.h : f.pcam, fx = Math.sin(ch), fz = Math.cos(ch), view = g.view % 3, D2 = view === 1 ? 7 : 4, H2 = view === 1 ? 3 : 2;
    E = [f.px - fx * D2, f.py + H2, f.pz - fz * D2]; E[1] = Math.max(E[1], KS.siteHeight(this.site, E[0], E[2]) + 0.6); L = [f.px + fx * 2, f.py + 1.4, f.pz + fz * 2]; fov = 62;
    if (view === 2) { E = [f.px, f.py + 30, f.pz - 6]; L = [f.px, f.py, f.pz]; }
  } else return cv;
  this.far = this.SPACE() || s.y > 900 ? 9000 : (this.aboard() ? 2600 : 700);
  if (g.world === 'city') { const c = g.c, ex = wrapD(E[0] - c.x), ez = wrapD(E[2] - c.z); return { e: [ex, E[1], ez], l: [ex + wrapD(L[0] - E[0]), L[1], ez + wrapD(L[2] - E[2])], fov, drawCar: !this.aboard() && f.ss !== 'eva', cockpit: false, roll: f.ss === 'helm' ? (this.camRoll || 0) : 0 }; }
  const roll = f.ss === 'helm' ? (this.camRoll || 0) : 0;
  this.E = E; return { e: [0, 0, 0], l: [L[0] - E[0], L[1] - E[1], L[2] - E[2]], fov, drawCar: false, cockpit: false, roll };
};
/** palette: climbing above Cybercity darkens the sky; space is black; each planet has its own sky */
Star.prototype.pal = function (pal) {
  const g = this.g, s = this.ship;
  if (g.world === 'space') return Object.assign({}, pal, { fog: [0, 0, 0.004], top: [0, 0, 0.01], fogDen: 0.00002, stripes: 0, sun: [1, 0.95, 0.85], sunDir: [0.55, 0.3, 0.78] });
  if (g.world === 'planet') { const P = KS.SITES[this.site] || KS.SITES.marte; return Object.assign({}, pal, { fog: P.fog, top: P.top, sun: P.sun, sunDir: this.site === 'proxima' ? [0.95, 0.08, 0.3] : [0.5, 0.45, 0.74], fogDen: P.fogDen, stripes: 0 }); }
  if (this.involved() && s.world === 'city' && s.y > 700) { const k = sstep(700, 3200, s.y); return Object.assign({}, pal, { fog: mixv(pal.fog, [0, 0, 0.01], k), top: mixv(pal.top, [0, 0, 0], k), fogDen: pal.fogDen * (1 - 0.9 * k) }); }
  return pal;
};
Star.prototype.dayK = function () { const g = this.g; if (g.world === 'space') return 0; if (g.world === 'planet') return (KS.SITES[this.site] || {}).day || 0; return null; };

/* ---------------- drawing ---------------- */
Star.prototype.drawM = function (mesh, M, o) {
  const gl = this.gl, P = this.g.P.veh, u = P.u; o = o || {};
  gl.uniformMatrix4fv(u.uModel, false, M); gl.uniform1f(u.uRotA, o.rot || 0); gl.uniform1f(u.uPropA, o.prop || 0); gl.uniform1f(u.uBlur, 0); gl.uniform1f(u.uSail, 0);
  if (u.uSteer) gl.uniform1f(u.uSteer, 0); this.g.draw(P, mesh);
};
Star.prototype.drawAvatar = function (ctx, Mv, pose, opt, t) {
  const F = this.g.fleet; if (!F) return;
  F.drawPilotPose(ctx.set, Mv, pose, Object.assign({ key: 'me' }, opt || {}), null, t);
  if (this.badge) { const pm = F.pilotMesh(true); if (!pm) return; const B = KP.pose(pose, t, opt || {}, pm.S), Sx = pm.S || 1;
    const bm = new Float32Array(B.buffer, B.byteOffset + 2 * 16 * 4, 16);
    const gl = this.gl, P = this.g.P.veh; gl.useProgram(P.p); ctx.set(P); gl.uniform1f(P.u.uGlowOnly, 0);
    this.drawM(this.mesh('badge', () => KS.buildBadge()), U.mul(Mv, U.mul(bm, U.T(0.085 * Sx, 1.37 * Sx, 0.15 * Sx)))); }
};
Star.prototype.drawWorld = function (ctx) {
  const g = this.g, gl = this.gl, F = g.fleet; if (!F) return;
  const P = g.P.veh, u = P.u, t = ctx.t, s = this.ship, f = this.foot(), cfg = this.cfg();
  const prep = () => { gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uGlowOnly, 0); if (u.uDay) gl.uniform1f(u.uDay, g.dayK || 0); };
  prep();
  // garage display: the miniature turning above its pedestal + the badge on its stand
  if (g.world === 'city') { const r = this.rel([DISPLAY.x, 0, DISPLAY.z], ctx);
    if (Math.hypot(r[0], r[2]) < 250) { this.drawM(this.mesh('display', () => KS.buildDisplay()), U.T(r[0], 0, r[2]));
      this.drawM(this.mesh('mini', () => KS.buildStarship(cfg, 'hi')), U.mul(U.T(r[0], 2.0 + Math.sin(t) * 0.05, r[2]), U.mul(U.RY(t * 0.3), FM(0.014))));
      if (!this.badge) this.drawM(this.mesh('badgeBig', () => { const mb = new KF.MB(); mb.part = 'badge'; KS.hexBadge(mb, 0.12, { c: [0.85, 0.65, 0.2], e: 0.15, slot: 2 }, { c: [0, 1, 0.9], e: 1.3, slot: 3 }); return mb.finish(); }), U.mul(U.T(r[0] + 0.55, 1.32, r[2] + 0.45), U.RY(t))); } }
  // clouds under the ship (only seen from up high)
  if (g.world === 'city' && g.cv && g.cv.e[1] > 250) { gl.uniform1f(u.uLit, 1.2);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const r = this.rel([630 + i * S, 470, 630 + j * S], ctx); if (Math.abs(r[0]) > 1500 || Math.abs(r[2]) > 1500) continue; this.drawM(this.mesh('clouds', () => KS.buildClouds()), U.T(r[0], r[1], r[2])); }
    gl.uniform1f(u.uLit, 1); }
  // space: stars, the local body (planet or the two suns), warp streaks
  if (g.world === 'space') {
    gl.uniform1f(u.uGlowOnly, 1); if (!window.__noStars) this.drawM(this.mesh('stars', () => KS.buildStars()), U.T(0, 0, 0));
    if (s.mode === 'warp') { const wk = clamp(KS.WARP_STEPS[s.warpI] / 10, 0.1, 1), z = ((t * 900 * (0.4 + wk)) % 1600) - 800, fwd = this.R4();
      for (const dz of [z, z - 1600]) this.drawM(this.mesh('streaks', () => KS.buildStreaks()), U.mul(U.T(0, 0, 0), U.mul(fwd, U.T(0, 0, -dz)))); }
    gl.uniform1f(u.uGlowOnly, 0);
    if (s.mode !== 'warp' && !window.__noPlanet) { const d = KS.DEST[s.loc], pr = this.rel([0, -d.R - 650, 2800], ctx);
      if (d.star) { gl.uniform1f(u.uGlowOnly, 1); this.drawM(this.mesh('pl_alpha', () => KS.buildPlanet('alpha', this.lod)), U.mul(U.T(...this.rel([0, 200, 3800], ctx)), FM(900)));
        this.drawM(this.mesh('pl_alphaB', () => KS.buildPlanet('alpha', 'hi')), U.mul(U.T(...this.rel([3200, 900, 5200], ctx)), FM(520))); gl.uniform1f(u.uGlowOnly, 0); }
      else { gl.uniform1f(u.uLit, 1.1); this.drawM(this.mesh('pl_' + s.loc, () => KS.buildPlanet(s.loc, this.lod)), U.mul(U.T(...pr), U.mul(U.RY(t * 0.01), FM(d.R)))); gl.uniform1f(u.uLit, 1);
        gl.uniform1f(u.uGlowOnly, 1); this.drawM(this.mesh('pl_sun', () => KS.buildPlanet('alpha', 'hi')), U.mul(U.T(...this.rel([4300, 2400, 6000], ctx)), FM(s.loc === 'proxima' ? 700 : 260))); gl.uniform1f(u.uGlowOnly, 0); } }
  }
  // planet surface + landmarks + locals
  if (g.world === 'planet') { const site = this.site;
    this.drawM(this.mesh('site_' + site, () => KS.buildSite(site, this.lod)), U.T(...this.rel([0, 0, 0], ctx)), { rot: t });
    if (site === 'luna') { gl.uniform1f(u.uGlowOnly, 1); this.drawM(this.mesh('pl_terra', () => KS.buildPlanet('terra', this.lod)), U.mul(U.T(...this.rel([600, 1400, 3200], ctx)), FM(420))); gl.uniform1f(u.uGlowOnly, 0); }
    if (site === 'proxima') { gl.uniform1f(u.uGlowOnly, 1); this.drawM(this.mesh('pl_sun', () => KS.buildPlanet('alpha', 'hi')), U.mul(U.T(...this.rel([4200, 300, 1300], ctx)), FM(800))); gl.uniform1f(u.uGlowOnly, 0); }
    for (const [who, x, z] of (SITE_CREW[site] || [])) { const a = t * 0.12 + x, px = x + Math.cos(a) * 6, pz = z + Math.sin(a) * 6, h = -a;
      F.drawPilotPose(ctx.set, U.mul(U.T(...this.rel([px, KS.siteHeight(site, px, pz), pz], ctx)), U.RY(h)), 'cammina', { speed: 0.72 }, this.person(who), t * 0.5 + x); }
    prep(); }
  // the ship (exterior when seen from outside; the current deck + crew when you're aboard)
  if (this.shipVisible()) {
    const Ms = this.shipM(ctx), aboard = this.aboard(), helmIn = f && f.ss === 'helm' && g.view % 2 === 0;
    const inside = aboard && (f.ss !== 'helm' || helmIn);
    if (!inside) { gl.uniform1f(u.uLit, g.world === 'space' ? 1.7 : 1.1); this.drawM(this.mesh('ship', () => KS.buildStarship(cfg, this.lod)), Ms, { rot: t * 0.8 }); gl.uniform1f(u.uLit, 1); }
    if (inside) { const di = f.ss === 'helm' ? 0 : f.deck; gl.uniform1f(u.uLit, 1.6);
      this.coreRot = (this.coreRot || 0) + (ctx.dt || 1 / 60) * 0.7 * (1 + 3 * Math.min(1, (this.boostT || 0) / 2) + (s.mode === 'warp' ? 2 : 0)); this.drawM(this.mesh('deck' + di, () => KS.buildDeck(D[di].id, cfg, this.lod)), Ms, { rot: this.coreRot }); gl.uniform1f(u.uLit, 1);
      // crew of this deck
      for (const c of CREW) { if (c.d !== di) continue; let x = c.x, z = c.z, h = c.h, pose = c.pose, tt = t + (c.x || 0);
        if (c.path && c.dwell) { const A = c.path[0], B = c.path[1], u = c.ph % 1, sm = v => v * v * (3 - 2 * v); let k, still = null;
          if (u < 0.35) k = sm(u / 0.35); else if (u < 0.5) { k = 1; still = c.hB; } else if (u < 0.85) k = 1 - sm((u - 0.5) / 0.35); else { k = 0; still = c.hA; }
          x = A[0] + (B[0] - A[0]) * k; z = A[1] + (B[1] - A[1]) * k;
          if (still !== null) { h = still; pose = c.work || 'in piedi'; c.pk = k; }
          else { h = Math.atan2(B[0] - A[0], B[1] - A[1]) + (u > 0.5 ? PI : 0); pose = 'cammina'; c.wd = (c.wd || 0) + Math.abs(k - (c.pk === undefined ? k : c.pk)) * Math.hypot(B[0] - A[0], B[1] - A[1]); c.pk = k; tt = c.wd / 1.45; } }
        else if (c.path) { const k = 0.5 - 0.5 * Math.cos(c.ph * TAU), A = c.path[0], B = c.path[1]; x = A[0] + (B[0] - A[0]) * k; z = A[1] + (B[1] - A[1]) * k; h = Math.atan2(B[0] - A[0], B[1] - A[1]) + (Math.sin(c.ph * TAU) < 0 ? PI : 0); pose = 'cammina'; c.wd = (c.wd || 0) + Math.abs(k - (c.pk === undefined ? k : c.pk)) * Math.hypot(B[0] - A[0], B[1] - A[1]); c.pk = k; tt = c.wd / 1.45; }
        const near = f.ss === 'in' && f.deck === di && Math.hypot(f.lx - x, f.lz - z) < 3.2;
        if ((near && c.wave) || (c.greet && this.greetT > 0)) { pose = 'saluto'; h = Math.atan2(f.lx - x, f.lz - z); }
        let opt = { key: 'crew' + CREW.indexOf(c) }; if (pose === 'seduto_m') { pose = 'seduto'; opt = { key: opt.key, seat: MESS_SEAT }; if (near && c.wave) { pose = 'saluto'; opt = { key: opt.key }; } }
        if (pose === 'seduto_c') { pose = 'seduto'; opt = { key: opt.key, seat: { hip: [0, 0.55, -0.1], footL: [0.12, 0.05, 0.45], footR: [-0.12, 0.05, 0.45], wheel: [0, 1.05, 0.6], wheelR: 0.25 } }; }
        F.drawPilotPose(ctx.set, U.mul(Ms, U.mul(U.T(x, D[di].y, z), U.RY(h))), pose, opt, this.person(c.who), tt); }
      // sleepers floating in the stasis pods (one may be awake, standing in front of its pod)
      if (D[di].id === 'ingegneria') KS.STASIS.forEach((q, i) => { const who = SLEEPERS[i], awake = this.wake && this.wake.i === i, face = q[0] < 0 ? PI / 2 : -PI / 2;
        if (awake) { const ax = q[0] - Math.sign(q[0]) * 1.2, az = q[1] + (q[1] < 21 ? -1.1 : 1.1), hh = f && f.ss === 'in' ? Math.atan2(f.lx - ax, f.lz - az) : face; F.drawPilotPose(ctx.set, U.mul(Ms, U.mul(U.T(ax, D[di].y, az), U.RY(hh))), this.wake.t > 13 ? 'esulta' : 'saluto', { key: 'pod' + i }, this.person(who), t); }
        else F.drawPilotPose(ctx.set, U.mul(Ms, U.mul(U.T(q[0], D[di].y + 0.42 + Math.sin(t * 0.6 + i * 1.7) * 0.05, q[1]), U.RY(face))), 'stasi', { key: 'pod' + i }, this.person(who), t + i); });
      prep();
      // lift doors (slide open when you walk up) + the replicated cup on the mess counter
      { const k = this.liftK || 0, dm = this.mesh('liftDoor', () => { const mb = new KF.MB(); mb.part = 'porta_ascensore'; mb.box(0, 1.6, 0, 1.02, 3.2, 0.1, { c: [0.62, 0.64, 0.7], e: 0, slot: 0, mode: 0, a: [0, 0, 0] }); mb.box(0, 1.6, 0.06, 0.05, 2.8, 0.02, { c: [0.2, 0.85, 1], e: 1.2, slot: 3, mode: 0, a: [0, 0, 0] }); return mb.finish(); });
        for (const sx of [-1, 1]) this.drawM(dm, U.mul(Ms, U.T(sx * (0.52 + k * 1.0), D[di].y, KS.LIFT_Z + 1.5))); }
      if (D[di].id === 'mensa' && this.repT > 0) { const cup = this.mesh('cup', () => { const mb = new KF.MB(); mb.part = 'tazza'; mb.cyl(0, 0.11, 0.045, 0.055, 14, { c: [0.95, 0.95, 0.97], e: 0, slot: 0, mode: 0, a: [0, 0, 0] }); mb.disc(0.045, 14, 0.1, { c: [0.35, 0.2, 0.1], e: 0.1, slot: 0, mode: 0, a: [0, 0, 0] }); mb.torus(0.04, 0.008, 10, 4, { c: [0.95, 0.95, 0.97], e: 0, slot: 0, mode: 0, a: [0, 0, 0] }); return mb.finish(); });
        if (this.repT < 8.2 || Math.random() < (9 - this.repT) / 0.8) this.drawM(cup, U.mul(Ms, U.T(KS.REPLI[0] + 0.15, D[di].y + 1.08, KS.REPLI[1]))); }
      prep(); }
    // the avatar inside / on EVA
    if (f && f.active && (f.ss === 'in' || f.ss === 'beamin' || f.ss === 'beamdown' || (f.ss === 'helm' && !helmIn) || f.ss === 'eva')) {
      const vis = f.ss === 'beamin' ? f.bt / 1.9 : f.ss === 'beamdown' ? 1 - f.bt / 1.9 : 1;
      if (vis > 0.98 || Math.random() < vis) {
        if (f.ss === 'eva') this.drawAvatar(ctx, U.mul(Ms, U.mul(U.T(f.ex, f.ey, f.ez), U.mul(U.RY(f.lh), U.RX(0.3)))), 'salta', {}, t * 0.3);
        else if (f.ss === 'helm') this.drawAvatar(ctx, U.mul(Ms, U.mul(U.T(RIG.chair[0], D[0].y, RIG.chair[1]), U.RY(0))), 'seduto', { seat: { hip: [0, 0.55, -0.05], footL: [0.12, 0.05, 0.5], footR: [-0.12, 0.05, 0.5], wheel: [0, 0.75, 0.25], wheelR: 0.35 }, speed: 0 }, t);
        else if (f.sit) this.drawAvatar(ctx, U.mul(Ms, U.mul(U.T(f.lx, D[f.deck].y, f.lz), U.RY(f.lh))), 'seduto', { seat: MESS_SEAT, speed: 0 }, t);
        else this.drawAvatar(ctx, U.mul(Ms, U.mul(U.T(f.lx, D[f.deck].y + (f.ly || 0), f.lz), U.RY(f.lh))), f.anim || 'in piedi', { speed: Math.abs(f.v || 0) }, f.anim === 'cammina' || f.anim === 'corre' ? f.ph : t);
      }
      prep(); }
  }
  // avatar on the street (beaming out) and on planets
  if (f && f.active) {
    if (g.world === 'city' && f.ss === 'beamout') { const vis = f.ss === 'beamout' ? 1 - f.bt / 1.9 : 1;
      if (vis > 0.98 || Math.random() < vis) this.drawAvatar(ctx, U.mul(U.T(...this.rel([f.x, f.y || 0, f.z], ctx)), U.RY(f.h)), 'in piedi', {}, t); prep(); }
    if (g.world === 'planet' && (f.ss === 'planet' || f.ss === 'planetin' || f.ss === 'beamup')) { const vis = f.ss === 'planetin' ? f.bt / 1.9 : f.ss === 'beamup' ? 1 - f.bt / 1.9 : 1;
      if (vis > 0.98 || Math.random() < vis) this.drawAvatar(ctx, U.mul(U.T(...this.rel([f.px, f.py, f.pz], ctx)), U.RY(f.h)), f.anim || 'in piedi', { speed: Math.abs(f.v || 0) }, f.anim === 'cammina' || f.anim === 'corre' ? f.ph : t); prep(); }
  }
};
const buildSparkle = () => { const mb = new KF.MB(); let s9 = 3; const rnd = () => (s9 = (s9 * 16807) % 2147483647) / 2147483647; mb.part = 'scintille_teletrasporto';
    for (let i = 0; i < 160; i++) { const a = rnd() * TAU, r = 0.15 + rnd() * 0.38, y = rnd() * 1.95, sz = 0.012 + rnd() * 0.025; mb.ellipsoid(Math.cos(a) * r, y, Math.sin(a) * r, sz, sz * 2.5, sz, 4, 2, { c: rnd() < 0.5 ? [0.7, 0.95, 1] : [1, 0.95, 0.7], e: 1.8, slot: 3, mode: 1, a: [0, 0, 0] }); }
    mb.part = 'colonna_luce'; mb.cyl(0, 2.1, 0.55, 0.55, 20, { c: [0.6, 0.85, 1], e: 0.35, slot: 3, mode: 0 }, false); return mb.finish(); };
/** warp lensing parameters for the game's screen-space pass: ship position (render space), strength, colour */
Star.prototype.lens = function (ctx) {
  const k = this.lensK || 0, s = this.ship, f = this.foot(); if (k < 0.01 || this.g.world !== 'space') return null;
  const inside = !!(f && f.ss === 'helm' && this.g.view % 2 === 0) || (f && f.ss === 'in');
  return { k, p: this.rel([s.x, s.y, s.z], ctx), r: 70, inside, col: { ciano: [0.2, 0.85, 1], viola: [0.65, 0.35, 1], ambra: [1, 0.6, 0.15] }[this.cfg().warp] || [0.2, 0.85, 1] };
};
/** transporter sparkle columns (additive) */
Star.prototype.drawAdditive = function (ctx) {
  const g = this.g, gl = this.gl, f = this.foot(); if (!f || !f.active || !f.ss) return;
  if (f.ss === 'in' && this.shipVisible() && g.fleet) { const d = D[f.deck], P = g.P.veh, u = P.u, Ms = this.shipM(ctx);
    gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uGlowOnly, 1); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uRotA, ctx.t * 0.5);
    if (d.id === 'ingegneria') { const pg = this.mesh('podGlow', () => window.KageXeno.buildPodGlow([0.35, 0.7, 1])); KS.STASIS.forEach((q, i) => { if (this.wake && this.wake.i === i) return; this.drawM(pg, U.mul(Ms, U.T(q[0], d.y + 0.32, q[1])), { rot: ctx.t * 0.5 + i }); });
      // plasma pulses running up the warp core (faster while boosted or at warp)
      const pr = this.mesh('corePulse', () => { const mb = new KF.MB(); mb.part = 'impulso_plasma'; mb.torus(0.95, 0.12, 28, 6, { c: [0.3, 0.85, 1], e: 1.5, slot: 3, mode: 0, a: [0, 0, 0] }); return mb.finish(); });
      const sp = 0.5 * (1 + 3 * Math.min(1, (this.boostT || 0) / 2) + (this.ship.mode === 'warp' ? 2 : 0));
      for (let k = 0; k < 3; k++) { const ph = (ctx.t * sp + k / 3) % 1; gl.uniform1f(u.uLit, Math.sin(ph * PI) * 1.2); this.drawM(pr, U.mul(Ms, U.T(RIG.core[0], d.y + 0.7 + ph * (RIG.H - 0.8), RIG.core[1]))); } gl.uniform1f(u.uLit, 1); }
    if (d.id === 'mensa' && this.repT > 8) { const sp = this.mesh('sparkle', buildSparkle); { gl.uniform1f(u.uLit, Math.sin((9 - this.repT) * PI) * 1.2); this.drawM(sp, U.mul(Ms, U.mul(U.T(KS.REPLI[0] + 0.15, d.y + 1.05, KS.REPLI[1]), new Float32Array([0.25, 0, 0, 0, 0, 0.12, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 1]))), { rot: ctx.t * 3 }); gl.uniform1f(u.uLit, 1); } }
    gl.uniform1f(u.uGlowOnly, 0); }
  let at = null, k = 0;
  if ((f.ss === 'beamout' || f.ss === 'beamup') ) { k = Math.sin(clamp(f.bt / 1.9, 0, 1) * PI); at = f.ss === 'beamout' ? [f.x, f.y || 0, f.z] : [f.px, f.py, f.pz]; }
  else if (f.ss === 'beamin' || f.ss === 'beamdown') { k = Math.sin(clamp(f.bt / 1.9, 0, 1) * PI); at = this.toW([f.lx, D[f.deck].y + (f.ly || 0), f.lz]); }
  else if (f.ss === 'planetin') { k = Math.sin(clamp(f.bt / 1.9, 0, 1) * PI); at = [f.px, f.py, f.pz]; }
  if (!at || k <= 0.01) return;
  const P = g.P.veh, u = P.u; gl.useProgram(P.p); ctx.set(P); gl.uniform1f(u.uTraffic, 0); gl.uniform1f(u.uScale, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uGlowOnly, 1); gl.uniform1f(u.uLit, k * 1.5);
  const sp = this.mesh('sparkle', buildSparkle);
  this.drawM(sp, U.T(...this.rel(at, ctx)), { rot: ctx.t * 3 });
  gl.uniform1f(u.uGlowOnly, 0); gl.uniform1f(u.uLit, 1);
};
Star.prototype.drawHud = function (hud) {
  const g = this.g, f = this.foot(), s = this.ship, c2 = hud.getContext('2d'), W = hud.width, H = hud.height, m = Math.min(W, H);
  const lines = [];
  if (f && f.active && f.ss) {
    if (f.ss === 'in') { const d = D[f.deck]; lines.push('KAGE ODYSSEY · ' + d.title); }
    if (f.ss === 'helm') { const w = KS.WARP_STEPS[s.warpI], c = KS.warpC(w);
      lines.push('KAGE ODYSSEY · PLANCIA · ' + (s.world === 'space' ? 'ORBITA · ' + KS.DEST[s.loc].name : s.world === 'city' ? 'SOPRA CYBERCITY' : 'ATTERRATI · ' + KS.DEST[s.loc].name));
      if (s.mode === 'warp') { const tr2 = s.travel, rem = Math.max(0, tr2.total - tr2.done); lines.push('IN CURVATURA · WARP ' + w + ' (' + (isFinite(c) ? Math.round(c).toLocaleString('it-IT') + ' × c' : '∞') + ') · VERSO ' + KS.DEST[tr2.to].name + ' · MANCANO ' + fmtLy(rem)); }
      else lines.push('IMPULSO ' + Math.round(s.imp * 100) + '% · FATTORE WARP ' + w + (s.course ? ' · ROTTA: ' + KS.DEST[s.course].name + ' (' + fmtLy(KS.dist(s.loc, s.course)) + ')' : ' · nessuna rotta'));
      lines.push('W/S impulso · A/D virata · SPAZIO/X quota · 1-9 / 0 warp · J ingrana · T decolla · L atterra · N rotta · C vista · INVIO alzati'); }
    if (f.ss === 'eva') lines.push('EVA · tuta spaziale · torna al portello verde per rientrare');
    if (f.ss === 'planet') lines.push(KS.DEST[Object.keys(KS.DEST).find(k => KS.DEST[k].land === this.site)].name + ' · esplora · ✦ BEAM IN per tornare a bordo');
    if (f.ss === 'beamout' || f.ss === 'beamup' || f.ss === 'beamdown') lines.push('TELETRASPORTO IN CORSO…');
    if (f.ss === 'beamin' || f.ss === 'planetin') lines.push('RIMATERIALIZZAZIONE…');
  }
  // alien crew talk in the CUSTODI language: the letters you've learned show through (web/monolith.js)
  if (f && f.active && f.ss === 'in' && window.KageGlyph) { const near = CREW.find(c => c.d === f.deck && typeof c.who === 'string' && c.x !== undefined && Math.hypot(f.lx - c.x, f.lz - c.z) < 3.2);
    if (near) { const KG = window.KageGlyph, ph = KG.SAYINGS[(CREW.indexOf(near) + Math.floor(this.t / 6)) % KG.SAYINGS.length]; lines.push('👽 «' + KG.say(ph) + '»'); } }
  if (this.msgT > 0) lines.push('» ' + this.msg);
  if (f && f.active && !f.ss && this.where().startsWith('badge')) lines.push(this.badge ? 'INVIO · rimetti il badge' : 'INVIO · prendi il badge della KAGE ODYSSEY');
  if (f && f.active && f.ss === 'in') { const w = this.where(); const L = { lift: 'INVIO · ascensore: scegli il ponte', chair: 'INVIO · siediti al posto del capitano', pad: 'INVIO · teletrasporto: scendi', astro: 'INVIO · cartigli dell’Astrolab: scegli il pianeta', airlock: 'INVIO · esci nello spazio (EVA)', sit: 'INVIO · siediti al tavolo', stand: 'INVIO · alzati', replic: 'INVIO · replicatore: ordina qualcosa', pod: 'INVIO · capsula di stasi: risveglia / rimetti in stasi', core: 'INVIO · console del nucleo warp: riequilibra' }[w]; if (L) lines.push(L); }
  if (f && f.active && f.ss === 'eva' && this.where() === 'reenter') lines.push('INVIO · rientra a bordo');
  if (!lines.length && !this.flash) return;
  c2.textAlign = 'center';
  lines.forEach((ln, i) => { c2.font = (i === 0 ? 'bold ' : '') + (m * (i === 0 ? 0.026 : 0.02) | 0) + 'px monospace'; const w = c2.measureText(ln).width + m * 0.03, y = m * 0.07 + i * m * 0.042;
    c2.fillStyle = 'rgba(5,8,16,0.6)'; c2.fillRect(W / 2 - w / 2, y - m * 0.028, w, m * 0.038); c2.fillStyle = i === 0 ? '#ffcf70' : ln.startsWith('»') ? '#7ff' : '#ecfcff'; c2.fillText(ln, W / 2, y); });
  if (this.flash > 0) { c2.fillStyle = 'rgba(220,240,255,' + Math.min(0.9, this.flash) + ')'; c2.fillRect(0, 0, W, H); }
  c2.textAlign = 'left';
};

/* ---------------- OnFoot extension ---------------- */
const OF = window.KageOnFoot;
if (OF) {
  const up0 = OF.prototype.update, dr0 = OF.prototype.draw, hud0 = OF.prototype.drawHud, cam0 = OF.prototype.camera, nc0 = OF.prototype.nearCar;
  OF.prototype.update = function (dt, inp) { const X = this.g.star; if (X && X.footUpdate(this, dt, inp)) return { vF: this.v }; return up0.call(this, dt, inp); };
  OF.prototype.draw = function (ctx) { if (this.ss) return; return dr0.call(this, ctx); };
  OF.prototype.drawHud = function (hud) { if (this.ss) return; return hud0.call(this, hud); };
  OF.prototype.camera = function (view, dt) { return cam0.call(this, view, dt); };
  OF.prototype.nearCar = function () { return !this.ss && nc0.call(this); };
}
window.KageStarGame = Star;
})();
