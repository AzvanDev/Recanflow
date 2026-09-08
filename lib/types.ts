export type NodeKind = "question" | "conversation" | "research" | "note";
export type NodeStatus = "ready" | "researching" | "complete" | "error";
export type ResearchSource = { id: string; title: string; url: string; domain: string; snippet: string; publishedAt?: string };
export type FlowNodeData = { kind: NodeKind; title: string; summary?: string; content?: string; status?: NodeStatus; messages?: { role: "user" | "assistant"; content: string }[]; sources?: ResearchSource[]; onAction?: (action: string, id: string) => void };
export type SavedWorkspace = { version: 1; id: string; name: string; nodes: import("@xyflow/react").Node<FlowNodeData>[]; edges: import("@xyflow/react").Edge[]; updatedAt: string };
