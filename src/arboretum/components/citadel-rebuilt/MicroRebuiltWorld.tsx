/**
 * Catacombs shell — minimal geometry + the same interaction graph as the
 * full lodge. Loaded only when `VITE_CITADEL_MICRO` is set (see citadelBuildMode).
 */
import { useMemo, useState } from 'react';
import { PlayerController } from './world/PlayerController';
import { TheBit } from './world/TheBit';
import { resolveBitAvatar } from './world/bitProfile';
import { RebuiltPortal } from './world/PortalSystems';
import { ProximityGlyph } from './RebuiltWorldShared';
import type { RebuiltWorldProps } from './RebuiltWorld';
import { useCitadelStore as useNotebookStore } from '@/core/state/citadelStore';
import { getNumericId } from './hooks/useCitadelState';
import { localDateISO } from './localDate';

const PORTAL_X = 11;
const TODAY_PORTAL_POS: [number, number, number] = [-14, 2.4, -10];
const safeText = (v: unknown, fb = '…') => (typeof v === 'string' && v.length > 0) ? v : fb;

function MicroBeacon({ pos, color }: { pos: [number, number, number]; color: string }) {
  return (
    <group position={pos}>
      <mesh>
        <octahedronGeometry args={[1.2, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.4, 0.06, 6, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function MicroRebuiltWorld({
  chamber,
  chambers,
  onEnterChamber,
  onOpenModal,
  onCreateBranch,
  onGoBack,
  onOpenTerminal,
  onRequestReset,
  onOpenSigma,
  onOpenTermite,
  onUndo,
  onRedo,
  onRitual,
  onOpenLedger,
  playerWorldPos,
  playerYaw,
  uiOpen,
  identity,
  vfxEvents: _vfx,
  fireworksActive: _fw,
  trailStyle: _trail,
  weatherMode: _w,
  footstepsOn: _fs,
  ghostTrailsOn: _gt,
  photoMode: _pm,
  onNearAltar,
  onNearSigma,
  onNearTermite,
  onNearPortal,
  onGoRoot,
}: RebuiltWorldProps) {
  const isPupil = chamber.id === 0;
  const [nearFolderLocal, setNearFolderLocal] = useState<number | null>(null);
  const [nearSigmaLocal, setNearSigmaLocal] = useState(false);
  const [nearTermiteLocal, setNearTermiteLocal] = useState(false);

  const portalPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    let sigmaPlaced = false;
    chamber.doors.forEach((doorId, index) => {
      const target = chambers[doorId];
      if (target?.template === 'sigma-tutorial-root' && !sigmaPlaced) {
        positions.push([0, 2.4, -38]);
        sigmaPlaced = true;
      } else {
        const side = index % 2 === 0 ? -1 : 1;
        const row = Math.floor(index / 2);
        const z = -10 + row * 8;
        positions.push([side * PORTAL_X, 2.4, z]);
      }
    });
    return positions;
  }, [chamber.doors, chambers]);

  const globalMindMap = useNotebookStore(s => s.state.globalMindMap);
  const mindMapRootId = useMemo(() => {
    const firstNode = globalMindMap.nodes?.[0];
    return firstNode ? getNumericId(firstNode.id) : -999;
  }, [globalMindMap.nodes]);

  const mindMapChamberIds = useMemo(() => {
    return new Set((globalMindMap.nodes || []).map(n => getNumericId(n.id)));
  }, [globalMindMap.nodes]);

  const today = localDateISO();

  const todayChamber = useMemo(() => {
    if (chamber.id !== 0) return null;
    return Object.values(chambers).find(
      c => c.template === 'day' && c.description.includes(today),
    ) ?? null;
  }, [chamber.id, chambers, today]);

  const extraPortals = useMemo(() => {
    const list: { id: number; pos: [number, number, number] }[] = [];
    if (todayChamber) list.push({ id: todayChamber.id, pos: TODAY_PORTAL_POS });
    if (chamber.id === 0) {
      list.push({ id: -1000, pos: [0, 2.4, -32] });
    }
    return list;
  }, [todayChamber, chamber.id]);

  const visibleDoors = useMemo(() => {
    if (chamber.template === 'day') {
      const returnDoor = chamber.parent ?? 0;
      return chamber.doors.includes(returnDoor) ? [returnDoor] : [0];
    }
    return isPupil
      ? chamber.doors.filter(doorId => !mindMapChamberIds.has(doorId))
      : chamber.doors;
  }, [isPupil, chamber.doors, chamber.parent, chamber.template, mindMapChamberIds]);

  const wormholePositions = useMemo(
    () => (chamber.wormholes ?? []).map((_, i) => {
      const angle = (i / Math.max((chamber.wormholes ?? []).length, 1)) * Math.PI * 2 + Math.PI / 4;
      const radius = 16;
      return [Math.cos(angle) * radius, 3.5, Math.sin(angle) * radius] as [number, number, number];
    }),
    [chamber.wormholes],
  );

  return (
    <>
      <color attach="background" args={['#030208']} />
      <fog attach="fog" args={['#030208', 18, 110]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 22, 0]} intensity={0.6} color="#a855f7" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[220, 220]} />
        <meshBasicMaterial color="#0c0618" transparent opacity={0.92} />
      </mesh>
      <gridHelper args={[140, 28, '#4c1d95', '#1e1033']} position={[0, 0.02, 0]} />

      {chamber.depth === 0 && (
        <>
          <ProximityGlyph glyph="Σ" position={[0, 6.5, -32]} active={nearSigmaLocal} playerPos={playerWorldPos} color="#22d3ee" />
          <MicroBeacon pos={[0, 3.2, -32]} color="#22d3ee" />
          <ProximityGlyph glyph="Λ" position={[26, 5.5, 0]} active={nearTermiteLocal} playerPos={playerWorldPos} color="#34d399" />
          <MicroBeacon pos={[26, 2.2, 0]} color="#34d399" />
        </>
      )}

      {visibleDoors.map((doorId, index) => {
        const target = chambers[doorId];
        if (!target) return null;
        const stale = target.lastVisited ? (Date.now() - target.lastVisited > 7 * 86400000) : false;
        return (
          <RebuiltPortal
            key={doorId}
            position={portalPositions[index]}
            targetName={safeText(target.name)}
            active={nearFolderLocal === doorId}
            onEnter={() => onEnterChamber(doorId)}
            playerPos={playerWorldPos}
            bookmarked={target.bookmarked}
            stale={stale}
            template={target.template}
          />
        );
      })}

      {chamber.id === 0 && (
        <RebuiltPortal
          key="calendar-eye-gate"
          position={[0, 2.4, -32]}
          targetName="MIND MAP"
          active={nearFolderLocal === -1000}
          onEnter={() => onEnterChamber(-1000)}
          playerPos={playerWorldPos}
          template="sigma-tutorial-root"
        />
      )}

      {chamber.id === 0 && todayChamber && (
        <>
          <ProximityGlyph
            glyph="◉"
            position={[TODAY_PORTAL_POS[0], 5.5, TODAY_PORTAL_POS[2]]}
            active={nearFolderLocal === todayChamber.id}
            playerPos={playerWorldPos}
            color="#fbbf24"
          />
          <RebuiltPortal
            key="today-portal"
            position={TODAY_PORTAL_POS}
            targetName="TODAY"
            active={nearFolderLocal === todayChamber.id}
            onEnter={() => onEnterChamber(todayChamber.id)}
            playerPos={playerWorldPos}
            template="sigma-tutorial-root"
          />
        </>
      )}

      {(chamber.wormholes ?? []).map((whId, index) => {
        const target = chambers[whId];
        if (!target) return null;
        return (
          <group key={`wh-${whId}`} position={wormholePositions[index]}>
            <mesh>
              <torusKnotGeometry args={[1.1, 0.22, 48, 8]} />
              <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.45} />
            </mesh>
          </group>
        );
      })}

      <TheBit
        playerPos={playerWorldPos}
        playerYaw={playerYaw}
        visible
        variant="rebuilt"
        avatar={resolveBitAvatar(identity?.avatar)}
        emitTrail={false}
      />

      <PlayerController
        onNearFolder={(id) => {
          setNearFolderLocal(id);
          onNearAltar?.(id === -999);
          onNearPortal?.(id !== -999 ? id : null);
        }}
        chamber={chamber}
        onEnterChamber={onEnterChamber}
        onOpenModal={onOpenModal}
        onCreateBranch={onCreateBranch}
        onGoBack={onGoBack}
        onOpenTerminal={onOpenTerminal}
        onRequestReset={onRequestReset}
        onOpenAres={onOpenSigma}
        onNearAres={(near) => { setNearSigmaLocal(near); onNearSigma?.(near); }}
        onOpenTermite={onOpenTermite}
        onNearTermite={(near) => { setNearTermiteLocal(near); onNearTermite?.(near); }}
        onRitual={onRitual}
        onOpenSigma={onOpenSigma}
        onOpenLedger={onOpenLedger}
        onGoRoot={onGoRoot}
        playerWorldPos={playerWorldPos}
        playerYaw={playerYaw}
        uiOpen={uiOpen}
        extraPortals={extraPortals}
      />
    </>
  );
}
