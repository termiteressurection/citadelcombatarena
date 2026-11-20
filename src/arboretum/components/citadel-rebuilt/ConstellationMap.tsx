import { useCallback, useEffect, useRef, useState } from 'react';
import type { Chamber } from './types';
import { UI_LAYER } from './uiLayers';

/**
 * [2] Constellation Map — interactive 2D node graph of the entire chamber hierarchy.
 * Shows tree structure + wormhole links. Click to jump. Pinch/scroll to zoom.
 */
interface Props {
  mode?: 'chambers' | 'thoughts' | 'calendar';
  chambers: Record<number, Chamber>;
  currentChamberId: number;
  onNavigate: (id: number) => void;
  onClose: () => void;
}

interface NodePos { id: string | number; x: number; y: number; type: 'chamber' | 'thought'; }

function layoutTree(chambers: Record<number, Chamber>): NodePos[] {
  const nodes: NodePos[] = [];
  const visited = new Set<number>();

  const walk = (id: number, depth: number, startAngle: number, endAngle: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    const ch = chambers[id];
    if (!ch) return;

    const midAngle = (startAngle + endAngle) / 2;
    const radius = depth * 220; // 220px per depth level

    nodes.push({
      id,
      x: Math.cos(midAngle) * radius,
      y: Math.sin(midAngle) * radius,
      type: 'chamber'
    });

    const childCount = ch.doors.length;
    if (childCount > 0) {
      const arc = endAngle - startAngle;
      const step = arc / childCount;
      ch.doors.forEach((doorId, i) => {
        walk(doorId, depth + 1, startAngle + step * i, startAngle + step * (i + 1));
      });
    }
  };

  walk(0, 0, 0, Math.PI * 2);
  return nodes;
}

function layoutThoughts(chambers: Record<number, Chamber>, currentChamberId: number): NodePos[] {
  const nodes: NodePos[] = [];
  const ch = chambers[currentChamberId];
  if (!ch) return [];

  // Radial layout for thoughts
  const radius = 220;
  ch.thoughts.forEach((t, i) => {
    const angle = (i / ch.thoughts.length) * Math.PI * 2;
    nodes.push({
      id: t.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      type: 'thought'
    });
  });

  return nodes;
}

/** Year hub + season + month + week + day rings (calendar template chambers). */
function layoutCalendarEye(chambers: Record<number, Chamber>): NodePos[] {
  const nodes: NodePos[] = [];
  const add = (id: number, x: number, y: number) => {
    nodes.push({ id, x, y, type: 'chamber' });
  };
  if (!chambers[1000]) return layoutTree(chambers);

  add(1000, 0, 0);
  const sr = 95;
  [1001, 1002, 1003, 1004].forEach((sid, i) => {
    if (!chambers[sid]) return;
    const ang = (i / 4) * Math.PI * 2 - Math.PI / 2;
    add(sid, Math.cos(ang) * sr, Math.sin(ang) * sr);
  });
  const mr = 175;
  for (let m = 0; m < 12; m++) {
    const mid = 1010 + m;
    if (!chambers[mid]) continue;
    const ang = (m / 12) * Math.PI * 2 - Math.PI / 2;
    add(mid, Math.cos(ang) * mr, Math.sin(ang) * mr);
  }
  const weeks = Object.values(chambers).filter(c => c.template === 'week');
  const wr = 232;
  weeks.forEach((ch, i) => {
    const ang = (i / Math.max(weeks.length, 1)) * Math.PI * 2 - Math.PI / 2;
    add(ch.id, Math.cos(ang) * wr, Math.sin(ang) * wr);
  });
  const y = new Date().getFullYear();
  const start = new Date(y, 0, 1);
  const dayList = Object.values(chambers).filter(c => c.template === 'day');
  const dr = 300;
  dayList.forEach(ch => {
    const match = ch.description?.match(/The day of (\d{4}-\d{2}-\d{2})\./);
    if (!match) return;
    const d = new Date(`${match[1]}T12:00:00`);
    const dayOfYear = Math.min(365, Math.max(0, Math.floor((d.getTime() - start.getTime()) / 86400000)));
    const ang = (dayOfYear / 365) * Math.PI * 2 - Math.PI / 2;
    add(ch.id, Math.cos(ang) * dr, Math.sin(ang) * dr);
  });
  return nodes;
}

