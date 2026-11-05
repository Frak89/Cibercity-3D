package it.ampy.cybercity;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Locale;

/** Weather presets for the city and live weather from Open-Meteo (free, no API key). */
public final class Weather {
    public static final String[] KEYS = {"off", "auto", "clear", "cloudy", "fog", "drizzle", "rain", "storm", "snow"};
    public static final String[] NAMES = {L.t("SPENTO (usa la pioggia manuale)"), L.t("AUTOMATICO (meteo reale)"), L.t("SERENO"), L.t("NUVOLOSO"),
        L.t("NEBBIA"), L.t("PIOGGERELLA"), L.t("PIOGGIA"), L.t("TEMPORALE"), L.t("NEVE")};
    public static final String[] ICONS = {"", "", "☾", "☁", "≋", "☂", "☔", "⚡", "❄"};

    /** Effect parameters — identical to WEATHER in web/cybercity.js. */
    public static final class Fx {
        public final String key; public final float rain, snow, fog, cloud, mist, light, wind;
        Fx(String key, float rain, float snow, float fog, float cloud, float mist, float light, float wind) {
            this.key = key; this.rain = rain; this.snow = snow; this.fog = fog; this.cloud = cloud; this.mist = mist; this.light = light; this.wind = wind;
        }
    }

    public static Fx fx(String key) {
        switch (key == null ? "" : key) {
            case "clear": return new Fx(key, 0, 0, 1f, 0, 0, 0, 0);
            case "cloudy": return new Fx(key, 0, 0, 1.15f, 0.85f, 0.15f, 0, 2);
            case "fog": return new Fx(key, 0, 0, 3.6f, 0.9f, 1f, 0, 0);
            case "drizzle": return new Fx(key, 0.3f, 0, 1.3f, 0.8f, 0.25f, 0, 2);
            case "rain": return new Fx(key, 0.85f, 0, 1.4f, 0.95f, 0.3f, 0, 5);
            case "storm": return new Fx(key, 1f, 0, 1.5f, 1f, 0.3f, 1, 9);
            case "snow": return new Fx(key, 0.9f, 1, 1.6f, 0.9f, 0.35f, 0, 1);
            default: return null;
        }
    }

    public static int index(String k) { for (int i = 0; i < KEYS.length; i++) if (KEYS[i].equals(k)) return i; return 0; }
    public static String name(String k) { return NAMES[index(k)]; }

    /** WMO weather code → preset key. */
    public static String fromWmo(int code) {
        if (code == 45 || code == 48) return "fog";
        if (code >= 51 && code <= 57) return "drizzle";
        if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
        if ((code >= 71 && code <= 77) || code == 85 || code == 86) return "snow";
        if (code >= 95) return "storm";
        if (code == 3 || code == 2) return "cloudy";
        return "clear";
    }

    /** The effective preset key now (resolves AUTO from the cached live weather). */
    public static String effective(Prefs p) {
        String m = p.weatherMode();
        if (!"auto".equals(m)) return m;
        String live = p.liveWeather();
        return live.isEmpty() ? "off" : live;
    }

    /* ---------------- live weather ---------------- */

    private static String get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000); c.setReadTimeout(8000);
        c.setRequestProperty("User-Agent", "Cybercity3D/1.4 (Android screensaver)");
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
            return o.toString("UTF-8");
        } finally { c.disconnect(); }
    }

    /** City name → stores lat/lon. Returns the resolved display name. Network: call off the UI thread. */
    public static String geocode(Prefs p, String city) throws Exception {
        String j = get("https://geocoding-api.open-meteo.com/v1/search?count=1&language=it&format=json&name=" + URLEncoder.encode(city, "UTF-8"));
        JSONObject o = new JSONObject(j);
        if (!o.has("results") || o.getJSONArray("results").length() == 0) throw new IllegalArgumentException(L.t("Città non trovata"));
        JSONObject r = o.getJSONArray("results").getJSONObject(0);
        String name = r.optString("name", city) + (r.has("country_code") ? " (" + r.optString("country_code") + ")" : "");
        p.edit().putFloat("wLat", (float) r.getDouble("latitude")).putFloat("wLon", (float) r.getDouble("longitude"))
            .putString("wCity", name).putBoolean("wUseGps", false).apply();
        return name;
    }

    /** Last known coarse location, if the permission was granted. */
    public static boolean fromDevice(Context c, Prefs p) {
        if (c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return false;
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        Location best = null;
        try {
            for (String prov : lm.getProviders(true)) {
                Location l = lm.getLastKnownLocation(prov);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            }
        } catch (SecurityException e) { return false; }
        if (best == null) return false;
        p.edit().putFloat("wLat", (float) best.getLatitude()).putFloat("wLon", (float) best.getLongitude())
            .putString("wCity", String.format(Locale.US, "posizione %.2f, %.2f", best.getLatitude(), best.getLongitude())).apply();
        return true;
    }

    /** Downloads the current weather and caches it. Network: call off the UI thread. */
    public static String refresh(Context c, Prefs p) throws Exception {
        if (p.useGps()) fromDevice(c, p);
        if (!p.hasLocation()) throw new IllegalStateException(L.t("Imposta una città o la posizione"));
        String url = String.format(Locale.US, "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f"
            + "&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,is_day", p.lat(), p.lon());
        JSONObject cur = new JSONObject(get(url)).getJSONObject("current");
        int code = cur.optInt("weather_code", 0);
        String key = fromWmo(code);
        int temp = (int) Math.round(cur.optDouble("temperature_2m", 0));
        p.edit().putString("wLive", key).putInt("wTemp", temp).putInt("wCode", code)
            .putLong("wTime", System.currentTimeMillis()).apply();
        return key;
    }

    /** Refreshes in a background thread if the cache is older than 30 minutes. */
    public static void refreshIfStale(Context c, Prefs p, Runnable done) {
        if (!"auto".equals(p.weatherMode()) || !p.hasLocation() && !p.useGps()) return;
        if (System.currentTimeMillis() - p.weatherTime() < 30 * 60_000L) return;
        new Thread(() -> {
            try { refresh(c, p); if (done != null) done.run(); } catch (Exception ignored) { }
        }, "weather").start();
    }

    /** "☔ 14° · PIOGGIA · Roma (IT)" */
    public static String line(Prefs p) {
        String k = p.liveWeather();
        if (k.isEmpty()) return "";
        return ICONS[index(k)] + " " + p.temp() + "° · " + NAMES[index(k)];
    }
}
