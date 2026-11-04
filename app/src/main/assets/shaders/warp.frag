uniform float uWarp;     // 0..1 charge of the chrono jump
uniform float uWhite;    // white-out flash
uniform float uRing;     // arrival ring 0..1 (expanding)
uniform vec2 uRes;
varying vec2 vUV;
/* Chrono jump overlay (additive): radial light streaks converging on the vanishing point, a pulsing
   rim, an expanding arrival ring and the white-out. */
void main(){
    vec2 p = (vUV - vec2(0.5, 0.52)) * vec2(uRes.x / uRes.y, 1.0);
    float r = length(p), a = atan(p.y, p.x);
    float streak = pow(h21(vec2(floor(a * 90.0), floor(uTime * 24.0))), 6.0);
    float speed = fract(r * 2.0 - uTime * (2.0 + uWarp * 6.0) + h21(vec2(floor(a * 90.0), 3.0)));
    float lines = streak * smoothstep(0.08, 0.5, r) * smoothstep(0.0, 0.2, speed) * (1.0 - speed);
    vec3 c = mix(uNeonA, vec3(0.85, 0.95, 1.0), 0.4) * lines * uWarp * 1.6;
    c += uNeonA * smoothstep(0.55, 0.95, r) * uWarp * (0.35 + 0.25 * sin(uTime * 30.0));
    float ring = smoothstep(0.05, 0.0, abs(r - uRing * 1.3)) * (1.0 - uRing);
    c += mix(uNeonA, uNeonB, 0.3) * ring * 1.5;
    c += vec3(1.0) * uWhite;
    gl_FragColor = vec4(c, 1.0);
}
