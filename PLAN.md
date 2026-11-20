# BONEYARD — Implementation Plan

Neon-shatter gladiator roguelite. Built in `citadelcombatarena2` only. Ludus (temple village) as the home base.

## Token-proofing (read this first)

You fear running out of tokens mid-build. The plan is built around that:

- **Every phase ends in a green, playable checkpoint** and a git commit. Nothing is left half-wired.
- **`HANDOFF.md` in the repo root** is updated at the end of every phase: what's done, what's next, how to run it, known bugs. Any agent (me, another Claude, Gemini) can pick up from it cold.
- **Phases are ordered by value.** If we stop after Phase 3, you still own a playable duel in a walkable Ludus.
- **Cheap work first.** Stripping and reskinning reuse existing code, so they cost fewer tokens than new systems.
- **Rule for me:** read first, write little. No rewrites, only targeted edits.

## Token budget (rough, in "Sonnet-session" units; 1 unit ≈ one long focused session)

| Phase | Est. units | Cumulative | Stop-safe? |
|---|---|---|---|
| 0. Setup & handoff | 0.2 | 0.2 | Yes |
| 1. Strip | 0.5 | 0.7 | Yes |
| 2. Walkable Ludus | 1.0 | 1.7 | Yes |
| 3. One duel + ragdoll | 1.5 | 3.2 | **Yes: first real game** |
| 4. The run (roguelite loop) | 1.5 | 4.7 | Yes |
| 5. Polish & Mac app | 1.0 | 5.7 | Yes |

**Minimum viable stopping point: end of Phase 3.** If tokens are tight, we ship a duel and stop there.

---

## Phase 0 — Setup (0.2)
**Deliverable:** `HANDOFF.md`, `PLAN.md`, git branch `boneyard`, baseline snapshot.

| KPI | Target |
|---|---|
| `npm run build` passes on untouched repo | Yes/No, recorded |
| Baseline bundle size recorded | MB number in HANDOFF.md |
| Baseline test count recorded | N tests passing |

## Phase 1 — Strip (0.5)
**Deliverable:** App launches into the world with no journal, vault, Sigma chat, sync, or ONNX model. Parked systems moved behind a flag or deleted via a labeled commit (recoverable from git).

| KPI | Target |
|---|---|
| App launches to a 3D scene | Yes |
| `tsc` errors | 0 |
| Bundle / app size vs baseline | ≥ 40% smaller (ONNX model alone is a big chunk) |
| Removed features still referenced in code | 0 dangling imports |
| Time from launch to first rendered frame | < 3 s |

## Phase 2 — Walkable Ludus (1.0)
**Deliverable:** Village reskinned as a Solomon's-temple gladiator school. Walk around it. Gate, Armory, Shrine, Wall of the Fallen, Training Yard exist as interactable props. Wandering NPC gladiators.

| KPI | Target |
|---|---|
| Frame rate in the Ludus (M-series Mac) | ≥ 60 FPS, never < 45 |
| Interactable stations working | 5 of 5 prompt on approach |
| Invisible colliders / unreachable props | 0 |
| NPC gladiators wandering | ≥ 6 on screen, no clipping into walls |
| Palette consistency | Uses existing neon palette only, no new colors |
| Walk Gate to arena-loading transition | Works, no crash |

## Phase 3 — One Duel + Ragdoll (1.5) ← **Make-or-break**
**Deliverable:** Arena scene. Player (sword, shield, dodge, light/heavy attack) vs one enemy. On death the enemy ragdolls and shatters into neon shards. Adds `@react-three/rapier` (justified: needed for ragdoll physics).

| KPI | Target |
|---|---|
| Frame rate with 2 ragdolls active | ≥ 60 FPS |
| Input-to-hit-reaction latency | < 100 ms (hit-stop + flash on the same frame) |
| Ragdoll stability | 0 explosions or NaN bodies in 50 consecutive kills |
| Ragdoll settle time | < 4 s, then bodies sleep (CPU cost drops) |
| Enemy telegraph readable | Attack wind-up ≥ 0.4 s |
| **Fun gate (Wyatt)** | "Would I do this again?": Yes/No. If No, fix before moving on |

## Phase 4 — The Run (1.5)
**Deliverable:** Full loop: Ludus → Gate → bouts → boon pick → harder bout → boss → death → back to Ludus with unlocks and a name on the Wall.

| KPI | Target |
|---|---|
| Enemy types | 3 (Skirmisher, Brute, Champion boss) |
| Boons | 12 at launch, all stack safely, 0 crash combos |
| Run length | 10–15 min for a full winning run |
| Death → Ludus return | < 5 s |
| Meta-progress persists across restarts | Yes (save survives app quit) |
| Meta unlocks add variety, not raw power | 100% (a new player's sword hits equally hard) |
| Max simultaneous ragdolls | 8 at ≥ 45 FPS |

## Phase 5 — Polish & Mac App (1.0)
**Deliverable:** Bloom/glow, crowd and drum audio, Termitesse menus, a signed `.app` via the existing `package_mac_app.py`.

| KPI | Target |
|---|---|
| `.app` launches by double-click on a clean user account | Yes |
| Crash-free playtest | 3 full runs, 0 crashes |
| App size | < 150 MB |
| Cold launch to Ludus | < 5 s |
| `npm test` | All pass, no skipped to hide failures |

---

## Standing rules for every phase
- `tsc` clean and `npm test` green before a checkpoint counts.
- One commit per phase, named `phase-N: …`.
- Update `HANDOFF.md` before ending any session.
- Ask before adding any dependency besides Rapier.
- No gore. Neon shatter only.

## Your only jobs
1. Approve this plan.
2. Play at the end of Phase 2 (Ludus) and Phase 3 (duel) and answer the **Fun gate**.
3. If tokens run low, say "checkpoint". I'll finish the current phase to a green commit and write the handoff.

## Open choice
Ludus: calm sanctuary (recommended) or sparring allowed. Default is calm, with sparring only in the Training Yard.
