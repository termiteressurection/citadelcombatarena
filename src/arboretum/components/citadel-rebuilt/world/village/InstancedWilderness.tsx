import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { applyGlobeCurvatureMatrix, sphereDrop } from '../../RebuiltWorldShared';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';
import type { ScatterInstance } from './DispersedOverworld';

export interface WildernessInstances {
  bamboo: ScatterInstance[];
  hedges: ScatterInstance[];
  lanterns: ScatterInstance[];
  pillars: ScatterInstance[];
  torii: ScatterInstance[];
  diamondLamps: ScatterInstance[];
}

interface AssetTransform {
  source: ScatterInstance;
  scale: number;
  rotationY: number;
  chunkKey: string;
}

interface LayerPlacement {
  asset: AssetTransform;
  localMatrix: THREE.Matrix4;
}

interface InstanceLayer {
  key: string;
  category: keyof WildernessInstances;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  placements: LayerPlacement[];
}

interface WildernessRenderData {
  assets: AssetTransform[];
  chunkKeys: string[];
  layers: InstanceLayer[];
}

const geometries = new Map<string, THREE.BufferGeometry>();
const materials = new Map<string, THREE.MeshBasicMaterial>();

function geometry(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let value = geometries.get(key);
  if (!value) {
    value = create();
    geometries.set(key, value);
  }
  return value;
}

function material(
  key: string,
  color: number,
  options: { wireframe?: boolean; transparent?: boolean; opacity?: number } = {},
): THREE.MeshBasicMaterial {
  let value = materials.get(key);
  if (!value) {
    value = new THREE.MeshBasicMaterial({ color, ...options });
    materials.set(key, value);
  }
  return value;
}

function matrix(
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Matrix4 {
  const object = new THREE.Object3D();
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.updateMatrix();
  return object.matrix.clone();
}

function compose(...matrices: THREE.Matrix4[]): THREE.Matrix4 {
  const result = new THREE.Matrix4();
  for (const item of matrices) result.multiply(item);
  return result;
}

function addLayer(
  layers: Map<string, InstanceLayer>,
  key: string,
  category: keyof WildernessInstances,
  asset: AssetTransform,
  geometryKey: string,
  createGeometry: () => THREE.BufferGeometry,
  materialKey: string,
  color: number,
  options: { wireframe?: boolean; transparent?: boolean; opacity?: number },
  localMatrix: THREE.Matrix4,
) {
  let layer = layers.get(key);
  if (!layer) {
    layer = {
      key,
      category,
      geometry: geometry(geometryKey, createGeometry),
      material: material(materialKey, color, options),
      placements: [],
    };
    layers.set(key, layer);
  }
  layer.placements.push({ asset, localMatrix });
}

function makeTransform(
  source: ScatterInstance,
  category: keyof WildernessInstances,
  index: number,
): AssetTransform {
  let scale = 1;
  let rotationY = 0;
  if (category === 'pillars' || category === 'torii' || category === 'diamondLamps' || category === 'hedges') {
    scale = source.scale[0];
  } else if (category === 'bamboo') {
    scale = source.scale[0];
  }
  if (category === 'pillars' || category === 'torii') rotationY = source.rotationY || 0;
  return { source, scale, rotationY, chunkKey: source.chunkKey || `${category}-${index}` };
}

function r(seed: number, factor: number, offset: number): number {
  const value = Math.sin(seed * factor + offset) * 1000;
  return value - Math.floor(value);
}

function addDoric(
  layers: Map<string, InstanceLayer>,
  asset: AssetTransform,
) {
  const part = (
    key: string,
    geometryKey: string,
    create: () => THREE.BufferGeometry,
    materialKey: string,
    color: number,
    options: { wireframe?: boolean; transparent?: boolean; opacity?: number },
    pos: [number, number, number],
  ) => addLayer(layers, key, 'pillars', asset, geometryKey, create, materialKey, color, options, matrix(pos));

  part('doric-shaft-wire', 'doric-shaft-wire', () => new THREE.CylinderGeometry(0.52, 0.65, 8, 16, 1, true), 'doric-cyan', 0x22d3ee, { wireframe: true, transparent: true, opacity: 0.55 }, [0, 4, 0]);
  part('doric-shaft-core', 'doric-shaft-core', () => new THREE.CylinderGeometry(0.48, 0.60, 7.9, 16), 'doric-core', 0x0b051b, { transparent: true, opacity: 0.7 }, [0, 4, 0]);
  part('doric-neck', 'doric-neck', () => new THREE.CylinderGeometry(0.54, 0.52, 0.15, 16), 'doric-gold-neck', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.7 }, [0, 7.9, 0]);
  part('doric-capital', 'doric-capital', () => new THREE.CylinderGeometry(0.82, 0.56, 0.35, 16), 'doric-gold-capital', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.8 }, [0, 8.15, 0]);
  part('doric-abacus', 'doric-abacus', () => new THREE.BoxGeometry(1.5, 0.25, 1.5), 'doric-gold-abacus', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.85 }, [0, 8.45, 0]);
}

