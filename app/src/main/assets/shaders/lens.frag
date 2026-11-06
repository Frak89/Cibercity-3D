uniform sampler2D uTex;
uniform vec2 uC;         // centre of the field (screen uv)
uniform float uR;        // radius of the warp bubble (in screen heights)
uniform float uK;        // strength 0..1 (follows the warp factor)
uniform vec3 uCol;       // warp colour
uniform vec2 uRes;
varying vec2 vUV;
/* Warp-field lensing: the frame is copied into uTex and re-sampled bent around the ship like light around a mass
   (deflection ~ R^2/r, an Einstein ring, a slow ripple that speeds up with the warp factor, a little chromatic split).
   The ship itself (r < ~0.5R) is left untouched. */
void main(){
    float asp = uRes.x / uRes.y;
    vec2 d = (vUV - uC) * vec2(asp, 1.0);
    float r = max(length(d), 1e-4);
    vec2 n = d / r;
    float hold = smoothstep(0.8 * uR, 1.3 * uR, r);
    float ripple = sin(r * 38.0 / max(uR, 0.05) - uTime * (3.0 + uK * 14.0)) * 0.012 * uK * exp(-r / (uR * 2.5));
    float defl = uK * 0.55 * uR * uR / (r + 0.2 * uR) * hold + ripple * hold;
    vec2 o = n * defl / vec2(asp, 1.0);
    float ca = 0.012 * uK * hold;
    vec2 cs = n * ca / vec2(asp, 1.0);
    vec3 c;
    c.r = texture2D(uTex, clamp(vUV - o * (1.0 + 0.0) - cs, 0.001, 0.999)).r;
    c.g = texture2D(uTex, clamp(vUV - o, 0.001, 0.999)).g;
    c.b = texture2D(uTex, clamp(vUV - o + cs, 0.001, 0.999)).b;
    float ring = exp(-pow((r - 1.4 * uR) / (0.08 * uR + 0.004), 2.0));
    float swirl = 0.5 + 0.5 * sin(atan(d.y, d.x) * 6.0 + uTime * (1.5 + uK * 6.0) - r * 30.0);
    c += uCol * ring * uK * (0.18 + 0.22 * swirl);
    c += uCol * hold * uK * 0.06 * exp(-r / (uR * 1.6));
    gl_FragColor = vec4(c, 1.0);
}
