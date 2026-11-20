import { useState, useRef, useEffect, useCallback } from 'react';
import { Chamber, GridIdentity } from './types';
import { getPlugin } from './terminal/TerminalRegistry';
import { executeTerminalCommand, type TerminalExecContext } from './terminal/terminalCommands';
import { UI_LAYER } from './uiLayers';

const BG = 'hsl(270 30% 4% / 0.97)';
const BD = 'hsl(280 80% 40% / 0.5)';
const CYAN = 'hsl(270 80% 72%)';
const MAG = 'hsl(330 80% 68%)';
const GOLD = 'hsl(45 90% 60%)';
const DIM = 'hsl(270 20% 50%)';
const RED = 'hsl(350 70% 60%)';
const GRN = 'hsl(160 70% 55%)';

interface TL { id: number; type: 'cmd' | 'out' | 'err' | 'sys' | 'ok' | 'hdr'; text: string }

const LC: Record<TL['type'], string> = { cmd: CYAN, out: MAG, err: RED, sys: DIM, ok: GRN, hdr: GOLD };
const _DIRECTIVES: Record<string, string> = {
  help: 'Display available directives',
  ls: 'List current chamber contents',
  cd: 'Navigate: cd <name|id> | cd ..',
  cat: 'View thought: cat <#>',
  pwd: 'Print current location',
  tree: 'Display chamber hierarchy',
  write: 'Record thought: write <text>',
  edit: 'Modify thought: edit <#> <text>',
  pin: 'Toggle pin: pin <#>',
  tag: 'Tag thought: tag <#> <tag> | untag <#> <tag>',
  reply: 'Reply to thought: reply <#> <text>',
  rename: 'Rename chamber or portal: rename <new name> | rename portal <#|id> <name>',
  mindmap: 'Create branches: mindmap root > child | sibling > leaf',
  talk: 'Commune with THE SIGMA at the Skull',
  rm: 'Delete: rm thought <#> | rm chamber <name|id>',
  search: 'Search all thoughts: search <query>',
  jump: 'Teleport to chamber: jump <name>',
  bookmark: 'Toggle bookmark: bookmark | bookmarks',
  wormhole: 'Link chambers: wormhole <chamber name|id>',
  sort: 'Sort thoughts: sort date | date-rev | alpha | pinned',
  merge: 'Merge chambers: merge <source> into <target>',
  template: 'Apply template: template <journal|brainstorm|project|daily>',
  orphans: 'List empty leaf chambers',
  summary: 'Summarize current chamber',
  similar: 'Find similar thoughts: similar <#>',
  mood: 'Tag mood: mood <#> <emoji>',
  streak: 'Show writing streak',
  'export-md': 'Export all thoughts as Markdown',
  'export-timeline': 'Export chronological timeline',
  'import-md': 'Import Markdown file (drag & drop)',
  upgrade: 'Upgrade: upgrade <altar|columns|portal|floor>',
  achievements: 'View achievement monuments',
  rituals: 'Daily ritual status',
  bottle: 'Send message in a bottle: bottle <text>',
  ghost: 'Toggle ghost trail echoes',
  mirror: 'Open mirror chamber — word cloud terrain',
  heatmap: 'View mood journal heatmap',
  letter: 'Write to future self: letter <days> <text>',
  echoboard: 'View last 5 commands in this chamber',
  trail: 'Set trail effect: trail <none|footprints|particles|ink|fire|stars|glitch>',
  photo: 'Toggle photo mode',
  skybox: 'Open skybox painter',
  lighthouse: 'Toggle chamber as a Beacon in the Void',
  ink: 'Set digital ink style: ink <classic|neon|glitch|vapor|gold>',
  furnish: 'Place furniture: furnish <lantern|rug|sculpture|crystal|obelisk|fountain>',
  sign: 'Place name plate: sign <text>',
  celebrate: 'Launch fireworks display',
  graph: 'Open thought graph visualization',
  paint: 'Open paint canvas',
  stats: 'Display grid statistics',
  whoami: 'Show identity disc',
  identity: 'Set identity: identity <name>',
  uptime: 'Session cycle duration',
  export: 'Download grid data as JSON',
  clear: 'Clear terminal output',
};

