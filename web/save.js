/* KAGE SAVE · backups of everything you've done, so uninstalling or changing phone never loses it.
 * One zip (cybercity_salvataggio_YYYY-MM-DD.zip) with save.json (every setting and progress: campaign, Custodians' alphabet,
 * KAGE TECH programs and repairs, KAGE BUILD pieces, vehicles' configuration, pilot, badge, music, tablet…) plus the photos
 * of the Gallery and the assets imported with AmpyOBJ. Saved to Download/Cybercity (Android app) or downloaded (browser);
 * restored by picking the zip in the tablet (💾 Salvataggi). Optional automatic backup every 3 days in the app. */
(function () {
'use strict';
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const enc8 = s => new TextEncoder().encode(s);
const idb = (name, store, mode, fn) => new Promise((ok, ko) => { let r; try { r = indexedDB.open(name, 1); } catch (e) { ok([]); return; }
  r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(store)) r.result.createObjectStore(store, { keyPath: 'id' }); };
  r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains(store)) { ok([]); return; } const t = db.transaction(store, mode), s = t.objectStore(store); fn(s, ok); t.onerror = () => ok([]); }; r.onerror = () => ok([]); });
const allOf = (name, store) => idb(name, store, 'readonly', (s, ok) => { const q = s.getAll(); q.onsuccess = () => ok(q.result || []); });
const putAll = (name, store, list) => idb(name, store, 'readwrite', (s, ok) => { for (const x of list) s.put(x); s.transaction.oncomplete = () => ok(list.length); });
const b2u8 = async b => new Uint8Array(await b.arrayBuffer());
const url2u8 = u => { const b = atob(u.slice(u.indexOf(',') + 1)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const u82url = (u, mime) => { let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return 'data:' + mime + ';base64,' + btoa(s); };

async function build() {
  const L = window.AmpyObjLib; if (!L) throw new Error('modulo zip non disponibile');
  const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== 'kageLastBackup') ls[k] = localStorage.getItem(k); }
  const files = [], photos = await allOf('ampybios', 'photos'), assets = await allOf('ampyobj', 'assets'), meta = { photos: [], assets: [] };
  for (const p of photos) { const n = 'foto/' + p.id + '.jpg'; files.push({ name: n, data: url2u8(p.url) }); meta.photos.push({ id: p.id, t: p.t, src: p.src, where: p.where, file: n }); }
  for (const a of assets) { const d = 'asset/' + a.id + '/', tex = {}; files.push({ name: d + a.name + '.obj', data: enc8(a.obj || '') }, { name: d + a.name + '.mtl', data: enc8(a.mtl || '') });
    for (const [k, b] of Object.entries(a.tex || {})) { files.push({ name: d + 'textures/' + k, data: await b2u8(b) }); tex[k] = { file: d + 'textures/' + k, type: b.type }; }
    meta.assets.push({ id: a.id, name: a.name, t: a.t, place: a.place, dir: d, tex }); }
  const save = { app: 'Cybercity 3D', v: 1, t: new Date().toISOString(), localStorage: ls, meta };
  files.unshift({ name: 'save.json', data: enc8(JSON.stringify(save, null, 1)) });
  return { zip: L.zip(files), n: Object.keys(ls).length, photos: photos.length, assets: assets.length };
}
async function backup(auto) {
  const r = await build(), d = new Date().toISOString().slice(0, 10), where = await window.AmpyObjLib.saveZip(r.zip, (auto ? 'cybercity_autosalvataggio_' : 'cybercity_salvataggio_') + d + '.zip');
  LS.set('kageLastBackup', String(Date.now())); return Object.assign(r, { where, size: r.zip.size });
}
async function restore(file) {
  const L = window.AmpyObjLib, F = await L.unzip(await file.arrayBuffer()), by = n => F.find(f => f.name === n), sj = by('save.json');
  if (!sj) throw new Error('non è un salvataggio di Cybercity (manca save.json)');
  const S = JSON.parse(new TextDecoder().decode(sj.data)); if (!S || S.app !== 'Cybercity 3D') throw new Error('salvataggio non riconosciuto');
  for (const [k, v] of Object.entries(S.localStorage || {})) LS.set(k, v);
  const ph = (S.meta.photos || []).map(p => { const f = by(p.file); return f ? { id: p.id, t: p.t, src: p.src, where: p.where, url: u82url(f.data, 'image/jpeg') } : null; }).filter(Boolean);
  const as = (S.meta.assets || []).map(a => { const td = new TextDecoder(), o = F.find(f => f.name.startsWith(a.dir) && f.name.endsWith('.obj')), m = F.find(f => f.name.startsWith(a.dir) && f.name.endsWith('.mtl')), tex = {};
    for (const [k, t] of Object.entries(a.tex || {})) { const f = by(t.file); if (f) tex[k] = new Blob([f.data], { type: t.type || 'image/png' }); }
    return { id: a.id, name: a.name, t: a.t, place: a.place, obj: o ? td.decode(o.data) : '', mtl: m ? td.decode(m.data) : '', tex }; });
  await putAll('ampybios', 'photos', ph); await putAll('ampyobj', 'assets', as);
  return { keys: Object.keys(S.localStorage || {}).length, photos: ph.length, assets: as.length, t: S.t };
}
/** automatic backup every 3 days (Android app only, when the setting is on) */
function auto() { if (!window.AmpyBridge || !window.AmpyBridge.fileBegin || LS.get('kageAutoBackup', '1') !== '1') return; const last = +LS.get('kageLastBackup', '0');
  if (Date.now() - last > 3 * 86400000) setTimeout(() => backup(true).catch(() => { }), 20000); }

