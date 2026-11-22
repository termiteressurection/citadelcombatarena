export const keys = new Set<string>();
const fresh = new Set<string>();
export const drag = { dx: 0, dy: 0 };
let installed = false;
let rmbDownAt = 0;
let rmbDragDist = 0;
let rmbActiveOnCanvas = false;

/** True once per key press. */
export const pressed = (code: string): boolean => fresh.delete(code);

/** Read and clear accumulated mouse-look delta. */
export function consumeMouseLook(): { dx: number; dy: number } {
  const dx = drag.dx;
  const dy = drag.dy;
  drag.dx = 0;
  drag.dy = 0;
  return { dx, dy };
}

export function installInput(): () => void {
  if (installed) return () => {};
  installed = true;
  const isUiTarget = (e: MouseEvent) =>
    Boolean((e.target as HTMLElement | null)?.closest?.('.clickable'));

  const down = (e: KeyboardEvent) => {
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    if (!e.repeat) fresh.add(e.code);
    keys.add(e.code);
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const move = (e: MouseEvent) => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      drag.dx += e.movementX;
      drag.dy += e.movementY;
      return;
    }
    if ((e.buttons & 2) && rmbActiveOnCanvas) {
      drag.dx += e.movementX;
      drag.dy += e.movementY;
      rmbDragDist += Math.hypot(e.movementX, e.movementY);
    } else if ((e.buttons & 1) && !isUiTarget(e)) {
      drag.dx += e.movementX;
      drag.dy += e.movementY;
    }
  };
  const mdown = (e: MouseEvent) => {
    if (isUiTarget(e)) return;
    if (e.button === 2) {
      rmbActiveOnCanvas = true;
      rmbDownAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      rmbDragDist = 0;
      keys.add('Mouse2');
      return;
    }
    const c = `Mouse${e.button}`;
    fresh.add(c);
    keys.add(c);
  };
  const mup = (e: MouseEvent) => {
    if (e.button === 2) {
      keys.delete('Mouse2');
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (rmbActiveOnCanvas && now - rmbDownAt < 220 && rmbDragDist < 10) {
        fresh.add('Mouse2');
      }
      rmbActiveOnCanvas = false;
      return;
    }
    keys.delete(`Mouse${e.button}`);
  };
  const ctx = (e: Event) => e.preventDefault();
  const blur = () => {
    keys.clear();
    fresh.clear();
    drag.dx = 0;
    drag.dy = 0;
    rmbActiveOnCanvas = false;
  };
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
