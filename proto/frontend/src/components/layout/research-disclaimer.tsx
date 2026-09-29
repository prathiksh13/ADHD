import { FlaskConical, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/ui/notice";

/**
 * Research-prototype banner.
 *
 * Required on any screen that shows a model output. The platform reports
 * research screening results and model probabilities — never a diagnosis.
 */
export function ResearchDisclaimer({ className }: { className?: string }) {
  return (
    <Notice tone="caution" icon={<FlaskConical />} className={cn("items-start", className)}>
      <p>
        <span className="font-semibold">Research prototype — not a medical device.</span> All outputs
        are model predictions from a research pipeline. They are screening signals for study
        purposes only and must not be used to diagnose, rule out, or guide treatment decisions.
      </p>
    </Notice>
  );
}

/** Softer inline variant for dense tables and result cards. */
export function InlineDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-subtle", className)}>
      <Info className="mt-px size-3 shrink-0" />
      <span>
        Research screening result from a research model. Not a clinical diagnosis and not a
        substitute for professional assessment.
      </span>
    </p>
  );
}
