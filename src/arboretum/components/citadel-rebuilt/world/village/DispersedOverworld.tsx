/**
 * Dispersed Overworld: Player-Centred Continuous Chunk Generation
 *
 * THE NEW ARCHITECTURE:
 * - The player is the atlas entity: chunks generate dynamically around playerPos.
 * - Chunk size: 40x40 units.
 * - Load radius: 220 units around player (closest first).
 * - Unload radius: 260 units (hysteresis prevents boundary flicker).
 * - Deterministic: hash(chunkX, chunkZ, seed) ensures visited chunks are identical across reloads.
 * - Density from town distance (scaled 1.5x for 900u border):
 *   - Town Core (r < 135): ZERO scatter (clean hand-crafted village).
 *   - Ramp-up (r in [135, 333]): Clusters rise smoothly.
 *   - Dense Plateau (r in [333, 522]): Peak density (2-4 clusters per chunk).
 *   - Fade-out (r in [522, 747]): Clusters thin out smoothly.
 *   - Barren Rim (r in [747, 900]): ZERO scatter (pure silence & ground grid).
 * - Colliders follow chunks: loaded chunk pillars & torii register colliders;
 *   unloaded chunks instantly remove their colliders (zero stale walls).
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  useVillageTunerStore,
  type DensityCurveSettings,
  DEFAULT_DENSITY_CURVE,
} from '@/core/state/villageTunerStore';
import { type VillageCollider } from './villageColliders';
import { InstancedWilderness } from './InstancedWilderness';

export const CHUNK_SIZE = 40.0;
export const LOAD_RADIUS = 220.0;
export const UNLOAD_RADIUS = 260.0; // 40-unit hysteresis band
export const CHUNK_BUDGET_PER_TICK = 6;

interface DispersedOverworldProps {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

export interface ScatterInstance {
  x: number;
  z: number;
  baseY: number;
  scale: [number, number, number];
  rotationY?: number;
  chunkKey: string;
  order?: 'doric' | 'ionic' | 'corinthian';
  seed?: number;
  color?: number;
}

export interface ChunkScatterData {
  key: string;
  chunkX: number;
  chunkZ: number;
  centerX: number;
  centerZ: number;
  rFromTown: number;
  density: number;
  bamboo: ScatterInstance[];
  hedges: ScatterInstance[];
  lanterns: ScatterInstance[];
  pillars: ScatterInstance[];
  torii: ScatterInstance[];
  diamondLamps: ScatterInstance[];
  colliders: VillageCollider[];
}

/**
 * 32-bit FNV-1a hash function for chunk coordinates.
 */
