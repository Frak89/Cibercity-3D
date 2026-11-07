/* Cybercity 3D — NEON RUN: open-world driving mini game (WebGL 1).
 * Same shaders as the screensaver (SHADERS injected by tools/build_web.py) and the same
 * palettes / weather (window.CYBER_PALETTES / CYBER_WEATHER from cybercity.js).
 * Logic mirrored 1:1 in app/src/main/java/it/ampy/cybercity/game/*.java */
(function () {
'use strict';
const GP = 84, RW = 18, GN = 15, S = GP * GN;   // block pitch, road width, blocks per side, torus size
const VIEWS = ['INSEGUIMENTO', 'INSEGUIMENTO LONTANO', 'COFANO', 'ABITACOLO', 'PARAURTI', 'CINEMATICA', "DALL'ALTO"];
const PAINTS = {
  nero:   { name: 'NERO NEON', c: [0.05, 0.05, 0.07] },
  rosso:  { name: 'ROSSO CORSA', c: [0.42, 0.03, 0.05] },
  perla:  { name: 'BIANCO PERLA', c: [0.72, 0.72, 0.76] },
  oro:    { name: 'ORO', c: [0.5, 0.36, 0.08] },
  ciano:  { name: 'CIANO', c: [0.0, 0.32, 0.38] },
  viola:  { name: 'VIOLA', c: [0.22, 0.04, 0.32] }
};

function rng(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fract = x => x - Math.floor(x);
const wrapD = d => { d = ((d % S) + S) % S; return d > S / 2 ? d - S : d; };  // shortest signed distance on the torus
/* harbour district: blocks HB0..HB1 become a lagoon with an outer ring of islands, four inner islands and a lighthouse islet.
   Same test as harborWater() in common.glsl and GameCity.isWater() on Android. */
const HB0 = 8, HB1 = 13;
const HARBOR = { x0: HB0 * GP + RW / 2, z0: HB0 * GP + RW / 2, x1: (HB1 + 1) * GP - RW / 2, z1: (HB1 + 1) * GP - RW / 2 };
HARBOR.cx = (HARBOR.x0 + HARBOR.x1) / 2; HARBOR.cz = (HARBOR.z0 + HARBOR.z1) / 2;
function islandOf(bx, bz) {
  if (bx < HB0 || bx > HB1 || bz < HB0 || bz > HB1) return null;
  const ringX = bx === HB0 || bx === HB1, ringZ = bz === HB0 || bz === HB1;
  const cX = bx <= HB0 + 1 || bx >= HB1 - 1, cZ = bz <= HB0 + 1 || bz >= HB1 - 1;
  if (!(ringX || ringZ || (cX && cZ))) return { water: true };
  return { water: false, sW: ringX && bx === HB0 ? 0 : 6, sE: ringX && bx === HB1 ? 0 : 6, sS: ringZ && bz === HB0 ? 0 : 6, sN: ringZ && bz === HB1 ? 0 : 6 };
}
function isWater(x, z) {
  x = ((x % S) + S) % S; z = ((z % S) + S) % S;
  if (x < HARBOR.x0 || x > HARBOR.x1 || z < HARBOR.z0 || z > HARBOR.z1) return false;
  if (Math.hypot(x - HARBOR.cx, z - HARBOR.cz) < 11) return false;
  const bx = Math.floor(x / GP), bz = Math.floor(z / GP), I = islandOf(bx, bz);
  if (!I || I.water) return true;
  const lx = x - bx * GP - RW / 2, lz = z - bz * GP - RW / 2, inn = GP - RW;
  return !(lx >= I.sW && lx <= inn - I.sE && lz >= I.sS && lz <= inn - I.sN);
}

/* ===================================================================== city */
function buildGameCity(seed) {
  const R = rng(seed);
  const chunks = [];
  let B = null;
  function newChunk() { B = { pos: [], center: [], norm: [], uv: [], misc: [], idx: [] }; chunks.push(B); }
  newChunk();
  const BB = { pos: [], center: [], uv: [], misc: [], idx: [] };
  const blocks = [];                       // collision rects per block: [x0,z0,x1,z1]
  for (let i = 0; i < GN * GN; i++) blocks.push([]);
  function box(cx, cz, w, d, y0, y1, s, kind) {
    if (B.pos.length / 3 > 60000) newChunk();
    const hw = w / 2, hd = d / 2;
    const faces = [
      [[1,0,0], [[hw,y0,-hd],[hw,y0,hd],[hw,y1,hd],[hw,y1,-hd]], d],
      [[-1,0,0], [[-hw,y0,hd],[-hw,y0,-hd],[-hw,y1,-hd],[-hw,y1,hd]], d],
      [[0,0,1], [[hw,y0,hd],[-hw,y0,hd],[-hw,y1,hd],[hw,y1,hd]], w],
      [[0,0,-1], [[-hw,y0,-hd],[hw,y0,-hd],[hw,y1,-hd],[-hw,y1,-hd]], w]
    ];
    for (const [n, cs, fw] of faces) {
      const b = B.pos.length / 3, us = [0, fw, fw, 0];
      for (let i = 0; i < 4; i++) {
        B.pos.push(cs[i][0], cs[i][1], cs[i][2]); B.center.push(cx, cz); B.norm.push(n[0], n[1], n[2]);
        B.uv.push(us[i], cs[i][1]); B.misc.push(s, kind, fw, y1);
      }
      B.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const b = B.pos.length / 3;
    for (const c of [[-hw,y1,-hd],[hw,y1,-hd],[hw,y1,hd],[-hw,y1,hd]]) { B.pos.push(c[0], c[1], c[2]); B.center.push(cx, cz); B.norm.push(0,1,0); B.uv.push(c[0], c[2]); B.misc.push(s, kind, w, y1); }
    B.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  /* billboard on a face; axis 0: face normal along x (plane x = lx), 1: along z (plane z = lz) */
  function board(cx, cz, axis, off, y0, y1, a0, a1, s, kind) {
    const b = BB.pos.length / 3, ratio = (y1 - y0) / Math.abs(a1 - a0);
    const cs = axis === 0 ? [[off,y0,a1],[off,y0,a0],[off,y1,a0],[off,y1,a1]] : [[a0,y0,off],[a1,y0,off],[a1,y1,off],[a0,y1,off]];
    const uvs = [[0,0],[1,0],[1,1],[0,1]];
    for (let i = 0; i < 4; i++) { BB.pos.push(...cs[i]); BB.center.push(cx, cz); BB.uv.push(...uvs[i]); BB.misc.push(s, kind, ratio, 0); }
    BB.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const inner = GP - RW;
  // quay walls of the lagoon (kind 3: concrete with a neon edge), below street level
  const wall = (x0, z0, x1, z1) => box((x0 + x1) / 2, (z0 + z1) / 2, Math.max(0.6, x1 - x0), Math.max(0.6, z1 - z0), -26, 0.03, 0.5, 3);
  wall(HARBOR.x0 - 0.3, HARBOR.z0, HARBOR.x0 + 0.3, HARBOR.z1); wall(HARBOR.x1 - 0.3, HARBOR.z0, HARBOR.x1 + 0.3, HARBOR.z1);
  wall(HARBOR.x0, HARBOR.z0 - 0.3, HARBOR.x1, HARBOR.z0 + 0.3); wall(HARBOR.x0, HARBOR.z1 - 0.3, HARBOR.x1, HARBOR.z1 + 0.3);
  for (let bz = 0; bz < GN; bz++) for (let bx = 0; bx < GN; bx++) {
    let rects = blocks[bz * GN + bx];
    const I = islandOf(bx, bz);
    // block (0,0) is the KAGE GARAGE: generate as usual (same random draws) but into a throwaway buffer
    const GAR = bx === 0 && bz === 0, keepB = B, keepBB = BB.pos.length;
    const endGar = () => { if (!GAR) return; B = keepB; for (const k of ['pos', 'center', 'uv', 'misc']) BB[k].length = keepBB / 3 * (k === 'pos' ? 3 : k === 'misc' ? 4 : 2); BB.idx.length = keepBB / 3 / 4 * 6;
      const G = window.KageFleet ? KageFleet.GARAGE : { x0: 16, x1: 66, z0: 16, z1: 68, h: 11 }, gr = blocks[0];
      gr.push([G.x1 - 1, G.z0, G.x1, G.z1, G.h + 0.6], [G.x0, G.z0, G.x1, G.z0 + 1, G.h + 0.6], [G.x0, G.z1 - 1, G.x1, G.z1, G.h + 0.6]); };
    if (GAR) { B = { pos: [], center: [], norm: [], uv: [], misc: [], idx: [] }; rects = []; }
    if (I && I.water) continue;
    let ox = bx * GP + RW / 2, oz = bz * GP + RW / 2, inX = inner, inZ = inner;
    if (I) {
      ox += I.sW; oz += I.sS; inX = inner - I.sW - I.sE; inZ = inner - I.sS - I.sN;
      if (I.sW) wall(ox - 0.3, oz, ox + 0.3, oz + inZ); if (I.sE) wall(ox + inX - 0.3, oz, ox + inX + 0.3, oz + inZ);
      if (I.sS) wall(ox, oz - 0.3, ox + inX, oz + 0.3); if (I.sN) wall(ox, oz + inZ - 0.3, ox + inX, oz + inZ + 0.3);
    }
    const dc = Math.hypot(bx - GN / 2 + 0.5, bz - GN / 2 + 0.5) / (GN / 2);
    const downtown = Math.max(0, 1 - dc);
    const r = R();
    if (r < 0.07) {
      // plaza: a low neon pavilion and a holo sign
      const s = R();
      box(ox + inX / 2, oz + inZ / 2, 14, 14, 0, 5, s, 1);
      rects.push([ox + inX / 2 - 7, oz + inZ / 2 - 7, ox + inX / 2 + 7, oz + inZ / 2 + 7, 5]);
      endGar(); continue;
    }
    const n = R() < 0.45 ? 3 : 2, cellX = inX / n, cellZ = inZ / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const s = R();
      const mx = 1.2 + R() * 2.2, mz = 1.2 + R() * 2.2;
      const w = cellX - 2 * mx, d = cellZ - 2 * mz;
      const cx = ox + cellX * (i + 0.5), cz = oz + cellZ * (j + 0.5);
      let kind = R() < 0.35 ? 1 : 0;
      let h = 10 + Math.pow(R(), 2) * 55 + downtown * Math.pow(R(), 1.3) * 190;
      if (downtown > 0.55 && R() < 0.12) { h = 200 + R() * 120; kind = 2; }
      box(cx, cz, w, d, 0, h, s, kind);
      const rect = [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h];
      rects.push(rect);
      if (h > 50 && R() < 0.55) {
        const h2 = h + h * (0.15 + R() * 0.25);
        rects.push([cx - w * 0.34, cz - d * 0.34, cx + w * 0.34, cz + d * 0.34, h2]);
        box(cx, cz, w * 0.68, d * 0.68, h, h2, fract(s * 7.7), kind === 2 ? 2 : 1);
        if (R() < 0.5) box(cx, cz, 0.7, 0.7, h2, h2 + 10 + R() * 25, fract(s * 3.3), 1);
      }
      // billboards on faces that look onto a road
      const sides = [];
      if (i === 0) sides.push([0, -w / 2 - 0.3]); if (i === n - 1) sides.push([0, w / 2 + 0.3]);
      if (j === 0) sides.push([1, -d / 2 - 0.3]); if (j === n - 1) sides.push([1, d / 2 + 0.3]);
      for (const [axis, off] of sides) {
        if (R() > 0.3) continue;
        const span = axis === 0 ? d : w;
        const bw = Math.min(span * 0.7, 3 + R() * 4), bh = Math.min(h - 6, 6 + R() * 14);
        if (bh < 4) continue;
        const y0 = 4 + R() * Math.max(0, Math.min(40, h - bh - 6));
        board(cx, cz, axis, off, y0, y0 + bh, -bw / 2, bw / 2, R(), Math.floor(R() * 3));
      }
    }
    // neon street poles at one corner of the block
    const px = ox + 1.2, pz = oz + 1.2;
    box(px, pz, 0.35, 0.35, 0, 7.5, R(), 1);
    rects.push([px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 7.5]);
    endGar();
  }
  // traffic (light trails) along every road + flying lanes above them
  const C = { lane: [], dir: [], corner: [], idx: [] }, DR = [];   // DR: flying KAGE STRIX drones (lane-instanced)
  function car(ox, oy, oz, speed, dx, dz, len, s) {
    const b = C.lane.length / 4;
    for (const c of [[0,-1],[0,1],[1,1],[1,-1]]) { C.lane.push(ox, oy, oz, speed); C.dir.push(dx, dz, len, s); C.corner.push(c[0], c[1]); }
    C.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  for (let k = 0; k < GN; k++) {
    const a = k * GP;
    for (const off of [-3, 3, -6.5, 6.5]) {
      const dir = off > 0 ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        car(a + off, 0.75, 0, 12 + R() * 10, 0, dir, 2.5 + R() * 2, R());   // along z
        car(0, 0.75, a - off, 12 + R() * 10, -dir, 0, 2.5 + R() * 2, R());  // along x
      }
    }
    for (const y of [28, 46, 70]) {
      for (let i = 0; i < 2; i++) {
        { const x = a + (R() - 0.5) * 6, yy = y + R() * 4, sp = 25 + R() * 20, d = R() < 0.5 ? 1 : -1; R(); const sd = R(); DR.push([x, yy, 0, sp, 0, d, sd * S, sd]); }
        { const yy = y + R() * 4, z = a + (R() - 0.5) * 6, sp = 25 + R() * 20, d = R() < 0.5 ? 1 : -1; R(); const sd = R(); DR.push([0, yy, z, sp, d, 0, sd * S, sd]); }
      }
    }
  }
  const RN = { seed: [], corner: [], idx: [] };
  for (let i = 0; i < 2600; i++) {
    const b = RN.seed.length / 3, sx = R(), sy = R(), sz = R();
    for (const c of [[0,-1],[0,1],[1,1],[1,-1]]) { RN.seed.push(sx, sy, sz); RN.corner.push(c[0], c[1]); }
    RN.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { chunks, BB, C, RN, blocks, DR };
}

/* ===================================================================== player car (original design) */
function buildCarModel(paint, accent) {
  const P = [], N = [], Cc = [], I = [];
  function quad(a, b, c, d, col, em) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = P.length / 3;
    for (const p of [a, b, c, d]) { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); Cc.push(col[0], col[1], col[2], em); }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const paintC = paint, dark = [0.02, 0.02, 0.025], glass = [0.03, 0.05, 0.08], tyre = [0.015, 0.015, 0.015];
  // body loft: stations along z (rear → front)
  const st = [
    [-2.30, 0.86, 0.30, 0.78], [-2.08, 0.97, 0.24, 0.86], [-1.30, 1.00, 0.22, 0.88], [-0.45, 1.00, 0.22, 0.87],
    [0.55, 1.00, 0.22, 0.81], [1.35, 0.98, 0.22, 0.72], [2.02, 0.92, 0.24, 0.58], [2.34, 0.72, 0.30, 0.42]
  ]; // z, half width, bottom y, belt y
  for (let i = 0; i < st.length - 1; i++) {
    const [z0, w0, b0, t0] = st[i], [z1, w1, b1, t1] = st[i + 1];
    const crown = 0.05;
    quad([w0, b0, z0], [w1, b1, z1], [w1, t1, z1], [w0, t0, z0], paintC, 0);           // right side
    quad([-w1, b1, z1], [-w0, b0, z0], [-w0, t0, z0], [-w1, t1, z1], paintC, 0);       // left side
    quad([w0, t0, z0], [w1, t1, z1], [0, t1 + crown, z1], [0, t0 + crown, z0], paintC, 0);   // top right half
    quad([0, t0 + crown, z0], [0, t1 + crown, z1], [-w1, t1, z1], [-w0, t0, z0], paintC, 0); // top left half
    quad([-w0, b0, z0], [-w1, b1, z1], [w1, b1, z1], [w0, b0, z0], dark, 0);           // floor
    // neon accent line along the belt (slightly outside)
    quad([w0 + 0.012, t0 - 0.1, z0], [w1 + 0.012, t1 - 0.1, z1], [w1 + 0.012, t1 - 0.06, z1], [w0 + 0.012, t0 - 0.06, z0], accent, 0.9);
    quad([-w1 - 0.012, t1 - 0.1, z1], [-w0 - 0.012, t0 - 0.1, z0], [-w0 - 0.012, t0 - 0.06, z0], [-w1 - 0.012, t1 - 0.06, z1], accent, 0.9);
  }
  { const [z, w, b, t] = st[0]; quad([-w, b, z], [w, b, z], [w, t, z], [-w, t, z], dark, 0);
    quad([-w * 0.92, t - 0.16, z - 0.005], [w * 0.92, t - 0.16, z - 0.005], [w * 0.92, t - 0.06, z - 0.005], [-w * 0.92, t - 0.06, z - 0.005], [1.0, 0.08, 0.12], 1); }  // full-width tail light bar
  { const [z, w, b, t] = st[st.length - 1]; quad([w, b, z], [-w, b, z], [-w, t, z], [w, t, z], dark, 0);
    for (const sx of [-1, 1]) quad([sx * 0.62, t - 0.06, z + 0.004], [sx * 0.2, t - 0.02, z + 0.004], [sx * 0.2, t + 0.0, z + 0.004], [sx * 0.62, t - 0.0, z + 0.004], [0.85, 0.95, 1.0], 1); } // headlight slits
  // cabin loft (glass + roof)
  const cb = [[-1.35, 0.74, 0.86, 0.86], [-0.95, 0.66, 1.20, 0.87], [0.10, 0.70, 1.24, 0.84], [0.95, 0.80, 0.80, 0.80]]; // z, roof half width, roof y, belt y
  for (let i = 0; i < cb.length - 1; i++) {
    const [z0, r0, y0, b0] = cb[i], [z1, r1, y1, b1] = cb[i + 1];
    const g = i === 0 || i === cb.length - 2 ? glass : paintC;
    quad([0.92, b0, z0], [0.92, b1, z1], [r1, y1, z1], [r0, y0, z0], glass, 0.04);       // right window
    quad([-r0, y0, z0], [-r1, y1, z1], [-0.92, b1, z1], [-0.92, b0, z0], glass, 0.04);   // left window
    quad([r0, y0, z0], [r1, y1, z1], [-r1, y1, z1], [-r0, y0, z0], g, 0.02);             // roof / screens
  }
  // spoiler
  const sp = (x0, x1, y0, y1, z0, z1, col, em) => {
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], col, em);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], col, em);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col, em);
    quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], col, em);
  };
  sp(-0.95, 0.95, 1.02, 1.06, -2.25, -1.9, paintC, 0);
  sp(-0.95, 0.95, 1.06, 1.075, -2.25, -2.2, accent, 0.9);
  for (const sx of [-0.6, 0.6]) sp(sx - 0.04, sx + 0.04, 0.86, 1.02, -2.12, -2.04, dark, 0);
  // wheels: octagonal prisms with neon rims
  for (const [wx, wz] of [[0.9, 1.42], [-0.9, 1.42], [0.9, -1.45], [-0.9, -1.45]]) {
    const r = 0.36, sgn = Math.sign(wx), xi = wx - sgn * 0.16, xo = wx + sgn * 0.14;
    for (let k = 0; k < 8; k++) {
      const a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4;
      const y0 = 0.36 + Math.cos(a0) * r, z0 = wz + Math.sin(a0) * r, y1 = 0.36 + Math.cos(a1) * r, z1 = wz + Math.sin(a1) * r;
      quad([xi, y0, z0], [xo, y0, z0], [xo, y1, z1], [xi, y1, z1], tyre, 0);
      quad([xo, 0.36, wz], [xo, y1, z1], [xo, y0, z0], [xo, 0.36, wz], k % 2 ? dark : [0.12, 0.12, 0.14], 0);
      const ri = 0.27;
      quad([xo + sgn * 0.003, 0.36 + Math.cos(a0) * ri, wz + Math.sin(a0) * ri], [xo + sgn * 0.003, y0, z0], [xo + sgn * 0.003, y1, z1], [xo + sgn * 0.003, 0.36 + Math.cos(a1) * ri, wz + Math.sin(a1) * ri], accent, 0.55);
    }
  }
  // glow quads (uv -1..1)
  function gq(list, a, b, c, d, col, al) {
    const base = list.pos.length / 3;
    for (const [p, uv] of [[a, [-1, -1]], [b, [1, -1]], [c, [1, 1]], [d, [-1, 1]]]) { list.pos.push(...p); list.uv.push(...uv); list.col.push(col[0], col[1], col[2], al); }
    list.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const under = { pos: [], uv: [], col: [], idx: [] }, heads = { pos: [], uv: [], col: [], idx: [] }, tail = { pos: [], uv: [], col: [], idx: [] };
  gq(under, [-1.6, 0.04, -3.0], [1.6, 0.04, -3.0], [1.6, 0.04, 3.0], [-1.6, 0.04, 3.0], accent, 1.0);
  gq(heads, [-4.0, 0.05, 2.5], [4.0, 0.05, 2.5], [6.0, 0.05, 22], [-6.0, 0.05, 22], [1.0, 0.95, 0.85], 0.55);
  for (const sx of [-0.42, 0.42]) gq(heads, [sx - 0.45, 0.25, 2.4], [sx + 0.45, 0.25, 2.4], [sx + 0.45, 0.85, 2.4], [sx - 0.45, 0.85, 2.4], [0.85, 0.95, 1.0], 0.9);
  gq(tail, [-1.5, 0.35, -2.36], [1.5, 0.35, -2.36], [1.5, 1.05, -2.36], [-1.5, 1.05, -2.36], [1.0, 0.08, 0.15], 0.85);
  gq(tail, [-1.4, 0.04, -6.0], [1.4, 0.04, -6.0], [1.4, 0.04, -2.2], [-1.4, 0.04, -2.2], [1.0, 0.05, 0.1], 0.35);
  return { solid: { pos: P, norm: N, col: Cc, idx: I }, under, heads, tail };
}

