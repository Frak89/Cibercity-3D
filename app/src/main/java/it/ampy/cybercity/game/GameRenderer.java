package it.ampy.cybercity.game;

import it.ampy.cybercity.L;

import android.content.Context;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.SystemClock;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

import it.ampy.cybercity.Palette;
import it.ampy.cybercity.Weather;

/** NEON RUN renderer: same shaders as the screensaver, camera-relative torus world. Mirrors Game.frame() in web/game.js. */
public class GameRenderer implements GLSurfaceView.Renderer {
    public static final String[] VIEWS = {L.t("INSEGUIMENTO"), L.t("INSEGUIMENTO LONTANO"), L.t("COFANO"), L.t("ABITACOLO"), L.t("PARAURTI"), L.t("CINEMATICA"), L.t("DALL'ALTO")};
    static final float S = GameCity.S;

    private final Context ctx;
    final CarPhysics car = new CarPhysics();
    final CarPhysics.Input input = new CarPhysics.Input();
    public volatile int view = 0;
    public volatile String palette = "neon", weather = "", paint = "nero";
    public volatile boolean paused = false;
    public volatile float lastImpact = 0;
    public volatile String hdError = null;
    final EngineSim eng = new EngineSim();
    private final ExhaustFx exhaust = new ExhaustFx();
    private Gl.Prog fxProg;
    private float fxOx, fxOz; private boolean fxInit = false;
    public volatile float telGx, telGy, t100 = -1, t200 = -1; private float telV0 = 0, telRun = -1, handK = 0; private boolean d100, d200;
    public volatile int kit, rim, livery, text = -1, stripeC = 0, rimC = 3, brakes = 0;
    public volatile String hudFuelCons = "", hudFuelTank = ""; public volatile float hudFuelK = 1;
    public volatile float hudRpm, hudRed = 8900, hudLim = 9100; public volatile int hudGear;
    public volatile int power = 0; public volatile boolean roofOpen = false;
    /* KAGE CHRONO + race exhaust + LEVITA flight */
    public volatile boolean chronoOn = false, race = false, flyOn = false;
    public volatile float hudChrono = 0, hudCool = 0; public volatile boolean hudPast = false;
    private Meadow meadow; private final List<Gl.Mesh> nature = new ArrayList<>();
    private Gl.Prog natureP, meadowP, warpP;
    private boolean past = false;
    private float tjCharge = 0, tjCool = 0, tjWhite = 0, tjRing = 1, tjJumpAt = -1, flyK = 0, bank = 0, pitch = 0, chronoPh = 0;
    private boolean arrive = false;
    private float[] curFog, curTop; private float curFogDen;
    private float roofT = 0;
    /** HUD snapshot (written on the GL thread) */
    public volatile float hudKmh, hudBoost, hudDrift, hudSteer, hudH, hudX, hudZ, hudDist; public volatile int hudScore, hudBest; public volatile boolean hudBoosting, hudCockpit;

    private GameCity city;
    private Gl.Prog sky, building, ground, board, traffic, rain, post, mist, solid, glow, hdProg;
    private CarHd hd;
    private final CarHd.State hdState = new CarHd.State();
    private final List<Gl.Mesh> chunks = new ArrayList<>();
    private Gl.Mesh mBoard, mTraffic, mRain, mGround, mQuad, cSolid, cUnder, cHeads, cTail;
    private String carBuilt = "";
    private float t = 0, camH = 0, flash = 0, nextFlash = 3;
    private long last = 0;
    private int W = 1, H = 1;
    private final Random rnd = new Random();
    private final float[] V = new float[16], P = new float[16], VP = new float[16], M = new float[16];

    public GameRenderer(Context c) { ctx = c.getApplicationContext(); }

