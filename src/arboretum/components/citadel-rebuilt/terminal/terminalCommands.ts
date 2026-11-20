/* ─────────────────────────────────────────────────────────────────
   TERMINAL COMMANDS
   Extracted from ChamberTerminal.tsx exec() callback.
   Commands already handled by TerminalPlugin (ls, cd, help, write,
   cat, pin, whoami, identity, stats) are NOT duplicated here.
   The `clear` command stays in ChamberTerminal because it needs
   React state (setPendingClear / pendingClearRef).
   ─────────────────────────────────────────────────────────────────
   Usage in ChamberTerminal:
     const lines = executeTerminalCommand(raw, ctx);
     if (lines !== null) push(...lines);
   Returns null when command was handled by plugin or is `clear`.
   ───────────────────────────────────────────────────────────────── */

import type { Thought } from '../types';
import type { TerminalLine, TerminalContext } from './TerminalPlugin';

/** Extended context that carries the extra props ChamberTerminal passes. */
export interface TerminalExecContext extends TerminalContext {
  onDeleteBranch: (id: number) => void;
  onRenameChamber: (id: number, name: string) => void;
  onCreateBranch: (name?: string) => number | null | void;
  onCreateMindMap: (input: string) => { created: number; summary: string };
  exportData: () => string;
  // Wave 1+2
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
  findSimilar?: (thoughtId: number) => { chamberId: number; chamberName: string; thought: Thought; score: number }[];
  exportMarkdown?: () => string;
  exportTimeline?: () => string;
  importMarkdown?: (md: string) => { created: number };
  onUpgradeStructure?: (structure: string) => boolean;
  getAchievements?: () => { id: string; label: string; unlocked: boolean }[];
  onCompleteRitual?: (slot: 'morning' | 'midday' | 'evening') => void;
  // Wave 8+
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
  onOpenConstellation?: () => void;
}

function previewText(text: string, max = 90) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function makeBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Execute a terminal command string.
 * Returns an array of TerminalLine to push, or null if the command should
 * be handled elsewhere (plugin dispatch, clear confirmation, or empty input).
 */
