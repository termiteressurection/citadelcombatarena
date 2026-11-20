import type {
  CalibrationFieldManual,
  CoachingControls,
  CognitiveStyleResult,
  IPCResult,
  IPIPNeoResult,
  NinePatternResult,
  ProductiveTension,
  StrengthPrismResult,
} from './calibrationTypes';

export function generateSynthesis(params: {
  ipip: IPIPNeoResult;
  ipc?: IPCResult | null;
  ninePattern?: NinePatternResult | null;
  strengthPrism?: StrengthPrismResult | null;
  cognitiveStyle?: CognitiveStyleResult | null;
  controls: CoachingControls;
  inscriptions: { helpfulCriticism?: string; challengePattern?: string };
  consentScope: 'session' | 'local' | 'export';
}): CalibrationFieldManual {
  const { ipip, ipc, ninePattern, strengthPrism, cognitiveStyle, controls, inscriptions, consentScope } = params;

  // Pass 1: Anchors & 5-Line Portrait
  const oMean = ipip.domains.O?.mean ?? 3;
  const cMean = ipip.domains.C?.mean ?? 3;
  const eMean = ipip.domains.E?.mean ?? 3;
  const aMean = ipip.domains.A?.mean ?? 3;
  const nMean = ipip.domains.N?.mean ?? 3;

  // Determine dominant IPC octant if IPC is scored
  const topIpcOctant = ipc
    ? Object.values(ipc.octants).sort((a, b) => b.mean - a.mean)[0]
    : undefined;

  const portrait: string[] = [
    `Cognitive orientation: ${
      cognitiveStyle?.axes.perception.preference === 'pattern'
        ? 'High tendency toward pattern discovery and conceptual synthesis.'
        : 'Grounded in tangible realities and concrete structure.'
    }`,
    `Execution cadence: ${
      cMean >= 3.5
        ? 'Disciplined, systematic forward momentum with high internal standards.'
        : 'Fluid, exploratory approach that thrives on flexibility over rigid checklists.'
    }`,
    `Interpersonal boundary: ${
      topIpcOctant
        ? `Circumplex vector anchors in ${topIpcOctant.label} (${topIpcOctant.octant}, ${Math.round(ipc!.vectorAngle)}°).`
        : eMean >= 3.5
          ? 'Generates friction and energy in collaborative dialogue.'
          : 'Processes decisions through internal reflection and deep solitary focus.'
    }`,
    `Motive anchor: ${
      ninePattern
        ? `Primary motive leans ${ninePattern.rankedTypes[0]?.name || 'Reflective'} (${ninePattern.leadStatus} lead).`
        : 'Calibrated to primary self-report anchors.'
    }`,
    `Strategic signature: User-endorsed core strengths lead with ${
      strengthPrism?.signatureStrengths.slice(0, 2).map((s) => s.name).join(' and ') || 'balanced capacity'
    }.`,
  ];

  // Pass 3: Tensions
  const tensions: ProductiveTension[] = [];

  // Tension 1: Exploration vs Completion
  if (oMean >= 3.4 || cognitiveStyle?.axes.rhythm.preference === 'adaptive' || ninePattern?.leadType === 7) {
    tensions.push({
      id: 'tension-exp-comp',
      name: 'Exploration vs Completion',
      advantage: 'Rapid generation of novel possibilities, unexpected angles, and creative architectures.',
      failureMode: 'Lingering in open-ended ideation to avoid the irreversible cost of closing options.',
      earlyWarning: 'Beginning three new branches before merging or completing the active working draft.',
      experiment: 'Institute a strict 20-minute expansion window followed immediately by one irreversible execution step.',
      evidenceSource: `High Openness (mean: ${oMean.toFixed(1)}) and ${cognitiveStyle?.axes.rhythm.label || 'adaptive rhythm'}.`,
    });
  }

  // Tension 2: Standards vs Flexibility
  if (cMean >= 3.4 || ninePattern?.leadType === 1 || cognitiveStyle?.axes.decision.preference === 'principle') {
    tensions.push({
      id: 'tension-std-flex',
      name: 'Standards vs Flexibility',
      advantage: 'Immense architectural rigor, high craft standards, and intolerance for silent bugs.',
      failureMode: 'Treating minor stylistic inconsistencies with the same urgency as systemic flaws.',
      earlyWarning: 'Refactoring supporting scaffolding repeatedly while the primary core sits blocked.',
      experiment: 'Identify the minimum viable threshold for non-critical components and ship them unpolished.',
      evidenceSource: `High Conscientiousness (mean: ${cMean.toFixed(1)}) and Principle-first evaluation.`,
    });
  }

  // Tension 3: Connection vs Autonomy
  if (eMean <= 2.8 || cognitiveStyle?.axes.energy.preference === 'inward' || ninePattern?.leadType === 5) {
    tensions.push({
      id: 'tension-conn-auto',
      name: 'Connection vs Autonomy',
      advantage: 'Deep sustained focus, minimal susceptibility to groupthink, and autonomous execution.',
      failureMode: 'Withholding work-in-progress until fully refined, missing early critical course-corrections.',
      earlyWarning: 'Going dark on collaborative channels during an unsolved conceptual roadblock.',
      experiment: 'Transmit a rough 2-sentence signal or partial snapshot before it feels ready.',
      evidenceSource: `Inward energy posture (E mean: ${eMean.toFixed(1)}) and autonomous working style.`,
    });
  }

  // Tension 4: Pressure vs Recovery
  if (nMean >= 3.0 || cognitiveStyle?.axes.rhythm.preference === 'adaptive') {
    tensions.push({
      id: 'tension-press-rec',
      name: 'Pressure vs Recovery',
      advantage: 'Acute sensitivity to impending risks, deadlines, and systemic breakdowns.',
      failureMode: 'Maintaining cognitive redline past the point of diminishing creative returns.',
      earlyWarning: 'Tightening physical tension and loss of patience with mundane logistical tasks.',
      experiment: 'Schedule a mandatory 15-minute complete disconnect after high-stakes deliveries.',
      evidenceSource: `Emotional reactivity index (N mean: ${nMean.toFixed(1)}).`,
    });
  }

  // Guarantee at least 2 tensions
  if (tensions.length < 2) {
    tensions.push({
      id: 'tension-cadence',
      name: 'Intent vs Momentum',
      advantage: 'High deliberate intentionality before initiating major maneuvers.',
      failureMode: 'Over-analyzing optimal paths before gathering empirical field data.',
      earlyWarning: 'Spending more time designing the tracker than executing the task.',
      experiment: 'Run one chaotic, unstructured 10-minute sprint with zero planning.',
      evidenceSource: 'Default calibration baseline.',
    });
  }

  return {
    portrait,
    controls,
    ipip,
    ipc: ipc || undefined,
    ninePattern: ninePattern || undefined,
    strengthPrism: strengthPrism || undefined,
    cognitiveStyle: cognitiveStyle || undefined,
    tensions,
    inscriptions,
    consent: {
      scope: consentScope,
      timestamp: new Date().toISOString(),
    },
  };
}
