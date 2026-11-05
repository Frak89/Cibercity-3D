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
        it.ampy.cybercity.L.init(this);
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
    @Override protected void onResume() { super.onResume(); if (list != null && list.getChildCount() > 0) rebuild(); }

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

    /* ============================== METEO ============================== */
    private void buildWeather() {
        section(L.t("METEO · NEBBIA, PIOGGIA, NEVE, TEMPORALE"));
        choice(L.t("EFFETTO METEO"), Weather.NAMES, Weather.index(p.weatherMode()), i -> p.putString("weather", Weather.KEYS[i]));
        if ("auto".equals(p.weatherMode())) {
            LinearLayout st = card();
            String live = p.liveWeather();
            st.addView(text(p.city().isEmpty() ? L.t("NESSUNA POSIZIONE IMPOSTATA") : "📍 " + p.city(), 13, ACC, true));
            st.addView(text(live.isEmpty() ? L.t("Meteo non ancora scaricato") : Weather.line(p) + " · aggiornato "
                + android.text.format.DateFormat.format("HH:mm", p.weatherTime()), 12, FG, false));
            st.addView(text(L.t("Fonte: Open-Meteo (gratuito, senza account). Si aggiorna ogni 30 minuti."), 11, MUTED, false));
            LinearLayout city = card();
            city.addView(text(L.t("CITTÀ  ›"), 14, ACC, true));
            city.addView(text(L.t("Scrivi la città per il meteo"), 11, MUTED, false));
            city.setOnClickListener(v -> {
                android.widget.EditText e = new android.widget.EditText(this);
                e.setHint("es. Roma, Milano, Treviso…"); e.setSingleLine(true);
                new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(L.t("CITTÀ")).setView(e)
                    .setPositiveButton(L.t("CERCA"), (d, w) -> runNet(() -> { Weather.geocode(p, e.getText().toString().trim()); Weather.refresh(this, p); }))
                    .setNegativeButton(L.t("ANNULLA"), null).show();
            });
            LinearLayout gps = card();
            gps.addView(text(L.t("USA LA POSIZIONE DEL TELEFONO  ›"), 14, ACC, true));
            gps.addView(text(L.t("Posizione approssimativa, solo per il meteo"), 11, MUTED, false));
            gps.setOnClickListener(v -> {
                if (checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[]{android.Manifest.permission.ACCESS_COARSE_LOCATION}, 11);
                else useGps();
            });
            LinearLayout upd = card();
            upd.addView(text(L.t("AGGIORNA ORA"), 14, ACC, true));
            upd.setOnClickListener(v -> runNet(() -> Weather.refresh(this, p)));
        }
        toggle(L.t("Meteo sotto l'orologio"), L.t("Icona, temperatura e condizione (con meteo automatico)"), p.weatherLine(), v -> p.putBool("wLine", v));
        LinearLayout pv = card();
        pv.addView(text(L.t("▶ ANTEPRIMA METEO"), 15, 0xffffd16a, true));
        pv.addView(text(L.t("Scegli un effetto e lo vedi subito sulla città; nell'anteprima il tasto METEO li fa scorrere tutti"), 11, MUTED, false));
        pv.setOnClickListener(v -> {
            String[] k = java.util.Arrays.copyOfRange(Weather.KEYS, 2, Weather.KEYS.length);
            String[] n = java.util.Arrays.copyOfRange(Weather.NAMES, 2, Weather.NAMES.length);
            new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(L.t("ANTEPRIMA"))
                .setItems(n, (d, i) -> startActivity(new Intent(this, MainActivity.class).putExtra("previewWeather", k[i]))).show();
        });
    }

    interface Net { void run() throws Exception; }
    private void runNet(Net n) {
        android.widget.Toast.makeText(this, L.t("Aggiorno il meteo…"), android.widget.Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            String err = null;
            try { n.run(); } catch (Exception e) { err = e.getMessage(); }
            String fe = err;
            runOnUiThread(() -> {
                if (fe != null) android.widget.Toast.makeText(this, L.t("Meteo: ") + fe, android.widget.Toast.LENGTH_LONG).show();
                rebuild();
            });
        }).start();
    }
    private void useGps() {
        p.putBool("wUseGps", true);
        if (!Weather.fromDevice(this, p)) android.widget.Toast.makeText(this, L.t("Posizione non disponibile: apri Maps una volta o scrivi la città"), android.widget.Toast.LENGTH_LONG).show();
        else runNet(() -> Weather.refresh(this, p));
        rebuild();
    }
    @Override public void onRequestPermissionsResult(int rc, String[] perms, int[] res) {
        if (rc == 11 && res.length > 0 && res[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) useGps();
    }

    /* ============================== OROLOGIO ============================== */
    private void colorPick(String title, int initial, java.util.function.IntConsumer on) {
        float[] hsv = new float[3]; android.graphics.Color.colorToHSV(initial, hsv);
        LinearLayout f = new LinearLayout(this); f.setOrientation(LinearLayout.VERTICAL); f.setPadding(dp(18), dp(10), dp(18), dp(4));
        View sw = new View(this); f.addView(sw, new LinearLayout.LayoutParams(-1, dp(46)));
        int[] cur = {initial};
        Runnable paint = () -> { cur[0] = android.graphics.Color.HSVToColor(hsv); GradientDrawable g = new GradientDrawable(); g.setColor(cur[0]); g.setCornerRadius(dp(8)); sw.setBackground(g); };
        String[] lab = {L.t("TINTA"), L.t("SATURAZIONE"), L.t("LUMINOSITÀ")}; int[] max = {360, 100, 100};
        SeekBar[] bars = new SeekBar[3];
        for (int k = 0; k < 3; k++) {
            final int kk = k;
            f.addView(text(lab[k], 11, MUTED, false));
            SeekBar b = new SeekBar(this); b.setMax(max[k]); b.setProgress((int) (k == 0 ? hsv[0] : hsv[k] * 100));
            b.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
                @Override public void onProgressChanged(SeekBar s, int pr, boolean u) { hsv[kk] = kk == 0 ? pr : pr / 100f; paint.run(); }
                @Override public void onStartTrackingTouch(SeekBar s) { }
                @Override public void onStopTrackingTouch(SeekBar s) { }
            });
            bars[k] = b; f.addView(b);
        }
        int[] presets = {0xffecfcff, 0xff00ffe2, 0xffff3ac8, 0xffffd16a, 0xffff2b4e, 0xff57ff8a, 0xff60a8ff, 0xffc797ff, 0xffff8a3d, 0xff9be7ff};
        LinearLayout row = new LinearLayout(this); row.setPadding(0, dp(8), 0, 0);
        for (int pc : presets) {
            View v = new View(this); GradientDrawable g = new GradientDrawable(); g.setColor(pc); g.setCornerRadius(dp(14)); v.setBackground(g);
            v.setOnClickListener(x -> { android.graphics.Color.colorToHSV(pc, hsv); bars[0].setProgress((int) hsv[0]); bars[1].setProgress((int) (hsv[1] * 100)); bars[2].setProgress((int) (hsv[2] * 100)); paint.run(); });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(26), dp(26)); lp.rightMargin = dp(5); row.addView(v, lp);
        }
        f.addView(row);
        paint.run();
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(title).setView(f)
            .setPositiveButton("OK", (d, w) -> { on.accept(cur[0]); rebuild(); }).setNegativeButton(L.t("ANNULLA"), null).show();
    }
    private void colorRow(String title, String key, int def) {
        LinearLayout c = card();
        LinearLayout h = new LinearLayout(this); h.setGravity(Gravity.CENTER_VERTICAL);
        View sw = new View(this); GradientDrawable g = new GradientDrawable(); g.setColor(p.i(key, def)); g.setCornerRadius(dp(12)); sw.setBackground(g);
        h.addView(sw, new LinearLayout.LayoutParams(dp(24), dp(24)));
        TextView t = text("  " + title + "  ▾", 14, FG, true); h.addView(t);
        c.addView(h);
        c.setOnClickListener(v -> colorPick(title, p.i(key, def), col -> p.putInt(key, col)));
    }

    private void buildClock() {
        section(L.t("OROLOGIO"));
        android.widget.FrameLayout pf = new android.widget.FrameLayout(this);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0xff05030c, 0xff2a1840});
        bg.setCornerRadius(dp(8)); pf.setBackground(bg);
        ClockOverlay preview = new ClockOverlay(this).preview();
        preview.setPalette(Palette.of(p.palette()));
        preview.setWeatherLine(p.weatherLine() ? Weather.line(p) : "");
        pf.addView(preview, new android.widget.FrameLayout.LayoutParams(-1, -1));
        LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(-1, dp(240)); plp.topMargin = dp(8);
        list.addView(pf, plp);
        list.addView(text(L.t("Anteprima dal vivo: ogni modifica si vede subito (gli effetti qui partono più spesso)"), 11, MUTED, false));
        toggle(L.t("Mostra orologio"), null, p.clock(), v -> p.putBool("clock", v));
        toggle("Secondi", null, p.b("clkSec", false), v -> p.putBool("clkSec", v));
        toggle("Data", null, p.b("clkDate", true), v -> p.putBool("clkDate", v));
        toggle("Formato 24 ore", null, p.b("clk24", true), v -> p.putBool("clk24", v));
        slider(L.t("DIMENSIONE"), 5, 40, p.i("clkSize", 16), " %", v -> p.putInt("clkSize", v));
        choice(L.t("STILE"), ClockOverlay.STYLES, p.i("clkStyle", 0), i -> p.putInt("clkStyle", i));
        int cm = p.i("clkColorMode", 4);
        choice(L.t("COLORI"), ClockOverlay.COLOR_MODES, cm, i -> p.putInt("clkColorMode", i));
        if (cm == 0) colorRow(L.t("COLORE"), "clkColor", 0xffecfcff);
        if (cm == 1) {
            String[] nm = {L.t("1ª CIFRA (decine ore)"), L.t("2ª CIFRA (unità ore)"), L.t("3ª CIFRA (decine minuti)"), L.t("4ª CIFRA (unità minuti)")};
            int[] dd = {0xff00ffe2, 0xffecfcff, 0xffff3ac8, 0xffffd16a};
            for (int i = 0; i < 4; i++) colorRow(nm[i], "clkDigit" + i, dd[i]);
            colorRow(L.t("DUE PUNTI  :"), "clkColon", 0xffecfcff);
        }
        if (cm == 2) {
            colorRow(L.t("SFUMATURA · COLORE A"), "clkGradA", 0xff00ffe2);
            colorRow(L.t("SFUMATURA · COLORE B"), "clkGradB", 0xffff3ac8);
        }
        if (cm == 2 || cm == 3) slider(L.t("VELOCITÀ DEI COLORI"), 0, 100, p.i("clkGradSpeed", 40), "", v -> p.putInt("clkGradSpeed", v));
        slider(L.t("BAGLIORE NEON"), 0, 100, p.i("clkGlow", 60), " %", v -> p.putInt("clkGlow", v));
        choice(L.t("MOVIMENTO"), ClockOverlay.MOVES, p.i("clkMove", 0), i -> p.putInt("clkMove", i));
        if (p.i("clkMove", 0) >= 1) slider(L.t("VELOCITÀ MOVIMENTO"), 5, 200, p.i("clkMoveSpeed", 50), " %", v -> p.putInt("clkMoveSpeed", v));
        if (p.i("clkMove", 0) <= 1) choice(L.t("POSIZIONE"), ClockOverlay.POSITIONS, p.i("clkPos", 0), i -> p.putInt("clkPos", i));
        LinearLayout fx = card();
        int mask = p.i("clkFx", 1);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ClockOverlay.EFFECTS.length; i++) if ((mask & (1 << i)) != 0) sb.append(sb.length() > 0 ? ", " : "").append(ClockOverlay.EFFECTS[i]);
        fx.addView(text(L.t("EFFETTI GRAFICI CASUALI"), 11, MUTED, false));
        fx.addView(text((sb.length() == 0 ? L.t("NESSUNO") : sb.toString()) + "  ▾", 14, ACC, true));
        fx.setOnClickListener(v -> {
            boolean[] ch = new boolean[ClockOverlay.EFFECTS.length];
            for (int i = 0; i < ch.length; i++) ch[i] = (p.i("clkFx", 1) & (1 << i)) != 0;
            new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(L.t("EFFETTI CASUALI"))
                .setMultiChoiceItems(ClockOverlay.EFFECTS, ch, (d, w, on) -> ch[w] = on)
                .setPositiveButton("OK", (d, w) -> { int m = 0; for (int i = 0; i < ch.length; i++) if (ch[i]) m |= 1 << i; p.putInt("clkFx", m); rebuild(); })
                .setNeutralButton(L.t("TUTTI"), (d, w) -> { p.putInt("clkFx", (1 << ClockOverlay.EFFECTS.length) - 1); rebuild(); })
                .setNegativeButton(L.t("ANNULLA"), null).show();
        });
        slider(L.t("FREQUENZA EFFETTI (ogni circa)"), 2, 120, p.i("clkFxEvery", 12), " s", v -> p.putInt("clkFxEvery", v));
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
        section(L.t("PROGRAMMAZIONE"));
        LinearLayout sum = card();
        sumView = text(new Schedule(p).summary(), 12, FG, false);
        sum.addView(sumView);

        section(L.t("LUMINOSITÀ"));
        choice(L.t("LUMINOSITÀ DEL SALVASCHERMO"), new String[]{L.t("COME IL SISTEMA"), L.t("PERSONALIZZATA")}, p.bright() < 0 ? 0 : 1,
            i -> p.putInt("bright", i == 0 ? Schedule.BRIGHT_SYSTEM : 40));
        if (p.bright() >= 0) slider(L.t("LUMINOSITÀ CITTÀ / OROLOGIO"), 1, 100, p.bright(), " %", v -> { p.putInt("bright", v); updSum(); });
        slider(L.t("LUMINOSITÀ IN PAUSA / NASCOSTO"), 1, 100, p.pauseBright(), " %", v -> { p.putInt("pauseBright", v); updSum(); });

        section(L.t("FASCE ORARIE · QUALE SALVASCHERMO E QUANDO"));
        list.addView(text(L.t("Ogni fascia sceglie cosa mostrare (città con la sua atmosfera, solo orologio, nero o niente) e con che luminosità. ")
            + L.t("Vince la prima fascia attiva che corrisponde all'ora."), 11, MUTED, false));
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
        add.addView(text(L.t("+ AGGIUNGI FASCIA"), 14, ACC, true));
        add.setOnClickListener(v -> { Schedule.Slot n = new Schedule.Slot(); n.name = L.t("FASCIA ") + (slots.size() + 1); n.from = 8 * 60; n.to = 12 * 60;
            slots.add(n); editSlot(slots, slots.size() - 1); });
        toggle(L.t("Fuori dalle fasce: non mostrare la città"), L.t("Spento = fuori fascia usa atmosfera e luminosità globali"), p.onlySlots(),
            v -> { p.putBool("onlySlots", v); updSum(); });

        section(L.t("ORARIO DI LAVORO · NON DISTURBARE"));
        toggle(L.t("Orario di lavoro"), L.t("In questo orario il salvaschermo non mostra la città"), p.workOn(), v -> { p.putBool("workOn", v); rebuild(); });
        if (p.workOn()) {
            timeRow(L.t("DALLE"), p.workFrom(), v -> p.putInt("workFrom", v));
            timeRow(L.t("ALLE"), p.workTo(), v -> p.putInt("workTo", v));
            LinearLayout dc = card();
            dc.addView(text(L.t("GIORNI DI LAVORO"), 12, MUTED, false));
            dc.addView(daysRow(p.workDays(), m -> { p.putInt("workDays", m); updSum(); }));
        }
        toggle(L.t("Rispetta il Non disturbare di Android"), L.t("Se la modalità Non disturbare (o una modalità Focus/Bedtime) è attiva, niente città"), p.respectDnd(),
            v -> { p.putBool("respectDnd", v); updSum(); });
        int[] hv = Schedule.PAUSE_VALUES; int hi = 1; for (int i = 0; i < hv.length; i++) if (hv[i] == p.hiddenMode()) hi = i;
        choice(L.t("QUANDO È NASCOSTO (lavoro / non disturbare / fuori fascia)"), Schedule.PAUSE_CHOICES, hi, i -> p.putInt("hiddenMode", hv[i]));

        section(L.t("CICLO E AVVIO"));
        toggle(L.t("Solo quando è in carica"), L.t("Se stacchi il caricatore il salvaschermo si chiude subito"), p.onlyCharging(),
            v -> { p.putBool("onlyCharging", v); updSum(); });
        slider(L.t("RITARDO DOPO LA MESSA IN CARICA / AVVIO"), 0, 60, p.delayMin(), " min", v -> { p.putInt("delayMin", v); updSum(); });
        slider(L.t("DURATA ANIMAZIONE (0 = sempre accesa)"), 0, 120, p.runMin(), " min", v -> { p.putInt("runMin", v); updSum(); });
        slider(L.t("PAUSA PRIMA CHE RICOMPAIA"), 1, 120, p.offMin(), " min", v -> { p.putInt("offMin", v); updSum(); });
        int pi = 0; for (int i = 0; i < hv.length; i++) if (hv[i] == p.pauseMode()) pi = i;
        choice(L.t("DURANTE LA PAUSA"), Schedule.PAUSE_CHOICES, pi, i -> p.putInt("pauseMode2", hv[i]));
        TextView note = text(L.t("Quando parte il salvaschermo lo decide Android: Impostazioni → Display → Salvaschermo → ")
            + L.t("\"Quando avviarlo\" (in carica / sul dock) e il timeout dello schermo. Questo programma regola cosa fa Cybercity da lì in poi."), 11, MUTED, false);
        note.setPadding(0, dp(8), 0, 0);
        list.addView(note);
        section(L.t("TELEFONO ROVESCIATO · NOTIFICHE"));
        choice(L.t("QUANDO ROVESCI IL TELEFONO (schermo verso il basso)"), Prefs.FACEDOWN_NAMES, p.faceDown(), i -> p.putInt("faceDown", i));
        toggle(L.t("Icone notifiche"), L.t("Sotto l'orologio: un'icona per ogni app con notifiche, senza numeri"), p.notifIcons(), v -> p.putBool("notifIcons", v));
        if (p.notifIcons() && !NotifListener.granted(this)) {
            LinearLayout g = card();
            g.addView(text(L.t("CONCEDI ACCESSO ALLE NOTIFICHE  ›"), 14, 0xffffd16a, true));
            g.addView(text(L.t("Serve solo per leggere le icone delle app; nessun contenuto viene letto o salvato."), 11, MUTED, false));
            g.setOnClickListener(v -> { try { startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); } catch (Exception ignored) { } });
        }
        buildWeather();
        buildClock();
        section(L.t("GRAFICA (GLOBALE)"));
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
        Switch on = new Switch(this); on.setText(L.t("Fascia attiva")); on.setTextColor(FG); on.setChecked(s.on);
        on.setOnCheckedChangeListener((b, v) -> s.on = v); f.addView(on);
        TextView from = text(L.t("DALLE ") + Schedule.hhmm(s.from) + "  ▾", 15, ACC, true), to = text(L.t("ALLE  ") + Schedule.hhmm(s.to) + "  ▾", 15, ACC, true);
        from.setPadding(0, dp(10), 0, dp(6)); to.setPadding(0, dp(6), 0, dp(6));
        from.setOnClickListener(v -> new TimePickerDialog(this, android.R.style.Theme_Material_Dialog_Alert,
            (tp, hh, mm) -> { s.from = hh * 60 + mm; from.setText(L.t("DALLE ") + Schedule.hhmm(s.from) + "  ▾"); }, s.from / 60, s.from % 60, true).show());
        to.setOnClickListener(v -> new TimePickerDialog(this, android.R.style.Theme_Material_Dialog_Alert,
            (tp, hh, mm) -> { s.to = hh * 60 + mm; to.setText(L.t("ALLE  ") + Schedule.hhmm(s.to) + "  ▾"); }, s.to / 60, s.to % 60, true).show());
        f.addView(from); f.addView(to);
        f.addView(daysRow(s.days, m -> s.days = m));
        TextView show = text("", 14, FG, true), pal = text("", 14, FG, true), mode = text("", 14, FG, true), br = text("", 14, FG, true);
        Runnable paint = () -> {
            show.setText(L.t("MOSTRA: ") + Schedule.SHOW_NAMES[s.show] + "  ▾");
            pal.setText(L.t("ATMOSFERA: ") + (s.palette.isEmpty() ? L.t("GLOBALE") : Palette.of(s.palette).name) + "  ▾");
            mode.setText(L.t("TELECAMERA: ") + (s.mode.isEmpty() ? L.t("GLOBALE") : CityRenderer.modeName(s.mode)) + "  ▾");
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
        show.setOnClickListener(v -> new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(L.t("COSA MOSTRARE"))
            .setSingleChoiceItems(Schedule.SHOW_NAMES, s.show, (d, i) -> { s.show = i; paint.run(); d.dismiss(); }).show());
        String[] pl = new String[Palette.NAMES.length + 1]; pl[0] = L.t("GLOBALE"); System.arraycopy(Palette.NAMES, 0, pl, 1, Palette.NAMES.length);
        pal.setOnClickListener(v -> new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(L.t("ATMOSFERA"))
            .setSingleChoiceItems(pl, s.palette.isEmpty() ? 0 : Palette.index(s.palette) + 1, (d, i) -> { s.palette = i == 0 ? "" : Palette.KEYS[i - 1]; paint.run(); d.dismiss(); }).show());
        String[] ml = new String[CityRenderer.ALL.length + 2]; ml[0] = L.t("GLOBALE"); ml[1] = L.t("AUTO (ciclo)");
        System.arraycopy(CityRenderer.ALL_NAMES, 0, ml, 2, CityRenderer.ALL.length);
        mode.setOnClickListener(v -> {
            int sel = 0; if ("auto".equals(s.mode)) sel = 1; for (int i = 0; i < CityRenderer.ALL.length; i++) if (CityRenderer.ALL[i].equals(s.mode)) sel = i + 2;
            new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(L.t("TELECAMERA"))
                .setSingleChoiceItems(ml, sel, (d, i) -> { s.mode = i == 0 ? "" : i == 1 ? "auto" : CityRenderer.ALL[i - 2]; paint.run(); d.dismiss(); }).show();
        });
        br.setOnClickListener(v -> new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(L.t("LUMINOSITÀ"))
            .setSingleChoiceItems(new String[]{L.t("GLOBALE"), L.t("COME IL SISTEMA"), L.t("PERSONALIZZATA (usa la barra)")},
                s.bright == Schedule.BRIGHT_GLOBAL ? 0 : s.bright == Schedule.BRIGHT_SYSTEM ? 1 : 2,
                (d, i) -> { s.bright = i == 0 ? Schedule.BRIGHT_GLOBAL : i == 1 ? Schedule.BRIGHT_SYSTEM : sb.getProgress() + 1; paint.run(); d.dismiss(); }).show());
        paint.run();
        ScrollView sv = new ScrollView(this); sv.addView(f);
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle(L.t("FASCIA ORARIA")).setView(sv)
            .setPositiveButton(L.t("SALVA"), (d, w) -> {
                String n = name.getText().toString().trim(); s.name = n.isEmpty() ? L.t("FASCIA") : n.toUpperCase(java.util.Locale.ROOT);
                p.putString("slots", Schedule.saveSlots(slots)); rebuild();
            })
            .setNeutralButton(L.t("ELIMINA"), (d, w) -> { slots.remove(idx); p.putString("slots", Schedule.saveSlots(slots)); rebuild(); })
            .setNegativeButton(L.t("ANNULLA"), (d, w) -> rebuild())
            .show();
    }

    private void build() {
        TextView h = text("// CYBERCITY 3D", 22, ACC, true);
        list.addView(h);
        list.addView(text(L.t("Salvaschermo 3D · città cyberpunk procedurale"), 12, MUTED, false));

        Button set = new Button(this);
        set.setText(L.t("IMPOSTA COME SALVASCHERMO"));
        set.setTextColor(BG); set.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        set.setBackgroundColor(ACC);
        set.setOnClickListener(v -> {
            try { startActivity(new Intent(Settings.ACTION_DREAM_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_DISPLAY_SETTINGS)); }
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(48)); lp.topMargin = dp(14);
        list.addView(set, lp);
        buildSchedule();

        choice(L.t("ATMOSFERA"), Palette.NAMES, Palette.index(p.palette()), i -> p.putString("palette", Palette.KEYS[i]));
        String[] modeLabels = new String[CityRenderer.ALL.length + 1];
        modeLabels[0] = L.t("AUTO (ciclo di tutte le telecamere)");
        System.arraycopy(CityRenderer.ALL_NAMES, 0, modeLabels, 1, CityRenderer.ALL.length);
        int ms = 0;
        for (int i = 0; i < CityRenderer.ALL.length; i++) if (CityRenderer.ALL[i].equals(p.mode())) ms = i + 1;
        choice(L.t("TELECAMERA"), modeLabels, ms, i -> p.putString("mode", i == 0 ? "auto" : CityRenderer.ALL[i - 1]));
        toggle(L.t("Scene KAGE GT nel ciclo AUTO"), L.t("Ogni tanto: giro dell'auto con configurazioni casuali e corsa in città col pilota automatico (senza suono)"), p.autoScenes(), v -> p.putBool("autoScenes", v));
        slider(L.t("DURATA DI OGNI INQUADRATURA (AUTO)"), 20, 120, p.cycleSec(), " s", v -> p.putInt("cycle", v));
        slider(L.t("VELOCITÀ DI VOLO"), 30, 250, p.speedPct(), " %", v -> p.putInt("speed", v));
        slider(L.t("PIOGGIA"), 0, 100, p.rainPct(), " %", v -> p.putInt("rain", v));
        slider(L.t("CAMPO VISIVO"), 45, 90, p.fov(), "°", v -> p.putInt("fov", v));
        toggle(L.t("Traffico volante"), L.t("Scie luminose di auto e spinner su più livelli"), p.traffic(), v -> p.putBool("traffic", v));
        toggle(L.t("Orologio glitch"), L.t("Si sposta di poco ogni minuto per proteggere lo schermo OLED"), p.clock(), v -> p.putBool("clock", v));
        toggle(L.t("Scanlines CRT"), null, p.scanlines(), v -> p.putBool("scanlines", v));
        int qi = 1; for (int i = 0; i < Prefs.QUALITY_VALUES.length; i++) if (Prefs.QUALITY_VALUES[i] == p.quality()) qi = i;
        choice(L.t("QUALITÀ DI RENDERING"), Prefs.QUALITY_LABELS, qi, i -> p.putInt("quality", Prefs.QUALITY_VALUES[i]));
        String[] fpsL = {L.t("30 FPS (risparmio)"), "45 FPS", L.t("60 FPS (fluido)")};
        int fi = 1; for (int i = 0; i < Prefs.FPS_VALUES.length; i++) if (Prefs.FPS_VALUES[i] == p.fps()) fi = i;
        choice(L.t("FREQUENZA FOTOGRAMMI"), fpsL, fi, i -> p.putInt("fps", Prefs.FPS_VALUES[i]));
        String[] seeds = {"2077 · Night City", "2019 · Los Angeles", "2049 · Megalopoli", "1988 · Neo Tokyo", "3030 · Arcologia"};
        int[] seedV = {2077, 2019, 2049, 1988, 3030};
        int si = 0; for (int i = 0; i < seedV.length; i++) if (seedV[i] == p.seed()) si = i;
        choice(L.t("PIANTA DELLA CITTÀ"), seeds, si, i -> p.putInt("seed", seedV[i]));

        TextView about = text("Davide Fraccaro · github.com/Frak89 · v" + version(), 11, MUTED, false);
        about.setGravity(Gravity.CENTER);
        about.setPadding(0, dp(18), 0, 0);
        list.addView(about);
    }

    private String version() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }
}