function addIonic(layers: Map<string, InstanceLayer>, asset: AssetTransform) {
  const part = (
    key: string,
    geometryKey: string,
    create: () => THREE.BufferGeometry,
    materialKey: string,
    color: number,
    options: { wireframe?: boolean; transparent?: boolean; opacity?: number },
    pos: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ) => addLayer(layers, key, 'pillars', asset, geometryKey, create, materialKey, color, options, matrix(pos, rotation));

  part('ionic-base-box', 'ionic-base-box', () => new THREE.BoxGeometry(1.5, 0.3, 1.5), 'ionic-purple-base', 0xa855f7, { wireframe: true, transparent: true, opacity: 0.65 }, [0, 0.15, 0]);
  part('ionic-base-cyl', 'ionic-base-cyl', () => new THREE.CylinderGeometry(0.75, 0.85, 0.22, 16), 'ionic-purple-cyl', 0xa855f7, { wireframe: true, transparent: true, opacity: 0.7 }, [0, 0.4, 0]);
  part('ionic-base-ring', 'ionic-base-ring', () => new THREE.TorusGeometry(0.62, 0.08, 6, 16), 'ionic-gold-ring', 0xfbbf24, { transparent: true, opacity: 0.8 }, [0, 0.55, 0], [Math.PI / 2, 0, 0]);
  part('ionic-shaft-wire', 'ionic-shaft-wire', () => new THREE.CylinderGeometry(0.44, 0.54, 7.8, 16, 1, true), 'ionic-purple-shaft', 0xa855f7, { wireframe: true, transparent: true, opacity: 0.6 }, [0, 4.4, 0]);
  part('ionic-shaft-core', 'ionic-shaft-core', () => new THREE.CylinderGeometry(0.40, 0.50, 7.7, 16), 'ionic-core', 0x0b051b, { transparent: true, opacity: 0.7 }, [0, 4.4, 0]);
  part('ionic-capital', 'ionic-capital', () => new THREE.CylinderGeometry(0.62, 0.46, 0.25, 16), 'ionic-gold-capital', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.8 }, [0, 8.25, 0]);

  const voluteGeometry = () => new THREE.TorusGeometry(0.35, 0.12, 6, 16);
  const voluteCoreGeometry = () => new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12);
  for (const z of [-0.68, 0.68]) {
    part('ionic-volutes', 'ionic-volute', voluteGeometry, 'ionic-gold-volute', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.9 }, [0, 8.4, z], [Math.PI / 2, 0, 0]);
    part('ionic-volute-cores', 'ionic-volute-core', voluteCoreGeometry, 'ionic-purple-volute-core', 0xa855f7, { transparent: true, opacity: 0.75 }, [0, 8.4, z]);
  }
  part('ionic-bolster', 'ionic-bolster', () => new THREE.BoxGeometry(1.0, 0.22, 1.4), 'ionic-gold-bolster', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.8 }, [0, 8.45, 0]);
  part('ionic-abacus', 'ionic-abacus', () => new THREE.BoxGeometry(1.2, 0.12, 1.6), 'ionic-gold-abacus', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.9 }, [0, 8.62, 0]);
}

