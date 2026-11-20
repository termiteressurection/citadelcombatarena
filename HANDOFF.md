# HANDOFF — BONEYARD (read this first)

Neon-shatter gladiator roguelite (*Spartacus: Legends* × *Nostalgaia* stick warriors × Citadel world). Branch: `boneyard`. Full plan + KPIs: `PLAN.md`.
Unrelated to the Citadel project; repo is only a source of art/tech. Ludus = calm sanctuary (sparring only in Training Yard). No gore.
**Standing Rule:** No browser QA — Wyatt playtests directly in the browser.

## Run
`npm install && npm run dev` (browser, http://127.0.0.1:5173; add `?arena` to jump straight into a bout)
`npm run package:mac` (rebuilds + cleanly replaces `/Applications/BONEYARD.app` & `~/Desktop/BONEYARD.app` + clears WebKit cache)
`npm run dev:tauri` (Mac shell) · `npm run build` · `npx vitest run` · `cd src-tauri && cargo check`

## Status (Spartacus Overhaul — Option A)
- [x] Phase 0–3 + Phase 4 core — Strip, Walkable Ludus, Rapier 11-part ragdoll, Fate 12-boon draft, 5-bout ladder, Crest unlocks.
- [x] **Phase A — Fluid Motion, Combos & Lock-On Camera** — COMPLETE:
  - Articulated *Nostalgaia* stick rig with crouched stance, waist/hip twist, directional footwork, smooth joint damping.
  - 3-hit light combo (`light` -> `light2` -> `light3`), light->heavy cancel, guard-break shield bash (`F`), forward strike lunges.
  - Pooled curved neon slash ribbons & bash/parry shockwaves (`SlashRibbons`), 3-trail dodge dash-roll afterimages (`DashGhosts`).
  - *Spartacus* Lock-On Arena camera (`Tab` switch/unlock into free Citadel `Q/E/R/F` orbit), FOV punch + callouts, spinning reticle.
- [x] **Phase A.5 — *Half Sword* Neon Limb Health & Dismemberment** — COMPLETE (34/34 tests + build clean; Bout 2 & decapitation ready for Wyatt playtest):
  - 6 individual limbs (`head`, `torso`, `armL`, `armR`, `legL`, `legR`) with attack-driven targeting (`light` -> shield arm, `light2` -> weapon arm, `light3`/`bash` -> legs, `heavy` -> head).
  - Live white -> amber -> pulsing crimson tinting on both 3D stickmen and HUD stick-doll (`LimbDoll`).
  - Gameplay consequences: severed shield arm disables blocking; severed enemy weapon arm disarms (player weapon arm cripples at 0.65× dmg / 1.25× windup without soft-locking); broken legs trigger limp animation, slow movement, and block dodging; broken head triggers instant neon decapitation.
  - `SeveredPiece` tumbling limb/sword/shield physics debris + partial `Ragdoll` omitting severed parts + Rapier world lifecycle fix across Bout transitions.
- [x] **Phase B — 5 Gladiator Weapon Styles & Mid-Fight Armor Shatter** — COMPLETE (40/40 tests + `tsc` + `vite build` clean; ready for Wyatt playtest):
  - 5 distinct gladiator styles (`src/game/arena/styles.ts`): **Murmillo** (gladius + scutum + crested helm), **Dimachaerus** (twin crimson-silver curved blades, no shield (cross-blade guard requires both arms intact at 1.5× stamina), single-arm resilience until both arms lost), **Executioner** (two-handed blunt hammer with heavy armor bleed-through & guard-breaking heavies), **Retiarius** (long trident + energy-net heavy snare slowing movement & locking dodge, unhelmeted with shoulder pauldron), and **Hoplomachus** (long spear thrust + round buckler (+0.08s parry window) + animated 3-segment crimson cape).
  - Mid-fight breakable armor (`helm`, `pauldron`, `shield`): mitigates limb damage (`0.45×` sharp / `0.75×` blunt), shatters visually on 3D rigs (`Gladiator.tsx`) and launches tumbling wireframe `SeveredPiece` debris + death weapon drops (`ragdoll.ts`).
  - Persisted equipped style in `store.ts` (`boneyard.save.v1`), swap styles in Armory or at the Arena Gate (`HUD.tsx`), and 8 Ludus NPCs + escalating `boutRosterFor` enemy waves showcasing all 5 silhouettes (`Ludus.tsx`, `run.ts`, `Arena.tsx`).
- [x] **Direction C — PS1 Retro CRT Relic, Low-Poly Polygon Fighters & Colosseum/Temple Overhaul** — COMPLETE (40/40 tests + `tsc` + `vite build` clean):
  - Procedural Bayer-dithered NearestFilter PS1 textures (`art/ps1Textures.ts`), `Ps1Resolution` 2.4× internal pixel scaling + `Ps1Overlay` CRT scanlines/bezel + `[P]` toggle (`art/Ps1Display.tsx`, `store.ts`).
  - Faceted twilight PS1 sky dome, moon, distant ruins, and flickering flame `Brazier`s (`art/Ps1Sky.tsx`), plus solid faceted 10-sided stone/bronze Classical Columns (`art/ClassicalColumns.tsx`, UV-preserving `art/StaticBatch.tsx`).
  - Low-poly tapered polygon fighters (`Gladiator.tsx`) with angular heads, eye slits, kilts, attack telegraph glints, drop shadows, solid faceted style armor/weapons/cape, and matching low-poly `RagdollView`/`SeveredPieceView`.
  - Colosseum Arena (`Arena.tsx`) with sand pit, center stone medallion, 24-sided stone podium + perimeter shields + N/S portcullis tunnels, open-center 3-tier seating bowl, 16 Roman arches with banners, Emperor's Royal Box, ~120 leaping spectators, and cinematic bout intro sweep.
  - Temple Sanctuary Ludus (`Ludus.tsx`, `Stations.tsx`) with flagstone plaza, shimmering octagonal fountain basin, paved station walkways, landmark station builds, Live 3D Armory Showcase camera + right-docked PS1 drawer, beveled HUD bars, and keycap legend (`HUD.tsx`, `index.css`).
- [x] **Combat Movesets, Parry/Riposte & Tactical AI Revamp** — COMPLETE (44/44 tests + `tsc` + `vite build` clean):
  - Per-weapon movesets (`styles.ts`, `Gladiator.tsx`, `effects.tsx`): unique `MoveSpec`s & 3D animations (`thrust`, `sweep`, `crush`, `twinSlash`, `twinCross`, `netThrow`, `slash`, `backhand`, `overhead`, `bash`) + piercing lance streaks — including **Hoplomachus** spear **Impale Charge** heavy thrust (`1.38×` reach, `1.85×` lunge), **Executioner** wide sweeps + **Skull Breaker**, **Dimachaerus** **Scissor Cross**, and **Retiarius** trident thrust + **Energy Net Cast**.
  - Responsive Parry & Riposte (`combat.ts`, `Arena.tsx`, `Gladiator.tsx`): `0.26s` tap-parry sustain, recovery & early-windup feint cancels into parry, bright parry flash glint on enemy attacks, `1.35s` attacker stagger + `+25` defender stamina, and `1.4s` molten-gold **`1.65×` `RIPOSTE!`** counter window (still beaten cleanly by shield `bash`).
  - Tactical Reactive Gladiator AI (`combat.ts`): per-style `AI_PROFILE`, deliberate one-shot reads on player windups to dodge laterally/back (`dodgeRate`) or parry/block, dodge-cancels out of recovery (`dimachaerus`/`retiarius`), multi-hit combo chaining, anti-turtle `bash`/heavy guard-breaking, and multi-enemy flanking separation.
- [x] ***FATE*-Inspired PS1 Roman Town Gladiator Life-Sim RPG** — COMPLETE (51/51 tests across 5 test files + `tsc` + `vite build` clean):
  - **Walkable Roman Town & Forum Marketplace** (`world/layout.ts`, `Ludus.tsx`, `Stations.tsx`, `art/ps1Textures.ts`, `art/Ps1Sky.tsx`): expanded `-48..48` x `-64..44` hilltop cobblestone terrace with South Barracks, central Flagstone Forum Square & Fountain Basin, paved Colosseum Avenue, 13 perimeter low-poly stucco townhouses (`plaster` & `roof` Bayer-dithered textures), 12 Mediterranean cypresses, 6 wandering unarmed `civilian` townsfolk, 4 wandering gladiators, and Morning sunlight <-> Dusk twilight day cycle.
  - **Classless Modular Gear & Weapons** (`rpg/items.ts`, `Gladiator.tsx`, `Arena.tsx`, `HUD.tsx`): independent slots for Main Weapon (13 weapons across `gladius`, `spear`, `twinSica`, `warhammer`, `trident`), Off-Hand (shields & `gladiator_net`), Helm, Body Armor, and Cape; equipped Weapon sets light/heavy movesets while `gladiator_net` overrides Heavy into `Energy Net Cast` and 2H weapons store the offhand automatically.
  - **RPG Progression, Quests, Fight Cards & Option-A Career** (`rpg/stats.ts`, `rpg/quests.ts`, `store.ts`, `combat.ts`, `HUD.tsx`): 5 upgradeable stats (`vit`, `str`, `agi`, `end`, `tec`) with `+3` points per level-up, Fame Ranks (`RECRUIT` -> `LIVING LEGEND`), `[H]` Healing Flasks (`drinkFlask`) & daily food/oil buffs at Apothecary, Daily Contracts at the Contract Board, Daily Training Yard drill (`+35 XP`), `[C]` right-docked 3D Gear & Attributes drawer, 4 Daily Colosseum Fight Cards at the Gate, and Option-A defeat recovery in the Barracks (small healer fee + `-15` Fame while preserving stats & gear).
- [ ] **Phase C — Excitement Engine** (NEXT: Dazed state + slow-mo `[E]` Executions, Live Crowd Favor & `T` Taunt, Procedural Web Audio drums/steel/crowd).
- [x] **Standalone Mac App (`BONEYARD.app` & `.dmg`)** — Built via Tauri (`src-tauri/Cargo.toml` `[profile.release.build-override] strip = false`).
- [ ] **Phase E — Live Training Yard Sparring**.

## Code map (src/game)
- `rpg/` `items.ts` (13 weapons, 6 offhands, 6 helms, 5 bodies, 4 capes, `resolveLoadout`, `gearFromStyle`) · `stats.ts` (5 stats, XP leveling, Fame ranks, consumables, `buildPlayerMods`) · `quests.ts` (daily bounties, bout telemetry tracker, 4 daily Fight Cards)
- `world/` layout (`BOUNDS` `-48..48` x `-64..44`, 9 stations) + collider math (pure, tested) · `Ludus.tsx` (Roman Town plaza, buildings, cypresses, morning/dusk lights, NPCs, showcase camera), `Stations.tsx`, `Gladiator.tsx` (modular low-poly PS1 rig + `civilian` mode)
- `arena/styles.ts` 5 weapon moveset blueprints · `arena/combat.ts` pure combat rules, combos, guard-break, breakable armor, net snare, 6-zone limb damage, `gearOf`, `drinkFlask`, AI (tested)
- `arena/ragdoll.ts` + `physics.ts` Rapier partial ragdoll + `SeveredPiece` limb/armor/weapon debris (tested: 50 kills + 40 mixed pieces stable)
- `arena/effects.tsx` `ShardPool`, `SlashPool`/`SlashRibbons`, `GhostPool`/`DashGhosts`
- `arena/boons.ts` + `arena/run.ts` 12 Fate boons, legacy 5-bout ladder (`?arena`), crest looks
- `arena/arenaStore.ts` HUD state (`playerLimbs`, `enemies`, locked target, combo, callouts) · `Arena.tsx` Colosseum scene, Fight Cards, `[H]` flask, sim loop & career settle
- `art/` `ps1Textures.ts` Bayer-dithered textures (`roof`, `plaster`, `cobble`, etc.), `Ps1Display.tsx` low-res CRT buffer & overlay, `Ps1Sky.tsx` sky domes (`town_morning`, `town_dusk`, `arena`) & `Brazier`, `ClassicalColumns.tsx`, `StaticBatch.tsx`, `Starfield.tsx`, `SurrealSpores.tsx`
- `store.ts` zustand + localStorage career save (`boneyard.save.v2` with `v1` migration)

## Known issues / honest notes
- Save is plain localStorage (`boneyard.save.v2`; automatically imports prior `boneyard.save.v1` saves).
- Training Yard offers a once-per-day drill (`+35 XP`) and quick stat upgrades until live dummy sparring arrives.
- Only external runtime dependency beyond R3F/Three/Zustand: `@dimforge/rapier3d-compat` (CSP has `wasm-unsafe-eval`).
