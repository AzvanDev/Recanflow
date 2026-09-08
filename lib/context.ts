import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "./types";
export function buildSelectedContext(nodes: Node<FlowNodeData>[]) { return nodes.map(n => `## ${n.data.title}\n${n.data.summary || n.data.content || "No details yet."}`).join("\n\n").slice(0, 12000); }
export function buildLineageContext(id: string, nodes: Node<FlowNodeData>[], edges: Edge[]) { const byId = new Map(nodes.map(n => [n.id, n])); const parts: string[] = []; let cursor = id; for (let i=0;i<8;i++) { const parent = edges.find(e => e.target === cursor)?.source; if (!parent) break; const n = byId.get(parent); if (n) parts.unshift(`${n.data.title}: ${n.data.summary || n.data.content || ""}`); cursor = parent; } return parts.join("\n").slice(0, 6000); }
