varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
varying vec2 vMode;
varying float vFade;
uniform float uBlur;     // rotor speed → blades blur into the disc
uniform float uLit;      // 1 normal, >1 brighter (garage)
uniform float uDay;      // 0 night city, 1 daylight
uniform vec3 uTint;      // race gates: tint for slot 3 (x < 0 → keep)
uniform float uGlowOnly; // light beams / bolts: emissive only, soft edges
void main(){
    float mode = vMode.x, slot = vMode.y;
    float dz = h21(gl_FragCoord.xy * 0.731 + fract(uTime) * 13.0);
    if (mode > 5.5 && mode < 6.5) { if (dz > uBlur * 0.32) discard; }
    else if (mode > 0.5 && mode < 2.5) { if (dz < uBlur * 0.75) discard; }
    vec3 N = normalize(vN), V = normalize(uEye - vWP);
    if (uGlowOnly > 0.5) {
        float face = abs(dot(N, V));
        vec3 g = vCol.rgb * vCol.a * (0.25 + 0.75 * face) * (1.0 - fogAmount(length(vWP - uEye)) * 0.9);
        gl_FragColor = vec4(g, 1.0); return;
    }
    if (dot(N, V) < 0.0) N = -N;
    vec3 base = vCol.rgb;
    if (uTint.x >= 0.0 && slot > 2.5 && slot < 3.5) base = uTint;
    float gloss = slot < 0.5 ? 0.25 : slot < 1.5 ? 0.75 : slot < 2.5 ? 0.55 : slot < 3.5 ? 0.3 : 1.0;
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
    vec3 col = base * (dif * keyC * 0.85 + amb) * (slot > 3.5 ? 0.3 : 1.0);
    col += env * fres * gloss * (slot > 3.5 ? 1.6 : 1.0) + keyC * spec * gloss * 0.7;
    col *= max(uLit, 1.0);
    col += base * vCol.a * 1.7;
    float vDist = length(vWP - uEye);
    col = applyFog(col, vDist, vWP.y);
    gl_FragColor = vec4(col, 1.0);
}
