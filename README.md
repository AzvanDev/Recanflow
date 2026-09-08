# ReCan Flow

ReCan Flow is a local-first visual AI research workspace. It turns questions into a spatial map of conversations, research threads, evidence, notes, and synthesis.

## Features

- Infinite XYFlow canvas with pan, zoom, connections, dragging, marquee selection, focus mode, and compact floating controls.
- Four node types: main question, conversation, research, and note.
- Contextual AI panel for branching, conversation, research briefs, and multi-node synthesis.
- Local workspace persistence with defensive recovery from malformed saved data.
- Global search (`Ctrl/Cmd + K`), keyboard node creation (`N`), research (`R`), selection clearing, and deletion.
- Responsive canvas-first layout and first-run onboarding.

## Architecture

The UI is a Next.js client workspace backed by XYFlow. Workspace data persists locally in the browser; API keys remain server-only in `app/api/ai/route.ts`. Gemini is used when `GEMINI_API_KEY` is configured. Without credentials—or when Gemini is unavailable—the app clearly returns a local non-research fallback rather than claiming live web research or fabricated citations.

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set `GEMINI_API_KEY` in `.env.local` to enable Gemini. `GROQ_API_KEY` is reserved for a future provider adapter. Do not expose either key through a `NEXT_PUBLIC_` environment variable.

## Verification

```bash
npm run typecheck
npm run build
```

## Deployment

Deploy directly to Vercel. Add server-side environment variables in the Vercel project settings. Browser persistence is intentionally local and works independently of the serverless environment.

## Current limitations

This V1 does not present web research as completed without a connected grounded-search service. Gemini responses are useful for AI exploration but are marked as non-researched unless a dedicated search integration has retrieved and validated real sources. A production research provider and IndexedDB repository can be added behind the existing workspace/AI boundaries.
