package it.ampy.cybercity;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Camera;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.Icon;
import android.os.SystemClock;
import android.view.View;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Random;

/**
 * Customisable clock: size, style (fonts, neon, 7-segment, LED matrix), colours (single, per digit,
 * moving chromatic gradient, rainbow, atmosphere), movement (still, drift, bounce, float, orbit)
 * and random graphic effects. Settings are read live from Prefs.
 */
public class ClockOverlay extends View implements SharedPreferences.OnSharedPreferenceChangeListener {
    static final String GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>/|ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ";
    static final String[] DAYS = {"DOMENICA", "LUNEDÌ", "MARTEDÌ", "MERCOLEDÌ", "GIOVEDÌ", "VENERDÌ", "SABATO"};

    public static final String[] STYLES = {"CYBER MONO", "PIXEL SOTTILE", "LIGHT", "CONDENSATO", "BLACK", "SERIF", "NEON CONTORNO", "7 SEGMENTI", "LED A PUNTINI"};
    public static final String[] COLOR_MODES = {"COLORE UNICO", "COLORE PER OGNI CIFRA", "SFUMATURA CROMATICA IN MOVIMENTO", "ARCOBALENO", "COME L'ATMOSFERA"};
    public static final String[] MOVES = {"FERMO (anti burn-in)", "DERIVA LENTA", "RIMBALZO (stile DVD)", "FLUTTUA", "ORBITA"};
    public static final String[] POSITIONS = {"IN BASSO A SINISTRA", "IN BASSO AL CENTRO", "AL CENTRO", "IN ALTO A SINISTRA", "IN ALTO AL CENTRO"};
    public static final String[] EFFECTS = {"GLITCH (strappi + RGB)", "DECODIFICA CIFRE", "SFARFALLIO NEON", "ONDA", "ABERRAZIONE CROMATICA", "PULSAZIONE", "GIRO 3D", "SCANLINE"};

