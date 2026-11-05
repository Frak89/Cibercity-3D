package it.ampy.cybercity.game;

import android.content.Context;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.SystemClock;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

import it.ampy.cybercity.Palette;

/** Showroom: turntable, glossy floor with reflection, hood / doors / steering demo, interior, cockpit and engine cameras. Mirrors web/showroom.js. */
public class ShowroomRenderer implements GLSurfaceView.Renderer {
    public static final int CAM_ORBIT = 0, CAM_INTERIOR = 1, CAM_COCKPIT = 2, CAM_ENGINE = 3;
    private final Context ctx;
    public volatile String palette = "neon", paint = "rosso";
    public volatile float tHood = 0, tDoors = 0, lights = 1;
    public volatile boolean steerDemo = false, auto = true;
    public volatile int camMode = CAM_ORBIT;
    public volatile float yawDrag = 0, pitch = 0.18f, dist = 7.2f, look = 0, lookP = 0;

    private Gl.Prog sky, floor, hdProg;
    private CarHd hd;
    private Gl.Mesh quad, ground;
    private final CarHd.State st = new CarHd.State();
    private float t = 0, turn = 0.7f;
    private long last = 0;
    private int W = 1, H = 1;
    private final float[] V = new float[16], P = new float[16], VP = new float[16], car = new float[16], mir = new float[16];
    public volatile String error = null;
    /** engine: idles by itself; rev = throttle held with SU DI GIRI (neutral) */
    final EngineSim eng = new EngineSim();
    private final ExhaustFx exhaust = new ExhaustFx();
    private Gl.Prog fxProg;
    public volatile boolean engineOn = true;
    public volatile float rev = 0, tRoof = 0;
    public volatile int power = 0;
    public volatile boolean race = false, chrono = false, fly = false;
    public volatile int kit, rim, livery, text = -1, stripeC = 0, rimC = 3, brakes = 0;
    private float flyK = 0, chronoPh = 0;
    private final float[] body = new float[16];

    public ShowroomRenderer(Context c) { ctx = c.getApplicationContext(); }

    /* screensaver turnaround: a new random configuration and camera every few seconds */
    public volatile boolean demo = false;
    private float demoT = 0, demoYaw = 0, demoDist = 7.2f, demoPitch = 0.18f, demoSpin = 0.25f, demoNext = 0;
    private final java.util.Random dr = new java.util.Random();
    private void demoStep(float dt) {
        demoT += dt;
        if (demoT >= demoNext) {
            demoT = 0; demoNext = 9 + dr.nextFloat() * 5;
            paint = CarHd.PAINT_KEYS[dr.nextInt(CarHd.PAINT_KEYS.length)];
            power = dr.nextInt(3); kit = dr.nextInt(3); rim = dr.nextInt(3); livery = dr.nextInt(3);
            rimC = dr.nextInt(CarHd.COLORS.length); stripeC = dr.nextInt(CarHd.COLORS.length);
            text = dr.nextFloat() < 0.4f ? -1 : dr.nextInt(CarHd.TEXT_PRESETS.length); brakes = dr.nextInt(CarHd.BRAKE_NAMES.length);
            race = dr.nextBoolean(); chrono = dr.nextFloat() < 0.3f; tRoof = dr.nextFloat() < 0.3f ? 1 : 0;
            fly = power == 2 && dr.nextFloat() < 0.4f;
            lights = dr.nextFloat() < 0.8f ? 1 : 0;
            float r = dr.nextFloat();
            tHood = r < 0.15f ? 1 : 0; tDoors = r > 0.15f && r < 0.32f ? 1 : 0;
            steerDemo = dr.nextFloat() < 0.3f;
            float c = dr.nextFloat();
            camMode = c < 0.72f ? CAM_ORBIT : c < 0.84f ? CAM_INTERIOR : c < 0.92f ? CAM_COCKPIT : CAM_ENGINE;
            if (camMode == CAM_ENGINE) tHood = 1;
            demoDist = 4.6f + dr.nextFloat() * 5; demoPitch = 0.02f + dr.nextFloat() * 0.5f;
            demoSpin = (dr.nextBoolean() ? 1 : -1) * (0.12f + dr.nextFloat() * 0.3f);
            demoYaw = dr.nextFloat() * 6.283f; turn = demoYaw; look = 0; lookP = 0;
            engineOn = true; rev = 0;
        }
        auto = false;
        turn += dt * demoSpin;
        dist += (demoDist - dist) * Math.min(1, dt * 0.8f); pitch += (demoPitch - pitch) * Math.min(1, dt * 0.8f);
        if (camMode == CAM_COCKPIT) look = 0.5f * (float) Math.sin(demoT * 0.35f);
        rev = demoT % 5 > 4.2f ? 0.7f : 0;   // a blip every few seconds (silent: no sound in the screensaver)
    }

