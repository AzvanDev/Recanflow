import { useState } from "react";
import { ChevronDown, Clipboard, Grip, PanelRight, Share2 } from "lucide-react";

export function TopLeftHeader({
  workspaceName,
  onRename,
  onToggleSidebar,
}: {
  workspaceName: string;
  onRename: (name: string) => void;
  onToggleSidebar: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workspaceName);
  return (
    <header className="floating top-left">
      <button className="brand" onClick={onToggleSidebar} aria-label="Open workspaces">
        <span className="logo">
          <Grip size={14} />
        </span>
        <b>ReCan Flow</b>
      </button>
      <span className="divider" />
      {editing ? (
        <input
          autoFocus
          className="workspace-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim()) onRename(draft.trim());
            else setDraft(workspaceName);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(workspaceName);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span
          className="workspace-name"
          onDoubleClick={() => {
            setDraft(workspaceName);
            setEditing(true);
          }}
          title="Double-click to rename"
        >
          {workspaceName}
        </span>
      )}
      <span className="free">Free</span>
      <ChevronDown size={15} />
    </header>
  );
}

export function TopRightControls({ onOpenPanel, onShare }: { onOpenPanel: () => void; onShare: () => void }) {
  return (
    <div className="floating top-right">
      <button className="ai-status" aria-label="Open AI panel" title="Open AI panel" onClick={onOpenPanel}>
        <PanelRight size={16} />
      </button>
      <span className="avatar">R</span>
      <button className="share" onClick={onShare}>
        <Share2 size={14} /> Share
      </button>
    </div>
  );
}

export function ShareToast() {
  return (
    <div className="share-toast floating">
      <Clipboard size={15} /> Link copied to clipboard
    </div>
  );
}
