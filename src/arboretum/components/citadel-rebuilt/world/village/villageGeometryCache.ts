import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function safeMerge(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geoms.length === 0) return new THREE.BufferGeometry();
  const normalized = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  return mergeGeometries(normalized) || new THREE.BufferGeometry();
}

// ─── YEAR GEOMETRY BATCHING ──────────────────────────────────────────────────
export function createYearGeometries() {
  const baseGeom = new THREE.IcosahedronGeometry(0.52, 0);

  // Merge 20 pyramid facets
  const facetCones: THREE.BufferGeometry[] = [];
  const pos = baseGeom.attributes.position;
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < pos.count; i += 3) {
    const vA = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const vB = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const vC = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
    const center = vA.clone().add(vB).add(vC).divideScalar(3);
    const normal = center.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, normal);

    const cone = new THREE.ConeGeometry(0.16, 0.12, 3);
    cone.applyQuaternion(q);
    cone.translate(center.x, center.y, center.z);
    facetCones.push(cone);
  }
  const mergedFacets = safeMerge(facetCones);

  // Merge 12 vertex rivets
  const rivetSpheres: THREE.BufferGeometry[] = [];
  const uniqueVerts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!uniqueVerts.some((existing) => existing.distanceTo(v) < 0.05)) {
      uniqueVerts.push(v);
      const rivet = new THREE.OctahedronGeometry(0.038, 0);
      rivet.translate(v.x, v.y, v.z);
      rivetSpheres.push(rivet);
    }
  }
  const mergedRivets = safeMerge(rivetSpheres);
  const wireframeGeom = new THREE.IcosahedronGeometry(0.535, 0);
  const lodGeom = new THREE.IcosahedronGeometry(0.52, 0);

  return {
    baseGeom,
    mergedFacets,
    mergedRivets,
    wireframeGeom,
    lodGeom,
  };
}

// ─── SEASON GEOMETRY BATCHING (4 VARIANTS) ───────────────────────────────────
export function createSeasonGeometries() {
  const baseGeom = new THREE.IcosahedronGeometry(0.48, 0);
  const pos = baseGeom.attributes.position;
  const up = new THREE.Vector3(0, 1, 0);

  // 12 Spikes merged
  const spikeCones: THREE.BufferGeometry[] = [];
  const uniqueVerts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!uniqueVerts.some((item) => item.distanceTo(v) < 0.05)) {
      uniqueVerts.push(v);
      const normal = v.clone().normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      const cone = new THREE.ConeGeometry(0.075, 0.28, 4);
      cone.applyQuaternion(quat);
      cone.translate(v.x, v.y, v.z);
      spikeCones.push(cone);
    }
  }
  const mergedSpikes = safeMerge(spikeCones);

  // 1. Spring: Merged Sakura Blossom Petals
  const springPetals: THREE.BufferGeometry[] = [];
  uniqueVerts.slice(0, 10).forEach((v, idx) => {
    const normal = v.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    const offset = new THREE.Vector3(
      Math.sin(idx * 1.8) * 0.12,
      Math.cos(idx * 2.1) * 0.12,
      Math.sin(idx * 3.4) * 0.12,
    );
    const bPos = v.clone().multiplyScalar(0.92).add(offset);

    for (let pIdx = 0; pIdx < 5; pIdx++) {
      const angle = (pIdx * Math.PI * 2) / 5;
      const px = Math.cos(angle) * 0.045;
      const pz = Math.sin(angle) * 0.045;
      const petal = new THREE.CircleGeometry(0.038, 5);
      petal.rotateX(-Math.PI / 2);
      petal.rotateY(angle);
      petal.applyQuaternion(quat);
      petal.translate(bPos.x + px, bPos.y + 0.01, bPos.z + pz);
      springPetals.push(petal);
    }
  });
  const mergedSpringTrim = safeMerge(springPetals);

  // 2. Summer: Merged Sunburst Flares & Radiant Spores
  const summerFlares: THREE.BufferGeometry[] = [];
  uniqueVerts.forEach((v, idx) => {
    if (idx % 2 === 0) {
      const flare = new THREE.OctahedronGeometry(0.065, 0);
      const normal = v.clone().normalize();
      flare.translate(v.x + normal.x * 0.18, v.y + normal.y * 0.18, v.z + normal.z * 0.18);
      summerFlares.push(flare);
    }
  });
  const mergedSummerTrim = safeMerge(summerFlares);

  // 3. Autumn: Merged Harvest Ember & Fallen Leaf Flecks
  const autumnLeaves: THREE.BufferGeometry[] = [];
  uniqueVerts.slice(0, 10).forEach((v, idx) => {
    const leaf = new THREE.BoxGeometry(0.07, 0.015, 0.07);
    leaf.rotateX(idx * 0.6);
    leaf.rotateY(idx * 1.1);
    leaf.translate(v.x * 0.95, v.y * 0.95, v.z * 0.95);
    autumnLeaves.push(leaf);
  });
  const mergedAutumnTrim = safeMerge(autumnLeaves);

  // 4. Winter: Merged Frost Crystals & Ice Cap Rims (Still, no glitter)
  const winterFrost: THREE.BufferGeometry[] = [];
  uniqueVerts.forEach((v) => {
    const frostCap = new THREE.RingGeometry(0.06, 0.11, 6);
    const normal = v.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    frostCap.applyQuaternion(quat);
    frostCap.translate(v.x * 0.98, v.y * 0.98, v.z * 0.98);
    winterFrost.push(frostCap);
  });
  const mergedWinterTrim = safeMerge(winterFrost);
  const lodGeom = new THREE.IcosahedronGeometry(0.48, 0);

  return {
    baseGeom,
    mergedSpikes,
    springTrim: mergedSpringTrim,
    summerTrim: mergedSummerTrim,
    autumnTrim: mergedAutumnTrim,
    winterTrim: mergedWinterTrim,
    lodGeom,
  };
}

