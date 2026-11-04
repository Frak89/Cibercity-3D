package it.ampy.cybercity.game;

import java.util.Random;

/** Engine state of the AMPY KAGE GT (rpm, gear, load, turbo, backfire pops). Port of EngineSim in web/engine_fx.js. */
final class EngineSim {
    static final float IDLE = 900, RED = 8900, LIMITER = 9100, FINAL = 4.70f, WHEEL_R = 0.365f;
    static final float[] RATIOS = {3.30f, 2.35f, 1.80f, 1.45f, 1.20f, 1.02f, 0.88f, 0.76f};
    static final float[][] TIPS = {{-0.38f, 0.33f, -2.40f}, {-0.22f, 0.33f, -2.40f}, {0.22f, 0.33f, -2.40f}, {0.38f, 0.33f, -2.40f}};

    static final float[][] HUBS = {{-0.92f, 0.36f, 1.42f}, {0.92f, 0.36f, 1.42f}, {-0.92f, 0.36f, -1.45f}, {0.92f, 0.36f, -1.45f}};
    /** power units: 0 V8 biturbo hybrid, 1 quad-rotor Wankel H2 hybrid, 2 LEVITA electromagnetic (no gears) */
    static final float[] T_IDLE = {900, 1150, 600}, T_RED = {8900, 10200, 21000}, T_LIM = {9100, 10500, 22000}, T_FINAL = {4.70f, 5.40f, 0};

    volatile int type = 0;
    volatile boolean race = false;             // sport exhaust: louder, earlier and longer crackle
    volatile float chrono = 0; private volatile int boomPend = 0;
    static final float[][] TIPS_RACE = {{-0.40f, 0.32f, -2.50f}, {-0.20f, 0.32f, -2.50f}, {0.20f, 0.32f, -2.50f}, {0.40f, 0.32f, -2.50f}};
    void boom() { boomPend++; }
    synchronized int takeBoom() { int b = boomPend; boomPend = 0; return b; }
    volatile float rpm = IDLE, load = 0, boostLvl = 0, speed = 0;
    volatile int gear = 0;           // -1 neutral, -2 electric direct drive
    volatile boolean off = false;
    float thr = 0, shift = 0, crackle = 0, crackleT = 0, cut = 0;
    boolean armed = false;
    /** pops fired during the last update (read by the effects on the GL thread) */
    int pops = 0; float popStrength = 0;
    /** pops waiting for the audio thread */
    private int audioPops = 0; private float audioPopS = 0;
    private final Random rnd = new Random();

    void setType(int t) { if (t != type) { type = Math.max(0, Math.min(2, t)); rpm = T_IDLE[type]; gear = 0; } }
    float limiter() { return T_LIM[type]; }
    float red() { return T_RED[type]; }

    private void firePop(float s) {
        pops++; popStrength = Math.max(popStrength, s);
        synchronized (this) { audioPops++; audioPopS = Math.max(audioPopS, s); }
    }
    /** audio thread: take the pending pops (returns count, strength in out[0]) */
    synchronized int takePops(float[] out) { int n = audioPops; out[0] = audioPopS; audioPops = 0; audioPopS = 0; return n; }

    void update(float dt, float spd, float throttle, boolean boost, boolean free) {
        pops = 0; popStrength = 0;
        if (off) { rpm = Math.max(0, rpm - dt * 4000); load = 0; thr = 0; return; }
        final int ty = type; final float idle = T_IDLE[ty], red = T_RED[ty], lim = T_LIM[ty], fin = T_FINAL[ty];
        float in = Math.max(0, Math.min(1, throttle));
        thr += (in - thr) * Math.min(1, dt * (in > thr ? 14 : 9));
        float r = rpm, target, v = Math.abs(spd), wheelRpm = v / (float) (2 * Math.PI * WHEEL_R) * 60;
        if (ty == 2) {
            target = free ? idle + (float) Math.pow(thr, 1.1) * (lim - idle) : Math.max(idle + thr * 2500, wheelRpm * 6.9f);
            r += (target - r) * Math.min(1, dt * (target > r ? 4 : 2));
            gear = -2;
        } else if (free) {
            target = idle + (float) Math.pow(thr, 1.15) * (lim + 200 - idle);
            float k = target > r ? (ty == 1 ? 9.5f : 7.5f) : (ty == 1 ? 3.4f : 2.6f);
            r += (target - r) * Math.min(1, dt * k);
            gear = -1;
        } else {
            if (gear < 0) gear = 0;
            float g = wheelRpm * RATIOS[gear] * fin;
            if (shift <= 0) {
                if (g > red - 250 && gear < 7) { gear++; shift = 0.14f; if (thr > 0.6f) firePop(0.9f); }
                else if (gear > 0 && g < red * 0.37f) { gear--; shift = 0.10f; }
            }
            g = wheelRpm * RATIOS[gear] * fin;
            float slip = Math.max(0, 1 - v / 9);
            target = Math.max(Math.max(idle + thr * 600, g), idle + slip * thr * red * 0.4f);
            if (shift > 0) { shift -= dt; target *= 0.93f; }
            r += (target - r) * Math.min(1, dt * 12);
        }
        if (cut > 0) cut -= dt;
        if (ty != 2 && r > lim) { r = lim - 350; cut = 0.06f; if (rnd.nextFloat() < 0.6f) firePop(0.55f); }
        rpm = Math.max(idle * 0.92f, r);
        load = cut > 0 ? 0 : thr;
        speed = v;
        float bt = boost ? 1 : Math.max(0, (rpm - idle * 2.6f) / (red * 0.68f)) * thr;
        boostLvl += (bt - boostLvl) * Math.min(1, dt * 3);
        final boolean rc = race; float hi = red * (rc ? 0.36f : 0.47f);
        if (thr > 0.6f && rpm > hi) armed = true;
        if (armed && thr < 0.3f) { armed = false; if (rpm > hi * 0.9f) { crackle = (rc ? 1.0f : 0.55f) + rnd.nextFloat() * (rc ? 0.9f : 0.6f); crackleT = 0.02f; firePop(1); } }
        if (crackle > 0) {
            crackle -= dt; crackleT -= dt;
            if (crackleT <= 0 && thr < 0.3f && rpm > red * (rc ? 0.2f : 0.27f)) { firePop((rc ? 0.55f : 0.35f) + rnd.nextFloat() * 0.65f); crackleT = rc ? 0.02f + rnd.nextFloat() * 0.07f : 0.03f + rnd.nextFloat() * 0.11f; }
        }
    }
}
