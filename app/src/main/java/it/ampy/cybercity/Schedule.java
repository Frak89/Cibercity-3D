package it.ampy.cybercity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * What the screensaver shows, and how bright, at any moment:
 * time slots (each with its own screensaver, brightness and days), work hours / Do Not Disturb,
 * start delay and the animation / pause cycle.
 */
public final class Schedule {
    /** What to put on screen. */
    public static final int SHOW_CITY = 0, SHOW_CLOCK = 1, SHOW_BLACK = 2, SHOW_NONE = 3;
    public static final String[] SHOW_NAMES = {"CITTÀ 3D", "SOLO OROLOGIO", "SCHERMO NERO", "NON MOSTRARE (chiudi)"};
    /** Legacy names for the pause choice (same values). */
    public static final int PAUSE_BLACK = SHOW_BLACK, PAUSE_CLOCK = SHOW_CLOCK, PAUSE_CLOSE = SHOW_NONE;
    public static final String[] PAUSE_CHOICES = {"SOLO OROLOGIO", "SCHERMO NERO", "CHIUDI SALVASCHERMO"};
    public static final int[] PAUSE_VALUES = {SHOW_CLOCK, SHOW_BLACK, SHOW_NONE};
    public static final String[] DAYS = {"L", "M", "M", "G", "V", "S", "D"};
    public static final int ALL_DAYS = 0x7f, WEEKDAYS = 0x1f;
    public static final int BRIGHT_SYSTEM = -1, BRIGHT_GLOBAL = -2;

    /** A time slot. palette/mode empty = use the global ones. */
    public static final class Slot {
        public boolean on = true;
        public String name = "FASCIA";
        public int from = 22 * 60, to = 7 * 60, days = ALL_DAYS;
        public int show = SHOW_CITY;
        public String palette = "", mode = "";
        public int bright = BRIGHT_GLOBAL;

        JSONObject json() throws Exception {
            return new JSONObject().put("on", on).put("name", name).put("from", from).put("to", to).put("days", days)
                .put("show", show).put("palette", palette).put("mode", mode).put("bright", bright);
        }
        static Slot of(JSONObject o) {
            Slot s = new Slot();
            s.on = o.optBoolean("on", true); s.name = o.optString("name", "FASCIA"); s.from = o.optInt("from", 0); s.to = o.optInt("to", 0);
            s.days = o.optInt("days", ALL_DAYS); s.show = o.optInt("show", SHOW_CITY); s.palette = o.optString("palette", "");
            s.mode = o.optString("mode", ""); s.bright = o.optInt("bright", BRIGHT_GLOBAL);
            return s;
        }
        public String summary() {
            StringBuilder b = new StringBuilder(hhmm(from) + "–" + hhmm(to) + "  " + days(days) + "\n" + SHOW_NAMES[show]);
            if (show == SHOW_CITY) b.append(" · ").append(palette.isEmpty() ? "atmosfera globale" : Palette.of(palette).name)
                .append(" · ").append(mode.isEmpty() ? "telecamera globale" : CityRenderer.modeName(mode));
            if (show != SHOW_NONE && show != SHOW_BLACK) b.append(" · ").append(brightLabel(bright));
            return b.toString();
        }
    }

    public final boolean onlyCharging, workOn, respectDnd;
    public final int delayMin, runMin, offMin, pauseMode, hiddenMode, bright, pauseBright;
    public final int workFrom, workTo, workDays;
    public final List<Slot> slots;
    private final String gPalette, gMode;

    public Schedule(Prefs p) {
        onlyCharging = p.onlyCharging();
        delayMin = p.delayMin(); runMin = p.runMin(); offMin = p.offMin(); pauseMode = p.pauseMode(); hiddenMode = p.hiddenMode();
        bright = p.bright(); pauseBright = p.pauseBright();
        workOn = p.workOn(); workFrom = p.workFrom(); workTo = p.workTo(); workDays = p.workDays(); respectDnd = p.respectDnd();
        slots = loadSlots(p.slotsJson());
        gPalette = p.palette(); gMode = p.mode();
        onlySlots = p.onlySlots();
    }

    public static List<Slot> loadSlots(String json) {
        List<Slot> l = new ArrayList<>();
        try { JSONArray a = new JSONArray(json); for (int i = 0; i < a.length(); i++) l.add(Slot.of(a.getJSONObject(i))); }
        catch (Exception ignored) { }
        return l;
    }
    public static String saveSlots(List<Slot> l) {
        JSONArray a = new JSONArray();
        try { for (Slot s : l) a.put(s.json()); } catch (Exception ignored) { }
        return a.toString();
    }

    /** day bit: Monday = bit 0 … Sunday = bit 6 */
    static int dayBit(Calendar c) { return 1 << ((c.get(Calendar.DAY_OF_WEEK) + 5) % 7); }

