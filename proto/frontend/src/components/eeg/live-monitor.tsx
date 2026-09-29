"use client";

import { useMemo } from "react";
import { Radio, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyValueList, Panel } from "@/components/ui/data";
import { Notice } from "@/components/ui/notice";
import { useEEGStream } from "@/hooks/useEEGStream";
import { LiveWaveform } from "@/components/eeg/live-waveform";
import { formatMs } from "@/lib/format";

/**
 * Live capture surface.
 *
 * Only mounted when `NEXT_PUBLIC_LIVE_EEG=1`, so the offline build never
 * renders it. Frames come from the device bridge; nothing is synthesised here.
 */
export function LiveMonitor({ sessionId }: { sessionId: string }) {
  const { status, frames, error, connect, disconnect, supported } = useEEGStream(sessionId);

  const channels = useMemo(() => {
    const names = new Set<string>();
    for (const frame of frames) for (const key of Object.keys(frame.channels)) names.add(key);
    return [...names].slice(0, 8);
  }, [frames]);

  const quality = frames.at(-1)?.quality ?? null;
  const elapsed = frames.at(-1)?.elapsed ?? 0;

  if (!supported) {
    return (
      <Notice tone="info">
        <p>Live capture is disabled in this build.</p>
      </Notice>
    );
  }

  return (
    <div className="grid gap-4">
      <Panel
        title="Live signal"
        icon={Radio}
        description={status === "streaming" ? "Streaming from the device bridge." : "Not connected."}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={status === "streaming" ? "positive" : status === "error" ? "critical" : "neutral"}>
              {status}
            </Badge>
            {status === "streaming" ? (
              <Button variant="secondary" size="sm" onClick={disconnect}>
                <Square className="size-3.5" />
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={connect}>
                <Radio className="size-3.5" />
                Connect
              </Button>
            )}
          </div>
        }
      >
        {error ? (
          <Notice tone="critical" className="mb-4">
            <p>{error}</p>
          </Notice>
        ) : null}

        {frames.length ? (
          <>
            <LiveWaveform frames={frames} channels={channels} height={190} />
            <KeyValueList
              className="mt-4"
              columns={3}
              items={[
                { label: "Channels", value: String(channels.length) },
                { label: "Elapsed", value: formatMs(elapsed) },
                {
                  label: "Device quality",
                  value: quality === null ? "—" : `${Math.round(quality * 100)}%`,
                },
              ]}
            />
          </>
        ) : (
          <p className="py-8 text-center text-[12.5px] text-ink-subtle">
            No frames received yet. Connect to the device bridge to begin.
          </p>
        )}
      </Panel>
    </div>
  );
}
