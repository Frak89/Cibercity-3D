/* KAGE CITIZENS · people walking on the pavements of Cybercity: humans in different suits and the odd alien, walking along
 * the edges of the roads around you, stopping to look at their phone or to greet you, and jumping out of the way of your car.
 * A small pool recycled around the player (cheap: low-detail meshes, only within ~110 m). Not in the meadow of the past. */
(function () {
'use strict';
const NR = window.NeonRun, U = window.CarRenderUtil; if (!NR || !window.KagePilot) return;
const { S, GP, RW, wrapD, isWater } = NR, PI = Math.PI;
const wrapP = v => ((v % S) + S) % S;
const LOOKS = [{ suit: 'rosso', hair: 'corti', hairColor: 'nero' }, { suit: 'blu', hair: 'coda', hairColor: 'castano', skin: 'olivastra', build: 'snello' }, { suit: 'oro', hair: 'rasati', skin: 'scura' },
  { suit: 'blu', hair: 'lunghi', hairColor: 'rosso', build: 'snello' }, { suit: 'oro', hair: 'ricci', hairColor: 'biondo' }, { suit: 'rosso', hair: 'calvo', beard: 'piena', skin: 'ambrata', build: 'robusto' },
  { species: 'grigio' }, { species: 'verde' }];
const N = 16, EDGE = RW / 2 + 1.6;   // walking line: just off the road, on the pavement

function People(game) { this.g = game; this.p = []; this.meshes = []; this.seed = 7; this.on = true; }
People.prototype.rnd = function () { return (this.seed = (this.seed * 16807) % 2147483647) / 2147483647; };
People.prototype.mesh = function (i) { if (!this.meshes[i]) { const m = KagePilot.build(Object.assign({}, LOOKS[i]), 'lo'); this.meshes[i] = this.g.vmesh(m); this.meshes[i].S = m.S; } return this.meshes[i]; };
/** a new walker somewhere along a pavement near (cx, cz) */
People.prototype.spawn = function (q, cx, cz, far) {
  for (let k = 0; k < 8; k++) {
    const alongX = this.rnd() < 0.5, side = this.rnd() < 0.5 ? -1 : 1, a = (this.rnd() * 2 - 1) * (far ? 110 : 80), b = (this.rnd() * 2 - 1) * 80;
    const line = Math.round(((alongX ? cz : cx) + b) / GP) * GP + side * EDGE, x = alongX ? cx + a : line, z = alongX ? line : cz + a;
    if (isWater(wrapP(x), wrapP(z))) continue;
    Object.assign(q, { x: wrapP(x), z: wrapP(z), ax: alongX ? 1 : 0, dir: this.rnd() < 0.5 ? 1 : -1, sp: 1.1 + this.rnd() * 0.6, look: Math.floor(this.rnd() * LOOKS.length), stop: 0, pose: null, ph: this.rnd() * 10, dodge: 0, wait: 3 + this.rnd() * 12 });
    if (q.look >= 6 && this.rnd() < 0.6) q.look = Math.floor(this.rnd() * 6);    // aliens are rarer
    return true; }
  return false;
};
People.prototype.update = function (dt) {
  const g = this.g; if (!this.on || g.world !== 'city') return; const f = g.foot, me = f && f.active ? f : g.c, cx = me.x, cz = me.z;
  while (this.p.length < N) { const q = {}; if (this.spawn(q, cx, cz, false)) this.p.push(q); else break; }
  const car = g.c, cv = Math.hypot(car.vx || 0, car.vz || 0);
  for (const q of this.p) {
    if (Math.hypot(wrapD(q.x - cx), wrapD(q.z - cz)) > 125) { this.spawn(q, cx, cz, true); continue; }
    q.wait -= dt;
    if (q.stop > 0) { q.stop -= dt; if (q.stop <= 0) q.pose = null; }
    else if (q.wait <= 0) { q.wait = 6 + this.rnd() * 14; const r = this.rnd(); if (r < 0.35) { q.stop = 2 + this.rnd() * 3; q.pose = this.rnd() < 0.5 ? 'pensieroso' : 'braccia conserte'; } else if (r < 0.45) q.dir = -q.dir; }
    // greet the pilot walking by
    if (f && f.active && !f.ss && q.stop <= 0 && !q.greeted && Math.hypot(wrapD(q.x - f.x), wrapD(q.z - f.z)) < 3) { q.greeted = 1; q.stop = 1.8; q.pose = 'saluto'; }
    // the car coming: jump aside onto the building side
    const dcar = Math.hypot(wrapD(q.x - car.x), wrapD(q.z - car.z)); if (!g.veh && cv > 3 && dcar < 5 + cv * 0.15 && q.dodge <= 0) { q.dodge = 0.6; q.stop = 0; q.pose = null; }
    if (q.dodge > 0) { q.dodge -= dt; const off = Math.sign((q.ax ? q.z : q.x) - Math.round((q.ax ? q.z : q.x) / GP) * GP) || 1; if (q.ax) q.z = wrapP(q.z + off * 4 * dt); else q.x = wrapP(q.x + off * 4 * dt); }
    if (q.stop <= 0) { const s = q.sp * (q.dodge > 0 ? 2.5 : 1) * dt * q.dir; if (q.ax) q.x = wrapP(q.x + s); else q.z = wrapP(q.z + s); q.ph += dt * q.sp * (q.dodge > 0 ? 2.5 : 1) / 1.45;
      if (isWater(q.x, q.z)) { q.dir = -q.dir; if (q.ax) q.x = wrapP(q.x + q.dir * 1.5); else q.z = wrapP(q.z + q.dir * 1.5); } }
  }
};
People.prototype.drawWorld = function (ctx) {
  const g = this.g, F = g.fleet; if (!this.on || g.world !== 'city' || !F) return;
  this.p.forEach((q, i) => { const rx = wrapD(q.x - ctx.camX), rz = wrapD(q.z - ctx.camZ), d = Math.hypot(rx, rz); if (d > 115) return;
    const h = q.ax ? (q.dir > 0 ? PI / 2 : -PI / 2) : (q.dir > 0 ? 0 : PI), moving = q.stop <= 0, pose = moving ? 'cammina' : q.pose || 'in piedi';
    const face = q.pose === 'saluto' && g.foot && g.foot.active ? Math.atan2(wrapD(g.foot.x - q.x), wrapD(g.foot.z - q.z)) : h;
    F.drawPilotPose(ctx.set, U.mul(U.T(rx, 0, rz), U.RY(face)), pose, { speed: moving ? q.sp * (q.dodge > 0 ? 2.5 : 1) : 0, key: 'cit' + i }, this.mesh(q.look), moving ? q.ph : ctx.t + i); });
};
window.KagePeople = People;
})();
