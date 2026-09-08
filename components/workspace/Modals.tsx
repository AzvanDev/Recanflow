import { ChevronRight, Grip, X } from "lucide-react";

export function OnboardingModal({ onDone }: { onDone: () => void }) {
  return (
    <div className="modal-shade">
      <div className="welcome">
        <span className="logo large">
          <Grip size={22} />
        </span>
        <span className="eyebrow">WELCOME TO RECAN FLOW</span>
        <h1>
          Think in branches,
          <br />
          not tabs.
        </h1>
        <p>Turn a question into a visual research map — then follow the ideas that matter.</p>
        <ol>
          <li>Start with a question.</li>
          <li>Explore branches.</li>
          <li>Research and save findings.</li>
          <li>Synthesize, then challenge what you found.</li>
        </ol>
        <button className="primary" onClick={onDone}>
          Get started <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-shade" onMouseDown={onClose}>
      <div className="welcome help-card" onMouseDown={(e) => e.stopPropagation()}>
        <button className="dialog-close" aria-label="Close help" onClick={onClose}>
          <X size={17} />
        </button>
        <span className="eyebrow">QUICK GUIDE</span>
        <h1>Build your map.</h1>
        <p>Choose Select to marquee ideas, or Hand to pan the canvas. Drag a node&apos;s edge handle onto another node to connect them.</p>
        <ol>
          <li><b>Q</b> adds a question, <b>N</b> a note, <b>R</b> research.</li>
          <li><b>F</b> saves the open research response as a finding.</li>
          <li><b>I</b> synthesizes 2+ selected findings into an insight.</li>
          <li><b>Ctrl/Cmd + Z</b> undo, <b>Ctrl/Cmd + Shift + Z</b> redo.</li>
          <li><b>Space + drag</b> pans the canvas; <b>Delete</b> removes the selection.</li>
          <li><b>Ctrl / Cmd + K</b> searches nodes.</li>
        </ol>
        <button className="primary" onClick={onClose}>
          Got it <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
