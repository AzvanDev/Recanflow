import { useState } from "react";
import { ArrowRight } from "lucide-react";

export function EmptyState({ onStart }: { onStart: (question: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="empty-state">
      <div className="empty-card">
        <span className="eyebrow">START A RESEARCH FLOW</span>
        <h1>What do you want to understand?</h1>
        <div className="empty-composer">
          <textarea
            autoFocus
            rows={2}
            placeholder="Type a question…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (value.trim()) onStart(value.trim());
              }
            }}
          />
          <button className="primary wide" disabled={!value.trim()} onClick={() => value.trim() && onStart(value.trim())}>
            Explore <ArrowRight size={15} />
          </button>
        </div>
        <p className="empty-hint">Press <kbd>Q</kbd> to add a question</p>
      </div>
    </div>
  );
}
