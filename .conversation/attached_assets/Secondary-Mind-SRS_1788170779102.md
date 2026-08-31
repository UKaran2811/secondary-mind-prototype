# Secondary Mind — Software Requirements Specification (SRS)

## 1. Introduction

**1.1 Purpose**
This document specifies the functional and non-functional requirements for Secondary Mind, an offline Android application that converts WhatsApp exports, voice memos, and screenshots into a structured, searchable task board.

**1.2 Scope**
Covers the Red Light core (Capture, Preprocessing, Extraction, Storage, Application UI) and the Green Light stretch layer (Office Kit dashboard, calendar-aware digest, insights view). Live notification capture is specified but explicitly out of build scope until the core is complete.

**1.3 Definitions & acronyms**
| Term | Meaning |
|---|---|
| STT | Speech-to-text |
| OCR | Optical character recognition |
| LLM | Large language model |
| JNI | Java Native Interface — bridges Kotlin/Java to native (C/C++) code |
| FTS | Full-text search (SQLite virtual table) |
| SAF | Storage Access Framework (Android) |
| MVP | Minimum viable product |

**1.4 References**
Internal hackathon architecture doc ("Secondary Mind — architecture and tech stack") and the companion PRD and build-plan documents produced alongside this SRS.

---

## 2. Overall description

**2.1 Product perspective**
Standalone Android application. No backend service, no cloud dependency, no account system.

**2.2 Product functions**
Capture chat/voice/image content → transcribe/OCR → extract structured task data via on-device LLM → store locally with search indexing → present via Task Board and Search UI → (stretch) surface a calendar-aware digest and cross-device dashboard.

**2.3 User characteristics**
Non-technical end users operating the shipped app; a technical audience (hackathon judges) evaluating the build and its offline/privacy claims.

**2.4 Constraints**
Fully offline; on-device compute only; Kotlin/Compose/Android-only; hackathon timebox (2-day prototype + 30-hour build).

**2.5 Assumptions & dependencies**
WhatsApp's `.txt` export format remains stable; ML Kit, Whisper Tiny, and the chosen quantized LLM run acceptably on a 6GB+ RAM Android device without further optimization.

---

## 3. Functional requirements

### FR-1 — Capture
- **FR-1.1** The system shall accept a WhatsApp `.txt` chat export selected via the Storage Access Framework.
- **FR-1.2** The system shall accept shared text, image, or audio content via the Android Share Sheet (`ACTION_SEND`).
- **FR-1.3** The system shall support in-app voice memo recording via `MediaRecorder`.
- **FR-1.4** *(Stretch, Green Light)* The system shall optionally capture live notification content via `NotificationListenerService`.

### FR-2 — Preprocessing
- **FR-2.1** The system shall transcribe voice input to text using Whisper Tiny via `whisper.cpp`.
- **FR-2.2** The system shall extract text from images using ML Kit Text Recognition v2.
- **FR-2.3** The system shall strip WhatsApp export formatting (timestamps, sender prefixes) before content reaches the extraction model.

### FR-3 — Extraction
- **FR-3.1** The system shall produce one structured JSON object per entry containing `task`, `owner`, `deadline`, `status`, `topic_tags`, `urgency`, and `confidence`.
- **FR-3.2** The system shall run extraction on-device using a quantized Gemma 2B-it or Phi-3 Mini model.
- **FR-3.3** If the model's output fails to parse as valid JSON, the system shall fall back to a regex/heuristic extraction pass.
- **FR-3.4** The system shall flag any extraction below a configurable confidence threshold as "needs review" rather than presenting it as confirmed fact.
- **FR-3.5** The system shall group related entries into a shared `thread_id` when they overlap in `topic_tags` within a rolling time window.
- **FR-3.6** Extraction shall run asynchronously with a visible processing state, without blocking the UI thread.

