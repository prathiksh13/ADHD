"""MNE preprocessing for resting-state EEG recordings.

The pipeline is deliberately explicit and shared by every uploaded recording:

1. channel validation against the harmonized TDBRAIN 26-channel montage,
2. common average reference,
3. 1-45 Hz band-pass and 50 Hz notch,
4. resampling to 250 Hz when needed,
5. 4-second / 1000-sample windows with 500-sample stride and single-sided
   350 µV amplitude rejection (the training-time check),
6. optional training-time fallback to the lowest-amplitude available windows.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import mne
import numpy as np

from app.eeg.schema import EXPECTED_CHANNELS

logger = logging.getLogger(__name__)


class EegError(Exception):
    """Base class for expected EEG pipeline failures."""


class EegFileError(EegError):
    """The uploaded file is not a readable EEG recording."""


class EegValidationError(EegError):
    """The recording is readable but cannot be analyzed safely."""

    def __init__(
        self,
        message: str,
        *,
        code: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.details = details


@dataclass(frozen=True)
class PreprocessedRecording:
    windows: tuple[np.ndarray, ...]
    sfreq: float
    windows_analyzed: int
    windows_rejected: int


def load_recording(path: Path) -> mne.io.BaseRaw:
    try:
        return mne.io.read_raw(path, preload=True, verbose=False)
    except Exception as exc:
        raise EegFileError(
            f"MNE could not read the EEG file ({type(exc).__name__}). "
            "Check that the format is supported and the file is not corrupted."
        ) from exc


def _normalized(name: str) -> str:
    return name.strip().lower()


def _select_required_channels(raw: mne.io.BaseRaw) -> list[str]:
    available = {_normalized(name): name for name in raw.ch_names}
    missing = [channel for channel in EXPECTED_CHANNELS if _normalized(channel) not in available]
    if missing:
        raise EegValidationError(
            f"Missing required EEG channels: {', '.join(missing)}.",
            code="missing_eeg_channels",
            details={"missing_channels": missing, "expected_channels": list(EXPECTED_CHANNELS)},
        )

    selected = [available[_normalized(channel)] for channel in EXPECTED_CHANNELS]
    if len(set(selected)) != len(selected):
        raise EegValidationError(
            "Channel names are ambiguous after whitespace normalization.",
            code="ambiguous_eeg_channels",
        )

    # The montage is known to be EEG; make the type explicit so referencing and
    # filtering use the same channels even if the BDF header labelled them MISC.
    raw.set_channel_types({name: "eeg" for name in selected}, verbose=False)
    return selected


def preprocess_raw(
    raw: mne.io.BaseRaw,
    *,
    target_sfreq: float = 250.0,
    l_freq: float = 1.0,
    h_freq: float = 45.0,
    notch_freq: float = 50.0,
    window_seconds: float = 4.0,
    window_overlap: float = 0.5,
    reject_amplitude_uv: float = 350.0,
    allow_low_amplitude_fallback: bool = False,
    minimum_windows: int = 4,
    max_fallback_windows: int = 20,
) -> PreprocessedRecording:
    """Apply the training-compatible pipeline and return usable windows.

    Windows use the training-time single-sided amplitude check:
    ``max(abs(window)) * 1e6 < 350 µV``. With
    ``allow_low_amplitude_fallback``, if fewer than ``minimum_windows`` pass,
    the lowest-amplitude available windows (up to 20) are retained for scoring.
    """
    if not 0.0 <= window_overlap < 1.0:
        raise ValueError("window_overlap must be in [0, 1).")
    if window_seconds <= 0:
        raise ValueError("window_seconds must be positive.")
    if minimum_windows < 1 or max_fallback_windows < 1:
        raise ValueError("Window fallback limits must be positive.")

    selected = _select_required_channels(raw)
    raw.pick(selected, verbose=False)
    raw = raw.set_eeg_reference("average", verbose=False)
    raw.filter(l_freq=l_freq, h_freq=h_freq, method="fir", phase="zero", verbose=False)
    if raw.info["sfreq"] > 2.0 * notch_freq:
        raw.notch_filter(freqs=notch_freq, verbose=False)
    if abs(float(raw.info["sfreq"]) - target_sfreq) > 1e-6:
        raw.resample(target_sfreq, verbose=False)

    sfreq = float(raw.info["sfreq"])
    data = np.asarray(raw.get_data(), dtype=np.float64)
    if data.ndim != 2 or data.shape[0] != len(EXPECTED_CHANNELS):
        raise EegValidationError(
            f"Expected {len(EXPECTED_CHANNELS)} EEG channels after selection, got {data.shape[0]}.",
            code="unexpected_channel_count",
        )

    window_samples = round(window_seconds * sfreq)
    step = round(window_samples * (1.0 - window_overlap))
    if window_samples <= 0 or step <= 0:
        raise ValueError("The configured window length or overlap is invalid.")
    if data.shape[1] < window_samples:
        raise EegValidationError(
            "Recording too short (minimum 4 seconds required)",
            code="recording_too_short",
            details={
                "samples_after_resampling": data.shape[1],
                "required_samples": window_samples,
                "sample_rate_hz": sfreq,
            },
        )

    amplitude_limit_uv = float(reject_amplitude_uv)
    all_windows: list[np.ndarray] = []
    accepted: list[np.ndarray] = []
    for start in range(0, data.shape[1] - window_samples + 1, step):
        window = data[:, start : start + window_samples]
        if not np.all(np.isfinite(window)):
            continue
        all_windows.append(window)
        if float(np.max(np.abs(window)) * 1e6) < amplitude_limit_uv:
            accepted.append(window)

    if allow_low_amplitude_fallback and len(accepted) < minimum_windows:
        if not all_windows:
            raise EegValidationError(
                "No finite EEG windows were available for feature extraction.",
                code="no_valid_windows",
            )
        lowest_amplitude = sorted(
            all_windows,
            key=lambda window: float(np.max(np.abs(window)) * 1e6),
        )
        accepted = lowest_amplitude[: min(max_fallback_windows, len(lowest_amplitude))]

    if not accepted:
        raise EegValidationError(
            "No 4-second windows remained after 350 µV amplitude rejection. "
            "Check electrode contact and recording quality.",
            code="all_windows_rejected",
            details={"windows_rejected": len(all_windows)},
        )

    return PreprocessedRecording(
        windows=tuple(accepted),
        sfreq=sfreq,
        windows_analyzed=len(accepted),
        windows_rejected=max(0, len(all_windows) - len(accepted)),
    )
