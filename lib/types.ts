import type { Edge, Node } from "@xyflow/react";

export type NodeKind = "question" | "answer" | "branch" | "research" | "finding" | "insight" | "note" | "text" | "debate" | "result" | "researchBranch";
export type NodeStatus = "idle" | "loading" | "error";
export type Confidence = "high" | "medium" | "low";
export type DebateStance = "for" | "against" | "balanced" | "challenge" | "respond";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; stance?: DebateStance; researched?: boolean; sources?: ResearchSource[] };

export type ResearchSource = { id: string; title: string; url: string; domain: string; snippet: string; publishedAt?: string };

export type VideoMetadata = { videoId: string; title: string; thumbnail: string; channelTitle: string; publishedAt: string; url: string };

export type Provenance = { questionId?: string; questionTitle?: string; branchId?: string; branchTitle?: string; researchId?: string };

/** A real result from an academic/research index (e.g. OpenAlex) — never model-generated. */
export type PaperResult = {
  id: string;
  title: string;
  authors: string[];
  institution?: string;
  year?: string;
  sourceType: string;
  abstract?: string;
  url: string;
  openAccessUrl?: string;
};

export type DocumentAnalysis = {
  summary: string;
  keyFindings: string[];
  claims: string[];
  methodology: string;
  limitations: string[];
  evidence: string[];
  openQuestions: string[];
};

/** One item inside a Research Branch — either a real search result or an identified upload. Never fabricated. */
export type ResearchItem = {
  id: string;
  title: string;
  institution?: string;
  year?: string;
  sourceType?: string;
  url?: string;
  uploaded?: boolean;
};

export type ChallengeResult = {
  weaknesses: string[];
  missingEvidence: string;
  alternativeExplanation: string;
  confidence: Confidence;
  suggestedQuestion: string;
};

export type DebateSummary = {
  currentPosition: string;
  strengthenedBy: string[];
  weakenedBy: string[];
  strongestCounterargument: string;
  keyEvidence: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
  confidence: Confidence;
};

export type NodeAction =
  | "explore"
  | "retryExplore"
  | "openBranch"
  | "openResearch"
  | "challenge"
  | "createQuestionFromChallenge"
  | "openDebate"
  | "editContent"
  | "editTitle"
  | "selectSuggestion"
  | "addFollowUp"
  | "respondDebate"
  | "formatText"
  | "resizeText";

export type FlowNodeData = {
  kind: NodeKind;
  title: string;
  description?: string;
  content?: string;
  status?: NodeStatus;
  error?: string;
  answer?: string;
  suggestions?: { title: string; description?: string }[];
  messages?: ChatMessage[];
  keyPoints?: string[];
  supportingEvidence?: string[];
  confidence?: Confidence;
  findingIds?: string[];
  provenance?: Provenance;
  sources?: ResearchSource[];
  videos?: VideoMetadata[];
  videosFetched?: boolean;
  challenge?: ChallengeResult;
  debateSummary?: DebateSummary;
  textLevel?: "heading" | "subheading" | "body";
  textSize?: "small" | "medium" | "large";
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  textColor?: string;
  width?: number;
  researchItems?: ResearchItem[];
  onAction?: (action: NodeAction, id: string, payload?: unknown) => void;
};

export type FlowNode = Node<FlowNodeData>;

export const WORKSPACE_VERSION = 2 as const;

export type SavedWorkspace = {
  version: typeof WORKSPACE_VERSION;
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: Edge[];
  updatedAt: string;
};