### FR-4 — Storage
- **FR-4.1** The system shall persist raw entries (`id`, `source_type`, `raw_text`, `transcribed_text`, `timestamp`, `sender`) in a local Room database.
- **FR-4.2** The system shall persist extraction results (`entry_id` FK, `task`, `owner`, `deadline`, `status`, `topic_tags`, `urgency`, `confidence`, `thread_id`) linked to their source entry.
- **FR-4.3** The system shall maintain an FTS4/FTS5 index over `raw_text` and `topic_tags`.
- **FR-4.4** The system shall make zero network calls anywhere in this layer.

### FR-5 — Application UI
- **FR-5.1** The system shall present a Task Board listing extracted tasks, grouped by thread where applicable.
- **FR-5.2** The system shall present a Second Brain Search view supporting free-text query over stored content.
- **FR-5.3** The system shall let the user tap any task card to view its original source message or transcript.
- **FR-5.4** The system shall visually distinguish "needs review" cards from confirmed ones.
- **FR-5.5** *(Should)* The system shall let a user mark a task done and generate a draft reply.
- **FR-5.6** *(Could, Green Light)* The system shall offer to open WhatsApp with the draft reply pre-filled when a recipient number is available.
- **FR-5.7** The system shall reflect new or updated data automatically via reactive state (`Flow`/`StateFlow`), with no manual refresh action.

### FR-6 — Green Light stretch
- **FR-6.1** *(Could)* The system shall expose stored data over the local network via an on-device Ktor server, readable from a browser dashboard.
- **FR-6.2** *(Could)* The system shall read calendar events via `ContentResolver`/`CalendarContract` and hold back medium-urgency notifications during meeting blocks, releasing them as a post-meeting digest.
- **FR-6.3** *(Could)* The system shall surface aggregate insights: tasks per owner, average time-to-done, and count of notifications held.

---

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Extraction shall complete within roughly 5–15 seconds per entry on a 6GB+ RAM device |
| NFR-2 | Zero network calls anywhere in the Red Light core scope — the offline claim must hold under an airplane-mode test |
| NFR-3 | Combined app + model + Whisper footprint shall not exceed ~3GB on-device storage |
| NFR-4 | Malformed or low-confidence model output must never populate the Task Board silently as confirmed fact |
| NFR-5 | A non-technical user shall be able to go from "share a chat export" to "see tasks" in one continuous flow, with no manual field entry |
| NFR-6 | Platform: Android API 26+, Kotlin, Jetpack Compose (Material 3) |
| NFR-7 | Verified on a device with 6GB+ RAM and 3GB+ free storage — not the demo phone's last available space |

---

## 5. External interface requirements

**5.1 User interfaces** — Jetpack Compose, Material 3, bottom navigation with Task Board and Search tabs; a source-detail screen reached via tap-through.
**5.2 Hardware interfaces** — device microphone (voice capture), device storage (SAF export/import).
**5.3 Software interfaces** — Android Share Sheet, ML Kit Text Recognition v2, `whisper.cpp`, MLC-LLM or `llama.cpp` (JNI), Room/SQLite; Ktor for the Green Light dashboard.
**5.4 Data interfaces** — WhatsApp `.txt` export format as input; the internal JSON extraction contract below as the extraction interface.

---

## 6. Data requirements

**`entries` table**
`id, source_type, raw_text, transcribed_text, timestamp, sender`

**`extractions` table**
`entry_id (FK), task, owner, deadline, status, topic_tags, urgency, confidence, thread_id`

**Extraction JSON contract**
```json
{
  "task": "string | null",
  "owner": "string | null",
  "deadline": "string | null",
  "status": "pending | done | null",
  "topic_tags": ["string"],
  "urgency": "high | medium | low",
  "confidence": "number (0.0–1.0)"
}
```

---

## 7. Appendix — glossary
- **Red Light scope** — features buildable and testable without depending on a laptop-only workflow; the non-negotiable MVP.
- **Green Light scope** — features that assume laptop access and are only attempted once the Red Light scope is stable.
- **Needs review** — a UI state for any extraction whose confidence falls below the configured threshold.
