import { cn } from "@/lib/utils";
type Props = { samples?: readonly number[]; className?: string; label?: string; showCaption?: boolean };
export function EegWaveform({ samples = [], className, label = "EEG signal preview", showCaption = true }: Props) {
  const values = samples.filter(Number.isFinite).slice(0, 2000);
  const peak = Math.max(1e-12, ...values.map(Math.abs));
  const path = values.length > 1 ? "M " + values.map((value, i) => `${(i * 600 / (values.length - 1)).toFixed(2)},${(80 - value / peak * 60).toFixed(2)}`).join(" ") : "";
  return <div className={cn("relative overflow-hidden rounded-xl border border-line bg-ink", className)}>
    <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label={label} className="h-full w-full">
      {[0, 40, 80, 120, 160].map((y) => <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="rgba(255,255,255,.08)" />)}
      {path ? <path d={path} fill="none" stroke="#3fbdb0" strokeWidth="1.8" /> : <text x="300" y="85" textAnchor="middle" fill="#cbd5e1" fontSize="14">No signal samples available</text>}
    </svg>
    {showCaption ? <p className="absolute left-3 top-2 text-xs text-white/60">{values.length ? `EEG preview · ${values.length} samples` : "Upload a recording to view a signal"}</p> : null}
  </div>;
}
