import { Suspense, useMemo } from 'react';
import { FEATURES, type FeatureId } from './FeatureRegistry';
import type { Thought } from './types';
import type { CitadelState } from './hooks/useCitadelState';
import type { WorldVFXEvent } from './RebuiltWorld';
import { parseLocalDateFromChamber } from './calendarChamberUtils';
import { parseCalendarChamberId, SEASONS } from './fractalCalendarModel';
import { resolveWritablePeriod, type JournalLevel } from './writablePath';
import { resolveAltarDestination } from './altarRouter';

type Props = {
  // Props bag is intentionally loose — feature-specific, shape determined by caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeFeature: { id: FeatureId; props?: Record<string, any> } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openFeature: (id: FeatureId, props?: Record<string, any>) => void;
  closeFeature: () => void;
  state: CitadelState;
  emitVFX: (type: WorldVFXEvent['type']) => void;
  enterChamber: (id: number) => void;
};

export default function RebuiltGameFeatureLayer({
  activeFeature,
  closeFeature,
  openFeature,
  state,
  emitVFX,
  enterChamber,
}: Props) {
  const journalThoughtsForLLM = useMemo((): Thought[] => {
    const flat: Thought[] = [];
    for (const ch of Object.values(state.chambers)) {
      for (const t of ch.thoughts) flat.push(t);
    }
    return flat.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 120);
  }, [state.chambers]);

  if (!activeFeature) return null;

  return (
    <Suspense fallback={null}>
      {(() => {
        const def = FEATURES[activeFeature.id];
        if (!def) return null;
        const Component = def.component as React.ComponentType<any>;

        if (activeFeature.id === 'inscribe') {
          return (
            <Component
              open
              onClose={closeFeature}
              onSave={(text: string) => {
                state.addThought(text);
                closeFeature();
                emitVFX('write');
              }}
            />
          );
        }

        if (activeFeature.id === 'terminal') {
          return (
            <Component
              open
              onClose={closeFeature}
              chamber={state.currentChamber}
              chambers={state.chambers}
              onDeleteBranch={(id: any) => { state.deleteBranch(id); emitVFX('delete'); }}
              onDeleteThought={(id: any) => { state.deleteThought(id); emitVFX('delete'); }}
              onEnterChamber={enterChamber}
              onRenameChamber={state.renameChamber}
              onAddThought={(text: any, type: any) => { state.addThought(text, type); emitVFX('write'); }}
              onEditThought={state.editThought}
              onTogglePin={(id: any) => { state.togglePinThought(id); emitVFX('pin'); }}
              identity={state.identity}
              onSetIdentity={state.setIdentity}
              onCreateBranch={state.createSubChamber}
              onCreateMindMap={(input: any) => { const r = state.createMindMap(input); emitVFX('mindmap'); return r; }}
              getBreadcrumb={state.getBreadcrumb}
              exportData={state.exportData}
              onAddTag={(id: any, tag: any) => { state.addTag(id, tag); emitVFX('tag'); }}
              onRemoveTag={state.removeTag}
              onAddReply={(parentId: any, text: any) => { state.addReply(parentId, text); emitVFX('reply'); }}
              onToggleBookmark={(id: any) => { state.toggleBookmark(id); emitVFX('bookmark'); }}
              fuzzyJump={state.fuzzyJump}
              onMergeChambers={(src: any, tgt: any) => { state.mergeChambers(src, tgt); emitVFX('merge'); }}
              onSetMood={(id: any, mood: any) => { state.setThoughtMood(id, mood); emitVFX('mood'); }}
              getOrphans={state.getOrphans}
              getChamberSummary={state.getChamberSummary}
              findSimilar={state.findSimilar}
              exportMarkdown={state.exportMarkdown}
              exportTimeline={state.exportTimeline}
              importMarkdown={state.importMarkdown}
              onCompleteRitual={state.completeRitual}
              onSendBottle={(text: any) => { state.sendBottle(text); }}
              onOpenHeatmap={() => openFeature('heatmap')}
              onWriteLetter={(days: any, text: any) => { const revealDate = new Date(Date.now() + (days as number) * 86400000).toISOString(); state.writeFutureLetter(text, revealDate); }}
              onOpenSkybox={() => openFeature('skybox')}
              onAddFurniture={(kind: any) => { const rx = (Math.random() - 0.5) * 20; const rz = (Math.random() - 0.5) * 20; state.addFurniture(kind, rx, rz); }}
              onAddNamePlate={(text: any) => { const rx = (Math.random() - 0.5) * 16; const rz = (Math.random() - 0.5) * 16; state.addNamePlate(text, rx, rz); }}
              onOpenGraph={() => openFeature('graph')}
              onOpenConstellation={() => {
                closeFeature();
                openFeature('chrono_dial');
              }}
              onOpenMindMap={() => {
                closeFeature();
                openFeature('mindmap');
              }}
            />
          );
        }

        if (activeFeature.id === 'termite') {
          return (
            <Component
              open
              onClose={closeFeature}
              chamber={state.currentChamber}
              identity={state.identity}
              journalThoughts={journalThoughtsForLLM}
              mbti={state.identity.calibration?.mbti}
              mbtiConsent={!!state.identity.calibration?.consentSigmaPersonalization}
              onOpenMBTI={() => openFeature('mbti')}
              onOpenSigmaMap={() => openFeature('constellation', { mode: 'calendar' })}
            />
          );
        }

        if (activeFeature.id === 'mbti') {
          return (
            <Component
              open
              onClose={closeFeature}
              identity={state.identity}
              onApply={(calibrationPatch: any) => {
                state.applyMBTICalibration(calibrationPatch);
                emitVFX('upgrade');
                closeFeature();
              }}
            />
          );
        }

        if (activeFeature.id === 'bottle') {
          return (
            <Component
              open
              onClose={closeFeature}
              chamber={state.currentChamber}
              identity={state.identity}
              onSendBottle={(text: string) => {
                state.sendBottle(text);
                emitVFX('write');
              }}
              onWriteLetter={(days: number, text: string) => {
                const revealDate = new Date(Date.now() + days * 86400000).toISOString();
                state.writeFutureLetter(text, revealDate);
                emitVFX('seal');
              }}
              onCollectBottles={() => state.collectBottles()}
            />
          );
        }

        if (activeFeature.id === 'constellation' || activeFeature.id === 'graph') {
          const mapMode =
            activeFeature.id === 'graph'
              ? 'thoughts'
              : activeFeature.props?.mode === 'calendar'
                ? 'calendar'
                : 'chambers';
          return (
            <Component
              mode={mapMode}
              chambers={state.chambers}
              currentChamberId={state.currentChamberId}
              onNavigate={activeFeature.id === 'graph' ? (id: any) => { enterChamber(id); closeFeature(); } : enterChamber}
              onClose={closeFeature}
            />
          );
        }

        if (activeFeature.id === 'search') {
          return (
            <Component
              onClose={closeFeature}
              onNavigate={(id: any) => { enterChamber(id); closeFeature(); }}
              searchThoughts={state.searchThoughts}
              fuzzyJump={state.fuzzyJump}
              chambers={state.chambers}
            />
          );
        }

        if (activeFeature.id === 'chrono_dial') {
          return (
            <Component
              open
              onClose={closeFeature}
              chambers={state.chambers}
              onEnterChamber={(id: number) => {
                enterChamber(id);
                closeFeature();
                emitVFX('teleport');
              }}
            />
          );
        }



        if (activeFeature.id === 'heatmap') {
          return <Component onClose={closeFeature} moodLog={state.identity.moodLog || []} />;
        }
        if (activeFeature.id === 'skybox') {
          return <Component onExit={closeFeature} onSave={(data: any) => { state.setSkybox(data); closeFeature(); }} />;
        }
        if (activeFeature.id === 'notebook') {
          return <Component open onClose={closeFeature} state={state} />;
        }
        if (activeFeature.id === 'mindmap') {
          return <Component open onClose={closeFeature} />;
        }
        if (activeFeature.id === 'altar') {
          const destination = resolveAltarDestination(state.currentChamber, activeFeature.props);
          return (
            <Component
              open
              destination={destination}
              level="day"
              period={destination.kind === 'journal' ? destination.period : undefined}
              day={destination.kind === 'journal' ? destination.period : undefined}
              onClose={closeFeature}
              onInscribed={() => emitVFX('write')}
            />
          );
        }
        if (activeFeature.id === 'archive') {
          return (
            <Component
              onClose={closeFeature}
              onNavigate={(id: any) => { enterChamber(id); closeFeature(); }}
              searchThoughts={state.searchThoughts}
              fuzzyJump={state.fuzzyJump}
              chambers={state.chambers}
            />
          );
        }
        return null;
      })()}
    </Suspense>
  );
}
