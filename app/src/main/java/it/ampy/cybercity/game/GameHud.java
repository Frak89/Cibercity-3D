package it.ampy.cybercity.game;

import it.ampy.cybercity.L;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.MotionEvent;
import android.view.View;

import it.ampy.cybercity.Palette;

/** HUD + multitouch controls: steer ◀ ▶, GAS, FRENO, DRIFT, N₂O, VISTA, pausa. Also draws the cockpit overlay. */
public class GameHud extends View {
    public interface Listener { void onView(); void onPause(); }
    static final int B_LEFT = 0, B_RIGHT = 1, B_GAS = 2, B_BRAKE = 3, B_DRIFT = 4, B_NOS = 5, B_VIEW = 6, B_PAUSE = 7;
    static final String[] LABEL = {"◀", "▶", "GAS", L.t("FRENO"), "DRIFT", "N₂O", L.t("VISTA"), "II"};

    private final GameRenderer r;
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG), t = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF[] btn = new RectF[8];
    private final boolean[] down = new boolean[8];
    private Listener listener;
    public boolean tilt = false;
    public float tiltSteer = 0;
    private int accent = 0xff00ffe2, second = 0xffff3ac8;

    public GameHud(Context c, GameRenderer r) {
        super(c);
        this.r = r;
        for (int i = 0; i < btn.length; i++) btn[i] = new RectF();
        t.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
    }
    public void setListener(Listener l) { listener = l; }
    public void setPalette(Palette pal) { accent = Palette.argb(pal.neonA); second = Palette.argb(pal.neonB); }
    private static int a(int c, int al) { return (c & 0x00ffffff) | (Math.max(0, Math.min(255, al)) << 24); }

    @Override protected void onSizeChanged(int w, int h, int ow, int oh) {
        float m = Math.min(w, h), s = m * 0.2f, g = m * 0.04f;
        btn[B_LEFT].set(g, h - g - s, g + s, h - g);
        btn[B_RIGHT].set(g * 2 + s, h - g - s, g * 2 + 2 * s, h - g);
        btn[B_GAS].set(w - g - s * 1.15f, h - g - s * 1.3f, w - g, h - g);
        btn[B_BRAKE].set(w - 2 * g - s * 2.05f, h - g - s * 0.9f, w - 2 * g - s * 1.15f, h - g);
        btn[B_DRIFT].set(w - 2 * g - s * 2.05f, h - 2 * g - s * 1.8f, w - 2 * g - s * 1.15f, h - 2 * g - s * 0.9f);
        btn[B_NOS].set(w - g - s * 1.0f, h - 2 * g - s * 2.2f, w - g, h - 2 * g - s * 1.3f);
        btn[B_VIEW].set(g, g * 3.2f, g + s * 0.95f, g * 3.2f + s * 0.45f);
        btn[B_PAUSE].set(g * 1.5f + s * 0.95f, g * 3.2f, g * 1.5f + s * 1.45f, g * 3.2f + s * 0.45f);
    }

    @Override public boolean onTouchEvent(MotionEvent e) {
        boolean[] now = new boolean[8];
        int act = e.getActionMasked(), upIdx = act == MotionEvent.ACTION_POINTER_UP ? e.getActionIndex() : -1;
        if (act != MotionEvent.ACTION_UP && act != MotionEvent.ACTION_CANCEL)
            for (int i = 0; i < e.getPointerCount(); i++) {
                if (i == upIdx) continue;
                float x = e.getX(i), y = e.getY(i);
                for (int b = 0; b < btn.length; b++) {
                    RectF q = new RectF(btn[b]); q.inset(-q.width() * 0.12f, -q.height() * 0.12f);
                    if (q.contains(x, y)) now[b] = true;
                }
            }
        if (now[B_VIEW] && !down[B_VIEW] && listener != null) { performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY); listener.onView(); }
        if (now[B_PAUSE] && !down[B_PAUSE] && listener != null) listener.onPause();
        for (int b = 0; b < 6; b++) if (now[b] && !down[b]) performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY);
        System.arraycopy(now, 0, down, 0, 8);
        apply();
        invalidate();
        return true;
    }

    public void apply() {
        CarPhysics.Input in = r.input;
        in.gas = down[B_GAS]; in.brake = down[B_BRAKE]; in.hand = down[B_DRIFT]; in.boost = down[B_NOS];
        in.steer = tilt ? tiltSteer : (down[B_LEFT] ? 1 : 0) - (down[B_RIGHT] ? 1 : 0);
    }

    @Override protected void onDraw(Canvas c) {
        float W = getWidth(), H = getHeight(), m = Math.min(W, H);
        if (r.hudCockpit) cockpit(c, W, H);
        // buttons
        for (int b = 0; b < btn.length; b++) {
            if (tilt && (b == B_LEFT || b == B_RIGHT)) continue;
            RectF q = btn[b];
            boolean rect = b >= B_VIEW;
            p.setStyle(Paint.Style.FILL); p.setColor(down[b] ? a(accent, 120) : 0x55070b13);
            if (rect) c.drawRoundRect(q, m * 0.02f, m * 0.02f, p); else c.drawOval(q, p);
            p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(m * 0.005f);
            p.setColor(a(b == B_NOS ? second : b == B_BRAKE ? 0xffff2b4e : accent, down[b] ? 255 : 150));
            if (rect) c.drawRoundRect(q, m * 0.02f, m * 0.02f, p); else c.drawOval(q, p);
            t.setTextAlign(Paint.Align.CENTER); t.setColor(0xffecfcff);
            t.setTextSize(q.height() * (rect ? 0.42f : b <= B_RIGHT ? 0.42f : 0.24f));
            c.drawText(b == B_VIEW ? L.t("VISTA") : LABEL[b], q.centerX(), q.centerY() + t.getTextSize() * 0.35f, t);
        }
        if (b(B_NOS)) { }
        if (r.hdError != null) { t.setTextAlign(Paint.Align.LEFT); t.setTextSize(m * 0.028f); t.setColor(0xffff6177); c.drawText(L.t("AUTO HD NON CARICATA: ") + r.hdError, m * 0.04f, m * 0.16f, t); }
        // top-left info
        t.setTextAlign(Paint.Align.LEFT); t.setTextSize(m * 0.035f); t.setColor(accent);
        c.drawText("NEON RUN · " + GameRenderer.VIEWS[r.view], m * 0.04f, m * 0.07f, t);
        t.setTextSize(m * 0.03f); t.setColor(0xffecfcff);
        c.drawText("DRIFT " + r.hudScore + "   RECORD " + r.hudBest + "   " + String.format("%.1f km", r.hudDist / 1000), m * 0.04f, m * 0.115f, t);
        if (r.hudDrift > 5) {
            t.setTextAlign(Paint.Align.CENTER); t.setTextSize(m * 0.08f); t.setColor(second);
            t.setShadowLayer(m * 0.03f, 0, 0, second);
            c.drawText("DRIFT " + Math.round(r.hudDrift), W / 2, H * 0.24f, t);
            t.clearShadowLayer();
        }
        // speedometer (bottom centre)
        float cx = W / 2, cy = H - m * 0.15f, rr = m * 0.12f;
        p.setStyle(Paint.Style.STROKE); p.setStrokeCap(Paint.Cap.ROUND); p.setStrokeWidth(m * 0.018f);
        p.setColor(0x26ffffff); c.drawArc(cx - rr, cy - rr, cx + rr, cy + rr, 135, 270, false, p);
        float k = Math.min(1, r.hudKmh / 340f);
        int sc = r.hudBoosting ? second : accent;
        p.setColor(sc); p.setShadowLayer(m * 0.02f, 0, 0, sc);
        c.drawArc(cx - rr, cy - rr, cx + rr, cy + rr, 135, 270 * k, false, p);
        p.clearShadowLayer();
        t.setTextAlign(Paint.Align.CENTER); t.setColor(0xffecfcff); t.setTextSize(m * 0.085f);
        c.drawText(String.valueOf(Math.round(r.hudKmh)), cx, cy + m * 0.025f, t);
        t.setTextSize(m * 0.026f); c.drawText("KM/H", cx, cy + m * 0.065f, t);
        // rev counter (inner arc) + gear
        float rr2 = rr * 0.8f, kr = Math.min(1, r.hudRpm / r.hudLim); boolean redz = r.hudRpm > r.hudRed * 0.9f; int rc = redz ? 0xffff3b5c : second;
        p.setStrokeWidth(m * 0.008f); p.setColor(0x1fffffff); c.drawArc(cx - rr2, cy - rr2, cx + rr2, cy + rr2, 135, 270, false, p);
        p.setColor(rc); c.drawArc(cx - rr2, cy - rr2, cx + rr2, cy + rr2, 135, 270 * kr, false, p);
        t.setTextSize(m * 0.032f); t.setColor(redz ? 0xffff3b5c : 0xffecfcff);
        c.drawText((r.hudGear == -2 ? "E" : r.hudGear < 0 ? "N" : String.valueOf(r.hudGear + 1)) + "   " + (Math.round(r.hudRpm / 100) * 100), cx, cy - rr * 0.42f, t);
        t.setColor(0xffecfcff);
        p.setStyle(Paint.Style.FILL); p.setColor(0x26ffffff);
        c.drawRect(cx - rr, cy + rr * 0.9f, cx + rr, cy + rr * 0.9f + m * 0.014f, p);
        p.setColor(second); c.drawRect(cx - rr, cy + rr * 0.9f, cx - rr + 2 * rr * r.hudBoost, cy + rr * 0.9f + m * 0.014f, p);
        // fuel / consumption
        t.setTextAlign(Paint.Align.RIGHT); t.setTextSize(m * 0.024f); t.setColor(r.hudFuelK < 0.12f ? 0xffff3b5c : 0xffecfcff);
        c.drawText("⛽ " + r.hudFuelCons + " · " + r.hudFuelTank, W - m * 0.04f, m * 0.42f, t);
        // cockpit view: head-up display with live telemetry
        if (r.view == 3) {
            float hx = W / 2, hy = H * 0.09f;
            p.setStyle(Paint.Style.FILL); p.setColor(0x59070b13); c.drawRect(hx - m * 0.34f, hy - m * 0.05f, hx + m * 0.34f, hy + m * 0.17f, p);
            t.setTextAlign(Paint.Align.CENTER); t.setColor(0xffecfcff); t.setTextSize(m * 0.075f); c.drawText(String.valueOf(Math.round(r.hudKmh)), hx, hy + m * 0.05f, t);
            t.setTextSize(m * 0.045f); t.setColor(second); c.drawText(r.hudGear == -2 ? "E" : r.hudGear < 0 ? "N" : String.valueOf(r.hudGear + 1), hx - m * 0.22f, hy + m * 0.05f, t);
            float rk2 = Math.min(1, r.hudRpm / r.hudLim); p.setColor(0x26ffffff); c.drawRect(hx - m * 0.3f, hy - m * 0.035f, hx + m * 0.3f, hy - m * 0.023f, p);
            p.setColor(rk2 > 0.9f ? 0xffff3b5c : accent); c.drawRect(hx - m * 0.3f, hy - m * 0.035f, hx - m * 0.3f + m * 0.6f * rk2, hy - m * 0.023f, p);
            float gx0 = hx + m * 0.24f, gy0 = hy + m * 0.03f, gr = m * 0.045f;
            p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(2); p.setColor(0x59ffffff); c.drawCircle(gx0, gy0, gr, p); c.drawCircle(gx0, gy0, gr / 2, p);
            p.setStyle(Paint.Style.FILL); p.setColor(accent); c.drawCircle(gx0 + Math.max(-1.5f, Math.min(1.5f, -r.telGy)) * gr / 1.5f, gy0 - Math.max(-1.5f, Math.min(1.5f, r.telGx)) * gr / 1.5f, m * 0.008f, p);
            t.setTextSize(m * 0.022f); t.setColor(0xffecfcff);
            c.drawText(String.format(java.util.Locale.ITALY, "LONG %.2f g  LAT %.2f g", r.telGx, r.telGy), hx, hy + m * 0.095f, t);
            c.drawText("0-100 " + (r.t100 > 0 ? String.format(java.util.Locale.ITALY, "%.2f s", r.t100) : "--") + "   0-200 " + (r.t200 > 0 ? String.format(java.util.Locale.ITALY, "%.2f s", r.t200) : "--"), hx, hy + m * 0.125f, t);
            c.drawText("⛽ " + r.hudFuelCons, hx, hy + m * 0.155f, t);
        }
        // KAGE CHRONO gauge + era label
        if (r.hudChrono >= 0) {
            float bw = m * 0.34f, bx = cx - bw / 2, by = cy - rr * 1.55f, kc = r.hudChrono;
            p.setStyle(Paint.Style.FILL); p.setColor(0x1fffffff); c.drawRect(bx, by, bx + bw, by + m * 0.012f, p);
            p.setColor(accent); p.setShadowLayer(m * 0.02f * kc + 0.01f, 0, 0, accent); c.drawRect(bx, by, bx + bw * kc, by + m * 0.012f, p); p.clearShadowLayer();
            t.setTextAlign(Paint.Align.CENTER); t.setTextSize(m * 0.022f); t.setColor(0xffecfcff);
            c.drawText(r.hudCool > 0 ? L.t("CRONO · RICARICA") : kc > 0 ? L.t("CRONO · TIENI 300 KM/H") : L.t("CRONO · PRONTO A 300 KM/H"), cx, by - m * 0.014f, t);
        }
        if (r.hudPast) { t.setTextAlign(Paint.Align.LEFT); t.setTextSize(m * 0.032f); t.setColor(0xfffff6c8); c.drawText(L.t("⏳ PRATERIA DEL PASSATO"), m * 0.04f, m * 0.2f, t); }
        // minimap
        float mr = m * 0.16f, mx = W - mr - m * 0.04f, my = mr + m * 0.04f, scale = mr / 220f;
        c.save();
        Path clip = new Path(); clip.addCircle(mx, my, mr, Path.Direction.CW); c.clipPath(clip);
        p.setColor(r.hudPast ? 0xbf285a1e : 0xbf070b13); c.drawCircle(mx, my, mr, p);
        p.setStyle(Paint.Style.STROKE); p.setStrokeCap(Paint.Cap.BUTT); p.setColor(0x73a0c8e6); p.setStrokeWidth(GameCity.RW * scale);
        for (int k2 = -4; k2 <= 4 && !r.hudPast; k2++) {
            float rx = (Math.round(r.hudX / GameCity.GP) + k2) * GameCity.GP - r.hudX, rz = (Math.round(r.hudZ / GameCity.GP) + k2) * GameCity.GP - r.hudZ;
            c.drawLine(mx + rx * scale, my - mr, mx + rx * scale, my + mr, p);
            c.drawLine(mx - mr, my - rz * scale, mx + mr, my - rz * scale, p);
        }
        c.restore();
        p.setStrokeWidth(m * 0.005f); p.setColor(accent); c.drawCircle(mx, my, mr, p);
        c.save(); c.translate(mx, my); c.rotate((float) Math.toDegrees(r.hudH));
        p.setStyle(Paint.Style.FILL); p.setColor(second);
        Path arrow = new Path(); arrow.moveTo(0, -m * 0.03f); arrow.lineTo(m * 0.018f, m * 0.02f); arrow.lineTo(-m * 0.018f, m * 0.02f); arrow.close();
        c.drawPath(arrow, p); c.restore();
        t.setTextSize(m * 0.026f); t.setColor(0xffecfcff); c.drawText("N", mx, my - mr + m * 0.035f, t);
        postInvalidateDelayed(33);
    }
    private boolean b(int i) { return down[i]; }

    private void cockpit(Canvas c, float W, float H) {
        p.setStyle(Paint.Style.FILL); p.setColor(0xff05070c);
        Path a = new Path(); a.moveTo(0, 0); a.lineTo(W * 0.16f, 0); a.lineTo(W * 0.02f, H * 0.62f); a.lineTo(0, H * 0.66f); a.close(); c.drawPath(a, p);
        Path b = new Path(); b.moveTo(W, 0); b.lineTo(W * 0.84f, 0); b.lineTo(W * 0.98f, H * 0.62f); b.lineTo(W, H * 0.66f); b.close(); c.drawPath(b, p);
        c.drawRect(0, 0, W, H * 0.05f, p);
        float dy = H * 0.74f;
        p.setShader(new LinearGradient(0, dy, 0, H, 0xff0b1020, 0xff020306, Shader.TileMode.CLAMP));
        Path d = new Path(); d.moveTo(0, H); d.lineTo(0, dy + H * 0.04f); d.quadTo(W / 2, dy - H * 0.05f, W, dy + H * 0.04f); d.lineTo(W, H); d.close();
        c.drawPath(d, p); p.setShader(null);
        p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(3); p.setColor(accent);
        Path e = new Path(); e.moveTo(W * 0.05f, dy + H * 0.035f); e.quadTo(W / 2, dy - H * 0.055f, W * 0.95f, dy + H * 0.035f); c.drawPath(e, p);
        float wx = W * 0.34f, wy = H * 0.98f, wr = H * 0.22f;
        c.save(); c.translate(wx, wy); c.rotate((float) Math.toDegrees(r.hudSteer * 1.4f));
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setColor(0xff151a26); p.setStrokeWidth(H * 0.035f); c.drawArc(-wr, -wr, wr, wr, 189, 162, false, p);
        p.setColor(second); p.setStrokeWidth(3); c.drawArc(-wr, -wr, wr, wr, 261, 18, false, p);
        p.setColor(0xff151a26); p.setStrokeWidth(H * 0.025f);
        Path s = new Path(); s.moveTo(-wr * 0.95f, -wr * 0.3f); s.lineTo(0, -wr * 0.15f); s.lineTo(wr * 0.95f, -wr * 0.3f); c.drawPath(s, p);
        c.restore();
    }
}
