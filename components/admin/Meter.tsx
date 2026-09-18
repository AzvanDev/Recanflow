export function Meter({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="meter">
      {label && <div className="meter-label">{label}</div>}
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${clamped}%` }} />
      </div>
      <div className="meter-value">{Math.round(clamped)}% used</div>
    </div>
  );
}
