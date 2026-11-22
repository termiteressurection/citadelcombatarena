import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CURVE_UNIFORMS, curveDrop } from './curvature';

const BASE_FONT_PX = 128;
const LINE_HEIGHT = 1.2;
const PADDING_PX = 28;
const FONT_FAMILY = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace";

function measureLine(ctx: CanvasRenderingContext2D, line: string, letterSpacingPx: number) {
  const chars = Array.from(line);
  return chars.reduce((width, char, index) => (
    width + ctx.measureText(char).width + (index < chars.length - 1 ? letterSpacingPx : 0)
  ), 0);
}

function drawLine(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, letterSpacingPx: number) {
  let cursor = x;
  for (const [index, char] of Array.from(line).entries()) {
    ctx.strokeText(char, cursor, y);
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width;
    if (index < line.length - 1) cursor += letterSpacingPx;
  }
}

interface SpriteTextProps {
  children?: string;
  text?: string;
  position?: [number, number, number];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  outlineColor?: string;
  outlineWidth?: number;
  opacity?: number;
  letterSpacing?: number;
  maxWidth?: number;
  depthTest?: boolean;
  renderOrder?: number;
}

export default function SpriteText({
  children,
  text: textProp,
  position = [0, 0, 0],
  fontSize = 0.3,
  fontFamily = FONT_FAMILY,
  fontWeight = 600,
  color = '#ffffff',
  outlineColor = '#000000',
  outlineWidth = 0,
  opacity = 1,
  letterSpacing = 0,
  maxWidth,
  depthTest = true,
  renderOrder,
}: SpriteTextProps) {
  const text = textProp ?? children;
  if (text === undefined || text === null) return null;
  const spriteRef = useRef<THREE.Sprite>(null!);
  const worldVec = useRef(new THREE.Vector3());

  const { texture, aspect, lineCount } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallbackTexture = new THREE.CanvasTexture(canvas);
      return { texture: fallbackTexture, aspect: 1, lineCount: 1 };
    }

    ctx.font = `${fontWeight} ${BASE_FONT_PX}px ${fontFamily}`;
    const lines = text.split('\n');
    const letterSpacingPx = BASE_FONT_PX * letterSpacing;
    const rawWidth = Math.max(...lines.map(line => measureLine(ctx, line, letterSpacingPx)), BASE_FONT_PX * 0.45);
    const lineHeightPx = BASE_FONT_PX * LINE_HEIGHT;
    const rawHeight = Math.max(lines.length * lineHeightPx, BASE_FONT_PX);
    const clampedWidth = maxWidth ? Math.min(rawWidth, BASE_FONT_PX * maxWidth * 10) : rawWidth;

    canvas.width = Math.ceil(clampedWidth + PADDING_PX * 2);
    canvas.height = Math.ceil(rawHeight + PADDING_PX * 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontWeight} ${BASE_FONT_PX}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.strokeStyle = outlineColor;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(2, outlineWidth * BASE_FONT_PX * 4.5);

    lines.forEach((line, index) => {
      const lineWidth = Math.min(measureLine(ctx, line, letterSpacingPx), clampedWidth);
      const x = (canvas.width - lineWidth) / 2;
      const y = PADDING_PX + lineHeightPx * (index + 0.5);
      drawLine(ctx, line, x, y, letterSpacingPx);
    });

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.generateMipmaps = false;

    return {
      texture: nextTexture,
      aspect: canvas.width / canvas.height,
      lineCount: lines.length,
    };
  }, [color, fontFamily, fontWeight, letterSpacing, maxWidth, opacity, outlineColor, outlineWidth, text]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const sp = spriteRef.current;
    if (!sp) return;
    sp.position.y = position[1];
    sp.updateWorldMatrix(true, false);
    sp.getWorldPosition(worldVec.current);
    const org = CURVE_UNIFORMS.uCurveOrigin.value;
    const drop = curveDrop(worldVec.current.x - org.x, worldVec.current.z - org.z);
    if (drop > 0) sp.position.y = position[1] - drop;
  });

  const height = Math.max(fontSize * lineCount * 1.2, fontSize);
  const width = height * aspect;

  return (
    <sprite ref={spriteRef} position={position} scale={[width, height, 1]} renderOrder={renderOrder}>
      <spriteMaterial map={texture} transparent opacity={opacity} depthTest={depthTest} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
