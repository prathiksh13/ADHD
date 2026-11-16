"""Bounded, derived webcam telemetry only. Never accepts raw frames or landmarks."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TelemetryModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


Affect = Literal["Engaged", "Neutral", "Frustrated", "Fatigued"]


class TelemetryEvent(TelemetryModel):
    type: Literal["BLINK", "DISTRACTION_START", "DISTRACTION_END", "ALERT_TRIGGERED", "EMOTION_SHIFT"]
    performanceNow: float = Field(ge=0)
    timestamp: str = Field(max_length=35)
    elapsedMs: float = Field(ge=0)
    state: Literal["ON_SCREEN", "OFF_SCREEN"] | None = None
    affect: Affect | None = None
    channel: Literal["visual", "audio"] | None = None
    stage: Literal[1, 2] | None = None
    durationMs: float | None = Field(default=None, ge=0)
    recoveryLatencyMs: float | None = Field(default=None, ge=0)
    reason: str | None = Field(default=None, max_length=80)

    @field_validator("timestamp")
    @classmethod
    def valid_timestamp(cls, value):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("Timestamp must include a timezone")
        return value


class EmotionPoint(TelemetryModel):
    state: Affect
    performanceNow: float = Field(ge=0)
    timestamp: str = Field(max_length=35)
    elapsedMs: float = Field(ge=0)

    _timestamp = field_validator("timestamp")(TelemetryEvent.valid_timestamp.__func__)


class AttentionTelemetry(TelemetryModel):
    schemaVersion: Literal[1]
    provenance: Literal["on-device-heuristic-v1"]
    calibrationComplete: bool
    eventsTruncated: bool
    observedDurationMs: float = Field(ge=0)
    focusPercentage: float = Field(ge=0, le=100)
    totalBlinks: int = Field(ge=0)
    meanBlinkRatePerMin: float = Field(ge=0)
    distractionCount: int = Field(ge=0)
    avgRecoveryLatencyMs: float = Field(ge=0)
    emotionTimeline: list[EmotionPoint] = Field(max_length=200)
    telemetryEvents: list[TelemetryEvent] = Field(max_length=1000)
    sessionDurationMs: float = Field(ge=0)
    faceVisiblePercentage: float = Field(ge=0, le=100)
    totalDistractionDurationMs: float = Field(ge=0)
    longestDistractionMs: float = Field(ge=0)


class ActivityCompletion(TelemetryModel):
    attentionTelemetry: AttentionTelemetry | None = None