// ─── MONTH GEOMETRY BATCHING (12 CALENDAR VARIANTS) ───────────────────────────
export function createMonthGeometries() {
  const baseCubeGeom = new THREE.BoxGeometry(0.82, 0.82, 0.82);

  // Merged 3 seam splitters + 8 corner brackets with rivets
  const parts: THREE.BufferGeometry[] = [];
  // X, Y, Z seam grid splitters
  parts.push(new THREE.BoxGeometry(0.824, 0.035, 0.824));
  parts.push(new THREE.BoxGeometry(0.035, 0.824, 0.824));
  parts.push(new THREE.BoxGeometry(0.824, 0.824, 0.035));

  // 8 Corner brackets
  const d = 0.355;
  const corners = [
    [-d, -d, -d], [d, -d, -d], [-d, d, -d], [d, d, -d],
    [-d, -d, d],  [d, -d, d],  [-d, d, d],  [d, d, d],
  ];
  corners.forEach(([cx, cy, cz]) => {
    const b = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    b.translate(cx, cy, cz);
    parts.push(b);
  });
  const mergedSeamsAndBrackets = safeMerge(parts);

  // 12 Distinct Month Face Motifs (Front & Back Faces)
  const monthMotifs: Record<number, THREE.BufferGeometry> = {};
  for (let m = 1; m <= 12; m++) {
    const motifParts: THREE.BufferGeometry[] = [];
    const zOffset = 0.415; // Placed right on the front and back faces

    [-zOffset, zOffset].forEach((zf) => {
      if (m === 1) {
        // Jan: Ice Chisel / Keystone rune
        const g1 = new THREE.BoxGeometry(0.12, 0.38, 0.02);
        g1.translate(0, 0, zf);
        const g2 = new THREE.BoxGeometry(0.32, 0.08, 0.02);
        g2.translate(0, 0.15, zf);
        motifParts.push(g1, g2);
      } else if (m === 2) {
        // Feb: Dormant Sprout Seed rune
        const g1 = new THREE.OctahedronGeometry(0.14, 0);
        g1.scale(0.8, 1.4, 0.2);
        g1.translate(0, -0.05, zf);
        motifParts.push(g1);
      } else if (m === 3) {
        // Mar: Vernal Frond Motif
        const g1 = new THREE.BoxGeometry(0.05, 0.42, 0.02);
        g1.rotateZ(0.2);
        g1.translate(0, 0, zf);
        const g2 = new THREE.OctahedronGeometry(0.08, 0);
        g2.translate(0.1, 0.14, zf);
        motifParts.push(g1, g2);
      } else if (m === 4) {
        // Apr: Sakura Rosette Motif
        const g1 = new THREE.RingGeometry(0.06, 0.18, 5);
        g1.translate(0, 0, zf);
        motifParts.push(g1);
      } else if (m === 5) {
        // May: Maypole Sun-Spiral Motif
        const g1 = new THREE.RingGeometry(0.08, 0.16, 8);
        g1.translate(0, 0, zf);
        const g2 = new THREE.BoxGeometry(0.38, 0.04, 0.02);
        g2.translate(0, 0, zf);
        motifParts.push(g1, g2);
      } else if (m === 6) {
        // Jun: Solar Disk Solstice Crest
        const g1 = new THREE.CircleGeometry(0.16, 8);
        g1.translate(0, 0, zf);
        const g2 = new THREE.RingGeometry(0.2, 0.24, 8);
        g2.translate(0, 0, zf);
        motifParts.push(g1, g2);
      } else if (m === 7) {
        // Jul: Full Flare Corona
        const g1 = new THREE.OctahedronGeometry(0.2, 0);
        g1.scale(1.2, 1.2, 0.15);
        g1.translate(0, 0, zf);
        motifParts.push(g1);
      } else if (m === 8) {
        // Aug: Grain Sheaf / Harvest Sickle
        const g1 = new THREE.TorusGeometry(0.18, 0.03, 4, 12, Math.PI);
        g1.translate(0, 0, zf);
        const g2 = new THREE.BoxGeometry(0.04, 0.32, 0.02);
        g2.translate(-0.16, -0.1, zf);
        motifParts.push(g1, g2);
      } else if (m === 9) {
        // Sep: Balanced Equinox Scale
        const g1 = new THREE.BoxGeometry(0.44, 0.03, 0.02);
        g1.translate(0, 0.08, zf);
        const g2 = new THREE.OctahedronGeometry(0.07, 0);
        g2.translate(-0.18, 0, zf);
        const g3 = new THREE.OctahedronGeometry(0.07, 0);
        g3.translate(0.18, 0, zf);
        motifParts.push(g1, g2, g3);
      } else if (m === 10) {
        // Oct: Fallen Maple Leaf Motif
        const g1 = new THREE.ConeGeometry(0.18, 0.32, 3);
        g1.translate(0, 0.05, zf);
        motifParts.push(g1);
      } else if (m === 11) {
        // Nov: Dying Ember Torch
        const g1 = new THREE.CylinderGeometry(0.04, 0.06, 0.36, 4);
        g1.translate(0, -0.06, zf);
        const g2 = new THREE.OctahedronGeometry(0.1, 0);
        g2.translate(0, 0.14, zf);
        motifParts.push(g1, g2);
      } else {
        // Dec: Solstice Star / Year Lock
        const g1 = new THREE.RingGeometry(0.1, 0.18, 4);
        g1.translate(0, 0, zf);
        const g2 = new THREE.OctahedronGeometry(0.08, 0);
        g2.translate(0, 0, zf);
        motifParts.push(g1, g2);
      }
    });

    monthMotifs[m] = safeMerge(motifParts);
  }

  const lodGeom = new THREE.BoxGeometry(0.82, 0.82, 0.82);

  return {
    baseCubeGeom,
    mergedSeamsAndBrackets,
    monthMotifs,
    lodGeom,
  };
}

