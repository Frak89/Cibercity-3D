package it.ampy.cybercity;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.BatteryManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.service.dreams.DreamService;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;

import java.util.Calendar;

/**
 * The screensaver itself (Impostazioni → Display → Salvaschermo → Cybercity 3D).
 * Every few seconds it resolves the schedule: time slot (which screensaver, brightness), work hours / Do Not Disturb,
 * start delay and animation / pause cycle, and switches between city, clock-only and black with a fade.
 */
public class CyberDreamService extends DreamService implements SensorEventListener {
    private Prefs prefs;
    private CityView city;
    private ClockOverlay clock;
    private View black;
    private Schedule sch;
    private long dreamStart;
    private boolean cityRunning = false, started = false;
    private int shown = -1;               // Schedule.SHOW_* currently on screen
    private String curPalette = "", curMode = "", curWeather = "";
    private int curBright = Integer.MIN_VALUE;
    private final Handler h = new Handler(Looper.getMainLooper());
    private SensorManager sm;
    private boolean faceDown = false;
    private long faceDownSince = 0, faceUpSince = 0;

    /* scenes: the city, the KAGE GT turnaround (random configurations) and the silent autopilot run */
    private static final int SC_CITY = 0, SC_KAGE = 1, SC_RACE = 2;
    private FrameLayout root;
    private android.opengl.GLSurfaceView active, extra;   // active = view on screen (city or extra)
    private int scene = SC_CITY, autoStep = 0;
    private float sceneT = 0;
    private String effMode = "auto";

    private final Runnable label = new Runnable() {
        @Override public void run() {
            if (city == null) return;
            String lb = "";
            if (shown == Schedule.SHOW_CITY) lb = scene == SC_KAGE ? L.t("KAGE GT · SHOWROOM") : scene == SC_RACE ? L.t("KAGE GT · CORSA IN CITTÀ")
                : city.renderer.currentPalette + " · " + CityRenderer.modeName(city.renderer.currentMode);
            clock.setLabel(lb);
            clock.postDelayed(this, 1000);
        }
    };

    /** once a second: which scene should be on screen */
    private final Runnable sceneTick = new Runnable() {
        @Override public void run() {
            if (!started) return;
            sceneT += 1;
            int want = SC_CITY;
            if ("kage".equals(effMode)) want = SC_KAGE;
            else if ("race".equals(effMode)) want = SC_RACE;
            else if ("auto".equals(effMode) && prefs.autoScenes()) {
                // city (4 camera shots) → turnaround → city → autopilot run → …
                float cityLen = Math.max(80, prefs.cycleSec() * 4);
                float[] len = {cityLen, 75, cityLen, 120};
                if (sceneT > len[autoStep % 4]) { sceneT = 0; autoStep++; }
                int st = autoStep % 4;
                want = st == 1 ? SC_KAGE : st == 3 ? SC_RACE : SC_CITY;
            }
            if (want != scene && shown == Schedule.SHOW_CITY) setScene(want);
            h.postDelayed(this, 1000);
        }
    };

    private android.opengl.GLSurfaceView glView(android.opengl.GLSurfaceView.Renderer r) {
        android.opengl.GLSurfaceView v = new android.opengl.GLSurfaceView(this);
        v.setEGLContextClientVersion(2);
        v.setEGLConfigChooser(new CityView.Chooser());
        v.setRenderer(r);
        return v;
    }

