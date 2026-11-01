attribute vec2 aPos;
uniform mat4 uVP;
uniform vec3 uEye;
varying vec3 vWP;
void main(){
    vec3 wp = vec3(aPos.x, 0.0, aPos.y);
    vWP = wp;
    gl_Position = uVP * vec4(wp, 1.0);
}
