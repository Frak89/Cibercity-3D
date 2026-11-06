/* AmpyOBJ in-game · assets importer / exporter for the AmpybiOS tablet (a REAL function: files go to / come from the phone).
 * EXPORT: any model of the game (vehicles with your saved configuration, ships, decks, aliens, your pilot, gear, monoliths,
 *   planets…) at ULTRA, split into its parts exactly as the game builds them → model.obj + model.mtl + textures/palette.png
 *   (the game's vertex colours baked into a palette texture, so every viewer shows the colours) → one .zip, saved to
 *   Download/Cybercity on the phone (Android app) or downloaded (browser).
 * IMPORT: .zip, or .obj + .mtl + textures picked together from the phone. Parser: v (+ vertex colours), vt, vn, f (polygons,
 *   negative indices), o / g, usemtl, mtllib; MTL: Kd, Ke, d / Tr, map_Kd. Preview in the tablet (orbit, explode, wireframe,
 *   points, parts on/off, like AmpyOBJ Viewer), then place it in the world in front of the pilot, move / turn / scale it.
 *   Imported assets are kept on the phone (IndexedDB) and drawn by the game with their textures. */
(function () {
'use strict';
const NR = window.NeonRun, KF = window.KageFleet; if (!NR || !KF) return;
const { S, wrapD } = NR, PI = Math.PI;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ===================== ZIP (write: stored; read: stored + deflate) ===================== */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const enc8 = s => new TextEncoder().encode(s);
function zip(files) {   // files: [{ name, data: Uint8Array }]
  const parts = [], cen = []; let off = 0; const D = new Date(), dt = ((D.getFullYear() - 1980) << 9) | ((D.getMonth() + 1) << 5) | D.getDate(), tm = (D.getHours() << 11) | (D.getMinutes() << 5) | (D.getSeconds() >> 1);
  for (const f of files) { const nm = enc8(f.name), d = f.data, c = crc32(d), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, c, true); ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    cen.push(new Uint8Array(ch.buffer), nm); off += 30 + nm.length + d.length; }
  const cs = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
async function unzip(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf); let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('zip non valido');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
  for (let k = 0; k < n; k++) {
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (name.endsWith('/')) continue;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u.subarray(ds, ds + csz);
    let data;
    if (meth === 0) data = raw.slice();
    else if (meth === 8) { if (typeof DecompressionStream === 'undefined') throw new Error('zip compresso non supportato qui'); data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }
    else continue;
    out.push({ name, data });
  }
  return out;
}

/* ===================== EXPORT: game mesh → OBJ + MTL + palette texture ===================== */
const SLOT = ['base', 'vernice', 'accento', 'led', 'vetro', 'membrana', 'pelle', 'capelli'];
const MODE = ['', 'rotore_orario', 'rotore_antiorario', 'elica', 'vela', 'bandiera', 'disco_rotore', 'luce_lampeggiante'];
const qz = (v, n) => Math.round(v * n) / n;
async function exportMesh(m, name, title) {
  const P = m.pos, N = m.norm, C = m.col, A = m.anim, I = m.idx, parts = m.parts || [];
  const groups = new Map(), mats = new Map(), vmat = new Int32Array(P.length / 3).fill(-1), mlist = [];
  const partOf = v => { let b = parts[v] || 'corpo'; const code = A ? A[v * 4] : 0, mode = code % 8;
    if (mode === 1 || mode === 2 || mode === 3 || mode === 6) b += '_' + MODE[mode] + '@' + qz(A[v * 4 + 1], 100) + ',' + qz(A[v * 4 + 2], 100) + ',' + qz(A[v * 4 + 3], 100);
    else if (mode === 4 || mode === 5 || mode === 7) b += '_' + MODE[mode];
    else if (mode === 0 && A && A[v * 4 + 3] > 9.5 && m.hinges && m.hinges[Math.round(A[v * 4 + 3] - 10)]) { const h = m.hinges[Math.round(A[v * 4 + 3] - 10)]; b += '_' + h.name.toLowerCase() + '@' + (h.pivot || []).map(x => qz(x, 100)).join(','); }
    return b; };
  const matOf = v => { if (vmat[v] >= 0) return vmat[v];
    const slot = A ? Math.floor(A[v * 4] / 8) : 0, r = qz(C[v * 4], 24), g = qz(C[v * 4 + 1], 24), b = qz(C[v * 4 + 2], 24), e = qz(C[v * 4 + 3], 10);
    const key = (SLOT[slot] || 'base') + '_' + [r, g, b].map(x => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('') + (e > 0 ? '_e' + Math.round(e * 10) : '');
    if (!mats.has(key)) { mats.set(key, mlist.length); mlist.push({ key, r, g, b, e, slot }); }
    return (vmat[v] = mats.get(key)); };
  for (let t = 0; t < I.length; t += 3) { const v = I[t], gname = partOf(v), mi = matOf(v); matOf(I[t + 1]); matOf(I[t + 2]);
    if (!groups.has(gname)) groups.set(gname, new Map()); const gm = groups.get(gname); if (!gm.has(mi)) gm.set(mi, []); gm.get(mi).push(I[t], I[t + 1], I[t + 2]); }
  // palette texture: one 4×4 cell per material
  const nm = mlist.length, cols = Math.ceil(Math.sqrt(nm)), cell = 4, W = Math.max(4, cols * cell), H = Math.max(4, Math.ceil(nm / cols) * cell);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c2 = cv.getContext('2d');
  const uv = mlist.map((M, i) => { const x = (i % cols) * cell, y = Math.floor(i / cols) * cell; c2.fillStyle = 'rgb(' + [M.r, M.g, M.b].map(k => Math.round(Math.min(1, Math.max(0, k)) * 255)).join(',') + ')'; c2.fillRect(x, y, cell, cell); return [(x + cell / 2) / W, 1 - (y + cell / 2) / H]; });
  const png = new Uint8Array(await (await new Promise(ok => cv.toBlob(ok, 'image/png'))).arrayBuffer());
  const out = ['# ' + title + ' — Cybercity 3D (KAGE), original design · exported in-game with AmpyOBJ (AmpybiOS)\n# metres, +Y up, +Z front · vertex colours (v x y z r g b) + palette texture · each part is its own object\nmtllib ' + name + '.mtl\n'];
  let base = 1, nObj = 0, nTri = 0; const used = {};
  for (const [gname, gm] of groups) {
    const map = new Map(), vs = [];
    for (const L of gm.values()) for (const v of L) if (!map.has(v)) { map.set(v, base + vs.length); vs.push(v); }
    const [nm0, piv] = gname.split('@'), on = nm0.replace(/[^\w\-]+/g, '_'); used[on] = (used[on] || 0) + 1;
    let s = 'o ' + on + (used[on] > 1 ? '_' + used[on] : '') + (piv ? '\n# perno / pivot = ' + piv : '') + '\n';
    for (const v of vs) s += 'v ' + P[v * 3].toFixed(5) + ' ' + P[v * 3 + 1].toFixed(5) + ' ' + P[v * 3 + 2].toFixed(5) + ' ' + Math.min(1, C[v * 4]).toFixed(4) + ' ' + Math.min(1, C[v * 4 + 1]).toFixed(4) + ' ' + Math.min(1, C[v * 4 + 2]).toFixed(4) + '\n';
    for (const v of vs) { const t = uv[vmat[v]]; s += 'vt ' + t[0].toFixed(5) + ' ' + t[1].toFixed(5) + '\n'; }
    for (const v of vs) s += 'vn ' + N[v * 3].toFixed(4) + ' ' + N[v * 3 + 1].toFixed(4) + ' ' + N[v * 3 + 2].toFixed(4) + '\n';
    for (const [mi, L] of gm) { s += 'usemtl ' + mlist[mi].key + '\n'; for (let t = 0; t < L.length; t += 3) { const a = map.get(L[t]), b = map.get(L[t + 1]), c = map.get(L[t + 2]); s += 'f ' + a + '/' + a + '/' + a + ' ' + b + '/' + b + '/' + b + ' ' + c + '/' + c + '/' + c + '\n'; } nTri += L.length / 3; }
    out.push(s); base += vs.length; nObj++;
  }
  let mtl = '# ' + title + ' — materials (Kd = game colour, map_Kd = palette texture, Ke = LEDs and screens)\n';
  for (const M of mlist) { const rough = M.slot === 1 ? 0.25 : M.slot === 4 ? 0.05 : M.slot === 6 ? 0.55 : M.slot === 7 ? 0.7 : 0.45, metal = M.slot === 1 || M.slot === 2 ? 0.6 : 0;
    mtl += '\nnewmtl ' + M.key + '\nKd ' + M.r.toFixed(4) + ' ' + M.g.toFixed(4) + ' ' + M.b.toFixed(4) + '\nKa 0 0 0\n' + (M.e > 0 ? 'Ke ' + (M.r * M.e).toFixed(4) + ' ' + (M.g * M.e).toFixed(4) + ' ' + (M.b * M.e).toFixed(4) + '\n' : '')
      + 'Ks 0.5 0.5 0.5\nNs ' + Math.round((1 - rough) * 400) + '\nPr ' + rough + '\nPm ' + metal + '\n' + (M.slot === 4 ? 'd 0.35\nTr 0.65\n' : 'd 1\n') + 'illum 2\nmap_Kd textures/' + name + '_palette.png\n'; }
  return { files: [{ name: name + '/' + name + '.obj', data: enc8(out.join('')) }, { name: name + '/' + name + '.mtl', data: enc8(mtl) }, { name: name + '/textures/' + name + '_palette.png', data: png }], parts: nObj, tris: nTri, mats: nm };
}
/** what can be exported: [id, title, () => mesh] — vehicles use your saved configuration */
function catalogue() {
  const L = [], U = 'ultra', K = KF.KINDS;
  for (const k of Object.keys(K)) { const D = K[k]; if (D.hidden || k === 'alien') continue;
    const views = D.opts && D.opts.view ? D.opts.view : [null];
    for (const v of views) L.push(['kage_' + k + (v && v !== 'esterno' ? '_' + v : ''), (D.title || k.toUpperCase()) + (v ? ' · ' + ((D.names && D.names.view && D.names.view[v]) || v) : ''), () => D.build(Object.assign({}, KF.loadCfg ? KF.loadCfg(k) : D.def, v ? { view: v } : {}, { lod: U }), U)]); }
  const KP = window.KagePilot; if (KP) { L.push(['pilota_il_mio_pilota', 'Il mio pilota', () => KP.build(Object.assign({}, KP.MINE), U)]);
    for (const sp of ['nordico', 'grigio', 'verde', 'scuro']) L.push(['alieno_' + sp, 'Alieno ' + sp, () => KP.build({ species: sp }, U)]); }
  const G = window.KageGearModels; if (G) { L.push(['kage_jet_jetpack', 'KAGE JET · jetpack', G.buildJetpack]); L.push(['kage_board_skateboard', 'KAGE BOARD · skateboard', G.buildBoard]); }
  const KS = window.KageStar; if (KS) { L.push(['kage_odyssey_badge', 'Badge KAGE ODYSSEY', () => KS.buildBadge()]); for (const k of KS.DEST_ORDER) L.push(['pianeta_' + k, 'Pianeta · ' + KS.DEST[k].name, () => KS.buildPlanet(k, U)]); }
  const KG = window.KageGlyph; if (KG) for (const m of KG.MONO) L.push(['monolite_' + m[0], m[1], () => KG.buildMonolith(m[2])]);
  L.push(['kage_nexus_portale', 'KAGE NEXUS · portale', () => KF.buildNexus()], ['kage_garage', 'KAGE GARAGE', () => KF.buildGarage()], ['faro_porto', 'Faro del porto', () => KF.buildLighthouse()]);
  return L;
}

/* ===================== IMPORT: OBJ + MTL + textures → asset ===================== */
function parseMtl(text) {
  const M = {}; let cur = null;
  for (const raw of text.split(/\r?\n/)) { const l = raw.trim(); if (!l || l[0] === '#') continue; const [k, ...r] = l.split(/\s+/), a = r.map(Number);
    if (k === 'newmtl') { cur = M[r.join(' ')] = { kd: [0.8, 0.8, 0.8], ke: [0, 0, 0], d: 1, map: null }; }
    else if (!cur) continue; else if (k === 'Kd') cur.kd = a.slice(0, 3); else if (k === 'Ke') cur.ke = a.slice(0, 3); else if (k === 'd') cur.d = a[0]; else if (k === 'Tr') cur.d = 1 - a[0];
    else if (k === 'map_Kd') cur.map = r.filter(x => !x.startsWith('-') && isNaN(+x)).pop() || r.pop(); }
  return M;
}
/** OBJ → { objects: [{ name, groups: [{ mat, pos, nrm, uv, col }] }], mtllib, bounds } (triangulated, flat arrays) */
function parseObj(text) {
  const V = [], VC = [], VT = [], VN = []; const objects = []; let obj = null, grp = null, mat = 'default', mtllib = [];
  const newObj = n => { obj = { name: n || 'parte_' + (objects.length + 1), groups: {} }; objects.push(obj); grp = null; };
  const g = () => { if (!obj) newObj('modello'); if (!grp || grp.mat !== mat) { grp = obj.groups[mat] = obj.groups[mat] || { mat, pos: [], nrm: [], uv: [], col: [] }; } return grp; };
  const lines = text.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) { const l = lines[li].trim(); if (!l || l[0] === '#') continue; const sp = l.indexOf(' '), k = sp < 0 ? l : l.slice(0, sp), rest = sp < 0 ? '' : l.slice(sp + 1).trim();
    if (k === 'v') { const a = rest.split(/\s+/).map(Number); V.push(a[0], a[1], a[2]); VC.push(a.length >= 6 ? a[3] : -1, a[4] || 0, a[5] || 0); }
    else if (k === 'vt') { const a = rest.split(/\s+/).map(Number); VT.push(a[0], a[1] || 0); }
    else if (k === 'vn') { const a = rest.split(/\s+/).map(Number); VN.push(a[0], a[1], a[2]); }
    else if (k === 'o' || k === 'g') { if (k === 'g' && obj && !Object.keys(obj.groups).length) obj.name = rest || obj.name; else newObj(rest); }
    else if (k === 'usemtl') { mat = rest; grp = null; }
    else if (k === 'mtllib') mtllib.push(rest);
    else if (k === 'f') { const G = g(), vs = rest.split(/\s+/).map(t => { const p = t.split('/'); const r = (s, n) => { if (!s) return -1; const i = parseInt(s, 10); return i < 0 ? n + i : i - 1; }; return [r(p[0], V.length / 3), r(p[1], VT.length / 2), r(p[2], VN.length / 3)]; });
      for (let i = 1; i + 1 < vs.length; i++) { const tri = [vs[0], vs[i], vs[i + 1]];
        let fn = null; if (tri.some(q => q[2] < 0)) { const a = tri[0][0] * 3, b = tri[1][0] * 3, c = tri[2][0] * 3, ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
          fn = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]; const L = Math.hypot(...fn) || 1; fn = fn.map(x => x / L); }
        for (const [vi, ti, ni] of tri) { G.pos.push(V[vi * 3], V[vi * 3 + 1], V[vi * 3 + 2]); G.col.push(VC[vi * 3], VC[vi * 3 + 1], VC[vi * 3 + 2]);
          if (ni >= 0) G.nrm.push(VN[ni * 3], VN[ni * 3 + 1], VN[ni * 3 + 2]); else G.nrm.push(...fn);
          if (ti >= 0) G.uv.push(VT[ti * 2], VT[ti * 2 + 1]); else G.uv.push(0, 0); } } } }
  const out = objects.map(o => ({ name: o.name, groups: Object.values(o.groups).filter(x => x.pos.length) })).filter(o => o.groups.length);
  let b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const o of out) { let c = [0, 0, 0], n = 0; for (const G of o.groups) for (let i = 0; i < G.pos.length; i += 3) { for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], G.pos[i + k]); b[k + 3] = Math.max(b[k + 3], G.pos[i + k]); c[k] += G.pos[i + k]; } n++; } o.c = c.map(x => x / Math.max(1, n)); }
  return { objects: out, mtllib, bounds: b };
}
const base = p => p.replace(/\\/g, '/').split('/').pop().toLowerCase();