/* ===================================================================== the past: meadow world (trees, rocks, bushes) */
const MEADOW_PAL = { name: 'PRATERIA', fog: [0.66, 0.77, 0.88], top: [0.20, 0.45, 0.85], sun: [1.0, 0.95, 0.82], sunDir: [0.45, 0.55, 0.7], stripes: 0, fogDen: 0.0042 };
function buildMeadow(seed) {
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const chunks = [], cells = new Map(), CELL = 16;
  let B = null;
  const newChunk = () => { B = { pos: [], center: [], norm: [], col: [], idx: [] }; chunks.push(B); };
  newChunk();
  const vtx = (p, n, c, cx, cz, leaf) => { B.pos.push(p[0], p[1], p[2]); B.norm.push(n[0], n[1], n[2]); B.col.push(c[0], c[1], c[2], leaf); B.center.push(cx, cz); return B.pos.length / 3 - 1; };
  const face = (a, b, c, col, cx, cz, leaf) => {     // flat-shaded triangle
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(x => x / l);
    if (n[1] < -0.2 && leaf < 0.5 && a[1] > 0.05) n = n.map(x => -x);
    const i = vtx(a, n, col, cx, cz, leaf); vtx(b, n, col, cx, cz, leaf); vtx(c, n, col, cx, cz, leaf); B.idx.push(i, i + 1, i + 2);
  };
  const cone = (cx, cz, y0, y1, r, seg, col, leaf, jit) => {
    for (let k = 0; k < seg; k++) {
      const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, j = 1 + (rnd() - 0.5) * jit;
      const p0 = [Math.cos(a0) * r * j, y0, Math.sin(a0) * r * j], p1 = [Math.cos(a1) * r, y0, Math.sin(a1) * r], tip = [(rnd() - 0.5) * r * 0.15, y1, (rnd() - 0.5) * r * 0.15];
      const c = col.map(x => x * (0.85 + rnd() * 0.3));
      face(p0, tip, p1, c, cx, cz, leaf); face(p0, p1, [0, y0 - r * 0.15, 0], c.map(x => x * 0.7), cx, cz, leaf);
    }
  };
  const prism = (cx, cz, y0, y1, r, seg, col) => {
    for (let k = 0; k < seg; k++) {
      const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2;
      const b0 = [Math.cos(a0) * r, y0, Math.sin(a0) * r], b1 = [Math.cos(a1) * r, y0, Math.sin(a1) * r], t0 = [b0[0] * 0.7, y1, b0[2] * 0.7], t1 = [b1[0] * 0.7, y1, b1[2] * 0.7];
      face(b0, t0, b1, col, cx, cz, 0); face(b1, t0, t1, col, cx, cz, 0);
    }
  };
  // lumpy rock / leafy crown: octahedron subdivided once, radially jittered
  const lump = (cx, cz, y, rx, ry, rz, col, leaf, jit) => {
    const V0 = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]], F0 = [[0,2,4],[4,2,1],[1,2,5],[5,2,0],[4,3,0],[1,3,4],[5,3,1],[0,3,5]];
    const cache = {}, jv = {}, J = i => { if (jv[i] === undefined) jv[i] = 1 + (rnd() - 0.5) * jit; return jv[i]; };
    const verts = V0.map(v => v.slice());
    const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] !== undefined) return cache[k]; const m = [(verts[a][0] + verts[b][0]) / 2, (verts[a][1] + verts[b][1]) / 2, (verts[a][2] + verts[b][2]) / 2]; const l = Math.hypot(...m); verts.push(m.map(x => x / l)); return cache[k] = verts.length - 1; };
    const F = []; for (const [a, b, c] of F0) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); F.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); }
    const P = i => { const v = verts[i], j = J(i); return [v[0] * rx * j, y + Math.max(v[1], leaf ? -1 : -0.35) * ry * j, v[2] * rz * j]; };
    for (const [a, b, c] of F) face(P(a), P(b), P(c), col.map(x => x * (0.85 + rnd() * 0.3)), cx, cz, leaf);
  };
  const add = (x, z, r) => { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); if (!cells.has(k)) cells.set(k, []); cells.get(k).push([x, z, r]); };
  const free = (x, z) => Math.hypot(x - 0, z - 42) > 30;   // keep the arrival spot clear
  let n = 0;
  while (n < 1500) {
    const x = rnd() * S, z = rnd() * S; if (!free(x, z)) continue;
    // clustered: groves where a low-frequency noise is high
    const grove = Math.sin(x * 0.011) * Math.cos(z * 0.013) + Math.sin((x + z) * 0.007);
    if (grove < -0.2 && rnd() < 0.8) continue;
    if (B.pos.length / 3 > 52000) newChunk();
    const kind = rnd();
    if (kind < 0.42) {                    // conifer
      const h = 6 + rnd() * 9, r = 1.6 + rnd() * 1.6;
      prism(x, z, 0, h * 0.35, 0.35, 6, [0.30, 0.20, 0.12]);
      for (let k = 0; k < 3; k++) cone(x, z, h * (0.22 + k * 0.22), h * (0.55 + k * 0.17), r * (1 - k * 0.25), 8, [0.10, 0.30 + rnd() * 0.08, 0.10], 1, 0.3);
      add(x, z, 0.8);
    } else if (kind < 0.78) {             // broadleaf
      const h = 4 + rnd() * 5, r = 2.2 + rnd() * 2;
      prism(x, z, 0, h * 0.6, 0.38, 6, [0.33, 0.23, 0.14]);
      lump(x, z, h * 0.75, r, r * 0.75, r, [0.22 + rnd() * 0.1, 0.44 + rnd() * 0.1, 0.12], 1, 0.35);
      add(x, z, 0.8);
    } else if (kind < 0.93) {             // rock
      const r = 0.5 + Math.pow(rnd(), 2) * 3.2;
      lump(x, z, r * 0.25, r, r * (0.45 + rnd() * 0.3), r * (0.7 + rnd() * 0.5), [0.42, 0.41, 0.38].map(v => v * (0.8 + rnd() * 0.3)), 0, 0.45);
      add(x, z, r * 0.85);
    } else {                              // bush
      const r = 0.6 + rnd() * 0.8;
      lump(x, z, r * 0.4, r * 1.2, r * 0.7, r * 1.2, [0.18, 0.40, 0.12], 1, 0.4);
    }
    n++;
  }
  return { chunks, cells, CELL };
}
function collideMeadow(c, M) {
  const C = M.CELL, cx = Math.floor(c.x / C), cz = Math.floor(c.z / C);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const kx = ((cx + i) % (S / C) + S / C) % (S / C), kz = ((cz + j) % (S / C) + S / C) % (S / C);
    const L = M.cells.get(kx + ',' + kz); if (!L) continue;
    for (const o of L) {
      let dx = c.x - o[0], dz = c.z - o[1]; dx -= Math.round(dx / S) * S; dz -= Math.round(dz / S) * S;
      const d = Math.hypot(dx, dz), r = o[2] + 1.1;
      if (d >= r || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d; c.x += nx * (r - d); c.z += nz * (r - d);
      const vn = c.vx * nx + c.vz * nz;
      if (vn < 0) { c.vx -= 1.5 * vn * nx; c.vz -= 1.5 * vn * nz; c.vx *= 0.75; c.vz *= 0.75; c.shake = Math.min(1, c.shake + Math.abs(vn) * 0.05); c.hit = Math.min(1, Math.abs(vn) * 0.06); }
    }
  }
}

