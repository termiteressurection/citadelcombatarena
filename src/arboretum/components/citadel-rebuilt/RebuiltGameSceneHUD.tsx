import RebuiltHUD from './RebuiltHUD';
import RitualChip from './RitualChip';
import type { FeatureId } from './FeatureRegistry';

type ArenaState = {
  wave: number;
  score: number;
  kills: number;
  hp: number;
  dead: boolean;
  wonMatch: boolean;
  rivalLabel?: string;
  rivalSource?: string;
  readyToCashOut?: boolean;
};

type Props = {
  scene: string;
  state: any;
  inputMode?: 'world' | 'typing' | 'ui';
  arenaState: ArenaState;
  nearAltar?: boolean;
  nearTermite?: boolean;
  nearPortal?: number | null;
  nearNoticeBoard?: boolean;
  nearMapTable?: boolean;
  nearLibrary?: boolean;
  nearMoodStone?: boolean;
  nearBottlePost?: boolean;
  openFeature: (id: FeatureId, props?: any) => void;
  onRitual?: () => void;
  emitVFX: (type: any) => void;
  setBookmarksOpen: React.Dispatch<React.SetStateAction<boolean>>;
  defragProgress?: number;
};

export default function RebuiltGameSceneHUD({
  scene,
  state,
  inputMode = 'world',
  arenaState,
  nearAltar = false,
  nearTermite = false,
  nearPortal = null,
  nearNoticeBoard = false,
  nearMapTable = false,
  nearLibrary = false,
  nearMoodStone = false,
  nearBottlePost = false,
  openFeature,
  onRitual,
  emitVFX,
  setBookmarksOpen,
  defragProgress = 0,
}: Props) {

  if (scene === 'world') {
    return (
      <>
        <RebuiltHUD
          chamber={state.currentChamber}
          chambers={state.chambers}
          identity={state.identity}
          inputMode={inputMode}
          nearAltar={nearAltar}
          nearTermite={nearTermite}
          nearPortal={nearPortal}
          nearNoticeBoard={nearNoticeBoard}
          nearMapTable={nearMapTable}
          nearLibrary={nearLibrary}
          nearMoodStone={nearMoodStone}
          nearBottlePost={nearBottlePost}
        />
        <RitualChip onTrigger={onRitual} />
        {defragProgress > 0 && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[150] pointer-events-none flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full border-2 border-purple-500/20 relative">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="32" cy="32" r="30" fill="none" stroke="#a855f7" strokeWidth="3"
                  strokeDasharray={`${defragProgress * 1.88} 188`}
                  className="transition-all duration-75"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-mono text-purple-200">{Math.floor(defragProgress)}%</span>
              </div>
            </div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-purple-300 animate-pulse">HEARTH RITUAL IN PROGRESS</p>
          </div>
        )}
      </>
    );
  }

  if (scene === 'gladiator3d') {
    return (
      <div className="pointer-events-none fixed left-0 top-0 z-[100] p-5 font-mono">
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/70">THE NEON COLOSSEUM</p>
        <p className="mt-1 text-[9px] tracking-[0.15em] text-amber-200/55">ROUND {arenaState.wave} · SCORE {arenaState.score} · WINS {arenaState.kills}</p>
        {arenaState.rivalLabel && (
          <p className="mt-0.5 text-[9px] tracking-[0.12em] text-fuchsia-200/75">
            RIVAL: {arenaState.rivalLabel}{arenaState.rivalSource ? ` · ${arenaState.rivalSource}` : ''}
          </p>
        )}
        <p className="mt-0.5 text-[9px] tracking-[0.15em] text-red-300/55">INTEGRITY {arenaState.hp}</p>
        <p className="mt-1 text-[9px] tracking-[0.15em] text-cyan-100/45">ESC EXIT (○ on controller)</p>
        {arenaState.dead && arenaState.wonMatch && (
          <p className="mt-1 text-[9px] tracking-[0.15em] text-emerald-300/80">VICTORY · ENTER NEXT RIVAL (✕ / △ on controller)</p>
        )}
        {arenaState.dead && !arenaState.wonMatch && (
          <p className="mt-1 text-[9px] tracking-[0.15em] text-red-300/50">DEFEATED · NO SPOILS · ENTER RETRY · ESC EXIT (✕ / ○ on controller)</p>
        )}
      </div>
    );
  }

  return null;
}
