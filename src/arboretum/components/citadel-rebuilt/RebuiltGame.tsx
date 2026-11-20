import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { WorldVFXEvent } from './RebuiltWorld';
import { isCitadelMicro } from './citadelBuildMode';
import { isPs1Visuals } from './ps1Aesthetic';
import { Ps1Bezel } from './Ps1Bezel';
import { Ps1InternalResolution } from './Ps1InternalResolution';
import { TheBit } from './world/TheBit';
import { useCitadelState } from './hooks/useCitadelState';
import { useDevShortcuts } from './devShortcuts';
import { useSceneManager } from './hooks/useSceneManager';
import { resolveBitAvatar } from './world/bitProfile';
import { getQualityProfile } from './qualityTier';
import { AdaptiveRenderer } from './AdaptiveRenderer';
import { rewindAll as rewindShaderTime } from './shaderTimeRegistry';
import { CitadelBrandEnvironment } from './CitadelBrandEnvironment';
import {
  useProximityStore,
  setNearAltar,
  setNearTermite,
  setNearPortal,
  setNearNoticeBoard,
  setNearMapTable,
  setNearLibrary,
  setNearMoodStone,
  setNearBottlePost,
  resetProximity,
} from './proximityStore';

import CRTOverlay from '../CRTOverlay';
import CitadelCore from './CitadelCore';
import { FeatureId } from './FeatureRegistry';
import { handleForensicNotebookShortcut } from './forensicNotebookModel';
import RebuiltGameSceneHUD from './RebuiltGameSceneHUD';
import RebuiltGameFeatureLayer from './RebuiltGameFeatureLayer';
import RebuiltGameUtilityOverlays from './RebuiltGameUtilityOverlays';
import ScreenLoader from '../ScreenLoader';
import DevPerfOverlay from './DevPerfOverlay';
import { localDateISO } from './localDate';
import {
  analyzeThoughtStress,
  findDayChamberIdByLocalDate,
  getJournalSourceThoughts,
  hasDailyAnchorForToday,
  summarizeThoughtText,
} from './calendarChamberUtils';
import { getChamberIdForDate, syncSigmaEngineChambers } from './hooks/useCitadelState';
import { useCitadelStore as useWorldStore } from './store';
import DailyAnchorGate from './DailyAnchorGate';
import PauseMenuModal from './PauseMenuModal';
import MonadSettingsModal, { type MonadSettingsTab } from './settings/MonadSettingsModal';
import CanopyTunerOverlay from './settings/CanopyTunerOverlay';
import VillageTunerOverlay from './settings/VillageTunerOverlay';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';
import PurificationDossierModal from './settings/PurificationDossierModal';
import { EdgeBoundaryModal } from './world/village/EdgeBoundaryModal';
import { useFoliageDebugStore } from '@/core/state/foliageDebugStore';
import { countMonthJournalMetrics } from './fractalCalendarModel';
import { getCitadelSettings } from './settings/citadelSettings';

/** Full spectral lodge vs wireframe catacombs — decided at first paint by env. */
const LodgeWorld = lazy(async () => (isCitadelMicro() ? import('./MicroRebuiltWorld') : import('./RebuiltWorld')));