interface Props {
  open: boolean;
  onClose: () => void;
  chamber: Chamber;
  chambers: Record<number, Chamber>;
  onDeleteBranch: (id: number) => void;
  onDeleteThought: (id: number) => void;
  onEnterChamber: (id: number) => void;
  onRenameChamber: (id: number, name: string) => void;
  onAddThought: (text: string, type?: 'gem' | 'seed' | 'scroll' | 'monolith' | 'orb') => void;
  onEditThought: (id: number, text: string) => void;
  onTogglePin: (id: number) => void;
  identity: GridIdentity;
  onSetIdentity: (name: string) => void;
  onCreateBranch: (name?: string) => number | null | void;
  onCreateMindMap: (input: string) => { created: number; summary: string };
  getBreadcrumb: () => { id: number; name: string }[];
  exportData: () => string;
  // Wave 1+2+4+7 operations
  onAddTag?: (thoughtId: number, tag: string) => void;
  onRemoveTag?: (thoughtId: number, tag: string) => void;
  onAddReply?: (parentId: number, text: string) => void;
  onToggleBookmark?: (chamberId: number) => void;
  onAddWormhole?: (from: number, to: number) => void;
  fuzzyJump?: (q: string) => number | null;
  onMergeChambers?: (src: number, tgt: number) => void;
  onSetMood?: (thoughtId: number, mood: string) => void;
  getOrphans?: () => { id: number; name: string }[];
  getChamberSummary?: (id: number) => string;
  findSimilar?: (thoughtId: number) => { chamberId: number; chamberName: string; thought: import('./types').Thought; score: number }[];
  exportMarkdown?: () => string;
  exportTimeline?: () => string;
  importMarkdown?: (md: string) => { created: number };
  onUpgradeStructure?: (structure: string) => boolean;
  getAchievements?: () => { id: string; label: string; unlocked: boolean }[];
  onCompleteRitual?: (slot: 'morning' | 'midday' | 'evening') => void;
  // Wave 8+: World features
  onSendBottle?: (text: string) => void;
  onToggleGhostTrails?: () => void;
  onOpenMirror?: () => void;
  onOpenHeatmap?: () => void;
  onWriteLetter?: (days: number, text: string) => void;
  onSetTrail?: (style: string) => void;
  onTogglePhotoMode?: () => void;
  onOpenSkybox?: () => void;
  onAddFurniture?: (kind: string) => void;
  onAddNamePlate?: (text: string) => void;
  onLaunchFireworks?: () => void;
  onOpenGraph?: () => void;
  onOpenPaint?: () => void;
  onToggleLighthouse?: (id: number) => void;
  onSetInk?: (style: string) => void;
  /** Full chamber constellation (replaces redundant in-terminal map tab). */
  onOpenConstellation?: () => void;
  /** Direct launcher for the 3D drag-and-drop mindmap. */
  onOpenMindMap?: () => void;
}

