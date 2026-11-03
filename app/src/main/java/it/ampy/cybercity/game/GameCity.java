package it.ampy.cybercity.game;

import java.util.ArrayList;
import java.util.List;

/** Open-world grid city on a torus. Line-by-line port of buildGameCity() in web/game.js. */
final class GameCity {
    static final float GP = 84, RW = 18;
    static final int GN = 15;
    static final float S = GP * GN;

    static final class Chunk { final Gl.FL pos = new Gl.FL(), center = new Gl.FL(), norm = new Gl.FL(), uv = new Gl.FL(), misc = new Gl.FL(); final Gl.SL idx = new Gl.SL(); }
    final List<Chunk> chunks = new ArrayList<>();
    private Chunk B;
    final Gl.FL gPos = new Gl.FL(), gCenter = new Gl.FL(), gUV = new Gl.FL(), gMisc = new Gl.FL(); final Gl.SL gIdx = new Gl.SL();
    final Gl.FL cLane = new Gl.FL(), cDir = new Gl.FL(), cCorner = new Gl.FL(); final Gl.SL cIdx = new Gl.SL();
    final Gl.FL rSeed = new Gl.FL(), rCorner = new Gl.FL(); final Gl.SL rIdx = new Gl.SL();
    /** collision rects per block: x0, z0, x1, z1 */
    final List<List<float[]>> blocks = new ArrayList<>();

    static final class Rng {
        int a; Rng(int s) { a = s; }
        float next() {
            a = a + 0x6D2B79F5;
            int t = (a ^ (a >>> 15)) * (1 | a);
            t = (t + ((t ^ (t >>> 7)) * (61 | t))) ^ t;
            return (float) (((t ^ (t >>> 14)) & 0xffffffffL) / 4294967296.0);
        }
    }
    private static float fract(float x) { return (float) (x - Math.floor(x)); }

    private void newChunk() { B = new Chunk(); chunks.add(B); }