function addCorinthian(layers: Map<string, InstanceLayer>, asset: AssetTransform) {
  const part = (
    key: string,
    geometryKey: string,
    create: () => THREE.BufferGeometry,
    materialKey: string,
    color: number,
    options: { wireframe?: boolean; transparent?: boolean; opacity?: number },
    pos: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ) => addLayer(layers, key, 'pillars', asset, geometryKey, create, materialKey, color, options, matrix(pos, rotation));

  part('corinthian-base-box', 'corinthian-base-box', () => new THREE.BoxGeometry(1.4, 0.3, 1.4), 'corinthian-pink-base', 0xec4899, { wireframe: true, transparent: true, opacity: 0.65 }, [0, 0.15, 0]);
  part('corinthian-base-cyl', 'corinthian-base-cyl', () => new THREE.CylinderGeometry(0.68, 0.78, 0.25, 16), 'corinthian-pink-cyl', 0xec4899, { wireframe: true, transparent: true, opacity: 0.7 }, [0, 0.42, 0]);
  part('corinthian-base-ring', 'corinthian-base-ring', () => new THREE.TorusGeometry(0.56, 0.07, 6, 16), 'corinthian-gold-ring', 0xfbbf24, { transparent: true, opacity: 0.8 }, [0, 0.6, 0]);
  part('corinthian-shaft-wire', 'corinthian-shaft-wire', () => new THREE.CylinderGeometry(0.40, 0.50, 8, 16, 1, true), 'corinthian-pink-shaft', 0xec4899, { wireframe: true, transparent: true, opacity: 0.65 }, [0, 4.6, 0]);
  part('corinthian-shaft-core', 'corinthian-shaft-core', () => new THREE.CylinderGeometry(0.36, 0.46, 7.9, 16), 'corinthian-core', 0x0b051b, { transparent: true, opacity: 0.7 }, [0, 4.6, 0]);
  part('corinthian-capital', 'corinthian-capital', () => new THREE.CylinderGeometry(0.75, 0.42, 0.9, 16), 'corinthian-gold-capital', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.75 }, [0, 8.8, 0]);

  const leaf1 = geometry('corinthian-leaf1', () => new THREE.ConeGeometry(0.14, 0.5, 4));
  const leaf2 = geometry('corinthian-leaf2', () => new THREE.ConeGeometry(0.16, 0.6, 4));
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    part('corinthian-leaves-lower', 'corinthian-leaf1', () => leaf1, 'corinthian-green-leaves', 0x34d399, { wireframe: true, transparent: true, opacity: 0.85 }, [Math.cos(angle) * 0.48, 8.55, Math.sin(angle) * 0.48], [0.25 * Math.sin(angle), -angle, 0.25 * Math.cos(angle)]);
  }
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) * Math.PI * 2) / 8;
    part('corinthian-leaves-upper', 'corinthian-leaf2', () => leaf2, 'corinthian-pink-leaves', 0xec4899, { wireframe: true, transparent: true, opacity: 0.9 }, [Math.cos(angle) * 0.62, 8.95, Math.sin(angle) * 0.62], [0.38 * Math.sin(angle), -angle, 0.38 * Math.cos(angle)]);
  }
  part('corinthian-abacus', 'corinthian-abacus', () => new THREE.BoxGeometry(1.5, 0.18, 1.5), 'corinthian-gold-abacus', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.9 }, [0, 9.35, 0]);
  part('corinthian-finial', 'corinthian-finial', () => new THREE.OctahedronGeometry(0.14, 0), 'corinthian-pink-finial', 0xec4899, { transparent: true, opacity: 0.95 }, [0, 9.46, 0]);
}

