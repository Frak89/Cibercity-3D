package it.ampy.cybercity;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.service.dreams.DreamService;
import android.view.View;
import android.widget.FrameLayout;

import java.util.Calendar;

/**
 * The screensaver itself (Impostazioni → Display → Salvaschermo → Cybercity 3D).
 * Follows the user's schedule: time window, start delay, animation / pause cycle, only while charging.
 */
public class CyberDreamService extends DreamService {
    private CityView city;
    private ClockOverlay clock;
    private View black;
    private Schedule sch;
    private long dreamStart;
    private boolean animating = false, cityRunning = false, started = false;
    private final Handler h = new Handler(Looper.getMainLooper());

    private final Runnable label = new Runnable() {
        @Override public void run() {
            if (city == null) return;
            clock.setLabel(animating ? city.renderer.currentPalette + " · " + CityRenderer.modeName(city.renderer.currentMode) : "");
            clock.postDelayed(this, 1000);
        }
    };

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!started) return;
            long elapsed = SystemClock.elapsedRealtime() - dreamStart;
            boolean want = sch.animate(elapsed, Calendar.getInstance());
            if (!want && sch.pauseMode == Schedule.PAUSE_CLOSE && elapsed >= sch.delayMin * 60_000L) { finish(); return; }
            if (want != animating) setAnimating(want);
            h.postDelayed(this, sch.nextCheckMs(elapsed));
        }
    };

    private final BroadcastReceiver unplug = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) { if (sch != null && sch.onlyCharging) finish(); }
    };

    @Override public void onAttachedToWindow() {
        super.onAttachedToWindow();
        Prefs p = Prefs.get(this);
        sch = new Schedule(p);
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(!p.dim());
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff000000);
        city = new CityView(this, p);
        clock = new ClockOverlay(this);
        clock.setPalette(Palette.of(p.palette()));
        clock.setShowClock(p.clock());
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

    @Override public void onDreamingStarted() {
        super.onDreamingStarted();
        if (city == null) return;
        if (sch.onlyCharging && !charging()) { finish(); return; }
        registerReceiver(unplug, new IntentFilter(Intent.ACTION_POWER_DISCONNECTED));
        started = true;
        dreamStart = SystemClock.elapsedRealtime();
        // GLSurfaceView renders as soon as it is attached: pause it right away if the schedule says so
        cityRunning = true;
        animating = !sch.animate(0, Calendar.getInstance());
        clock.setVisibility(Prefs.get(this).clock() && sch.pauseMode != Schedule.PAUSE_BLACK ? View.VISIBLE : View.INVISIBLE);
        clock.post(label);
        h.post(tick);
    }

    /** Fade between the animated city and the pause screen; the GL thread sleeps during pauses. */
    private void setAnimating(boolean on) {
        animating = on;
        Prefs p = Prefs.get(this);
        if (on) {
            if (!cityRunning) { city.onResume(); cityRunning = true; }
            black.animate().alpha(0f).setDuration(1500).start();
            clock.setVisibility(p.clock() ? View.VISIBLE : View.INVISIBLE);
            setScreenBright(!p.dim());
        } else {
            black.animate().alpha(1f).setDuration(1500).withEndAction(() -> {
                if (!animating && cityRunning) { city.onPause(); cityRunning = false; }
            }).start();
            clock.setVisibility(sch.pauseMode == Schedule.PAUSE_CLOCK && p.clock() ? View.VISIBLE : View.INVISIBLE);
            setScreenBright(false);
        }
    }

    @Override public void onDreamingStopped() {
        started = false;
        h.removeCallbacksAndMessages(null);
        try { unregisterReceiver(unplug); } catch (Exception ignored) { }
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
