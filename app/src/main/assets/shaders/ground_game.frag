uniform float uCamX;
uniform float uCamZ;
uniform float uPitch;   // block pitch (road every uPitch metres)
uniform float uRoad;    // road width
varying vec3 vWP;

/* Game ground: a grid of wet neon streets with lanes, crossings and sidewalks. */
void main(){
    float vDist = length(vWP - uEye);
    vec2 w = vWP.xz + vec2(uCamX, uCamZ);                 // world position on the torus
    vec2 q = mod(w + uPitch * 0.5, uPitch) - uPitch * 0.5; // distance to the nearest road axis (signed)
    vec2 a = abs(q);
    float hr = uRoad * 0.5;
    float onX = step(a.x, hr), onZ = step(a.y, hr);   // inside a road running along z / along x
    float road = max(onX, onZ);
    float inter = onX * onZ;
    vec3 col = vec3(0.012, 0.014, 0.02);
    // sidewalks and block floor
    float walk = 1.0 - road;
    vec2 tl = abs(fract(w * 0.5) - 0.5);
    col += walk * (vec3(0.028, 0.03, 0.042) + 0.012 * step(0.47, max(tl.x, tl.y)));
    // curb neon lines
    float curb = max(onX * (1.0 - onZ) * exp(-abs(a.x - hr) * 4.0), onZ * (1.0 - onX) * exp(-abs(a.y - hr) * 4.0));
    col += uNeonA * curb * 0.5;
    // centre double line and dashed lanes (not inside crossings)
    float alongZ = onX * (1.0 - onZ), alongX = onZ * (1.0 - onX);
    float centre = alongZ * (1.0 - smoothstep(0.08, 0.16, abs(a.x - 0.25))) + alongX * (1.0 - smoothstep(0.08, 0.16, abs(a.y - 0.25)));
    col += vec3(1.0, 0.75, 0.25) * centre * 0.35;
    float lane = alongZ * (1.0 - smoothstep(0.06, 0.14, abs(a.x - 4.6))) * step(0.5, fract(w.y / 6.0))
               + alongX * (1.0 - smoothstep(0.06, 0.14, abs(a.y - 4.6))) * step(0.5, fract(w.x / 6.0));
    col += vec3(0.7, 0.75, 0.85) * lane * 0.22;
    // zebra crossings at the edge of each intersection
    float zx = onX * step(hr, a.y) * step(a.y, hr + 3.0) * step(0.5, fract(w.x * 0.8));
    float zz = onZ * step(hr, a.x) * step(a.x, hr + 3.0) * step(0.5, fract(w.y * 0.8));
    col += vec3(0.6, 0.62, 0.7) * max(zx, zz) * 0.18;
    // wet asphalt: neon streak reflections
    // streaks run along the road: thin across, long and slowly varying along
    float nz = h21(vec2(floor(w.x * 0.8), floor(w.y / 26.0)));
    float nx = h21(vec2(floor(w.y * 0.8) + 91.0, floor(w.x / 26.0)));
    float n = alongZ > 0.5 ? nz : nx;
    float along = alongZ > 0.5 ? w.y : w.x;
    float streak = pow(n, 6.0) * road * (0.55 + 0.45 * sin(along * 0.07 + n * 40.0));
    col += mix(uNeonA, uNeonB, fract(n * 7.0)) * streak * 0.5;
    col += uFog * 0.10 * smoothstep(15.0, 300.0, vDist);
    col += vec3(0.5, 0.55, 0.7) * uFlash * 0.15;
    col = applyFog(col, vDist * 0.8, 0.0);
    gl_FragColor = vec4(col, 1.0);
}
