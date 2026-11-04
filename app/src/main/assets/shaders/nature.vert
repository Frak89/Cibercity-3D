attribute vec3 aPos;
attribute vec2 aCenter;
attribute vec3 aNorm;
attribute vec4 aCol;          // rgb colour, a: 1 = foliage (sways in the wind)
uniform mat4 uVP;
uniform float uCamZ;
uniform float uL;
uniform float uCamX;
uniform float uWrapX;
uniform float uZOff;
uniform float uTime;
varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
/* Meadow props (trees, rocks, bushes) on the torus world, wrapped around the camera like the buildings. */
void main(){
    float z = mod(aCenter.y - uCamZ + uL * uZOff, uL) - uL * uZOff;
    float x = mod(aCenter.x - uCamX + uWrapX * 0.5, uWrapX) - uWrapX * 0.5;
    vec3 p = aPos;
    float sway = aCol.a * max(p.y - 1.0, 0.0) * 0.025;
    p.x += sway * sin(uTime * 1.3 + aCenter.x * 0.07);
    p.z += sway * cos(uTime * 1.1 + aCenter.y * 0.05);
    vec3 wp = vec3(x, 0.0, z) + p;
    vN = aNorm; vCol = aCol; vWP = wp;
    gl_Position = uVP * vec4(wp, 1.0);
}
