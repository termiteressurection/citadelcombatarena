# HANDOFF — BONEYARD (read this first)

Neon-shatter gladiator roguelite (*Spartacus: Legends* × *Nostalgaia* stick warriors × Citadel world). Branch: `boneyard`. Full plan + KPIs: `PLAN.md`.
Unrelated to the Citadel project; repo is only a source of art/tech. Ludus = calm sanctuary (sparring only in Training Yard). No gore.
**Standing Rule:** No browser QA — Wyatt playtests directly in the browser.

## Run
`npm install && npm run dev` (browser, http://127.0.0.1:5173; add `?arena` to jump straight into a bout)
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
- [ ] **Phase C — Excitement Engine** (NEXT: Dazed state + slow-mo `[E]` Executions, Live Crowd Favor & `T` Taunt, Procedural Web Audio drums/steel/crowd).
- [x] **Standalone Mac App (`BONEYARD.app` & `.dmg`)** — Built via Tauri (`src-tauri/Cargo.toml` `[profile.release.build-override] strip = false`).
- [ ] **Phase E — Named Rivals & Live Training Yard**.

## Code map (src/game)
- `world/` layout + collider math (pure, tested) · `Ludus.tsx`, `Stations.tsx`, `Gladiator.tsx` (low-poly PS1 polygon rig + modular armor/cape/weapons + limp/snare/glint visuals)
- `arena/styles.ts` 5 gladiator styles (`murmillo`, `dimachaerus`, `executioner`, `retiarius`, `hoplomachus`) · `arena/combat.ts` pure combat rules, combos, guard-break, breakable armor, net snare, 6-zone limb damage, AI (tested)
- `arena/ragdoll.ts` + `physics.ts` Rapier partial ragdoll + `SeveredPiece` limb/armor/weapon debris (tested: 50 kills + 40 mixed pieces stable)
- `arena/effects.tsx` `ShardPool`, `SlashPool`/`SlashRibbons`, `GhostPool`/`DashGhosts`
- `arena/boons.ts` + `arena/run.ts` 12 Fate boons, 5-bout ladder (`boutRosterFor`), crest looks
- `arena/arenaStore.ts` HUD state (`playerLimbs`, `styleName`, enemy `limbs`, locked target, combo, callouts) · `Arena.tsx` Colosseum scene + sim loop
- `art/` `ps1Textures.ts` Bayer-dithered textures, `Ps1Display.tsx` low-res CRT buffer & overlay, `Ps1Sky.tsx` sky dome & `Brazier`, `ClassicalColumns.tsx`, `StaticBatch.tsx`, `Starfield.tsx`, `SurrealSpores.tsx`
- `store.ts` zustand + localStorage save (`boneyard.save.v1`, `style`, `look`, `ps1Mode`)

## Known issues / honest notes
- Save is plain localStorage (`boneyard.save.v1`).
- Training Yard is a placeholder until Phase E (Armory now equips both Fighting Styles and Cosmetic Crest Colors).
- Only external runtime dependency beyond R3F/Three/Zustand: `@dimforge/rapier3d-compat` (CSP has `wasm-unsafe-eval`).
