/**
 * SYNAPTIC VAULT CHAMBER UI (ENDEL × APPLE STREAMLINED INTERFACE)
 *
 * Designed to match the Citadel's chamber aesthetic:
 * - Zero clinical clutter, zero bureaucratic boxes, zero monospace walls on the main stage.
 * - Uses explicit inline flexbox/padding styles so global CSS `* { padding: 0 }` resets
 *   never clip or cut off a single pill button border.
 * - Centerpiece "Sealed Cipher Astrolabe" canvas that delivers immediate kinetic visual
 *   gratification (synaptic shockwaves, harmonic ring surges, and orbital star-node ignition)
 *   on every single answer WITHOUT spoiling live psychometric results mid-run.
 * - Bottom floating Endel-style lens dock: Core · Circle · Motive · Strengths · Style · Codex
 * - Top-right "Tune Sigma" pill that opens a clean slide-over calibration & coaching drawer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IPIP_120_BANK, scoreIpipNeo120, FACET_NAMES, DOMAIN_NAMES } from './ipipScoring';
import {
  scoreIPC,
  scoreNinePattern,
  scoreStrengthPrism,
  scoreCognitiveStyle,
  IPC_DATA,
  NINE_PATTERN_DATA,
  STRENGTH_SIGNALS_DATA,
  COGNITIVE_STYLE_DATA,
} from './optionalModules';
import { generateSynthesis } from './synthesisEngine';
import {
  resolveUnlockedWorldSlot,
  useWorldLook,
} from '@/arboretum/components/citadel-rebuilt/looks/worldLook';
import type {
  CalibrationFieldManual,
  CoachingControls,
} from './calibrationTypes';

interface Props {
  onClose: () => void;
}

const STORAGE_KEY = 'citadel.calibration.manual.v0.2';
const RESPONSES_KEY = 'citadel.calibration.responses.v0.2';
const IPC_RESPONSES_KEY = 'citadel.calibration.ipcResponses.v0.2';
const NINE_RESPONSES_KEY = 'citadel.calibration.nineResponses.v0.2';
const GOVERNANCE_SEEN_KEY = 'citadel.calibration.governanceSeenV1';

type VaultLensId = 'core' | 'circle' | 'motive' | 'strengths' | 'style' | 'codex';
type CodexSubTab = 'overview' | 'domains' | 'circumplex' | 'annexes';

interface LensMeta {
  id: VaultLensId;
  shortName: string;
  subtitle: string;
  accentColor: string;
  icon: string;
}

const VAULT_LENSES: LensMeta[] = [
  { id: 'core', shortName: 'Core', subtitle: 'IPIP-NEO · 120', accentColor: '#a855f7', icon: '◈' },
  { id: 'circle', shortName: 'Circle', subtitle: 'Circumplex · 32', accentColor: '#22d3ee', icon: '◎' },
  { id: 'motive', shortName: 'Motive', subtitle: 'Nine-Pattern · 27', accentColor: '#f472b6', icon: '✧' },
  { id: 'strengths', shortName: 'Strengths', subtitle: 'Prism · Top 5', accentColor: '#fbbf24', icon: '△' },
  { id: 'style', shortName: 'Style', subtitle: 'Continua · 4 Axes', accentColor: '#34d399', icon: '≈' },
  { id: 'codex', shortName: 'Codex', subtitle: 'Field Manual', accentColor: '#c084fc', icon: '✦' },
];

const SCALE_OPTIONS = [
  { val: 1, short: 'Inaccurate', full: 'Very Inaccurate' },
  { val: 2, short: 'Mostly Not', full: 'Moderately Inaccurate' },
  { val: 3, short: 'Neutral', full: 'Neither' },
  { val: 4, short: 'Mostly So', full: 'Moderately Accurate' },
  { val: 5, short: 'Accurate', full: 'Very Accurate' },
];

interface SynapticPulse {
  bornAt: number;
  intensity: number; // 1..5
  color: string;
  angle: number;
}

export function SynapticCalibrationChamber({ onClose }: Props) {
  // Saved manual
  const [manual, setManual] = useState<CalibrationFieldManual | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Active lens in bottom dock
  const [activeLens, setActiveLens] = useState<VaultLensId>(() => (manual ? 'codex' : 'core'));
  const [codexTab, setCodexTab] = useState<CodexSubTab>('overview');

  // Slide-over drawer & governance modal state
  const [tuneDrawerOpen, setTuneDrawerOpen] = useState<boolean>(false);
  const [governanceSeen, setGovernanceSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GOVERNANCE_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showGovernanceModal, setShowGovernanceModal] = useState<boolean>(() => !governanceSeen && !manual);

  // Consent & scope
  const [consentScope, setConsentScope] = useState<'local' | 'session' | 'export'>(
    () => manual?.consent?.scope ?? 'local'
  );

  // 1. Core IPIP-120 responses
  const [coreResponses, setCoreResponses] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(RESPONSES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [coreIndex, setCoreIndex] = useState<number>(0);

  // 2. Circle (IPIP-IPC-32) responses
  const [ipcResponses, setIpcResponses] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(IPC_RESPONSES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [ipcIndex, setIpcIndex] = useState<number>(0);

  // 3. Motive (Nine-Pattern 27) responses
  const [nineResponses, setNineResponses] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(NINE_RESPONSES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [nineIndex, setNineIndex] = useState<number>(0);
  const [nineTieChoice, setNineTieChoice] = useState<number | undefined>();

  // 4. Strengths Prism (Top 5 + Underused target)
  const [strengthRatings, setStrengthRatings] = useState<Record<string, number>>({});
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>(() =>
    manual?.strengthPrism?.signatureStrengths?.map((s) => s.id) ?? []
  );
  const [underusedTarget, setUnderusedTarget] = useState<string>(
    () => manual?.strengthPrism?.underusedTarget ?? ''
  );

  // 5. Cognitive Style Continua
  const [cognitiveResponses, setCognitiveResponses] = useState<Record<string, number>>({
    'CS-E-01': 0,
    'CS-E-02': 0,
    'CS-P-01': 0,
    'CS-P-02': 0,
    'CS-D-01': 0,
    'CS-D-02': 0,
    'CS-R-01': 0,
    'CS-R-02': 0,
  });

  // Sigma Inscriptions & Coaching Controls
  const [inscriptions, setInscriptions] = useState<{ helpfulCriticism?: string; challengePattern?: string }>(
    () =>
      manual?.inscriptions ?? {
        helpfulCriticism: '',
        challengePattern: '',
      }
  );

  const [controls, setControls] = useState<CoachingControls>(
    () =>
      manual?.controls ?? {
        directness: 4,
        challenge: 'balanced',
        pace: 'one step',
        evidence: 'balanced',
      }
  );

  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const activeWorldLook = useWorldLook((s) => s.look);
  const setWorldLook = useWorldLook((s) => s.setLook);

  // Kinetic visual gratification pulses for the Cipher Astrolabe Canvas
  const astrolabeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pulsesRef = useRef<SynapticPulse[]>([]);

  const currentLensMeta = useMemo(
    () => VAULT_LENSES.find((l) => l.id === activeLens) ?? VAULT_LENSES[0],
    [activeLens]
  );

  const triggerSynapticPulse = useCallback((intensity: number, color: string, indexRatio: number) => {
    pulsesRef.current.push({
      bornAt: performance.now(),
      intensity,
      color,
      angle: indexRatio * Math.PI * 2 - Math.PI / 2,
    });
    if (pulsesRef.current.length > 16) {
      pulsesRef.current.shift();
    }
  }, []);

  // Lens progress metrics
  const coreAnsweredCount = Object.keys(coreResponses).length;
  const ipcAnsweredCount = Object.keys(ipcResponses).length;
  const nineAnsweredCount = Object.keys(nineResponses).length;
  const strengthsSelectedCount = selectedStrengths.length;

  const lensProgress = useMemo(() => {
    switch (activeLens) {
      case 'core':
        return { current: coreIndex + 1, answered: coreAnsweredCount, total: 120 };
      case 'circle':
        return { current: ipcIndex + 1, answered: ipcAnsweredCount, total: 32 };
      case 'motive':
        return { current: nineIndex + 1, answered: nineAnsweredCount, total: 27 };
      case 'strengths':
        return { current: strengthsSelectedCount, answered: strengthsSelectedCount, total: 5 };
      case 'style':
        return { current: 4, answered: 4, total: 4 };
      case 'codex':
        return { current: 100, answered: 100, total: 100 };
    }
  }, [
    activeLens,
    coreIndex,
    coreAnsweredCount,
    ipcIndex,
    ipcAnsweredCount,
    nineIndex,
    nineAnsweredCount,
    strengthsSelectedCount,
  ]);

  const progressPct =
    lensProgress.total > 0 ? Math.min(100, (lensProgress.answered / lensProgress.total) * 100) : 0;

  // Compile & Unveil Codex
  const compileAndUnveilCodex = useCallback(
    (overrideData?: {
      core?: Record<string, number>;
      ipc?: Record<string, number>;
      nine?: Record<string, number>;
      strengths?: string[];
      cog?: Record<string, number>;
    }) => {
      const cMap = overrideData?.core ?? coreResponses;
      const iMap = overrideData?.ipc ?? ipcResponses;
      const nMap = overrideData?.nine ?? nineResponses;
      const sList = overrideData?.strengths ?? selectedStrengths;
      const gMap = overrideData?.cog ?? cognitiveResponses;

      const ipip = scoreIpipNeo120(cMap);
      const ipc = scoreIPC(iMap);
      const nine = scoreNinePattern(nMap, nineTieChoice);
      const strengths = scoreStrengthPrism(strengthRatings, sList, underusedTarget);
      const cog = scoreCognitiveStyle(gMap);

      const generated = generateSynthesis({
        ipip,
        ipc,
        ninePattern: nine,
        strengthPrism: strengths,
        cognitiveStyle: cog,
        controls,
        inscriptions,
        consentScope,
      });

      setManual(generated);
      if (consentScope === 'local') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(generated));
        } catch {
          // ignore storage quota errors
        }
      }

      // Automatically unlock and apply the user's matched World Style Pack if its shader is live
      const matchedSlot = resolveUnlockedWorldSlot({
        energy: cog.axes.energy.preference,
        perception: cog.axes.perception.preference,
        decision: cog.axes.decision.preference,
        rhythm: cog.axes.rhythm.preference,
        oMean: ipip.domains.O?.mean,
        cMean: ipip.domains.C?.mean,
        eMean: ipip.domains.E?.mean,
        aMean: ipip.domains.A?.mean,
      });
      if (matchedSlot.lookId) {
        setWorldLook(matchedSlot.lookId);
      }

      triggerSynapticPulse(5, '#c084fc', 0);
      setActiveLens('codex');
    },
    [
      coreResponses,
      ipcResponses,
      nineResponses,
      nineTieChoice,
      strengthRatings,
      selectedStrengths,
      underusedTarget,
      cognitiveResponses,
      controls,
      inscriptions,
      consentScope,
      triggerSynapticPulse,
    ]
  );

  // Answer handlers for the 3 card-based instruments
  const handleCoreAnswer = useCallback(
    (val: number) => {
      const item = IPIP_120_BANK.items[coreIndex];
      if (!item) return;
      const next = { ...coreResponses, [item.id]: val };
      setCoreResponses(next);
      try {
        localStorage.setItem(RESPONSES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      triggerSynapticPulse(val, '#a855f7', coreIndex / 120);

      if (coreIndex < IPIP_120_BANK.items.length - 1) {
        setCoreIndex((prev) => prev + 1);
      } else {
        setActiveLens('circle');
      }
    },
    [coreIndex, coreResponses, triggerSynapticPulse]
  );

  const handleIpcAnswer = useCallback(
    (val: number) => {
      const item = IPC_DATA.items[ipcIndex];
      if (!item) return;
      const next = { ...ipcResponses, [item.id]: val };
      setIpcResponses(next);
      try {
        localStorage.setItem(IPC_RESPONSES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      triggerSynapticPulse(val, '#22d3ee', ipcIndex / 32);

      if (ipcIndex < IPC_DATA.items.length - 1) {
        setIpcIndex((prev) => prev + 1);
      } else {
        setActiveLens('motive');
      }
    },
    [ipcIndex, ipcResponses, triggerSynapticPulse]
  );

  const handleNineAnswer = useCallback(
    (val: number) => {
      const item = NINE_PATTERN_DATA.items[nineIndex];
      if (!item) return;
      const next = { ...nineResponses, [item.id]: val };
      setNineResponses(next);
      try {
        localStorage.setItem(NINE_RESPONSES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      triggerSynapticPulse(val, '#f472b6', nineIndex / 27);

      if (nineIndex < NINE_PATTERN_DATA.items.length - 1) {
        setNineIndex((prev) => prev + 1);
      } else {
        setActiveLens('strengths');
      }
    },
    [nineIndex, nineResponses, triggerSynapticPulse]
  );

  // Keyboard shortcuts (1..5, Left/Right arrows, ESC)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showGovernanceModal) {
          setShowGovernanceModal(false);
          return;
        }
        if (tuneDrawerOpen) {
          setTuneDrawerOpen(false);
          return;
        }
        onClose();
        return;
      }

      if (showGovernanceModal || tuneDrawerOpen) return;

      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const num = Number(e.key);
        if (activeLens === 'core') handleCoreAnswer(num);
        else if (activeLens === 'circle') handleIpcAnswer(num);
        else if (activeLens === 'motive') handleNineAnswer(num);
      } else if (e.key === 'ArrowLeft') {
        if (activeLens === 'core' && coreIndex > 0) setCoreIndex((i) => i - 1);
        else if (activeLens === 'circle' && ipcIndex > 0) setIpcIndex((i) => i - 1);
        else if (activeLens === 'motive' && nineIndex > 0) setNineIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight') {
        if (activeLens === 'core' && coreIndex < 119) setCoreIndex((i) => i + 1);
        else if (activeLens === 'circle' && ipcIndex < 31) setIpcIndex((i) => i + 1);
        else if (activeLens === 'motive' && nineIndex < 26) setNineIndex((i) => i + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeLens,
    coreIndex,
    ipcIndex,
    nineIndex,
    showGovernanceModal,
    tuneDrawerOpen,
    handleCoreAnswer,
    handleIpcAnswer,
    handleNineAnswer,
    onClose,
  ]);

  // Centerpiece Canvas: Sealed Cipher Astrolabe (during calibration) & Unveiled Constellation (in Codex)
  useEffect(() => {
    const canvas = astrolabeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animId: number;
    let lastDraw = 0;

    const draw = (ts: number) => {
      animId = requestAnimationFrame(draw);
      if (ts - lastDraw < 33) return;
      lastDraw = ts;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.4;
      const t = prefersReducedMotion ? 0 : ts * 0.001;
      const accent = currentLensMeta.accentColor;

      // Ambient radial glow
      const glow = ctx.createRadialGradient(cx, cy, maxR * 0.05, cx, cy, maxR * 1.18);
      glow.addColorStop(0, `${accent}33`);
      glow.addColorStop(0.55, `${accent}12`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 1.18, 0, Math.PI * 2);
      ctx.fill();

      // Active Synaptic Shockwave Pulses (immediate visual gratification on answer)
      const now = performance.now();
      pulsesRef.current = pulsesRef.current.filter((p) => now - p.bornAt < 1100);
      const latestPulseAge =
        pulsesRef.current.length > 0
          ? (now - pulsesRef.current[pulsesRef.current.length - 1].bornAt) / 1000
          : 999;
      const ringBoost = latestPulseAge < 0.6 ? Math.sin((1 - latestPulseAge / 0.6) * Math.PI) * 8 : 0;

      for (const pulse of pulsesRef.current) {
        const age = (now - pulse.bornAt) / 1100;
        const ease = 1 - Math.pow(1 - age, 3);
        const pulseR = maxR * (0.18 + ease * 0.92);
        const alpha = Math.max(0, (1 - age) * 0.65);

        ctx.strokeStyle = pulse.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5 + (pulse.intensity / 5) * 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        // Directional synaptic spark traveling to orbital rim
        const sparkR = maxR * (0.2 + ease * 0.75);
        const sx = cx + Math.cos(pulse.angle) * sparkR;
        const sy = cy + Math.sin(pulse.angle) * sparkR;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 3 * (1 - age * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Endel-style organic harmonic rings
      const numRings = 4;
      for (let ring = 0; ring < numRings; ring++) {
        const ratio = (ring + 1) / numRings;
        const baseR = maxR * (0.34 + ratio * 0.54);
        const speed = 0.55 + ring * 0.22;
        const wobbleAmp = (prefersReducedMotion ? 1.5 : 3.2 + ring * 1.8) + ringBoost * 0.45;

        ctx.strokeStyle =
          ring === numRings - 1
            ? `${accent}aa`
            : `rgba(255, 255, 255, ${0.08 + ring * 0.04})`;
        ctx.lineWidth = ring === numRings - 1 ? 1.6 : 1;

        ctx.beginPath();
        const steps = 84;
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const harmonic =
            Math.sin(angle * (3 + (ring % 2)) + t * speed + ring * 1.1) *
            Math.cos(angle * 2 - t * speed * 0.7);
          const r = baseR + harmonic * wobbleAmp;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      if (activeLens !== 'codex' || !manual) {
        // ── SEALED CIPHER MODE: Orbital Star Nodes + Veiled Sacred Geometry Core ──
        const nodeCount =
          activeLens === 'core'
            ? 24
            : activeLens === 'circle'
              ? 16
              : activeLens === 'motive'
                ? 9
                : activeLens === 'strengths'
                  ? 5
                  : 8;
        const litNodes = Math.round((progressPct / 100) * nodeCount);
        const orbitR = maxR * 0.96;

        for (let i = 0; i < nodeCount; i++) {
          const a = (i / nodeCount) * Math.PI * 2 - Math.PI / 2 + t * 0.06;
          const nx = cx + Math.cos(a) * orbitR;
          const ny = cy + Math.sin(a) * orbitR;
          const isLit = i < litNodes;

          if (isLit) {
            // Delicate synaptic filament to the sealed center
            ctx.strokeStyle = `${accent}30`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(nx, ny);
            ctx.stroke();
          }

          ctx.fillStyle = isLit ? '#ffffff' : 'rgba(255, 255, 255, 0.18)';
          ctx.beginPath();
          ctx.arc(nx, ny, isLit ? 2.6 : 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Rotating Sealed Cipher Polygon (hides true scores until Codex is unveiled)
        const sides = activeLens === 'circle' ? 8 : activeLens === 'motive' ? 9 : 5;
        const cipherR = maxR * 0.36 + ringBoost * 0.3;
        ctx.strokeStyle = `${accent}66`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let s = 0; s <= sides; s++) {
          const a = (s / sides) * Math.PI * 2 - Math.PI / 2 - t * 0.18;
          const px = cx + Math.cos(a) * cipherR;
          const py = cy + Math.sin(a) * cipherR;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        // ── UNVEILED CODEX CONSTELLATION: True 5-Factor Polygon + IPC Vector ──
        const domainOrder: Array<'O' | 'C' | 'E' | 'A' | 'N'> = ['O', 'C', 'E', 'A', 'N'];
        const domainLabels = ['O', 'C', 'E', 'A', 'N'];
        const polyPoints: Array<{ x: number; y: number; label: string; score: number }> = [];

        domainOrder.forEach((key, idx) => {
          const d = manual.ipip.domains[key];
          const norm = d ? Math.max(0.2, (d.mean - 1) / 4) : 0.5;
          const angle = (idx / 5) * Math.PI * 2 - Math.PI / 2;
          const r = maxR * (0.22 + norm * 0.68);
          polyPoints.push({
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r,
            label: domainLabels[idx],
            score: d ? d.mean : 3.0,
          });
        });

        // Axis spokes
        domainOrder.forEach((_, idx) => {
          const angle = (idx / 5) * Math.PI * 2 - Math.PI / 2;
          const ox = cx + Math.cos(angle) * (maxR * 0.92);
          const oy = cy + Math.sin(angle) * (maxR * 0.92);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(ox, oy);
          ctx.stroke();
        });

        // Filled 5-Factor Constellation Polygon
        ctx.fillStyle = 'rgba(168, 85, 247, 0.24)';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        polyPoints.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Vertex stars + subtle labels
        polyPoints.forEach((pt, idx) => {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fill();

          const angle = (idx / 5) * Math.PI * 2 - Math.PI / 2;
          const lx = cx + Math.cos(angle) * (maxR * 1.06);
          const ly = cy + Math.sin(angle) * (maxR * 1.06);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pt.label, lx, ly);
        });

        // If IPC Circumplex is present, render the cyan Interpersonal Compass Needle
        if (manual.ipc) {
          const rad = (manual.ipc.vectorAngle * Math.PI) / 180;
          const ampNorm = Math.min(1, manual.ipc.vectorAmplitude / 2.5);
          const vx = cx + Math.cos(rad) * (maxR * (0.25 + ampNorm * 0.6));
          const vy = cy - Math.sin(rad) * (maxR * (0.25 + ampNorm * 0.6));

          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.75;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(vx, vy);
          ctx.stroke();

          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(vx, vy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [activeLens, currentLensMeta.accentColor, manual, progressPct]);

  const handleAcknowledgeGovernance = () => {
    try {
      localStorage.setItem(GOVERNANCE_SEEN_KEY, '1');
    } catch {
      // ignore
    }
    setGovernanceSeen(true);
    setShowGovernanceModal(false);
  };

  const handleCycleConsentScope = () => {
    const order: Array<'local' | 'session' | 'export'> = ['local', 'session', 'export'];
    const next = order[(order.indexOf(consentScope) + 1) % order.length];
    setConsentScope(next);
  };

  const handleSimulateFullSignal = () => {
    const mockCore: Record<string, number> = {};
    IPIP_120_BANK.items.forEach((it, idx) => {
      mockCore[it.id] = idx % 3 === 0 ? 4 : idx % 2 === 0 ? 3 : 5;
    });

    const mockIpc: Record<string, number> = {};
    IPC_DATA.items.forEach((it, idx) => {
      mockIpc[it.id] = idx % 4 === 0 ? 5 : idx % 2 === 0 ? 4 : 3;
    });

    const mockNine: Record<string, number> = {};
    NINE_PATTERN_DATA.items.forEach((it, idx) => {
      mockNine[it.id] = it.type === 5 || it.type === 7 ? 5 : idx % 2 === 0 ? 3 : 2;
    });

    const mockStrengths = STRENGTH_SIGNALS_DATA.items.slice(0, 5).map((s) => s.id);
    const mockCog: Record<string, number> = {
      'CS-E-01': -1,
      'CS-E-02': -1,
      'CS-P-01': 2,
      'CS-P-02': 1,
      'CS-D-01': -1,
      'CS-D-02': -1,
      'CS-R-01': 1,
      'CS-R-02': 2,
    };

    setCoreResponses(mockCore);
    setIpcResponses(mockIpc);
    setNineResponses(mockNine);
    setSelectedStrengths(mockStrengths);
    setCognitiveResponses(mockCog);

    try {
      localStorage.setItem(RESPONSES_KEY, JSON.stringify(mockCore));
      localStorage.setItem(IPC_RESPONSES_KEY, JSON.stringify(mockIpc));
      localStorage.setItem(NINE_RESPONSES_KEY, JSON.stringify(mockNine));
    } catch {
      // ignore
    }

    compileAndUnveilCodex({
      core: mockCore,
      ipc: mockIpc,
      nine: mockNine,
      strengths: mockStrengths,
      cog: mockCog,
    });
  };

  const handleDeleteCalibration = () => {
    if (window.confirm('Clear all stored responses and reset your Synaptic Vault?')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(RESPONSES_KEY);
      localStorage.removeItem(IPC_RESPONSES_KEY);
      localStorage.removeItem(NINE_RESPONSES_KEY);
      setManual(null);
      setCoreResponses({});
      setIpcResponses({});
      setNineResponses({});
      setSelectedStrengths([]);
      setCoreIndex(0);
      setIpcIndex(0);
      setNineIndex(0);
      setTuneDrawerOpen(false);
      setActiveLens('core');
    }
  };

  const currentCoreItem = IPIP_120_BANK.items[coreIndex];
  const currentIpcItem = IPC_DATA.items[ipcIndex];
  const currentNineItem = NINE_PATTERN_DATA.items[nineIndex];

  const canUnveilCodex = coreAnsweredCount === 120 || !!manual;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 450,
        background: 'radial-gradient(circle at 50% 38%, #160a2c 0%, #05020a 78%)',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
        letterSpacing: 'normal',
        textShadow: 'none',
        WebkitFontSmoothing: 'antialiased',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '28px 40px',
        boxSizing: 'border-box',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* ── TOP BAR: Minimal, Zero Clutter, Generous Safe Margins ─────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          zIndex: 10,
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Privacy / Storage Scope Pill */}
          <button
            type="button"
            onClick={handleCycleConsentScope}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.82)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
            }}
            title="Click to cycle memory scope (Local Sanctuary · Session Only · Portable)"
          >
            <span>
              {consentScope === 'local' ? '🔒' : consentScope === 'session' ? '⚡' : '✧'}
            </span>
            <span>
              {consentScope === 'local'
                ? 'Local Sanctuary'
                : consentScope === 'session'
                  ? 'Session Only'
                  : 'Portable Codex'}
            </span>
          </button>

          {/* Subtle Governance / Calibration Note trigger */}
          <button
            type="button"
            onClick={() => setShowGovernanceModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title="View Calibration Governance & Method Note"
          >
            <span>Calibration, not diagnosis</span>
          </button>
        </div>

        {/* Top-Right Controls: Simulate Signal + Tune Sigma + Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSimulateFullSignal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              background: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.25)',
              color: '#fde68a',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Populate sample responses across all 5 instruments and unveil the Codex"
          >
            <span>✧ Demo Signal</span>
          </button>

          <button
            type="button"
            onClick={() => setTuneDrawerOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.88)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <span>Tune Sigma</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.75)',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Close Synaptic Vault (ESC)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── CENTERPIECE STAGE: Living Cipher Astrolabe + Weightless Lens View ─ */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          minHeight: 0,
          overflowY: 'auto',
          padding: '12px 0',
        }}
      >
        {/* 1. Card-Based Lenses: Core (120) · Circle (32) · Motive (27) */}
        {(activeLens === 'core' || activeLens === 'circle' || activeLens === 'motive') && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '680px',
              gap: '22px',
            }}
          >
            {/* Sealed Cipher Astrolabe Canvas */}
            <div
              style={{
                position: 'relative',
                width: '220px',
                height: '220px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <canvas
                ref={astrolabeCanvasRef}
                width={240}
                height={240}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 200,
                    letterSpacing: '0.04em',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {lensProgress.current}
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
                    /{lensProgress.total}
                  </span>
                </span>
                <span
                  style={{
                    marginTop: '8px',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: currentLensMeta.accentColor,
                  }}
                >
                  Signal Sealed
                </span>
              </div>
            </div>

            {/* Weightless Prompt Typography */}
            <div
              style={{
                textAlign: 'center',
                minHeight: '84px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 16px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.42)',
                  marginBottom: '12px',
                }}
              >
                {activeLens === 'core'
                  ? 'Foundational Trait Resonance'
                  : activeLens === 'circle'
                    ? 'Interpersonal Circumplex'
                    : 'Underlying Behavioral Motive'}
              </div>

              <div
                style={{
                  fontSize: 'clamp(20px, 3vw, 28px)',
                  fontWeight: 300,
                  lineHeight: 1.38,
                  color: '#ffffff',
                  maxWidth: '580px',
                }}
              >
                “
                {activeLens === 'core'
                  ? currentCoreItem?.text
                  : activeLens === 'circle'
                    ? currentIpcItem?.text
                    : currentNineItem?.text}
                ”
              </div>
            </div>

            {/* 5 Pill-Shaped Resonance Buttons */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '100%',
              }}
            >
              {SCALE_OPTIONS.map((opt) => {
                const currentItemId =
                  activeLens === 'core'
                    ? currentCoreItem?.id
                    : activeLens === 'circle'
                      ? currentIpcItem?.id
                      : currentNineItem?.id;
                const map =
                  activeLens === 'core'
                    ? coreResponses
                    : activeLens === 'circle'
                      ? ipcResponses
                      : nineResponses;
                const isSelected = currentItemId ? map[currentItemId] === opt.val : false;

                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      if (activeLens === 'core') handleCoreAnswer(opt.val);
                      else if (activeLens === 'circle') handleIpcAnswer(opt.val);
                      else handleNineAnswer(opt.val);
                    }}
                    style={{
                      minWidth: '114px',
                      padding: '12px 18px',
                      borderRadius: '9999px',
                      background: isSelected
                        ? `${currentLensMeta.accentColor}2e`
                        : 'rgba(255, 255, 255, 0.05)',
                      border: isSelected
                        ? `1px solid ${currentLensMeta.accentColor}`
                        : '1px solid rgba(255, 255, 255, 0.12)',
                      color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.78)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, opacity 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '15px', fontWeight: 600 }}>{opt.val}</span>
                    <span style={{ fontSize: '11px', opacity: 0.72 }}>{opt.short}</span>
                  </button>
                );
              })}
            </div>

            {/* Subtle Step Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.45)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (activeLens === 'core' && coreIndex > 0) setCoreIndex((i) => i - 1);
                  else if (activeLens === 'circle' && ipcIndex > 0) setIpcIndex((i) => i - 1);
                  else if (activeLens === 'motive' && nineIndex > 0) setNineIndex((i) => i - 1);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                ← Previous
              </button>
              <span>Keys 1–5</span>
              <button
                type="button"
                onClick={() => {
                  if (activeLens === 'core' && coreIndex < 119) setCoreIndex((i) => i + 1);
                  else if (activeLens === 'circle' && ipcIndex < 31) setIpcIndex((i) => i + 1);
                  else if (activeLens === 'motive' && nineIndex < 26) setNineIndex((i) => i + 1);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* 2. Strengths Prism Lens: Floating Glass Tokens */}
        {activeLens === 'strengths' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: '760px',
              gap: '20px',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#fbbf24',
                  marginBottom: '6px',
                }}
              >
                Signature Strength Prism · {selectedStrengths.length} of 5 Ignited
              </div>
              <div style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 300 }}>
                Ignite the five strengths that define you at your highest operational peak.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '10px',
                maxHeight: '340px',
                overflowY: 'auto',
                padding: '6px',
              }}
            >
              {STRENGTH_SIGNALS_DATA.items.map((item, idx) => {
                const isSelected = selectedStrengths.includes(item.id);
                const rank = selectedStrengths.indexOf(item.id) + 1;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedStrengths(selectedStrengths.filter((id) => id !== item.id));
                      } else if (selectedStrengths.length < 5) {
                        const next = [...selectedStrengths, item.id];
                        setSelectedStrengths(next);
                        triggerSynapticPulse(5, '#fbbf24', idx / 24);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 18px',
                      borderRadius: '9999px',
                      background: isSelected
                        ? 'rgba(251, 191, 36, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: isSelected
                        ? '1px solid #fbbf24'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                    }}
                    title={item.text}
                  >
                    <span>{item.strength}</span>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#fbbf24',
                          fontWeight: 700,
                        }}
                      >
                        #{rank}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedStrengths.length === 5 && (
              <button
                type="button"
                onClick={() => setActiveLens('style')}
                style={{
                  padding: '10px 24px',
                  borderRadius: '9999px',
                  background: '#fbbf24',
                  border: 'none',
                  color: '#000000',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Continue to Cognitive Style →
              </button>
            )}
          </div>
        )}

        {/* 3. Cognitive Style Continua + Unveil Codex Trigger */}
        {activeLens === 'style' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: '720px',
              gap: '16px',
              maxHeight: '100%',
              overflowY: 'auto',
              padding: '4px 12px',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#34d399',
                  marginBottom: '4px',
                }}
              >
                Cognitive Continua
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.68)', fontWeight: 300 }}>
                Balance your natural polarity across four continuous spectrums.
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                gap: '12px',
                width: '100%',
              }}
            >
              {COGNITIVE_STYLE_DATA.cards.map((card) => {
                const currentVal = cognitiveResponses[card.id] ?? 0;
                return (
                  <div
                    key={card.id}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '18px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.09)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.4 }}>
                      {card.text}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', width: '76px' }}>
                        {card.left}
                      </span>
                      <input
                        type="range"
                        min={-2}
                        max={2}
                        step={1}
                        value={currentVal}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setCognitiveResponses({ ...cognitiveResponses, [card.id]: v });
                        }}
                        style={{ flex: 1, accentColor: '#34d399', cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.5)',
                          width: '76px',
                          textAlign: 'right',
                        }}
                      >
                        {card.right}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => compileAndUnveilCodex()}
                style={{
                  padding: '12px 28px',
                  borderRadius: '9999px',
                  background: '#ffffff',
                  border: 'none',
                  color: '#000000',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Unveil Synaptic Codex ✦
              </button>
            </div>
          </div>
        )}

        {/* 4. CODEX VIEW (Unveiled Only When Calibration Is Complete) */}
        {activeLens === 'codex' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: '880px',
              gap: '20px',
              maxHeight: '100%',
              overflowY: 'auto',
              padding: '4px 12px',
            }}
          >
            {!manual ? (
              /* Sealed Gate when user clicks Codex before finishing */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '16px',
                  padding: '32px',
                  borderRadius: '28px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  maxWidth: '460px',
                }}
              >
                <div style={{ fontSize: '28px' }}>🔒</div>
                <div style={{ fontSize: '18px', fontWeight: 500 }}>Codex Remains Sealed</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                  To preserve pure, unspoiled self-observation without mid-run bias, your trait constellation remains veiled until your calibration is ready to compile.
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveLens('core')}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '9999px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Resume Calibration
                  </button>
                  <button
                    type="button"
                    onClick={() => compileAndUnveilCodex()}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '9999px',
                      background: '#ffffff',
                      border: 'none',
                      color: '#000000',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Unveil Current Signal
                  </button>
                </div>
              </div>
            ) : (
              /* Unveiled Codex Layout */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(240px, 280px) 1fr',
                  gap: '28px',
                  width: '100%',
                  alignItems: 'start',
                }}
              >
                {/* Left Column: Unveiled Constellation Canvas + Sub-navigation pills */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px',
                    borderRadius: '24px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ position: 'relative', width: '220px', height: '220px' }}>
                    <canvas
                      ref={astrolabeCanvasRef}
                      width={240}
                      height={240}
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                  </div>

                  {/* Codex Sub-Section Pills */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      width: '100%',
                    }}
                  >
                    {(
                      [
                        { id: 'overview', label: 'Portrait & Tensions' },
                        { id: 'domains', label: '5-Factor Architecture' },
                        { id: 'circumplex', label: 'Interpersonal Circle' },
                        { id: 'annexes', label: 'Motive & Strengths' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCodexTab(tab.id)}
                        style={{
                          padding: '9px 14px',
                          borderRadius: '9999px',
                          background:
                            codexTab === tab.id ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                          border:
                            codexTab === tab.id
                              ? '1px solid rgba(255, 255, 255, 0.28)'
                              : '1px solid transparent',
                          color: codexTab === tab.id ? '#ffffff' : 'rgba(255, 255, 255, 0.58)',
                          fontSize: '12px',
                          fontWeight: codexTab === tab.id ? 600 : 400,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Column: Clean Glassmorphic Codex Cards */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxHeight: '430px',
                    overflowY: 'auto',
                    paddingRight: '6px',
                  }}
                >
                  {codexTab === 'overview' && (
                    <>
                      {/* Unlocked Sanctuary World Style Pack Card */}
                      {(() => {
                        const slot = resolveUnlockedWorldSlot({
                          energy: manual.cognitiveStyle?.axes.energy.preference,
                          perception: manual.cognitiveStyle?.axes.perception.preference,
                          decision: manual.cognitiveStyle?.axes.decision.preference,
                          rhythm: manual.cognitiveStyle?.axes.rhythm.preference,
                          oMean: manual.ipip.domains.O?.mean,
                          cMean: manual.ipip.domains.C?.mean,
                          eMean: manual.ipip.domains.E?.mean,
                          aMean: manual.ipip.domains.A?.mean,
                        });
                        const isApplied = slot.lookId ? activeWorldLook === slot.lookId : false;
                        return (
                          <div
                            style={{
                              padding: '20px 24px',
                              borderRadius: '22px',
                              background:
                                'linear-gradient(135deg, rgba(168, 85, 247, 0.16) 0%, rgba(251, 191, 36, 0.10) 100%)',
                              border: '1px solid rgba(192, 132, 252, 0.35)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '16px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  letterSpacing: '0.18em',
                                  textTransform: 'uppercase',
                                  color: '#fbbf24',
                                }}
                              >
                                ✦ Unlocked Sanctuary Style Pack · Slot #{String(slot.slot).padStart(2, '0')} (Curvature R={slot.curvatureRadius})
                              </div>
                              <div style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                                {slot.title}{' '}
                                <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.65)' }}>
                                  — {slot.archetype}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>
                                {slot.subtitle} ({slot.cognitiveCode})
                              </div>
                            </div>
                            {slot.lookId ? (
                              <button
                                type="button"
                                onClick={() => setWorldLook(slot.lookId!)}
                                style={{
                                  padding: '10px 20px',
                                  borderRadius: '9999px',
                                  background: isApplied ? 'rgba(52, 211, 153, 0.2)' : '#ffffff',
                                  border: isApplied ? '1px solid #34d399' : 'none',
                                  color: isApplied ? '#6ee7b7' : '#000000',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {isApplied ? '✓ Active in Your World' : 'Apply Style Pack'}
                              </button>
                            ) : (
                              <span
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: '9999px',
                                  background: 'rgba(255,255,255,0.08)',
                                  border: '1px solid rgba(255,255,255,0.16)',
                                  color: 'rgba(255,255,255,0.7)',
                                  fontSize: '11px',
                                }}
                              >
                                Master Archetype Recorded
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* 5-Line Portrait Card */}
                      <div
                        style={{
                          padding: '20px 24px',
                          borderRadius: '22px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: '#c084fc',
                          }}
                        >
                          Synthesized Portrait
                        </div>
                        {manual.portrait.map((line, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '13px',
                              lineHeight: 1.55,
                              color: 'rgba(255, 255, 255, 0.88)',
                            }}
                          >
                            {line}
                          </div>
                        ))}
                      </div>

                      {/* Productive Tensions */}
                      {manual.tensions.map((t) => {
                        const isOpen = !!expandedWhy[t.id];
                        return (
                          <div
                            key={t.id}
                            style={{
                              padding: '18px 22px',
                              borderRadius: '22px',
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span style={{ fontSize: '14px', fontWeight: 600 }}>{t.name}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedWhy({ ...expandedWhy, [t.id]: !isOpen })
                                }
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '9999px',
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  border: 'none',
                                  color: 'rgba(255, 255, 255, 0.65)',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                              >
                                {isOpen ? 'Hide Source' : 'Evidence'}
                              </button>
                            </div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
                              <span style={{ color: '#67e8f9', fontWeight: 500 }}>Edge: </span>
                              {t.advantage}
                            </div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
                              <span style={{ color: '#f472b6', fontWeight: 500 }}>Drift: </span>
                              {t.failureMode}
                            </div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.88)', lineHeight: 1.5 }}>
                              <span style={{ color: '#fde68a', fontWeight: 500 }}>Practice: </span>
                              {t.experiment}
                            </div>
                            {isOpen && (
                              <div
                                style={{
                                  marginTop: '6px',
                                  padding: '10px 14px',
                                  borderRadius: '12px',
                                  background: 'rgba(0, 0, 0, 0.35)',
                                  fontSize: '11px',
                                  color: 'rgba(255, 255, 255, 0.6)',
                                }}
                              >
                                {t.evidenceSource}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {codexTab === 'domains' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(['O', 'C', 'E', 'A', 'N'] as const).map((domainKey) => {
                        const domainScore = manual.ipip.domains[domainKey];
                        const domainName = DOMAIN_NAMES[domainKey];
                        const isExpanded = expandedDomain === domainKey;

                        return (
                          <div
                            key={domainKey}
                            style={{
                              padding: '16px 20px',
                              borderRadius: '20px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.09)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            <div
                              onClick={() =>
                                setExpandedDomain(isExpanded ? null : domainKey)
                              }
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                {domainName}
                              </span>
                              <span style={{ fontSize: '13px', color: '#c084fc', fontWeight: 500 }}>
                                {domainScore ? `${domainScore.mean.toFixed(2)} / 5.0` : 'Unscored'}
                              </span>
                            </div>

                            {domainScore && (
                              <div
                                style={{
                                  width: '100%',
                                  height: '5px',
                                  borderRadius: '9999px',
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${domainScore.possibleRangePosition}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #a855f7, #22d3ee)',
                                    borderRadius: '9999px',
                                  }}
                                />
                              </div>
                            )}

                            {isExpanded && domainScore && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: '8px',
                                  paddingTop: '8px',
                                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                              >
                                {Object.entries(domainScore.facets).map(([fCode, fScore]) => (
                                  <div
                                    key={fCode}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontSize: '11px',
                                      color: 'rgba(255, 255, 255, 0.72)',
                                    }}
                                  >
                                    <span>{FACET_NAMES[fCode] || fCode}</span>
                                    <span style={{ color: '#ffffff', fontWeight: 500 }}>
                                      {fScore.mean.toFixed(1)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {codexTab === 'circumplex' && (
                    <div
                      style={{
                        padding: '20px 24px',
                        borderRadius: '22px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: '#22d3ee',
                          }}
                        >
                          Interpersonal Circumplex (IPIP-IPC-32)
                        </span>
                        {manual.ipc && (
                          <span style={{ fontSize: '12px', color: '#67e8f9', fontWeight: 500 }}>
                            Vector {Math.round(manual.ipc.vectorAngle)}° · Amp{' '}
                            {manual.ipc.vectorAmplitude.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {!manual.ipc ? (
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                          Complete all 32 items in the <strong>Circle</strong> lens to unlock your 8-octant interpersonal compass.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '10px',
                          }}
                        >
                          {Object.values(manual.ipc.octants)
                            .sort((a, b) => b.mean - a.mean)
                            .map((oct) => (
                              <div
                                key={oct.octant}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: '14px',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                  <span style={{ fontWeight: 500 }}>{oct.label}</span>
                                  <span style={{ color: '#22d3ee' }}>{oct.mean.toFixed(2)}</span>
                                </div>
                                <div
                                  style={{
                                    width: '100%',
                                    height: '4px',
                                    borderRadius: '9999px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${Math.max(0, Math.min(100, ((oct.mean - 1) / 4) * 100))}%`,
                                      height: '100%',
                                      background: '#22d3ee',
                                      borderRadius: '9999px',
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {codexTab === 'annexes' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Nine-Pattern Summary */}
                      <div
                        style={{
                          padding: '18px 22px',
                          borderRadius: '20px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.09)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: '#f472b6',
                          }}
                        >
                          Nine-Pattern Motive Architecture
                        </div>
                        {manual.ninePattern ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {manual.ninePattern.rankedTypes.slice(0, 3).map((rt, idx) => (
                              <span
                                key={rt.type}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '9999px',
                                  background:
                                    idx === 0
                                      ? 'rgba(244, 114, 182, 0.18)'
                                      : 'rgba(255, 255, 255, 0.05)',
                                  border:
                                    idx === 0
                                      ? '1px solid rgba(244, 114, 182, 0.5)'
                                      : '1px solid rgba(255, 255, 255, 0.1)',
                                  fontSize: '12px',
                                }}
                              >
                                Type {rt.type} · {rt.name} ({rt.mean.toFixed(1)})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                            Complete the Motive lens to reveal your primary motive pattern.
                          </div>
                        )}
                      </div>

                      {/* Signature Strengths */}
                      <div
                        style={{
                          padding: '18px 22px',
                          borderRadius: '20px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.09)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: '#fbbf24',
                          }}
                        >
                          Signature Strengths Prism
                        </div>
                        {manual.strengthPrism && manual.strengthPrism.signatureStrengths.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {manual.strengthPrism.signatureStrengths.map((s, idx) => (
                              <span
                                key={s.id}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '9999px',
                                  background: 'rgba(251, 191, 36, 0.14)',
                                  border: '1px solid rgba(251, 191, 36, 0.35)',
                                  fontSize: '12px',
                                  color: '#fde68a',
                                }}
                              >
                                #{idx + 1} {s.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                            Select 5 strengths in the Strengths lens.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM DOCK: Thin Scrubber Line + 6 Endel-Style Lens Pills ─────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          width: '100%',
          maxWidth: '760px',
          margin: '0 auto',
          zIndex: 10,
        }}
      >
        {/* Thin Progress Scrubber Bar */}
        <div
          onClick={(e) => {
            if (activeLens !== 'core' && activeLens !== 'circle' && activeLens !== 'motive') return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(0.999, (e.clientX - rect.left) / rect.width));
            if (activeLens === 'core') setCoreIndex(Math.floor(ratio * 120));
            else if (activeLens === 'circle') setIpcIndex(Math.floor(ratio * 32));
            else if (activeLens === 'motive') setNineIndex(Math.floor(ratio * 27));
          }}
          style={{
            width: '100%',
            maxWidth: '420px',
            height: '4px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.1)',
            cursor:
              activeLens === 'core' || activeLens === 'circle' || activeLens === 'motive'
                ? 'pointer'
                : 'default',
            overflow: 'hidden',
          }}
          title="Progress across active lens"
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: currentLensMeta.accentColor,
              borderRadius: '9999px',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* 6 Endel-Style Mode Pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '6px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {VAULT_LENSES.map((lens) => {
            const isSelected = lens.id === activeLens;
            const isCodexLocked = lens.id === 'codex' && !canUnveilCodex;
            return (
              <button
                key={lens.id}
                type="button"
                onClick={() => setActiveLens(lens.id)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '9999px',
                  border: isSelected
                    ? `1px solid ${lens.accentColor}88`
                    : '1px solid transparent',
                  background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
                  fontSize: '13px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
              >
                <span>{lens.shortName}</span>
                {isCodexLocked && <span style={{ fontSize: '10px', opacity: 0.6 }}>🔒</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SLIDE-OVER "TUNE SIGMA" DRAWER ─ */}
      {tuneDrawerOpen && (
        <div
          onClick={() => setTuneDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '390px',
              maxWidth: '92vw',
              height: '100%',
              background: '#0f081d',
              borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '28px 24px',
              boxSizing: 'border-box',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '24px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Drawer Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '14px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 600 }}>Sigma Coaching Contract</span>
                <button
                  type="button"
                  onClick={() => {
                    if (manual) compileAndUnveilCodex();
                    setTuneDrawerOpen(false);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </div>

              {/* Directness Slider */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>Directness</span>
                  <span style={{ color: '#c084fc', fontWeight: 500 }}>
                    {controls.directness === 5
                      ? 'Blunt'
                      : controls.directness >= 4
                        ? 'Direct'
                        : controls.directness === 3
                          ? 'Balanced'
                          : 'Gentle'}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={controls.directness}
                  onChange={(e) =>
                    setControls({ ...controls, directness: Number(e.target.value) })
                  }
                  style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
                />
              </div>

              {/* Challenge Posture Pill Selector */}
              <div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                  Challenge Posture
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {(['affirm', 'balanced', 'confront'] as const).map((posture) => (
                    <button
                      key={posture}
                      type="button"
                      onClick={() => setControls({ ...controls, challenge: posture })}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '9999px',
                        background:
                          controls.challenge === posture
                            ? 'rgba(168, 85, 247, 0.25)'
                            : 'rgba(255, 255, 255, 0.05)',
                        border:
                          controls.challenge === posture
                            ? '1px solid #a855f7'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontSize: '12px',
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                      }}
                    >
                      {posture}
                    </button>
                  ))}
                </div>
              </div>

              {/* Execution Pace Pill Selector */}
              <div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                  Execution Pace
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {(['one step', 'steady', 'rapid stack'] as const).map((paceOpt) => (
                    <button
                      key={paceOpt}
                      type="button"
                      onClick={() => setControls({ ...controls, pace: paceOpt })}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '9999px',
                        background:
                          controls.pace === paceOpt
                            ? 'rgba(34, 211, 238, 0.22)'
                            : 'rgba(255, 255, 255, 0.05)',
                        border:
                          controls.pace === paceOpt
                            ? '1px solid #22d3ee'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontSize: '11px',
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                      }}
                    >
                      {paceOpt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unscored Cognitive Contract Inscriptions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.72)',
                      marginBottom: '6px',
                    }}
                  >
                    When criticism helps you, what does it sound like?
                  </label>
                  <textarea
                    rows={3}
                    value={inscriptions.helpfulCriticism}
                    onChange={(e) =>
                      setInscriptions({ ...inscriptions, helpfulCriticism: e.target.value })
                    }
                    placeholder="Direct architectural critique focused on bottlenecks..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      resize: 'none',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.72)',
                      marginBottom: '6px',
                    }}
                  >
                    What pattern should Sigma challenge rather than accommodate?
                  </label>
                  <textarea
                    rows={3}
                    value={inscriptions.challengePattern}
                    onChange={(e) =>
                      setInscriptions({ ...inscriptions, challengePattern: e.target.value })
                    }
                    placeholder="Over-polishing secondary scaffolding before shipping..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '14px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '12px',
              }}
            >
              <button
                type="button"
                onClick={handleDeleteCalibration}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Reset Vault
              </button>
              <button
                type="button"
                onClick={() => {
                  setTuneDrawerOpen(false);
                  compileAndUnveilCodex();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#c084fc',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Compile Codex →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GOVERNANCE NOTE MODAL (Clean Endel-Style Sheet) ───────────────── */}
      {showGovernanceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 550,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#120a24',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '24px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Calibration Note</div>
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.74)' }}>
              The Synaptic Vault uses peer-reviewed, public-domain psychometric instruments (IPIP-NEO-120 &amp; IPIP-IPC-32) alongside clearly labeled reflective annexes. Your live scores stay sealed while you answer so you can respond intuitively without self-correcting. This is self-report calibration for Sigma, not a clinical diagnosis.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleAcknowledgeGovernance}
                style={{
                  padding: '8px 22px',
                  borderRadius: '9999px',
                  background: '#ffffff',
                  border: 'none',
                  color: '#000000',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Enter Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
