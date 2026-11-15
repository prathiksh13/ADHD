"""Load the EEG classifier artifact once at application startup.

A bundle may be provided as ``eeg_model_bundle.json`` next to the classifier::

    {
      "artifact_version": "tdbrain-xgb-2026-11-15",
      "threshold": 0.5,
      "threshold_source": "validation-roc-youden",
      "positive_class": "ADHD",
      "negative_class": "Control",
      "channels": ["Fp1", "..."],
      "feature_names": ["frontal_delta_rel", "..."],
      "classifier": {"format": "xgboost_json", "path": "best_xgboost.json"},
      "scaler": {"mean": [0.0, "..."], "scale": [1.0, "..."]}
    }

When no bundle is present the server falls back to ``best_xgboost.json`` with an
identity scaler and the configured threshold. This is deliberate: missing scaler
statistics are never invented, and their absence is reported by ``GET /health``.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import Settings
from app.eeg.schema import EXPECTED_CHANNELS, FEATURE_NAMES, FEATURE_SCHEMA_VERSION

logger = logging.getLogger(__name__)

DEFAULT_BUNDLE_NAME = "eeg_model_bundle.json"
DEFAULT_CLASSIFIER_NAME = "best_xgboost.json"
GRAPH_ENCODER_NAME = "best_graph_encoder.pt"


class ArtifactError(Exception):
    """Raised when the serialized model cannot be used safely."""


@dataclass(frozen=True)
class Standardizer:
    """Minimal standard scaler; no scikit-learn dependency is required."""

    mean: np.ndarray | None = None
    scale: np.ndarray | None = None

    @property
    def configured(self) -> bool:
        return self.mean is not None and self.scale is not None

    def transform(self, values: np.ndarray) -> np.ndarray:
        array = np.asarray(values, dtype=np.float64)
        if not self.configured:
            return array
        if array.shape[-1] != self.mean.shape[0]:
            raise ArtifactError(f"Scaler expects {self.mean.shape[0]} features, received {array.shape[-1]}.")
        return (array - self.mean) / self.scale


@dataclass
class EegModel:
    classifier: Any | None = None
    classifier_path: Path | None = None
    threshold: float = 0.5
    threshold_source: str = "default_not_provided"
    feature_names: tuple[str, ...] = FEATURE_NAMES
    channels: tuple[str, ...] = EXPECTED_CHANNELS
    artifact_version: str = "unavailable"
    scaler: Standardizer = field(default_factory=Standardizer)
    positive_class: str = "ADHD"
    negative_class: str = "Control"
    reason: str | None = "model_not_loaded"
    graph_encoder_status: str = "not_found"
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def available(self) -> bool:
        return self.classifier is not None and self.reason is None

    def predict_proba(self, features: np.ndarray) -> np.ndarray:
        """Return ``[negative_probability, positive_probability]`` rows.

        The underlying artifact is an ``xgboost.Booster`` rather than an
        ``XGBClassifier``, so the two-column probability array is assembled here
        without requiring scikit-learn.
        """
        if not self.available:
            raise ArtifactError(self.reason or "The EEG model is unavailable.")
        import xgboost as xgb

        values = np.asarray(features, dtype=np.float64)
        if values.ndim == 1:
            values = values.reshape(1, -1)
        scaled = self.scaler.transform(values)
        predictions = np.asarray(
            self.classifier.predict(xgb.DMatrix(scaled, nthread=1)),
            dtype=np.float64,
        ).reshape(-1)
        positive = np.clip(predictions, 0.0, 1.0)
        return np.column_stack((1.0 - positive, positive))

    def score(self, features: np.ndarray) -> float:
        """Return the raw model probability for the configured positive class."""
        return float(self.predict_proba(features)[0, 1])

    def adhd_probability(self, raw_probability: float) -> float:
        positive = self.positive_class.strip().lower()
        negative = self.negative_class.strip().lower()
        if positive == "adhd":
            return float(raw_probability)
        if negative == "adhd":
            return float(1.0 - raw_probability)
        raise ArtifactError("The bundle must map one class to ADHD (positive_class or negative_class).")

    def status(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "reason": self.reason,
            "artifact_version": self.artifact_version,
            "classifier": "xgboost",
            "classifier_file": self.classifier_path.name if self.classifier_path else None,
            "threshold": self.threshold,
            "threshold_source": self.threshold_source,
            "expected_channels": list(self.channels),
            "feature_count": len(self.feature_names),
            "feature_schema": FEATURE_SCHEMA_VERSION,
            "scaler_loaded": self.scaler.configured,
            "positive_class": self.positive_class,
            "negative_class": self.negative_class,
            "graph_encoder_status": self.graph_encoder_status,
            "metadata": self.metadata,
        }


def _unavailable(reason: str, *, model_dir: Path) -> EegModel:
    graph_encoder = "present_state_dict_only_no_architecture"
    if not (model_dir / GRAPH_ENCODER_NAME).exists():
        graph_encoder = "not_found"
    return EegModel(reason=reason, graph_encoder_status=graph_encoder)


def _read_bundle(bundle_path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ArtifactError(f"The model bundle could not be read ({type(exc).__name__}).") from exc
    if not isinstance(payload, dict):
        raise ArtifactError("The model bundle must contain a JSON object.")
    return payload


def _parse_scaler(payload: Any) -> Standardizer:
    if payload in (None, {}, ""):
        return Standardizer()
    if not isinstance(payload, dict):
        raise ArtifactError("The bundle scaler must be an object or null.")

    if "path" in payload:
        path = Path(str(payload["path"]))
        if not path.is_absolute():
            raise ArtifactError("The scaler path in the bundle must be absolute or use mean/scale arrays.")
        try:
            with np.load(path) as arrays:
                mean = np.asarray(arrays["mean"], dtype=np.float64).reshape(-1)
                scale = np.asarray(arrays["scale"], dtype=np.float64).reshape(-1)
        except (OSError, KeyError, ValueError) as exc:
            raise ArtifactError(f"The scaler array file could not be read ({type(exc).__name__}).") from exc
    else:
        if "mean" not in payload or "scale" not in payload:
            raise ArtifactError("The bundle scaler must include both mean and scale arrays.")
        try:
            mean = np.asarray(payload["mean"], dtype=np.float64).reshape(-1)
            scale = np.asarray(payload["scale"], dtype=np.float64).reshape(-1)
        except (TypeError, ValueError) as exc:
            raise ArtifactError("The bundle scaler arrays are not numeric.") from exc

    if mean.shape != scale.shape:
        raise ArtifactError("The bundle scaler mean and scale arrays must have the same length.")
    if mean.size != len(FEATURE_NAMES):
        raise ArtifactError(f"The bundle scaler has {mean.size} values; {len(FEATURE_NAMES)} are required.")
    if not np.all(np.isfinite(mean)) or not np.all(np.isfinite(scale)):
        raise ArtifactError("The bundle scaler contains non-finite values.")
    if np.any(scale == 0):
        raise ArtifactError("The bundle scaler contains a zero scale value.")
    return Standardizer(mean=mean, scale=scale)


def _classifier_from_bundle(bundle: dict[str, Any], base_dir: Path) -> tuple[Path, str]:
    classifier = bundle.get("classifier", {})
    if isinstance(classifier, str):
        return _resolve_path(base_dir, classifier), "xgboost_json"
    if isinstance(classifier, dict):
        path = str(classifier.get("path", DEFAULT_CLASSIFIER_NAME))
        model_format = str(classifier.get("format", "xgboost_json")).lower()
        return _resolve_path(base_dir, path), model_format
    raise ArtifactError("The bundle classifier must be a path string or an object.")


def _resolve_path(base_dir: Path, raw_path: str) -> Path:
    path = Path(raw_path)
    return path if path.is_absolute() else (base_dir / path)


def _artifact_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:12]


def _graph_encoder_status(model_dir: Path) -> str:
    if (model_dir / GRAPH_ENCODER_NAME).exists():
        return "present_state_dict_only_no_architecture"
    return "not_found"


def load_eeg_model(settings: Settings) -> EegModel:
    """Load the classifier artifact once. Failures return an explicit unavailable state."""
    model_dir = Path(settings.eeg_model_dir)
    bundle_path = (
        Path(settings.eeg_model_bundle_path)
        if settings.eeg_model_bundle_path
        else model_dir / DEFAULT_BUNDLE_NAME
    )

    try:
        bundle: dict[str, Any] = {}
        if bundle_path.exists():
            bundle = _read_bundle(bundle_path)
            classifier_path, model_format = _classifier_from_bundle(bundle, bundle_path.parent)
        else:
            classifier_path = model_dir / DEFAULT_CLASSIFIER_NAME
            model_format = "xgboost_json"

        if model_format != "xgboost_json":
            raise ArtifactError(f"Unsupported classifier format: {model_format}.")
        if not classifier_path.exists():
            return _unavailable("classifier_artifact_not_found", model_dir=model_dir)

        threshold = float(bundle.get("threshold", settings.eeg_threshold))
        if not 0.0 <= threshold <= 1.0:
            raise ArtifactError("The probability threshold must be between 0 and 1.")
        threshold_source = str(
            bundle.get(
                "threshold_source",
                "bundle" if "threshold" in bundle else "configured_default",
            )
        )

        feature_names = tuple(bundle.get("feature_names", FEATURE_NAMES))
        if feature_names != FEATURE_NAMES:
            raise ArtifactError("The bundle feature names do not match the inference feature contract.")
        channels = tuple(bundle.get("channels", EXPECTED_CHANNELS))
        if channels != EXPECTED_CHANNELS:
            raise ArtifactError("The bundle channels do not match the TDBRAIN 26-channel montage.")

        import xgboost as xgb

        classifier = xgb.Booster(model_file=str(classifier_path))
        if classifier.num_features() != len(FEATURE_NAMES):
            raise ArtifactError(
                f"The classifier expects {classifier.num_features()} features; "
                f"{len(FEATURE_NAMES)} are produced."
            )

        artifact_version = str(bundle.get("artifact_version") or f"xgboost-{_artifact_hash(classifier_path)}")
        return EegModel(
            classifier=classifier,
            classifier_path=classifier_path,
            threshold=threshold,
            threshold_source=threshold_source,
            feature_names=feature_names,
            channels=channels,
            artifact_version=artifact_version,
            scaler=_parse_scaler(bundle.get("scaler")),
            positive_class=str(bundle.get("positive_class", "ADHD")),
            negative_class=str(bundle.get("negative_class", "Control")),
            reason=None,
            graph_encoder_status=_graph_encoder_status(model_dir),
            metadata=dict(bundle.get("metadata", {})),
        )
    except ArtifactError as exc:
        logger.warning("eeg_model_unavailable reason=%s", exc)
        return _unavailable(str(exc), model_dir=model_dir)
    except ImportError:
        logger.warning("eeg_model_unavailable reason=xgboost_not_installed")
        return _unavailable("xgboost_not_installed", model_dir=model_dir)
    except Exception as exc:
        logger.warning("eeg_model_unavailable reason=%s", type(exc).__name__)
        return _unavailable(f"artifact_load_failed_{type(exc).__name__}", model_dir=model_dir)
