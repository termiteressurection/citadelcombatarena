import { useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Chamber, CHAMBER_SIZE, HUB_SIZE, MOVE_SPEED, LOOK_SPEED } from '../types';
import { useVillageTunerStore, getZoneName } from '@/core/state/villageTunerStore';
import { getActiveChunkColliders } from './village/DispersedOverworld';

const CAMERA_SOCKET_DISTANCE = 5.2;
const CAMERA_SOCKET_HEIGHT = 3.35;
const CAMERA_LERP = 0.18;
const LOOK_LERP = 0.18;
const ALTAR_POS = new THREE.Vector3(0, 0, 0);
const ALTAR_INTERACT_DIST = 6;
// Hub landmarks — Masonic Lodge orientation:
// The Worshipful Master (Sigma) presides in the East at the head of the sacred avenue (Z: -80)
const GODHEAD_POS = new THREE.Vector3(0, 0, -80);
const GODHEAD_INTERACT_DIST = 10;
const TERMITE_POS = new THREE.Vector3(0, 0, -80);
const TERMITE_INTERACT_DIST = 10;
// Solomon's Temple Inner Court Building Positions:
// - Terminal Library = Rear "West Building" at [0, 0, -68]
// - Post Office = East Side Chambers at [36, 0, -34]
// - Mind Map Lighthouse = Central Temple & Oracle at [0, 0, -34]
// - Synaptic Vault = West Side Chambers at [-36, 0, -34]
const TERMINAL_COTTAGE_POS = new THREE.Vector3(0, 0, -68);
const POST_COTTAGE_POS = new THREE.Vector3(36, 0, -34);
const MINDMAP_COTTAGE_POS = new THREE.Vector3(0, 0, -34);
const SYNAPTIC_VAULT_POS = new THREE.Vector3(-36, 0, -34);
const COTTAGE_INTERACT_DIST = 10;

const NOTICE_BOARD_POS = new THREE.Vector3(-60, 0, 40);   // Bookmarks
const MAP_TABLE_POS = new THREE.Vector3(0, 0, -40);        // Constellation map
const LIBRARY_PILLAR_POS = new THREE.Vector3(-60, 0, -40); // Search
const MOOD_STONE_POS = new THREE.Vector3(-80, 0, 0);       // Mood log + heatmap
const BOTTLE_POST_POS = new THREE.Vector3(80, 0, 0);       // Bottle messages + future letters
const HUB_OBJECT_INTERACT_DIST = 8;
const NOTICE_BOARD_INTERACT_DIST = HUB_OBJECT_INTERACT_DIST;
const MAP_TABLE_INTERACT_DIST = HUB_OBJECT_INTERACT_DIST;
const LIBRARY_PILLAR_INTERACT_DIST = HUB_OBJECT_INTERACT_DIST;
const MOOD_STONE_INTERACT_DIST = HUB_OBJECT_INTERACT_DIST;
const BOTTLE_POST_INTERACT_DIST = HUB_OBJECT_INTERACT_DIST;
const PORTAL_HALF_W = 11;

const KB_YAW_SENS = 0.06;
const CAMERA_LOOK_AHEAD = 8.8;
const CAMERA_LOOK_HEIGHT = 1.55;
const CAMERA_MOVE_LEAD = 0.9;

// Reused per-frame scratch vectors so nothing in this hot path allocates.
// Two are needed because the movement block composes `forward * speed` and
// `right * speed` simultaneously; the third backs the proximity probes.
const _tmpVec = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _tmpSide = new THREE.Vector3();

