# ReCan Flow — Project Context

Source of truth for future work on this codebase. Describes what actually exists in the code today, not what was planned. Update this file when behavior changes materially.

## 1. Purpose & Product Vision

ReCan Flow is a visual AI research workspace: an infinite canvas (built on `@xyflow/react`) where a user starts from a question and grows a branching map of AI-generated answers, follow-up questions, debates, text notes, and research material — instead of losing that structure across disconnected chat tabs. The guiding principle across every feature: **the underlying end-to-end workflow must actually work with real data** — no feature is "done" just because a button or panel exists, and nothing is ever fabricated (sources, papers, citations, authors) when a real provider is available.

## 2. Architecture & Main Technologies

- **Next.js 15** (App Router) + **React 19** + **TypeScript**, package manager **pnpm**.
- **`@xyflow/react`** for the canvas (nodes, edges, pan/zoom, minimap, selection).
- **Zod** for all API request/response validation.
- No database — **`localStorage`** is the only persistence layer (see §12).
- Client structure:
  - `components/workspace/Workspace.tsx` — the central orchestrator. Owns all canvas state (`nodes`, `edges` via `useNodesState`/`useEdgesState`), every AI-backed action (explore, debate, research search, etc.), keyboard shortcuts, and workspace switching. This file is large and is the first place to look for "how does X work."
  - `components/workspace/nodes/*.tsx` — one component per `NodeKind`.
  - `components/workspace/AIResearchPanel.tsx` — the right-side contextual panel; renders a different view per selected node kind.
  - `components/workspace/OpenResearchPortal.tsx` — a separate full-panel overlay (mutually exclusive with `AIResearchPanel`) for the research finder.
  - `lib/types.ts` — canonical shared types: `NodeKind`, `FlowNodeData`, `NodeAction`, `ChatMessage`, etc.
  - `lib/layout.ts` — deterministic, collision-avoiding node placement (no physics/force layout).
  - `lib/workspace.ts` — localStorage read/write, multi-workspace index, `newId()`.
  - `lib/history.ts` — debounced undo/redo.
- Server structure:
  - `app/api/ai/route.ts` — single endpoint, discriminated-union `action` field, handles every LLM call (decompose, chat, debate, selection ask/summarize, document analyze/chat). Falls back Gemini → Groq → local placeholder text if no key is configured.
  - `app/api/youtube/route.ts` — YouTube Data API v3 search.
  - `app/api/research/route.ts` — OpenAlex paper search.
  - `app/api/research/upload/route.ts` — PDF/DOCX/TXT text extraction (no AI call).
  - `lib/providers/{tavily,youtube,openalex}.ts` — thin real-API wrappers, never synthesize data.

## 3. UI / Visual Design Principles

