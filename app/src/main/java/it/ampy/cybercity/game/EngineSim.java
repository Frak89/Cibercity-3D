package it.ampy.cybercity.game;

import java.util.Random;

/** Engine state of the AMPY KAGE GT (rpm, gear, load, turbo, backfire pops). Port of EngineSim in web/engine_fx.js. */
final class EngineSim {
    static final float IDLE = 900, RED = 8900, LIMITER = 9100, FINAL = 4.70f, WHEEL_R = 0.365f;
    static final float[] RATIOS = {3.30f, 2.35f, 1.80f, 1.45f, 1.20f, 1.02f, 0.88f, 0.76f};
    static final float[][] TIPS = {{-0.38f, 0.33f, -2.40f}, {-0.22f, 0.33f, -2.40f}, {0.22f, 0.33f, -2.40f}, {0.38f, 0.33f, -2.40f}};

    volatile float rpm = IDLE, load = 0, boostLvl = 0;
    volatile int gear = 0;
    volatile boolean off = false;
    float thr = 0, shift = 0, crackle = 0, crackleT = 0, cut = 0;
    boolean armed = false;
    /** pops fired during the last update (read by the effects on the GL thread) */
    int pops = 0; float popStrength = 0;
    /** pops waiting for the audio thread */
    private int audioPops = 0; private float audioPopS = 0;
    private final Random rnd = new Random();

    private void firePop(float s) {
        pops++; popStrength = Math.max(popStrength, s);
        synchronized (this) { audioPops++; audioPopS = Math.max(audioPopS, s); }
    }
    /** audio thread: take the pending pops (returns count, strength in out[0]) */
    synchronized int takePops(float[] out) { int n = audioPops; out[0] = audioPopS; audioPops = 0; audioPopS = 0; return n; }

    void update(float dt, float speed, float throttle, boolean boost, boolean free) {
        pops = 0; popStrength = 0;
        if (off) { rpm = Math.max(0, rpm - dt * 4000); load = 0; thr = 0; return; }
        float in = Math.max(0, Math.min(1, throttle));
        thr += (in - thr) * Math.min(1, dt * (in > thr ? 14 : 9));
        float r = rpm, target;
        if (free) {
            target = IDLE + (float) Math.pow(thr, 1.15) * (LIMITER + 200 - IDLE);
            float k = target > r ? 7.5f : 2.6f;
            r += (target - r) * Math.min(1, dt * k);
            gear = -1;
        } else {
            float v = Math.abs(speed), wheelRpm = v / (float) (2 * Math.PI * WHEEL_R) * 60;
            if (gear < 0) gear = 0;
            float g = wheelRpm * RATIOS[gear] * FINAL;
            if (shift <= 0) {
                if (g > RED - 250 && gear < 7) { gear++; shift = 0.14f; if (thr > 0.6f) firePop(0.9f); }
                else if (gear > 0 && g < 3300) { gear--; shift = 0.10f; }
            }
            g = wheelRpm * RATIOS[gear] * FINAL;
            float slip = Math.max(0, 1 - v / 9);
            target = Math.max(Math.max(IDLE + thr * 600, g), IDLE + slip * thr * 3600);
            if (shift > 0) { shift -= dt; target *= 0.93f; }
            r += (target - r) * Math.min(1, dt * 12);
        }
        if (cut > 0) cut -= dt;
        if (r > LIMITER) { r = LIMITER - 350; cut = 0.06f; if (rnd.nextFloat() < 0.6f) firePop(0.55f); }
        rpm = Math.max(IDLE * 0.92f, r);
        load = cut > 0 ? 0 : thr;
        float bt = boost ? 1 : Math.max(0, (rpm - 2500) / 6000) * thr;
        boostLvl += (bt - boostLvl) * Math.min(1, dt * 3);
        if (thr > 0.6f && rpm > 4200) armed = true;
        if (armed && thr < 0.3f) { armed = false; if (rpm > 3800) { crackle = 0.55f + rnd.nextFloat() * 0.6f; crackleT = 0.02f; firePop(1); } }
        if (crackle > 0) {
            crackle -= dt; crackleT -= dt;
            if (crackleT <= 0 && thr < 0.3f && rpm > 2400) { firePop(0.35f + rnd.nextFloat() * 0.65f); crackleT = 0.03f + rnd.nextFloat() * 0.11f; }
        }
    }
}
