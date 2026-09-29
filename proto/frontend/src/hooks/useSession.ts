"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/types/session";
import { getSessionDetail } from "@/lib/api";
import type { EEGPayload } from "@/types/eeg";

type SessionState = {
  session: Session | null;
  eeg: EEGPayload | null;
  loading: boolean;
  error: string | null;
};

/**
 * Reads a session and its EEG payload.
 *
 * The processing screen re-polls while the backend reports a running stage.
 * Progress is never simulated: the UI renders exactly what the stage list says.
 */
export function useSession(sessionId: string, options: { poll?: boolean } = {}) {
  const [state, setState] = useState<SessionState>({
    session: null,
    eeg: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const detail = await getSessionDetail(sessionId);
        if (cancelled) return;
        if (!detail) {
          setState({ session: null, eeg: null, loading: false, error: "Session not found" });
          return;
        }
        setState({ session: detail.session, eeg: detail.eeg, loading: false, error: null });
      } catch {
        if (!cancelled) {
          setState({ session: null, eeg: null, loading: false, error: "Request failed" });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!options.poll) return;
    if (state.session && state.session.status !== "processing") return;
    const id = window.setInterval(() => {
      void (async () => {
        const detail = await getSessionDetail(sessionId);
        if (detail) setState((prev) => ({ ...prev, session: detail.session, eeg: detail.eeg }));
      })();
    }, 4000);
    return () => window.clearInterval(id);
  }, [options.poll, sessionId, state.session]);

  return state;
}
