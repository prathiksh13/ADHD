from __future__ import annotations

import io
import json
from pathlib import Path

import h5py
import mne
import numpy as np
import pytest
import xgboost as xgb
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from scipy.io import savemat

from app.core.config import Settings
from app.eeg.artifacts import EegModel, load_eeg_model
from app.eeg.features import extract_recording_features
from app.eeg.ingestion import (
    decrypt_if_needed,
    harmonize_to_26_channels,
    load_any_eeg_bytes,
)
from app.eeg.preprocessing import EegValidationError, preprocess_raw
from app.eeg.schema import EXPECTED_CHANNELS, FEATURE_NAMES
from app.main import create_app
from app.repositories.firestore import InMemoryRepository
from tests.conftest import fake_token_verifier


def synthetic_raw(
    *,
    sfreq: float = 250.0,
    seconds: float = 8.0,
    missing: tuple[str, ...] = (),
    amplitude: float = 10e-6,
) -> mne.io.RawArray:
    channels = [channel for channel in EXPECTED_CHANNELS if channel not in missing]
    rng = np.random.default_rng(42)
    samples = int(seconds * sfreq)
    data = rng.normal(0.0, amplitude, size=(len(channels), samples))
    time = np.arange(samples) / sfreq
    data += 0.5 * amplitude * np.sin(2 * np.pi * 10.0 * time)
    info = mne.create_info(channels, sfreq, ch_types="eeg")
    return mne.io.RawArray(data.astype(float), info, verbose=False)


def fake_eeg_model(probability: float = 0.8) -> EegModel:
    model = EegModel(
        classifier=object(),
        artifact_version="test-artifact",
        threshold=0.5,
        threshold_source="test",
        reason=None,
    )
    model.predict_proba = lambda features: np.asarray(  # type: ignore[method-assign]
        [[1.0 - probability, probability]]
    )
    return model


def fake_bdf() -> bytes:
    return b"\x01BIOSEMI" + b"\x00" * 300


@pytest.fixture
def eeg_app(monkeypatch):
    monkeypatch.setattr(
        "app.eeg.ingestion.mne.io.read_raw",
        lambda path, **kwargs: synthetic_raw(),
    )
    app = create_app(
        Settings(firebase_project_id="test-project"),
        token_verifier=fake_token_verifier,
        repository=InMemoryRepository(),
    )
    with TestClient(app) as client:
        app.state.eeg_model = fake_eeg_model()
        yield app, client


def test_health_reports_model_contract(eeg_app):
    _, client = eeg_app
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["artifact_version"] == "test-artifact"
    assert body["expected_channels"] == list(EXPECTED_CHANNELS)
    assert body["threshold"] == 0.5
    assert body["feature_count"] == 24
    assert body["preprocessing"]["window_seconds"] == 4.0
    assert body["preprocessing"]["target_sample_rate_hz"] == 250.0
    assert body["preprocessing"]["amplitude_rejection_uv"] == 350.0


def test_predict_returns_expected_contract(eeg_app):
    _, client = eeg_app
    response = client.post(
        "/predict",
        files={"restEC_file": ("restEC.bdf", fake_bdf(), "application/octet-stream")},
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "prediction",
        "probability",
        "threshold",
        "confidence_level",
        "windows_analyzed",
        "ec_eo_recording_used",
        "biomarker_highlights",
        "biomarker_breakdown",
    }
    assert body["prediction"] == "ADHD"
    assert body["probability"] == 0.8
    assert body["threshold"] == 0.5
    assert body["confidence_level"] == "High"
    assert body["windows_analyzed"] == 3
    assert body["ec_eo_recording_used"] is False
    assert body["biomarker_highlights"]["ec_eo_theta_reactivity"] is None
    assert set(body["biomarker_highlights"]) == {
        "frontal_theta_rel",
        "frontal_posterior_theta_gradient",
        "ec_eo_theta_reactivity",
    }
    assert set(body["biomarker_breakdown"]) == set(FEATURE_NAMES)


