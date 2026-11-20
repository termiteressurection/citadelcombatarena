import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const WORD = 'ABRACADABRA';
const TAU = Math.PI * 2;

// Shared animated word texture cache so all 16-cells share the same canvas textures
interface WordTextureRecord {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  rows: string[];
  direction: 'up' | 'down';
}

let sharedUpTex: WordTextureRecord | null = null;
let sharedDownTex: WordTextureRecord | null = null;
let lastSharedTime = -1;

function createWordTexture(direction: 'up' | 'down'): WordTextureRecord {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const rows: string[] = [];
  if (direction === 'up') {
    for (let i = 1; i <= WORD.length; i++) rows.push(WORD.slice(0, i));
  } else {
    for (let j = WORD.length; j >= 1; j--) rows.push(WORD.slice(0, j));
  }

  const rec: WordTextureRecord = { canvas, ctx, texture, rows, direction };
  redrawWordCanvas(rec, direction === 'up' ? 0.35 : 0.85);
  return rec;
}

function redrawWordCanvas(rec: WordTextureRecord, phase: number) {
  const c = rec.ctx;
  const w = 512;
  c.clearRect(0, 0, w, w);

  // Deep void-violet esoteric gradient
  const bg = c.createRadialGradient(256, 105, 10, 256, 280, 330);
  bg.addColorStop(0, 'rgba(91, 26, 112, 0.75)');
  bg.addColorStop(0.55, 'rgba(48, 12, 69, 0.65)');
  bg.addColorStop(1, 'rgba(25, 6, 39, 0.52)');
  c.fillStyle = bg;
  c.fillRect(0, 0, w, w);

  const hold = phase > 0.56 && phase < 0.78;
  const fade = phase > 0.8 ? Math.max(0, 1 - (phase - 0.8) / 0.18) : 1;
  const reveal = Math.min(rec.rows.length, (phase / 0.55) * rec.rows.length);

  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffe2a0';
  c.shadowColor = 'rgba(235, 157, 52, 0.95)';
  c.shadowBlur = hold ? 16 : 9;

  for (let i = 0; i < rec.rows.length; i++) {
    const alpha = Math.max(0, Math.min(1, (reveal - i) * 1.3)) * fade;
    if (alpha <= 0) continue;
    c.globalAlpha = alpha * 0.96;

    const y = 34 + i * 43.3;
    const allowed = Math.max(32, y * 0.88);
    let size = 39;
    c.font = `600 ${size}px 'Cinzel', 'Times New Roman', 'Palatino', serif`;
    while (c.measureText(rec.rows[i]).width > allowed && size > 12) {
      size -= 1;
      c.font = `600 ${size}px 'Cinzel', 'Times New Roman', 'Palatino', serif`;
    }
    c.fillText(rec.rows[i], 256, y);
  }
  c.globalAlpha = 1;
  rec.texture.needsUpdate = true;
}

function updateSharedWordTextures(masterTime: number) {
  if (Math.abs(masterTime - lastSharedTime) < 0.04) return;
  lastSharedTime = masterTime;

  if (!sharedUpTex) sharedUpTex = createWordTexture('up');
  if (!sharedDownTex) sharedDownTex = createWordTexture('down');

  const ph = (masterTime * 0.14) % 1;
  redrawWordCanvas(sharedUpTex, ph);
  redrawWordCanvas(sharedDownTex, (ph + 0.5) % 1);
}

// 8 Vertices of the 16-Cell (regular 4-orthoplex / hexadecachoron)
const FORM_16CELL = (() => {
  const v: number[][] = [];
  for (let a = 0; a < 4; a++) {
    for (let s = -1; s <= 1; s += 2) {
      const ax = [0, 0, 0, 0];
      ax[a] = s;
      v.push(ax);
    }
  }

  const e: [number, number][] = [];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          e.push([a * 2 + i, b * 2 + j]);
        }
      }
    }
  }

  const f: [number, number, number][] = [];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      for (let c = b + 1; c < 4; c++) {
        for (let m = 0; m < 8; m++) {
          f.push([a * 2 + (m & 1), b * 2 + ((m >> 1) & 1), c * 2 + ((m >> 2) & 1)]);
        }
      }
    }
  }

  return { vertices: v, edges: e, faces: f };
})();

export interface Hexadecachoron16CellProps {
  scale?: number;
  color?: string | number;
  wireframeColor?: string | number;
  speed?: number;
  faceOpacity?: number;
  showDust?: boolean;
  dustCount?: number;
  showFaces?: boolean;
  showVertices?: boolean;
  showGlowEdges?: boolean;
  dimension?: number;
}

/**
 * Hexadecachoron16Cell: The Extradimensional 16-Cell with ABRACADABRA Sigil Textures
 * Faithful real-time recreation of the Plash Desktop Wallpaper R^24 -> R^3 16-cell.
 */