/* ===================================================================== physics */
function newCar() { return { x: 0, z: 42, h: 0, vx: 0, vz: 0, steer: 0, spin: 0, boost: 1, drift: 0, score: 0, best: 0, shake: 0, hit: 0, dist: 0 }; }

function stepCar(c, inp, dt, city) {
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = Math.cos(c.h), rz = -Math.sin(c.h);
  let vF = c.vx * fx + c.vz * fz, vR = c.vx * rx + c.vz * rz;
  const boosting = inp.boost && c.boost > 0.02 && vF > 2;
  const pk = c.pk || 1;                           // power unit: V8 1 · Wankel 1.03 · LEVITA 1.1
  const mu = c.mu === undefined ? 1 : c.mu;       // tyre-road friction (weather, compound, wear, surface)
  const maxF = (boosting ? 95 : 72) * pk;
  if (inp.gas) vF += (boosting ? 30 : 17) * (pk * pk) * Math.min(1, 0.45 + mu * 0.6) * (1 - Math.max(0, vF) / (maxF + 8)) * dt;
  if (inp.brake) vF -= (vF > 0.5 ? 34 * Math.min(1.1, mu) : 10) * dt;
  if (c.drag) vF -= vF * c.drag * dt;
  if (!inp.gas && !inp.brake) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 3.5 * dt);
  vF = Math.max(-14, Math.min(maxF + 5, vF));
  vF -= vF * Math.abs(vF) * 0.00022 * dt * 60 * 0.016;
  c.boost = boosting ? Math.max(0, c.boost - dt * 0.28) : Math.min(1, c.boost + dt * 0.07);
  // steering: smoothed input, less authority at speed
  c.steer += (inp.steer - c.steer) * Math.min(1, dt * 10);
  const sp = Math.abs(vF);
  let yaw = c.steer * 2.5 * Math.min(1, sp / 10) / (1 + sp / 45) * Math.sign(vF || 1);
  if (inp.hand) yaw *= 1.45;
  c.h += yaw * dt;
  // lateral grip: low with handbrake → drift
  const grip = (inp.hand ? 1.3 : (sp > 50 ? 5.5 : 8)) * Math.max(0.25, mu);
  vR *= Math.exp(-grip * dt);
  if (inp.hand) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 6 * dt);
  const nfx = Math.sin(c.h), nfz = Math.cos(c.h), nrx = Math.cos(c.h), nrz = -Math.sin(c.h);
  // keep part of the momentum in the old direction (slide), the rest follows the nose
  c.vx = nfx * vF + nrx * vR + (fx - nfx) * vF * 0.6;
  c.vz = nfz * vF + nrz * vR + (fz - nfz) * vF * 0.6;
  c.x += c.vx * dt; c.z += c.vz * dt;
  c.spin += vF * dt / 0.365;                      // wheel rotation (rad)
  c.dist += Math.hypot(c.vx, c.vz) * dt;
  // drift score
  const slip = Math.abs(c.vx * nrx + c.vz * nrz);
  if (slip > 4 && sp > 12) { c.drift += slip * dt * 10; } else if (c.drift > 0) { c.score += Math.round(c.drift); c.best = Math.max(c.best, Math.round(c.drift)); c.drift = 0; }
  if (c.world === 'track') { if (c.trackCollide) c.trackCollide(c); }
  else { if (c.world === 'meadow') { if ((c.y || 0) < 1.0) collideMeadow(c, c.meadow); } else collide(c, city);
    c.x = ((c.x % S) + S) % S; c.z = ((c.z % S) + S) % S; }
  c.shake = Math.max(0, c.shake - dt * 3); c.hit = Math.max(0, c.hit - dt * 2.5);
  // wheelspin on a hard launch (and with the handbrake held while on the gas: burnout on the spot)
  const spinW = inp.gas ? Math.max(0, 1 - sp / 16) * (boosting ? 1.2 : 1) * (inp.hand ? 1.3 : 1) : 0;
  return { vF, slip, boosting, wheelspin: Math.min(1, spinW), brakeHard: inp.brake && sp > 14 };
}

function collide(c, city) {
  const fx = Math.sin(c.h), fz = Math.cos(c.h);
  for (const off of [1.35, -1.35]) {
    let px = c.x + fx * off, pz = c.z + fz * off; const r = 1.05;
    const bx = Math.floor(px / GP), bz = Math.floor(pz / GP);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const ix = ((bx + i) % GN + GN) % GN, iz = ((bz + j) % GN + GN) % GN;
      const shiftX = (bx + i) * GP - ix * GP, shiftZ = (bz + j) * GP - iz * GP;   // unwrap the neighbour block
      for (const q of city.blocks[iz * GN + ix]) {
        const x0 = q[0] + shiftX - r, z0 = q[1] + shiftZ - r, x1 = q[2] + shiftX + r, z1 = q[3] + shiftZ + r;
        if (px <= x0 || px >= x1 || pz <= z0 || pz >= z1) continue;
        const pl = px - x0, pr = x1 - px, pb = pz - z0, pt = z1 - pz, m = Math.min(pl, pr, pb, pt);
        let nx = 0, nz = 0;
        if (m === pl) nx = -1; else if (m === pr) nx = 1; else if (m === pb) nz = -1; else nz = 1;
        c.x += nx * m; c.z += nz * m; px += nx * m; pz += nz * m;
        const vn = c.vx * nx + c.vz * nz;
        if (vn < 0) {
          c.vx -= 1.35 * vn * nx; c.vz -= 1.35 * vn * nz;
          c.vx *= 0.82; c.vz *= 0.82;
          c.shake = Math.min(1, c.shake + Math.abs(vn) * 0.04); c.hit = Math.min(1, Math.abs(vn) * 0.05);
          if (c.drift > 0) c.drift = 0;
        }
      }
    }
    // quay edge of the harbour lagoon: push back onto the street
    if ((c.y || 0) < 1 && isWater(px, pz)) {
      let nx = (isWater(px - 2, pz) ? 1 : 0) - (isWater(px + 2, pz) ? 1 : 0), nz = (isWater(px, pz - 2) ? 1 : 0) - (isWater(px, pz + 2) ? 1 : 0);
      nx = -nx; nz = -nz;
      if (!nx && !nz) { const v = Math.hypot(c.vx, c.vz) || 1; nx = -c.vx / v; nz = -c.vz / v; }
      const l = Math.hypot(nx, nz); nx /= l; nz /= l;
      c.x += nx * 0.5; c.z += nz * 0.5;
      const vn = c.vx * nx + c.vz * nz;
      if (vn < 0) { c.vx -= 1.4 * vn * nx; c.vz -= 1.4 * vn * nz; c.vx *= 0.75; c.vz *= 0.75; c.shake = Math.min(1, c.shake + Math.abs(vn) * 0.04); c.hit = Math.min(1, Math.abs(vn) * 0.05); }
    }
  }
}

