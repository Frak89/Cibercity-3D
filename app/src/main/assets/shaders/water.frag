/* Neon harbour water: dark, rippled, mirroring the sky, the fog glow and the city lights. */
varying vec3 vWP;
uniform float uCamX;
uniform float uCamZ;
uniform vec4 uWake;     // player wake: x, z (frame of vWP), strength, heading
void main(){
    vec2 w = vWP.xz + vec2(uCamX, uCamZ);
    float t = uTime;
    // ripple normal from a few travelling waves + noise
    vec2 g = vec2(0.0);
    g += vec2(0.8, 0.6) * cos(dot(w, vec2(0.8, 0.6)) * 0.9 + t * 1.6) * 0.07;
    g += vec2(-0.5, 0.86) * cos(dot(w, vec2(-0.5, 0.86)) * 1.7 + t * 2.3) * 0.05;
    g += vec2(0.2, -0.98) * cos(dot(w, vec2(0.2, -0.98)) * 3.1 + t * 3.1) * 0.03;
    float n1 = vnoise(w * 0.35 + t * 0.25), n2 = vnoise(w * 0.35 + vec2(5.2, 1.3) - t * 0.2);
    g += (vec2(n1, n2) - 0.5) * 0.16;
    // wake behind the player's hull: a V of churned foam
    vec2 dw = vWP.xz - uWake.xy; float foam = 0.0;
    if (uWake.z > 0.01) {
        vec2 f = vec2(sin(uWake.w), cos(uWake.w)), r = vec2(f.y, -f.x);
        float back = -dot(dw, f), lat = abs(dot(dw, r));
        float vshape = exp(-abs(lat - back * 0.32) * 1.6) * smoothstep(0.0, 3.0, back) * exp(-back * 0.035);
        float core = exp(-lat * lat * 0.35) * exp(-back * 0.07) * step(0.0, back);
        foam = (vshape * 0.7 + core) * uWake.z * (0.55 + 0.45 * vnoise(w * 2.2 + t * 2.0));
        g += (vec2(vnoise(w * 1.7 - t), vnoise(w * 1.7 + 3.0)) - 0.5) * foam * 0.6;
    }
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 V = normalize(uEye - vWP);
    float vDist = length(vWP - uEye);
    vec3 R = reflect(-V, N);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 sky = mix(uFog * 1.15 + vec3(0.01), uSkyTop * 2.0, clamp(R.y * 2.2, 0.0, 1.0));
    // city light reflections: long shimmering vertical streaks + window sparkle
    float col0 = floor(w.x * 0.45 + g.x * 6.0), col1 = floor(w.y * 0.45 + g.y * 6.0);
    float hs = h21(vec2(col0, 7.0)) * h21(vec2(col1, 3.0));
    vec3 lights = mix(uWinA, mix(uNeonA, uNeonB, step(0.5, fract(hs * 9.0))), step(0.6, fract(hs * 3.7))) * pow(hs, 4.0) * 1.8;
    float sparkle = pow(vnoise(w * vec2(1.3, 1.3) + g * 30.0 + t * 0.6), 9.0) * 3.0;
    vec3 base = vec3(0.004, 0.01, 0.018) + uFog * 0.06;
    vec3 col = base + sky * fres * 1.3 + lights * (0.25 + fres) * smoothstep(8.0, 60.0, vDist) * 0.5 + mix(uNeonA, uWinA, 0.5) * sparkle * 0.25;
    vec3 L = normalize(vec3(0.35, 0.75, -0.45));
    col += vec3(0.6, 0.65, 0.85) * pow(max(dot(R, L), 0.0), 200.0) * 0.8;
    col += vec3(0.55, 0.62, 0.7) * foam * 0.55 + uNeonA * foam * 0.08;
    col += vec3(0.5, 0.55, 0.7) * uFlash * 0.2 * fres;
    col = applyFog(col, vDist * 0.8, 0.0);
    gl_FragColor = vec4(col, 1.0);
}
