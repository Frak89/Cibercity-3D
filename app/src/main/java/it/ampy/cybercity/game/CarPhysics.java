package it.ampy.cybercity.game;

import java.util.List;

/** Arcade car physics with drift, nitro and building collisions. Port of stepCar() / collide() in web/game.js. */
final class CarPhysics {
    static final float GP = GameCity.GP, S = GameCity.S;
    static final int GN = GameCity.GN;

    static final class Input { volatile boolean gas, brake, hand, boost; volatile float steer; }

    float spin = 0;
    /** power unit factor: V8 1 · Wankel 1.03 · LEVITA 1.1 */
    float pk = 1;
    float x = 0, z = 42, h = 0, vx = 0, vz = 0, steer = 0, boost = 1, drift = 0, shake = 0, hit = 0, dist = 0;
    int score = 0, best = 0;
    boolean boosting; float slip;

    void reset() { x = 0; z = 42; h = 0; vx = vz = 0; steer = 0; boost = 1; drift = 0; shake = hit = 0; }
    float speed() { return (float) Math.hypot(vx, vz); }

    /** returns impact strength (0 = no crash) for haptics */
    /** set by the renderer: the meadow when we are in the past, altitude when flying */
    Meadow meadow = null; float y = 0;
    /** last step: wheelspin (launch / burnout), hard braking, signed forward speed */
    float wheelspin = 0, vFwd = 0; boolean brakeHard = false;
    float step(Input in, float dt, GameCity city) {
        float fx = (float) Math.sin(h), fz = (float) Math.cos(h), rx = (float) Math.cos(h), rz = (float) -Math.sin(h);
        float vF = vx * fx + vz * fz, vR = vx * rx + vz * rz;
        boosting = in.boost && boost > 0.02f && vF > 2;
        float maxF = (boosting ? 95 : 72) * pk;
        if (in.gas) vF += (boosting ? 30 : 17) * pk * pk * (1 - Math.max(0, vF) / (maxF + 8)) * dt;
        if (in.brake) vF -= (vF > 0.5f ? 34 : 10) * dt;
        if (!in.gas && !in.brake) vF -= Math.signum(vF) * Math.min(Math.abs(vF), 3.5f * dt);
        vF = Math.max(-14, Math.min(maxF + 5, vF));
        vF -= vF * Math.abs(vF) * 0.00022f * dt * 60 * 0.016f;
        boost = boosting ? Math.max(0, boost - dt * 0.28f) : Math.min(1, boost + dt * 0.07f);
        steer += (in.steer - steer) * Math.min(1, dt * 10);
        float sp = Math.abs(vF);
        float yaw = steer * 2.5f * Math.min(1, sp / 10) / (1 + sp / 45) * (vF < 0 ? -1 : 1);
        if (in.hand) yaw *= 1.45f;
        h += yaw * dt;
        float grip = in.hand ? 1.3f : (sp > 50 ? 5.5f : 8);
        vR *= (float) Math.exp(-grip * dt);
        if (in.hand) vF -= Math.signum(vF) * Math.min(Math.abs(vF), 6 * dt);
        float nfx = (float) Math.sin(h), nfz = (float) Math.cos(h), nrx = (float) Math.cos(h), nrz = (float) -Math.sin(h);
        vx = nfx * vF + nrx * vR + (fx - nfx) * vF * 0.6f;
        vz = nfz * vF + nrz * vR + (fz - nfz) * vF * 0.6f;
        x += vx * dt; z += vz * dt;
        spin += vF * dt / CarHd.WHEEL_R;
        dist += speed() * dt;
        slip = Math.abs(vx * nrx + vz * nrz);
        if (slip > 4 && sp > 12) drift += slip * dt * 10;
        else if (drift > 0) { score += Math.round(drift); best = Math.max(best, Math.round(drift)); drift = 0; }
        wheelspin = in.gas ? Math.min(1, Math.max(0, 1 - sp / 16) * (boosting ? 1.2f : 1) * (in.hand ? 1.3f : 1)) : 0;
        brakeHard = in.brake && sp > 14; vFwd = vF;
        float impact = meadow != null ? (y < 1.0f ? meadow.collide(this) : 0) : collide(city);
        x = ((x % S) + S) % S; z = ((z % S) + S) % S;
        shake = Math.max(0, shake - dt * 3); hit = Math.max(0, hit - dt * 2.5f);
        return impact;
    }

    private float collide(GameCity city) {
        float fx = (float) Math.sin(h), fz = (float) Math.cos(h), impact = 0;
        for (float off : new float[]{1.35f, -1.35f}) {
            float px = x + fx * off, pz = z + fz * off, r = 1.05f;
            int bx = (int) Math.floor(px / GP), bz = (int) Math.floor(pz / GP);
            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
                int ix = ((bx + i) % GN + GN) % GN, iz = ((bz + j) % GN + GN) % GN;
                float shiftX = (bx + i) * GP - ix * GP, shiftZ = (bz + j) * GP - iz * GP;
                List<float[]> rects = city.blocks.get(iz * GN + ix);
                for (float[] q : rects) {
                    float x0 = q[0] + shiftX - r, z0 = q[1] + shiftZ - r, x1 = q[2] + shiftX + r, z1 = q[3] + shiftZ + r;
                    if (px <= x0 || px >= x1 || pz <= z0 || pz >= z1) continue;
                    float pl = px - x0, pr = x1 - px, pb = pz - z0, pt = z1 - pz, m = Math.min(Math.min(pl, pr), Math.min(pb, pt));
                    float nx = 0, nz = 0;
                    if (m == pl) nx = -1; else if (m == pr) nx = 1; else if (m == pb) nz = -1; else nz = 1;
                    x += nx * m; z += nz * m;
                    px += nx * m; pz += nz * m;
                    float vn = vx * nx + vz * nz;
                    if (vn < 0) {
                        vx -= 1.35f * vn * nx; vz -= 1.35f * vn * nz;
                        vx *= 0.82f; vz *= 0.82f;
                        shake = Math.min(1, shake + Math.abs(vn) * 0.04f); hit = Math.min(1, Math.abs(vn) * 0.05f);
                        impact = Math.max(impact, Math.abs(vn));
                        if (drift > 0) drift = 0;
                    }
                }
            }
        }
        return impact;
    }
}
