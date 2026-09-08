import { useMemo, useState } from "react";
import { Command, Search } from "lucide-react";
import type { FlowNode } from "@/lib/types";
import { KIND_LABEL } from "./nodes/shared";

export function CommandPalette({ nodes, onClose, onSelect }: { nodes: FlowNode[]; onClose: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => `${n.data.title} ${n.data.description || ""} ${n.data.content || ""}`.toLowerCase().includes(q));
  }, [nodes, query]);

  return (
    <div className="modal-shade" onMouseDown={onClose}>
      <div className="command" onMouseDown={(e) => e.stopPropagation()}>
        <Search size={18} />
        <input autoFocus placeholder="Search your research…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <kbd>
          <Command size={12} />K
        </kbd>
        <div className="results">
          {results.length === 0 && <p className="chat-empty">No matching nodes.</p>}
          {results.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                onSelect(n.id);
                onClose();
              }}
            >
              <span className="result-icon">{KIND_LABEL[n.data.kind][0]}</span>
              <span>
                <b>{n.data.title || `Untitled ${KIND_LABEL[n.data.kind].toLowerCase()}`}</b>
                <small>{n.data.description || n.data.content || ""}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
