import { z } from "zod";
import type { VideoMetadata } from "../research-provider";

const youtubeResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.object({ videoId: z.string() }),
        snippet: z.object({
          title: z.string(),
          channelTitle: z.string(),
          publishedAt: z.string(),
          thumbnails: z.object({
            medium: z.object({ url: z.string() }).optional(),
            default: z.object({ url: z.string() }).optional(),
          }),
        }),
      }),
    )
    .default([]),
});

// The YouTube Data API returns snippet text HTML-escaped (e.g. "&#39;" for an apostrophe);
// decode it so the UI shows real characters instead of literal entity codes.
const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Real YouTube Data API v3 search only — never invents a video, id, channel, or thumbnail. */
export async function findYoutubeVideos(query: string, apiKey: string, maxResults = 3): Promise<VideoMetadata[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`youtube-http-${response.status}`);
  const json = youtubeResponseSchema.parse(await response.json());
  return json.items.map((item) => ({
    videoId: item.id.videoId,
    title: decodeHtmlEntities(item.snippet.title),
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || "",
    channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}
