package it.ampy.cybercity;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Full-screen live preview with a small panel: set as screensaver / settings. Tap to hide the panel. */
public class MainActivity extends Activity {
    private CityView city;
    private ClockOverlay clock;
    private LinearLayout panel;
    private String previewWeather = null;   // null = follow the settings
    private Button weatherBtn;
    private final Runnable label = new Runnable() {
        @Override public void run() {
            clock.setLabel(city.renderer.currentPalette + " · " + CityRenderer.modeName(city.renderer.currentMode));
            clock.postDelayed(this, 1000);
        }
    };

    int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Prefs p = Prefs.get(this);
        FrameLayout root = new FrameLayout(this);
        city = new CityView(this, p);
        city.renderer.setDemo(true);
        clock = new ClockOverlay(this);
        root.addView(city, new FrameLayout.LayoutParams(-1, -1));
        root.addView(clock, new FrameLayout.LayoutParams(-1, -1));

        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable g = new GradientDrawable();
        g.setColor(0xd9070b13); g.setStroke(dp(1), 0xff00ffe2); g.setCornerRadius(dp(8));
        panel.setBackground(g);
        TextView t = new TextView(this);
        t.setText("// CYBERCITY 3D");
        t.setTextColor(0xff00ffe2); t.setTextSize(18); t.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        panel.addView(t);
        TextView s = new TextView(this);
        s.setText("Anteprima dal vivo · tocca per nascondere");
        s.setTextColor(0xff86adbf); s.setTextSize(11); s.setTypeface(Typeface.MONOSPACE);
        panel.addView(s);
        panel.addView(button("IMPOSTA COME SALVASCHERMO", true, v -> {
            try { startActivity(new Intent(Settings.ACTION_DREAM_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_DISPLAY_SETTINGS)); }
        }));
        panel.addView(button("IMPOSTAZIONI", false, v -> startActivity(new Intent(this, SettingsActivity.class))));
        weatherBtn = button("", false, v -> {
            // cycle the preview through every weather effect (not saved)
            int i = previewWeather == null ? 1 : Weather.index(previewWeather);
            i = i + 1 >= Weather.KEYS.length ? 2 : Math.max(2, i + 1);
            previewWeather = Weather.KEYS[i];
            applyPreview();
        });
        panel.addView(weatherBtn);
        previewWeather = getIntent().getStringExtra("previewWeather");
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(300), -2, Gravity.TOP | Gravity.END);
        lp.setMargins(dp(16), dp(40), dp(16), dp(16));
        root.addView(panel, lp);
        root.setOnClickListener(v -> panel.setVisibility(panel.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
        setContentView(root);
        if (android.os.Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
    }

    private void applyPreview() {
        Prefs p = Prefs.get(this);
        String w = previewWeather != null ? previewWeather : Weather.effective(p);
        city.renderer.setConfig(p.snapshot().weather(w));
        weatherBtn.setText("METEO: " + (previewWeather != null ? "ANTEPRIMA " : "") + Weather.name(w).replace(" (usa la pioggia manuale)", "") + "  ›");
        clock.setWeatherLine(p.weatherLine() ? Weather.line(p) : "");
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); previewWeather = i.getStringExtra("previewWeather"); }

    private Button button(String text, boolean primary, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(text);
        b.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        b.setTextColor(primary ? 0xff070b13 : 0xff00ffe2);
        GradientDrawable g = new GradientDrawable();
        g.setColor(primary ? 0xff00ffe2 : 0x00000000); g.setStroke(dp(1), 0xff00ffe2); g.setCornerRadius(dp(4));
        b.setBackground(g);
        b.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(44));
        lp.topMargin = dp(10);
        b.setLayoutParams(lp);
        return b;
    }

    @Override protected void onResume() {
        super.onResume();
        Prefs p = Prefs.get(this);
        city.reload(p);
        applyPreview();
        Weather.refreshIfStale(this, p, () -> runOnUiThread(this::applyPreview));
        clock.setPalette(Palette.of(p.palette()));
        clock.setShowClock(p.clock());
        city.onResume();
        clock.post(label);
        WindowInsetsController c = android.os.Build.VERSION.SDK_INT >= 30 ? getWindow().getInsetsController() : null;
        if (c == null) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        else {
            c.hide(WindowInsets.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @Override protected void onPause() {
        clock.removeCallbacks(label);
        city.onPause();
        super.onPause();
    }
}