/* ===================== textured renderer (one per GL context) ===================== */
const VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec2 aT;attribute vec3 aC;uniform mat4 uVP;uniform mat4 uM;uniform vec3 uOff;varying vec3 vN;varying vec2 vT;varying vec3 vC;varying vec3 vW;'
  + 'void main(){vec4 w=uM*vec4(aP+uOff,1.0);vW=w.xyz;vN=mat3(uM)*aN;vT=aT;vC=aC;gl_Position=uVP*w;}';
const FS = 'precision mediump float;uniform sampler2D uTex;uniform float uHasTex;uniform vec3 uKd;uniform vec3 uKe;uniform float uD;uniform vec3 uSun;uniform vec3 uSunC;uniform vec3 uAmb;uniform float uWire;uniform vec3 uWireC;'
  + 'varying vec3 vN;varying vec2 vT;varying vec3 vC;varying vec3 vW;void main(){if(uWire>0.5){gl_FragColor=vec4(uWireC,1.0);return;}vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;'
  + 'vec3 base=uHasTex>0.5?texture2D(uTex,vT).rgb:(vC.r>=0.0?vC:uKd);float l=max(dot(n,normalize(uSun)),0.0);vec3 c=base*(uAmb+uSunC*l)+uKe;gl_FragColor=vec4(c,uD);}';