// ─── DAY GEOMETRY BATCHING (WITH VISIBLE EMBER CORE & 6 SEEDED VARIANTS) ─────
export interface DayVariantGeomSet {
  rockGeom: THREE.BufferGeometry;
  mergedFlakes: THREE.BufferGeometry;
  emberCoreGeom: THREE.BufferGeometry;
  lodGeom: THREE.BufferGeometry;
}

export function createDayGeometries() {
  const variants: DayVariantGeomSet[] = [];

  // 6 distinct dark rock variants with unique facet orientations & flake layouts
  const tilts = [
    [0, 0, 0],
    [0.25, 0.8, -0.2],
    [-0.4, 1.6, 0.3],
    [0.3, -1.2, -0.4],
    [-0.2, 2.4, 0.25],
    [0.45, -2.1, 0.15],
  ];

  for (let v = 0; v < 6; v++) {
    const rock = new THREE.DodecahedronGeometry(0.55, 1);
    const pos = rock.attributes.position;
    const seedOffset = v * 17.83;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const seed = seedOffset + i * 19.37 + x * 5.2 + y * 8.3 + z * 13.1;
      const noise = ((Math.sin(seed * 43758.5453) * 10000) % 1 + 1) % 1;
      const disp = 0.80 + noise * 0.44;
      pos.setXYZ(i, x * disp, y * (0.86 + noise * 0.38), z * disp);
    }

    // Apply facet orientation tilt to vertex positions
    const [tx, ty, tz] = tilts[v];
    rock.rotateX(tx);
    rock.rotateY(ty);
    rock.rotateZ(tz);
    rock.computeVertexNormals();

    // 3 distinct detached flake layouts
    const flakes: THREE.BufferGeometry[] = [];
    if (v % 3 === 0) {
      const f1 = new THREE.TetrahedronGeometry(0.07, 0);
      f1.translate(0.42, -0.28, 0.25);
      const f2 = new THREE.TetrahedronGeometry(0.06, 0);
      f2.translate(-0.38, 0.32, -0.2);
      flakes.push(f1, f2);
    } else if (v % 3 === 1) {
      const f1 = new THREE.TetrahedronGeometry(0.065, 0);
      f1.translate(-0.44, -0.15, 0.3);
      const f2 = new THREE.TetrahedronGeometry(0.055, 0);
      f2.translate(0.28, 0.38, -0.25);
      const f3 = new THREE.TetrahedronGeometry(0.05, 0);
      f3.translate(0.1, -0.42, -0.32);
      flakes.push(f1, f2, f3);
    } else {
      const f1 = new THREE.TetrahedronGeometry(0.07, 0);
      f1.translate(0.35, 0.35, 0.35);
      const f2 = new THREE.TetrahedronGeometry(0.06, 0);
      f2.translate(-0.32, -0.35, -0.3);
      flakes.push(f1, f2);
    }
    const mergedFlakes = safeMerge(flakes);

    // Visible Ember Core peeking through stone fissures
    const emberCoreGeom = new THREE.DodecahedronGeometry(0.28, 0);
    const lodGeom = new THREE.DodecahedronGeometry(0.52, 0);

    variants.push({
      rockGeom: rock,
      mergedFlakes,
      emberCoreGeom,
      lodGeom,
    });
  }

  // Base fallback matching variant 0
  return {
    rockGeom: variants[0].rockGeom,
    mergedFlakes: variants[0].mergedFlakes,
    emberCoreGeom: variants[0].emberCoreGeom,
    lodGeom: variants[0].lodGeom,
    variants,
  };
}

