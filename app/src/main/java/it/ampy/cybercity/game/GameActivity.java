package it.ampy.cybercity.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.opengl.GLSurfaceView;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Surface;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.FrameLayout;

import it.ampy.cybercity.Palette;
import it.ampy.cybercity.Prefs;
import it.ampy.cybercity.Weather;

/** NEON RUN — open-world driving mini game through Cybercity. Landscape, touch or tilt steering. */
public class GameActivity extends Activity implements SensorEventListener {
    private GLSurfaceView glv;
    private GameRenderer r;
    private GameHud hud;
    private SharedPreferences sp;
    private SensorManager sm;
    private Vibrator vib;
    private final Runnable haptics = new Runnable() {
        @Override public void run() {
            if (r != null && r.lastImpact > 0) {
                float imp = r.lastImpact; r.lastImpact = 0;
                try { if (vib != null) vib.vibrate(VibrationEffect.createOneShot((long) Math.min(120, 20 + imp * 4), Math.min(255, (int) (60 + imp * 8)))); } catch (Exception ignored) { }
            }
            if (hud != null) hud.postDelayed(this, 50);
        }
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        sp = Prefs.get(this).raw();
        r = new GameRenderer(this);
        r.palette = sp.getString("gPalette", "neon");
        r.weather = sp.getString("gWeather", "");
        r.paint = sp.getString("gPaint", "nero");
        r.view = sp.getInt("gView", 0);
        glv = new GLSurfaceView(this);
        glv.setEGLContextClientVersion(2);
        glv.setEGLConfigChooser(new it.ampy.cybercity.CityView.Chooser());   // 4x MSAA when available
        glv.setPreserveEGLContextOnPause(true);
        glv.setRenderer(r);
        hud = new GameHud(this, r);
        hud.tilt = sp.getBoolean("gTilt", false);
        hud.setPalette(Palette.of(r.palette));
        hud.setListener(new GameHud.Listener() {
            @Override public void onView() { r.view = (r.view + 1) % GameRenderer.VIEWS.length; sp.edit().putInt("gView", r.view).apply(); }
            @Override public void onPause() { menu(); }
        });
        FrameLayout root = new FrameLayout(this);
        root.addView(glv, new FrameLayout.LayoutParams(-1, -1));
        root.addView(hud, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        sm = (SensorManager) getSystemService(SENSOR_SERVICE);
        vib = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        applyWeather();
    }

    private void applyWeather() {
        String w = sp.getString("gWeather", "");
        if ("auto".equals(w)) w = Weather.effective(Prefs.get(this));
        r.weather = w;
    }

    private EngineSound sound;
    private void menu() {
        r.paused = true;
        String[] items = {"▶ RIPRENDI", "SUONO MOTORE: " + (sp.getBoolean("gSound", true) ? "ON" : "OFF"), "VISTA: " + GameRenderer.VIEWS[r.view], "ATMOSFERA: " + Palette.of(r.palette).name,
            "METEO: " + weatherName(sp.getString("gWeather", "")), "COLORE AUTO: " + CarModel.PAINT_NAMES[CarModel.paintIndex(r.paint)],
            "STERZO: " + (hud.tilt ? "INCLINAZIONE DEL TELEFONO" : "PULSANTI ◀ ▶"), "↺ RIPARTI DAL VIA", "✕ ESCI", "🏁 SHOWROOM (garage)"};
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("NEON RUN · PAUSA")
            .setItems(items, (d, i) -> {
                switch (i) {
                    case 1: { boolean on = !sp.getBoolean("gSound", true); sp.edit().putBoolean("gSound", on).apply(); if (sound != null) sound.muted = !on; r.paused = false; return; }
                    case 2: pick("VISTA", GameRenderer.VIEWS, r.view, k -> { r.view = k; sp.edit().putInt("gView", k).apply(); }); return;
                    case 3: pick("ATMOSFERA", Palette.NAMES, Palette.index(r.palette), k -> { r.palette = Palette.KEYS[k]; hud.setPalette(Palette.of(r.palette)); sp.edit().putString("gPalette", r.palette).apply(); }); return;
                    case 4: {
                        String[] keys = {"", "auto", "clear", "cloudy", "fog", "drizzle", "rain", "storm", "snow"};
                        String[] names = new String[keys.length];
                        int sel = 0;
                        for (int k = 0; k < keys.length; k++) { names[k] = weatherName(keys[k]); if (keys[k].equals(sp.getString("gWeather", ""))) sel = k; }
                        pick("METEO", names, sel, k -> { sp.edit().putString("gWeather", keys[k]).apply(); applyWeather(); });
                        return;
                    }
                    case 5: pick("COLORE AUTO", CarModel.PAINT_NAMES, CarModel.paintIndex(r.paint), k -> { r.paint = CarModel.PAINT_KEYS[k]; sp.edit().putString("gPaint", r.paint).apply(); }); return;
                    case 6: hud.tilt = !hud.tilt; sp.edit().putBoolean("gTilt", hud.tilt).apply(); registerTilt(); r.paused = false; return;
                    case 7: r.resetCar(); r.paused = false; return;
                    case 8: finish(); return;
                    case 9: startActivity(new android.content.Intent(this, ShowroomActivity.class)); return;
                    default: r.paused = false;
                }
            })
            .setOnCancelListener(d -> r.paused = false)
            .show();
    }
    private static String weatherName(String k) {
        if (k == null || k.isEmpty()) return "SERENO (nessun effetto)";
        return Weather.name(k);
    }
    interface IntCb { void on(int i); }
    private void pick(String title, String[] items, int sel, IntCb cb) {
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert).setTitle(title)
            .setSingleChoiceItems(items, sel, (d, i) -> { cb.on(i); d.dismiss(); r.paused = false; })
            .setOnCancelListener(d -> r.paused = false).show();
    }

    private void registerTilt() {
        sm.unregisterListener(this);
        if (hud.tilt) { Sensor a = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER); if (a != null) sm.registerListener(this, a, SensorManager.SENSOR_DELAY_GAME); }
        else { hud.tiltSteer = 0; hud.apply(); }
    }

    /** Landscape: gravity along the device y axis steers (like a wheel). */
    @Override public void onSensorChanged(SensorEvent e) {
        int rot = getWindowManager().getDefaultDisplay().getRotation();
        float g = rot == Surface.ROTATION_270 ? e.values[1] : -e.values[1];
        float s = Math.max(-1, Math.min(1, g / 5.5f));
        if (Math.abs(s) < 0.06f) s = 0;
        hud.tiltSteer = s;
        hud.apply();
    }
    @Override public void onAccuracyChanged(Sensor s, int a) { }

    @Override protected void onResume() {
        super.onResume();
        glv.onResume();
        registerTilt();
        if (sound == null) sound = new EngineSound(r.eng);
        sound.muted = !sp.getBoolean("gSound", true); sound.start();
        hud.post(haptics);
        View d = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController() != null) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());
            getWindow().getInsetsController().setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override protected void onPause() {
        sm.unregisterListener(this);
        hud.removeCallbacks(haptics);
        if (sound != null) sound.stop();
        glv.onPause();
        super.onPause();
    }

    @Override public void onBackPressed() { menu(); }
}
