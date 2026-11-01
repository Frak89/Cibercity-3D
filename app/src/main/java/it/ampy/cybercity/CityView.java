package it.ampy.cybercity;

import android.content.Context;
import android.opengl.GLSurfaceView;

import javax.microedition.khronos.egl.EGL10;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.egl.EGLDisplay;

/** GLSurfaceView with 4x MSAA (falls back gracefully) and a render-scale for battery saving. */
public class CityView extends GLSurfaceView {
    public final CityRenderer renderer;
    private int scalePct;

    public CityView(Context c, Prefs p) {
        super(c);
        setEGLContextClientVersion(2);
        setEGLConfigChooser(new Chooser());
        setPreserveEGLContextOnPause(true);
        renderer = new CityRenderer(c, p.snapshot());
        setRenderer(renderer);
        setRenderMode(RENDERMODE_CONTINUOUSLY);
        scalePct = p.quality();
    }

    public void reload(Prefs p) {
        renderer.setConfig(p.snapshot());
        if (p.quality() != scalePct) { scalePct = p.quality(); applyScale(getWidth(), getHeight()); }
    }

    @Override protected void onSizeChanged(int w, int h, int ow, int oh) {
        super.onSizeChanged(w, h, ow, oh);
        applyScale(w, h);
    }
    private void applyScale(int w, int h) {
        if (w <= 0 || h <= 0) return;
        if (scalePct >= 100) getHolder().setSizeFromLayout();
        else getHolder().setFixedSize(Math.max(1, w * scalePct / 100), Math.max(1, h * scalePct / 100));
    }

    static final class Chooser implements EGLConfigChooser {
        private static final int EGL_OPENGL_ES2_BIT = 4;
        @Override public EGLConfig chooseConfig(EGL10 egl, EGLDisplay d) {
            int[][] attempts = {
                {EGL10.EGL_RED_SIZE, 8, EGL10.EGL_GREEN_SIZE, 8, EGL10.EGL_BLUE_SIZE, 8, EGL10.EGL_DEPTH_SIZE, 24,
                    EGL10.EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT, EGL10.EGL_SAMPLE_BUFFERS, 1, EGL10.EGL_SAMPLES, 4, EGL10.EGL_NONE},
                {EGL10.EGL_RED_SIZE, 8, EGL10.EGL_GREEN_SIZE, 8, EGL10.EGL_BLUE_SIZE, 8, EGL10.EGL_DEPTH_SIZE, 16,
                    EGL10.EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT, EGL10.EGL_NONE},
                {EGL10.EGL_RED_SIZE, 5, EGL10.EGL_GREEN_SIZE, 6, EGL10.EGL_BLUE_SIZE, 5, EGL10.EGL_DEPTH_SIZE, 16,
                    EGL10.EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT, EGL10.EGL_NONE},
            };
            for (int[] a : attempts) {
                int[] n = new int[1];
                if (egl.eglChooseConfig(d, a, null, 0, n) && n[0] > 0) {
                    EGLConfig[] cs = new EGLConfig[n[0]];
                    egl.eglChooseConfig(d, a, cs, n[0], n);
                    return cs[0];
                }
            }
            throw new IllegalArgumentException("No EGL config");
        }
    }
}
