type OracleScene = 'world' | 'gladiator3d';

const SIGMA_LINES = [
  'Sigma hums: every thought can become a star.',
  'Sigma records: tiny courage compounds into myth.',
  'Sigma whispers: breathe once, and the grid softens.',
];

const LEGION_LINES = [
  'Legion echoes: you are never building alone.',
  'Legion chants: one step forward rewrites the maze.',
  'Legion vows: joy shared is power multiplied.',
];

const TERMITE_LINES = [
  'Termite grins: make it weird, then make it beautiful.',
  'Termite nods: play first, polish second, love always.',
  'Termite says: your future self is cheering right now.',
];

const SCENE_BLESSINGS: Record<OracleScene, string[]> = {
  world: [
    'The lodge remembers every small victory.',
    'Leave one kind trace for your future self.',
  ],
  gladiator3d: [
    'Arena vow: precision with mercy, power with grace.',
    'Fight clean, shine brighter.',
  ],
};

export function getWhimsyLine(scene: string, seed: number): string {
  const oracle: OracleScene = (scene as OracleScene) || 'world';
  const pools = [...SIGMA_LINES, ...LEGION_LINES, ...TERMITE_LINES, ...(SCENE_BLESSINGS[oracle] || SCENE_BLESSINGS.world)];
  return pools[Math.abs(seed) % pools.length];
}