function addTorii(layers: Map<string, InstanceLayer>, asset: AssetTransform, seed: number) {
  const height = 5.5 + r(seed, 23.45, 7.89) * 1.5;
  const width = 3.6 + r(seed, 23.45, 15.78) * 1.2;
  const thickness = 0.28 + r(seed, 23.45, 23.67) * 0.08;
  const box = () => geometry('torii-box-unit', () => new THREE.BoxGeometry(1, 1, 1));
  const post = () => geometry('torii-post-unit', () => new THREE.CylinderGeometry(0.8, 1, 1, 6));

  const add = (
    key: string,
    geo: THREE.BufferGeometry,
    matKey: string,
    color: number,
    options: { wireframe?: boolean; transparent?: boolean; opacity?: number },
    pos: [number, number, number],
    scale: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ) => addLayer(layers, key, 'torii', asset, `torii-${key}`, () => geo, matKey, color, options, matrix(pos, rotation, scale));

  for (const x of [-width / 2, width / 2]) {
    add('torii-bases', box(), 'torii-base', 0x0a0514, { transparent: true, opacity: 0.6 }, [x, 0.2, 0], [thickness * 1.5, 0.4, thickness * 1.5]);
    add('torii-posts', post(), 'torii-post', 0xec4899, { wireframe: true, transparent: true, opacity: 0.65 }, [x, height / 2, 0], [thickness, height, thickness]);
  }
  add('torii-top-beam', box(), 'torii-gold-top', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.8 }, [0, height - 0.1, 0], [width * 1.48, thickness * 1.1, thickness * 1.2]);
  for (const sign of [-1, 1]) {
    add('torii-eaves', box(), 'torii-gold-eaves', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.8 }, [sign * (width * 0.74 + 0.1), height - 0.1 + thickness * 0.15, 0], [0.4, thickness * 1.1, thickness * 1.2], [0, 0, sign < 0 ? 0.25 : -0.25]);
  }
  add('torii-crossbeam', box(), 'torii-cyan-crossbeam', 0x22d3ee, { wireframe: true, transparent: true, opacity: 0.6 }, [0, height * 0.76, 0], [width * 1.25, thickness * 0.7, thickness * 0.8]);
}

