package it.ampy.cybercity;

import android.content.Context;
import android.content.SharedPreferences;

/** Settings shared by the screensaver, the preview and the settings screen. */
public final class Prefs {
    public static final String[] QUALITY_LABELS = {L.t("BATTERIA (60%)"), L.t("BILANCIATA (85%)"), L.t("MASSIMA (100%)")};
    public static final int[] QUALITY_VALUES = {60, 85, 100};
    public static final int[] FPS_VALUES = {30, 45, 60};

    private final SharedPreferences sp;
    private Prefs(Context c) { sp = c.getApplicationContext().getSharedPreferences("cybercity", Context.MODE_PRIVATE); }
    public static Prefs get(Context c) { return new Prefs(c); }

    public String palette() { return sp.getString("palette", "neon"); }
    public String mode() { return sp.getString("mode", "auto"); }
    public int speedPct() { return sp.getInt("speed", 100); }          // 30..250
    public int rainPct() { return sp.getInt("rain", 55); }             // 0..100
    public boolean autoScenes() { return sp.getBoolean("autoScenes", true); }
    public boolean traffic() { return sp.getBoolean("traffic", true); }
    public boolean scanlines() { return sp.getBoolean("scanlines", false); }
    public boolean clock() { return sp.getBoolean("clock", true); }
    public boolean dim() { return sp.getBoolean("dim", false); }
    public int quality() { return sp.getInt("quality", 85); }
    public int fps() { return sp.getInt("fps", 45); }
    public int cycleSec() { return sp.getInt("cycle", 45); }           // 20..120
    public int fov() { return sp.getInt("fov", 62); }                  // 45..90
    public int seed() { return sp.getInt("seed", 2077); }

    // schedule
    public static final String DEFAULT_SLOTS = ("[{\"on\":true,\"name\":\"SERA\",\"from\":1140,\"to\":1380,\"days\":127,\"show\":0,\"palette\":\"neon\",\"mode\":\"\",\"bright\":60},")
        + ("{\"on\":true,\"name\":\"NOTTE\",\"from\":1380,\"to\":420,\"days\":127,\"show\":1,\"palette\":\"bloodmoon\",\"mode\":\"\",\"bright\":8}]");
    public boolean onlyCharging() { return sp.getBoolean("onlyCharging", true); }
    public int delayMin() { return sp.getInt("delayMin", 0); }
    public int runMin() { return sp.getInt("runMin", 0); }      // 0 = always
    public int offMin() { return sp.getInt("offMin", 15); }
    public int pauseMode() { return sp.getInt("pauseMode2", Schedule.SHOW_CLOCK); }
    public int hiddenMode() { return sp.getInt("hiddenMode", Schedule.SHOW_BLACK); }
    public int bright() { return sp.getInt("bright", Schedule.BRIGHT_SYSTEM); }   // -1 system, 1..100
    public int pauseBright() { return sp.getInt("pauseBright", 5); }
    public boolean workOn() { return sp.getBoolean("workOn", false); }
    public int workFrom() { return sp.getInt("workFrom", 9 * 60); }
    public int workTo() { return sp.getInt("workTo", 18 * 60); }
    public int workDays() { return sp.getInt("workDays", Schedule.WEEKDAYS); }
    public boolean respectDnd() { return sp.getBoolean("respectDnd", true); }
    public boolean onlySlots() { return sp.getBoolean("onlySlots", false); }
    public static final String[] FACEDOWN_NAMES = {L.t("SPEGNI (schermo nero, 3D fermo)"), L.t("CHIUDI SALVASCHERMO"), L.t("IGNORA")};
    public int faceDown() { return sp.getInt("faceDown", 0); }
    public boolean notifIcons() { return sp.getBoolean("notifIcons", true); }
    // weather
    public String weatherMode() { return sp.getString("weather", "auto"); }
    public String liveWeather() { return sp.getString("wLive", ""); }
    public long weatherTime() { return sp.getLong("wTime", 0); }
    public int temp() { return sp.getInt("wTemp", 0); }
    public boolean useGps() { return sp.getBoolean("wUseGps", false); }
    public boolean hasLocation() { return sp.contains("wLat"); }
    public float lat() { return sp.getFloat("wLat", 0); }
    public float lon() { return sp.getFloat("wLon", 0); }
    public String city() { return sp.getString("wCity", ""); }
    public boolean weatherLine() { return sp.getBoolean("wLine", true); }
    public String slotsJson() { return sp.getString("slots", DEFAULT_SLOTS); }

    public SharedPreferences.Editor edit() { return sp.edit(); }
    public SharedPreferences raw() { return sp; }
    public int i(String k, int d) { return sp.getInt(k, d); }
    public boolean b(String k, boolean d) { return sp.getBoolean(k, d); }
    public void putString(String k, String v) { sp.edit().putString(k, v).apply(); }
    public void putInt(String k, int v) { sp.edit().putInt(k, v).apply(); }
    public void putBool(String k, boolean v) { sp.edit().putBoolean(k, v).apply(); }

    /** Immutable snapshot read by the GL thread. */
    public static final class Snapshot {
        public final String palette, mode;
        public final float speed, rain;
        public final boolean traffic, scanlines;
        public final int fps, cycle, fov, seed;
        public String weather;   // effective weather preset key ("off" = none)
        public Snapshot weather(String w) { Snapshot s = new Snapshot(this, palette, mode); s.weather = w; return s; }
        private Snapshot(Snapshot o, String palette, String mode) {
            this.palette = palette; this.mode = mode; speed = o.speed; rain = o.rain; traffic = o.traffic; scanlines = o.scanlines;
            fps = o.fps; cycle = o.cycle; fov = o.fov; seed = o.seed; weather = o.weather;
        }
        /** Same settings with a time slot's atmosphere / camera. */
        public Snapshot with(String palette, String mode) { return new Snapshot(this, palette, mode); }
        public Snapshot(Prefs p) {
            palette = p.palette(); mode = p.mode(); speed = p.speedPct() / 100f; rain = p.rainPct() / 100f;
            traffic = p.traffic(); scanlines = p.scanlines(); fps = p.fps(); cycle = p.cycleSec(); fov = p.fov(); seed = p.seed();
            weather = Weather.effective(p);
        }
    }
    public Snapshot snapshot() { return new Snapshot(this); }
}
