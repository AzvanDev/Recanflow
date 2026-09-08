import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ action: z.enum(["chat", "branches", "synthesis", "research"]), prompt: z.string().min(1).max(12000), context: z.string().max(12000).optional() });
const fallback = (action: string, prompt: string) => {
  if (action === "branches") return { text: "", branches: ["Clarify the user need", "Compare existing approaches", "Identify assumptions", "Explore implementation risks"] };
  if (action === "synthesis") return { text: `Executive summary\n\n${prompt}\n\nKey findings\n• The selected ideas reveal useful themes but still need evidence.\n• Separate observed facts from proposed solutions.\n\nOpen questions\n• What evidence would change this conclusion?\n\nThis local draft was generated without a connected AI provider.` };
  return { text: `I can help explore this. ${prompt}\n\nNo AI provider is configured, so this is a local guidance fallback. Add GEMINI_API_KEY or GROQ_API_KEY to enable live AI responses.` };
};

async function groqFallback(action: string, prompt: string, context: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const instruction = action === "branches" ? "Return four concise branch titles, one per line." : action === "research" ? "Do not claim web browsing. Clearly label facts, inference, assumptions, and uncertainty." : "Be concise, structured, and useful.";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: instruction }, { role: "user", content: `Context:\n${context}\n\nRequest: ${prompt}` }], temperature: 0.4 }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Groq unavailable");
  const json = await response.json() as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Malformed Groq response");
  return action === "branches" ? { text, branches: text.split("\n").map(s => s.replace(/^[-*\d.\s]+/, "")).filter(Boolean).slice(0, 6), provider: "groq", researched: false } : { text, provider: "groq", researched: false };
}
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please provide a valid, non-empty request." }, { status: 400 });
  const { action, prompt, context = "" } = parsed.data;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ ...fallback(action, prompt), provider: "local", researched: false });
  try {
    const model = "gemini-2.0-flash";
    const instruction = action === "branches" ? "Return four concise branch titles, one per line." : action === "research" ? "Do not claim web browsing. Label facts, inference, assumptions, uncertainty." : "Be concise and structured.";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: `${instruction}\n\nContext:\n${context}\n\nRequest: ${prompt}` }] }] }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Gemini unavailable");
    const json = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n").trim();
    if (!text) throw new Error("Malformed provider response");
    return NextResponse.json(action === "branches" ? { text, branches: text.split("\n").map(s => s.replace(/^[-*\d.\s]+/, "")).filter(Boolean).slice(0, 6), provider: "gemini", researched: false } : { text, provider: "gemini", researched: false });
  } catch {
    try {
      const groq = await groqFallback(action, prompt, context);
      if (groq) return NextResponse.json(groq);
    } catch { /* return the explicit local fallback below */ }
    return NextResponse.json({ ...fallback(action, prompt), provider: "local fallback", researched: false, warning: "Gemini and Groq are temporarily unavailable. Showing a local fallback." });
  }
}
