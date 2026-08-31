# Secondary Mind — final build plan
**Pune city round · Sat 11:00 → Sun 12:00 · 25h window · 19h pure build**

This compiles the original architecture doc, folds all six proposed improvements directly into the layers they belong to (rather than leaving them as a separate "nice to have" list), and maps the resulting build into your Red Light / Green Light build spine.

---

## 1. Working assumption — please sanity-check this

The build spine says Red Light is "iQOO phone only, every route through Office Kit, laptops restricted," while the app itself is a Kotlin/Compose Android app that fundamentally needs Android Studio on a laptop to compile. The only reading that reconciles both facts: **Red Light hours are for phone-first work — dogfooding whatever was compiled in the last Green Light session, capturing real test content, refining prompts and copy, and planning — not for writing Kotlin.** Green Light hours are when the laptop comes out for actual compilation.

If your venue's rule is different (e.g. you're allowed a cloud IDE like GitHub Codespaces or Replit through the phone's browser during Red Light), shift the Layer 1 capture-intent work earlier into Red Light — everything else in this plan still holds.

---

## 2. Final architecture

One extraction pipeline, three consumer-facing views (Task Board, Second Brain Search, Interruption Digest) — no view owns its own data path. The diagram above shows the five-stage flow; the table below is the detail, with each of the six improvements folded into its layer instead of bolted on as an afterthought.

| Layer | Core job | Improvements folded in | Tier |
|---|---|---|---|
| 1. Capture | WhatsApp `.txt` export via SAF, universal Share Sheet intake, `MediaRecorder` voice memos | — | Red |
| 2. Preprocessing | Whisper Tiny STT, ML Kit OCR, export-format cleanup | — | Red |
| 3. Extraction | Gemma 2B-it / Phi-3 Mini structured JSON extraction, regex/heuristic fallback | **Confidence flag** (new JSON field, drives "needs review" state) · **Dedupe/thread-linking** (groups related messages into one evolving task) | Red |
| 4. Storage | Room over SQLite, FTS4/FTS5 search index | Schema extended with `confidence` and `thread_id` columns to carry the two extraction-layer improvements through | Red |
| 5. Application UI | Task Board, Second Brain Search, Compose Navigation | **Tap to see source message** (deep link from any card to its raw `raw_text`/transcript) · **Close the loop with a reply draft** (mark done → drafted WhatsApp reply → intent hand-off) | Red core UI + one Green-gated action |
| 6. Green Light extras | — | **Office Kit** (Ktor server + React dashboard) · **Calendar-aware digest** (holds back medium-urgency pings during meetings) · **Lightweight insights view** (assignee load, time-to-done, notifications silenced) | Green |

Live capture via `NotificationListenerService` stays deferred past Red Light, exactly as scoped originally — parsing live notifications mid-demo is the single riskiest thing to depend on.

**Why the reply-draft sits split across tiers:** drafting the text is a Red-safe UI action (it only touches local extraction data), but the WhatsApp handoff depends on having a real phone number for that contact, which a `.txt` export usually doesn't retain — see the risk register. Build the draft-and-copy version first; treat the deep-linked `wa.me` handoff as the Green-light-if-time upgrade.

---

## 3. Complete tech stack

