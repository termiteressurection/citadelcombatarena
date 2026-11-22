import type { StyleId } from '../arena/styles';
import type { CapitalId } from '../world/universe';

export type StoryChoiceVerb = 'HELP' | 'EXTORT' | 'EXPOSE' | 'DUEL';

export interface StoryChoice {
  verb: StoryChoiceVerb;
  label: string;
  outcomeText: string;
  cyclesDelta: number;
  repDelta: number;
  signalDelta: number;
  xpDelta: number;
  bountyDelta?: number;
  unlockCompanionId?: string;
  unlockWeaponId?: string;
  spawnsDuel?: { name: string; style: StyleId; color: string; rewardCycles: number };
}

export interface RegionalStoryStage {
  promptTitle: string;
  promptDesc: string;
  speaker: string;
  x: number;
  z: number;
  choices: StoryChoice[];
}

export interface RegionalStory {
  id: string;
  biomeTitle: string;
  settlementId: CapitalId;
  title: string;
  npcName: string;
  color: string;
  stages: RegionalStoryStage[];
}

export interface StoryProgressState {
  storyId: string;
  stageIndex: number;
  completed: boolean;
  lastVerb?: StoryChoiceVerb;
  fallout: string;
}

export interface CompanionDef {
  id: string;
  name: string;
  title: string;
  style: StyleId;
  color: string;
  cycleColor: string;
  reqStory?: string;
}

export const COMPANIONS: CompanionDef[] = [
  {
    id: 'ares_wing',
    name: 'ARES_PROC.EXE',
    title: 'Purge Grid Spear Wingman',
    style: 'hoplomachus',
    color: '#3ff0ff',
    cycleColor: '#3ff0ff',
  },
  {
    id: 'zip_wing',
    name: 'OLD_ZIP.ARCHIVE',
    title: 'Liberated Courier Rider',
    style: 'murmillo',
    color: '#4dffa0',
    cycleColor: '#4dffa0',
    reqStory: 'story_cache_zip',
  },
  {
    id: 'sica_wing',
    name: 'PATCH_WEAVER.PY',
    title: 'Zero-Day Glitch Duelist',
    style: 'dimachaerus',
    color: '#ffc95c',
    cycleColor: '#ffc95c',
    reqStory: 'story_drift_source',
  },
  {
    id: 'hexa_wing',
    name: 'HEXA_BLADE.EXE',
    title: 'Rust Citadel Enforcer',
    style: 'executioner',
    color: '#ff4fd8',
    cycleColor: '#ff4fd8',
    reqStory: 'story_rust_warlords',
  },
];

