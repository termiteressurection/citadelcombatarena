export type LocalDay = `${number}-${number}-${number}`;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalDay(date = new Date()): LocalDay {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}` as LocalDay;
}

export function parseLocalDay(day: LocalDay): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function compareLocalDay(a: LocalDay, b: LocalDay): number {
  const ta = parseLocalDay(a).getTime();
  const tb = parseLocalDay(b).getTime();
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  return 0;
}

export function isPastDay(day: LocalDay, today: LocalDay): boolean {
  return compareLocalDay(day, today) < 0;
}

export function isToday(day: LocalDay, today: LocalDay): boolean {
  return compareLocalDay(day, today) === 0;
}
