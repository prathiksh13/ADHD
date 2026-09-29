/**
 * Data access layer.
 *
 * Every screen reads through this module. Right now it resolves from the
 * deterministic fixtures in `mock-data.ts` so the whole interface works before
 * the Python service exists. When FastAPI is available, swap the body of each
 * function for a `fetch` against the documented contract:
 *
 *   POST /api/sessions
 *   POST /api/sessions/{id}/upload
 *   POST /api/experiments/start
 *   POST /api/experiments/event
 *   GET  /api/sessions/{id}
 *   GET  /api/sessions/{id}/eeg
 *   GET  /api/sessions/{id}/results
 *   GET  /api/models
 *
 * Nothing in `src/app` or `src/components` imports from `mock-data` directly,
 * so the swap is confined to this file.
 */

import {
  modelArchitectures,
  modelResults,
  experiments,
  getParticipant,
  getSession,
  getSessionsForParticipant,
  participants,
  participantStats,
  sessionStats,
  sessions,
  doctorStats,
  researchStats,
  buildEEGPayload,
  bandImportance,
  channelImportance,
  featureImportance,
  temporalImportance,
  attentionWeights,
  getTrainingCurves,
  getBestModel,
} from "./mock-data";
import { DATASETS } from "./constants";
import type { EEGPayload } from "@/types/eeg";
import type { Participant } from "@/types/participant";
import type { Session } from "@/types/session";
import type {
  ExperimentPlan,
  ModelArchitecture,
  ModelResult,
  TrainingCurve,
} from "@/types/model";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Simulated latency keeps loading states honest during development. */
const latency = process.env.NODE_ENV === "production" ? 0 : 120;

async function resolve<T>(value: () => T): Promise<T> {
  if (latency > 0) await new Promise((r) => setTimeout(r, latency));
  return value();
}

/* ---------------------------------- auth --------------------------------- */

export type AuthResult = {
  ok: true;
  role: "participant" | "doctor" | "researcher";
  redirectTo: string;
};

export async function signIn(_input: {
  email: string;
  password: string;
  role: AuthResult["role"];
}): Promise<AuthResult> {
  return resolve(() => ({
    ok: true as const,
    role: _input.role,
    redirectTo:
      _input.role === "participant"
        ? "/participant/dashboard"
        : _input.role === "doctor"
          ? "/doctor/dashboard"
          : "/research/dashboard",
  }));
}

/* ------------------------------ participants ----------------------------- */

export async function listParticipants(): Promise<{
  rows: Participant[];
  stats: typeof participantStats;
}> {
  return resolve(() => ({ rows: participants, stats: participantStats }));
}

export async function getParticipantDetail(id: string) {
  const participant = getParticipant(id);
  if (!participant) return null;
  return {
    participant,
    sessions: getSessionsForParticipant(id),
    eeg: buildEEGPayload(id, id.includes("CGX") ? "cgx29" : "epoc14", {
      artifact: participant.signalQuality < 0.8,
    }),
  };
}

/* -------------------------------- sessions ------------------------------- */

export async function listSessions(): Promise<{
  rows: Session[];
  stats: typeof sessionStats;
}> {
  return resolve(() => ({ rows: sessions, stats: sessionStats }));
}

export async function listParticipantSessions(participantId: string): Promise<Session[]> {
  return resolve(() => getSessionsForParticipant(participantId));
}

export async function getSessionDetail(id: string) {
  const session = getSession(id);
  if (!session) return null;
  const eeg: EEGPayload = buildEEGPayload(
    id,
    session.channels > 20 ? "cgx29" : session.samplingRateHz === 128 ? "epoc14" : "adhdata",
    { artifact: session.flagged },
  );
  return { session, eeg };
}

/**
 * Existence check used to 404 a bad route before rendering.
 *
 * Returns only what a page needs to confirm the id resolves, so callers do not
 * pull a full EEG payload just to validate a URL.
 */
export async function getSessionSummary(id: string) {
  const session = getSession(id);
  if (!session) return null;
  return { id: session.id, status: session.status };
}

export async function getSessionResults(id: string) {
  const detail = await getSessionDetail(id);
  if (!detail) return null;
  const { session, eeg } = detail;
  const modelId = session.modelId ?? "cnn-lstm-attn";
  return {
    session,
    eeg,
    model: modelArchitectures.find((m) => m.id === modelId) ?? null,
    result: session.probability,
    bandImportance,
    channelImportance: channelImportance.slice(0, 12),
    temporalImportance,
    attentionWeights,
  };
}

/* --------------------------------- models -------------------------------- */

export async function listModels(): Promise<{
  architectures: ModelArchitecture[];
  results: ModelResult[];
  best: ModelResult | undefined;
}> {
  return resolve(() => ({
    architectures: modelArchitectures,
    results: modelResults,
    best: getBestModel(),
  }));
}

export async function getModelDetail(modelId: string) {
  const model = modelArchitectures.find((m) => m.id === modelId);
  if (!model) return null;
  return {
    model,
    result: modelResults.find((r) => r.modelId === modelId) ?? null,
    curve: getTrainingCurves(modelId),
    attentionWeights: model.family.includes("Attention") ? attentionWeights : [],
  };
}

export async function listExperiments(): Promise<ExperimentPlan[]> {
  return resolve(() => experiments);
}

export async function getExplainability(modelId = "cnn-lstm-attn") {
  return resolve(() => ({
    modelId,
    channels: channelImportance,
    bands: bandImportance,
    features: featureImportance,
    temporal: temporalImportance,
    attention: attentionWeights,
  }));
}

export async function getDatasets() {
  return resolve(() => DATASETS);
}

export async function getResearchOverview() {
  return resolve(() => ({
    stats: researchStats,
    experiments,
    results: modelResults,
    architectures: modelArchitectures,
    curve: getTrainingCurves("cnn-lstm-attn") as TrainingCurve[],
  }));
}

export async function getDoctorOverview() {
  return resolve(() => ({
    stats: doctorStats,
    sessions: sessions.slice(0, 12),
    participants: participants.slice(0, 8),
  }));
}