/* ===================================================================== camera */
function cameraFor(view, c, cam, dt, t) {
  // smoothed heading for the chase cams
  let dh = c.h - cam.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
  cam.h += dh * Math.min(1, dt * (view === 1 ? 3 : 5));
  const speed = Math.hypot(c.vx, c.vz);
  const fx = Math.sin(cam.h), fz = Math.cos(cam.h), rx = Math.cos(cam.h), rz = -Math.sin(cam.h);
  const cfx = Math.sin(c.h), cfz = Math.cos(c.h), crx = Math.cos(c.h), crz = -Math.sin(c.h);
  let e, l, drawCar = true, fov = 62 + Math.min(18, speed * 0.2);
  switch (view) {
    case 1: e = [-fx * 11, 4.6, -fz * 11]; l = [fx * 6, 1.0, fz * 6]; break;
    case 2: e = [cfx * 0.9, 1.08, cfz * 0.9]; l = [cfx * 30, 0.8, cfz * 30]; fov += 4; break;                 // hood
    case 3: { const de = window.CarHD ? CarHD.RIG.driverEye : [-0.35, 1.0, -0.15];   // driver's eye, in the car frame
      e = [cfx * de[2] + crx * de[0], de[1], cfz * de[2] + crz * de[0]]; l = [cfx * 30 + crx * de[0], de[1] - 0.12, cfz * 30 + crz * de[0]]; drawCar = !!window.CarHD; fov = 70 + Math.min(10, speed * 0.1); break; } // cockpit
    case 4: e = [cfx * 2.45, 0.45, cfz * 2.45]; l = [cfx * 30, 0.45, cfz * 30]; drawCar = false; fov += 8; break;  // bumper
    case 5: { const a = t * 0.25; e = [Math.sin(a) * 13, 5.5 + Math.sin(t * 0.4) * 2, Math.cos(a) * 13]; l = [0, 0.8, 0]; fov = 55; break; }
    case 6: e = [-fx * 2, 70, -fz * 2]; l = [fx * 3, 0, fz * 3]; fov = 60; break;
    default: e = [-fx * 6.5, 2.4, -fz * 6.5]; l = [fx * 4, 0.9, fz * 4];
  }
  const sh = c.shake * 0.25, cy = c.y || 0;
  e[0] += (Math.random() - 0.5) * sh; e[1] += (Math.random() - 0.5) * sh;
  if (view !== 5 && view !== 6) { e[1] += cy; l[1] += cy; } else l[1] += cy;
  return { e, l, drawCar, fov, cockpit: view === 3 && !window.CarHD };
}

/* ===================================================================== matrices */
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect,0,0,0, 0,f,0,0, 0,0,(far + near) * nf,-1, 0,0,2 * far * near * nf,0]);
}
function lookAt(e, c, up) {
  let fx = c[0] - e[0], fy = c[1] - e[1], fz = c[2] - e[2];
  let l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
  let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0];
  l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
  const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
  return { m: new Float32Array([sx,ux,-fx,0, sy,uy,-fy,0, sz,uz,-fz,0,
    -(sx*e[0]+sy*e[1]+sz*e[2]), -(ux*e[0]+uy*e[1]+uz*e[2]), (fx*e[0]+fy*e[1]+fz*e[2]), 1]), f: [fx,fy,fz], r: [sx,sy,sz], u: [ux,uy,uz] };
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}
/* model matrix: rotation about y by h, then translation */
function model(h, tx, ty, tz) {
  const c = Math.cos(h), s = Math.sin(h);
  return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, tx,ty,tz,1]);
}

/* ===================================================================== game */
function Game(canvas, hud, opts) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: !!opts.preserve });
  if (!gl) throw new Error('WebGL non disponibile');
  this.gl = gl; this.canvas = canvas; this.hud = hud; this.o = opts;
  const SH = SHADERS;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(v, f) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, SH[v])); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, SH['common.glsl'] + '\n' + SH[f]));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  this.P = { sky: prog('sky.vert', 'sky.frag'), building: prog('building.vert', 'building.frag'), ground: prog('ground.vert', 'ground_game.frag'),
    board: prog('billboard.vert', 'billboard.frag'), car: prog('car.vert', 'car.frag'), rain: prog('rain.vert', 'rain.frag'),
    post: prog('post.vert', 'post.frag'), warp: prog('post.vert', 'warp.frag'), nature: prog('nature.vert', 'nature.frag'), meadow: prog('ground.vert', 'ground_meadow.frag'), mist: prog('post.vert', 'mist.frag'), solid: prog('solid.vert', 'solid.frag'), glow: prog('glow.vert', 'glow.frag'), lens: prog('post.vert', 'lens.frag') };
  if (window.CarHD && window.CarRender) { this.P.hd = prog('car_hd.vert', 'car_hd.frag'); this.hd = new CarRender(gl, this.P.hd, CarHD.build({ quality: opts.quality || 'high' })); this.hdQ = opts.quality || 'high'; }
  this.P.veh = prog('vehicle.vert', 'vehicle.frag'); this.P.water = prog('water.vert', 'water.frag'); this.P.eco = prog('post.vert', 'eco.frag'); this.P.pil = prog('pilot.vert', 'vehicle.frag'); this.P.seabed = prog('water.vert', 'seabed.frag');
  function buf(arr, idx) { const b = gl.createBuffer(); gl.bindBuffer(idx ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, b); gl.bufferData(idx ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, idx ? new Uint16Array(arr) : new Float32Array(arr), gl.STATIC_DRAW); return b; }
  const ext32 = gl.getExtension('OES_element_index_uint');
  this.mesh = (attrs, idx) => { const m = { a: {}, n: idx.length }; for (const k in attrs) m.a[k] = { b: buf(attrs[k][0]), s: attrs[k][1] };
    let big = false; for (let i = 0; i < idx.length; i++) if (idx[i] > 65535) { big = true; break; }
    if (big && ext32) { const b = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW); m.i = b; m.u32 = true; }
    else m.i = buf(idx, true); return m; };
  const city = this.city = buildGameCity(opts.seed || 2077);
  this.M = {
    chunks: city.chunks.map(B => this.mesh({ aPos: [B.pos, 3], aCenter: [B.center, 2], aNorm: [B.norm, 3], aUV: [B.uv, 2], aMisc: [B.misc, 4] }, B.idx)),
    board: this.mesh({ aPos: [city.BB.pos, 3], aCenter: [city.BB.center, 2], aUV: [city.BB.uv, 2], aMisc: [city.BB.misc, 4] }, city.BB.idx),
    car: this.mesh({ aLane: [city.C.lane, 4], aDir: [city.C.dir, 4], aCorner: [city.C.corner, 2] }, city.C.idx),
    rain: this.mesh({ aSeed: [city.RN.seed, 3], aCorner: [city.RN.corner, 2] }, city.RN.idx),
    ground: this.mesh({ aPos: [[-S / 2, -S / 2, S / 2, -S / 2, S / 2, S / 2, -S / 2, S / 2], 2] }, [0, 1, 2, 0, 2, 3]),
    quad: this.mesh({ aPos: [[-1, -1, 1, -1, 1, 1, -1, 1], 2] }, [0, 1, 2, 0, 2, 3])
  };
  { const hw = (HARBOR.x1 - HARBOR.x0) / 2 + 1; this.M.water = this.mesh({ aPos: [[-hw, -hw, hw, -hw, hw, hw, -hw, hw], 2] }, [0, 1, 2, 0, 2, 3]); }
  this.vmesh = m => { const g = this.mesh(Object.assign({ aPos: [m.pos, 3], aNorm: [m.norm, 3], aCol: [m.col, 4], aAnim: [m.anim, 4] }, m.skin ? { aSkin: [m.skin, 4] } : {}), m.idx); g.hinges = m.hinges; return g; };
  if (window.KageFleet) this.T = { drones: KageFleet.bakeTraffic(KageFleet.buildDrone({ lod: 'lo' }), city.DR).map(ch => this.mesh({ aPos: [ch.pos, 3], aNorm: [ch.norm, 3], aCol: [ch.col, 4], aAnim: [ch.anim, 4], aLane: [ch.lane, 4], aDir: [ch.dir, 4] }, ch.idx)) };
  if (window.EngineFX) {
    const F = window.EngineFX;
    this.P.fx = prog('particle.vert', 'particle.frag');
    this.eng = new F.EngineSim(opts.power || 'v8'); this.fx = new F.ExhaustFX(700); this.fxgl = new F.ExhaustGL(gl, this.P.fx); this.audio = new F.EngineAudio();
    this.fxO = null;
  }
  const md = this.meadow = buildMeadow((opts.seed || 2077) + 1885);
  this.M.nature = md.chunks.map(B => this.mesh({ aPos: [B.pos, 3], aCenter: [B.center, 2], aNorm: [B.norm, 3], aCol: [B.col, 4] }, B.idx));
  this.tj = { charge: 0, phase: 0, t: 0, cool: 0, white: 0, ring: 1 };
  this.world = 'city';
  this.car = (window.kageLoad ? kageLoad() : {});
  this.applyCar = () => { this.car = kageLoad(); if (this.hd && this.car.text === 'C') this.hd.replaceParts(CarHD.buildText(this.car.customText || 'KAGE GT')); };
  this.applyCar();
  addEventListener('focus', () => this.applyCar()); addEventListener('storage', () => this.applyCar());
  this.buildCar();
  this.c = newCar(); this.cam = { h: 0 }; this.t = 0; this.flash = 0; this.nextFlash = 3; this.view = 0;
  this.stats = { verts: city.chunks.reduce((a, B) => a + B.pos.length / 3, 0), chunks: city.chunks.length };
  this.fleet = window.FleetGame ? new FleetGame(this) : null;   // drone / boat / galleon (web/fleet_game.js)
  this.veh = null;
  this.nexus = window.KageNexus ? new KageNexus(this) : null;   // portal to ECO (web/nexus.js)
  this.foot = window.KageOnFoot ? new KageOnFoot(this) : null;   // walk around as your pilot (web/onfoot.js)
  this.xeno = window.KageXenoGame && this.fleet ? new KageXenoGame(this) : null;   // UFO, crew, time cabin (web/xeno_game.js)
  this.star = window.KageStarGame && this.fleet ? new KageStarGame(this) : null;
  this.aos = window.AmpyOS && this.foot ? new AmpyOS(this) : null;   // AmpybiOS tablet shell (web/ampyos.js)
  this.post = [];
  this.people = window.KagePeople && this.foot ? new KagePeople(this) : null;   // citizens on the pavements (web/people.js)
  this.trophies = window.KageTrophies && this.foot ? new KageTrophies(this) : null;   // achievements (web/trophies.js)
  this.power = window.KagePower && !opts.preserve ? new KagePower(this) : null;   // KAGE POWER battery-aware quality (web/power.js)
  this.music = window.KageMusic ? new KageMusic(this) : null;   // KAGE SOUND soundtrack + 3D sounds (web/music.js)
  this.net = window.KageNet && this.foot ? new KageNet(this) : null;   // KAGE NET local multiplayer (web/net.js)
  this.photo = window.KagePhoto && this.foot ? new KagePhoto(this) : null;   // AmpyCam photo mode (web/photo.js)
  this.editor = window.KageEditor && this.foot ? new KageEditor(this) : null;   // KAGE BUILD city decorations (web/editor.js)
  this.story = window.KageStory && this.foot ? new KageStory(this) : null;   // the campaign (web/story.js)
  this.ampyobj = window.KageAmpyObj ? new KageAmpyObj(this) : null;   // imported OBJ assets placed in the world (web/ampyobj.js)   // AmpybiOS tablet shell (web/ampyos.js)
  this.tech = window.KageTech && this.foot ? new KageTech(this) : null;   // technician's tablet (web/tech.js)
  this.mono = window.KageGlyphs && this.foot ? new KageGlyphs(this) : null;   // monoliths + the CUSTODI language (web/monolith.js)
  this.gear = window.KageGear && this.foot ? new KageGear(this) : null;   // jetpack + skateboard (web/gear.js)   // KAGE ODYSSEY starship, space, planets (web/starship_game.js)
}
/** model resolution for the KAGE GT: low / high / ultra */
Game.prototype.setQuality = function (q) {
  if (!this.P.hd || this.hdQ === q) return;
  this.hd = new CarRender(this.gl, this.P.hd, CarHD.build({ quality: q })); this.hdQ = q; this.o.quality = q;
  if (this.car && this.car.text === 'C') this.hd.replaceParts(CarHD.buildText(this.car.customText || 'KAGE GT'));
  if (this.fleet) this.fleet.setQuality(q);
};
Game.prototype.buildCar = function () {
  const pal = CYBER_PALETTES[this.o.palette] || CYBER_PALETTES.neon;
  const paint = (PAINTS[this.o.paint] || PAINTS.nero).c;
  const m = buildCarModel(paint, pal.neonA);
  this.paletteBuilt = this.o.palette + this.o.paint;
  this.CM = {
    solid: this.mesh({ aPos: [m.solid.pos, 3], aNorm: [m.solid.norm, 3], aCol: [m.solid.col, 4] }, m.solid.idx),
    under: this.mesh({ aPos: [m.under.pos, 3], aUV: [m.under.uv, 2], aCol: [m.under.col, 4] }, m.under.idx),
    heads: this.mesh({ aPos: [m.heads.pos, 3], aUV: [m.heads.uv, 2], aCol: [m.heads.col, 4] }, m.heads.idx),
    tail: this.mesh({ aPos: [m.tail.pos, 3], aUV: [m.tail.uv, 2], aCol: [m.tail.col, 4] }, m.tail.idx)
  };
};
Game.prototype.draw = function (pr, m) {
  const gl = this.gl; gl.useProgram(pr.p);
  const used = [];
  for (const k in m.a) { const loc = gl.getAttribLocation(pr.p, k); if (loc < 0) continue; gl.bindBuffer(gl.ARRAY_BUFFER, m.a[k].b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, m.a[k].s, gl.FLOAT, false, 0, 0); used.push(loc); }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i); gl.drawElements(gl.TRIANGLES, m.n, m.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
  for (const l of used) gl.disableVertexAttribArray(l);
};

