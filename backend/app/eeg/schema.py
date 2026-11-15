"""Fixed EEG channel, band and feature contract used by the inference pipeline.

The channel order is the 26-channel TDBRAIN 10-20 montage order. The 24-feature
vector is an explicit, documented contract so the classifier input cannot drift
silently between requests.
"""

from __future__ import annotations

EXPECTED_CHANNELS: tuple[str, ...] = (
    "Fp1",
    "Fp2",
    "F7",
    "F3",
    "Fz",
    "F4",
    "F8",
    "FC3",
    "FCz",
    "FC4",
    "T7",
    "C3",
    "Cz",
    "C4",
    "T8",
    "CP3",
    "CPz",
    "CP4",
    "P7",
    "P3",
    "Pz",
    "P4",
    "P8",
    "O1",
    "Oz",
    "O2",
)

BANDS: dict[str, tuple[float, float]] = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 45.0),
}
BAND_ORDER: tuple[str, ...] = ("delta", "theta", "alpha", "beta", "gamma")

FRONTAL_CHANNELS: tuple[str, ...] = ("Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8")
FRONTOCENTRAL_CHANNELS: tuple[str, ...] = ("FC3", "FCz", "FC4", "C3", "Cz", "C4")
POSTERIOR_CHANNELS: tuple[str, ...] = ("P7", "P3", "Pz", "P4", "P8", "O1", "Oz", "O2")

# (channel pair, band, output feature name)
CONNECTIVITY_PAIRS: tuple[tuple[tuple[str, str], str, str], ...] = (
    (("F3", "F4"), "theta", "plv_theta_frontal_interhemispheric"),
    (("F3", "F4"), "alpha", "plv_alpha_frontal_interhemispheric"),
    (("P3", "P4"), "theta", "plv_theta_parietal_interhemispheric"),
    (("Fz", "Pz"), "alpha", "plv_alpha_frontal_posterior"),
    (("Fz", "Pz"), "beta", "plv_beta_frontal_posterior"),
)

FRONTAL_FEATURES: tuple[str, ...] = tuple(f"frontal_{band}_rel" for band in BAND_ORDER)
FRONTOCENTRAL_FEATURES: tuple[str, ...] = tuple(f"frontocentral_{band}_rel" for band in BAND_ORDER)
GRADIENT_FEATURES: tuple[str, ...] = tuple(f"frontal_posterior_{band}_gradient" for band in BAND_ORDER)
RATIO_FEATURES: tuple[str, ...] = ("theta_beta_ratio", "theta_alpha_ratio")
PLV_FEATURES: tuple[str, ...] = tuple(item[2] for item in CONNECTIVITY_PAIRS)
REACTIVITY_FEATURES: tuple[str, ...] = (
    "ec_eo_frontal_theta_reactivity",
    "ec_eo_frontal_alpha_reactivity",
)

FEATURE_NAMES: tuple[str, ...] = (
    *FRONTAL_FEATURES,
    *FRONTOCENTRAL_FEATURES,
    *GRADIENT_FEATURES,
    *RATIO_FEATURES,
    *PLV_FEATURES,
    *REACTIVITY_FEATURES,
)
FEATURE_INDEX: dict[str, int] = {name: index for index, name in enumerate(FEATURE_NAMES)}
FEATURE_SCHEMA_VERSION = "attune-eeg-24-v1"
