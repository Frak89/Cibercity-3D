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
        r.power = CarHd.powerIndex(sp.getString("gPower", "v8"));
        r.race = sp.getBoolean("gRace", false); r.chrono = sp.getBoolean("gChrono", false);
        accent = Palette.argb(Palette.of(r.palette).neonA);
        glv = new GLSurfaceView(this);
        glv.setEGLContextClientVersion(2);
        glv.setEGLConfigChooser(new it.ampy.cybercity.CityView.Chooser());   // 4x MSAA when available
        glv.setPreserveEGLContextOnPause(true);
        glv.setRenderer(r);
        FrameLayout root = new FrameLayout(this);
        root.addView(glv, new FrameLayout.LayoutParams(-1, -1));

        TextView title = text(CarHd.MODEL_NAMES[r.power], 22, accent, true); titleView = title;
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
        // engine controls: MOTORE on/off, SU DI GIRI (hold to rev, release for the crackle) and the rev counter
        LinearLayout eb = new LinearLayout(this); eb.setGravity(Gravity.CENTER_VERTICAL);
        rpmText = text("900 RPM", 16, accent, true); rpmText.setShadowLayer(dp(8), 0, 0, accent);
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(-2, -2); rp.rightMargin = dp(12); eb.addView(rpmText, rp);
        add(bar, "roof", "CAPOTE: CHIUSA", false, v -> { r.tRoof = r.tRoof > 0 ? 0 : 1; sel("roof", r.tRoof > 0); btn.get("roof").setText(r.tRoof > 0 ? "CAPOTE: APERTA (SPIDER)" : "CAPOTE: CHIUSA"); });
        add(bar, "power", CarHd.POWER_NAMES[r.power], false, v -> {
            r.power = (r.power + 1) % 3; sp.edit().putString("gPower", CarHd.POWER_KEYS[r.power]).apply();
            btn.get("power").setText(CarHd.POWER_NAMES[r.power]); specs.setText(specsText()); titleView.setText(CarHd.MODEL_NAMES[r.power]);
        });
        add(bar, "exh", "SCARICO: SERIE", false, v -> { r.race = !r.race; sel("exh", r.race); btn.get("exh").setText(r.race ? "SCARICO: ELABORATO" : "SCARICO: SERIE"); sp.edit().putBoolean("gRace", r.race).apply(); });
        add(bar, "chrono", "MODULO CRONO", false, v -> { r.chrono = !r.chrono; sel("chrono", r.chrono); sp.edit().putBoolean("gChrono", r.chrono).apply(); });
        add(bar, "fly", "VOLO", false, v -> {
            if (r.power != 2) { r.power = 2; btn.get("power").setText(CarHd.POWER_NAMES[2]); specs.setText(specsText()); titleView.setText(CarHd.MODEL_NAMES[2]); }
            r.fly = !r.fly; sel("fly", r.fly);
        });
        sel("exh", r.race); btn.get("exh").setText(r.race ? "SCARICO: ELABORATO" : "SCARICO: SERIE"); sel("chrono", r.chrono);
        add(eb, "motor", "MOTORE ON", true, v -> {
            r.engineOn = !r.engineOn; sel("motor", r.engineOn); btn.get("motor").setText(r.engineOn ? "MOTORE ON" : "MOTORE OFF");
            if (r.engineOn) { r.eng.rpm = 300; r.rev = 0.45f; glv.postDelayed(() -> { if (!revHeld) r.rev = 0; }, 260); }
        });
        TextView revB = text("🔥 SU DI GIRI", 14, 0xffffd2b0, true);
        revB.setPadding(dp(18), dp(12), dp(18), dp(12));
        revBg(revB, false);
        revB.setOnTouchListener((v, e) -> {
            int a = e.getActionMasked();
            if (a == MotionEvent.ACTION_DOWN) {
                revHeld = true; v.performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY);
                if (!r.engineOn) { r.engineOn = true; sel("motor", true); btn.get("motor").setText("MOTORE ON"); }
                r.rev = 1; revBg(revB, true);
            } else if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) { revHeld = false; r.rev = 0; revBg(revB, false); }
            return true;
        });
        eb.addView(revB);
        FrameLayout.LayoutParams elp = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.END); elp.setMargins(0, 0, dp(14), dp(72));
        root.addView(eb, elp);
        setContentView(root);
        sound = new EngineSound(r.eng);
        rpmText.post(rpmTick);

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

    private TextView rpmText, titleView;
    private boolean revHeld = false;
    private EngineSound sound;
    private final Runnable rpmTick = new Runnable() { @Override public void run() {
        rpmText.setText(r.engineOn ? (Math.round(r.eng.rpm / 50) * 50) + " RPM" : "");
        rpmText.setTextColor(r.eng.rpm > r.eng.red() * 0.9f ? 0xffff3b5c : accent);
        rpmText.postDelayed(this, 80);
    } };
    private void revBg(TextView t, boolean on) {
        GradientDrawable g = new GradientDrawable(); g.setColor(on ? 0xffff7a2e : 0xb3070b13); g.setStroke(dp(2), 0xffff7a2e); g.setCornerRadius(dp(22));
        t.setBackground(g); t.setTextColor(on ? 0xff070b13 : 0xffffd2b0);
    }

    private String specsText() {
        StringBuilder s = new StringBuilder(CarHd.MODEL_NAMES[r.power] + "\n");
        for (String[] row : CarHd.SPECS_BY[r.power]) s.append("\n").append(row[0]).append("\n").append(row[1]).append("\n");
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
        super.onResume(); glv.onResume(); sound.start();
        glv.postDelayed(() -> { if (r.error != null) android.widget.Toast.makeText(this, "Auto HD non caricata: " + r.error, android.widget.Toast.LENGTH_LONG).show(); }, 2500);
    }
    @Override protected void onPause() { sound.stop(); r.rev = 0; glv.onPause(); super.onPause(); }
}
