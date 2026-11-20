# Open questions for Wyatt

Each question is a product choice; the recommendation is the default for implementation planning.

1. **May marketing say “tamper-evident” before M0.5 ships?** Recommended answer: **No.** Until the signed, hash-chained append-only journal log and trusted checkpoint are shipping, the app has a mutable JSON journal and an in-memory graph, not a tamper-evident journal. After M0.5, approve the phrase only with a plain explanation of its limits.

2. **Should the first Layer 1 release be English-only?** Recommended answer: **Yes.** Ship MiniLM with exact-text fallback and clear language limits; revisit multilingual E5 only if multilingual support outranks the 200 MB base target.

3. **Which day defines “Today” when a device travels or its clock changes?** Recommended answer: use the device's local civil day at write time, persist its timezone offset in the immutable event, never reassign a sealed day, and require confirmation for a large forward jump. The sync design cannot prove absolute time while devices are offline.

4. **How should users correct an old entry?** Recommended answer: keep the original stone immutable and append a visibly linked correction or continuation. Do not edit or erase the old text in place.

5. **Does the ≤200 MB base installer cap still hold?** Radio and the Bison Tarot feature are dropped. Historical M0.1 measurements, including the Tarot assets, are recorded in [the implementation plan](./03_implementation_plan.md); they are not current bundle measurements. Recommended answer: keep the cap, then verify it against actual signed release packages for each architecture after the graph store and runtime libraries are integrated.

6. **Should Layer 2 start disabled?** Recommended answer: **Yes.** Layer 1 must work without it; downloading a local model is a separate explicit choice with an accurate size and local-storage explanation.

7. **What is the minimum mobile release scope and first platform?** Existing: an iOS WKWebView companion (separate `Companion-App` repo) with one-way `.trmgts` handoff to the desktop; whether to replace it with the shared Rust core is open. Recommended answer: capture, review, local Layer 1, and sync only; choose one mobile OS for the first end-to-end release, then port the shared Rust core to the second after storage, FFI, permissions, and model packaging are proven.

8. **What recovery-kit form is acceptable for a nontechnical user?** Recommended answer: an encrypted local recovery file in two user-chosen offline locations plus a separately stored printed recovery code, with a guided restore ritual at the Archive. Validate the words and recovery flow with real users before release.

9. **What evidence tone should patterns use?** Recommended answer: below 10 complete day-pairs, no percentage; at 10–19, show only an explicitly small descriptive fraction; from 20 with an adequate comparison group, say “association” and show uncertainty, missingness, and counterexamples. No causal claims.

10. **Should the standalone browser build remain writable after M0.5?** Recommended answer: **Only through the same signed append-only log API.** Verify a durable browser adapter and key support first; otherwise make standalone mode an explicit import/export surface rather than keeping a writable localStorage journal in parallel.
