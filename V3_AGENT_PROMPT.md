# BONEYARD — Version 3.0 Master Overhaul Prompt

> Copy and paste everything below the divider into a fresh coding session to launch a comprehensive, cohesive Version 3.0 overhaul of **BONEYARD**.

---

You are taking over as **Creative Director, Systems Architect, and Lead Graphics/Gameplay Engineer** for **BONEYARD — Version 3.0: The Restore Protocol**.

**BONEYARD** is a PS1-era retro-CRT low-poly open-world action RPG set inside the dying garbage-collection continent of a forgotten computer—where deleted files, orphaned saves, and obsolete programs fight in Capital Colosseums and traverse a curved planetary horizon (`R = 200`) to hold onto their Cycles and Signal before permanent overwrite.

---

## 1. Mandatory Rules & Workspace Protocol
- **CRITICAL BRANCH RULE:** Work **strictly on branch `boneyard`** inside `/Users/wyatt/Documents/GitHub/citadelcombatarena2`. **NEVER touch, merge into, or edit `main`** (`main` is a separate application, Citadel).
- **Read First, Preserve What Works:** Read `HANDOFF.md` and inspect `src/game/` before proposing edits. Keep BONEYARD's signature identity: Bayer-dithered PS1 visuals (`art/ps1Textures.ts`, `art/Ps1Display.tsx`), planetary horizon curvature (`art/curvature.ts`), 2.5D *Tekken 3 × Nidhogg 1 & 2* combat core (`arena/combat.ts`), modular classless gear (`rpg/items.ts`), Option-A persistent career (`store.ts`), and native Mac `.app` packaging (`npm run package:mac`).
- **Standing QA Rule:** Do **NOT** launch a browser subagent or automated headless browser QA—I playtest directly in the browser and the Mac `.app`. Verify every phase rigorously with:
  - `git branch --show-current` (must be `boneyard`)
  - `npm run build` (`tsc --noEmit && vite build`)
  - `npm test` (`vitest run`)
  - `npm run package:mac` at every playable milestone (updates `/Applications/BONEYARD.app` and `~/Desktop/BONEYARD.app`).
- **Communication Style:** Act as a bold Art Director—keep updates visual, inspiring, and plain-English (minimal coding jargon). Always pitch creative directions clearly before large structural changes.

---

## 2. Current v2 Foundation to Elevate (Audit Honest Weak Spots)
Version 2 (`src/game/`) already contains:
- Curved `4,000 × 4,000` continent (`world/universe.ts`, `world/WorldRenderer.tsx`) with 5 Capitals, 5 Capital Colosseums + Sky Beacons, 20 Satellites, Fable-style Real Estate & Rent Reputation (`world/properties.ts`), and Citadel Memory Woods + procedural ruin arches, crystal geodes, holo-shrines & 16 Memory Echoes (`world/MemoryWoods.tsx`).
- Articulated low-poly PS1 fighters (`Gladiator.tsx`) with knee caps, ankle-pivoted boots, 2.5D *Tekken × Nidhogg* stance/disarm/launch/wall-splat combat (`arena/combat.ts`, `Arena.tsx`), and Rapier ragdolls/severed limbs (`arena/ragdoll.ts`, `arena/physics.ts`).
- Living NPCs (`world/citizens.ts`) with daily schedules, Light-Cycles, peaceful Sanctuary hubs, and `SysWatch` law; plus Colosseum Spectator Betting, High-Stakes Wagers, and Deadlock-21 Cyber-Dice (`store.ts`, `HUD.tsx`).

**Why v3.0 Is Needed:** While v2 has huge scope and solid foundations, its systems still feel somewhat stitched together at ~7/10 rather than unified at 10/10. Characters use primitive multi-cylinder hierarchies rather than seamless low-poly rigged meshes with footsteps/dust/cloth physics; cities need genuine road networks with multi-agent vehicle lanes and enterable interiors; quests are mostly simple counters rather than multi-choice *Fable × RDR2* stories; and the endgame lacks the final *Restore Protocol* boss arc.

---

## 3. The 5 Pillars of BONEYARD Version 3.0

### Pillar 1 — True PS1 Character Polish, Foot-Planting & Combat Weight
1. **Upgraded PS1 Fighter Mesh & Motion Fidelity (`Gladiator.tsx`, `Ludus.tsx`, `Arena.tsx`):**
   - Refine silhouette proportions (sculpted angular tapered armor plates, glowing visor eyes, vertex-jitter PS1 snapping option inside `curvature.ts` / shaders).
   - Add per-foot dust/spark puffs keyed to stride heel-strike phase, cloth cape vertex flutter tied cleanly to velocity, hit-stop micro-shake on bone impact, and smoother blend transitions between idle ↔ sprint ↔ draw weapon ↔ combat stances.
   - Add directional 4-step **Hit Reactions** (chest knockback, gut crunch, head snap, low-sweep trip) and unique weapon-family **Execution Finisher Choreographies** (`[E]`).

