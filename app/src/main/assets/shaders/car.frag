varying vec2 vC;
varying float vAway;
varying float vDist;
varying float vSeed;
void main(){
    float side = exp(-vC.y * vC.y * 3.5);
    float along = mix(0.25, 1.0, vC.x);
    vec3 tailCol = vec3(1.0, 0.12, 0.18);
    vec3 headCol = mix(vec3(0.85, 0.95, 1.0), uNeonA, step(0.8, fract(vSeed * 13.0)));
    vec3 col = mix(headCol, tailCol, vAway);
    col += vec3(1.0) * pow(vC.x, 8.0) * 0.6;
    float fade = 1.0 - fogAmount(vDist) * 0.85;
    gl_FragColor = vec4(col * side * along * fade * 1.3, 1.0);
}