    /* ---------------- screensaver: autopilot run through the city (silent, no HUD) ---------------- */
    public volatile boolean autopilot = false;
    private int apDir = 0, apTurn = 0;         // cardinal heading 0 +z, 1 +x, 2 -z, 3 -x; pending turn -1 / 0 / +1
    private float apNextInt = Float.NaN, apCruise = 30, apStuck = 0, apView = 0, apViewNext = 10, apBoostT = 0;
    private static final float LANE = 4.5f;
    private static float wrapA(float a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
    /** lane line of direction d through the road whose centre is c (x for d even, z for d odd): returns the fixed coordinate */
    private static float laneCoord(int d, float c) { float h = d * (float) Math.PI / 2; return d % 2 == 0 ? c + (float) Math.cos(h) * LANE : c - (float) Math.sin(h) * LANE; }
    private void autopilot(float dt) {
        float along = apDir % 2 == 0 ? car.z : car.x, sgn = apDir == 0 || apDir == 1 ? 1 : -1;
        float cross = apDir % 2 == 0 ? car.x : car.z;
        float road = Math.round(cross / GameCity.GP) * GameCity.GP;
        // next intersection ahead along the travel axis
        float ni = sgn > 0 ? (float) Math.ceil((along + 0.5f) / GameCity.GP) * GameCity.GP : (float) Math.floor((along - 0.5f) / GameCity.GP) * GameCity.GP;
        if (Float.isNaN(apNextInt) || Math.abs(ni - apNextInt) > 1) { apNextInt = ni; float r = rnd.nextFloat(); apTurn = r < 0.25f ? -1 : r < 0.5f ? 1 : 0; apCruise = 22 + rnd.nextFloat() * 18; }
        float toInt = (apNextInt - along) * sgn;
        if (apTurn != 0) {
            int nd = (apDir + apTurn + 4) % 4;
            float newLane = laneCoord(nd, apNextInt);             // where the new lane line crosses our axis
            if ((newLane - along) * sgn < 6.5f) { apDir = nd; apTurn = 0; apNextInt = Float.NaN; return; }
        }
        float lc = laneCoord(apDir, road);
        float look = 7 + car.speed() * 0.35f;
        float tx, tz;
        if (apDir % 2 == 0) { tx = lc; tz = car.z + sgn * look; } else { tz = lc; tx = car.x + sgn * look; }
        float want = (float) Math.atan2(tx - car.x, tz - car.z);
        float err = wrapA(want - car.h);
        input.steer = Math.max(-1, Math.min(1, err * 2.2f));
        float vt = apTurn != 0 && toInt < 45 ? 11 : Math.abs(err) > 0.4f ? 14 : apCruise;
        float v = car.speed();
        input.gas = v < vt; input.brake = v > vt + 4; input.hand = false;
        apBoostT -= dt; if (apBoostT < -12 && apTurn == 0 && toInt > 60 && rnd.nextFloat() < 0.01f) apBoostT = 2.5f;
        input.boost = apBoostT > 0 && apTurn == 0;
        // stuck against a wall → back onto the lane
        if (v < 1.5f) apStuck += dt; else apStuck = 0;
        if (apStuck > 2.5f) {
            apStuck = 0; car.vx = car.vz = 0;
            if (apDir % 2 == 0) car.x = laneCoord(apDir, road); else car.z = laneCoord(apDir, road);
            car.h = apDir * (float) Math.PI / 2;
        }
        // cinematic camera rotation (no cockpit HUD)
        apView += dt;
        if (apView > apViewNext) { apView = 0; apViewNext = 9 + rnd.nextFloat() * 8; int[] vs = {0, 1, 5, 2, 4, 0, 6, 3}; view = vs[rnd.nextInt(vs.length)]; }
    }
    /** start the run on a lane (called once when autopilot is switched on) */
    public void startAutopilot() {
        autopilot = true; car.reset(); car.x = laneCoord(0, 0); car.z = 42; car.h = 0; apDir = 0; apNextInt = Float.NaN; view = 0;
        String[] pk = CarHd.PAINT_KEYS; paint = pk[rnd.nextInt(pk.length)]; kit = rnd.nextInt(3); rim = rnd.nextInt(3); livery = rnd.nextInt(3);
        rimC = rnd.nextInt(CarHd.COLORS.length); stripeC = rnd.nextInt(CarHd.COLORS.length); power = rnd.nextInt(3); race = rnd.nextBoolean();
    }

    @Override public void onSurfaceCreated(GL10 gl, EGLConfig cfg) {
        String common = Gl.asset(ctx, "common.glsl");
        sky = Gl.prog(ctx, "sky.vert", "sky.frag", common);
        building = Gl.prog(ctx, "building.vert", "building.frag", common);
        ground = Gl.prog(ctx, "ground.vert", "ground_game.frag", common);
        board = Gl.prog(ctx, "billboard.vert", "billboard.frag", common);
        traffic = Gl.prog(ctx, "car.vert", "car.frag", common);
        rain = Gl.prog(ctx, "rain.vert", "rain.frag", common);
        post = Gl.prog(ctx, "post.vert", "post.frag", common);
        mist = Gl.prog(ctx, "post.vert", "mist.frag", common);
        solid = Gl.prog(ctx, "solid.vert", "solid.frag", common);
        glow = Gl.prog(ctx, "glow.vert", "glow.frag", common);
        hdProg = Gl.prog(ctx, "car_hd.vert", "car_hd.frag", common);
        fxProg = Gl.prog(ctx, "particle.vert", "particle.frag", common); exhaust.glLost();
        natureP = Gl.prog(ctx, "nature.vert", "nature.frag", common);
        meadowP = Gl.prog(ctx, "ground.vert", "ground_meadow.frag", common);
        warpP = Gl.prog(ctx, "post.vert", "warp.frag", common);
        if (meadow == null) meadow = new Meadow(2077 + 1885);
        nature.clear();
        for (Meadow.Chunk c : meadow.chunks)
            nature.add(Gl.mesh(new String[]{"aPos", "aCenter", "aNorm", "aCol"}, new float[][]{c.pos.arr(), c.center.arr(), c.norm.arr(), c.col.arr()}, new int[]{3, 2, 3, 4}, c.idx.arr()));
        try { hd = new CarHd(ctx, hdProg); hdError = null; } catch (Exception ex) { android.util.Log.e(Gl.TAG, "car_hd", ex); hd = null; hdError = String.valueOf(ex.getMessage()); }
        if (city == null) city = new GameCity(2077);
        chunks.clear();
        for (GameCity.Chunk c : city.chunks)
            chunks.add(Gl.mesh(new String[]{"aPos", "aCenter", "aNorm", "aUV", "aMisc"},
                new float[][]{c.pos.arr(), c.center.arr(), c.norm.arr(), c.uv.arr(), c.misc.arr()}, new int[]{3, 2, 3, 2, 4}, c.idx.arr()));
        mBoard = Gl.mesh(new String[]{"aPos", "aCenter", "aUV", "aMisc"}, new float[][]{city.gPos.arr(), city.gCenter.arr(), city.gUV.arr(), city.gMisc.arr()}, new int[]{3, 2, 2, 4}, city.gIdx.arr());
        mTraffic = Gl.mesh(new String[]{"aLane", "aDir", "aCorner"}, new float[][]{city.cLane.arr(), city.cDir.arr(), city.cCorner.arr()}, new int[]{4, 4, 2}, city.cIdx.arr());
        mRain = Gl.mesh(new String[]{"aSeed", "aCorner"}, new float[][]{city.rSeed.arr(), city.rCorner.arr()}, new int[]{3, 2}, city.rIdx.arr());
        float h = S / 2;
        mGround = Gl.mesh(new String[]{"aPos"}, new float[][]{{-h, -h, h, -h, h, h, -h, h}}, new int[]{2}, new short[]{0, 1, 2, 0, 2, 3});
        mQuad = Gl.mesh(new String[]{"aPos"}, new float[][]{{-1, -1, 1, -1, 1, 1, -1, 1}}, new int[]{2}, new short[]{0, 1, 2, 0, 2, 3});
        carBuilt = "";
        last = 0;
    }

    private void buildCar(Palette pal) {
        Gl.free(cSolid); Gl.free(cUnder); Gl.free(cHeads); Gl.free(cTail);
        CarModel m = new CarModel(CarModel.PAINTS[CarModel.paintIndex(paint)], pal.neonA);
        cSolid = Gl.mesh(new String[]{"aPos", "aNorm", "aCol"}, new float[][]{m.pos.arr(), m.norm.arr(), m.col.arr()}, new int[]{3, 3, 4}, m.idx.arr());
        cUnder = glowMesh(m.under); cHeads = glowMesh(m.heads); cTail = glowMesh(m.tail);
        carBuilt = pal.key + paint;
    }
    private static Gl.Mesh glowMesh(CarModel.Glow g) {
        return Gl.mesh(new String[]{"aPos", "aUV", "aCol"}, new float[][]{g.pos.arr(), g.uv.arr(), g.col.arr()}, new int[]{3, 2, 4}, g.idx.arr());
    }

    @Override public void onSurfaceChanged(GL10 gl, int w, int h) { W = Math.max(1, w); H = Math.max(1, h); GLES20.glViewport(0, 0, W, H); }

    /* ---------------- camera views (cameraFor in JS) ---------------- */
    private final float[] e = new float[3], l = new float[3];
    private boolean drawCar; private float fov;
    private void camera(float dt) {
        float dh = car.h - camH;
        while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        camH += dh * Math.min(1, dt * (view == 1 ? 3 : 5));
        float speed = car.speed();
        float fx = (float) Math.sin(camH), fz = (float) Math.cos(camH);
        float cfx = (float) Math.sin(car.h), cfz = (float) Math.cos(car.h), crx = (float) Math.cos(car.h), crz = (float) -Math.sin(car.h);
        drawCar = true; fov = 62 + Math.min(18, speed * 0.2f);
        switch (view) {
            case 1: set(e, -fx * 11, 4.6f, -fz * 11); set(l, fx * 6, 1.0f, fz * 6); break;
            case 2: set(e, cfx * 0.9f, 1.08f, cfz * 0.9f); set(l, cfx * 30, 0.8f, cfz * 30); fov += 4; break;
            case 3: { float[] de = CarHd.DRIVER_EYE;
                set(e, cfx * de[2] + crx * de[0], de[1], cfz * de[2] + crz * de[0]); set(l, cfx * 30 + crx * de[0], de[1] - 0.12f, cfz * 30 + crz * de[0]);
                drawCar = hd != null; fov = 70 + Math.min(10, speed * 0.1f); break; }
            case 4: set(e, cfx * 2.45f, 0.45f, cfz * 2.45f); set(l, cfx * 30, 0.45f, cfz * 30); drawCar = false; fov += 8; break;
            case 5: { float a = t * 0.25f; set(e, (float) Math.sin(a) * 13, 5.5f + (float) Math.sin(t * 0.4f) * 2, (float) Math.cos(a) * 13); set(l, 0, 0.8f, 0); fov = 55; break; }
            case 6: set(e, -fx * 2, 70, -fz * 2); set(l, fx * 3, 0, fz * 3); fov = 60; break;
            default: set(e, -fx * 6.5f, 2.4f, -fz * 6.5f); set(l, fx * 4, 0.9f, fz * 4);
        }
        float sh = car.shake * 0.25f;
        e[0] += (rnd.nextFloat() - 0.5f) * sh; e[1] += (rnd.nextFloat() - 0.5f) * sh;
    }
    private static void set(float[] a, float x, float y, float z) { a[0] = x; a[1] = y; a[2] = z; }

    private void common(Gl.Prog p, Palette pal, float fogDen, float camX, float camZ, float[] eye) {
        GLES20.glUseProgram(p.id);
        p.f1("uTime", t % 3600f); p.f1("uL", S); p.f1("uFar", 620); p.f1("uZOff", 0.5f); p.f1("uCamX", camX); p.f1("uWrapX", S); p.f1("uCamZ", camZ);
        p.f1("uFogDen", fogDen); p.f1("uFlash", flash); p.f1("uPitch", GameCity.GP); p.f1("uRoad", GameCity.RW);
        p.v3("uFog", curFog != null ? curFog : pal.fog); p.v3("uSkyTop", curTop != null ? curTop : pal.top); p.v3("uWinA", pal.winA); p.v3("uWinB", pal.winB); p.v3("uWinC", pal.winC);
        p.v3("uNeonA", pal.neonA); p.v3("uNeonB", pal.neonB); p.v3("uEye", eye);
        p.m4("uVP", VP); p.m4("uV", V); p.m4("uP", P);
        { float fx = (float) Math.sin(car.h), fz = (float) Math.cos(car.h); int l = p.u("uHL"); if (l >= 0) { GLES20.glUniform4f(l, -e[0] + fx * 2.3f, -e[2] + fz * 2.3f, fx, fz); p.f1("uHLOn", past ? 0.35f : 1); } }
    }

    @Override public void onDrawFrame(GL10 gl) {
        long now = SystemClock.uptimeMillis();
        float dt = last == 0 ? 1 / 60f : Math.min(0.05f, (now - last) / 1000f);
        last = now;
        Palette pal = Palette.of(palette);
        if (!carBuilt.equals(pal.key + paint)) buildCar(pal);
        Weather.Fx wx = past ? null : Weather.fx(weather);
        curFog = past ? Meadow.FOG : null; curTop = past ? Meadow.TOP : null;
        // LEVITA flight: hover higher
        flyK += Math.max(-dt * 0.8f, Math.min(dt * 0.8f, (power == 2 && flyOn ? 1 : 0) - flyK));
        float fsm = flyK * flyK * (3 - 2 * flyK);
        car.y = fsm * CarHd.FLY_ALT + (power == 2 ? 0.015f * (float) Math.sin(t * 2.1f) * (1 + fsm * 4) : 0);
        car.meadow = past ? meadow : null;
        if (!paused) {
            t += dt;
            if (autopilot && !past) autopilot(dt);
            float imp = car.step(input, dt, city);
            if (imp > 3) lastImpact = imp;
            eng.race = race;
            eng.setType(power); car.pk = power == 0 ? 1 : power == 1 ? 1.03f : 1.1f;
            eng.update(dt, car.speed(), input.gas ? 1 : 0, car.boosting, false, car.slip, car.wheelspin, car.brakeHard, input.brake, flyK > 0.3f);
            // telemetry for the cockpit HUD: g forces and 0-100 / 0-200
            float vNow = Math.abs(car.vFwd);
            telGx += ((vNow - telV0) / Math.max(dt, 1e-3f) / 9.81f - telGx) * Math.min(1, dt * 6); telV0 = vNow;
            telGy += ((car.steer * 2.5f * Math.min(1, vNow / 10) / (1 + vNow / 45)) * vNow / 9.81f - telGy) * Math.min(1, dt * 6);
            if (vNow < 0.3f) { telRun = 0; d100 = d200 = false; }
            else if (telRun >= 0) { telRun += dt; if (!d100 && vNow * 3.6f >= 100) { t100 = telRun; d100 = true; } if (!d200 && vNow * 3.6f >= 200) { t200 = telRun; d200 = true; telRun = -1; } if (input.brake) telRun = -1; }
            handK += ((input.hand ? 1 : 0) - handK) * Math.min(1, dt * 12);
            roofT += Math.max(-dt / 5, Math.min(dt / 5, (roofOpen ? 1 : 0) - roofT));
            // KAGE CHRONO: hold 300 km/h to charge; the jump swaps Cybercity and the meadow
            float kmh = car.speed() * 3.6f;
            tjCool = Math.max(0, tjCool - dt); tjWhite = Math.max(0, tjWhite - dt * 1.6f); tjRing = Math.min(1, tjRing + dt * 0.9f);
            if (chronoOn && tjCool <= 0 && kmh >= 300) tjCharge = Math.min(1, tjCharge + dt / 1.6f); else tjCharge = Math.max(0, tjCharge - dt * 1.2f);
            if (tjCharge >= 1) { tjCharge = 0; tjCool = 4; tjWhite = 1; tjRing = 0; tjJumpAt = 0.18f; eng.boom(); car.shake = 1; lastImpact = 6; }
            if (tjJumpAt >= 0) { tjJumpAt -= dt; if (tjJumpAt < 0) { past = !past; exhaust.reset(); arrive = true; } }
            eng.chrono = chronoOn ? tjCharge : 0;
            chronoPh += dt * (1 + tjCharge * 14);
        }
        flash = Math.max(0, flash - dt * 3.5f);
        if (wx != null && wx.light > 0) { nextFlash -= dt; if (nextFlash <= 0) { flash = 1; nextFlash = rnd.nextFloat() < 0.35f ? 0.15f : 4 + rnd.nextFloat() * 9; } }
        camera(paused ? 0 : dt);
        if (view != 5 && view != 6) { e[1] += car.y; l[1] += car.y; } else l[1] += car.y;
        {   // exhaust particles live in the camera-relative frame: follow the origin across the torus
            float ox = car.x + e[0], oz = car.z + e[2];
            if (fxInit) { float dx = ox - fxOx, dz = oz - fxOz; dx -= Math.round(dx / S) * S; dz -= Math.round(dz / S) * S; exhaust.shift(-dx, 0, -dz); }
            fxOx = ox; fxOz = oz; fxInit = true;
        }
        float camX = (((car.x + e[0]) % S) + S) % S, camZ = (((car.z + e[2]) % S) + S) % S;
        float[] eye = {0, e[1], 0};
        Matrix.setLookAtM(V, 0, 0, e[1], 0, l[0] - e[0], l[1], l[2] - e[2], 0, 1, 0);
        Matrix.perspectiveM(P, 0, fov, W / (float) H, 0.12f, 700);
        Matrix.multiplyMM(VP, 0, P, 0, V, 0);
        float fogDen = past ? Meadow.FOG_DEN : pal.fogDen * (wx != null ? wx.fog : 1);

        GLES20.glClearColor(0, 0, 0, 1);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST); GLES20.glDisable(GLES20.GL_BLEND);
        common(sky, pal, fogDen, camX, camZ, eye);
        float fx = l[0] - e[0], fy = l[1] - e[1], fz = l[2] - e[2];
        float fl = (float) Math.sqrt(fx * fx + fy * fy + fz * fz); fx /= fl; fy /= fl; fz /= fl;
        float rx = -fz, ry = 0, rz = fx;  // forward × up(0,1,0)
        float rl = (float) Math.sqrt(rx * rx + rz * rz); rx /= rl; rz /= rl;
        float ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
        GLES20.glUniform3f(sky.u("uFwd"), fx, fy, fz);
        GLES20.glUniform3f(sky.u("uRight"), rx, ry, rz);
        GLES20.glUniform3f(sky.u("uUp"), ux, uy, uz);
        float ty = (float) Math.tan(Math.toRadians(fov) / 2);
        GLES20.glUniform2f(sky.u("uTan"), ty * W / H, ty);
        sky.f1("uCloud", past ? 0.45f : wx != null ? wx.cloud : 0); sky.f1("uDay", past ? 1 : 0);
        sky.v3("uSunDir", past ? Meadow.SUN_DIR : pal.sunDir); sky.v3("uSunCol", past ? Meadow.SUN : pal.sun); sky.f1("uSunStripes", pal.stripes);
        Gl.draw(sky, mQuad);

        GLES20.glEnable(GLES20.GL_DEPTH_TEST); GLES20.glDepthMask(true);
        if (past) {
            common(meadowP, pal, fogDen, camX, camZ, eye); meadowP.v3("uSunDir", Meadow.SUN_DIR); meadowP.v3("uSunCol", Meadow.SUN); Gl.draw(meadowP, mGround);
            common(natureP, pal, fogDen, camX, camZ, eye); natureP.v3("uSunDir", Meadow.SUN_DIR); natureP.v3("uSunCol", Meadow.SUN); for (Gl.Mesh m : nature) Gl.draw(natureP, m);
        } else {
            common(ground, pal, fogDen, camX, camZ, eye); Gl.draw(ground, mGround);
            common(building, pal, fogDen, camX, camZ, eye); for (Gl.Mesh m : chunks) Gl.draw(building, m);
            common(board, pal, fogDen, camX, camZ, eye); Gl.draw(board, mBoard);
        }
        // body: heading + gyroscopic bank into the turn (stronger in flight) + pitch with throttle / brake
        float vabs = car.speed();
        bank += ((-car.steer * (0.10f + 0.32f * fsm) * Math.min(1, vabs / 15)) - bank) * Math.min(1, dt * 4);
        pitch += (((input.gas ? -0.025f : 0) + (input.brake ? 0.04f : 0)) * (0.4f + fsm) - pitch) * Math.min(1, dt * 3);
        Matrix.setIdentityM(M, 0);
        Matrix.translateM(M, 0, -e[0], car.y, -e[2]);
        Matrix.rotateM(M, 0, (float) Math.toDegrees(car.h), 0, 1, 0);
        Matrix.rotateM(M, 0, (float) Math.toDegrees(pitch), 1, 0, 0);
        Matrix.rotateM(M, 0, (float) Math.toDegrees(bank), 0, 0, 1);
        hdState.roof = roofT; hdState.power = power; hdState.time = t;
        hdState.kit = kit; hdState.rim = rim; hdState.livery = livery; hdState.text = text; hdState.hand = handK;
        hdState.race = race; hdState.chrono = chronoOn; hdState.chronoPh = chronoPh; hdState.fly = fsm;
        hdState.wheelSteer = car.steer * 0.5f; hdState.steerWheel = car.steer * 2.6f; hdState.spin = car.spin;
        if (drawCar && hd != null) {
            common(hdProg, pal, fogDen, camX, camZ, eye);
            hd.stripe = CarHd.COLORS[stripeC]; hd.rimCol = CarHd.COLORS[rimC]; hd.brakes = brakes;
            hd.setMaterials(paint, pal.neonA, pal.neonB);
            hdProg.f1("uKey", past ? 1.0f : 0.35f);
            hdProg.f1("uSpd", Math.abs(car.vFwd) * 3.6f); hdProg.f1("uRpmK", eng.rpm / eng.limiter()); hdProg.f1("uGear", eng.gear); hdProg.f1("uFuelK", eng.fuelK); hdProg.f1("uGx", telGx); hdProg.f1("uLights", 1); hdProg.f1("uBrake", input.brake ? 1 : 0);
            hd.draw(M, hdState, false);
        } else if (drawCar) {
            common(solid, pal, fogDen, camX, camZ, eye);
            solid.m4("uModel", M);
            solid.f1("uGloss", CarModel.PAINTS[CarModel.paintIndex(paint)][0] > 0.6f ? 0.6f : 1f);
            Gl.draw(solid, cSolid);
        }
        GLES20.glEnable(GLES20.GL_BLEND); GLES20.glDepthMask(false);
        if (drawCar && hd != null) {
            GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
            common(hdProg, pal, fogDen, camX, camZ, eye);
            hd.draw(M, hdState, true);
        }
        if (!paused) {
            exhaust.update(dt, M, car.vx, car.vz, eng);
            exhaust.tyreSmoke(dt, M, Math.max(eng.burn, eng.tyre * 0.7f), car.vx, car.vz, CarHd.KIT_TRACK[Math.max(0, Math.min(2, kit))]);
            if (chronoOn && tjCharge > 0.05f) exhaust.chronoArcs(M, tjCharge, car.vx, car.vz);
            if (arrive) { arrive = false; exhaust.ring(M, 2.2f, car.vx, car.vz, 120); }
        }
        common(fxProg, pal, fogDen, camX, camZ, eye);
        exhaust.draw(fxProg, H / (2 * (float) Math.tan(Math.toRadians(fov) / 2)));
        GLES20.glEnable(GLES20.GL_BLEND); GLES20.glDepthMask(false);
        GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE);
        if (!past) { common(traffic, pal, fogDen, camX, camZ, eye); traffic.f1("uWidth", 0.3f); Gl.draw(traffic, mTraffic); }
        common(glow, pal, fogDen, camX, camZ, eye);
        glow.m4("uModel", M);
        glow.f1("uGlow", 0.55f + 0.15f * (float) Math.sin(t * 3)); Gl.draw(glow, cUnder);
        glow.f1("uGlow", 1); Gl.draw(glow, cHeads);
        glow.f1("uGlow", input.brake ? 1.8f : 0.7f); Gl.draw(glow, cTail);
        float rainAmt = wx != null ? wx.rain : 0;   // (no weather in the past)
        if (rainAmt > 0) {
            common(rain, pal, fogDen, camX, camZ, eye); rain.f1("uCamZ", camZ % 84);
            rain.f1("uRain", rainAmt); rain.f1("uRainSpeed", 28); rain.f1("uSnow", wx.snow); rain.f1("uWind", wx.wind);
            Gl.draw(rain, mRain);
        }
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        if (wx != null && wx.mist > 0) {
            common(mist, pal, fogDen, camX, camZ, eye); mist.f1("uMist", wx.mist * 0.7f); GLES20.glUniform2f(mist.u("uRes"), W, H);
            Gl.draw(mist, mQuad);
        }
        GLES20.glUseProgram(post.id);
        post.f1("uFade", paused ? 0.45f : car.hit * 0.25f); post.f1("uScan", 0); GLES20.glUniform2f(post.u("uRes"), W, H);
        Gl.draw(post, mQuad);
        if (tjCharge > 0.01f || tjWhite > 0.01f || tjRing < 1) {
            common(warpP, pal, fogDen, camX, camZ, eye); GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE);
            warpP.f1("uWarp", tjCharge * tjCharge); warpP.f1("uWhite", Math.min(1, tjWhite * 1.4f)); warpP.f1("uRing", tjRing); GLES20.glUniform2f(warpP.u("uRes"), W, H);
            Gl.draw(warpP, mQuad);
        }
        GLES20.glDepthMask(true); GLES20.glDisable(GLES20.GL_BLEND);

        hudChrono = chronoOn ? tjCharge : -1; hudCool = tjCool; hudPast = past;
        hudFuelCons = eng.fuelCons(); hudFuelTank = eng.fuelTank(); hudFuelK = eng.fuelK;
        hudRpm = eng.rpm; hudGear = eng.gear; hudRed = eng.red(); hudLim = eng.limiter();
        hudKmh = car.speed() * 3.6f; hudBoost = car.boost; hudBoosting = car.boosting; hudDrift = car.drift; hudSteer = car.steer;
        hudH = car.h; hudX = car.x; hudZ = car.z; hudDist = car.dist; hudScore = car.score; hudBest = car.best; hudCockpit = view == 3 && hd == null;
    }

    public void resetCar() { car.reset(); camH = 0; exhaust.reset(); fxInit = false; eng.refuel(1); }
    public void toPresent() { past = false; tjCharge = 0; }
}
