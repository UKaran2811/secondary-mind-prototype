# Secondary Mind — Product Requirements Document (PRD)

## 1. One-line pitch
Secondary Mind turns the WhatsApp exports, voice notes, and screenshots that already flood a phone into a structured, searchable task board — entirely on-device, with nothing ever leaving the phone.

## 2. Problem
Commitments and information get buried inside WhatsApp threads. "Can you send the invoice?" → "did you send it?" → "sent" reads as three disconnected messages, and finding "what did I actually agree to, and by when" means re-reading an entire chat. Existing task apps require manual entry; existing chat-reading tools either need the WhatsApp Business API (setup friction, not built for personal/group chats) or send chat content to a server (a real privacy concern for personal conversations).

## 3. Target users
- **Primary:** small team leads and freelancers coordinating over WhatsApp group chats — e.g. a freelance designer running four client groups who needs to know what she's on the hook for without re-reading everything.
- **Secondary:** students coordinating group assignments over WhatsApp.

## 4. Goals
| ID | Goal |
|---|---|
| G1 | Extract actionable tasks, owners, and deadlines from raw WhatsApp export / voice / screenshots with zero manual tagging |
| G2 | Never let chat content leave the device |
| G3 | Make the system's confidence visible instead of silently wrong |
| G4 | Cut the time spent re-reading chat history to find commitments |

## 5. Non-goals (this build cycle)
- WhatsApp Business API integration or always-on live listening
- Other messaging platforms (Slack, Telegram, iMessage)
- Cloud sync or multi-device access
- General-purpose task manager features beyond what extraction produces (no manual task creation UI)

## 6. Key user stories
- As a user, I share a WhatsApp export into the app and see a board of tasks with owners and deadlines within a minute, no setup.
- As a user, I can search anything mentioned across my chats and get back the exact source message.
- As a user, I can see which extracted tasks the system is unsure about, so I don't act on a wrong deadline.
- As a user, I see three related messages about the same request collapsed into one thread that updates as it progresses, instead of three duplicate cards.
- As a user (stretch), I can mark a task done and get a ready-to-send WhatsApp reply drafted for me.

## 7. Feature scope (MoSCoW)

**Must have — MVP / Red Light core**
Capture (chat export, share sheet, voice memo) · Preprocessing (speech-to-text, OCR) · Extraction with confidence scoring · Local storage with full-text search · Task Board · Second Brain Search · tap-to-source · dedupe/thread-linking

**Should have**
Reply-draft, draft-and-copy version (no auto-send)

**Could have — Green Light stretch**
Office Kit browser dashboard · calendar-aware digest · insights view · reply-draft with deep-linked WhatsApp send

**Won't have — this cycle**
Live notification capture, multi-platform ingestion, cloud sync/backup

## 8. Success metrics

**Demo-day (what judges will actually see):**
- Import → first structured task card visible live, on stage, in under a target you rehearse to
- At least three distinct capture types demoed in one pass: text export, voice, screenshot
- Airplane-mode demo segment proving zero network calls

**Product-sense metrics (for pitch narrative, not measured in 30h):**
- Reduction in time spent searching chat history for a commitment
- Share of extracted tasks a user confirms as accurate, tracked against the confidence score

## 9. Constraints & assumptions
- Android, API 26+, Kotlin + Jetpack Compose
- Fully offline: no network calls anywhere in the Red Light core scope
- Target device: 6GB+ RAM, 2–3GB free storage for model + Whisper
- Built by a small team inside a hackathon timebox — see the companion roadmap for exact sequencing

## 10. Risks
See the risk register in the SRS and the build plan — the two to watch hardest are on-device JNI integration eating the schedule, and the reply-draft's WhatsApp deep link depending on a phone number that `.txt` exports may not carry.

## 11. Timeline
See `Secondary-Mind-Prototype-to-Hackathon-Roadmap.md` for the two-phase plan: a 2-day vibe-coded prototype for idea submission, then the 30-hour hackathon-day build.
