# Secondary Mind

**The commitments buried in your conversations, finally visible.**

An offline-first workspace prototype that turns WhatsApp exports, voice notes, and screenshots into a searchable, confidence-aware task board entirely in the browser, entirely on-device.

Built for **iQOO Hack Pune**. This repo is the browser-based prototype that validates the product experience — board, search, digest, calendar export ahead of the native, on-device Android build.

---

## Table of contents

- [What it does](#what-it-does)
- [Why it's built this way](#why-its-built-this-way)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [What's real vs. simulated](#whats-real-vs-simulated)
- [Resetting the demo](#resetting-the-demo)
- [Team](#team)
- [License](#license)

---

## What it does

- Import or paste WhatsApp-style text, or simulate a voice memo transcription and a screenshot OCR capture.
- Review extracted commitments, grouped into evolving threads with an **owner**, **deadline**, **urgency**, **confidence score**, and a link back to the exact source message.
- Search across every captured source, inspect the original moment, mark work done, and copy a reply draft.
- Work the board with open commitments first and completed items kept separate; switch to a month calendar and open Google Calendar event templates for recognized dates.
- Explore the interruption digest, Office Kit insights, privacy settings, model choice, and confidence-threshold controls.

## Why it's built this way

Secondary Mind's core claim is that private conversation content never leaves the device. The prototype is built to make that claim demonstrable rather than asserted:

- **No backend required to run the demo.** Entries, extractions, digest state, and settings all live in the browser's `localStorage`. There's nothing to upload and nothing to leak.
- **The ML layers are honest simulations, not fake data.** Whisper transcription, screenshot OCR, and on-device LLM extraction are represented by transparent, clearly-labeled simulations in this build. They preserve the exact extraction contract owner, deadline, urgency, confidence, source traceability that the native Android implementation (Whisper Tiny, ML Kit, Gemma 2B / Phi-3 running on the Snapdragon NPU) will fill in.
- **One shared state model** feeds the board, search, source detail, digest, and insights views, so the demo never shows disconnected mock data between screens.

## Tech stack

| Layer | Tooling |
|---|---|
| Monorepo | pnpm workspaces, Node.js 24, TypeScript 5.9 |
| Frontend (prototype) | React 19, Vite 7, Tailwind CSS 4, shadcn/ui on Radix primitives, wouter, TanStack Query, Framer Motion, React Hook Form, Recharts |
| API server | Express 5, Pino logging (scaffolded — see [status](#whats-real-vs-simulated)) |
| Database | PostgreSQL + Drizzle ORM (schema not yet defined) |
| Validation | Zod, drizzle-zod |
| API contract | OpenAPI 3.1 spec, client + Zod schemas generated with Orval |
| Build | esbuild (API server), Vite (frontend) |
| Hosting/dev | Replit (`.replit` config: autoscale deployment, PNPM workspace agent) |

## Repository layout

```
.
├── artifacts/
│   ├── secondary-mind/       # The prototype — the real product demo
│   │   └── src/App.tsx       #   single shared state model + all views
│   ├── api-server/           # Express API skeleton (health check only so far)
│   └── mockup-sandbox/       # Internal design/mockup sandbox, not shipped
├── lib/
│   ├── api-spec/             # OpenAPI 3.1 source of truth (openapi.yaml)
│   ├── api-client-react/     # Orval-generated React Query client + schemas
│   ├── api-zod/              # Orval-generated Zod validation types
│   └── db/                   # Drizzle ORM + Postgres schema (currently empty)
├── scripts/                  # Workspace utility scripts (post-merge hook, etc.)
├── attached_assets/          # Reference images
├── pnpm-workspace.yaml       # Workspace packages + dependency catalog
└── replit.md                 # Project notes (run commands, architecture decisions)
```

## Getting started

**Prerequisites:** Node.js 24, [pnpm](https://pnpm.io) (the workspace refuses `npm`/`yarn` installs see the `preinstall` script in `package.json`).

```bash
pnpm install
```

Run the prototype (the part you actually want to demo):

```bash
pnpm --filter @workspace/secondary-mind dev
```

Run the API server (optional a health-check skeleton, not required for the prototype):

```bash
pnpm --filter @workspace/api-server dev   # serves on port 5000
```

The API server and the `db` package need a Postgres connection string:

```bash
export DATABASE_URL="postgres://..."
```

## Available scripts

| Command | What it does |
|---|---|
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm run build` | Typecheck, then build every package that defines a `build` script |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate the API client and Zod schemas from `openapi.yaml` |
| `pnpm --filter @workspace/db run push` | Push Drizzle schema changes to the database (dev only) |
| `pnpm --filter @workspace/secondary-mind dev` | Run the prototype locally |

## What's real vs. simulated

**Built and working, in the browser:**
- Board with threaded commitments, full-text search, daily digest with hold & release, month calendar, Google Calendar export templates, privacy/model/confidence settings.

**Scaffolded but not yet the point of this repo:**
- The Express API server currently exposes a single `/api/healthz` route.
- The Postgres schema (`lib/db/src/schema`) is an empty template no tables defined yet.
- The OpenAPI spec (`lib/api-spec/openapi.yaml`) only documents the health check.

These exist so the eventual backend has a contract-first shape to grow into; none of them are required to run or demo the prototype today.

**Not yet real — simulated in this build, to become native during the hackathon:**
- Whisper Tiny voice transcription
- ML Kit screenshot OCR
- On-device LLM extraction (Gemma 2B / Phi-3)

## Resetting the demo

Resetting removes any locally captured entries and restores the seeded review item plus a three-entry onboarding thread useful for giving a clean demo without reinstalling anything.

## Team

| | |
|---|---|
| **Karan Uchadiya** | Storage, UI & on-device pipeline |
| **Ronak Bharodiya** | Capture & permissions |
| **Kashyap Bhanderi** | AI extraction & threading |

## License

MIT
