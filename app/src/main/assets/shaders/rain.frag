uniform float uRain;
uniform float uSnow;
varying vec2 vC;
varying float vDist;
void main(){
    float a = (1.0 - abs(vC.y)) * smoothstep(0.0, 0.4, vC.x) * uRain;
    a *= smoothstep(1.0, 5.0, vDist) * (1.0 - smoothstep(30.0, 70.0, vDist));
    vec3 col = mix(vec3(0.6, 0.7, 0.85), uFog * 2.2 + uNeonA * 0.2, 0.4);
    if (uSnow > 0.5) {
        a = (1.0 - abs(vC.y)) * (1.0 - abs(vC.x * 2.0 - 1.0)) * uRain;
        a *= smoothstep(0.5, 3.0, vDist) * (1.0 - smoothstep(25.0, 60.0, vDist));
        col = vec3(0.9, 0.93, 1.0) + uNeonA * 0.08;
        gl_FragColor = vec4(col * a * 0.9, 1.0);
        return;
    }
    col += vec3(0.6) * uFlash;
    gl_FragColor = vec4(col * a * 0.35, 1.0);
}