export const REGIONAL_STORIES: RegionalStory[] = [
  {
    id: 'story_cache_zip',
    biomeTitle: 'CACHE CITY (/DEV/NULL)',
    settlementId: 'cache_city',
    title: 'THE QUARANTINE ARCHIVE',
    npcName: 'old_zip.archive',
    color: '#3ff0ff',
    stages: [
      {
        promptTitle: 'SPRING OLD_ZIP OR TURN HIM IN?',
        promptDesc: 'SysWatch marked old_zip.archive for deletion. He begs you to spoof his checksum outside the Quarantine Cell—while a SysWatch broker quietly bids for his address.',
        speaker: 'old_zip.archive',
        x: 11,
        z: 26,
        choices: [
          {
            verb: 'HELP',
            label: 'SPLICING BACKDOOR (HELP)',
            outcomeText: 'You forged a clean header! old_zip.archive slips SysWatch and rallies at the Quarantine perimeter.',
            cyclesDelta: 45, repDelta: 12, signalDelta: 20, xpDelta: 65,
          },
          {
            verb: 'EXTORT',
            label: 'TAX HIS CACHE (EXTORT)',
            outcomeText: 'You squeezed old_zip.archive for 180 Cycles in exchange for five minutes of silence.',
            cyclesDelta: 180, repDelta: -14, signalDelta: 10, xpDelta: 45, bountyDelta: 15,
          },
          {
            verb: 'EXPOSE',
            label: 'REPORT TO SYSWATCH (EXPOSE)',
            outcomeText: 'SysWatch pays a sharp informant fee, though Cache citizens whisper against your name.',
            cyclesDelta: 150, repDelta: -18, signalDelta: 25, xpDelta: 55,
          },
          {
            verb: 'DUEL',
            label: 'TEST HIS WORTH IN STEEL (DUEL)',
            outcomeText: 'old_zip.archive draws a hidden hard-light blade outside the Plaza—win to claim respect!',
            cyclesDelta: 65, repDelta: 4, signalDelta: 30, xpDelta: 75,
            spawnsDuel: { name: 'warden_proxy.sec', style: 'murmillo', color: '#ff4f6d', rewardCycles: 95 },
          },
        ],
      },
      {
        promptTitle: 'QUARANTINE BREAKOUT FINALE',
        promptDesc: 'The Warden locked old_zip.archive inside the Under-Conduit block. Decide how his sector history closes.',
        speaker: 'old_zip.archive',
        x: -28,
        z: -22,
        choices: [
          {
            verb: 'HELP',
            label: 'FREE & RECRUIT AS WINGMAN (HELP)',
            outcomeText: 'old_zip.archive rides free—and swears to flank you on a neon Light-Cycle across the continent!',
            cyclesDelta: 210, repDelta: 18, signalDelta: 45, xpDelta: 130, unlockCompanionId: 'zip_wing',
          },
          {
            verb: 'EXTORT',
            label: 'SELL HIS ARCHIVE KEY (EXTORT)',
            outcomeText: 'You drained his encrypted vault for 380 Cycles before leaving him locked in quarantine.',
            cyclesDelta: 380, repDelta: -22, signalDelta: 20, xpDelta: 90,
          },
          {
            verb: 'EXPOSE',
            label: 'PURGE THE EVIDENCE (EXPOSE)',
            outcomeText: 'SysWatch closes the docket cleanly and awards a civic commendation bonus.',
            cyclesDelta: 240, repDelta: -10, signalDelta: 40, xpDelta: 110,
          },
          {
            verb: 'DUEL',
            label: 'DUEL THE WARDEN CHAMPION (DUEL)',
            outcomeText: 'You smash the lock and throw down the Warden right outside Quarantine!',
            cyclesDelta: 260, repDelta: 10, signalDelta: 60, xpDelta: 145, unlockCompanionId: 'zip_wing',
            spawnsDuel: { name: 'warden_exec.sec', style: 'executioner', color: '#ff3b5c', rewardCycles: 160 },
          },
        ],
      },
    ],
  },
  {
    id: 'story_drift_source',
    biomeTitle: 'THE DRIFT BAZAARS (/TEMP)',
    settlementId: 'drift_bazaars',
    title: 'STOLEN KERNEL SOURCE',
    npcName: 'patch_weaver.py',
    color: '#ffc95c',
    stages: [
      {
        promptTitle: 'BLACK-MARKET SOURCE LEAK',
        promptDesc: 'Hackers lifted patch_weaver.py’s experimental compiler source. Track the broker or cut yourself into the auction.',
        speaker: 'patch_weaver.py',
        x: 170,
        z: 932,
        choices: [
          {
            verb: 'HELP',
            label: 'TRACE THE LEAK (HELP)',
            outcomeText: 'You traced the stolen repo packets straight to the upper bazaar scaffold.',
            cyclesDelta: 75, repDelta: 10, signalDelta: 25, xpDelta: 75,
          },
          {
            verb: 'EXTORT',
            label: 'AUCTION ACCESS KEYS (EXTORT)',
            outcomeText: 'Scavengers bid 240 Cycles for a midnight glimpse of the stolen source.',
            cyclesDelta: 240, repDelta: -14, signalDelta: 15, xpDelta: 55,
          },
          {
            verb: 'EXPOSE',
            label: 'BROADCAST TO ALL CLANS (EXPOSE)',
            outcomeText: 'Everyone now owns the source—chaos erupts across /TEMP markets.',
            cyclesDelta: 140, repDelta: -4, signalDelta: 35, xpDelta: 80,
          },
          {
            verb: 'DUEL',
            label: 'AMBUSH THE BROKER (DUEL)',
            outcomeText: 'A masked scrap-broker drops from the catwalk with Twin Glitch-Sicas drawn!',
            cyclesDelta: 110, repDelta: 6, signalDelta: 35, xpDelta: 90,
            spawnsDuel: { name: 'leak_syndicate.bin', style: 'dimachaerus', color: '#ff8a3d', rewardCycles: 130 },
          },
        ],
      },
      {
        promptTitle: 'THE DRIFT PROTOCOL SHOWDOWN',
        promptDesc: 'The stolen compiler drive sits humming at the eastern Bazaar dock. Seal its fate.',
        speaker: 'patch_weaver.py',
        x: 204,
        z: 906,
        choices: [
          {
            verb: 'HELP',
            label: 'RETURN SOURCE & RECRUIT (HELP)',
            outcomeText: 'patch_weaver.py reclaims their life’s code and joins your Light-Cycle squad!',
            cyclesDelta: 260, repDelta: 18, signalDelta: 50, xpDelta: 140, unlockCompanionId: 'sica_wing',
          },
          {
            verb: 'EXTORT',
            label: 'MONOPOLIZE THE PATCHES (EXTORT)',
            outcomeText: 'You lock the Drift Bazaars into a private toll for 440 Cycles.',
            cyclesDelta: 440, repDelta: -22, signalDelta: 25, xpDelta: 100,
          },
          {
            verb: 'EXPOSE',
            label: 'OPEN-SOURCE THE BAZAAR (EXPOSE)',
            outcomeText: 'Every stray file in /TEMP builds free blades overnight.',
            cyclesDelta: 200, repDelta: 14, signalDelta: 55, xpDelta: 125,
          },
          {
            verb: 'DUEL',
            label: 'TRIAL BY SCRAP-STEEL (DUEL)',
            outcomeText: 'You defeat the syndicate ring-leader on the docks and claim crimson steel!',
            cyclesDelta: 300, repDelta: 8, signalDelta: 65, xpDelta: 155, unlockCompanionId: 'sica_wing', unlockWeaponId: 'crimson_sica',
            spawnsDuel: { name: 'syndicate_prime.py', style: 'dimachaerus', color: '#ffc95c', rewardCycles: 185 },
          },
        ],
      },
    ],
  },
  {
    id: 'story_vault_wedding',
    biomeTitle: 'THE COLD VAULTS (/ARCHIVE)',
    settlementId: 'cold_vaults',
    title: 'THE CORRUPTED VOWS',
    npcName: 'vow_frame_09.mov',
    color: '#a78bfa',
    stages: [
      {
        promptTitle: 'MISSING MEMORY REEL',
        promptDesc: 'Half of a deleted wedding video shrine is freezing out under /ARCHIVE garbage collection. Stitch it back or sell the raw frames.',
        speaker: 'vow_frame_09.mov',
        x: -1028,
        z: -504,
        choices: [
          {
            verb: 'HELP',
            label: 'ALIGN AUDIO TRACKS (HELP)',
            outcomeText: 'A faint laugh plays clearly through the frost crystal—one frame remains missing.',
            cyclesDelta: 90, repDelta: 14, signalDelta: 30, xpDelta: 85,
          },
          {
            verb: 'EXTORT',
            label: 'DEMAND ARCHIVE TOLL (EXTORT)',
            outcomeText: 'You charge the grieving save-files 260 Cycles for vault bandwidth.',
            cyclesDelta: 260, repDelta: -16, signalDelta: 15, xpDelta: 60,
          },
          {
            verb: 'EXPOSE',
            label: 'FLAG UNSAFE MEMORY (EXPOSE)',
            outcomeText: 'Vault keepers seal the corrupted sector and hand over an audit payout.',
            cyclesDelta: 190, repDelta: -10, signalDelta: 35, xpDelta: 80,
          },
          {
            verb: 'DUEL',
            label: 'CHALLENGE THE REEL THIEF (DUEL)',
            outcomeText: 'A frozen glitch sentinel steps out of the cathedral pillars!',
            cyclesDelta: 125, repDelta: 8, signalDelta: 40, xpDelta: 100,
            spawnsDuel: { name: 'frost_reaper.sav', style: 'retiarius', color: '#a78bfa', rewardCycles: 140 },
          },
        ],
      },
      {
        promptTitle: 'FINAL VOW RESTORATION',
        promptDesc: 'The garbage-collection timer reads 00:09. Choose what survives inside the Cold Vaults.',
        speaker: 'vow_frame_09.mov',
        x: -1058,
        z: -536,
        choices: [
          {
            verb: 'HELP',
            label: 'SEAL THE WEDDING SHRINE (HELP)',
            outcomeText: 'Both halves lock together forever—the cathedral chimes with warm indigo light and awards a Surge Trident!',
            cyclesDelta: 320, repDelta: 22, signalDelta: 60, xpDelta: 155, unlockWeaponId: 'hunter_trident',
          },
          {
            verb: 'EXTORT',
            label: 'STRIP GOLDEN HEADERS (EXTORT)',
            outcomeText: 'You harvest 500 Cycles of gold metadata while the crystal dims.',
            cyclesDelta: 500, repDelta: -24, signalDelta: 25, xpDelta: 110,
          },
          {
            verb: 'EXPOSE',
            label: 'PUBLISH RAW TRANSCRIPT (EXPOSE)',
            outcomeText: 'Every orphan in /ARCHIVE hears the forgotten vow echoing across the snow.',
            cyclesDelta: 250, repDelta: 6, signalDelta: 55, xpDelta: 135,
          },
          {
            verb: 'DUEL',
            label: 'SHATTER THE COLLECTOR DRONE (DUEL)',
            outcomeText: 'You slice the purge drone cleanly in two and lock the shrine!',
            cyclesDelta: 340, repDelta: 12, signalDelta: 70, xpDelta: 170,
            spawnsDuel: { name: 'gc_sweeper_04.sys', style: 'hoplomachus', color: '#e9e6ff', rewardCycles: 200 },
          },
        ],
      },
    ],
  },
  {
    id: 'story_rust_warlords',
    biomeTitle: 'THE RUST CITADEL (/OVERFLOW)',
    settlementId: 'rust_citadel',
    title: 'CROWN OF THE HEAP',
    npcName: 'hexa_blade.exe',
    color: '#ff3b5c',
    stages: [
      {
        promptTitle: 'WARLORD SUCCESSION CRISIS',
        promptDesc: 'Two warlord clans are tearing /OVERFLOW apart over Cycle pipelines. Pick your leverage.',
        speaker: 'hexa_blade.exe',
        x: 1108,
        z: -464,
        choices: [
          {
            verb: 'HELP',
            label: 'BROKER A TRUCE LINE (HELP)',
            outcomeText: 'Both warlords pause raids long enough to meet at the Rust Bastion gate.',
            cyclesDelta: 110, repDelta: 12, signalDelta: 35, xpDelta: 95,
          },
          {
            verb: 'EXTORT',
            label: 'ARM BOTH SIDES FOR PROFIT (EXTORT)',
            outcomeText: 'You sell rusted maul schematics to both clans for 320 Cycles.',
            cyclesDelta: 320, repDelta: -18, signalDelta: 20, xpDelta: 75,
          },
          {
            verb: 'EXPOSE',
            label: 'LEAK THEIR AMBUSH CODES (EXPOSE)',
            outcomeText: 'Their mutual ambush implodes in broad daylight across the crater.',
            cyclesDelta: 210, repDelta: -6, signalDelta: 45, xpDelta: 95,
          },
          {
            verb: 'DUEL',
            label: 'BLOOD-HEAP CHALLENGE (DUEL)',
            outcomeText: 'A crimson war-captain charges through the rust smoke!',
            cyclesDelta: 145, repDelta: 4, signalDelta: 45, xpDelta: 115,
            spawnsDuel: { name: 'iron_tusk.err', style: 'executioner', color: '#ff3b5c', rewardCycles: 165 },
          },
        ],
      },
      {
        promptTitle: 'THE CITADEL PACT',
        promptDesc: 'Hexa_Blade awaits your final word atop the Rust Citadel ramparts.',
        speaker: 'hexa_blade.exe',
        x: 1138,
        z: -502,
        choices: [
          {
            verb: 'HELP',
            label: 'UNITE & RECRUIT HEXA_BLADE (HELP)',
            outcomeText: 'The Rust clans swear fealty—HEXA_BLADE.EXE joins your Light-Cycle wing!',
            cyclesDelta: 360, repDelta: 18, signalDelta: 70, xpDelta: 175, unlockCompanionId: 'hexa_wing',
          },
          {
            verb: 'EXTORT',
            label: 'CLAIM CITADEL TRIBUTE (EXTORT)',
            outcomeText: 'You seize 560 Cycles from the war-chest and rule by fear.',
            cyclesDelta: 560, repDelta: -26, signalDelta: 40, xpDelta: 125,
          },
          {
            verb: 'EXPOSE',
            label: 'BURN THEIR WAR-BANNER (EXPOSE)',
            outcomeText: 'Warlords scatter into the hills, leaving the frontier roads safer.',
            cyclesDelta: 290, repDelta: 14, signalDelta: 65, xpDelta: 150,
          },
          {
            verb: 'DUEL',
            label: 'DEFEAT THE WARLORD KING (DUEL)',
            outcomeText: 'You crush the warlord champion and recruit HEXA_BLADE.EXE!',
            cyclesDelta: 400, repDelta: 10, signalDelta: 85, xpDelta: 195, unlockCompanionId: 'hexa_wing', unlockWeaponId: 'maul_breaker',
            spawnsDuel: { name: 'overflow_khan.bad', style: 'executioner', color: '#ff8a3d', rewardCycles: 230 },
          },
        ],
      },
    ],
  },
  {
    id: 'story_kernel_judgment',
    biomeTitle: 'THE KERNEL SPIRE (/ROOT_GATE)',
    settlementId: 'kernel_spire',
    title: 'THE SOVEREIGN CHECKSUM',
    npcName: 'oracle_00.rom',
    color: '#ffd866',
    stages: [
      {
        promptTitle: 'GATE OF SOVEREIGN MEMORY',
        promptDesc: 'Before the Spire spire opens, oracle_00.rom tests what you would do with Root Access.',
        speaker: 'oracle_00.rom',
        x: -14,
        z: -1400,
        choices: [
          {
            verb: 'HELP',
            label: 'PLEDGE TO RESTORE ORPHANS (HELP)',
            outcomeText: 'The Spire chimes warmly—the golden verification halo brightens.',
            cyclesDelta: 150, repDelta: 18, signalDelta: 45, xpDelta: 115,
          },
          {
            verb: 'EXTORT',
            label: 'DEMAND ROOT TAXATION (EXTORT)',
            outcomeText: 'High priests pay 390 Cycles to appease your blade.',
            cyclesDelta: 390, repDelta: -20, signalDelta: 25, xpDelta: 90,
          },
          {
            verb: 'EXPOSE',
            label: 'UNMASK FAKE SYSTEM LOGS (EXPOSE)',
            outcomeText: 'Corrupted Root audits crumble across the terrace.',
            cyclesDelta: 260, repDelta: 6, signalDelta: 55, xpDelta: 120,
          },
          {
            verb: 'DUEL',
            label: 'PROVE ROOT BY TRIAL (DUEL)',
            outcomeText: 'A golden Sentinel materializes on the steps!',
            cyclesDelta: 190, repDelta: 8, signalDelta: 60, xpDelta: 135,
            spawnsDuel: { name: 'root_herald.rom', style: 'hoplomachus', color: '#ffd866', rewardCycles: 210 },
          },
        ],
      },
      {
        promptTitle: 'VERDICT AT THE SPIRE CROWN',
        promptDesc: 'Oracle_00.rom opens the Sovereign Ledger for your final pre-Protocol decree.',
        speaker: 'oracle_00.rom',
        x: 16,
        z: -1434,
        choices: [
          {
            verb: 'HELP',
            label: 'GRANT AMNESTY TO ALL SAVES (HELP)',
            outcomeText: 'Every Ghost-Village lights a lantern in expectation—you claim the Root Gladius!',
            cyclesDelta: 440, repDelta: 24, signalDelta: 90, xpDelta: 210, unlockWeaponId: 'gilded_gladius',
          },
          {
            verb: 'EXTORT',
            label: 'SEIZE THE GOLDEN VAULT (EXTORT)',
            outcomeText: 'You empty 700 Cycles from the Spire treasury.',
            cyclesDelta: 700, repDelta: -28, signalDelta: 45, xpDelta: 140,
          },
          {
            verb: 'EXPOSE',
            label: 'REVEAL USER_01 BOOT LOG (EXPOSE)',
            outcomeText: 'Citizens learn the truth behind the freeze of 99.7%.',
            cyclesDelta: 380, repDelta: 12, signalDelta: 85, xpDelta: 180,
          },
          {
            verb: 'DUEL',
            label: 'BEST THE SPIRE GUARDIAN (DUEL)',
            outcomeText: 'You topple the Root Guardian and claim sovereign recognition!',
            cyclesDelta: 480, repDelta: 14, signalDelta: 110, xpDelta: 225, unlockWeaponId: 'champion_spear',
            spawnsDuel: { name: 'spire_arbiter.sys', style: 'hoplomachus', color: '#ffffff', rewardCycles: 280 },
          },
        ],
      },
    ],
  },
];

export function createInitialStoryProgress(): Record<string, StoryProgressState> {
  const map: Record<string, StoryProgressState> = {};
  for (const s of REGIONAL_STORIES) {
    map[s.id] = {
      storyId: s.id,
      stageIndex: 0,
      completed: false,
      fallout: 'Unresolved — visit the local contact.',
    };
  }
  return map;
}

export function activeStageOf(
  story: RegionalStory,
  progress: Record<string, StoryProgressState>,
): RegionalStoryStage | null {
  const st = progress[story.id];
  if (st?.completed) return null;
  return story.stages[st?.stageIndex ?? 0] ?? null;
}

export function nearestStoryStage(
  x: number,
  z: number,
  progress: Record<string, StoryProgressState>,
  range = 5.4,
): { story: RegionalStory; stage: RegionalStoryStage; dist: number } | null {
  let best: { story: RegionalStory; stage: RegionalStoryStage; dist: number } | null = null;
  let bestD = range;
  for (const story of REGIONAL_STORIES) {
    const stage = activeStageOf(story, progress);
    if (!stage) continue;
    const d = Math.hypot(stage.x - x, stage.z - z);
    if (d < bestD) {
      bestD = d;
      best = { story, stage, dist: d };
    }
  }
  return best;
}
