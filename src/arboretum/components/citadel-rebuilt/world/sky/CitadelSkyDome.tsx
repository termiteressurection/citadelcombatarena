/**
 * Citadel Celestial Sky Dome — Procedural Low-Power Celestial Sky System
 *
 * Implements the canon visionary sky language extracted from the user's library:
 * - Near-black violet/indigo void first across all chambers (#000002 to #020108)
 * - Razor-sharp, tight glowing horizon band (no washing up the dome)
 * - Procedural low-poly faceted clouds with distinct lit/mid/shadow faces & pure void channels
 * - Countable 3-face dragon scale canopy with dark grout lines & slow breathing shimmer (Summer)
 * - Four canonical celestial heroes with tight coronas (gold sun, faceted moon, dark disc, mandala flare)
 * - Full 360-degree neural thread canopy for Mindmap (axons, dendrites, mycelium, synaptic beads)
 * - Full low-power discipline: single draw call, respects prefers-reduced-motion, registers with shaderTimeRegistry
 * - Preserves SkyboxPainter user custom textures
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { register, unregister } from '../../shaderTimeRegistry';
import { resolveSkyParams, type CitadelSkyConfig, type StarDialect, type HeroCelestialBody, type RetroMotif } from './citadelSkyParams';
import { useCitadelStore } from '../../store';
import { useProximityStore } from '../../proximityStore';
import { readPortablePref } from '@/core/persistence/portablePrefs';
import type { Chamber } from '../../types';

const SKY_RADIUS = 500;

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;

  void main() {
    // Normal in world space for inverted sphere
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vWorldDir;

  uniform float u_time;
  uniform float u_motion;

  // Void Gradients
  uniform vec3 u_zenith;
  uniform vec3 u_midSky;
  uniform vec3 u_horizon;
  uniform vec3 u_nadir;
  uniform float u_horizonGlow;

  // Nebulae Wash
  uniform vec3 u_nebulaA;
  uniform vec3 u_nebulaB;
  uniform float u_nebulaDensity;

  // Star Dialect: 0=sparkle, 1=pixel, 2=aether, 3=plexus
  uniform int u_starDialect;
  uniform float u_starDensity;
  uniform vec3 u_starColor;
  uniform float u_starTwinkle;

  // Faceted Clouds
  uniform vec3 u_cloudColor;
  uniform float u_cloudOpacity;
  uniform float u_cloudScale;
  uniform float u_cloudDrift;

  // Hero Body: 0=none, 1=gold_sun, 2=faceted_moon, 3=dark_constellation_disc, 4=mandala_flare
  uniform int u_heroType;
  uniform vec3 u_heroDir;
  uniform float u_heroScale;
  uniform vec3 u_heroColor;
  uniform float u_heroDimmed;

  // Dragon Scale Ceiling
  uniform float u_hasScaleCeiling;
  uniform vec3 u_scalePrimary;
  uniform vec3 u_scaleSecondary;
  uniform vec3 u_scaleAccent;
  uniform float u_scaleBreathingSpeed;
  uniform float u_scaleDensity;
  uniform float u_scaleElevationStart;
  uniform float u_scaleDormant;

  // Plexus
  uniform float u_hasPlexus;
  uniform vec3 u_plexusColor;

  // Neural Thread Canopy (Mindmap)
  uniform float u_hasThreadCanopy;
  uniform vec3 u_threadPrimary;
  uniform vec3 u_threadSecondary;
  uniform vec3 u_threadAccent;

  // Retro Early-2000s Startup Menu Silhouettes
  uniform int u_retroMotif;
  uniform vec3 u_retroPrimary;
  uniform vec3 u_retroSecondary;
  uniform vec3 u_retroRim;
  uniform float u_retroSpeed;
  uniform float u_retroScale;
  uniform float u_retroElevation;
  uniform float u_retroAzimuth;
  uniform float u_retroOpacity;

  // Crystallization
  uniform float u_crystallized;

  // User Custom Skybox Drawing (SkyboxPainter)
  uniform float u_hasCustomTex;
  uniform sampler2D u_customTex;

  // Fast deterministic hashes
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  vec2 hash22(vec2 p) {
    float n = sin(dot(p, vec2(127.1, 311.7)));
    return fract(vec2(262144.0, 32768.0) * n);
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float elevation = dir.y;
    float azimuth = atan(dir.z, dir.x);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. VOID BASE & HORIZON BAND (Darkened Void Dominance)
    // ─────────────────────────────────────────────────────────────────────────
    vec3 col;
    if (elevation > 0.0) {
      float t = clamp(elevation, 0.0, 1.0);
      col = t < 0.14
        ? mix(u_horizon * 0.65, u_midSky, smoothstep(0.0, 0.14, t))
        : mix(u_midSky, u_zenith, smoothstep(0.14, 0.48, t));
    } else {
      col = mix(u_horizon * 0.65, u_nadir, smoothstep(0.0, 0.25, -elevation));
    }

    // Razor glowing neon horizon line (tight halo, does NOT wash up dome)
    float horizonLine = exp(-abs(elevation) * 110.0) * (u_horizonGlow * 0.55);
    col += u_horizon * (horizonLine * 0.95);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. NEBULAE WASH (Quiet, subtle cosmic smoke atmosphere)
    // ─────────────────────────────────────────────────────────────────────────
    if (u_nebulaDensity > 0.01) {
      float nebTime = u_time * u_motion * 0.035;
      float n1 = sin(dir.x * 2.8 + nebTime) * cos(dir.z * 2.8 - nebTime * 0.7);
      float n2 = sin(dir.y * 3.6 + dir.x * 1.8 - nebTime * 0.5) * cos(dir.z * 2.2 + nebTime);
      float nebVal = smoothstep(0.18, 0.85, n1 * 0.5 + n2 * 0.5 + 0.32);
      float nebFade = smoothstep(0.06, 0.45, elevation);
      vec3 nebCol = mix(u_nebulaA, u_nebulaB, 0.5 + 0.5 * sin(dir.x * 2.2 + nebTime * 1.4));
      col += nebCol * (nebVal * u_nebulaDensity * 0.12 * nebFade);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. FACETED LOW-POLY CLOUDS (Polygonal Facets, Lit/Mid/Shadow Faces, Void Gaps)
    // ─────────────────────────────────────────────────────────────────────────
    if (u_cloudOpacity > 0.01 && elevation > 0.04 && elevation < 0.72) {
      vec2 cloudUV = vec2(azimuth * 3.2, elevation * 6.0) * u_cloudScale;
      cloudUV.x += u_time * u_motion * u_cloudDrift;

      vec2 iuv = floor(cloudUV);
      vec2 fuv = fract(cloudUV);
      float d1 = 1.0;
      float d2 = 1.0;
      vec2 cellId = vec2(0.0);
      vec2 cellDiff = vec2(0.0);
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 neighbor = vec2(float(x), float(y));
          vec2 pt = hash22(iuv + neighbor);
          vec2 diff = neighbor + pt - fuv;
          float dist = length(diff);
          if (dist < d1) {
            d2 = d1;
            d1 = dist;
            cellId = iuv + neighbor;
            cellDiff = diff;
          } else if (dist < d2) {
            d2 = dist;
          }
        }
      }

      float cellVal = hash21(cellId);
      // Discrete polygonal clusters with wide channels of pure void
      float cloudCluster = smoothstep(0.60, 0.90, cellVal)
                         * smoothstep(0.04, 0.16, elevation)
                         * smoothstep(0.72, 0.40, elevation);

      // Facet normal lighting: lit, mid, shadow
      float lightDot = dot(normalize(cellDiff + vec2(0.001)), vec2(0.6, 0.8));
      float facetShade = lightDot > 0.25 ? 1.25 : (lightDot > -0.22 ? 0.78 : 0.38);
      float facetEdge = smoothstep(0.01, 0.08, d2 - d1);

      vec3 cloudCol = u_cloudColor * facetShade * facetEdge;
      col = mix(col, cloudCol, cloudCluster * u_cloudOpacity);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. STAR DIALECTS (Strict separation — pick one dialect per chamber)
    // ─────────────────────────────────────────────────────────────────────────
    if (u_starDialect == 0) {
      // 0: SPARKLE (4-point sparkle stars — Sanctuary Hub / Torii plate)
      vec2 starUV = vec2(azimuth * 11.0, elevation * 15.0) * u_starDensity;
      vec2 sId = floor(starUV);
      vec2 sF = fract(starUV);
      float sHash = hash21(sId * 19.31);
      if (sHash > 0.89 && elevation > 0.07) {
        vec2 sCenter = vec2(0.5) + (hash22(sId) - 0.5) * 0.5;
        vec2 d = sF - sCenter;
        float crossStar = max(1.0 - abs(d.x) * 32.0, 0.0) * max(1.0 - abs(d.y) * 6.0, 0.0)
                        + max(1.0 - abs(d.y) * 32.0, 0.0) * max(1.0 - abs(d.x) * 6.0, 0.0);
        float core = exp(-length(d) * 24.0);
        float twinkle = 0.65 + 0.35 * sin(u_time * u_motion * u_starTwinkle + sHash * 35.0);
        float starIntensity = (crossStar * 1.5 + core * 2.0) * twinkle * smoothstep(0.07, 0.28, elevation);
        col += u_starColor * starIntensity;
      }
    } else if (u_starDialect == 1) {
      // 1: PIXEL (Square pixel stars — Glade plate / Star Fox)
      vec2 pixUV = floor(vec2(azimuth * 62.0, elevation * 84.0) * u_starDensity);
      float pHash = hash21(pixUV * 33.71);
      if (pHash > 0.984 && elevation > 0.09) {
        float twinkle = 0.75 + 0.25 * step(0.5, sin(u_time * u_motion * u_starTwinkle + pHash * 45.0));
        col += u_starColor * (twinkle * 1.35);
      }
    } else if (u_starDialect == 2) {
      // 2: AETHER (Falling triangles & fine cosmic dust weather — Aether weather plate)
      vec2 aethUV = vec2(azimuth * 18.0, elevation * 22.0) * u_starDensity;
      aethUV.y += u_time * u_motion * 0.045; // slow falling aether weather
      vec2 aId = floor(aethUV);
      vec2 aF = fract(aethUV);
      float aHash = hash21(aId * 25.13);
      if (aHash > 0.93 && elevation > 0.04) {
        vec2 p = aF - 0.5;
        float tri = step(0.0, p.y + 0.18) * step(abs(p.x), (0.22 - p.y) * 0.55);
        float dust = exp(-length(p) * 16.0);
        col += u_starColor * (tri * 1.6 + dust * 0.8) * smoothstep(0.04, 0.22, elevation);
      }
    }

    // PLEXUS (Constellation network lines joining nodes)
    if (u_hasPlexus > 0.5 && elevation > 0.12) {
      vec2 plexUV = vec2(azimuth * 6.5, elevation * 8.5);
      vec2 pId = floor(plexUV);
      vec2 pF = fract(plexUV);
      float nHash = hash21(pId * 13.7);
      if (nHash > 0.78) {
        float nodeCore = exp(-length(pF - 0.5) * 16.0);
        col += u_plexusColor * (nodeCore * 1.25);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. DRAGON SCALE CEILING (Summer Signature Canopy & Winter Dormant)
    // ─────────────────────────────────────────────────────────────────────────
    if (u_hasScaleCeiling > 0.5 && elevation > u_scaleElevationStart) {
      float zenithAngle = acos(clamp(elevation, 0.0, 1.0));
      float rowH = 0.084 / u_scaleDensity;
      float row = floor(zenithAngle / rowH);
      float rowFract = fract(zenithAngle / rowH);

      float circumCount = max(6.0, floor(sin(max(zenithAngle, 0.08)) * 36.0 * u_scaleDensity));
      float colW = 6.2831853 / circumCount;
      float colShift = mod(row, 2.0) * 0.5 * colW;
      float colIdx = floor((azimuth + colShift) / colW);
      float colFract = fract((azimuth + colShift) / colW);

      vec2 scaleId = vec2(row, colIdx);
      float scaleHash = hash21(scaleId * 15.31);

      vec2 st = vec2((colFract - 0.5) * 2.0, (rowFract - 0.5) * 2.0);
      float diamondDist = abs(st.x) + abs(st.y + 0.16) * 1.25;

      // Scale tile boundary is at diamondDist < 0.90; boundary 0.90..1.06 is dark grout gap
      if (diamondDist < 1.06) {
        float isTile = 1.0 - smoothstep(0.86, 0.92, diamondDist);

        // 3 distinct facet faces: Lit, Mid, Shadow
        float facetShade;
        if (st.y <= -0.08) {
          facetShade = 0.40; // Shadow face
        } else if (st.x < 0.0) {
          facetShade = 1.24; // Lit face
        } else {
          facetShade = 0.80; // Mid face
        }

        // Thin contrasting rim edge on tile boundaries
        float rimEdge = smoothstep(0.74, 0.86, diamondDist) * isTile;

        // Slow breathing shimmer (26s cycle)
        float breathPhase = u_scaleDormant > 0.5
          ? 0.0
          : sin(u_time * u_motion * u_scaleBreathingSpeed + scaleHash * 6.283) * 0.5 + 0.5;

        vec3 tileColor = mix(u_scalePrimary, u_scaleSecondary, scaleHash);
        tileColor = mix(tileColor, u_scaleAccent, breathPhase * 0.38);
        tileColor *= facetShade;
        tileColor = mix(tileColor, u_scaleAccent * 0.8, rimEdge * 0.42);

        // Dark grout gap between tiles is deep obsidian crevice
        vec3 groutColor = vec3(0.002, 0.005, 0.009);
        vec3 finalScale = mix(groutColor, tileColor, isTile);

        float scaleOpacity = smoothstep(u_scaleElevationStart, u_scaleElevationStart + 0.12, elevation);

        if (u_scaleDormant > 0.5) {
          finalScale = mix(groutColor, u_scalePrimary * 0.28, isTile * 0.75);
          scaleOpacity *= 0.65;
        }

        col = mix(col, finalScale, scaleOpacity * 0.96);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. NEURAL THREAD CANOPY (Mindmap Skybox — Full Axon / Dendrite / Mycelium)
    // ─────────────────────────────────────────────────────────────────────────
    if (u_hasThreadCanopy > 0.5) {
      vec2 p = vec2(azimuth, elevation * 1.57079);

      // Dimming mask in the horizontal plane where mindmap nodes and labels sit
      float foregroundFade = smoothstep(0.02, 0.38, abs(elevation));
      float labelZoneMask = mix(0.28, 1.0, foregroundFade);

      vec3 threadCol = vec3(0.0);

      // Layer 1: Far threads (dense, delicate background mycelium web)
      {
        vec2 uvFar = p * 6.5;
        vec2 warpFar = vec2(sin(uvFar.y * 1.8 + u_time * u_motion * 0.04), cos(uvFar.x * 1.8 - u_time * u_motion * 0.03)) * 0.45;
        vec2 q = uvFar + warpFar;
        float lineFar = abs(sin(q.x * 2.2 + sin(q.y * 3.1)));
        float tFar = 1.0 - smoothstep(0.0, 0.08, lineFar);
        threadCol += u_threadSecondary * (tFar * 0.28);
      }

      // Layer 2: Mid threads (curving, branching dendrites with forks)
      {
        vec2 uvMid = p * 3.8;
        vec2 warpMid = vec2(sin(uvMid.y * 2.4 - u_time * u_motion * 0.05), cos(uvMid.x * 2.2 + u_time * u_motion * 0.04)) * 0.65;
        vec2 q = uvMid + warpMid;
        float lineMid1 = abs(sin(q.x * 1.8 + cos(q.y * 2.4)));
        float lineMid2 = abs(cos(q.y * 1.9 - sin(q.x * 2.1)));
        float tMid = (1.0 - smoothstep(0.0, 0.065, lineMid1)) + (1.0 - smoothstep(0.0, 0.065, lineMid2)) * 0.6;
        float pulse = sin(q.x * 4.0 + q.y * 3.0 - u_time * u_motion * 0.35) * 0.5 + 0.5;
        threadCol += mix(u_threadPrimary * 0.65, u_threadPrimary, pulse * 0.45) * (tMid * 0.48);
      }

      // Layer 3: Near threads (bold axons, tapering, synaptic node beads, sparse gold terminals)
      {
        vec2 uvNear = p * 2.2;
        vec2 warpNear = vec2(cos(uvNear.y * 1.6 + u_time * u_motion * 0.03), sin(uvNear.x * 1.5 - u_time * u_motion * 0.04)) * 0.85;
        vec2 q = uvNear + warpNear;
        float lineNear = abs(sin(q.x * 1.4 + sin(q.y * 1.8)));
        float tNear = 1.0 - smoothstep(0.0, 0.055, lineNear);

        // Synaptic node beads at intersections
        vec2 beadCell = floor(q * 1.5);
        vec2 beadFract = fract(q * 1.5) - 0.5;
        float bHash = hash21(beadCell * 17.31);
        float beadDist = length(beadFract);
        float beadCore = exp(-beadDist * 18.0) * step(0.68, bHash);

        // Sparsely distributed gold synaptic terminal nodes
        vec3 beadColor = bHash > 0.92 ? u_threadAccent : (u_threadPrimary * 1.35);
        float beadPulse = sin(u_time * u_motion * 0.5 + bHash * 6.28) * 0.3 + 0.7;

        threadCol += u_threadPrimary * (tNear * 0.65);
        threadCol += beadColor * (beadCore * 1.35 * beadPulse);
      }

      col += threadCol * (labelZoneMask * 0.75);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. CELESTIAL HERO BODIES (At most ONE hero per sky, tight coronas)
    // ─────────────────────────────────────────────────────────────────────────
    if (u_heroType > 0) {
      float heroDot = dot(dir, u_heroDir);
      float heroAng = acos(clamp(heroDot, -1.0, 1.0));
      float hScale = u_heroScale * 0.085;

      vec3 heroRight = normalize(cross(u_heroDir, vec3(0.0, 1.0, 0.001)));
      vec3 heroUp = cross(heroRight, u_heroDir);
      vec2 heroUV = vec2(dot(dir, heroRight), dot(dir, heroUp)) / max(hScale, 0.01);
      float heroRad = length(heroUV);
      float heroAngle = atan(heroUV.y, heroUV.x);

      if (u_heroType == 1) {
        // 1: GOLD SUN (Year Chamber / Visionary Neon Geometry Plate Hero)
        float sunDisc = smoothstep(1.0, 0.88, heroRad);
        float sunRim = smoothstep(0.85, 0.94, heroRad) * (1.0 - smoothstep(0.98, 1.05, heroRad));
        // Tight needle rays
        float rays = max(cos(heroAngle * 28.0), 0.0);
        rays = pow(rays, 12.0) * smoothstep(1.9, 0.88, heroRad);
        float raysLong = max(cos(heroAngle * 14.0 + 0.22), 0.0);
        raysLong = pow(raysLong, 14.0) * smoothstep(2.5, 0.90, heroRad);

        vec3 sunGold = u_heroColor;
        vec3 sunBeam = mix(sunGold, vec3(1.0, 0.98, 0.85), 0.65);
        float sunTotal = sunDisc * 2.2 + (rays + raysLong * 1.5) * 1.25 + sunRim * 0.9;
        if (u_heroDimmed > 0.5) sunTotal *= 0.35;
        col += mix(sunGold, sunBeam, sunDisc) * sunTotal;
      } else if (u_heroType == 2) {
        // 2: FACETED MOON (Day Chamber / Glade plate)
        if (heroRad < 1.0) {
          vec2 mUV = heroUV * 3.8;
          vec2 mId = floor(mUV);
          float mFacet = hash21(mId);
          float lightM = sin(mFacet * 19.0);
          float moonShade = lightM > 0.3 ? 1.2 : (lightM > -0.3 ? 0.78 : 0.44);
          float moonEdge = smoothstep(1.0, 0.92, heroRad);
          vec3 moonCol = u_heroColor * moonShade;
          if (u_heroDimmed > 0.5) moonCol *= 0.45;
          col = mix(col, moonCol, moonEdge * 0.95);
        }
      } else if (u_heroType == 3) {
        // 3: DARK CONSTELLATION DISC (Root Hub Plate 11)
        if (heroRad < 1.0) {
          float discEdge = smoothstep(1.0, 0.93, heroRad);
          float rimWire = smoothstep(0.90, 0.94, heroRad) * (1.0 - smoothstep(0.98, 1.02, heroRad));
          vec3 darkDiscCol = vec3(0.008, 0.004, 0.015);
          col = mix(col, darkDiscCol, discEdge * 0.98);
          col += u_heroColor * (rimWire * 0.75);

          vec2 innerUV = heroUV * 5.5;
          vec2 iId = floor(innerUV);
          float iHash = hash21(iId * 9.35);
          if (iHash > 0.67 && heroRad < 0.72) {
            float starCore = exp(-length(fract(innerUV) - 0.5) * 15.0);
            vec3 nodeCol = iHash > 0.84 ? vec3(0.13, 0.83, 0.93) : vec3(0.92, 0.28, 0.6);
            col += nodeCol * starCore * 1.75;
          }
        }
      } else if (u_heroType == 4) {
        // 4: MANDALA FLARE (Winter / Sigma starburst)
        float flareCore = exp(-heroRad * 4.2) * 2.4;
        float flareRay1 = max(1.0 - abs(heroUV.x) * 1.5, 0.0) * exp(-abs(heroUV.y) * 16.0) * 1.7;
        float flareRay2 = max(1.0 - abs(heroUV.y) * 1.5, 0.0) * exp(-abs(heroUV.x) * 16.0) * 1.7;
        float flareTotal = flareCore + flareRay1 + flareRay2;
        if (u_heroDimmed > 0.5) flareTotal *= 0.4;
        col += u_heroColor * flareTotal;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. RETRO EARLY-2000s CONSOLE STARTUP MENU SILHOUETTES
    // ─────────────────────────────────────────────────────────────────────────
    if (u_retroMotif > 0 && u_retroOpacity > 0.01) {
      if (u_retroMotif == 1) {
        // 1: TOWER WORLD (Root Hub & Sigma — save-data towers & drifting orbs)
        if (elevation > 0.01 && elevation < 0.28) {
          float tAngle = azimuth + u_time * u_motion * u_retroSpeed * 0.02;
          float colIdx = floor(tAngle * 10.0);
          float colHash = hash21(vec2(colIdx, 4.19));
          float tHeight = 0.05 + colHash * 0.16;
          float colFrac = abs(fract(tAngle * 10.0) - 0.5) * 2.0;

          if (elevation < tHeight && colFrac < 0.68) {
            float vPulse = sin((elevation * 45.0 - u_time * u_motion * u_retroSpeed * 0.9) + colIdx) * 0.5 + 0.5;
            float tRim = smoothstep(0.48, 0.68, colFrac) + smoothstep(tHeight - 0.015, tHeight, elevation);
            vec3 tBody = mix(u_retroPrimary, u_retroSecondary, clamp(elevation / tHeight, 0.0, 1.0));
            vec3 tFinal = tBody * (0.65 + 0.35 * vPulse) + u_retroRim * (tRim * 0.85);
            col = mix(col, tFinal, u_retroOpacity * 0.72);
          }

          // Drifting soft orbs between pillars
          float orbA = azimuth * 2.5 + u_time * u_motion * u_retroSpeed * 0.3;
          vec2 orbUV = vec2(fract(orbA / 6.28318) - 0.5, (elevation - 0.12) * 4.5);
          float orbDist = length(orbUV);
          if (orbDist < 0.45) {
            float orbCore = exp(-orbDist * 14.0);
            col += u_retroRim * (orbCore * u_retroOpacity * 0.65);
          }
        }
      } else if (u_retroMotif == 2) {
        // 2: CUBE WORLD (Day Chamber — single slow tumbling chrome/translucent cube)
        float cPhi = 1.5707963 - u_retroElevation * 1.5707963;
        vec3 cDir = vec3(
          sin(cPhi) * cos(u_retroAzimuth),
          cos(cPhi),
          sin(cPhi) * sin(u_retroAzimuth)
        );
        vec3 cRight = normalize(cross(cDir, vec3(0.0, 1.0, 0.001)));
        vec3 cUp = cross(cRight, cDir);
        vec2 cUV = vec2(dot(dir, cRight), dot(dir, cUp)) / max(u_retroScale * 0.075, 0.01);

        if (length(cUV) < 1.35) {
          float angX = u_time * u_motion * u_retroSpeed * 0.35;
          float angY = u_time * u_motion * u_retroSpeed * 0.55;
          float angZ = u_time * u_motion * u_retroSpeed * 0.22;

          mat3 rotX = mat3(1.0, 0.0, 0.0, 0.0, cos(angX), -sin(angX), 0.0, sin(angX), cos(angX));
          mat3 rotY = mat3(cos(angY), 0.0, sin(angY), 0.0, 1.0, 0.0, -sin(angY), 0.0, cos(angY));
          mat3 rotZ = mat3(cos(angZ), -sin(angZ), 0.0, sin(angZ), cos(angZ), 0.0, 0.0, 0.0, 1.0);
          mat3 cubeRot = rotZ * rotY * rotX;

          vec3 ro = cubeRot * vec3(0.0, 0.0, -2.2);
          vec3 rd = cubeRot * normalize(vec3(cUV, 1.8));

          vec3 safeRd = vec3(abs(rd.x) < 0.0001 ? 0.0001 : rd.x, abs(rd.y) < 0.0001 ? 0.0001 : rd.y, abs(rd.z) < 0.0001 ? 0.0001 : rd.z);
          vec3 invR = 1.0 / safeRd;
          vec3 tbot = invR * (-vec3(0.48) - ro);
          vec3 ttop = invR * (vec3(0.48) - ro);
          vec3 tmin = min(ttop, tbot);
          vec3 tmax = max(ttop, tbot);
          float t0 = max(max(tmin.x, tmin.y), tmin.z);
          float t1 = min(min(tmax.x, tmax.y), tmax.z);

          if (t0 < t1 && t1 > 0.0) {
            vec3 hitPos = ro + rd * t0;
            vec3 hitNormal = -sign(rd) * step(tmin.yzx, tmin.xyz) * step(tmin.zxy, tmin.xyz);
            float diff = abs(dot(hitNormal, normalize(vec3(0.5, 0.8, 0.4))));
            float edgeDist = max(max(abs(hitPos.x), abs(hitPos.y)), abs(hitPos.z));
            float rim = smoothstep(0.40, 0.48, edgeDist);

            vec3 faceCol = mix(u_retroPrimary, u_retroSecondary, diff * 0.85);
            vec3 cubeCol = faceCol + u_retroRim * (rim * 1.1 + diff * 0.3);
            col = mix(col, cubeCol, u_retroOpacity * 0.85);
          }
        }
      } else if (u_retroMotif == 3) {
        // 3: SWIRL WORLD (Month Chambers — slow liquid ribbon arcing across upper dome + aether dust)
        if (elevation > 0.14) {
          float swirlPhase = azimuth * 2.0 + log(max(elevation, 0.02)) * 3.6 - u_time * u_motion * u_retroSpeed;
          float ribbon = abs(sin(swirlPhase));
          float ribbonBand = 1.0 - smoothstep(0.0, 0.16, ribbon);
          float env = smoothstep(0.12, 0.32, elevation) * smoothstep(0.88, 0.62, elevation);

          float seg = sin(azimuth * 16.0 + elevation * 10.0);
          float facetShade = seg > 0.0 ? 1.18 : 0.72;

          vec2 dGrid = vec2(azimuth * 22.0, elevation * 24.0);
          float dHash = hash21(floor(dGrid));
          float dCore = exp(-length(fract(dGrid) - 0.5) * 16.0) * step(0.82, dHash);

          vec3 sCol = mix(u_retroPrimary, u_retroSecondary, ribbon) * facetShade + u_retroRim * (dCore * 1.6 + (1.0 - ribbon) * 0.45);
          col += sCol * (ribbonBand * env * u_retroOpacity * 0.68);
        }
      } else if (u_retroMotif == 4) {
        // 4: BLADE WORLD (Spring & dormant Winter — translucent panels sliding and settling)
        if (elevation > 0.02 && elevation < 0.28) {
          float bIdx = floor(azimuth * 8.0);
          float bSeed = hash21(vec2(bIdx, 7.89));
          float bSlide = sin(u_time * u_motion * u_retroSpeed + bSeed * 6.28) * 0.025;
          float bHeight = 0.08 + bSeed * 0.14 + bSlide;
          float bAngle = (bSeed - 0.5) * 0.8;
          float bU = (fract(azimuth * 8.0) - 0.5) + (elevation - 0.05) * bAngle;

          if (abs(bU) < 0.38 && elevation < bHeight) {
            float bShade = 0.72 + 0.38 * sin(bIdx * 2.3);
            float bRim = smoothstep(0.28, 0.38, abs(bU)) + smoothstep(bHeight - 0.015, bHeight, elevation);
            vec3 bCol = mix(u_retroPrimary, u_retroSecondary, elevation / bHeight) * bShade + u_retroRim * (bRim * 0.88);
            col = mix(col, bCol, u_retroOpacity * 0.68);
          }
        }
      } else if (u_retroMotif == 5) {
        // 5: ORB REVEAL (Summer Chamber — slow-rising chrome orb emerging at horizon)
        float orbY = u_retroElevation + sin(u_time * u_motion * u_retroSpeed * 0.6) * 0.02;
        vec2 pOrb = vec2(sin(azimuth - u_retroAzimuth), elevation - orbY) / max(u_retroScale * 0.08, 0.01);
        float orbRad = length(pOrb);

        if (orbRad < 1.0) {
          float z = sqrt(max(0.0, 1.0 - orbRad * orbRad));
          vec3 n = normalize(vec3(pOrb.x, pOrb.y, z));
          float rim = pow(1.0 - n.z, 2.4);
          float spec = pow(max(dot(n, normalize(vec3(0.35, 0.75, 0.55))), 0.0), 16.0);
          vec3 orbChrome = mix(u_retroPrimary, u_retroSecondary, n.y * 0.5 + 0.5) + u_retroRim * (rim * 0.95 + spec * 1.6);
          col = mix(col, orbChrome, u_retroOpacity * 0.92);
        }
      } else if (u_retroMotif == 6) {
        // 6: RING DRIFT (Autumn Chamber — concentric translucent rings drifting across sunset)
        if (elevation > 0.08 && elevation < 0.45) {
          float rTime = u_time * u_motion * u_retroSpeed * 0.25;
          vec2 rCenter = vec2(u_retroAzimuth + sin(rTime * 0.5) * 0.18, u_retroElevation + cos(rTime * 0.7) * 0.035);
          float rDist = length(vec2(sin(azimuth - rCenter.x) * 1.4, (elevation - rCenter.y) * 2.2)) / max(u_retroScale * 0.18, 0.01);

          float ring1 = abs(rDist - 0.75);
          float ring2 = abs(rDist - 1.18);
          float ring3 = abs(rDist - 1.60);
          float rMask = (1.0 - smoothstep(0.0, 0.045, ring1)) * 0.75
                      + (1.0 - smoothstep(0.0, 0.040, ring2)) * 0.55
                      + (1.0 - smoothstep(0.0, 0.035, ring3)) * 0.42;

          float rFilm = smoothstep(1.7, 0.6, rDist) * 0.16;
          vec3 rCol = mix(u_retroPrimary, u_retroSecondary, sin(rDist * 4.0) * 0.5 + 0.5) * rFilm + u_retroRim * rMask;
          col += rCol * (u_retroOpacity * 0.72);
        }
      } else if (u_retroMotif == 7) {
        // 7: MONOLITH REVEAL (Year Chamber — tall crystalline obelisk rotating before gold sun)
        float mPhi = 1.5707963 - u_retroElevation * 1.5707963;
        vec3 mDir = vec3(
          sin(mPhi) * cos(u_retroAzimuth),
          cos(mPhi),
          sin(mPhi) * sin(u_retroAzimuth)
        );
        vec3 mRight = normalize(cross(mDir, vec3(0.0, 1.0, 0.001)));
        vec3 mUp = cross(mRight, mDir);
        vec2 mUV = vec2(dot(dir, mRight), dot(dir, mUp)) / max(u_retroScale * 0.08, 0.01);

        if (length(mUV) < 1.6) {
          float yaw = u_time * u_motion * u_retroSpeed * 0.35;
          mat3 rotYaw = mat3(cos(yaw), 0.0, sin(yaw), 0.0, 1.0, 0.0, -sin(yaw), 0.0, cos(yaw));

          vec3 ro = rotYaw * vec3(0.0, 0.0, -2.5);
          vec3 rd = rotYaw * normalize(vec3(mUV, 1.8));

          vec3 bDim = vec3(0.28, 0.88, 0.18);
          vec3 safeRd = vec3(abs(rd.x) < 0.0001 ? 0.0001 : rd.x, abs(rd.y) < 0.0001 ? 0.0001 : rd.y, abs(rd.z) < 0.0001 ? 0.0001 : rd.z);
          vec3 invR = 1.0 / safeRd;
          vec3 tbot = invR * (-bDim - ro);
          vec3 ttop = invR * (bDim - ro);
          vec3 tmin = min(ttop, tbot);
          vec3 tmax = max(ttop, tbot);
          float t0 = max(max(tmin.x, tmin.y), tmin.z);
          float t1 = min(min(tmax.x, tmax.y), tmax.z);

          if (t0 < t1 && t1 > 0.0) {
            vec3 hitPos = ro + rd * t0;
            vec3 hitNormal = -sign(rd) * step(tmin.yzx, tmin.xyz) * step(tmin.zxy, tmin.xyz);
            float diff = abs(dot(hitNormal, normalize(vec3(0.4, 0.6, 0.7))));
            float edgeDist = max(max(abs(hitPos.x) / bDim.x, abs(hitPos.y) / bDim.y), abs(hitPos.z) / bDim.z);
            float rimEdge = smoothstep(0.85, 0.99, edgeDist);

            vec3 mBody = mix(u_retroPrimary, u_retroSecondary, clamp(hitPos.y / bDim.y * 0.5 + 0.5, 0.0, 1.0));
            vec3 mFinal = mBody * (0.7 + 0.3 * diff) + u_retroRim * (rimEdge * 1.15 + diff * 0.25);
            col = mix(col, mFinal, u_retroOpacity * 0.88);
          }
        }
      } else if (u_retroMotif == 8) {
        // 8: CUBE DUST (Mindmap — faint translucent cube particles drifting through neural threads)
        vec2 cdGrid = vec2(azimuth * 18.0, elevation * 22.0);
        vec2 cdID = floor(cdGrid);
        float cdHash = hash21(cdID * 14.81);
        if (cdHash > 0.86 && elevation > 0.12 && elevation < 0.88) {
          vec2 cdFrac = fract(cdGrid) - 0.5;
          float cdDist = max(abs(cdFrac.x), abs(cdFrac.y));
          float cdCore = smoothstep(0.24, 0.14, cdDist);
          float cdRim = smoothstep(0.26, 0.20, cdDist) - smoothstep(0.20, 0.10, cdDist);
          float cdPulse = sin(u_time * u_motion * 0.45 + cdHash * 6.28) * 0.35 + 0.65;

          vec3 cdCol = mix(u_retroPrimary, u_retroSecondary, cdHash) * cdCore + u_retroRim * (cdRim * 1.3);
          col += cdCol * (cdPulse * u_retroOpacity * 0.65);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. USER CUSTOM SKYBOX DRAWING (SkyboxPainter API)
    // ─────────────────────────────────────────────────────────────────────────
    if (u_hasCustomTex > 0.5) {
      vec2 customUV = vec2(azimuth / 6.2831853 + 0.5, elevation * 0.5 + 0.5);
      vec4 userDrawn = texture2D(u_customTex, customUV);
      col = mix(col, userDrawn.rgb, userDrawn.a * 0.85);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. CRYSTALLIZED STONE STATE (Past / Sealed chambers)
    // ─────────────────────────────────────────────────────────────────────────
    if (u_crystallized > 0.5) {
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 stone = vec3(lum) * 0.65 + vec3(0.02, 0.04, 0.08);
      col = mix(col, stone, 0.82);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function getStarDialectInt(d: StarDialect): number {
  if (d === 'pixel') return 1;
  if (d === 'aether') return 2;
  if (d === 'plexus') return 3;
  return 0; // sparkle
}

function getHeroTypeInt(h: HeroCelestialBody): number {
  if (h === 'gold_sun') return 1;
  if (h === 'faceted_moon') return 2;
  if (h === 'dark_constellation_disc') return 3;
  if (h === 'mandala_flare') return 4;
  return 0; // none
}

function getRetroMotifInt(m: RetroMotif): number {
  if (m === 'towerWorld') return 1;
  if (m === 'cubeWorld') return 2;
  if (m === 'swirlWorld') return 3;
  if (m === 'bladeWorld') return 4;
  if (m === 'orbReveal') return 5;
  if (m === 'ringDrift') return 6;
  if (m === 'monolithReveal') return 7;
  if (m === 'cubeDust') return 8;
  return 0; // none
}

export interface CitadelSkyDomeProps {
  chamber?: Chamber | null;
  isNearSigma?: boolean;
}

export function CitadelSkyDome({ chamber: propChamber, isNearSigma: propIsNearSigma }: CitadelSkyDomeProps = {}) {
  const storeChamber = useCitadelStore((s) => s.chambers[s.currentChamberId]);
  const chamber = propChamber !== undefined ? propChamber : storeChamber;
  const storeNearSigma = useProximityStore((s) => s.termite);
  const isNearSigma = propIsNearSigma !== undefined ? propIsNearSigma : storeNearSigma;

  const { scene } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  // Opt-out kill switch only; enabled by default
  const disabled = readPortablePref('citadel.visuals.sky') === '0';
  const enabled = !disabled;

  const config = useMemo(() => resolveSkyParams(chamber, isNearSigma), [chamber, isNearSigma]);

  // Ensure scene.background does not occlude the procedural sky dome
  useEffect(() => {
    scene.background = null;
  }, [scene, config.id]);

  // Reduced motion preference
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Custom texture loader from SkyboxPainter base64 data
  const customTexture = useMemo(() => {
    if (!chamber?.skyboxData) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(chamber.skyboxData);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [chamber?.skyboxData]);

  // Calculate hero direction vector in spherical coordinates
  const heroDir = useMemo(() => {
    const el = config.heroElevation;
    const az = config.heroAzimuth;
    const phi = Math.PI / 2 - el * (Math.PI / 2);
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(az),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(az)
    ).normalize();
  }, [config.heroElevation, config.heroAzimuth]);

  const material = useMemo(() => {
    if (!enabled) return null;

    const uniforms: Record<string, THREE.IUniform> = {
      u_time: { value: 0 },
      u_motion: { value: reducedMotion || config.isCrystallized ? 0.0 : 1.0 },

      // Gradients
      u_zenith: { value: new THREE.Color(config.zenithColor) },
      u_midSky: { value: new THREE.Color(config.midSkyColor) },
      u_horizon: { value: new THREE.Color(config.horizonColor) },
      u_nadir: { value: new THREE.Color(config.nadirColor) },
      u_horizonGlow: { value: config.horizonGlowIntensity },

      // Nebulae
      u_nebulaA: { value: new THREE.Color(config.nebulaColorA) },
      u_nebulaB: { value: new THREE.Color(config.nebulaColorB) },
      u_nebulaDensity: { value: config.nebulaDensity },

      // Stars
      u_starDialect: { value: getStarDialectInt(config.starDialect) },
      u_starDensity: { value: config.starDensity },
      u_starColor: { value: new THREE.Color(config.starColor) },
      u_starTwinkle: { value: config.starTwinkleSpeed },

      // Clouds
      u_cloudColor: { value: new THREE.Color(config.cloudColor) },
      u_cloudOpacity: { value: config.cloudOpacity },
      u_cloudScale: { value: config.cloudScale },
      u_cloudDrift: { value: config.cloudDriftSpeed },

      // Hero Body
      u_heroType: { value: getHeroTypeInt(config.hero) },
      u_heroDir: { value: heroDir },
      u_heroScale: { value: config.heroScale },
      u_heroColor: { value: new THREE.Color(config.heroColor) },
      u_heroDimmed: { value: config.heroDimmed ? 1.0 : 0.0 },

      // Scale Ceiling
      u_hasScaleCeiling: { value: config.hasScaleCeiling ? 1.0 : 0.0 },
      u_scalePrimary: { value: new THREE.Color(config.scaleColorPrimary) },
      u_scaleSecondary: { value: new THREE.Color(config.scaleColorSecondary) },
      u_scaleAccent: { value: new THREE.Color(config.scaleColorAccent) },
      u_scaleBreathingSpeed: { value: config.scaleBreathingSpeed },
      u_scaleDensity: { value: config.scaleDensity },
      u_scaleElevationStart: { value: config.scaleElevationStart },
      u_scaleDormant: { value: config.scaleDormant ? 1.0 : 0.0 },

      // Plexus
      u_hasPlexus: { value: config.hasPlexus ? 1.0 : 0.0 },
      u_plexusColor: { value: new THREE.Color(config.plexusColor) },

      // Neural Thread Canopy
      u_hasThreadCanopy: { value: config.hasThreadCanopy ? 1.0 : 0.0 },
      u_threadPrimary: { value: new THREE.Color(config.threadColorPrimary) },
      u_threadSecondary: { value: new THREE.Color(config.threadColorSecondary) },
      u_threadAccent: { value: new THREE.Color(config.threadColorAccent) },

      // Retro Early-2000s Startup Menu Silhouettes
      u_retroMotif: { value: getRetroMotifInt(config.retroMotif) },
      u_retroPrimary: { value: new THREE.Color(config.retroColorPrimary) },
      u_retroSecondary: { value: new THREE.Color(config.retroColorSecondary) },
      u_retroRim: { value: new THREE.Color(config.retroColorRim) },
      u_retroSpeed: { value: config.retroSpeed },
      u_retroScale: { value: config.retroScale },
      u_retroElevation: { value: config.retroElevation },
      u_retroAzimuth: { value: config.retroAzimuth },
      u_retroOpacity: { value: config.retroOpacity },

      // Crystallization
      u_crystallized: { value: config.isCrystallized ? 1.0 : 0.0 },

      // Custom User Texture
      u_hasCustomTex: { value: customTexture ? 1.0 : 0.0 },
      u_customTex: { value: customTexture || new THREE.Texture() },
    };

    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: true,
    });
  }, [enabled, config, reducedMotion, customTexture, heroDir]);

  // Hook into continuous-animation registry (shaderTimeRegistry)
  useEffect(() => {
    if (!material) return;
    register(material);
    return () => {
      unregister(material);
      material.dispose();
      customTexture?.dispose();
    };
  }, [material, customTexture]);

  // Frame tick — sky dome strictly follows camera position to eliminate parallax/tilt distortion
  useFrame(({ camera }, dt) => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }
    if (!material || config.isCrystallized || reducedMotion) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const u = material.uniforms['u_time'];
    if (u) u.value += dt;
  });

  if (!material) return null;

  return (
    <>
      {/* Mathematically coupled scene fog matching sky horizon/nadir */}
      <fog attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />

      {/* Single Draw-Call Celestial Sky Dome (always centered on camera, drawn behind scene) */}
      <mesh
        ref={meshRef}
        renderOrder={-1000}
        frustumCulled={false}
      >
        <sphereGeometry args={[SKY_RADIUS, 48, 32]} />
        <primitive object={material} attach="material" />
      </mesh>
    </>
  );
}
