import { ArrowRight, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { InlineDisclaimer } from "@/components/layout/research-disclaimer";
import { formatDateTime, formatPercent } from "@/lib/format";
import type { ModelArchitecture } from "@/types/model";

/**
 * Research screening result card.
 *
 * Deliberately worded as *model output* and *classification probability*.
 * It never says "diagnosis" or "diagnosed".
 */
export function PredictionCard({
  result,
  probability,
  model,
  sessionId,
  evaluatedAt,
  className,
  confidenceNote,
}: {
  result: string;
  probability: number | null;
  model: ModelArchitecture | null;
  sessionId?: string;
  evaluatedAt?: string;
  className?: string;
  confidenceNote?: string;
}) {
  const elevated = (probability ?? 0) >= 0.5;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3",
          elevated ? "border-caution-100 bg-caution-50" : "border-primary-100 bg-primary-50",
        )}
      >
        <div className="flex items-center gap-2">
          <Badge tone={elevated ? "caution" : "primary"}>Model output</Badge>
          <p className="text-[12px] text-ink-muted">
            {model ? model.name : "model unavailable"}
            {sessionId ? ` · ${sessionId}` : ""}
          </p>
        </div>
        {evaluatedAt ? (
          <p className="text-[11.5px] text-ink-subtle">evaluated {formatDateTime(evaluatedAt)}</p>
        ) : null}
      </div>

      <div className="grid gap-6 p-5 sm:grid-cols-[1fr_220px]">
        <div className="flex flex-col gap-3">
          <p className="text-lg leading-snug font-semibold tracking-tight text-ink">{result}</p>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-medium text-ink-muted">
                Classification probability
              </span>
              <span className="text-[15px] font-semibold text-ink tabular-nums">
                {probability === null ? "—" : formatPercent(probability, 1)}
              </span>
            </div>
            <Progress
              value={probability ?? 0}
              size="md"
              tone={elevated ? "caution" : "primary"}
            />
            <div className="flex justify-between text-[10.5px] text-ink-subtle">
              <span>Control-associated</span>
              <span className="tabular-nums">0.5 decision threshold</span>
              <span>ADHD-associated</span>
            </div>
          </div>

          {confidenceNote ? (
            <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-muted">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-caution-600" />
              {confidenceNote}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5 rounded-md border border-line bg-surface-subtle p-4">
          <p className="section-label">How to read this</p>
          <ul className="flex flex-col gap-2 text-[11.5px] leading-relaxed text-ink-muted">
            <li>
              This is the output of one trained research model on one recorded session.
            </li>
            <li>
              Probability describes model confidence, not a clinical likelihood of any condition.
            </li>
            <li>It cannot confirm or rule out anything.</li>
          </ul>
          <ButtonLink
            href="/research/explainability"
            variant="secondary"
            size="sm"
            className="mt-auto w-full"
          >
            What contributed to this
            <ArrowRight className="size-3.5" />
          </ButtonLink>
        </div>
      </div>

      <div className="border-t border-line bg-surface-subtle px-5 py-3">
        <InlineDisclaimer />
      </div>
    </Card>
  );
}

/** Horizontal importance bars — reused for channels, bands and time windows. */
export function ImportanceBars({
  items,
  emptyLabel = "No data",
  className,
}: {
  items: { label: string; value: number; note?: string }[];
  emptyLabel?: string;
  className?: string;
}) {
  if (!items.length) {
    return <p className={cn("text-[12.5px] text-ink-subtle", className)}>{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.value)) || 1;

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[12.5px] font-medium text-ink">
            {item.label}
          </span>
          <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-primary-500"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </span>
          <span className="w-20 shrink-0 text-right text-[12px] text-ink-muted tabular-nums">
            {item.note ?? formatPercent(item.value, 1)}
          </span>
        </li>
      ))}
    </ul>
  );
}
