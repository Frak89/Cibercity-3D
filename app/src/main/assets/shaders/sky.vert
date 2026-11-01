attribute vec2 aPos;
uniform vec3 uFwd;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uTan;
varying vec3 vDir;
void main(){
    vDir = uFwd + aPos.x * uTan.x * uRight + aPos.y * uTan.y * uUp;
    gl_Position = vec4(aPos, 0.9999, 1.0);
}
