import type { ChatMessage, Confidence } from "./types";

type Branch = { title: string; description: string };
type SynthesisResult = { title: string; summary: string; keyPoints: string[]; supportingEvidence: string[]; confidence: Confidence };
type ChallengeResult = { weaknesses: string[]; missingEvidence: string; alternativeExplanation: string; confidence: Confidence; suggestedQuestion: string };

type Request =
  | { action: "decompose"; question: string }
  | { action: "chat"; topic: string; context?: string; history?: ChatMessage[]; message: string }
  | { action: "synthesize"; context?: string; findings: { title: string; content: string }[] }
  | { action: "challenge"; insightTitle: string; insightSummary: string; keyPoints: string[] };

type DataFor<A extends Request["action"]> = A extends "decompose"
  ? { answer: string; branches: Branch[] }
  : A extends "chat"
    ? { reply: string }
    : A extends "synthesize"
      ? SynthesisResult
      : ChallengeResult;

export async function callAI<R extends Request>(body: R): Promise<DataFor<R["action"]>> {
  const response = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await response.json()) as { success: boolean; data?: unknown; error?: string };
  if (!response.ok || !json.success) throw new Error(json.error || "The AI request failed. Please try again.");
  return json.data as DataFor<R["action"]>;
}