    /** fade to black, swap the GL view, fade back in. No EngineSound is ever created here: the scenes are silent. */
    private void setScene(int sc) {
        scene = sc;
        black.animate().cancel();
        black.animate().alpha(1f).setDuration(700).withEndAction(() -> {
            if (!started) return;
            if (extra != null) { extra.onPause(); root.removeView(extra); extra = null; }
            if (scene == SC_CITY) {
                active = city; city.setVisibility(View.VISIBLE);
                if (cityRunning) { city.onResume(); }
            } else {
                if (cityRunning) city.onPause();
                city.setVisibility(View.GONE);   // two SurfaceViews have no reliable z-order: only one is ever visible
                String pal = curPalette.isEmpty() ? prefs.palette() : curPalette;
                if (scene == SC_KAGE) {
                    it.ampy.cybercity.game.ShowroomRenderer r = new it.ampy.cybercity.game.ShowroomRenderer(this);
                    r.demo = true; r.palette = pal;
                    extra = glView(r);
                } else {
                    it.ampy.cybercity.game.GameRenderer r = new it.ampy.cybercity.game.GameRenderer(this);
                    r.palette = pal; r.weather = Weather.effective(prefs);
                    r.startAutopilot();
                    extra = glView(r);
                }
                root.addView(extra, 1, new FrameLayout.LayoutParams(-1, -1));
                active = extra;
            }
            if (shown == Schedule.SHOW_CITY) black.animate().alpha(0f).setDuration(1200).start();
        }).start();
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!started) return;
            long elapsed = SystemClock.elapsedRealtime() - dreamStart;
            Schedule.State s = sch.resolve(Calendar.getInstance(), dndOn());
            int want = s.show;
            int bright = s.bright;
            if (want == Schedule.SHOW_CITY && !sch.cycleOn(elapsed)) { want = sch.pauseMode; bright = sch.pauseBright; }
            if (faceDown) { want = Schedule.SHOW_BLACK; bright = 1; }
            if (want == Schedule.SHOW_NONE) { finish(); return; }
            String wNow = Weather.effective(prefs);
            Weather.refreshIfStale(CyberDreamService.this, prefs, null);
            if (!s.palette.equals(curPalette) || !s.mode.equals(curMode) || !wNow.equals(curWeather)) {
                curPalette = s.palette; curMode = s.mode; curWeather = wNow;
                effMode = s.mode.isEmpty() ? prefs.mode() : s.mode;
                clock.setWeatherLine(prefs.weatherLine() ? Weather.line(prefs) : "");
                city.renderer.setConfig(prefs.snapshot().with(s.palette, s.mode));
                clock.setPalette(Palette.of(s.palette));
            }
            if (want != shown) show(want);
            if (bright != curBright) { curBright = bright; brightness(bright); }
            h.postDelayed(this, sch.nextCheckMs(elapsed));
        }
    };

    private final BroadcastReceiver unplug = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) { if (sch != null && sch.onlyCharging) finish(); }
    };

    @Override public void onAttachedToWindow() {
        L.init(this);
        super.onAttachedToWindow();
        prefs = Prefs.get(this);
        sch = new Schedule(prefs);
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(true);
        root = new FrameLayout(this);
        root.setBackgroundColor(0xff000000);
        city = new CityView(this, prefs);
        clock = new ClockOverlay(this);
        clock.setPalette(Palette.of(prefs.palette()));
        clock.setShowClock(prefs.clock());
        black = new View(this);
        black.setBackgroundColor(0xff000000);
        black.setAlpha(1f);
        root.addView(city, new FrameLayout.LayoutParams(-1, -1));
        root.addView(black, new FrameLayout.LayoutParams(-1, -1));
        root.addView(clock, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
    }

    private boolean charging() {
        Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        return b != null && b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
    }

    private boolean dndOn() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            int f = nm.getCurrentInterruptionFilter();
            return f != NotificationManager.INTERRUPTION_FILTER_ALL && f != NotificationManager.INTERRUPTION_FILTER_UNKNOWN;
        } catch (Exception e) { return false; }
    }

    /** -1 = follow the system, otherwise 1..100 %. */
    private void brightness(int pct) {
        Window w = getWindow();
        if (w == null) return;
        WindowManager.LayoutParams lp = w.getAttributes();
        lp.screenBrightness = pct < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : Math.max(0.01f, Math.min(1f, pct / 100f));
        w.setAttributes(lp);
    }

    @Override public void onDreamingStarted() {
        super.onDreamingStarted();
        if (city == null) return;
        if (sch.onlyCharging && !charging()) { finish(); return; }
        registerReceiver(unplug, new IntentFilter(Intent.ACTION_POWER_DISCONNECTED));
        started = true;
        dreamStart = SystemClock.elapsedRealtime();
        cityRunning = true;   // GLSurfaceView renders as soon as it is attached
        shown = -1;
        curPalette = ""; curMode = ""; curWeather = "";
        clock.post(label);
        h.post(tick);
        scene = SC_CITY; sceneT = 0; autoStep = 0; active = city;
        h.postDelayed(sceneTick, 1000);
        faceDown = false;
        if (prefs.faceDown() != 2) {
            sm = (SensorManager) getSystemService(SENSOR_SERVICE);
            Sensor acc = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            if (acc != null) sm.registerListener(this, acc, SensorManager.SENSOR_DELAY_NORMAL);
        }
        if (prefs.notifIcons() && NotifListener.granted(this)) NotifListener.setWatcher(clock::setNotificationIcons);
    }

    /** Phone turned face down for ~1 s → screensaver off; face up again → back on. */
    @Override public void onSensorChanged(SensorEvent e) {
        float z = e.values[2];
        long now = SystemClock.elapsedRealtime();
        boolean down = z < -8.0f && Math.abs(e.values[0]) < 3f && Math.abs(e.values[1]) < 3f;
        if (down) { faceUpSince = 0; if (faceDownSince == 0) faceDownSince = now; }
        else if (z > -5f) { faceDownSince = 0; if (faceUpSince == 0) faceUpSince = now; }
        if (!faceDown && faceDownSince != 0 && now - faceDownSince > 1000) {
            if (prefs.faceDown() == 1) { finish(); return; }
            faceDown = true; h.removeCallbacks(tick); h.post(tick);
        } else if (faceDown && faceUpSince != 0 && now - faceUpSince > 600) {
            faceDown = false; h.removeCallbacks(tick); h.post(tick);
        }
    }
    @Override public void onAccuracyChanged(Sensor s, int a) { }

    /** Fade between city / clock-only / black; the GL thread sleeps unless the city is on screen. */
    private void show(int what) {
        boolean first = shown == -1;
        shown = what;
        boolean clockOn = (prefs.clock() || prefs.notifIcons()) && what != Schedule.SHOW_BLACK;
        clock.setShowClock(prefs.clock());
        clock.setVisibility(clockOn ? View.VISIBLE : View.INVISIBLE);
        if (what == Schedule.SHOW_CITY) {
            if (!cityRunning) { cityRunning = true; if (active != null) active.onResume(); }
            black.animate().alpha(0f).setDuration(1500).start();
        } else {
            black.animate().alpha(1f).setDuration(first ? 0 : 1500).withEndAction(() -> {
                if (shown != Schedule.SHOW_CITY && cityRunning) { if (active != null) active.onPause(); cityRunning = false; }
            }).start();
        }
    }

    @Override public void onDreamingStopped() {
        started = false;
        h.removeCallbacksAndMessages(null);
        try { unregisterReceiver(unplug); } catch (Exception ignored) { }
        if (sm != null) { sm.unregisterListener(this); sm = null; }
        NotifListener.setWatcher(null);
        if (city != null) {
            clock.removeCallbacks(label);
            if (cityRunning) { if (active != null) active.onPause(); cityRunning = false; }
            if (extra != null) { root.removeView(extra); extra = null; }
            active = city; scene = SC_CITY; city.setVisibility(View.VISIBLE);
        }
        super.onDreamingStopped();
    }

    @Override public void onDetachedFromWindow() {
        city = null;
        super.onDetachedFromWindow();
    }
}
