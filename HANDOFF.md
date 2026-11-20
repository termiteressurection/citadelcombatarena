# HANDOFF — BONEYARD (read this first)

Neon-shatter gladiator roguelite (*Spartacus: Legends* × *Nostalgaia* stick warriors × Citadel world). Branch: `boneyard`. Full plan + KPIs: `PLAN.md`.
Unrelated to the Citadel project; repo is only a source of art/tech. Ludus = calm sanctuary (sparring only in Training Yard). No gore.

## Run
`npm install && npm run dev` (browser, http://127.0.0.1:5173; add `?arena` to jump straight into a bout)
`npm run dev:tauri` (Mac shell) · `npm run build` · `npx vitest run` · `cd src-tauri && cargo check`

## Status (Spartacus Overhaul — Option A)
- [x] Phase 0–3 + Phase 4 core — Strip, Walkable Ludus, Rapier 11-part ragdoll, Fate 12-boon draft, 5-bout ladder, Crest unlocks.
- [x] **Phase A — Fluid Motion, Combos & Lock-On Camera** — COMPLETE & QA-VERIFIED (120 FPS in browser):
  - Articulated *Nostalgaia* stick rig with crouched stance, waist/hip twist, directional footwork (strafe/advance/backpedal), smooth joint damping.
  - 3-hit light combo (`light` -> `light2` -> `light3` finisher), light->heavy cancel, guard-break shield bash (`F`), forward strike lunges.
  - Pooled curved neon slash ribbons & bash/parry shockwaves (`SlashRibbons`), 3-trail dodge dash-roll afterimages (`DashGhosts`).
  - *Spartacus* Lock-On Arena camera (`Tab` switch/unlock into free Citadel `Q/E/R/F` orbit), FOV punch + callouts (`PARRY!`, `GUARD BREAK!`, `FINISHER!`), spinning target reticle.
  - Ludus preserves exact Citadel `Q/E` rotate, `R/F` tilt, `WASD`/`Arrows` roam, `Enter` interact.
- [ ] **Phase B — 5 Gladiator Weapon Styles & Mid-Fight Armor Shatter** (NEXT: Murmillo, Dimachaerus, Executioner, Retiarius, Hoplomachus + breakable helms/pauldrons/shields + gear-carrying ragdolls).
- [ ] **Phase C — Excitement Engine** (Dazed state + slow-mo `[E]` Executions, Live Crowd Favor & `T` Taunt, Procedural Web Audio drums/steel/crowd).
- [ ] **Phase D — Restore Citadel Temple Ludus & Colosseum Stands** (Solomon's Temple pavilions/lanterns/sky dome from `8d88a49`, tiered amphitheater with cheering stick spectators & braziers).
- [ ] **Phase E — Named Rivals, Real Armory, Live Training Yard & Standalone Mac `.app`**.

## Code map (src/game)
- `world/` layout + collider math (pure, tested) · `Ludus.tsx`, `Stations.tsx`, `Gladiator.tsx` (articulated stick rig)
- `arena/combat.ts` pure combat rules, 3-hit combos, bash guard-break, AI (tested)
- `arena/ragdoll.ts` + `physics.ts` Rapier 11-part ragdoll (tested: 50 kills stable)
- `arena/effects.tsx` `ShardPool`, `SlashPool`/`SlashRibbons`, `GhostPool`/`DashGhosts`
- `arena/boons.ts` + `arena/run.ts` 12 Fate boons, 5-bout ladder, crest looks
- `arena/arenaStore.ts` HUD state (locked target, combo counter, callouts) · `Arena.tsx` scene + sim loop
- `art/` Citadel art kept: columns, synthwave horizon, starfield, spores, palette · `StaticBatch.tsx`
- `store.ts` zustand + localStorage save (`boneyard.save.v1`)

## Known issues / honest notes
- Save is plain localStorage (`boneyard.save.v1`).
- Training Yard is a placeholder until Phase E; Armory equips unlocked crest colors until Phase B/E adds weapon styles & armor.
- Only external runtime dependency beyond R3F/Three/Zustand: `@dimforge/rapier3d-compat` (CSP has `wasm-unsafe-eval`).
