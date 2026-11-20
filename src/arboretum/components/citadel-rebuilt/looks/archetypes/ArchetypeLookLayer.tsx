import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getActiveCurvatureRadius,
  livePlayerWorldPos,
  sphereDrop,
  WORLD_CURVATURE_RADIUS,
} from '../../RebuiltWorldShared';

export type ArchetypeLookId =
  | 'crt'
  | 'ukiyoe'
  | 'cathedral'
  | 'blueprint'
  | 'biolume'
  | 'kintsugi'
  | 'solarpunk'
  | 'noir';

interface ArchetypeStyleSpec {
  id: ArchetypeLookId;
  modeId: number;
  horizonSrgb: readonly [number, number, number];
  fogNear: number;
  fogFar: number;
  ambientHex: number;
  ambientIntensity: number;
  dirHex1: number;
  dirInt1: number;
  dirHex2: number;
  dirInt2: number;
  roughness: number;
  metalness: number;
  emissiveMult: number;
  emissiveIntensity: number;
  flatShading?: boolean;
  palette: {
    dark: [number, number, number];
    green: [number, number, number];
    cyan: [number, number, number];
    purple: [number, number, number];
    gold: [number, number, number];
  };
}

const ARCHETYPE_SPECS: Record<ArchetypeLookId, ArchetypeStyleSpec> = {
  crt: {
    id: 'crt',
    modeId: 0,
    horizonSrgb: [0.02, 0.14, 0.05],
    fogNear: 40,
    fogFar: 180,
    ambientHex: 0x16a34a,
    ambientIntensity: 0.72,
    dirHex1: 0x39ff14,
    dirInt1: 1.5,
    dirHex2: 0xffb000,
    dirInt2: 0.55,
    roughness: 0.35,
    metalness: 0.45,
    emissiveMult: 0.38,
    emissiveIntensity: 0.75,
    palette: {
      dark: [0.02, 0.12, 0.04],
      green: [0.15, 0.95, 0.38],
      cyan: [0.22, 1.0, 0.52],
      purple: [0.12, 0.78, 0.32],
      gold: [1.0, 0.76, 0.14],
    },
  },
  ukiyoe: {
    id: 'ukiyoe',
    modeId: 1,
    horizonSrgb: [0.93, 0.87, 0.75],
    fogNear: 46,
    fogFar: 195,
    ambientHex: 0xf4ebd9,
    ambientIntensity: 0.85,
    dirHex1: 0xffe5b4,
    dirInt1: 1.45,
    dirHex2: 0x1d3557,
    dirInt2: 0.65,
    roughness: 0.88,
    metalness: 0.05,
    emissiveMult: 0.16,
    emissiveIntensity: 0.28,
    flatShading: true,
    palette: {
      dark: [0.11, 0.20, 0.34],
      green: [0.26, 0.48, 0.38],
      cyan: [0.16, 0.36, 0.56],
      purple: [0.85, 0.24, 0.26],
      gold: [0.95, 0.84, 0.65],
    },
  },
  cathedral: {
    id: 'cathedral',
    modeId: 2,
    horizonSrgb: [0.12, 0.06, 0.22],
    fogNear: 42,
    fogFar: 185,
    ambientHex: 0x9d4edd,
    ambientIntensity: 0.75,
    dirHex1: 0xffb703,
    dirInt1: 1.75,
    dirHex2: 0x3a86ff,
    dirInt2: 0.8,
    roughness: 0.25,
    metalness: 0.55,
    emissiveMult: 0.35,
    emissiveIntensity: 0.65,
    palette: {
      dark: [0.14, 0.09, 0.22],
      green: [0.08, 0.68, 0.52],
      cyan: [0.16, 0.48, 0.95],
      purple: [0.82, 0.14, 0.38],
      gold: [1.0, 0.76, 0.18],
    },
  },
  blueprint: {
    id: 'blueprint',
    modeId: 3,
    horizonSrgb: [0.06, 0.24, 0.48],
    fogNear: 48,
    fogFar: 205,
    ambientHex: 0x90e0ef,
    ambientIntensity: 0.85,
    dirHex1: 0xffffff,
    dirInt1: 1.55,
    dirHex2: 0x00b4d8,
    dirInt2: 0.7,
    roughness: 0.65,
    metalness: 0.15,
    emissiveMult: 0.28,
    emissiveIntensity: 0.55,
    palette: {
      dark: [0.05, 0.20, 0.42],
      green: [0.58, 0.86, 0.98],
      cyan: [0.88, 0.96, 1.0],
      purple: [0.38, 0.72, 0.96],
      gold: [1.0, 0.86, 0.42],
    },
  },
  biolume: {
    id: 'biolume',
    modeId: 4,
    horizonSrgb: [0.02, 0.12, 0.24],
    fogNear: 34,
    fogFar: 165,
    ambientHex: 0x00b4d8,
    ambientIntensity: 0.7,
    dirHex1: 0x00f5d4,
    dirInt1: 1.55,
    dirHex2: 0xf15bb5,
    dirInt2: 0.85,
    roughness: 0.3,
    metalness: 0.35,
    emissiveMult: 0.45,
    emissiveIntensity: 0.85,
    palette: {
      dark: [0.03, 0.14, 0.26],
      green: [0.0, 0.95, 0.78],
      cyan: [0.12, 0.78, 0.98],
      purple: [0.92, 0.28, 0.74],
      gold: [0.65, 1.0, 0.38],
    },
  },
  kintsugi: {
    id: 'kintsugi',
    modeId: 5,
    horizonSrgb: [0.10, 0.09, 0.12],
    fogNear: 44,
    fogFar: 190,
    ambientHex: 0xffe5b4,
    ambientIntensity: 0.75,
    dirHex1: 0xffd166,
    dirInt1: 1.75,
    dirHex2: 0x8d99ae,
    dirInt2: 0.55,
    roughness: 0.32,
    metalness: 0.68,
    emissiveMult: 0.25,
    emissiveIntensity: 0.5,
    palette: {
      dark: [0.12, 0.11, 0.14],
      green: [0.24, 0.25, 0.28],
      cyan: [0.85, 0.83, 0.78],
      purple: [0.20, 0.18, 0.22],
      gold: [1.0, 0.80, 0.22],
    },
  },
  solarpunk: {
    id: 'solarpunk',
    modeId: 6,
    horizonSrgb: [0.84, 0.94, 0.80],
    fogNear: 46,
    fogFar: 195,
    ambientHex: 0xd8f3dc,
    ambientIntensity: 0.88,
    dirHex1: 0xffe066,
    dirInt1: 1.65,
    dirHex2: 0x40916c,
    dirInt2: 0.65,
    roughness: 0.45,
    metalness: 0.35,
    emissiveMult: 0.22,
    emissiveIntensity: 0.42,
    palette: {
      dark: [0.16, 0.32, 0.24],
      green: [0.28, 0.72, 0.48],
      cyan: [0.58, 0.88, 0.82],
      purple: [0.84, 0.62, 0.26],
      gold: [0.98, 0.84, 0.38],
    },
  },
  noir: {
    id: 'noir',
    modeId: 7,
    horizonSrgb: [0.05, 0.05, 0.07],
    fogNear: 36,
    fogFar: 165,
    ambientHex: 0x9ca3af,
    ambientIntensity: 0.68,
    dirHex1: 0xe5e7eb,
    dirInt1: 1.55,
    dirHex2: 0xe6193c,
    dirInt2: 0.85,
    roughness: 0.28,
    metalness: 0.62,
    emissiveMult: 0.25,
    emissiveIntensity: 0.55,
    palette: {
      dark: [0.07, 0.07, 0.09],
      green: [0.28, 0.29, 0.32],
      cyan: [0.76, 0.78, 0.82],
      purple: [0.90, 0.10, 0.24],
      gold: [0.92, 0.92, 0.95],
    },
  },
};

