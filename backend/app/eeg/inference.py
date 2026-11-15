"""End-to-end EEG prediction from uploaded bytes.

The processing order is fixed:

``decrypt_if_needed`` -> ``load_any_eeg_bytes`` -> ``harmonize_to_26_channels``
-> ``extract_24_features_from_raw`` -> ``predict_proba``.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import Settings
from app.eeg.artifacts import EegModel
from app.eeg.features import RecordingFeatures, extract_recording_features
from app.eeg.ingestion import (
    decrypt_if_needed,
    harmonize_to_26_channels,
    load_any_eeg_bytes,
)
from app.eeg.preprocessing import EegValidationError, PreprocessedRecording, preprocess_raw
from app.eeg.schema import FEATURE_NAMES

logger = logging.getLogger(__name__)


def _load_harmonized(
    raw_bytes: bytes,
    filename: str | None,
    label: str,
    encryption_key: str | None,
):
    try:
        decrypted = decrypt_if_needed(raw_bytes, encryption_key)
        raw = load_any_eeg_bytes(decrypted, filename)
        return harmonize_to_26_channels(raw)
    except ValueError as exc:
        raise ValueError(f"{label}: {exc}") from exc


def extract_24_features_from_raw(
    raw,
    settings: Settings,
    *,
    label: str = "recording",
) -> tuple[RecordingFeatures, PreprocessedRecording]:
    """Preprocess one harmonized recording and extract its 24 model features."""
    try:
        preprocessed = preprocess_raw(
            raw,
            target_sfreq=settings.eeg_target_sfreq,
            l_freq=1.0,
            h_freq=45.0,
            notch_freq=50.0,
            window_seconds=settings.eeg_window_seconds,
            window_overlap=settings.eeg_window_overlap,
            reject_amplitude_uv=settings.eeg_reject_amplitude_uv,
            allow_low_amplitude_fallback=True,
            minimum_windows=4,
            max_fallback_windows=20,
        )
    except EegValidationError:
        raise
    except Exception as exc:
        raise EegValidationError(
            f"{label} preprocessing failed ({type(exc).__name__}).",
            code="preprocessing_failed",
        ) from exc

    try:
        features = extract_recording_features(preprocessed.windows, preprocessed.sfreq)
    except EegValidationError:
        raise
    except Exception as exc:
        raise EegValidationError(
            f"{label} feature extraction failed ({type(exc).__name__}).",
            code="feature_extraction_failed",
        ) from exc

    return features, preprocessed


def confidence_level(probability: float, threshold: float) -> str:
    """Classify confidence by distance from the decision threshold."""
    distance = abs(probability - threshold)
    if distance >= 0.20:
        return "High"
    if distance >= 0.10:
        return "Moderate"
    return "Borderline"


def analyze_recording(
    raw_bytes: bytes,
    filename: str | None,
    eo_bytes: bytes | None,
    eo_filename: str | None,
    model: EegModel,
    settings: Settings,
) -> dict[str, Any]:
    if not model.available:
        raise RuntimeError(model.reason or "The EEG model is unavailable.")

    ec_raw = _load_harmonized(
        raw_bytes,
        filename,
        "Eyes Closed",
        settings.eeg_encryption_key,
    )
    ec_features, ec_preprocessed = extract_24_features_from_raw(
        ec_raw,
        settings,
        label="Eyes Closed",
    )

    eo_preprocessed: PreprocessedRecording | None = None
    features = ec_features
    if eo_bytes is not None:
        eo_raw = _load_harmonized(
            eo_bytes,
            eo_filename,
            "Eyes Open",
            settings.eeg_encryption_key,
        )
        eo_features, eo_preprocessed = extract_24_features_from_raw(
            eo_raw,
            settings,
            label="Eyes Open",
        )
        features = ec_features.with_ec_eo_reactivity(eo_features)

    probabilities = model.predict_proba(features.values)
    adhd_probability = model.adhd_probability(float(probabilities[0, 1]))
    adhd_probability = min(max(adhd_probability, 0.0), 1.0)
    threshold = float(model.threshold)
    prediction = "ADHD" if adhd_probability >= threshold else "Control"

    total_windows = ec_preprocessed.windows_analyzed
    if eo_preprocessed is not None:
        total_windows += eo_preprocessed.windows_analyzed

    return {
        "prediction": prediction,
        "probability": round(adhd_probability, 6),
        "threshold": threshold,
        "confidence_level": confidence_level(adhd_probability, threshold),
        "windows_analyzed": total_windows,
        "ec_eo_recording_used": eo_preprocessed is not None,
        "biomarker_highlights": {
            "frontal_theta_rel": round(features.frontal_theta_rel, 6),
            "frontal_posterior_theta_gradient": round(features.frontal_posterior_theta_gradient, 6),
            "ec_eo_theta_reactivity": (
                None if features.ec_eo_theta_reactivity is None else round(features.ec_eo_theta_reactivity, 6)
            ),
        },
        "biomarker_breakdown": {name: round(features.named[name], 6) for name in FEATURE_NAMES},
    }