Game.prototype.frame = function (dt, inp) {
  this.inp = inp;
  const gl = this.gl, P = this.P, o = this.o;
  if (this.paletteBuilt !== o.palette + o.paint) this.buildCar();
  const cityPal = CYBER_PALETTES[o.palette] || CYBER_PALETTES.neon;
  const past = this.world === 'meadow';
  const eco = this.world === 'eco';
  let pal = past ? Object.assign({}, cityPal, MEADOW_PAL) : eco ? Object.assign({}, cityPal, KageNexus.ECO_PAL) : cityPal;
  // real light and weather where you are (web/realsky.js): day / dusk / night from the sun, live weather unless you picked one
  const SPACE = this.world === 'space' || this.world === 'planet';
  const RS = !past && !eco && !SPACE && window.getRealSky ? getRealSky() : null;
  if (RS && RS.enabled) pal = RS.apply(pal);
  if (this.star) pal = this.star.pal(pal);
  this.dayK = past ? 1 : (this.star && this.star.dayK() !== null) ? this.star.dayK() : RS ? RS.dayK() : 0;
  const wx = past || SPACE ? null : (CYBER_WEATHER[o.weather || (RS && RS.weather()) || ''] || null);
  this.t += dt; const t = this.t;
  this.flash = Math.max(0, this.flash - dt * 3.5);
  if (wx && wx.light > 0) { this.nextFlash -= dt; if (this.nextFlash <= 0) { this.flash = 1; this.nextFlash = Math.random() < 0.35 ? 0.15 : 4 + Math.random() * 9; } }
  this.c.pk = { v8: 1, wankel: 1.03, mag: 1.1 }[o.power || 'v8'] || 1;
  this.c.world = this.world; this.c.meadow = this.meadow;
  // LEVITA flight: hover higher (and keep hovering a little when not flying)
  const flyT = (o.power === 'mag' && o.fly) ? 1 : 0;
  this.fly = (this.fly || 0) + Math.max(-dt * 0.8, Math.min(dt * 0.8, flyT - (this.fly || 0)));
  const fsm = this.fly * this.fly * (3 - 2 * this.fly);
  this.c.y = fsm * CarHD.RIG.fly.alt + (o.power === 'mag' ? 0.015 * Math.sin(this.t * 2.1) * (1 + fsm * 4) : 0);
  const VEH = this.veh && this.fleet, FOOT = !VEH && this.foot && this.foot.active;
  if (this.audio) this.audio.mute = !!(FOOT && !(this.foot.trans && this.foot.trans.into));   // no engine while you walk
  if (FOOT) this.foot.update(dt, inp);
  const phys = VEH ? this.fleet.update(dt, inp) : stepCar(this.c, FOOT ? { gas: false, brake: false, steer: 0, hand: true, boost: false } : inp, dt, this.city);
  this.phys = phys;
  if (this.nexus) this.nexus.update(dt);
  if (this.xeno) this.xeno.update(dt, inp);
  if (this.star) this.star.update(dt, inp);
  if (this.gear) this.gear.update(dt, inp);
  if (this.mono) this.mono.update(dt);
  if (this.tech) this.tech.update(dt);
  if (this.story) this.story.update(dt);
  if (this.editor) this.editor.update(dt);
  if (this.net) this.net.update(dt);
  if (this.people) this.people.update(dt);
  if (this.trophies) this.trophies.update(dt);
  if (this.music) this.music.update(dt);
  const c = this.c;
  const cv0 = VEH ? this.fleet.camera(this.view, dt, t) : FOOT ? this.foot.camera(this.view, dt) : cameraFor(this.view, c, this.cam, dt, t);
  const cv1 = this.xeno ? this.xeno.camera(cv0, dt) : cv0, cv = this.star ? this.star.camera(cv1, dt) : cv1;
  // below the lagoon surface: teal murk, light from above, marine snow
  const UNDER = !past && !SPACE && cv.e[1] < -1.25 && isWater(c.x + cv.e[0], c.z + cv.e[2]);
  if (UNDER) pal = Object.assign({}, pal, { fog: eco ? [0.0, 0.07, 0.03] : [0.0, 0.075, 0.095], top: [0.0, 0.04, 0.05], fogDen: 0.042, sun: [0.3, 0.6, 0.65], stripes: 0 });
  this.cv = cv;
  if (this.eng && VEH) { this.audio.on = false; this.audio.feed(this.eng); this.fxO = null; }
  if (this.eng && !VEH) {
    if (this.eng.type !== (o.power || 'v8')) { this.eng.setType(o.power || 'v8'); this.eng.rpm = this.eng.T.idle; }
    this.eng.race = o.exhaust === 'race';
    this.eng.update(dt, { speed: phys.vF, throttle: inp.gas && !FOOT ? 1 : 0, boost: phys.boosting && !FOOT, slip: phys.slip, wheelspin: phys.wheelspin, brakeHard: phys.brakeHard && !FOOT, brake: inp.brake && !FOOT, airborne: (this.fly || 0) > 0.3 });
    // live telemetry for the cockpit HUD + cluster: g forces, 0-100 / 0-200 timers
    const T = this.tel = this.tel || { gx: 0, gy: 0, v0: 0, run: -1, t100: null, t200: null };
    const vNow = Math.abs(phys.vF);
    T.gx += ((vNow - T.v0) / Math.max(dt, 1e-3) / 9.81 - T.gx) * Math.min(1, dt * 6); T.v0 = vNow;
    T.gy += ((c.steer * 2.5 * Math.min(1, vNow / 10) / (1 + vNow / 45)) * vNow / 9.81 - T.gy) * Math.min(1, dt * 6);
    if (vNow < 0.3) { T.run = 0; T.d100 = T.d200 = false; }
    else if (T.run >= 0) {
      T.run += dt;
      if (!T.d100 && vNow * 3.6 >= 100) { T.t100 = T.run; T.d100 = true; }
      if (!T.d200 && vNow * 3.6 >= 200) { T.t200 = T.run; T.d200 = true; T.run = -1; }
      if (inp.brake) T.run = -1;
    }
    this.audio.feed(this.eng);
    // KAGE CHRONO: hold 300 km/h to charge the jump; the jump swaps Cybercity ⇄ the meadow
    const tj = this.tj, kmh = Math.abs(phys.vF) * 3.6;
    tj.cool = Math.max(0, tj.cool - dt); tj.white = Math.max(0, tj.white - dt * 1.6); tj.ring = Math.min(1, tj.ring + dt * 0.9);
    if (o.chrono && tj.cool <= 0 && kmh >= 300) tj.charge = Math.min(1, tj.charge + dt / 1.6); else tj.charge = Math.max(0, tj.charge - dt * 1.2);
    if (tj.charge >= 1) {
      tj.charge = 0; tj.cool = 4; tj.white = 1; tj.ring = 0; tj.jumpAt = 0.18; this.audio.boom(); c.shake = 1;
    }
    if (tj.jumpAt !== undefined) { tj.jumpAt -= dt; if (tj.jumpAt <= 0) { tj.jumpAt = undefined; this.world = this.world === 'city' ? 'meadow' : 'city'; this.fx.p.length = 0; tj.arrive = 1; } }
    this.audio.setChrono(o.chrono ? tj.charge : 0);
    // particles live in the camera-relative frame: move them when the camera origin moves (torus-wrapped)
    const ox = c.x + cv.e[0], oz = c.z + cv.e[2];
    if (this.fxO) { let dx = ox - this.fxO[0], dz = oz - this.fxO[1]; dx -= Math.round(dx / S) * S; dz -= Math.round(dz / S) * S; this.fx.shift(-dx, 0, -dz); }
    this.fxO = [ox, oz];
  }
  // camera-relative world: eye at (0, ey, 0); uCamX / uCamZ = eye position on the torus
  const camX = ((c.x + cv.e[0]) % S + S) % S, camZ = ((c.z + cv.e[2]) % S + S) % S;
  const eye = [0, cv.e[1], 0];
  const carRel = [-cv.e[0], 0, -cv.e[2]];
  const W = this.canvas.width, H = this.canvas.height;
  gl.viewport(0, 0, W, H);
  const er = eco ? 0.035 * Math.sin(t * 0.37) + 0.015 * Math.sin(t * 1.9) : 0;   // ECO: the horizon is never quite level
  // camera roll (drone banking, the starship in turns): tilt the up vector about the view direction
  let upV = [Math.sin(er), Math.cos(er), 0];
  if (cv.roll) { const fx0 = cv.l[0] - cv.e[0], fy0 = cv.l[1] - cv.e[1], fz0 = cv.l[2] - cv.e[2], fl = Math.hypot(fx0, fy0, fz0) || 1, F0 = [fx0 / fl, fy0 / fl, fz0 / fl];
    let Rr = [F0[1] * 0 - F0[2] * 1, F0[2] * 0 - F0[0] * 0, F0[0] * 1 - F0[1] * 0]; const rl = Math.hypot(Rr[0], Rr[1], Rr[2]) || 1; Rr = Rr.map(v => v / rl);
    const cr = Math.cos(cv.roll), sr = Math.sin(cv.roll); upV = [upV[0] * cr + Rr[0] * sr, upV[1] * cr + Rr[1] * sr, upV[2] * cr + Rr[2] * sr]; }
  const V = lookAt(eye, [cv.l[0] - cv.e[0], cv.l[1], cv.l[2] - cv.e[2]], upV);
  const fov = cv.fov * Math.PI / 180, far = (this.star && this.star.far) || Math.round(700 * (this.power ? this.power.cfg().far : 1));
  const Pm = perspective(fov, W / H, 0.12, far);
  const VP = mul(Pm, V.m); this.VP = VP; this.Pm5 = Pm[5];
  const fogDen = pal.fogDen * (wx ? wx.fog : 1);
  const set = (pr) => {
    const u = pr.u, v3 = (n, a) => { if (u[n]) gl.uniform3fv(u[n], a); }, f1 = (n, a) => { if (u[n]) gl.uniform1f(u[n], a); };
    f1('uTime', t % 3600); f1('uL', S); f1('uFar', far > 700 ? far * 0.92 : Math.min(620, far * 0.89)); f1('uZOff', 0.5); f1('uCamX', camX); f1('uWrapX', S); f1('uCamZ', camZ);
    f1('uFogDen', fogDen); f1('uFlash', this.flash); f1('uPitch', GP); f1('uRoad', RW); f1('uGlitch', eco ? 1 : 0);
    v3('uFog', pal.fog); v3('uSkyTop', pal.top); v3('uWinA', pal.winA); v3('uWinB', pal.winB); v3('uWinC', pal.winC);
    v3('uNeonA', pal.neonA); v3('uNeonB', pal.neonB); v3('uEye', eye);
    if (u.uHL) { const fx = Math.sin(c.h), fz = Math.cos(c.h); gl.uniform4f(u.uHL, carRel[0] + fx * 2.3, carRel[2] + fz * 2.3, fx, fz); f1('uHLOn', VEH ? 0 : (past ? 0.35 : 1) * (this.techHL === undefined ? 1 : this.techHL)); }
    if (u.uHarbor) gl.uniform4f(u.uHarbor, HARBOR.x0, HARBOR.z0, HARBOR.x1, HARBOR.z1);
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, VP); if (u.uV) gl.uniformMatrix4fv(u.uV, false, V.m); if (u.uP) gl.uniformMatrix4fv(u.uP, false, Pm);
  };
  if (UNDER) gl.clearColor(pal.fog[0], pal.fog[1], pal.fog[2], 1); else gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  const sp = P.sky; gl.useProgram(sp.p); set(sp);
  gl.uniform3fv(sp.u.uFwd, V.f); gl.uniform3fv(sp.u.uRight, V.r); gl.uniform3fv(sp.u.uUp, V.u);
  const ty = Math.tan(fov / 2); gl.uniform2f(sp.u.uTan, ty * W / H, ty);
  if (sp.u.uCloud) gl.uniform1f(sp.u.uCloud, past ? 0.45 : wx ? wx.cloud : 0);
  if (sp.u.uDay) gl.uniform1f(sp.u.uDay, this.dayK);
  gl.uniform3fv(sp.u.uSunDir, pal.sunDir); gl.uniform3fv(sp.u.uSunCol, pal.sun); gl.uniform1f(sp.u.uSunStripes, pal.stripes);
  if (!UNDER) this.draw(sp, this.M.quad);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  if (past) {
    const g = P.meadow; gl.useProgram(g.p); set(g); gl.uniform3fv(g.u.uSunDir, pal.sunDir); gl.uniform3fv(g.u.uSunCol, pal.sun); this.draw(g, this.M.ground);
    const nt = P.nature; gl.useProgram(nt.p); set(nt); gl.uniform3fv(nt.u.uSunDir, pal.sunDir); gl.uniform3fv(nt.u.uSunCol, pal.sun); for (const m of this.M.nature) this.draw(nt, m);
    // in the past too: your vehicle, your pilot on foot and the EPOCH cabin
    if (this.fleet) this.fleet.drawPlayer({ set, camX, camZ, t, pal, dt });
    if (FOOT) this.foot.draw({ set, camX, camZ, t, pal, dt });
    if (this.gear) this.gear.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.xeno) this.xeno.drawWorld({ set, camX, camZ, t, pal, dt, past: true });
    if (this.story) this.story.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.net) this.net.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.ampyobj) this.ampyobj.drawWorld({ set, camX, camZ, t, pal, dt });
  } else if (SPACE) {
    if (this.star) this.star.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.mono) this.mono.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.net) this.net.drawWorld({ set, camX, camZ, t, pal, dt });
  } else {
    gl.useProgram(P.ground.p); set(P.ground); this.draw(P.ground, this.M.ground);
    gl.useProgram(P.building.p); set(P.building); for (const m of this.M.chunks) this.draw(P.building, m);
    if (eco) { const bu = P.building.u; gl.uniform1f(bu.uMirror, 470); gl.uniform1f(bu.uFogDen, 0.0019); gl.uniform1f(bu.uFar, 1500); for (const m of this.M.chunks) this.draw(P.building, m); gl.uniform1f(bu.uMirror, 0); set(P.building); }   // ECO: the city hangs from the sky
    gl.useProgram(P.board.p); set(P.board); this.draw(P.board, this.M.board);
    { const w = P.water; gl.useProgram(w.p); set(w); gl.uniform3f(w.u.uWaterC, HARBOR.cx, -1.2, HARBOR.cz); gl.uniform1f(w.u.uWaterRel, 0);
      const wk = this.fleet ? this.fleet.wake(camX, camZ) : [0, 0, 0, 0]; gl.uniform4f(w.u.uWake, wk[0], wk[1], wk[2], wk[3]); if (w.u.uUnder) gl.uniform1f(w.u.uUnder, UNDER ? 1 : 0); this.draw(w, this.M.water); }
    if (this.fleet) this.fleet.drawUnder({ set, camX, camZ, t, pal, dt, under: UNDER });
    if (this.T) { const v = P.veh, u = v.u; gl.useProgram(v.p); set(v); gl.uniform1f(u.uTraffic, 1); gl.uniform3f(u.uTint, -1, 0, 0); gl.uniform1f(u.uLit, 1); gl.uniform1f(u.uDay, this.dayK || 0); if (u.uSteer) gl.uniform1f(u.uSteer, 0);
      gl.uniform1f(u.uScale, 2.2); gl.uniform1f(u.uBob, 0); gl.uniform1f(u.uBlur, 0.45); gl.uniform1f(u.uFlut, 0.4); gl.uniform1f(u.uSailSide, 1); for (const m of this.T.drones) this.draw(v, m); }
    if (this.fleet) this.fleet.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.nexus) this.nexus.drawWorld({ set, camX, camZ, t, pal, dt });
    if (FOOT) this.foot.draw({ set, camX, camZ, t, pal, dt });
    if (this.gear) this.gear.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.xeno) this.xeno.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.star) this.star.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.mono) this.mono.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.ampyobj) this.ampyobj.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.editor) this.editor.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.people) this.people.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.net) this.net.drawWorld({ set, camX, camZ, t, pal, dt });
    if (this.story) this.story.drawWorld({ set, camX, camZ, t, pal, dt });
  }
  // body: heading + flight bank (gyroscopic roll into the turn) and pitch with the throttle
  const U = CarRenderUtil, fl = this.fly || 0;
  this.bank = (this.bank || 0) + ((-c.steer * (0.10 + 0.32 * fl) * Math.min(1, Math.abs(phys.vF) / 15)) - (this.bank || 0)) * Math.min(1, dt * 4);
  this.pitch = (this.pitch || 0) + (((inp.gas ? -0.025 : 0) + (inp.brake ? 0.04 : 0)) * (0.4 + fl) - (this.pitch || 0)) * Math.min(1, dt * 3);
  const carM = U.mul(U.T(carRel[0], c.y || 0, carRel[2]), U.mul(U.RY(c.h), U.mul(U.RX(this.pitch), U.RZ(this.bank))));
  this.roof = (this.roof || 0) + Math.max(-dt / 5, Math.min(dt / 5, (o.roof ? 1 : 0) - (this.roof || 0)));
  this.chronoPh = (this.chronoPh || 0) + dt * (1 + this.tj.charge * 14);
  this.doorT = Math.max(0, (this.doorT || 0) - dt); const doorK = this.doorT > 0 ? Math.sin(Math.min(1, (1.8 - this.doorT) / 1.8) * Math.PI) : 0;
  this.techDoorK = (this.techDoorK || 0) + ((this.techDoor || 0) - (this.techDoorK || 0)) * Math.min(1, dt * 2.5); this.techHoodK = (this.techHoodK || 0) + ((this.techHood || 0) - (this.techHoodK || 0)) * Math.min(1, dt * 2.5);
  const hdState = { hood: this.techHoodK, doorL: Math.max(doorK, this.techDoorK), doorR: this.techDoorK, wheelSteer: c.steer * 0.5, steerWheel: c.steer * 2.6, spin: c.spin, roof: this.roof, power: o.power || 'v8', time: t,
    exhaust: o.exhaust || 'serie', chrono: !!o.chrono, chronoPh: this.chronoPh, fly: fsm,
    kit: this.car.kit, rim: this.car.rim, livery: this.car.livery, text: this.car.text, hand: (this.handK = (this.handK || 0) + ((inp.hand ? 1 : 0) - (this.handK || 0)) * Math.min(1, dt * 12)) };
  if (VEH) { /* the player's vehicle is drawn by the fleet */ }
  else if (cv.drawCar && this.hd) {
    gl.useProgram(P.hd.p); set(P.hd); this.hd.setMaterials(o.paint, pal.neonA, pal.neonB, kageExtra(this.car));
    { const e = this.eng, u = P.hd.u; if (u.uSpd) { gl.uniform1f(u.uSpd, Math.abs(phys.vF) * 3.6); gl.uniform1f(u.uRpmK, e ? e.rpm / e.T.limiter : 0); gl.uniform1f(u.uGear, e ? e.gear : 0); gl.uniform1f(u.uFuelK, e ? e.fuelK || 0 : 1); gl.uniform1f(u.uGx, this.tel ? this.tel.gx : 0); } }
    gl.uniform1f(P.hd.u.uKey, past ? 1.0 : 0.35 + (this.dayK || 0) * 0.75); gl.uniform1f(P.hd.u.uLights, FOOT ? 0.35 : 1); gl.uniform1f(P.hd.u.uBrake, inp.brake && !FOOT ? 1 : 0);
    this.hd.draw(carM, hdState, 'opaque');
    if (this.net) this.net.drawCars({ camX, camZ, dt, hdState });
    if (this.fleet && this.view !== 3 && !FOOT) { this.fleet.drawPilot(set, carM, 'car'); gl.useProgram(P.hd.p); set(P.hd); }
  } else if (cv.drawCar && !this.hd) {
    gl.useProgram(P.solid.p); set(P.solid);
    gl.uniformMatrix4fv(P.solid.u.uModel, false, model(c.h, carRel[0], 0, carRel[2]));
    gl.uniform1f(P.solid.u.uGloss, (PAINTS[o.paint] || PAINTS.nero).c[0] > 0.6 ? 0.6 : 1);
    this.draw(P.solid, this.CM.solid);
  }
  // additive lights
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
  if (cv.drawCar && this.hd && !VEH) {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(P.hd.p); set(P.hd); this.hd.draw(carM, hdState, "glass"); gl.blendFunc(gl.ONE, gl.ONE);
  }
  if (this.eng && !VEH && !SPACE) {
    const tp = EngineFX.tipsFrom(carM, o.exhaust === 'race');
    // parked while you walk: engine off — no exhaust, no tyre smoke (what's in the air fades away)
    this.fx.update(dt, FOOT ? [] : tp.tips, tp.dir, [c.vx, 0, c.vz], this.eng, FOOT ? [] : tp.hubs);
    if (!FOOT) this.fx.tyreSmoke(dt, carM, Math.max(this.eng.burn || 0, (this.eng.tyre || 0) * 0.7), [c.vx, 0, c.vz], CarHD.RIG.kitTrack[this.car.kit || 0]);
    if (o.chrono && this.tj.charge > 0.05) this.fx.chronoArcs(carM, this.tj.charge, [c.vx, 0, c.vz]);
    if (this.tj.arrive) { this.tj.arrive = 0; this.fx.ring(carM, 2.2, [c.vx, 0, c.vz], 120); }
    gl.useProgram(P.fx.p); set(P.fx); this.fxgl.draw(this.fx, H / (2 * Math.tan(fov / 2)));
    gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
  }
  if (!past && !SPACE) { gl.useProgram(P.car.p); set(P.car); gl.uniform1f(P.car.u.uWidth, 0.3); this.draw(P.car, this.M.car); }
  if (!VEH) {
  gl.useProgram(P.glow.p); set(P.glow);
  gl.uniformMatrix4fv(P.glow.u.uModel, false, model(c.h, carRel[0], 0, carRel[2]));
  gl.uniform1f(P.glow.u.uGlow, 0.55 + 0.15 * Math.sin(t * 3)); this.draw(P.glow, this.CM.under);
  gl.uniform1f(P.glow.u.uGlow, 1); this.draw(P.glow, this.CM.heads);
  gl.uniform1f(P.glow.u.uGlow, FOOT ? 0.25 : inp.brake ? 1.8 : 0.7); this.draw(P.glow, this.CM.tail);
  }
  if (this.fleet && !SPACE) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); this.fleet.drawAdditive({ set, camX, camZ, t, pal, dt }); }
  if (this.nexus && !SPACE) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); this.nexus.drawAdditive({ set, camX, camZ, t, pal, dt }); }
  if (this.xeno && !SPACE) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); this.xeno.drawAdditive({ set, camX, camZ, t, pal, dt }); }
  if (this.star) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); this.star.drawAdditive({ set, camX, camZ, t, pal, dt }); }
  if (this.gear && !SPACE) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); this.gear.drawAdditive({ set, camX, camZ, t, pal, dt }); }
  // warp-field lensing: copy the frame and re-draw it bent around the ship (only while the KAGE ODYSSEY is in curvature)
  if (this.star && P.lens && !(this.power && !this.power.cfg().lens)) { const li = this.star.lens({ camX, camZ }); if (li) {
    let cx = 0.5, cy = 0.47, R = 0.3, k = li.k * 0.3;
    if (!li.inside) { const v = [li.p[0], li.p[1], li.p[2], 1], q = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q[i] += VP[j * 4 + i] * v[j];
      if (q[3] > 1) { cx = 0.5 + 0.5 * q[0] / q[3]; cy = 0.5 + 0.5 * q[1] / q[3]; R = Math.min(0.9, li.r * Pm[5] / q[3] * 0.5); k = li.k; } }
    if (!this.lensTex || this.lensW !== W || this.lensH !== H) { if (this.lensTex) gl.deleteTexture(this.lensTex); this.lensTex = gl.createTexture(); this.lensW = W; this.lensH = H; gl.bindTexture(gl.TEXTURE_2D, this.lensTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, W, H, 0, gl.RGB, gl.UNSIGNED_BYTE, null); }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.lensTex); gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, W, H);
    const lp = P.lens; gl.useProgram(lp.p); set(lp); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.uniform1i(lp.u.uTex, 0); gl.uniform2f(lp.u.uC, cx, cy); gl.uniform1f(lp.u.uR, R); gl.uniform1f(lp.u.uK, k); gl.uniform3fv(lp.u.uCol, li.col); gl.uniform2f(lp.u.uRes, W, H);
    this.draw(lp, this.M.quad); gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); } }
  const rainAmt = SPACE ? 0 : UNDER ? 0.55 : eco ? 0.6 : wx ? wx.rain : past ? 0 : (o.rain || 0);
  if (rainAmt > 0) {
    gl.useProgram(P.rain.p); set(P.rain); gl.uniform1f(P.rain.u.uCamZ, camZ % 84);
    gl.uniform1f(P.rain.u.uRain, rainAmt); gl.uniform1f(P.rain.u.uRainSpeed, UNDER ? 2.5 : eco ? -14 : 28);   // in ECO the rain falls upwards; under water: marine snow
    if (P.rain.u.uSnow) gl.uniform1f(P.rain.u.uSnow, UNDER ? 1 : wx ? wx.snow : 0); if (P.rain.u.uWind) gl.uniform1f(P.rain.u.uWind, UNDER ? 0 : wx ? wx.wind : 0);
    if (P.rain.u.uRainCenter) gl.uniform1f(P.rain.u.uRainCenter, UNDER || VEH ? 1 : 0);
    this.draw(P.rain, this.M.rain);
  }
  gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (wx && wx.mist > 0) { gl.useProgram(P.mist.p); set(P.mist); gl.uniform1f(P.mist.u.uMist, wx.mist * 0.7); gl.uniform2f(P.mist.u.uRes, W, H); this.draw(P.mist, this.M.quad); }
  gl.useProgram(P.post.p); gl.uniform1f(P.post.u.uFade, c.hit * 0.25); gl.uniform1f(P.post.u.uScan, 0); gl.uniform2f(P.post.u.uRes, W, H);
  this.draw(P.post, this.M.quad);
  const tj = this.tj;
  if (tj.charge > 0.01 || tj.white > 0.01 || tj.ring < 1) {
    const wp = P.warp; gl.useProgram(wp.p); set(wp); gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(wp.u.uWarp, tj.charge * tj.charge); gl.uniform1f(wp.u.uWhite, Math.min(1, tj.white * 1.4)); gl.uniform1f(wp.u.uRing, tj.ring); gl.uniform2f(wp.u.uRes, W, H);
    this.draw(wp, this.M.quad);
  }
  gl.depthMask(true); gl.disable(gl.BLEND);
  if (this.nexus) this.nexus.drawOverlay(W, H, set);
  gl.depthMask(true); gl.disable(gl.BLEND);
  if (VEH) this.fleet.drawHud(this.hud); else if (FOOT) this.hud.getContext('2d').clearRect(0, 0, this.hud.width, this.hud.height); else this.drawHud(inp);
  if (this.foot && !VEH) this.foot.drawHud(this.hud);
  if (this.fleet) this.fleet.drawGarageHud(this.hud);
  if (this.xeno && !SPACE) this.xeno.drawHud(this.hud);
  if (this.star) this.star.drawHud(this.hud);
  if (this.mono) this.mono.drawHud(this.hud);
  if (this.tech) this.tech.drawHud(this.hud);
  if (this.story) this.story.drawHud(this.hud);
  if (this.editor) this.editor.drawHud(this.hud);
  if (this.net) this.net.drawHud(this.hud);
  if (window.realSky && realSky.enabled && !SPACE && !(this.xeno && this.xeno.tt) && !(this.star && this.star.involved())) { const g2 = this.hud.getContext('2d'), m2 = Math.min(this.hud.width, this.hud.height), ln = realSky.line();
    if (ln) { g2.font = (m2 * 0.019 | 0) + 'px monospace'; g2.textAlign = 'center'; g2.fillStyle = 'rgba(236,252,255,0.75)'; g2.fillText(ln, this.hud.width / 2, m2 * 0.03); g2.textAlign = 'left'; } }
  if (this.nexus) this.nexus.drawHud(this.hud);
  // readers of the finished frame (photo preview / capture): the drawing buffer is only valid right now
  if (this.post && this.post.length) for (const fn of this.post.slice()) { try { fn(this.canvas); } catch (e) { } }
};

