import type { NodeKind, FlowNode } from "./types";

export const NODE_SIZE: Record<NodeKind, { width: number; height: number }> = {
  question: { width: 360, height: 200 },
  answer: { width: 320, height: 240 },
  branch: { width: 280, height: 170 },
  research: { width: 300, height: 190 },
  finding: { width: 260, height: 170 },
  insight: { width: 320, height: 220 },
  note: { width: 240, height: 150 },
  text: { width: 220, height: 90 },
  debate: { width: 300, height: 190 },
  result: { width: 300, height: 190 },
  researchBranch: { width: 300, height: 190 },
};

const GAP_X = 48;
const GAP_Y = 140;

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function boxOf(node: FlowNode) {
  const size = NODE_SIZE[node.data.kind] ?? NODE_SIZE.note;
  return { x: node.position.x, y: node.position.y, w: size.width, h: size.height };
}

/** Nudges a candidate position downward in fixed steps until it clears every existing node's bounding box. */
export function placeClear(existing: FlowNode[], kind: NodeKind, x: number, y: number): { x: number; y: number } {
  const size = NODE_SIZE[kind];
  let candidateY = y;
  for (let attempt = 0; attempt < 60; attempt++) {
    const box = { x, y: candidateY, w: size.width, h: size.height };
    const blocked = existing.some((node) => overlaps(box, boxOf(node)));
    if (!blocked) return { x, y: candidateY };
    candidateY += size.height + 32;
  }
  return { x, y: candidateY };
}

/** Evenly spaces a row of children centered under a parent, then nudges each clear of existing nodes. */
export function layoutChildrenBelow(existing: FlowNode[], parent: FlowNode, childKind: NodeKind, count: number): { x: number; y: number }[] {
  const parentSize = NODE_SIZE[parent.data.kind] ?? NODE_SIZE.note;
  const childSize = NODE_SIZE[childKind];
  const totalWidth = count * childSize.width + (count - 1) * GAP_X;
  const startX = parent.position.x + parentSize.width / 2 - totalWidth / 2;
  const y = parent.position.y + parentSize.height + GAP_Y;
  const placed: FlowNode[] = [];
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = startX + i * (childSize.width + GAP_X);
    const pos = placeClear([...existing, ...placed], childKind, x, y);
    positions.push(pos);
    placed.push({ id: `layout-preview-${i}`, type: "flowNode", position: pos, data: { kind: childKind, title: "" } });
  }
  return positions;
}

/** Places a single child near its parent (used for one-to-one relationships like Branch -> Research, Insight -> New Question). */
export function layoutChildOf(existing: FlowNode[], parent: FlowNode, childKind: NodeKind): { x: number; y: number } {
  const parentSize = NODE_SIZE[parent.data.kind] ?? NODE_SIZE.note;
  const x = parent.position.x;
  const y = parent.position.y + parentSize.height + GAP_Y;
  return placeClear(existing, childKind, x, y);
}

/** Places the Nth child spawned from the same parent side-by-side with its earlier siblings, so repeated branches off one Answer fan out instead of stacking. */
export function layoutNextSiblingBelow(existing: FlowNode[], parent: FlowNode, childKind: NodeKind, siblingIndex: number): { x: number; y: number } {
  const parentSize = NODE_SIZE[parent.data.kind] ?? NODE_SIZE.note;
  const childSize = NODE_SIZE[childKind];
  const x = parent.position.x + parentSize.width / 2 - childSize.width / 2 + siblingIndex * (childSize.width + GAP_X);
  const y = parent.position.y + parentSize.height + GAP_Y;
  return placeClear(existing, childKind, x, y);
}

/** Centers a node under the average position of a set of source nodes (used for Insight under its Findings). */
export function layoutBelowGroup(existing: FlowNode[], sources: FlowNode[], childKind: NodeKind): { x: number; y: number } {
  const childSize = NODE_SIZE[childKind];
  const avgX = sources.reduce((sum, n) => sum + n.position.x + (NODE_SIZE[n.data.kind]?.width ?? 0) / 2, 0) / sources.length;
  const maxY = Math.max(...sources.map((n) => n.position.y + (NODE_SIZE[n.data.kind]?.height ?? 0)));
  const x = avgX - childSize.width / 2;
  const y = maxY + GAP_Y;
  return placeClear(existing, childKind, x, y);
}

export function viewportCenterPosition(instance: { screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number } } | null, kind: NodeKind) {
  const size = NODE_SIZE[kind];
  if (!instance) return { x: 320, y: 240 };
  const center = instance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  return { x: center.x - size.width / 2, y: center.y - size.height / 2 };
}
