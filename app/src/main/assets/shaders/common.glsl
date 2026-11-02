#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uTime;
uniform float uL;
uniform float uFogDen;
uniform vec3 uEye;
uniform vec3 uFog;
uniform vec3 uSkyTop;
uniform vec3 uWinA;
uniform vec3 uWinB;
uniform vec3 uWinC;
uniform vec3 uNeonA;
uniform vec3 uNeonB;
uniform float uFlash;   // lightning

float h21(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return v;
}

/* Integer id from an interpolated per-vertex seed: varyings are not bit-exact,
   so hashing the raw float produces per-pixel noise. */
float sid(float s){ return floor(s * 251.0 + 0.5); }

/* Exponential fog plus a hard fade near the end of the wrapped city chunk,
   so buildings re-entering at the horizon never pop. */
float fogAmount(float d){
    float f = 1.0 - exp(-d * uFogDen);
    return max(f, smoothstep(uL * 0.60, uL * 0.84, d));
}
vec3 applyFog(vec3 col, float d, float y){
    float f = fogAmount(d);
    vec3 fc = uFog * (1.0 + 0.35 * exp(-max(y, 0.0) * 0.02)) + vec3(0.55, 0.6, 0.8) * uFlash;
    return mix(col, fc, f);
}