/* ──────────────────────  SKY DOME SHADER  ────────────────────── */

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  uniform int uMode;
  varying vec3 vDir;

  vec3 toLinear(vec3 srgb) {
    return pow(max(srgb, vec3(0.0)), vec3(2.2));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);
    vec3 col = vec3(0.05);

    if (uMode == 0) {
      // CRT Phosphor: Dark terminal dome with green vector latitude/longitude rings & falling glyph rain
      vec3 bg = mix(vec3(0.02, 0.14, 0.05), vec3(0.005, 0.03, 0.01), smoothstep(0.0, 0.6, h));
      float lat = smoothstep(0.02, 0.0, abs(fract(h * 12.0) - 0.5));
      float lon = smoothstep(0.02, 0.0, abs(fract(atan(d.x, d.z) * 3.82) - 0.5));
      float rain = step(0.92, fract(hash(vec2(floor(atan(d.x, d.z) * 24.0), floor(h * 18.0 - uTime * 2.5)))));
      col = bg + vec3(0.15, 0.95, 0.38) * (lat * 0.25 + lon * 0.2 + rain * 0.45);
    } else if (uMode == 1) {
      // Ukiyo-e Woodblock: Washi cream sky, bokashi Prussian blue zenith, giant vermilion sun & woodgrain
      vec3 washi = vec3(0.95, 0.89, 0.77);
      vec3 bokashi = vec3(0.12, 0.24, 0.42);
      col = mix(washi, bokashi, smoothstep(0.15, 0.78, h));
      vec3 sunDir = normalize(vec3(0.0, 0.22, -0.97));
      float sunAngle = acos(clamp(dot(d, sunDir), -1.0, 1.0));
      if (sunAngle < 0.16) {
        col = vec3(0.88, 0.22, 0.20);
      }
      // Woodblock horizontal grain lines
      col += sin(h * 180.0 + sin(d.x * 12.0) * 2.0) * 0.018;
    } else if (uMode == 2) {
      // Stained Cathedral: Gothic leaded stained-glass ribs & glowing rose-window clerestory
      vec3 ruby = vec3(0.78, 0.10, 0.32);
      vec3 sapphire = vec3(0.10, 0.36, 0.88);
      vec3 gold = vec3(1.0, 0.74, 0.16);
      float a = atan(d.x, d.z);
      float panel = fract(a * 3.82);
      float rib = smoothstep(0.04, 0.0, abs(panel - 0.5)) + smoothstep(0.03, 0.0, abs(fract(h * 7.0) - 0.5));
      vec3 glass = mix(sapphire, ruby, step(0.5, fract(a * 1.91 + floor(h * 7.0) * 0.5)));
      glass = mix(glass, gold, smoothstep(0.65, 0.95, sin(a * 12.0) * cos(h * 14.0)));
      col = mix(glass * (0.45 + 0.45 * smoothstep(-0.1, 0.5, h)), vec3(0.03, 0.02, 0.05), clamp(rib, 0.0, 1.0));
    } else if (uMode == 3) {
      // Blueprint Atelier: Prussian cyanotype paper with white protractor degree ticks & celestial astrolabe arcs
      vec3 cyanBase = mix(vec3(0.06, 0.24, 0.48), vec3(0.04, 0.15, 0.34), smoothstep(0.0, 0.8, h));
      float a = atan(d.x, d.z);
      float degLine = smoothstep(0.012, 0.0, abs(fract(a * 5.73) - 0.5));
      float altLine = smoothstep(0.012, 0.0, abs(fract(h * 10.0) - 0.5));
      col = mix(cyanBase, vec3(0.88, 0.96, 1.0), clamp((degLine + altLine) * 0.35, 0.0, 1.0));
    } else if (uMode == 4) {
      // Biolume Abyss: Deep midnight ocean surface caustic shimmer & drifting aqua aurora currents
      vec3 abyss = mix(vec3(0.02, 0.13, 0.25), vec3(0.01, 0.04, 0.12), smoothstep(0.0, 0.7, h));
      float wave = sin(d.x * 9.0 + uTime * 0.8) * cos(d.z * 9.0 - uTime * 0.6);
      float caustic = smoothstep(0.35, 0.85, wave) * smoothstep(0.0, 0.6, h);
      col = abyss + vec3(0.0, 0.95, 0.82) * caustic * 0.42 + vec3(0.88, 0.22, 0.68) * pow(max(0.0, -wave), 3.0) * 0.22;
    } else if (uMode == 5) {
      // Gilded Kintsugi: Matte charcoal ceramic dome fractured with glowing veins of molten 24k gold
      vec3 obsidian = mix(vec3(0.11, 0.10, 0.13), vec3(0.05, 0.05, 0.07), smoothstep(0.0, 0.7, h));
      float crack = abs(sin(d.x * 7.0 + sin(d.z * 5.0) * 1.8) * cos(h * 9.0 + sin(d.x * 6.0)));
      float goldSeam = smoothstep(0.035, 0.0, crack);
      col = mix(obsidian, vec3(1.0, 0.82, 0.26), goldSeam * (0.75 + 0.25 * sin(uTime * 2.0)));
    } else if (uMode == 6) {
      // Solarpunk Glasshouse: Sunlit Art-Nouveau wrought-iron & brass conservatory glass dome
      vec3 sky = mix(vec3(0.86, 0.95, 0.82), vec3(0.38, 0.78, 0.68), smoothstep(0.0, 0.75, h));
      float a = atan(d.x, d.z);
      float arch = smoothstep(0.025, 0.0, abs(fract(a * 3.82 + sin(h * 4.0) * 0.15) - 0.5));
      float ring = smoothstep(0.025, 0.0, abs(fract(h * 6.0) - 0.5));
      vec3 sunDir = normalize(vec3(0.25, 0.45, -0.85));
      float sun = pow(max(dot(d, sunDir), 0.0), 12.0);
      col = sky + vec3(1.0, 0.92, 0.55) * sun * 0.55;
      col = mix(col, vec3(0.76, 0.58, 0.22), clamp(arch + ring, 0.0, 1.0) * 0.55);
    } else {
      // Velvet Noir: Stormy monochrome midnight sky with crimson neon horizon glow & rain streaks
      vec3 night = mix(vec3(0.09, 0.09, 0.12), vec3(0.02, 0.02, 0.03), smoothstep(0.0, 0.65, h));
      float neonGlow = pow(max(0.0, 1.0 - abs(h - 0.04) * 7.0), 2.0);
      float rain = smoothstep(0.96, 1.0, sin(atan(d.x, d.z) * 90.0 + h * 40.0 + uTime * 18.0));
      col = night + vec3(0.90, 0.08, 0.22) * neonGlow * 0.35 + vec3(0.75, 0.78, 0.85) * rain * 0.25;
    }

    gl_FragColor = vec4(toLinear(col), 1.0);
  }
