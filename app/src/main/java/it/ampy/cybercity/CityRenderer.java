package it.ampy.cybercity;

import android.content.Context;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.SystemClock;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;
import java.util.HashMap;
import java.util.Map;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/** OpenGL ES 2 renderer. Mirrors Cybercity.prototype.frame() in web/cybercity.js. */
public class CityRenderer implements GLSurfaceView.Renderer {
    static final String TAG = "Cybercity";
    public static final String[] MODES = {"avenue", "glide", "drone", "skyline"};
    public static final String[] MODE_NAMES = {"VOLO SUL VIALE", "PLANATA", "DRONE A BASSA QUOTA", "SOPRA I TETTI"};

    private final Context ctx;
    private volatile Prefs.Snapshot cfg;
    private volatile boolean demo; // preview: slight speed-up of the auto cycle
    public volatile String currentMode = "avenue";
    public volatile String currentPalette = "neon";

    private Prog sky, building, ground, board, car, rain, post, mist;
    private float flash = 0, nextFlash = 3;
    private final java.util.Random rnd = new java.util.Random();
    private Mesh mBuilding, mBoard, mCar, mRain, mGround, mQuad;

    private double camZ = 0;
    private float fogMul = 1;
    private float t = 0, modeT = 0, fade = 1;
    private int modeIdx = 0, W = 1, H = 1;
    private long last = 0, frameStart = 0;
    private final float[] V = new float[16], P = new float[16], VP = new float[16];

    public CityRenderer(Context c, Prefs.Snapshot s) { ctx = c.getApplicationContext(); cfg = s; }
    public void setConfig(Prefs.Snapshot s) {
        if (cfg != null && !cfg.mode.equals(s.mode)) fade = 1;
        cfg = s;
    }
    public void setDemo(boolean d) { demo = d; }

    /* ---------------- GL helpers ---------------- */
    static final class Prog {
        int id; final Map<String, Integer> u = new HashMap<>(); final Map<String, Integer> a = new HashMap<>();
        int u(String n) { Integer i = u.get(n); if (i == null) { i = GLES20.glGetUniformLocation(id, n); u.put(n, i); } return i; }
        int a(String n) { Integer i = a.get(n); if (i == null) { i = GLES20.glGetAttribLocation(id, n); a.put(n, i); } return i; }
    }
    static final class Mesh {
        String[] names; int[] vbo; int[] size; int ibo; int count;
    }

