# Dependency license election

The shipped Rust dependency graph contains `oxrocksdb-sys 0.4.11`, declared
`GPL-2.0 OR Apache-2.0`. Citadel elects the **Apache-2.0** option for this
dual-licensed dependency. No GPL-only or AGPL dependency is present in the
locked macOS Rust bundle closure or the npm production dependency closure
reviewed for this release. The Rust graph also contains LGPL only as an option
in `r-efi`'s `MIT OR Apache-2.0 OR LGPL-2.1-or-later` expression; use its MIT
or Apache option.

The npm lockfile omits a license expression for `webgl-constants 1.1.1`; its
shipped `node_modules/webgl-constants/LICENSE` is MIT. The production npm
closure reviewed here contains 211 packages. The macOS Cargo target closure
contains 375 packages.

`src-tauri/vendor/oxrdfxml` and `src-tauri/vendor/sparesults` are local patches
of the same-version Oxigraph crates (MIT OR Apache-2.0). Their parser changes
are limited to compatibility with `quick-xml` 0.41; retain the upstream license
and attribution when updating them.

**Guardrail:** for every dependency or feature change, rerun the locked Cargo
and npm license scans against the actual macOS bundle/production closures and
update this election if the result changes. Do not ship a GPL-only or AGPL
dependency without an explicit business-model decision.

## Accepted RustSec warnings (2026-10-19)

`cargo audit` reports zero vulnerabilities and nine allowed warnings in the
locked Rust graph. The seven unmaintained crates are `fxhash 0.2.1`
(RUSTSEC-2025-0057), `proc-macro-error 1.0.4` (RUSTSEC-2024-0370), and
`unic-char-property`, `unic-char-range`, `unic-common`, `unic-ucd-ident`, and
`unic-ucd-version` (all 0.9.0; RUSTSEC-2025-0081, -0075, -0080, -0100, and
-0098). They arrive through Tauri's HTML/URL parsing stack. The two unsound
warnings are `glib 0.18.5` (RUSTSEC-2024-0429; Linux GTK target, not macOS) and
`rand 0.7.3` (RUSTSEC-2026-0097; transitive build-time parser path). These are
retained because replacing them safely requires changing upstream Tauri
dependency paths; re-evaluate on each Tauri upgrade. No npm audit
vulnerabilities were reported in this scan.