interface Props {
  onNearFolder: (id: number | null) => void; chamber: Chamber;
  onEnterChamber: (id: number) => void;
  onOpenModal: () => void; onCreateBranch: () => void; onGoBack: () => void; onOpenTerminal: () => void;
  onOpenAltar?: () => void;
  onRequestReset: () => void;
  onOpenAres?: () => void;
  onNearAres?: (near: boolean) => void;
  onOpenTermite?: () => void;
  onNearTermite?: (near: boolean) => void;
  // New hub physical objects (hub chamber id=0 only)
  onOpenNoticeBoard?: () => void;
  onNearNoticeBoard?: (near: boolean) => void;
  onOpenMapTable?: () => void;
  onNearMapTable?: (near: boolean) => void;
  onOpenLibraryPillar?: () => void;
  onNearLibraryPillar?: (near: boolean) => void;
  onOpenMoodStone?: () => void;
  onNearMoodStone?: (near: boolean) => void;
  onOpenBottlePost?: () => void;
  onNearBottlePost?: (near: boolean) => void;
  // Root-Chamber rebind: △ Triangle tap invokes the context-aware daily ritual
  // (see useRitualRouter). Optional so copy-4/copy-13 callers that haven't
  // been migrated still type-check while the feature rolls out.
  onRitual?: () => void;
  // L1 + □ combo — summon the Sigma. Falls back to onOpenAres-style paths in
  // the host when absent.
  onOpenSigma?: () => void;
  // Options — open Ritual Ledger. When absent, Options still triggers reset.
  onOpenLedger?: () => void;
  /** Home (keyboard) — return to root lodge. */
  onGoRoot?: () => void;
  playerWorldPos: React.MutableRefObject<THREE.Vector3>;
  playerYaw: React.MutableRefObject<number>;
  uiOpen: boolean;
  // Synthetic portals not present in chamber.doors (e.g. TODAY, calendar EYE
  // gate). Included in proximity detection so the HUD "enter" prompt and the
  // keyboard interact key work for them too.
  extraPortals?: { id: number; pos: [number, number, number] }[];
  visibleDoors?: number[];
  doorPositions?: [number, number, number][];
  obstacles?: { pos: [number, number, number], scale: [number, number, number] }[];
}