    @Override public void onSurfaceCreated(GL10 gl, EGLConfig cfg) {
        String common = Gl.asset(ctx, "common.glsl");
        sky = Gl.prog(ctx, "sky.vert", "sky.frag", common);
        floor = Gl.prog(ctx, "ground.vert", "studio_floor.frag", common);
        hdProg = Gl.prog(ctx, "car_hd.vert", "car_hd.frag", common);
        fxProg = Gl.prog(ctx, "particle.vert", "particle.frag", common); exhaust.glLost();
        try { hd = new CarHd(ctx, hdProg); } catch (Exception e) { error = e.getMessage(); }
        quad = Gl.mesh(new String[]{"aPos"}, new float[][]{{-1, -1, 1, -1, 1, 1, -1, 1}}, new int[]{2}, new short[]{0, 1, 2, 0, 2, 3});
        ground = Gl.mesh(new String[]{"aPos"}, new float[][]{{-40, -40, 40, -40, 40, 40, -40, 40}}, new int[]{2}, new short[]{0, 1, 2, 0, 2, 3});
        last = 0;
    }
    @Override public void onSurfaceChanged(GL10 gl, int w, int h) { W = Math.max(1, w); H = Math.max(1, h); GLES20.glViewport(0, 0, W, H); }

    private static float ease(float cur, float target, float k, float dt) { return cur + (target - cur) * Math.min(1, dt * k); }

    private float[] toWorld(float x, float y, float z) {
        float c = (float) Math.cos(turn), s = (float) Math.sin(turn);
        return new float[]{x * c + z * s, y, -x * s + z * c};
    }

    private void common(Gl.Prog p, Palette pal, float[] eye) {
        GLES20.glUseProgram(p.id);
        p.f1("uTime", t % 3600f); p.f1("uL", 1e5f); p.f1("uFar", 400); p.f1("uFogDen", 0.004f); p.f1("uFlash", 0);
        p.v3("uFog", new float[]{pal.fog[0] * 0.6f, pal.fog[1] * 0.6f, pal.fog[2] * 0.6f}); p.v3("uSkyTop", pal.top);
        p.v3("uWinA", pal.winA); p.v3("uWinB", pal.winB); p.v3("uWinC", pal.winC); p.v3("uNeonA", pal.neonA); p.v3("uNeonB", pal.neonB); p.v3("uEye", eye);
        p.m4("uVP", VP);
        int l = p.u("uHL"); if (l >= 0) { GLES20.glUniform4f(l, car[8] * 2.3f + car[12], car[10] * 2.3f + car[14], car[8], car[10]); p.f1("uHLOn", lights); }
    }

