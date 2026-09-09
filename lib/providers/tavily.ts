import { z } from "zod";
import { safeDomain, type ResearchProvider, type SourceMetadata } from "../research-provider";

const tavilyResponseSchema = z.object({
  results: z
    .array(
      z.object({
        title: z.string().optional().default(""),
        url: z.string(),
        content: z.string().optional().default(""),
        published_date: z.string().optional(),
      }),
    )
    .default([]),
});

export function createTavilyProvider(apiKey: string): ResearchProvider {
  return {
    name: "tavily",
    async search(query: string): Promise<{ sources: SourceMetadata[] }> {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "basic",
          max_results: 5,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`tavily-http-${response.status}`);
      const json = tavilyResponseSchema.parse(await response.json());
      const sources: SourceMetadata[] = json.results.map((r) => ({
        id: r.url,
        title: r.title || safeDomain(r.url),
        url: r.url,
        domain: safeDomain(r.url),
        snippet: r.content.slice(0, 400),
        publishedAt: r.published_date || undefined,
      }));
      return { sources };
    },
  };
}