export function PlayerController({ onNearFolder, chamber, onEnterChamber, onOpenModal, onCreateBranch, onGoBack, onOpenTerminal, onOpenAltar, onRequestReset, onOpenAres, onNearAres, onOpenTermite, onNearTermite, onOpenNoticeBoard, onNearNoticeBoard, onOpenMapTable, onNearMapTable, onOpenLibraryPillar, onNearLibraryPillar, onOpenMoodStone, onNearMoodStone, onOpenBottlePost, onNearBottlePost, onRitual, onOpenSigma, onOpenLedger, onGoRoot, playerWorldPos, playerYaw, uiOpen, extraPortals, visibleDoors, doorPositions, obstacles }: Props) {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3(0, 5.2, 16.5));
  const lookTarget = useRef(new THREE.Vector3(0, 3.3, 0));
  const desiredCam = useRef(new THREE.Vector3());
  const desiredLook = useRef(new THREE.Vector3());
  const forwardRef = useRef(new THREE.Vector3(0, 0, -1));
  const rightRef = useRef(new THREE.Vector3(1, 0, 0));
    const yaw = useRef(0);
  const pitch = useRef(0);
  const enterCooldown = useRef(0);
  const prevR1 = useRef(false);
  const keys = useRef<Set<string>>(new Set());

  const activeDoors = visibleDoors ?? chamber.doors;

  // Keep callback refs current so keyboard effect never has stale closures
  const cbRefs = useRef({ onOpenModal, onCreateBranch, onGoBack, onOpenTerminal, onOpenAltar, onOpenAres, onOpenTermite, onOpenNoticeBoard, onOpenMapTable, onOpenLibraryPillar, onOpenMoodStone, onOpenBottlePost, onEnterChamber, onRequestReset, onRitual, onOpenSigma, onOpenLedger, onGoRoot });
  cbRefs.current = { onOpenModal, onCreateBranch, onGoBack, onOpenTerminal, onOpenAltar, onOpenAres, onOpenTermite, onOpenNoticeBoard, onOpenMapTable, onOpenLibraryPillar, onOpenMoodStone, onOpenBottlePost, onEnterChamber, onRequestReset, onRitual, onOpenSigma, onOpenLedger, onGoRoot };

  // Keyboard listeners
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (uiOpen) return;
      keys.current.add(e.code);
      const cb = cbRefs.current;
      if (e.code === 'KeyJ') cb.onOpenModal();
      // Portal creation is now an intentional legacy action instead of a
      // first-class movement button. Shift+N keeps the escape hatch.
      if (e.code === 'KeyN' && e.shiftKey) cb.onCreateBranch();
      // Keyboard parity for the daily ritual (△ on DualSense).
      if (e.code === 'KeyR') cb.onRitual?.();
      if (e.code === 'Home') cb.onGoRoot?.();
      if (e.code === 'Backspace' || e.code === 'KeyB') cb.onGoBack();
      if (e.code === 'Space') {
        e.preventDefault();
        // Priority check: inspect adjacent NPC on-demand via Space
        if (typeof window !== 'undefined' && (window as any).__CITADEL_TOGGLE_INSPECT_NPC__) {
          const handledNpc = (window as any).__CITADEL_TOGGLE_INSPECT_NPC__();
          if (handledNpc) return;
        }
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        if (e.code === 'Space') e.preventDefault();
        const pp = playerWorldPos.current;
        const isHub = chamber.id === 0;
        // 4 Solomon's Temple Inner Court service buildings
        if (isHub && pp.distanceTo(TERMINAL_COTTAGE_POS) < COTTAGE_INTERACT_DIST) {
          if (cb.onOpenLibraryPillar) cb.onOpenLibraryPillar();
          else if (cb.onOpenNoticeBoard) cb.onOpenNoticeBoard();
          else cb.onOpenTerminal?.();
        }
        else if (isHub && pp.distanceTo(POST_COTTAGE_POS) < COTTAGE_INTERACT_DIST) {
          if (cb.onOpenBottlePost) cb.onOpenBottlePost();
        }
        else if (isHub && pp.distanceTo(MINDMAP_COTTAGE_POS) < COTTAGE_INTERACT_DIST) {
          if (cb.onOpenMapTable) cb.onOpenMapTable();
        }
        else if (isHub && pp.distanceTo(SYNAPTIC_VAULT_POS) < COTTAGE_INTERACT_DIST) {
          if (cb.onOpenMoodStone) cb.onOpenMoodStone();
        }
        else {
          const altarDist = pp.distanceTo(ALTAR_POS);
          if (altarDist < ALTAR_INTERACT_DIST) (cb.onOpenAltar ?? cb.onOpenTerminal)();
          else { const n = findNearestFolder(); if (n !== null) cb.onEnterChamber(n); }
        }
      }
    };
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [uiOpen, chamber]);

  // Mouse look and debug teleport hooks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__CITADEL_SET_PITCH__ = (p: number) => { pitch.current = p; };
      (window as any).__CITADEL_SET_YAW__ = (y: number) => { yaw.current = y; };
      (window as any).__CITADEL_TELEPORT__ = (x: number, y: number, z: number, yawAngle: number) => {
        playerWorldPos.current.set(x, y, z);
        yaw.current = yawAngle;
      };
    }
  }, []);

  // Cache the door anchor positions for the active chamber. Doors are static
  // for the lifetime of the chamber, so we materialize them once instead of
  // allocating a Vector3 per door every proximity check (was ~8/frame).
  const doorPositionsRef = useRef<THREE.Vector3[]>([]);
  useEffect(() => {
    if (doorPositions && doorPositions.length === activeDoors.length) {
      doorPositionsRef.current = doorPositions.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      return;
    }
    doorPositionsRef.current = activeDoors.map((_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -10 + Math.floor(i / 2) * 8;
      return new THREE.Vector3(side * PORTAL_HALF_W, 2, z);
    });
  }, [activeDoors, doorPositions]);

  const extraPortalsRef = useRef(extraPortals);
  extraPortalsRef.current = extraPortals;

  const findNearestFolder = useCallback((): number | null => {
    const pPos = playerWorldPos.current;
    const positions = doorPositionsRef.current;
    let nearest: number | null = null, min = 8;
    for (let i = 0; i < activeDoors.length; i += 1) {
      if (!positions[i]) continue;
      const d = pPos.distanceTo(positions[i]);
      if (d < min) { min = d; nearest = activeDoors[i]; }
    }
    const extras = extraPortalsRef.current;
    if (extras) {
      for (const { id, pos } of extras) {
        const d = pPos.distanceTo(_tmpVec.set(pos[0], pos[1], pos[2]));
        if (d < min) { min = d; nearest = id; }
      }
    }
    return nearest;
  }, [chamber, playerWorldPos]);

  useEffect(() => {
    if (chamber.template === 'month') {
      playerWorldPos.current.set(0, 2, 0);
      camera.position.set(0, 3.8, 4.2);
      cameraTarget.current.set(0, 3.8, 4.2);
      lookTarget.current.set(0, 2.0, -8.0);
    } else {
      playerWorldPos.current.set(0, 2, 12);
      camera.position.set(0, 4.95, 17.2);
      cameraTarget.current.set(0, 4.95, 17.2);
      lookTarget.current.set(0, 3.15, 3.2);
    }
    velocity.current.set(0, 0, 0);
    yaw.current = 0;
    pitch.current = 0;
    enterCooldown.current = 60;
  }, [chamber.id, chamber.template]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__CITADEL_TELEPORT_SPAWN__ = () => {
      playerWorldPos.current.set(0, 2, 12);
      camera.position.set(0, 4.95, 17.2);
      cameraTarget.current.set(0, 4.95, 17.2);
      lookTarget.current.set(0, 3.15, 3.2);
      velocity.current.set(0, 0, 0);
      yaw.current = 0;
      pitch.current = 0;
      useVillageTunerStore.getState().setEdgeModalOpen(false);
    };
    return () => {
      delete (window as any).__CITADEL_TELEPORT_SPAWN__;
    };
  }, [camera, playerWorldPos]);

  useFrame((_, delta) => {
    if (uiOpen || useVillageTunerStore.getState().edgeModalOpen) return;
    const pPos = playerWorldPos.current;

    let keyboardOrbit = 0;
    if (keys.current.has('KeyQ')) keyboardOrbit += 1;
    if (keys.current.has('KeyE')) keyboardOrbit -= 1;
    if (keyboardOrbit) yaw.current += keyboardOrbit * KB_YAW_SENS * (delta * 60);

    let keyboardPitch = 0;
    if (keys.current.has('KeyR') || keys.current.has('ArrowUp')) keyboardPitch += 1;
    if (keys.current.has('KeyF') || keys.current.has('ArrowDown')) keyboardPitch -= 1;
    if (keyboardPitch) {
      pitch.current = Math.max(-1.3, Math.min(1.4, pitch.current + keyboardPitch * KB_YAW_SENS * (delta * 60)));
    }

    forwardRef.current.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    rightRef.current.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const forward = forwardRef.current;
    const right = rightRef.current;

    const speed = MOVE_SPEED;

    velocity.current.x = 0; velocity.current.z = 0;

    // Keyboard movement. Reuses _tmpDir to avoid 4 Vector3 allocations/frame.
    if (keys.current.has('KeyW') || keys.current.has('ArrowUp')) velocity.current.add(_tmpDir.copy(forward).multiplyScalar(speed));
    if (keys.current.has('KeyS') || keys.current.has('ArrowDown')) velocity.current.add(_tmpDir.copy(forward).multiplyScalar(-speed));
    if (keys.current.has('KeyA') || keys.current.has('ArrowLeft')) velocity.current.add(_tmpSide.copy(right).multiplyScalar(-speed));
    if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) velocity.current.add(_tmpSide.copy(right).multiplyScalar(speed));

    // NO-CLIP MOVEMENT: Collision removed so the user can move freely through all structures.
    const isHub = chamber.id === 0;
    pPos.add(velocity.current);
    if (isHub) {
      const curve = useVillageTunerStore.getState().densityCurve;
      const rMax = curve.rMax || 900;
      const r = Math.sqrt(pPos.x * pPos.x + pPos.z * pPos.z);
      const t = r / rMax;
      useVillageTunerStore.getState().setPlayerZoneInfo({
        r,
        t,
        zoneName: getZoneName(r, curve),
      });

      if (r >= rMax) {
        // Clamped to perimeter and movement stopped
        pPos.x = (pPos.x / r) * rMax;
        pPos.z = (pPos.z / r) * rMax;
        velocity.current.set(0, 0, 0);
        if (!useVillageTunerStore.getState().edgeModalOpen) {
          useVillageTunerStore.getState().setEdgeModalOpen(true);
        }
      }
      pPos.y = 1.6;
    } else {
      const bound = CHAMBER_SIZE - 2;
      pPos.y = 1.6;
      pPos.x = Math.max(-bound, Math.min(bound, pPos.x));
      pPos.z = Math.max(-bound, Math.min(bound, pPos.z));
    }

    if (enterCooldown.current > 0) enterCooldown.current--;

    // Altar proximity
    const altarDist = pPos.distanceTo(ALTAR_POS);
    const nearAltar = altarDist < ALTAR_INTERACT_DIST;
    onNearFolder(nearAltar ? -999 : findNearestFolder());

    if (onNearAres) onNearAres(false);
    if (onNearTermite) onNearTermite(false);

    // 4 Functional Village Service Cottages & Landmark proximity triggers
    if (isHub) {
      const isNearTerminal = pPos.distanceTo(TERMINAL_COTTAGE_POS) < COTTAGE_INTERACT_DIST;
      const isNearPost = pPos.distanceTo(POST_COTTAGE_POS) < COTTAGE_INTERACT_DIST;
      const isNearMindmap = pPos.distanceTo(MINDMAP_COTTAGE_POS) < COTTAGE_INTERACT_DIST;
      const isNearVault = pPos.distanceTo(SYNAPTIC_VAULT_POS) < COTTAGE_INTERACT_DIST;

      if (onNearNoticeBoard) onNearNoticeBoard(isNearTerminal);
      if (onNearMapTable) onNearMapTable(isNearMindmap);
      if (onNearLibraryPillar) onNearLibraryPillar(isNearTerminal);
      if (onNearMoodStone) onNearMoodStone(isNearVault);
      if (onNearBottlePost) onNearBottlePost(isNearPost);
    }

    playerYaw.current = yaw.current;

    const speedLead = Math.min(velocity.current.length(), MOVE_SPEED * 1.5) * CAMERA_MOVE_LEAD;
    const cosPitch = Math.cos(pitch.current);
    const sinPitch = Math.sin(pitch.current);
    const lookDist = CAMERA_LOOK_AHEAD + speedLead;
    desiredLook.current.set(
      pPos.x + forward.x * lookDist * cosPitch,
      pPos.y + CAMERA_LOOK_HEIGHT + lookDist * sinPitch * 2.2,
      pPos.z + forward.z * lookDist * cosPitch,
    );
    desiredCam.current.set(
      pPos.x - forward.x * CAMERA_SOCKET_DISTANCE,
      pPos.y + CAMERA_SOCKET_HEIGHT,
      pPos.z - forward.z * CAMERA_SOCKET_DISTANCE,
    );
    const positionAlpha = 1 - Math.pow(1 - CAMERA_LERP, delta * 60);
    const lookAlpha = 1 - Math.pow(1 - LOOK_LERP, delta * 60);
    cameraTarget.current.lerp(desiredCam.current, positionAlpha);
    lookTarget.current.lerp(desiredLook.current, lookAlpha);
    camera.position.copy(cameraTarget.current);
    camera.lookAt(lookTarget.current);

  });
  return null;
}
