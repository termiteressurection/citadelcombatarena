import { TerminalPlugin } from '../TerminalPlugin';

export const CdPlugin: TerminalPlugin = {
  id: 'cd',
  description: 'Navigate: cd <name|id> | cd ..',
  execute: (args, { chamber, chambers, onNavigate, onClose, push, ln }) => {
    if (!args) {
      push(ln('err', 'USAGE: cd <name|id> | cd ..'));
      return;
    }

    if (args === '..') {
      if (chamber.parent !== undefined && chambers[chamber.parent]) {
        push(ln('ok', `Traversing to: ${chambers[chamber.parent].name.toUpperCase()}. Efficient.`));
        setTimeout(() => { onNavigate(chamber.parent!); onClose(); }, 200);
      } else {
        push(ln('err', 'Root level. No further retreat possible.'));
      }
      return;
    }

    const asNum = parseInt(args, 10);
    let found: number | undefined;
    
    if (!Number.isNaN(asNum)) {
      if (chamber.doors.includes(asNum)) {
        found = asNum;
      } else if (chamber.doors[asNum - 1] !== undefined) {
        found = chamber.doors[asNum - 1];
      }
    } else {
      found = chamber.doors.find(doorId => 
        chambers[doorId]?.name.toLowerCase().includes(args.toLowerCase())
      );
    }

    if (found !== undefined && chambers[found]) {
      push(ln('ok', `Entering sector: ${chambers[found].name.toUpperCase()}.`));
      setTimeout(() => { onNavigate(found!); onClose(); }, 200);
    } else {
      push(ln('err', `SECTOR NOT FOUND: "${args}". Use the Portals panel or 'ls'.`));
    }
  }
};