/* ===================================================================== HUD (2D canvas) */
Game.prototype.drawHud = function (inp) {
  const h = this.hud, g = h.getContext('2d'), W = h.width, H = h.height, c = this.c, m = Math.min(W, H);
  const pal = CYBER_PALETTES[this.o.palette] || CYBER_PALETTES.neon;
  const A = 'rgb(' + pal.neonA.map(v => v * 255 | 0) + ')', B = 'rgb(' + pal.neonB.map(v => v * 255 | 0) + ')';
  g.clearRect(0, 0, W, H);
  if (this.cv.cockpit) cockpit(g, W, H, c, A, B);
  if (this.view === 3 && this.eng && this.tel) {        // head-up display with live telemetry
    const e = this.eng, T = this.tel, kmh = Math.abs(this.phys.vF) * 3.6, cx2 = W / 2, y0 = H * 0.08;
    g.save(); g.globalAlpha = 0.9; g.textAlign = 'center';
    g.fillStyle = 'rgba(7,11,19,0.35)'; g.fillRect(cx2 - m * 0.32, y0 - m * 0.04, m * 0.64, m * 0.2);
    g.fillStyle = '#ecfcff'; g.font = 'bold ' + (m * 0.07 | 0) + 'px monospace'; g.fillText(Math.round(kmh), cx2, y0 + m * 0.05);
    g.font = (m * 0.018 | 0) + 'px monospace'; g.fillText('KM/H', cx2, y0 + m * 0.075);
    g.font = 'bold ' + (m * 0.04 | 0) + 'px monospace'; g.fillStyle = B; g.fillText(e.gear === -2 ? 'E' : e.gear < 0 ? 'N' : e.gear + 1, cx2 - m * 0.2, y0 + m * 0.05);
    const rk = Math.min(1, e.rpm / e.T.limiter); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(cx2 - m * 0.3, y0 - m * 0.03, m * 0.6, m * 0.012);
    g.fillStyle = rk > 0.9 ? '#ff3b5c' : A; g.fillRect(cx2 - m * 0.3, y0 - m * 0.03, m * 0.6 * rk, m * 0.012);
    // g-meter
    const gx0 = cx2 + m * 0.22, gy0 = y0 + m * 0.045, gr = m * 0.045;
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(gx0, gy0, gr, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(gx0, gy0, gr / 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = A; g.beginPath(); g.arc(gx0 + Math.max(-1.5, Math.min(1.5, -T.gy)) * gr / 1.5, gy0 - Math.max(-1.5, Math.min(1.5, T.gx)) * gr / 1.5, m * 0.007, 0, Math.PI * 2); g.fill();
    g.font = (m * 0.015 | 0) + 'px monospace'; g.fillStyle = '#ecfcff';
    g.fillText('LONG ' + T.gx.toFixed(2) + ' g  LAT ' + T.gy.toFixed(2) + ' g', cx2, y0 + m * 0.105);
    g.fillText('0-100 ' + (T.t100 ? T.t100.toFixed(2) + ' s' : '--') + '   0-200 ' + (T.t200 ? T.t200.toFixed(2) + ' s' : '--'), cx2, y0 + m * 0.128);
    const ff = EngineFX.fmtFuel(e); g.fillText('⛽ ' + ff.cons + '   ' + ff.tank, cx2, y0 + m * 0.151);
    g.restore();
  }
  if (this.eng && this.view !== 3) { const ff = EngineFX.fmtFuel(this.eng); g.font = (m * 0.016 | 0) + 'px monospace'; g.textAlign = 'center'; g.fillStyle = this.eng.fuelK < 0.12 ? '#ff3b5c' : '#ecfcff'; g.fillText('⛽ ' + ff.cons + ' · ' + ff.tank, W - m * 0.15, m * 0.29); }
  const kmh = Math.round(Math.hypot(c.vx, c.vz) * 3.6);
  // speedometer arc
  const cx = W - m * 0.16, cy = H - m * 0.16, r = m * 0.11;
  g.lineWidth = m * 0.012; g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
  const k = Math.min(1, kmh / 340);
  g.strokeStyle = this.phys && this.phys.boosting ? B : A; g.shadowColor = g.strokeStyle; g.shadowBlur = m * 0.02;
  g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * k)); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = '#ecfcff'; g.textAlign = 'center'; g.font = 'bold ' + (m * 0.06 | 0) + 'px monospace';
  g.fillText(kmh, cx, cy + m * 0.015); g.font = (m * 0.02 | 0) + 'px monospace'; g.fillText('KM/H', cx, cy + m * 0.045);
  // nitro bar
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(cx - r, cy + r * 0.95, r * 2, m * 0.012);
  g.fillStyle = B; g.fillRect(cx - r, cy + r * 0.95, r * 2 * c.boost, m * 0.012);
  g.font = (m * 0.016 | 0) + 'px monospace'; g.fillStyle = '#ecfcff'; g.fillText('NITRO', cx, cy + r * 0.95 + m * 0.035);
  if (this.o.chrono) {   // chrono gauge
    const k = this.tj.charge, bw = m * 0.30, bx = cx - bw / 2, by = cy - r * 1.55;
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(bx, by, bw, m * 0.012);
    g.fillStyle = A; g.shadowColor = A; g.shadowBlur = m * 0.02 * k; g.fillRect(bx, by, bw * k, m * 0.012); g.shadowBlur = 0;
    g.font = (m * 0.016 | 0) + 'px monospace'; g.fillStyle = '#ecfcff'; g.textAlign = 'center';
    g.fillText(this.tj.cool > 0 ? 'CRONO · RICARICA' : k > 0 ? 'CRONO · TIENI 300 KM/H' : 'CRONO · PRONTO A 300 KM/H', cx, by - m * 0.012);
  }
  if (this.world === 'meadow') { g.font = 'bold ' + (m * 0.024 | 0) + 'px monospace'; g.textAlign = 'left'; g.fillStyle = '#fff6c8'; g.fillText('⏳ PRATERIA DEL PASSATO', m * 0.03, m * 0.13); }
  if (this.eng) {   // rev counter: thin inner arc + gear
    const e = this.eng, kr = Math.min(1, e.rpm / e.T.limiter);
    g.lineWidth = m * 0.006; g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(cx, cy, r * 0.8, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
    g.strokeStyle = e.rpm > e.T.red * 0.9 ? '#ff3b5c' : B; g.beginPath(); g.arc(cx, cy, r * 0.8, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * kr)); g.stroke();
    g.font = 'bold ' + (m * 0.026 | 0) + 'px monospace'; g.fillStyle = e.rpm > 8000 ? '#ff3b5c' : '#ecfcff';
    g.fillText((e.gear === -2 ? 'E' : e.gear < 0 ? 'N' : e.gear + 1) + '  ' + (Math.round(e.rpm / 100) * 100), cx, cy - r * 0.38);
    if (!this.audio.ctx) { g.font = (m * 0.016 | 0) + 'px monospace'; g.fillStyle = 'rgba(236,252,255,0.6)'; g.fillText('🔊 tocca / premi un tasto per il suono', W / 2, H - m * 0.03); }
  }
  // top-left: view + score
  g.textAlign = 'left'; g.font = 'bold ' + (m * 0.022 | 0) + 'px monospace'; g.fillStyle = A;
  g.fillText('NEON RUN · ' + VIEWS[this.view], m * 0.03, m * 0.05);
  g.fillStyle = '#ecfcff'; g.font = (m * 0.02 | 0) + 'px monospace';
  g.fillText('PUNTI DRIFT ' + c.score + '   RECORD ' + c.best + '   ' + (c.dist / 1000).toFixed(1) + ' km', m * 0.03, m * 0.085);
  if (c.drift > 5) { g.font = 'bold ' + (m * 0.05 | 0) + 'px monospace'; g.textAlign = 'center'; g.fillStyle = B; g.shadowColor = B; g.shadowBlur = 20;
    g.fillText('DRIFT ' + Math.round(c.drift), W / 2, H * 0.22); g.shadowBlur = 0; }
  // minimap (north-up, roads around the player)
  const mr = m * 0.12, mx = W - mr - m * 0.03, my = mr + m * 0.03, scale = mr / 220;
  g.save(); g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(7,11,19,0.75)'; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  g.strokeStyle = 'rgba(160,200,230,0.45)'; g.lineWidth = RW * scale;
  if (this.world === 'meadow') { g.fillStyle = 'rgba(40,90,30,0.75)'; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2); g.strokeStyle = 'rgba(0,0,0,0)'; }
  for (let k2 = -4; k2 <= 4 && this.world !== 'meadow'; k2++) {
    const rx = (Math.round(c.x / GP) + k2) * GP - c.x, rz = (Math.round(c.z / GP) + k2) * GP - c.z;
    g.beginPath(); g.moveTo(mx + rx * scale, my - mr); g.lineTo(mx + rx * scale, my + mr); g.stroke();
    g.beginPath(); g.moveTo(mx - mr, my - rz * scale); g.lineTo(mx + mr, my - rz * scale); g.stroke();
  }
  g.restore();
  g.strokeStyle = A; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.stroke();
  g.save(); g.translate(mx, my); g.rotate(c.h); g.fillStyle = B;
  g.beginPath(); g.moveTo(0, -m * 0.018); g.lineTo(m * 0.011, m * 0.012); g.lineTo(-m * 0.011, m * 0.012); g.closePath(); g.fill(); g.restore();
  g.fillStyle = '#ecfcff'; g.font = (m * 0.016 | 0) + 'px monospace'; g.textAlign = 'center'; g.fillText('N', mx, my - mr + m * 0.022);
  if (this.o.help) {
    g.textAlign = 'left'; g.fillStyle = 'rgba(236,252,255,0.7)'; g.font = (m * 0.017 | 0) + 'px monospace';
    ['W/↑ accelera · S/↓ frena · A D/← → sterza', 'SPAZIO derapata · SHIFT nitro · C vista', 'P atmosfera · M meteo · V colore · E propulsione · T capote · X scarico · Q crono · F volo (LEVITA) · B suono · H aiuto']
      .forEach((s, i) => g.fillText(s, m * 0.03, H - m * 0.12 + i * m * 0.03));
  }
};

