package it.ampy.cybercity.game;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/** The past: an endless meadow with conifers, broadleaf trees, rocks and bushes on the torus world.
 *  Same generator as buildMeadow() in web/game.js. */
final class Meadow {
    static final float S = GameCity.S, CELL = 16;
    /** sky / fog palette of the meadow (daytime) */
    static final float[] FOG = {0.66f, 0.77f, 0.88f}, TOP = {0.20f, 0.45f, 0.85f}, SUN = {1.0f, 0.95f, 0.82f}, SUN_DIR = {0.45f, 0.55f, 0.7f};
    static final float FOG_DEN = 0.0042f;

    static final class Chunk { final Gl.FL pos = new Gl.FL(), center = new Gl.FL(), norm = new Gl.FL(), col = new Gl.FL(); final Gl.SL idx = new Gl.SL(); int verts = 0; }
    final List<Chunk> chunks = new ArrayList<>();
    final HashMap<Long, List<float[]>> cells = new HashMap<>();
    private Chunk B;
    private long s;

    private float rnd() { s = (s * 1664525L + 1013904223L) & 0xffffffffL; return s / 4294967296f; }

    Meadow(int seed) {
        s = seed & 0xffffffffL;
        B = new Chunk(); chunks.add(B);
        int n = 0;
        while (n < 1500) {
            float x = rnd() * S, z = rnd() * S;
            if (Math.hypot(x, z - 42) <= 30) continue;
            double grove = Math.sin(x * 0.011) * Math.cos(z * 0.013) + Math.sin((x + z) * 0.007);
            if (grove < -0.2 && rnd() < 0.8) continue;
            if (B.verts > 52000) { B = new Chunk(); chunks.add(B); }
            float kind = rnd();
            if (kind < 0.42f) {
                float h = 6 + rnd() * 9, r = 1.6f + rnd() * 1.6f;
                prism(x, z, 0, h * 0.35f, 0.35f, 6, new float[]{0.30f, 0.20f, 0.12f});
                for (int k = 0; k < 3; k++) cone(x, z, h * (0.22f + k * 0.22f), h * (0.55f + k * 0.17f), r * (1 - k * 0.25f), 8, new float[]{0.10f, 0.30f + rnd() * 0.08f, 0.10f}, 1, 0.3f);
                add(x, z, 0.8f);
            } else if (kind < 0.78f) {
                float h = 4 + rnd() * 5, r = 2.2f + rnd() * 2;
                prism(x, z, 0, h * 0.6f, 0.38f, 6, new float[]{0.33f, 0.23f, 0.14f});
                lump(x, z, h * 0.75f, r, r * 0.75f, r, new float[]{0.22f + rnd() * 0.1f, 0.44f + rnd() * 0.1f, 0.12f}, 1, 0.35f);
                add(x, z, 0.8f);
            } else if (kind < 0.93f) {
                float r = 0.5f + (float) Math.pow(rnd(), 2) * 3.2f, g = 0.8f + rnd() * 0.3f;
                lump(x, z, r * 0.25f, r, r * (0.45f + rnd() * 0.3f), r * (0.7f + rnd() * 0.5f), new float[]{0.42f * g, 0.41f * g, 0.38f * g}, 0, 0.45f);
                add(x, z, r * 0.85f);
            } else {
                float r = 0.6f + rnd() * 0.8f;
                lump(x, z, r * 0.4f, r * 1.2f, r * 0.7f, r * 1.2f, new float[]{0.18f, 0.40f, 0.12f}, 1, 0.4f);
            }
            n++;
        }
    }

    private static long key(int ix, int iz) { return ((long) ix << 32) ^ (iz & 0xffffffffL); }
    private void add(float x, float z, float r) {
        long k = key((int) Math.floor(x / CELL), (int) Math.floor(z / CELL));
        List<float[]> l = cells.get(k); if (l == null) { l = new ArrayList<>(); cells.put(k, l); }
        l.add(new float[]{x, z, r});
    }

    private void face(float[] a, float[] b, float[] c, float[] col, float cx, float cz, float leaf) {
        float ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        float nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (l < 1e-9f) l = 1; nx /= l; ny /= l; nz /= l;
        if (ny < -0.2f && leaf < 0.5f && a[1] > 0.05f) { nx = -nx; ny = -ny; nz = -nz; }
        int i = B.verts;
        for (float[] p : new float[][]{a, b, c}) { B.pos.add(p[0], p[1], p[2]); B.norm.add(nx, ny, nz); B.col.add(col[0], col[1], col[2], leaf); B.center.add(cx, cz); }
        B.verts += 3; B.idx.add(i, i + 1, i + 2);
    }
    private float[] jit(float[] c) { float k = 0.85f + rnd() * 0.3f; return new float[]{c[0] * k, c[1] * k, c[2] * k}; }

