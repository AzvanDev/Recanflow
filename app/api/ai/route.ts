import { NextResponse } from "next/server";
import { z } from "zod";

const chatMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string() });

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
]);

const branchesSchema = z.object({
  branches: z.array(z.object({ title: z.string().min(1).max(160), description: z.string().min(1).max(600) })).min(3).max(5),
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

function instructionFor(body: Body): { system: string; wantsJson: boolean } {
  if (body.action === "decompose") {
    return {
      wantsJson: true,
      system:
        'You are a research planning assistant. Break the user\'s question into 3 to 5 distinct research branches that together cover the question well (e.g. economic, technical, social, risk angles). Respond with ONLY JSON: {"branches":[{"title":"short branch name","description":"one sentence describing what to investigate"}]}. No prose outside the JSON.',
    };
  }
  if (body.action === "chat") {
    return {
      wantsJson: false,
      system:
        "You are a research assistant helping investigate a specific branch of a larger question. Be concise and structured. Where relevant, distinguish factual claims, reasoning, assumptions, and open uncertainty. Do not claim to have browsed the web or cite sources you were not given — you are reasoning from general knowledge only.",
    };
  }
  if (body.action === "synthesize") {
    return {
      wantsJson: true,
      system:
        'You are synthesizing multiple research findings into one insight. Respond with ONLY JSON: {"title":"short insight title","summary":"2-4 sentence synthesis","keyPoints":["point"],"supportingEvidence":["which finding(s) support this and how"],"confidence":"high|medium|low"}. Base the synthesis only on the findings given; do not invent evidence.',
    };
  }
  return {
    wantsJson: true,
    system:
      'You are a critical reviewer stress-testing a research insight. Look for contradictory evidence, weak assumptions, missing evidence, alternative explanations, and overgeneralization. Respond with ONLY JSON: {"weaknesses":["specific weakness"],"missingEvidence":"what evidence is absent","alternativeExplanation":"a plausible alternative reading","confidence":"high|medium|low (revised confidence in the original insight after this challenge)","suggestedQuestion":"one focused follow-up research question that would resolve the biggest gap"}.',
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
  return `Insight: ${body.insightTitle}\nSummary: ${body.insightSummary}\nKey points: ${body.keyPoints.join("; ")}`;
}

function localFallback(body: Body) {
  if (body.action === "decompose") {
    return {
      branches: [
        { title: "Core evidence", description: `Gather the strongest available evidence bearing directly on: ${body.question}` },
        { title: "Counterarguments", description: "Identify the strongest reasons the answer might be no, or more limited than assumed." },
        { title: "Feasibility & constraints", description: "Investigate practical, technical, or resource constraints that shape the answer." },
        { title: "Stakeholder impact", description: "Consider who is affected and how their incentives shape the outcome." },
      ],
    };
  }
  if (body.action === "chat") {
    return { reply: "No AI provider is configured, so this is a local placeholder. Add GEMINI_API_KEY or GROQ_API_KEY in .env.local to get real research responses." };
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
  return {
    weaknesses: ["No AI provider is configured, so this challenge could not be generated."],
    missingEvidence: "Add GEMINI_API_KEY or GROQ_API_KEY in .env.local to enable real critical review.",
    alternativeExplanation: "Not available without a configured AI provider.",
    confidence: "low" as const,
    suggestedQuestion: `What additional evidence would most change confidence in: ${body.insightTitle}?`,
  };
}

function parseStructured(body: Body, text: string) {
  const json = extractJson(text);
  if (body.action === "decompose") return branchesSchema.parse(json);
  if (body.action === "synthesize") return synthesisSchema.parse(json);
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

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Please provide a valid request." }, { status: 400 });
  const body = parsed.data;
  const { wantsJson } = instructionFor(body);

  const providers: (() => Promise<{ text: string; provider: "gemini" | "groq" }>)[] = [() => callGemini(body), () => callGroq(body)];
  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      const { text, provider: name } = await provider();
      if (!wantsJson) return NextResponse.json({ success: true, data: { reply: text }, provider: name, researched: false });
      const data = parseStructured(body, text);
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
