"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Ticks once per second while `running` is true. */
export function useTicker(running: boolean, intervalMs = 1000) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed * 1000;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
    }, intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, intervalMs]);

  const reset = useCallback(() => {
    startRef.current = null;
    setElapsed(0);
  }, []);

  return { elapsed, reset };
}