    @Override public void onDrawFrame(GL10 gl) {
        long now = SystemClock.uptimeMillis();
        float dt = last == 0 ? 1 / 60f : Math.min(0.05f, (now - last) / 1000f);
        last = now; t += dt;
        if (demo) demoStep(dt);
        st.kit = kit; st.rim = rim; st.livery = livery; st.text = text;
        eng.setType(power); st.power = power; st.time = t; st.race = race; st.chrono = chrono; eng.race = race;
        flyK += Math.max(-dt * 0.7f, Math.min(dt * 0.7f, (power == 2 && fly ? 1 : 0) - flyK)); st.fly = flyK * flyK * (3 - 2 * flyK);
        chronoPh += dt * (1 + rev * 10); st.chronoPh = chronoPh;
        st.roof += Math.max(-dt / 5, Math.min(dt / 5, tRoof - st.roof));
        if (power == 2) st.spin += dt * eng.rpm / 22000 * 9;
        eng.off = !engineOn;
        eng.update(dt, 0, rev, false, true);
        Palette pal = Palette.of(palette);
        st.hood = ease(st.hood, tHood, 3, dt); st.doorL = ease(st.doorL, tDoors, 2.6f, dt); st.doorR = ease(st.doorR, tDoors, 2.4f, dt);
        float steer = steerDemo ? (float) Math.sin(t * 1.4f) : 0;
        st.wheelSteer = ease(st.wheelSteer, steer * 0.55f, 6, dt); st.steerWheel = ease(st.steerWheel, steer * 2.6f, 6, dt);
        if (auto && camMode == CAM_ORBIT) turn += dt * 0.25f;
        turn += yawDrag; yawDrag = 0;
        float[] eye, tgt; float fov = 40;
        if (camMode == CAM_COCKPIT) {
            float[] e = CarHd.DRIVER_EYE; eye = toWorld(e[0], e[1], e[2]);
            float p = lookP - 0.08f;
            tgt = toWorld(e[0] + (float) Math.sin(look) * 2, e[1] + (float) Math.sin(p) * 2, e[2] + (float) Math.cos(look) * 2); fov = 72;
        } else if (camMode == CAM_INTERIOR) { eye = toWorld(1.9f, 1.75f, -0.2f); tgt = toWorld(-0.2f, 0.55f, -0.1f); fov = 55; }
        else if (camMode == CAM_ENGINE) { eye = toWorld(0.9f, 2.0f, 3.4f); tgt = toWorld(0, 0.45f, 1.5f); fov = 45; }
        else {
            float cp = (float) Math.cos(pitch);
            eye = new float[]{(float) Math.sin(0.7) * dist * cp, 0.6f + dist * (float) Math.sin(pitch), (float) Math.cos(0.7) * dist * cp};
            tgt = new float[]{0, 0.55f, 0};
        }
        Matrix.setLookAtM(V, 0, eye[0], eye[1], eye[2], tgt[0], tgt[1], tgt[2], 0, 1, 0);
        Matrix.perspectiveM(P, 0, fov, W / (float) H, 0.03f, 200);
        Matrix.multiplyMM(VP, 0, P, 0, V, 0);

        GLES20.glClearColor(0, 0, 0, 1);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST); GLES20.glDisable(GLES20.GL_BLEND);
        common(sky, pal, eye);
        float fx = tgt[0] - eye[0], fy = tgt[1] - eye[1], fz = tgt[2] - eye[2];
        float fl = (float) Math.sqrt(fx * fx + fy * fy + fz * fz); fx /= fl; fy /= fl; fz /= fl;
        float rx = -fz, rz = fx, rl = (float) Math.sqrt(rx * rx + rz * rz); rx /= rl; rz /= rl;
        float ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
        GLES20.glUniform3f(sky.u("uFwd"), fx, fy, fz); GLES20.glUniform3f(sky.u("uRight"), rx, 0, rz); GLES20.glUniform3f(sky.u("uUp"), ux, uy, uz);
        float ty = (float) Math.tan(Math.toRadians(fov) / 2);
        GLES20.glUniform2f(sky.u("uTan"), ty * W / H, ty);
        sky.f1("uCloud", 0.4f); sky.v3("uSunDir", new float[]{0.3f, 0.25f, -1}); sky.v3("uSunCol", pal.sun); sky.f1("uSunStripes", pal.stripes);
        Gl.draw(sky, quad);
        if (hd == null) return;
        GLES20.glEnable(GLES20.GL_DEPTH_TEST); GLES20.glDepthMask(true);
        Matrix.setIdentityM(car, 0); Matrix.translateM(car, 0, 0, st.fly * 1.2f, 0); Matrix.rotateM(car, 0, (float) Math.toDegrees(turn), 0, 1, 0);
        Matrix.rotateM(car, 0, (float) Math.toDegrees(st.fly * 0.06f * Math.sin(t * 0.9f)), 0, 0, 1);
        {   // the body rocks on its mounts with the torque and shivers at idle
            float rk = engineOn ? Math.min(1, Math.max(0, (eng.rpm - 900) / 8000)) : 0;
            float shiver = engineOn ? (float) Math.sin(t * eng.rpm / 60 * 0.5f * 6.283f) * 0.0012f * (1 - rk * 0.6f) : 0;
            Matrix.translateM(car, 0, 0, shiver + rk * 0.004f, 0);
            Matrix.rotateM(car, 0, (float) Math.toDegrees(rk * eng.load * 0.012f + shiver * 0.6f), 0, 0, 1);
        }
        common(hdProg, pal, eye);
        hd.stripe = CarHd.COLORS[stripeC]; hd.rimCol = CarHd.COLORS[rimC]; hd.brakes = brakes;
        hd.setMaterials(paint, pal.neonA, pal.neonB);
        hdProg.f1("uSpd", 0); hdProg.f1("uRpmK", eng.rpm / eng.limiter()); hdProg.f1("uGear", power == 2 ? -2 : -1); hdProg.f1("uFuelK", eng.fuelK); hdProg.f1("uGx", 0);
        hdProg.f1("uKey", 1.15f); hdProg.f1("uLights", lights); hdProg.f1("uBrake", lights * 0.3f);
        if (camMode != CAM_COCKPIT) {
            Matrix.setIdentityM(mir, 0); Matrix.scaleM(mir, 0, 1, -1, 1); Matrix.multiplyMM(mir, 0, mir.clone(), 0, car, 0);
            hd.draw(mir, st, false);
        }
        GLES20.glEnable(GLES20.GL_BLEND); GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        common(floor, pal, eye); floor.f1("uAlpha", 0.86f); Gl.draw(floor, ground);
        GLES20.glDisable(GLES20.GL_BLEND);
        common(hdProg, pal, eye);
        hd.draw(car, st, false);
        GLES20.glEnable(GLES20.GL_BLEND); GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA); GLES20.glDepthMask(false);
        hd.draw(car, st, true);
        exhaust.update(dt, car, 0, 0, eng);
        common(fxProg, pal, eye);
        exhaust.draw(fxProg, H / (2 * (float) Math.tan(Math.toRadians(fov) / 2)));
        GLES20.glDepthMask(true); GLES20.glDisable(GLES20.GL_BLEND);
    }
}
