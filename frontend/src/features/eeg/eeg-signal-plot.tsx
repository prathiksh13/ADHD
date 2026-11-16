"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

export interface SignalPreview {
  channels: string[];
  samples: number[][];
  sample_rate_hz: number;
  duration_seconds: number;
  description: string;
}

export function readSignalPreview(value: unknown): SignalPreview | null {
  if (!value || typeof value !== "object") return null;
  const p = value as SignalPreview;
  if (!Array.isArray(p.channels) || !Array.isArray(p.samples) || p.channels.length < 1 || p.channels.length > 26
      || p.samples.length !== p.channels.length || !p.channels.every((c) => typeof c === "string")
      || !Number.isFinite(p.sample_rate_hz) || p.sample_rate_hz <= 0
      || !Number.isFinite(p.duration_seconds) || p.duration_seconds <= 0
      || !p.samples.every((s) => Array.isArray(s) && s.length > 1 && s.length <= 10000 && s.every((n) => typeof n === "number" && Number.isFinite(n)))) return null;
  return { ...p, description: typeof p.description === "string" ? p.description : "Selected EEG segment" };
}

export function EegSignalPlot({ preview }: { preview: SignalPreview }) {
  const ref = useRef<SVGSVGElement>(null);
  const amplitude = preview.samples.reduce((max, channel) => channel.reduce((peak, n) => Math.max(peak, Math.abs(n)), max), 1);
  const height = preview.channels.length * 70 + 55;
  function download() {
    if (!ref.current) return;
    const xml = new XMLSerializer().serializeToString(ref.current);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "eeg-signal-preview.svg"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
    <h3 className="text-lg font-semibold text-ink">Your EEG signal</h3>
    <p className="text-sm leading-6 text-ink-muted">{preview.description}</p>
    <p className="text-xs text-ink-subtle">{preview.duration_seconds} seconds · {preview.sample_rate_hz} Hz preview · shared vertical scale ±{amplitude.toFixed(1)} µV per channel.</p>
    <div className="overflow-x-auto"><svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 960 ${height}`} className="min-w-[640px] w-full" role="img" aria-label="EEG electrical signals from the uploaded recording, labelled by electrode and time">
      <title>EEG electrical signals from uploaded recording</title>
      <rect width="960" height={height} fill="white" />
      {Array.from({ length: 5 }, (_, i) => <g key={i}><line x1={75 + i * 215} x2={75 + i * 215} y1="10" y2={height - 35} stroke="#e2e8f0" />
        <text x={75 + i * 215} y={height - 12} fill="#475569" fontSize="12" textAnchor="middle">{(preview.duration_seconds * i / 4).toFixed(1)} s</text></g>)}
      {preview.channels.map((channel, index) => {
        const y = index * 70 + 40;
        return <g key={channel}><text x="10" y={y + 4} fill="#1e293b" fontSize="13">{channel}</text>
          <line x1="75" x2="935" y1={y} y2={y} stroke="#e2e8f0" />
          <polyline fill="none" stroke="#315b80" strokeWidth="1.2" points={preview.samples[index].map((v, i, all) => `${75 + i / (all.length - 1) * 860},${y - v / amplitude * 28}`).join(" ")} />
        </g>;
      })}
    </svg></div>
    <Button type="button" variant="outline" onClick={download}>Download signal image (SVG)</Button>
    <p className="text-xs leading-5 text-ink-subtle">This displays measured electrical activity, not a picture of the brain. Signal shape alone cannot diagnose ADHD. Preview samples are not saved to Firestore.</p>
  </section>;
}