export function hashChunk(chunkX: number, chunkZ: number, worldSeed = 1337): number {
  const str = `${worldSeed}:${chunkX},${chunkZ}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function createChunkRng(seed: number) {
  let a = seed >>> 0;
  return function nextFloat(): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Reverse density curve D(r) in [0, 1].
 */
export function calculateDispersedDensity(
  r: number,
  curve: DensityCurveSettings = DEFAULT_DENSITY_CURVE
): number {
  const { coreMax, rampMax, plateauMax, fadeMax } = curve;
  if (r < coreMax) return 0;
  if (r < rampMax) {
    const u = (r - coreMax) / (rampMax - coreMax);
    return u * u * (3 - 2 * u); // smoothstep ramp
  }
  if (r <= plateauMax) return 1.0; // peak plateau
  if (r <= fadeMax) {
    const u = (fadeMax - r) / (fadeMax - plateauMax);
    return u * u * (3 - 2 * u); // smoothstep fade-out
  }
  return 0; // Barren rim!
}

/**
 * Deterministically generate scatter data and physical colliders for a single chunk.
 */
export function generateChunkData(
  chunkX: number,
  chunkZ: number,
  curve: DensityCurveSettings = DEFAULT_DENSITY_CURVE,
  densityMultiplier = 1.0
): ChunkScatterData {
  const key = `${chunkX},${chunkZ}`;
  const centerX = chunkX * CHUNK_SIZE + CHUNK_SIZE / 2;
  const centerZ = chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2;
  const rFromTown = Math.sqrt(centerX * centerX + centerZ * centerZ);
  const density = calculateDispersedDensity(rFromTown, curve) * Math.max(0.4, densityMultiplier);

  const data: ChunkScatterData = {
    key,
    chunkX,
    chunkZ,
    centerX,
    centerZ,
    rFromTown,
    density,
    bamboo: [],
    hedges: [],
    lanterns: [],
    pillars: [],
    torii: [],
    diamondLamps: [],
    colliders: [],
  };

  // Zero scatter if inside town core (r < coreMax) or barren rim (r > fadeMax)
  if (rFromTown < curve.coreMax || rFromTown > curve.fadeMax || density <= 0.01) {
    return data;
  }

  const seed = hashChunk(chunkX, chunkZ);
  const rng = createChunkRng(seed);

  // Clusters per chunk based on density:
  // In dense plateau: 2-3 clusters. In ramp/fade: 1 cluster.
  const clusterCount = density >= 0.8 ? 2 + Math.floor(rng() * 2) : 1;

  for (let c = 0; c < clusterCount; c++) {
    // Cluster origin within the chunk interior (leaving 4-unit margin)
    const offsetX = (rng() - 0.5) * (CHUNK_SIZE - 10);
    const offsetZ = (rng() - 0.5) * (CHUNK_SIZE - 10);
    const cx = centerX + offsetX;
    const cz = centerZ + offsetZ;
    const cr = Math.sqrt(cx * cx + cz * cz);

    // Strict boundary checks
    if (cr < curve.coreMax || cr > curve.fadeMax) continue;

    const clusterType = Math.floor(rng() * 6);

    if (clusterType === 0 || clusterType === 3) {
      // Bamboo Grove Cluster (multi-tiered segmented stalks with joint rings)
      const stalkCount = Math.round((6 + rng() * 6) * density);
      for (let s = 0; s < stalkCount; s++) {
        const sAngle = rng() * Math.PI * 2;
        const sDist = 1.2 + rng() * 3.5;
        data.bamboo.push({
          x: cx + Math.cos(sAngle) * sDist,
          z: cz + Math.sin(sAngle) * sDist,
          baseY: 0,
          scale: [0.85 + rng() * 0.3, 0.9 + rng() * 0.3, 0.85 + rng() * 0.3],
          rotationY: sAngle,
          chunkKey: key,
          seed: Math.floor(rng() * 100000),
        });
      }
      if (density > 0.4) {
        data.lanterns.push({
          x: cx + 0.4,
          z: cz - 0.4,
          baseY: 0,
          scale: [0.85, 0.85, 0.85],
          rotationY: rng() * Math.PI * 2,
          chunkKey: key,
          color: rng() > 0.5 ? 0xfbbf24 : 0x22d3ee,
        });
      }
    } else if (clusterType === 1) {
      // Classical Column Order Shrine (Doric, Ionic, or Corinthian with authentic capitals, no wording)
      const order = (['doric', 'ionic', 'corinthian'] as const)[Math.floor(rng() * 3)];
      data.pillars.push({
        x: cx,
        z: cz,
        baseY: 0,
        scale: [1.1, 1.2, 1.1],
        rotationY: rng() * Math.PI * 2,
        chunkKey: key,
        order,
        seed: Math.floor(rng() * 100000),
      });

      // Register physical obstacle collider for the column
      data.colliders.push({
        id: `chunk-pillar-${key}-${c}`,
        name: `Classical Column Shrine (${order.toUpperCase()}) (${key})`,
        kind: 'column',
        pos: [cx, 0, cz],
        scale: [1.2, 9.0, 1.2],
        sourceFile: 'DispersedOverworld.tsx',
      });

      const hedgeCount = Math.round(3 * density);
      for (let h = 0; h < hedgeCount; h++) {
        const hAngle = (h * Math.PI) / 1.5;
        data.hedges.push({
          x: cx + Math.cos(hAngle) * 3.0,
          z: cz + Math.sin(hAngle) * 3.0,
          baseY: 0,
          scale: [1.0, 0.9, 1.0],
          rotationY: hAngle,
          chunkKey: key,
        });
      }
    } else if (clusterType === 2) {
      // Full Aesthetic Torii Gate Portal (dual posts, kasagi eaves, nuki beam)
      const yaw = rng() * Math.PI * 2;
      data.torii.push({
        x: cx,
        z: cz,
        baseY: 0,
        scale: [1.1, 1.1, 1.1],
        rotationY: yaw,
        chunkKey: key,
        seed: Math.floor(rng() * 100000),
      });

      // Register 2 post colliders for torii arch
      const halfW = 2.4;
      const dx = Math.cos(yaw) * halfW;
      const dz = Math.sin(yaw) * halfW;
      data.colliders.push({
        id: `chunk-torii-${key}-${c}-L`,
        name: `Torii Fragment Post A (${key})`,
        kind: 'torii_post',
        pos: [cx - dx, 0, cz - dz],
        scale: [0.6, 7.0, 0.6],
        sourceFile: 'DispersedOverworld.tsx',
      });
      data.colliders.push({
        id: `chunk-torii-${key}-${c}-R`,
        name: `Torii Fragment Post B (${key})`,
        kind: 'torii_post',
        pos: [cx + dx, 0, cz + dz],
        scale: [0.6, 7.0, 0.6],
        sourceFile: 'DispersedOverworld.tsx',
      });

      if (density > 0.3) {
        data.diamondLamps.push({
          x: cx + Math.cos(yaw + Math.PI / 2) * 3.2,
          z: cz + Math.sin(yaw + Math.PI / 2) * 3.2,
          baseY: 0,
          scale: [0.9, 0.9, 0.9],
          chunkKey: key,
          color: 0x22d3ee,
        });
      }
    } else if (clusterType === 4) {
      // ASCII Hedge Thicket
      const bushCount = Math.round(4 * density);
      for (let b = 0; b < bushCount; b++) {
        const bAngle = (b * 1.5) % (Math.PI * 2);
        const bDist = 1.6 + b * 0.9;
        data.hedges.push({
          x: cx + Math.cos(bAngle) * bDist,
          z: cz + Math.sin(bAngle) * bDist,
          baseY: 0,
          scale: [0.95, 0.9, 0.95],
          rotationY: bAngle,
          chunkKey: key,
        });
      }
    } else {
      // Solitary Beacon Outpost (Diamond lamp on high rise)
      data.diamondLamps.push({
        x: cx,
        z: cz,
        baseY: 0,
        scale: [1.1, 1.1, 1.1],
        chunkKey: key,
        color: 0x22d3ee,
      });
      if (density > 0.5) {
        data.lanterns.push({
          x: cx - 1.8,
          z: cz + 1.2,
          baseY: 0,
          scale: [0.8, 0.8, 0.8],
          rotationY: rng() * Math.PI * 2,
          chunkKey: key,
          color: 0xfbbf24,
        });
      }
    }
  }

  return data;
}

/**
 * Module-level dynamic colliders registry for active chunks.
 */
let _activeChunkColliders: VillageCollider[] = [];

export function getActiveChunkColliders(): VillageCollider[] {
  return _activeChunkColliders;
}

/**
 * Helper to compute colliders across representative wild chunks (for tests/inspection).
 */
export function computeDispersedColliders(
  curve: DensityCurveSettings = DEFAULT_DENSITY_CURVE
): VillageCollider[] {
  const colliders: VillageCollider[] = [];
  for (let cx = 4; cx <= 6; cx++) {
    const chunk = generateChunkData(cx, cx, curve);
    colliders.push(...chunk.colliders);
  }
  return colliders;
}

/**
 * Helper to sample dispersed clusters across chunk space (for acceptance tests).
 */
export function generateDispersedClusters(
  curve: DensityCurveSettings = DEFAULT_DENSITY_CURVE
) {
  const result = {
    bamboo: [] as ScatterInstance[],
    hedges: [] as ScatterInstance[],
    lanterns: [] as ScatterInstance[],
    pillars: [] as ScatterInstance[],
    torii: [] as ScatterInstance[],
    diamondLamps: [] as ScatterInstance[],
  };
  for (let x = -10; x <= 10; x++) {
    for (let z = -10; z <= 10; z++) {
      const data = generateChunkData(x, z, curve);
      result.bamboo.push(...data.bamboo);
      result.hedges.push(...data.hedges);
      result.lanterns.push(...data.lanterns);
      result.pillars.push(...data.pillars);
      result.torii.push(...data.torii);
      result.diamondLamps.push(...data.diamondLamps);
    }
  }
  return result;
}

export function DispersedOverworld({ playerPos }: DispersedOverworldProps) {
  const densityCurve = useVillageTunerStore((state) => state.densityCurve);
  const hedgeDensity = useVillageTunerStore((state) => state.hedgeDensity);
  const bambooDensity = useVillageTunerStore((state) => state.bambooDensity);
  const atlasGridVisible = useVillageTunerStore((state) => state.atlasGridVisible);

  // Active loaded chunk dataset map
  const loadedChunksRef = useRef<Map<string, ChunkScatterData>>(new Map());
  const [activeChunksVersion, setActiveChunksVersion] = useState(0);

  // Streaming Tick (Runs at ~10Hz on a staggered clock)
  const tickAcc = useRef(0);
  const lastPlayerPos = useRef<[number, number]>([0, 0]);

  useFrame((_, delta) => {
    tickAcc.current += delta;
    if (tickAcc.current < 0.1) return; // 100ms streaming tick
    tickAcc.current = 0;

    const pp = playerPos.current;
    const pChunkX = Math.floor(pp.x / CHUNK_SIZE);
    const pChunkZ = Math.floor(pp.z / CHUNK_SIZE);

    const radiusChunks = Math.ceil(LOAD_RADIUS / CHUNK_SIZE);
    const unloadRadiusSq = UNLOAD_RADIUS * UNLOAD_RADIUS;

    const loaded = loadedChunksRef.current;
    let changed = false;

    // 1. Unload distant chunks (beyond UNLOAD_RADIUS)
    for (const [key, chunk] of loaded.entries()) {
      const dx = chunk.centerX - pp.x;
      const dz = chunk.centerZ - pp.z;
      if (dx * dx + dz * dz > unloadRadiusSq) {
        loaded.delete(key);
        changed = true;
      }
    }

    // 2. Identify required chunks within LOAD_RADIUS
    const candidateKeys: Array<{ chunkX: number; chunkZ: number; distSq: number }> = [];
    for (let ox = -radiusChunks; ox <= radiusChunks; ox++) {
      for (let oz = -radiusChunks; oz <= radiusChunks; oz++) {
        const cx = pChunkX + ox;
        const cz = pChunkZ + oz;
        const chunkCenterX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
        const chunkCenterZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
        const dx = chunkCenterX - pp.x;
        const dz = chunkCenterZ - pp.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= LOAD_RADIUS * LOAD_RADIUS) {
          const key = `${cx},${cz}`;
          if (!loaded.has(key)) {
            candidateKeys.push({ chunkX: cx, chunkZ: cz, distSq });
          }
        }
      }
    }

    // Sort closest to player first
    candidateKeys.sort((a, b) => a.distSq - b.distSq);

    // 3. Load up to BUDGET per tick
    let loadedCountThisTick = 0;
    for (let i = 0; i < Math.min(candidateKeys.length, CHUNK_BUDGET_PER_TICK); i++) {
      const c = candidateKeys[i];
      const chunkData = generateChunkData(
        c.chunkX,
        c.chunkZ,
        densityCurve,
        (hedgeDensity + bambooDensity) / 2
      );
      loaded.set(chunkData.key, chunkData);
      loadedCountThisTick++;
      changed = true;
    }

    const tunerState = useVillageTunerStore.getState();
    if (tunerState.chunksLoadedPerTick !== loadedCountThisTick) {
      tunerState.setChunksLoadedPerTick(loadedCountThisTick);
    }
    if (tunerState.loadedChunkCount !== loaded.size) {
      tunerState.setLoadedChunkCount(loaded.size);
    }

    if (changed) {
      // Rebuild active colliders list from currently loaded chunks
      const allChunkColliders: VillageCollider[] = [];
      for (const chunk of loaded.values()) {
        allChunkColliders.push(...chunk.colliders);
      }
      _activeChunkColliders = allChunkColliders;
      setActiveChunksVersion((v) => v + 1);
    }
  });

  // Consolidate instances from all loaded chunks
  const aggregatedInstances = useMemo(() => {
    const loaded = loadedChunksRef.current;
    const dataset = {
      bamboo: [] as ScatterInstance[],
      hedges: [] as ScatterInstance[],
      lanterns: [] as ScatterInstance[],
      pillars: [] as ScatterInstance[],
      torii: [] as ScatterInstance[],
      diamondLamps: [] as ScatterInstance[],
    };

    for (const chunk of loaded.values()) {
      dataset.bamboo.push(...chunk.bamboo);
      dataset.hedges.push(...chunk.hedges);
      dataset.lanterns.push(...chunk.lanterns);
      dataset.pillars.push(...chunk.pillars);
      dataset.torii.push(...chunk.torii);
      dataset.diamondLamps.push(...chunk.diamondLamps);
    }

    return dataset;
  }, [activeChunksVersion]);

  // Player Atlas Grid Wireframe
  const atlasGridWireframe = useMemo(() => {
    if (!atlasGridVisible) return null;
    const loaded = loadedChunksRef.current;
    const boxes: Array<{ cx: number; cz: number }> = [];
    for (const chunk of loaded.values()) {
      boxes.push({ cx: chunk.centerX, cz: chunk.centerZ });
    }
    return boxes;
  }, [atlasGridVisible, activeChunksVersion]);

  return (
    <group name="player-atlas-dispersed-overworld">
      <InstancedWilderness
        instances={aggregatedInstances}
        playerPos={playerPos}
        chunkSize={CHUNK_SIZE}
      />

      {/* Debug: Player Atlas Grid Wireframe Visualization */}
      {atlasGridVisible && atlasGridWireframe && (
        <group name="atlas-grid-outlines">
          {atlasGridWireframe.map((b) => (
            <mesh
              key={`atlas-chunk-${b.cx}-${b.cz}`}
              position={[b.cx, 0.05, b.cz]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[CHUNK_SIZE - 0.5, CHUNK_SIZE - 0.5]} />
              <meshBasicMaterial
                color={0x22d3ee}
                wireframe
                transparent
                opacity={0.35}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
