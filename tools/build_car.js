#!/usr/bin/env node
/* Builds the HD car once:
 *  - app/src/main/assets/car_hd.bin.gz  (Android: parts, pivots, interleaved-free float arrays + uint16 indices)
 *  - models/ampy_kage_gt_hd/ampy_kage_gt_hd.obj + .mtl  (textures are made by tools/car_textures.py)
 * Run: node tools/build_car.js */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.resolve(__dirname, '..');
const CarHD = require(path.join(root, 'web/car_hd.js'));
const m = CarHD.build({ quality: 'high' });

/* ---------- binary asset ---------- */
const chunks = [];
const i32 = v => { const b = Buffer.alloc(4); b.writeInt32LE(v); chunks.push(b); };
const f32a = a => { const b = Buffer.alloc(a.length * 4); for (let i = 0; i < a.length; i++) b.writeFloatLE(a[i], i * 4); chunks.push(b); };
const u16a = a => { const b = Buffer.alloc(a.length * 2 + (a.length % 2) * 2); for (let i = 0; i < a.length; i++) b.writeUInt16LE(a[i], i * 2); chunks.push(b); };
chunks.push(Buffer.from('AKG1'));
i32(m.parts.length);
for (const p of m.parts) {
  const nb = Buffer.from(p.name, 'utf8'); i32(nb.length); chunks.push(nb); const pad = (4 - nb.length % 4) % 4; if (pad) chunks.push(Buffer.alloc(pad));
  f32a(p.pivot); i32(p.pos.length / 3); i32(p.idx.length); i32(p.gidx.length);
  f32a(p.pos); f32a(p.norm); f32a(p.uv); f32a(p.mat); u16a(p.idx); u16a(p.gidx);
}
const bin = Buffer.concat(chunks);
const gz = zlib.gzipSync(bin, { level: 9 });
fs.writeFileSync(path.join(root, 'app/src/main/assets/car_hd.bin.gz'), gz);
console.log('car_hd.bin', bin.length, 'bytes →', gz.length, 'gz ·', JSON.stringify(m.stats));

/* ---------- OBJ / MTL ---------- */
// texture tiling per material: uv multiplier so that one texture tile = TILE periods of the shader pattern
const TILE = { carbon: 60 / 8, leather: 1, tyre: 1, brake_disc: 1, grille: 60 / 10, screen: 1, carpet: 4 };
const out = path.join(root, 'models/ampy_kage_gt_hd');
fs.mkdirSync(out, { recursive: true });
let obj = '# AMPY KAGE GT — HD model (Cybercity 3D / NEON RUN), original design\n# metres, +Y up, +Z front. Parts are separate objects with their pivots noted below.\nmtllib ampy_kage_gt_hd.mtl\n';
let vBase = 1;
const lines = [];
for (const p of m.parts) {
  lines.push(`o ${p.name}\n# pivot ${p.pivot.map(x => x.toFixed(4)).join(' ')}\n`);
  const vc = p.pos.length / 3;
  let s = '';
  for (let i = 0; i < vc; i++) s += `v ${p.pos[i * 3].toFixed(5)} ${p.pos[i * 3 + 1].toFixed(5)} ${p.pos[i * 3 + 2].toFixed(5)}\n`;
  for (let i = 0; i < vc; i++) {
    const name = CarHD.MAT_NAMES[p.mat[i]], k = TILE[name] || 1;
    s += `vt ${(p.uv[i * 2] * k).toFixed(5)} ${(p.uv[i * 2 + 1] * k).toFixed(5)}\n`;
  }
  for (let i = 0; i < vc; i++) s += `vn ${p.norm[i * 3].toFixed(4)} ${p.norm[i * 3 + 1].toFixed(4)} ${p.norm[i * 3 + 2].toFixed(4)}\n`;
  lines.push(s);
  // group faces by material
  const byMat = {};
  for (const list of [p.idx, p.gidx]) for (let t = 0; t < list.length; t += 3) {
    const mat = p.mat[list[t]];
    (byMat[mat] = byMat[mat] || []).push(list[t], list[t + 1], list[t + 2]);
  }
  for (const mat in byMat) {
    let f = `usemtl ${CarHD.MAT_NAMES[mat]}\n`;
    const L = byMat[mat];
    for (let t = 0; t < L.length; t += 3) { const a = L[t] + vBase, b = L[t + 1] + vBase, c = L[t + 2] + vBase; f += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`; }
    lines.push(f);
  }
  vBase += vc;
}
fs.writeFileSync(path.join(out, 'ampy_kage_gt_hd.obj'), obj + lines.join(''));
fs.writeFileSync(path.join(out, 'materials.json'), JSON.stringify(CarHD.MAT_NAMES));
console.log('OBJ written', path.join(out, 'ampy_kage_gt_hd.obj'));
