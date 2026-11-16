import { NextResponse } from "next/server";
import { validateAttentionSessionPayload } from "@/features/attention/attention-session";

const MAX_BODY_BYTES = 1_000_000;

/**
 * Accepts one completed attention-session payload. Raw video, images and audio
 * are never accepted or stored. The route validates the structured telemetry,
 * echoes the client-computed summary, and deliberately keeps no server copy.
 */
export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Payload too large." },
      { status: 413, headers: { "cache-control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Payload too large." },
        { status: 413, headers: { "cache-control": "no-store" } },
      );
    }
    body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const result = validateAttentionSessionPayload(body);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      sessionId: result.payload.sessionId,
      acceptedEvents: result.payload.telemetryEvents.length,
      summary: result.payload.summary,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
