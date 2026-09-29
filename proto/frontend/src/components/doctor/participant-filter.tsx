"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Panel } from "@/components/ui/data";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPercent } from "@/lib/format";
import type { Diagnosis, Participant, ParticipantStatus } from "@/types/participant";

type SortKey = "displayId" | "signalQuality" | "lastSession" | "completedSessions";

const STATUS_TONE: Record<ParticipantStatus, "positive" | "caution" | "neutral" | "critical"> = {
  Active: "positive",
  Review: "caution",
  Complete: "neutral",
  Withdrawn: "critical",
};

const DIAGNOSIS_TONE: Record<Diagnosis, "primary" | "secondary" | "neutral"> = {
  ADHD: "primary",
  Control: "secondary",
  undetermined: "neutral",
  unknown: "neutral",
};

/**
 * Roster table with client-side search, filter and sort.
 *
 * All rows arrive from the API in one call; filtering is presentation only and
 * never changes what the server returned. Row rendering lives here rather than
 * in the page because a server component cannot hand a function to a client
 * component.
 */
export function ParticipantFilter({ rows }: { rows: Participant[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ParticipantStatus>("all");
  const [diagnosis, setDiagnosis] = useState<"all" | Diagnosis>("all");
  const [source, setSource] = useState<"all" | Participant["source"]>("all");
  const [lowQualityOnly, setLowQualityOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("displayId");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows
      .filter((participant) => {
        if (status !== "all" && participant.status !== status) return false;
        if (diagnosis !== "all" && participant.diagnosis !== diagnosis) return false;
        if (source !== "all" && participant.source !== source) return false;
        if (lowQualityOnly && participant.signalQuality >= 0.8) return false;
        if (!needle) return true;
        return (
          participant.displayId.toLowerCase().includes(needle) ||
          participant.id.toLowerCase().includes(needle) ||
          participant.tasks.some((task) => task.toLowerCase().includes(needle)) ||
          participant.devices.some((device) => device.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => {
        switch (sort) {
          case "signalQuality":
            return a.signalQuality - b.signalQuality;
          case "completedSessions":
            return a.completedSessions - b.completedSessions;
          case "lastSession":
            return (b.lastSession ?? "").localeCompare(a.lastSession ?? "");
          default:
            return a.displayId.localeCompare(b.displayId);
        }
      });
  }, [diagnosis, lowQualityOnly, query, rows, sort, source, status]);

  const headers = [
    "Participant",
    "Diagnosis",
    "Status",
    "Sessions",
    "Signal",
    "Behaviour",
    "Last session",
    "",
  ];

  return (
    <Panel bodyClassName="p-0">
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ID, device or task"
            aria-label="Search participants"
            className="pl-8"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label="Filter by status"
          className="w-auto"
        >
          <option value="all">All statuses</option>
          <option value="Active">Active</option>
          <option value="Review">Review</option>
          <option value="Complete">Complete</option>
          <option value="Withdrawn">Withdrawn</option>
        </Select>

        <Select
          value={diagnosis}
          onChange={(event) => setDiagnosis(event.target.value as typeof diagnosis)}
          aria-label="Filter by diagnosis"
          className="w-auto"
        >
          <option value="all">All diagnoses</option>
          <option value="ADHD">ADHD</option>
          <option value="Control">Control</option>
          <option value="undetermined">Undetermined</option>
          <option value="unknown">Unknown</option>
        </Select>

        <Select
          value={source}
          onChange={(event) => setSource(event.target.value as typeof source)}
          aria-label="Filter by source"
          className="w-auto"
        >
          <option value="all">All sources</option>
          <option value="balladeer">BALLADEER</option>
          <option value="adhdata">adhdata</option>
        </Select>

        <Select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Sort by"
          className="w-auto"
        >
          <option value="displayId">Sort: ID</option>
          <option value="signalQuality">Sort: lowest signal</option>
          <option value="completedSessions">Sort: fewest sessions</option>
          <option value="lastSession">Sort: recent</option>
        </Select>

        <label className="flex items-center gap-2 pb-2 text-[12.5px] text-ink-muted">
          <input
            type="checkbox"
            checked={lowQualityOnly}
            onChange={(event) => setLowQualityOnly(event.target.checked)}
            className="size-3.5 accent-[var(--color-primary-600)]"
          />
          Low signal only
        </label>
      </div>

      <p className="px-5 py-2 text-[11.5px] text-ink-subtle">
        {filtered.length} of {rows.length} participants
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-[13px]">
          <thead>
            <tr className="border-y border-line">
              {headers.map((label) => (
                <th
                  key={label || "open"}
                  className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((participant) => (
              <tr key={participant.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <span className="block font-medium text-ink">{participant.displayId}</span>
                  <span className="block text-[11.5px] text-ink-subtle">
                    {participant.source} · {participant.age} y · {participant.gender}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={DIAGNOSIS_TONE[participant.diagnosis]}>
                    {participant.diagnosis}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={STATUS_TONE[participant.status]}>{participant.status}</Badge>
                </td>
                <td className="px-5 py-3 text-ink-muted tabular-nums">
                  {participant.completedSessions} / {participant.sessionCount}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={
                      participant.signalQuality < 0.8
                        ? "font-medium text-caution-700 tabular-nums"
                        : "text-ink-muted tabular-nums"
                    }
                  >
                    {formatPercent(participant.signalQuality, 1)}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {participant.behaviorLinked ? (
                    <span className="text-[12.5px] text-ink-muted">linked</span>
                  ) : (
                    <span className="text-[12.5px] text-ink-subtle">EEG only</span>
                  )}
                </td>
                <td className="px-5 py-3 text-ink-muted">
                  {participant.lastSession ? formatDate(participant.lastSession) : "—"}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/doctor/participants/${participant.id}`}
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary-700 hover:underline"
                  >
                    Open
                    <ArrowRight className="size-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-[12.5px] text-ink-subtle">
          No participants match these filters.
        </p>
      ) : null}
    </Panel>
  );
}
