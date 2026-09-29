"use client";

import { useEffect, useRef, useState } from "react";
import { STREAM_ENDPOINT, isLiveModeEnabled, type StreamFrame } from "@/lib/websocket";

type StreamStatus = "idle" | "connecting" | "streaming" | "error" | "unsupported";

/**
 * Subscribes to the live EEG WebSocket once a device bridge exists.
 *
 * The hook stays inert while `NEXT_PUBLIC_LIVE_EEG` is unset, so the offline
 * workflow is unaffected. It intentionally exposes the raw frame so the same
 * waveform components can render recorded and live data.
 */
export function useEEGStream(sessionId: string) {
  const [status, setStatus] = useState<StreamStatus>(
    isLiveModeEnabled() ? "idle" : "unsupported",
  );
  const [frames, setFrames] = useState<StreamFrame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  function connect() {
    if (!isLiveModeEnabled()) {
      setStatus("unsupported");
      return;
    }
    setStatus("connecting");
    setError(null);
    try {
      const socket = new WebSocket(STREAM_ENDPOINT(sessionId));
      socketRef.current = socket;
      socket.onopen = () => setStatus("streaming");
      socket.onmessage = (event) => {
        const frame = JSON.parse(event.data) as StreamFrame;
        setFrames((prev) => [...prev.slice(-240), frame]);
      };
      socket.onerror = () => {
        setStatus("error");
        setError("Could not reach the EEG stream endpoint.");
      };
      socket.onclose = () => setStatus("idle");
    } catch {
      setStatus("error");
      setError("Could not open the EEG stream.");
    }
  }

  function disconnect() {
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("idle");
  }

  useEffect(() => () => socketRef.current?.close(), []);

  return { status, frames, error, connect, disconnect, supported: isLiveModeEnabled() };
}