| Category | Component | Technology | Notes |
|---|---|---|---|
| Language | App language | Kotlin | — |
| IDE | Development | Android Studio | Green Light only |
| Min SDK | Platform floor | API 26+ | Required for ML Kit / Compose compatibility |
| **Capture** | WhatsApp ingestion | Chat export (`.txt`) via Storage Access Framework | Avoids WhatsApp Business API and Notification Listener permission friction entirely |
| Capture | Universal capture | Android Share Sheet (`ACTION_SEND` intent filter) | One integration point covers voice, photo, screenshot from any app |
| Capture | Voice input | `MediaRecorder` | In-app quick-record button |
| Capture | Live capture | `NotificationListenerService` | Deferred — Green Light / stretch only |
| **Preprocessing** | Speech-to-text | Whisper Tiny via `whisper.cpp` | Fork an existing Android wrapper rather than writing JNI bindings cold. ~1–3s per short clip on mid-range hardware |
| Preprocessing | OCR | ML Kit Text Recognition v2 | On-device, no model management, low integration risk |
| Preprocessing | Text cleanup | Small regex pass | Strips WhatsApp timestamps/sender prefixes before the model sees text |
| **Extraction** | LLM | Gemma 2B-it or Phi-3 Mini, quantized (Q4_K_M GGUF, ~1.5–2.2GB) | One structured prompt per entry, forced JSON |
| Extraction | Runtime | MLC-LLM's Android app as a scaffold, or `llama.cpp` with JNI for more control | ~5–15s per entry — run async with a visible processing state |
| Extraction | JSON contract | `task`, `owner`, `deadline`, `status`, `topic_tags`, `urgency`, **`confidence`** (new) | Confidence field is the cheapest addition in this whole plan and buys the most demo credibility |
| Extraction | Fallback | Regex/heuristic pass (date patterns, `@mention`) | Cheap insurance if JSON parsing fails live |
| Extraction | Dedupe/thread linking | Heuristic: same `topic_tags` overlap + rolling time window (e.g. 6h) between entries → same `thread_id` | No embeddings needed for MVP; upgrade to on-device sentence similarity only if the overnight window has slack |
| **Storage** | Database | Room over SQLite | Two tables: `entries` (id, source_type, raw_text, transcribed_text, timestamp, sender), `extractions` (entry_id FK, task, owner, deadline, status, topic_tags, urgency, confidence, thread_id) |
| Storage | Search | FTS4/FTS5 virtual table over `raw_text` + `topic_tags` | Powers Second Brain Search |
| Storage | Network | None | Fully offline — genuine trust signal for WhatsApp content, worth stating outright in the pitch |
| **UI** | Framework | Kotlin + Jetpack Compose (Material 3) | — |
| UI | Navigation | Compose Navigation, bottom bar, 2 tabs (Task Board, Search) | Add a detail route for "tap to see source" |
| UI | State | ViewModel + StateFlow observing Room via Flow | New entries appear automatically — no manual refresh |
| UI | Concurrency | `Dispatchers.IO` coroutines / WorkManager | Keeps UI thread free during multi-second extraction |
| UI | Loop-closing action | `Intent(ACTION_SEND)` to WhatsApp, or `wa.me/<number>?text=` deep link | See risk register — number availability is the gating factor |
| **Green Light extras** | Office Kit | Ktor embedded on-device server + lightweight React dashboard | Bigger-screen view of Room data, read-only |
| Green Light extras | Calendar-aware digest | Android `ContentResolver` over `CalendarContract` | No external API needed — holds back medium-urgency notifications during meeting blocks |
| Green Light extras | Insights view | Aggregation queries over Room (`COUNT` by owner, `AVG` time-to-done, count of notifications silenced) | Good fit for the Office Kit dashboard if you build it |
| **Hardware** | Storage headroom | 2–3GB for model + Whisper Tiny | Test on a phone with real spare space, not the demo phone's last 500MB |
| Hardware | RAM | 6GB+ recommended | Budget phones may struggle running a 2–4B model alongside Whisper + OCR concurrently |

---

## 4. Scope tiers — what's non-negotiable vs. stretch

**Red Light core (build this no matter what):**
Layers 1–5 as scoped, plus confidence flag, tap-to-source, and dedupe/thread-linking. This is a complete, demoable, trustworthy product on its own — it reads real WhatsApp exports, transcribes voice, OCRs screenshots, extracts structured tasks with visible confidence, links related messages into threads, and lets you tap any card back to its source.

**Green Light / stretch (only once the core above is solid):**
In payoff-per-hour order —
1. Office Kit dashboard (bigger screen for mentors/judges, "time saved" stat)
2. Reply-draft loop-closing (drafted text now, deep-linked send later)
3. Calendar-aware digest
4. Insights view

Don't start #2–4 until #1's core is stable — this mirrors the original doc's own instinct ("only touch Office Kit if Red Light is done with hours to spare").

---

## 5. Build-spine roadmap — Pune city round

Your spine gives ~10.5h Red + ~8.5h Green = 19h pure build, inside a 25h Sat 11:00 → Sun 12:00 window (the ~6h gap is meals/breaks/eval rounds, which sit outside the split). Below is one consistent way to place that — adjust the clock times to whatever your actual mentor-round and eval-round schedule turns out to be; the durations and breather placement are what matter.

