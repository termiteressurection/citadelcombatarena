import type { CitadelStateModel } from '@/core/model/types';

/**
 * The Fractal Eye
 * Harvests and condenses the user's timeline into a single, pure strand of consciousness.
 * This utility can summarize context outside of linear time for local Sigma features.
 */
export function extractContextFromTimeline(state: CitadelStateModel): string {
  const days = Object.values(state.days).sort((a, b) => a.day.localeCompare(b.day));
  
  if (days.length === 0) {
    return 'The timeline is empty. The world is yet to be built.';
  }

  let context = 'Timeline fragments:\\n';
  let totalEntries = 0;

  for (const day of days) {
    if (day.entries.length === 0) continue;
    context += `[${day.day}]:\\n`;
    for (const entry of day.entries) {
      context += ` - ${entry.text}\\n`;
      totalEntries++;
    }
  }

  if (totalEntries === 0) {
    return 'The timeline is empty. The world is yet to be built.';
  }

  return context;
}
