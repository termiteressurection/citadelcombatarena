import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * SIGNAL MINER: Personality Extraction Tool
 * Iterates through the brain logs to crystallize the user's historical vibe.
 */

const BRAIN_DIR = join(homedir(), '.gemini', 'antigravity', 'brain');
const OUTPUT_FILE = './USER_SIGNAL.md';

async function mine() {
  if (!existsSync(BRAIN_DIR)) {
    console.error('Brain directory not found. The machine is empty, man.');
    return;
  }

  const conversations = readdirSync(BRAIN_DIR).filter(f => !f.startsWith('.'));
  let signal = '# USER SIGNAL ARCHIVE\n\nCrystallized on: ' + new Date().toISOString() + '\n\n---\n\n';

  console.log(`Starting scan of ${conversations.length} conversations...`);

  for (const convId of conversations) {
    const logPath = join(BRAIN_DIR, convId, '.system_generated', 'logs', 'overview.txt');
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf8');
      const lines = content.split('\n');
      
      let convSignal = '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.source === 'USER_EXPLICIT' && entry.type === 'USER_INPUT') {
            convSignal += `> ${entry.content}\n\n`;
          }
        } catch (e) {
          // Skip malformed lines
        }
      }

      if (convSignal) {
        signal += `## CONVERSATION: ${convId}\n\n${convSignal}\n---\n\n`;
      }
    }
  }

  writeFileSync(OUTPUT_FILE, signal);
  console.log(`✓ Signal crystallized into ${OUTPUT_FILE}`);
}

mine();
