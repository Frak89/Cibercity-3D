varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
varying vec2 vMode;
varying float vFade;
varying vec3 vLoc;
uniform float uPortal;   // KAGE NEXUS membrane: 0 closed → 1 fully open
uniform float uBlur;     // rotor speed → blades blur into the disc
uniform float uLit;      // 1 normal, >1 brighter (garage)
uniform float uDay;      // 0 night city, 1 daylight
uniform vec3 uTint;      // race gates: tint for slot 3 (x < 0 → keep)
uniform float uGlowOnly; // light beams / bolts: emissive only, soft edges
uniform float uShadow;   // ECO doppelgänger: black body, red glow
void main(){
    float mode = vMode.x, slot = vMode.y;
    float dz = h21(gl_FragCoord.xy * 0.731 + fract(uTime) * 13.0);
    if (mode > 5.5 && mode < 6.5) { if (dz > uBlur * 0.32) discard; }
    else if (mode > 0.5 && mode < 2.5) { if (dz < uBlur * 0.75) discard; }
    vec3 N = normalize(vN), V = normalize(uEye - vWP);
    if (slot > 4.5 && slot < 5.5) {           // the living membrane of the portal
        float r = length(vLoc.xy - vec2(0.0, 7.0)) / 6.55;
        if (r > uPortal) discard;
        vec2 q = vLoc.xy * 0.35; float tt = uTime;
        float ring = sin(r * 22.0 - tt * 3.2) * 0.5 + 0.5;
        float nn = fbm(q * 2.0 + vec2(tt * 0.3, -tt * 0.21) + vec2(sin(r * 6.0 - tt), cos(r * 5.0 + tt)) * 0.4);
        vec2 cell = floor(vLoc.xy * 2.5);
        float gl = step(0.94, h21(cell + floor(tt * 9.0))) * (0.4 + 0.6 * step(0.5, h21(cell * 1.7 + floor(tt * 23.0))));
        vec3 c = mix(uNeonA * 0.18, uNeonA * 1.25 + vec3(0.25), clamp(nn * nn * 1.4 + ring * 0.22, 0.0, 1.0));
        c += vec3(0.75, 1.0, 0.9) * gl * 0.7 + uNeonB * pow(nn, 6.0) * 0.8;
        c += vec3(1.0) * smoothstep(uPortal - 0.1, uPortal, r) * 1.3 + uNeonA * (1.0 - smoothstep(0.0, 0.25, r)) * 0.6;
        gl_FragColor = vec4(applyFog(c, length(vWP - uEye) * 0.6, vWP.y), 1.0); return;
    }
    if (uGlowOnly > 0.5) {
        float face = abs(dot(N, V));
        vec3 g = vCol.rgb * vCol.a * (0.25 + 0.75 * face) * (1.0 - fogAmount(length(vWP - uEye)) * 0.9);
        gl_FragColor = vec4(g, 1.0); return;
    }
    if (dot(N, V) < 0.0) N = -N;
    vec3 base = vCol.rgb;
    if (uTint.x >= 0.0 && slot > 2.5 && slot < 3.5) base = uTint;
    bool skinS = slot > 5.5 && slot < 6.5, hairS = slot > 6.5;
    float gloss = slot < 0.5 ? 0.25 : slot < 1.5 ? 0.75 : slot < 2.5 ? 0.55 : slot < 3.5 ? 0.3 : skinS ? 0.12 : hairS ? 0.18 : 1.0;
    vec3 L = normalize(vec3(0.35, 0.75, -0.45));
    vec3 keyC = mix(vec3(0.42, 0.46, 0.62), vec3(1.25, 1.15, 1.0), uDay);
    float dif = max(dot(N, L), 0.0);
    vec3 amb = (uFog * 0.9 + vec3(0.035, 0.04, 0.055)) * (0.55 + 0.45 * N.y) + uNeonA * 0.10 * max(-N.y, 0.0) + uNeonB * 0.06 * max(N.x, 0.0);
    amb = mix(amb, vec3(0.45, 0.5, 0.6) * (0.6 + 0.4 * N.y), uDay);
    vec3 R = reflect(-V, N);
    vec3 env = mix(uFog * 1.25 + vec3(0.02), uSkyTop * 2.5 + uNeonB * 0.04, clamp(R.y * 1.6, 0.0, 1.0));
    float hz = pow(1.0 - abs(R.y), 10.0);
    env += mix(uWinA, uNeonA, step(0.5, fract(floor(atan(R.x, R.z) * 9.0) * 0.37))) * hz * 0.35;
    env = mix(env, vec3(0.6, 0.72, 0.9) * (0.5 + 0.5 * R.y), uDay);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float spec = pow(max(dot(R, L), 0.0), slot > 3.5 ? 120.0 : 50.0);
    bool glassS = slot > 3.5 && slot < 4.5;
    vec3 col;
    if (skinS) {
        // skin: wrapped diffuse, warm light bleeding through in the shadows, soft wide highlight
        float wrapD = max((dot(N, L) + 0.45) / 1.45, 0.0);
        vec3 ambS = mix(amb, vec3(dot(amb, vec3(0.333))) + 0.02, 0.65);
        col = base * (wrapD * mix(keyC, vec3(1.0, 0.95, 0.9) * length(keyC) * 0.6, 0.5) * 1.05 + ambS * 1.25) + base * vec3(0.32, 0.1, 0.06) * (1.0 - dif) * 0.35;
        col += keyC * pow(max(dot(R, L), 0.0), 18.0) * 0.05 + env * fres * 0.08 + uNeonA * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.06;
    } else if (hairS) {
        // hair: darker diffuse with a soft sheen across the strands
        vec3 Hh = normalize(L + V);
        float sheen = pow(1.0 - abs(dot(N, Hh)), 6.0);
        col = base * (dif * keyC * 0.7 + amb) + base * keyC * sheen * 0.45 + keyC * pow(max(dot(N, Hh), 0.0), 40.0) * 0.06;
    } else {
        col = base * (dif * keyC * 0.85 + amb) * (glassS ? 0.3 : 1.0);
        col += env * fres * gloss * (glassS ? 1.6 : 1.0) + keyC * spec * gloss * 0.7;
    }
    col *= max(uLit, 1.0);
    col += base * vCol.a * 1.7;
    if (uShadow > 0.5) col = vec3(0.004) + env * fres * 0.15 + vec3(1.0, 0.04, 0.12) * vCol.a * 1.4;
    float vDist = length(vWP - uEye);
    col = applyFog(col, vDist, vWP.y);
    gl_FragColor = vec4(col, 1.0);
}