function SceneHandleBridge({
  rendererRef,
  sceneRef,
  cameraRef,
}: {
  rendererRef: MutableRefObject<THREE.WebGLRenderer | null>;
  sceneRef: MutableRefObject<THREE.Scene | null>;
  cameraRef: MutableRefObject<THREE.Camera | null>;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    rendererRef.current = gl;
    sceneRef.current = scene;
    cameraRef.current = camera;

    return () => {
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, [camera, cameraRef, gl, rendererRef, scene, sceneRef]);

  return null;
}

/**
 * Subscribes to the proximity store so only this small component
 * re-renders when the player crosses a portal/altar threshold,
 * not the entire RebuiltGame tree.
 */
function SceneHUDBridge(props: Record<string, unknown>) {
  const altar = useProximityStore(s => s.altar);
  const termite = useProximityStore(s => s.termite);
  const customize = useProximityStore(s => s.customize);
  const portal = useProximityStore(s => s.portal);
  const noticeBoard = useProximityStore(s => s.noticeBoard);
  const mapTable = useProximityStore(s => s.mapTable);
  const library = useProximityStore(s => s.library);
  const moodStone = useProximityStore(s => s.moodStone);
  const bottlePost = useProximityStore(s => s.bottlePost);
  const HudComponent = RebuiltGameSceneHUD as unknown as ComponentType<Record<string, unknown>>;
  return (
    <HudComponent
      {...props}
      nearAltar={altar}
      nearTermite={termite}
      nearPortal={portal}
      nearNoticeBoard={noticeBoard}
      nearMapTable={mapTable}
      nearLibrary={library}
      nearMoodStone={moodStone}
      nearBottlePost={bottlePost}
    />
  );
}

export default function RebuiltGame({ slotId, onReturnToMenu, onOpenMindMap, onOpenSynapticVault }: { slotId: string; onReturnToMenu: () => void; onOpenMindMap?: () => void; onOpenSynapticVault?: () => void }) {
  const state = useCitadelState(slotId);
  const nearNoticeBoard = useProximityStore(s => s.noticeBoard);
  const nearMapTable = useProximityStore(s => s.mapTable);
  const nearLibrary = useProximityStore(s => s.library);
  const nearMoodStone = useProximityStore(s => s.moodStone);
  const nearBottlePost = useProximityStore(s => s.bottlePost);
  const {
    scene,
    transitioning,
    transLabel,
    moshIntensity,
    playerWorldPos,
    playerYaw,
    transitionTo,
  } = useSceneManager(new THREE.Vector3(0, 2, 15));

  // Force Hub Landing (Chamber 0) on first load
  useEffect(() => {
    if (state.isLoaded && state.currentChamberId !== 0) {
      state.enterChamber(0);
    }
  }, [state.isLoaded]);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  // Cached for the lifetime of this game session. Tier never changes mid-run;
  // adaptive DRS handles intra-tier movement.
  const qualityProfile = useMemo(() => getQualityProfile(), []);
  const ps1 = isPs1Visuals();
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<{ id: FeatureId; props?: any } | null>(null);
  const [clipboardToast, setClipboardToast] = useState(false);
  const [snapshotFlash, setSnapshotFlash] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<MonadSettingsTab>('identity');
  const [onboardingPrimed, setOnboardingPrimed] = useState(false);
  const [inputMode, setInputMode] = useState<'world' | 'typing' | 'ui'>('world');

  const openFeature = useCallback((id: FeatureId, props?: any) => setActiveFeature({ id, props }), []);
  const closeFeature = useCallback(() => setActiveFeature(null), []);

  const chamberTransitionTimerRef = useRef<number | null>(null);
  const enterChamberWithTransition = useCallback((id: number) => {
    if (id === -1000) {
      openFeature('mindmap');
      return;
    }
    // Sanctuary Hub only — no 3D sub-chamber traversal
    if (state.currentChamberId !== 0) {
      state.enterChamber(0);
    }
  }, [state, openFeature]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__CITADEL_NAV__ = (id: number) => {
        if (id === -1000) openFeature('mindmap');
        else state.enterChamber(0);
      };
    }
  }, [state, openFeature]);

  // Ritual button (HUD RitualChip click + KeyR + △ Triangle):
  // Opens the Day-level Journal Altar directly in the Sanctuary Hub.
  const onRitualTrigger = useCallback(() => {
    const today = localDateISO();
    openFeature('altar', { kind: 'journal', level: 'day', period: today, day: today });
  }, [openFeature]);

  const needsDailyAnchor = state.isLoaded && !hasDailyAnchorForToday(state.identity);

  // Install `window.__citadel` console helpers in dev builds only so we can
  // rehearse the ritual state machine without waiting real time. Stripped
  // from the packaged .app.
  useDevShortcuts();

  // Sync name prompt when loaded (after today's root anchor exists)
  useEffect(() => {
    if (needsDailyAnchor) return;
    const settings = getCitadelSettings();
    if (settings.userName && settings.userName !== 'Traveler') {
      if (state.isLoaded && (state.identity.name === 'Traveler' || state.identity.name === 'UNKNOWN_PROGRAM')) {
        state.setIdentity(settings.userName);
      }
      return;
    }
    if (state.isLoaded && (state.identity.name === 'Traveler' || state.identity.name === 'UNKNOWN_PROGRAM')) {
      setNamePromptOpen(true);
    }
  }, [state.isLoaded, state.identity.name, needsDailyAnchor]);

  // Name capture is modal: clear feature overlays while active.
  useEffect(() => {
    if (namePromptOpen && activeFeature) setActiveFeature(null);
  }, [namePromptOpen, activeFeature]);

  // Guided first-run onboarding: no longer auto-surfaces tutorial.
  useEffect(() => {
    if (!state.isLoaded || onboardingPrimed) return;
    if (needsDailyAnchor) return;
    if (namePromptOpen) return;
    setOnboardingPrimed(true);
  }, [state.isLoaded, onboardingPrimed, namePromptOpen, needsDailyAnchor]);

  const [graphOpen, setGraphOpen] = useState(false);
  const [chamberTransitioning, setChamberTransitioning] = useState(false);
  const [chamberTransLabel, setChamberTransLabel] = useState('TRAVERSING CHAMBER');
  // Proximity flags live in an external store (proximityStore.ts) so the
  // PlayerController's per-frame setters never re-render this component.
  // Only the small SceneHUDBridge below subscribes.
  useEffect(() => () => resetProximity(), []);

  // ── World VFX event system ──
  const [vfxEvents, setVfxEvents] = useState<WorldVFXEvent[]>([]);
  const vfxIdRef = useRef(0);
  const emitVFX = useCallback((type: WorldVFXEvent['type']) => {
    const id = ++vfxIdRef.current;
    setVfxEvents(prev => [...prev.slice(-8), { id, type, time: performance.now() / 1000 }]);
    setTimeout(() => setVfxEvents(prev => prev.filter(e => e.id !== id)), 4000);
  }, []);

  const [arenaState, setArenaState] = useState({
    wave: 1,
    score: 0,
    kills: 0,
    hp: 100,    dead: false,
    wonMatch: false,
    rivalLabel: 'Stress Rival',
    rivalSource: '',
    readyToCashOut: false,
    composure: 100,
    school: 'Hoplite',
    sigil: 'Aegis Grid',
    prioritySeal: null as 'player' | 'enemy' | null,
    priorityTimer: 0,
    clashFreeze: 0,
    interference: 0,
    crowdFavor: 0,
    title: 'Initiate of the Grid',
    chronicle: '',
    rivalHouse: 'House Null',
    taunt: '',
  });

  const [defragProgress, setDefragProgress] = useState(0);
  const arenaRivals = useMemo(() => {
    return getJournalSourceThoughts(state.chambers)
      .filter(({ chamber, thought }) => chamber.template === 'day' && !thought.tags?.includes('daily-anchor'))
      .map(({ chamber, thought }) => {
        const stress = thought.stressScore != null
          ? { score: thought.stressScore, label: thought.stressLabel || 'charged thread' }
          : analyzeThoughtStress(thought.text, thought.tags, thought.mood);
        return {
          id: thought.id,
          label: summarizeThoughtText(thought.text, 34),
          sourceDate: thought.sourceDate || thought.timestamp.slice(0, 10),
          chamberName: chamber.name,
          stressScore: stress.score,
          stressLabel: stress.label,
        };
      })
      .sort((a, b) => b.stressScore - a.stressScore)
      .slice(0, 24);
  }, [state.chambers]);

  const downloadSnapshot = useCallback((canvas: HTMLCanvasElement) => {
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `citadel-snapshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, []);

  const captureSnapshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = Math.max(1, Math.floor(size.x));
    const height = Math.max(1, Math.floor(size.y));
    const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: false });
    target.texture.colorSpace = renderer.outputColorSpace;
    const previousTarget = renderer.getRenderTarget();
    const previousXrEnabled = renderer.xr.enabled;
    try {
      renderer.xr.enabled = false;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const pixels = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const snapshotCanvas = document.createElement('canvas');
      snapshotCanvas.width = width;
      snapshotCanvas.height = height;
      const context = snapshotCanvas.getContext('2d');
      if (!context) return;
      const imageData = context.createImageData(width, height);
      const rowLength = width * 4;
      for (let y = 0; y < height; y += 1) {
        const srcOffset = (height - y - 1) * rowLength;
        const destOffset = y * rowLength;
        imageData.data.set(pixels.subarray(srcOffset, srcOffset + rowLength), destOffset);
      }
      context.putImageData(imageData, 0, 0);
      setSnapshotFlash(true);
      window.setTimeout(() => setSnapshotFlash(false), 300);
      downloadSnapshot(snapshotCanvas);
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.xr.enabled = previousXrEnabled;
      target.dispose();
    }
  }, [downloadSnapshot]);

  useEffect(() => {
    return () => {
      if (chamberTransitionTimerRef.current) {
        window.clearTimeout(chamberTransitionTimerRef.current);
        chamberTransitionTimerRef.current = null;
      }
    };
  }, []);

  // Ensure UI overlays remain clickable when switching out of pointer-lock scenes.
  useEffect(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [scene, transitioning, chamberTransitioning]);

  // ── Undo/Redo + Map + Search + Pause keyboard shortcuts ──
  useEffect(() => {
    const uiOpenNow = !!activeFeature || graphOpen || bookmarksOpen || pauseOpen || settingsOpen;
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };
    
    // Altar defrag authoritative progression lives in the world/controller loop,
    // which owns the per-frame keyboard state. No side effects here.

    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Escape') {
        const debugState = useFoliageDebugStore.getState();
        if (debugState.dossierOpen) {
          e.preventDefault();
          debugState.closeDossier();
          return;
        }
        if (debugState.tunerOverlayOpen) {
          e.preventDefault();
          debugState.setTunerOverlayOpen(false);
          return;
        }
        if (settingsOpen) {
          e.preventDefault();
          setSettingsOpen(false);
          return;
        }
        if (pauseOpen) {
          e.preventDefault();
          setPauseOpen(false);
          return;
        }
        if (bookmarksOpen) {
          e.preventDefault();
          setBookmarksOpen(false);
          return;
        }
        if (activeFeature) {
          e.preventDefault();
          closeFeature();
          return;
        }
        e.preventDefault();
        setPauseOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); openFeature('search'); }
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && !uiOpenNow) { openFeature('mindmap'); }
      if ((e.key === 't' || e.key === 'T' || e.key === '`') && !e.metaKey && !e.ctrlKey && !uiOpenNow && scene === 'world') {
        e.preventDefault();
        useFoliageDebugStore.getState().toggleTunerOverlay();
      }
      if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !uiOpenNow && scene === 'world') {
        e.preventDefault();
        useVillageTunerStore.getState().toggleTunerOpen();
      }
      handleForensicNotebookShortcut(
        e.key,
        e.metaKey || e.ctrlKey,
        uiOpenNow,
        isTypingTarget(e.target),
        () => openFeature('notebook'),
      );
      if (e.key === 'k' && !e.metaKey && !e.ctrlKey && scene === 'world') {
        e.preventDefault();
        setBookmarksOpen(v => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '[') { e.preventDefault(); state.historyBack(); }
      if ((e.metaKey || e.ctrlKey) && e.key === ']') { e.preventDefault(); state.historyForward(); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const text = state.currentChamber.thoughts.map(t => t.text).join('\n\n');
        navigator.clipboard.writeText(text).then(() => {
          setClipboardToast(true);
          setTimeout(() => setClipboardToast(false), 1500);
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        captureSnapshot();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [captureSnapshot, state, openFeature, closeFeature, activeFeature, graphOpen, bookmarksOpen, pauseOpen, settingsOpen, scene]);

  // Auto-trigger Daily Prompt modal loop retired — the Day Chamber Altar is now the ritual.

  const uiOpen = !!activeFeature || graphOpen || bookmarksOpen || pauseOpen || settingsOpen;

  useEffect(() => {
    const isTypingTarget = (el: Element | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const refreshMode = () => {
      const active = document.activeElement;
      if (isTypingTarget(active)) {
        setInputMode('typing');
        return;
      }
      if (uiOpen) {
        setInputMode('ui');
        return;
      }
      setInputMode('world');
    };

    refreshMode();
    const onFocus = () => refreshMode();
    const onBlur = () => window.setTimeout(refreshMode, 0);
    const onKey = () => refreshMode();

    window.addEventListener('focusin', onFocus as EventListener);
    window.addEventListener('focusout', onBlur as EventListener);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('focusin', onFocus as EventListener);
      window.removeEventListener('focusout', onBlur as EventListener);
      window.removeEventListener('keydown', onKey);
    };
  }, [uiOpen]);
  const canvasFrameloop = uiOpen ? 'demand' : 'always';
  const bookmarks = state.getBookmarks();

  // Shader-time pause observer. Watches the same uiOpen boolean that drives
  // frameloop='demand'. On open we record the timestamp; on close we rewind
  // every registered continuous-animation material by the pause duration,
  // so the neural sky / altar rotation resume from their pre-pause phase
  // instead of jumping forward by pauseDurationMs.
  // One-shot animations (portal flashes, pickup glints) intentionally do NOT
  // register with shaderTimeRegistry — they capture their own startedAt at
  // trigger time and handle their own phase.
  const uiOpenPrevRef = useRef(false);
  const uiOpenedAtRef = useRef<number | null>(null);
  useEffect(() => {
    const wasOpen = uiOpenPrevRef.current;
    if (!wasOpen && uiOpen) {
      uiOpenedAtRef.current = performance.now();
    } else if (wasOpen && !uiOpen && uiOpenedAtRef.current != null) {
      const pauseMs = performance.now() - uiOpenedAtRef.current;
      rewindShaderTime(pauseMs);
      uiOpenedAtRef.current = null;
    }
    uiOpenPrevRef.current = uiOpen;
  }, [uiOpen]);

  if (!state.isLoaded) {
    return <ScreenLoader label="Reconstructing Citadel State" variant="rebuilt" />;
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#0a0414' }}>
      <CitadelCore />
      <div className="absolute inset-0">
      <Canvas
        camera={{ fov: ps1 ? 72 : 66, near: 0.1, far: 800, position: [0, 6.3, 17.1] }}
        style={{ position: 'absolute', inset: 0 }}
        // Tier-driven dpr ceiling. AdaptiveRenderer below adjusts at runtime.
        dpr={ps1 ? 1 : Math.min(window.devicePixelRatio, qualityProfile.maxPixelRatio)}
        // Suspend the render loop while modal UIs are open in the lodge.
        frameloop={canvasFrameloop}
        gl={{
          antialias: qualityProfile.antialias && !ps1,
          alpha: false,
          powerPreference: qualityProfile.tier === 'forge' ? 'high-performance' : 'low-power',
          stencil: false,
        }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(ps1 ? 1 : Math.min(window.devicePixelRatio, qualityProfile.maxPixelRatio));
          // Static meshes don't need their world matrix re-computed every frame;
          // we leave that opt-in per mesh. This sets the renderer-level baseline.
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
          // Expose the renderer for the dev perf overlay (dev builds only).
          const meta = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
          if (meta?.DEV) {
            (window as unknown as { __R3F_RENDERER?: unknown }).__R3F_RENDERER = gl;
          }
        }}
      >
        {ps1 && <Ps1InternalResolution />}
        <AdaptiveRenderer />
        <CitadelBrandEnvironment chamber={state.currentChamber} />
        <Suspense fallback={null}>
          <SceneHandleBridge rendererRef={rendererRef} sceneRef={sceneRef} cameraRef={cameraRef} />
          {scene === 'world' && (
            <LodgeWorld
              chamber={state.currentChamber}
              chambers={state.chambers}
              onEnterChamber={(id) => {
                if (id === -1000) {
                  openFeature('mindmap');
                } else {
                  enterChamberWithTransition(id);
                }
              }}
              onOpenModal={() => openFeature('inscribe')}
              onCreateBranch={state.createSubChamber}
              onGoBack={state.goToParent}
              onOpenTerminal={() => openFeature('terminal')}
              onOpenAltar={() => openFeature('altar')}
              onRequestReset={() => {}}
              onOpenTermite={() => openFeature('termite')}
              onRitual={onRitualTrigger}
              onOpenLedger={() => openFeature('terminal')}
              playerWorldPos={playerWorldPos}
              playerYaw={playerYaw}
              uiOpen={uiOpen}
              identity={state.identity}
              vfxEvents={vfxEvents}
              trailStyle={state.identity.avatar?.trailStyle || 'none'}
              onOpenSigma={openFeature.bind(null, 'termite')}
              onNearSigma={(near) => { setNearTermite(near); }}
              onOpenNoticeBoard={() => setBookmarksOpen(true)}
              onNearNoticeBoard={(near) => { setNearNoticeBoard(near); }}
              onOpenMapTable={() => openFeature('mindmap')}
              onNearMapTable={(near) => { setNearMapTable(near); }}
              onOpenLibraryPillar={() => openFeature('search')}
              onNearLibraryPillar={(near) => { setNearLibrary(near); }}
              onOpenMoodStone={() => onOpenSynapticVault?.() ?? openFeature('graph')}
              onNearMoodStone={(near) => { setNearMoodStone(near); }}
              onOpenBottlePost={() => openFeature('bottle')}
              onNearBottlePost={(near) => { setNearBottlePost(near); }}
              nearNoticeBoard={nearNoticeBoard}
              nearMapTable={nearMapTable}
              nearLibrary={nearLibrary}
              nearMoodStone={nearMoodStone}
              nearBottlePost={nearBottlePost}
              onGoRoot={() => state.enterChamber(0)}
            />
          )}
        </Suspense>
      </Canvas>
      {ps1 && <Ps1Bezel />}
      </div>


      {!isCitadelMicro() && <DevPerfOverlay />}

      {/* DailyAnchorGate is now an intentional interaction, not a forced boot-gate */}
      {/* needsDailyAnchor && (
        <DailyAnchorGate onSubmit={body => state.submitDailyAnchor(body)} />
      ) */}

      <SceneHUDBridge
        scene={scene}
        state={state}
        inputMode={inputMode}
        arenaState={arenaState}
        openFeature={openFeature}
        onRitual={onRitualTrigger}
        emitVFX={emitVFX}
        setBookmarksOpen={setBookmarksOpen}
        defragProgress={defragProgress}
      />

      <RebuiltGameFeatureLayer
        activeFeature={activeFeature}
        closeFeature={closeFeature}
        openFeature={openFeature}
        state={state}
        emitVFX={emitVFX}
        enterChamber={enterChamberWithTransition}
      />

      <CRTOverlay
        mentalLoad={ps1 ? 32 : 0}
      />

      <RebuiltGameUtilityOverlays
        transitioning={chamberTransitioning}
        transLabel={chamberTransLabel}
        bookmarksOpen={bookmarksOpen}
        setBookmarksOpen={setBookmarksOpen}
        bookmarks={bookmarks}
        state={state}
        scene={scene}
        uiOpen={uiOpen}
        clipboardToast={clipboardToast}
        snapshotFlash={snapshotFlash}
        namePromptOpen={namePromptOpen}
        setNamePromptOpen={setNamePromptOpen}
        onEnterChamber={enterChamberWithTransition}
      />

      <PauseMenuModal
        open={pauseOpen}
        onResume={() => setPauseOpen(false)}
        onDissolveToMonad={() => {
          setPauseOpen(false);
          onReturnToMenu();
        }}
        onOpenSettings={() => {
          setSettingsInitialTab('identity');
          setSettingsOpen(true);
        }}
        onOpenWipe={() => {
          setPauseOpen(false);
          setSettingsInitialTab('wipe');
          setSettingsOpen(true);
        }}
      />

      <MonadSettingsModal
        open={settingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => setSettingsOpen(false)}
      />

      {(() => {
        const currentMonthIndex = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const currentMonthMetrics = countMonthJournalMetrics(
          state.chambers,
          currentYear,
          currentMonthIndex + 1,
        );
        return (
          <>
            <CanopyTunerOverlay
              realEntries={currentMonthMetrics.entryCount}
              realActiveDays={currentMonthMetrics.activeDays}
            />
            <VillageTunerOverlay />
          </>
        );
      })()}

      <PurificationDossierModal />
      <EdgeBoundaryModal />
    </div>
  );
}
