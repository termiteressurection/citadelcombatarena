import { TerminalPlugin } from '../TerminalPlugin';

export const LsPlugin: TerminalPlugin = {
  id: 'ls',
  description: 'List current chamber contents',
  execute: (args, { chamber, chambers, push, ln }) => {
    push(ln('hdr', `── ${chamber.name.toUpperCase()} ──`));
    if (chamber.thoughts.length === 0 && chamber.doors.length === 0) {
      push(ln('out', '  (empty chamber)'));
      return;
    }

    if (chamber.thoughts.length > 0) {
      push(ln('hdr', '  MEDITATIONS:'));
      const sorted = [...chamber.thoughts].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
      sorted.forEach((thought, idx) => {
        const typeIcons: Record<string, string> = { gem: '◆', seed: '🌱', scroll: '📜', monolith: '▮', orb: '◉' };
        const tType = thought.type ?? 'gem';
        const typeIcon = typeIcons[tType] ?? '◆';
        const pin = thought.pinned ? ' [PINNED]' : '';
        const tags = (thought.tags?.length ?? 0) > 0 ? ` [${thought.tags!.map(t => '#' + t).join(' ')}]` : '';
        const mood = thought.mood ? ` ${thought.mood}` : '';
        const replies = chamber.thoughts.filter(t => t.replyTo === thought.id).length;
        const replyStr = replies > 0 ? ` (${replies} repl${replies === 1 ? 'y' : 'ies'})` : '';
        
        // Truncate preview
        const preview = thought.text.length > 42 ? thought.text.slice(0, 42) + '...' : thought.text;
        push(ln('out', `    ${typeIcon} [${idx + 1}] "${preview}"${pin}${tags}${mood}${replyStr}`));
      });
    }

    if (chamber.doors.length > 0) {
      push(ln('hdr', '  PORTALS (CHRONOLOGICAL HIERARCHY):'));
      chamber.doors.forEach((doorId, idx) => {
        const target = chambers[doorId];
        if (target) {
          const type = target.template || 'custom';
          const tIcon = type === 'day' ? '◈' : type === 'week' ? '▣' : type === 'month' ? '▢' : '⬡';
          const counts = `[${target.thoughts.length}t | ${target.doors.length}p]`;
          push(ln('out', `    (${idx + 1}) ${tIcon} ${target.name.toUpperCase()} (id:${doorId}) — ${counts}`));
        }
      });
    }
  }
};
