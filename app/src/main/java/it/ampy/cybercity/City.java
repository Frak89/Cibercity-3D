package it.ampy.cybercity;

/** Procedural city: line-by-line port of buildCity() in web/cybercity.js (same PRNG, same layout). */
public final class City {
    public static final float L = 420f, CELL = 14f;
    public static final int ROWS = 30, COLS = 13;
    /** canal along the left of the avenue (the first two building columns are water) */
    public static final float CANAL0 = -44f, CANAL1 = -16f;
    /** KAGE fleet traffic: {ox, oy, oz, speed, dx, dz, phase, seed} */
    public final java.util.List<float[]> drones = new java.util.ArrayList<>(), boats = new java.util.ArrayList<>(), galleons = new java.util.ArrayList<>();

    public static final class FL {
        public float[] a = new float[1024]; public int n;
        void add(float... v) { if (n + v.length > a.length) { float[] b = new float[Math.max(a.length * 2, n + v.length)]; System.arraycopy(a, 0, b, 0, n); a = b; } System.arraycopy(v, 0, a, n, v.length); n += v.length; }
        public float[] arr() { float[] o = new float[n]; System.arraycopy(a, 0, o, 0, n); return o; }
    }
    public static final class SL {
        public short[] a = new short[1024]; public int n;
        void add(int... v) { if (n + v.length > a.length) { short[] b = new short[Math.max(a.length * 2, n + v.length)]; System.arraycopy(a, 0, b, 0, n); a = b; } for (int x : v) a[n++] = (short) x; }
        public short[] arr() { short[] o = new short[n]; System.arraycopy(a, 0, o, 0, n); return o; }
    }

    /** mulberry32, bit-identical to the JS version. */
    static final class Rng {
        int a;
        Rng(int s) { a = s; }
        float next() {
            a = a + 0x6D2B79F5;
            int t = (a ^ (a >>> 15)) * (1 | a);
            t = (t + ((t ^ (t >>> 7)) * (61 | t))) ^ t;
            return (float) (((t ^ (t >>> 14)) & 0xffffffffL) / 4294967296.0);
        }
    }

    // building mesh
    public final FL bPos = new FL(), bCenter = new FL(), bNorm = new FL(), bUV = new FL(), bMisc = new FL();
    public final SL bIdx = new SL();
    // billboards
    public final FL gPos = new FL(), gCenter = new FL(), gUV = new FL(), gMisc = new FL();
    public final SL gIdx = new SL();
    // cars
    public final FL cLane = new FL(), cDir = new FL(), cCorner = new FL();
    public final SL cIdx = new SL();
    // rain
    public final FL rSeed = new FL(), rCorner = new FL();
    public final SL rIdx = new SL();

    private static float fract(float x) { return (float) (x - Math.floor(x)); }

