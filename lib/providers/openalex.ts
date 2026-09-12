import { z } from "zod";
import type { PaperResult } from "../types";

const workSchema = z.object({
  id: z.string(),
  doi: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  publication_year: z.number().optional().nullable(),
  type: z.string().optional().nullable(),
  authorships: z
    .array(
      z.object({
        author: z.object({ display_name: z.string().optional() }).optional(),
        institutions: z.array(z.object({ display_name: z.string().optional() })).optional(),
      }),
    )
    .optional()
    .default([]),
  abstract_inverted_index: z.record(z.string(), z.array(z.number())).optional().nullable(),
  primary_location: z
    .object({
      landing_page_url: z.string().optional().nullable(),
      pdf_url: z.string().optional().nullable(),
      source: z.object({ display_name: z.string().optional(), type: z.string().optional() }).optional().nullable(),
    })
    .optional()
    .nullable(),
  open_access: z.object({ oa_url: z.string().optional().nullable() }).optional().nullable(),
});

const responseSchema = z.object({ results: z.array(workSchema).default([]) });

/** OpenAlex stores abstracts as a word→positions inverted index (to save space) — this rebuilds plain text from it. */
function reconstructAbstract(index?: Record<string, number[]> | null): string {
  if (!index) return "";
  let maxPos = -1;
  for (const positions of Object.values(index)) for (const p of positions) if (p > maxPos) maxPos = p;
  if (maxPos < 0) return "";
  const words: string[] = new Array(maxPos + 1).fill("");
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.join(" ").replace(/\s+/g, " ").trim();
}

/** Derived only from OpenAlex's own factual `type`/source-type fields — never a fabricated "verified" claim. */
function classifySourceType(type?: string | null, sourceType?: string | null): string {
  if (sourceType === "journal") return "Peer-reviewed journal";
  if (sourceType === "repository") return "Institutional publication";
  if (sourceType === "conference") return "Academic conference";
  if (type === "preprint") return "Preprint";
  if (type === "dissertation") return "University";
  if (type === "report") return "Technical report";
  if (type === "book" || type === "book-chapter") return "Academic paper";
  return "Academic paper";
}

/** Real OpenAlex Works search only — no API key required, never invents a paper, author, institution, or URL. */
export async function searchOpenAlex(query: string, limit = 6): Promise<PaperResult[]> {
  // OpenAlex's default (stemmed) search treats "?" and "*" as wildcard operators and rejects
  // them with a 400 — but branch questions naturally end in "?", so strip wildcard characters
  // rather than fail on every question-shaped query.
  const cleanQuery = query.replace(/[?*]/g, " ").replace(/\s+/g, " ").trim();
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&per-page=${limit}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`openalex-http-${response.status}`);
  const json = responseSchema.parse(await response.json());
  const papers: PaperResult[] = [];
  for (const w of json.results) {
    if (!w.title) continue;
    const url = w.doi || w.primary_location?.landing_page_url || w.id;
    if (!url) continue;
    const authors = (w.authorships || []).map((a) => a.author?.display_name).filter((n): n is string => !!n);
    const institutions = Array.from(
      new Set((w.authorships || []).flatMap((a) => (a.institutions || []).map((i) => i.display_name)).filter((n): n is string => !!n)),
    );
    papers.push({
      id: w.id,
      title: w.title,
      authors,
      institution: institutions[0],
      year: w.publication_year ? String(w.publication_year) : undefined,
      sourceType: classifySourceType(w.type, w.primary_location?.source?.type),
      abstract: reconstructAbstract(w.abstract_inverted_index) || undefined,
      url,
      openAccessUrl: w.open_access?.oa_url || w.primary_location?.pdf_url || undefined,
    });
  }
  return papers;
}
