package it.ampy.cybercity.game;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.opengl.GLSurfaceView;
import android.os.Bundle;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.HashMap;
import java.util.Map;

import it.ampy.cybercity.Palette;
import it.ampy.cybercity.Prefs;

/** AMPY KAGE GT showroom: turntable, hood, butterfly doors, interior / cockpit / engine, steering demo, lights, paint, specs. */
public class ShowroomActivity extends Activity {
    private GLSurfaceView glv;
    private ShowroomRenderer r;
    private SharedPreferences sp;
    private TextView specs;
    private final Map<String, TextView> btn = new HashMap<>();
    private int accent = 0xff00ffe2;

    int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        sp = Prefs.get(this).raw();
        r = new ShowroomRenderer(this);
        r.palette = sp.getString("gPalette", "neon");
        r.paint = sp.getString("gPaint", "rosso");
        accent = Palette.argb(Palette.of(r.palette).neonA);
        glv = new GLSurfaceView(this);
        glv.setEGLContextClientVersion(2);
        glv.setEGLConfigChooser(8, 8, 8, 8, 24, 0);
        glv.setPreserveEGLContextOnPause(true);
        glv.setRenderer(r);
        FrameLayout root = new FrameLayout(this);
        root.addView(glv, new FrameLayout.LayoutParams(-1, -1));

