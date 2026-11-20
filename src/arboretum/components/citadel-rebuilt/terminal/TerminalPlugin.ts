import { Chamber, GridIdentity, Thought } from '../types';

export interface TerminalLine {
  id: number;
  type: 'cmd' | 'out' | 'err' | 'sys' | 'ok' | 'hdr';
  text: string;
}

/**
 * Shared context passed to every Terminal plugin.
 * Optional callbacks are only present when the host terminal is wired for them.
 * Plugins MUST null-check optional fields and emit a helpful error line instead of throwing.
 */
export interface TerminalContext {
  chamber: Chamber;
  chambers: Record<number, Chamber>;
  identity: GridIdentity;
  push: (...lines: TerminalLine[]) => void;
  ln: (type: TerminalLine['type'], text: string) => TerminalLine;
  onNavigate: (id: number) => void;
  onClose: () => void;
  state: unknown;

  // Thought mutators
  onAddThought?: (text: string, type?: Thought['type']) => void;
  onEditThought?: (id: number, text: string) => void;
  onTogglePin?: (id: number) => void;
  onDeleteThought?: (id: number) => void;

  // Selection / tab plumbing (terminal side-panel)
  onSelectThought?: (id: number | null) => void;
  onSetSideTab?: (tab: 'thoughts' | 'portals') => void;

  // Identity mutators
  onSetIdentity?: (name: string) => void;

  // Session info
  getUptime?: () => string;

  // Breadcrumb
  getBreadcrumb?: () => { id: number; name: string }[];
}

export interface TerminalPlugin {
  id: string;
  description: string;
  execute: (args: string, context: TerminalContext) => void | Promise<void>;
}
