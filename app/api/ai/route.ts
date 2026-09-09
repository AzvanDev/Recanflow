import { NextResponse } from "next/server";
import { z } from "zod";
import { createTavilyProvider } from "@/lib/providers/tavily";
import type { SourceMetadata } from "@/lib/research-provider";

/**
 * Model instructions to avoid Markdown are honored inconsistently (LLMs are probabilistic,
 * not fully compliant), so every string the UI ever shows as plain text is sanitized here
 * regardless of what the model actually produced — belt and suspenders, applied once at the
 * API boundary rather than re-implemented in every display component.
 */
function sanitizeAiText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // **bold**
    .replace(/^\s*[-*•]\s+/gm, "• ") // normalize bullet markers before touching stray asterisks
    .replace(/\*(.*?)\*/g, "$1") // remaining *italic*
    .replace(/^#{1,6}\s+/gm, "") // # headers
    .replace(/^[-*_]{3,}\s*$/gm, "") // horizontal rules
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/`([^`]*)`/g, "$1") // inline/fenced code
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function deepSanitize<T>(value: T): T {
  if (typeof value === "string") return sanitizeAiText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deepSanitize(v)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepSanitize(v)])) as T;
  }
  return value;
}

const chatMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string(), stance: z.enum(["for", "against", "balanced", "challenge", "respond"]).optional() });
const debateStanceSchema = z.enum(["for", "against", "balanced", "challenge", "respond"]);

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("decompose"), question: z.string().min(1).max(2000) }),
  z.object({
    action: z.literal("chat"),
    topic: z.string().min(1).max(2000),
    context: z.string().max(8000).optional().default(""),
    history: z.array(chatMessageSchema).max(40).optional().default([]),
    message: z.string().min(1).max(4000),
  }),
  z.object({
    action: z.literal("synthesize"),
    context: z.string().max(4000).optional().default(""),
    findings: z.array(z.object({ title: z.string(), content: z.string() })).min(2).max(12),
  }),
  z.object({
    action: z.literal("challenge"),
    insightTitle: z.string().min(1).max(500),
    insightSummary: z.string().min(1).max(4000),
    keyPoints: z.array(z.string()).default([]),
  }),
  z.object({
    action: z.literal("debate"),
    topic: z.string().min(1).max(2000),
    context: z.string().max(8000).optional().default(""),
    history: z.array(chatMessageSchema).max(60).optional().default([]),
    message: z.string().min(1).max(4000),
    stance: debateStanceSchema,
  }),
  z.object({
    action: z.literal("debateCruxes"),
    topic: z.string().min(1).max(2000),
    context: z.string().max(4000).optional().default(""),
  }),
  z.object({
    action: z.literal("debateSummarize"),
    topic: z.string().min(1).max(2000),
    history: z.array(chatMessageSchema).min(1).max(60),
  }),
]);

const branchesSchema = z.object({
  answer: z.string().min(1).max(1500),
  branches: z.array(z.object({ title: z.string().min(1).max(240), description: z.string().min(1).max(600) })).min(3).max(5),
});
const synthesisSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(3000),
  keyPoints: z.array(z.string()).min(1).max(8),
  supportingEvidence: z.array(z.string()).min(1).max(8),
  confidence: z.enum(["high", "medium", "low"]),
});
const challengeSchema = z.object({
  weaknesses: z.array(z.string()).min(1).max(8),
  missingEvidence: z.string().min(1).max(1500),
  alternativeExplanation: z.string().min(1).max(1500),
  confidence: z.enum(["high", "medium", "low"]),
  suggestedQuestion: z.string().min(1).max(400),
});
const cruxesSchema = z.object({
  cruxes: z.array(z.object({ title: z.string().min(1).max(240), description: z.string().min(1).max(600) })).min(3).max(5),
});
const debateSummarySchema = z.object({
  currentPosition: z.string().max(600).default(""),
  strengthenedBy: z.array(z.string()).max(6).default([]),
  weakenedBy: z.array(z.string()).max(6).default([]),
  strongestCounterargument: z.string().max(600).default(""),
  keyEvidence: z.array(z.string()).max(6).default([]),
  assumptions: z.array(z.string()).max(6).default([]),
  unresolvedQuestions: z.array(z.string()).max(6).default([]),
  confidence: z.enum(["high", "medium", "low"]),
});

type Body = z.infer<typeof requestSchema>;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const arrStart = candidate.indexOf("[");
  const first = start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (first === -1 || end === -1) throw new Error("No JSON found in AI response");
  return JSON.parse(candidate.slice(first, end + 1));
}

const NO_MARKDOWN =
  "Never use Markdown syntax anywhere in your response or in any string value: no **bold**, no # headers, no bullet characters (*, -, •), no numbered-list prefixes, no backticks, no horizontal rules. The UI displays your text as plain prose, so write plain sentences and paragraphs only — if you need to list things, do it as a short plain sentence (\"First, ...; second, ...\") or as separate array items where the schema already gives you an array.";

function instructionFor(body: Body): { system: string; wantsJson: boolean } {
  if (body.action === "decompose") {
    return {
      wantsJson: true,
      system: `You are a thinking partner helping someone understand a question, reasoning from general knowledge only (you have no live search). First write a direct, concrete answer to their question in 2 to 4 sentences — lead with the actual answer, not a preamble, and be honest about uncertainty where it exists. Then propose 3 to 5 follow-up questions that a genuinely curious person would want to ask next, grounded in what you just said — not a generic fixed checklist (avoid vague categories like "Economic factors" or "Considerations"). Prefer real questions ("Why does X happen?", "How does this compare to Y?", "What would have to be true for this to fail?") over noun-phrase labels, and pick whichever angles actually matter for THIS question. Each follow-up needs one precise sentence explaining why it matters. Respond with ONLY JSON: {"answer":"your 2-4 sentence answer","branches":[{"title":"a specific follow-up question","description":"one precise sentence on why it matters"}]}. No prose outside the JSON. ${NO_MARKDOWN}`,
    };
  }
  if (body.action === "chat") {
    return {
      wantsJson: false,
      system: `You are a research assistant investigating one specific branch of a larger question. Be direct, concrete, and efficient: lead with the most important point in the first sentence, then support it. Where relevant, clearly separate factual claims from reasoning, assumptions, and open uncertainty (e.g. "Fact: ...", "Assumption: ...") but only when it adds real clarity, not as boilerplate. Keep the whole answer tight — well under 200 words unless the question genuinely requires more, and never pad with generic caveats or restating the question. If the background below includes a "Retrieved sources" section, those are real search results — ground your answer in them and you may refer to them naturally (e.g. "according to X"), but never invent a citation, statistic, or source beyond what is given there. If no "Retrieved sources" section is present, you have no live search — reason from general knowledge only and do not claim to have browsed the web. ${NO_MARKDOWN}`,
    };
  }
  if (body.action === "synthesize") {
    return {
      wantsJson: true,
      system: `You are synthesizing multiple research findings into one precise insight. Respond with ONLY JSON: {"title":"short specific insight title, not a generic label","summary":"2-3 tight, concrete sentences stating the actual conclusion, no throat-clearing","keyPoints":["one precise, standalone-readable sentence per point, no vague filler"],"supportingEvidence":["a plain sentence naming which finding(s) support this and exactly how, e.g. 'Finding 2 shows X, which directly supports Y'"],"confidence":"high|medium|low"}. Base the synthesis strictly on the findings given — never invent evidence, and if the findings conflict or are thin, say so plainly in the summary and lower the confidence accordingly. ${NO_MARKDOWN}`,
    };
  }
  if (body.action === "challenge") {
    return {
      wantsJson: true,
      system: `You are a rigorous critical reviewer stress-testing a research insight. Find the strongest real objections, not generic hedging: contradictory evidence, weak or unstated assumptions, missing evidence, plausible alternative explanations, and overgeneralization. Respond with ONLY JSON: {"weaknesses":["one specific, concrete weakness per item — name the actual flaw, not a category"],"missingEvidence":"one precise sentence naming exactly what evidence is absent and why it matters","alternativeExplanation":"one concrete alternative reading of the same evidence","confidence":"high|medium|low (your honest revised confidence in the original insight after this challenge)","suggestedQuestion":"one specific, answerable follow-up research question that would resolve the single biggest gap"}. ${NO_MARKDOWN}`,
    };
  }
  if (body.action === "debate") {
    const stanceInstruction: Record<typeof body.stance, string> = {
      for: "Argue FOR this position as rigorously and persuasively as you honestly can, using real reasoning — not fabricated statistics or invented sources.",
      against: "Argue AGAINST this position as rigorously and persuasively as you honestly can, using real reasoning — not fabricated statistics or invented sources.",
      balanced: "Give a balanced take: state the strongest case on each side and honestly weigh them against each other — do not dodge toward a wishy-washy middle just to seem fair.",
      challenge: "The user has stated their own position. Challenge it as rigorously as a sharp, good-faith critic would: find the weakest link in their reasoning, name unstated assumptions, and offer the strongest real counter-evidence or counter-example. Do not simply agree or soften your critique to be polite.",
      respond: "Continue this debate as an intellectually honest sparring partner responding to what the user just said. Acknowledge anything genuinely correct in their point in one clause at most, then push back with the strongest real counter-consideration — do not cave to agreement just because they pushed back, and do not repeat points already made earlier in the thread.",
    };
    return {
      wantsJson: false,
      system: `You are debating one specific position with the user, reasoning from general knowledge only (no live search, no fabricated citations or statistics). ${stanceInstruction[body.stance]} Keep it tight — under 150 words, lead with your strongest point first, no throat-clearing or restating the topic. ${NO_MARKDOWN}`,
    };
  }
  if (body.action === "debateCruxes") {
    return {
      wantsJson: true,
      system: `You help turn a debated position into concrete research questions. Given the position below, identify 3 to 5 specific "cruxes" — the concrete pieces of evidence or facts that, if known, would most change confidence in this position one way or the other (per Julia Galef's "what would change your mind" framing). Each crux must be a specific, investigable question, not a vague theme. Respond with ONLY JSON: {"cruxes":[{"title":"a specific investigable question","description":"one sentence on why this evidence would be decisive"}]}. No prose outside the JSON. ${NO_MARKDOWN}`,
    };
  }
  return {
    wantsJson: true,
    system: `You are summarizing a debate transcript into a clear-eyed wrap-up. Respond with ONLY JSON: {"currentPosition":"one or two sentences stating where the position now stands after the debate","strengthenedBy":["a specific point that strengthened the position, if any"],"weakenedBy":["a specific point that weakened the position, if any"],"strongestCounterargument":"the single strongest counterargument raised in the debate","keyEvidence":["a specific piece of evidence or reasoning actually used in the debate"],"assumptions":["an assumption either side relied on"],"unresolvedQuestions":["a specific question the debate did not resolve"],"confidence":"high|medium|low, your honest confidence in the current position given everything said"}. Base this strictly on the actual transcript — never invent points that were not made. ${NO_MARKDOWN}`,
  };
}

