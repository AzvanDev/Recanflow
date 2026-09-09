import type { VideoMetadata } from "./types";

/** Never throws — a failed/unavailable lookup resolves to an empty list so the caller can omit the section gracefully. */
export async function fetchRelatedVideos(topic: string, context?: string): Promise<VideoMetadata[]> {
  try {
    const response = await fetch("/api/youtube", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, context }) });
    const json = (await response.json()) as { success: boolean; data?: { videos: VideoMetadata[] } };
    if (!response.ok || !json.success) return [];
    return json.data?.videos || [];
  } catch {
    return [];
  }
}
