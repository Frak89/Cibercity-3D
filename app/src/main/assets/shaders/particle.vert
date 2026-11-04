attribute vec3 aPos;
attribute vec4 aCol;
attribute vec2 aInfo;        // x: size in metres, y: kind (0 smoke, 1 flame) + seed * 0.9
uniform mat4 uVP;
uniform float uScale;        // viewport height / (2 tan(fov / 2))
varying vec4 vCol;
varying float vKind;
varying float vSeed;
void main(){
    gl_Position = uVP * vec4(aPos, 1.0);
    gl_PointSize = clamp(aInfo.x * uScale / max(gl_Position.w, 0.05), 1.0, 300.0);
    vCol = aCol;
    vKind = floor(aInfo.y);
    vSeed = fract(aInfo.y) / 0.9;
}
