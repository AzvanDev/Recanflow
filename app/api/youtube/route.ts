import { NextResponse } from "next/server";
import { z } from "zod";
import { findYoutubeVideos } from "@/lib/providers/youtube";

const requestSchema = z.object({ topic: z.string().min(1).max(300), context: z.string().max(300).optional().default("") });

/**
 * A full research question makes a bad YouTube search query — YouTube's search does much better
 * with a short keyword phrase, and generic topic words (e.g. a product named "Digit") need the
 * surrounding context folded in or they collide with unrelated content. Uses Groq, not Gemini:
 * Gemini's free tier caps at 20 requests/day total for this app, already spent on decompose/chat/
 * synthesize/challenge/debate, so a secondary feature like this must not compete for that budget.
 * Never blocks the actual video lookup — any failure here just falls back to the raw topic text.
 */
async function deriveSearchQuery(topic: string, context: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return topic;
  try {
    const prompt = context
      ? `Overall research question: "${context}"\nSpecific research topic: "${topic}"\n\nWrite a short, concrete YouTube search phrase (3-8 words) to find real videos about this topic. Include enough context to disambiguate generic words (e.g. include the product/company/technology name, not just a generic term). No question marks, no quotes, no explanation, just the phrase.`
      : `Write a short, concrete YouTube search phrase (3-8 words) for this research topic: "${topic}". No question marks, no quotes, no explanation, just the phrase.`;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "user", content: prompt }], temperature: 0.2 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return topic;
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const derived = json.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
    return derived || topic;
  } catch {
    return topic;
  }
}

/**
 * Real YouTube Data API v3 lookup only. If YOUTUBE_API_KEY is missing or the request fails,
 * this always returns an empty video list with success:true — the UI is expected to omit the
 * Related Videos section gracefully rather than treat it as an error, and never fabricates.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Please provide a valid request." }, { status: 400 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ success: true, data: { videos: [] } });

  try {
    const query = await deriveSearchQuery(parsed.data.topic, parsed.data.context);
    const videos = await findYoutubeVideos(query, key, 3);
    return NextResponse.json({ success: true, data: { videos } });
  } catch (err) {
    console.error("YouTube search failed", err);
    return NextResponse.json({ success: true, data: { videos: [] } });
  }
}
