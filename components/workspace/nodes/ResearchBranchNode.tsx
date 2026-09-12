import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell } from "./shared";

// Kept compact on the canvas — a quick peek at what's been collected, never the full paper
// list. Full titles, meta, and Open links live in the right-side panel (AIResearchPanel).
const PREVIEW_COUNT = 3;

export function ResearchBranchNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const items = data.researchItems || [];
  const preview = items.slice(0, PREVIEW_COUNT);
  const remaining = items.length - preview.length;

  return (
    <NodeShell kind="researchBranch" selected={selected} dimmed={data.dimmed}>
      <h3>Research {items.length > 0 ? `(${items.length})` : ""}</h3>
      {items.length === 0 ? (
        <p>No research added yet.</p>
      ) : (
        <div className="research-branch-items">
          {preview.map((item) => (
            <span key={item.id} className="research-branch-item-title">{item.title}</span>
          ))}
          {remaining > 0 && <span className="research-branch-more">+{remaining} more</span>}
        </div>
      )}
    </NodeShell>
  );
}
