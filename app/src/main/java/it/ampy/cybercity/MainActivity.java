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
import android.widget.ScrollView;
import android.content.res.Configuration;
import android.widget.TextView;

/** Full-screen live preview with a small panel: set as screensaver / settings. Tap to hide the panel. */
public class MainActivity extends Activity {
    private CityView city;
    private ClockOverlay clock;
    private LinearLayout panel;
    private ScrollView panelScroll;
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
        it.ampy.cybercity.L.init(this);
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
        // the menu scrolls (smoothly, with fading edges) when it doesn't fit — e.g. in landscape
        panelScroll = new ScrollView(this);
        panelScroll.setBackground(g); panelScroll.setVerticalFadingEdgeEnabled(true); panelScroll.setFadingEdgeLength(dp(24)); panelScroll.setSmoothScrollingEnabled(true);
        panelScroll.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS); panelScroll.setVerticalScrollBarEnabled(true); panelScroll.setScrollbarFadingEnabled(true);
        panelScroll.addView(panel, new FrameLayout.LayoutParams(-1, -2));
        TextView t = new TextView(this);
        t.setText("// CYBERCITY 3D");
        t.setTextColor(0xff00ffe2); t.setTextSize(22); t.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        panel.addView(t);
        TextView s = new TextView(this);
        s.setText(L.t("Anteprima dal vivo · tocca per nascondere"));
        s.setTextColor(0xff86adbf); s.setTextSize(13); s.setTypeface(Typeface.MONOSPACE);
        panel.addView(s);
        // Cybercity 3D: the story (everything — vehicles, ODYSSEY, NEXUS, tablet… — unlocks as you play), the showroom, the screensaver
        panel.addView(button(L.t("▶ GIOCA · IL SEGNALE DEI CUSTODI"), true, v -> startActivity(new Intent(this, it.ampy.cybercity.game.TrackActivity.class).putExtra("page", "game.html"))));
        panel.addView(button(L.t("✦ NUOVA PARTITA · DAL PROLOGO"), false, v -> new android.app.AlertDialog.Builder(this)
            .setTitle(L.t("Nuova partita")).setMessage(L.t("La storia ricomincia dal prologo e i veicoli tornano da sbloccare. Foto, costruzioni e trofei restano. Fai prima un salvataggio dal tablet se vuoi."))
            .setPositiveButton(L.t("RICOMINCIA"), (d, w) -> startActivity(new Intent(this, it.ampy.cybercity.game.TrackActivity.class).putExtra("page", "game.html").putExtra("new", true)))
            .setNegativeButton(L.t("ANNULLA"), null).show()));
        panel.addView(button(L.t("🎨 SHOWROOM · VEICOLI SBLOCCATI"), false, v -> startActivity(new Intent(this, it.ampy.cybercity.game.TrackActivity.class).putExtra("page", "showroom.html").putExtra("vehicle", "car"))));
        panel.addView(button(L.t("🌙 IMPOSTA COME SALVASCHERMO"), false, v -> {
            try { startActivity(new Intent(Settings.ACTION_DREAM_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_DISPLAY_SETTINGS)); }
        }));
        panel.addView(button(L.t("⚙ IMPOSTAZIONI"), false, v -> startActivity(new Intent(this, SettingsActivity.class))));
        panel.addView(button(L.english() ? "🌐 LANGUAGE: ENGLISH" : "🌐 LINGUA: ITALIANO", false, v -> {
            L.set(this, !L.english());
            Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (i != null) { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK); startActivity(i); }
            Runtime.getRuntime().exit(0);      // restart so every screen is rebuilt in the new language
        }));
        weatherBtn = button("", false, v -> {
            // cycle the preview through every weather effect (not saved)
            int i = previewWeather == null ? 1 : Weather.index(previewWeather);
            i = i + 1 >= Weather.KEYS.length ? 2 : Math.max(2, i + 1);
            previewWeather = Weather.KEYS[i];
            applyPreview();
        });
        panel.addView(weatherBtn);
        previewWeather = getIntent().getStringExtra("previewWeather");
        root.addView(panelScroll, panelParams(getResources().getConfiguration()));
        root.setOnClickListener(v -> panelScroll.setVisibility(panelScroll.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
        setContentView(root);
        if (android.os.Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
    }

    /** portrait: a column on the right; landscape: wider and from the top, scrolling */
    private FrameLayout.LayoutParams panelParams(Configuration c) {
        boolean land = c.orientation == Configuration.ORIENTATION_LANDSCAPE;
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Math.min(dp(land ? 420 : 340), getResources().getDisplayMetrics().widthPixels - dp(32)), -2, Gravity.TOP | Gravity.END);
        lp.setMargins(dp(16), dp(land ? 12 : 40), dp(16), dp(land ? 12 : 16)); return lp;
    }
    @Override public void onConfigurationChanged(Configuration c) { super.onConfigurationChanged(c); if (panelScroll != null) panelScroll.setLayoutParams(panelParams(c)); }

    private void applyPreview() {
        Prefs p = Prefs.get(this);
        String w = previewWeather != null ? previewWeather : Weather.effective(p);
        city.renderer.setConfig(p.snapshot().weather(w));
        weatherBtn.setText(L.t("METEO: ") + (previewWeather != null ? L.t("ANTEPRIMA ") : "") + Weather.name(w).replace(L.t(" (usa la pioggia manuale)"), "") + "  ›");
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
        // readable: the button grows with its text (two lines if needed) instead of cutting it in half
        b.setAllCaps(false); b.setTextSize(15); b.setLetterSpacing(0.02f); b.setLineSpacing(dp(2), 1f); b.setMaxLines(2);
        b.setGravity(Gravity.CENTER); b.setMinHeight(dp(52)); b.setMinimumHeight(dp(52)); b.setPadding(dp(14), dp(10), dp(14), dp(10)); b.setIncludeFontPadding(true);
        b.setStateListAnimator(null);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, LinearLayout.LayoutParams.WRAP_CONTENT);
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
