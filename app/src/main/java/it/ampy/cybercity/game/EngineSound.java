package it.ampy.cybercity.game;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

/** Real-time synthesized twin-turbo V8 (cross-plane burble, exhaust resonance, turbo whistle, backfire pops).
 *  Same synthesizer as EngineSynth in web/engine_fx.js, streamed through an AudioTrack on its own thread. */
final class EngineSound implements Runnable {
    private static final float[] PAT = {1.0f, 0.68f, 0.94f, 0.58f, 0.9f, 0.74f, 1.0f, 0.55f};
    private final EngineSim sim;
    private final int sr = 44100;
    private volatile boolean running = false;
    volatile boolean muted = false;
    volatile float volume = 0.8f;
    private Thread th;
    private AudioTrack track;
    // synth state
    private double ph = 0, tph = 0, popPh = 0;
    private int cyl = 0, popQ = 0, popGap = 0, n = 1;
    private float lump = 1, zap = 0, crk = 0, bp1 = 0;
    private double eph = 0, zph = 0, hum = 0;
    private int synType = 0;
    private float tyreK = 0, burnK = 0, wob = 0; private double sqph = 0; private final float[] tb1 = new float[2], tb2 = new float[2], tb3 = new float[2];
    private boolean race = false; private float chronoK = 0, boom = 0, blp = 0; private double chph = 0, bph = 0;
    private float amp = 0, rpm = EngineSim.IDLE, load = 0, boost = 0, low = 0, band = 0, low2 = 0, hiss = 0, popEnv = 0, popAmp = 0, gain = 0;

    EngineSound(EngineSim s) { sim = s; }

    synchronized void start() {
        if (running) return;
        running = true;
        th = new Thread(this, "EngineSound"); th.setPriority(Thread.MAX_PRIORITY); th.start();
    }
    synchronized void stop() {
        running = false;
        if (th != null) { try { th.join(400); } catch (InterruptedException ignored) { } th = null; }
    }

    private float noise() { n = (int) ((n * 16807L) % 2147483647L); return n / 1073741823.5f - 1; }

