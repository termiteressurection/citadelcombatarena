import { TerminalPlugin } from '../TerminalPlugin';

const TYPE_ICONS: Record<string, string> = {
  gem: '◆', seed: '🌱', scroll: '📜', monolith: '▮', orb: '◉',
};

function previewText(text: string, max = 90) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export const WritePlugin: TerminalPlugin = {
  id: 'write',
  description: 'Record thought: write <text> | write --seed <text> | write --scroll <text>',
  execute: (args, { push, ln, onAddThought }) => {
    if (!onAddThought) {
      push(ln('err', 'Write is not wired in this context.'));
      return;
    }
    if (!args) {
      push(ln('err', 'USAGE: write <text> | write --gem|seed|scroll|monolith|orb <text>'));
      return;
    }
    const typeMatch = args.match(/^--(gem|seed|scroll|monolith|orb)\s+(.+)$/s);
    if (typeMatch) {
      const tType = typeMatch[1] as 'gem' | 'seed' | 'scroll' | 'monolith' | 'orb';
      onAddThought(typeMatch[2], tType);
      push(ln('ok', `${TYPE_ICONS[tType] ?? '◆'} ${tType.toUpperCase()} inscription accepted.`));
      return;
    }
    onAddThought(args);
    push(ln('ok', '◆ Inscription accepted. The lodge remembers.'));
  },
};

export const CatPlugin: TerminalPlugin = {
  id: 'cat',
  description: 'View thought: cat <#>',
  execute: (args, { chamber, push, ln, onSelectThought, onSetSideTab }) => {
    const n = parseInt(args, 10);
    if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length) {
      push(ln('err', `INVALID INDEX. Range: 1-${chamber.thoughts.length}`));
      return;
    }
    const thought = chamber.thoughts[n - 1];
    onSelectThought?.(thought.id);
    onSetSideTab?.('thoughts');
    push(ln('hdr', `── MEDITATION #${n} ──`));
    push(ln('out', thought.text));
    push(ln('sys', `${thought.timestamp}${thought.pinned ? ' · PINNED' : ''}${thought.mood ? ' · ' + thought.mood : ''}`));
    if (thought.tags && thought.tags.length > 0) {
      push(ln('sys', `  Tags: ${thought.tags.map(t => '#' + t).join(' ')}`));
    }
    if (thought.replyTo) {
      const parent = chamber.thoughts.find(t => t.id === thought.replyTo);
      if (parent) push(ln('sys', `  ↳ Reply to: "${previewText(parent.text, 40)}"`));
    }
    const replies = chamber.thoughts.filter(t => t.replyTo === thought.id);
    if (replies.length > 0) {
      push(ln('sys', `  ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}:`));
      replies.forEach(r => push(ln('out', `    ↳ "${previewText(r.text, 45)}"`)));
    }
  },
};

export const PinPlugin: TerminalPlugin = {
  id: 'pin',
  description: 'Toggle pin: pin <#>',
  execute: (args, { chamber, push, ln, onTogglePin }) => {
    if (!onTogglePin) {
      push(ln('err', 'Pin is not wired in this context.'));
      return;
    }
    const n = parseInt(args, 10);
    if (Number.isNaN(n) || n < 1 || n > chamber.thoughts.length) {
      push(ln('err', `INVALID INDEX. Range: 1-${chamber.thoughts.length}`));
      return;
    }
    const thought = chamber.thoughts[n - 1];
    onTogglePin(thought.id);
    push(ln('ok', `Pin state toggled for meditation #${n}.`));
  },
};

export const THOUGHT_COMMANDS: Record<string, TerminalPlugin> = {
  write: WritePlugin,
  inscribe: WritePlugin,
  cat: CatPlugin,
  pin: PinPlugin,
};
