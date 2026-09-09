import type { Edge, Node } from "@xyflow/react";

export type NodeKind = "question" | "branch" | "research" | "finding" | "insight" | "note" | "text";
export type NodeStatus = "idle" | "loading" | "error";
export type Confidence = "high" | "medium" | "low";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export type ResearchSource = { id: string; title: string; url: string; domain: string; snippet: string; publishedAt?: string };

export type Provenance = { questionId?: string; questionTitle?: string; branchId?: string; branchTitle?: string; researchId?: string };

export type ChallengeResult = {
  weaknesses: string[];
  missingEvidence: string;
  alternativeExplanation: string;
  confidence: Confidence;
  suggestedQuestion: string;
};

export type NodeAction =
  | "explore"
  | "retryExplore"
  | "openBranch"
  | "openResearch"
  | "challenge"
  | "createQuestionFromChallenge"
  | "editContent"
  | "editTitle";

export type FlowNodeData = {
  kind: NodeKind;
  title: string;
  description?: string;
  content?: string;
  status?: NodeStatus;
  error?: string;
  answer?: string;
  messages?: ChatMessage[];
  keyPoints?: string[];
  supportingEvidence?: string[];
  confidence?: Confidence;
  findingIds?: string[];
  provenance?: Provenance;
  sources?: ResearchSource[];
  challenge?: ChallengeResult;
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
