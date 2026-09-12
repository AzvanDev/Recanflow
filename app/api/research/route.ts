import { NextResponse } from "next/server";
import { z } from "zod";
import { searchOpenAlex } from "@/lib/providers/openalex";

const requestSchema = z.object({ query: z.string().min(1).max(300) });

/** Real OpenAlex results only. Never returns fabricated papers — a failed/unavailable search resolves to an empty list with success:true, matching this app's existing graceful-degrade pattern for Tavily/YouTube. */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Please provide a research query." }, { status: 400 });

  try {
    const papers = await searchOpenAlex(parsed.data.query);
    return NextResponse.json({ success: true, data: { papers } });
  } catch (err) {
    console.error("Research search failed", err);
    return NextResponse.json({ success: true, data: { papers: [] } });
  }
}
