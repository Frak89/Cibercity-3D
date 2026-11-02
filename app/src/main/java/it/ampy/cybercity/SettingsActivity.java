package it.ampy.cybercity;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.TimePickerDialog;
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

    private void timeRow(String title, int min, java.util.function.IntConsumer on) {
        LinearLayout c = card();
        c.addView(text(title, 12, MUTED, false));
        c.addView(text(Schedule.hhmm(min) + "  ▾", 18, ACC, true));
        c.setOnClickListener(v -> new TimePickerDialog(this, android.R.style.Theme_Material_Dialog_Alert,
            (tp, h, m) -> { on.accept(h * 60 + m); rebuild(); }, min / 60, min % 60, true).show());
    }
    private void section(String s) {
        TextView t = text("■ " + s, 13, 0xffff3ac8, true);
        t.setPadding(0, dp(22), 0, dp(2));
        list.addView(t);
    }

    private TextView sumView;
    private void updSum() { if (sumView != null) sumView.setText(new Schedule(p).summary()); }

    private int brightPct(int v) { return v < 0 ? 50 : v; }

    /** Row of 7 day toggles (L M M G V S D). */
    private LinearLayout daysRow(int mask, java.util.function.IntConsumer on) {
        LinearLayout r = new LinearLayout(this);
        int[] m = {mask};
        for (int i = 0; i < 7; i++) {
            final int bit = 1 << i;
            TextView d = text(Schedule.DAYS[i], 14, FG, true);
            d.setGravity(Gravity.CENTER);
            Runnable paint = () -> {
                GradientDrawable g = new GradientDrawable(); g.setCornerRadius(dp(16));
                boolean sel = (m[0] & bit) != 0;
                g.setColor(sel ? ACC : 0x00000000); g.setStroke(dp(1), ACC);
                d.setBackground(g); d.setTextColor(sel ? BG : FG);
            };
            paint.run();
            d.setOnClickListener(v -> { m[0] ^= bit; paint.run(); on.accept(m[0]); });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(36), dp(32)); lp.rightMargin = dp(5); lp.topMargin = dp(6);
            r.addView(d, lp);
        }
        return r;
    }

    private void buildSchedule() {
        section("PROGRAMMAZIONE");
        LinearLayout sum = card();
        sumView = text(new Schedule(p).summary(), 12, FG, false);
        sum.addView(sumView);

        section("LUMINOSITÀ");
        choice("LUMINOSITÀ DEL SALVASCHERMO", new String[]{"COME IL SISTEMA", "PERSONALIZZATA"}, p.bright() < 0 ? 0 : 1,
            i -> p.putInt("bright", i == 0 ? Schedule.BRIGHT_SYSTEM : 40));
        if (p.bright() >= 0) slider("LUMINOSITÀ CITTÀ / OROLOGIO", 1, 100, p.bright(), " %", v -> { p.putInt("bright", v); updSum(); });
        slider("LUMINOSITÀ IN PAUSA / NASCOSTO", 1, 100, p.pauseBright(), " %", v -> { p.putInt("pauseBright", v); updSum(); });

        section("FASCE ORARIE · QUALE SALVASCHERMO E QUANDO");
        list.addView(text("Ogni fascia sceglie cosa mostrare (città con la sua atmosfera, solo orologio, nero o niente) e con che luminosità. "
            + "Vince la prima fascia attiva che corrisponde all'ora.", 11, MUTED, false));
        java.util.List<Schedule.Slot> slots = Schedule.loadSlots(p.slotsJson());
        for (int i = 0; i < slots.size(); i++) {
            final int idx = i;
            Schedule.Slot sl = slots.get(i);
            LinearLayout c = card();
            c.addView(text((sl.on ? "● " : "○ ") + sl.name, 15, sl.on ? ACC : MUTED, true));
            c.addView(text(sl.summary(), 12, sl.on ? FG : MUTED, false));
            c.setOnClickListener(v -> editSlot(slots, idx));
        }
        LinearLayout add = card();
        add.addView(text("+ AGGIUNGI FASCIA", 14, ACC, true));
        add.setOnClickListener(v -> { Schedule.Slot n = new Schedule.Slot(); n.name = "FASCIA " + (slots.size() + 1); n.from = 8 * 60; n.to = 12 * 60;
            slots.add(n); editSlot(slots, slots.size() - 1); });
        toggle("Fuori dalle fasce: non mostrare la città", "Spento = fuori fascia usa atmosfera e luminosità globali", p.onlySlots(),
            v -> { p.putBool("onlySlots", v); updSum(); });

        section("ORARIO DI LAVORO · NON DISTURBARE");
        toggle("Orario di lavoro", "In questo orario il salvaschermo non mostra la città", p.workOn(), v -> { p.putBool("workOn", v); rebuild(); });
        if (p.workOn()) {
            timeRow("DALLE", p.workFrom(), v -> p.putInt("workFrom", v));
            timeRow("ALLE", p.workTo(), v -> p.putInt("workTo", v));
            LinearLayout dc = card();
            dc.addView(text("GIORNI DI LAVORO", 12, MUTED, false));
            dc.addView(daysRow(p.workDays(), m -> { p.putInt("workDays", m); updSum(); }));
        }
        toggle("Rispetta il Non disturbare di Android", "Se la modalità Non disturbare (o una modalità Focus/Bedtime) è attiva, niente città", p.respectDnd(),
            v -> { p.putBool("respectDnd", v); updSum(); });
        int[] hv = Schedule.PAUSE_VALUES; int hi = 1; for (int i = 0; i < hv.length; i++) if (hv[i] == p.hiddenMode()) hi = i;
        choice("QUANDO È NASCOSTO (lavoro / non disturbare / fuori fascia)", Schedule.PAUSE_CHOICES, hi, i -> p.putInt("hiddenMode", hv[i]));

        section("CICLO E AVVIO");
        toggle("Solo quando è in carica", "Se stacchi il caricatore il salvaschermo si chiude subito", p.onlyCharging(),
            v -> { p.putBool("onlyCharging", v); updSum(); });
        slider("RITARDO DOPO LA MESSA IN CARICA / AVVIO", 0, 60, p.delayMin(), " min", v -> { p.putInt("delayMin", v); updSum(); });
        slider("DURATA ANIMAZIONE (0 = sempre accesa)", 0, 120, p.runMin(), " min", v -> { p.putInt("runMin", v); updSum(); });
        slider("PAUSA PRIMA CHE RICOMPAIA", 1, 120, p.offMin(), " min", v -> { p.putInt("offMin", v); updSum(); });
        int pi = 0; for (int i = 0; i < hv.length; i++) if (hv[i] == p.pauseMode()) pi = i;
        choice("DURANTE LA PAUSA", Schedule.PAUSE_CHOICES, pi, i -> p.putInt("pauseMode2", hv[i]));
        TextView note = text("Quando parte il salvaschermo lo decide Android: Impostazioni → Display → Salvaschermo → "
            + "\"Quando avviarlo\" (in carica / sul dock) e il timeout dello schermo. Questo programma regola cosa fa Cybercity da lì in poi.", 11, MUTED, false);
        note.setPadding(0, dp(8), 0, 0);
        list.addView(note);
        section("GRAFICA (GLOBALE)");
    }

    /** Editor of one time slot. */
    private void editSlot(java.util.List<Schedule.Slot> slots, int idx) {
        Schedule.Slot s = slots.get(idx);
        LinearLayout f = new LinearLayout(this);
        f.setOrientation(LinearLayout.VERTICAL);
        f.setPadding(dp(18), dp(8), dp(18), dp(8));
        android.widget.EditText name = new android.widget.EditText(this);
        name.setText(s.name); name.setTextColor(FG); name.setTypeface(Typeface.MONOSPACE); name.setSingleLine(true);
        f.addView(name);
        Switch on = new Switch(this); on.setText("Fascia attiva"); on.setTextColor(FG); on.setChecked(s.on);
        on.setOnCheckedChangeListener((b, v) -> s.on = v); f.addView(on);
        TextView from = text("DALLE " + Schedule.hhmm(s.from) + "  ▾", 15, ACC, true), to = text("ALLE  " + Schedule.hhmm(s.to) + "  ▾", 15, ACC, true);
        from.setPadding(0, dp(10), 0, dp(6)); to.setPadding(0, dp(6), 0, dp(6));
        from.setOnClickListener(v -> new TimePickerDialog(this, android.R.style.Theme_Material_Dialog_Alert,
            (tp, hh, mm) -> { s.from = hh * 60 + mm; from.setText("DALLE " + Schedule.hhmm(s.from) + "  ▾"); }, s.from / 60, s.from % 60, true).show());
        to.setOnClickListener(v -> new TimePickerDialog(this, android.R.style.Theme_Material_Dialog_Alert,
            (tp, hh, mm) -> { s.to = hh * 60 + mm; to.setText("ALLE  " + Schedule.hhmm(s.to) + "  ▾"); }, s.to / 60, s.to % 60, true).show());
        f.addView(from); f.addView(to);
        f.addView(daysRow(s.days, m -> s.days = m));
        TextView show = text("", 14, FG, true), pal = text("", 14, FG, true), mode = text("", 14, FG, true), br = text("", 14, FG, true);
        Runnable paint = () -> {
            show.setText("MOSTRA: " + Schedule.SHOW_NAMES[s.show] + "  ▾");
            pal.setText("ATMOSFERA: " + (s.palette.isEmpty() ? "GLOBALE" : Palette.of(s.palette).name) + "  ▾");
            mode.setText("TELECAMERA: " + (s.mode.isEmpty() ? "GLOBALE" : CityRenderer.modeName(s.mode)) + "  ▾");
            br.setText(Schedule.brightLabel(s.bright).toUpperCase(java.util.Locale.ROOT) + "  ▾");
            boolean city = s.show == Schedule.SHOW_CITY;
            pal.setAlpha(city ? 1 : 0.35f); mode.setAlpha(city ? 1 : 0.35f);
        };
        for (TextView t : new TextView[]{show, pal, mode, br}) { t.setPadding(0, dp(12), 0, dp(4)); f.addView(t); }
        SeekBar sb = new SeekBar(this); sb.setMax(99); sb.setProgress(brightPct(s.bright) - 1);
        sb.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar b, int pr, boolean u) { if (u) { s.bright = pr + 1; paint.run(); } }
            @Override public void onStartTrackingTouch(SeekBar b) { }
            @Override public void onStopTrackingTouch(SeekBar b) { }
        });
        f.addView(sb);
        show.setOnClickListener(v -> new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle("COSA MOSTRARE")
            .setSingleChoiceItems(Schedule.SHOW_NAMES, s.show, (d, i) -> { s.show = i; paint.run(); d.dismiss(); }).show());
        String[] pl = new String[Palette.NAMES.length + 1]; pl[0] = "GLOBALE"; System.arraycopy(Palette.NAMES, 0, pl, 1, Palette.NAMES.length);
        pal.setOnClickListener(v -> new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle("ATMOSFERA")
            .setSingleChoiceItems(pl, s.palette.isEmpty() ? 0 : Palette.index(s.palette) + 1, (d, i) -> { s.palette = i == 0 ? "" : Palette.KEYS[i - 1]; paint.run(); d.dismiss(); }).show());
        String[] ml = new String[CityRenderer.MODES.length + 2]; ml[0] = "GLOBALE"; ml[1] = "AUTO (ciclo)";
        System.arraycopy(CityRenderer.MODE_NAMES, 0, ml, 2, CityRenderer.MODES.length);
        mode.setOnClickListener(v -> {
            int sel = 0; if ("auto".equals(s.mode)) sel = 1; for (int i = 0; i < CityRenderer.MODES.length; i++) if (CityRenderer.MODES[i].equals(s.mode)) sel = i + 2;
            new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle("TELECAMERA")
                .setSingleChoiceItems(ml, sel, (d, i) -> { s.mode = i == 0 ? "" : i == 1 ? "auto" : CityRenderer.MODES[i - 2]; paint.run(); d.dismiss(); }).show();
        });
        br.setOnClickListener(v -> new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle("LUMINOSITÀ")
            .setSingleChoiceItems(new String[]{"GLOBALE", "COME IL SISTEMA", "PERSONALIZZATA (usa la barra)"},
                s.bright == Schedule.BRIGHT_GLOBAL ? 0 : s.bright == Schedule.BRIGHT_SYSTEM ? 1 : 2,
                (d, i) -> { s.bright = i == 0 ? Schedule.BRIGHT_GLOBAL : i == 1 ? Schedule.BRIGHT_SYSTEM : sb.getProgress() + 1; paint.run(); d.dismiss(); }).show());
        paint.run();
        ScrollView sv = new ScrollView(this); sv.addView(f);
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("FASCIA ORARIA").setView(sv)
            .setPositiveButton("SALVA", (d, w) -> {
                String n = name.getText().toString().trim(); s.name = n.isEmpty() ? "FASCIA" : n.toUpperCase(java.util.Locale.ROOT);
                p.putString("slots", Schedule.saveSlots(slots)); rebuild();
            })
            .setNeutralButton("ELIMINA", (d, w) -> { slots.remove(idx); p.putString("slots", Schedule.saveSlots(slots)); rebuild(); })
            .setNegativeButton("ANNULLA", (d, w) -> rebuild())
            .show();
    }

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
        buildSchedule();

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