function isSigmaTutorialNode(chamber: Chamber): boolean {
  return (chamber.template || '').startsWith('sigma-tutorial');
}

export default function ConstellationMap({ mode = 'chambers', chambers, currentChamberId, onNavigate, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<string | number | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const nodes = useRef<NodePos[]>([]);

  useEffect(() => {
    nodes.current =
      mode === 'thoughts'
        ? layoutThoughts(chambers, currentChamberId)
        : mode === 'calendar'
          ? layoutCalendarEye(chambers)
          : layoutTree(chambers);
  }, [chambers, currentChamberId, mode]);

  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const w = cvs.width = cvs.offsetWidth * 2;
    const h = cvs.height = cvs.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const cx = cvs.offsetWidth / 2 + offset.x;
    const cy = 80 + offset.y;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);

    const nodeMap: Record<string | number, NodePos> = {};
    for (const n of nodes.current) nodeMap[n.id] = n;

    // Draw edges
    ctx.lineWidth = 1;
    if (mode === 'chambers' || mode === 'calendar') {
      for (const ch of Object.values(chambers)) {
        const from = nodeMap[ch.id];
        if (!from) continue;
        for (const doorId of ch.doors) {
          const to = nodeMap[doorId];
          if (!to) continue;
          ctx.strokeStyle = mode === 'calendar' ? 'rgba(34,211,238,0.18)' : 'rgba(168,85,247,0.25)';
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
        }
        if (mode === 'chambers') {
          for (const wId of (ch.wormholes || [])) {
            const to = nodeMap[wId];
            if (!to || (typeof wId === 'number' && typeof ch.id === 'number' && wId <= ch.id)) continue;
            ctx.strokeStyle = 'rgba(251,191,36,0.3)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
      if (mode === 'calendar') {
        const ids = new Set(nodes.current.map(n => n.id as number));
        for (const ch of Object.values(chambers)) {
          if (ch.template !== 'day') continue;
          const from = nodeMap[ch.id];
          if (!from) continue;
          for (const other of Object.values(chambers)) {
            if (other.template !== 'day' || other.id >= ch.id) continue;
            const to = nodeMap[other.id];
            if (!to || !ids.has(other.id)) continue;
            const ma = ch.description?.match(/(\d{4}-\d{2}-\d{2})/);
            const mb = other.description?.match(/(\d{4}-\d{2}-\d{2})/);
            if (!ma || !mb) continue;
            const da = new Date(ma[1] + 'T12:00:00').getTime();
            const db = new Date(mb[1] + 'T12:00:00').getTime();
            if (Math.abs(da - db) === 86400000) {
              ctx.strokeStyle = 'rgba(168,85,247,0.12)';
              ctx.beginPath();
              ctx.moveTo(from.x, from.y);
              ctx.lineTo(to.x, to.y);
              ctx.stroke();
            }
          }
        }
      }
    } else {
      // Draw thought links (replies)
      const ch = chambers[currentChamberId];
      if (ch) {
        for (const t of ch.thoughts) {
          const from = nodeMap[t.id];
          if (!from) continue;
          for (const reply of ((t as any).replies || [])) {
            const to = nodeMap[reply.id]; // reply might be in same chamber or different
            if (!to) continue;
            ctx.strokeStyle = 'rgba(34,211,238,0.3)';
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
          }
        }
      }
    }

    // Draw nodes
    for (const n of nodes.current) {
      const isHovered = n.id === hovered;
      let radius = isHovered ? 15 : 12;
      let fill = '#7c3aed';
      let label = '';
      let subtext = '';

      if (n.type === 'chamber') {
        const ch = chambers[n.id as number];
        if (!ch) continue;
        const isCurrent = n.id === currentChamberId;
        if (isCurrent) radius = 18;
        label = ch.name;
        subtext = ch.thoughts.length > 0 ? `${ch.thoughts.length}` : '';
        
        const isTutorial = isSigmaTutorialNode(ch);
        const isTutorialRoot = ch.template === 'sigma-tutorial-root';
        const isTutorialExample = ch.template === 'sigma-tutorial-example';
        const isDay = ch.template === 'day';
        const isYear = ch.id === 1000;

        fill = isCurrent
          ? '#a855f7'
          : isTutorialRoot
            ? '#22d3ee'
            : isTutorialExample
              ? '#fbbf24'
              : isTutorial
                ? '#34d399'
                : ch.bookmarked
                  ? '#fbbf24'
                  : isDay
                    ? '#0e7490'
                    : isYear
                      ? '#fae8ff'
                      : (ch.thoughts.length === 0 && ch.doors.length === 0)
                        ? '#4c1d95'
                        : '#7c3aed';
        
        if (isCurrent || isHovered) {
          ctx.shadowColor = isCurrent ? '#a855f7' : '#ec4899';
          ctx.shadowBlur = 20;
        }
      } else {
        const ch = chambers[currentChamberId];
        const thought = ch?.thoughts.find(t => t.id === n.id);
        if (!thought) continue;
        label = thought.text.slice(0, 20) + (thought.text.length > 20 ? '...' : '');
        fill = thought.mood === 'happy' ? '#34d399' : thought.mood === 'sad' ? '#60a5fa' : thought.mood === 'angry' ? '#f87171' : '#a855f7';
        if (isHovered) {
          ctx.shadowColor = fill;
          ctx.shadowBlur = 15;
        }
      }

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = isHovered ? '#e9d5ff' : '#a78bfa';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, n.x, n.y + radius + 14);

      if (subtext) {
        ctx.fillStyle = '#d8b4fe';
        ctx.font = '8px monospace';
        ctx.fillText(subtext, n.x, n.y + 4);
      }
    }

    ctx.restore();
  }, [chambers, currentChamberId, offset, zoom, hovered]);

  useEffect(() => { draw(); }, [draw]);

  const tutorialNodeCount = Object.values(chambers).filter(isSigmaTutorialNode).length;

  const hitTest = useCallback((ex: number, ey: number): string | number | null => {
    const cvs = canvasRef.current;
    if (!cvs) return null;
    const rect = cvs.getBoundingClientRect();
    const mx = (ex - rect.left - rect.width / 2 - offset.x) / zoom;
    const my = (ey - rect.top - 80 - offset.y) / zoom;
    for (const n of nodes.current) {
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy < 400) return n.id;
    }
    return null;
  }, [offset, zoom]);

  return (
    <div
      className="fixed inset-0 flex flex-col font-mono"
      style={{ zIndex: UI_LAYER.constellationMap, background: 'rgba(10,4,20,0.95)', animation: 'citadelFadeIn 200ms ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-purple-400/60">
            {mode === 'thoughts' ? 'Mind Map' : mode === 'calendar' ? 'Chronos Eye' : 'Constellation Map'}
          </p>
          <p className="text-[8px] tracking-[0.2em] text-purple-300/30 mt-1">
            {mode === 'thoughts'
              ? `${chambers[currentChamberId]?.thoughts.length || 0} thoughts · semantic links · scroll to zoom · drag to pan`
              : mode === 'calendar'
                ? `${Object.keys(chambers).length} cells · year at center · day-to-day filaments · click to travel`
                : `${Object.keys(chambers).length} chambers · click to navigate · scroll to zoom · drag to pan`}
          </p>
          {mode === 'chambers' && tutorialNodeCount > 0 && (
            <p className="text-[8px] tracking-[0.18em] text-cyan-300/40 mt-1">Sigma archive nodes are highlighted so the tutorial branch doubles as a sample constellation.</p>
          )}
        </div>
        <button onClick={onClose} className="text-[10px] uppercase tracking-[0.2em] text-purple-300/50 hover:text-purple-200 px-3 py-1 border border-purple-400/15 rounded">
          ESC / CLOSE
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 cursor-grab"
        style={{ width: '100%', height: '100%' }}
        onMouseDown={e => { dragging.current = true; dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }; }}
        onMouseMove={e => {
          if (dragging.current) {
            setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
          } else {
            setHovered(hitTest(e.clientX, e.clientY));
          }
        }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; setHovered(null); }}
        onClick={e => {
          const id = hitTest(e.clientX, e.clientY);
          if (id !== null) { onNavigate(Number(id)); onClose(); }
        }}
        onWheel={e => {
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
        }}
      />
    </div>
  );
}