`;

/* ──────────────────────  GROUND SHADER  ────────────────────── */

const GROUND_VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uCenter;
  uniform float uCurvatureRadius;
  varying vec2 vWorld;
  varying float vPathDist;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    float pathCenterX = sin(vWorld.y * 0.075) * 2.6;
    vPathDist = abs(vWorld.x - pathCenterX);

    float r = uCurvatureRadius > 0.0 ? uCurvatureRadius : ${WORLD_CURVATURE_RADIUS.toFixed(1)};
    float radial = length(vWorld - uCenter.xz);
    float sagitta = (r <= 0.0 || r >= 50000.0) ? 0.0 : (radial * radial) / (2.0 * r);

    w.y -= sagitta;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uCam;
  uniform float uTime;
  uniform int uMode;
  varying vec2 vWorld;
  varying float vPathDist;

  vec3 toLinear(vec3 srgb) {
    return pow(max(srgb, vec3(0.0)), vec3(2.2));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float plazaDist = length(vWorld);
    bool onPlaza = plazaDist < 4.5;
    bool onRoad = vPathDist < 2.5;
    bool onPath = onPlaza || onRoad;
    vec3 col = vec3(0.1);

    if (uMode == 0) {
      // CRT Phosphor: Phosphor green terminal matrix grid & glowing amber data bus road
      vec2 g = abs(fract(vWorld * 0.5) - 0.5);
      float line = smoothstep(0.04, 0.0, min(g.x, g.y));
      vec3 base = vec3(0.01, 0.05, 0.02) + vec3(0.12, 0.92, 0.35) * line * 0.55;
      vec3 road = vec3(0.04, 0.16, 0.06) + vec3(1.0, 0.75, 0.12) * line * 0.85;
      col = onPath ? road : base;
    } else if (uMode == 1) {
      // Ukiyo-e Woodblock: Seigaiha (concentric Prussian-blue ocean wave crests) & warm tatami/sandstone path
      vec2 waveUv = vWorld * 0.35;
      waveUv.x += mod(floor(waveUv.y), 2.0) * 0.5;
      float r = length(fract(waveUv) - vec2(0.5, 0.0));
      float arcs = smoothstep(0.06, 0.0, abs(fract(r * 4.0) - 0.5));
      vec3 sea = mix(vec3(0.12, 0.24, 0.42), vec3(0.94, 0.88, 0.76), arcs * 0.65);
      vec3 road = mix(vec3(0.88, 0.78, 0.62), vec3(0.78, 0.24, 0.22), step(0.92, abs(vPathDist - 2.3)));
      col = onPath ? road : sea;
    } else if (uMode == 2) {
      // Stained Cathedral: Mosaic leaded jewel tiles with golden nave walkway
      vec2 cell = floor(vWorld * 0.6);
      vec2 f = abs(fract(vWorld * 0.6) - 0.5);
      float lead = smoothstep(0.44, 0.49, max(f.x, f.y));
      float h = hash(cell);
      vec3 jewel = h < 0.33 ? vec3(0.12, 0.32, 0.72) : (h < 0.66 ? vec3(0.62, 0.12, 0.34) : vec3(0.38, 0.16, 0.58));
      vec3 road = mix(vec3(0.85, 0.65, 0.22), vec3(0.98, 0.88, 0.52), smoothstep(0.0, 0.4, min(f.x, f.y)));
      col = mix(onPath ? road : jewel, vec3(0.04, 0.02, 0.06), lead);
    } else if (uMode == 3) {
      // Blueprint Atelier: Prussian cyanotype drafting paper with major/minor white millimeter gridlines
      vec2 minorG = abs(fract(vWorld * 1.0) - 0.5);
      vec2 majorG = abs(fract(vWorld * 0.2) - 0.5);
      float minorL = smoothstep(0.03, 0.0, min(minorG.x, minorG.y));
      float majorL = smoothstep(0.02, 0.0, min(majorG.x, majorG.y));
      vec3 paper = vec3(0.06, 0.25, 0.50);
      vec3 road = vec3(0.10, 0.36, 0.66);
      col = (onPath ? road : paper) + vec3(0.85, 0.96, 1.0) * (minorL * 0.22 + majorL * 0.65);
    } else if (uMode == 4) {
      // Biolume Abyss: Deep seabed with glowing cyan/magenta bioluminescent coral veins & ripple rings
      float caustic = sin(vWorld.x * 0.45 + uTime) * cos(vWorld.y * 0.45 - uTime * 0.8);
      float glow = smoothstep(0.45, 0.95, caustic);
      vec3 seabed = vec3(0.02, 0.10, 0.20) + vec3(0.0, 0.92, 0.78) * glow * 0.38;
      vec3 road = vec3(0.05, 0.22, 0.36) + vec3(0.92, 0.28, 0.74) * (1.0 - glow) * 0.35;
      col = onPath ? road : seabed;
    } else if (uMode == 5) {
      // Gilded Kintsugi: Dark unglazed ceramic stone slabs mended with glowing 24k gold lacquer seams
      float crack1 = abs(sin(vWorld.x * 0.35 + sin(vWorld.y * 0.25) * 2.2));
      float crack2 = abs(cos(vWorld.y * 0.32 + cos(vWorld.x * 0.28) * 2.0));
      float goldSeam = smoothstep(0.045, 0.0, min(crack1, crack2));
      vec3 slate = vec3(0.13, 0.12, 0.15) + (hash(floor(vWorld * 8.0)) - 0.5) * 0.03;
      vec3 road = vec3(0.20, 0.18, 0.22);
      col = mix(onPath ? road : slate, vec3(1.0, 0.82, 0.24), goldSeam);
    } else if (uMode == 6) {
      // Solarpunk Glasshouse: Sunlit emerald moss lawn & Art-Nouveau travertine + brass inlay path
      float n = hash(floor(vWorld * 4.0));
      vec3 moss = mix(vec3(0.20, 0.54, 0.36), vec3(0.38, 0.76, 0.48), n);
      vec2 tile = abs(fract(vWorld * 0.35) - 0.5);
      float brassInlay = smoothstep(0.45, 0.49, max(tile.x, tile.y));
      vec3 stone = mix(vec3(0.94, 0.91, 0.82), vec3(0.85, 0.68, 0.24), brassInlay);
      col = onPath ? stone : moss;
    } else {
      // Velvet Noir: Wet rain-slicked midnight cobblestones reflecting silver streetlight & crimson neon
      vec2 cobble = abs(fract(vWorld * 0.9) - 0.5);
      float seam = smoothstep(0.42, 0.49, max(cobble.x, cobble.y));
      float puddle = smoothstep(0.2, 0.8, sin(vWorld.x * 0.25) * cos(vWorld.y * 0.25));
      vec3 wetStone = mix(vec3(0.08, 0.08, 0.10), vec3(0.22, 0.23, 0.27), puddle * 0.6) * (1.0 - seam * 0.6);
      if (onPath && abs(vPathDist - 2.2) < 0.18) {
        wetStone += vec3(0.90, 0.08, 0.22) * 0.75;
      }
      col = wetStone;
    }

    vec3 lin = toLinear(col);
    float dist = length(vec3(vWorld.x - uCam.x, 0.0, vWorld.y - uCam.z));
    lin = mix(lin, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    gl_FragColor = vec4(lin, 1.0);
  }
`;

