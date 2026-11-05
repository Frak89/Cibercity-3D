/* Real light and weather: the sun where you are (computed from the date, latitude and longitude) and the current weather
 * from Open-Meteo (free, no key). Position: ?lat=&lon= (the Android app passes its saved one) → saved last position →
 * browser geolocation → a guess from the time zone. apply(pal) blends the night palette towards day / dusk; weather() gives a
 * CYBER_WEATHER key. Off with localStorage kageReal = '0'. */
(function (root) {
'use strict';
const TZ = { 'Europe/Rome': [41.9, 12.5, 'Roma'], 'Europe/Vatican': [41.9, 12.45, 'Roma'], 'Europe/San_Marino': [43.94, 12.45, 'San Marino'], 'Europe/Zurich': [47.37, 8.54, 'Zürich'],
  'Europe/London': [51.5, -0.13, 'London'], 'Europe/Paris': [48.86, 2.35, 'Paris'], 'Europe/Berlin': [52.52, 13.4, 'Berlin'], 'Europe/Madrid': [40.42, -3.7, 'Madrid'], 'Europe/Lisbon': [38.72, -9.14, 'Lisboa'],
  'Europe/Amsterdam': [52.37, 4.9, 'Amsterdam'], 'Europe/Vienna': [48.21, 16.37, 'Wien'], 'Europe/Athens': [37.98, 23.73, 'Athína'], 'Europe/Moscow': [55.75, 37.62, 'Moskva'], 'Europe/Istanbul': [41.01, 28.98, 'İstanbul'],
  'America/New_York': [40.71, -74.0, 'New York'], 'America/Chicago': [41.88, -87.63, 'Chicago'], 'America/Denver': [39.74, -104.99, 'Denver'], 'America/Los_Angeles': [34.05, -118.24, 'Los Angeles'],
  'America/Sao_Paulo': [-23.55, -46.63, 'São Paulo'], 'America/Mexico_City': [19.43, -99.13, 'Ciudad de México'], 'Asia/Tokyo': [35.68, 139.69, 'Tokyo'], 'Asia/Shanghai': [31.23, 121.47, 'Shanghai'],
  'Asia/Dubai': [25.2, 55.27, 'Dubai'], 'Asia/Kolkata': [28.61, 77.21, 'Delhi'], 'Asia/Singapore': [1.35, 103.82, 'Singapore'], 'Australia/Sydney': [-33.87, 151.21, 'Sydney'], 'Africa/Cairo': [30.04, 31.24, 'al-Qāhira'] };
const WX_NAME = { clear: 'SERENO', cloudy: 'NUVOLOSO', fog: 'NEBBIA', drizzle: 'PIOGGERELLA', rain: 'PIOGGIA', storm: 'TEMPORALE', snow: 'NEVE' };
const fromWmo = c => c === 45 || c === 48 ? 'fog' : c >= 51 && c <= 57 ? 'drizzle' : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : c === 2 || c === 3 ? 'cloudy' : 'clear';
const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), R = Math.PI / 180;

function RealSky() {
  this.enabled = ls.get('kageReal', '1') !== '0';
  this.lat = null; this.lon = null; this.city = ''; this.src = ''; this.wx = null; this.temp = null; this.cloud = 0; this.elev = -30; this.az = 0; this.day = 0; this.dusk = 0;
  const q = new URLSearchParams(location.search);
  if (q.has('lat') && q.has('lon')) this.setPos(+q.get('lat'), +q.get('lon'), q.get('city') || '', 'app');
  else { const c = ls.get('kageGeo', ''); if (c) try { const j = JSON.parse(c); this.setPos(j.lat, j.lon, j.city, 'salvata'); } catch (e) { } }
  if (this.lat === null) { let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { }
    const g = TZ[tz]; if (g) this.setPos(g[0], g[1], g[2], 'fuso orario'); else this.setPos(45, -new Date().getTimezoneOffset() / 4, '', 'fuso orario'); }
  if (this.enabled && !q.has('shot') && navigator.geolocation && this.src !== 'app') try {
    navigator.geolocation.getCurrentPosition(p => { this.setPos(p.coords.latitude, p.coords.longitude, '', 'GPS'); ls.set('kageGeo', JSON.stringify({ lat: this.lat, lon: this.lon, city: '' })); this.fetch(); }, () => { }, { maximumAge: 3600e3, timeout: 15000 });
  } catch (e) { }
  this.tick();
  if (this.enabled && !q.has('shot')) { this.fetch(); setInterval(() => this.fetch(), 15 * 60e3); }
  setInterval(() => this.tick(), 30e3);
}
RealSky.prototype.setPos = function (lat, lon, city, src) { this.lat = lat; this.lon = lon; this.city = city || this.city; this.src = src; this.tick(); };
RealSky.prototype.setEnabled = function (on) { this.enabled = !!on; ls.set('kageReal', on ? '1' : '0'); if (on && this.wx === null) this.fetch(); };
RealSky.prototype.fetch = function () {
  if (this.lat === null || !root.fetch) return;
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + this.lat.toFixed(3) + '&longitude=' + this.lon.toFixed(3) + '&current=temperature_2m,weather_code,cloud_cover,is_day';
  fetch(url).then(r => r.json()).then(j => { const c = j.current || {}; this.code = c.weather_code | 0; this.wx = fromWmo(this.code); this.temp = Math.round(c.temperature_2m); this.cloud = (c.cloud_cover || 0) / 100; }).catch(() => { });
};
/** solar elevation / azimuth (degrees) for now at lat, lon (NOAA-style approximation, ±0.5°) */
RealSky.prototype.tick = function (when) {
  if (this.lat === null) return;
  const d = (when || Date.now()) / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * R, q = 280.459 + 0.98564736 * d, L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * R, e = (23.439 - 0.00000036 * d) * R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24, ha = (gmst * 15 + this.lon) * R - ra, la = this.lat * R;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  this.elev = el / R; this.az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  this.day = sstep(-5, 8, this.elev); this.dusk = Math.exp(-((this.elev - 1) ** 2) / (2 * 4.5 * 4.5)) * (this.elev > -9 ? 1 : 0);
};
RealSky.prototype.weather = function () { return this.enabled ? this.wx : null; };
RealSky.prototype.dayK = function () { return this.enabled ? this.day : 0; };
/** the palette at this moment: night neon → dawn / dusk glow → daylight (greyer under clouds, rain or snow) */
RealSky.prototype.apply = function (pal) {
  if (!this.enabled) return pal;
  const K = this.day, D = this.dusk, ov = clamp(this.cloud + (this.wx && this.wx !== 'clear' && this.wx !== 'cloudy' ? 0.4 : 0), 0, 1);
  const dayFog = mix([0.62, 0.72, 0.86], [0.6, 0.62, 0.66], ov), dayTop = mix([0.2, 0.42, 0.82], [0.42, 0.45, 0.5], ov);
  let fog = mix(pal.fog, dayFog, K), top = mix(pal.top, dayTop, K * 0.95);
  fog = mix(fog, [0.95, 0.48, 0.3], D * 0.55); top = mix(top, [0.32, 0.16, 0.36], D * 0.5);
  const sun = mix(pal.sun, mix([1, 0.96, 0.86], [0.8, 0.8, 0.82], ov), K);
  const el = Math.max(0.05, this.elev * R), sunDir = [Math.sin(this.az) * Math.cos(el), Math.sin(el), Math.cos(this.az) * Math.cos(el)];
  return Object.assign({}, pal, { fog, top, sun: mix(sun, [1, 0.55, 0.3], D * 0.6), sunDir: K > 0.02 || D > 0.1 ? sunDir : pal.sunDir, stripes: pal.stripes * (1 - K), fogDen: (pal.fogDen || 0.006) * (1 - K * 0.35) });
};
/** "📍 Roma · 14° · NUVOLOSO · GIORNO" */
RealSky.prototype.line = function () {
  if (!this.enabled) return '';
  const ph = this.day > 0.6 ? 'GIORNO' : this.dusk > 0.3 ? (new Date().getHours() >= 12 ? 'TRAMONTO' : 'ALBA') : this.day > 0.05 ? 'CREPUSCOLO' : 'NOTTE';
  return '📍 ' + (this.city || (this.lat !== null ? this.lat.toFixed(1) + '°, ' + this.lon.toFixed(1) + '°' : '')) + (this.temp !== null ? ' · ' + this.temp + '°' : '') + (this.wx ? ' · ' + WX_NAME[this.wx] : '') + ' · ' + ph;
};
root.KageRealSky = RealSky;
root.realSky = null;
root.getRealSky = () => root.realSky || (root.realSky = new RealSky());
})(typeof window !== 'undefined' ? window : globalThis);