export function executeTerminalCommand(
  raw: string,
  ctx: TerminalExecContext,
): TerminalLine[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const { ln, chamber, chambers, identity, onClose } = ctx;
  const [cmd, ...rest] = trimmed.split(/\s+/);
  const args = rest.join(' ');
  const c = cmd.toLowerCase();
  const o: TerminalLine[] = [ln('cmd', `Λ:\\> ${trimmed}`)];

  // Commands handled by TerminalPlugin (ls, cd, help, write, cat, pin,
  // whoami, identity, stats) — return null so caller uses getPlugin path.
  const PLUGIN_COMMANDS = new Set([
    'ls', 'cd', 'help', 'write', 'inscribe', 'cat', 'pin',
    'whoami', 'identity', 'stats',
  ]);
  if (PLUGIN_COMMANDS.has(c)) return null;
  // `clear` stays in ChamberTerminal (needs setPendingClear state)
  if (c === 'clear') return null;

  switch (c) {
    case 'pwd': {
      o.push(ln('out', `C:\\> ${(ctx.getBreadcrumb?.() ?? []).map(b => b.name).join(' \\ ')}`));
      break;
    }
    case 'tree': {
      o.push(ln('hdr', '── CHAMBER HIERARCHY ──'));
      const printTree = (id: number, depth: number) => {
        const node = chambers[id];
        if (!node) return;
        const prefix = `${'  '.repeat(depth)}${depth > 0 ? '└─ ' : ''}`;
        const here = id === chamber.id ? ' ◄' : '';
        o.push(ln('out', `${prefix}⬡ ${node.name} (${node.thoughts.length}t)${here}`));
        node.doors.forEach(doorId => printTree(doorId, depth + 1));
      };
      printTree(0, 0);
      break;
    }
    case 'edit': {
      const parts = args.split(/\s+/);
      const n = parseInt(parts[0], 10);
      const nextText = parts.slice(1).join(' ');
      if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length || !nextText) {
        o.push(ln('err', 'USAGE: edit <#> <new text>'));
      } else {
        ctx.onEditThought?.(chamber.thoughts[n - 1].id, nextText);
        o.push(ln('ok', `Inscription #${n} recompiled. Precision matters.`));
      }
      break;
    }
    case 'rename': {
      const renameParts = args.split(/\s+/);
      if (renameParts[0]?.toLowerCase() === 'portal') {
        const rawTarget = renameParts[1];
        const nextName = renameParts.slice(2).join(' ').trim();
        if (!rawTarget || !nextName) {
          o.push(ln('err', 'USAGE: rename portal <#|id> <new name>'));
        } else {
          const byIndex = parseInt(rawTarget, 10);
          let targetId: number | undefined;
          if (!Number.isNaN(byIndex) && chamber.doors.includes(byIndex)) targetId = byIndex;
          else if (!Number.isNaN(byIndex) && chamber.doors[byIndex - 1] !== undefined) targetId = chamber.doors[byIndex - 1];
          if (targetId !== undefined && chambers[targetId]) {
            ctx.onRenameChamber(targetId, nextName);
            o.push(ln('ok', `Portal ${rawTarget} redesignated: ${nextName.toUpperCase()}.`));
          } else {
            o.push(ln('err', `PORTAL NOT FOUND: "${rawTarget}"`));
          }
        }
      } else if (!args) {
        o.push(ln('err', 'USAGE: rename <new name>'));
      } else {
        ctx.onRenameChamber(chamber.id, args);
        o.push(ln('ok', `Sector redesignated: ${args.toUpperCase()}. Identity is everything.`));
      }
      break;
    }
    case 'mindmap': {
      if (!args) {
        o.push(ln('err', 'USAGE: mindmap root > child | sibling > leaf'));
      } else {
        const result = ctx.onCreateMindMap(args);
        if (result.created > 0) {
          o.push(ln('ok', `Mindmap integrated. ${result.created} chamber${result.created === 1 ? '' : 's'} created.`));
          o.push(ln('sys', result.summary));
        } else {
          o.push(ln('err', result.summary));
        }
      }
      break;
    }
    case 'talk': {
      o.push(ln('sys', 'THE SIGMA abides. Approach the Skull in the root chamber to commune.'));
      break;
    }
    case 'rm':
    case 'delete':
    case 'derez': {
      const parts = args.split(/\s+/);
      const kind = parts[0]?.toLowerCase();
      const value = parts.slice(1).join(' ');
      if (kind === 'thought' || kind === 't') {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length) {
          o.push(ln('err', `INVALID INDEX. Range: 1-${chamber.thoughts.length}`));
        } else {
          ctx.onDeleteThought?.(chamber.thoughts[n - 1].id);
          o.push(ln('ok', `Inscription #${n} derezzed. Clean.`));
        }
      } else if (kind === 'chamber' || kind === 'c' || kind === 'sector') {
        if (!value) {
          o.push(ln('err', 'USAGE: rm chamber <name|id>'));
        } else {
          const rid = parseInt(value, 10);
          let found: number | undefined;
          if (!Number.isNaN(rid) && chamber.doors.includes(rid)) found = rid;
          else if (!Number.isNaN(rid) && chamber.doors[rid - 1] !== undefined) found = chamber.doors[rid - 1];
          else found = chamber.doors.find(id => chambers[id]?.name.toLowerCase().includes(value.toLowerCase()));
          if (found !== undefined && chambers[found]) {
            const name = chambers[found].name;
            ctx.onDeleteBranch(found);
            o.push(ln('ok', `Sector "${name}" — eliminated. No trace remains.`));
          } else {
            o.push(ln('err', `SECTOR NOT FOUND: "${value}"`));
          }
        }
      } else {
        o.push(ln('err', 'USAGE: rm thought <#> | rm chamber <name|id>'));
      }
      break;
    }
    case 'search':
    case 'grep':
    case 'find': {
      if (!args) {
        o.push(ln('err', 'USAGE: search <query>'));
      } else {
        const sq = args.toLowerCase();
        const results: { text: string; cname: string }[] = [];
        Object.values(chambers).forEach(node => {
          node.thoughts.forEach(t => {
            if (t.text.toLowerCase().includes(sq)) results.push({ text: t.text, cname: node.name });
          });
        });
        o.push(ln('hdr', `── SEARCH: "${args}" — ${results.length} MATCH${results.length !== 1 ? 'ES' : ''} ──`));
        if (results.length === 0) {
          o.push(ln('out', '  No matching records found in the Grid.'));
        } else {
          results.slice(0, 25).forEach(r => o.push(ln('out', `  [${r.cname}] "${previewText(r.text, 45)}"`)));
          if (results.length > 25) o.push(ln('sys', `  ... and ${results.length - 25} more results.`));
        }
      }
      break;
    }
    case 'uptime': {
      o.push(ln('out', `SESSION CYCLE: ${ctx.getUptime?.() ?? '??'} — every microsecond is accountable.`));
      break;
    }
    case 'export': {
      const data = ctx.exportData();
      makeBlob(data, 'application/json', `citadel-${new Date().toISOString().slice(0, 10)}.json`);
      o.push(ln('ok', 'Grid data extracted. Clean export.'));
      o.push(ln('sys', 'Cycle complete.'));
      break;
    }
    case 'tag': {
      if (!ctx.onAddTag) { o.push(ln('err', 'Tag not available.')); break; }
      const parts = args.split(/\s+/);
      const n = parseInt(parts[0], 10);
      const tag = parts.slice(1).join(' ');
      if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length || !tag) {
        o.push(ln('err', 'USAGE: tag <#> <tag>'));
      } else {
        ctx.onAddTag(chamber.thoughts[n - 1].id, tag);
        o.push(ln('ok', `Tag #${tag.replace(/^#/, '')} applied to inscription #${n}.`));
      }
      break;
    }
    case 'untag': {
      if (!ctx.onRemoveTag) { o.push(ln('err', 'Untag not available.')); break; }
      const parts = args.split(/\s+/);
      const n = parseInt(parts[0], 10);
      const tag = parts.slice(1).join(' ').replace(/^#/, '');
      if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length || !tag) {
        o.push(ln('err', 'USAGE: untag <#> <tag>'));
      } else {
        ctx.onRemoveTag(chamber.thoughts[n - 1].id, tag);
        o.push(ln('ok', `Tag #${tag} removed from inscription #${n}.`));
      }
      break;
    }
    case 'reply': {
      if (!ctx.onAddReply) { o.push(ln('err', 'Reply not available.')); break; }
      const parts = args.split(/\s+/);
      const n = parseInt(parts[0], 10);
      const text = parts.slice(1).join(' ');
      if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length || !text) {
        o.push(ln('err', 'USAGE: reply <#> <text>'));
      } else {
        ctx.onAddReply(chamber.thoughts[n - 1].id, text);
        o.push(ln('ok', `Reply threaded to inscription #${n}.`));
      }
      break;
    }
    case 'bookmark':
    case 'bm': {
      if (args === '' || args === 'toggle') {
        if (ctx.onToggleBookmark) {
          ctx.onToggleBookmark(chamber.id);
          o.push(ln('ok', `Bookmark ${(chamber as { bookmarked?: boolean }).bookmarked ? 'removed' : 'set'}: ${chamber.name}.`));
        }
      } else if (args === 'list' || args === 'ls') {
        const bms = Object.values(chambers).filter(ch => (ch as { bookmarked?: boolean }).bookmarked);
        o.push(ln('hdr', `── BOOKMARKS (${bms.length}) ──`));
        if (bms.length === 0) o.push(ln('out', '  No bookmarked chambers.'));
        bms.forEach(b => o.push(ln('out', `  ★ ${b.name} (id:${b.id}, ${b.thoughts.length}t)`)));
      }
      break;
    }
    case 'bookmarks': {
      const bms = Object.values(chambers).filter(ch => (ch as { bookmarked?: boolean }).bookmarked);
      o.push(ln('hdr', `── BOOKMARKS (${bms.length}) ──`));
      if (bms.length === 0) o.push(ln('out', '  No bookmarked chambers.'));
      bms.forEach(b => o.push(ln('out', `  ★ ${b.name} (id:${b.id}, ${b.thoughts.length}t)`)));
      break;
    }
    case 'wormhole': {
      if (!ctx.onAddWormhole) { o.push(ln('err', 'USAGE: wormhole <chamber name|id>')); break; }
      if (!args) { o.push(ln('err', 'USAGE: wormhole <chamber name|id>')); break; }
      const asNum = parseInt(args, 10);
      const target = !Number.isNaN(asNum)
        ? chambers[asNum]
        : Object.values(chambers).find(ch => ch.name.toLowerCase().includes(args.toLowerCase()));
      if (!target || target.id === chamber.id) {
        o.push(ln('err', `Chamber not found: "${args}"`));
      } else {
        ctx.onAddWormhole(chamber.id, target.id);
        o.push(ln('ok', `Wormhole opened: ${chamber.name} ⟷ ${target.name}`));
      }
      break;
    }
    case 'jump': {
      if (!ctx.fuzzyJump) { o.push(ln('err', 'USAGE: jump <chamber name>')); break; }
      if (!args) { o.push(ln('err', 'USAGE: jump <chamber name>')); break; }
      const id = ctx.fuzzyJump(args);
      if (id !== null) {
        o.push(ln('ok', `Teleporting to: ${chambers[id]?.name?.toUpperCase() ?? args}.`));
        setTimeout(() => onClose(), 200);
      } else {
        o.push(ln('err', `No chamber matching: "${args}"`));
      }
      break;
    }
    case 'sort': {
      const mode = (args || 'pinned') as 'date' | 'date-rev' | 'alpha' | 'pinned';
      const MODES = ['date', 'date-rev', 'alpha', 'pinned'];
      if (!MODES.includes(mode)) {
        o.push(ln('err', `USAGE: sort <${MODES.join('|')}>`));
      } else {
        const sorted = [...chamber.thoughts].sort((a, b) => {
          if (mode === 'pinned') return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          if (mode === 'alpha') return a.text.localeCompare(b.text);
          if (mode === 'date-rev') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        o.push(ln('hdr', `── SORTED: ${mode.toUpperCase()} (${sorted.length}) ──`));
        sorted.forEach((t, i) => o.push(ln('out', `  ${i + 1}. ${t.pinned ? '📌 ' : ''}${t.mood ? t.mood + ' ' : ''}${previewText(t.text, 60)}`)));
      }
      break;
    }
    case 'merge': {
      if (!ctx.onMergeChambers) { o.push(ln('err', 'Merge not available.')); break; }
      const match = args.match(/^(.+?)\s+into\s+(.+)$/i);
      if (!match) {
        o.push(ln('err', 'USAGE: merge <source name> into <target name>'));
      } else {
        const src = Object.values(chambers).find(ch => ch.name.toLowerCase().includes(match[1].toLowerCase()));
        const tgt = Object.values(chambers).find(ch => ch.name.toLowerCase().includes(match[2].toLowerCase()));
        if (!src || !tgt) {
          o.push(ln('err', 'Chamber not found.'));
        } else {
          ctx.onMergeChambers(src.id, tgt.id);
          o.push(ln('ok', `${src.name} merged into ${tgt.name}. Thoughts consolidated.`));
        }
      }
      break;
    }
    case 'template': {
      const TEMPLATES: Record<string, string[]> = {
        journal: ['Today I feel...', 'What happened:', 'What I learned:', 'Tomorrow I will...'],
        brainstorm: ['Main idea:', 'Why it matters:', 'Obstacles:', 'Next steps:', 'Wild card:'],
        project: ['Objective:', 'Requirements:', 'Tasks:', 'Timeline:', 'Done criteria:'],
        daily: ['Morning intention:', 'Top 3 priorities:', 'Gratitude:', 'Evening reflection:'],
      };
      const name = (args || '').toLowerCase();
      if (!name || !TEMPLATES[name]) {
        o.push(ln('err', `USAGE: template <${Object.keys(TEMPLATES).join('|')}>`));
      } else {
        TEMPLATES[name].forEach(prompt => ctx.onAddThought?.(prompt));
        o.push(ln('ok', `Template "${name}" applied — ${TEMPLATES[name].length} prompts inscribed.`));
      }
      break;
    }
    case 'orphans': {
      if (!ctx.getOrphans) { o.push(ln('out', '  No orphan data available.')); break; }
      const orph = ctx.getOrphans();
      o.push(ln('hdr', `── ORPHAN CHAMBERS (${orph.length}) ──`));
      if (orph.length === 0) o.push(ln('out', '  No orphaned chambers. Everything has purpose.'));
      orph.forEach(op => o.push(ln('out', `  ○ ${op.name} (id:${op.id})`)));
      break;
    }
    case 'summary': {
      if (!ctx.getChamberSummary) { o.push(ln('out', '  Summary not available.')); break; }
      o.push(ln('hdr', `── ${chamber.name.toUpperCase()} SUMMARY ──`));
      o.push(ln('out', `  ${ctx.getChamberSummary(chamber.id)}`));
      break;
    }
    case 'similar': {
      if (!ctx.findSimilar) { o.push(ln('err', 'Similar not available.')); break; }
      const n = parseInt(args, 10);
      if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length) {
        o.push(ln('err', `USAGE: similar <#> (1-${chamber.thoughts.length})`));
      } else {
        const sims = ctx.findSimilar(chamber.thoughts[n - 1].id);
        o.push(ln('hdr', `── SIMILAR THOUGHTS (${sims.length}) ──`));
        if (sims.length === 0) o.push(ln('out', '  No similar thoughts found.'));
        sims.slice(0, 8).forEach(s => o.push(ln('out', `  [${s.chamberName}] "${previewText(s.thought.text, 50)}" (${s.score} overlap)`)));
      }
      break;
    }
    case 'mood': {
      if (!ctx.onSetMood) { o.push(ln('err', 'Mood not available.')); break; }
      const parts = args.split(/\s+/);
      const n = parseInt(parts[0], 10);
      const mood = parts.slice(1).join(' ');
      if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length || !mood) {
        o.push(ln('err', 'USAGE: mood <#> <emoji or word>'));
      } else {
        ctx.onSetMood(chamber.thoughts[n - 1].id, mood);
        o.push(ln('ok', `Mood ${mood} set on inscription #${n}.`));
      }
      break;
    }
    case 'streak': {
      o.push(ln('hdr', '── WRITING STREAK ──'));
      o.push(ln('out', `  Current streak: ${(identity as { streak?: number }).streak ?? 0} day${((identity as { streak?: number }).streak ?? 0) !== 1 ? 's' : ''}`));
      o.push(ln('out', `  Last active: ${(identity as { lastActiveDate?: string }).lastActiveDate ?? 'today'}`));
      break;
    }
    case 'export-md': {
      if (!ctx.exportMarkdown) { o.push(ln('err', 'Markdown export not available.')); break; }
      makeBlob(ctx.exportMarkdown(), 'text/markdown', `citadel-${new Date().toISOString().slice(0, 10)}.md`);
      o.push(ln('ok', 'Markdown exported. The Grid is documented.'));
      break;
    }
    case 'export-timeline': {
      if (!ctx.exportTimeline) { o.push(ln('err', 'Timeline export not available.')); break; }
      makeBlob(ctx.exportTimeline(), 'text/markdown', `citadel-timeline-${new Date().toISOString().slice(0, 10)}.md`);
      o.push(ln('ok', 'Timeline exported chronologically.'));
      break;
    }
    case 'import-md': {
      if (!ctx.importMarkdown) { o.push(ln('err', 'Markdown import not available.')); break; }
      if (!args) {
        o.push(ln('hdr', '── IMPORT MARKDOWN ──'));
        o.push(ln('sys', 'Paste Markdown content after the command:'));
        o.push(ln('sys', '  import-md # Heading\n- thought 1\n- thought 2'));
        o.push(ln('sys', 'Headings become chambers, list items become thoughts.'));
      } else {
        const result = ctx.importMarkdown(args.replace(/\\n/g, '\n'));
        o.push(ln('ok', `Imported ${result.created} thought${result.created !== 1 ? 's' : ''} from Markdown.`));
      }
      break;
    }

    case 'achievements': {
      if (!ctx.getAchievements) { o.push(ln('out', '  Achievements not available.')); break; }
      const achs = ctx.getAchievements();
      o.push(ln('hdr', `── ACHIEVEMENT MONUMENTS (${achs.filter(a => a.unlocked).length}/${achs.length}) ──`));
      for (const a of achs) {
        o.push(ln(a.unlocked ? 'ok' : 'sys', `  ${a.unlocked ? '★' : '☆'} ${a.label}${a.unlocked ? '' : ' (locked)'}`));
      }
      break;
    }
    case 'rituals': {
      o.push(ln('hdr', '── DAILY RITUALS ──'));
      const r = (identity as { rituals?: { date?: string; morning?: boolean; midday?: boolean; evening?: boolean; stars?: number; constellations?: number } }).rituals;
      const today = new Date().toISOString().slice(0, 10);
      const isToday = r?.date === today;
      o.push(ln(isToday && r?.morning ? 'ok' : 'sys', `  ${isToday && r?.morning ? '✓' : '○'} Morning intention`));
      o.push(ln(isToday && r?.midday ? 'ok' : 'sys', `  ${isToday && r?.midday ? '✓' : '○'} Midday check-in`));
      o.push(ln(isToday && r?.evening ? 'ok' : 'sys', `  ${isToday && r?.evening ? '✓' : '○'} Evening reflection`));
      o.push(ln('out', `  ★ Stars: ${r?.stars ?? 0}/7 · Constellations: ${r?.constellations ?? 0}`));
      break;
    }
    case 'bottle': {
      if (!ctx.onSendBottle) { o.push(ln('err', 'USAGE: bottle <message text>')); break; }
      if (!args) { o.push(ln('err', 'USAGE: bottle <message text>')); break; }
      ctx.onSendBottle(args);
      o.push(ln('ok', '🍾 Message sealed in a bottle and cast into the void. It will drift to another chamber in time.'));
      break;
    }
    case 'lighthouse': {
      if (!ctx.onToggleLighthouse) { o.push(ln('err', 'Lighthouse not available.')); break; }
      ctx.onToggleLighthouse(chamber.id);
      o.push(ln('ok', `Chamber beacon ${!(chamber as { isLighthouse?: boolean }).isLighthouse ? 'IGNITED' : 'EXTINGUISHED'}. It now calls out to the Void Hub.`));
      break;
    }
    case 'ink': {
      if (!ctx.onSetInk) { o.push(ln('err', 'Ink not available.')); break; }
      const styles = ['classic', 'neon', 'glitch', 'vapor', 'gold'];
      const style = (args || '').toLowerCase();
      if (!style || !styles.includes(style)) {
        o.push(ln('err', `USAGE: ink <${styles.join('|')}>`));
      } else {
        ctx.onSetInk(style);
        o.push(ln('ok', `Digital ink style set to ${style.toUpperCase()}. Your inscriptions will carry this weight.`));
      }
      break;
    }
    case 'sigma':
    case 'voice': {
      o.push(ln('hdr', '── SIGMA GENERATIVE VOICE CORE ──'));
      o.push(ln('out', 'Station 02 houses the Sigma Pyramid.'));
      o.push(ln('out', 'To awaken the private local neural model (840 MB Llama-3.2-1B):'));
      o.push(ln('out', '1. Approach Station 02 (Z = -80) in the Citadel hub.'));
      o.push(ln('out', '2. Press ENTER to open dialogue, then click "AWAKEN SIGMA (OPT-IN)".'));
      o.push(ln('ok', 'Zero cloud telemetry. 100% on-device local inference.'));
      break;
    }
    case 'ghost': {
      if (!ctx.onToggleGhostTrails) { o.push(ln('err', 'Ghost trails not available.')); break; }
      ctx.onToggleGhostTrails();
      o.push(ln('ok', 'Ghost trail echoes toggled. Your past self walks these halls.'));
      break;
    }
    case 'mirror': {
      if (!ctx.onOpenMirror) { o.push(ln('err', 'Mirror not available.')); break; }
      o.push(ln('ok', 'Opening mirror chamber...'));
      setTimeout(() => { ctx.onOpenMirror!(); onClose(); }, 200);
      break;
    }
    case 'heatmap': {
      if (!ctx.onOpenHeatmap) { o.push(ln('err', 'Heatmap not available.')); break; }
      o.push(ln('ok', 'Opening mood journal heatmap...'));
      setTimeout(() => { ctx.onOpenHeatmap!(); onClose(); }, 200);
      break;
    }
    case 'letter': {
      if (!ctx.onWriteLetter) { o.push(ln('err', 'Letter not available.')); break; }
      const parts = args.split(/\s+/);
      const days = parseInt(parts[0], 10);
      const text = parts.slice(1).join(' ');
      if (Number.isNaN(days) || days < 1 || !text) {
        o.push(ln('err', 'USAGE: letter <days> <message to your future self>'));
      } else {
        ctx.onWriteLetter(days, text);
        const until = new Date(Date.now() + days * 86400000).toLocaleDateString();
        o.push(ln('ok', `📨 Letter sealed. It will materialize as a glowing monolith on ${until}.`));
      }
      break;
    }
    case 'echoboard': {
      const log = (chamber as { commandLog?: string[] }).commandLog ?? [];
      o.push(ln('hdr', `── ECHO BOARD: ${chamber.name.toUpperCase()} ──`));
      if (log.length === 0) {
        o.push(ln('out', '  No echoes recorded in this chamber yet.'));
      } else {
        log.slice(-5).forEach((cmd, i) => o.push(ln('out', `  ${i + 1}. ${cmd}`)));
      }
      break;
    }
    case 'trail': {
      if (!ctx.onSetTrail) { o.push(ln('err', 'Trail not available.')); break; }
      const styles = ['none', 'footprints', 'particles', 'ink', 'fire', 'stars', 'glitch'];
      const style = (args || '').toLowerCase();
      if (!style || !styles.includes(style)) {
        o.push(ln('err', `USAGE: trail <${styles.join('|')}>`));
      } else {
        ctx.onSetTrail(style);
        o.push(ln('ok', `Trail effect set to ${style.toUpperCase()}. Walk with presence.`));
      }
      break;
    }
    case 'photo': {
      if (!ctx.onTogglePhotoMode) { o.push(ln('err', 'Photo mode not available.')); break; }
      o.push(ln('ok', '📸 Photo mode toggled. Freeze time, move freely, capture the moment.'));
      setTimeout(() => { ctx.onTogglePhotoMode!(); onClose(); }, 200);
      break;
    }
    case 'skybox': {
      if (!ctx.onOpenSkybox) { o.push(ln('err', 'Skybox not available.')); break; }
      o.push(ln('ok', 'Opening skybox painter...'));
      setTimeout(() => { ctx.onOpenSkybox!(); onClose(); }, 200);
      break;
    }

    case 'furnish': {
      if (!ctx.onAddFurniture) { o.push(ln('err', 'Furnish not available.')); break; }
      const kinds = ['lantern', 'rug', 'sculpture', 'crystal', 'obelisk', 'fountain'];
      const kind = (args || '').toLowerCase();
      if (!kind || !kinds.includes(kind)) {
        o.push(ln('err', `USAGE: furnish <${kinds.join('|')}>`));
      } else {
        ctx.onAddFurniture(kind);
        o.push(ln('ok', `🪑 ${kind.toUpperCase()} placed in the chamber. Your space, your rules.`));
      }
      break;
    }
    case 'sign': {
      if (!ctx.onAddNamePlate) { o.push(ln('err', 'Sign not available.')); break; }
      if (!args) { o.push(ln('err', 'USAGE: sign <text for the floating sign>')); break; }
      ctx.onAddNamePlate(args);
      o.push(ln('ok', `🪧 Name plate placed: "${args}"`));
      break;
    }
    case 'celebrate': {
      if (!ctx.onLaunchFireworks) { o.push(ln('err', 'Fireworks not available.')); break; }
      o.push(ln('ok', '🎆 Launching fireworks! The Grid celebrates.'));
      setTimeout(() => { ctx.onLaunchFireworks!(); onClose(); }, 200);
      break;
    }
    case 'graph': {
      if (!ctx.onOpenGraph) { o.push(ln('err', 'Graph not available.')); break; }
      o.push(ln('ok', 'Opening thought graph visualization...'));
      setTimeout(() => { ctx.onOpenGraph!(); onClose(); }, 200);
      break;
    }
    case 'garden': {
      const seeds = chamber.thoughts.filter(t => t.type === 'seed');
      o.push(ln('hdr', '── GARDEN STATUS ──'));
      if (seeds.length === 0) {
        o.push(ln('out', '  No seeds planted. Use "write --seed <text>" to plant one.'));
      } else {
        seeds.forEach(s => {
          const age = Math.floor((Date.now() - new Date(s.timestamp).getTime()) / 86400000);
          const stage = age >= 7 ? 'TREE 🌳' : age >= 3 ? 'SAPLING 🌿' : 'SPROUT 🌱';
          o.push(ln('out', `  ${stage} "${previewText(s.text, 40)}" — ${age} day${age !== 1 ? 's' : ''} old`));
        });
      }
      break;
    }
    case 'paint': {
      if (!ctx.onOpenPaint) { o.push(ln('err', 'Paint canvas not available.')); break; }
      o.push(ln('ok', '🎨 Opening paint canvas...'));
      setTimeout(() => { ctx.onOpenPaint!(); onClose(); }, 200);
      break;
    }
    default: {
      o.push(ln('err', `Unrecognized: ${c}. Inefficient.`));
      o.push(ln('sys', 'Type "help" if you need direction.'));
    }
  }

  return o;
}