function Renderer(gl) {
  this.gl = gl; const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const p = this.p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
  this.a = {}; for (const n of ['aP', 'aN', 'aT', 'aC']) this.a[n] = gl.getAttribLocation(p, n);
  this.u = {}; for (const n of ['uVP', 'uM', 'uOff', 'uTex', 'uHasTex', 'uKd', 'uKe', 'uD', 'uSun', 'uSunC', 'uAmb', 'uWire', 'uWireC']) this.u[n] = gl.getUniformLocation(p, n);
  this.cache = new Map();
}
/** GPU buffers for an asset (cached by id) */
Renderer.prototype.upload = function (A) {
  if (this.cache.has(A.id)) return this.cache.get(A.id); const gl = this.gl, R = { objects: [] };
  const tex = {}; for (const [k, img] of Object.entries(A.images || {})) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, pot ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, img.width <= 64 ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, pot ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, pot ? gl.REPEAT : gl.CLAMP_TO_EDGE); if (pot) gl.generateMipmap(gl.TEXTURE_2D); tex[k] = t; }
  for (const o of A.model.objects) { const RO = { name: o.name, c: o.c, groups: [] };
    for (const G of o.groups) { const n = G.pos.length / 3, d = new Float32Array(n * 11);
      for (let i = 0; i < n; i++) { d.set([G.pos[i * 3], G.pos[i * 3 + 1], G.pos[i * 3 + 2], G.nrm[i * 3], G.nrm[i * 3 + 1], G.nrm[i * 3 + 2], G.uv[i * 2], G.uv[i * 2 + 1], G.col[i * 3], G.col[i * 3 + 1], G.col[i * 3 + 2]], i * 11); }
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
      const M = (A.mtl || {})[G.mat] || { kd: [0.75, 0.77, 0.8], ke: [0, 0, 0], d: 1, map: null }; const tk = M.map ? base(M.map) : null;
      RO.groups.push({ b, n, M, tex: tk && tex[tk] ? tex[tk] : null, wire: null, pos: G.pos }); }
    R.objects.push(RO); }
  this.cache.set(A.id, R); return R;
};
Renderer.prototype.drop = function (id) { const R = this.cache.get(id); if (!R) return; for (const o of R.objects) for (const g of o.groups) { this.gl.deleteBuffer(g.b); if (g.wire) this.gl.deleteBuffer(g.wire.b); } this.cache.delete(id); };
/** opt: { VP, M, sun, sunC, amb, explode, hide:Set, solid, wire, points, center } */
Renderer.prototype.draw = function (A, opt) {
  const gl = this.gl, R = this.upload(A), u = this.u, a = this.a; gl.useProgram(this.p);
  gl.uniformMatrix4fv(u.uVP, false, opt.VP); gl.uniformMatrix4fv(u.uM, false, opt.M); gl.uniform3fv(u.uSun, opt.sun || [0.4, 0.8, 0.5]); gl.uniform3fv(u.uSunC, opt.sunC || [0.95, 0.95, 0.9]); gl.uniform3fv(u.uAmb, opt.amb || [0.32, 0.34, 0.4]); gl.uniform1i(u.uTex, 0);
  for (const k of ['aN', 'aT', 'aC']) if (a[k] >= 0) gl.enableVertexAttribArray(a[k]); gl.enableVertexAttribArray(a.aP);
  const ctr = A.model.center || [0, 0, 0], ex = opt.explode || 0, pass = (tr) => {
    R.objects.forEach((o, oi) => { if (opt.hide && opt.hide.has(oi)) return; const dx = o.c[0] - ctr[0], dy = o.c[1] - ctr[1], dz = o.c[2] - ctr[2], L = Math.hypot(dx, dy, dz) || 1, k = ex * (A.model.radius || 1) * 0.35;
      gl.uniform3f(u.uOff, dx / L * k, dy / L * k, dz / L * k);
      for (const G of o.groups) { const tp = G.M.d < 0.99; if (tp !== tr) continue;
        if (opt.solid !== false) { gl.bindBuffer(gl.ARRAY_BUFFER, G.b); this.attrs();
          gl.uniform1f(u.uWire, 0); gl.uniform3fv(u.uKd, G.M.kd); gl.uniform3fv(u.uKe, G.M.ke || [0, 0, 0]); gl.uniform1f(u.uD, G.M.d); gl.uniform1f(u.uHasTex, G.tex && opt.tex !== false ? 1 : 0);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.drawArrays(gl.TRIANGLES, 0, G.n); }
        if (opt.wire || opt.points) { gl.uniform1f(u.uWire, 1); gl.uniform3fv(u.uWireC, opt.wire ? [0.51, 0.92, 0.98] : [0.55, 0.92, 1]);
          if (opt.points) { gl.bindBuffer(gl.ARRAY_BUFFER, G.b); this.attrs(); gl.drawArrays(gl.POINTS, 0, G.n); }
          if (opt.wire) { if (!G.wire) { const n = G.n, d = new Float32Array(n * 2 * 11), P = G.pos; let w = 0; for (let t = 0; t < n; t += 3) for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) for (const v of [t + i, t + j]) { d.set([P[v * 3], P[v * 3 + 1], P[v * 3 + 2], 0, 1, 0, 0, 0, -1, 0, 0], w); w += 11; }
              const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); G.wire = { b, n: n * 2 }; }
            gl.bindBuffer(gl.ARRAY_BUFFER, G.wire.b); this.attrs(); gl.drawArrays(gl.LINES, 0, G.wire.n); } } } }); };
  gl.disable(gl.BLEND); gl.depthMask(true); pass(false);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); pass(true); gl.depthMask(true); gl.disable(gl.BLEND);
  for (const k of ['aN', 'aT', 'aC']) if (a[k] >= 0) gl.disableVertexAttribArray(a[k]);
};
Renderer.prototype.attrs = function () { const gl = this.gl, a = this.a, st = 44; gl.vertexAttribPointer(a.aP, 3, gl.FLOAT, false, st, 0); if (a.aN >= 0) gl.vertexAttribPointer(a.aN, 3, gl.FLOAT, false, st, 12); if (a.aT >= 0) gl.vertexAttribPointer(a.aT, 2, gl.FLOAT, false, st, 24); if (a.aC >= 0) gl.vertexAttribPointer(a.aC, 3, gl.FLOAT, false, st, 32); };

