package it.ampy.cybercity;

import android.content.Context;
import android.content.SharedPreferences;

/** Settings shared by the screensaver, the preview and the settings screen. */
public final class Prefs {
    public static final String[] QUALITY_LABELS = {"BATTERIA (60%)", "BILANCIATA (85%)", "MASSIMA (100%)"};
    public static final int[] QUALITY_VALUES = {60, 85, 100};
    public static final int[] FPS_VALUES = {30, 45, 60};

    private final SharedPreferences sp;
    private Prefs(Context c) { sp = c.getApplicationContext().getSharedPreferences("cybercity", Context.MODE_PRIVATE); }
    public static Prefs get(Context c) { return new Prefs(c); }

    public String palette() { return sp.getString("palette", "neon"); }
    public String mode() { return sp.getString("mode", "auto"); }
    public int speedPct() { return sp.getInt("speed", 100); }          // 30..250
    public int rainPct() { return sp.getInt("rain", 55); }             // 0..100
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
    public boolean windowOn() { return sp.getBoolean("windowOn", false); }
    public int fromMin() { return sp.getInt("fromMin", 22 * 60); }
    public int toMin() { return sp.getInt("toMin", 7 * 60); }
    public boolean onlyCharging() { return sp.getBoolean("onlyCharging", true); }
    public int delayMin() { return sp.getInt("delayMin", 0); }
    public int runMin() { return sp.getInt("runMin", 0); }      // 0 = always
    public int offMin() { return sp.getInt("offMin", 15); }
    public int pauseMode() { return sp.getInt("pauseMode", Schedule.PAUSE_CLOCK); }

    public SharedPreferences.Editor edit() { return sp.edit(); }
    public void putString(String k, String v) { sp.edit().putString(k, v).apply(); }
    public void putInt(String k, int v) { sp.edit().putInt(k, v).apply(); }
    public void putBool(String k, boolean v) { sp.edit().putBoolean(k, v).apply(); }

    /** Immutable snapshot read by the GL thread. */
    public static final class Snapshot {
        public final String palette, mode;
        public final float speed, rain;
        public final boolean traffic, scanlines;
        public final int fps, cycle, fov, seed;
        public Snapshot(Prefs p) {
            palette = p.palette(); mode = p.mode(); speed = p.speedPct() / 100f; rain = p.rainPct() / 100f;
            traffic = p.traffic(); scanlines = p.scanlines(); fps = p.fps(); cycle = p.cycleSec(); fov = p.fov(); seed = p.seed();
        }
    }
    public Snapshot snapshot() { return new Snapshot(this); }
}
