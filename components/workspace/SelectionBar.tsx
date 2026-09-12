import { useState } from "react";
import { Sparkles } from "lucide-react";

export function SelectionBar({
  busy,
  onAsk,
  onSummarize,
}: {
  busy: boolean;
  onAsk: (question: string) => void;
  onSummarize: () => void;
}) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim() || busy) return;
    onAsk(value.trim());
    setValue("");
  }

  return (
    <div className="selection-bar floating">
      <input
        placeholder="Ask AI about selection…"
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setValue("");
        }}
      />
      <i />
      <button className="selection-bar-summarize" disabled={busy} onClick={onSummarize}>
        <Sparkles size={13} /> {busy ? "Working…" : "Summarize"}
      </button>
    </div>
  );
}