function cockpit(g, W, H, c, A, B) {
  // A-pillars, roof edge, dashboard and steering wheel (drawn over the 3D view)
  g.fillStyle = '#05070c';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.16, 0); g.lineTo(W * 0.02, H * 0.62); g.lineTo(0, H * 0.66); g.fill();
  g.beginPath(); g.moveTo(W, 0); g.lineTo(W * 0.84, 0); g.lineTo(W * 0.98, H * 0.62); g.lineTo(W, H * 0.66); g.fill();
  g.fillRect(0, 0, W, H * 0.05);
  const dy = H * 0.74;
  const grd = g.createLinearGradient(0, dy, 0, H); grd.addColorStop(0, '#0b1020'); grd.addColorStop(1, '#020306');
  g.fillStyle = grd; g.beginPath(); g.moveTo(0, H); g.lineTo(0, dy + H * 0.04); g.quadraticCurveTo(W / 2, dy - H * 0.05, W, dy + H * 0.04); g.lineTo(W, H); g.fill();
  g.strokeStyle = A; g.lineWidth = 2; g.beginPath(); g.moveTo(W * 0.05, dy + H * 0.035); g.quadraticCurveTo(W / 2, dy - H * 0.055, W * 0.95, dy + H * 0.035); g.stroke();
  // wheel rotated by the steering
  const wx = W * 0.34, wy = H * 0.98, wr = H * 0.22;
  g.save(); g.translate(wx, wy); g.rotate(c.steer * 1.4);
  g.strokeStyle = '#151a26'; g.lineWidth = H * 0.035; g.beginPath(); g.arc(0, 0, wr, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.strokeStyle = B; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, wr, Math.PI * 1.45, Math.PI * 1.55); g.stroke();
  g.strokeStyle = '#151a26'; g.lineWidth = H * 0.025; g.beginPath(); g.moveTo(-wr * 0.95, -wr * 0.3); g.lineTo(0, -wr * 0.15); g.lineTo(wr * 0.95, -wr * 0.3); g.stroke();
  g.restore();
}