/* ===================== storage of imported assets (IndexedDB) ===================== */
const DB = { db: null,
  open() { if (this.db) return Promise.resolve(this.db); return new Promise((ok, ko) => { const r = indexedDB.open('ampyobj', 1); r.onupgradeneeded = () => r.result.createObjectStore('assets', { keyPath: 'id' }); r.onsuccess = () => { this.db = r.result; ok(this.db); }; r.onerror = () => ko(r.error); }); },
  put(a) { return this.open().then(db => new Promise(ok => { const t = db.transaction('assets', 'readwrite'); t.objectStore('assets').put(a); t.oncomplete = ok; })); },
  all() { return this.open().then(db => new Promise(ok => { const q = db.transaction('assets').objectStore('assets').getAll(); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]); })).catch(() => []); },
  del(id) { return this.open().then(db => new Promise(ok => { const t = db.transaction('assets', 'readwrite'); t.objectStore('assets').delete(id); t.oncomplete = ok; })); } };

/** files: [{ name, data: Uint8Array }] (zip already expanded) → stored record { id, name, obj (text), mtl (text), tex: { basename: Blob } } */
async function recordFrom(files) {
  const objs = files.filter(f => /\.obj$/i.test(f.name)); if (!objs.length) throw new Error('nessun file .obj');
  const dec = new TextDecoder(), recs = [];
  for (const of of objs) { const text = dec.decode(of.data), lib = [...text.matchAll(/^\s*mtllib\s+(.+)$/gmi)].map(m => base(m[1].trim()));
    let mf = files.find(f => /\.mtl$/i.test(f.name) && lib.includes(base(f.name))) || files.find(f => base(f.name) === base(of.name).replace(/\.obj$/, '.mtl')) || (files.filter(f => /\.mtl$/i.test(f.name)).length === 1 ? files.find(f => /\.mtl$/i.test(f.name)) : null);
    const mtl = mf ? dec.decode(mf.data) : '', tex = {};
    for (const f of files) if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)) tex[base(f.name)] = new Blob([f.data], { type: /\.png$/i.test(f.name) ? 'image/png' : /\.webp$/i.test(f.name) ? 'image/webp' : 'image/jpeg' });
    recs.push({ id: Date.now() + recs.length, name: base(of.name).replace(/\.obj$/, ''), obj: text, mtl, tex, place: null, t: new Date().toISOString() }); }
  return recs;
}
/** stored record → asset ready to draw (parsed model, materials, decoded images, centre, radius) */
async function load(rec) {
  const model = parseObj(rec.obj), mtl = parseMtl(rec.mtl || ''), images = {};
  for (const [k, b] of Object.entries(rec.tex || {})) { try { images[k] = await createImageBitmap(b); } catch (e) { } }
  const B = model.bounds; model.center = [(B[0] + B[3]) / 2, (B[1] + B[4]) / 2, (B[2] + B[5]) / 2]; model.radius = Math.max(0.001, Math.hypot(B[3] - B[0], B[4] - B[1], B[5] - B[2]) / 2); model.size = [B[3] - B[0], B[4] - B[1], B[5] - B[2]];
  let tris = 0; for (const o of model.objects) for (const g of o.groups) tris += g.pos.length / 9; model.tris = tris;
  return { id: rec.id, rec, model, mtl, images };
}

