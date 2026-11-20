import { TerminalPlugin } from '../TerminalPlugin';

export const HelpPlugin: TerminalPlugin = {
  id: 'help',
  description: 'Display available directives',
  execute: (args, { push, ln, state }) => {
    push(ln('hdr', '── AVAILABLE DIRECTIVES ──'));
    
    // In a real plugin system, we'd iterate over all registered plugins.
    // For now, we'll list the core ones.
    const DIRECTIVES: Record<string, string> = {
      help: 'Display available directives',
      ls: 'List current chamber contents',
      cd: 'Navigate: cd <name|id> | cd ..',
      cat: 'View thought: cat <#>',
      pwd: 'Print current location',
      tree: 'Display chamber hierarchy',
      write: 'Record thought: write <text>',
      edit: 'Modify thought: edit <#> <text>',
      pin: 'Toggle pin: pin <#>',
      tag: 'Tag thought: tag <#> <tag>',
      reply: 'Reply to thought: reply <#> <text>',
      search: 'Search all thoughts: search <query>',
      clear: 'Clear terminal output',
    };

    Object.entries(DIRECTIVES).forEach(([k, v]) =>
      push(ln('out', `  ${k.padEnd(12)} ${v}`))
    );
    
    push(ln('sys', 'Thoughts, portals, and chat are also available in the right-side panel.'));
    push(ln('sys', 'Cycle complete.'));
  }
};
