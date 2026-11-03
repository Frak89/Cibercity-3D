package it.ampy.cybercity.game;

import android.content.Context;
import android.opengl.GLES20;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;
import java.util.HashMap;
import java.util.Map;

/** Tiny GLES2 helpers for the game (programs from the shared shader assets, VBO meshes). */
final class Gl {
    private Gl() { }
    static final String TAG = "NeonRun";

    static final class Prog {
        int id; final Map<String, Integer> u = new HashMap<>(); final Map<String, Integer> a = new HashMap<>();
        int u(String n) { Integer i = u.get(n); if (i == null) { i = GLES20.glGetUniformLocation(id, n); u.put(n, i); } return i; }
        int a(String n) { Integer i = a.get(n); if (i == null) { i = GLES20.glGetAttribLocation(id, n); a.put(n, i); } return i; }
        void f1(String n, float v) { int l = u(n); if (l >= 0) GLES20.glUniform1f(l, v); }
        void v3(String n, float[] v) { int l = u(n); if (l >= 0) GLES20.glUniform3f(l, v[0], v[1], v[2]); }
        void m4(String n, float[] m) { int l = u(n); if (l >= 0) GLES20.glUniformMatrix4fv(l, 1, false, m, 0); }
    }
    static final class Mesh { String[] names; int[] vbo; int[] size; int ibo; int count; }

    static String asset(Context c, String name) {
        try (InputStream in = c.getAssets().open("shaders/" + name)) {
            ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[4096]; int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
            return o.toString("UTF-8");
        } catch (Exception e) { throw new RuntimeException(e); }
    }
    private static int shader(int type, String src) {
        int s = GLES20.glCreateShader(type);
        GLES20.glShaderSource(s, src); GLES20.glCompileShader(s);
        int[] ok = new int[1]; GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0);
        if (ok[0] == 0) { String log = GLES20.glGetShaderInfoLog(s); Log.e(TAG, log); throw new RuntimeException("shader: " + log); }
        return s;
    }
    static Prog prog(Context c, String v, String f, String common) {
        Prog p = new Prog();
        p.id = GLES20.glCreateProgram();
        GLES20.glAttachShader(p.id, shader(GLES20.GL_VERTEX_SHADER, asset(c, v)));
        GLES20.glAttachShader(p.id, shader(GLES20.GL_FRAGMENT_SHADER, common + "\n" + asset(c, f)));
        GLES20.glLinkProgram(p.id);
        int[] ok = new int[1]; GLES20.glGetProgramiv(p.id, GLES20.GL_LINK_STATUS, ok, 0);
        if (ok[0] == 0) { String log = GLES20.glGetProgramInfoLog(p.id); Log.e(TAG, log); throw new RuntimeException("link: " + log); }
        return p;
    }
    private static FloatBuffer fb(float[] a) {
        FloatBuffer b = ByteBuffer.allocateDirect(a.length * 4).order(ByteOrder.nativeOrder()).asFloatBuffer(); b.put(a).position(0); return b;
    }
    static Mesh mesh(String[] names, float[][] data, int[] sizes, short[] idx) {
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
    static void free(Mesh m) {
        if (m == null) return;
        GLES20.glDeleteBuffers(m.vbo.length, m.vbo, 0);
        GLES20.glDeleteBuffers(1, new int[]{m.ibo}, 0);
    }
    static void draw(Prog p, Mesh m) {
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

    /** Growable float / short arrays. */
    static final class FL {
        float[] a = new float[4096]; int n;
        void add(float... v) { if (n + v.length > a.length) { float[] b = new float[Math.max(a.length * 2, n + v.length)]; System.arraycopy(a, 0, b, 0, n); a = b; } System.arraycopy(v, 0, a, n, v.length); n += v.length; }
        float[] arr() { float[] o = new float[n]; System.arraycopy(a, 0, o, 0, n); return o; }
    }
    static final class SL {
        short[] a = new short[4096]; int n;
        void add(int... v) { if (n + v.length > a.length) { short[] b = new short[Math.max(a.length * 2, n + v.length)]; System.arraycopy(a, 0, b, 0, n); a = b; } for (int x : v) a[n++] = (short) x; }
        short[] arr() { short[] o = new short[n]; System.arraycopy(a, 0, o, 0, n); return o; }
    }
}