/* ===================== matrices ===================== */
const M4 = { mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(f, as, n, fa) { const t = 1 / Math.tan(f / 2); return new Float32Array([t / as, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); },
  look(e, l) { const z = [e[0] - l[0], e[1] - l[1], e[2] - l[2]], zl = Math.hypot(...z); z.forEach((v, i) => z[i] = v / zl); let x = [z[2], 0, -z[0]]; const xl = Math.hypot(...x) || 1; x = x.map(v => v / xl); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); },
  trs(x, y, z, h, s) { const c = Math.cos(h) * s, n = Math.sin(h) * s; return new Float32Array([c, 0, -n, 0, 0, s, 0, 0, n, 0, c, 0, x, y, z, 1]); } };

/* ===================== the manager: placed assets in the world + the tablet app ===================== */
function AmpyObj(game) { this.g = game; this.assets = []; this.gr = null; this.ready = DB.all().then(async L => { for (const r of L) { try { this.assets.push(await load(r)); } catch (e) { } } }); }
AmpyObj.prototype.drawWorld = function (ctx) {
  const g = this.g; if (!this.assets.length || !g.VP) return; const placed = this.assets.filter(a => a.rec.place && a.rec.place.world === g.world); if (!placed.length) return;
  const gl = g.gl; if (!this.gr) { try { this.gr = new Renderer(gl); } catch (e) { console.warn('AmpyOBJ', e); this.assets = []; return; } }
  const pal = ctx.pal || {}, sun = pal.sunDir || [0.4, 0.8, 0.5], sc = pal.sun || [0.9, 0.9, 0.85], day = g.dayK === undefined ? 0.6 : g.dayK;
  gl.enable(gl.DEPTH_TEST);
  for (const A of placed) { const p = A.rec.place, rx = wrapD(p.x - ctx.camX), rz = wrapD(p.z - ctx.camZ); if (Math.hypot(rx, rz) > 400) continue;
    const s = p.s, C = A.model.center, M = M4.mul(M4.trs(rx, p.y, rz, p.h, s), new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -C[0], -A.model.bounds[1], -C[2], 1]));
    this.gr.draw(A, { VP: g.VP, M, sun, sunC: sc.map(v => v * (0.6 + 0.6 * day)), amb: [0.22 + 0.25 * day, 0.24 + 0.25 * day, 0.3 + 0.25 * day] }); }
};
AmpyObj.prototype.placeFront = function (A, keepScale) {
  const f = this.g.foot, d = Math.max(3, Math.min(25, (A.model.radius * (A.rec.place ? A.rec.place.s : 1)) * 1.6 + 1.5));
  const s = keepScale && A.rec.place ? A.rec.place.s : A.model.radius > 40 ? 20 / A.model.radius : A.model.radius < 0.05 ? 0.5 / A.model.radius : 1;
  const side = Math.max(1.2, A.model.radius * s * 0.9);   // a little to the side, so the pilot doesn't hide it
  A.rec.place = { world: this.g.world, x: f.x + Math.sin(f.h) * d + Math.cos(f.h) * side, z: f.z + Math.cos(f.h) * d - Math.sin(f.h) * side, y: f.y || 0, h: f.h + PI, s }; return DB.put(A.rec);
};