    private final Random R = new Random();
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG), small = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Prefs prefs;

    // config
    private boolean showClock = true, seconds, date = true, h24 = true, preview;
    private int size = 16, style = 0, colorMode = 4, color = 0xffecfcff, gradA = 0xff00ffe2, gradB = 0xffff3ac8, glow = 60;
    private final int[] digit = {0xff00ffe2, 0xffecfcff, 0xffff3ac8, 0xffffd16a};
    private int colonColor = 0xffecfcff, gradSpeed = 40, move = 0, moveSpeed = 50, pos = 0, fxMask = 1, fxEvery = 12;
    private int accent = 0xff00ffe2, second = 0xffff3ac8;
    private String label = "";

    // runtime
    private String last = "";
    private long[] lockAt = new long[0];
    private long fxUntil = 0, fxStart = 0, nextFx = 0;
    private int fx = -1;
    private float driftX, driftY; private long lastDrift = 0;
    private float bx = -1, by = -1, vx = 1, vy = 1; private long lastFrame = 0;
    private final long t0 = SystemClock.uptimeMillis();
    private final Camera cam3d = new Camera();
    private final Matrix mtx = new Matrix();

    public ClockOverlay(Context c) {
        super(c);
        prefs = Prefs.get(c);
        small.setTypeface(Typeface.MONOSPACE);
        small.setLetterSpacing(0.3f);
        reload();
    }

    /** Settings preview: always shows the clock, effects more often. */
    public ClockOverlay preview() { preview = true; return this; }

    @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); prefs.raw().registerOnSharedPreferenceChangeListener(this); }
    @Override protected void onDetachedFromWindow() { prefs.raw().unregisterOnSharedPreferenceChangeListener(this); super.onDetachedFromWindow(); }
    @Override public void onSharedPreferenceChanged(SharedPreferences s, String k) { reload(); invalidate(); }

    public void reload() {
        showClock = prefs.clock();
        seconds = prefs.b("clkSec", false); date = prefs.b("clkDate", true); h24 = prefs.b("clk24", true);
        size = prefs.i("clkSize", 16); style = prefs.i("clkStyle", 0); colorMode = prefs.i("clkColorMode", 4);
        color = prefs.i("clkColor", 0xffecfcff); gradA = prefs.i("clkGradA", 0xff00ffe2); gradB = prefs.i("clkGradB", 0xffff3ac8);
        gradSpeed = prefs.i("clkGradSpeed", 40); glow = prefs.i("clkGlow", 60);
        for (int i = 0; i < 4; i++) digit[i] = prefs.i("clkDigit" + i, digit[i]);
        colonColor = prefs.i("clkColon", 0xffecfcff);
        move = prefs.i("clkMove", 0); moveSpeed = prefs.i("clkMoveSpeed", 50); pos = prefs.i("clkPos", 0);
        fxMask = prefs.i("clkFx", 1); fxEvery = prefs.i("clkFxEvery", 12);
        Typeface tf;
        switch (style) {
            case 1: tf = Typeface.create("sans-serif-thin", Typeface.NORMAL); break;
            case 2: tf = Typeface.create("sans-serif-light", Typeface.NORMAL); break;
            case 3: tf = Typeface.create("sans-serif-condensed", Typeface.BOLD); break;
            case 4: tf = Typeface.create("sans-serif-black", Typeface.NORMAL); break;
            case 5: tf = Typeface.create(Typeface.SERIF, Typeface.BOLD); break;
            case 6: tf = Typeface.create("sans-serif-light", Typeface.NORMAL); break;
            default: tf = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD);
        }
        fill.setTypeface(tf);
        fill.setLetterSpacing(style == 0 ? 0.06f : 0.02f);
        last = "";
    }

    public void setPalette(Palette p) { accent = Palette.argb(p.neonA); second = Palette.argb(p.neonB); invalidate(); }
    public void setShowClock(boolean b) { showClock = b; invalidate(); }
    public void setLabel(String s) { label = s; }
    private String weatherLine = "";
    public void setWeatherLine(String s) { weatherLine = s == null ? "" : s; invalidate(); }

    /* ---------------- notification icons (icon only, no count) ---------------- */
    private final List<Drawable> icons = new ArrayList<>();
    public void setNotificationIcons(List<Icon> list) {
        post(() -> {
            icons.clear();
            if (list != null) for (Icon ic : list) {
                if (icons.size() >= 8) break;
                try { Drawable d = ic.loadDrawable(getContext()); if (d != null) icons.add(d.mutate()); } catch (Exception ignored) { }
            }
            invalidate();
        });
    }
    private void drawIcons(Canvas c, float x, float y, float sz, int tintA, int tintB) {
        float gap = sz * 0.55f;
        for (Drawable d : icons) {
            int l = (int) x, t = (int) (y - sz), r = (int) (x + sz), b = (int) y;
            d.setBounds(l - 2, t, r - 2, b); d.setTint(a(tintB, 170)); d.draw(c);
            d.setBounds(l + 2, t, r + 2, b); d.setTint(a(tintA, 170)); d.draw(c);
            d.setBounds(l, t, r, b); d.setTint(0xffecfcff); d.draw(c);
            x += sz + gap;
        }
    }

    private static int a(int c, int alpha) { return (c & 0x00ffffff) | (Math.max(0, Math.min(255, alpha)) << 24); }

    /* ---------------- glyph layout ---------------- */
    private float textH;          // digit height in px
    private float[] cx = new float[0], cw = new float[0];
    private float totalW;

    private boolean custom() { return style == 7 || style == 8; }

    private void layout(String s) {
        int n = s.length();
        if (cx.length != n) { cx = new float[n]; cw = new float[n]; }
        float x = 0;
        for (int i = 0; i < n; i++) {
            char ch = s.charAt(i);
            float w;
            if (custom()) w = ch == ':' ? textH * 0.32f : textH * 0.62f;
            else w = fill.measureText(String.valueOf(ch)) + fill.getTextSize() * fill.getLetterSpacing();
            cx[i] = x; cw[i] = w; x += w;
        }
        totalW = x;
    }

    /** colour of the i-th char (digit index skips ':') */
    private int colorAt(String s, int i, float t) {
        char ch = s.charAt(i);
        int di = 0; for (int k = 0; k < i; k++) if (Character.isDigit(s.charAt(k)) || s.charAt(k) > 0x3000) di++;
        switch (colorMode) {
            case 0: return color;
            case 1: return ch == ':' ? colonColor : digit[di % 4];
            case 3: return Color.HSVToColor(new float[]{(t * gradSpeed * 0.9f + i * 38) % 360f, 0.75f, 1f});
            case 4: return 0xffecfcff;
            default: return 0xffffffff; // gradient: shader carries the colour
        }
    }

    private void drawGlyph(Canvas c, char ch, float x, float base, float w, Paint p) {
        if (style == 7) { seg(c, ch, x, base - textH, w, textH, p); return; }
        if (style == 8) { led(c, ch, x, base - textH, w, textH, p); return; }
        c.drawText(String.valueOf(ch), x, base, p);
    }

    private static final int[] SEG = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
    private void seg(Canvas c, char ch, float x, float top, float w, float h, Paint p) {
        float t = w * 0.15f, pad = w * 0.12f, l = x + pad, r = x + w - pad, mid = top + h / 2, bot = top + h;
        if (ch == ':') {
            float d = t * 0.9f, ccx = x + w / 2;
            c.drawRect(ccx - d / 2, top + h * 0.3f - d / 2, ccx + d / 2, top + h * 0.3f + d / 2, p);
            c.drawRect(ccx - d / 2, top + h * 0.7f - d / 2, ccx + d / 2, top + h * 0.7f + d / 2, p);
            return;
        }
        int m = Character.isDigit(ch) ? SEG[ch - '0'] : SEG[R.nextInt(10)];
        int col = p.getColor(), al = p.getAlpha();
        float[][] rs = {
            {l + t, top, r - t, top + t}, {r - t, top + t * 0.6f, r, mid - t * 0.3f}, {r - t, mid + t * 0.3f, r, bot - t * 0.6f},
            {l + t, bot - t, r - t, bot}, {l, mid + t * 0.3f, l + t, bot - t * 0.6f}, {l, top + t * 0.6f, l + t, mid - t * 0.3f},
            {l + t, mid - t / 2, r - t, mid + t / 2}};
        for (int k = 0; k < 7; k++) {
            boolean on = (m & (1 << k)) != 0;
            p.setAlpha(on ? al : al / 12);
            c.drawRoundRect(rs[k][0], rs[k][1], rs[k][2], rs[k][3], t / 2, t / 2, p);
        }
        p.setColor(col); p.setAlpha(al);
    }

    private static final int[][] DOT = {
        {0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E}, {0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E}, {0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F},
        {0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E}, {0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02}, {0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E},
        {0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E}, {0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08}, {0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E},
        {0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C}};
    private void led(Canvas c, char ch, float x, float top, float w, float h, Paint p) {
        float cell = h / 7f, rad = cell * 0.36f;
        int al = p.getAlpha();
        if (ch == ':') {
            float ccx = x + w / 2;
            c.drawCircle(ccx, top + cell * 2.5f, rad, p); c.drawCircle(ccx, top + cell * 4.5f, rad, p);
            return;
        }
        int[] g = DOT[Character.isDigit(ch) ? ch - '0' : R.nextInt(10)];
        float ox = x + (w - cell * 5) / 2;
        for (int row = 0; row < 7; row++) for (int col = 0; col < 5; col++) {
            boolean on = (g[row] & (1 << (4 - col))) != 0;
            p.setAlpha(on ? al : al / 14);
            c.drawCircle(ox + col * cell + cell / 2, top + row * cell + cell / 2, rad, p);
        }
        p.setAlpha(al);
    }

    /* ---------------- effects ---------------- */
    private void maybeFx(long now) {
        if (fxMask == 0) { fx = -1; return; }
        if (now < fxUntil) return;
        fx = -1;
        if (nextFx == 0) nextFx = now + 2000;
        if (now < nextFx) return;
        List<Integer> on = new ArrayList<>();
        for (int i = 0; i < EFFECTS.length; i++) if ((fxMask & (1 << i)) != 0) on.add(i);
        if (on.isEmpty()) return;
        fx = on.get(R.nextInt(on.size()));
        fxStart = now;
        fxUntil = now + (fx == 6 ? 900 : fx == 1 ? 500 : 650);
        if (fx == 1) scramble(last, now);
        long every = (preview ? Math.min(4, fxEvery) : fxEvery) * 1000L;
        nextFx = now + (long) (every * (0.5 + R.nextFloat()));
    }
    private void scramble(String s, long now) {
        lockAt = new long[s.length()];
        for (int i = 0; i < s.length(); i++) lockAt[i] = now + 70L * i + R.nextInt(220);
    }

    /* ---------------- draw ---------------- */
    @Override protected void onDraw(Canvas c) {
        long now = SystemClock.uptimeMillis();
        float t = (now - t0) / 1000f;
        float W = getWidth(), H = getHeight(), m = Math.min(W, H);
        if (W == 0) return;
        float dt = lastFrame == 0 ? 0.016f : Math.min(0.1f, (now - lastFrame) / 1000f);
        lastFrame = now;
        boolean animating = false;
        boolean clockVisible = showClock || preview;

        if (clockVisible) {
            Calendar cal = Calendar.getInstance();
            int hh = cal.get(Calendar.HOUR_OF_DAY);
            if (!h24) { hh = hh % 12; if (hh == 0) hh = 12; }
            String s = String.format("%02d:%02d", hh, cal.get(Calendar.MINUTE)) + (seconds ? String.format(":%02d", cal.get(Calendar.SECOND)) : "");
            if (!s.equals(last)) {
                boolean minuteChange = last.length() < 5 || !s.substring(0, 5).equals(last.substring(0, Math.min(5, last.length())));
                last = s;
                if (minuteChange && (fxMask & 2) != 0) scramble(s, now);
                else if (lockAt.length != s.length()) lockAt = new long[s.length()];
            }
            maybeFx(now);
            char[] shown = s.toCharArray();
            boolean scrambling = false;
            for (int i = 0; i < shown.length; i++)
                if (shown[i] != ':' && i < lockAt.length && now < lockAt[i]) {
                    shown[i] = custom() ? (char) ('0' + R.nextInt(10)) : GLYPHS.charAt(R.nextInt(GLYPHS.length())); scrambling = true;
                }
            String txt = new String(shown);

            float ts = m * size / 100f;
            fill.setTextSize(ts);
            Paint.FontMetrics fm = fill.getFontMetrics();
            textH = custom() ? ts * 0.78f : -fm.ascent * 0.95f;
            layout(txt);
            float dateH = date ? m * 0.045f : 0;
            float iconsH = (icons.isEmpty() ? 0 : m * 0.06f) + (weatherLine.isEmpty() ? 0 : m * 0.04f);
            float blockW = Math.max(totalW, m * 0.4f), blockH = textH + dateH + iconsH;

            // position / movement
            float margin = m * 0.05f;
            float ax, ay;
            switch (pos) {
                case 1: ax = (W - blockW) / 2; ay = H * 0.88f - blockH; break;
                case 2: ax = (W - blockW) / 2; ay = (H - blockH) / 2; break;
                case 3: ax = margin; ay = H * 0.08f; break;
                case 4: ax = (W - blockW) / 2; ay = H * 0.08f; break;
                default: ax = margin; ay = H * 0.88f - blockH;
            }
            float sp = moveSpeed / 50f;
            float x0, y0;
            switch (move) {
                case 1: x0 = ax + (float) Math.sin(t * 0.05f * sp) * m * 0.05f; y0 = ay + (float) Math.sin(t * 0.037f * sp + 1) * m * 0.04f; animating = true; break;
                case 2: {
                    if (bx < 0) { bx = ax; by = ay; }
                    float v = m * 0.06f * sp;
                    bx += vx * v * dt; by += vy * v * dt;
                    if (bx < 0) { bx = 0; vx = 1; } if (bx > W - blockW) { bx = W - blockW; vx = -1; }
                    if (by < 0) { by = 0; vy = 1; } if (by > H - blockH) { by = H - blockH; vy = -1; }
                    x0 = bx; y0 = by; animating = true; break;
                }
                case 3: x0 = (W - blockW) * (0.5f + 0.45f * (float) Math.sin(t * 0.13f * sp)); y0 = (H - blockH) * (0.5f + 0.42f * (float) Math.sin(t * 0.09f * sp + 1)); animating = true; break;
                case 4: { float r = m * 0.22f; x0 = (W - blockW) / 2 + (float) Math.cos(t * 0.2f * sp) * r; y0 = (H - blockH) / 2 + (float) Math.sin(t * 0.2f * sp) * r; animating = true; break; }
                default:
                    if (now - lastDrift > 60000 || lastDrift == 0) { lastDrift = now; driftX = (R.nextFloat() - 0.5f) * m * 0.05f; driftY = (R.nextFloat() - 0.5f) * m * 0.05f; }
                    x0 = ax + driftX; y0 = ay + driftY;
            }
            float base = y0 + textH;

            // effect transforms
            boolean fxOn = fx >= 0 && now < fxUntil;
            float k = fxOn ? (now - fxStart) / (float) (fxUntil - fxStart) : 0;
            c.save();
            if (fxOn && fx == 5) { float sc = 1 + 0.14f * (float) Math.sin(k * Math.PI); c.scale(sc, sc, x0 + totalW / 2, base - textH / 2); }
            if (fxOn && fx == 6) {
                cam3d.save(); cam3d.rotateX(360 * k); cam3d.getMatrix(mtx); cam3d.restore();
                float pcx = x0 + totalW / 2, pcy = base - textH / 2;
                mtx.preTranslate(-pcx, -pcy); mtx.postTranslate(pcx, pcy); c.concat(mtx);
            }

            // paint setup
            int glowCol = colorMode == 2 ? gradA : colorMode == 4 ? accent : colorMode == 0 ? color : colorMode == 1 ? digit[0] : Color.HSVToColor(new float[]{(t * gradSpeed) % 360, 0.8f, 1});
            fill.setStyle(style == 6 ? Paint.Style.STROKE : Paint.Style.FILL);
            fill.setStrokeWidth(ts * 0.025f);
            float alphaMul = fxOn && fx == 2 ? (R.nextFloat() < 0.5f ? 0.25f + R.nextFloat() * 0.4f : 1f) : 1f;

            // chromatic split layers (atmosphere colours / effects)
            float split = m * 0.0018f;
            boolean glitch = fxOn && (fx == 0 || fx == 4);
            if (glitch) split = m * (fx == 4 ? 0.012f : 0.004f + R.nextFloat() * 0.01f);
            if (colorMode == 4 || glitch) {
                fill.setShader(null);
                fill.setColor(a(colorMode == 4 ? second : 0xffff2b4e, (int) (170 * alphaMul)));
                drawText(c, txt, x0 - split, base, null, t);
                fill.setColor(a(colorMode == 4 ? accent : 0xff00e5ff, (int) (170 * alphaMul)));
                drawText(c, txt, x0 + split, base, null, t);
            }
            // main layer with glow
            if (glow > 0 && style != 8) fill.setShadowLayer(ts * 0.25f * glow / 100f, 0, 0, a(glowCol, 220));
            if (colorMode == 2) {
                float off = (t * gradSpeed * m * 0.004f) % (totalW * 2 + 1);
                LinearGradient lg = new LinearGradient(x0 - totalW + off, 0, x0 + off, 0, new int[]{gradA, gradB, gradA}, null, Shader.TileMode.MIRROR);
                fill.setShader(lg);
                animating = true;
            } else fill.setShader(null);
            if (colorMode == 3) animating = true;
            fill.setAlpha((int) (255 * alphaMul));
            if (glitch && fx == 0) {
                for (int i = 0; i < 4; i++) {
                    float top = base - textH + R.nextFloat() * textH, bh = textH * (0.05f + R.nextFloat() * 0.14f);
                    c.save(); c.clipRect(0, top, W, top + bh); c.translate((R.nextFloat() - 0.5f) * m * 0.05f, 0);
                    drawText(c, txt, x0, base, s, t); c.restore();
                }
                c.save(); c.clipRect(0, base - textH * 1.2f, W, base - textH * 0.55f); c.translate(m * 0.006f * (R.nextBoolean() ? 1 : -1), 0);
                drawText(c, txt, x0, base, s, t); c.restore();
                c.save(); c.clipRect(0, base - textH * 0.55f, W, base + textH * 0.3f);
                drawText(c, txt, x0, base, s, t); c.restore();
            } else drawText(c, txt, x0, base, s, t);
            fill.clearShadowLayer();
            fill.setShader(null);
            if (fxOn && fx == 7) {
                float ly = base - textH + textH * 1.3f * k;
                Paint sl = new Paint(); sl.setColor(a(0xffffffff, 200)); sl.setShadowLayer(m * 0.02f, 0, 0, glowCol);
                c.drawRect(x0 - m * 0.02f, ly - m * 0.002f, x0 + totalW + m * 0.02f, ly + m * 0.002f, sl);
                sl.clearShadowLayer(); sl.setColor(0x33000000);
                for (float yy = base - textH; yy < base; yy += m * 0.008f) c.drawRect(x0, yy, x0 + totalW, yy + m * 0.003f, sl);
            }
            c.restore();

            float y = base;
            if (date) {
                small.setTextSize(m * 0.028f);
                small.setColor(0xccecfcff);
                y += m * 0.045f;
                c.drawText(DAYS[cal.get(Calendar.DAY_OF_WEEK) - 1] + " · " + String.format("%02d.%02d.%d",
                    cal.get(Calendar.DAY_OF_MONTH), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.YEAR)), x0 + m * 0.005f, y, small);
            }
            if (!weatherLine.isEmpty()) {
                small.setTextSize(m * 0.026f); small.setColor(a(glowCol, 220));
                y += m * 0.04f; c.drawText(weatherLine, x0 + m * 0.005f, y, small);
            }
            if (!icons.isEmpty()) drawIcons(c, x0 + m * 0.005f, y + m * 0.065f, m * 0.042f, glowCol, colorMode == 4 ? second : gradB);
            if (scrambling || fxOn) animating = true;
        } else if (!icons.isEmpty()) {
            drawIcons(c, W * 0.05f, H * 0.08f, m * 0.042f, accent, second);
        }

        if (!label.isEmpty() && !preview) {
            small.setTextSize(m * 0.022f);
            small.setColor(a(0xffecfcff, 150));
            small.setTextAlign(Paint.Align.RIGHT);
            c.drawText("CYBERCITY 3D", W * 0.95f, H * 0.06f + m * 0.02f, small);
            c.drawText(label, W * 0.95f, H * 0.06f + m * 0.05f, small);
            small.setTextAlign(Paint.Align.LEFT);
        }
        if (animating) postInvalidateDelayed(33);
        else if (fxMask != 0 && clockVisible) postInvalidateDelayed(Math.max(33, Math.min(1000, nextFx - now)));
        else postInvalidateDelayed(seconds ? 250 : 1000);
    }

    /** Draws the string glyph by glyph. colorsFrom != null → per-char colours, else current paint colour. */
    private void drawText(Canvas c, String txt, float x0, float base, String colorsFrom, float t) {
        boolean wave = fx == 3 && SystemClock.uptimeMillis() < fxUntil;
        int baseAlpha = fill.getAlpha();
        for (int i = 0; i < txt.length(); i++) {
            float y = base;
            if (wave) y += (float) Math.sin(t * 14 + i * 0.9f) * textH * 0.12f;
            if (colorsFrom != null && colorMode != 2) {
                fill.setColor(colorAt(colorsFrom, i, t));
                fill.setAlpha(baseAlpha);
            }
            drawGlyph(c, txt.charAt(i), x0 + cx[i], y, cw[i], fill);
        }
    }
}
