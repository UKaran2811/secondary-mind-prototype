---
name: Secondary Mind prototype boundary
description: The prototype's offline behavior and native-implementation boundary.
---

The browser prototype intentionally keeps all demo data local and simulates transcription/OCR/extraction rather than calling a hosted service.

**Why:** The product's differentiator is that private conversation content stays on-device; a browser-local demo makes that trust claim visible without pretending the Android native ML stack is already shipped.

**How to apply:** Preserve the extraction contract, confidence/review state, source traceability, and shared state model when replacing the simulations with Whisper, OCR, and a quantized on-device model.

Digest actions should operate on linked extraction IDs rather than maintaining a second copy of task titles or urgency.

**Why:** A separate digest list can silently drift from the task board when a task is completed, captured, dismissed, or held.

**How to apply:** Derive Digest rows from the shared extraction state and persist only presentation choices such as held or dismissed.