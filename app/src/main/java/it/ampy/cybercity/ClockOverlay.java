package it.ampy.cybercity;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.View;

import java.util.Calendar;
import java.util.Random;

/** Glitch clock (same decode effect as AmpyRocket) that drifts slowly to protect OLED screens. */
public class ClockOverlay extends View {
    static final String GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>/|ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ";
    static final String[] DAYS = {"DOMENICA", "LUNEDÌ", "MARTEDÌ", "MERCOLEDÌ", "GIOVEDÌ", "VENERDÌ", "SABATO"};
    private final Random R = new Random();
    private final Paint big = new Paint(Paint.ANTI_ALIAS_FLAG), small = new Paint(Paint.ANTI_ALIAS_FLAG);
    private String last = "";
    private long[] lockAt = new long[0];
    private long burstUntil = 0;
    private int accent = 0xff00ffe2, second = 0xffff3ac8;
    private boolean showClock = true;
    private String label = "";
    private float driftX, driftY;
    private long lastDrift = 0;

    public ClockOverlay(Context c) {
        super(c);
        big.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        big.setLetterSpacing(0.06f);
        small.setTypeface(Typeface.MONOSPACE);
        small.setLetterSpacing(0.3f);
    }

    public void setPalette(Palette p) { accent = Palette.argb(p.neonA); second = Palette.argb(p.neonB); invalidate(); }
    public void setShowClock(boolean b) { showClock = b; invalidate(); }
    public void setLabel(String s) { label = s; }

    private static int a(int c, int alpha) { return (c & 0x00ffffff) | (alpha << 24); }

    @Override protected void onDraw(Canvas c) {
        long now = SystemClock.uptimeMillis();
        float W = getWidth(), H = getHeight(), m = Math.min(W, H);
        if (now - lastDrift > 60000 || lastDrift == 0) {
            lastDrift = now; driftX = (R.nextFloat() - 0.5f) * m * 0.06f; driftY = (R.nextFloat() - 0.5f) * m * 0.06f;
        }
        if (showClock) {
            Calendar cal = Calendar.getInstance();
            String s = String.format("%02d:%02d", cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE));
            if (!s.equals(last)) {
                last = s; lockAt = new long[s.length()];
                for (int i = 0; i < s.length(); i++) lockAt[i] = now + 90L * i + R.nextInt(250);
                burstUntil = now + 300;
            }
            if (R.nextInt(400) == 0) burstUntil = now + 120 + R.nextInt(200);
            char[] shown = s.toCharArray();
            boolean scrambling = false;
            for (int i = 0; i < shown.length; i++)
                if (shown[i] != ':' && now < lockAt[i]) { shown[i] = GLYPHS.charAt(R.nextInt(GLYPHS.length())); scrambling = true; }
            String txt = new String(shown);
            boolean g = now < burstUntil;
            big.setTextSize(m * 0.16f);
            float x = W * 0.05f + driftX, y = H * 0.88f + driftY;
            float sp = g ? m * (0.003f + R.nextFloat() * 0.008f) : m * 0.0018f;
            big.setShadowLayer(m * 0.03f, 0, 0, a(accent, 150));
            big.setColor(a(second, 170)); c.drawText(txt, x - sp, y, big);
            big.setColor(a(accent, 170)); c.drawText(txt, x + sp, y, big);
            big.clearShadowLayer();
            big.setColor(0xffecfcff);
            if (g) {
                float th = big.getTextSize();
                for (int i = 0; i < 4; i++) {
                    float top = y - th + R.nextFloat() * th, bh = th * (0.05f + R.nextFloat() * 0.12f);
                    c.save(); c.clipRect(0, top, W, top + bh); c.translate((R.nextFloat() - 0.5f) * m * 0.04f, 0);
                    c.drawText(txt, x, y, big); c.restore();
                }
            } else c.drawText(txt, x, y, big);
            small.setTextSize(m * 0.028f);
            small.setColor(0xccecfcff);
            c.drawText(DAYS[cal.get(Calendar.DAY_OF_WEEK) - 1] + " · " + String.format("%02d.%02d.%d",
                cal.get(Calendar.DAY_OF_MONTH), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.YEAR)), x + m * 0.005f, y + m * 0.05f, small);
            if (scrambling || g) postInvalidateOnAnimation(); else postInvalidateDelayed(120);
        } else postInvalidateDelayed(1000);
        if (!label.isEmpty()) {
            small.setTextSize(m * 0.022f);
            small.setColor(a(0xffecfcff, 150));
            small.setTextAlign(Paint.Align.RIGHT);
            c.drawText("CYBERCITY 3D", W * 0.95f - driftX, H * 0.06f + m * 0.02f, small);
            c.drawText(label, W * 0.95f - driftX, H * 0.06f + m * 0.05f, small);
            small.setTextAlign(Paint.Align.LEFT);
        }
    }
}
