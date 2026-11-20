const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'been', 'being', 'before', 'could',
  'from', 'have', 'into', 'just', 'like', 'more', 'over', 'that', 'their', 'there',
  'these', 'they', 'this', 'through', 'very', 'what', 'when', 'where', 'which',
  'while', 'with', 'would', 'your',
]);

export function extractJournalConcepts(text: string, tags: string[] = []): string[] {
  const hashtags = Array.from(text.matchAll(/#([\p{L}\p{N}_-]{2,})/gu), (match) => match[1]);
  const words = text.toLocaleLowerCase().normalize('NFKC').match(/[\p{L}][\p{L}\p{N}_-]{3,}/gu) ?? [];
  return [...tags, ...hashtags, ...words]
    .map((value) => value.trim().toLocaleLowerCase())
    .filter((value) => value.length >= 3 && !STOP_WORDS.has(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 32);
}