# ReCan Flow

ReCan Flow is a local-first visual AI research workspace. It turns a question into a spatial research graph: decompose it into branches, research each branch with AI, save findings, synthesize findings into an insight, critically challenge that insight, and spin up a new question from the challenge — repeating the loop.

## The research loop

```
Question → AI decomposition → Branches → Research (AI chat) → Findings
  → (select 2+) Synthesis → Insight → Challenge → New Question → …
```

- **Question** — the root of a research thread. "Explore with AI" decomposes it into 3–5 research branches.
- **Branch** — a research direction proposed by AI. "Explore" opens (or creates) its Research node.
- **Research** — a contextual AI chat scoped to one branch. Any assistant reply can be saved as a Finding.
- **Finding** — a saved piece of evidence with provenance back to its question/branch/research.
- **Insight** — created by selecting 2+ Findings and synthesizing them; carries a confidence level.
- **Challenge** — critically stress-tests an Insight (weaknesses, missing evidence, alternative explanation) and can spawn a new Question from its suggested follow-up.
- **Note** / **Text** — freeform annotations, no AI involved.

## Architecture

- **Canvas**: `@xyflow/react`, one node component per kind under `components/workspace/nodes/`. Layout for AI-generated children (branches, findings, insights, new questions) is deterministic and overlap-avoiding (`lib/layout.ts`), not random.
- **State**: a single `nodes`/`edges` pair in `components/workspace/Workspace.tsx`. Node data holds AI status/error inline (no separate loading state tree). Selection lives on XYFlow's own `node.selected`/`edge.selected` fields rather than duplicated state, so click-driven and programmatic selection never disagree.
- **Undo/redo**: `lib/history.ts` — a debounced snapshot stack so a drag or a burst of edits becomes one undo step.
- **AI**: `app/api/ai/route.ts` is the only place that talks to a model. Four actions — `decompose`, `chat`, `synthesize`, `challenge` — each validated with Zod on the way in and the way the model's JSON comes back out. Gemini is primary, Groq is the fallback; if neither key is configured the route returns a clearly-labeled local placeholder rather than pretending research happened. Nothing here ever claims to have browsed the web or fabricates a citation.
- **Persistence**: versioned `localStorage` (`lib/workspace.ts`). Corrupt or old-schema data is discarded in favor of a fresh empty workspace rather than crashing.

## Local setup

```bash
pnpm install
copy .env.example .env.local
pnpm dev
```

Set `GEMINI_API_KEY` and/or `GROQ_API_KEY` in `.env.local`. Without either, AI actions return a local, clearly-labeled fallback instead of a real response. Never expose either key through a `NEXT_PUBLIC_` variable.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Keyboard shortcuts

`V` select · `H` hand/pan (also Space+drag) · `Q` new question · `N` new note · `R` new research (or open the selected branch's) · `F` save the open research reply as a finding · `I` synthesize 2+ selected findings · `Delete`/`Backspace` remove selection · `Ctrl/Cmd+Z` undo · `Ctrl/Cmd+Shift+Z` redo · `Ctrl/Cmd+K` search nodes · `Escape` clear selection / close overlays.

## Current limitations

- No grounded web search: the AI reasons from model knowledge only, and the UI never claims otherwise.
- Single local workspace per browser (no accounts, no multi-workspace switching, no real-time collaboration — Share just copies the URL).
- Desktop-first (1280px+); usable but not polished below ~800px.