function addBamboo(layers: Map<string, InstanceLayer>, asset: AssetTransform, seed: number) {
  const baseH = 3.2 + r(seed, 43.21, 9.87) * 1.6;
  const midH = 2.5 + r(seed, 43.21, 19.74) * 1.2;
  const topH = 1.8 + r(seed, 43.21, 29.61);
  const baseW = 0.08 + r(seed, 43.21, 39.48) * 0.05;
  const midW = baseW * 0.8;
  const topW = midW * 0.75;
  const bendX1 = (r(seed, 43.21, 49.35) - 0.5) * 0.12;
  const bendZ1 = (r(seed, 43.21, 59.22) - 0.5) * 0.12;
  const bendX2 = (r(seed, 43.21, 69.09) - 0.5) * 0.16;
  const bendZ2 = (r(seed, 43.21, 78.96) - 0.5) * 0.16;
  const leafCount = Math.floor(2 + r(seed, 43.21, 88.83) * 3);
  const leafScale = 0.7 + r(seed, 43.21, 98.7) * 0.4;
  const firstBend = matrix([0, baseH, 0], [bendX1, 0, bendZ1]);
  const secondBend = compose(firstBend, matrix([0, midH, 0], [bendX2, 0, bendZ2]));
  const topNode = compose(secondBend, matrix([0, topH, 0]));

  const add = (
    key: string,
    geoKey: string,
    create: () => THREE.BufferGeometry,
    matKey: string,
    color: number,
    options: { wireframe?: boolean; transparent?: boolean; opacity?: number },
    local: THREE.Matrix4,
  ) => addLayer(layers, key, 'bamboo', asset, geoKey, create, matKey, color, options, local);

  add('bamboo-segment-base', 'bamboo-base-geometry', () => new THREE.CylinderGeometry(0.8, 1, 1, 6, 2), 'bamboo-base-green', 0x34d399, { wireframe: true, transparent: true, opacity: 0.6 }, matrix([0, baseH / 2, 0], [0, 0, 0], [baseW, baseH, baseW]));
  add('bamboo-segment-mid', 'bamboo-mid-geometry', () => new THREE.CylinderGeometry(0.75, 1, 1, 6, 2), 'bamboo-mid-green', 0x10b981, { wireframe: true, transparent: true, opacity: 0.65 }, compose(firstBend, matrix([0, midH / 2, 0], [0, 0, 0], [midW, midH, midW])));
  add('bamboo-segment-top', 'bamboo-top-geometry', () => new THREE.CylinderGeometry(0.7, 1, 1, 6, 1), 'bamboo-top-green', 0x059669, { wireframe: true, transparent: true, opacity: 0.7 }, compose(secondBend, matrix([0, topH / 2, 0], [0, 0, 0], [topW, topH, topW])));
  add('bamboo-rings-base', 'bamboo-base-ring-geometry', () => new THREE.TorusGeometry(1.15, 0.4, 4, 8), 'bamboo-gold-base-ring', 0xfbbf24, { transparent: true, opacity: 0.8 }, compose(matrix([0, baseH, 0], [Math.PI / 2, 0, 0], [baseW, 0.1, baseW])));
  add('bamboo-rings-mid', 'bamboo-mid-ring-geometry', () => new THREE.TorusGeometry(1.15, 0.3, 4, 8), 'bamboo-gold-mid-ring', 0xfbbf24, { transparent: true, opacity: 0.8 }, compose(firstBend, matrix([0, midH, 0], [Math.PI / 2, 0, 0], [midW, 0.1, midW])));

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI * 2) / leafCount;
    const leaf = compose(
      topNode,
      matrix([Math.cos(angle) * 0.25, -0.1, Math.sin(angle) * 0.25], [0.3, angle, 0.6], [leafScale, leafScale, leafScale]),
    );
    add('bamboo-leaves', 'bamboo-leaf-geometry', () => new THREE.ConeGeometry(0.18, 0.7, 4), 'bamboo-leaf-green', 0x34d399, { wireframe: true, transparent: true, opacity: 0.75 }, leaf);
    if (i >= leafCount) layers.get('bamboo-leaves')!.placements.pop();
  }
}

function addLantern(layers: Map<string, InstanceLayer>, asset: AssetTransform) {
  const add = (
    key: string,
    geoKey: string,
    create: () => THREE.BufferGeometry,
    matKey: string,
    color: number,
    options: { wireframe?: boolean; transparent?: boolean; opacity?: number },
    pos: [number, number, number],
  ) => addLayer(layers, key, 'lanterns', asset, geoKey, create, matKey, color, options, matrix(pos));
  add('lantern-base', 'lantern-base', () => new THREE.BoxGeometry(0.7, 0.3, 0.7), 'lantern-indigo-base', 0x1e1b4b, { wireframe: true, transparent: true, opacity: 0.65 }, [0, 0.15, 0]);
  add('lantern-post', 'lantern-post', () => new THREE.CylinderGeometry(0.16, 0.20, 0.8, 6), 'lantern-indigo-post', 0x1e1b4b, { wireframe: true, transparent: true, opacity: 0.6 }, [0, 0.65, 0]);
  add('lantern-platform', 'lantern-platform', () => new THREE.CylinderGeometry(0.55, 0.35, 0.2, 6), 'lantern-indigo-platform', 0x1e1b4b, { wireframe: true, transparent: true, opacity: 0.7 }, [0, 1.15, 0]);
  const color = asset.source.color || 0xfbbf24;
  add(`lantern-lightbox-${color}`, 'lantern-lightbox', () => new THREE.BoxGeometry(0.45, 0.45, 0.45), `lantern-lightbox-${color}`, color, { transparent: true, opacity: 0.85 }, [0, 1.45, 0]);
  add('lantern-roof', 'lantern-roof', () => new THREE.ConeGeometry(0.75, 0.35, 6), 'lantern-purple-roof', 0xa855f7, { wireframe: true, transparent: true, opacity: 0.8 }, [0, 1.8, 0]);
  add('lantern-jewel', 'lantern-jewel', () => new THREE.OctahedronGeometry(0.12, 0), 'lantern-gold-jewel', 0xfbbf24, { transparent: true, opacity: 0.9 }, [0, 2.05, 0]);
}

