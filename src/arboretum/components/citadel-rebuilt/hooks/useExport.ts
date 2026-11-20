import { useCallback } from 'react';
import { useCitadelStore } from '../store';
import { withIdentityDefaults } from '../identityDefaults';
import { assertImportByteLength, assertImportTextSize } from '@/core/persistence/importLimits';
import { assertWorldImportWithinLimits } from '../importValidation';
import type { Chamber, GridIdentity } from '../types';

export function useExport() {
  const chambers = useCitadelStore(state => state.chambers);
  const identity = useCitadelStore(state => state.identity);
  const setChambers = useCitadelStore(state => state.setChambers);
  const setIdentity = useCitadelStore(state => state.setIdentity);

  const exportData = useCallback(() => {
    const data = JSON.stringify({ chambers, identity, version: 2, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citadel-${identity.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chambers, identity]);

  const importData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        assertImportByteLength(file.size, 'World import');
      } catch (error) {
        console.error('Failed to import data', error);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = reader.result;
          if (typeof raw !== 'string') throw new Error('World import is not text.');
          assertImportTextSize(raw, 'World import');
          const data: unknown = JSON.parse(raw);
          assertWorldImportWithinLimits(data);
          setChambers(data.chambers as Record<number, Chamber>);
          if (data.identity && typeof data.identity === 'object') {
            setIdentity({
              ...withIdentityDefaults(data.identity as GridIdentity),
              sessionStart: Date.now(),
            });
          }
        } catch (e) {
          console.error("Failed to import data", e);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setChambers, setIdentity]);

  const exportMarkdown = useCallback(() => {
    let md = `# ${identity.name}'s Citadel\n\n`;
    Object.values(chambers).forEach(c => {
      md += `## ${c.name}\n${c.description}\n\n`;
      c.thoughts.forEach(t => {
        md += `- [${t.timestamp}] ${t.text}\n`;
      });
      md += `\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citadel-${identity.name.toLowerCase().replace(/\s+/g, '-')}-journal.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chambers, identity]);

  const exportTimeline = useCallback(() => {
    const allThoughts = Object.values(chambers).flatMap(c => c.thoughts.map(t => ({ ...t, chamberName: c.name })));
    allThoughts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let md = `# ${identity.name}'s Timeline\n\n`;
    allThoughts.forEach(t => {
      md += `### ${t.timestamp} (${t.chamberName})\n${t.text}\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citadel-${identity.name.toLowerCase().replace(/\s+/g, '-')}-timeline.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chambers, identity]);

  const importMarkdown = useCallback((text: string) => {
    const lines = text.split('\n');
    const topTitle = lines.find(l => l.trim().startsWith('# '))?.trim().slice(2).trim() || 'Imported Journal';
    const timestamp = new Date().toISOString();

    let created = 0;
    setChambers(prev => {
      const next = { ...prev };
      const root = next[0] || {
        id: 0,
        name: 'The Citadel',
        description: 'Your inner fortress — the root of the Grid.',
        depth: 0,
        thoughts: [],
        doors: [],
      };
      next[0] = root;

      let nextId = Math.max(...Object.keys(next).map(Number), 0) + 1;
      const importRootId = nextId++;
      next[importRootId] = {
        id: importRootId,
        name: topTitle,
        description: 'Imported from Markdown',
        depth: 1,
        parent: 0,
        thoughts: [],
        doors: [],
      };
      next[0] = { ...next[0], doors: [...next[0].doors, importRootId] };

      let currentChamberId = importRootId;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('## ')) {
          const sectionName = line.slice(3).trim() || `Imported Section ${nextId}`;
          const sectionId = nextId++;
          next[sectionId] = {
            id: sectionId,
            name: sectionName,
            description: 'Markdown section',
            depth: 2,
            parent: importRootId,
            thoughts: [],
            doors: [],
          };
          next[importRootId] = { ...next[importRootId], doors: [...next[importRootId].doors, sectionId] };
          currentChamberId = sectionId;
          continue;
        }

        if (line.startsWith('# ')) continue;
        const thoughtText = line.startsWith('- ') ? line.slice(2).trim() : line;
        if (!thoughtText) continue;
        const thought = {
          id: Date.now() + Math.random(),
          text: thoughtText,
          timestamp,
          chamberId: currentChamberId,
        };
        next[currentChamberId] = {
          ...next[currentChamberId],
          thoughts: [...next[currentChamberId].thoughts, thought],
        };
        created += 1;
      }
      return next;
    });

    return { created };
  }, [setChambers]);

  return { exportData, importData, exportMarkdown, exportTimeline, importMarkdown };
}
