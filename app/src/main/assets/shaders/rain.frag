uniform float uRain;
varying vec2 vC;
varying float vDist;
void main(){
    float a = (1.0 - abs(vC.y)) * smoothstep(0.0, 0.4, vC.x) * uRain;
    a *= smoothstep(1.0, 5.0, vDist) * (1.0 - smoothstep(30.0, 70.0, vDist));
    vec3 col = mix(vec3(0.6, 0.7, 0.85), uFog * 2.2 + uNeonA * 0.2, 0.4);
    gl_FragColor = vec4(col * a * 0.35, 1.0);
}
