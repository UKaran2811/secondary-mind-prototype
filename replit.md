# Secondary Mind

An offline-first workspace prototype that turns WhatsApp exports, voice notes, and screenshots into a searchable, confidence-aware task board.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/secondary-mind/src/App.tsx` — browser-local product flow and seeded demo data
- `artifacts/secondary-mind/src/index.css` — visual language, theme tokens, responsive styles
- `artifacts/secondary-mind/.replit-artifact/artifact.toml` — registered web artifact and preview routing

## Architecture decisions

- The prototype keeps entries, extractions, digest state, and settings in localStorage so the offline/privacy promise is demonstrable without a backend.
- The Android-specific Whisper, OCR, and on-device LLM layers are represented by transparent demo simulations; the extraction contract and confidence states are preserved for a later native implementation.
- A single local state model feeds the board, search, source detail, digest, and insights views so the demo never presents disconnected mock data.

## Product

- Import or paste WhatsApp-style text and simulate voice memo transcription or screenshot OCR.
- Review extracted commitments grouped into evolving threads with owner, deadline, urgency, confidence, and exact source traceability.
- Search source content, inspect the original moment, mark work done, and copy a reply draft.
- Keep open commitments first with a separate completed section, switch to a month calendar, and open Google Calendar event templates for recognized dates.
- Explore interruption digest, Office Kit insights, privacy settings, model choice, and confidence threshold controls.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Resetting the demo removes locally captured entries and restores the seeded review item and three-entry onboarding thread.
- The web artifact is intentionally frontend-only for the prototype; no API server or external integration is required to demonstrate the flow.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
