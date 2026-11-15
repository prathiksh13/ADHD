"""Extract the 24-value EEG feature vector from accepted 4-second windows."""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, hilbert, sosfiltfilt, welch

from app.eeg.preprocessing import EegValidationError
from app.eeg.schema import (
    BAND_ORDER,
    BANDS,
    CONNECTIVITY_PAIRS,
    EXPECTED_CHANNELS,
    FEATURE_NAMES,
    FRONTAL_CHANNELS,
    FRONTOCENTRAL_CHANNELS,
    PLV_FEATURES,
    POSTERIOR_CHANNELS,
)

_CHANNEL_INDEX = {name: index for index, name in enumerate(EXPECTED_CHANNELS)}
_EPSILON = 1e-12


def _bandpower(freqs: np.ndarray, psd: np.ndarray, low: float, high: float) -> np.ndarray:
    mask = (freqs >= low) & (freqs <= high)
    if np.count_nonzero(mask) < 2:
        nearest = int(np.argmin(np.abs(freqs - (low + high) / 2.0)))
        return psd[:, nearest]
    return np.trapezoid(psd[:, mask], freqs[mask], axis=1)


def _relative_bandpower(window: np.ndarray, sfreq: float) -> np.ndarray:
    nperseg = min(1024, window.shape[1])
    freqs, psd = welch(
        window,
        fs=sfreq,
        nperseg=nperseg,
        noverlap=nperseg // 2,
        detrend="constant",
        axis=1,
    )
    band_powers = np.stack(
        [_bandpower(freqs, psd, low, high) for low, high in (BANDS[band] for band in BAND_ORDER)],
        axis=1,
    )
    total = np.sum(band_powers, axis=1, keepdims=True)
    return band_powers / (total + _EPSILON)


def _region_mean(relative: np.ndarray, channels: tuple[str, ...], band_index: int) -> float:
    indices = [_CHANNEL_INDEX[name] for name in channels]
    return float(np.mean(relative[indices, band_index]))


def _bandpass(signal: np.ndarray, sfreq: float, low: float, high: float) -> np.ndarray:
    nyquist = sfreq / 2.0
    low = max(low, 0.1)
    high = min(high, nyquist * 0.99)
    if low >= high or np.std(signal) < _EPSILON:
        return signal
    sos = butter(4, [low, high], btype="bandpass", fs=sfreq, output="sos")
    return sosfiltfilt(sos, signal)


def _plv(left: np.ndarray, right: np.ndarray, sfreq: float, low: float, high: float) -> float:
    if np.std(left) < _EPSILON or np.std(right) < _EPSILON:
        return 0.0
    phase_left = np.angle(hilbert(_bandpass(left, sfreq, low, high)))
    phase_right = np.angle(hilbert(_bandpass(right, sfreq, low, high)))
    return float(np.abs(np.mean(np.exp(1j * (phase_left - phase_right)))))


def compute_window_features(window: np.ndarray, sfreq: float) -> dict[str, float]:
    """Compute named features for one accepted window."""
    relative = _relative_bandpower(window, sfreq)
    global_relative = np.mean(relative, axis=0)
    features: dict[str, float] = {}

    for band_index, band in enumerate(BAND_ORDER):
        features[f"frontal_{band}_rel"] = _region_mean(relative, FRONTAL_CHANNELS, band_index)
        features[f"frontocentral_{band}_rel"] = _region_mean(relative, FRONTOCENTRAL_CHANNELS, band_index)
        posterior = _region_mean(relative, POSTERIOR_CHANNELS, band_index)
        features[f"frontal_posterior_{band}_gradient"] = features[f"frontal_{band}_rel"] - posterior

    theta = float(global_relative[BAND_ORDER.index("theta")])
    alpha = float(global_relative[BAND_ORDER.index("alpha")])
    beta = float(global_relative[BAND_ORDER.index("beta")])
    features["theta_beta_ratio"] = theta / (beta + _EPSILON)
    features["theta_alpha_ratio"] = theta / (alpha + _EPSILON)

    for (left_name, right_name), band, feature_name in CONNECTIVITY_PAIRS:
        low, high = BANDS[band]
        features[feature_name] = _plv(
            window[_CHANNEL_INDEX[left_name]],
            window[_CHANNEL_INDEX[right_name]],
            sfreq,
            low,
            high,
        )

    return features


class RecordingFeatures:
    """Subject-level features plus the biomarker values shown by the API."""

    def __init__(self, named: dict[str, float], plv_reliability: float) -> None:
        self.named = {name: float(named[name]) for name in FEATURE_NAMES}
        self.values = np.asarray([self.named[name] for name in FEATURE_NAMES], dtype=np.float64)
        self.plv_reliability = float(plv_reliability)
        self.frontal_theta_rel = self.named["frontal_theta_rel"]
        self.frontal_posterior_theta_gradient = self.named["frontal_posterior_theta_gradient"]
        self.ec_eo_theta_reactivity: float | None = None

    def with_ec_eo_reactivity(self, eyes_open: RecordingFeatures) -> RecordingFeatures:
        named = dict(self.named)
        theta_reactivity = self.frontal_theta_rel - eyes_open.frontal_theta_rel
        alpha_reactivity = self.named["frontal_alpha_rel"] - eyes_open.named["frontal_alpha_rel"]
        named["ec_eo_frontal_theta_reactivity"] = theta_reactivity
        named["ec_eo_frontal_alpha_reactivity"] = alpha_reactivity
        combined = RecordingFeatures(named, self.plv_reliability)
        combined.ec_eo_theta_reactivity = theta_reactivity
        return combined


def _reliability_weights(windows: tuple[np.ndarray, ...]) -> np.ndarray:
    peak_to_peak = np.asarray([float(np.max(np.ptp(window, axis=1))) for window in windows])
    median = float(np.median(peak_to_peak))
    if median <= _EPSILON:
        return np.ones(len(windows), dtype=np.float64)
    return 1.0 / (1.0 + (peak_to_peak / (4.0 * median)) ** 2)


def extract_recording_features(windows: tuple[np.ndarray, ...], sfreq: float) -> RecordingFeatures:
    """Aggregate window features into one subject-level vector.

    PLV values are reliability-gated: windows with high amplitude variability
    relative to the recording median contribute less to the connectivity score.
    """
    if not windows:
        raise EegValidationError(
            "No valid EEG windows were available for feature extraction.",
            code="no_valid_windows",
        )

    per_window = [compute_window_features(window, sfreq) for window in windows]
    weights = _reliability_weights(windows)
    weight_total = float(np.sum(weights))
    if weight_total <= _EPSILON:
        weights = np.ones(len(windows), dtype=np.float64)
        weight_total = float(len(windows))

    named: dict[str, float] = {}
    for name in FEATURE_NAMES:
        if name in PLV_FEATURES:
            named[name] = float(
                np.sum([weights[i] * values[name] for i, values in enumerate(per_window)]) / weight_total
            )
        elif name not in ("ec_eo_frontal_theta_reactivity", "ec_eo_frontal_alpha_reactivity"):
            named[name] = float(np.mean([values[name] for values in per_window]))

    named["ec_eo_frontal_theta_reactivity"] = 0.0
    named["ec_eo_frontal_alpha_reactivity"] = 0.0

    feature = RecordingFeatures(named, float(np.mean(weights)))
    if not np.all(np.isfinite(feature.values)):
        raise EegValidationError(
            "Feature extraction produced non-finite values; the recording cannot be scored.",
            code="non_finite_features",
        )
    return feature
