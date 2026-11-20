# Citadel architecture: current state

This document describes the current Tauri-only product runtime. Vite still builds the React frontend that runs inside Tauri's WebView; standalone browser cartridges are no longer shipped or supported.

## Journal storage

- Startup rejects non-Tauri runtimes. It activates the encrypted WebView storage bridge, migrates legacy Web Storage/IndexedDB values, and hydrates the journal/profile from native commands before rendering the app. A failed initialization is shown as a retryable startup error; it does not boot with an empty state. [main.tsx](../../src/main.tsx) · [vaultStorage.ts](../../src/core/security/vaultStorage.ts) · [citadelStore.ts](../../src/core/state/citadelStore.ts)
- The native signed journal is the source of truth for entries; non-journal profile data is stored separately. Legacy `citadel-v2-state` snapshots are imported through the Rust migration command. The encrypted WebView storage bridge remains for compatibility and feature-specific key/value stores, not as a standalone browser persistence mode. [nativeStorage.ts](../../src/core/persistence/nativeStorage.ts) · [storage.ts](../../src/core/persistence/storage.ts)
- The Rust graph is a rebuildable projection, not the journal authority. Its in-memory Oxigraph store is persisted as an encrypted snapshot and can be reconstructed from journal data. [graph.rs](../../src-tauri/src/graph.rs)
- `oxigraph` is pinned to 0.4.11 with default features disabled. In that tagged release, RocksDB is the feature that enables durable `Store::open`; it is disabled in the current manifest. [Cargo.toml](../../src-tauri/Cargo.toml#L28) · [Oxigraph 0.4.11 feature declaration](https://github.com/oxigraph/oxigraph/blob/v0.4.11/lib/oxigraph/Cargo.toml#L350-L355)

## Midnight and past-entry behavior

- The write gate allows entries only for the state's current local day. An accepted write appends to the in-memory day cell with a UUID and timestamps. The day cell's `locked` flag is not a cryptographic seal. [writeGate.ts](../../src/core/rules/writeGate.ts) · [stateActions.ts](../../src/core/state/stateActions.ts#L24)
- `rolloverToToday()` runs during native hydration and on the active-app midnight/focus watcher. The Rust journal enforces append-only entries and exposes journal crystallization/verification commands; application state is reconstructed from that log. [stateActions.ts](../../src/core/state/stateActions.ts) · [citadelStore.ts](../../src/core/state/citadelStore.ts) · [App.tsx](../../src/app/App.tsx) · [journal_log.rs](../../src-tauri/src/journal_log.rs)
- The frontend still uses Web APIs inside the Tauri WebView, including bridged localStorage for legacy and feature-specific values. This is not a supported browser runtime: `main.tsx` refuses to render the product outside Tauri, and native persistence/service calls do not return simulated browser success values.

## Sigma and the localhost endpoint

- `OllamaProvider.ts` defines the sole literal `http://localhost:11434` in the tracked application sources found by search. It probes `/api/tags` and posts generations to `/api/generate`, with `llama3` as its default model. There is no Ollama package dependency in the inspected manifest/lockfile search; this integration is direct HTTP code.
- `CitadelLLM.ts` creates and probes that provider, tracks connection status, and registers it with `SigmaEngine.ts`. `TermiteDialog.tsx` and `RebuiltApp.tsx` initiate/check that status. `SigmaEngine.ts` has a rule-based reply path and an optional provider path.
- `src/features/sigma/SigmaChatPanel.tsx` separately creates the provider and sends its own prompt. If the endpoint fails, this panel displays a connection failure instead of using the rule-based reply path.
- `CitadelBrainPrompt.ts` has stale comments describing the old local-model surface. The Tauri dev-server URL at `localhost:5173` is unrelated to the model endpoint.

### Files to change to remove the Ollama integration

M0 must remove or replace every runtime import/call site and update the repository map:

1. Delete `src/arboretum/components/citadel-rebuilt/sigma/OllamaProvider.ts`.
2. Delete or replace `src/arboretum/components/citadel-rebuilt/sigma/CitadelLLM.ts` with a provider-free status/stub interface.
3. Remove provider registration and route all replies through the Layer 1 stub in `src/arboretum/components/citadel-rebuilt/sigma/SigmaEngine.ts`.
4. Remove connection-status/probe wiring in `src/arboretum/components/citadel-rebuilt/TermiteDialog.tsx` and `src/arboretum/components/citadel-rebuilt/RebuiltApp.tsx`.
5. Replace the direct provider call and connection-failure branch in `src/features/sigma/SigmaChatPanel.tsx` with the same offline stub/reply API.
6. Remove stale references in `src/arboretum/components/citadel-rebuilt/sigma/CitadelBrainPrompt.ts`.
7. Update the file tree in `PROJECT_SCAFFOLD.txt`.

No change to `package.json` is indicated by the current dependency search. Repeat a whole-repository search for `11434`, `Ollama`, and the endpoint before M0 closes; generated output and ignored build products should not be treated as runtime source.

## Locked product constraints

Implementation must preserve fully air-gapped use, with no accounts or telemetry; one double-click installer, with no separately user-installed server/daemon or user-managed port configuration; macOS 14+ Apple Silicon and planned Windows support; and mobile capture/review with Layer 1 only.

## Design implication

The existing local date gate and mutable in-memory graph do not satisfy an immutable signed journal. The proposed M0.5 therefore makes a signed, hash-chained append-only entry log the canonical journal source; persistent Oxigraph becomes a rebuildable graph projection. The old JSON and localStorage stores become import-only migration inputs, with a verified legacy archive retained until migration acceptance. This is a proposed design, not current behavior.
