package it.ampy.cybercity.game;

import it.ampy.cybercity.L;

/** Original low neon coupe ("AMPY KAGE GT"). Port of buildCarModel() in web/game.js. */
final class CarModel {
    static final String[] PAINT_KEYS = {"nero", "rosso", "perla", "oro", "ciano", "viola"};
    static final String[] PAINT_NAMES = {L.t("NERO NEON"), L.t("ROSSO CORSA"), L.t("BIANCO PERLA"), L.t("ORO"), L.t("CIANO"), L.t("VIOLA")};
    static final float[][] PAINTS = {{0.05f, 0.05f, 0.07f}, {0.42f, 0.03f, 0.05f}, {0.72f, 0.72f, 0.76f}, {0.5f, 0.36f, 0.08f}, {0.0f, 0.32f, 0.38f}, {0.22f, 0.04f, 0.32f}};
    static int paintIndex(String k) { for (int i = 0; i < PAINT_KEYS.length; i++) if (PAINT_KEYS[i].equals(k)) return i; return 0; }

    final Gl.FL pos = new Gl.FL(), norm = new Gl.FL(), col = new Gl.FL(); final Gl.SL idx = new Gl.SL();
    static final class Glow { final Gl.FL pos = new Gl.FL(), uv = new Gl.FL(), col = new Gl.FL(); final Gl.SL idx = new Gl.SL(); }
    final Glow under = new Glow(), heads = new Glow(), tail = new Glow();