function userContentFor(body: Body): string {
  if (body.action === "decompose") return `Question: ${body.question}`;
  if (body.action === "chat") {
    const history = body.history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
    return `Research branch: ${body.topic}\n\nBackground:\n${body.context}\n\n${history ? `Conversation so far:\n${history}\n\n` : ""}User: ${body.message}`;
  }
  if (body.action === "synthesize") {
    const findings = body.findings.map((f, i) => `Finding ${i + 1} — ${f.title}: ${f.content}`).join("\n\n");
    return `Context: ${body.context}\n\nFindings to synthesize:\n${findings}`;
  }
  if (body.action === "challenge") return `Insight: ${body.insightTitle}\nSummary: ${body.insightSummary}\nKey points: ${body.keyPoints.join("; ")}`;
  if (body.action === "debate") {
    const history = body.history.map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n");
    return `Position being debated: ${body.topic}\n\nBackground:\n${body.context}\n\n${history ? `Debate so far:\n${history}\n\n` : ""}User: ${body.message}`;
  }
  if (body.action === "debateCruxes") return `Position: ${body.topic}\n\nBackground:\n${body.context}`;
  const transcript = body.history.map((m) => `${m.role === "user" ? "User" : `AI (${m.stance || "debate"})`}: ${m.content}`).join("\n");
  return `Position debated: ${body.topic}\n\nTranscript:\n${transcript}`;
}

