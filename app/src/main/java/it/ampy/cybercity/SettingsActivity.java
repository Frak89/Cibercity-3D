package it.ampy.cybercity;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;

/** Screensaver options (also opened from the system's screensaver gear icon). */
public class SettingsActivity extends Activity {
    static final int BG = 0xff070b13, PANEL = 0xff101d30, FG = 0xffecfcff, MUTED = 0xff86adbf, ACC = 0xff00ffe2;
    private Prefs p;
    private LinearLayout list;

    int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        p = Prefs.get(this);
        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(BG);
        sv.setFitsSystemWindows(true);
        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(dp(18), dp(18), dp(18), dp(28));
        sv.addView(list);
        setContentView(sv);
        build();
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color);
        t.setTypeface(Typeface.create(Typeface.MONOSPACE, bold ? Typeface.BOLD : Typeface.NORMAL));
        t.setLetterSpacing(0.06f);
        return t;
    }
    private LinearLayout card() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable g = new GradientDrawable();
        g.setColor(PANEL); g.setStroke(dp(1), 0xff214557); g.setCornerRadius(dp(6));
        c.setBackground(g);
        c.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(10);
        list.addView(c, lp);
        return c;
    }

    private void choice(String title, String[] labels, int sel, java.util.function.IntConsumer on) {
        LinearLayout c = card();
        c.addView(text(title, 12, MUTED, false));
        TextView v = text(labels[sel] + "  ▾", 16, ACC, true);
        c.addView(v);
        c.setOnClickListener(x -> new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle(title).setSingleChoiceItems(labels, sel, (d, i) -> { on.accept(i); d.dismiss(); rebuild(); }).show());
    }
    private void slider(String title, int min, int max, int val, String unit, java.util.function.IntConsumer on) {
        LinearLayout c = card();
        TextView t = text(title + ": " + val + unit, 12, MUTED, false);
        c.addView(t);
        SeekBar s = new SeekBar(this);
        s.setMax(max - min); s.setProgress(val - min);
        s.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar sb, int pr, boolean u) { t.setText(title + ": " + (pr + min) + unit); if (u) on.accept(pr + min); }
            @Override public void onStartTrackingTouch(SeekBar sb) { }
            @Override public void onStopTrackingTouch(SeekBar sb) { }
        });
        c.addView(s);
    }
    private void toggle(String title, String sub, boolean val, java.util.function.Consumer<Boolean> on) {
        LinearLayout c = card();
        Switch sw = new Switch(this);
        sw.setText(title); sw.setTextColor(FG); sw.setTextSize(15);
        sw.setTypeface(Typeface.MONOSPACE);
        sw.setChecked(val);
        sw.setOnCheckedChangeListener((bt, ch) -> on.accept(ch));
        c.addView(sw);
        if (sub != null) c.addView(text(sub, 11, MUTED, false));
    }

    private void rebuild() { list.removeAllViews(); build(); }

    private void build() {
        TextView h = text("// CYBERCITY 3D", 22, ACC, true);
        list.addView(h);
        list.addView(text("Salvaschermo 3D · città cyberpunk procedurale", 12, MUTED, false));

        Button set = new Button(this);
        set.setText("IMPOSTA COME SALVASCHERMO");
        set.setTextColor(BG); set.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        set.setBackgroundColor(ACC);
        set.setOnClickListener(v -> {
            try { startActivity(new Intent(Settings.ACTION_DREAM_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_DISPLAY_SETTINGS)); }
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(48)); lp.topMargin = dp(14);
        list.addView(set, lp);

        choice("ATMOSFERA", Palette.NAMES, Palette.index(p.palette()), i -> p.putString("palette", Palette.KEYS[i]));
        String[] modeLabels = new String[CityRenderer.MODES.length + 1];
        modeLabels[0] = "AUTO (ciclo di tutte le telecamere)";
        System.arraycopy(CityRenderer.MODE_NAMES, 0, modeLabels, 1, CityRenderer.MODES.length);
        int ms = 0;
        for (int i = 0; i < CityRenderer.MODES.length; i++) if (CityRenderer.MODES[i].equals(p.mode())) ms = i + 1;
        choice("TELECAMERA", modeLabels, ms, i -> p.putString("mode", i == 0 ? "auto" : CityRenderer.MODES[i - 1]));
        slider("DURATA DI OGNI INQUADRATURA (AUTO)", 20, 120, p.cycleSec(), " s", v -> p.putInt("cycle", v));
        slider("VELOCITÀ DI VOLO", 30, 250, p.speedPct(), " %", v -> p.putInt("speed", v));
        slider("PIOGGIA", 0, 100, p.rainPct(), " %", v -> p.putInt("rain", v));
        slider("CAMPO VISIVO", 45, 90, p.fov(), "°", v -> p.putInt("fov", v));
        toggle("Traffico volante", "Scie luminose di auto e spinner su più livelli", p.traffic(), v -> p.putBool("traffic", v));
        toggle("Orologio glitch", "Si sposta di poco ogni minuto per proteggere lo schermo OLED", p.clock(), v -> p.putBool("clock", v));
        toggle("Scanlines CRT", null, p.scanlines(), v -> p.putBool("scanlines", v));
        toggle("Schermo attenuato", "Luminosità ridotta durante il salvaschermo (notte)", p.dim(), v -> p.putBool("dim", v));
        int qi = 1; for (int i = 0; i < Prefs.QUALITY_VALUES.length; i++) if (Prefs.QUALITY_VALUES[i] == p.quality()) qi = i;
        choice("QUALITÀ DI RENDERING", Prefs.QUALITY_LABELS, qi, i -> p.putInt("quality", Prefs.QUALITY_VALUES[i]));
        String[] fpsL = {"30 FPS (risparmio)", "45 FPS", "60 FPS (fluido)"};
        int fi = 1; for (int i = 0; i < Prefs.FPS_VALUES.length; i++) if (Prefs.FPS_VALUES[i] == p.fps()) fi = i;
        choice("FREQUENZA FOTOGRAMMI", fpsL, fi, i -> p.putInt("fps", Prefs.FPS_VALUES[i]));
        String[] seeds = {"2077 · Night City", "2019 · Los Angeles", "2049 · Megalopoli", "1988 · Neo Tokyo", "3030 · Arcologia"};
        int[] seedV = {2077, 2019, 2049, 1988, 3030};
        int si = 0; for (int i = 0; i < seedV.length; i++) if (seedV[i] == p.seed()) si = i;
        choice("PIANTA DELLA CITTÀ", seeds, si, i -> p.putInt("seed", seedV[i]));

        TextView about = text("Davide Fraccaro · github.com/Frak89 · v" + version(), 11, MUTED, false);
        about.setGravity(Gravity.CENTER);
        about.setPadding(0, dp(18), 0, 0);
        list.addView(about);
    }

    private String version() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }
}
