export const FORENSIC_HORIZONS = ['year', 'season', 'month', 'week', 'day'] as const;

export function handleForensicNotebookShortcut(
  key: string,
  hasModifier: boolean,
  overlayAlreadyOpen: boolean,
  typingTarget: boolean,
  openNotebook: () => void,
): boolean {
  if (key !== 'n' || hasModifier || overlayAlreadyOpen || typingTarget) return false;
  openNotebook();
  return true;
}
