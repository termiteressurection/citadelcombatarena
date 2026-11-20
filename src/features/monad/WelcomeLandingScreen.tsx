import React, { useEffect, useRef, useState } from 'react';

interface Props {
  onEnterWorld: () => void;
}

export function WelcomeLandingScreen({ onEnterWorld }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hovered, setHovered] = useState(false);

  // Mouse & physics tracking
  const mouseRef = useRef({
    targetX: 0.5,
    targetY: 0.5,
    // Slower channel for fractal morph
    morphX: 0.5,
    morphY: 0.5,
    // Faster lag for liquid ripple
    lagX: 0.5,
    lagY: 0.5,
    lastX: 0.5,
    lastY: 0.5,
    velocity: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: false });
    if (!gl) return;

    let animId: number;
    let width = 0;
    let height = 0;

    const resize = () => {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth * dpr;
      height = window.innerHeight * dpr;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    resize();
    window.addEventListener('resize', resize);

    const onPointerMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = 1.0 - e.clientY / window.innerHeight;
      const m = mouseRef.current;
      m.targetX = x;
      m.targetY = y;
    };
    window.addEventListener('pointermove', onPointerMove);

    // Keyboard support: Enter / Space triggers entry directly into the 3D world
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEnterWorld();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Vertex shader
    const vsSource = `
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment shader implementing the 3-Layer Fractal + Liquid Ripple + Asymmetric Chromatic Aberration
    const fsSource = `
      precision highp float;
      varying vec2 vUv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_morph_mouse;
      uniform vec2 u_lag_mouse;
      uniform float u_mouse_vel;

      vec2 csqr(vec2 z) {
        return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
      }

      // DEEP Layer: Julia Set (Violet / Magenta / Gold)
      vec3 sampleDeepJulia(vec2 uv, vec2 c) {
        vec2 z = uv * 1.75;
        float n = 0.0;
        for (int i = 0; i < 48; i++) {
          if (dot(z, z) > 4.0) { n = float(i); break; }
          z = csqr(z) + c;
        }
        if (n == 0.0) n = 48.0;
        float t = n / 48.0;

        vec3 colViolet = vec3(0.482, 0.184, 0.968); // #7b2ff7
        vec3 colMagenta = vec3(1.0, 0.184, 0.702); // #ff2fb3
        vec3 colGold = vec3(1.0, 0.819, 0.400);    // #ffd166

        vec3 col = mix(colViolet, colMagenta, smoothstep(0.08, 0.55, t));
        col = mix(col, colGold, smoothstep(0.55, 0.92, t));
        col *= smoothstep(0.02, 0.28, t);
        return col;
      }

      // MID Layer: Electric Blue / Cyan Iridescence
      vec3 sampleMidJulia(vec2 uv, vec2 c, float angle) {
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 z = (rot * uv) * 2.1;
        float n = 0.0;
        for (int i = 0; i < 36; i++) {
          if (dot(z, z) > 4.0) { n = float(i); break; }
          z = csqr(z) + c;
        }
        if (n == 0.0) n = 36.0;
        float t = n / 36.0;

        vec3 colCyan = vec3(0.0, 0.898, 1.0); // #00e5ff
        vec3 colBlue = vec3(0.15, 0.22, 0.85);

        vec3 col = mix(colBlue, colCyan, t);
        col *= smoothstep(0.04, 0.35, t) * 0.42;
        return col;
      }

      // FOREGROUND Layer: Luminous Filament Filigree
      vec3 sampleFiligree(vec2 uv, float time) {
        vec2 z = uv * 3.0;
        float val = 0.0;
        for (int i = 0; i < 4; i++) {
          z = abs(z) / clamp(dot(z, z), 0.1, 1.5) - vec2(0.65, 0.55 + sin(time * 0.2) * 0.05);
          val += exp(-length(z) * 6.0);
        }
        vec3 filigree = vec3(1.0, 0.85, 0.45) * val * 0.12;
        return filigree;
      }

      vec3 renderScene(vec2 uv, vec2 cDeep, vec2 cMid) {
        vec2 aspect = vec2(u_resolution.x / min(u_resolution.x, u_resolution.y),
                           u_resolution.y / min(u_resolution.x, u_resolution.y));
        vec2 p = (uv - 0.5) * aspect;

        // Differential Parallax
        vec2 pDeep = p - (u_morph_mouse - 0.5) * 0.10;
        vec2 pMid  = p - (u_morph_mouse - 0.5) * 0.35;
        vec2 pFore = p - (u_morph_mouse - 0.5) * 0.70;

        vec3 deep = sampleDeepJulia(pDeep, cDeep);
        vec3 mid  = sampleMidJulia(pMid, cMid, u_time * 0.08);
        vec3 fore = sampleFiligree(pFore, u_time);

        // Additive / screen blend
        vec3 finalCol = deep + mid + fore;

        // Vignette
        float vig = 1.0 - smoothstep(0.4, 1.35, length(p));
        finalCol *= vig;

        return finalCol;
      }

      void main() {
        vec2 uv = vUv;

        // Liquid composite ripple pass centered on lag mouse
        vec2 dir = uv - u_lag_mouse;
        float dist = length(dir);
        vec2 ndir = dist > 1e-4 ? dir / dist : vec2(0.0);

        float rippleAmp = (0.012 + u_mouse_vel * 0.035) * exp(-dist * 4.5);
        float ripple = sin(dist * 26.0 - u_time * 5.0) * rippleAmp;
        vec2 displacedUv = uv + ndir * ripple;

        // Asymmetric chromatic aberration: +1.55px R, -1.85px B
        vec2 rOffset = vec2(1.55 / u_resolution.x, 0.0);
        vec2 bOffset = vec2(-1.85 / u_resolution.x, 0.0);

        // Morph Julia constants with slow LFO idle drift
        float idleLFO = sin(u_time * 0.35) * 0.035;
        vec2 cDeep = vec2(
          mix(-0.72, -0.68, u_morph_mouse.x) + idleLFO,
          mix(0.18, 0.24, u_morph_mouse.y) + cos(u_time * 0.28) * 0.03
        );
        vec2 cMid = vec2(
          -0.4 + sin(u_time * 0.15) * 0.05,
          0.6 + cos(u_time * 0.2) * 0.05
        );

        float r = renderScene(displacedUv + rOffset, cDeep, cMid).r;
        float g = renderScene(displacedUv, cDeep, cMid).g;
        float b = renderScene(displacedUv + bOffset, cDeep, cMid).b;

        vec3 col = vec3(r, g, b);

        // Near-black void baseline (#010103)
        col = max(col, vec3(0.005, 0.004, 0.012));

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const createShader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = createShader(gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMorphMouse = gl.getUniformLocation(prog, 'u_morph_mouse');
    const uLagMouse = gl.getUniformLocation(prog, 'u_lag_mouse');
    const uMouseVel = gl.getUniformLocation(prog, 'u_mouse_vel');

    const startTime = performance.now();

    const render = () => {
      const now = performance.now();
      const time = (now - startTime) * 0.001;

      const m = mouseRef.current;
      // Morph pointer lerp (slow channel: 0.02)
      m.morphX += (m.targetX - m.morphX) * 0.02;
      m.morphY += (m.targetY - m.morphY) * 0.02;

      // Liquid lag lerp (fast channel: 0.1)
      m.lagX += (m.targetX - m.lagX) * 0.1;
      m.lagY += (m.targetY - m.lagY) * 0.1;

      // Mouse velocity
      const dx = m.targetX - m.lastX;
      const dy = m.targetY - m.lastY;
      const vel = Math.min(Math.sqrt(dx * dx + dy * dy) * 15.0, 1.0);
      m.velocity += (vel - m.velocity) * 0.08;
      m.lastX = m.targetX;
      m.lastY = m.targetY;

      gl.useProgram(prog);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMorphMouse, m.morphX, m.morphY);
      gl.uniform2f(uLagMouse, m.lagX, m.lagY);
      gl.uniform1f(uMouseVel, m.velocity);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onEnterWorld]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: '#010103',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Fullscreen Three-Layer Fractal Shader Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      {/* Dark central vignette backing for high contrast */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(2, 1, 6, 0.4) 0%, rgba(1, 1, 3, 0.85) 75%)',
          pointerEvents: 'none',
        }}
      />

      {/* Centered Void Minimalism: Click "welcome." to enter the 3D world directly */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={onEnterWorld}
          style={{
            cursor: 'pointer',
            textAlign: 'center',
            padding: '24px 48px',
            position: 'relative',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(2.8rem, 7.5vw, 4.8rem)',
              fontWeight: 200,
              letterSpacing: '0.18em',
              color: '#ffffff',
              margin: 0,
              textTransform: 'lowercase',
              fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              textShadow: hovered
                ? '0 0 32px rgba(168, 85, 247, 0.65), 0 0 64px rgba(255, 47, 179, 0.35)'
                : '0 0 24px rgba(255, 255, 255, 0.25)',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: hovered ? 'scale(1.03)' : 'scale(1.0)',
            }}
          >
            welcome.
          </h1>

          {/* Subtle pulse line */}
          <div
            style={{
              width: hovered ? '100%' : '24px',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.8), transparent)',
              margin: '14px auto 0',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}
