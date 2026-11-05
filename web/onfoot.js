/* On foot: get out of the KAGE GT and walk / run / jump around the city in third person as your own pilot, then get back in.
 * Hooks into NeonRun.Game (game.js): update() / camera() / draw() / drawHud(). */
(function () {
'use strict';
const NR = window.NeonRun, U = window.CarRenderUtil;
const { S, GP, wrapD, isWater } = NR;
const wrapP = v => ((v % S) + S) % S, wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const ease = (c, t, k, dt) => c + (t - c) * Math.min(1, dt * k);
function OnFoot(game) { this.g = game; this.active = false; this.x = 0; this.z = 0; this.y = 0; this.h = 0; this.v = 0; this.vy = 0; this.ph = 0; this.camH = 0; this.air = false; this.t = 0; }
OnFoot.prototype.canExit = function () { const g = this.g; return !g.veh && !this.active && Math.hypot(g.c.vx, g.c.vz) < 3 && (g.c.y || 0) < 0.5; };
OnFoot.prototype.nearCar = function () { const c = this.g.c; return Math.hypot(wrapD(c.x - this.x), wrapD(c.z - this.z)) < 3.6; };
OnFoot.prototype.toggle = function () {
  const g = this.g, c = g.c;
  if (this.active) { if (this.nearCar()) { this.active = false; g.cam.h = c.h; } return; }
  if (!this.canExit()) return;
  // out of the driver's door (the driver sits on the car's -x side)
  this.x = wrapP(c.x - Math.cos(c.h) * 1.7); this.z = wrapP(c.z + Math.sin(c.h) * 1.7); this.y = 0; this.h = c.h - 0.4; this.v = 0; this.vy = 0; this.camH = c.h; this.active = true;
};
OnFoot.prototype.collide = function () {
  const r = 0.38, bx = Math.floor(this.x / GP), bz = Math.floor(this.z / GP), city = this.g.city;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const ix = ((bx + i) % 15 + 15) % 15, iz = ((bz + j) % 15 + 15) % 15, sx = (bx + i) * GP - ix * GP, sz = (bz + j) * GP - iz * GP;
    for (const q of city.blocks[iz * 15 + ix]) {
      if (this.y > (q[4] || 8)) continue;
      const x0 = q[0] + sx - r, z0 = q[1] + sz - r, x1 = q[2] + sx + r, z1 = q[3] + sz + r;
      if (this.x <= x0 || this.x >= x1 || this.z <= z0 || this.z >= z1) continue;
      const pl = this.x - x0, pr = x1 - this.x, pb = this.z - z0, pt = z1 - this.z, m = Math.min(pl, pr, pb, pt);
      if (m === pl) this.x -= m; else if (m === pr) this.x += m; else if (m === pb) this.z -= m; else this.z += m;
    }
  }
  // the parked car is solid too
  const c = this.g.c, dx = wrapD(this.x - c.x), dz = wrapD(this.z - c.z), fx = Math.sin(c.h), fz = Math.cos(c.h);
  const lf = dx * fx + dz * fz, ls = dx * fz - dz * fx;
  if (Math.abs(lf) < 2.6 && Math.abs(ls) < 1.4) { const pf = 2.6 - Math.abs(lf), ps = 1.4 - Math.abs(ls);
    if (ps < pf) { const s = Math.sign(ls) * ps; this.x += fz * s; this.z -= fx * s; } else { const s = Math.sign(lf) * pf; this.x += fx * s; this.z += fz * s; } }
};
OnFoot.prototype.update = function (dt, inp) {
  this.t += dt;
  const run = !!inp.boost, fwd = inp.fwd || 0, side = inp.strafe || 0;
  this.h = wrapA(this.h + (inp.yaw || 0) * 2.6 * dt);
  const tv = fwd * (run ? 6.2 : 1.9), ts = side * 1.4;
  this.v = ease(this.v, tv, 8, dt); this.vs = ease(this.vs || 0, ts, 8, dt);
  const fx = Math.sin(this.h), fz = Math.cos(this.h), rx = -Math.cos(this.h), rz = Math.sin(this.h);
  const ox = this.x, oz = this.z;
  this.x = wrapP(this.x + (fx * this.v + rx * this.vs) * dt); this.z = wrapP(this.z + (fz * this.v + rz * this.vs) * dt);
  if (isWater(this.x, this.z)) { this.x = ox; this.z = oz; this.v *= -0.2; }      // the quay edge
  // jump + gravity
  if (!this.air && (inp.lift || 0) > 0.5) { this.vy = 4.8; this.air = true; }
  if (this.air) { this.vy -= 13 * dt; this.y += this.vy * dt; if (this.y <= 0) { this.y = 0; this.vy = 0; this.air = false; } }
  this.collide();
  const sp = Math.abs(this.v) + Math.abs(this.vs) * 0.6;
  this.ph += dt * (sp > 3 ? sp / 5.5 : sp / 1.45);        // stride phase follows the ground speed (no foot sliding)
  this.anim = this.air ? 'salta' : sp > 3.2 ? 'corre' : sp > 0.25 ? 'cammina' : (this.idleG || 'in piedi');
  if (sp < 0.2 && !this.air) { this.idleT = (this.idleT || 0) + dt; if (this.idleT > 14) { this.idleT = 0; this.idleG = ['pensieroso', 'braccia conserte', 'mani sui fianchi', 'in piedi'][Math.floor(Math.random() * 4)]; } } else { this.idleT = 0; this.idleG = 'in piedi'; }
  // the game's car keeps its own state; this is the pilot
  return { vF: this.v };
};
OnFoot.prototype.camera = function (view, dt) {
  const c = this.g.c;
  this.camH += wrapA(this.h - this.camH) * Math.min(1, dt * 3);
  const fx = Math.sin(this.camH), fz = Math.cos(this.camH), px = wrapD(this.x - c.x), pz = wrapD(this.z - c.z);
  const far = view % 3 === 1, top = view % 3 === 2, D = far ? 6.5 : 3.3, H = far ? 2.8 : 1.95;
  let e, l, fov = 58;
  if (top) { e = [px - fx * 1, this.y + 28, pz - fz * 1]; l = [px + fx * 2, this.y, pz + fz * 2]; fov = 55; }
  else { e = [px - fx * D, this.y + H, pz - fz * D]; l = [px + fx * 2.5, this.y + 1.45, pz + fz * 2.5]; }
  this.cv = { e, l, fov, drawCar: true, cockpit: false };
  return this.cv;
};
OnFoot.prototype.draw = function (ctx) {
  const f = this.g.fleet; if (!f) return;
  const rx = wrapD(this.x - ctx.camX), rz = wrapD(this.z - ctx.camZ);
  const t = this.anim === 'cammina' || this.anim === 'corre' ? this.ph : this.t;
  f.drawPilotPose(ctx.set, U.mul(U.T(rx, this.y, rz), U.RY(this.h)), this.anim || 'in piedi', { speed: Math.abs(this.v) }, null, t);
};
OnFoot.prototype.drawHud = function (hud) {
  const g = hud.getContext('2d'), W = hud.width, H = hud.height, m = Math.min(W, H);
  let line = '';
  if (this.active) line = this.nearCar() ? 'INVIO · sali in auto' : 'A PIEDI · W/S cammina · A/D gira · Q/E laterale · SHIFT corri · SPAZIO salta · INVIO vicino all\'auto per salire';
  else if (this.canExit()) line = 'INVIO · scendi dall\'auto';
  if (!line) return;
  g.font = (m * 0.02 | 0) + 'px monospace'; g.textAlign = 'center';
  const w = g.measureText(line).width + m * 0.03; g.fillStyle = 'rgba(7,11,19,0.6)'; g.fillRect(W / 2 - w / 2, H - m * 0.12, w, m * 0.04);
  g.fillStyle = '#00ffe2'; g.fillText(line, W / 2, H - m * 0.093); g.textAlign = 'left';
};
window.KageOnFoot = OnFoot;
})();
