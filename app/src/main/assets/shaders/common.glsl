#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uTime;
uniform float uL;
uniform float uFar;    // distance where everything has faded into the fog
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
    return max(f, smoothstep(uFar * 0.60, uFar * 0.84, d));
}
vec3 applyFog(vec3 col, float d, float y){
    float f = fogAmount(d);
    vec3 fc = uFog * (1.0 + 0.35 * exp(-max(y, 0.0) * 0.02)) + vec3(0.55, 0.6, 0.8) * uFlash;
    return mix(col, fc, f);
}

/* headlight beams on the ground: uHL = (nose x, nose z, forward x, forward z) in the frame of vWP */
uniform vec4 uHL;
uniform float uHLOn;
vec3 headLight(vec3 wp){
    if (uHLOn < 0.01) return vec3(0.0);
    vec2 d = wp.xz - uHL.xy, f = normalize(uHL.zw + 1e-6), r = vec2(-f.y, f.x);
    float along = dot(d, f), lat = dot(d, r), w = 0.45 + max(along, 0.0) * 0.26;
    float cone = max(smoothstep(w, 0.0, abs(lat - 0.62)), smoothstep(w, 0.0, abs(lat + 0.62)));
    float fall = smoothstep(0.3, 3.5, along) * exp(-max(along, 0.0) * 0.032) * (1.0 - smoothstep(55.0, 85.0, along));
    float pool = exp(-dot(d - f * 2.2, d - f * 2.2) * 0.35) * 0.35;           // spill right in front of the bumper
    return vec3(1.0, 0.95, 0.86) * (cone * fall * 1.25 + pool) * uHLOn;
}

/* harbour district of the game city (lagoon with islands + lighthouse). uHarbor = lagoon x0, z0, x1, z1 (world); x1 <= x0 → none */
uniform vec4 uHarbor;
uniform vec2 uCanal;    // screensaver canal: x range of the water (y <= x → none)
uniform float uPitch;   // block pitch (road every uPitch metres)
uniform float uRoad;    // road width
float harborWater(vec2 w){
    if (uHarbor.z <= uHarbor.x) return 0.0;
    if (w.x < uHarbor.x || w.x > uHarbor.z || w.y < uHarbor.y || w.y > uHarbor.w) return 0.0;
    vec2 c = (uHarbor.xy + uHarbor.zw) * 0.5;
    if (length(w - c) < 11.0) return 0.0;                          // lighthouse islet
    vec2 b0 = floor(uHarbor.xy / uPitch), b1 = floor(uHarbor.zw / uPitch);
    vec2 b = floor(w / uPitch), l = w - b * uPitch - uRoad * 0.5, in_ = vec2(uPitch - uRoad);
    bool ringX = b.x < b0.x + 0.5 || b.x > b1.x - 0.5, ringZ = b.y < b0.y + 0.5 || b.y > b1.y - 0.5;
    bool cornerX = b.x < b0.x + 1.5 || b.x > b1.x - 1.5, cornerZ = b.y < b0.y + 1.5 || b.y > b1.y - 1.5;
    bool island = ringX || ringZ || (cornerX && cornerZ);
    if (!island) return 1.0;
    float sW = (ringX && b.x < b0.x + 0.5) ? 0.0 : 6.0, sE = (ringX && b.x > b1.x - 0.5) ? 0.0 : 6.0;
    float sS = (ringZ && b.y < b0.y + 0.5) ? 0.0 : 6.0, sN = (ringZ && b.y > b1.y - 0.5) ? 0.0 : 6.0;
    if (l.x >= sW && l.x <= in_.x - sE && l.y >= sS && l.y <= in_.y - sN) return 0.0;
    return 1.0;
}
