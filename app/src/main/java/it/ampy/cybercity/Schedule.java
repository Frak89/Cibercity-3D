package it.ampy.cybercity;

import java.util.Calendar;
import java.util.Locale;

/**
 * When the city is animated while the screensaver is running:
 * time window, start delay after plugging in, animation / pause cycle.
 */
public final class Schedule {
    public static final int PAUSE_BLACK = 0, PAUSE_CLOCK = 1, PAUSE_CLOSE = 2;
    public static final String[] PAUSE_NAMES = {"SCHERMO NERO", "SOLO OROLOGIO", "CHIUDI SALVASCHERMO"};

    public final boolean windowOn, onlyCharging;
    public final int fromMin, toMin;       // minutes after midnight
    public final int delayMin, runMin, offMin, pauseMode;

    public Schedule(Prefs p) {
        windowOn = p.windowOn(); onlyCharging = p.onlyCharging();
        fromMin = p.fromMin(); toMin = p.toMin();
        delayMin = p.delayMin(); runMin = p.runMin(); offMin = p.offMin(); pauseMode = p.pauseMode();
    }

    /** True if 'now' is inside the window (handles windows across midnight, e.g. 22:00 → 07:00). */
    public boolean inWindow(Calendar now) {
        if (!windowOn || fromMin == toMin) return true;
        int m = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        return fromMin < toMin ? (m >= fromMin && m < toMin) : (m >= fromMin || m < toMin);
    }

    /** Should the animation run, given how long the screensaver has been on? */
    public boolean animate(long elapsedMs, Calendar now) {
        if (!inWindow(now)) return false;
        long e = elapsedMs - delayMin * 60_000L;
        if (e < 0) return false;
        if (runMin <= 0 || offMin <= 0) return true;
        long period = (runMin + offMin) * 60_000L;
        return e % period < runMin * 60_000L;
    }

    /** Milliseconds until the state may change (for the next check). */
    public long nextCheckMs(long elapsedMs) {
        long e = elapsedMs - delayMin * 60_000L;
        if (e < 0) return Math.min(-e, 30_000L);
        if (runMin <= 0 || offMin <= 0) return 30_000L;
        long period = (runMin + offMin) * 60_000L, pos = e % period;
        long left = pos < runMin * 60_000L ? runMin * 60_000L - pos : period - pos;
        return Math.max(500, Math.min(left, 30_000L));
    }

    public static String hhmm(int min) { return String.format(Locale.US, "%02d:%02d", min / 60, min % 60); }

    public String summary() {
        StringBuilder s = new StringBuilder();
        s.append(windowOn ? "Attivo dalle " + hhmm(fromMin) + " alle " + hhmm(toMin) : "Attivo a qualsiasi ora");
        if (onlyCharging) s.append(" · solo in carica");
        if (delayMin > 0) s.append("\nParte " + delayMin + " min dopo l'avvio del salvaschermo");
        if (runMin > 0 && offMin > 0) s.append("\nAnimazione " + runMin + " min → pausa " + offMin + " min (" + PAUSE_NAMES[pauseMode].toLowerCase(Locale.ROOT) + ") → riparte");
        else s.append("\nAnimazione continua, senza pause");
        return s.toString();
    }
}
