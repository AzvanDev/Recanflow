import type { Node, NodeProps } from "@xyflow/react";
import { ExternalLink } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell } from "./shared";

export function ResearchBranchNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const items = data.researchItems || [];

  return (
    <NodeShell kind="researchBranch" selected={selected}>
      <h3>Research {items.length > 0 ? `(${items.length})` : ""}</h3>
      <div className="research-branch-items">
        {items.map((item) => {
          const meta = [item.institution, item.year, item.sourceType].filter(Boolean).join(" · ");
          return (
            <div key={item.id} className="research-branch-item">
              <span className="research-branch-item-title">{item.title}</span>
              {meta && <span className="research-branch-item-meta">{meta}</span>}
              {item.url && (
                <a
                  className="node-action nodrag"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={11} /> Open
                </a>
              )}
            </div>
          );
        })}
      </div>
    </NodeShell>
  );
}
