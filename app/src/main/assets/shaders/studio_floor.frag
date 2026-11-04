uniform float uAlpha;
varying vec3 vWP;
/* Showroom floor: glossy dark (the mirrored car shows through), neon turntable ring and a faint grid. */
void main(){
    vec2 p = vWP.xz + uEye.xz * 0.0;
    float r = length(vWP.xz);
    vec3 col = vec3(0.012, 0.013, 0.02) + uFog * 0.08;
    float ring = exp(-abs(r - 3.6) * 18.0) + 0.5 * exp(-abs(r - 3.75) * 40.0);
    col += uNeonA * ring * 0.9;
    float sweep = smoothstep(0.96, 1.0, sin(atan(vWP.z, vWP.x) * 1.0 - uTime * 1.2) * 0.5 + 0.5) * step(r, 3.6);
    col += uNeonA * sweep * 0.06;
    vec2 g = abs(fract(vWP.xz * 0.5) - 0.5);
    col += uNeonB * 0.05 * step(0.48, max(g.x, g.y)) * smoothstep(14.0, 4.0, r);
    col *= smoothstep(26.0, 5.0, r) * 0.9 + 0.1;
    vec3 hl = headLight(vWP) * 0.35;
    col += hl;
    float a = min(1.0, length(hl) * 0.8 + mix(uAlpha, 1.0, smoothstep(3.0, 9.0, r)));
    gl_FragColor = vec4(col, a);
}
