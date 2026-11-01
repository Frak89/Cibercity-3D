package it.ampy.cybercity;

import android.service.dreams.DreamService;
import android.widget.FrameLayout;

/** The screensaver itself (Impostazioni → Display → Salvaschermo → Cybercity 3D). */
public class CyberDreamService extends DreamService {
    private CityView city;
    private ClockOverlay clock;
    private final Runnable label = new Runnable() {
        @Override public void run() {
            if (city == null) return;
            clock.setLabel(city.renderer.currentPalette + " · " + CityRenderer.modeName(city.renderer.currentMode));
            clock.postDelayed(this, 1000);
        }
    };

    @Override public void onAttachedToWindow() {
        super.onAttachedToWindow();
        Prefs p = Prefs.get(this);
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(!p.dim());
        FrameLayout root = new FrameLayout(this);
        city = new CityView(this, p);
        clock = new ClockOverlay(this);
        clock.setPalette(Palette.of(p.palette()));
        clock.setShowClock(p.clock());
        root.addView(city, new FrameLayout.LayoutParams(-1, -1));
        root.addView(clock, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
    }

    @Override public void onDreamingStarted() {
        super.onDreamingStarted();
        if (city != null) { city.onResume(); clock.post(label); }
    }

    @Override public void onDreamingStopped() {
        if (city != null) { city.onPause(); clock.removeCallbacks(label); }
        super.onDreamingStopped();
    }

    @Override public void onDetachedFromWindow() {
        city = null;
        super.onDetachedFromWindow();
    }
}
