import type { Node, NodeProps } from "@xyflow/react";
import { MessageCircle } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell, StatusBadge } from "./shared";

export function ResearchNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const findingCount = data.findingIds?.length ?? 0;
  const messageCount = data.messages?.length ?? 0;
  const editableTitle = !data.provenance;

  return (
    <NodeShell kind="research" selected={selected} dimmed={data.dimmed}>
      <div className="node-kicker-trailer">
        <StatusBadge status={data.status} />
      </div>
      {editableTitle ? (
        <input
          className="nodrag node-title-input"
          value={data.title}
          placeholder="New research topic…"
          onChange={(e) => data.onAction?.("editTitle", id, e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      ) : (
        <h3>{data.title}</h3>
      )}
      <p>{data.description || "Ask questions to build evidence for this branch."}</p>
      <div className="node-meta">
        {messageCount} message{messageCount === 1 ? "" : "s"} · {findingCount} finding{findingCount === 1 ? "" : "s"}
      </div>
      <div className="node-footer">
        <button
          className="node-action nodrag"
          onClick={(e) => {
            e.stopPropagation();
            data.onAction?.("openResearch", id);
          }}
        >
          <MessageCircle size={12} /> Open research
        </button>
      </div>
    </NodeShell>
  );
}
