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
            float rpmT = sim.rpm, loadT = sim.load, boostT = sim.boostLvl;
            float gainT = (muted || sim.off || rpmT < 200) ? 0 : volume;
            for (int i = 0; i < frames; i++) buf[i] = (short) (sample(rpmT, loadT, boostT, gainT) * 32000);
            track.write(buf, 0, frames);
        }
        try { track.stop(); } catch (Exception ignored) { }
        track.release(); track = null;
    }

    private float sample(float rpmT, float loadT, float boostT, float gainT) {
        rpm += (rpmT - rpm) * 0.0016f; load += (loadT - load) * 0.002f; boost += (boostT - boost) * 0.0008f; gain += (gainT - gain) * 0.0005f;
        ph += rpm / 60.0 * 4 / sr;
        if (ph >= 1) { ph -= 1; cyl = (cyl + 1) & 7; amp = PAT[cyl] * (0.42f + 0.58f * load) * (0.9f + 0.2f * (noise() * 0.5f + 0.5f)); }
        float p = (float) ph, a = amp;
        float x = a * (float) (Math.exp(-p * 6) - Math.exp(-p * 38)) * 1.6f;
        x += noise() * a * (float) Math.exp(-p * 4) * (0.12f + 0.4f * load);
        float fc = Math.min(sr * 0.2f, 110 + rpm * 0.085f + load * 1100);
        float f1 = 2 * (float) Math.sin(Math.PI * fc / sr);
        low += f1 * band; float high = x - low - 0.55f * band; band += f1 * high;
        low2 += (x - low2) * (float) (2 * Math.PI * 70 / sr);
        float y = low * 0.85f + band * 0.35f + low2 * 1.4f;
        tph += (2200 + rpm * 0.55) / sr; if (tph > 1) tph -= 1;
        y += (float) Math.sin(tph * 6.2831853) * 0.035f * boost * (0.3f + load);
        hiss += (noise() - hiss) * 0.25f; y += hiss * 0.03f * boost * (1 - load);
        if (popEnv < 0.05f && popQ > 0 && popGap <= 0) { popQ--; popEnv = 0.6f + 0.4f * popAmp; popPh = 0; popGap = (int) (sr * 0.025f); if (popQ == 0) popAmp = 0; }
        if (popGap > 0) popGap--;
        if (popEnv > 0.001f) {
            popPh += 85.0 / sr;
            y += popEnv * (noise() * 0.9f + (float) Math.sin(popPh * 6.2831853) * 0.9f);
            popEnv *= 1 - 32f / sr;
        }
        return (float) Math.tanh(y * 1.1f) * gain;
    }
}
