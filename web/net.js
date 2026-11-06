/* KAGE NET · local multiplayer. Two (or more) phones on the same Wi-Fi share one Cybercity: you see the other pilots on foot,
 * in their KAGE GT or on any KAGE vehicle, with their name over the head; you meet on the KAGE ODYSSEY decks; you send quick
 * messages and challenge each other to a race to a point of the city (first to arrive wins). No server: the Android app
 * broadcasts small UDP packets on the local network (AmpyBridge.net*); in a browser, tabs of the same device talk through a
 * BroadcastChannel (handy to try it). Turn it on from the tablet: 🌐 KAGE NET. */
(function () {
'use strict';
const NR = window.NeonRun, KF = window.KageFleet, U = window.CarRenderUtil; if (!NR) return;
const { S, wrapD } = NR, PI = Math.PI;
const wrapP = v => ((v % S) + S) % S;
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLS = ['#13dff9', '#cf4eff', '#f2ba57', '#7cff6b', '#ff5577', '#ffffff'];
const QUICK = ['👋 Ciao!', '🚀 Saliamo sulla ODYSSEY?', '🏁 Gara?', '📸 Foto di gruppo!', '👀 Seguimi', '🆘 Aiuto!', '✨ Grande!'];

function Net(game) {
  this.g = game; this.on = false; this.peers = {}; this.sendT = 0; this.msgs = [];
  this.id = LS.get('kageNetId', '') || (() => { const v = Math.random().toString(36).slice(2, 8); LS.set('kageNetId', v); return v; })();
  this.name = LS.get('kageNetName', 'PILOTA-' + this.id.slice(0, 4).toUpperCase()); this.col = LS.get('kageNetCol', COLS[0]);
  this.race = null; this.meshes = {};
  if (LS.get('kageNetOn', '0') === '1') this.start();
}
Net.prototype.start = function () {
  if (this.on) return; const B = window.AmpyBridge;
  if (B && B.netStart) { this.mode = B.netStart(47827) ? 'wifi' : 'off'; }
  else if (typeof BroadcastChannel !== 'undefined') { this.bc = new BroadcastChannel('kage-net'); this.bc.onmessage = e => this.recv(e.data, 'local'); this.mode = 'browser'; }
  else this.mode = 'off';
  this.on = this.mode !== 'off'; LS.set('kageNetOn', this.on ? '1' : '0'); if (this.on) this.say('🌐 KAGE NET attivo (' + (this.mode === 'wifi' ? 'Wi-Fi locale' : 'schede del browser') + ')');
};
Net.prototype.stop = function () { if (!this.on) return; this.send({ bye: 1 }); const B = window.AmpyBridge; if (B && B.netStop) B.netStop(); if (this.bc) { this.bc.close(); this.bc = null; } this.on = false; this.peers = {}; LS.set('kageNetOn', '0'); };
Net.prototype.send = function (o) { if (!this.on) return; o.v = 1; o.id = this.id; const s = JSON.stringify(o); const B = window.AmpyBridge; if (this.mode === 'wifi' && B) B.netSend(s); else if (this.bc) this.bc.postMessage(s); };
Net.prototype.say = function (s) { this.msgs.push({ s, t: 6 }); if (this.msgs.length > 5) this.msgs.shift(); };
Net.prototype.recv = function (s, ip) {
  let o; try { o = typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return; } if (!o || o.v !== 1 || o.id === this.id) return;
  if (o.bye) { if (this.peers[o.id]) this.say('👋 ' + this.peers[o.id].name + ' è uscito'); delete this.peers[o.id]; return; }
  let p = this.peers[o.id]; if (!p) { p = this.peers[o.id] = { id: o.id, name: o.name || '?', col: o.col || COLS[0], cur: null, prev: null }; this.say('🌐 ' + (o.name || '?') + ' è entrato in Cybercity'); this.beep(660, 990); }
  p.ip = ip; p.seen = performance.now();
  if (o.st) { p.prev = p.cur; p.cur = Object.assign({ at: performance.now() }, o.st); p.name = o.name || p.name; p.col = o.col || p.col; }
  if (o.cfg) p.cfg = o.cfg;
  if (o.chat) { this.say('💬 ' + p.name + ': ' + o.chat); this.beep(880, 1320); }
  if (o.race) { this.race = { to: o.race.to, t0: performance.now() + 3000, by: p.name, name: o.race.name, win: null }; this.say('🏁 ' + p.name + ' ti sfida: corsa fino a ' + o.race.name + '!'); this.beep(523, 1046); }
  if (o.win && this.race && !this.race.win) { this.race.win = p.name; this.say('🏁 ' + p.name + ' ha vinto la corsa!'); }
};
/** my state, 10 times a second */
Net.prototype.state = function () {
  const g = this.g, f = g.foot, F = g.fleet, Y = g.star;
  if (g.veh && F && F.st) { const s = F.st; return { m: 'veh', k: g.veh.kind, x: s.x, y: s.y, z: s.z, h: s.h, p: s.pitch || 0, r: s.roll || 0, w: g.world }; }
  if (f && f.active) { if (f.ss === 'in' || f.ss === 'helm') return { m: 'ship', d: f.ss === 'helm' ? 0 : f.deck, x: f.lx, z: f.lz, h: f.lh, a: f.ss === 'helm' ? 'seduto' : f.anim || 'in piedi', s: Math.abs(f.v || 0), w: 'ship' };
    if (f.ss === 'planet' && Y) return { m: 'planet', site: Y.site, x: f.px, y: f.py, z: f.pz, h: f.h, a: f.anim || 'in piedi', s: Math.abs(f.v || 0), w: 'planet' };
    if (!f.ss && !f.xs) return { m: 'foot', x: f.x, y: f.y || 0, z: f.z, h: f.h, a: f.anim || 'in piedi', s: Math.abs(f.v || 0), gear: f.gear || '', w: g.world }; }
  const c = g.c; return { m: 'car', x: c.x, y: c.y || 0, z: c.z, h: c.h, sp: Math.hypot(c.vx || 0, c.vz || 0), w: g.world, paint: g.o.paint };
};
Net.prototype.update = function (dt) {
  for (const m of this.msgs) m.t -= dt; this.msgs = this.msgs.filter(m => m.t > 0);
  if (!this.on) return; const B = window.AmpyBridge;
  if (this.mode === 'wifi' && B) { const L = JSON.parse(B.netPoll() || '[]'); for (const q of L) this.recv(q.m, q.ip); }
  this.sendT -= dt; if (this.sendT <= 0) { this.sendT = 0.1; this.cfgT = (this.cfgT || 0) - 0.1; const o = { name: this.name, col: this.col, st: this.state() };
    if (this.cfgT <= 0) { this.cfgT = 3; o.cfg = this.g.fleet && this.g.fleet.pilotCfg ? this.g.fleet.pilotCfg() : null; } this.send(o); }
  const now = performance.now(); for (const k in this.peers) if (now - this.peers[k].seen > 6000) { this.say('📴 ' + this.peers[k].name + ' non risponde'); delete this.peers[k]; }
  // race: arrival
  const R = this.race; if (R && !R.win && now > R.t0) { const st = this.state(); if (st.x !== undefined && (st.m === 'foot' || st.m === 'car' || st.m === 'veh') && Math.hypot(wrapD(st.x - R.to[0]), wrapD(st.z - R.to[1])) < 8) { R.win = this.name; this.send({ win: 1 }); this.say('🏆 HAI VINTO la corsa fino a ' + R.name + '!'); this.beep(523, 1568); } }
  if (R && R.win && now - R.t0 > 15000 + (R.winAt || (R.winAt = now)) - R.t0) this.race = null;
};
/** interpolated pose of a peer (with a little extrapolation) */
Net.prototype.pose = function (p) { const a = p.prev, b = p.cur; if (!b) return null; if (!a || a.m !== b.m || b.at - a.at > 600) return b;
  const k = Math.min(1.5, (performance.now() - b.at) / Math.max(30, b.at - a.at)), L = (u, v) => u + (v - u) * k, LA = (u, v) => { let d = ((v - u + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return u + d * k; };
  return Object.assign({}, b, { x: a.m === 'ship' ? L(a.x, b.x) : a.x + wrapD(b.x - a.x) * k, z: a.m === 'ship' ? L(a.z, b.z) : a.z + wrapD(b.z - a.z) * k, y: L(a.y || 0, b.y || 0), h: LA(a.h, b.h) }); };
Net.prototype.pilot = function (p) { if (!p.cfg || !window.KagePilot || !this.g.fleet) return null; const key = JSON.stringify(p.cfg); if (!this.meshes[key]) { const m = KagePilot.build(Object.assign({}, p.cfg, { pose: undefined, inVehicle: undefined }), 'hi'); this.meshes[key] = this.g.vmesh(m); this.meshes[key].S = m.S; } return this.meshes[key]; };
Net.prototype.drawWorld = function (ctx) {
  if (!this.on) return; const g = this.g, F = g.fleet, f = g.foot, Y = g.star; if (!F) return; this.tags = [];
  for (const p of Object.values(this.peers)) { const s = this.pose(p); if (!s) continue; const mesh = this.pilot(p);
    const tt = s.a === 'cammina' || s.a === 'corre' ? (p.ph = (p.ph || 0) + (ctx.dt || 0.016) * (s.s > 3 ? s.s / 5.5 : s.s / 1.45)) : g.t;
    if ((s.m === 'foot' || s.m === 'car' || s.m === 'veh') && s.w === g.world && (g.world === 'city' || g.world === 'meadow' || g.world === 'eco')) {
      const rx = wrapD(s.x - ctx.camX), rz = wrapD(s.z - ctx.camZ); if (Math.hypot(rx, rz) > 500) continue;
      if (s.m === 'foot') F.drawPilotPose(ctx.set, U.mul(U.T(rx, s.y, rz), U.RY(s.h)), s.gear === 'skate' ? 'skate' : s.gear === 'jet' && s.y > 0.3 ? 'jetpack' : s.a, { speed: s.s, key: 'net' + p.id }, mesh, tt);
      if (s.m === 'veh' && KF.KINDS[s.k]) { const P = g.P.veh, u = P.u; g.gl.useProgram(P.p); ctx.set(P); g.gl.uniform1f(u.uTraffic, 0); g.gl.uniform1f(u.uScale, 1); g.gl.uniform3f(u.uTint, -1, 0, 0); g.gl.uniform1f(u.uLit, 1); g.gl.uniform1f(u.uGlowOnly, 0);
        const m = F.model(s.k, Object.assign({}, KF.KINDS[s.k].def, { lod: 'lo' })); F.drawModel(m, { x: s.x, y: s.y, z: s.z, h: s.h, pitch: s.p, roll: s.r, rot: g.t * 30, prop: g.t * 40, kind: s.k, hv: [] }, ctx); }
      this.tags.push([p, rx, s.y + (s.m === 'car' ? 1.6 : s.m === 'veh' ? 2.4 : 2.05), rz]); }
    else if (s.m === 'ship' && f && (f.ss === 'in' || f.ss === 'helm') && Y && Y.shipVisible && Y.shipVisible()) { const di = f.ss === 'helm' ? 0 : f.deck; if (s.d !== di) continue;
      const D = window.KageStar.DECKS[di], Ms = Y.shipM(ctx); F.drawPilotPose(ctx.set, U.mul(Ms, U.mul(U.T(s.x, D.y, s.z), U.RY(s.h))), s.a === 'seduto' ? 'in piedi' : s.a, { speed: s.s, key: 'net' + p.id }, mesh, tt); }
    else if (s.m === 'planet' && f && f.ss === 'planet' && Y && Y.site === s.site) F.drawPilotPose(ctx.set, U.mul(U.T(...Y.rel([s.x, s.y, s.z], ctx)), U.RY(s.h)), s.a, { speed: s.s, key: 'net' + p.id }, mesh, tt);
  }
};
/** the other players' KAGE GT, with the player's car renderer (called while the HD car program is bound) */
Net.prototype.drawCars = function (ctx) {
  if (!this.on) return; const g = this.g; if (!g.hd) return;
  for (const p of Object.values(this.peers)) { const s = this.pose(p); if (!s || s.m === 'ship' || s.m === 'planet' || s.w !== g.world) continue;
    // their GT stays where they left it while they walk: we only know it while they drive
    if (s.m !== 'car') continue; const rx = wrapD(s.x - ctx.camX), rz = wrapD(s.z - ctx.camZ); if (Math.hypot(rx, rz) > 400) continue;
    p.spin = (p.spin || 0) + (s.sp || 0) * (ctx.dt || 0.016) / 0.34;
    g.hd.draw(U.mul(U.T(rx, s.y || 0, rz), U.RY(s.h)), Object.assign({}, ctx.hdState, { doorL: 0, doorR: 0, hood: 0, spin: p.spin, wheelSteer: 0, steerWheel: 0 }), 'opaque'); }
};
Net.prototype.drawHud = function (hud) {
  const g = this.g, c2 = hud.getContext('2d'), W = hud.width, H = hud.height, m = Math.min(W, H), VP = g.VP;
  if (this.on && VP && this.tags) for (const [p, x, y, z] of this.tags) { const q = [0, 0, 0, 0], v = [x, y + 0.35, z, 1]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q[i] += VP[j * 4 + i] * v[j]; if (q[3] < 0.5) continue;
    const sx = (0.5 + 0.5 * q[0] / q[3]) * W, sy = (0.5 - 0.5 * q[1] / q[3]) * H, d = Math.hypot(x, z); c2.font = 'bold ' + Math.max(11, m * 0.022 * Math.min(1, 25 / Math.max(5, d))) + 'px system-ui'; c2.textAlign = 'center';
    const w = c2.measureText(p.name).width + 12; c2.fillStyle = 'rgba(5,8,16,.65)'; c2.fillRect(sx - w / 2, sy - m * 0.03, w, m * 0.036); c2.fillStyle = p.col; c2.fillText(p.name, sx, sy - m * 0.003); c2.textAlign = 'left'; }
  const R = this.race; if (R) { const now = performance.now(), left = (R.t0 - now) / 1000; c2.textAlign = 'center'; c2.font = 'bold ' + (m * (left > 0 ? 0.12 : 0.03) | 0) + 'px system-ui'; c2.fillStyle = '#ffe08a';
    c2.fillText(left > 0 ? Math.ceil(left) : R.win ? '🏁 vince ' + R.win : '🏁 CORSA fino a ' + R.name + ' · ' + this.distTo(R.to) + ' m', W / 2, left > 0 ? H / 2 : m * 0.2); c2.textAlign = 'left'; }
  if (this.msgs.length && !(g.aos && g.aos.isOpen)) { c2.font = (m * 0.02 | 0) + 'px system-ui'; this.msgs.forEach((q, i) => { const y = H - m * 0.28 - (this.msgs.length - 1 - i) * m * 0.035, w = c2.measureText(q.s).width + 16;
      c2.globalAlpha = Math.min(1, q.t); c2.fillStyle = 'rgba(5,8,16,.65)'; c2.fillRect(W - w - m * 0.02, y - m * 0.024, w, m * 0.032); c2.fillStyle = '#e8f6ff'; c2.fillText(q.s, W - w - m * 0.02 + 8, y); c2.globalAlpha = 1; }); }
};
Net.prototype.distTo = function (p) { const s = this.state(); return s.x === undefined || s.m === 'ship' ? '—' : Math.round(Math.hypot(wrapD(s.x - p[0]), wrapD(s.z - p[1]))); };
Net.prototype.beep = function (a, b) { if (!window.FleetAudio) return; if (!this.au) this.au = new FleetAudio(); this.au.start(); this.au.blip(a, b, 0.15, 0.08, 'triangle'); };
/** challenge: race to a point (the targets are famous places of the city) */
const TARGETS = [['IL NEXUS', [336, 210]], ['IL FARO DEL PORTO', [960, 1060]], ['IL KAGE GARAGE', [40, 40]], ['LA PIAZZA', [180, 600]], ['LA PERIFERIA', [760, 780]]];
Net.prototype.challenge = function () { const st = this.state(); let T = TARGETS.map(t => [t, st.x === undefined ? 0 : Math.hypot(wrapD(st.x - t[1][0]), wrapD(st.z - t[1][1]))]).filter(q => q[1] > 120); if (!T.length) T = TARGETS.map(t => [t, 0]);
  const t = T[Math.floor(Math.random() * T.length)][0]; this.race = { to: t[1], name: t[0], t0: performance.now() + 3000, by: this.name, win: null }; this.send({ race: { to: t[1], name: t[0] } }); this.say('🏁 sfida lanciata: corsa fino a ' + t[0]); };

/* ---------------- tablet app ---------------- */
function install(OS) {
  OS.prototype.app_net = function () {
    const N = this.g.net; if (!N) { this.frame('🌐 KAGE NET', 'non disponibile'); return; }
    const b = this.frame('🌐 KAGE NET · multigiocatore locale', '');
    const draw = () => { if (this.app !== 'net') return; const P = Object.values(N.peers);
      b.innerHTML = '<div class="card"><b>' + (N.on ? '● attivo · ' + (N.mode === 'wifi' ? 'Wi-Fi locale' : 'schede del browser') : '○ spento') + '</b><br><small>Stessa rete Wi-Fi, nessun server: vi vedete nella stessa Cybercity, sulla ODYSSEY e sui pianeti.</small><br><br>'
        + '<button class="btn ' + (N.on ? 'on' : '') + '" data-act="net:' + (N.on ? 'off' : 'on') + '">' + (N.on ? '⏻ spegni' : '⏻ accendi KAGE NET') + '</button></div>'
        + '<div class="card"><b>Il tuo nome</b><br><input id="netName" maxlength="16" value="' + esc(N.name) + '" style="background:var(--sf);color:var(--fg);border:1px solid var(--ac);border-radius:1vmin;padding:.6vmin;font:inherit;width:30vmin"> '
        + COLS.map(c => '<button class="btn ' + (N.col === c ? 'on' : '') + '" data-act="netcol:' + c + '" style="color:' + c + '">●</button>').join('') + '</div>'
        + '<div class="card"><b>Piloti in rete (' + P.length + ')</b>' + (P.length ? P.map(p => { const s = p.cur || {}; return '<div style="margin-top:.6vmin"><span style="color:' + p.col + '">●</span> <b>' + esc(p.name) + '</b> <small>· ' + ({ foot: 'a piedi', car: 'in KAGE GT', veh: 'su ' + ((KF.KINDS[s.k] || {}).title || s.k), ship: 'sulla KAGE ODYSSEY · ponte ' + ((s.d || 0) + 1), planet: 'sul pianeta ' + s.site }[s.m] || '…') + (s.x !== undefined && s.m !== 'ship' ? ' · ' + N.distTo([s.x, s.z]) + ' m' : '') + '</small></div>'; }).join('') : '<br><small>nessuno ancora. Accendi KAGE NET anche sull’altro telefono.</small>') + '</div>'
        + '<div class="card"><b>Messaggi rapidi</b><br>' + QUICK.map((q, i) => '<button class="btn" data-act="netq:' + i + '" style="margin:.3vmin">' + q + '</button>').join('') + '<br><br><button class="btn" data-act="netrace">🏁 lancia una sfida di corsa</button></div>';
      const ni = b.querySelector('#netName'); ni.addEventListener('change', () => { N.name = ni.value.trim().slice(0, 16) || N.name; LS.set('kageNetName', N.name); }); };
    draw(); this.timers.push(setInterval(() => { if (!b.contains(document.activeElement)) draw(); }, 1500));
  };
  const act0 = OS.prototype.act;
  OS.prototype.act = function (a, el) { const N = this.g.net, k = a.split(':')[0], v = a.slice(k.length + 1);
    if (!N || !/^net(|col|q|race)$/.test(k)) return act0.call(this, a, el);
    if (k === 'net') { if (v === 'on') N.start(); else N.stop(); }
    if (k === 'netcol') { N.col = v; LS.set('kageNetCol', v); }
    if (k === 'netq') { N.send({ chat: QUICK[+v] }); N.say('💬 tu: ' + QUICK[+v]); }
    if (k === 'netrace') { if (!N.on) { this.toast('accendi prima KAGE NET'); return; } N.challenge(); this.close(); return; }
    this.launch('net'); };
}
if (window.AmpyOS) install(window.AmpyOS);
window.KageNet = Net;
})();
