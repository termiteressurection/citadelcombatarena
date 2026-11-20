import { useMindmap, type EdgeStyle } from "./store";
import { labelSlots, edgeLabelSlots } from "./LabelLayer";
import {
  X,
  Trash2,
  Link2,
  Link2Off,
  Plus,
  Network,
  ExternalLink,
  ChevronRight,
  Sliders,
  Move3d,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { getNumericId } from "./ids";
import {
  deleteWithUndo,
  deleteEdgeWithUndo,
  updateEdgeStyleWithUndo,
  createChild,
  focusNode,
  runtime,
} from "./runtime";
import { pathToRoot, kindOf } from "./graph";
import { ACCENTS, accentForHue, isHexColor, resolveNodeColor, type AccentName } from "./palette";

interface NodePanelProps {
  onNavigate?: (id: number) => void;
}

export function NodePanel({ onNavigate }: NodePanelProps) {
  const selectedId = useMindmap((s) => s.selectedId);
  const selectedEdgeId = useMindmap((s) => s.selectedEdgeId);
  const nodes = useMindmap((s) => s.nodes);
  const edges = useMindmap((s) => s.edges);
  const order = useMindmap((s) => s.order);
  const select = useMindmap((s) => s.select);
  const selectEdge = useMindmap((s) => s.selectEdge);
  const startLinking = useMindmap((s) => s.startLinking);
  const update = useMindmap((s) => s.updateNode);
  const toggleLink = useMindmap((s) => s.toggleLink);
  const toggleStar = useMindmap((s) => s.toggleStar);
  const addBullet = useMindmap((s) => s.addBullet);
  const removeBullet = useMindmap((s) => s.removeBullet);
  const updateBullet = useMindmap((s) => s.updateBullet);

  const [bulletDraft, setBulletDraft] = useState("");
  const [linkSearch, setLinkSearch] = useState("");

  const c = selectedId ? nodes[selectedId] : null;
  const currentEdge = selectedEdgeId ? (edges || {})[selectedEdgeId] : null;

  // Local drafts for instant typing without lifting keystroke state
  const [draftTitle, setDraftTitle] = useState(c?.title ?? "");
  const [draftBody, setDraftBody] = useState(c?.body ?? "");
  const [draftEdgeLabel, setDraftEdgeLabel] = useState(currentEdge?.style?.label ?? "");

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync drafts when selected node or edge changes
  useEffect(() => {
    setDraftTitle(c?.title ?? "");
    setDraftBody(c?.body ?? "");
  }, [c?.id]);

  useEffect(() => {
    setDraftEdgeLabel(currentEdge?.style?.label ?? "");
  }, [currentEdge?.id]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current);
      if (edgeLabelTimerRef.current) clearTimeout(edgeLabelTimerRef.current);
    };
  }, []);

  const handleTitleChange = (val: string) => {
    setDraftTitle(val);
    if (c) {
      // Instant direct DOM sync with 3D label slot
      for (const slot of labelSlots) {
        if (slot.el.dataset.id === c.id) {
          const text = val.length > 30 ? val.slice(0, 29) + "…" : val;
          slot.title.textContent = text;
          slot.text = text;
          break;
        }
      }
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(() => {
        update(c.id, { title: val });
      }, 350);
    }
  };

  const handleTitleBlur = () => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    if (c && c.title !== draftTitle) {
      update(c.id, { title: draftTitle });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const handleBodyChange = (val: string) => {
    setDraftBody(val);
    if (c) {
      if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current);
      bodyTimerRef.current = setTimeout(() => {
        update(c.id, { body: val });
      }, 350);
    }
  };

  const handleBodyBlur = () => {
    if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current);
    if (c && c.body !== draftBody) {
      update(c.id, { body: draftBody });
    }
  };

  const handleEdgeLabelChange = (val: string) => {
    setDraftEdgeLabel(val);
    if (currentEdge) {
      for (const slot of edgeLabelSlots) {
        if (slot.el.dataset.edgeId === currentEdge.id) {
          slot.title.textContent = val;
          slot.text = val;
          break;
        }
      }
      if (edgeLabelTimerRef.current) clearTimeout(edgeLabelTimerRef.current);
      edgeLabelTimerRef.current = setTimeout(() => {
        updateEdgeStyleWithUndo(currentEdge.id, { label: val });
      }, 350);
    }
  };

  const handleEdgeLabelBlur = () => {
    if (edgeLabelTimerRef.current) clearTimeout(edgeLabelTimerRef.current);
    if (currentEdge && (currentEdge.style?.label || "") !== draftEdgeLabel) {
      updateEdgeStyleWithUndo(currentEdge.id, { label: draftEdgeLabel });
    }
  };

  const graph = runtime.graph;
  const breadcrumb = useMemo(() => {
    if (!graph || !selectedId) return [];
    return pathToRoot(graph, selectedId);
  }, [graph, selectedId]);

  const nodeKind = useMemo(() => {
    if (!graph || !c) return "entry";
    return kindOf(graph, c);
  }, [graph, c]);

  const linkedNodes = useMemo(() => {
    if (!c) return [];
    return (c.links || []).map((id) => nodes[id]).filter(Boolean);
  }, [c, nodes]);

  const unlinkedMatches = useMemo(() => {
    if (!c || !linkSearch.trim()) return [];
    const q = linkSearch.toLowerCase().trim();
    const existing = new Set(c.links || []);
    const results: Array<{ id: string; title: string; hue: number }> = [];
    for (const id of order) {
      if (id === c.id || existing.has(id)) continue;
      const n = nodes[id];
      if (!n) continue;
      const t = (n.title || "Untitled").toLowerCase();
      if (t.includes(q)) {
        results.push({ id, title: n.title || "Untitled", hue: n.hue });
        if (results.length >= 6) break;
      }
    }
    return results;
  }, [c, linkSearch, order, nodes]);

  // ── Render Edge Editor when an edge is selected ──────────────────────────
  if (selectedEdgeId && currentEdge) {
    const srcNode = nodes[currentEdge.source];
    const tgtNode = nodes[currentEdge.target];
    const style: EdgeStyle = currentEdge.style || {};
    const currentColor = style.color || (currentEdge.kind === "tree" ? "#3ff0ff" : "#ff4fd8");
    const currentCurvature = style.curvature ?? 0.15;
    const currentThickness = style.thickness ?? 1.5;
    const isDashed = Boolean(style.dashed);
    const hasArrow = Boolean(style.arrow);
    const currentLabel = style.label || "";

    const setStyle = (patch: Partial<EdgeStyle>) => {
      updateEdgeStyleWithUndo(currentEdge.id, patch);
    };

    return (
      <aside
        className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col border-l shadow-2xl transition-all"
        style={{
          borderColor: "rgba(255, 79, 216, 0.3)",
          background: "rgba(6, 5, 13, 0.95)",
          backdropFilter: "blur(16px)",
          color: "#e6e6ea",
          fontFamily: "var(--citadel-ui-font, monospace)",
        }}
      >
        <header
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "rgba(255, 79, 216, 0.2)" }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: currentColor, boxShadow: `0 0 8px ${currentColor}` }}
            />
            <span className="text-[10px] uppercase tracking-[0.25em] font-mono text-[#ff4fd8]">
              {currentEdge.kind === "tree" ? "TREE CONNECTION" : "SYNAPTIC CROSSLINK"}
            </span>
          </div>
          <button
            onClick={() => selectEdge(null)}
            className="rounded p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
            aria-label="Close edge panel"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Connected Endpoints */}
          <div className="rounded border p-3 bg-white/[0.02]" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
            <div className="text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono mb-2">
              Connected Thoughts
            </div>
            <div className="space-y-2">
              <button
                onClick={() => focusNode(currentEdge.source, true)}
                className="flex items-center justify-between w-full text-left text-xs hover:text-[#3ff0ff] transition"
              >
                <span className="truncate opacity-80">{srcNode?.title || "Source Thought"}</span>
                <span className="text-[9px] text-[#3ff0ff] opacity-60">Source ◈</span>
              </button>
              <div className="flex items-center justify-center opacity-30 my-0.5">
                <ArrowRight className="h-3 w-3" />
              </div>
              <button
                onClick={() => focusNode(currentEdge.target, true)}
                className="flex items-center justify-between w-full text-left text-xs hover:text-[#ff4fd8] transition"
              >
                <span className="truncate opacity-80">{tgtNode?.title || "Target Thought"}</span>
                <span className="text-[9px] text-[#ff4fd8] opacity-60">Target ◈</span>
              </button>
            </div>
          </div>

          {/* Edge Label */}
          <div>
            <label className="text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono block mb-1">
              Connection Label
            </label>
            <input
              value={draftEdgeLabel}
              onChange={(e) => handleEdgeLabelChange(e.target.value)}
              onBlur={handleEdgeLabelBlur}
              placeholder="e.g. causes, implies, questions..."
              className="w-full bg-transparent border rounded px-2.5 py-1.5 text-xs outline-none font-mono"
              style={{
                borderColor: "rgba(255, 255, 255, 0.15)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            />
          </div>

          {/* Color Presets */}
          <div>
            <label className="text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono block mb-2">
              Neon Palette Accent
            </label>
            <div className="flex items-center gap-2">
              {[
                { name: "Cyan", hex: "#3ff0ff" },
                { name: "Magenta", hex: "#ff4fd8" },
                { name: "Gold", hex: "#ffc95c" },
              ].map((preset) => {
                const isActive = (style.color || currentColor).toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    onClick={() => setStyle({ color: preset.hex })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono uppercase tracking-wider transition ${
                      isActive ? "border-white bg-white/10" : "opacity-60 hover:opacity-100"
                    }`}
                    style={{ borderColor: preset.hex, color: preset.hex }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: preset.hex }} />
                    <span>{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style toggles: Solid / Dashed & Arrowhead */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setStyle({ dashed: !isDashed })}
              className={`rounded border py-2 px-3 text-[10px] uppercase tracking-wider font-mono transition flex items-center justify-center gap-1.5 ${
                isDashed ? "text-[#ffc95c] border-[#ffc95c]/60 bg-[#ffc95c]/10" : "opacity-70 border-white/20"
              }`}
            >
              <span>{isDashed ? "Dashed Line" : "Solid Line"}</span>
            </button>
            <button
              onClick={() => setStyle({ arrow: !hasArrow })}
              className={`rounded border py-2 px-3 text-[10px] uppercase tracking-wider font-mono transition flex items-center justify-center gap-1.5 ${
                hasArrow ? "text-[#3ff0ff] border-[#3ff0ff]/60 bg-[#3ff0ff]/10" : "opacity-70 border-white/20"
              }`}
            >
              <span>{hasArrow ? "Directed (Arrow)" : "Undirected"}</span>
            </button>
          </div>

          {/* Thickness Slider */}
          <div className="pt-1">
            <div className="flex justify-between items-center mb-1 text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono">
              <span>Thickness</span>
              <span className="opacity-80">{currentThickness.toFixed(1)}px</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={currentThickness}
              onChange={(e) => setStyle({ thickness: Number(e.target.value) })}
              className="w-full accent-[#ff4fd8]"
            />
          </div>

          {/* 3D Curvature / Bend Slider */}
          <div className="pt-1">
            <div className="flex justify-between items-center mb-1 text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono">
              <span>3D Curve Bend</span>
              <span className="opacity-80">{currentCurvature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-0.8}
              max={0.8}
              step={0.05}
              value={currentCurvature}
              onChange={(e) => setStyle({ curvature: Number(e.target.value) })}
              className="w-full accent-[#3ff0ff]"
            />
            <p className="mt-1 text-[9px] opacity-40 leading-normal">
              Tip: You can also drag the glowing midpoint handle directly in 3D to bend this connection.
            </p>
          </div>
        </div>

        <footer className="border-t px-4 py-3" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
          <button
            onClick={() => {
              deleteEdgeWithUndo(currentEdge.id);
              selectEdge(null);
            }}
            className="flex items-center justify-center gap-1.5 w-full rounded border py-2 text-[10px] uppercase tracking-[0.2em] text-red-400/90 border-red-500/30 transition hover:bg-red-500/10 font-mono"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Sever Connection (Both thoughts remain)</span>
          </button>
        </footer>
      </aside>
    );
  }

  // ── Render Node Panel when a node is selected ────────────────────────────
  if (!selectedId || !c) return null;

  const hasCustomColor = isHexColor(c.color);
  const accentName = c.starred ? "gold" : hasCustomColor ? "custom" : accentForHue(c.hue);
  const accentHex = c.starred ? ACCENTS.gold.hex : resolveNodeColor(c).hex;
  const bullets = c.bullets || [];
  const currentPos = runtime.getPos(c.id) ?? c.position;
  const currentZ = currentPos[2] ?? 0;

  return (
    <aside
      className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col border-l shadow-2xl transition-all"
      style={{
        borderColor: "rgba(63, 240, 255, 0.2)",
        background: "rgba(6, 5, 13, 0.94)",
        backdropFilter: "blur(16px)",
        color: "#e6e6ea",
        fontFamily: "var(--citadel-ui-font, monospace)",
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "rgba(63, 240, 255, 0.15)" }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{
              background: accentHex,
              boxShadow: `0 0 8px ${accentHex}`,
            }}
          />
          <span className="text-[10px] uppercase tracking-[0.25em] opacity-60 font-mono">
            {nodeKind.toUpperCase()} · {c.id.slice(0, 6)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Link mode trigger button */}
          <button
            onClick={() => startLinking(c.id)}
            title="Link to another thought [L]"
            className="flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] uppercase tracking-wider font-mono opacity-80 hover:opacity-100 transition hover:bg-white/5"
            style={{ borderColor: "rgba(255, 79, 216, 0.4)", color: "#ff4fd8" }}
          >
            <Link2 className="h-3 w-3" />
            <span>Link [L]</span>
          </button>
          <button
            onClick={() => createChild(c.id)}
            title="Create child thought [N]"
            className="flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] uppercase tracking-wider font-mono opacity-80 hover:opacity-100 transition hover:bg-white/5"
            style={{ borderColor: "rgba(63, 240, 255, 0.3)", color: "#3ff0ff" }}
          >
            <Plus className="h-3 w-3" />
            <span>Child</span>
          </button>
          <button
            onClick={() => select(null)}
            className="rounded p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Breadcrumb path */}
      {breadcrumb.length > 1 && (
        <nav
          className="flex items-center gap-1 overflow-x-auto px-4 py-2 border-b text-[10px] font-mono tracking-wider opacity-60"
          style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
        >
          {breadcrumb.map((id, idx) => {
            const n = nodes[id];
            const isLast = idx === breadcrumb.length - 1;
            return (
              <span key={id} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <ChevronRight className="h-3 w-3 opacity-40" />}
                <button
                  onClick={() => focusNode(id, true)}
                  className={`truncate max-w-[90px] transition hover:underline ${
                    isLast ? "font-bold text-white opacity-100" : "hover:opacity-100 text-[#3ff0ff]"
                  }`}
                >
                  {n?.title || "Untitled"}
                </button>
              </span>
            );
          })}
        </nav>
      )}

      {/* Main body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <label className="text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono block mb-1">
            Thought Title
          </label>
          <input
            value={draftTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled thought..."
            className="w-full border-0 border-b bg-transparent pb-1.5 text-lg font-light tracking-wide outline-none placeholder:opacity-25"
            style={{ borderColor: `${accentHex}66` }}
          />

          <label className="text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono block mt-4 mb-1">
            Notes & Inquiry
          </label>
          <textarea
            value={draftBody}
            onChange={(e) => handleBodyChange(e.target.value)}
            onBlur={handleBodyBlur}
            placeholder="Record philosophical notes, derivations, or context..."
            rows={4}
            className="w-full resize-none bg-transparent text-xs leading-relaxed outline-none placeholder:opacity-25 border rounded p-2"
            style={{
              borderColor: "rgba(255, 255, 255, 0.08)",
              background: "rgba(255, 255, 255, 0.02)",
              color: "rgba(230, 230, 234, 0.9)",
            }}
          />
        </div>

        {/* 3D Depth Placement Control */}
        <div className="border-t pt-3" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono flex items-center gap-1.5">
              <Move3d className="h-3 w-3 text-[#3ff0ff]" />
              <span>3D Depth (Z-Axis)</span>
            </span>
            <span className="text-[10px] font-mono text-[#3ff0ff]">{currentZ.toFixed(1)}u</span>
          </div>
          <input
            type="range"
            min={-35}
            max={35}
            step={0.5}
            value={currentZ}
            onChange={(e) => {
              const val = Number(e.target.value);
              const p = runtime.getPos(c.id) ?? c.position;
              update(c.id, { position: [p[0], p[1], val] });
              runtime.invalidate();
            }}
            className="w-full accent-[#3ff0ff]"
          />
          <p className="mt-1 text-[9px] opacity-50 font-mono leading-tight">
            Drag node in 3D to move on plane · Scroll or Shift-drag to adjust depth directly.
          </p>
        </div>

        {/* Chamber Porting / Navigation */}
        {onNavigate && (
          <div className="border-t pt-3" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
            <button
              onClick={() => onNavigate(getNumericId(c.id))}
              className="w-full text-xs font-semibold tracking-[0.25em] uppercase border py-2.5 flex items-center justify-center gap-2 rounded transition hover:scale-[1.01]"
              style={{
                borderColor: "#3ff0ff",
                color: "#3ff0ff",
                background: "rgba(63, 240, 255, 0.08)",
                boxShadow: "0 0 14px rgba(63, 240, 255, 0.2)",
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Traverse Chamber</span>
            </button>
          </div>
        )}

        {/* Torii Gate Star */}
        <div className="border-t pt-3" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
          <button
            onClick={() => toggleStar(c.id)}
            className="w-full text-[10px] tracking-[0.2em] uppercase border py-2 flex items-center justify-center gap-2 rounded transition hover:bg-white/5"
            style={{
              borderColor: c.starred ? "#ffc95c" : "rgba(138, 138, 148, 0.3)",
              color: c.starred ? "#ffc95c" : "#e6e6ea",
              background: c.starred ? "rgba(255, 201, 92, 0.12)" : "transparent",
              boxShadow: c.starred ? "0 0 10px rgba(255, 201, 92, 0.25)" : "none",
            }}
          >
            <span>★</span>
            <span>{c.starred ? "STARRED · TORII GATE LIVE" : "STAR AS SANCTUARY GATE"}</span>
          </button>
        </div>

        {/* Chamber Outlines / Inscribed Bullets */}
        <div className="border-t pt-3" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
          <div className="mb-2 text-[9px] uppercase tracking-[0.25em] opacity-60 text-[#3ff0ff] font-mono flex items-center justify-between">
            <span>NOTES & INQUIRY: Inscribed Bullets ({bullets.length})</span>
            <span className="text-[8px] opacity-60 font-mono uppercase">Timelock Immune</span>
          </div>
          <div className="space-y-1.5">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="text-[10px] opacity-40 select-none font-mono">·</span>
                <input
                  value={b}
                  onChange={(e) => updateBullet(c.id, i, e.target.value)}
                  className="flex-1 bg-transparent border-b pb-0.5 text-xs outline-none"
                  style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
                />
                <button
                  onClick={() => removeBullet(c.id, i)}
                  className="opacity-40 hover:opacity-100 text-red-400 p-0.5 text-[11px]"
                  title="Remove inscribed bullet"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-1.5 mt-2">
              <input
                value={bulletDraft}
                onChange={(e) => setBulletDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && bulletDraft.trim()) {
                    addBullet(c.id, bulletDraft.trim());
                    setBulletDraft("");
                  }
                }}
                placeholder="Inscribe bullet into node... (Enter)"
                className="flex-1 bg-transparent border-b pb-0.5 text-xs outline-none"
                style={{ borderColor: "rgba(63, 240, 255, 0.3)" }}
              />
              <button
                onClick={() => {
                  if (bulletDraft.trim()) {
                    addBullet(c.id, bulletDraft.trim());
                    setBulletDraft("");
                  }
                }}
                className="px-2 py-0.5 border text-xs rounded hover:bg-white/5 font-mono"
                style={{ borderColor: "rgba(63, 240, 255, 0.4)", color: "#3ff0ff" }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Wireframe Color Accent */}
        <div className="border-t pt-3" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono">
              Chamber Hue Accent
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono opacity-60 uppercase">{accentName}</span>
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: accentHex, boxShadow: `0 0 6px ${accentHex}` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.keys(ACCENTS) as AccentName[]).map((name) => {
              const swatch = ACCENTS[name];
              const on = !c.starred && !hasCustomColor && accentName === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={`Set node color ${name}`}
                  data-testid={`node-color-${name}`}
                  onClick={() => update(c.id, { hue: swatch.hue, color: undefined })}
                  className="h-5 w-5 rounded-full transition-transform hover:scale-125"
                  style={{
                    background: swatch.hex,
                    boxShadow: on ? `0 0 0 2px #06050d, 0 0 0 3px ${swatch.hex}, 0 0 10px ${swatch.hex}` : "none",
                    opacity: on ? 1 : 0.7,
                  }}
                />
              );
            })}
            <label
              title="Pick any color"
              className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full transition-transform hover:scale-125"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff4d4d, #ffd24d, #4dff6a, #4dfff0, #4d6aff, #d24dff, #ff4d4d)",
                boxShadow: hasCustomColor
                  ? `0 0 0 2px #06050d, 0 0 0 3px ${accentHex}, 0 0 10px ${accentHex}`
                  : "none",
                opacity: hasCustomColor ? 1 : 0.8,
              }}
            >
              <input
                type="color"
                aria-label="Custom node color wheel"
                data-testid="node-color-wheel"
                value={hasCustomColor ? accentHex : "#3ff0ff"}
                onChange={(e) => update(c.id, { color: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={c.hue}
            onChange={(e) => update(c.id, { hue: Number(e.target.value), color: undefined })}
            className="w-full accent-cyan-400"
          />
        </div>

        {/* Synaptic Links */}
        <div className="border-t pt-3" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] uppercase tracking-[0.25em] opacity-40 font-mono">
              Synaptic Links ({linkedNodes.length})
            </span>
            <Network className="h-3 w-3 opacity-40" />
          </div>

          <ul className="space-y-1 mb-3">
            {linkedNodes.map((target) => (
              <li
                key={target.id}
                className="flex items-center justify-between rounded px-2 py-1 text-xs transition bg-white/[0.02] border border-white/5"
              >
                <button
                  onClick={() => focusNode(target.id, true)}
                  className="flex items-center gap-2 truncate text-left hover:underline"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: resolveNodeColor(target).hex }}
                  />
                  <span className="truncate">{target.title || "Untitled"}</span>
                </button>
                <button
                  onClick={() => toggleLink(c.id, target.id)}
                  title="Sever link"
                  className="opacity-40 hover:opacity-100 text-red-300 p-0.5 ml-1 shrink-0"
                >
                  <Link2Off className="h-3 w-3" />
                </button>
              </li>
            ))}
            {linkedNodes.length === 0 && (
              <li className="text-[10px] opacity-40 font-mono">No synaptic links connected.</li>
            )}
          </ul>

          {/* Quick connect search */}
          <div className="relative">
            <input
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              placeholder="Search thought to connect..."
              className="w-full bg-transparent border rounded px-2 py-1 text-xs outline-none font-mono"
              style={{
                borderColor: "rgba(255, 255, 255, 0.15)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            />
            {unlinkedMatches.length > 0 && (
              <ul
                className="absolute bottom-full left-0 right-0 mb-1 rounded border shadow-xl overflow-hidden z-30 font-mono"
                style={{ background: "#0b0a14", borderColor: "rgba(63, 240, 255, 0.3)" }}
              >
                {unlinkedMatches.map((match) => (
                  <li key={match.id}>
                    <button
                      onClick={() => {
                        toggleLink(c.id, match.id);
                        setLinkSearch("");
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-left hover:bg-white/10 transition"
                    >
                      <Link2 className="h-3 w-3 text-[#3ff0ff]" />
                      <span className="truncate">{match.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="border-t px-4 py-3 flex items-center justify-between"
        style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
      >
        <button
          onClick={() => deleteWithUndo(c.id)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-red-400/80 transition hover:text-red-300 font-mono"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Remove Thought</span>
        </button>
      </footer>
    </aside>
  );
}