    private void quad(float[] a, float[] b, float[] c, float[] d, float[] cl, float em) {
        float ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        float nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        float l = (float) Math.sqrt(nx * nx + ny * ny + nz * nz); if (l == 0) l = 1; nx /= l; ny /= l; nz /= l;
        int base = pos.n / 3;
        for (float[] p : new float[][]{a, b, c, d}) { pos.add(p[0], p[1], p[2]); norm.add(nx, ny, nz); col.add(cl[0], cl[1], cl[2], em); }
        idx.add(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    private static float[] v(float x, float y, float z) { return new float[]{x, y, z}; }

    private void sp(float x0, float x1, float y0, float y1, float z0, float z1, float[] c, float em) {
        quad(v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1), c, em);
        quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y0, z0), v(x0, y0, z0), c, em);
        quad(v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0), c, em);
        quad(v(x1, y0, z1), v(x0, y0, z1), v(x0, y1, z1), v(x1, y1, z1), c, em);
    }
    private static void gq(Glow g, float[] a, float[] b, float[] c, float[] d, float[] cl, float al) {
        int base = g.pos.n / 3;
        float[][] ps = {a, b, c, d}, uvs = {{-1, -1}, {1, -1}, {1, 1}, {-1, 1}};
        for (int i = 0; i < 4; i++) { g.pos.add(ps[i]); g.uv.add(uvs[i]); g.col.add(cl[0], cl[1], cl[2], al); }
        g.idx.add(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    CarModel(float[] paint, float[] accent) {
        float[] dark = {0.02f, 0.02f, 0.025f}, glass = {0.03f, 0.05f, 0.08f}, tyre = {0.015f, 0.015f, 0.015f};
        float[][] st = {
            {-2.30f, 0.86f, 0.30f, 0.78f}, {-2.08f, 0.97f, 0.24f, 0.86f}, {-1.30f, 1.00f, 0.22f, 0.88f}, {-0.45f, 1.00f, 0.22f, 0.87f},
            {0.55f, 1.00f, 0.22f, 0.81f}, {1.35f, 0.98f, 0.22f, 0.72f}, {2.02f, 0.92f, 0.24f, 0.58f}, {2.34f, 0.72f, 0.30f, 0.42f}};
        for (int i = 0; i < st.length - 1; i++) {
            float z0 = st[i][0], w0 = st[i][1], b0 = st[i][2], t0 = st[i][3];
            float z1 = st[i + 1][0], w1 = st[i + 1][1], b1 = st[i + 1][2], t1 = st[i + 1][3];
            float crown = 0.05f;
            quad(v(w0, b0, z0), v(w1, b1, z1), v(w1, t1, z1), v(w0, t0, z0), paint, 0);
            quad(v(-w1, b1, z1), v(-w0, b0, z0), v(-w0, t0, z0), v(-w1, t1, z1), paint, 0);
            quad(v(w0, t0, z0), v(w1, t1, z1), v(0, t1 + crown, z1), v(0, t0 + crown, z0), paint, 0);
            quad(v(0, t0 + crown, z0), v(0, t1 + crown, z1), v(-w1, t1, z1), v(-w0, t0, z0), paint, 0);
            quad(v(-w0, b0, z0), v(-w1, b1, z1), v(w1, b1, z1), v(w0, b0, z0), dark, 0);
            quad(v(w0 + 0.012f, t0 - 0.1f, z0), v(w1 + 0.012f, t1 - 0.1f, z1), v(w1 + 0.012f, t1 - 0.06f, z1), v(w0 + 0.012f, t0 - 0.06f, z0), accent, 0.9f);
            quad(v(-w1 - 0.012f, t1 - 0.1f, z1), v(-w0 - 0.012f, t0 - 0.1f, z0), v(-w0 - 0.012f, t0 - 0.06f, z0), v(-w1 - 0.012f, t1 - 0.06f, z1), accent, 0.9f);
        }
        {
            float z = st[0][0], w = st[0][1], b = st[0][2], t = st[0][3];
            quad(v(-w, b, z), v(w, b, z), v(w, t, z), v(-w, t, z), dark, 0);
            quad(v(-w * 0.92f, t - 0.16f, z - 0.005f), v(w * 0.92f, t - 0.16f, z - 0.005f), v(w * 0.92f, t - 0.06f, z - 0.005f), v(-w * 0.92f, t - 0.06f, z - 0.005f), new float[]{1.0f, 0.08f, 0.12f}, 1);
        }
        {
            float[] l = st[st.length - 1]; float z = l[0], w = l[1], b = l[2], t = l[3];
            quad(v(w, b, z), v(-w, b, z), v(-w, t, z), v(w, t, z), dark, 0);
            for (float sx : new float[]{-1, 1})
                quad(v(sx * 0.62f, t - 0.06f, z + 0.004f), v(sx * 0.2f, t - 0.02f, z + 0.004f), v(sx * 0.2f, t, z + 0.004f), v(sx * 0.62f, t, z + 0.004f), new float[]{0.85f, 0.95f, 1.0f}, 1);
        }
        float[][] cb = {{-1.35f, 0.74f, 0.86f, 0.86f}, {-0.95f, 0.66f, 1.20f, 0.87f}, {0.10f, 0.70f, 1.24f, 0.84f}, {0.95f, 0.80f, 0.80f, 0.80f}};
        for (int i = 0; i < cb.length - 1; i++) {
            float z0 = cb[i][0], r0 = cb[i][1], y0 = cb[i][2], b0 = cb[i][3];
            float z1 = cb[i + 1][0], r1 = cb[i + 1][1], y1 = cb[i + 1][2], b1 = cb[i + 1][3];
            float[] g = i == 0 || i == cb.length - 2 ? glass : paint;
            quad(v(0.92f, b0, z0), v(0.92f, b1, z1), v(r1, y1, z1), v(r0, y0, z0), glass, 0.04f);
            quad(v(-r0, y0, z0), v(-r1, y1, z1), v(-0.92f, b1, z1), v(-0.92f, b0, z0), glass, 0.04f);
            quad(v(r0, y0, z0), v(r1, y1, z1), v(-r1, y1, z1), v(-r0, y0, z0), g, 0.02f);
        }
        sp(-0.95f, 0.95f, 1.02f, 1.06f, -2.25f, -1.9f, paint, 0);
        sp(-0.95f, 0.95f, 1.06f, 1.075f, -2.25f, -2.2f, accent, 0.9f);
        for (float sx : new float[]{-0.6f, 0.6f}) sp(sx - 0.04f, sx + 0.04f, 0.86f, 1.02f, -2.12f, -2.04f, dark, 0);
        float[][] wheels = {{0.9f, 1.42f}, {-0.9f, 1.42f}, {0.9f, -1.45f}, {-0.9f, -1.45f}};
        for (float[] wh : wheels) {
            float wx = wh[0], wz = wh[1], r = 0.36f, sgn = Math.signum(wx), xi = wx - sgn * 0.16f, xo = wx + sgn * 0.14f;
            for (int k = 0; k < 8; k++) {
                double a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4;
                float y0 = 0.36f + (float) Math.cos(a0) * r, z0 = wz + (float) Math.sin(a0) * r, y1 = 0.36f + (float) Math.cos(a1) * r, z1 = wz + (float) Math.sin(a1) * r;
                quad(v(xi, y0, z0), v(xo, y0, z0), v(xo, y1, z1), v(xi, y1, z1), tyre, 0);
                quad(v(xo, 0.36f, wz), v(xo, y1, z1), v(xo, y0, z0), v(xo, 0.36f, wz), k % 2 == 1 ? dark : new float[]{0.12f, 0.12f, 0.14f}, 0);
                float ri = 0.27f, xs = xo + sgn * 0.003f;
                quad(v(xs, 0.36f + (float) Math.cos(a0) * ri, wz + (float) Math.sin(a0) * ri), v(xs, y0, z0), v(xs, y1, z1),
                    v(xs, 0.36f + (float) Math.cos(a1) * ri, wz + (float) Math.sin(a1) * ri), accent, 0.55f);
            }
        }
        gq(under, v(-1.6f, 0.04f, -3.0f), v(1.6f, 0.04f, -3.0f), v(1.6f, 0.04f, 3.0f), v(-1.6f, 0.04f, 3.0f), accent, 1.0f);
        gq(heads, v(-4.0f, 0.05f, 2.5f), v(4.0f, 0.05f, 2.5f), v(6.0f, 0.05f, 22), v(-6.0f, 0.05f, 22), new float[]{1.0f, 0.95f, 0.85f}, 0.55f);
        for (float sx : new float[]{-0.42f, 0.42f})
            gq(heads, v(sx - 0.45f, 0.25f, 2.4f), v(sx + 0.45f, 0.25f, 2.4f), v(sx + 0.45f, 0.85f, 2.4f), v(sx - 0.45f, 0.85f, 2.4f), new float[]{0.85f, 0.95f, 1.0f}, 0.9f);
        gq(tail, v(-1.5f, 0.35f, -2.36f), v(1.5f, 0.35f, -2.36f), v(1.5f, 1.05f, -2.36f), v(-1.5f, 1.05f, -2.36f), new float[]{1.0f, 0.08f, 0.15f}, 0.85f);
        gq(tail, v(-1.4f, 0.04f, -6.0f), v(1.4f, 0.04f, -6.0f), v(1.4f, 0.04f, -2.2f), v(-1.4f, 0.04f, -2.2f), new float[]{1.0f, 0.05f, 0.1f}, 0.35f);
    }
}