    /** Time range on given days; a range across midnight belongs to the day it starts on. */
    public static boolean matches(int from, int to, int days, Calendar now) {
        if (from == to) return (days & dayBit(now)) != 0;
        int m = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        if (from < to) return m >= from && m < to && (days & dayBit(now)) != 0;
        if (m >= from) return (days & dayBit(now)) != 0;
        if (m < to) { Calendar y = (Calendar) now.clone(); y.add(Calendar.DAY_OF_MONTH, -1); return (days & dayBit(y)) != 0; }
        return false;
    }

    /** Resolved state for "now". */
    public static final class State {
        public int show = SHOW_CITY;
        public String palette, mode, why = "";
        public int bright;
        public Slot slot;
    }

    public State resolve(Calendar now, boolean dnd) {
        State s = new State();
        s.palette = gPalette; s.mode = gMode; s.bright = bright;
        if (respectDnd && dnd) { s.show = hiddenMode; s.why = "NON DISTURBARE"; s.bright = pauseBright; return s; }
        if (workOn && matches(workFrom, workTo, workDays, now)) { s.show = hiddenMode; s.why = "ORARIO DI LAVORO"; s.bright = pauseBright; return s; }
        for (Slot sl : slots) {
            if (!sl.on || !matches(sl.from, sl.to, sl.days, now)) continue;
            s.slot = sl; s.show = sl.show; s.why = sl.name;
            if (!sl.palette.isEmpty()) s.palette = sl.palette;
            if (!sl.mode.isEmpty()) s.mode = sl.mode;
            if (sl.bright != BRIGHT_GLOBAL) s.bright = sl.bright;
            return s;
        }
        if (!slots.isEmpty() && onlySlots) { s.show = hiddenMode; s.why = "FUORI FASCIA"; s.bright = pauseBright; }
        return s;
    }
    /** When slots exist, outside all slots the screensaver is hidden (set by Prefs). */
    public boolean onlySlots;

    /** Animation / pause cycle (only for SHOW_CITY). */
    public boolean cycleOn(long elapsedMs) {
        long e = elapsedMs - delayMin * 60_000L;
        if (e < 0) return false;
        if (runMin <= 0 || offMin <= 0) return true;
        long period = (runMin + offMin) * 60_000L;
        return e % period < runMin * 60_000L;
    }

    public long nextCheckMs(long elapsedMs) {
        long e = elapsedMs - delayMin * 60_000L;
        if (e < 0) return Math.max(500, Math.min(-e, 20_000L));
        if (runMin <= 0 || offMin <= 0) return 20_000L;
        long period = (runMin + offMin) * 60_000L, pos = e % period;
        long left = pos < runMin * 60_000L ? runMin * 60_000L - pos : period - pos;
        return Math.max(500, Math.min(left, 20_000L));
    }

    public static String hhmm(int min) { return String.format(Locale.US, "%02d:%02d", (min / 60) % 24, min % 60); }
    public static String days(int mask) {
        if (mask == ALL_DAYS) return "tutti i giorni";
        if (mask == WEEKDAYS) return "lun–ven";
        if (mask == 0x60) return "sab–dom";
        StringBuilder b = new StringBuilder();
        String[] n = {"lun", "mar", "mer", "gio", "ven", "sab", "dom"};
        for (int i = 0; i < 7; i++) if ((mask & (1 << i)) != 0) b.append(b.length() > 0 ? " " : "").append(n[i]);
        return b.length() == 0 ? "nessun giorno" : b.toString();
    }
    public static String brightLabel(int b) {
        if (b == BRIGHT_SYSTEM) return "luminosità di sistema";
        if (b == BRIGHT_GLOBAL) return "luminosità globale";
        return "luminosità " + b + "%";
    }

    public String summary() {
        StringBuilder s = new StringBuilder();
        s.append(onlyCharging ? "Solo in carica" : "In carica e no");
        s.append(" · ").append(brightLabel(bright)).append(" (pausa ").append(pauseBright).append("%)");
        if (workOn) s.append("\nLavoro / non disturbare: ").append(hhmm(workFrom)).append("–").append(hhmm(workTo)).append(" ").append(days(workDays));
        if (respectDnd) s.append("\nRispetta il Non disturbare di Android");
        int active = 0; for (Slot sl : slots) if (sl.on) active++;
        s.append("\n").append(active).append(" fasce orarie attive").append(onlySlots && active > 0 ? " (fuori fascia: nascosto)" : "");
        if (delayMin > 0) s.append("\nParte ").append(delayMin).append(" min dopo l'avvio");
        if (runMin > 0 && offMin > 0) s.append("\nAnimazione ").append(runMin).append(" min → pausa ").append(offMin).append(" min → riparte");
        else s.append("\nAnimazione continua, senza pause");
        return s.toString();
    }
}
