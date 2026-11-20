export const keys = new Set<string>();
const fresh = new Set<string>();
export const drag = { dx: 0 };
let installed = false;

/** True once per key press. */
export const pressed = (code: string): boolean => fresh.delete(code);

export function installInput(): () => void {
  if (installed) return () => {};
  installed = true;
  const down = (e: KeyboardEvent) => {
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    if (!e.repeat) fresh.add(e.code);
    keys.add(e.code);
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const move = (e: MouseEvent) => { if (e.buttons & 1) drag.dx += e.movementX; };
  const mdown = (e: MouseEvent) => { const c = `Mouse${e.button}`; fresh.add(c); keys.add(c); };
  const mup = (e: MouseEvent) => keys.delete(`Mouse${e.button}`);
  const ctx = (e: Event) => e.preventDefault();
  const blur = () => { keys.clear(); fresh.clear(); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('mousemove', move);
  window.addEventListener('blur', blur);
  window.addEventListener('mousedown', mdown);
  window.addEventListener('mouseup', mup);
  window.addEventListener('contextmenu', ctx);
  return () => {
    installed = false;
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('mousemove', move);
    window.removeEventListener('blur', blur);
    window.removeEventListener('mousedown', mdown);
    window.removeEventListener('mouseup', mup);
    window.removeEventListener('contextmenu', ctx);
  };
}
