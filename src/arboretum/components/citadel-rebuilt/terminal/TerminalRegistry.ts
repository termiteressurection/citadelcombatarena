import { TerminalPlugin } from './TerminalPlugin';
import { LsPlugin } from './plugins/LsPlugin';
import { HelpPlugin } from './plugins/HelpPlugin';
import { CdPlugin } from './plugins/CdPlugin';
import { THOUGHT_COMMANDS } from './plugins/ThoughtCommands';
import { IDENTITY_COMMANDS } from './plugins/IdentityCommands';

export const TERMINAL_PLUGINS: Record<string, TerminalPlugin> = {
  ls: LsPlugin,
  help: HelpPlugin,
  cd: CdPlugin,
  ...THOUGHT_COMMANDS,
  ...IDENTITY_COMMANDS,
};

export function getPlugin(cmd: string): TerminalPlugin | undefined {
  return TERMINAL_PLUGINS[cmd.toLowerCase()];
}

export function listPlugins(): TerminalPlugin[] {
  return Object.values(TERMINAL_PLUGINS);
}