// ─── MINDMAP GEOMETRY BATCHING (4 SEEDED PALE TINT VARIANTS) ────────────────
export interface MindmapVariantGeomSet {
  baseOctahedron: THREE.BufferGeometry;
  mergedGlintsAndCore: THREE.BufferGeometry;
  lodGeom: THREE.BufferGeometry;
}

export function createMindmapGeometries() {
  const variants: MindmapVariantGeomSet[] = [];

  const scales: [number, number, number][] = [
    [1.0, 1.0, 1.0],      // Standard
    [0.94, 1.08, 0.94],   // Tall & Slender
    [1.06, 0.94, 1.06],   // Wide & Grounded
    [1.0, 1.02, 1.0],     // Prismatic Bevel
  ];

  for (let v = 0; v < 4; v++) {
    const baseOctahedron = new THREE.OctahedronGeometry(0.58, 0);
    const [sx, sy, sz] = scales[v];
    baseOctahedron.scale(sx, sy, sz);

    const glints: THREE.BufferGeometry[] = [];
    const apexPts = [
      [0, 0.58 * sy, 0], [0, -0.58 * sy, 0], [0.58 * sx, 0, 0],
      [-0.58 * sx, 0, 0], [0, 0, 0.58 * sz], [0, 0, -0.58 * sz],
    ];
    apexPts.forEach(([ax, ay, az]) => {
      const g = new THREE.OctahedronGeometry(0.03, 0);
      g.translate(ax, ay, az);
      glints.push(g);
    });

    const innerDiamond = new THREE.OctahedronGeometry(0.28, 0);
    if (v === 3) innerDiamond.rotateY(Math.PI / 4);
    glints.push(innerDiamond);

    const mergedGlintsAndCore = safeMerge(glints);
    const lodGeom = new THREE.OctahedronGeometry(0.58, 0);
    lodGeom.scale(sx, sy, sz);

    variants.push({
      baseOctahedron,
      mergedGlintsAndCore,
      lodGeom,
    });
  }

  return {
    baseOctahedron: variants[0].baseOctahedron,
    mergedGlintsAndCore: variants[0].mergedGlintsAndCore,
    lodGeom: variants[0].lodGeom,
    variants,
  };
}