    private void box(float cx, float cz, float w, float d, float y0, float y1, float s, float kind) {
        float hw = w / 2, hd = d / 2;
        float[][][] faces = {
            {{1, 0, 0}, {hw, y0, -hd}, {hw, y0, hd}, {hw, y1, hd}, {hw, y1, -hd}, {d}},
            {{-1, 0, 0}, {-hw, y0, hd}, {-hw, y0, -hd}, {-hw, y1, -hd}, {-hw, y1, hd}, {d}},
            {{0, 0, 1}, {hw, y0, hd}, {-hw, y0, hd}, {-hw, y1, hd}, {hw, y1, hd}, {w}},
            {{0, 0, -1}, {-hw, y0, -hd}, {hw, y0, -hd}, {hw, y1, -hd}, {-hw, y1, -hd}, {w}},
        };
        for (float[][] f : faces) {
            int b = bPos.n / 3;
            float fw = f[5][0];
            float[] us = {0, fw, fw, 0};
            for (int i = 0; i < 4; i++) {
                float[] c = f[1 + i];
                bPos.add(c[0], c[1], c[2]); bCenter.add(cx, cz); bNorm.add(f[0][0], f[0][1], f[0][2]);
                bUV.add(us[i], c[1]); bMisc.add(s, kind, fw, y1);
            }
            bIdx.add(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        int b = bPos.n / 3;
        float[][] top = {{-hw, y1, -hd}, {hw, y1, -hd}, {hw, y1, hd}, {-hw, y1, hd}};
        for (float[] c : top) { bPos.add(c[0], c[1], c[2]); bCenter.add(cx, cz); bNorm.add(0, 1, 0); bUV.add(c[0], c[2]); bMisc.add(s, kind, w, y1); }
        bIdx.add(b, b + 2, b + 1, b, b + 3, b + 2);
    }

    private void board(float cx, float cz, float lx, float y0, float y1, float z0, float z1, float s, float kind, int facing) {
        int b = gPos.n / 3;
        float ratio = (y1 - y0) / Math.abs(z1 - z0);
        float[][] cs = facing > 0
            ? new float[][]{{lx, y0, z1}, {lx, y0, z0}, {lx, y1, z0}, {lx, y1, z1}}
            : new float[][]{{lx, y0, z0}, {lx, y0, z1}, {lx, y1, z1}, {lx, y1, z0}};
        float[][] uvs = {{0, 0}, {1, 0}, {1, 1}, {0, 1}};
        for (int i = 0; i < 4; i++) { gPos.add(cs[i]); gCenter.add(cx, cz); gUV.add(uvs[i]); gMisc.add(s, kind, ratio, 0); }
        gIdx.add(b, b + 1, b + 2, b, b + 2, b + 3);
    }

    private void car(float ox, float oy, float oz, float speed, float dx, float dz, float len, float s) {
        int b = cLane.n / 4;
        float[][] cs = {{0, -1}, {0, 1}, {1, 1}, {1, -1}};
        for (float[] c : cs) { cLane.add(ox, oy, oz, speed); cDir.add(dx, dz, len, s); cCorner.add(c[0], c[1]); }
        cIdx.add(b, b + 1, b + 2, b, b + 2, b + 3);
    }

    public City(int seed) {
        Rng R = new Rng(seed);
        for (int r = 0; r < ROWS; r++) {
            float cz = r * CELL + CELL / 2;
            box(CANAL1 + 0.3f, cz, 0.6f, CELL, -3.2f, 0.03f, 0.5f, 3); box(CANAL0 - 0.3f, cz, 0.6f, CELL, -3.2f, 0.03f, 0.5f, 3);
        }
        for (int side : new int[]{-1, 1}) {
            for (int col = 0; col < COLS; col++) {
                float cx = side * (16 + CELL / 2 + col * CELL);
                boolean wet = side < 0 && col < 2;
                for (int r = 0; r < ROWS; r++) {
                    if (r % 6 == 0) continue;
                    float cz = r * CELL + CELL / 2;
                    float s = R.next();
                    float w = 7 + R.next() * 5, d = 7 + R.next() * 5;
                    float kind = R.next() < 0.35f ? 1 : 0;
                    float h = (float) (12 + Math.pow(R.next(), 2.4) * 105 * (col < 3 ? 1.5 : 1.0));
                    if (col >= 2 && R.next() < 0.05f) { h = 170 + R.next() * 120; kind = 2; }
                    if (!wet) box(cx, cz, w, d, 0, h, s, kind);
                    if (h > 55 && R.next() < 0.55f) {
                        float h2 = h + h * (0.15f + R.next() * 0.25f);
                        if (!wet) box(cx, cz, w * 0.68f, d * 0.68f, h, h2, fract(s * 7.7f), kind == 2 ? 2 : 1);
                        if (R.next() < 0.5f) { float h3 = h2 + 10 + R.next() * 25; if (!wet) box(cx, cz, 0.7f, 0.7f, h2, h3, fract(s * 3.3f), 1); }
                    }
                    if (col == 0 && R.next() < 0.6f) {
                        float bw = 2.5f + R.next() * 3, bh = Math.min(h - 6, 6 + R.next() * 16);
                        if (bh > 4) {
                            float y0 = 5 + R.next() * Math.max(0, h - bh - 8);
                            float lx = -side * (w / 2 + 0.3f);
                            float bs = R.next(), bk = (float) Math.floor(R.next() * 3);
                            if (!wet) board(cx, cz, lx, y0, y0 + bh, -bw / 2, bw / 2, bs, bk, side);
                        }
                    }
                }
            }
        }
        float[] xl = {-10, -6, 6, 10}, yl = {13, 24, 37, 55, 78};
        for (float x : xl) for (float y : yl) {
            float dir = x > 0 ? 1 : -1;
            int n = 6 + (int) Math.floor(R.next() * 6);
            float v = 0;
            for (int i = 0; i < n; i++) { float jx = R.next() - 0.5f, jy = (R.next() - 0.5f) * 3, sp = 22 + R.next() * 25; R.next(); float sd = R.next(); if (i == 0) v = sp;
                drones.add(new float[]{x + jx, y + jy, 0, v, 0, dir, (i + sd * 0.3f) * L / n, sd}); }
        }
        for (float x : new float[]{-7, -3, 3, 7}) {
            for (int i = 0; i < 10; i++) car(x, 0.7f, 0, 12 + R.next() * 10, 0, x > 0 ? 1 : -1, 2.5f + R.next() * 2, R.next());
        }
        float[][] cross = {{0.7f, -2.5f}, {0.7f, 2.5f}, {21, 0}, {34, 2}};
        for (int r = 0; r < ROWS; r += 6) {
            float cz = r * CELL + CELL / 2;
            for (float[] yo : cross) {
                if (yo[0] < 1) { for (int i = 0; i < 6; i++) car(0, yo[0], cz + yo[1], 14 + R.next() * 18, yo[1] >= 0 ? 1 : -1, 0, 3 + R.next() * 5, R.next()); }
                else { float v = 0; for (int i = 0; i < 6; i++) { float sp = 14 + R.next() * 18; R.next(); float sd = R.next(); if (i == 0) v = sp; drones.add(new float[]{0, yo[0], cz + yo[1], v, yo[1] >= 0 ? 1 : -1, 0, (i + sd * 0.3f) * L / 6, sd}); } }
            }
        }
        for (int i = 0; i < 18; i++) {
            float x = (R.next() < 0.5f ? -1 : 1) * (40 + R.next() * 120), y = 110 + R.next() * 60;
            float v = 0;
            for (int k = 0; k < 5; k++) { float sp = 30 + R.next() * 20; R.next(); float sd = R.next(); if (k == 0) v = sp; drones.add(new float[]{x, y, 0, v, 0, x > 0 ? 1 : -1, (k + sd * 0.3f) * L / 5, sd}); }
        }
        for (int k = 0; k < 4; k++) {
            boats.add(new float[]{CANAL1 - 6, -1.2f, 0, 13, 0, 1, k * L / 4 + 17, fract(k * 0.618f + 0.11f)});
            boats.add(new float[]{CANAL0 + 6, -1.2f, 0, 11, 0, -1, k * L / 4 + 61, fract(k * 0.618f + 0.47f)});
        }
        galleons.add(new float[]{(CANAL0 + CANAL1) / 2, -1.2f, 0, 4.5f, 0, 1, 120, 0.37f});
        float[][] cs = {{0, -1}, {0, 1}, {1, 1}, {1, -1}};
        for (int i = 0; i < 2600; i++) {
            int b = rSeed.n / 3;
            float sx = R.next(), sy = R.next(), sz = R.next();
            for (float[] c : cs) { rSeed.add(sx, sy, sz); rCorner.add(c[0], c[1]); }
            rIdx.add(b, b + 1, b + 2, b, b + 2, b + 3);
        }
    }
}
