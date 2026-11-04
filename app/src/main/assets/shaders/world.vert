attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec4 aCol;          // rgb, a: 1 = foliage sway
uniform mat4 uVP;
uniform vec3 uOrigin;
uniform float uTime;
varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
/* Static scenery in absolute track coordinates (walls, stands, garages, trees), drawn relative to the camera. */
void main(){
    vec3 p = aPos;
    float sway = aCol.a * 0.02 * max(p.y - 1.0, 0.0) * 0.1;
    p.x += sway * sin(uTime * 1.3 + aPos.x * 0.07);
    vec3 wp = p - uOrigin;
    vN = aNorm; vCol = aCol; vWP = wp;
    gl_Position = uVP * vec4(wp, 1.0);
}
