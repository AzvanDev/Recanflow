import type { PaperResult } from "./types";

/** Never throws — a failed/unavailable search resolves to an empty list so the UI can show "no results" rather than an error. */
export async function searchResearchPapers(query: string): Promise<PaperResult[]> {
  try {
    const response = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
    const json = (await response.json()) as { success: boolean; data?: { papers: PaperResult[] } };
    if (!response.ok || !json.success) return [];
    return json.data?.papers || [];
  } catch {
    return [];
  }
}

/** Throws with a user-facing message on failure — uploads are a direct user action, so the caller should surface the error. */
export async function uploadResearchDocument(file: File): Promise<{ fileName: string; text: string }> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/research/upload", { method: "POST", body: form });
  const json = (await response.json()) as { success: boolean; data?: { fileName: string; text: string }; error?: string };
  if (!response.ok || !json.success || !json.data) throw new Error(json.error || "Could not process this file.");
  return json.data;
}
