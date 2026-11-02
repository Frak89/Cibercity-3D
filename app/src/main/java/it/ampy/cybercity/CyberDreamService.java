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

    private final Runnable label = new Runnable() {
        @Override public void run() {
            if (city == null) return;
            clock.setLabel(shown == Schedule.SHOW_CITY ? city.renderer.currentPalette + " · " + CityRenderer.modeName(city.renderer.currentMode) : "");
            clock.postDelayed(this, 1000);
        }
    };

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
        super.onAttachedToWindow();
        prefs = Prefs.get(this);
        sch = new Schedule(prefs);
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(true);
        FrameLayout root = new FrameLayout(this);
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
            if (!cityRunning) { city.onResume(); cityRunning = true; }
            black.animate().alpha(0f).setDuration(1500).start();
        } else {
            black.animate().alpha(1f).setDuration(first ? 0 : 1500).withEndAction(() -> {
                if (shown != Schedule.SHOW_CITY && cityRunning) { city.onPause(); cityRunning = false; }
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
            if (cityRunning) { city.onPause(); cityRunning = false; }
        }
        super.onDreamingStopped();
    }

    @Override public void onDetachedFromWindow() {
        city = null;
        super.onDetachedFromWindow();
    }
}