/* ===================================================================== autopilot (screensaver city run) */
// keeps the right-hand lane of the grid, picks a random turn at each intersection, slows for corners. Mirrors GameRenderer.autopilot() on Android.
function Autopilot() { this.dir = 0; this.turn = 0; this.next = NaN; this.cruise = 30; this.stuck = 0; this.view = 0; this.viewNext = 10; this.boostT = 0; }
Autopilot.LANE = 4.5;
Autopilot.lane = (d, c) => { const h = d * Math.PI / 2; return d % 2 === 0 ? c + Math.cos(h) * Autopilot.LANE : c - Math.sin(h) * Autopilot.LANE; };
Autopilot.prototype.start = function (c) { Object.assign(c, newCar()); c.x = Autopilot.lane(0, 0); c.z = 42; c.h = 0; this.dir = 0; this.next = NaN; };
Autopilot.prototype.step = function (c, dt, game) {
  const inp = { gas: false, brake: false, steer: 0, hand: false, boost: false };
  const along = this.dir % 2 === 0 ? c.z : c.x, sgn = this.dir === 0 || this.dir === 1 ? 1 : -1;
  const cross = this.dir % 2 === 0 ? c.x : c.z, road = Math.round(cross / GP) * GP;
  const ni = sgn > 0 ? Math.ceil((along + 0.5) / GP) * GP : Math.floor((along - 0.5) / GP) * GP;
  if (isNaN(this.next) || Math.abs(ni - this.next) > 1) {
    this.next = ni; this.cruise = 22 + Math.random() * 18;
    // pick a turn that does not lead into the harbour lagoon
    const ix = this.dir % 2 === 0 ? road : ni, iz = this.dir % 2 === 0 ? ni : road, ok = [];
    for (const tr of [-1, 0, 1]) { const nd = (this.dir + tr + 4) % 4, h = nd * Math.PI / 2; if (!isWater(ix + Math.sin(h) * 22, iz + Math.cos(h) * 22)) ok.push(tr); }
    if (!ok.length) ok.push(2);
    const r = Math.random(); let want = r < 0.25 ? -1 : r < 0.5 ? 1 : 0;
    this.turn = ok.includes(want) ? want : ok[Math.floor(Math.random() * ok.length)];
  }
  const toInt = (this.next - along) * sgn;
  if (this.turn !== 0) {
    const nd = (this.dir + this.turn + 4) % 4, nl = this.turn === 2 ? along + sgn * 3 : Autopilot.lane(nd, this.next);
    if ((nl - along) * sgn < 6.5) { this.dir = nd; this.turn = 0; this.next = NaN; return this.step(c, dt, game); }
  }
  const lc = Autopilot.lane(this.dir, road), v = Math.hypot(c.vx, c.vz), look = 7 + v * 0.35;
  let tx, tz; if (this.dir % 2 === 0) { tx = lc; tz = c.z + sgn * look; } else { tz = lc; tx = c.x + sgn * look; }
  let err = Math.atan2(tx - c.x, tz - c.z) - c.h; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
  inp.steer = Math.max(-1, Math.min(1, err * 2.2));
  const vt = this.turn !== 0 && toInt < 45 ? 11 : Math.abs(err) > 0.4 ? 14 : this.cruise;
  inp.gas = v < vt; inp.brake = v > vt + 4;
  this.boostT -= dt; if (this.boostT < -12 && this.turn === 0 && toInt > 60 && Math.random() < 0.01) this.boostT = 2.5;
  inp.boost = this.boostT > 0 && this.turn === 0;
  if (v < 1.5) this.stuck += dt; else this.stuck = 0;
  if (this.stuck > 2.5) { this.stuck = 0; c.vx = c.vz = 0; if (this.dir % 2 === 0) c.x = lc; else c.z = lc; c.h = this.dir * Math.PI / 2; }
  this.view += dt;
  if (game && this.view > this.viewNext) { this.view = 0; this.viewNext = 9 + Math.random() * 8; const vs = [0, 1, 5, 2, 4, 0, 6, 3]; game.view = vs[Math.random() * vs.length | 0]; }
  return inp;
};
window.NeonRun = { Autopilot, HARBOR, isWater, islandOf, wrapD, Game, VIEWS, PAINTS, S, GP, RW, buildGameCity, buildMeadow, buildCarModel, stepCar, newCar, cameraFor, lookAt, perspective, mul, model };
})();
