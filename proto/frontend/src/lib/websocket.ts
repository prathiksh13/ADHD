/**
 * Live EEG transport.
 *
 * Placeholder for the Phase-7 WebSocket path. The contract is fixed now so the
 * offline screens and the live screens keep the same visual components:
 *
 *   EEG device → BrainFlow / SDK → FastAPI → WebSocket → this client
 *   ws://<api>/ws/eeg/{sessionId}
 *
 * Nothing in the UI depends on this module yet; live screens read
 * `getStreamState()` which reports `unsupported` until a device bridge exists.
 */

export type StreamState = "unsupported" | "idle" | "connecting" | "streaming" | "error";

export type StreamFrame = {
  /** Milliseconds since the stream opened. */
  elapsed: number;
  /** Latest sample per channel, in microvolts. */
  channels: Record<string, number>;
  /** Optional device-side quality estimate, 0–1. */
  quality?: number;
};

export const STREAM_ENDPOINT = (sessionId: string, base = process.env.NEXT_PUBLIC_API_BASE_URL) =>
  `${base?.replace(/^http/, "ws") ?? "ws://localhost:8000"}/ws/eeg/${sessionId}`;

export function getStreamState(): StreamState {
  return "unsupported";
}

export function isLiveModeEnabled() {
  return process.env.NEXT_PUBLIC_LIVE_EEG === "1";
}
