/**
 * Provider-agnostic real-research abstraction. `search()` returns only what a provider actually
 * retrieved — never model-generated URLs or titles. The LLM layer (app/api/ai/route.ts) is
 * responsible for turning retrieved sources into an answer; providers never synthesize text.
 */
import type { ResearchSource } from "./types";

export type SourceMetadata = ResearchSource;

export type VideoMetadata = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
};

export type SearchResult = {
  sources: SourceMetadata[];
};

export interface ResearchProvider {
  name: string;
  search(query: string): Promise<SearchResult>;
  /** Optional: fetch full page content for a URL a search already returned. Not implemented by every provider. */
  fetchSource?(url: string): Promise<{ content: string } | null>;
  /** Optional: turn raw HTML into readable text. Not implemented by every provider. */
  extractContent?(html: string): Promise<string>;
  /** Optional: real video search (e.g. YouTube Data API). Not implemented by every provider. */
  findVideos?(query: string): Promise<VideoMetadata[]>;
}

export function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