function addDiamondLamp(layers: Map<string, InstanceLayer>, asset: AssetTransform) {
  const add = (
    key: string,
    geoKey: string,
    create: () => THREE.BufferGeometry,
    matKey: string,
    color: number,
    options: { wireframe?: boolean; transparent?: boolean; opacity?: number },
    pos: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ) => addLayer(layers, key, 'diamondLamps', asset, geoKey, create, matKey, color, options, matrix(pos, rotation, scale));
  add('lamp-base', 'lamp-base', () => new THREE.CylinderGeometry(0.25, 0.35, 0.4, 6), 'lamp-indigo-base', 0x1e1b4b, { wireframe: true, transparent: true, opacity: 0.65 }, [0, 0.2, 0]);
  add('lamp-pole', 'lamp-pole', () => new THREE.CylinderGeometry(0.08, 0.12, 5, 6), 'lamp-indigo-pole', 0x6366f1, { wireframe: true, transparent: true, opacity: 0.6 }, [0, 2.5, 0]);
  add('lamp-bracket', 'lamp-bracket', () => new THREE.BoxGeometry(0.3, 0.15, 0.3), 'lamp-gold-bracket', 0xfbbf24, { transparent: true, opacity: 0.8 }, [0, 5.1, 0]);
  add('lamp-head', 'lamp-head', () => new THREE.OctahedronGeometry(0.45, 0), 'lamp-cyan-head', 0x22d3ee, { transparent: true, opacity: 0.9 }, [0, 5.5, 0], [0.4, 0.7, 0.2]);
  add('lamp-head-outline', 'lamp-head-outline', () => new THREE.OctahedronGeometry(0.45, 0), 'lamp-gold-outline', 0xfbbf24, { wireframe: true, transparent: true, opacity: 0.7 }, [0, 5.5, 0], [0.4, 0.7, 0.2], [1.08, 1.08, 1.08]);
}

function addHedge(layers: Map<string, InstanceLayer>, asset: AssetTransform, color: number) {
  addLayer(layers, `hedge-wire-${color}`, 'hedges', asset, `hedge-dodeca-${color}`, () => new THREE.DodecahedronGeometry(0.55, 0), `hedge-wire-${color}`, color, { wireframe: true, transparent: true, opacity: 0.65 }, matrix([0, 0.45, 0]));
  addLayer(layers, 'hedge-core', 'hedges', asset, 'hedge-core', () => new THREE.IcosahedronGeometry(0.42, 0), 'hedge-core', 0x064e3b, { transparent: true, opacity: 0.5 }, matrix([0, 0.45, 0]));
}

