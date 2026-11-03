uniform float uGlow;
varying vec2 vUV;
varying vec4 vCol;
varying vec3 vWP;
/* Additive soft light: underglow, headlight pools, tail-light bloom. */
void main(){
    float f = exp(-dot(vUV, vUV) * 2.6) * (1.0 - smoothstep(0.85, 1.0, max(abs(vUV.x), abs(vUV.y))));
    float d = length(uEye - vWP);
    float fade = 1.0 - fogAmount(d) * 0.9;
    gl_FragColor = vec4(vCol.rgb * f * vCol.a * uGlow * fade, 1.0);
}
