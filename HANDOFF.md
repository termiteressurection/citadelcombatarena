# HANDOFF — BONEYARD (read this first)

Neon-shatter gladiator roguelite. Branch: `boneyard`. Full plan + KPIs: `PLAN.md`.
Unrelated to the Citadel project; the repo is only a source of art/tech. Ludus = calm sanctuary (sparring only in Training Yard). No gore.

## Run
`npm ci && npm run dev` (web) · `npm run dev:tauri` (Mac shell) · `npm run build` · `npx vitest run`

## Baseline (Phase 0, untouched Citadel)
- `npm run build`: PASS (tsc + vite), ~1s
- Tests: 1 passing
- `dist/`: 7.7 MB (three-runtime chunk 923 kB)
- Tauri ONNX model (`src-tauri/models`): 22 MB  <- removal target in Phase 1

## Status
- [x] Phase 0 Setup
- [ ] Phase 1 Strip
- [ ] Phase 2 Walkable Ludus
- [ ] Phase 3 One duel + ragdoll (first real game)
- [ ] Phase 4 The run
- [ ] Phase 5 Polish + Mac app

## Notes for next agent
- Reusable: `src/arboretum/components/citadel-rebuilt/world/` (village/, PlayerController.tsx, sky/, shaders), `scripts/package_mac_app.py`.
- Strip targets: journal/vault/Sigma/sync/graph (`src/core`, `src/features/sigma`, `src/features/synaptic-vault`, `src-tauri/src/*`, ONNX model).
- Only new dependency allowed: `@react-three/rapier` (Phase 3).