function install(OS) {
  OS.prototype.app_save = function () {
    const last = +LS.get('kageLastBackup', '0'), autoOn = LS.get('kageAutoBackup', '1') === '1';
    const b = this.frame('💾 Salvataggi · KAGE SAVE', '<div class="card"><b>Fai un salvataggio</b><br><small>Tutto in un file zip: campagna, alfabeto dei Custodi, programmi e riparazioni di KAGE TECH, pezzi di KAGE BUILD, configurazione dei veicoli e del pilota, impostazioni, foto della Galleria e asset di AmpyOBJ. '
      + (window.AmpyBridge ? 'Va in Download/Cybercity sul telefono.' : 'Viene scaricato dal browser.') + ' Fallo prima di disinstallare o cambiare telefono.</small><br><br><button class="btn" data-act="sv:make">💾 salva adesso</button> <span id="svLog"><small>' + (last ? 'ultimo salvataggio: ' + new Date(last).toLocaleString('it-IT') : 'nessun salvataggio ancora') + '</small></span></div>'
      + '<div class="card"><b>Ripristina</b><br><small>Scegli un file cybercity_salvataggio_….zip: i progressi tornano come erano e il gioco si riavvia.</small><br><br><label class="btn" style="display:inline-block">📂 scegli il salvataggio<input type="file" accept=".zip,application/zip,application/octet-stream" style="display:none" id="svPick"></label> <span id="svRes"></span></div>'
      + (window.AmpyBridge ? '<div class="card"><b>Automatico</b><br><button class="btn ' + (autoOn ? 'on' : '') + '" data-act="sv:auto">' + (autoOn ? '◉' : '○') + ' salvataggio automatico ogni 3 giorni</button></div>' : ''));
    b.querySelector('#svPick').addEventListener('change', async e => { const f = e.target.files[0], el = b.querySelector('#svRes'); if (!f) return; el.textContent = 'ripristino…';
      try { const r = await restore(f); el.textContent = '✓ ripristinato (' + r.keys + ' voci, ' + r.photos + ' foto, ' + r.assets + ' asset) · riavvio…'; this.vib(30); setTimeout(() => location.reload(), 1600); } catch (er) { el.textContent = '✖ ' + er.message; } });
  };
  const act0 = OS.prototype.act;
  OS.prototype.act = function (a, el) { if (!a.startsWith('sv:')) return act0.call(this, a, el); const v = a.slice(3);
    if (v === 'auto') { LS.set('kageAutoBackup', LS.get('kageAutoBackup', '1') === '1' ? '0' : '1'); this.launch('save'); return; }
    if (v === 'make') { const log = this.view().querySelector('#svLog'); log.textContent = 'salvataggio…';
      backup(false).then(r => { log.innerHTML = '✓ salvato in <b>' + r.where + '</b> · ' + r.n + ' voci · ' + r.photos + ' foto · ' + r.assets + ' asset · ' + (r.size / 1048576).toFixed(1) + ' MB'; this.vib(25); }).catch(er => { log.textContent = '✖ ' + er.message; }); } };
}
if (window.AmpyOS) install(window.AmpyOS);
window.KageSave = { build, backup, restore, auto };
auto();
})();
