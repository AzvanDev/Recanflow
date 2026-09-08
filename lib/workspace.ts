import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, SavedWorkspace } from "./types";

export const demoNodes: Node<FlowNodeData>[] = [
  { id: "root", type: "researchNode", position: { x: 105, y: 235 }, data: { kind: "question", title: "How can AI improve education for students?", summary: "A visual investigation into student outcomes, markets, and implementation." } },
  { id: "needs", type: "researchNode", position: { x: 500, y: 80 }, data: { kind: "conversation", title: "Student Needs", summary: "Identify the learning barriers worth solving.", status: "ready", messages: [] } },
  { id: "market", type: "researchNode", position: { x: 500, y: 295 }, data: { kind: "research", title: "Market Research", summary: "Global and Indian education opportunity.", status: "complete", sources: [] } },
  { id: "implementation", type: "researchNode", position: { x: 500, y: 510 }, data: { kind: "conversation", title: "Implementation", summary: "Tools, models, and practical risks.", status: "ready", messages: [] } },
  { id: "challenges", type: "researchNode", position: { x: 850, y: 10 }, data: { kind: "note", title: "Learning Challenges", content: "Feedback is delayed, lessons are one-size-fits-all, and confidence gaps compound." } },
  { id: "personas", type: "researchNode", position: { x: 850, y: 150 }, data: { kind: "note", title: "User Personas", content: "Students, teachers, parents, and school administrators each need different support." } },
  { id: "india", type: "researchNode", position: { x: 850, y: 350 }, data: { kind: "research", title: "India Market Opportunity", summary: "Research the local access, language, and affordability landscape.", status: "ready", sources: [] } },
  { id: "risks", type: "researchNode", position: { x: 850, y: 560 }, data: { kind: "note", title: "Potential Risks", content: "Privacy, bias, over-reliance, and uneven access must be designed for early." } }
];
export const demoEdges: Edge[] = [["root","needs"],["root","market"],["root","implementation"],["needs","challenges"],["needs","personas"],["market","india"],["implementation","risks"]].map(([source,target]) => ({ id: `e-${source}-${target}`, source, target, type: "smoothstep" }));
const KEY = "recan-flow-workspace-v1";
export function loadWorkspace(): SavedWorkspace { try { const raw = localStorage.getItem(KEY); if (raw) { const item = JSON.parse(raw) as SavedWorkspace; if (item.version === 1 && Array.isArray(item.nodes) && Array.isArray(item.edges)) return item; } } catch { /* restore the demo if data is corrupted */ } return { version: 1, id: "demo", name: "AI in Education", nodes: demoNodes, edges: demoEdges, updatedAt: new Date().toISOString() }; }
export function saveWorkspace(workspace: SavedWorkspace) { try { localStorage.setItem(KEY, JSON.stringify(workspace)); } catch { /* browser storage may be unavailable */ } }
export function newId(prefix = "node") { return `${prefix}-${crypto.randomUUID()}`; }
