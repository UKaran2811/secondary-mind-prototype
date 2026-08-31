# Secondary Mind — prototype-to-hackathon roadmap

Two phases: a 2-day vibe-coded prototype for the idea-submission gate, then the real build on hackathon day.

**One note before the schedule:** your build spine graphic listed a 25h window (Sat 11:00 → Sun 12:00, 19h pure build). This roadmap uses the 30h you just gave for hackathon day instead — I've scaled the same 55% Red / 45% Green ratio and the same ~76% pure-build-to-total-window ratio onto 30h rather than re-deriving it from scratch. If the real number is closer to 25h, the phase *order* below still holds — just compress the overnight window and the two Red stretches proportionally.

---

## Phase 1 — idea-submission prototype (2 days, vibe-coding)

**Purpose:** a convincing, demoable core loop for the submission gate — not the final architecture. Judges at this stage are evaluating the idea and whether it works at all, not whether it's on-device yet.

**The one deliberate shortcut:** call a hosted LLM API for extraction instead of integrating the on-device quantized model. JNI + MLC-LLM/llama.cpp integration is the single most time-expensive, highest-risk piece of the real architecture — not worth spending 2 prototype days on when a hosted API call proves the exact same UX. Swap it for the real on-device pipeline on hackathon day. Everything else — the JSON contract, the UI, the confidence/dedupe concepts — carries over unchanged.

### Day 1
| Block | Time | Focus |
|---|---|---|
| Morning | 2–3h | Lock one realistic, anonymized demo dataset — a WhatsApp export, 1–2 voice clips, 1–2 screenshots. Lock the JSON extraction contract exactly as written in the SRS; don't redesign it twice. |
| Midday–afternoon | 4–5h | Vibe-code the core loop: project scaffold → import flow → hosted LLM call using the locked JSON contract → render results as a plain list |
| Evening | 2h | Minimal Task Board styling; run the full loop against 5+ different sample messages to catch obvious breakage early |

### Day 2
| Block | Time | Focus |
|---|---|---|
| Morning | 3h | Add Second Brain Search over the same data, add a confidence badge / "needs review" state, add tap-to-source |
| Afternoon | 2–3h | Add one real example of thread-grouping — doesn't need to be algorithmically robust yet, just needs to land in the recorded demo |
| Late afternoon | 2h | Record the demo video / screenshots; write submission copy straight from the PRD's pitch, problem statement, and MoSCoW list |
| Evening | buffer 1–2h | Final fixes, submit |

---

## Phase 2 — hackathon day (30h)

| Block | Elapsed hours | Duration | Light | Focus |
|---|---|---|---|---|
| Opening sprint | H0.0–1.0 | 1.0h | 🟢 Green | Repo init on the real stack, dependencies (Room, Compose, ML Kit, whisper.cpp/MLC-LLM scaffold), re-confirm the JSON contract and DB schema carried over from Phase 1 |
| Red stretch 1a | H1.0–4.0 | 3.0h | 🔴 Red | Re-test the prototype's sample dataset against real constraints, refine prompt wording for the on-device model, sketch any UI gaps found in Phase 1 |
| Breather 1 | H4.0–4.5 | 0.5h | 🟢 Green | Push code, unblock |
| Red stretch 1b | H4.5–7.5 | 3.0h | 🔴 Red | Finalize regex fallback rules and dedupe time-window thresholds, write pitch narrative |
| Mentor round | H7.5–8.5 | 1.0h | 🟢 Green | Demo current state, get feedback on the extraction schema and dedupe heuristic |
| Red stretch 2a | H8.5–12.0 | 3.5h | 🔴 Red | Content prep, confidence-threshold calibration against sample outputs |
| Breather 2 | H12.0–12.5 | 0.5h | 🟢 Green | Sync, unblock |
| Red stretch 2b | H12.5–15.5 | 3.0h | 🔴 Red | Lock the prioritized backlog for the overnight push |
| Buffer/meal | H15.5–17.0 | 1.5h | — | Off the split |
| **Overnight window** | H17.0–22.5 | 5.5h | 🟢 Green | **The core engineering block.** Swap Phase 1's hosted LLM call for the real on-device Gemma/Phi-3 pipeline via MLC-LLM or llama.cpp JNI, wire Whisper + ML Kit, implement the confidence field and regex fallback for real, implement dedupe/thread-linking for real, finish Room schema + FTS, wire Task Board + Search + tap-to-source, StateFlow + WorkManager |
| Buffer/rest | H22.5–24.0 | 1.5h | — | Sleep, food — off the split |
| Demo polish | H24.0–26.0 | 2.0h | 🟢 Green | Fix overnight bugs, Material 3 polish, final APK build, airplane-mode offline test, rehearse pitch, attempt one Green Light stretch item only if the core is fully stable |
| Buffer + evaluation | H26.0–30.0 | 4.0h | — | Submission, judging — off the split |

Totals: 12.5h Red + 10.5h Green = 23h pure build, inside the 30h window.

---

## Carry-over checklist — Phase 1 into Phase 2

- [ ] Reuse the exact JSON contract from Phase 1 — don't redesign the schema on hackathon day
- [ ] Reuse the same sample dataset for consistent demo storytelling across submission and final pitch
- [ ] Swap the hosted-LLM call → on-device Gemma/Phi-3 + MLC-LLM/llama.cpp — the single biggest engineering delta between the two phases, and the reason it's scheduled first in the overnight window
- [ ] Swap any mocked confidence/dedupe logic → the real heuristics specified in the SRS
- [ ] Carry the Phase 1 UI shell forward rather than rebuilding it from scratch — polish, don't restart
