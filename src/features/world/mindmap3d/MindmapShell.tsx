import { useEffect, useMemo, useState, useRef } from "react";
import { Scene } from "./Scene";
import { NodePanel } from "./NodePanel";
import { LabelLayer } from "./LabelLayer";
import { MapTabs } from "./MapTabs";
import { useMindmap, type Node } from "./store";
import {
  runtime,
  useMindmapView,
  focusNode,
  toggleFold,
  createChild,
  deleteWithUndo,
  deleteEdgeWithUndo,
} from "./runtime";
import {
  buildGraph,
  computeVisibility,
  pathToRoot,
  searchNodes,
  visibleOrder,
  topologyKey,
} from "./graph";
import { VISIBLE_BUDGET, resolveNodeColor } from "./palette";
import { semanticPairScores, type SemanticPairScore } from "@/core/semantic/semanticClient";
import {
  Plus,
  Search,
  Maximize2,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Sliders,
  HelpCircle,
  X,
  Compass,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate?: (id: number) => void;
}

export function MindmapShell({ open, onClose, onNavigate }: Props) {
  const nodes = useMindmap((s) => s.nodes);
  const edges = useMindmap((s) => s.edges);
  const order = useMindmap((s) => s.order);
  const selectedId = useMindmap((s) => s.selectedId);
  const selectedEdgeId = useMindmap((s) => s.selectedEdgeId);
  const linkingSourceId = useMindmap((s) => s.linkingSourceId);
  const select = useMindmap((s) => s.select);
  const selectEdge = useMindmap((s) => s.selectEdge);
  const startLinking = useMindmap((s) => s.startLinking);
  const cancelLinking = useMindmap((s) => s.cancelLinking);
  const finishLinking = useMindmap((s) => s.finishLinking);

  const expanded = useMindmapView((s) => s.expanded);
  const collapsed = useMindmapView((s) => s.collapsed);
  const undo = useMindmapView((s) => s.undo);
  const setUndo = useMindmapView((s) => s.setUndo);
  const showKeys = useMindmapView((s) => s.showKeys);
  const toggleKeys = useMindmapView((s) => s.toggleKeys);

  const [searchOpen, setSearchOpen] = useState(false);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [semanticPairs, setSemanticPairs] = useState<SemanticPairScore[] | null>(null);

  // Reduced motion preference
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  });

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Compute graph structure and decluttered visibility — memoized on topologyKey
  // so text editing (title, body, notes) never triggers graph rebuild or layout simulation
  const topKey = useMemo(() => topologyKey(nodes, order, edges), [nodes, order, edges]);
  const graph = useMemo(() => buildGraph(nodes, order, edges), [topKey]);
  const vis = useMemo(
    () => computeVisibility(graph, expanded, collapsed, VISIBLE_BUDGET),
    [graph, expanded, collapsed]
  );

  // Keep runtime bridge synced
  runtime.graph = graph;
  runtime.vis = vis;
  runtime.nodes = nodes;
  runtime.reducedMotion = reducedMotion;

  // Semantic pairing layout scores (gentle background clustering)
  // Only runs when graph topology changes, debounced by 1s
  useEffect(() => {
    const orderedNodes = order.flatMap((id) => (nodes[id] ? [nodes[id]] : []));
    if (orderedNodes.length < 2) return;
    const items = orderedNodes.map((node) => ({
      id: node.id,
      text: [node.title, node.body, ...(node.bullets ?? [])].filter(Boolean).join("\n"),
    }));
    const timer = setTimeout(() => {
      void semanticPairScores(items)
        .then((pairs) => setSemanticPairs(pairs))
        .catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [topKey]);

  // Initial root selection if open and nothing selected
  useEffect(() => {
    if (open && order.length > 0 && !selectedId && graph.rootId) {
      select(graph.rootId);
    }
  }, [open, order.length, selectedId, graph.rootId, select]);

  // Auto-dismiss undo toast after 7s
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo, setUndo]);

  // Breadcrumb path back to root
  const breadcrumb = useMemo(() => {
    if (!selectedId) return [];
    return pathToRoot(graph, selectedId);
  }, [graph, selectedId]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // If search modal is open, it handles its own input and navigation
      if (searchOpen) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const isInput =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable;

      // If typing in a form field, do not hijack normal typing
      if (isInput) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // Hotkey / : open fuzzy search
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Hotkey ? : toggle key shortcuts
      if (e.key === "?") {
        e.preventDefault();
        toggleKeys();
        return;
      }

      // Hotkey F : frame all
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        runtime.frameAll();
        return;
      }

      // Hotkey L : enter link mode from selected node
      if (e.key === "l" || e.key === "L") {
        if (selectedId) {
          e.preventDefault();
          startLinking(selectedId);
          return;
        }
      }

      // Hotkey N : create child
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        createChild(selectedId);
        return;
      }

      // Hotkey Delete / Backspace : remove with undo
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdgeId) {
          e.preventDefault();
          deleteEdgeWithUndo(selectedEdgeId);
          return;
        }
        if (selectedId) {
          e.preventDefault();
          deleteWithUndo(selectedId);
          return;
        }
      }

      // Hotkey Space : toggle fold
      if (e.key === " " && selectedId) {
        e.preventDefault();
        toggleFold(selectedId);
        return;
      }

      // Tab / Shift+Tab : cycle visible nodes
      if (e.key === "Tab") {
        e.preventDefault();
        const visNodes = visibleOrder(graph, vis.visible);
        if (visNodes.length === 0) return;
        const curIdx = selectedId ? visNodes.indexOf(selectedId) : -1;
        const nextIdx = e.shiftKey
          ? (curIdx - 1 + visNodes.length) % visNodes.length
          : (curIdx + 1) % visNodes.length;
        focusNode(visNodes[nextIdx], true);
        return;
      }

      // Arrow navigation across the tree
      if (selectedId) {
        if (e.key === "ArrowUp") {
          // Go to parent
          const p = graph.parent.get(selectedId);
          if (p) {
            e.preventDefault();
            focusNode(p, true);
          }
          return;
        }

        if (e.key === "ArrowDown") {
          // Go to first child
          const kids = (graph.children.get(selectedId) || []).filter((k) =>
            vis.visible.has(k)
          );
          if (kids.length > 0) {
            e.preventDefault();
            focusNode(kids[0], true);
          }
          return;
        }

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          // Move among siblings
          const p = graph.parent.get(selectedId);
          const siblings = p
            ? (graph.children.get(p) || []).filter((k) => vis.visible.has(k))
            : graph.rootId
            ? [graph.rootId]
            : [];
          if (siblings.length > 1) {
            e.preventDefault();
            const idx = siblings.indexOf(selectedId);
            const nextIdx =
              e.key === "ArrowRight"
                ? (idx + 1) % siblings.length
                : (idx - 1 + siblings.length) % siblings.length;
            focusNode(siblings[nextIdx], true);
          }
          return;
        }
      }

      // Escape: clear selection, cancel linking, or close
      if (e.key === "Escape") {
        e.preventDefault();
        if (linkingSourceId) {
          cancelLinking();
        } else if (selectedEdgeId) {
          selectEdge(null);
        } else if (selectedId) {
          select(null);
        } else {
          onClose();
        }
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    open,
    selectedId,
    selectedEdgeId,
    linkingSourceId,
    searchOpen,
    graph,
    vis,
    select,
    selectEdge,
    startLinking,
    cancelLinking,
    finishLinking,
    onClose,
    toggleKeys,
  ]);

  if (!open) return null;

  const hasNodes = order.length > 0;
  const visibleNodes = visibleOrder(graph, vis.visible);

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden select-none"
      style={{
        background: "#06050d",
        color: "#e9e6ff",
        fontFamily: "var(--citadel-ui-font, monospace)",
      }}
    >
      {/* 3D Scene viewport */}
      <div className="absolute inset-0">
        <Scene
          graph={graph}
          vis={vis}
          nodes={nodes}
          selectedId={selectedId}
          reducedMotion={reducedMotion}
          semanticPairs={semanticPairs}
          panelOpen={Boolean(selectedId)}
        />
      </div>

      {/* DOM Label Layer for clean, non-competing typography */}
      <LabelLayer />

      <MapTabs />

      {/* Header HUD */}
      <header
        className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4 border-b"
        style={{
          background: "linear-gradient(180deg, rgba(6, 5, 13, 0.95) 0%, rgba(6, 5, 13, 0.6) 75%, transparent 100%)",
          borderColor: "rgba(63, 240, 255, 0.12)",
        }}
      >
        {/* Title & Root Breadcrumb */}
        <div className="flex items-center gap-4">
          <div>
            <h1
              className="text-[12px] uppercase tracking-[0.45em] font-mono flex items-center gap-2"
              style={{ color: "#ffc95c", textShadow: "0 0 10px rgba(255, 201, 92, 0.4)" }}
            >
              <span>◈ CITADEL MINDMAP</span>
              <span className="text-[10px] opacity-40 font-normal tracking-[0.2em] text-[#3ff0ff]">
                THE PHILOSOPHER'S NOTEBOOK
              </span>
            </h1>

            {/* Breadcrumb path */}
            {breadcrumb.length > 1 && (
              <div className="pointer-events-auto flex items-center gap-1 mt-1 font-mono text-[10px] tracking-wider opacity-75">
                {breadcrumb.map((id, idx) => {
                  const n = nodes[id];
                  const isCurrent = id === selectedId;
                  return (
                    <span key={id} className="flex items-center gap-1">
                      {idx > 0 && <ChevronRight className="h-3 w-3 opacity-40 text-[#3ff0ff]" />}
                      <button
                        onClick={() => focusNode(id, true)}
                        className={`truncate max-w-[120px] transition hover:text-white ${
                          isCurrent
                            ? "text-[#ff4fd8] font-bold"
                            : "text-[#3ff0ff] opacity-80 hover:opacity-100"
                        }`}
                      >
                        {n?.title || "Untitled"}
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Global Controls */}
        <div className="pointer-events-auto flex items-center gap-2 font-mono">
          {/* Declutter stats */}
          <div
            className="flex items-center gap-2 rounded border px-3 py-1 text-[10px] tracking-wider opacity-80"
            style={{ borderColor: "rgba(255, 255, 255, 0.1)", background: "rgba(6, 5, 13, 0.8)" }}
          >
            <Sliders className="h-3 w-3 text-[#3ff0ff]" />
            <span>
              {vis.visible.size} / {order.length} VISIBLE
            </span>
          </div>

          {/* Search Trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 rounded border px-3 py-1 text-[10px] uppercase tracking-wider transition hover:bg-white/10"
            style={{
              borderColor: "rgba(63, 240, 255, 0.3)",
              background: "rgba(6, 5, 13, 0.8)",
              color: "#3ff0ff",
            }}
            title="Search thoughts [/]"
          >
            <Search className="h-3 w-3" />
            <span>Search</span>
            <kbd className="ml-1 text-[9px] opacity-60 border px-1 rounded border-white/20">/</kbd>
          </button>

          {/* Recenter Frame All */}
          <button
            onClick={() => runtime.frameAll()}
            className="flex items-center gap-1 rounded border px-2.5 py-1 text-[10px] uppercase tracking-wider transition hover:bg-white/10 opacity-75 hover:opacity-100"
            style={{ borderColor: "rgba(255, 255, 255, 0.15)", background: "rgba(6, 5, 13, 0.8)" }}
            title="Recenter Camera [F]"
          >
            <Maximize2 className="h-3 w-3" />
          </button>

          {/* Keyboard legend toggle */}
          <button
            onClick={toggleKeys}
            className={`rounded border p-1 transition hover:bg-white/10 ${
              showKeys ? "text-[#ffc95c] border-[#ffc95c]" : "opacity-60 border-white/20"
            }`}
            style={{ background: "rgba(6, 5, 13, 0.8)" }}
            title="Keyboard Controls [?]"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="rounded border px-3 py-1 text-[10px] uppercase tracking-widest transition hover:bg-white/10 font-bold ml-1"
            style={{
              borderColor: "rgba(255, 79, 216, 0.4)",
              background: "rgba(255, 79, 216, 0.08)",
              color: "#ff4fd8",
            }}
          >
            Close ✕
          </button>
        </div>
      </header>

      {/* Link Mode Indicator Banner */}
      {linkingSourceId && (
        <div className="pointer-events-auto absolute top-20 left-1/2 z-30 -translate-x-1/2 font-mono">
          <div
            className="flex items-center gap-3 px-5 py-2.5 rounded-full border shadow-2xl backdrop-blur-md"
            style={{
              borderColor: "rgba(255, 79, 216, 0.6)",
              background: "rgba(20, 10, 30, 0.95)",
              color: "#ff4fd8",
              boxShadow: "0 0 25px rgba(255, 79, 216, 0.35)",
            }}
          >
            <span className="text-xs uppercase tracking-widest font-bold">
              ◈ LINK MODE: Connecting from “{nodes[linkingSourceId]?.title || "Thought"}”
            </span>
            <span className="text-[10px] text-zinc-300 opacity-80">
              (Click target thought or press / to search)
            </span>
            <button
              onClick={cancelLinking}
              className="px-2.5 py-0.5 rounded border border-white/20 text-[10px] uppercase hover:bg-white/10 text-white ml-2"
            >
              Cancel [Esc]
            </button>
          </div>
        </div>
      )}

      {/* Decluttered Left Rail — Hierarchical Tree */}
      <aside
        className={`pointer-events-auto absolute left-6 top-24 z-20 transition-all duration-300 font-mono ${
          leftRailOpen ? "w-64 max-h-[70vh]" : "w-10 h-10"
        }`}
      >
        {leftRailOpen ? (
          <div
            className="flex flex-col h-full rounded border overflow-hidden shadow-2xl"
            style={{
              borderColor: "rgba(63, 240, 255, 0.2)",
              background: "rgba(6, 5, 13, 0.9)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-3 py-2 text-[10px] uppercase tracking-widest opacity-70"
              style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
            >
              <span>Mindscape Index</span>
              <button
                onClick={() => setLeftRailOpen(false)}
                className="opacity-50 hover:opacity-100"
                title="Collapse rail"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {visibleNodes.map((id) => {
                const node = nodes[id];
                if (!node) return null;
                const isSelected = selectedId === id;
                const depth = graph.depth.get(id) ?? 0;
                const kids = graph.children.get(id) || [];
                const hiddenCount = vis.folded.get(id);
                const hasKids = kids.length > 0;
                const isOpen = vis.isOpen(id);
                const accent = resolveNodeColor(node).hex;

                return (
                  <div
                    key={id}
                    className={`group flex items-center gap-1.5 rounded px-2 py-1 text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-[#ff4fd8]/20 text-white font-semibold"
                        : "text-zinc-300/80 hover:bg-white/5 hover:text-white"
                    }`}
                    style={{ paddingLeft: `${Math.min(depth * 10 + 8, 48)}px` }}
                    onClick={() => focusNode(id, true)}
                  >
                    {/* Fold toggle icon */}
                    {hasKids ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFold(id);
                        }}
                        className="opacity-60 hover:opacity-100 p-0.5"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3 w-3 text-[#3ff0ff]" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-[#ffc95c]" />
                        )}
                      </button>
                    ) : (
                      <span className="w-3 text-center opacity-30 text-[9px]">·</span>
                    )}

                    {/* Color dot */}
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        background: node.starred ? "#ffc95c" : accent,
                        boxShadow: isSelected ? `0 0 6px ${accent}` : "none",
                      }}
                    />

                    {/* Title */}
                    <span className="truncate flex-1 text-[11px]">
                      {node.title || "Untitled"}
                    </span>

                    {/* Fold count chip */}
                    {hiddenCount ? (
                      <span
                        className="text-[9px] px-1 rounded border border-[#ffc95c]/50 text-[#ffc95c] bg-[#ffc95c]/10"
                        title={`${hiddenCount} thoughts folded`}
                      >
                        +{hiddenCount}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Bottom quick action */}
            <div
              className="border-t p-2"
              style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
            >
              <button
                onClick={() => createChild(selectedId)}
                className="flex items-center justify-center gap-1.5 w-full rounded border py-1.5 text-[10px] uppercase tracking-wider transition hover:bg-white/5 text-[#3ff0ff]"
                style={{ borderColor: "rgba(63, 240, 255, 0.3)" }}
              >
                <Plus className="h-3 w-3" />
                <span>New Thought [N]</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setLeftRailOpen(true)}
            className="flex items-center justify-center h-9 w-9 rounded border transition hover:bg-white/10"
            style={{
              borderColor: "rgba(63, 240, 255, 0.3)",
              background: "rgba(6, 5, 13, 0.9)",
              color: "#3ff0ff",
            }}
            title="Open Mindscape Index"
          >
            <Compass className="h-4 w-4" />
          </button>
        )}
      </aside>

      {/* Floating Center Bottom Action (Plant thought / Add child) */}
      <div className="pointer-events-auto absolute bottom-6 left-1/2 z-10 -translate-x-1/2 font-mono">
        <button
          onClick={() => createChild(selectedId)}
          className="group flex items-center gap-2 rounded-full border px-6 py-2.5 text-[11px] uppercase tracking-[0.3em] backdrop-blur-md transition hover:scale-[1.03] shadow-xl"
          style={{
            borderColor: "rgba(63, 240, 255, 0.4)",
            background: "rgba(6, 5, 13, 0.8)",
            color: "#e9e6ff",
            boxShadow: "0 0 20px rgba(63, 240, 255, 0.2)",
          }}
        >
          <Plus className="h-4 w-4 text-[#3ff0ff] transition group-hover:rotate-90" />
          <span>{selectedId ? "Branch Thought [N]" : "New Seed Thought [N]"}</span>
        </button>
      </div>

      {/* Selected Node Editor Panel */}
      <NodePanel
        onNavigate={(id) => {
          onNavigate?.(id);
          onClose();
        }}
      />

      {/* Empty State Banner (if no nodes exist) */}
      {!hasNodes && (
        <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
          <div
            className="max-w-md p-8 rounded-xl border backdrop-blur-xl shadow-2xl font-mono"
            style={{
              borderColor: "rgba(63, 240, 255, 0.3)",
              background: "rgba(6, 5, 13, 0.9)",
            }}
          >
            <div className="h-12 w-12 mx-auto mb-4 text-[#3ff0ff] animate-pulse flex items-center justify-center">
              ◈
            </div>
            <h2 className="text-base uppercase tracking-[0.3em] text-[#ffc95c] mb-2 font-bold">
              The Untouched Void
            </h2>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Every philosophical treatise begins with a single inquiry. Plant the seed thought to
              illuminate the Citadel mindmap.
            </p>
            <button
              onClick={() => createChild(null)}
              className="inline-flex items-center gap-2 rounded border px-6 py-3 text-xs uppercase tracking-widest font-semibold transition hover:scale-[1.02]"
              style={{
                borderColor: "#3ff0ff",
                background: "rgba(63, 240, 255, 0.15)",
                color: "#3ff0ff",
                boxShadow: "0 0 16px rgba(63, 240, 255, 0.3)",
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Plant Seed Thought</span>
            </button>
          </div>
        </div>
      )}

      {/* Fuzzy Search Modal (isolated local typing state) */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        nodes={nodes}
        order={order}
        linkingSourceId={linkingSourceId}
        onSelect={(id) => {
          if (linkingSourceId) {
            finishLinking(id);
          } else {
            focusNode(id, true);
          }
        }}
      />

      {/* Keyboard Shortcuts Overlay */}
      {showKeys && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: "rgba(6, 5, 13, 0.7)" }}
          onClick={toggleKeys}
        >
          <div
            className="w-full max-w-md rounded-xl border p-6 shadow-2xl font-mono"
            style={{
              borderColor: "rgba(255, 201, 92, 0.4)",
              background: "#0c0a18",
              boxShadow: "0 0 25px rgba(255, 201, 92, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
              <h3 className="text-xs uppercase tracking-[0.25em] text-[#ffc95c] font-bold">
                Mindmap Keyboard Navigation
              </h3>
              <button onClick={toggleKeys} className="opacity-50 hover:opacity-100">
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Navigate Tree (Parent / Child / Sibling)</span>
                <span className="text-[#3ff0ff]">↑ / ↓ / ← / →</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Cycle Visible Thoughts</span>
                <span className="text-[#3ff0ff]">Tab / Shift+Tab</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Create Child Thought</span>
                <span className="text-[#ff4fd8]">N</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Connect Crosslink</span>
                <span className="text-[#ff4fd8]">L</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">3D Orbit / Pan / Dolly</span>
                <span className="text-[#3ff0ff]">Left Drag / Right Drag / Scroll</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Adjust Thought Depth</span>
                <span className="text-[#ffc95c]">Shift-Drag or Scroll on Node</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Orbit Pivot to Thought</span>
                <span className="text-[#3ff0ff]">Double-Click Node</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Fuzzy Search & Jump / Link</span>
                <span className="text-[#3ff0ff]">/</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Fold / Unfold Branch</span>
                <span className="text-[#ffc95c]">Space</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Recenter View to Root</span>
                <span className="text-[#3ff0ff]">F (or Double-Click Empty)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="opacity-70">Delete Thought or Connection (Undo)</span>
                <span className="text-red-400">Delete / Backspace</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="opacity-70">Deselect / Close</span>
                <span className="opacity-60">Esc</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {undo && (
        <div className="pointer-events-auto fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-lg border px-4 py-2.5 shadow-2xl backdrop-blur-md font-mono text-xs" style={{ borderColor: "rgba(255, 79, 216, 0.4)", background: "rgba(11, 10, 20, 0.95)" }}>
          <span className="text-zinc-200">{undo.message}</span>
          <button
            onClick={undo.restore}
            className="flex items-center gap-1 rounded border border-[#ff4fd8] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#ff4fd8] transition hover:bg-[#ff4fd8]/20"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Undo</span>
          </button>
          <button onClick={() => setUndo(null)} className="opacity-40 hover:opacity-100 text-zinc-400 ml-1">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ── Search Modal Subcomponent (keeps typing state strictly local) ─────────
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Record<string, Node>;
  order: string[];
  linkingSourceId: string | null;
  onSelect: (id: string) => void;
}

function SearchModal({
  isOpen,
  onClose,
  nodes,
  order,
  linkingSourceId,
  onSelect,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchNodes(nodes, order, query, 8);
  }, [query, nodes, order]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 backdrop-blur-md font-mono"
      style={{ background: "rgba(6, 5, 13, 0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border shadow-2xl overflow-hidden font-mono"
        style={{
          borderColor: "rgba(63, 240, 255, 0.4)",
          background: "#0c0a18",
          boxShadow: "0 0 30px rgba(63, 240, 255, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && results[index]) {
            e.preventDefault();
            onSelect(results[index].id);
            onClose();
          }
        }}
      >
        <div
          className="flex items-center border-b px-4 py-3"
          style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
        >
          <Search className="h-4 w-4 text-[#3ff0ff] mr-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to thought (fuzzy search)..."
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-40 text-white font-mono"
          />
          <button onClick={onClose} className="opacity-40 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="max-h-72 overflow-y-auto divide-y divide-white/5 font-mono">
          {results.map((item, idx) => {
            const n = nodes[item.id];
            if (!n) return null;
            const isFocused = idx === index;
            const accent = resolveNodeColor(n).hex;

            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition ${
                    isFocused ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: n.starred ? "#ffc95c" : accent }}
                    />
                    <div className="truncate">
                      <div className="text-xs text-white truncate font-medium">
                        {n.title || "Untitled"}
                      </div>
                      {n.body && (
                        <div className="text-[10px] text-zinc-400 truncate opacity-60">
                          {n.body}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-[#3ff0ff] opacity-60 ml-2 shrink-0">
                    {linkingSourceId ? "Connect ↵" : "Jump ↵"}
                  </span>
                </button>
              </li>
            );
          })}
          {query.trim() && results.length === 0 && (
            <li className="px-4 py-6 text-center text-xs opacity-40 font-mono">
              No thoughts found matching "{query}"
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
