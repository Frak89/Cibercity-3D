package it.ampy.cybercity;

import android.content.Context;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPInputStream;

/** KAGE fleet meshes (assets/fleet.akv, made by tools/build_vehicles.js) and the lane-instanced traffic baking of web/vehicles.js. */
public final class Fleet {
    public static final class MeshData { public float[] pos, norm, col, anim; public short[] idx; public int verts; }
    /** one draw chunk of baked traffic: model attributes + aLane / aDir per copy */
    public static final class Chunk { public float[] pos, norm, col, anim, lane, dir; public short[] idx; }

    private static Map<String, MeshData> cache;

    public static synchronized Map<String, MeshData> load(Context c) {
        if (cache != null) return cache;
        Map<String, MeshData> out = new HashMap<>();
        try (InputStream in0 = c.getAssets().open("fleet.akv")) {
            byte[] raw = readAll(in0);
            if (raw.length > 2 && (raw[0] & 0xff) == 0x1f && (raw[1] & 0xff) == 0x8b) raw = readAll(new GZIPInputStream(new java.io.ByteArrayInputStream(raw)));
            ByteBuffer b = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN);
            b.position(4);
            int n = b.getInt();
            for (int k = 0; k < n; k++) {
                int nl = b.getInt(); byte[] nb = new byte[nl]; b.get(nb); b.position(b.position() + (4 - nl % 4) % 4);
                MeshData m = new MeshData();
                m.verts = b.getInt(); int ni = b.getInt();
                m.pos = f(b, m.verts * 3); m.norm = f(b, m.verts * 3); m.col = f(b, m.verts * 4); m.anim = f(b, m.verts * 4);
                m.idx = new short[ni]; for (int i = 0; i < ni; i++) m.idx[i] = b.getShort();
                if (ni % 2 == 1) b.getShort();
                out.put(new String(nb, "UTF-8"), m);
            }
        } catch (Exception e) { android.util.Log.e("Cybercity", "fleet.akv", e); }
        cache = out;
        return out;
    }
    private static float[] f(ByteBuffer b, int n) { float[] a = new float[n]; for (int i = 0; i < n; i++) a[i] = b.getFloat(); return a; }
    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int r;
        while ((r = in.read(buf)) > 0) o.write(buf, 0, r);
        return o.toByteArray();
    }

    /** inst: {ox, oy, oz, speed, dx, dz, phase, seed} per copy */
    public static List<Chunk> bake(MeshData m, List<float[]> inst) {
        List<Chunk> out = new ArrayList<>();
        if (m == null || inst.isEmpty()) return out;
        int per = Math.max(1, 64000 / m.verts);
        for (int s0 = 0; s0 < inst.size(); s0 += per) {
            int cnt = Math.min(per, inst.size() - s0), nv = cnt * m.verts;
            Chunk ch = new Chunk();
            ch.pos = new float[nv * 3]; ch.norm = new float[nv * 3]; ch.col = new float[nv * 4]; ch.anim = new float[nv * 4]; ch.lane = new float[nv * 4]; ch.dir = new float[nv * 4];
            ch.idx = new short[cnt * m.idx.length];
            for (int k = 0; k < cnt; k++) {
                float[] q = inst.get(s0 + k); int o = k * m.verts;
                System.arraycopy(m.pos, 0, ch.pos, o * 3, m.verts * 3); System.arraycopy(m.norm, 0, ch.norm, o * 3, m.verts * 3);
                System.arraycopy(m.col, 0, ch.col, o * 4, m.verts * 4); System.arraycopy(m.anim, 0, ch.anim, o * 4, m.verts * 4);
                for (int v = 0; v < m.verts; v++) {
                    int p = (o + v) * 4;
                    ch.lane[p] = q[0]; ch.lane[p + 1] = q[1]; ch.lane[p + 2] = q[2]; ch.lane[p + 3] = q[3];
                    ch.dir[p] = q[4]; ch.dir[p + 1] = q[5]; ch.dir[p + 2] = q[6]; ch.dir[p + 3] = q[7];
                }
                for (int i = 0; i < m.idx.length; i++) ch.idx[k * m.idx.length + i] = (short) ((m.idx[i] & 0xffff) + o);
            }
            out.add(ch);
        }
        return out;
    }
}
