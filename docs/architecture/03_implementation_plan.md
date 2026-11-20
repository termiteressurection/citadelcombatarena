# Implementation plan

## Embedder decision

Use **`sentence-transformers/all-MiniLM-L6-v2`**, starting with its quantized ONNX artifact for each CPU architecture. It is the smallest suitable English-first option in this comparison, has an Apache-2.0 license, and leaves more room for the always-on app than the BGE or multilingual candidates. It produces 384-dimensional vectors and the model card describes English semantic search/clustering; cap input to its 256 wordpiece context. Exact retrieval remains available if the vector runtime or model is unavailable. Mobile latency, retrieval quality on Citadel journal entries, and package-size after app integration are **UNVERIFIED** and must be measured before shipping.

| Model | Size | Dimensions | License | Quality notes | Mobile viability |
|---|---|---:|---|---|---|
| `sentence-transformers/all-MiniLM-L6-v2` **selected** | 90.4 MB float ONNX; listed quantized files include 23 MB AVX2 and 45.2 MB ARM64. Tokenizer/package overhead **UNVERIFIED**. | 384 | Apache-2.0 | 22.7M parameters; English-focused; model card supports semantic search and clustering, with a 256 wordpiece limit. No directly comparable journal-domain score is published here. | Strongest base-package fit. ARM64 and AVX2 quantized exports exist; actual latency, numerical behavior, and iOS/Android delegate coverage **UNVERIFIED**. [Model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) · [ONNX artifacts and sizes](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/tree/main/onnx) |
| `BAAI/bge-small-en-v1.5` | Original ONNX file listed at 133 MB; quantized package size not established here. | 384 | MIT | 33.4M parameters, English, 512-token input. The card publishes MTEB averages: 62.17 overall, 51.68 retrieval, 43.82 clustering. Those published results are not an apples-to-apples comparison against MiniLM. | Plausible after quantization, but the original export is large for a ≤200 MB base package; quantization, mobile latency, and delegate coverage **UNVERIFIED**. [Model card](https://huggingface.co/BAAI/bge-small-en-v1.5) · [ONNX file](https://huggingface.co/BAAI/bge-small-en-v1.5/blob/main/onnx/model.onnx) |
| `intfloat/multilingual-e5-small` | Quantized ONNX file listed at 118 MB, plus tokenizer JSON 17.1 MB and SentencePiece 5.07 MB; total listed files already exceed 140 MB before runtime/app. | 384 | MIT | Model card lists 94 languages. Query/document prefixes (`query:` and `passage:`) are part of the model's expected usage. | Appropriate only if multilingual support outranks the base-size target. Runtime/latency on mobile and package trimming **UNVERIFIED**. [Model card](https://huggingface.co/intfloat/multilingual-e5-small) · [ONNX and tokenizer files](https://huggingface.co/intfloat/multilingual-e5-small/tree/main/onnx) |

Keep model metadata with every local index: model ID/revision, tokenizer revision, dimensions, quantization, and normalization version. Embeddings are disposable local indexes, never synchronized or used as the journal authority. An embedder upgrade builds a new index and swaps it only after a full local rebuild succeeds.

## Runtime matrix

**Decision: use the Rust `ort` binding to ONNX Runtime as the shared model API.** It is a Rust wrapper over ONNX Runtime, not a pure-Rust inference engine. This aligns with the existing Rust/Tauri core and reuses one ONNX artifact where its operators and execution provider are supported. ONNX Runtime assigns supported nodes to an execution provider and can leave unsupported nodes on CPU. Exact Rust binding version, license notices, binaries, and mobile packaging are **UNVERIFIED** until pinned in a platform prototype. [Rust `ort` project](https://github.com/pykeio/ort) · [Execution-provider behavior](https://onnxruntime.ai/docs/execution-providers/) · [Rust linking guidance](https://github.com/pykeio/ort/blob/main/docs/content/setup/linking.mdx)

| Platform | Pick | Why this pick | Alternatives and limits |
|---|---|---|---|
| macOS 14+ Apple Silicon | Rust `ort` + Core ML execution provider, with CPU fallback | One Rust API and ONNX graph; Core ML can target Apple CPU/GPU/Neural Engine. | Core ML EP is listed as preview and has operator partition/fallback constraints. Prove MiniLM coverage, notarized library packaging, and performance before enabling it by default. Direct Core ML would require a separate Swift/runtime path. [Core ML EP](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html) |
| Windows | Rust `ort` + CPU execution provider for the first supported build | Lowest-risk common path for this small quantized encoder; no separate runtime API in the app core. | Windows 11 24H2+ documentation points new work toward WinML and describes DirectML as sustained engineering. Evaluate WinML later behind the same inference interface; do not make DirectML a release dependency. [Windows guidance](https://onnxruntime.ai/docs/get-started/with-windows.html) · [DirectML status](https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html) |
| iOS | Rust `ort` + Core ML EP, CPU fallback | Keeps inference in the shared Rust core and uses Apple's local execution path when the graph is supported. | ORT's Rust FFI, iOS binary, app-store packaging, and Core ML EP support for the quantized graph must be proven. **UNVERIFIED**. Core ML's deployment documentation lists supported Apple OS versions, but this does not establish compatibility with this exact Rust build. [Core ML EP](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html) · [`ort` linking](https://github.com/pykeio/ort/blob/main/docs/content/setup/linking.mdx) |
| Android | Rust `ort` + XNNPACK EP, CPU fallback | Shared Rust interface with an execution provider optimized for supported mobile CPU operators. | XNNPACK only handles supported operators and delegates other nodes to CPU; confirm quantized MiniLM coverage, ABI packaging, and energy/latency on representative phones. **UNVERIFIED**. [XNNPACK EP](https://onnxruntime.ai/docs/execution-providers/Xnnpack-ExecutionProvider.html) |

Alternatives considered: Apple's MLX is a strong Apple-Silicon-specific framework with Swift support, but it creates a Mac-specific inference path rather than the shared macOS/Windows/mobile Rust interface. [MLX project](https://github.com/ml-explore/mlx) · [MLX installation/platform notes](https://github.com/ml-explore/mlx/blob/main/docs/src/install.rst) Hugging Face Candle is a Rust ML framework with CPU and accelerator backends, but the supported model/operator path for this exact exported encoder is **UNVERIFIED**. [Candle](https://github.com/huggingface/candle) Sonos Tract is a pure-Rust ONNX inference engine; the exact operator and quantized-artifact support needed here is also **UNVERIFIED**. [Tract](https://github.com/sonos/tract) · [Tract pipeline](https://github.com/sonos/tract/blob/main/doc/pipeline.md)

## CRDT choice

Choose **Automerge** for the shared Today view, modeled as append-only entries keyed by globally unique event ID plus immutable close/manifest references. Its Rust implementation and sync protocol fit the shared core. The sync protocol expects reliable, in-order delivery; the authenticated transport must provide that, with resumable chunks above it. [Automerge Rust API](https://docs.rs/automerge/latest/automerge/) · [Automerge sync module](https://docs.rs/automerge/latest/automerge/sync/index.html)

Do not use CRDT conflict resolution to edit journal text. A same-ID/different-payload collision is quarantined, not resolved by a deterministic winner. Corrections are new signed entries linking forward. Yrs is attractive when Yjs interoperability or its C FFI is a requirement, but Citadel's shared core is Rust and the journal is not a shared editable text buffer. [Yrs](https://docs.rs/yrs/latest/yrs/) · [y-crdt C FFI](https://github.com/y-crdt/y-crdt) Loro is a credible Rust/JS/Swift alternative with version history and merge features, but those capabilities exceed the append-only set/list use case; reconsider only if a product requirement needs them. [Loro](https://github.com/loro-dev/loro)

## Handshake and cryptography crates

- **`snow`** for the Noise XX handshake, configured for `Noise_XX_25519_ChaChaPoly_BLAKE2s`. Derive a short comparison phrase from the handshake transcript; require both screens to confirm it, then pin the peer's identity key. Noise XX does not make mDNS trustworthy. The Snow project states it has no formal security audit; **UNVERIFIED** for production suitability and feature configuration. [Noise Protocol Framework](https://noiseprotocol.org/noise.html) · [Snow](https://github.com/mcginty/snow)
- **`ed25519-dalek` 2.x** for per-device event signatures. The repository's Rust MSRV is 1.77; pin a compatible 2.x release and verify its exact MSRV in the lockfile. Version 3.0 requires Rust 1.85, so it does not fit the current MSRV without a toolchain change. [2.x API](https://docs.rs/ed25519-dalek/2.2.0/ed25519_dalek/) · [3.0 MSRV](https://docs.rs/crate/ed25519-dalek/3.0.0)
- **`blake3`** for event hashes and local chunk/Merkle summaries. Confirm the selected crate version's MSRV and target support when pinning. [BLAKE3 Rust crate](https://docs.rs/blake3/latest/blake3/)
- **Deterministic event encoding** must be part of the signed schema. RFC 8949 defines deterministic CBOR encoding requirements; a compatible Rust encoder and its canonical behavior are **UNVERIFIED**. [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949.html#section-4.2)
- Signatures and hashes detect changes relative to a trusted key/head; they do not encrypt local files or make a compromised key safe. Use OS secure key storage and full-disk encryption as the first release baseline. Specific cross-platform secure-store crates and at-rest encryption are **UNVERIFIED**. For encrypted removable bundles, evaluate `chacha20poly1305`; exact crate/version/nonce/key lifecycle and app target support remain **UNVERIFIED**. [Rust `chacha20poly1305`](https://docs.rs/chacha20poly1305/latest/chacha20poly1305/)

## Base installer size budget

Target is **200 decimal MB maximum per desktop architecture slice**, counting installed base payload before archive compression. Layer 2 weights are outside the base build and require a separate, explicit optional download as the brief specifies. The table is a target allocation, not a measured release artifact; all non-model line items are **UNVERIFIED** until a signed release build is measured. The MiniLM ARM64 ONNX file alone is listed at 45.2 MB; 47 MB reserves about 1.8 MB for tokenizer/config and is still **UNVERIFIED** as a combined package.

| Line item | Target MB | Basis |
|---|---:|---|
| Tauri shell, Rust core, persistent graph, UI code | 58 | **UNVERIFIED**; measure stripped signed application per target. |
| ONNX Runtime, execution-provider/native libraries, RocksDB | 60 | **UNVERIFIED**; varies by OS/architecture and provider. |
| Quantized MiniLM ONNX plus tokenizer/config | 47 | 45.2 MB ARM64 model file listed upstream; remainder **UNVERIFIED**. Windows AVX2 model file is listed at 23 MB. [Artifact list](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/tree/main/onnx) |
| Essential interface assets, icons, fonts, offline lore | 20 | Former budget allocation; re-inventory current assets before release measurement. |
| Radio library | 0 | Dropped; 770,652,772 bytes of source tracks moved outside the public build root into ignored `_archive/radio/`. |
| Schema, migrations, licenses/notices, built-in rules and prompts | 5 | **UNVERIFIED**. |
| Installer metadata, signing overhead, and package reserve | 10 | **UNVERIFIED**; verify for each installer format. |
| **Total** | **200** | The 200 MB target remains a budget, not a verified installer size; verify remaining estimates and package overhead. |

Historical M0.1 measurements: the 770,652,772-byte Radio library and 136,153,920 bytes of original tarot PNGs were stored under the ignored `_archive/` directory, outside the public build root. The 78 served Tarot WebPs then totaled 15,541,054 bytes. The music and Tarot features, their served assets, and both ignored local archives were removed as obsolete on 2026-10-28. These figures are historical, not current bundle estimates. Vite `dist/` fell from 914,045,339 bytes to 22,705,743 bytes; the Tauri app directory fell from 919,070,340 bytes to 30,108,304 bytes. The previous app was x86_64 and the new local app is native ARM64, so the app-directory comparison also reflects the architecture change. These are uncompressed directory measurements before Developer ID signing/notarization, not compressed installer sizes; measure an actual signed installer before promising a 200 MB download/install size.

## Ordered milestones

Effort is a rough engineering size: S = days, M = roughly one to two weeks, L = several weeks including platform integration and review. Exit criteria are design targets; no implementation or verification was performed in this design pass.

### M0 — Citadel name and provider-free Sigma

- **Scope:** Set Tauri product and window names to Citadel, remove the Ollama HTTP integration and connection probes, keep Sigma available through a deterministic Layer 1 stub/structured fallback, and retain the current UI routes.
- **Files/crates:** `src-tauri/tauri.conf.json`, delete `src/arboretum/components/citadel-rebuilt/sigma/OllamaProvider.ts`, replace/delete `src/arboretum/components/citadel-rebuilt/sigma/CitadelLLM.ts`, and update `src/arboretum/components/citadel-rebuilt/sigma/SigmaEngine.ts`, `src/arboretum/components/citadel-rebuilt/TermiteDialog.tsx`, `src/arboretum/components/citadel-rebuilt/RebuiltApp.tsx`, `src/features/sigma/SigmaChatPanel.tsx`, `src/arboretum/components/citadel-rebuilt/sigma/CitadelBrainPrompt.ts`, and `PROJECT_SCAFFOLD.txt`. No new crate is indicated.
- **Exit criteria:** Bundle/window both identify as Citadel; every provider import/probe/call removed or routed through the stub; app still opens Sigma and responds offline; whole-repository search finds no runtime reference to `localhost:11434` or the retired provider.
- **Effort:** M.

### M0.5 — Real Stone

- **Scope:** Implement persistent graph storage and a signed, hash-chained append-only journal entry log. The log becomes the sole canonical source of journal entries. Persistent Oxigraph is a rebuildable projection/index derived only from verified log events. Replace the separate JSON and localStorage journal paths with the log-backed interface. Import existing user entries from all applicable legacy stores with **zero data loss**.
- **Status:** The signed native journal, legacy snapshot importer, async store hydration, and encrypted graph snapshot are implemented. The product now has a Tauri-only startup gate; no browser adapter is part of the supported runtime. Remaining work in this plan should preserve import-only handling for legacy browser data rather than restoring a parallel browser persistence implementation.
- **Migration and zero-loss rule:** Snapshot every available `citadel-state.json`, legacy `state.json`, and `citadel-v2-state` value before import; inventory entry IDs, count, original text bytes, dates, timestamps, tags, and unknown legacy fields; preserve a read-only legacy archive and migration receipt. Convert each entry into a signed migration-provenance event without pretending the original historical timestamp was newly verified. Equal duplicate IDs with equal payloads map to one canonical event with both source references; same ID with differing payloads preserves both byte-exact candidates under distinct migration event IDs and raises a visible collision. Do not delete or overwrite a source until the imported log is durable, signatures and chain re-verify, a reconstructed journal matches every source entry, and a recoverable backup exists. On interruption, resume idempotently from the receipt. The browser localStorage snapshot is imported once into signed migration events; later browser writes must use the same append-only log API, never recreate a second state-blob authority. An IndexedDB/WASM storage and signing adapter is **UNVERIFIED**; if it cannot verify, preserve the browser snapshot and require a verified local export/import before declaring migration complete. JSON/localStorage cease to be live journal write paths after successful migration; backups are non-authoritative archives.
- **Exit criteria:** Persistent graph survives process restart and can be rebuilt from the log; append signature/hash-chain validates from genesis; no graph command can mutate journal authority; migration reconciles every input entry and field with zero lost entries/bytes, handles conflicting duplicate IDs without choosing a winner, and survives interruption/retry without duplicates; export/recovery procedure restores the prior journal; old sources remain until successful verification and user-visible migration completion. The separate verifier/migration matrix is an implementation task and was not run here.
- **Effort:** L.

### M1 — Layer 1 embedder and retriever

- **Scope:** Package quantized MiniLM per architecture, run local inference through the Rust `ort` interface, mean-pool token outputs with the attention mask and L2-normalize vectors according to the model card, then implement top-five retrieval with citations plus exact keyword/tag fallback. Build/rebuild disposable local indexes from the canonical log.
- **Files/crates:** `src-tauri/src/semantic_engine.rs` exposes semantic search, index rebuild/status, and pairwise map similarity. `ort` is pinned to `2.0.0-rc.10` with Core ML and build-time ONNX Runtime binaries; this release retains support for the app's macOS 12 floor and Intel builds. The quantized `Xenova/all-MiniLM-L6-v2` artifact and vocabulary are pinned under `src-tauri/models/all-MiniLM-L6-v2/`, with checksum and Apache-2.0 notice. Rebuildable vectors live only at `<app_data_dir>/semantic_index/index.json`. Sigma uses the native search seam with exact keyword/tag fallback; the Mind Map Table uses ephemeral pair scores to gently cluster similar nodes.
- **Exit criteria:** Air-gapped lookup returns dated source IDs; disabling embeddings leaves usable exact retrieval; rebuilding index from verified log is repeatable; artifact revision/dimensions are recorded; no response can cite a nonexistent event; semantically related map nodes move closer while remaining draggable.
- **Effort:** L.

### M2 — Pattern engine and dialogue manager

- **Scope:** Add transparent day-level statistics, evidence views, sparse-data behavior, dialogue states, extractive summaries, Quick Inscribe, ritual prompts, and day/week/month/season/year horizons. Implement the thresholds in [Layered Sigma stress test](01_layered_sigma_stress_test.md).
- **Files/crates:** `src/core/rules/librarian.ts`, `ritualEngine.ts`, `src/core/state/stateActions.ts`, `src/core/model/types.ts`, graph/retrieval interfaces, `SigmaEngine.ts`, `TermiteDialog.tsx`, Sigma and Archive views; create pure-statistics and evidence-format modules as needed. No new statistical/model crate is selected; any library claim requires source review before adoption.
- **Exit criteria:** Every computed pattern links its input events; sparse/biased/missing observations trigger calibrated wording; template cooldown prevents repetition; extractive output preserves quotes/counterexamples; app remains usable with Layer 2 absent.
- **Effort:** M.

### M3 — Rust sync core and desktop-to-desktop exchange

- **Scope:** Replicate verified signed logs between already paired desktop devices. Implement identity binding, sequence/head comparison, Merkle summaries, resumable bounded chunks, replay idempotence, fork quarantine, and encrypted local transfer bundles. This extends the M0.5 canonical journal log; it does not introduce a second journal store.
- **Files/crates:** Add `src-tauri/src/sync/` modules for event protocol, authorization, transport framing, bundle import/export, and reconciliation; update `journal_log.rs`, `lib.rs`, Cargo manifest/lock; reuse `snow`, `ed25519-dalek` 2.x, and `blake3` from M0.5. Exact event encoder and AEAD crate remain **UNVERIFIED** until pinned.
- **Exit criteria:** Two desktop replicas converge after exchanging missing events; valid replay is a no-op; modified, truncated, oversized, wrong-key, and forked bundles are rejected/quarantined; temporary chunks never reach the graph before complete verification; transfer works without external network access.
- **Effort:** L.

### M4 — Archive pairing ritual

- **Scope:** Add user-started discovery, QR rendezvous, Noise XX phrase confirmation on both devices, identity pinning, explicit allow/deny, progress, cancel, and local signed bundle export/import at the Archive monolith.
- **Files/crates:** `src/arboretum/components/citadel-rebuilt` Archive views and new pairing components; Tauri capability/configuration; `src-tauri/src/sync/` discovery/handshake commands; add platform local-network permission explanations. Candidate mDNS/BLE bindings and Tauri plugin choice are **UNVERIFIED**.
- **Exit criteria:** A spoofed service record cannot pass the dual-screen confirmation; no persistent device identifier or journal content is advertised; user can stop discovery; QR and manual bundle path share key validation; revocation heads are checked before import.
- **Effort:** M.

### M5 — Today CRDT and midnight crystallization

- **Scope:** Add Automerge as the Today view's append-only set/list model over signed events; per-device local-day segments; immutable close events; merged day manifests; roster and pending-convergence states; clock-change handling from [Handshake Sync stress test](02_handshake_sync_stress_test.md).
- **Files/crates:** Add/pin `automerge` in `src-tauri/Cargo.toml`; update `src-tauri/src/sync/`, `journal_log.rs`, and day projection; update `src/core/time/localDay.ts`, state/store, Journal Altar date controls and Archive conflict/review views. Exact Automerge version and Rust model are **UNVERIFIED** until prototype.
- **Exit criteria:** Both-offline-across-midnight sequence merges without lost entries or rewritten seals; duplicate delivery is idempotent; same-ID conflicts are retained and surfaced; display ordering is deterministic but does not claim trusted wall time; a day is called globally converged only after all roster close heads or a signed roster change.
- **Effort:** L.

### M6 — Optional Layer 2 voice

- **Scope:** Add the desktop-only optional generative voice as an app-managed sidecar/runtime with no separately installed daemon or model-server listener, plus an explicit model download. Layer 1 constructs the prompt from cited retrieved events, constrains unsupported claims, and remains the fallback. The generative model never becomes a journal or retrieval authority.
- **Files/crates:** Add sidecar/download manager modules under `src-tauri/src/`, update Tauri bundle configuration, Sigma Pyramid UI, consent/status and prompt-building boundaries. Model choice/runtime packaging remain **UNVERIFIED** until device and size benchmarks; keep model weights out of the 200 MB base budget.
- **Exit criteria:** User can leave it unavailable and retain every Layer 1 feature; model is local after download; disable/delete controls work; every historical claim is tied to retrieved citations; outputs that invent or fail source checks are withheld or explicitly qualified.
- **Effort:** L.

### M7 — Windows build

- **Scope:** Deliver supported Windows installer with durable Oxigraph, log migration, Layer 1 CPU inference, Sigma, and desktop sync; add accelerator only after the common runtime path is stable.
- **Files/crates:** Tauri Windows config/signing/build scripts; Rust dependency target configuration; installer assets; platform key storage and local-network capability glue. Runtime baseline is `ort` CPU; a WinML path is later evaluation.
- **Exit criteria:** Signed installer fits its declared size target; clean install and upgrade preserve journal; local pairing and recovery work; app succeeds without a network connection; restore/import and clock/fork handling meet the desktop criteria.
- **Effort:** L.

### M8 — Mobile: capture, review, Layer 1, and sync

- **Current state:** A companion app already exists in the separate `Companion-App` repo: a SwiftUI `WKWebView` shell (`CitadelPhone/`) hosting a plain JS app (`citadel-phone/`) with its own `localStorage` ledger. It is not built on the shared Rust core. It hands off one-way to the desktop: the desktop runs a LAN `POST /import` session (`src-tauri/src/trmgts_import.rs`) and shows a QR (`{v:1, type:'citadel-import', session, phrase, endpoint, mac}`); the phone sends an encrypted `trismegistus` v1 `.trmgts` bundle with the `X-Citadel-Session` header, or shares the file as a fallback. The scope below is the target state, not the current one.
- **Scope:** Ship the shared Rust core via FFI on iOS/Android for capture, archive review, local search/patterns, pairing, and sync. No generative Sigma on mobile, per product scope.
- **Files/crates:** Add iOS/Android app shells and FFI bridge, target-specific `ort` packages/providers, local network permission/plist/manifest entries, and compact-model packaging; reuse journal, sync, and CRDT core. Tauri-mobile reuse versus native shell and exact FFI are **UNVERIFIED**.
- **Exit criteria:** Device writes survive offline/restart; mobile and desktop verify and exchange signed events; platform permissions are requested only when pairing starts; capture/review work air-gapped; model-less exact search still works; no desktop-only surface appears.
- **Effort:** L.

## Lore mapping

| User-facing feature | In-world location or ritual |
|---|---|
| First launch, local-only identity/key setup, and explaining the Archive | Archive monolith arrival ritual |
| Write, edit today's draft before append, daily anchor, quick capture, and morning/midday/evening prompts | Journal Altar; once appended, corrections are new linked inscriptions |
| Today view and unresolved local-day merge | Journal Altar, with the day marked as local-sealed or awaiting another device |
| Historical scans and cited history search | Archive monolith |
| Mind Map and semantic clusters | Mind Map Table (station 06, northeast) |
| Forensic day/week/month/season/year horizons | Forensic Notebook (N key); the Archive monolith holds historical scans only |
| Bookmarked chambers | Notice monolith (station 05) |
| Transparent mood/sleep/activity patterns and evidence/counterexamples | Forensic Notebook (N key), opened from cited entries |
| Sigma reflection, dialogue states, and extractive summaries | Sigma Pyramid |
| Optional Layer 2 consent, model download/status/delete | Sigma Pyramid threshold ritual; Layer 1 remains the default path |
| QR + phrase pairing, discovery start/stop, transfer progress, conflict review, revocation, recovery, USB/AirDrop bundles | Archive monolith pairing and custody ritual |
| Mobile capture and review | Journal Altar for capture; Archive monolith for search, history, and sync |
| Recovery and migration receipt | Archive monolith; show imported-entry count and verification receipt before calling migration complete |
