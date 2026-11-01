uniform float uFade;
uniform float uScan;
uniform vec2 uRes;
varying vec2 vUV;
/* Vignette, CRT scanlines and fade-to-black (alpha-blended over the frame). */
void main(){
    vec2 p = vUV - 0.5;
    float vig = smoothstep(0.35, 0.85, length(p * vec2(1.0, 0.85)));
    float scan = uScan * 0.18 * step(0.5, fract(vUV.y * uRes.y / 3.0));
    float a = clamp(max(uFade, vig * 0.75 + scan), 0.0, 1.0);
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
