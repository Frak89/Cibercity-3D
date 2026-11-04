package it.ampy.cybercity.game;

import android.content.Context;
import android.opengl.GLES20;
import android.opengl.Matrix;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.GZIPInputStream;

/**
 * AMPY KAGE GT high-detail model: loads assets/car_hd.bin.gz (made by tools/build_car.js from web/car_hd.js)
 * and draws its animated parts. Mirrors web/car_render.js.
 */
public final class CarHd {
    /* rig — same numbers as RIG in web/car_hd.js */
    static final float[] HOOD_PIVOT = {0, 0.80f, 0.96f}; static final float HOOD_OPEN = -0.95f;
    static final float[] DOOR_L = {-0.98f, 0.50f, 0.40f}, DOOR_R = {0.98f, 0.50f, 0.40f}; static final float DOOR_OPEN = 1.05f, DOOR_OUT = 0.22f;
    static final float[] STEER_PIVOT = {-0.40f, 0.84f, 0.10f}; static final float STEER_TILT = 0.47f;
    public static final float[] DRIVER_EYE = {-0.40f, 1.02f, -0.36f};
    static final float[][] HUBS = {{-0.92f, 0.36f, 1.42f}, {0.92f, 0.36f, 1.42f}, {-0.92f, 0.36f, -1.45f}, {0.92f, 0.36f, -1.45f}};
    static final String[] HUB_KEYS = {"FL", "FR", "RL", "RR"};
    public static final float WHEEL_R = 0.365f;
    /* spider hard top + levitation spheres (RIG.roof / RIG.tonneau / RIG.sphere) */
    static final float[] ROOF_PIVOT_B = {0, 0.86f, -1.32f}, ROOF_JOINT = {0, 1.235f, -0.35f}, LID_PIVOT = {0, 0.85f, -2.22f};
    static final float ROOF_FOLD = (float) Math.PI - 0.08f, ROOF_FLIP = (float) Math.PI - 0.10f, LID_OPEN = -1.15f, WIN_DROP = 0.32f;
    static final float SPHERE_R = 0.335f, SPHERE_LIFT = 0.04f;
    static final float[] CHRONO_C = {0, 0.80f, -0.985f}; public static final float FLY_ALT = 1.9f; static final float TUCK_X = 0.05f, TUCK_Y = 0.06f;
    private static float sm(float t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

    public static final String[] PAINT_KEYS = {"nero", "rosso", "perla", "oro", "ciano", "viola"};
    public static final String[] PAINT_NAMES = {"NERO NEON", "ROSSO CORSA", "BIANCO PERLA", "ORO", "CIANO", "VIOLA"};
    static final float[][] PAINTS = {{0.03f, 0.03f, 0.04f}, {0.42f, 0.02f, 0.04f}, {0.72f, 0.72f, 0.76f}, {0.55f, 0.38f, 0.08f}, {0.0f, 0.30f, 0.36f}, {0.20f, 0.03f, 0.30f}};
    public static int paintIndex(String k) { for (int i = 0; i < PAINT_KEYS.length; i++) if (PAINT_KEYS[i].equals(k)) return i; return 0; }

    /** Animated state (radians / 0..1). */
    public static final class State { public float hood, doorL, doorR, wheelSteer, steerWheel, spin, roof, time, chronoPh, fly; public int power; public boolean race, chrono; }   // power: 0 V8, 1 Wankel, 2 LEVITA

    static final class Part {
        String name; int kind; int hub = -1;          // kind: 0 static, 1 hood, 2 doorL, 3 doorR, 4 wheel, 5 caliper, 6 steering wheel
        int vPos, vNorm, vUV, vMat, ibo, gibo, n, gn, mask = 7;
    }
    private final List<Part> parts = new ArrayList<>();
    private Gl.Prog prog;
    private final float[] T = new float[16];

    /** Reads + uploads (GL thread). */
    public CarHd(Context c, Gl.Prog prog) throws Exception {
        this.prog = prog;
        // ".akg" on purpose: the Android build silently un-gzips and renames "*.gz" assets
        byte[] raw = null;
        for (String name : new String[]{"car_hd.akg", "car_hd.bin", "car_hd.bin.gz"}) {
            try (InputStream in = c.getAssets().open(name)) { raw = readAll(in); break; } catch (java.io.IOException ignored) { }
        }
        if (raw == null) throw new java.io.FileNotFoundException("car_hd.akg");
        if (raw.length > 2 && (raw[0] & 0xff) == 0x1f && (raw[1] & 0xff) == 0x8b)
            try (InputStream in = new GZIPInputStream(new java.io.ByteArrayInputStream(raw))) { raw = readAll(in); }
        ByteBuffer bb = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN);
        byte[] magic = new byte[4]; bb.get(magic);
        if (magic[0] != 'A' || magic[1] != 'K' || magic[2] != 'G') throw new IllegalStateException("car_hd.bin non valido");
        int count = bb.getInt();
        for (int p = 0; p < count; p++) {
            int nl = bb.getInt(); byte[] nb = new byte[nl]; bb.get(nb); bb.position(bb.position() + (4 - nl % 4) % 4);
            Part part = new Part(); part.name = new String(nb, "UTF-8");
            bb.getFloat(); bb.getFloat(); bb.getFloat();      // pivot (rig constants above are used)
            int vc = bb.getInt(), ni = bb.getInt(), ng = bb.getInt();
            part.vPos = vbo(bb, vc * 3); part.vNorm = vbo(bb, vc * 3); part.vUV = vbo(bb, vc * 2); part.vMat = vbo(bb, vc);
            part.ibo = ibo(bb, ni); part.n = ni; part.gibo = ibo(bb, ng); part.gn = ng;
            String n = part.name;
            if (n.equals("hood")) part.kind = 1; else if (n.equals("doorL")) part.kind = 2; else if (n.equals("doorR")) part.kind = 3;
            else if (n.startsWith("wheel")) { part.kind = 4; part.hub = hubIndex(n.substring(5)); }
            else if (n.startsWith("caliper")) { part.kind = 5; part.hub = hubIndex(n.substring(7)); }
            else if (n.equals("steeringWheel")) part.kind = 6;
            else if (n.equals("roofA")) part.kind = 7; else if (n.equals("roofB")) part.kind = 8; else if (n.equals("tonneau")) part.kind = 9;
            else if (n.equals("winL")) part.kind = 10; else if (n.equals("winR")) part.kind = 11;
            else if (n.startsWith("sphere")) { part.kind = 12; part.hub = hubIndex(n.substring(6)); }
            else if (n.equals("qwinL") || n.equals("qwinR")) part.kind = 13;
            else if (n.equals("chrono")) part.kind = 14;
            else if (n.startsWith("chronoR")) { part.kind = 15; part.hub = n.charAt(7) - '1'; }
            else if (n.equals("magRings")) part.kind = 16;
            else if (n.equals("exhaustR")) part.kind = 17;
            else if (n.equals("exhaust")) part.kind = 18;
            // which power units show this part (bit 0 V8, 1 Wankel, 2 LEVITA)
            part.mask = 7;
            if (n.equals("engine")) part.mask = 1; else if (n.equals("engineW")) part.mask = 2; else if (n.equals("engineE") || n.equals("magPads") || n.equals("magRings") || part.kind == 12) part.mask = 4;
            else if (n.equals("exhaustR")) part.mask = 3;
            else if (n.equals("exhaust") || part.kind == 4 || part.kind == 5) part.mask = 3;
            parts.add(part);
        }
    }
    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int k;
        while ((k = in.read(b)) > 0) o.write(b, 0, k);
        return o.toByteArray();
    }
    private static int hubIndex(String k) { for (int i = 0; i < 4; i++) if (HUB_KEYS[i].equals(k)) return i; return 0; }
    private static int vbo(ByteBuffer bb, int floats) {
        FloatBuffer f = ByteBuffer.allocateDirect(floats * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
        for (int i = 0; i < floats; i++) f.put(bb.getFloat());
        f.position(0);
        int[] id = new int[1]; GLES20.glGenBuffers(1, id, 0);
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, id[0]);
        GLES20.glBufferData(GLES20.GL_ARRAY_BUFFER, floats * 4, f, GLES20.GL_STATIC_DRAW);
        return id[0];
    }
    private static int ibo(ByteBuffer bb, int n) {
        ShortBuffer s = ByteBuffer.allocateDirect(Math.max(2, n * 2)).order(ByteOrder.nativeOrder()).asShortBuffer();
        for (int i = 0; i < n; i++) s.put(bb.getShort());
        if (n % 2 == 1) bb.getShort();
        s.position(0);
        if (n == 0) return 0;
        int[] id = new int[1]; GLES20.glGenBuffers(1, id, 0);
        GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, id[0]);
        GLES20.glBufferData(GLES20.GL_ELEMENT_ARRAY_BUFFER, n * 2, s, GLES20.GL_STATIC_DRAW);
        return id[0];
    }

    /** Material table — same as materials() in web/car_render.js. */
    public void setMaterials(String paint, float[] a, float[] b) {
        float[] p = PAINTS[paintIndex(paint)];
        float[][] col = {p, {0.06f, 0.06f, 0.07f}, {0.02f, 0.02f, 0.025f}, {0.30f, 0.31f, 0.35f}, {0.02f, 0.03f, 0.05f}, {0.85f, 0.95f, 1.0f}, {1.0f, 0.06f, 0.12f}, a,
            {0.025f, 0.025f, 0.025f}, {0.35f, 0.35f, 0.37f}, b, {0.05f, 0.045f, 0.05f}, {0.035f, 0.035f, 0.04f}, {0.025f, 0.027f, 0.035f}, {0, 0, 0}, {0.6f, 0.6f, 0.62f},
            b, a, {0.03f, 0.03f, 0.035f}, {0.03f, 0.03f, 0.035f}, {0.62f, 0.58f, 0.60f}};
        float[][] par = {{0.18f, 0.55f, 0, 0}, {0.3f, 0.2f, 0, 1}, {0.6f, 0, 0, 0}, {0.12f, 1, 0, 0}, {0.05f, 0, 0, 0}, {0.2f, 0, 1, 7}, {0.2f, 0, 1, 6}, {0.3f, 0, 1, 9},
            {0.9f, 0, 0, 3}, {0.35f, 0.9f, 0, 5}, {0.35f, 0.2f, 0.15f, 0}, {0.55f, 0, 0, 2}, {0.95f, 0, 0, 0}, {0.7f, 0, 0, 0}, {0.3f, 0, 1, 4}, {0.35f, 1, 0, 0},
            {0.3f, 0, 1, 9}, {0.3f, 0, 0.8f, 9}, {0.5f, 0.3f, 0, 8}, {1, 0, 0, 10}, {0.22f, 1, 0, 11}};
        float[] c3 = new float[63], c4 = new float[84];
        for (int i = 0; i < 21; i++) { System.arraycopy(col[i], 0, c3, i * 3, 3); System.arraycopy(par[i], 0, c4, i * 4, 4); }
        GLES20.glUseProgram(prog.id);
        GLES20.glUniform3fv(prog.u("uMatCol"), 21, c3, 0);
        GLES20.glUniform4fv(prog.u("uMatPar"), 21, c4, 0);
    }

    private static void about(float[] m, float[] p, float rad) {
        Matrix.translateM(m, 0, p[0], p[1], p[2]); Matrix.rotateM(m, 0, (float) Math.toDegrees(rad), 1, 0, 0); Matrix.translateM(m, 0, -p[0], -p[1], -p[2]);
    }
    private void partMatrix(Part p, float[] car, State s, float[] out) {
        System.arraycopy(car, 0, out, 0, 16);
        float r = s.roof, win = sm(r / 0.2f), lid = sm((r - 0.12f) / 0.2f) * (1 - sm((r - 0.80f) / 0.18f)), fold = sm((r - 0.25f) / 0.25f), flip = sm((r - 0.42f) / 0.40f);
        switch (p.kind) {
            case 7: about(out, ROOF_PIVOT_B, -ROOF_FLIP * flip); about(out, ROOF_JOINT, -ROOF_FOLD * fold); return;
            case 8: about(out, ROOF_PIVOT_B, -ROOF_FLIP * flip); return;
            case 9: about(out, LID_PIVOT, LID_OPEN * lid); return;
            case 10: case 11: {
                float[] pv = p.kind == 10 ? DOOR_L : DOOR_R; float k = p.kind == 10 ? s.doorL : s.doorR, o2 = p.kind == 10 ? DOOR_OUT : -DOOR_OUT;
                Matrix.translateM(out, 0, pv[0], pv[1], pv[2]);
                Matrix.rotateM(out, 0, (float) Math.toDegrees(o2 * k), 0, 0, 1);
                Matrix.rotateM(out, 0, (float) Math.toDegrees(DOOR_OPEN * k), 1, 0, 0);
                Matrix.translateM(out, 0, -pv[0], -pv[1], -pv[2]);
                Matrix.translateM(out, 0, 0, -WIN_DROP * win, 0);
                return;
            }
            case 12: {
                float[] h = HUBS[p.hub]; float fl = s.fly, outS = h[0] > 0 ? 1 : -1;
                float bob = SPHERE_LIFT + 0.006f * (float) Math.sin(s.time * 2.3f + h[2] * 3 + h[0]);
                Matrix.translateM(out, 0, h[0] + outS * TUCK_X * fl, h[1] + bob + TUCK_Y * fl, h[2]);
                if (p.hub < 2) Matrix.rotateM(out, 0, (float) Math.toDegrees(s.wheelSteer * (1 - fl)), 0, 1, 0);
                Matrix.rotateM(out, 0, (float) Math.toDegrees(-outS * fl * Math.PI / 2), 0, 0, 1);
                if (fl > 0.5f) Matrix.rotateM(out, 0, (float) Math.toDegrees((s.time * 4) % (2 * Math.PI)), 0, 1, 0);
                else Matrix.rotateM(out, 0, (float) Math.toDegrees((s.spin * WHEEL_R / SPHERE_R) % (2 * Math.PI)), 1, 0, 0);
                return;
            }
            case 13: Matrix.translateM(out, 0, 0, -WIN_DROP * win, 0); return;
            case 15: {
                float ph = s.chronoPh + s.time * 0.8f;
                Matrix.translateM(out, 0, CHRONO_C[0], CHRONO_C[1], CHRONO_C[2]);
                if (p.hub == 0) { Matrix.rotateM(out, 0, (float) Math.toDegrees(ph % 6.2831853f), 0, 1, 0); Matrix.rotateM(out, 0, (float) Math.toDegrees(0.35f), 1, 0, 0); }
                else if (p.hub == 1) { Matrix.rotateM(out, 0, (float) Math.toDegrees((-ph * 1.4f) % 6.2831853f), 1, 0, 0); Matrix.rotateM(out, 0, (float) Math.toDegrees(0.6f), 0, 0, 1); }
                else { Matrix.rotateM(out, 0, (float) Math.toDegrees((ph * 1.9f) % 6.2831853f), 0, 0, 1); Matrix.rotateM(out, 0, (float) Math.toDegrees(1.2f), 1, 0, 0); }
                return;
            }
            case 1:
                Matrix.translateM(out, 0, HOOD_PIVOT[0], HOOD_PIVOT[1], HOOD_PIVOT[2]);
                Matrix.rotateM(out, 0, (float) Math.toDegrees(HOOD_OPEN * s.hood), 1, 0, 0);
                Matrix.translateM(out, 0, -HOOD_PIVOT[0], -HOOD_PIVOT[1], -HOOD_PIVOT[2]);
                break;
            case 2: case 3: {
                float[] pv = p.kind == 2 ? DOOR_L : DOOR_R; float k = p.kind == 2 ? s.doorL : s.doorR, out2 = p.kind == 2 ? DOOR_OUT : -DOOR_OUT;
                Matrix.translateM(out, 0, pv[0], pv[1], pv[2]);
                Matrix.rotateM(out, 0, (float) Math.toDegrees(out2 * k), 0, 0, 1);
                Matrix.rotateM(out, 0, (float) Math.toDegrees(DOOR_OPEN * k), 1, 0, 0);
                Matrix.translateM(out, 0, -pv[0], -pv[1], -pv[2]);
                break;
            }
            case 4: case 5: {
                float[] h = HUBS[p.hub];
                Matrix.translateM(out, 0, h[0], h[1], h[2]);
                if (p.hub < 2) Matrix.rotateM(out, 0, (float) Math.toDegrees(s.wheelSteer), 0, 1, 0);
                if (p.kind == 4) Matrix.rotateM(out, 0, (float) Math.toDegrees(s.spin % (2 * Math.PI)), 1, 0, 0);
                break;
            }
            case 6:
                Matrix.translateM(out, 0, STEER_PIVOT[0], STEER_PIVOT[1], STEER_PIVOT[2]);
                Matrix.rotateM(out, 0, (float) Math.toDegrees(STEER_TILT), 1, 0, 0);
                Matrix.rotateM(out, 0, (float) Math.toDegrees(-s.steerWheel), 0, 0, 1);
                break;
            default: break;
        }
    }

    /** glass = false: opaque pass; true: transparent glass (blend on, depth write off, set by the caller). */
    public void draw(float[] car, State s, boolean glass) {
        GLES20.glUseProgram(prog.id);
        prog.f1("uGlassPass", glass ? 1 : 0);
        int aPos = prog.a("aPos"), aNorm = prog.a("aNorm"), aUV = prog.a("aUV"), aMat = prog.a("aMat");
        int lm = prog.u("uModel");
        for (Part p : parts) {
            int ib = glass ? p.gibo : p.ibo, n = glass ? p.gn : p.n;
            if (ib == 0 || n == 0) continue;
            if ((p.mask & (1 << s.power)) == 0) continue;
            if ((p.kind == 18 && s.race) || (p.kind == 17 && !s.race)) continue;
            if ((p.kind == 14 || p.kind == 15) && !s.chrono) continue;
            if (p.kind == 16 && s.fly > 0.25f) continue;
            partMatrix(p, car, s, T);
            GLES20.glUniformMatrix4fv(lm, 1, false, T, 0);
            bind(aPos, p.vPos, 3); bind(aNorm, p.vNorm, 3); bind(aUV, p.vUV, 2); bind(aMat, p.vMat, 1);
            GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, ib);
            GLES20.glDrawElements(GLES20.GL_TRIANGLES, n, GLES20.GL_UNSIGNED_SHORT, 0);
        }
        for (int l : new int[]{aPos, aNorm, aUV, aMat}) if (l >= 0) GLES20.glDisableVertexAttribArray(l);
    }
    private static void bind(int loc, int vbo, int size) {
        if (loc < 0) return;
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, vbo);
        GLES20.glEnableVertexAttribArray(loc);
        GLES20.glVertexAttribPointer(loc, size, GLES20.GL_FLOAT, false, 0, 0);
    }

    /* performance sheets (fictional) — generated from SPECS_BY in web/car_hd.js */
    public static final String[] POWER_KEYS = {"v8", "wankel", "mag"};
    public static final String[] POWER_NAMES = {"V8 BITURBO IBRIDO", "WANKEL 4 ROTORI H₂", "LEVITA ELETTRICA"};
    public static final String[] MODEL_NAMES = {"AMPY KAGE GT", "AMPY KAGE GT R4-H", "AMPY KAGE GT LEVITA"};
    public static int powerIndex(String k) { for (int i = 0; i < 3; i++) if (POWER_KEYS[i].equals(k)) return i; return 0; }
    public static final String[][][] SPECS_BY = {
        {
            {"MOTORE", "V8 4.0 L biturbo ibrido · motore elettrico assiale anteriore"},
            {"POTENZA", "780 CV termici + 220 CV elettrici = 1000 CV (735 kW) a 8.200 giri/min"},
            {"COPPIA", "1.150 Nm combinati (800 Nm a 3.200–6.500 giri/min)"},
            {"REGIME MAX", "9.000 giri/min"},
            {"TRASMISSIONE", "Doppia frizione 8 rapporti · trazione integrale e-AWD con torque vectoring"},
            {"ACCELERAZIONE", "0–100 km/h 2,4 s · 0–200 km/h 6,9 s · 0–300 km/h 17,8 s"},
            {"VELOCITÀ MAX", "345 km/h (con N₂O) · 260 km/h senza boost"},
            {"FRENATA", "100–0 km/h in 29 m · dischi carboceramici 410/390 mm"},
            {"PESO", "1.420 kg · rapporto peso/potenza 1,42 kg/CV"},
            {"AERODINAMICA", "Deportanza 520 kg a 250 km/h · ala posteriore attiva"},
            {"DIMENSIONI", "L 4.70 m · L 2.06 m · H 1.24 m · passo 2.87 m"},
            {"PNEUMATICI", "265/30 R21 ant. · 325/25 R22 post."},
            {"BATTERIA", "6,2 kWh · boost elettrico 18 s · ricarica in frenata"}
        },
        {
            {"MOTORE", "Wankel quadrirotore 2.616 cc (4 × 654 cc) a idrogeno · ibrido con motore elettrico assiale"},
            {"POTENZA", "860 CV a idrogeno + 260 CV elettrici = 1120 CV (824 kW) a 10.200 giri/min"},
            {"COPPIA", "1.020 Nm combinati (rotori 640 Nm a 7.800 giri/min + coppia istantanea elettrica)"},
            {"REGIME MAX", "10.500 giri/min"},
            {"TRASMISSIONE", "Doppia frizione 8 rapporti · trazione integrale e-AWD con torque vectoring"},
            {"ACCELERAZIONE", "0–100 km/h 2,3 s · 0–200 km/h 6,5 s · 0–300 km/h 16,4 s"},
            {"VELOCITÀ MAX", "352 km/h (con N₂O) · 268 km/h senza boost"},
            {"FRENATA", "100–0 km/h in 29 m · dischi carboceramici 410/390 mm"},
            {"PESO", "1.390 kg · serbatoi H₂ a 700 bar in fibra di carbonio (6,4 kg)"},
            {"AERODINAMICA", "Deportanza 520 kg a 250 km/h · ala posteriore attiva"},
            {"DIMENSIONI", "L 4.70 m · L 2.06 m · H 1.24 m · passo 2.87 m"},
            {"PNEUMATICI", "265/30 R21 ant. · 325/25 R22 post."},
            {"BATTERIA", "5,0 kWh · allo scarico solo vapore acqueo"}
        },
        {
            {"MOTORE", "Propulsione elettromagnetica · 4 sfere a levitazione con motori a flusso assiale integrati"},
            {"POTENZA", "4 × 320 kW = 1280 kW (1740 CV) · nessuno scarico"},
            {"COPPIA", "2.400 Nm istantanei · vettorializzazione su 360° (le sfere rotolano in ogni direzione)"},
            {"REGIME MAX", "22.000 giri/min (motori-sfera)"},
            {"TRASMISSIONE", "Presa diretta · controllo di campo per ogni sfera"},
            {"ACCELERAZIONE", "0–100 km/h 1,8 s · 0–200 km/h 5,2 s · 0–300 km/h 12,9 s"},
            {"VELOCITÀ MAX", "380 km/h (boost di campo) · 290 km/h di serie"},
            {"FRENATA", "100–0 km/h in 29 m · dischi carboceramici 410/390 mm"},
            {"PESO", "1.480 kg · altezza di levitazione 4 cm"},
            {"AERODINAMICA", "Deportanza 520 kg a 250 km/h · ala posteriore attiva"},
            {"DIMENSIONI", "L 4.70 m · L 2.06 m · H 1.24 m · passo 2.87 m"},
            {"PNEUMATICI", "Sfere Ø 670 mm con battistrada in elastomero a grafene"},
            {"BATTERIA", "28 kWh a stato solido · ronzio elettrostatico di serie"}
        },
    };
    public static final String[][] SPECS = SPECS_BY[0];
}