function previewText(text: string, max = 90) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function ChamberTerminal({
  open, onClose, chamber, chambers, onDeleteBranch, onDeleteThought,
  onEnterChamber, onRenameChamber, onAddThought, onEditThought,
  onTogglePin, identity, onSetIdentity, onCreateBranch, onCreateMindMap,
  getBreadcrumb, exportData,
  onAddTag, onRemoveTag, onAddReply, onToggleBookmark, onAddWormhole,
  fuzzyJump, onMergeChambers, onSetMood, getOrphans, getChamberSummary,
  findSimilar, exportMarkdown, exportTimeline, importMarkdown,
  onUpgradeStructure, getAchievements, onCompleteRitual: _onCompleteRitual,
  onSendBottle, onToggleGhostTrails,
  onOpenMirror, onOpenHeatmap, onWriteLetter, onSetTrail,
  onTogglePhotoMode, onOpenSkybox, onAddFurniture, onAddNamePlate,
  onLaunchFireworks, onOpenGraph,
  onOpenPaint,
  onToggleLighthouse, onSetInk, onOpenConstellation, onOpenMindMap,
}: Props) {
  const [lines, setLines] = useState<TL[]>([]);
  const [input, setInput] = useState('');
  const [pendingClear, setPendingClear] = useState(false);
  const [sideTab, setSideTab] = useState<'thoughts' | 'portals'>('thoughts');
  const [selectedThoughtId, setSelectedThoughtId] = useState<number | null>(null);
  const [selectedPortalId, setSelectedPortalId] = useState<number | null>(null);
  const [portalNameInput, setPortalNameInput] = useState('');
  const [branchNameInput, setBranchNameInput] = useState('');
  const pendingClearRef = useRef(false);
  const idRef = useRef(100);
  const cmdHist = useRef<string[]>([]);
  const histI = useRef(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ln = useCallback((type: TL['type'], text: string): TL =>
    ({ id: idRef.current++, type, text }), []);

  const push = useCallback((...nl: TL[]) => {
    setLines(prev => {
      const next = [...prev, ...nl];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    idRef.current = 100;
    setLines([
      { id: 1, type: 'sys', text: '╔══════════════════════════════════════════════════╗' },
      { id: 2, type: 'sys', text: '║      GRID TERMINAL v3.4 — SYSTEM INTERFACE       ║' },
      { id: 3, type: 'sys', text: '╚══════════════════════════════════════════════════╝' },
      { id: 4, type: 'out', text: `${identity.name}. Connection stable. Thoughts & portals on the right.` },
      { id: 5, type: 'out', text: `SECTOR: ${chamber.name.toUpperCase()} — DEPTH ${chamber.depth}` },
      { id: 6, type: 'sys', text: 'Type "help" for directives. Chamber graph: Constellation button (or `graph`).' },
    ]);
    setInput('');
    setSideTab('thoughts');
    setSelectedThoughtId(chamber.thoughts[0]?.id ?? null);
    setSelectedPortalId(chamber.doors[0] ?? null);
    setPortalNameInput(chamber.doors[0] !== undefined ? chambers[chamber.doors[0]]?.name ?? '' : '');
    setBranchNameInput('');
    cmdHist.current = [];
    histI.current = -1;
    setTimeout(() => {
      inputRef.current?.focus();
      if (document.pointerLockElement) document.exitPointerLock();
    }, 150);
  }, [open, chamber.id, chamber.name, chamber.depth, chamber.thoughts, chamber.doors, identity.name, chambers]);

  useEffect(() => {
    if (selectedPortalId === null) return;
    setPortalNameInput(chambers[selectedPortalId]?.name ?? '');
  }, [selectedPortalId, chambers]);

  useEffect(() => {
    if (!selectedThoughtId && chamber.thoughts[0]) {
      setSelectedThoughtId(chamber.thoughts[0].id);
    }
  }, [selectedThoughtId, chamber.thoughts]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  const fmtUp = useCallback(() => {
    const ms = Date.now() - identity.sessionStart;
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [identity.sessionStart]);

  const handlePortalRename = useCallback(() => {
    if (selectedPortalId === null) return;
    const nextName = portalNameInput.trim();
    if (!nextName) return;
    onRenameChamber(selectedPortalId, nextName);
    push(ln('ok', `Portal ${selectedPortalId} redesignated: ${nextName.toUpperCase()}.`));
  }, [selectedPortalId, portalNameInput, onRenameChamber, push, ln]);

  const handleQuickBranch = useCallback(() => {
    const nextName = branchNameInput.trim();
    const created = onCreateBranch(nextName || undefined);
    if (created == null) {
      push(ln('err', 'Calendar chambers are fixed. Use the existing day/week/month/season/year lattice.'));
      return;
    }
    push(ln('ok', nextName ? `Legacy annex created: ${nextName.toUpperCase()}.` : 'Legacy annex created. Name it once you know what it wants to be.'));
    setBranchNameInput('');
  }, [branchNameInput, onCreateBranch, push, ln]);

  const exec = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const [cmd] = trimmed.split(/\s+/);
    const c = cmd.toLowerCase();

    // `clear` is stateful — handle here
    if (c === 'clear') {
      push(ln('cmd', `Λ:\\> ${trimmed}`));
      push(ln('sys', '⚠ CLEAR ALL TERMINAL OUTPUT?'));
      push(ln('sys', '  ✕ (Cross) = Yes  ·  ○ (Circle) = No'));
      push(ln('sys', '  Or type: yes / no'));
      pendingClearRef.current = true;
      setPendingClear(true);
      return;
    }

    // Plugin dispatch (ls, cd, help, write, cat, pin, whoami, identity, stats…)
    const plugin = getPlugin(c);
    if (plugin) {
      push(ln('cmd', `Λ:\\> ${trimmed}`));
      plugin.execute(trimmed.slice(cmd.length).trim(), {
        chamber, chambers, identity, push, ln,
        onNavigate: onEnterChamber, onClose, state: null,
        onAddThought, onEditThought, onTogglePin, onDeleteThought,
        onSelectThought: setSelectedThoughtId, onSetSideTab: setSideTab,
        onSetIdentity, getUptime: fmtUp, getBreadcrumb,
      });
      return;
    }

    // Pending clear confirmation
    if (pendingClearRef.current) {
      if (c === 'yes' || c === 'y') {
        setLines([]);
        pendingClearRef.current = false;
        setPendingClear(false);
        return;
      }
      push(ln('cmd', `Λ:\\> ${trimmed}`));
      push(ln('sys', 'Clear cancelled.'));
      pendingClearRef.current = false;
      setPendingClear(false);
      return;
    }

    // All other commands delegated to terminalCommands.ts
    const execCtx: TerminalExecContext = {
      chamber, chambers, identity, push, ln,
      onNavigate: onEnterChamber, onClose, state: null,
      onAddThought, onEditThought, onTogglePin, onDeleteThought,
      onSelectThought: setSelectedThoughtId, onSetSideTab: setSideTab,
      onSetIdentity, getUptime: fmtUp, getBreadcrumb,
      onDeleteBranch, onRenameChamber, onCreateBranch, onCreateMindMap,
      exportData,
      onAddTag, onRemoveTag, onAddReply, onToggleBookmark, onAddWormhole,
      fuzzyJump, onMergeChambers, onSetMood, getOrphans, getChamberSummary,
      findSimilar, exportMarkdown, exportTimeline, importMarkdown,
      onUpgradeStructure, getAchievements,
      onCompleteRitual: _onCompleteRitual,
      onSendBottle, onToggleGhostTrails, onOpenMirror, onOpenHeatmap,
      onWriteLetter, onSetTrail, onTogglePhotoMode, onOpenSkybox,
      onAddFurniture, onAddNamePlate, onLaunchFireworks, onOpenGraph,
      onOpenPaint, onToggleLighthouse, onSetInk,
      onOpenConstellation,
    };
    const result = executeTerminalCommand(raw, execCtx);
    if (result !== null) push(...result);
  }, [
    chamber, chambers, identity, ln, push, getBreadcrumb,
    onEnterChamber, onClose, onAddThought, onEditThought, onTogglePin,
    onDeleteThought, onDeleteBranch, onRenameChamber, onSetIdentity,
    onCreateMindMap, onCreateBranch, exportData, fmtUp,
    onSendBottle, onToggleGhostTrails, onOpenMirror, onOpenHeatmap,
    onWriteLetter, onSetTrail, onTogglePhotoMode, onOpenSkybox,
    onAddFurniture, onAddNamePlate, onLaunchFireworks, onOpenGraph,
    onOpenPaint,
    onAddTag, onRemoveTag, onAddReply, onToggleBookmark, onAddWormhole,
    fuzzyJump, onMergeChambers, onSetMood, getOrphans, getChamberSummary,
    findSimilar, exportMarkdown, exportTimeline, importMarkdown,
    onUpgradeStructure, getAchievements,
    onToggleLighthouse, onSetInk, onOpenConstellation, _onCompleteRitual,
  ]);




  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const val = input;
      setInput('');
      if (val.trim()) {
        cmdHist.current.push(val);
        histI.current = -1;
      }
      exec(val);
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = cmdHist.current;
      if (!h.length) return;
      if (histI.current === -1) histI.current = h.length;
      histI.current = Math.max(0, histI.current - 1);
      setInput(h[histI.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histI.current === -1) return;
      histI.current++;
      if (histI.current >= cmdHist.current.length) {
        histI.current = -1;
        setInput('');
      } else {
        setInput(cmdHist.current[histI.current]);
      }
    }
  }, [input, exec, onClose]);

  if (!open) return null;

  const selectedThought = chamber.thoughts.find(thought => thought.id === selectedThoughtId) ?? chamber.thoughts[0] ?? null;
  const selectedPortal = selectedPortalId !== null ? chambers[selectedPortalId] : null;
  const thoughtLinkPattern = /@([^/\n]+)\/(\d+)/g;
  const resolveThoughtLink = (chamberNamePart: string, thoughtOrdinal: number) => {
    const nameQuery = chamberNamePart.trim().toLowerCase();
    const targetChamber = Object.values(chambers).find(c => c.name.toLowerCase().includes(nameQuery));
    if (!targetChamber) return null;
    const thought = targetChamber.thoughts[thoughtOrdinal - 1];
    if (!thought) return null;
    return { chamberId: targetChamber.id, chamberName: targetChamber.name, thoughtId: thought.id };
  };
  const renderThoughtWithLinks = (text: string) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(thoughtLinkPattern)) {
      const full = match[0];
      const chamberPart = match[1];
      const idx = Number(match[2]);
      const start = match.index ?? 0;
      if (start > last) parts.push(<span key={`txt-${start}`}>{text.slice(last, start)}</span>);
      const resolved = resolveThoughtLink(chamberPart, idx);
      if (resolved) {
        parts.push(
          <button
            key={`lnk-${start}`}
            className="mx-0.5 rounded border px-1 py-0 text-[10px] uppercase tracking-[0.08em] hover:brightness-125"
            style={{ color: CYAN, borderColor: 'hsl(180 100% 60% / 0.35)' }}
            onClick={() => {
              onEnterChamber(resolved.chamberId);
              onClose();
            }}
            title={`Jump to ${resolved.chamberName} thought ${idx}`}
          >
            {full}
          </button>,
        );
      } else {
        parts.push(<span key={`bad-${start}`} style={{ color: RED }}>{full}</span>);
      }
      last = start + full.length;
    }
    if (last < text.length) parts.push(<span key="tail">{text.slice(last)}</span>);
    return parts.length > 0 ? parts : [text];
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center font-mono"
      style={{ zIndex: UI_LAYER.terminal, animation: 'citadelFadeIn 180ms ease-out' }}
      role="dialog"
      aria-label="Chamber Terminal"
    >
      <div className="absolute inset-0" style={{ background: 'hsl(200 30% 2% / 0.9)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="relative w-[1180px] max-w-[96vw] h-[680px] max-h-[88vh] flex overflow-hidden"
        style={{
          background: BG,
          border: `1px solid ${BD}`,
          boxShadow: `0 0 60px hsl(190 80% 30% / 0.25), inset 0 0 40px hsl(200 30% 3% / 0.5)`,
          borderRadius: '4px',
          animation: 'citadelPanelIn 220ms ease-out',
        }}
      >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: `1px solid ${BD}` }}>
              <div className="flex items-center gap-3">
                <span style={{ color: CYAN }} className="text-sm">⬡</span>
                <span style={{ color: CYAN, textShadow: `0 0 10px hsl(180 100% 50% / 0.4)` }}
                  className="text-sm tracking-[0.2em] uppercase font-bold">SIGMA TERMINAL</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] tracking-wider uppercase" style={{ color: DIM }}>{identity.name} @ DEPTH {chamber.depth}</span>
                <button onClick={onClose} className="px-2 py-0.5 text-[10px] tracking-wider hover:brightness-150 transition-all"
                  style={{ color: RED, border: '1px solid hsl(0 70% 50% / 0.3)', borderRadius: '2px' }}>ESC</button>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: `${BD} transparent` }}>
              {lines.map(line => (
                <div key={line.id} className="text-[11px] tracking-wider leading-relaxed whitespace-pre-wrap"
                  style={{ color: LC[line.type], textShadow: line.type === 'hdr' ? '0 0 6px currentColor' : undefined }}>{line.text}</div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 shrink-0"
              style={{ borderTop: `1px solid ${BD}`, background: 'hsl(200 30% 3% / 0.6)' }}>
              <span className="text-xs shrink-0" style={{ color: CYAN, textShadow: `0 0 6px ${CYAN}` }}>Λ:\&gt;</span>
              <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                className="flex-1 bg-transparent text-[11px] tracking-[0.12em] uppercase outline-none placeholder:opacity-30 font-mono"
                style={{ color: CYAN, caretColor: CYAN }} placeholder="ENTER DIRECTIVE..." autoFocus />
            </div>
            <div className="px-4 py-1.5 text-center shrink-0" style={{ borderTop: '1px solid hsl(190 40% 15% / 0.4)' }}>
              <p className="text-[8px] tracking-[0.2em] uppercase" style={{ color: 'hsl(200 20% 25%)' }}>
                SIGMA INTERFACE — THE LODGE ABIDES</p>
            </div>
          </div>

          <div className="w-[340px] shrink-0 border-l px-3 py-3 flex flex-col gap-3"
            style={{ borderColor: BD, background: 'hsl(205 34% 5% / 0.9)' }}>
            <div className="grid grid-cols-2 gap-2">
              {(['thoughts', 'portals'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSideTab(tab)}
                  className="px-2 py-2 text-[10px] tracking-[0.18em] uppercase transition-colors"
                  style={{
                    color: sideTab === tab ? CYAN : DIM,
                    border: `1px solid ${sideTab === tab ? 'hsl(180 100% 60% / 0.45)' : 'hsl(190 60% 25% / 0.25)'}`,
                    background: sideTab === tab ? 'hsl(190 80% 14% / 0.5)' : 'transparent',
                    borderRadius: '2px',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            {onOpenConstellation && (
              <button
                type="button"
                onClick={() => { onOpenConstellation(); }}
                className="w-full px-2 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors"
                style={{
                  color: GOLD,
                  border: '1px solid hsl(180 100% 60% / 0.35)',
                  borderRadius: '2px',
                  background: 'hsl(190 80% 14% / 0.35)',
                }}
              >
                Open constellation map
              </button>
            )}

            {sideTab === 'thoughts' && (
              <div className="min-h-0 flex-1 flex flex-col gap-3">
                <div className="text-[10px] tracking-[0.16em] uppercase" style={{ color: GOLD }}>Chamber Thoughts</div>
                <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1">
                  {chamber.thoughts.length === 0 && (
                    <div className="text-[11px] leading-relaxed" style={{ color: DIM }}>
                      No inscriptions yet. Use `write`, the journal hotkey, or the main modal to make one.
                    </div>
                  )}
                  {chamber.thoughts.map((thought, index) => {
                    const active = selectedThought?.id === thought.id;
                    return (
                      <button
                        key={thought.id}
                        onClick={() => setSelectedThoughtId(thought.id)}
                        className="w-full text-left px-3 py-2"
                        style={{
                          border: `1px solid ${active ? 'hsl(180 100% 60% / 0.45)' : 'hsl(190 60% 25% / 0.2)'}`,
                          background: active ? 'hsl(190 80% 14% / 0.38)' : 'hsl(205 20% 8% / 0.55)',
                          borderRadius: '2px',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] tracking-[0.16em] uppercase" style={{ color: CYAN }}>
                            {({ gem: '◆', seed: '🌱', scroll: '📜', monolith: '▮', orb: '◉' })[thought.type ?? 'gem'] ?? '◆'} #{index + 1}{thought.pinned ? ' PINNED' : ''}
                          </span>
                          <span className="text-[9px]" style={{ color: DIM }}>{thought.timestamp}</span>
                        </div>
                        <div className="mt-1 text-[11px] leading-relaxed" style={{ color: active ? MAG : '#b0c9d8' }}>
                          {previewText(thought.text, 84)}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedThought && (
                  <div className="px-3 py-3 space-y-3" style={{ border: `1px solid hsl(190 60% 25% / 0.25)`, borderRadius: '2px', background: 'hsl(205 24% 7% / 0.8)' }}>
                    <div className="text-[10px] tracking-[0.16em] uppercase" style={{ color: GOLD }}>
                      Thought Preview
                    </div>
                    <div className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: '#cfe6f2' }}>
                      {renderThoughtWithLinks(selectedThought.text)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onTogglePin(selectedThought.id)}
                        className="flex-1 px-2 py-2 text-[10px] tracking-[0.14em] uppercase"
                        style={{ color: CYAN, border: `1px solid hsl(180 100% 60% / 0.35)`, borderRadius: '2px' }}
                      >
                        {selectedThought.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        onClick={() => onDeleteThought(selectedThought.id)}
                        className="flex-1 px-2 py-2 text-[10px] tracking-[0.14em] uppercase"
                        style={{ color: RED, border: `1px solid hsl(0 70% 60% / 0.35)`, borderRadius: '2px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sideTab === 'portals' && (
              <div className="min-h-0 flex-1 flex flex-col gap-3">
                <div className="text-[10px] tracking-[0.16em] uppercase" style={{ color: GOLD }}>Portal Control</div>
                <div className="min-h-0 max-h-[180px] overflow-y-auto space-y-2 pr-1">
                  {chamber.doors.length === 0 && (
                    <div className="text-[11px] leading-relaxed" style={{ color: DIM }}>
                      No portals in this chamber yet. Create one below or with `mindmap`.
                    </div>
                  )}
                  {chamber.doors.map((doorId, index) => {
                    const target = chambers[doorId];
                    if (!target) return null;
                    const active = selectedPortalId === doorId;
                    return (
                      <button
                        key={doorId}
                        onClick={() => setSelectedPortalId(doorId)}
                        className="w-full text-left px-3 py-2"
                        style={{
                          border: `1px solid ${active ? 'hsl(180 100% 60% / 0.45)' : 'hsl(190 60% 25% / 0.2)'}`,
                          background: active ? 'hsl(190 80% 14% / 0.38)' : 'hsl(205 20% 8% / 0.55)',
                          borderRadius: '2px',
                        }}
                      >
                        <div className="text-[10px] tracking-[0.16em] uppercase" style={{ color: CYAN }}>
                          Portal {index + 1} · id {doorId}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: '#cfe6f2' }}>{target.name}</div>
                        <div className="mt-1 text-[9px]" style={{ color: DIM }}>
                          {target.thoughts.length} thoughts · {target.doors.length} child portals
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="px-3 py-3 space-y-2" style={{ border: `1px solid hsl(190 60% 25% / 0.25)`, borderRadius: '2px', background: 'hsl(205 24% 7% / 0.8)' }}>
                  <div className="text-[10px] tracking-[0.16em] uppercase" style={{ color: GOLD }}>Rename Selected Portal</div>
                  <input
                    value={portalNameInput}
                    onChange={e => setPortalNameInput(e.target.value)}
                    placeholder={selectedPortal ? selectedPortal.name : 'Select a portal'}
                    className="w-full bg-transparent px-2 py-2 text-[11px] outline-none"
                    style={{ color: CYAN, border: `1px solid hsl(190 60% 25% / 0.25)`, borderRadius: '2px' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handlePortalRename}
                      disabled={!selectedPortal}
                      className="flex-1 px-2 py-2 text-[10px] tracking-[0.14em] uppercase disabled:opacity-40"
                      style={{ color: CYAN, border: `1px solid hsl(180 100% 60% / 0.35)`, borderRadius: '2px' }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => selectedPortal && onEnterChamber(selectedPortal.id)}
                      disabled={!selectedPortal}
                      className="flex-1 px-2 py-2 text-[10px] tracking-[0.14em] uppercase disabled:opacity-40"
                      style={{ color: MAG, border: `1px solid hsl(300 80% 70% / 0.35)`, borderRadius: '2px' }}
                    >
                      Enter
                    </button>
                  </div>
                </div>

                <div className="px-3 py-3 space-y-2" style={{ border: `1px solid hsl(190 60% 25% / 0.25)`, borderRadius: '2px', background: 'hsl(205 24% 7% / 0.8)' }}>
                  <div className="text-[10px] tracking-[0.16em] uppercase" style={{ color: GOLD }}>Create Portal</div>
                  <input
                    value={branchNameInput}
                    onChange={e => setBranchNameInput(e.target.value)}
                    placeholder="Optional portal name"
                    className="w-full bg-transparent px-2 py-2 text-[11px] outline-none"
                    style={{ color: CYAN, border: `1px solid hsl(190 60% 25% / 0.25)`, borderRadius: '2px' }}
                  />
                  <button
                    onClick={handleQuickBranch}
                    className="w-full px-2 py-2 text-[10px] tracking-[0.14em] uppercase"
                    style={{ color: CYAN, border: `1px solid hsl(180 100% 60% / 0.35)`, borderRadius: '2px' }}
                  >
                    Create Branch
                  </button>
                </div>

                <div className="px-3 py-3 space-y-2" style={{ border: `1px solid hsl(180 100% 60% / 0.35)`, borderRadius: '2px', background: 'hsl(190 80% 10% / 0.65)' }}>
                  <div className="text-[10px] tracking-[0.16em] uppercase" style={{ color: GOLD }}>3D Visual Mindmap</div>
                  <div className="text-[10px] leading-relaxed" style={{ color: '#cfe6f2' }}>
                    Interactive spatial workspace with drag-and-drop node sculpting and holographic laser grid alignment.
                  </div>
                  <button
                    onClick={() => {
                      if (onOpenMindMap) {
                        onOpenMindMap();
                      } else if (onOpenConstellation) {
                        onOpenConstellation();
                      }
                    }}
                    className="w-full py-2.5 px-3 text-[10px] tracking-[0.18em] uppercase flex items-center justify-center gap-2 transition hover:scale-[1.01]"
                    style={{
                      color: '#00f0ff',
                      border: `1px solid hsl(180 100% 60% / 0.5)`,
                      borderRadius: '2px',
                      background: 'hsl(190 100% 50% / 0.12)',
                      boxShadow: '0 0 10px hsl(180 100% 60% / 0.2)'
                    }}
                  >
                    <span>✦ Launch 3D Mindmap</span>
                  </button>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
