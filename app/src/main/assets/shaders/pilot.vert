/* KAGE pilot: 2-bone linear blend skinning (bones in the character's local space), then uModel. Same varyings as vehicle.vert. */
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec4 aCol;
attribute vec4 aAnim;
attribute vec4 aSkin;    // bone 0, bone 1, weight of bone 0
uniform mat4 uVP;
uniform mat4 uModel;
uniform mat4 uBones[19];
varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
varying vec2 vMode;
varying float vFade;
varying vec3 vLoc;
void main(){
    mat4 m = uBones[int(aSkin.x + 0.5)] * aSkin.z + uBones[int(aSkin.y + 0.5)] * (1.0 - aSkin.z);
    vec4 lp = m * vec4(aPos, 1.0);
    vec3 n = (m * vec4(aNorm, 0.0)).xyz;
    vec4 wp = uModel * lp;
    float slot = floor(aAnim.x / 8.0 + 0.01);
    vN = (uModel * vec4(n, 0.0)).xyz; vWP = wp.xyz; vCol = aCol; vMode = vec2(aAnim.x - slot * 8.0, slot); vFade = 1.0; vLoc = aPos;
    gl_Position = uVP * wp;
}