    private void cone(float cx, float cz, float y0, float y1, float r, int seg, float[] col, float leaf, float jt) {
        for (int k = 0; k < seg; k++) {
            double a0 = k * 2 * Math.PI / seg, a1 = (k + 1) * 2 * Math.PI / seg; float j = 1 + (rnd() - 0.5f) * jt;
            float[] p0 = {(float) Math.cos(a0) * r * j, y0, (float) Math.sin(a0) * r * j}, p1 = {(float) Math.cos(a1) * r, y0, (float) Math.sin(a1) * r};
            float[] tip = {(rnd() - 0.5f) * r * 0.15f, y1, (rnd() - 0.5f) * r * 0.15f};
            float[] c = jit(col);
            face(p0, tip, p1, c, cx, cz, leaf);
            face(p0, p1, new float[]{0, y0 - r * 0.15f, 0}, new float[]{c[0] * 0.7f, c[1] * 0.7f, c[2] * 0.7f}, cx, cz, leaf);
        }
    }
    private void prism(float cx, float cz, float y0, float y1, float r, int seg, float[] col) {
        for (int k = 0; k < seg; k++) {
            double a0 = k * 2 * Math.PI / seg, a1 = (k + 1) * 2 * Math.PI / seg;
            float[] b0 = {(float) Math.cos(a0) * r, y0, (float) Math.sin(a0) * r}, b1 = {(float) Math.cos(a1) * r, y0, (float) Math.sin(a1) * r};
            float[] t0 = {b0[0] * 0.7f, y1, b0[2] * 0.7f}, t1 = {b1[0] * 0.7f, y1, b1[2] * 0.7f};
            face(b0, t0, b1, col, cx, cz, 0); face(b1, t0, t1, col, cx, cz, 0);
        }
    }
    private static final float[][] V0 = {{1, 0, 0}, {-1, 0, 0}, {0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {0, 0, -1}};
    private static final int[][] F0 = {{0, 2, 4}, {4, 2, 1}, {1, 2, 5}, {5, 2, 0}, {4, 3, 0}, {1, 3, 4}, {5, 3, 1}, {0, 3, 5}};
    private void lump(float cx, float cz, float y, float rx, float ry, float rz, float[] col, float leaf, float jt) {
        List<float[]> verts = new ArrayList<>(); for (float[] v : V0) verts.add(v.clone());
        HashMap<Long, Integer> cache = new HashMap<>();
        List<int[]> F = new ArrayList<>();
        for (int[] f : F0) {
            int ab = mid(verts, cache, f[0], f[1]), bc = mid(verts, cache, f[1], f[2]), ca = mid(verts, cache, f[2], f[0]);
            F.add(new int[]{f[0], ab, ca}); F.add(new int[]{ab, f[1], bc}); F.add(new int[]{ca, bc, f[2]}); F.add(new int[]{ab, bc, ca});
        }
        float[] J = new float[verts.size()]; for (int i = 0; i < J.length; i++) J[i] = 1 + (rnd() - 0.5f) * jt;
        for (int[] f : F) {
            float[][] p = new float[3][];
            for (int q = 0; q < 3; q++) { float[] v = verts.get(f[q]); float j = J[f[q]]; p[q] = new float[]{v[0] * rx * j, y + Math.max(v[1], leaf > 0 ? -1 : -0.35f) * ry * j, v[2] * rz * j}; }
            face(p[0], p[1], p[2], jit(col), cx, cz, leaf);
        }
    }
    private static int mid(List<float[]> verts, HashMap<Long, Integer> cache, int a, int b) {
        long k = a < b ? ((long) a << 20) | b : ((long) b << 20) | a;
        Integer h = cache.get(k); if (h != null) return h;
        float[] p = verts.get(a), q = verts.get(b);
        float x = (p[0] + q[0]) / 2, y = (p[1] + q[1]) / 2, z = (p[2] + q[2]) / 2, l = (float) Math.sqrt(x * x + y * y + z * z);
        verts.add(new float[]{x / l, y / l, z / l}); cache.put(k, verts.size() - 1); return verts.size() - 1;
    }

    /** push the car out of trees / rocks; returns impact strength */
    float collide(CarPhysics c) {
        int cx = (int) Math.floor(c.x / CELL), cz = (int) Math.floor(c.z / CELL), nC = (int) (S / CELL); float impact = 0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            int kx = ((cx + i) % nC + nC) % nC, kz = ((cz + j) % nC + nC) % nC;
            List<float[]> L = cells.get(key(kx, kz)); if (L == null) continue;
            for (float[] o : L) {
                float dx = c.x - o[0], dz = c.z - o[1]; dx -= Math.round(dx / S) * S; dz -= Math.round(dz / S) * S;
                float d = (float) Math.sqrt(dx * dx + dz * dz), r = o[2] + 1.1f;
                if (d >= r || d < 1e-4f) continue;
                float nx = dx / d, nz = dz / d; c.x += nx * (r - d); c.z += nz * (r - d);
                float vn = c.vx * nx + c.vz * nz;
                if (vn < 0) { c.vx -= 1.5f * vn * nx; c.vz -= 1.5f * vn * nz; c.vx *= 0.75f; c.vz *= 0.75f; c.shake = Math.min(1, c.shake + Math.abs(vn) * 0.05f); c.hit = Math.min(1, Math.abs(vn) * 0.06f); impact = Math.max(impact, Math.abs(vn)); }
            }
        }
        return impact;
    }
}