/* --------- the tablet app --------- */
function install(OS) {
  OS.prototype.app_obj = function () {
    const G = this.g.ampyobj; if (!G) { this.frame('AmpyOBJ', 'non disponibile'); return; }
    this.objTab = this.objTab || 'import';
    const tabs = '<button class="btn ' + (this.objTab === 'import' ? 'on' : '') + '" data-act="objtab:import">⬇ IMPORTA</button><button class="btn ' + (this.objTab === 'export' ? 'on' : '') + '" data-act="objtab:export">⬆ ESPORTA</button>';
    const b = this.frame('◳ AmpyOBJ · asset del gioco', '', tabs);
    if (this.objTab === 'export') {
      this.objCat = this.objCat || catalogue();
      b.innerHTML = '<div class="card"><b>Esporta un modello del gioco</b><br><small>ULTRA · parti separate come nel gioco · OBJ + MTL + texture palette · un file ZIP ' + (window.AmpyBridge ? 'salvato in Download/Cybercity sul telefono' : 'scaricato dal browser') + '. I veicoli usano la tua configurazione salvata.</small></div>'
        + '<div class="card" style="display:flex;flex-wrap:wrap;gap:.8vmin">' + this.objCat.map((c, i) => '<button class="btn" data-act="objexp:' + i + '">' + esc(c[1]) + '</button>').join('') + '</div><div class="card" id="objlog"><small>Scegli un modello.</small></div>';
      return; }
    b.innerHTML = '<div class="card"><b>Importa dal telefono</b><br><small>Scegli un file .zip, oppure .obj + .mtl + texture insieme (selezione multipla). Anche i modelli esportati da qui o da AmpyOBJ Viewer.</small><br><br>'
      + '<label class="btn" style="display:inline-block">📁 Scegli file<input type="file" multiple accept=".obj,.mtl,.zip,.png,.jpg,.jpeg,.webp,image/*,application/zip,application/octet-stream" style="display:none" id="objpick"></label> <span id="objmsg"></span></div><div id="objlist"><small>caricamento…</small></div>';
    b.querySelector('#objpick').addEventListener('change', async e => { const msg = b.querySelector('#objmsg'); msg.textContent = 'lettura…';
      try { let fl = []; for (const f of e.target.files) { const d = new Uint8Array(await f.arrayBuffer()); if (/\.zip$/i.test(f.name)) fl = fl.concat(await unzip(d.buffer)); else fl.push({ name: f.name, data: d }); }
        const recs = await recordFrom(fl); for (const r of recs) { await DB.put(r); G.assets.push(await load(r)); }
        msg.textContent = '✓ importati: ' + recs.map(r => r.name).join(', '); this.vib(20); this.objPreview(G.assets[G.assets.length - 1].id); }
      catch (er) { msg.textContent = '✖ ' + er.message; } });
    G.ready.then(() => { if (this.app !== 'obj') return; const L = b.querySelector('#objlist');
      L.innerHTML = G.assets.length ? G.assets.slice().reverse().map(A => '<div class="card n" style="display:flex;align-items:center;gap:1vmin;flex-wrap:wrap"><span style="flex:1"><b>' + esc(A.rec.name) + '</b><br><small>' + A.model.objects.length + ' parti · ' + Math.round(A.model.tris).toLocaleString('it-IT') + ' triangoli · ' + Object.keys(A.images).length + ' texture · ' + A.model.size.map(v => v.toFixed(2)).join(' × ') + ' m' + (A.rec.place ? ' · nel mondo' : '') + '</small></span>'
        + '<button class="btn" data-act="objview:' + A.id + '">👁 anteprima</button><button class="btn" data-act="objplace:' + A.id + '">📍 ' + (A.rec.place ? 'portalo qui' : 'metti nel mondo') + '</button>' + (A.rec.place ? '<button class="btn" data-act="objedit:' + A.id + '">✥ sposta</button><button class="btn" data-act="objhide:' + A.id + '">togli</button>' : '') + '<button class="btn" data-act="objdel:' + A.id + '">🗑</button></div>').join('')
        : '<div class="card"><small>Nessun asset importato.</small></div>'; });
  };
  /** preview like AmpyOBJ Viewer: orbit, zoom, explode, solid / wireframe / points / texture, parts on and off */
  OS.prototype.objPreview = function (id) {
    const G = this.g.ampyobj, A = G.assets.find(a => a.id === +id); if (!A) return; this.app = 'objview';
    const b = this.frame('👁 ' + esc(A.rec.name), '<div style="display:flex;height:100%;gap:1.2vmin"><canvas style="flex:1;min-width:0;height:100%;border-radius:1vmin;background:#0c1017;touch-action:none"></canvas>'
      + '<div style="width:32%;overflow:auto"><div class="card"><small>Esplosione</small><input type="range" min="0" max="3" step="0.01" value="0" data-k="ex" style="width:100%"><label><input type="checkbox" data-k="solid" checked> solido</label> <label><input type="checkbox" data-k="wire"> wireframe</label> <label><input type="checkbox" data-k="points"> punti</label> <label><input type="checkbox" data-k="tex" checked> texture</label> <label><input type="checkbox" data-k="rot" checked> rotazione</label></div>'
      + '<div class="card"><small>' + A.model.objects.length + ' componenti</small><br><button class="btn" data-k="all">tutti</button> <button class="btn" data-k="none">nessuno</button><div style="max-height:30vmin;overflow:auto;margin-top:.6vmin">' + A.model.objects.map((o, i) => '<label style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><input type="checkbox" data-part="' + i + '" checked> ' + esc(o.name) + '</label>').join('') + '</div></div>'
      + '<button class="btn" data-act="objplace:' + A.id + '">📍 metti nel mondo</button></div></div>', '<button class="btn" data-act="objtab:import">◳ asset</button>');
    b.style.padding = '1.2vmin'; const cv = b.querySelector('canvas'), st = { yaw: 0.7, pit: 0.35, d: 2.6, ex: 0, solid: true, wire: false, points: false, tex: true, rot: true, hide: new Set() };
    let gl = null, R = null; try { gl = cv.getContext('webgl', { antialias: true }); R = new Renderer(gl); } catch (e) { b.querySelector('canvas').replaceWith(Object.assign(document.createElement('div'), { textContent: 'WebGL non disponibile' })); return; }
    b.addEventListener('input', e => { const k = e.target.dataset.k, p = e.target.dataset.part; if (k === 'ex') st.ex = +e.target.value; else if (k) st[k] = e.target.checked; if (p !== undefined) { if (e.target.checked) st.hide.delete(+p); else st.hide.add(+p); } });
    b.addEventListener('click', e => { const k = e.target.dataset && e.target.dataset.k; if (k !== 'all' && k !== 'none') return; b.querySelectorAll('[data-part]').forEach(c => { c.checked = k === 'all'; }); st.hide = k === 'all' ? new Set() : new Set(A.model.objects.map((o, i) => i)); });
    const pts = new Map(); let pd = 0;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); st.rot = false; });
    cv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const o = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { st.yaw -= (e.clientX - o[0]) * 0.01; st.pit = Math.max(-1.4, Math.min(1.4, st.pit + (e.clientY - o[1]) * 0.01)); }
      else { const [p1, p2] = [...pts.values()], d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]); if (pd) st.d = Math.max(0.6, Math.min(12, st.d * pd / d)); pd = d; } });
    const up = e => { pts.delete(e.pointerId); pd = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); st.d = Math.max(0.6, Math.min(12, st.d * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
    const loop = () => { if (this.app !== 'objview' || !cv.isConnected) { R.drop(A.id); return; } const w = cv.clientWidth * Math.min(2, devicePixelRatio || 1), h = cv.clientHeight * Math.min(2, devicePixelRatio || 1); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      if (st.rot) st.yaw += 0.006; const r = A.model.radius, D = r * st.d, e = [Math.sin(st.yaw) * Math.cos(st.pit) * D, Math.sin(st.pit) * D, Math.cos(st.yaw) * Math.cos(st.pit) * D];
      gl.viewport(0, 0, w, h); gl.clearColor(0.047, 0.063, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
      const VP = M4.mul(M4.persp(0.87, w / Math.max(1, h), r / 200, r * 60), M4.look(e, [0, 0, 0])), C = A.model.center;
      R.draw(A, { VP, M: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -C[0], -C[1], -C[2], 1]), explode: st.ex, hide: st.hide, solid: st.solid, wire: st.wire, points: st.points, tex: st.tex, sun: [e[0] + r, e[1] + r * 2, e[2]], amb: [0.35, 0.37, 0.42] });
      requestAnimationFrame(loop); };
    loop();
  };
  /** move / turn / scale a placed asset with buttons (fine steps) */
  OS.prototype.objEdit = function (id) {
    const G = this.g.ampyobj, A = G.assets.find(a => a.id === +id); if (!A || !A.rec.place) return; this.app = 'objedit'; const p = A.rec.place;
    const B = (k, l) => '<button class="btn" data-act="objmv:' + A.id + ':' + k + '" style="min-width:12vmin">' + l + '</button>';
    this.frame('✥ ' + esc(A.rec.name), '<div class="card">Chiudi la sessione per vederlo nel mondo, o usa la Fotocamera simulata.<br><small>posizione x ' + p.x.toFixed(1) + ' · z ' + p.z.toFixed(1) + ' · quota ' + p.y.toFixed(2) + ' m · ' + Math.round(p.h * 180 / PI) + '° · scala ' + p.s.toFixed(3) + '</small></div>'
      + '<div class="card" style="display:grid;grid-template-columns:repeat(4,auto);gap:1vmin;justify-content:start">' + B('f', '⬆ avanti') + B('b', '⬇ indietro') + B('l', '⬅ sinistra') + B('r', '➡ destra') + B('u', '⤒ su') + B('d', '⤓ giù') + B('rl', '⟲ 15°') + B('rr', '⟳ 15°') + B('s+', '＋ scala') + B('s-', '－ scala') + B('s1', 'scala 1:1') + B('here', '📍 davanti a me') + '</div>',
      '<button class="btn" data-act="objtab:import">◳ asset</button>');
  };
  const act0 = OS.prototype.act;
  OS.prototype.act = function (a, el) {
    const [k, v, w] = a.split(':'), G = this.g.ampyobj;
    if (k === 'objtab') { this.objTab = v; this.launch('obj'); return; }
    if (k === 'objview') { this.objPreview(v); return; }
    if (k === 'objedit') { this.objEdit(v); return; }
    if (k === 'objplace' || k === 'objhide' || k === 'objdel' || k === 'objmv') { const A = G.assets.find(x => x.id === +v); if (!A) return;
      if (k === 'objplace') G.placeFront(A, !!A.rec.place).then(() => { this.toast(A.rec.name + ' è nel mondo davanti a te'); this.objEdit(A.id); });
      if (k === 'objhide') { A.rec.place = null; DB.put(A.rec).then(() => this.launch('obj')); }
      if (k === 'objdel') { DB.del(A.id).then(() => { G.assets = G.assets.filter(x => x !== A); if (G.gr) G.gr.drop(A.id); this.launch('obj'); }); }
      if (k === 'objmv') { const p = A.rec.place, f = this.g.foot, st = Math.max(0.1, A.model.radius * p.s * 0.15), fx = Math.sin(f.h), fz = Math.cos(f.h);
        if (w === 'f') { p.x += fx * st; p.z += fz * st; } if (w === 'b') { p.x -= fx * st; p.z -= fz * st; } if (w === 'l') { p.x += fz * st; p.z -= fx * st; } if (w === 'r') { p.x -= fz * st; p.z += fx * st; }
        if (w === 'u') p.y += st; if (w === 'd') p.y = Math.max(-5, p.y - st); if (w === 'rl') p.h += PI / 12; if (w === 'rr') p.h -= PI / 12; if (w === 's+') p.s *= 1.25; if (w === 's-') p.s /= 1.25; if (w === 's1') p.s = 1;
        if (w === 'here') { G.placeFront(A, true).then(() => this.objEdit(A.id)); return; }
        p.x = ((p.x % S) + S) % S; p.z = ((p.z % S) + S) % S; DB.put(A.rec); this.objEdit(A.id); }
      return; }
    if (k === 'objexp') { const c = this.objCat[+v], log = this.view().querySelector('#objlog'); if (!c) return; log.innerHTML = '<small>costruzione di ' + esc(c[1]) + ' in ULTRA…</small>';
      setTimeout(async () => { try { const m = c[2](), r = await exportMesh(m, c[0], c[1]), z = zip(r.files), fn = c[0] + '_ultra.zip';
          let where = ''; const B = window.AmpyBridge;
          if (B && B.fileBegin) { const u = new Uint8Array(await z.arrayBuffer()), h = B.fileBegin(fn, 'application/zip'); if (!h) throw new Error('impossibile creare il file');
            for (let i = 0; i < u.length; i += 393216) { let s = ''; const ch = u.subarray(i, i + 393216); for (let j = 0; j < ch.length; j += 32768) s += String.fromCharCode.apply(null, ch.subarray(j, j + 32768)); B.fileChunk(h, btoa(s)); }
            where = B.fileEnd(h); if (!where) throw new Error('salvataggio non riuscito'); }
          else { const a = document.createElement('a'); a.href = URL.createObjectURL(z); a.download = fn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); where = 'download del browser'; }
          log.innerHTML = '✓ <b>' + esc(fn) + '</b> · ' + r.parts + ' parti · ' + r.tris.toLocaleString('it-IT') + ' triangoli · ' + r.mats + ' materiali · ' + (z.size / 1048576).toFixed(1) + ' MB<br><small>salvato in ' + esc(where) + '</small>'; this.vib(25);
          window.__lastExport = { name: fn, size: z.size, parts: r.parts }; }
        catch (er) { log.innerHTML = '✖ ' + esc(er.message); } }, 30); return; }
    return act0.call(this, a, el);
  };
  const ap = OS.prototype; const i0 = ap.constructor; void i0;
}
if (window.AmpyOS) install(window.AmpyOS);
window.KageAmpyObj = AmpyObj; window.AmpyObjLib = { zip, unzip, exportMesh, parseObj, parseMtl, catalogue, recordFrom, load };
})();
