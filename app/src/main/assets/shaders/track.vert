attribute vec3 aPos;
attribute vec3 aTrk;          // x: distance along the lap (m), y: lateral offset (m), z: kerb strength
uniform mat4 uVP;
uniform vec3 uOrigin;         // camera position in track coordinates (keeps float precision)
varying vec3 vWP;
varying vec3 vTrk;
void main(){
    vec3 wp = aPos - uOrigin;
    vWP = wp; vTrk = aTrk;
    gl_Position = uVP * vec4(wp, 1.0);
}