- Clean white/near-white surfaces, subtle borders, rounded corners, a single restrained purple accent (`#7355e9`).
- Canvas nodes are compact cards (`NodeShell` in `nodes/shared.tsx`: icon + uppercase kind label + content + top/bottom `Handle`s). Plain **Text** nodes are the one exception — deliberately borderless/lightweight, Figma/Miro-style, no card chrome.
- The bottom toolbar (`Toolbar.tsx`) is the single home for canvas tools and tool-mode buttons (Select, Hand, Text) and creation actions (Question, Note, Research, Text). Contextual bars (`SelectionBar`, `TextFormatBar`) float **directly above** the toolbar, never beside a node, and appear/disappear based on selection state.
- The right-side panel (`AIResearchPanel` or `OpenResearchPortal`) is the only place for longer content, chat threads, and multi-step detail. Canvas nodes themselves stay compact; anything long lives in the panel or a bounded, scrollable in-node section (e.g. Debate's expanded thread).
- Minimap is intentionally small (96×64px, bottom-left) with an explicit close/reopen toggle — not a large panel.
- No large dashboards, no heavy animation, no glassmorphism.

## 4. Completed Features

- Question → Answer → Follow-up → Branch (core loop)
- Sources (Tavily) + Related Videos (YouTube) on Answer nodes
- Select multiple nodes → Ask AI / Summarize → Result node
- Debate (Argue For/Against, conversational, sourced) as a single expandable node
- Text tool (Heading/Subheading/Body, bold/italic/align/size/color, resizable, bottom-bar formatting controls)
- Open Research (real paper search + upload, "Add to Flow" into a compact Research Branch)
- Legacy/independent: standalone Research chat node (`research` kind, reached via Toolbar "New research" or a `branch` node's "Open research"), Finding → Synthesize → Insight → Challenge, multi-workspace management, undo/redo, command palette (⌘K)

## 5. Question → Answer → Follow-up → Branch Behavior

- A `question` node has a title (the question text) and, once explored, an `answer` field (used only as a "has this been answered" flag for its own UI) plus a connected `answer`-kind child node holding the real answer text.
- Clicking **Explore with AI** calls `action: "decompose"` → `{ answer, branches, sources }`. This creates (or, on retry, updates) exactly one `answer` node connected below the question, and kicks off a YouTube lookup for that node.
- The `answer` node carries `suggestions` (3–5 follow-up questions) as **data only** — they are not canvas nodes until clicked. Clicking a suggestion, or using the answer's "+" composer for a custom question, creates a new `question` node connected to that `answer` and immediately calls Explore on it — suggested and manually-typed follow-ups behave identically.
- Multiple children can hang off one `answer` (siblings are laid out side-by-side via `layoutNextSiblingBelow`, never overlapping).
- The older `branch` node kind + standalone `research` chat kind still exist and still work (debate "cruxes" and a `branch`'s "Open research" button use them), but the main Q→A loop no longer creates `branch` nodes.

## 6. Sources & YouTube Behavior

- Sources on an `answer` node come from Tavily (`lib/providers/tavily.ts`), fetched server-side in parallel with the Gemini/Groq call during `decompose` — never used to ground the answer text itself, just attached to the branch.
- Shown as a collapsed **"Sources ›"** toggle on the node (expands to "Quick Links" + "Videos"); collapsed by default so the canvas stays clean as branches multiply.
- Videos come from a separate client call to `/api/youtube`, which derives a disambiguated search query via Groq (not Gemini, to preserve Gemini's scarce free-tier quota) using both the immediate question and the root question as context. Cached on the node (`videosFetched`) so it's fetched once.
- This is distinct from **Open Research** (§10) — Sources/Videos are fast, incidental web links; Open Research is a deliberate, user-initiated search for trustworthy papers/documents.

## 7. Select → Ask AI / Summarize Behavior

- Selecting 2+ nodes (drag-box or shift-click, native XYFlow selection) shows `SelectionBar` fixed above the toolbar.
- `buildSelectionContext()` (`lib/context.ts`) builds a kind-aware text summary of only the selected nodes (question→answer text, research→last reply, insight→summary+key points, else content/description) — never the whole workspace.
- Typing a question + Enter → `action: "selectionAsk"`; clicking Summarize → `action: "selectionSummarize"`. Either creates one new `result` node positioned below the selected group (via `layoutBelowGroup`) and connected from every selected node. No node is created if the request fails (error surfaces as a toast).

## 8. Debate Behavior

- Triggered from an Answer's panel view ("Argue For" / "Argue Against"), not from the canvas node directly. At most one `debate` node per Answer — a second click on either button jumps to the existing one instead of creating a duplicate.
- Opening argument is generated immediately via the same turn-taking function (`argueDebate`) used for every subsequent turn; the debate node's `messages[0].stance` is the source of truth for its For/Against badge (no separate stance field).
- System prompt is explicitly conversational: ~100–180 words, 2–5 short paragraphs, must acknowledge the user's point before countering, reveals one idea per turn (not a full case at once), and often (not always) ends with a specific question. This was a deliberate rewrite after the first version read as an AI essay — do not regress it back to long-form.
- Real sources attached to the originating Answer are passed as citable-but-not-fabricatable context (`data.sources` on the debate node), formatted into the prompt only when present.
- Canvas representation is a single node: collapsed shows stance badge + opening-line preview + "Expand"; expanded shows the full inline thread + a "Respond to the debate…" composer, all within the same node (no per-message nodes). The side panel view of the same node also works and includes a "Back to answer" link.
- The pre-existing, separate debate system (Argue for/against/**balanced**, "what would change your mind" cruxes, debate summary) reached from `branch`/`finding`/`insight` nodes still exists untouched and is more feature-rich — it predates this simplified Answer-triggered flow and both coexist.

## 9. Text Tool Behavior

- A true tool mode (`Toolbar`'s Text button / `T` shortcut), not an instant-create action: arms the canvas (cursor becomes a text beam), and the next click on empty canvas creates a `text` node exactly there via `onPaneClick`, then reverts to Select.
- `text` nodes are bare (no card border/shadow/kicker), auto-growing height, horizontally resizable only (drag handle on the right edge, zoom-aware).
- Formatting (Heading/Subheading/Body level, bold, italic, alignment cycle, small/medium/large size, a 6-swatch color picker) lives in `TextFormatBar`, a floating bar shown above the toolbar **only when exactly one text node is selected** — not inside the node itself.
- Typing inside a text node already can't trigger canvas keyboard shortcuts (the app-wide keydown handler ignores `INPUT`/`TEXTAREA`/`contentEditable` targets).

## 10. Open Research Behavior

- A dedicated finder, intentionally **not** an AI chat/briefing panel. Opened from an Answer's panel ("Open Research" / "Add more research"), pre-filled with that Answer's root question as the search query (editable).
- Search hits **OpenAlex** (`lib/providers/openalex.ts`, no API key required) and returns only: title, authors, institution, year, a factual source-type label (Peer-reviewed journal / Preprint / University / Technical report / Institutional publication / Academic conference / Academic paper — derived from OpenAlex's own `type`/source fields, never a fabricated "verified" claim), and the real URL. **No abstract, snippet, or AI-generated text is shown** — each result is just `[Open] [Add to Flow]`.
- Upload (PDF/DOCX/TXT via `pdf-parse`/`mammoth`, real extraction) identifies the file (name + type) and offers Add to Flow directly — no AI analysis or summary is run on it in this flow. (The `analyzeDocument`/`documentChat` AI actions exist server-side for a possible future "deep document understanding" feature but are currently unused by the client.)
- "Add to Flow" appends a `ResearchItem` to the **single** `researchBranch` node connected to that Answer — the branch is created on the first add and every subsequent add (from search or upload) appends into the same node's `researchItems[]` array (deduped by id). This deliberately avoids one-canvas-node-per-paper.

## 11. API Providers & Environment Variables

| Variable | Used for | Fallback if missing |
|---|---|---|
| `GEMINI_API_KEY` | Primary LLM (`gemini-3.6-flash`) for all `/api/ai` actions | Falls through to Groq |
| `GROQ_API_KEY` | Secondary LLM (`openai/gpt-oss-120b`) for `/api/ai`; also derives YouTube search queries | Falls through to local placeholder text (never a hard error) if both LLM keys are missing |
| `TAVILY_API_KEY` | Real web source retrieval (Answer Sources, chat grounding, debate context) | Silently returns no sources (never fabricates) |
| `YOUTUBE_API_KEY` | Real YouTube Data API v3 search | Silently returns no videos |

- OpenAlex needs no key (used for Open Research).
- **Known constraint:** Gemini's free tier caps at ~20 requests/day for `gemini-3.6-flash` — secondary/high-volume calls (e.g. YouTube query derivation) intentionally use Groq instead to conserve that quota.
- `.env.local` holds real keys and is gitignored; `.env.example` lists the four variables above with empty values and must be kept in sync if a new provider is added.

## 12. Persistence Approach

- Everything lives in browser `localStorage`, no backend database.
- `lib/workspace.ts`: each workspace is `recan-flow-workspace-data-<id>`; an index (`recan-flow-workspaces-index`) and an active-workspace pointer (`recan-flow-active-workspace`) support multiple workspaces and switching between them.
- `Workspace.tsx` autosaves the full `{nodes, edges}` graph on a 500ms debounce after any change — this is generic and required no special-casing when new node kinds were added.
- Because persistence is fully generic, any new `FlowNodeData` field or `NodeKind` is automatically saved/restored with zero extra code — but there is **no schema migration**: renaming a `NodeKind` (as happened once, `paper` → `researchBranch`) orphans old saved nodes of the old kind in any existing localStorage data.

## 13. Important UX Decisions Already Made

- A feature only counts as working when the full user action → backend → real data → UI → persistence chain works, not when a button/panel merely exists.
- Never fabricate data: sources, papers, authors, institutions, dates, and citations must come from a real provider response or be omitted entirely.
- Suggested follow-ups and other AI-proposed branches are ephemeral data until the user explicitly acts on them — never auto-materialized as canvas nodes.
- One derived/compound node per logical relationship, not one node per item: one Answer per Question, one Debate per Answer, one Research Branch per Answer (holding many items) — avoids canvas clutter as the graph grows.
- Selection state is derived from XYFlow's own `node.selected`, never duplicated into separate React state.
- Contextual toolbars/format bars float above the main bottom toolbar and only appear for the relevant selection state; they never attach to or hover beside a specific node.
- AI response style matters as a first-class requirement, not an afterthought — Debate was explicitly rewritten to stop reading like an essay.
- Verify live behavior (typecheck + lint + build + an actual browser/API round-trip) before considering any feature done — several real bugs (OpenAlex query wildcards, `pdf-parse`/Next.js bundling, an over-strict Zod field) were only caught this way.

## 14. Features Intentionally NOT Implemented Yet

- Deep document understanding for Open Research uploads (structured summary/findings/limitations, ask-a-question-about-this-document) — deliberately deferred; backend AI actions exist but are unused.
- Research → challenge / find-evidence / find-counter-evidence / "what would change my mind" wired to the new Debate or Research Branch nodes (the older Debate system has its own version of some of this, but it isn't connected to the newer Answer-triggered Debate or to Research Branch items).
- Additional Open Research providers (Semantic Scholar, Crossref, arXiv, PubMed, institutional repositories) — architecture allows it, only OpenAlex is wired up.
- Removing/deduping a single item from an existing Research Branch.
- Any schema-migration or cleanup path for renamed/removed node kinds in already-saved workspaces.
- Real backend/database persistence, auth, or multi-user collaboration — everything is single-browser localStorage.

## 15. Known Bugs / Limitations

- No data migration: a workspace saved before the `paper` → `researchBranch` rename (or any future kind rename) will contain nodes XYFlow can't render meaningfully.
- Local dev server occasionally hits a `.next` cache corruption (chunk/module-not-found errors, or edges silently failing to render) after many hot-reloads in one long session. Fix: stop the server, confirm no leftover `node.exe`, `rm -rf .next`, restart.
- `pdf-parse`/`mammoth` must be dynamically imported inside the upload route (not statically imported at module scope) and are declared in `next.config.ts`'s `serverExternalPackages` — required for their bundled dependencies to work under Next.js's route compilation; don't "simplify" this back to a static import.
- OpenAlex's default search treats a literal `?`/`*` as a wildcard operator and 400s on it — `searchOpenAlex()` strips those characters before querying; question-shaped queries (the common case here) would otherwise always fail.
- The `chat` action's `topic` is intentionally optional (a standalone Research node can have an empty title) — don't reintroduce a `min(1)` there.
- Gemini's ~20/day free-tier cap can throttle heavy manual testing; Groq is the practical fallback during development.

## 16. Recommended Next Priorities

1. Commit or deliberately discard the substantial work currently sitting uncommitted (Select/Summarize, Debate, Text tool, Open Research rewrite — see `git status`) before starting new feature work, so history stays meaningful.
2. Decide whether to build the deferred "deep document understanding" feature (§14) now that its backend groundwork already exists, or remove the unused `analyzeDocument`/`documentChat` actions if it's off the roadmap.
3. Add a second Open Research provider (Semantic Scholar or Crossref are the next-easiest, both keyless) to reduce single-provider dependency.
4. Give Research Branch items a remove/dedupe affordance now that branches can accumulate many entries.
5. If workspace schema changes become frequent, consider a lightweight version/migration step in `lib/workspace.ts` rather than silently orphaning old node kinds.