| Block | Time (illustrative) | Duration | Light | Focus |
|---|---|---|---|---|
| Opening sprint | Sat 11:00–12:00 | 1.0h | 🟢 Green | Repo init, package structure, dependencies (Room, Compose, ML Kit, clone the whisper.cpp/MLC-LLM scaffold), lock the JSON extraction contract (incl. `confidence`, `thread_id`), assign layer ownership |
| Red stretch 1a | Sat 12:00–14:30 | 2.5h | 🔴 Red | Gather/anonymize real WhatsApp export samples, record test voice memos, capture OCR test screenshots, draft the extraction prompt wording, sketch Task Board / Search screens |
| Breather 1 | Sat 14:30–15:00 | 0.5h | 🟢 Green | Unblock anything from the morning, push code, resolve build errors |
| Red stretch 1b | Sat 15:00–17:30 | 2.5h | 🔴 Red | Finalize regex fallback rules, define the dedupe time-window/overlap thresholds on paper, write pitch narrative draft, review opening-sprint code via GitHub mobile |
| Mentor round | Sat 17:30–18:30 | 1.0h | 🟢 Green | Demo current state, get feedback on the extraction schema and dedupe heuristic, fix quick blockers |
| Red stretch 2a | Sat 18:30–21:30 | 3.0h | 🔴 Red | Continue content prep, refine confidence-threshold expectations against sample outputs, write "tap to see source" copy |
| Breather 2 | Sat 21:30–22:00 | 0.5h | 🟢 Green | Sync, unblock, prep for the overnight push |
| Red stretch 2b | Sat 22:00–00:30 | 2.5h | 🔴 Red | Finalize the prioritized backlog for the overnight build, last content/prompt tweaks |
| **Overnight window** | Sat 00:30–04:30 | 4.0h | 🟢 Green | **Heaviest block.** Wire Layers 2–5 end to end: Whisper.cpp + ML Kit integration, Gemma/Phi-3 via MLC-LLM/llama.cpp JNI, JSON extraction with confidence + regex fallback, Room schema, FTS index, Task Board + Search UI, tap-to-source, dedupe/thread-linking, StateFlow wiring, WorkManager background pipeline |
| Buffer/rest | Sun 04:30–06:00 | 1.5h | — | Sleep, food — outside pure build time |
| Demo polish | Sun 06:00–07:30 | 1.5h | 🟢 Green | Fix overnight bugs, Material 3 polish, final APK build, offline test (airplane mode), rehearse the pitch, attempt one stretch item only if the core is fully stable |
| Buffer + evaluation | Sun 07:30–12:00 | 4.5h | — | Submission, judging rounds — outside the split |

Totals check out: 10.5h Red (2.5+2.5+3.0+2.5) + 8.5h Green (1.0+0.5+1.0+0.5+4.0+1.5) = 19h pure build, inside the 25h window.

---

## 6. Risk register

| Risk | Why it matters | Mitigation |
|---|---|---|
| JNI bindings for `whisper.cpp`/`llama.cpp` eat the overnight window | Building from scratch is the single biggest time sink in the whole stack | Fork an existing wrapper/sample app rather than starting cold — stated explicitly in the source doc for a reason |
| Model JSON output fails to parse live | Silent failure looks worse than a visible one during judging | Regex/heuristic fallback is mandatory, not optional — keep it in Red stretch planning time |
| Wrong deadline/owner shown as fact | A confidently wrong Task Board card is worse than the app admitting uncertainty | Confidence field + "needs review" badge below a threshold (e.g. <0.6) |
| Reply-draft can't find the right WhatsApp number | `.txt` exports usually carry names, not numbers, so a `wa.me` deep link may have nothing to target | Ship the draft-and-copy version first (works with names alone); treat the deep-linked send as best-effort only when a number is present |
| Demo phone runs out of storage mid-event | 2–3GB for model + Whisper is not trivial | Test on a device with real spare headroom well before Saturday, not the phone with 500MB free |
| Budget/older phones can't hold model + Whisper + OCR in memory together | Silent slowdowns or crashes during a live demo | Target 6GB+ RAM test device; if the demo phone is weaker, keep OCR/STT sequential rather than concurrent |
| Live capture (`NotificationListenerService`) breaks mid-demo | Real-time notification parsing is inherently fragile | Stays out of scope entirely until Red Light core is fully done — no exceptions |

---

## 7. Demo & pitch checklist

- Airplane-mode test: confirm zero network calls anywhere in the Red Light scope, and say so explicitly in the pitch — it's a real trust signal given the content is WhatsApp data
- At least one "needs review" card visible in the demo data — showing the system knows its own limits reads better than a flawlessly clean board
- One deduped thread card (3+ related messages collapsed into one evolving status) — stronger visual than three stale duplicates
- Tap-through from a Task Board card to its source message, live, in front of judges
- If Office Kit made it in: the "time saved from interruptions" stat ready on the bigger screen