def test_predict_with_eyes_open_adds_reactivity(eeg_app, monkeypatch):
    recordings = iter(
        [
            synthetic_raw(amplitude=12e-6),
            synthetic_raw(amplitude=8e-6),
        ]
    )
    monkeypatch.setattr(
        "app.eeg.ingestion.mne.io.read_raw",
        lambda path, **kwargs: next(recordings),
    )
    _, client = eeg_app
    response = client.post(
        "/predict",
        files={
            "restEC_file": ("restEC.bdf", fake_bdf(), "application/octet-stream"),
            "restEO_file": ("restEO.bdf", fake_bdf(), "application/octet-stream"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["windows_analyzed"] == 6
    assert body["ec_eo_recording_used"] is True
    assert isinstance(body["biomarker_highlights"]["ec_eo_theta_reactivity"], float)
    assert body["biomarker_breakdown"]["ec_eo_frontal_theta_reactivity"] == pytest.approx(
        body["biomarker_highlights"]["ec_eo_theta_reactivity"]
    )


def test_predict_scores_high_amplitude_recording(eeg_app, monkeypatch):
    monkeypatch.setattr(
        "app.eeg.ingestion.mne.io.read_raw",
        lambda path, **kwargs: synthetic_raw(amplitude=2e-3),
    )
    _, client = eeg_app
    response = client.post(
        "/predict",
        files={"restEC_file": ("restEC.bdf", fake_bdf(), "application/octet-stream")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["prediction"] == "ADHD"
    assert body["windows_analyzed"] == 3


def test_predict_harmonizes_partial_montage(eeg_app, monkeypatch):
    monkeypatch.setattr(
        "app.eeg.ingestion.mne.io.read_raw",
        lambda path, **kwargs: synthetic_raw(missing=("Fp1", "Fz", "FC3", "CP3")),
    )
    _, client = eeg_app
    response = client.post(
        "/predict",
        files={"restEC_file": ("restEC.bdf", fake_bdf(), "application/octet-stream")},
    )
    assert response.status_code == 200
    assert response.json()["prediction"] == "ADHD"


def test_predict_returns_unscored_for_missing_core_electrodes(eeg_app, monkeypatch):
    monkeypatch.setattr(
        "app.eeg.ingestion.mne.io.read_raw",
        lambda path, **kwargs: synthetic_raw(missing=("Fp1", "Fp2", "F3", "F4", "Fz")),
    )
    _, client = eeg_app
    response = client.post(
        "/predict",
        files={"restEC_file": ("restEC.bdf", fake_bdf(), "application/octet-stream")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Unscored"
    assert body["prediction"] == "Unscored"
    assert body["probability"] is None
    assert "core frontal" in body["reason"].lower()


def test_predict_accepts_any_filename(eeg_app):
    _, client = eeg_app
    response = client.post(
        "/predict",
        files={"restEC_file": ("recording.edf", b"contents", "application/octet-stream")},
    )
    assert response.status_code == 200
    assert response.json()["prediction"] == "ADHD"


def test_predict_returns_unscored_for_unreadable_file(eeg_app):
    _, client = eeg_app
    response = client.post(
        "/predict",
        files={"restEC_file": ("report.pdf", b"%PDF-1.7", "application/pdf")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Unscored"
    assert body["prediction"] == "Unscored"
    assert body["probability"] is None
    assert "unsupported file type" in body["reason"].lower()


def test_predict_requires_model(eeg_app):
    app, client = eeg_app
    app.state.eeg_model = None
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "degraded"
    assert health.json()["model_loaded"] is False
    response = client.post(
        "/predict",
        files={"restEC_file": ("restEC.bdf", fake_bdf(), "application/octet-stream")},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "eeg_model_unavailable"


def test_preprocessing_resamples_windows_and_extracts_features():
    raw = synthetic_raw(sfreq=250.0, seconds=8.0)
    recording = preprocess_raw(raw)
    assert recording.sfreq == 250.0
    assert recording.windows_analyzed == 3
    assert recording.windows_rejected == 0
    assert recording.windows[0].shape == (26, 1000)

    features = extract_recording_features(recording.windows, recording.sfreq)
    assert features.values.shape == (24,)
    assert np.all(np.isfinite(features.values))
    assert features.named.keys() == set(FEATURE_NAMES)
    for name in FEATURE_NAMES:
        if name.startswith("plv_"):
            assert 0.0 <= features.named[name] <= 1.0
    assert features.named["theta_beta_ratio"] >= 0.0
    assert features.named["theta_alpha_ratio"] >= 0.0


def test_ec_eo_reactivity_is_the_frontal_theta_difference():
    ec = extract_recording_features(preprocess_raw(synthetic_raw(amplitude=12e-6)).windows, 250.0)
    eo = extract_recording_features(preprocess_raw(synthetic_raw(amplitude=8e-6)).windows, 250.0)
    combined = ec.with_ec_eo_reactivity(eo)
    assert combined.ec_eo_theta_reactivity == pytest.approx(ec.frontal_theta_rel - eo.frontal_theta_rel)
    assert combined.named["ec_eo_frontal_theta_reactivity"] == pytest.approx(combined.ec_eo_theta_reactivity)


def test_preprocessing_rejects_short_recordings():
    with pytest.raises(EegValidationError) as excinfo:
        preprocess_raw(synthetic_raw(seconds=2.0))
    assert excinfo.value.code == "recording_too_short"
    assert str(excinfo.value) == "Recording too short (minimum 4 seconds required)"


def test_preprocessing_rejects_high_amplitude_windows():
    with pytest.raises(EegValidationError) as excinfo:
        preprocess_raw(synthetic_raw(amplitude=2e-3))
    assert excinfo.value.code == "all_windows_rejected"


def test_preprocessing_uses_single_sided_350uv_check():
    sfreq = 250.0
    time = np.arange(int(8.0 * sfreq)) / sfreq
    data = np.zeros((len(EXPECTED_CHANNELS), time.size))
    data[0] = 300e-6 * np.sin(2 * np.pi * 10.0 * time)
    raw = mne.io.RawArray(
        data,
        mne.create_info(list(EXPECTED_CHANNELS), sfreq, ch_types="eeg"),
        verbose=False,
    )

    recording = preprocess_raw(raw)

    assert recording.windows_analyzed == 3
    assert recording.windows_rejected == 0
    assert np.max(np.abs(recording.windows[0])) * 1e6 < 350.0
    assert np.max(np.ptp(recording.windows[0], axis=-1)) * 1e6 > 350.0


def test_preprocessing_fallback_keeps_lowest_amplitude_windows():
    recording = preprocess_raw(
        synthetic_raw(amplitude=2e-3),
        allow_low_amplitude_fallback=True,
    )
    assert recording.sfreq == 250.0
    assert recording.windows_analyzed == 3
    assert recording.windows_rejected == 0
    assert recording.windows[0].shape == (26, 1000)


def test_loader_uses_bundle_scaler_threshold_and_version(tmp_path: Path):
    rng = np.random.default_rng(0)
    features = rng.normal(size=(32, 24)).astype(np.float32)
    labels = np.array([0, 1] * 16)
    classifier = xgb.train(
        {"objective": "binary:logistic", "max_depth": 2, "seed": 1},
        xgb.DMatrix(features, label=labels),
        num_boost_round=2,
    )
    classifier.save_model(tmp_path / "best_xgboost.json")
    (tmp_path / "eeg_model_bundle.json").write_text(
        json.dumps(
            {
                "artifact_version": "bundle-test",
                "threshold": 0.61,
                "threshold_source": "validation",
                "positive_class": "ADHD",
                "negative_class": "Control",
                "served": "yes",
                "scaler": {
                    "mean": np.zeros(24).tolist(),
                    "scale": np.ones(24).tolist(),
                },
            }
        ),
        encoding="utf-8",
    )

    model = load_eeg_model(Settings(eeg_model_dir=tmp_path))
    assert model.available
    assert model.artifact_version == "bundle-test"
    assert model.threshold == 0.61
    assert model.scaler.configured


def test_loader_reports_missing_artifacts(tmp_path: Path):
    model = load_eeg_model(Settings(eeg_model_dir=tmp_path))
    assert not model.available
    assert model.reason == "classifier_artifact_not_found"
    assert model.status()["threshold"] == 0.5


def test_loader_rejects_incompatible_scaler(tmp_path: Path):
    rng = np.random.default_rng(0)
    classifier = xgb.train(
        {"objective": "binary:logistic", "max_depth": 2, "seed": 1},
        xgb.DMatrix(rng.normal(size=(16, 24)).astype(np.float32), label=np.array([0, 1] * 8)),
        num_boost_round=1,
    )
    classifier.save_model(tmp_path / "best_xgboost.json")
    (tmp_path / "eeg_model_bundle.json").write_text(
        '{"threshold": 0.5, "scaler": {"mean": [0.0], "scale": [1.0]}}',
        encoding="utf-8",
    )
    model = load_eeg_model(Settings(eeg_model_dir=tmp_path))
    assert not model.available
    assert "24" in (model.reason or "")


def test_decrypt_if_needed_accepts_plain_and_fernet_payloads():
    key = Fernet.generate_key()
    plain = b"plain eeg bytes"
    token = Fernet(key).encrypt(plain)

    assert decrypt_if_needed(plain) == plain
    assert decrypt_if_needed(token, key.decode("utf-8")) == plain

    with pytest.raises(ValueError, match="encrypted"):
        decrypt_if_needed(token)


def test_harmonize_19_channel_aliases_to_26():
    channels = [
        "Fp1",
        "Fp2",
        "F7",
        "F3",
        "Fz",
        "F4",
        "F8",
        "T3",
        "C3",
        "Cz",
        "C4",
        "T4",
        "T5",
        "P3",
        "Pz",
        "P4",
        "T6",
        "O1",
        "O2",
    ]
    rng = np.random.default_rng(7)
    data = rng.normal(0.0, 10e-6, size=(len(channels), 1000))
    raw = mne.io.RawArray(
        data,
        mne.create_info(channels, 128.0, ch_types="eeg"),
        verbose=False,
    )

    harmonized = harmonize_to_26_channels(raw)

    assert harmonized.ch_names == list(EXPECTED_CHANNELS)
    assert harmonized.get_data().shape == (26, 1000)
    assert np.all(np.isfinite(harmonized.get_data()))
    assert np.array_equal(harmonized.get_data()[EXPECTED_CHANNELS.index("T7")], data[7])
    assert np.array_equal(harmonized.get_data()[EXPECTED_CHANNELS.index("P8")], data[16])


def test_non_mat_loaders_do_not_rescale_amplitudes(tmp_path: Path):
    raw = synthetic_raw(amplitude=0.25)
    path = tmp_path / "recording_raw.fif"
    raw.save(path, overwrite=True)

    loaded = load_any_eeg_bytes(path.read_bytes(), "recording_raw.fif")

    assert np.allclose(loaded.get_data(), raw.get_data())


def test_load_any_eeg_bytes_reads_mat_v5():
    rng = np.random.default_rng(8)
    data = rng.normal(0.0, 10e-6, size=(26, 2000))
    payload = io.BytesIO()
    savemat(
        payload,
        {
            "EEG": {
                "data": data,
                "srate": 250.0,
                "labels": np.asarray(EXPECTED_CHANNELS, dtype=object),
            }
        },
    )

    raw = load_any_eeg_bytes(payload.getvalue(), "recording.mat")

    assert raw.ch_names == list(EXPECTED_CHANNELS)
    assert raw.info["sfreq"] == 250.0
    assert np.allclose(raw.get_data(), data)


@pytest.mark.parametrize(
    ("source_scale", "expected_std"),
    [
        (20.0, 20e-6),
        (0.02, 20e-6),
        (20e-6, 20e-6),
        (20_000.0, 50e-6),
    ],
)
def test_mat_units_are_scaled_to_volts(source_scale, expected_std):
    rng = np.random.default_rng(13)
    data = rng.normal(0.0, source_scale, size=(26, 2000))
    payload = io.BytesIO()
    savemat(
        payload,
        {
            "EEG": {
                "data": data,
                "srate": 250.0,
                "labels": np.asarray(EXPECTED_CHANNELS, dtype=object),
            }
        },
    )

    raw = load_any_eeg_bytes(payload.getvalue(), "recording.mat")

    assert np.isclose(float(np.std(raw.get_data())), expected_std, rtol=0.05)


def test_load_any_eeg_bytes_reads_mat_v5_nested_chanlocs():
    rng = np.random.default_rng(12)
    data = rng.normal(0.0, 10e-6, size=(26, 2000))
    chanlocs = np.empty((26,), dtype=object)
    for index, channel in enumerate(EXPECTED_CHANNELS):
        chanlocs[index] = {"labels": channel}
    payload = io.BytesIO()
    savemat(
        payload,
        {
            "EEG": {
                "data": data,
                "srate": 250.0,
                "chanlocs": chanlocs,
            }
        },
    )

    raw = load_any_eeg_bytes(payload.getvalue(), "recording.mat")

    assert raw.ch_names == list(EXPECTED_CHANNELS)
    assert raw.info["sfreq"] == 250.0
    assert np.allclose(raw.get_data(), data)


def test_load_any_eeg_bytes_reads_mat_v73(tmp_path: Path):
    rng = np.random.default_rng(9)
    data = rng.normal(0.0, 10e-6, size=(26, 2000))
    path = tmp_path / "recording.mat"
    with h5py.File(path, "w") as handle:
        eeg = handle.create_group("EEG")
        eeg.create_dataset("data", data=data)
        eeg.create_dataset("srate", data=250.0)
        eeg.create_dataset(
            "labels",
            data=np.asarray(EXPECTED_CHANNELS, dtype=h5py.string_dtype()),
        )

    raw = load_any_eeg_bytes(path.read_bytes(), "recording.mat")

    assert raw.ch_names == list(EXPECTED_CHANNELS)
    assert raw.info["sfreq"] == 250.0
    assert np.allclose(raw.get_data(), data)


def test_load_any_eeg_bytes_reads_mat_v73_cell_labels(tmp_path: Path):
    rng = np.random.default_rng(10)
    data = rng.normal(0.0, 10e-6, size=(26, 2000))
    path = tmp_path / "recording.mat"
    with h5py.File(path, "w") as handle:
        eeg = handle.create_group("EEG")
        eeg.create_dataset("data", data=data)
        eeg.create_dataset("srate", data=250.0)
        labels = eeg.create_dataset("labels", (26, 1), dtype=h5py.ref_dtype)
        for index, channel in enumerate(EXPECTED_CHANNELS):
            label = eeg.create_dataset(
                f"label_{index}",
                data=np.asarray([ord(char) for char in channel], dtype=np.uint16),
            )
            label.attrs["MATLAB_class"] = np.bytes_("char")
            labels[index, 0] = label.ref

    raw = load_any_eeg_bytes(path.read_bytes(), "recording.mat")

    assert raw.ch_names == list(EXPECTED_CHANNELS)
    assert raw.info["sfreq"] == 250.0
    assert np.allclose(raw.get_data(), data)


@pytest.mark.parametrize("transpose_labels", [False, True])
def test_load_any_eeg_bytes_reads_mat_v73_char_matrix_labels(
    tmp_path: Path,
    transpose_labels: bool,
):
    rng = np.random.default_rng(11)
    data = rng.normal(0.0, 10e-6, size=(26, 2000))
    path = tmp_path / "recording.mat"
    width = max(len(channel) for channel in EXPECTED_CHANNELS)
    char_matrix = np.zeros((26, width), dtype=np.uint16)
    for row, channel in enumerate(EXPECTED_CHANNELS):
        for column, char in enumerate(channel):
            char_matrix[row, column] = ord(char)
    if transpose_labels:
        char_matrix = char_matrix.T

    with h5py.File(path, "w") as handle:
        eeg = handle.create_group("EEG")
        eeg.create_dataset("data", data=data)
        eeg.create_dataset("srate", data=250.0)
        labels = eeg.create_dataset("labels", data=char_matrix)
        labels.attrs["MATLAB_class"] = np.bytes_("char")

    raw = load_any_eeg_bytes(path.read_bytes(), "recording.mat")

    assert raw.ch_names == list(EXPECTED_CHANNELS)
    assert raw.info["sfreq"] == 250.0
    assert np.allclose(raw.get_data(), data)