    private void box(float cx, float cz, float w, float d, float y0, float y1, float s, float kind) {
        if (B.pos.n / 3 > 60000) newChunk();
        float hw = w / 2, hd = d / 2;
        float[][][] faces = {
            {{1, 0, 0}, {hw, y0, -hd}, {hw, y0, hd}, {hw, y1, hd}, {hw, y1, -hd}, {d}},
            {{-1, 0, 0}, {-hw, y0, hd}, {-hw, y0, -hd}, {-hw, y1, -hd}, {-hw, y1, hd}, {d}},
            {{0, 0, 1}, {hw, y0, hd}, {-hw, y0, hd}, {-hw, y1, hd}, {hw, y1, hd}, {w}},
            {{0, 0, -1}, {-hw, y0, -hd}, {hw, y0, -hd}, {hw, y1, -hd}, {-hw, y1, -hd}, {w}},
        };
        for (float[][] f : faces) {
            int b = B.pos.n / 3; float fw = f[5][0]; float[] us = {0, fw, fw, 0};
            for (int i = 0; i < 4; i++) {
                float[] c = f[1 + i];
                B.pos.add(c[0], c[1], c[2]); B.center.add(cx, cz); B.norm.add(f[0][0], f[0][1], f[0][2]);
                B.uv.add(us[i], c[1]); B.misc.add(s, kind, fw, y1);
            }
            B.idx.add(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        int b = B.pos.n / 3;
        float[][] top = {{-hw, y1, -hd}, {hw, y1, -hd}, {hw, y1, hd}, {-hw, y1, hd}};
        for (float[] c : top) { B.pos.add(c[0], c[1], c[2]); B.center.add(cx, cz); B.norm.add(0, 1, 0); B.uv.add(c[0], c[2]); B.misc.add(s, kind, w, y1); }
        B.idx.add(b, b + 2, b + 1, b, b + 3, b + 2);
    }

    private void board(float cx, float cz, int axis, float off, float y0, float y1, float a0, float a1, float s, float kind) {
        int b = gPos.n / 3; float ratio = (y1 - y0) / Math.abs(a1 - a0);
        float[][] cs = axis == 0
            ? new float[][]{{off, y0, a1}, {off, y0, a0}, {off, y1, a0}, {off, y1, a1}}
            : new float[][]{{a0, y0, off}, {a1, y0, off}, {a1, y1, off}, {a0, y1, off}};
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

    GameCity(int seed) {
        Rng R = new Rng(seed);
        newChunk();
        for (int i = 0; i < GN * GN; i++) blocks.add(new ArrayList<>());
        float inner = GP - RW;
        for (int bz = 0; bz < GN; bz++) for (int bx = 0; bx < GN; bx++) {
            List<float[]> rects = blocks.get(bz * GN + bx);
            float ox = bx * GP + RW / 2, oz = bz * GP + RW / 2;
            float dc = (float) (Math.hypot(bx - GN / 2f + 0.5f, bz - GN / 2f + 0.5f) / (GN / 2f));
            float downtown = Math.max(0, 1 - dc);
            float r = R.next();
            if (r < 0.07f) {
                float s = R.next();
                box(ox + inner / 2, oz + inner / 2, 14, 14, 0, 5, s, 1);
                rects.add(new float[]{ox + inner / 2 - 7, oz + inner / 2 - 7, ox + inner / 2 + 7, oz + inner / 2 + 7});
                continue;
            }
            int n = R.next() < 0.45f ? 3 : 2;
            float cell = inner / n;
            for (int j = 0; j < n; j++) for (int i = 0; i < n; i++) {
                float s = R.next();
                float mx = 1.2f + R.next() * 2.2f, mz = 1.2f + R.next() * 2.2f;
                float w = cell - 2 * mx, d = cell - 2 * mz;
                float cx = ox + cell * (i + 0.5f), cz = oz + cell * (j + 0.5f);
                float kind = R.next() < 0.35f ? 1 : 0;
                float h = (float) (10 + Math.pow(R.next(), 2) * 55 + downtown * Math.pow(R.next(), 1.3) * 190);
                if (downtown > 0.55f && R.next() < 0.12f) { h = 200 + R.next() * 120; kind = 2; }
                box(cx, cz, w, d, 0, h, s, kind);
                rects.add(new float[]{cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2});
                if (h > 50 && R.next() < 0.55f) {
                    float h2 = h + h * (0.15f + R.next() * 0.25f);
                    box(cx, cz, w * 0.68f, d * 0.68f, h, h2, fract(s * 7.7f), kind == 2 ? 2 : 1);
                    if (R.next() < 0.5f) box(cx, cz, 0.7f, 0.7f, h2, h2 + 10 + R.next() * 25, fract(s * 3.3f), 1);
                }
                List<float[]> sides = new ArrayList<>();
                if (i == 0) sides.add(new float[]{0, -w / 2 - 0.3f}); if (i == n - 1) sides.add(new float[]{0, w / 2 + 0.3f});
                if (j == 0) sides.add(new float[]{1, -d / 2 - 0.3f}); if (j == n - 1) sides.add(new float[]{1, d / 2 + 0.3f});
                for (float[] sd : sides) {
                    if (R.next() > 0.3f) continue;
                    int axis = (int) sd[0]; float off = sd[1];
                    float span = axis == 0 ? d : w;
                    float bw = Math.min(span * 0.7f, 3 + R.next() * 4), bh = Math.min(h - 6, 6 + R.next() * 14);
                    if (bh < 4) continue;
                    float y0 = 4 + R.next() * Math.max(0, Math.min(40, h - bh - 6));
                    board(cx, cz, axis, off, y0, y0 + bh, -bw / 2, bw / 2, R.next(), (float) Math.floor(R.next() * 3));
                }
            }
            float px = ox + 1.2f, pz = oz + 1.2f;
            box(px, pz, 0.35f, 0.35f, 0, 7.5f, R.next(), 1);
            rects.add(new float[]{px - 0.3f, pz - 0.3f, px + 0.3f, pz + 0.3f});
        }
        for (int k = 0; k < GN; k++) {
            float a = k * GP;
            for (float off : new float[]{-3, 3, -6.5f, 6.5f}) {
                float dir = off > 0 ? 1 : -1;
                for (int i = 0; i < 3; i++) {
                    car(a + off, 0.75f, 0, 12 + R.next() * 10, 0, dir, 2.5f + R.next() * 2, R.next());
                    car(0, 0.75f, a - off, 12 + R.next() * 10, -dir, 0, 2.5f + R.next() * 2, R.next());
                }
            }
            for (float y : new float[]{28, 46, 70}) {
                for (int i = 0; i < 2; i++) {
                    car(a + (R.next() - 0.5f) * 6, y + R.next() * 4, 0, 25 + R.next() * 20, 0, R.next() < 0.5f ? 1 : -1, 5 + R.next() * 6, R.next());
                    car(0, y + R.next() * 4, a + (R.next() - 0.5f) * 6, 25 + R.next() * 20, R.next() < 0.5f ? 1 : -1, 0, 5 + R.next() * 6, R.next());
                }
            }
        }
        float[][] cs = {{0, -1}, {0, 1}, {1, 1}, {1, -1}};
        for (int i = 0; i < 2600; i++) {
            int b = rSeed.n / 3; float sx = R.next(), sy = R.next(), sz = R.next();
            for (float[] c : cs) { rSeed.add(sx, sy, sz); rCorner.add(c[0], c[1]); }
            rIdx.add(b, b + 1, b + 2, b, b + 2, b + 3);
        }
    }
}
