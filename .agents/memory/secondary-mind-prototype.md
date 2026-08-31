---
name: Secondary Mind prototype boundary
description: The prototype's offline behavior and native-implementation boundary.
---

The browser prototype intentionally keeps all demo data local and simulates transcription/OCR/extraction rather than calling a hosted service.

**Why:** The product's differentiator is that private conversation content stays on-device; a browser-local demo makes that trust claim visible without pretending the Android native ML stack is already shipped.

**How to apply:** Preserve the extraction contract, confidence/review state, source traceability, and shared state model when replacing the simulations with Whisper, OCR, and a quantized on-device model.