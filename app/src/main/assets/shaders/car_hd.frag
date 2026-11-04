uniform float uKey;        // key light strength (studio > street)
uniform float uGlassPass;  // 1 while drawing the transparent glass
uniform float uLights;     // headlights / tail lights on
uniform float uBrake;
uniform float uSpd;        // live data for the instrument cluster: km/h
uniform float uRpmK;       // rpm / limiter
uniform float uGear;       // -2 E, -1 N, 0.. gear index
uniform float uFuelK;      // tank 0..1
uniform float uGx;         // longitudinal g
/* 7-segment digit d in a 1×2 cell (p in 0..1 × 0..2) */
float seg7(vec2 p, float d){
    float on = 0.0;
    // segments a b c d e f g as bit flags of the digit
    float bits = d < 0.5 ? 63.0 : d < 1.5 ? 6.0 : d < 2.5 ? 91.0 : d < 3.5 ? 79.0 : d < 4.5 ? 102.0 : d < 5.5 ? 109.0 : d < 6.5 ? 125.0 : d < 7.5 ? 7.0 : d < 8.5 ? 127.0 : d < 9.5 ? 111.0 : 121.0;  // 10 = E
    float w = 0.16;
    float a = step(abs(p.y - 1.9), w) * step(abs(p.x - 0.5), 0.36);
    float g = step(abs(p.y - 1.0), w) * step(abs(p.x - 0.5), 0.36);
    float dd = step(abs(p.y - 0.1), w) * step(abs(p.x - 0.5), 0.36);
    float f = step(abs(p.x - 0.1), w) * step(abs(p.y - 1.45), 0.42);
    float b = step(abs(p.x - 0.9), w) * step(abs(p.y - 1.45), 0.42);
    float e = step(abs(p.x - 0.1), w) * step(abs(p.y - 0.55), 0.42);
    float c = step(abs(p.x - 0.9), w) * step(abs(p.y - 0.55), 0.42);
    on += a * mod(bits, 2.0);
    on += b * mod(floor(bits / 2.0), 2.0);
    on += c * mod(floor(bits / 4.0), 2.0);
    on += dd * mod(floor(bits / 8.0), 2.0);
    on += e * mod(floor(bits / 16.0), 2.0);
    on += f * mod(floor(bits / 32.0), 2.0);
    on += g * mod(floor(bits / 64.0), 2.0);
    return clamp(on, 0.0, 1.0);
}
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
    } else if (pat > 3.5 && pat < 4.5) {     // displays: uv.x 0..1 instrument cluster, 2..3 navigation map
        float scan = 0.9 + 0.1 * sin(uv.y * 400.0);
        vec3 c = vec3(0.004, 0.008, 0.015);
        if (uv.x < 1.5) {
            vec2 q = vec2(uv.x * 4.2, uv.y);                       // display is ~4:1
            for (int g = 0; g < 2; g++) {                          // tachometer (left) and speed (right) dials
                vec2 cc = vec2(g == 0 ? 0.85 : 3.35, 0.5), d = q - cc;
                float r = length(d), a = atan(d.x, -d.y);           // 0 at the bottom
                float val = g == 0 ? clamp(uRpmK, 0.0, 1.0) : clamp(uSpd / 360.0, 0.0, 1.0);
                float ang = (a + 3.14159) / 6.28318;
                float arc = smoothstep(0.04, 0.0, abs(r - 0.40)) * step(0.12, ang) * step(ang, 0.88);
                float lit = arc * step(ang, 0.12 + 0.76 * val);
                float tick = smoothstep(0.03, 0.0, abs(r - 0.33)) * step(0.85, fract(ang * 20.0)) * step(0.12, ang) * step(ang, 0.88);
                float red = step(0.75, ang);
                c += uNeonA * arc * 0.18 + mix(uNeonA, vec3(1.0, 0.15, 0.25), red) * lit * 0.9 + vec3(0.6) * tick * 0.5;
                c += uNeonA * smoothstep(0.30, 0.0, r) * 0.08;
            }
            // centre: live speed (3 digits), gear, fuel bar, g-meter
            float spd = floor(clamp(uSpd, 0.0, 999.0) + 0.5);
            for (int k = 0; k < 3; k++) {
                float dv = k == 0 ? floor(spd / 100.0) : k == 1 ? floor(mod(spd, 100.0) / 10.0) : mod(spd, 10.0);
                vec2 cp = (q - vec2(1.62 + float(k) * 0.30, 0.30)) / vec2(0.25, 0.25);
                if (cp.x > 0.0 && cp.x < 1.0 && cp.y > 0.0 && cp.y < 2.0 && (k > 0 || spd >= 100.0) && (k > 1 || spd >= 10.0)) c += vec3(0.85, 0.95, 1.0) * seg7(cp, dv) * 1.2;
            }
            float gd = uGear < -1.5 ? 10.0 : uGear < -0.5 ? 0.0 : uGear + 1.0;
            vec2 gp = (q - vec2(1.95, 0.05)) / vec2(0.12, 0.12);
            if (gp.x > 0.0 && gp.x < 1.0 && gp.y > 0.0 && gp.y < 2.0) c += uNeonB * seg7(gp, gd) * 1.3;
            float fb = step(abs(q.y - 0.92), 0.03) * step(1.6, q.x) * step(q.x, 1.6 + 0.9 * clamp(uFuelK, 0.0, 1.0));
            c += mix(vec3(1.0, 0.2, 0.2), uNeonA, step(0.15, uFuelK)) * fb * 0.9 + vec3(0.12) * step(abs(q.y - 0.92), 0.03) * step(1.6, q.x) * step(q.x, 2.5);
            float gx = clamp(uGx, -1.5, 1.5);
            c += uNeonA * smoothstep(0.03, 0.0, abs(q.x - (2.75 + 0.02 * 0.0))) * step(abs(q.y - 0.5 - gx * 0.25), 0.05) * 1.5;
        } else {
            vec2 q = vec2(uv.x - 2.0, uv.y) * vec2(3.0, 2.0) + vec2(uTime * 0.05, uTime * 0.12);
            vec2 gr = abs(fract(q * 3.0) - 0.5);
            float road = smoothstep(0.06, 0.0, min(gr.x, gr.y));
            c += vec3(0.05, 0.07, 0.1) * road;
            float route = smoothstep(0.05, 0.0, abs(fract(q.x * 3.0 + 0.5) - 0.5)) * step(0.5, fract(q.y * 1.5));
            c += uNeonB * route * 0.6;
            vec2 me = vec2(uv.x - 2.5, uv.y - 0.35);
            c += uNeonA * smoothstep(0.05, 0.02, length(me * vec2(3.0, 2.0)));
        }
        base = c * scan;
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
    } else if (pat > 10.5) {                 // titanium: heat-tinted (gold → blue → violet) along the pipe
        float k = clamp(uv.x, 0.0, 1.0);
        vec3 heat = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + k * 0.9 + 0.15));
        base = mix(base, heat * 0.7, 0.55 * smoothstep(0.1, 0.9, k));
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
    // crisp horizon line: dark floor below, bright rim just above — gives the body its "liquid" definition
    env = mix(env * 0.35, env, smoothstep(-0.02, 0.02, r.y));
    env += vec3(0.55, 0.6, 0.75) * (uKey * 0.6 + 0.25) * smoothstep(0.0, 0.03, r.y) * (1.0 - smoothstep(0.03, 0.12, r.y));
    // long side softbox strip
    env += vec3(1.0) * uKey * 0.45 * smoothstep(0.86, 0.9, abs(r.x)) * smoothstep(0.05, 0.15, r.y) * (1.0 - smoothstep(0.35, 0.45, r.y));
    float ndv = max(dot(n, v), 0.0);
    float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    vec3 F0 = mix(vec3(0.04), base, metal);
    float shin = mix(220.0, 6.0, rough);
    float spec = pow(max(dot(reflect(-L, n), v), 0.0), shin) * (1.0 - rough) * 1.6;
    // cheap ambient occlusion: darker toward the ground, the sills and inside the wheel arches
    float ao = 0.45 + 0.55 * smoothstep(0.12, 0.62, vWP.y);
    vec3 col = base * (1.0 - metal) * (amb + diff * uKey * 0.9) * ao;
    col += env * mix(vec3(fres), base, metal) * (1.0 - rough * 0.8);
    col += spec * mix(vec3(1.0), base, metal) * uKey;
    // clear coat on painted panels: a second, razor-sharp lobe on top of the base paint
    if (pat < 0.5 && rough < 0.5 && uGlassPass < 0.5) {
        float cc = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
        col += env * cc * 0.9 * ao;
        col += vec3(1.0) * pow(max(dot(reflect(-L, n), v), 0.0), 900.0) * 3.0 * uKey;
    }
    col += base * emis * 2.4;
    col += vec3(0.6, 0.65, 0.8) * uFlash * 0.25;
    col = applyFog(col, length(uEye - vWP), vWP.y);
    float alpha = 1.0;
    if (uGlassPass > 0.5) {                  // tinted glass: you see the cabin, but it clearly is a closed coupé
        col = col * 0.8 + env * (0.10 + fres * 0.9);
        alpha = clamp(0.48 + 0.5 * fres + spec * 0.5, 0.0, 0.95);
    }
    gl_FragColor = vec4(col, alpha);
}