    @Override public void run() {
        int min = AudioTrack.getMinBufferSize(sr, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        int frames = 512;
        try {
            track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(sr).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setBufferSizeInBytes(Math.max(min, frames * 2 * 4)).setTransferMode(AudioTrack.MODE_STREAM).build();
        } catch (Exception e) { android.util.Log.e(Gl.TAG, "audio", e); running = false; return; }
        track.play();
        short[] buf = new short[frames];
        float[] ps = new float[1];
        while (running) {
            int pops = sim.takePops(ps);
            if (pops > 0) { popQ += pops; popAmp = Math.max(popAmp, ps[0]); }
            float rpmT = sim.rpm, loadT = sim.load, boostT = sim.boostLvl, spd = sim.speed;
            if (synType != sim.type) { synType = sim.type; rpm = rpmT; }
            race = sim.race; tyreK = sim.tyre; burnK = sim.burn; chronoK = sim.chrono; if (sim.takeBoom() > 0) { boom = 1; bph = 0; }
            float gainT = (muted || sim.off || rpmT < 200) ? 0 : volume;
            for (int i = 0; i < frames; i++) buf[i] = (short) ((synType == 2 ? sampleMag(rpmT, loadT, boostT, gainT) : sample(rpmT, loadT, boostT, gainT, spd)) * 32000);
            track.write(buf, 0, frames);
        }
        try { track.stop(); } catch (Exception ignored) { }
        track.release(); track = null;
    }

    private float sample(float rpmT, float loadT, float boostT, float gainT, float spd) {
        final boolean W = synType == 1;
        rpm += (rpmT - rpm) * (W ? 0.0022f : 0.0016f); load += (loadT - load) * 0.002f; boost += (boostT - boost) * 0.0008f; gain += (gainT - gain) * 0.0005f;
        ph += rpm / 60.0 * 4 / sr;
        if (ph >= 1) {
            ph -= 1; cyl = (cyl + 1) & 7;
            if (W) {
                float lumpy = Math.max(0, 1 - (rpm - 1100) / 2500) * (1 - load);
                if ((cyl & 3) == 0) lump = 1 - lumpy * (0.55f + 0.45f * (noise() * 0.5f + 0.5f));
                amp = (0.5f + 0.5f * load) * lump * (0.95f + 0.1f * (noise() * 0.5f + 0.5f));
            } else amp = PAT[cyl] * (0.42f + 0.58f * load) * (0.9f + 0.2f * (noise() * 0.5f + 0.5f));
        }
        float p = (float) ph, a = amp, x;
        if (W) {
            x = a * (float) (Math.exp(-p * 2.6) - Math.exp(-p * 70)) * 1.25f - a * 0.25f;
            x += noise() * a * (float) Math.exp(-p * 3) * (0.2f + 0.55f * load);
        } else {
            x = a * (float) (Math.exp(-p * 6) - Math.exp(-p * 38)) * 1.6f;
            x += noise() * a * (float) Math.exp(-p * 4) * (0.12f + 0.4f * load);
        }
        if (race) x *= 1.25f;
        float fc = Math.min(sr * 0.22f, (W ? 220 + rpm * 0.13f + load * 1700 : 110 + rpm * 0.085f + load * 1100) * (race ? 1.35f : 1));
        float f1 = 2 * (float) Math.sin(Math.PI * fc / sr);
        low += f1 * band; float high = x - low - (W ? 0.42f : 0.55f) * band; band += f1 * high;
        low2 += (x - low2) * (float) (2 * Math.PI * (W ? 110 : 70) / sr);
        float y = low * 0.85f + band * (W ? 0.5f : 0.35f) * (race ? 1.5f : 1) + low2 * (W ? 0.8f : 1.4f) * (race ? 1.35f : 1);
        tph += (2200 + rpm * 0.55) / sr; if (tph > 1) tph -= 1;
        y += (float) Math.sin(tph * 6.2831853) * 0.035f * boost * (0.3f + load);
        hiss += (noise() - hiss) * 0.25f; y += hiss * 0.03f * boost * (1 - load);
        if (W) { eph += (600 + spd * 95) / sr; if (eph > 1) eph -= 1; y += (float) Math.sin(eph * 6.2831853) * 0.03f * Math.min(1, spd / 20 + load * 0.3f); }
        if (popEnv < 0.05f && popQ > 0 && popGap <= 0) { popQ--; popEnv = 0.6f + 0.4f * popAmp; popPh = 0; popGap = (int) (sr * (W ? 0.018f : 0.025f)); if (popQ == 0) popAmp = 0; }
        if (popGap > 0) popGap--;
        if (popEnv > 0.001f) {
            popPh += (W ? 140.0 : 85.0) / sr;
            y += popEnv * (race ? 1.35f : 1) * (noise() * (W ? 1.1f : 0.9f) + (float) Math.sin(popPh * 6.2831853) * (W ? 0.6f : 0.9f));
            popEnv *= 1 - (W ? 45f : 32f) / sr;
        }
        return (float) Math.tanh(tyreMix(chronoMix(y * (race ? 1.2f : 1))) * 1.1f) * gain;
    }

    private float bp(float[] st, float f, float q, float n) { float f1 = 2 * (float) Math.sin(Math.PI * f / sr); st[0] += f1 * st[1]; float hp = n - st[0] - q * st[1]; st[1] += f1 * hp; return st[1]; }
    /** tyres: noise through two resonances + a wobbling squeal tone; burnout adds a rough low rasp */
    private float tyreMix(float y) {
        float k = tyreK, b = burnK;
        if (k < 0.002f && b < 0.002f) return y;
        float n = noise();
        wob += noise() * 0.5f * 0.002f; wob *= 0.9995f;
        sqph += (820 + 380 * k + 160 * wob + 90 * b) / sr; if (sqph > 1) sqph -= 1;
        float tone = (float) (Math.sin(sqph * 6.2831853) + 0.35 * Math.sin(sqph * 12.566 + 0.4));
        float lvl = (float) Math.pow(Math.max(k, b * 0.8f), 1.2);
        y += (tone * 0.22f * (0.6f + 0.4f * Math.abs(bp(tb1, 1150, 0.25f, n) * 4)) + bp(tb2, 2500, 0.35f, n) * 0.25f) * lvl;
        y += bp(tb3, 520, 0.6f, n) * 0.45f * b;
        return y;
    }

    /** KAGE CHRONO layer: rising whine while charging, boom + crack at the jump */
    private float chronoMix(float y) {
        float k = chronoK;
        if (k > 0.001f) {
            chph += (180 + k * k * 2600) / sr;
            double ph = chph * 6.2831853;
            y += (float) (Math.sin(ph) * 0.6 + Math.sin(ph * 2.01) * 0.25 + Math.sin(ph * 3.03) * 0.15) * k * 0.22f;
        }
        if (boom > 0.0005f) {
            bph += 1.0 / sr;
            float n2 = noise();
            blp += (n2 - blp) * 0.03f;
            y += boom * ((float) Math.sin(bph * 6.2831853 * (38 + 30 * boom)) * 1.1f + blp * 2.5f) + (bph < 0.06 ? n2 * 0.9f * (float) (1 - bph / 0.06) : 0);
            boom *= 1 - 2.2f / sr;
        }
        return y;
    }

    /** LEVITA: electrostatic hum, gliding field whine, crackling micro-discharges, zaps on lift-off */
    private float sampleMag(float rpmT, float loadT, float boostT, float gainT) {
        rpm += (rpmT - rpm) * 0.0012f; load += (loadT - load) * 0.002f; boost += (boostT - boost) * 0.001f; gain += (gainT - gain) * 0.0005f;
        float k = Math.min(1, rpm / 22000);
        hum += 100.0 / sr; if (hum > 1) hum -= 1;
        double h = hum * 6.2831853;
        float buzz = (float) (Math.sin(h) + 0.55 * Math.sin(2 * h + 0.3) + 0.4 * Math.sin(3 * h) + 0.22 * Math.sin(5 * h + 1.1) + 0.12 * Math.sin(7 * h));
        buzz = (float) Math.tanh(buzz * 1.6f) * (0.16f + 0.22f * k + 0.12f * load);
        eph += (180 + rpm * 0.075) / sr; if (eph > 1) eph -= 1;
        zph += (183 + rpm * 0.0756) / sr; if (zph > 1) zph -= 1;
        float whine = (float) (Math.sin(eph * 6.2831853) + Math.sin(zph * 6.2831853 * 2) * 0.4) * (0.03f + 0.10f * k) * (0.6f + 0.4f * load);
        if (noise() * 0.5f + 0.5f < (3 + load * 45 + k * 20) / sr) crk = 0.6f + 0.4f * (noise() * 0.5f + 0.5f);
        float n2 = noise();
        bp1 += (n2 - bp1) * 0.45f; float hp = n2 - bp1;
        float y = buzz + whine + hp * crk * 0.5f + hiss * 0.02f;
        hiss += (n2 - hiss) * 0.1f;
        crk *= 1 - 400f / sr;
        if (zap < 0.05f && popQ > 0 && popGap <= 0) { popQ--; zap = 0.7f + 0.3f * popAmp; popGap = (int) (sr * 0.03f); if (popQ == 0) popAmp = 0; }
        if (popGap > 0) popGap--;
        if (zap > 0.001f) { popPh += (900 + 2400 * zap) / sr; y += zap * (hp * 1.2f + Math.signum((float) Math.sin(popPh * 6.2831853)) * 0.25f); zap *= 1 - 60f / sr; }
        low2 += (y - low2) * 0.5f;
        return (float) Math.tanh(chronoMix(low2) * 1.3f) * gain;
    }
}
