# Layered Sigma: stress test

Layer 1 is the always-available, in-process semantic and statistical system. The optional generative voice is Layer 2. Layer 1 must remain useful with no model download, no network, and no prior journal history. No response may state an event that is not supported by retrieved entries or clearly marked as a question or possibility.

## Failure modes

| Failure | Trigger | User sees | Severity (1-5) | Mitigation |
|---|---|---|---:|---|
| Empty or tiny journal | First launch or fewer than 10 entries | Generic prompts; empty retrieval | 2 | Welcome with one concrete capture prompt; say there is not enough history to identify patterns; never fabricate familiarity. |
| Missed relevant entry | Short text, misspelling, alias, or a name used in a new sense | Sigma says it cannot find a relevant inscription | 3 | Combine exact terms, tags, recency, local embeddings, and entity aliases; expose the query and cited results so the user can broaden it. |
| False semantic match | Similar wording, different person/event | Incorrect citation or apparent memory | 4 | Require a relevance threshold; show date and short quoted evidence; allow “not this”; never paraphrase unsupported facts as memory. |
| Stale index after import/rebuild | Crash or partial projection update | Search misses new entries or duplicates them | 4 | Commit canonical log first, then update an idempotent projection; track projection head hash; rebuild from verified log on mismatch. |
| Classifier misreads tone | Sarcasm, dialect, short entry | Incorrect mood/topic label | 3 | Make labels editable and optional; preserve original text; show confidence/“uncertain”; never silently rewrite a user label. |
| Sparse pattern data | Few days or uneven tracking | A percentage sounds more certain than it is | 5 | Enforce minimum denominators and interval wording below; distinguish association from causation. |
| Confounding | Sleep, workload, illness, season, and mood move together | A simple pair is framed as an explanation | 4 | State the observed association, list missingness and alternative context, show counterexamples, ask whether the pattern fits. |
| Repetitive template | Same intent repeatedly selects the same prompt | Mechanical or falsely intimate voice | 2 | Track recent template IDs locally; vary phrasing only within approved meaning; use the user's actual words with a citation. |
| Extractive summary loses nuance | Long or contradictory entries | Summary overstates a theme | 4 | Preserve quotes and entry links; mark summaries as summaries; include a “what this leaves out” counterexample. |
| Retrieval contains sensitive text | A prompt searches the whole archive unexpectedly | Private entry appears in an unrelated exchange | 5 | Scope search to explicit user intent and local consent; show sources; let the user exclude entries/tags; no hidden upload. |
| Model package absent/corrupt | User skips download or disk/file corruption | Semantic ranking unavailable | 2 | Exact keyword/tag retrieval remains; surface local status; verify artifact hash and offer repair from the app package or user-selected local media. |
| Unsupported language | User writes outside English in the initial English model | Search quality falls | 3 | Keep exact search and manual tags; state language limits; do not silently translate or claim equivalent semantic quality. |

## Ten dialogue repairs

Each repair keeps a clear boundary between retrieved evidence and interpretation. “Fixed” examples assume the cited entry really exists; the interface should render the citation as a clickable date/source.

| User says | Robotic or unsafe version | Fixed Layer 1 version |
|---|---|---|
| “I blew the whole morning.” | “You are stuck in a cycle of self-sabotage.” | “You wrote ‘blew the whole morning’ today. What took the first hour?” |
| “Same fight with Mara again.” | “Mara always makes you feel unseen.” | “I found two entries mentioning Mara and conflict: May 4 and May 11. Is this the same disagreement, or a new one?” |
| “I feel weird about the launch.” | “You’re afraid of success.” | “I can’t tell what ‘weird’ means yet. Is it dread, excitement, pressure, or something else?” |
| “Did I say I’d call him?” | “Yes, you promised to call your brother.” | “I found no entry that says you promised. I did find ‘I should call Dad’ on June 2. Is that who you mean?” |
| “Why do I crash on Fridays?” | “Your body is telling you to slow down.” | “Your Friday entries mention low energy 4 times out of 6 logged Fridays. That is a small sample and doesn’t establish why. Want the six dates?” |
| “I’m proud of that.” | “You’ve finally learned to believe in yourself.” | “The entry about finishing the draft says, ‘I actually kept my word.’ Is that the part you’re proud of?” |
| “Should I quit?” | “Absolutely. Choose yourself.” | “I can help lay out what you’ve written for and against it. I can’t make that decision from your journal. Which part should we look at first?” |
| “Nothing matters.” | “Here are three productivity tips.” | “That sounds heavy. I won’t turn it into a checklist. Do you want to write what happened, or stay with that sentence for a moment?” |
| “What changed since winter?” | “You became more disciplined.” | “I found 8 winter entries and 11 recent entries tagged ‘work.’ Here are two exact differences in what you wrote; tell me if they miss the point.” |
| “Give me the short version.” | “Your life is a journey of transformation.” | “Short version: you recorded more sleep on days after evening walks in 5 of 7 logged pairs. That is an observed overlap, not proof the walks caused it.” |

