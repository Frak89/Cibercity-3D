package it.ampy.cybercity.game;

import android.opengl.GLES20;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.Random;

/** Exhaust smoke + backfire flames as point sprites (particle.vert / particle.frag). Port of ExhaustFX in web/engine_fx.js. */
final class ExhaustFx {
    private static final int STRIDE = 9, MAX = 700;
    // particle arrays (struct of arrays, swap-remove)
    private final int[] k = new int[MAX];
    private final float[] x = new float[MAX], y = new float[MAX], z = new float[MAX], vx = new float[MAX], vy = new float[MAX], vz = new float[MAX];
    private final boolean[] h2 = new boolean[MAX], mag = new boolean[MAX];
    private final float[][] hubs = new float[4][3];
    private final float[] age = new float[MAX], life = new float[MAX], s0 = new float[MAX], s1 = new float[MAX], c = new float[MAX], al = new float[MAX], seed = new float[MAX], hot = new float[MAX];
    private int n = 0, smokeN = 0, flameN = 0;
    private float acc = 0;
    private final float[] data = new float[MAX * STRIDE];
    private final FloatBuffer fb = ByteBuffer.allocateDirect(MAX * STRIDE * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
    private final Random rnd = new Random();
    private int vbo = 0;
    private final float[][] tips = new float[4][3];
    private final float[] dir = new float[3];

    void shift(float dx, float dy, float dz) { for (int i = 0; i < n; i++) { x[i] += dx; y[i] += dy; z[i] += dz; } }

    private float r() { return rnd.nextFloat(); }
    private boolean curH2 = false, curMag = false;

    private void add(int kind, float px, float py, float pz, float ux, float uy, float uz, float lf, float a0, float a1, float col, float alpha) {
        if (n >= MAX) return;
        int i = n++;
        h2[i] = curH2; mag[i] = curMag;
        k[i] = kind; x[i] = px; y[i] = py; z[i] = pz; vx[i] = ux; vy[i] = uy; vz[i] = uz; age[i] = 0; life[i] = lf; s0[i] = a0; s1[i] = a1; c[i] = col; al[i] = alpha; seed[i] = r(); hot[i] = r();
    }

    /** M: car model matrix (column major); vel: car velocity in world (m/s) */
    void update(float dt, float[] M, float velX, float velZ, EngineSim sim) {
        for (int t = 0; t < 4; t++) {
            float[] p = (sim.race && sim.type != 2 ? EngineSim.TIPS_RACE : EngineSim.TIPS)[t];
            tips[t][0] = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12];
            tips[t][1] = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13];
            tips[t][2] = M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14];
        }
        float dx = -M[8], dy = -M[9] + 0.04f, dz = -M[10], dl = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        dir[0] = dx / dl; dir[1] = dy / dl; dir[2] = dz / dl;
        for (int t = 0; t < 4; t++) {
            float[] p = EngineSim.HUBS[t]; float py = p[1] + 0.04f;
            hubs[t][0] = M[0] * p[0] + M[4] * py + M[8] * p[2] + M[12];
            hubs[t][1] = M[1] * p[0] + M[5] * py + M[9] * p[2] + M[13];
            hubs[t][2] = M[2] * p[0] + M[6] * py + M[10] * p[2] + M[14];
        }
        float speed = (float) Math.hypot(velX, velZ), load = sim.load, rpm = sim.rpm;
        final boolean H2 = sim.type == 1;
        curH2 = H2; curMag = false;
        if (sim.type == 2) { sparks(dt, velX, velZ, sim); integrate(dt); return; }
        float rate = sim.off ? 0 : (6 + load * 22 + Math.max(0, rpm - 3000) / 6000 * 6) / (1 + speed * 0.06f);
        acc += rate * dt;
        while (acc >= 1) {
            acc -= 1;
            for (float[] t : tips) {
                float ex = 0.8f + load * 2.6f + r() * 0.6f;
                add(0, t[0] + (r() - 0.5f) * 0.03f, t[1] + (r() - 0.5f) * 0.03f, t[2] + (r() - 0.5f) * 0.03f,
                    velX + dir[0] * ex + (r() - 0.5f) * 0.3f, dir[1] * ex + 0.15f + r() * 0.2f, velZ + dir[2] * ex + (r() - 0.5f) * 0.3f,
                    1.3f + r() * 1.3f - Math.min(0.8f, speed * 0.02f), 0.07f, 0.75f + r() * 0.55f + load * 0.4f,
                    H2 ? 0.86f + r() * 0.1f : 0.55f + r() * 0.15f - load * 0.12f, H2 ? 0.08f + load * 0.05f : 0.13f + load * 0.08f);
            }
        }
        if (sim.pops > 0) {
            float st = Math.max(0.35f, sim.popStrength);
            for (float[] t : tips) {
                if (r() < 0.25f && st < 0.7f) continue;
                int cnt = 3 + (int) (r() * 3 + st * 3);
                for (int i = 0; i < cnt; i++) {
                    float ex = 3 + r() * 5 * st, off = r() * 0.12f;
                    add(1, t[0] + dir[0] * off, t[1] + dir[1] * off, t[2] + dir[2] * off,
                        velX + dir[0] * ex + (r() - 0.5f) * 0.8f, dir[1] * ex + (r() - 0.3f) * 0.6f, velZ + dir[2] * ex + (r() - 0.5f) * 0.8f,
                        0.05f + r() * 0.09f * (0.6f + st), 0.06f + 0.07f * st, 0.13f + 0.17f * st * r(), 0, 1);
                }
                add(0, t[0], t[1], t[2], velX + dir[0] * 2, 0.3f, velZ + dir[2] * 2, 0.9f + r() * 0.6f, 0.15f, 0.9f, H2 ? 0.9f : 0.3f, H2 ? 0.16f : 0.32f);
            }
        }
        integrate(dt);
    }
    /** LEVITA: blue-white sparks between the spheres and the arch emitters; bursts on field discharges */
    private void sparks(float dt, float velX, float velZ, EngineSim sim) {
        curH2 = false; curMag = true;
        float kk = Math.min(1, sim.rpm / 22000);
        if (!sim.off) acc += (4 + sim.load * 30 + kk * 12) * dt;
        while (acc >= 1) { acc -= 1; spark(hubs[rnd.nextInt(4)], velX, velZ, false); }
        if (sim.pops > 0) { int b = 6 + (int) (sim.popStrength * 10); for (int i = 0; i < b; i++) for (float[] h : hubs) spark(h, velX, velZ, true); }
    }
    private void spark(float[] h, float velX, float velZ, boolean big) {
        float a = r() * 6.2831853f, rr = 0.30f + r() * 0.06f; boolean ring = r() < 0.5f;
        float px = h[0] + (ring ? (float) Math.cos(a) * 0.15f : (r() - 0.5f) * 0.25f), py = ring ? 0.03f : h[1] + (float) Math.sin(a) * rr * 0.9f + 0.04f, pz = h[2] + (ring ? (float) Math.sin(a) * rr * 0.8f : (float) Math.cos(a) * rr);
        add(1, px, py, pz, velX * 0.9f + (r() - 0.5f) * 1.5f, (r() - 0.3f) * 1.2f, velZ * 0.9f + (r() - 0.5f) * 1.5f, 0.04f + r() * (big ? 0.16f : 0.08f), big ? 0.08f : 0.04f, big ? 0.02f : 0.01f, 0, 1);
    }
    private void integrate(float dt) {
        for (int i = n - 1; i >= 0; i--) {
            age[i] += dt;
            if (age[i] >= life[i]) { remove(i); continue; }
            float drag = (float) Math.exp(-(k[i] == 1 ? 7 : 2.6f) * dt);
            vx[i] *= drag; vz[i] *= drag; vy[i] = vy[i] * drag + (k[i] == 1 ? 0.6f : 0.35f) * dt;
            x[i] += vx[i] * dt; y[i] += vy[i] * dt; z[i] += vz[i] * dt;
            if (y[i] < 0.05f) { y[i] = 0.05f; vy[i] = Math.abs(vy[i]) * 0.2f; }
        }
        int sN = 0, fN = 0;
        for (int pass = 0; pass < 2; pass++) for (int i = 0; i < n; i++) {
            if (k[i] != pass) continue;
            float f = age[i] / life[i]; int o = (sN + fN) * STRIDE;
            data[o] = x[i]; data[o + 1] = y[i]; data[o + 2] = z[i];
            if (pass == 0) {
                float a = al[i] * Math.min(1, f * 6) * (1 - f) * (1 - f);
                data[o + 3] = c[i]; data[o + 4] = c[i]; data[o + 5] = c[i] * 1.05f; data[o + 6] = a;
                data[o + 7] = s0[i] + (s1[i] - s0[i]) * (float) Math.sqrt(f); data[o + 8] = seed[i] * 0.9f; sN++;
            } else {
                float cr = 1, cg = 0.5f - f * 0.32f + hot[i] * 0.12f, cb = Math.max(0, 0.35f - f * 1.6f) + 0.03f;
                if (h2[i]) { cr = 0.35f + 0.25f * (1 - f); cg = 0.45f + 0.2f * (1 - f); cb = 1; }
                if (mag[i]) { cr = 0.55f + 0.45f * (1 - f); cg = 0.8f + 0.2f * (1 - f); cb = 1; }
                data[o + 3] = cr; data[o + 4] = cg; data[o + 5] = cb; data[o + 6] = 0.75f * (1 - f) * (1 - f * 0.5f);
                data[o + 7] = s0[i] + (s1[i] - s0[i]) * f; data[o + 8] = 1 + seed[i] * 0.9f; fN++;
            }
        }
        smokeN = sN; flameN = fN;
    }
    private void remove(int i) {
        int j = --n; if (i == j) return;
        h2[i] = h2[j]; mag[i] = mag[j];
        k[i] = k[j]; x[i] = x[j]; y[i] = y[j]; z[i] = z[j]; vx[i] = vx[j]; vy[i] = vy[j]; vz[i] = vz[j]; age[i] = age[j]; life[i] = life[j];
        s0[i] = s0[j]; s1[i] = s1[j]; c[i] = c[j]; al[i] = al[j]; seed[i] = seed[j]; hot[i] = hot[j];
    }
    /** chrono: blue arcs crawling over the body (k 0..1) */
    void chronoArcs(float[] M, float k, float velX, float velZ) {
        curH2 = false; curMag = true;
        int cnt = (int) (k * k * 14) + (r() < k ? 1 : 0);
        for (int i = 0; i < cnt; i++) {
            float side = r() < 0.5f ? -1 : 1, z = (r() * 2 - 1) * 2.3f, y = 0.3f + r() * 0.9f;
            float x = side * (0.95f + r() * 0.12f) * (1 - (float) Math.pow(Math.abs(z) / 2.5f, 4) * 0.4f);
            add(1, M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14],
                velX + (r() - 0.5f) * 2, (r() - 0.5f) * 2, velZ + (r() - 0.5f) * 2, 0.05f + r() * 0.1f, 0.10f, 0.03f, 0, 1);
        }
    }
    /** burst ring around the car (arrival) */
    void ring(float[] M, float radius, float velX, float velZ, int cnt) {
        curH2 = false; curMag = true;
        for (int i = 0; i < cnt; i++) {
            float a = i / (float) cnt * 6.2831853f, ca = (float) Math.cos(a), sa = (float) Math.sin(a);
            float x = ca * radius, y = 0.15f + r() * 0.3f, z = sa * radius * 1.6f;
            float ox = ca * 9, oz = sa * 9;
            add(1, M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14],
                velX * 0.3f + ox * M[0] + oz * M[8], 0.5f + r(), velZ * 0.3f + ox * M[2] + oz * M[10], 0.35f + r() * 0.35f, 0.35f, 0.08f, 0, 1);
        }
    }
    private float tacc = 0;
    /** white tyre smoke from the rear contact patches (amount 0..1) */
    void tyreSmoke(float dt, float[] M, float amount, float velX, float velZ, float track) {
        if (amount < 0.05f) return;
        curH2 = false; curMag = false;
        tacc += amount * 70 * dt;
        while (tacc >= 1) {
            tacc -= 1;
            float sx = r() < 0.5f ? -1 : 1, x = sx * (0.92f + track), y = 0.08f, z = -1.45f - r() * 0.2f;
            add(0, M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14],
                velX * 0.25f + (r() - 0.5f) * 1.5f, 0.25f + r() * 0.5f, velZ * 0.25f + (r() - 0.5f) * 1.5f, 1.6f + r() * 1.8f, 0.35f, 2.4f + r() * 1.4f, 0.82f + r() * 0.12f, 0.18f + 0.2f * amount);
        }
    }
    void reset() { n = 0; smokeN = flameN = 0; }

    /** draw with the particle program already in use (common uniforms set); scale = H / (2 tan(fov / 2)). Leaves depth writes off. */
    void draw(Gl.Prog p, float scale) {
        int cnt = smokeN + flameN; if (cnt == 0) return;
        if (vbo == 0) { int[] b = new int[1]; GLES20.glGenBuffers(1, b, 0); vbo = b[0]; }
        fb.clear(); fb.put(data, 0, cnt * STRIDE); fb.position(0);
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, vbo);
        GLES20.glBufferData(GLES20.GL_ARRAY_BUFFER, cnt * STRIDE * 4, fb, GLES20.GL_DYNAMIC_DRAW);
        p.f1("uScale", scale);
        int aP = p.a("aPos"), aC = p.a("aCol"), aI = p.a("aInfo"), S = STRIDE * 4;
        GLES20.glEnableVertexAttribArray(aP); GLES20.glVertexAttribPointer(aP, 3, GLES20.GL_FLOAT, false, S, 0);
        GLES20.glEnableVertexAttribArray(aC); GLES20.glVertexAttribPointer(aC, 4, GLES20.GL_FLOAT, false, S, 12);
        GLES20.glEnableVertexAttribArray(aI); GLES20.glVertexAttribPointer(aI, 2, GLES20.GL_FLOAT, false, S, 28);
        GLES20.glEnable(GLES20.GL_BLEND); GLES20.glDepthMask(false);
        if (smokeN > 0) { GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA); GLES20.glDrawArrays(GLES20.GL_POINTS, 0, smokeN); }
        if (flameN > 0) { GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE); GLES20.glDrawArrays(GLES20.GL_POINTS, smokeN, flameN); }
        GLES20.glDisableVertexAttribArray(aP); GLES20.glDisableVertexAttribArray(aC); GLES20.glDisableVertexAttribArray(aI);
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, 0);
    }
    void glLost() { vbo = 0; }
}
