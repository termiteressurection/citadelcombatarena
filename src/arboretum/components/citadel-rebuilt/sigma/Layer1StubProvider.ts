export interface SigmaSourceEntry {
  text: string;
  date: string;
  tags?: readonly string[];
  eventId?: string;
  source?: string;
  timestamp?: string;
}

export interface SigmaReplyRequest {
  message: string;
  entries: readonly SigmaSourceEntry[];
  history?: readonly { role: 'user' | 'assistant'; content: string }[];
}

export interface SigmaProvider {
  reply(request: SigmaReplyRequest): string | Promise<string>;
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'being',
  'between', 'but', 'can', 'could', 'did', 'does', 'doing', 'down', 'each', 'else', 'for',
  'from', 'have', 'here', 'how', 'into', 'just', 'like', 'might', 'more', 'most', 'much',
  'must', 'need', 'not', 'now', 'off', 'once', 'only', 'onto', 'our', 'out', 'over',
  'same', 'should', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'too', 'under', 'until', 'very', 'was', 'were',
  'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your', 'sigma', 'dude', 'man',
]);

function terms(value: string): Set<string> {
  return new Set(
    value.normalize('NFKC').toLocaleLowerCase('en-US')
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter(word => word.length > 2 && !STOP_WORDS.has(word)) ?? [],
  );
}

export class Layer1StubProvider implements SigmaProvider {
  reply(request: SigmaReplyRequest): string {
    const queryTerms = terms(request.message);
    const matches = request.entries
      .filter(entry => entry.text.trim() && !entry.tags?.some(tag =>
        tag === 'non-inscription' || tag === 'sigma-chat'))
      .map((entry, index) => ({
        entry,
        index,
        matches: [...queryTerms].filter(term => terms(entry.text).has(term)).length,
      }))
      .filter(candidate => candidate.matches > 0)
      .sort((a, b) => b.matches - a.matches || a.index - b.index)
      .slice(0, 5)
      .map(candidate => candidate.entry);

    if (matches.length === 0) return 'No matching stone surfaced in verified journal records.';
    return [
      'Retrieved journal records:',
      ...matches.map(entry =>
        `[event ${entry.eventId ?? 'unavailable'}; source ${entry.source ?? 'journal'}; timestamp ${entry.timestamp ?? entry.date}] “${entry.text}”`,
      ),
    ].join('\n');
  }
}

const provider = new Layer1StubProvider();

export async function requestSigmaReply(request: SigmaReplyRequest): Promise<string> {
  return provider.reply(request);
}
