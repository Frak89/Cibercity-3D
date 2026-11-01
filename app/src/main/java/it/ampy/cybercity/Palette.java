package it.ampy.cybercity;

/** Atmospheres. Values are identical to web/cybercity.js. */
public final class Palette {
    public static final String[] KEYS = {"neon", "blade", "matrix", "synthwave", "bloodmoon", "glass"};
    public static final String[] NAMES = {"NEON TOKYO", "BLADE RUNNER", "MATRIX", "SYNTHWAVE", "BLOOD MOON", "FUTURISTIC GLASS"};

    public final String key, name;
    public final float[] fog, top, winA, winB, winC, neonA, neonB, sun, sunDir;
    public final float stripes, fogDen;

    private Palette(String key, String name, float[] fog, float[] top, float[] winA, float[] winB, float[] winC,
                    float[] neonA, float[] neonB, float[] sun, float[] sunDir, float stripes, float fogDen) {
        this.key = key; this.name = name; this.fog = fog; this.top = top; this.winA = winA; this.winB = winB; this.winC = winC;
        this.neonA = neonA; this.neonB = neonB; this.sun = sun; this.sunDir = sunDir; this.stripes = stripes; this.fogDen = fogDen;
    }
    private static float[] v(float a, float b, float c) { return new float[]{a, b, c}; }

    public static Palette of(String k) {
        switch (k == null ? "" : k) {
            case "blade": return new Palette("blade", "BLADE RUNNER", v(.42f,.19f,.06f), v(.06f,.025f,.012f), v(1f,.62f,.25f), v(.3f,.85f,.85f), v(1f,.85f,.6f), v(.1f,.95f,.9f), v(1f,.45f,.1f), v(1f,.6f,.25f), v(-.2f,.18f,1f), 0, .0085f);
            case "matrix": return new Palette("matrix", "MATRIX", v(.02f,.11f,.05f), v(0f,.015f,.005f), v(.35f,1f,.45f), v(.6f,1f,.6f), v(.15f,.7f,.3f), v(.2f,1f,.4f), v(.6f,1f,.2f), v(.5f,1f,.6f), v(.3f,.4f,1f), 0, .007f);
            case "synthwave": return new Palette("synthwave", "SYNTHWAVE", v(.36f,.08f,.3f), v(.03f,.01f,.09f), v(1f,.55f,.85f), v(.4f,.85f,1f), v(1f,.85f,.4f), v(1f,.25f,.8f), v(.25f,.85f,1f), v(1f,.8f,.25f), v(0f,.1f,1f), 1, .0058f);
            case "bloodmoon": return new Palette("bloodmoon", "BLOOD MOON", v(.2f,.02f,.04f), v(.025f,0f,.006f), v(1f,.35f,.3f), v(1f,.7f,.3f), v(1f,.15f,.3f), v(1f,.17f,.3f), v(1f,.69f,0f), v(1f,.15f,.12f), v(-.3f,.35f,1f), 0, .0068f);
            case "glass": return new Palette("glass", "FUTURISTIC GLASS", v(.08f,.14f,.26f), v(.01f,.015f,.05f), v(.75f,.9f,1f), v(.6f,.9f,1f), v(.78f,.6f,1f), v(.6f,.9f,1f), v(.78f,.59f,1f), v(.85f,.95f,1f), v(.2f,.3f,1f), 0, .006f);
            default: return new Palette("neon", "NEON TOKYO", v(.17f,.08f,.26f), v(.012f,.008f,.035f), v(1f,.72f,.42f), v(.35f,.9f,1f), v(1f,.3f,.82f), v(0f,1f,.89f), v(1f,.23f,.78f), v(.9f,.85f,1f), v(.25f,.32f,1f), 0, .0062f);
        }
    }

    public static int argb(float[] c) {
        return 0xff000000 | (Math.round(Math.min(1, c[0]) * 255) << 16) | (Math.round(Math.min(1, c[1]) * 255) << 8) | Math.round(Math.min(1, c[2]) * 255);
    }
    public static int index(String k) { for (int i = 0; i < KEYS.length; i++) if (KEYS[i].equals(k)) return i; return 0; }
}
