import { useEffect, useRef } from "react";
import { focusNode, focusEdge, toggleFold, runtime } from "./runtime";

export interface LabelSlot {
  el: HTMLDivElement;
  title: HTMLSpanElement;
  chip: HTMLSpanElement;
  tier: string;
  text: string;
  chipText: string;
}

export interface EdgeLabelSlot {
  el: HTMLDivElement;
  title: HTMLSpanElement;
  text: string;
  edgeId: string;
}

const POOL_SIZE = 56;
const EDGE_POOL_SIZE = 24;
export const labelSlots: LabelSlot[] = [];
export const edgeLabelSlots: EdgeLabelSlot[] = [];

export function LabelLayer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    labelSlots.length = 0;
    edgeLabelSlots.length = 0;

    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement("div");
      el.className =
        "mm-label pointer-events-auto absolute top-0 left-0 select-none cursor-pointer flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] tracking-wider uppercase font-mono transition-colors duration-150";
      el.style.opacity = "0";
      el.style.transform = "translate3d(-9999px, -9999px, 0)";
      el.style.background = "rgba(6, 5, 13, 0.88)";
      el.style.border = "1px solid rgba(63, 240, 255, 0.25)";
      el.style.color = "#e9e6ff";
      el.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.7)";
      el.style.backdropFilter = "blur(4px)";

      const title = document.createElement("span");
      title.className = "truncate max-w-[180px]";

      const chip = document.createElement("span");
      chip.className =
        "px-1 py-0.2 rounded text-[8.5px] font-bold border transition-transform hover:scale-110";
      chip.style.borderColor = "rgba(255, 201, 92, 0.6)";
      chip.style.background = "rgba(255, 201, 92, 0.15)";
      chip.style.color = "#ffc95c";
      chip.style.display = "none";
      chip.dataset.role = "chip";

      el.appendChild(title);
      el.appendChild(chip);
      container.appendChild(el);

      labelSlots.push({
        el,
        title,
        chip,
        tier: "rest",
        text: "",
        chipText: "",
      });
    }

    // Edge labels pool
    for (let i = 0; i < EDGE_POOL_SIZE; i++) {
      const el = document.createElement("div");
      el.className =
        "mm-edge-label pointer-events-auto absolute top-0 left-0 select-none cursor-pointer flex items-center px-1.5 py-0.5 rounded text-[8.5px] tracking-widest uppercase font-mono transition-all duration-150";
      el.style.opacity = "0";
      el.style.transform = "translate3d(-9999px, -9999px, 0)";
      el.style.background = "rgba(10, 8, 22, 0.9)";
      el.style.border = "1px solid rgba(255, 79, 216, 0.4)";
      el.style.color = "#ff4fd8";
      el.style.backdropFilter = "blur(4px)";

      const title = document.createElement("span");
      title.className = "truncate max-w-[120px]";

      el.appendChild(title);
      container.appendChild(el);

      edgeLabelSlots.push({
        el,
        title,
        text: "",
        edgeId: "",
      });
    }

    const onPointerDown = (e: MouseEvent) => {
      const edgeTarget = (e.target as HTMLElement).closest<HTMLElement>("[data-edge-id]");
      if (edgeTarget) {
        const edgeId = edgeTarget.dataset.edgeId;
        if (edgeId) {
          e.stopPropagation();
          focusEdge(edgeId);
          return;
        }
      }

      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-id]");
      if (!target) return;
      const id = target.dataset.id;
      if (!id) return;
      e.stopPropagation();

      const isChip = (e.target as HTMLElement).dataset.role === "chip";
      if (isChip) {
        toggleFold(id);
      } else {
        focusNode(id, true);
      }
    };

    const onPointerOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-id]");
      const id = target?.dataset.id || null;
      if (id && id !== runtime.hoveredId) {
        runtime.hoveredId = id;
        runtime.invalidate();
      }
    };

    const onPointerOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-id]");
      if (target && runtime.hoveredId) {
        runtime.hoveredId = null;
        runtime.invalidate();
      }
    };

    container.addEventListener("click", onPointerDown);
    container.addEventListener("mouseover", onPointerOver);
    container.addEventListener("mouseout", onPointerOut);

    return () => {
      container.removeEventListener("click", onPointerDown);
      container.removeEventListener("mouseover", onPointerOver);
      container.removeEventListener("mouseout", onPointerOut);
      container.innerHTML = "";
      labelSlots.length = 0;
      edgeLabelSlots.length = 0;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none"
    />
  );
}