function createRenderData(instances: WildernessInstances): WildernessRenderData {
  const layers = new Map<string, InstanceLayer>();
  const assets: AssetTransform[] = [];
  const addAsset = (source: ScatterInstance, category: keyof WildernessInstances, index: number) => {
    const asset = makeTransform(source, category, index);
    assets.push(asset);
    return asset;
  };

  instances.pillars.forEach((source, index) => {
    const asset = addAsset(source, 'pillars', index);
    const order = source.order ?? (['doric', 'ionic', 'corinthian'] as const)[index % 3];
    if (order === 'ionic') addIonic(layers, asset);
    else if (order === 'corinthian') addCorinthian(layers, asset);
    else addDoric(layers, asset);
  });
  instances.torii.forEach((source, index) => {
    const asset = addAsset(source, 'torii', index);
    addTorii(layers, asset, source.seed || index);
  });
  instances.bamboo.forEach((source, index) => {
    const asset = addAsset(source, 'bamboo', index);
    addBamboo(layers, asset, source.seed || index);
  });
  instances.lanterns.forEach((source, index) => addLantern(layers, addAsset(source, 'lanterns', index)));
  instances.diamondLamps.forEach((source, index) => addDiamondLamp(layers, addAsset(source, 'diamondLamps', index)));
  instances.hedges.forEach((source, index) => {
    const asset = addAsset(source, 'hedges', index);
    addHedge(layers, asset, index % 2 === 0 ? 0x10b981 : 0x34d399);
  });

  return {
    assets,
    chunkKeys: [...new Set(assets.map((asset) => asset.chunkKey))],
    layers: [...layers.values()],
  };
}

export function getWildernessChunkSphere(
  chunkX: number,
  chunkZ: number,
  playerPos: THREE.Vector3,
  chunkSize: number,
  curvatureRadius?: number,
): THREE.Sphere {
  const centerX = chunkX * chunkSize + chunkSize / 2;
  const centerZ = chunkZ * chunkSize + chunkSize / 2;
  const half = chunkSize / 2;
  let minDrop = Number.POSITIVE_INFINITY;
  let maxDrop = Number.NEGATIVE_INFINITY;
  const nearestX = THREE.MathUtils.clamp(playerPos.x, centerX - half, centerX + half);
  const nearestZ = THREE.MathUtils.clamp(playerPos.z, centerZ - half, centerZ + half);
  const nearestDrop = sphereDrop(nearestX - playerPos.x, nearestZ - playerPos.z, curvatureRadius);
  minDrop = nearestDrop;
  maxDrop = nearestDrop;
  for (const dx of [-half, half]) {
    for (const dz of [-half, half]) {
      const drop = sphereDrop(centerX + dx - playerPos.x, centerZ + dz - playerPos.z, curvatureRadius);
      minDrop = Math.min(minDrop, drop);
      maxDrop = Math.max(maxDrop, drop);
    }
  }
  const minY = -maxDrop - 14;
  const maxY = -minDrop + 14;
  const horizontalRadius = half + 8;
  const verticalRadius = (maxY - minY) / 2;
  return new THREE.Sphere(
    new THREE.Vector3(centerX, (minY + maxY) / 2, centerZ),
    Math.hypot(horizontalRadius, horizontalRadius, verticalRadius),
  );
}

function chunkKeyToCoordinates(key: string): [number, number] {
  const [x, z] = key.split(',').map(Number);
  return [x, z];
}