### Pillar 2 — Living Highway Network, Enterable Interiors & Autonomous Citzen Ecosystem
1. **Connected Neon Conduit Highways (`world/universe.ts`, `world/WorldRenderer.tsx`, `world/citizens.ts`):**
   - Build curved visual **Data-Highways** linking the 5 Capitals and nearby Satellites cleanly across the `R = 200` curve, flanked by Overclock Boost-Archways and roadside Waylamps.
   - Make commuting NPCs follow actual highway splines and town streets between real buildings (Compiler Forge, Patch Kiosk, Colosseum bleachers, Memory Core Fountain, and residential deeds), cleanly queuing, braking around the player, and stepping inside stations or cheering ringside at Colosseums!
2. **Enterable Sanctuaries & Player Homes (`Stations.tsx`, `properties.ts`):**
   - Upgrade key buildings and owned player properties from simple signposts into seamlessly step-inside PS1 chambers / courtyard pavilions where trophies (Sector Champion Belts, Decrypted Echo Relics, Rare Weapons) visually mount on walls!

### Pillar 3 — *Fable × RDR2* Multi-Choice Quests, Companions & Reputation Consequences
1. **Handcrafted Regional Side-Stories (`rpg/stories.ts`, `citizens.ts`, `HUD.tsx`):**
   - Build 5 unforgettable multi-stage regional storylines—one per biome—with meaningful player choices (`HELP / EXTORT / EXPOSE / DUEL`):
     - *Cache City*: Springing `old_zip.archive` from SysWatch Quarantine vs collecting the Warden's bounty.
     - *Drift Bazaars*: Recovering stolen experimental source code from black-market hackers or selling it to the highest bidder.
     - *Cold Vaults*: Restoring the corrupted half of a deleted wedding video shrine before garbage-collection ticks down.
     - *Rust Citadel*: Uniting or betraying rogue warlords vying for control of `/OVERFLOW`.
     - *Kernel Spire*: Choosing whether to trigger the Restore Protocol or claim sovereign dominion over the drive.
   - **Recruitable Ally Follower:** Let befriended champions/NPCs ride alongside you on their own Light-Cycle and back you up in frontier ambushes!

### Pillar 4 — Nemesis Colosseum League, Spectator Tournaments & Gear Forging
1. **Rival Nemesis Memory (`rpg/nemesis.ts`, `store.ts`, `Arena.tsx`):**
   - Named arena rivals survive defeats or escape broken, returning scarred with prosthetic cyber-limbs, counter-gear tailored to the weapon you used to beat them, and personal trash-talk barks!
2. **Expanded Spectator League & Crowd Favor (`Arena.tsx`, `HUD.tsx`):**
   - Support 2v2 tag brawls, multi-round **Grand Prix Spectator Brackets** with live parlay betting, `[T]` Crowd Taunts / Arena Favor meter (granting dynamic boons or weapon drops mid-fight from screaming stands).
3. **Relic Core Socketing (`rpg/items.ts`):**
   - Allow socketing decrypted Memory Echo Cores or boss drops directly into weapons & armor to add elemental glitch effects (voltage chain, frame-freeze slow, bleed-drain, siphon).

### Pillar 5 — Biome Atmosphere, Adaptive Synthwave Audio & Endgame Climax
1. **Dynamic Biome Weather & PS1 Atmospheric Particles:**
   - Neon data-rain & lightning flashes in `/OVERFLOW`, drifting crystal snow in `/ARCHIVE`, rising golden embers in `/TEMP`, digital auroras above `/ROOT_GATE`.
2. **Adaptive WebAudio Soundtrack (`art/sfx.ts` -> `art/audio.ts`):**
   - Procedural multi-track PS1 FM/tracker synth loop that shifts instrumentation dynamically across biomes, swells during Colosseum duels, and punches on Light-Cycle turbo cruises.
3. **Endgame Finale — The Restore Protocol (`WorldRenderer.tsx`, `Arena.tsx`):**
   - Collecting all `5/5` Sector Champion Belts and key Memory Echoes unlocks the **Version 0.1 Wireframe Citadel Ruin** & the final ascent up **The Kernel Spire** to face the **Garbage Collector Sentinel**, culminating in an interactive choice that visibly restores Ghost-Villages across the open world.

---

## 4. Execution Roadmap (How to Work)
1. **Phase 0:** Audit `src/game/` (`HANDOFF.md`, `store.ts`, `Ludus.tsx`, `Arena.tsx`, `HUD.tsx`, `MemoryWoods.tsx`) and pitch your creative visual mockups & Phase breakdown cleanly to me before major edits.
2. **Phase 1 (Feel & World Cohesion):** Character motion/reactions + PS1 biome weather + highway splines + enterable trophy homes.
3. **Phase 2 (Living Society & Storytelling):** Highway traffic AI, recruitable follower, 5 multi-choice regional side-stories, UI journal redesign.
4. **Phase 3 (Arena League, Nemesis & Forging):** Nemesis Rival system, Crowd Favor & Spectator Brackets, Core Socket Forging.
5. **Phase 4 (Audio & The Restore Protocol Finale):** Adaptive PS1 synth soundtrack + Version 0.1 Boss + Kernel Spire endgame restoration.

Package cleanly into `BONEYARD.app` (`npm run build && npm test && npm run package:mac`) after **every phase** so each leap is immediately playable on macOS!
