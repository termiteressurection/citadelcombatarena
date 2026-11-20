# HANDOFF — BONEYARD (read this first)

Neon-shatter gladiator roguelite. Branch: `boneyard`. Full plan + KPIs: `PLAN.md`.
Unrelated to the Citadel project; repo is only a source of art/tech. Ludus = calm sanctuary (sparring only in Training Yard). No gore.

## Run
`npm install && npm run dev` (browser, http://127.0.0.1:5173; add `?arena` to jump straight into a bout)
`npm run dev:tauri` (Mac shell) · `npm run build` · `npx vitest run` · `cd src-tauri && cargo check`

## Status
- [x] Phase 0 Setup
- [x] Phase 1 Strip — Citadel journal/vault/Sigma/sync/graph/ONNX model all removed. Rust shell is ~10 lines (`src-tauri/src/lib.rs`). dist 7.7 MB -> ~1.1 MB. Tests 1 -> 17.
- [x] Phase 2 Walkable Ludus — Solomon's-temple court from the Citadel pillar plan (46 columns, Jachin & Boaz), 5 stations (Gate/Armory/Shrine/Yard/Wall), 8 wandering NPC gladiators, visible parapet boundary.
- [~] Phase 3 One duel + ragdoll — BUILT AND PLAYABLE. Sword/shield/dodge/parry, Skirmisher AI w/ telegraph, Rapier 11-part ragdoll, neon shard shatter, victory/defeat -> glory / Wall of the Fallen. Needs Wyatt's FUN GATE.
- [ ] Phase 4 The run (Brute, Champion, boons, bout ladder, unlocks) — `KINDS` in `arena/combat.ts` already has brute + champion stats/AI params; `newWorld(bout, roster)` in `Arena.tsx` takes a roster.
- [ ] Phase 5 Polish + Mac app (`scripts/package_mac_app.py` still has Citadel names; needs retargeting to BONEYARD)

## Code map (src/game)
- `world/` layout + collider math (pure, tested) · `Ludus.tsx`, `Stations.tsx`, `Gladiator.tsx`
- `arena/combat.ts` pure combat rules + AI (tested) · `arena/ragdoll.ts` + `physics.ts` Rapier (tested: 50 kills stable)
- `arena/effects.ts` shard pool · `arena/arenaStore.ts` HUD state · `Arena.tsx` scene + sim loop
- `art/` Citadel art kept: columns, synthwave horizon, starfield, spores, palette · `StaticBatch.tsx` bakes columns into few draw calls
- `store.ts` zustand + localStorage save (`boneyard.save.v1`)

## Known issues / honest notes
- Ludus FPS in the headless QA browser was ~20 before optimization (arena ~65-80). Replaced the Citadel grid shader with line segments and batched columns; re-measure on a real Mac GPU.
- Save is plain localStorage. Not sealed/tamper-proof (Muse's idea; not adopted).
- Training Yard and Armory are placeholders. Gate -> arena works.
- Only new dependency: `@dimforge/rapier3d-compat` (CSP has `wasm-unsafe-eval`).