export function InstancedWilderness({
  instances,
  playerPos,
  chunkSize,
}: {
  instances: WildernessInstances;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  chunkSize: number;
}) {
  const { camera } = useThree();
  const data = useMemo(() => createRenderData(instances), [instances]);
  const meshRefs = useRef(new Map<string, THREE.InstancedMesh>());
  const baseMatrices = useRef(new Map<AssetTransform, THREE.Matrix4>());
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projectionScreenMatrix = useMemo(() => new THREE.Matrix4(), []);
  const lastPlayerPosition = useMemo(() => new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0), []);
  const lastCameraMatrix = useMemo(() => new THREE.Matrix4(), []);
  const lastProjectionMatrix = useMemo(() => new THREE.Matrix4(), []);
  const hasLastCameraMatrix = useRef(false);
  const lastCurvatureRadius = useRef(Number.NaN);
  const lastData = useRef<WildernessRenderData | null>(null);
  const visibleChunks = useRef(new Set<string>());

  useFrame(() => {
    const player = playerPos.current;
    camera.updateMatrixWorld();
    const playerMoved = lastPlayerPosition.distanceToSquared(player) >= 0.0625;
    const dataChanged = lastData.current !== data;
    const placementsChanged = playerMoved || dataChanged;
    const curvatureRadius = useVillageTunerStore.getState().curvatureRadius;
    const curvatureChanged = curvatureRadius !== lastCurvatureRadius.current;
    const transformsChanged = placementsChanged || curvatureChanged;
    const cameraChanged = !hasLastCameraMatrix.current
      || camera.matrixWorld.elements.some((value, index) => Math.abs(value - lastCameraMatrix.elements[index]) > 0.0001);
    const projectionChanged = camera.projectionMatrix.elements.some(
      (value, index) => Math.abs(value - lastProjectionMatrix.elements[index]) > 0.0001,
    );
    if (!transformsChanged && !cameraChanged && !projectionChanged) return;

    if (transformsChanged) {
      baseMatrices.current.clear();
      for (const asset of data.assets) {
        const transform = new THREE.Matrix4();
        applyGlobeCurvatureMatrix(
          transform,
          asset.source.x,
          asset.source.baseY,
          asset.source.z,
          player,
          asset.scale,
          asset.rotationY,
          0,
          curvatureRadius,
        );
        baseMatrices.current.set(asset, transform);
      }
      lastPlayerPosition.copy(player);
      lastData.current = data;
      lastCurvatureRadius.current = curvatureRadius;
    }

    projectionScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionScreenMatrix);
    const nextVisibleChunks = new Set<string>();
    for (const key of data.chunkKeys) {
      const [chunkX, chunkZ] = chunkKeyToCoordinates(key);
      if (frustum.intersectsSphere(getWildernessChunkSphere(chunkX, chunkZ, player, chunkSize, curvatureRadius))) {
        nextVisibleChunks.add(key);
      }
    }
    let visibilityChanged = nextVisibleChunks.size !== visibleChunks.current.size;
    if (!visibilityChanged) {
      for (const key of nextVisibleChunks) {
        if (!visibleChunks.current.has(key)) {
          visibilityChanged = true;
          break;
        }
      }
    }
    visibleChunks.current = nextVisibleChunks;
    lastCameraMatrix.copy(camera.matrixWorld);
    lastProjectionMatrix.copy(camera.projectionMatrix);
    hasLastCameraMatrix.current = true;
    if (!transformsChanged && !visibilityChanged) return;

    const composed = new THREE.Matrix4();
    for (const layer of data.layers) {
      const mesh = meshRefs.current.get(layer.key);
      if (!mesh) continue;
      let count = 0;
      for (const placement of layer.placements) {
        if (!nextVisibleChunks.has(placement.asset.chunkKey)) continue;
        const base = baseMatrices.current.get(placement.asset);
        if (!base) continue;
        composed.multiplyMatrices(base, placement.localMatrix);
        mesh.setMatrixAt(count, composed);
        count++;
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="instanced-wilderness">
      {data.layers.map((layer) => {
        const defaultCapacity = layer.category === 'bamboo'
          ? 32768
          : layer.category === 'hedges' || layer.category === 'torii'
            ? 4096
            : 2048;
        const capacity = Math.max(defaultCapacity, layer.placements.length);
        return (
          <instancedMesh
            key={`${layer.key}:${capacity}`}
            ref={(mesh) => {
              if (mesh) meshRefs.current.set(layer.key, mesh);
              else meshRefs.current.delete(layer.key);
            }}
            args={[layer.geometry, layer.material, capacity]}
            count={0}
            matrixAutoUpdate={false}
            frustumCulled={false}
            dispose={null}
          />
        );
      })}
    </group>
  );
}