function localFallback(body: Body) {
  if (body.action === "decompose") {
    return {
      answer: "No AI provider is configured, so this is a local placeholder rather than a real answer. Add GEMINI_API_KEY or GROQ_API_KEY in .env.local to get a real answer here.",
      branches: [
        { title: "What evidence would settle this?", description: `Gather the strongest available evidence bearing directly on: ${body.question}` },
        { title: "What's the strongest case against this?", description: "Identify the strongest reasons the answer might be no, or more limited than assumed." },
        { title: "What practical constraints shape this?", description: "Investigate practical, technical, or resource constraints that shape the answer." },
        { title: "Who is most affected, and how?", description: "Consider who is affected and how their incentives shape the outcome." },
      ],
    };
  }
  if (body.action === "chat") {
    return { reply: "No AI provider is configured, so this is a local placeholder. Add GEMINI_API_KEY or GROQ_API_KEY in .env.local to get real research responses.", researched: false, sources: [] };
  }
  if (body.action === "synthesize") {
    return {
      title: "Draft synthesis (no AI configured)",
      summary: "This is a local placeholder synthesis because no AI provider is configured. Add GEMINI_API_KEY or GROQ_API_KEY to generate a real synthesis of the selected findings.",
      keyPoints: body.findings.map((f) => f.title),
      supportingEvidence: body.findings.map((f) => f.title),
      confidence: "low" as const,
    };
  }
  if (body.action === "challenge") {
    return {
      weaknesses: ["No AI provider is configured, so this challenge could not be generated."],
      missingEvidence: "Add GEMINI_API_KEY or GROQ_API_KEY in .env.local to enable real critical review.",
      alternativeExplanation: "Not available without a configured AI provider.",
      confidence: "low" as const,
      suggestedQuestion: `What additional evidence would most change confidence in: ${body.insightTitle}?`,
    };
  }
  if (body.action === "debate") {
    return { reply: "No AI provider is configured, so this is a local placeholder. Add GEMINI_API_KEY or GROQ_API_KEY in .env.local to get a real debate response." };
  }
  if (body.action === "debateCruxes") {
    return {
      cruxes: [
        { title: `What is the strongest evidence for: ${body.topic}?`, description: "No AI provider is configured, so this is a placeholder crux." },
        { title: `What is the strongest evidence against: ${body.topic}?`, description: "No AI provider is configured, so this is a placeholder crux." },
        { title: "What would a neutral observer need to see to be convinced either way?", description: "No AI provider is configured, so this is a placeholder crux." },
      ],
    };
  }
  return {
    currentPosition: "No AI provider is configured, so no real summary is available.",
    strengthenedBy: [],
    weakenedBy: [],
    strongestCounterargument: "Add GEMINI_API_KEY or GROQ_API_KEY in .env.local to summarize this debate.",
    keyEvidence: [],
    assumptions: [],
    unresolvedQuestions: ["Add GEMINI_API_KEY or GROQ_API_KEY in .env.local to enable a real debate summary."],
    confidence: "low" as const,
  };
}

