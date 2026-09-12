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

type Size = { width: number; height: number };
type Box = { x: number; y: number; w: number; h: number };

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Prefers the node's actual rendered size (populated by XYFlow after it mounts) over the
// generic per-kind estimate — an Answer with 5 follow-ups and expanded sources is routinely
// 150px+ taller than the declared default, and laying out its children against the wrong
// height is what used to make new branches jump unexpectedly far away.
function boxOf(node: FlowNode): Box {
  const declared = NODE_SIZE[node.data.kind] ?? NODE_SIZE.note;
  const w = node.measured?.width ?? declared.width;
  const h = node.measured?.height ?? declared.height;
  return { x: node.position.x, y: node.position.y, w, h };
}

/**
 * Nudges a candidate position clear of every existing node's bounding box: first a short
 * sideways sweep at the same row (so a blocked slot resolves next to its neighbors instead of
 * dropping to a new row), then a downward step search as a guaranteed-to-terminate fallback.
 */
export function placeClear(existing: FlowNode[], size: Size, x: number, y: number): { x: number; y: number } {
  const blockedAt = (bx: number, by: number) => {
    const box: Box = { x: bx, y: by, w: size.width, h: size.height };
    return existing.some((node) => overlaps(box, boxOf(node)));
  };

  if (!blockedAt(x, y)) return { x, y };

  const stepX = size.width + GAP_X;
  for (let i = 1; i <= 4; i++) {
    const right = x + stepX * i;
    if (!blockedAt(right, y)) return { x: right, y };
    const left = x - stepX * i;
    if (!blockedAt(left, y)) return { x: left, y };
  }

  let candidateY = y;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (!blockedAt(x, candidateY)) return { x, y: candidateY };
    candidateY += size.height + 32;
  }
  return { x, y: candidateY };
}

/** Evenly spaces a row of children centered under a parent, then nudges each clear of existing nodes. */
export function layoutChildrenBelow(existing: FlowNode[], parent: FlowNode, childKind: NodeKind, count: number): { x: number; y: number }[] {
  const parentBox = boxOf(parent);
  const childSize = NODE_SIZE[childKind];
  const totalWidth = count * childSize.width + (count - 1) * GAP_X;
  const startX = parentBox.x + parentBox.w / 2 - totalWidth / 2;
  const y = parentBox.y + parentBox.h + GAP_Y;
  const placed: FlowNode[] = [];
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = startX + i * (childSize.width + GAP_X);
    const pos = placeClear([...existing, ...placed], childSize, x, y);
    positions.push(pos);
    placed.push({ id: `layout-preview-${i}`, type: "flowNode", position: pos, data: { kind: childKind, title: "" } });
  }
  return positions;
}

/** Places a single child near its parent (used for one-to-one relationships like Branch -> Research, Insight -> New Question). */
export function layoutChildOf(existing: FlowNode[], parent: FlowNode, childKind: NodeKind): { x: number; y: number } {
  const parentBox = boxOf(parent);
  const x = parentBox.x;
  const y = parentBox.y + parentBox.h + GAP_Y;
  return placeClear(existing, NODE_SIZE[childKind], x, y);
}

/**
 * Lays out a parent's full row of children — every existing child the user hasn't manually
 * dragged, plus one new child — evenly centered under the parent using each child's real
 * rendered width. Children the user has moved (data.movedByUser) are left exactly where they
 * are and treated as obstacles instead, so a new branch never yanks a manually-placed sibling
 * back into formation.
 */
export function layoutFamilyRow(
  existing: FlowNode[],
  parent: FlowNode,
  siblings: FlowNode[],
  newChildKind: NodeKind,
): { repositioned: { id: string; position: { x: number; y: number } }[]; newChildPosition: { x: number; y: number } } {
  const parentBox = boxOf(parent);
  const y = parentBox.y + parentBox.h + GAP_Y;

  const movable = siblings.filter((s) => !s.data.movedByUser);
  const movableIds = new Set(movable.map((s) => s.id));
  const obstacles = existing.filter((n) => n.id !== parent.id && !movableIds.has(n.id));

  const row: { id: string; kind: NodeKind; size: Size }[] = [
    ...movable.map((s) => {
      const b = boxOf(s);
      return { id: s.id, kind: s.data.kind, size: { width: b.w, height: b.h } };
    }),
    { id: "__new__", kind: newChildKind, size: NODE_SIZE[newChildKind] },
  ];
  const totalWidth = row.reduce((sum, r) => sum + r.size.width, 0) + GAP_X * (row.length - 1);
  let cursorX = parentBox.x + parentBox.w / 2 - totalWidth / 2;

  const repositioned: { id: string; position: { x: number; y: number } }[] = [];
  let newChildPosition = { x: cursorX, y };
  const placedSoFar: FlowNode[] = [];

  for (const entry of row) {
    const size = entry.size;
    const pos = placeClear([...obstacles, ...placedSoFar], size, cursorX, y);
    placedSoFar.push({ id: entry.id, type: entry.kind, position: pos, data: { kind: entry.kind, title: "" } });
    if (entry.id === "__new__") newChildPosition = pos;
    else repositioned.push({ id: entry.id, position: pos });
    cursorX += size.width + GAP_X;
  }

  return { repositioned, newChildPosition };
}

/** Centers a node under the average position of a set of source nodes (used for Insight under its Findings). */
export function layoutBelowGroup(existing: FlowNode[], sources: FlowNode[], childKind: NodeKind): { x: number; y: number } {
  const childSize = NODE_SIZE[childKind];
  const boxes = sources.map(boxOf);
  const avgX = boxes.reduce((sum, b) => sum + b.x + b.w / 2, 0) / boxes.length;
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const x = avgX - childSize.width / 2;
  const y = maxY + GAP_Y;
  return placeClear(existing, childSize, x, y);
}

export function viewportCenterPosition(instance: { screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number } } | null, kind: NodeKind) {
  const size = NODE_SIZE[kind];
  if (!instance) return { x: 320, y: 240 };
  const center = instance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  return { x: center.x - size.width / 2, y: center.y - size.height / 2 };
}