export function Hexadecachoron16Cell({
  scale = 1.0,
  color,
  wireframeColor = 0xffc75d,
  speed = 2.2,
  faceOpacity = 0.72,
  showDust = false,
  dustCount = 60,
  showFaces = true,
  showVertices = true,
  showGlowEdges = true,
  dimension = 24,
}: Hexadecachoron16CellProps) {
  const rootGroupRef = useRef<THREE.Group>(null);
  const meshGeomRef = useRef<THREE.BufferGeometry>(null);
  const lineGeomRef = useRef<THREE.BufferGeometry>(null);
  const pointGeomRef = useRef<THREE.BufferGeometry>(null);
  const dustGeomRef = useRef<THREE.BufferGeometry>(null);

  // Initialize shared textures
  const { upTex, downTex } = useMemo(() => {
    if (!sharedUpTex) sharedUpTex = createWordTexture('up');
    if (!sharedDownTex) sharedDownTex = createWordTexture('down');
    return { upTex: sharedUpTex, downTex: sharedDownTex };
  }, []);

  // Set up 24D planes of rotation matching the wallpaper (tuned quicker for kinetic drift)
  const planes = useMemo(() => {
    const list: { a: number; b: number; speed: number }[] = [];
    if (dimension > 3) {
      for (let i = 0; i <= dimension - 4; i++) {
        list.push({ a: i, b: i + 3, speed: 0.075 / (1 + i * 0.009) });
      }
    }
    return list;
  }, [dimension]);

  // Working vectors
  const baseVectors = useMemo(() => {
    return FORM_16CELL.vertices.map((v) => {
      const a = new Float64Array(dimension);
      for (let i = 0; i < v.length; i++) a[i] = v[i];
      return a;
    });
  }, [dimension]);

  const projected3D = useMemo(() => {
    return FORM_16CELL.vertices.map(() => new THREE.Vector3());
  }, []);

  const work = useMemo(() => new Float64Array(dimension), [dimension]);

  // Build Geometry attributes
  const { faceMap, meshPositions, meshUVs, linePositions, pointPositions } = useMemo(() => {
    const fMap: number[] = [];
    const pos = new Float32Array(FORM_16CELL.faces.length * 9);
    const uvs = new Float32Array(FORM_16CELL.faces.length * 6);

    FORM_16CELL.faces.forEach((face, fi) => {
      for (let c = 0; c < 3; c++) {
        fMap.push(face[c]);
        uvs[fi * 6 + c * 2] = c === 0 ? 0.5 : c === 1 ? 0 : 1;
        uvs[fi * 6 + c * 2 + 1] = c === 0 ? 0 : 1;
      }
    });

    const lPos = new Float32Array(FORM_16CELL.edges.length * 6);
    const pPos = new Float32Array(FORM_16CELL.vertices.length * 3);

    return {
      faceMap: fMap,
      meshPositions: pos,
      meshUVs: uvs,
      linePositions: lPos,
      pointPositions: pPos,
    };
  }, []);

  // Multi-material setup: even faces use Up, odd faces use Down
  const materials = useMemo(() => {
    const tintColor = color !== undefined ? new THREE.Color(color) : new THREE.Color(0xffffff);

    const faceUp = new THREE.MeshBasicMaterial({
      map: upTex.texture,
      transparent: true,
      opacity: faceOpacity,
      color: tintColor,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const faceDown = new THREE.MeshBasicMaterial({
      map: downTex.texture,
      transparent: true,
      opacity: faceOpacity,
      color: tintColor,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const edgeMat = new THREE.LineBasicMaterial({
      color: wireframeColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glowMat = new THREE.LineBasicMaterial({
      color: 0xff9f35,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const vertexMat = new THREE.PointsMaterial({
      color: 0xffdfa0,
      size: 0.055 * scale,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return { faceUp, faceDown, edgeMat, glowMat, vertexMat };
  }, [upTex, downTex, faceOpacity, color, wireframeColor, scale]);

  // Mesh geometry with groups
  useEffect(() => {
    if (meshGeomRef.current) {
      meshGeomRef.current.clearGroups();
      for (let i = 0; i < FORM_16CELL.faces.length; i++) {
        meshGeomRef.current.addGroup(i * 3, 3, i % 2);
      }
    }
  }, []);

  // Ambient dust motes
  const dustData = useMemo(() => {
    if (!showDust) return null;
    const positions = new Float32Array(dustCount * 3);
    const baseY = new Float32Array(dustCount);
    const phase = new Float32Array(dustCount);

    for (let di = 0; di < dustCount; di++) {
      const rr = 1.6 + Math.pow(Math.random(), 0.55) * 3.5;
      const ang = Math.random() * TAU;
      positions[di * 3] = Math.cos(ang) * rr * scale;
      baseY[di] = (Math.random() - 0.5) * 4 * scale;
      positions[di * 3 + 1] = baseY[di];
      positions[di * 3 + 2] = Math.sin(ang) * rr * scale;
      phase[di] = Math.random() * TAU;
    }

    return { positions, baseY, phase };
  }, [showDust, dustCount, scale]);

  useFrame(({ clock }) => {
    const masterTime = clock.elapsedTime * speed;

    // Update shared ABRACADABRA texture
    updateSharedWordTextures(masterTime);

    // Compute plane rotation angles
    const angles = planes.map((p) => masterTime * p.speed);

    // Project each vertex from R^24 down to R^3
    for (let i = 0; i < baseVectors.length; i++) {
      const src = baseVectors[i];
      for (let d = 0; d < dimension; d++) work[d] = src[d] || 0;

      // Rotate across 24D planes
      for (let p = 0; p < planes.length; p++) {
        const pl = planes[p];
        const a = pl.a;
        const b = pl.b;
        const ang = angles[p];
        const x = work[a];
        const y = work[b];
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        work[a] = x * c - y * s;
        work[b] = x * s + y * c;
      }

      // Extradimensional perspective collapse
      for (let d = dimension; d >= 4; d--) {
        const sc = 4.2 / (4.2 - work[d - 1]);
        for (let j = 0; j < d - 1; j++) work[j] *= sc;
      }

      projected3D[i].set(work[0] * scale, work[1] * scale, work[2] * scale);
    }

    // Update 32 Triangular Faces
    if (showFaces && meshGeomRef.current) {
      const p = meshGeomRef.current.attributes.position.array as Float32Array;
      for (let i = 0; i < faceMap.length; i++) {
        const v = projected3D[faceMap[i]];
        const o = i * 3;
        p[o] = v.x;
        p[o + 1] = v.y;
        p[o + 2] = v.z;
      }
      meshGeomRef.current.attributes.position.needsUpdate = true;
      meshGeomRef.current.computeVertexNormals();
    }

    // Update 24 Edges
    if (lineGeomRef.current) {
      const p = lineGeomRef.current.attributes.position.array as Float32Array;
      FORM_16CELL.edges.forEach((e, i) => {
        const a = projected3D[e[0]];
        const b = projected3D[e[1]];
        const o = i * 6;
        p[o] = a.x;
        p[o + 1] = a.y;
        p[o + 2] = a.z;
        p[o + 3] = b.x;
        p[o + 4] = b.y;
        p[o + 5] = b.z;
      });
      lineGeomRef.current.attributes.position.needsUpdate = true;
    }

    // Update 8 Vertices
    if (showVertices && pointGeomRef.current) {
      const p = pointGeomRef.current.attributes.position.array as Float32Array;
      projected3D.forEach((v, i) => {
        p[i * 3] = v.x;
        p[i * 3 + 1] = v.y;
        p[i * 3 + 2] = v.z;
      });
      pointGeomRef.current.attributes.position.needsUpdate = true;
    }

    // Breathing pulse
    const breath = 0.5 + 0.5 * Math.sin(masterTime * 0.28);
    materials.faceUp.opacity = faceOpacity * (0.88 + breath * 0.12);
    materials.faceDown.opacity = materials.faceUp.opacity;
    materials.edgeMat.opacity = 0.82 + breath * 0.18;

    // Root rotation matching the wallpaper's organic drift (accelerated)
    if (rootGroupRef.current) {
      rootGroupRef.current.rotation.x = -0.16 + Math.sin(masterTime * 0.048) * 0.09;
      rootGroupRef.current.rotation.y = masterTime * 0.052;
      rootGroupRef.current.rotation.z = 0.065 * Math.sin(masterTime * 0.056);
    }

    // Update orbiting dust
    if (showDust && dustData && dustGeomRef.current) {
      const p = dustGeomRef.current.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        p[i * 3 + 1] = dustData.baseY[i] + Math.sin(masterTime * 0.16 + dustData.phase[i]) * 0.14 * scale;
      }
      dustGeomRef.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={rootGroupRef}>
      {/* 32 Translucent Facets with ABRACADABRA Sigil */}
      {showFaces && (
        <mesh renderOrder={2} frustumCulled={false} material={[materials.faceUp, materials.faceDown]}>
          <bufferGeometry ref={meshGeomRef}>
            <bufferAttribute attach="attributes-position" args={[meshPositions, 3]} />
            <bufferAttribute attach="attributes-uv" args={[meshUVs, 2]} />
          </bufferGeometry>
        </mesh>
      )}

      {/* 24 Luminous Hyper-Edges */}
      <lineSegments renderOrder={5} frustumCulled={false} material={materials.edgeMat}>
        <bufferGeometry ref={lineGeomRef}>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
      </lineSegments>

      {/* Secondary Outer Aura Edge Glow */}
      {showGlowEdges && (
        <lineSegments
          scale={1.014}
          renderOrder={4}
          frustumCulled={false}
          material={materials.glowMat}
        >
          <bufferGeometry ref={lineGeomRef}>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
          </bufferGeometry>
        </lineSegments>
      )}

      {/* 8 Glowing Vertex Synapses */}
      {showVertices && (
        <points renderOrder={6} frustumCulled={false} material={materials.vertexMat}>
          <bufferGeometry ref={pointGeomRef}>
            <bufferAttribute attach="attributes-position" args={[pointPositions, 3]} />
          </bufferGeometry>
        </points>
      )}

      {/* Ambient Celestial Golden Dust */}
      {showDust && dustData && (
        <points renderOrder={3} frustumCulled={false}>
          <bufferGeometry ref={dustGeomRef}>
            <bufferAttribute attach="attributes-position" args={[dustData.positions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color={0xf4bc62}
            size={0.03 * scale}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}
    </group>
  );
}
