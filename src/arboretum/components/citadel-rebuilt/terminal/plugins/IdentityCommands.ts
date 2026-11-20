import { TerminalPlugin } from '../TerminalPlugin';

export const WhoamiPlugin: TerminalPlugin = {
  id: 'whoami',
  description: 'Show identity disc',
  execute: (_args, { identity, push, ln, getUptime }) => {
    push(ln('hdr', '── IDENTITY DISC ──'));
    push(ln('out', `  Name:       ${identity.name}`));
    push(ln('out', `  Created:    ${identity.createdAt}`));
    if (getUptime) {
      push(ln('out', `  Session:    ${getUptime()}`));
    }
  },
};

export const IdentityPlugin: TerminalPlugin = {
  id: 'identity',
  description: 'Set identity: identity <name>',
  execute: (args, { push, ln, onSetIdentity }) => {
    if (!onSetIdentity) {
      push(ln('err', 'Identity cannot be reassigned in this context.'));
      return;
    }
    const next = args.trim();
    if (!next) {
      push(ln('err', 'USAGE: identity <name>'));
      return;
    }
    if (next.length > 24) {
      push(ln('err', 'Name too long — 24 characters max.'));
      return;
    }
    onSetIdentity(next);
    push(ln('ok', `Identity rebound: ${next.toUpperCase()}.`));
  },
};

export const StatsPlugin: TerminalPlugin = {
  id: 'stats',
  description: 'Display grid statistics',
  execute: (_args, { chambers, identity, push, ln }) => {
    const totalThoughts = Object.values(chambers).reduce(
      (acc, c) => acc + (c.thoughts?.length ?? 0),
      0,
    );
    const totalChambers = Object.keys(chambers).length;
    const pinned = Object.values(chambers).reduce(
      (acc, c) => acc + c.thoughts.filter(t => t.pinned).length,
      0,
    );

    push(ln('hdr', '── GRID STATISTICS ──'));
    push(ln('out', `  Architect:  ${identity.name}`));
    push(ln('out', `  Chambers:   ${totalChambers}`));
    push(ln('out', `  Thoughts:   ${totalThoughts}`));
    push(ln('out', `  Pinned:     ${pinned}`));
    const streak = (identity as { streak?: number }).streak;
    if (typeof streak === 'number') {
      push(ln('out', `  Streak:     ${streak} day${streak === 1 ? '' : 's'}`));
    }
  },
};

export const IDENTITY_COMMANDS: Record<string, TerminalPlugin> = {
  whoami: WhoamiPlugin,
  identity: IdentityPlugin,
  stats: StatsPlugin,
};
