uniform float uKey;        // key light strength (studio > street)
uniform float uGlassPass;  // 1 while drawing the transparent glass
uniform float uLights;     // headlights / tail lights on
uniform float uBrake;
varying vec3 vN;
varying vec3 vWP;
varying vec2 vUV;
varying vec3 vCol;
varying vec4 vPar;

/* Procedural PBR-ish car materials: carbon twill, stitched leather, tyre tread, drilled discs, HUD screens, LED lights, grille. */
void main(){
    vec3 v = normalize(uEye - vWP);
    vec3 n = normalize(vN);
    if (dot(n, v) < 0.0) n = -n;
    float rough = vPar.x, metal = vPar.y, em = vPar.z, pat = vPar.w;
    vec3 base = vCol;
    vec2 uv = vUV;
    float emis = em;
    if (pat > 0.5 && pat < 1.5) {            // carbon fibre twill
        vec2 q = uv * 60.0;
        float a = mod(floor(q.x) + floor(q.y), 2.0);
        float w = abs(fract(a > 0.5 ? q.x : q.y) - 0.5);
        base *= 0.55 + 0.9 * (0.4 + 0.6 * w) * (0.7 + 0.3 * a);
        rough = mix(rough, 0.15, a * 0.5);
    } else if (pat > 1.5 && pat < 2.5) {     // leather: grain + accent stitching
        float g = h21(floor(uv * 260.0)) * 0.12;
        base *= 0.9 + g;
        float st = (1.0 - smoothstep(0.0, 0.04, abs(fract(uv.y * 6.0) - 0.5))) * step(0.5, fract(uv.x * 90.0));
        base = mix(base, uNeonB * 0.9, st * 0.8);
    } else if (pat > 2.5 && pat < 3.5) {     // tyre: tread blocks on the crown, lettering band on the sidewall
        float crown = smoothstep(0.30, 0.38, uv.y) * (1.0 - smoothstep(0.62, 0.70, uv.y));
        float groove = step(0.82, fract(uv.x + (uv.y - 0.5) * 3.0)) + step(0.92, fract(uv.y * 5.0));
        base *= 1.0 - crown * clamp(groove, 0.0, 1.0) * 0.7;
        float side = 1.0 - crown;
        float letters = side * step(0.6, h21(vec2(floor(uv.x * 12.0), floor(uv.y * 9.0)))) * step(0.12, uv.y) * step(uv.y, 0.22);
        base += vec3(0.08) * letters;
        rough = 0.9;
    } else if (pat > 3.5 && pat < 4.5) {     // HUD screen
        vec2 q = uv;
        float bars = step(0.5, fract(q.x * 18.0)) * step(q.y, 0.25 + 0.6 * h21(vec2(floor(q.x * 18.0), floor(uTime * 2.0))));
        float ring = smoothstep(0.02, 0.0, abs(length((q - vec2(0.22, 0.5)) * vec2(3.0, 1.0)) - 0.32));
        float scan = 0.85 + 0.15 * sin(q.y * 300.0);
        base = (uNeonA * (0.25 + ring * 1.2) + uNeonB * bars * 0.6) * scan;
        emis = 1.0;
    } else if (pat > 4.5 && pat < 5.5) {     // drilled + slotted brake disc
        vec2 q = vec2(uv.x * 48.0, uv.y * 3.0);
        float hole = 1.0 - smoothstep(0.18, 0.24, length(fract(q) - 0.5));
        base *= 1.0 - hole * 0.85;
        base += vec3(0.04) * step(0.97, fract(uv.x * 12.0 + uv.y));
    } else if (pat > 5.5 && pat < 6.5) {     // segmented tail light bar
        float seg = step(0.18, fract(uv.x * 46.0));
        emis = em * seg * (uLights * 0.8 + uBrake * 1.6 + 0.15);
    } else if (pat > 6.5 && pat < 7.5) {     // LED headlight dots
        vec2 q = fract(uv * vec2(90.0, 30.0)) - 0.5;
        float led = 1.0 - smoothstep(0.2, 0.35, length(q));
        base = mix(base * 0.35, base, led);
        emis = em * (0.25 + 0.95 * uLights) * (0.4 + 0.6 * led);
    } else if (pat > 7.5 && pat < 8.5) {     // hexagonal grille
        vec2 q = uv * vec2(60.0, 34.0);
        q.x += step(1.0, mod(floor(q.y), 2.0)) * 0.5;
        float hex = smoothstep(0.32, 0.4, length(fract(q) - 0.5));
        base *= 0.15 + 0.85 * hex;
    } else if (pat > 8.5 && pat < 9.5) {     // neon: gentle pulse
        emis = em * (0.85 + 0.15 * sin(uTime * 2.2 + vWP.x * 2.0));
    } else if (pat > 9.5) {                  // carpet
        base *= 0.8 + 0.3 * h21(floor(uv * 400.0));
    }
    vec3 L = normalize(vec3(0.35, 0.8, 0.45));
    float diff = max(dot(n, L), 0.0);
    vec3 amb = uFog * 0.7 + uSkyTop * 0.6 + vec3(0.035) + (n.y * 0.5 + 0.5) * vec3(0.05, 0.05, 0.07);
    amb += uKey * 0.22 * (n.y * 0.5 + 0.5) + uKey * 0.08;            // soft studio / street fill
    vec3 r = reflect(-v, n);
    float band = smoothstep(0.75, 1.0, sin(r.x * 9.0 + r.z * 5.0 + r.y * 3.0) * 0.5 + 0.5);
    vec3 env = mix(uFog * 1.2 + vec3(0.02), uSkyTop * 1.4 + vec3(0.05, 0.06, 0.09), smoothstep(-0.3, 0.6, r.y));
    env += mix(uNeonA, uNeonB, step(0.0, r.x)) * band * 0.55 + vec3(0.9, 0.85, 0.8) * smoothstep(0.985, 1.0, dot(r, L)) * 2.0;
    env += vec3(0.85, 0.9, 1.0) * uKey * 0.5 * smoothstep(0.75, 0.9, r.y) * (0.6 + 0.4 * step(0.5, fract(r.x * 2.5 + 0.25)));  // overhead softboxes
    float ndv = max(dot(n, v), 0.0);
    float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    vec3 F0 = mix(vec3(0.04), base, metal);
    float shin = mix(220.0, 6.0, rough);
    float spec = pow(max(dot(reflect(-L, n), v), 0.0), shin) * (1.0 - rough) * 1.6;
    vec3 col = base * (1.0 - metal) * (amb + diff * uKey * 0.9);
    col += env * mix(vec3(fres), base, metal) * (1.0 - rough * 0.8);
    col += spec * mix(vec3(1.0), base, metal) * uKey;
    col += base * emis * 2.4;
    col += vec3(0.6, 0.65, 0.8) * uFlash * 0.25;
    col = applyFog(col, length(uEye - vWP), vWP.y);
    float alpha = 1.0;
    if (uGlassPass > 0.5) alpha = clamp(0.22 + 0.7 * fres + spec * 0.5, 0.0, 0.92);
    gl_FragColor = vec4(col, alpha);
}
