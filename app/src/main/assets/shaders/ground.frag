uniform float uCamZ;
varying vec3 vWP;

void main(){
    if (uCanal.y > uCanal.x && vWP.x > uCanal.x && vWP.x < uCanal.y) discard;
    float vDist = length(vWP - uEye); // per-pixel: interpolating it across big quads is wrong
    float wz = vWP.z + uCamZ;
    float ax = abs(vWP.x);
    vec3 col = vec3(0.010, 0.012, 0.018);
    // dashed lane lines on the avenue
    float lane = (1.0 - smoothstep(0.05, 0.16, abs(mod(vWP.x + 2.0, 4.0) - 2.0)))
               * step(ax, 13.0) * step(0.55, fract(wz / 6.0));
    col += vec3(0.55, 0.58, 0.7) * lane * 0.18;
    // sidewalk curbs glow
    col += uNeonA * exp(-abs(ax - 14.5) * 3.0) * 0.35;
    // cross streets
    float cz = abs(mod(wz, 84.0) - 7.0);
    float cross = step(cz, 6.0);
    col += vec3(0.6, 0.6, 0.7) * cross * step(0.6, fract(vWP.x / 5.0)) * 0.05 * step(ax, 400.0);
    // wet asphalt: vertical streak reflections of the neon
    float n = h21(vec2(floor(vWP.x * 0.7), 3.0));
    float streak = pow(n, 5.0) * (0.55 + 0.45 * sin(wz * 0.045 + n * 40.0 + uTime * 0.3));
    col += mix(uNeonA, uNeonB, fract(n * 7.0)) * streak * 0.55 * (0.6 + 0.4 * step(13.0, ax));
    // reflection of the fog / skyline
    col += uFog * 0.12 * smoothstep(20.0, 300.0, vDist);
    col = applyFog(col, vDist * 0.7, 0.0);
    gl_FragColor = vec4(col, 1.0);
}
