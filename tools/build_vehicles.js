#!/usr/bin/env node
/* Exports the low-detail KAGE fleet meshes for the Android screensaver / NEON RUN traffic:
 *  app/src/main/assets/fleet.akv (gzip): 'AKV1', count, then per mesh: name, nverts, nidx, pos, norm, col, anim (float32), idx (uint16)
 * Run: node tools/build_vehicles.js */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'web/vehicles.js'));
const F = globalThis.KageFleet;
const meshes = {
  drone: F.buildDrone({ lod: 'lo', paint: 'nero', accent: 'argento' }),
  boat: F.buildBoat({ lod: 'lo' }),
  galleon: F.buildGalleon({ lod: 'lo' }),
  lighthouse: F.buildLighthouse()
};
const chunks = [];
const i32 = v => { const b = Buffer.alloc(4); b.writeInt32LE(v); chunks.push(b); };
const f32a = a => { const b = Buffer.alloc(a.length * 4); for (let i = 0; i < a.length; i++) b.writeFloatLE(a[i], i * 4); chunks.push(b); };
const u16a = a => { const b = Buffer.alloc(a.length * 2 + (a.length % 2) * 2); for (let i = 0; i < a.length; i++) b.writeUInt16LE(a[i], i * 2); chunks.push(b); };
chunks.push(Buffer.from('AKV1'));
i32(Object.keys(meshes).length);
for (const [name, m] of Object.entries(meshes)) {
  const nb = Buffer.from(name, 'utf8'); i32(nb.length); chunks.push(nb); const pad = (4 - nb.length % 4) % 4; if (pad) chunks.push(Buffer.alloc(pad));
  i32(m.verts); i32(m.idx.length);
  f32a(m.pos); f32a(m.norm); f32a(m.col); f32a(m.anim); u16a(m.idx);
  console.log(name, m.verts, 'verts', m.idx.length / 3, 'tris');
}
const gz = zlib.gzipSync(Buffer.concat(chunks), { level: 9 });
fs.writeFileSync(path.join(root, 'app/src/main/assets/fleet.akv'), gz);
console.log('fleet.akv', gz.length, 'bytes');
