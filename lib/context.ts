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