/* ──────────────────────  POST FX SHADER  ────────────────────── */

const POST_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const POST_FRAG = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uTime;
  uniform int uMode;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 uv = vUv;
    if (uMode == 0) {
      // Slight CRT barrel curvature
      vec2 d = uv - 0.5;
      uv = 0.5 + d * (1.0 + 0.08 * dot(d, d));
    }
    vec3 col = texture2D(tScene, clamp(uv, 0.001, 0.999)).rgb;

    if (uMode == 0) {
      // CRT scanlines + green phosphor tint
      float scan = 0.88 + 0.12 * sin(vUv.y * uRes.y * 1.4);
      float lum = luma(col);
      vec3 phos = mix(col, vec3(lum * 0.35, lum * 1.15, lum * 0.45), 0.42);
      col = phos * scan;
    } else if (uMode == 1) {
      // Ukiyo-e warm washi paper tint + ink edge contrast
      col = mix(col, col * vec3(1.04, 0.98, 0.88), 0.35);
    } else if (uMode == 2) {
      // Stained Cathedral jewel saturation boost
      float lum = luma(col);
      col = mix(vec3(lum), col, 1.28);
    } else if (uMode == 3) {
      // Blueprint cyanotype contrast
      float lum = luma(col);
      vec3 bluePrint = mix(vec3(0.04, 0.18, 0.38), vec3(0.92, 0.98, 1.0), smoothstep(0.08, 0.85, lum));
      col = mix(col, bluePrint, 0.28);
    } else if (uMode == 4) {
      // Biolume Abyss subtle underwater wave shimmer
      col *= vec3(0.92, 1.04, 1.08);
    } else if (uMode == 5) {
      // Gilded Kintsugi warm gold highlight contrast
      float lum = luma(col);
      col = mix(vec3(lum) * vec3(0.95, 0.92, 0.98), col * vec3(1.08, 1.02, 0.90), 0.75);
    } else if (uMode == 6) {
      // Solarpunk warm sunlit bloom wash
      col *= vec3(1.04, 1.03, 0.96);
    } else if (uMode == 7) {
      // Velvet Noir: High-contrast silver chiaroscuro + selective crimson neon retention + Venetian blind shadow
      float lum = luma(col);
      float redness = max(0.0, col.r - max(col.g, col.b) * 1.35);
      float bw = smoothstep(0.06, 0.88, lum);
      vec3 noir = mix(vec3(bw * 0.95, bw * 0.96, bw * 1.0), vec3(0.95, 0.08, 0.22), clamp(redness * 2.2, 0.0, 1.0));
      float vig = smoothstep(0.38, 0.88, length(vUv - 0.5));
      col = mix(noir, vec3(0.02, 0.02, 0.03), vig * 0.65);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/* ──────────────────────  BESPOKE 3D SCENERY PER ARCHETYPE  ────────────────────── */

function ArchetypeScenery({ id }: { id: ArchetypeLookId }) {
  const pillarsRef = useRef<THREE.Group>(null);
  const floatersRef = useRef<THREE.Group>(null);

  const pillarCoords = useMemo(
    () => [
      [-7.5, 0, 8.5] as [number, number, number],
      [7.5, 0, 8.5] as [number, number, number],
      [-9.2, 0, -4.5] as [number, number, number],
      [9.2, 0, -4.5] as [number, number, number],
    ],
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const px = livePlayerWorldPos.x;
    const pz = livePlayerWorldPos.z;

    if (pillarsRef.current) {
      pillarsRef.current.children.forEach((child, idx) => {
        const c = pillarCoords[idx];
        if (!c) return;
        child.position.y = -sphereDrop(c[0] - px, c[2] - pz);
      });
    }

    if (floatersRef.current) {
      floatersRef.current.children.forEach((child, idx) => {
        const angle = t * 0.4 + idx * ((Math.PI * 2) / 6);
        const radius = 5.8 + (idx % 2) * 2.2;
        const fx = Math.cos(angle) * radius;
        const fz = Math.sin(angle) * radius;
        const fy = 3.2 + Math.sin(t * 1.8 + idx) * 0.45 - sphereDrop(fx - px, fz - pz);
        child.position.set(fx, fy, fz);
        child.rotation.y = t * 0.8 + idx;
      });
    }
  });

  const pillarColor =
    id === 'crt'
      ? '#22ff66'
      : id === 'ukiyoe'
        ? '#d62828'
        : id === 'cathedral'
          ? '#ffb703'
          : id === 'blueprint'
            ? '#e0f4ff'
            : id === 'biolume'
              ? '#00f5d4'
              : id === 'kintsugi'
                ? '#ffd166'
                : id === 'solarpunk'
                  ? '#52b788'
                  : '#e6193c';

  const floaterColor =
    id === 'crt'
      ? '#ffb000'
      : id === 'ukiyoe'
        ? '#f4ebd9'
        : id === 'cathedral'
          ? '#ff006e'
          : id === 'blueprint'
            ? '#90e0ef'
            : id === 'biolume'
              ? '#f15bb5'
              : id === 'kintsugi'
                ? '#ffd166'
                : id === 'solarpunk'
                  ? '#ffd166'
                  : '#f8fafc';

  return (
    <group userData={{ archetypeOwn: true }}>
      <group ref={pillarsRef} userData={{ archetypeOwn: true }}>
        {pillarCoords.map((pos, idx) => (
          <group key={`arch-pillar-${idx}`} position={pos} userData={{ archetypeOwn: true }}>
            {/* Stepped Foundation Plinth + Wireframe Exoskeleton */}
            <mesh position={[0, 0.35, 0]} userData={{ archetypeOwn: true }}>
              <boxGeometry args={[1.6, 0.7, 1.6]} />
              <meshLambertMaterial color="#0b0816" />
            </mesh>
            <mesh position={[0, 0.35, 0]} userData={{ archetypeOwn: true }}>
              <boxGeometry args={[1.65, 0.74, 1.65]} />
              <meshBasicMaterial color={pillarColor} wireframe transparent opacity={0.75} />
            </mesh>
            {/* Fluted Multi-Tier Shaft + Structural Wireframe Cage */}
            <mesh position={[0, 2.8, 0]} userData={{ archetypeOwn: true }}>
              <cylinderGeometry args={[0.38, 0.52, 4.4, id === 'crt' || id === 'blueprint' ? 4 : 8]} />
              <meshLambertMaterial color={id === 'ukiyoe' || id === 'solarpunk' ? '#f4ebd9' : '#110d20'} />
            </mesh>
            <mesh position={[0, 2.8, 0]} userData={{ archetypeOwn: true }}>
              <cylinderGeometry args={[0.42, 0.56, 4.45, id === 'crt' || id === 'blueprint' ? 4 : 8]} />
              <meshBasicMaterial color={pillarColor} wireframe transparent opacity={0.85} />
            </mesh>
            {/* Capital Collar & Lantern Housing */}
            <mesh position={[0, 5.2, 0]} userData={{ archetypeOwn: true }}>
              <cylinderGeometry args={[0.85, 0.45, 0.45, 6]} />
              <meshBasicMaterial color={pillarColor} wireframe />
            </mesh>
            <mesh position={[0, 5.85, 0]} userData={{ archetypeOwn: true }}>
              <octahedronGeometry args={[0.58, id === 'biolume' ? 1 : 0]} />
              <meshBasicMaterial color={floaterColor} />
            </mesh>
            <mesh position={[0, 5.85, 0]} scale={1.22} userData={{ archetypeOwn: true }}>
              <octahedronGeometry args={[0.58, 0]} />
              <meshBasicMaterial color={pillarColor} wireframe />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={floatersRef} userData={{ archetypeOwn: true }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <group key={`arch-floater-${i}`} userData={{ archetypeOwn: true }}>
            <mesh userData={{ archetypeOwn: true }}>
              <octahedronGeometry args={[0.32, id === 'biolume' ? 1 : 0]} />
              <meshBasicMaterial color={i % 2 === 0 ? floaterColor : pillarColor} />
            </mesh>
            <mesh scale={1.35} userData={{ archetypeOwn: true }}>
              <octahedronGeometry args={[0.32, 0]} />
              <meshBasicMaterial color={pillarColor} wireframe />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ──────────────────────  SKIN & POST-FX LAYER  ────────────────────── */

const HIDDEN_LAYER = 29;
const SCAN_INTERVAL_S = 2.0;
const hsl = { h: 0, s: 0, l: 0 };

function remapColorForSpec(src: THREE.Color, spec: ArchetypeStyleSpec): THREE.Color {
  const out = src.clone();
  out.getHSL(hsl, THREE.SRGBColorSpace);
  const p = spec.palette;
  if (hsl.l < 0.18) {
    out.setRGB(p.dark[0], p.dark[1], p.dark[2], THREE.SRGBColorSpace);
    return out;
  }
  if (hsl.h >= 0.22 && hsl.h <= 0.48) {
    out.setRGB(p.green[0], p.green[1], p.green[2], THREE.SRGBColorSpace);
    return out;
  }
  if (hsl.h > 0.48 && hsl.h < 0.68) {
    out.setRGB(p.cyan[0], p.cyan[1], p.cyan[2], THREE.SRGBColorSpace);
    return out;
  }
  if (hsl.h >= 0.68 && hsl.h <= 0.94) {
    out.setRGB(p.purple[0], p.purple[1], p.purple[2], THREE.SRGBColorSpace);
    return out;
  }
  out.setRGB(p.gold[0], p.gold[1], p.gold[2], THREE.SRGBColorSpace);
  return out;
}

function isLineLike(obj: THREE.Object3D): boolean {
  const o = obj as unknown as Record<string, unknown>;
  return o.isLine === true || o.isLineSegments === true || o.isLineLoop === true;
}

function shouldHideMaterial(mat: THREE.Material): boolean {
  const m = mat as unknown as Record<string, unknown>;
  if (m.isLineMaterial === true || m.isLineBasicMaterial === true || m.isLineDashedMaterial === true) return true;
  if (mat instanceof THREE.ShaderMaterial) {
    if (mat.side === THREE.BackSide) return true;
    const u = mat.uniforms ?? {};
    if ('uSphereRadius' in u || 'u_lineColor' in u) return true;
  }
  return false;
}

export function ArchetypeLookLayer({ id }: { id: ArchetypeLookId }) {
  const spec = ARCHETYPE_SPECS[id];
  const scene = useThree((s) => s.scene);

  const skyRef = useRef<THREE.Mesh>(null);
  const groundRef = useRef<THREE.Mesh>(null);

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uMode: { value: spec.modeId },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [spec.modeId],
  );

  const groundMat = useMemo(() => {
    const fogCol = new THREE.Color().setRGB(
      spec.horizonSrgb[0],
      spec.horizonSrgb[1],
      spec.horizonSrgb[2],
      THREE.SRGBColorSpace,
    );
    return new THREE.ShaderMaterial({
      uniforms: {
        uFogColor: { value: fogCol },
        uFogNear: { value: spec.fogNear },
        uFogFar: { value: spec.fogFar },
        uCam: { value: new THREE.Vector3() },
        uCenter: { value: new THREE.Vector3() },
        uCurvatureRadius: { value: getActiveCurvatureRadius() },
        uTime: { value: 0 },
        uMode: { value: spec.modeId },
      },
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
    });
  }, [spec]);

  useEffect(
    () => () => {
      skyMat.dispose();
      groundMat.dispose();
    },
    [skyMat, groundMat],
  );

  /* ─── Scene Material Skinning ─── */
  const savedMeshMaterials = useRef(new Map<THREE.Mesh, THREE.Material | THREE.Material[]>());
  const materialCache = useRef(new Map<string, THREE.MeshLambertMaterial>());
  const hiddenObjects = useRef(new Map<THREE.Object3D, number>());
  const lastChildCount = useRef(-1);
  const scanClock = useRef(0);
  const fogRef = useRef<THREE.Fog | null>(null);

  const hide = (obj: THREE.Object3D) => {
    if (hiddenObjects.current.has(obj)) return;
    hiddenObjects.current.set(obj, obj.layers.mask);
    obj.layers.set(HIDDEN_LAYER);
  };

  const makeMaterial = (orig: THREE.Material): THREE.Material => {
    const anyOrig = orig as unknown as {
      color?: THREE.Color;
      opacity?: number;
      transparent?: boolean;
      side?: THREE.Side;
    };
    if (orig instanceof THREE.ShaderMaterial || orig instanceof THREE.PointsMaterial) {
      return orig;
    }

    const baseColor =
      anyOrig.color instanceof THREE.Color
        ? remapColorForSpec(anyOrig.color, spec)
        : new THREE.Color().setRGB(spec.palette.gold[0], spec.palette.gold[1], spec.palette.gold[2], THREE.SRGBColorSpace);

    const origOpacity = typeof orig.opacity === 'number' ? orig.opacity : 1;
    const isWire = Boolean((anyOrig as { wireframe?: boolean }).wireframe);
    const isAuraShell = orig.transparent && origOpacity < 0.42;
    const opacity = isWire ? Math.max(origOpacity, 0.7) : isAuraShell ? Math.max(origOpacity * 0.55, 0.22) : 1.0;
    const side = orig.side ?? THREE.FrontSide;
    const cacheKey = `${spec.id}_${baseColor.getHexString()}_${isWire ? 'w' : isAuraShell ? opacity.toFixed(2) : '1'}_${side}`;

    let cached = materialCache.current.get(cacheKey);
    if (!cached) {
      cached = new THREE.MeshLambertMaterial({
        color: baseColor,
        emissive: baseColor.clone().multiplyScalar(isWire ? Math.max(spec.emissiveMult, 0.55) : spec.emissiveMult),
        emissiveIntensity: isWire ? Math.max(spec.emissiveIntensity, 0.8) : spec.emissiveIntensity,
        flatShading: Boolean(spec.flatShading),
        wireframe: isWire || (id === 'crt' && isAuraShell),
        transparent: isAuraShell || isWire,
        opacity,
        depthWrite: !isAuraShell,
        side,
      });
      materialCache.current.set(cacheKey, cached);
    }
    return cached;
  };

  const scan = () => {
    scene.traverse((obj) => {
      if (obj.userData?.archetypeOwn) return;
      let p: THREE.Object3D | null = obj.parent;
      while (p) {
        if (p.userData?.archetypeOwn) return;
        p = p.parent;
      }

      if (isLineLike(obj) && id !== 'crt' && id !== 'blueprint') {
        hide(obj);
        return;
      }

      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (savedMeshMaterials.current.has(mesh)) return;

      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (list.some(shouldHideMaterial)) {
        hide(obj);
        return;
      }

      const hasTexture = list.some((m) => (m as unknown as { map?: THREE.Texture | null }).map != null);
      if (hasTexture) return;

      if (mesh.geometry && !mesh.geometry.attributes.normal) {
        mesh.geometry.computeVertexNormals();
      }

      savedMeshMaterials.current.set(mesh, mesh.material);
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(makeMaterial)
        : makeMaterial(mesh.material);
    });
  };

  const restore = () => {
    savedMeshMaterials.current.forEach((origMat, mesh) => {
      mesh.material = origMat;
    });
    savedMeshMaterials.current.clear();
    materialCache.current.forEach((m) => m.dispose());
    materialCache.current.clear();
    hiddenObjects.current.forEach((mask, obj) => {
      obj.layers.mask = mask;
    });
    hiddenObjects.current.clear();
    lastChildCount.current = -1;
  };

  useEffect(() => {
    const previousFog = scene.fog;
    const previousBackground = scene.background;
    const fogColor = new THREE.Color().setRGB(
      spec.horizonSrgb[0],
      spec.horizonSrgb[1],
      spec.horizonSrgb[2],
      THREE.SRGBColorSpace,
    );
    const fog = new THREE.Fog(fogColor, spec.fogNear, spec.fogFar);
    fogRef.current = fog;
    scene.fog = fog;
    scene.background = null;
    scan();
    return () => {
      restore();
      if (scene.fog === fog) scene.fog = previousFog;
      scene.background = previousBackground;
      fogRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, spec]);

  useFrame(({ camera, clock }, delta) => {
    const t = clock.elapsedTime;
    skyMat.uniforms.uTime.value = t;
    skyRef.current?.position.copy(camera.position);

    groundMat.uniforms.uCam.value.copy(camera.position);
    groundMat.uniforms.uCenter.value.copy(livePlayerWorldPos);
    groundMat.uniforms.uCurvatureRadius.value = getActiveCurvatureRadius();
    groundMat.uniforms.uTime.value = t;
    groundRef.current?.position.set(livePlayerWorldPos.x, -0.02, livePlayerWorldPos.z);

    scanClock.current += delta;
    if (scanClock.current >= SCAN_INTERVAL_S) {
      scanClock.current = 0;
      const fog = fogRef.current;
      if (fog && scene.fog !== fog) scene.fog = fog;
      if (scene.background) scene.background = null;
      if (scene.children.length !== lastChildCount.current) {
        lastChildCount.current = scene.children.length;
        scan();
      }
    }
  });

  return (
    <>
      <mesh ref={skyRef} renderOrder={-1000} frustumCulled={false} userData={{ archetypeOwn: true }}>
        <sphereGeometry args={[420, 24, 16]} />
        <primitive object={skyMat} attach="material" />
      </mesh>
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={-900}
        frustumCulled={false}
        userData={{ archetypeOwn: true }}
      >
        <planeGeometry args={[520, 520, 96, 96]} />
        <primitive object={groundMat} attach="material" />
      </mesh>
      <ArchetypeScenery id={id} />
      <ambientLight args={[spec.ambientHex, spec.ambientIntensity]} userData={{ archetypeOwn: true }} />
      <directionalLight
        args={[spec.dirHex1, spec.dirInt1]}
        position={[32, 46, 24]}
        userData={{ archetypeOwn: true }}
      />
      <directionalLight
        args={[spec.dirHex2, spec.dirInt2]}
        position={[-28, 22, -20]}
        userData={{ archetypeOwn: true }}
      />
    </>
  );
}