## Where Layer 1 falls short of Layer 2

- It cannot reliably compose an open-ended, novel answer from broad world knowledge. **NEEDS LAYER 2** for optional generative phrasing; otherwise answer narrowly or ask a question.
- A finite dialogue state machine cannot infer every conversational subtext or keep a naturally flowing discussion over arbitrary turns. **NEEDS LAYER 2** for flexible dialogue; **MITIGATE** with intent detection, state display, and a clean “I didn’t understand” response.
- Local classifiers may miss sarcasm, mixed mood, metaphor, and uncommon language. **ACCEPT** uncertain or absent labels; **MITIGATE** with editability and user-provided tags.
- Extractive summaries can select representative quotes but cannot guarantee a faithful synthesis of a complex, changing view. **MITIGATE** with dated quotations, counterexamples, and an explicit “review this summary” action; **NEEDS LAYER 2** only for optional prose synthesis under citations.
- A model can return semantically plausible but unsupported claims. **ACCEPT** that no generation is guaranteed; **MITIGATE** by requiring Layer 1 retrieval citations and limiting the prompt to those passages; suppress unsupported claims and let the user inspect the evidence.
- It will not diagnose, predict a user's future, infer causes, or replace professional care. **ACCEPT**. Do not turn correlation into clinical or causal advice.

## Ranked tactics for a useful default experience

1. Cite every recalled entry by date, with a short quote and a one-click route to the source.
2. Make “I can’t find that” and “I’m not sure” good, specific responses rather than failures.
3. Retrieve through exact text, tags, names/aliases, date filters, and semantic similarity; never make embeddings the only search path.
4. Ask one focused Socratic follow-up selected from the current dialogue state, not a generic stack of questions.
5. Offer a user-approved one-sentence summary followed by the entries that support it and a counterexample when available.
6. Use the user's own phrases as quoted language, not as a guessed personality model.
7. Expose “why this appeared” on patterns, topics, and recommendations.
8. Use a template cooldown and deterministic intent-specific variation so consecutive turns do not repeat the same line.
9. Let the user correct labels and exclude private entries from retrieval without editing the journal event.
10. Preserve exact keyword search and prompts if the model is missing, unsupported, or switched off.

## Cold start: fewer than 10 entries

- With zero entries, Sigma introduces the Journal Altar and asks one open capture question. It does not claim to remember the user or offer archive-based patterns.
- With 1–9 entries, it may quote and cite an exact entry, ask a grounded follow-up, or find exact keyword matches. It labels any summary “based on N entries” and makes no recurring-pattern claim.
- Empty retrieval is stated directly. Sigma may offer a date/tag filter or ask the user to add context; it must not fill the gap with an invented anecdote.
- Do not block writing while an embedder downloads or initializes. Exact text, dates, and tags work first.

## Statistical honesty rules

Treat a day-pair (for example, last night's sleep and next day's user-entered mood) as the unit, not individual entries. Deduplicate repeated entries from one day. Do not infer absent values as “no.” Store the source entries and the time window for every computed result.

- Fewer than 10 complete eligible day-pairs: no percentage, trend, or pattern statement. Say “I have N of the observations needed to compare this.”
- At 10–19 complete pairs: the engine may show a descriptive fraction only, e.g. “Low mood appeared after short sleep on 7 of 10 logged pairs (70%). Small sample; this does not show cause.” Do not say “usually,” “predicts,” or “pattern.”
- At 20 or more complete pairs, with at least 8 exposed and 8 comparison days: it may say “This association recurs in the entries I can compare” only if it shows counts, interval/uncertainty, missingness, and contrary examples. Use a 95% Wilson interval for a proportion; implementation and calibration are **UNVERIFIED** until evaluated on representative journal data.
- No causal verb (“causes,” “leads to,” “because”) from an observational journal pattern. Prefer “co-occurred,” “was followed by,” and “in these N logged pairs.”
- A confidence interval that is wide, a subgroup below its minimum, or substantial missingness forces a softer “too uncertain to summarize” response. Do not rank or expose a pattern when that condition fails.
- Weather is usable only if the user entered it or explicitly enabled a local source with a visible provenance marker. No external lookup is part of the zero-cloud design.

All thresholds above are proposed product rules, not validated clinical or statistical guarantees.
