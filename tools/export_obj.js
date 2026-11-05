#!/usr/bin/env node
/* Exports every Cybercity 3D model at ULTRA resolution as OBJ + MTL, one folder per model, each assembly split into
 * separate objects (o …) exactly as the game builds them: same geometry, same vertex colours (also written as v x y z r g b),
 * moving parts (rotors, propellers, gear crowns, rim lights, sails) as their own objects with their pivot in a comment.
 * Units: metres, +Y up, +Z = front of the model. Run: node tools/export_obj.js [outDir]  → also writes <outDir>.zip */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '..');
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['vehicles.js', 'xeno.js', 'pilot.js']) (0, eval)(fs.readFileSync(path.join(root, 'web', f), 'utf8'));
const KF = globalThis.KageFleet, KX = globalThis.KageXeno, KP = globalThis.KagePilot;
const OUT = path.resolve(process.argv[2] || path.join(root, 'models/cybercity3d_ultra'));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

const SLOT = ['base', 'vernice', 'accento', 'led', 'vetro', 'membrana', 'pelle', 'capelli'];
const MODE = ['', 'rotore_orario', 'rotore_antiorario', 'elica', 'vela', 'bandiera', 'disco_rotore', 'luce_lampeggiante'];
const q = (v, n) => Math.round(v * n) / n;
function writeObj(name, title, m, notes) {
  const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
  const P = m.pos, N = m.norm, C = m.col, A = m.anim, I = m.idx, parts = m.parts || [], tags = m.tags || [];
  // group triangles: part name (+ moving-part suffix with its pivot)
  const groups = new Map(), mats = new Map();
  const partOf = v => {
    let base = parts[v] || tags[v] || 'corpo';
    const code = A[v * 4], mode = code % 8;
    if (mode === 1 || mode === 2 || mode === 3 || mode === 6) base += '_' + MODE[mode] + '@' + q(A[v * 4 + 1], 100) + ',' + q(A[v * 4 + 2], 100) + ',' + q(A[v * 4 + 3], 100);
    else if (mode === 4 || mode === 5 || mode === 7) base += '_' + MODE[mode];
    return base;
  };
  const matOf = v => {
    const slot = Math.floor(A[v * 4] / 8), r = q(C[v * 4], 24), g = q(C[v * 4 + 1], 24), b = q(C[v * 4 + 2], 24), e = q(C[v * 4 + 3], 10);
    const key = SLOT[slot] + '_' + [r, g, b].map(x => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('') + (e > 0 ? '_e' + Math.round(e * 10) : '');
    if (!mats.has(key)) mats.set(key, { r, g, b, e, slot });
    return key;
  };
  for (let t = 0; t < I.length; t += 3) {
    const v = I[t], gname = partOf(v), mname = matOf(v);
    if (!groups.has(gname)) groups.set(gname, new Map());
    const gm = groups.get(gname); if (!gm.has(mname)) gm.set(mname, []); gm.get(mname).push(I[t], I[t + 1], I[t + 2]);
  }
  // OBJ: each object gets its own vertex block (re-indexed), so parts are fully separable
  const out = [`# ${title} — Cybercity 3D (KAGE), original design · ULTRA resolution\n# metres, +Y up, +Z front · vertex colours as in the game (v x y z r g b)\n${notes ? notes.map(n => '# ' + n + '\n').join('') : ''}mtllib ${name}.mtl\n`];
  let base = 1, nObj = 0, nTri = 0; const used = {};
  for (const [gname, gm] of groups) {
    const map = new Map(), vs = [];
    for (const L of gm.values()) for (const v of L) if (!map.has(v)) { map.set(v, base + vs.length); vs.push(v); }
    const [nm0, piv] = gname.split('@'), nm = nm0.replace(/[^\w\-]+/g, '_'); used[nm] = (used[nm] || 0) + 1;
    let s = `o ${nm}${used[nm] > 1 ? '_' + used[nm] : ''}${piv ? '\n# pivot / perno (a, b, c del gioco) = ' + piv : ''}\n`;
    for (const v of vs) s += `v ${P[v * 3].toFixed(5)} ${P[v * 3 + 1].toFixed(5)} ${P[v * 3 + 2].toFixed(5)} ${Math.min(1, C[v * 4]).toFixed(4)} ${Math.min(1, C[v * 4 + 1]).toFixed(4)} ${Math.min(1, C[v * 4 + 2]).toFixed(4)}\n`;
    for (const v of vs) s += `vn ${N[v * 3].toFixed(4)} ${N[v * 3 + 1].toFixed(4)} ${N[v * 3 + 2].toFixed(4)}\n`;
    for (const [mname, L] of gm) { s += `usemtl ${mname}\n`; for (let t = 0; t < L.length; t += 3) { const a = map.get(L[t]), b = map.get(L[t + 1]), c = map.get(L[t + 2]); s += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`; } nTri += L.length / 3; }
    out.push(s); base += vs.length; nObj++;
  }
  fs.writeFileSync(path.join(dir, name + '.obj'), out.join(''));
  let mtl = `# ${title} — materials (colour = game base colour; Ke = self-illumination of LEDs and screens)\n`;
  for (const [k, M] of mats) {
    mtl += `\nnewmtl ${k}\nKd ${M.r.toFixed(4)} ${M.g.toFixed(4)} ${M.b.toFixed(4)}\nKa 0 0 0\n`;
    if (M.e > 0) mtl += `Ke ${(M.r * M.e).toFixed(4)} ${(M.g * M.e).toFixed(4)} ${(M.b * M.e).toFixed(4)}\n`;
    const rough = M.slot === 1 ? 0.25 : M.slot === 4 ? 0.05 : M.slot === 6 ? 0.55 : M.slot === 7 ? 0.7 : 0.45, metal = M.slot === 1 || M.slot === 2 ? 0.6 : 0;
    mtl += `Ks 0.5 0.5 0.5\nNs ${Math.round((1 - rough) * 400)}\nPr ${rough}\nPm ${metal}\n${M.slot === 4 ? 'd 0.35\nTr 0.65\n' : 'd 1\n'}illum 2\n`;
  }
  fs.writeFileSync(path.join(dir, name + '.mtl'), mtl);
  console.log(name.padEnd(28), String(nObj).padStart(4), 'parti', String(nTri).padStart(7), 'triangoli', String(mats.size).padStart(4), 'materiali');
  return { name, title, parts: nObj, tris: nTri };
}

const U = 'ultra', list = [];
const add = (name, title, m, notes) => list.push(writeObj(name, title, m, notes));
// fleet
add('kage_volt_moto', 'KAGE VOLT · superbike elettrica', KF.buildMoto(Object.assign({}, KF.KINDS.moto.def, { lod: U })));
add('kage_strix_drone', 'KAGE STRIX · drone', KF.buildDrone(Object.assign({}, KF.KINDS.drone.def, { lod: U })));
add('kage_glide_hovercraft', 'KAGE GLIDE · hovercraft', KF.buildHover(Object.assign({}, KF.KINDS.hover.def, { lod: U })));
add('kage_riptide_barca', 'KAGE RIPTIDE · motoscafo', KF.buildBoat(Object.assign({}, KF.KINDS.boat.def, { lod: U })));
add('kage_abyss_sottomarino', 'KAGE ABYSS · sottomarino', KF.buildSub(Object.assign({}, KF.KINDS.sub.def, { lod: U })));
add('kage_leviathan_galeone', 'KAGE LEVIATHAN · cyber galeone', KF.buildGalleon(Object.assign({}, KF.KINDS.galleon.def, { lod: U })));
// xeno
add('kage_xeno_ufo_esterno', 'KAGE XENO · UFO (esterno)', KX.buildUfo(Object.assign({}, KX.UFO_DEF), U), ['the interior (kage_xeno_ufo_interno) fits inside at the same origin']);
add('kage_xeno_ufo_interno', 'KAGE XENO · UFO (interno esplorabile)', KX.buildUfoInterior(Object.assign({}, KX.UFO_DEF), U), ['deck floor at y = ' + KX.UFO_RIG.floor + ' m, same origin as the exterior']);
add('kage_xeno_raggio_traente', 'KAGE XENO · raggio traente', KX.buildBeam({}), ['hangs from the emitter: origin at the top, 30 m long (scale Y to the height)']);
add('kage_epoch_cabina_tempo', 'KAGE EPOCH · cabina del tempo Art Déco', KX.buildChrono(Object.assign({}, KX.CHRONO_DEF), U));
add('vortice_temporale', 'Vortice temporale (tunnel)', KX.buildVortex(U), ['tunnel along -Y, 600 m; the game turns it to face the flight']);
// characters (bind pose; parts = body regions used for skinning)
const ppl = [['pilota_il_mio_pilota', 'Il mio pilota', Object.assign({}, KP.MINE)], ['alieno_nordico', 'Alieno nordico', { species: 'nordico' }],
  ['alieno_grigio', 'Alieno grigio', { species: 'grigio' }], ['alieno_verde', 'Piccolo alieno verde', { species: 'verde' }], ['alieno_ombra', 'Alieno ombra (scuro)', { species: 'scuro' }]];
for (const [n, t, c] of ppl) { const m = KP.build(c, U); add(n, t, m, ['bind pose (standing); each body region is its own object (head, torso, arms, hands, legs, feet)']); }
// world props
add('faro_porto', 'Faro del porto', KF.buildLighthouse());
add('kage_garage', 'KAGE GARAGE', KF.buildGarage(), ['world coordinates of block (0,0)']);
add('kage_nexus_portale', 'KAGE NEXUS · portale', KF.buildNexus());
add('kage_nexus_console', 'KAGE NEXUS · console di composizione', KF.buildConsole());
add('eco_osservatore', 'ECO · osservatore', KF.buildWatcher());
add('eco_monolite', 'ECO · monolite', KF.buildMonolith());
for (const k of ['drone', 'boat', 'galleon']) add('porta_gara_' + k, 'Porta di gara (' + k + ')', KF.buildGate(k));

// the KAGE GT at ultra, with its PBR textures (same materials as the game's)
try {
  const CarHD = require(path.join(root, 'web/car_hd.js')), m = CarHD.build({ quality: 'ultra' }), dir = path.join(OUT, 'ampy_kage_gt_ultra');
  fs.mkdirSync(dir, { recursive: true });
  const src = path.join(root, 'models/ampy_kage_gt_hd'), TILE = { carbon: 60 / 8, grille: 60 / 10, carpet: 4 };
  fs.copyFileSync(path.join(src, 'ampy_kage_gt_hd.mtl'), path.join(dir, 'ampy_kage_gt_ultra.mtl'));
  fs.cpSync(path.join(src, 'textures'), path.join(dir, 'textures'), { recursive: true });
  const L = ['# AMPY KAGE GT — ULTRA model (Cybercity 3D / NEON RUN), original design\n# metres, +Y up, +Z front. Parts are separate objects with their pivots.\nmtllib ampy_kage_gt_ultra.mtl\n'];
  let vb = 1, tris = 0;
  for (const p of m.parts) {
    const vc = p.pos.length / 3; let s = `o ${p.name}\n# pivot ${p.pivot.map(x => x.toFixed(4)).join(' ')}\n`;
    for (let i = 0; i < vc; i++) s += `v ${p.pos[i * 3].toFixed(5)} ${p.pos[i * 3 + 1].toFixed(5)} ${p.pos[i * 3 + 2].toFixed(5)}\n`;
    for (let i = 0; i < vc; i++) { const k = TILE[CarHD.MAT_NAMES[p.mat[i]]] || 1; s += `vt ${(p.uv[i * 2] * k).toFixed(5)} ${(p.uv[i * 2 + 1] * k).toFixed(5)}\n`; }
    for (let i = 0; i < vc; i++) s += `vn ${p.norm[i * 3].toFixed(4)} ${p.norm[i * 3 + 1].toFixed(4)} ${p.norm[i * 3 + 2].toFixed(4)}\n`;
    const byMat = {}; for (const li of [p.idx, p.gidx]) for (let t = 0; t < li.length; t += 3) (byMat[p.mat[li[t]]] = byMat[p.mat[li[t]]] || []).push(li[t], li[t + 1], li[t + 2]);
    for (const mt in byMat) { s += `usemtl ${CarHD.MAT_NAMES[mt]}\n`; const F = byMat[mt]; for (let t = 0; t < F.length; t += 3) { const a = F[t] + vb, b = F[t + 1] + vb, c = F[t + 2] + vb; s += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`; } tris += F.length / 3; }
    L.push(s); vb += vc;
  }
  fs.writeFileSync(path.join(dir, 'ampy_kage_gt_ultra.obj'), L.join(''));
  list.unshift({ name: 'ampy_kage_gt_ultra', title: 'AMPY KAGE GT · auto (con texture PBR)', parts: m.parts.length, tris });
  console.log('ampy_kage_gt_ultra'.padEnd(28), String(m.parts.length).padStart(4), 'parti', String(tris).padStart(7), 'triangoli');
} catch (e) { console.log('KAGE GT skipped:', e.message); }

fs.writeFileSync(path.join(OUT, 'LEGGIMI.txt'), `CYBERCITY 3D · MODELLI KAGE · RISOLUZIONE ULTRA
================================================
Ogni cartella = un modello: file .obj + .mtl (stessa cartella; l'auto ha anche le texture PBR in textures/).
Ogni assieme è diviso in parti separate (oggetti "o" nell'OBJ), con gli stessi nomi usati dal gioco.
Le parti mobili (rotori, eliche, corone a ingranaggi, luci del bordo dell'UFO, vele) sono oggetti a sé: il commento "# pivot" dà il centro di rotazione.
Unità: metri · asse Y in alto · asse +Z = davanti. I colori sono quelli del gioco (materiali + colori per vertice "v x y z r g b").
I personaggi sono in posa base (in piedi); ogni regione del corpo è un oggetto separato.
Import: Blender (File › Import › Wavefront OBJ, attiva "Split by Object"), Unity, Unreal, 3ds Max, Maya, Cinema 4D.

${list.map(x => (x.name + '/').padEnd(30) + (x.title + '').padEnd(48) + String(x.parts).padStart(4) + ' parti  ' + String(x.tris).padStart(8) + ' triangoli').join('\n')}
`);
const zip = OUT + '.zip'; fs.rmSync(zip, { force: true });
cp.execSync(`cd "${path.dirname(OUT)}" && zip -qr "${path.basename(zip)}" "${path.basename(OUT)}"`);
console.log('zip', zip, (fs.statSync(zip).size / 1e6).toFixed(1), 'MB');
