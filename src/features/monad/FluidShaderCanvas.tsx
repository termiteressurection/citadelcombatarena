import { useEffect, useRef } from 'react';

export function FluidShaderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let mx = 0;
    let my = 0;

    function resize() {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
      width = window.innerWidth * dpr;
      height = window.innerHeight * dpr;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      mx = width * 0.5;
      my = height * 0.5;
    }

    resize();
    window.addEventListener('resize', resize);

    const onPointerMove = (e: PointerEvent) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
      mx = e.clientX * dpr;
      my = (window.innerHeight - e.clientY) * dpr;
    };
    window.addEventListener('pointermove', onPointerMove);

    const vsSource = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;
    const fsSource = `
      precision mediump float;
      uniform float t;
      uniform vec2 r;
      uniform vec2 m;

      vec3 pal(float v){
        vec3 a=vec3(0.5,0.5,0.5);
        vec3 b=vec3(0.5,0.5,0.5);
        vec3 c=vec3(1.0,1.0,1.0);
        vec3 d=vec3(0.0,0.1,0.2);
        return a+b*cos(6.28318*(c*v+d));
      }

      float fbm(vec2 p, float time){
        float v=0.0, a=0.5;
        mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
        for(int i=0;i<5;i++){
          v+=a*sin(p.x*1.2+time*0.3)*cos(p.y*1.1-time*0.2);
          p=rot*p*2.1;
          a*=0.5;
        }
        return v;
      }

      void main(){
        vec2 uv=(gl_FragCoord.xy-0.5*r)/min(r.x,r.y);
        float time=t*0.15;

        vec2 q=vec2(fbm(uv+time*0.1,time),fbm(uv+vec2(1.7,9.2)+time*0.08,time));
        vec2 rr=vec2(fbm(uv+4.0*q+vec2(1.7,9.2)+time*0.06,time),fbm(uv+4.0*q+vec2(8.3,2.8)+time*0.07,time));
        float f=fbm(uv+4.0*rr,time);

        vec2 mp=(m-0.5*r)/min(r.x,r.y);
        float md=length(uv-mp);
        float mI=exp(-md*md*4.0)*0.3;
        f+=mI*sin(md*12.0-t*2.0);

        vec3 col=pal(f*0.8+time*0.05);
        col=mix(col,pal(f*1.2+0.3+time*0.03),smoothstep(0.0,1.5,length(q)));
        col=mix(col,pal(f*0.6+0.6+time*0.04),smoothstep(0.0,2.0,length(rr)));

        float vig=1.0-smoothstep(0.3,1.4,length(uv));
        col*=vig*0.35;
        col=pow(col,vec3(1.1))+vec3(0.02,0.0,0.04);

        gl_FragColor=vec4(col,1.0);
      }
    `;

    function compile(src: string, type: number) {
      if (!gl) return null;
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    const vs = compile(vsSource, gl.VERTEX_SHADER);
    const fs = compile(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;

    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pLoc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    const tLoc = gl.getUniformLocation(prog, 't');
    const rLoc = gl.getUniformLocation(prog, 'r');
    const mLoc = gl.getUniformLocation(prog, 'm');

    function loop(now: number) {
      if (!gl) return;
      gl.uniform1f(tLoc, now * 0.001);
      gl.uniform2f(rLoc, width, height);
      gl.uniform2f(mLoc, mx, my);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      if (gl && prog) {
        gl.deleteProgram(prog);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ background: '#020006' }}
    />
  );
}