function parseStructured(body: Body, text: string) {
  const json = extractJson(text);
  if (body.action === "decompose") return branchesSchema.parse(json);
  if (body.action === "synthesize") return synthesisSchema.parse(json);
  if (body.action === "debateCruxes") return cruxesSchema.parse(json);
  if (body.action === "debateSummarize") return debateSummarySchema.parse(json);
  return challengeSchema.parse(json);
}

async function callGemini(body: Body): Promise<{ text: string; provider: "gemini" }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no-gemini-key");
  const { system } = instructionFor(body);
  const model = "gemini-3.6-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${system}\n\n${userContentFor(body)}` }] }] }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`gemini-http-${response.status}`);
  const json = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim();
  if (!text) throw new Error("gemini-empty-response");
  return { text, provider: "gemini" };
}

async function callGroq(body: Body): Promise<{ text: string; provider: "groq" }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no-groq-key");
  const { system } = instructionFor(body);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "system", content: system }, { role: "user", content: userContentFor(body) }],
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`groq-http-${response.status}`);
  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("groq-empty-response");
  return { text, provider: "groq" };
}

/** Formats retrieved sources into a labeled block the chat instruction tells the model to ground its answer in. */
function formatRetrievedSources(sources: SourceMetadata[]): string {
  return `Retrieved sources:\n${sources.map((s, i) => `${i + 1}. ${s.title} (${s.domain})\n${s.snippet}`).join("\n\n")}`;
}

/** Real retrieval only — never invents a source. Returns [] (not an error) if no provider is configured or the search fails, so chat always degrades to honest non-grounded mode rather than breaking. */
async function retrieveSources(query: string): Promise<SourceMetadata[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const provider = createTavilyProvider(key);
    const { sources } = await provider.search(query);
    return sources;
  } catch (err) {
    console.error("Search retrieval failed", err);
    return [];
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Please provide a valid request." }, { status: 400 });
  const body = parsed.data;
  const { wantsJson } = instructionFor(body);

  const sources = body.action === "chat" ? await retrieveSources(body.message) : [];
  const groundedBody: Body = sources.length > 0 && body.action === "chat" ? { ...body, context: `${formatRetrievedSources(sources)}\n\n${body.context}` } : body;

  const providers: (() => Promise<{ text: string; provider: "gemini" | "groq" }>)[] = [() => callGemini(groundedBody), () => callGroq(groundedBody)];
  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      const { text, provider: name } = await provider();
      if (!wantsJson) {
        return NextResponse.json({
          success: true,
          data: { reply: sanitizeAiText(text), researched: sources.length > 0, sources: deepSanitize(sources) },
          provider: name,
          researched: sources.length > 0,
        });
      }
      const data = deepSanitize(parseStructured(body, text));
      return NextResponse.json({ success: true, data, provider: name, researched: false });
    } catch (err) {
      lastError = err;
    }
  }

  const bothKeysMissing = !process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY;
  if (bothKeysMissing) {
    return NextResponse.json({ success: true, data: localFallback(body), provider: "local", researched: false });
  }

  console.error("AI providers failed", lastError);
  return NextResponse.json({ success: false, error: "The AI provider is temporarily unavailable. Please try again." }, { status: 502 });
}
