import { Brain, CheckCircle2, Clock, Cpu, GitBranch, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/format";
import type { ModelArchitecture, ModelResult } from "@/types/model";

export function ModelCard({
  model,
  result,
  best = false,
  className,
}: {
  model: ModelArchitecture;
  result?: ModelResult;
  best?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-4 p-5 transition-colors",
        best && "border-primary-300 bg-primary-50/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md",
              best ? "bg-primary-700 text-ink-inverse" : "bg-surface-sunken text-ink-muted",
            )}
          >
            <Brain className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
              {model.name}
              {best ? (
                <Badge tone="solid">
                  <CheckCircle2 className="size-3" />
                  Best
                </Badge>
              ) : null}
            </h3>
            <p className="mt-0.5 text-[11.5px] text-ink-subtle">{model.family}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10.5px] font-medium tracking-[0.05em] text-ink-subtle uppercase">
            Accuracy
          </p>
          <p className="text-xl font-semibold text-ink tabular-nums">
            {result ? formatPercent(result.metrics.accuracy, 1) : "—"}
          </p>
          {result?.standardDeviation.accuracy ? (
            <p className="text-[10.5px] text-ink-subtle tabular-nums">
              ±{(result.standardDeviation.accuracy * 100).toFixed(1)}
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-ink-muted">{model.description}</p>

      <dl className="grid grid-cols-3 gap-3 border-t border-line pt-3.5">
        <Fact icon={Layers} label="Input" value={model.inputShape} />
        <Fact icon={Cpu} label="Parameters" value={model.parameters} />
        <Fact
          icon={Clock}
          label="Epochs"
          value={model.epochs ? String(model.epochs) : "not trained"}
        />
      </dl>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={result ? "positive" : "neutral"}>
          {result ? `${result.folds}-fold participant CV` : "Not evaluated"}
        </Badge>
        <Badge tone="outline">
          <GitBranch className="size-3" />
          seed {result?.seed ?? "—"}
        </Badge>
        {result ? (
          <Badge tone="outline">run {result.runId}</Badge>
        ) : (
          <Badge tone="caution">metrics unavailable</Badge>
        )}
      </div>
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10.5px] font-medium text-ink-subtle">
        <Icon className="size-3" />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[12.5px] font-semibold text-ink tabular-nums">
        {value}
      </dd>
    </div>
  );
}
