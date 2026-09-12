import type { Edge } from "@xyflow/react";
import type { FlowNode } from "./types";

/** Walks edges backward from a node to its root, describing each ancestor. Used to give AI calls context without re-sending the whole graph. */
export function buildLineageContext(id: string, nodes: FlowNode[], edges: Edge[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parts: string[] = [];
  let cursor = id;
  for (let i = 0; i < 8; i++) {
    const parent = edges.find((e) => e.target === cursor)?.source;
    if (!parent) break;
    const node = byId.get(parent);
    if (node) parts.unshift(`${node.data.kind.toUpperCase()}: ${node.data.title}\n${node.data.description || node.data.content || ""}`.trim());
    cursor = parent;
  }
  return parts.join("\n\n").slice(0, 6000);
}

export function buildFindingsContext(findings: FlowNode[]) {
  return findings
    .map((n, i) => `Finding ${i + 1}: ${n.data.title}\n${n.data.content || ""}`)
    .join("\n\n")
    .slice(0, 12000);
}

/** Describes only the selected nodes' most relevant content (kind-specific), never the whole graph — used to scope Select + Ask AI / Summarize to exactly what the user picked. */
export function buildSelectionContext(nodes: FlowNode[]): string {
  return nodes
    .map((n) => {
      const label = n.data.title?.trim() || n.data.kind;
      let body: string;
      if (n.data.kind === "question") body = n.data.answer || "(not yet explored)";
      else if (n.data.kind === "research") {
        const lastReply = [...(n.data.messages || [])].reverse().find((m) => m.role === "assistant");
        body = [n.data.description, lastReply?.content].filter(Boolean).join("\n");
      } else if (n.data.kind === "insight") {
        body = [n.data.description, ...(n.data.keyPoints || [])].filter(Boolean).join("\n");
      } else {
        body = n.data.content || n.data.description || "";
      }
      return `${n.data.kind.toUpperCase()}: ${label}\n${body}`.trim();
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);
}