        TextView title = text("AMPY KAGE GT", 22, accent, true);
        title.setShadowLayer(dp(10), 0, 0, accent);
        TextView sub = text("SHOWROOM · CYBERCITY 3D", 10, 0xbbecfcff, false);
        LinearLayout tl = new LinearLayout(this); tl.setOrientation(LinearLayout.VERTICAL); tl.addView(title); tl.addView(sub);
        FrameLayout.LayoutParams tlp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.START); tlp.setMargins(dp(18), dp(28), 0, 0);
        root.addView(tl, tlp);

        specs = text(specsText(), 11, 0xffecfcff, false);
        specs.setLineSpacing(0, 1.25f);
        specs.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable sg = new GradientDrawable(); sg.setColor(0xd9070b13); sg.setStroke(dp(1), accent); sg.setCornerRadius(dp(6));
        ScrollView ss = new ScrollView(this); ss.addView(specs); ss.setBackground(sg); ss.setVisibility(View.GONE);
        FrameLayout.LayoutParams slp = new FrameLayout.LayoutParams(dp(300), -2, Gravity.TOP | Gravity.END); slp.setMargins(0, dp(28), dp(14), dp(90));
        root.addView(ss, slp);

        LinearLayout bar = new LinearLayout(this); bar.setPadding(dp(10), 0, dp(10), 0);
        add(bar, "turn", "⟳ RUOTA", true, v -> { r.auto = !r.auto; sel("turn", r.auto); });
        add(bar, "hood", "COFANO", false, v -> { r.tHood = r.tHood > 0 ? 0 : 1; sel("hood", r.tHood > 0); });
        add(bar, "doors", "PORTIERE", false, v -> { r.tDoors = r.tDoors > 0 ? 0 : 1; sel("doors", r.tDoors > 0); });
        add(bar, "int", "INTERNI", false, v -> mode(ShowroomRenderer.CAM_INTERIOR));
        add(bar, "cock", "ABITACOLO", false, v -> mode(ShowroomRenderer.CAM_COCKPIT));
        add(bar, "eng", "MOTORE", false, v -> mode(ShowroomRenderer.CAM_ENGINE));
        add(bar, "steer", "STERZO", false, v -> { r.steerDemo = !r.steerDemo; sel("steer", r.steerDemo); });
        add(bar, "lights", "LUCI", true, v -> { r.lights = r.lights > 0 ? 0 : 1; sel("lights", r.lights > 0); });
        add(bar, "paint", "COLORE", false, v -> {
            int i = (CarHd.paintIndex(r.paint) + 1) % CarHd.PAINT_KEYS.length; r.paint = CarHd.PAINT_KEYS[i];
            sp.edit().putString("gPaint", r.paint).apply(); btn.get("paint").setText("COLORE: " + CarHd.PAINT_NAMES[i]);
        });
        add(bar, "pal", "ATMOSFERA", false, v -> {
            int i = (Palette.index(r.palette) + 1) % Palette.KEYS.length; r.palette = Palette.KEYS[i]; sp.edit().putString("gPalette", r.palette).apply();
        });
        add(bar, "specs", "SCHEDA TECNICA", false, v -> { boolean on = ss.getVisibility() != View.VISIBLE; ss.setVisibility(on ? View.VISIBLE : View.GONE); sel("specs", on); });
        add(bar, "drive", "▶ GUIDALA", false, v -> { startActivity(new Intent(this, GameActivity.class)); finish(); });
        HorizontalScrollView hs = new HorizontalScrollView(this); hs.setHorizontalScrollBarEnabled(false); hs.addView(bar);
        FrameLayout.LayoutParams blp = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM); blp.bottomMargin = dp(18);
        root.addView(hs, blp);
        setContentView(root);

        ScaleGestureDetector sg2 = new ScaleGestureDetector(this, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override public boolean onScale(ScaleGestureDetector d) { r.dist = Math.max(4, Math.min(14, r.dist / d.getScaleFactor())); return true; }
        });
        final float[] last = new float[2];
        glv.setOnTouchListener((v, e) -> {
            sg2.onTouchEvent(e);
            if (e.getActionMasked() == MotionEvent.ACTION_DOWN) { last[0] = e.getX(); last[1] = e.getY(); }
            if (e.getActionMasked() == MotionEvent.ACTION_MOVE && !sg2.isInProgress() && e.getPointerCount() == 1) {
                float dx = (e.getX() - last[0]) / v.getWidth(), dy = (e.getY() - last[1]) / v.getHeight();
                last[0] = e.getX(); last[1] = e.getY();
                if (r.camMode == ShowroomRenderer.CAM_COCKPIT) { r.look -= dx * 3; r.lookP = Math.max(-0.8f, Math.min(0.8f, r.lookP - dy * 2)); }
                else { r.yawDrag += dx * 4; r.pitch = Math.max(0.02f, Math.min(1.2f, r.pitch + dy * 2)); }
            }
            return true;
        });
    }

    private String specsText() {
        StringBuilder s = new StringBuilder("AMPY KAGE GT\n");
        for (String[] row : CarHd.SPECS) s.append("\n").append(row[0]).append("\n").append(row[1]).append("\n");
        return s.toString();
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color);
        t.setTypeface(Typeface.create(Typeface.MONOSPACE, bold ? Typeface.BOLD : Typeface.NORMAL));
        t.setLetterSpacing(bold ? 0.2f : 0.08f);
        return t;
    }
    private void add(LinearLayout bar, String key, String label, boolean on, View.OnClickListener l) {
        TextView t = text(label, 12, 0xffecfcff, true);
        t.setLetterSpacing(0.06f);
        t.setPadding(dp(14), dp(9), dp(14), dp(9));
        t.setOnClickListener(v -> { v.performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY); l.onClick(v); });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.rightMargin = dp(8);
        bar.addView(t, lp);
        btn.put(key, t);
        sel(key, on);
    }
    private void sel(String key, boolean on) {
        TextView t = btn.get(key); if (t == null) return;
        GradientDrawable g = new GradientDrawable(); g.setColor(on ? accent : 0xb3070b13); g.setStroke(dp(1), accent); g.setCornerRadius(dp(16));
        t.setBackground(g); t.setTextColor(on ? 0xff070b13 : 0xffecfcff);
    }
    private void mode(int m) {
        r.camMode = r.camMode == m ? ShowroomRenderer.CAM_ORBIT : m;
        sel("int", r.camMode == ShowroomRenderer.CAM_INTERIOR); sel("cock", r.camMode == ShowroomRenderer.CAM_COCKPIT); sel("eng", r.camMode == ShowroomRenderer.CAM_ENGINE);
        if (r.camMode == ShowroomRenderer.CAM_ENGINE) { r.tHood = 1; sel("hood", true); }
        if (r.camMode == ShowroomRenderer.CAM_INTERIOR) { r.tDoors = 1; sel("doors", true); }
    }

    @Override protected void onResume() {
        super.onResume(); glv.onResume();
        glv.postDelayed(() -> { if (r.error != null) android.widget.Toast.makeText(this, "Auto HD non caricata: " + r.error, android.widget.Toast.LENGTH_LONG).show(); }, 2500);
    }
    @Override protected void onPause() { glv.onPause(); super.onPause(); }
}