    private String asset(String name) {
        try (InputStream in = ctx.getAssets().open("shaders/" + name)) {
            ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[4096]; int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
            return o.toString("UTF-8");
        } catch (Exception e) { throw new RuntimeException(e); }
    }
    private int shader(int type, String src) {
        int s = GLES20.glCreateShader(type);
        GLES20.glShaderSource(s, src); GLES20.glCompileShader(s);
        int[] ok = new int[1]; GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0);
        if (ok[0] == 0) { String log = GLES20.glGetShaderInfoLog(s); Log.e(TAG, log); throw new RuntimeException("shader: " + log); }
        return s;
    }
    private Prog prog(String v, String f, String common) {
        Prog p = new Prog();
        p.id = GLES20.glCreateProgram();
        GLES20.glAttachShader(p.id, shader(GLES20.GL_VERTEX_SHADER, asset(v)));
        GLES20.glAttachShader(p.id, shader(GLES20.GL_FRAGMENT_SHADER, common + "\n" + asset(f)));
        GLES20.glLinkProgram(p.id);
        int[] ok = new int[1]; GLES20.glGetProgramiv(p.id, GLES20.GL_LINK_STATUS, ok, 0);
        if (ok[0] == 0) { String log = GLES20.glGetProgramInfoLog(p.id); Log.e(TAG, log); throw new RuntimeException("link: " + log); }
        return p;
    }
    private static FloatBuffer fb(float[] a) {
        FloatBuffer b = ByteBuffer.allocateDirect(a.length * 4).order(ByteOrder.nativeOrder()).asFloatBuffer(); b.put(a).position(0); return b;
    }
    private static Mesh mesh(String[] names, float[][] data, int[] sizes, short[] idx) {
        Mesh m = new Mesh(); m.names = names; m.size = sizes; m.vbo = new int[names.length];
        GLES20.glGenBuffers(names.length, m.vbo, 0);
        for (int i = 0; i < names.length; i++) {
            GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, m.vbo[i]);
            GLES20.glBufferData(GLES20.GL_ARRAY_BUFFER, data[i].length * 4, fb(data[i]), GLES20.GL_STATIC_DRAW);
        }
        int[] ib = new int[1]; GLES20.glGenBuffers(1, ib, 0); m.ibo = ib[0];
        ShortBuffer sb = ByteBuffer.allocateDirect(idx.length * 2).order(ByteOrder.nativeOrder()).asShortBuffer(); sb.put(idx).position(0);
        GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, m.ibo);
        GLES20.glBufferData(GLES20.GL_ELEMENT_ARRAY_BUFFER, idx.length * 2, sb, GLES20.GL_STATIC_DRAW);
        m.count = idx.length;
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, 0);
        GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, 0);
        return m;
    }
    private void draw(Prog p, Mesh m) {
        int[] used = new int[m.names.length]; int nu = 0;
        for (int i = 0; i < m.names.length; i++) {
            int loc = p.a(m.names[i]); if (loc < 0) continue;
            GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, m.vbo[i]);
            GLES20.glEnableVertexAttribArray(loc);
            GLES20.glVertexAttribPointer(loc, m.size[i], GLES20.GL_FLOAT, false, 0, 0);
            used[nu++] = loc;
        }
        GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, m.ibo);
        GLES20.glDrawElements(GLES20.GL_TRIANGLES, m.count, GLES20.GL_UNSIGNED_SHORT, 0);
        for (int i = 0; i < nu; i++) GLES20.glDisableVertexAttribArray(used[i]);
    }

    @Override public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        String common = asset("common.glsl");
        sky = prog("sky.vert", "sky.frag", common);
        building = prog("building.vert", "building.frag", common);
        ground = prog("ground.vert", "ground.frag", common);
        board = prog("billboard.vert", "billboard.frag", common);
        car = prog("car.vert", "car.frag", common);
        rain = prog("rain.vert", "rain.frag", common);
        post = prog("post.vert", "post.frag", common);
        mist = prog("post.vert", "mist.frag", common);
        City c = new City(cfg.seed);
        mBuilding = mesh(new String[]{"aPos", "aCenter", "aNorm", "aUV", "aMisc"},
            new float[][]{c.bPos.arr(), c.bCenter.arr(), c.bNorm.arr(), c.bUV.arr(), c.bMisc.arr()}, new int[]{3, 2, 3, 2, 4}, c.bIdx.arr());
        mBoard = mesh(new String[]{"aPos", "aCenter", "aUV", "aMisc"},
            new float[][]{c.gPos.arr(), c.gCenter.arr(), c.gUV.arr(), c.gMisc.arr()}, new int[]{3, 2, 2, 4}, c.gIdx.arr());
        mCar = mesh(new String[]{"aLane", "aDir", "aCorner"},
            new float[][]{c.cLane.arr(), c.cDir.arr(), c.cCorner.arr()}, new int[]{4, 4, 2}, c.cIdx.arr());
        mRain = mesh(new String[]{"aSeed", "aCorner"}, new float[][]{c.rSeed.arr(), c.rCorner.arr()}, new int[]{3, 2}, c.rIdx.arr());
        mGround = mesh(new String[]{"aPos"}, new float[][]{{-420, -40, 420, -40, 420, City.L, -420, City.L}}, new int[]{2}, new short[]{0, 1, 2, 0, 2, 3});
        mQuad = mesh(new String[]{"aPos"}, new float[][]{{-1, -1, 1, -1, 1, 1, -1, 1}}, new int[]{2}, new short[]{0, 1, 2, 0, 2, 3});
        last = 0;
    }

    @Override public void onSurfaceChanged(GL10 gl, int w, int h) { W = Math.max(1, w); H = Math.max(1, h); GLES20.glViewport(0, 0, W, H); }

    /* ---------------- camera paths (same as cameraFor in JS) ---------------- */
    private final float[] cam = new float[8]; // eyeX, eyeY, lookX, lookY, lookZ, roll, speed
    private void cameraFor(String mode, float t) {
        double s;
        switch (mode) {
            case "glide": {
                float y = (float) (70 + Math.sin(t * 0.045) * 35);
                set((float) Math.sin(t * 0.06) * 5, y, (float) Math.sin(t * 0.06 + 0.8) * 9, (float) (y - 22 - Math.sin(t * 0.03) * 10), 70, (float) Math.sin(t * 0.06) * 0.12f, 14); break;
            }
            case "drone": {
                float x = (float) Math.sin(t * 0.21) * 6.5f, y = (float) (7 + Math.sin(t * 0.13) * 3.5);
                set(x, y, (float) Math.sin(t * 0.21 + 0.6) * 7, (float) (y + 2 + Math.sin(t * 0.17) * 3), 40, (float) -Math.cos(t * 0.21) * 0.18f, 32); break;
            }
            case "skyline": {
                float y = (float) (215 + Math.sin(t * 0.03) * 25);
                set((float) Math.sin(t * 0.04) * 4, y, (float) Math.sin(t * 0.04 + 1.2) * 40, y - 70, 160, (float) Math.sin(t * 0.04) * 0.05f, 20); break;
            }
            default: {
                float y = (float) (19 + Math.sin(t * 0.05) * 7);
                set((float) Math.sin(t * 0.07) * 3.5f, y, (float) Math.sin(t * 0.07 + 0.5) * 2, (float) (y - 2 + Math.sin(t * 0.11) * 3), 60, (float) Math.sin(t * 0.07) * 0.06f, 18);
            }
        }
    }
    private void set(float ex, float ey, float lx, float ly, float lz, float roll, float speed) {
        cam[0] = ex; cam[1] = ey; cam[2] = lx; cam[3] = ly; cam[4] = lz; cam[5] = roll; cam[6] = speed;
    }

    private void common(Prog p, Palette pal, float[] eye) {
        GLES20.glUseProgram(p.id);
        f1(p, "uTime", t % 3600f); f1(p, "uL", City.L); f1(p, "uFar", City.L); f1(p, "uZOff", 0.08f); f1(p, "uCamX", 0); f1(p, "uWrapX", p == car ? 420f : 0f); f1(p, "uCamZ", (float) camZ); f1(p, "uFogDen", pal.fogDen * fogMul); f1(p, "uFlash", flash);
        v3(p, "uFog", pal.fog); v3(p, "uSkyTop", pal.top); v3(p, "uWinA", pal.winA); v3(p, "uWinB", pal.winB); v3(p, "uWinC", pal.winC);
        v3(p, "uNeonA", pal.neonA); v3(p, "uNeonB", pal.neonB); v3(p, "uEye", eye);
        int l = p.u("uVP"); if (l >= 0) GLES20.glUniformMatrix4fv(l, 1, false, VP, 0);
        l = p.u("uV"); if (l >= 0) GLES20.glUniformMatrix4fv(l, 1, false, V, 0);
        l = p.u("uP"); if (l >= 0) GLES20.glUniformMatrix4fv(l, 1, false, P, 0);
    }
    private static void f1(Prog p, String n, float v) { int l = p.u(n); if (l >= 0) GLES20.glUniform1f(l, v); }
    private static void v3(Prog p, String n, float[] v) { int l = p.u(n); if (l >= 0) GLES20.glUniform3f(l, v[0], v[1], v[2]); }

    @Override public void onDrawFrame(GL10 gl) {
        Prefs.Snapshot o = cfg;
        // frame limiter
        long frameMs = 1000L / Math.max(15, o.fps);
        long now = SystemClock.uptimeMillis();
        if (frameStart != 0) {
            long wait = frameMs - (now - frameStart);
            if (wait > 1) { try { Thread.sleep(wait); } catch (InterruptedException ignored) { } now = SystemClock.uptimeMillis(); }
        }
        frameStart = now;
        float dt = last == 0 ? 1 / 60f : Math.min(0.05f, (now - last) / 1000f);
        last = now;
        t += dt;

        Palette pal = Palette.of(o.palette);
        Weather.Fx wx = Weather.fx(o.weather);
        flash = Math.max(0, flash - dt * 3.5f);
        if (wx != null && wx.light > 0) { nextFlash -= dt; if (nextFlash <= 0) { flash = 1; nextFlash = rnd.nextFloat() < 0.35f ? 0.15f : 4 + rnd.nextFloat() * 9; } }
        float rainAmt = wx != null ? wx.rain : o.rain;
        fogMul = wx != null ? wx.fog : 1;
        currentPalette = pal.name;
        String mode = o.mode;
        if ("auto".equals(mode)) {
            modeT += dt;
            float period = Math.max(10, o.cycle) * (demo ? 0.6f : 1f);
            if (modeT > period) { modeT = 0; modeIdx = (modeIdx + 1) % MODES.length; }
            mode = MODES[modeIdx];
            float edge = Math.min(modeT, period - modeT);
            fade = Math.max(0, 1 - edge / 1.2f);
        } else fade = Math.max(0, fade - dt);
        currentMode = mode;
        cameraFor(mode, t);
        camZ = (camZ + cam[6] * o.speed * dt) % City.L;

        float[] eye = {cam[0], cam[1], 0};
        float roll = cam[5];
        Matrix.setLookAtM(V, 0, eye[0], eye[1], 0, cam[2], cam[3], cam[4], (float) Math.sin(roll), (float) Math.cos(roll), 0);
        float fovDeg = o.fov;
        Matrix.perspectiveM(P, 0, fovDeg, W / (float) H, 0.3f, City.L * 0.95f);
        Matrix.multiplyMM(VP, 0, P, 0, V, 0);

        GLES20.glClearColor(0, 0, 0, 1);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);

        // sky
        GLES20.glDisable(GLES20.GL_DEPTH_TEST); GLES20.glDisable(GLES20.GL_BLEND);
        common(sky, pal, eye);
        float fx = cam[2] - eye[0], fy = cam[3] - eye[1], fz = cam[4];
        float fl = (float) Math.sqrt(fx * fx + fy * fy + fz * fz); fx /= fl; fy /= fl; fz /= fl;
        float ux0 = (float) Math.sin(roll), uy0 = (float) Math.cos(roll), uz0 = 0;
        float rx = fy * uz0 - fz * uy0, ry = fz * ux0 - fx * uz0, rz = fx * uy0 - fy * ux0;
        float rl = (float) Math.sqrt(rx * rx + ry * ry + rz * rz); rx /= rl; ry /= rl; rz /= rl;
        float ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
        GLES20.glUniform3f(sky.u("uFwd"), fx, fy, fz);
        GLES20.glUniform3f(sky.u("uRight"), rx, ry, rz);
        GLES20.glUniform3f(sky.u("uUp"), ux, uy, uz);
        float ty = (float) Math.tan(Math.toRadians(fovDeg) / 2);
        GLES20.glUniform2f(sky.u("uTan"), ty * W / H, ty);
        f1(sky, "uCloud", wx != null ? wx.cloud : 0);
        v3(sky, "uSunDir", pal.sunDir); v3(sky, "uSunCol", pal.sun); f1(sky, "uSunStripes", pal.stripes);
        draw(sky, mQuad);

        // opaque geometry
        GLES20.glEnable(GLES20.GL_DEPTH_TEST); GLES20.glDepthMask(true);
        common(ground, pal, eye); draw(ground, mGround);
        common(building, pal, eye); draw(building, mBuilding);
        common(board, pal, eye); draw(board, mBoard);

        // additive lights
        GLES20.glEnable(GLES20.GL_BLEND); GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE); GLES20.glDepthMask(false);
        if (o.traffic) { common(car, pal, eye); f1(car, "uWidth", 0.32f); draw(car, mCar); }
        if (rainAmt > 0) {
            common(rain, pal, eye); f1(rain, "uRain", rainAmt); f1(rain, "uRainSpeed", 28f);
            f1(rain, "uSnow", wx != null ? wx.snow : 0); f1(rain, "uWind", wx != null ? wx.wind : 0);
            draw(rain, mRain);
        }
        if (wx != null && wx.mist > 0) {
            GLES20.glDisable(GLES20.GL_DEPTH_TEST);
            GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
            common(mist, pal, eye); f1(mist, "uMist", wx.mist); GLES20.glUniform2f(mist.u("uRes"), W, H);
            draw(mist, mQuad);
        }

        // post: vignette, scanlines, fade
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glUseProgram(post.id);
        f1(post, "uFade", fade); f1(post, "uScan", o.scanlines ? 1 : 0);
        GLES20.glUniform2f(post.u("uRes"), W, H);
        draw(post, mQuad);
        GLES20.glDepthMask(true); GLES20.glDisable(GLES20.GL_BLEND);
    }

    public static String modeName(String key) {
        for (int i = 0; i < MODES.length; i++) if (MODES[i].equals(key)) return MODE_NAMES[i];
        return "AUTO";
    }
}
