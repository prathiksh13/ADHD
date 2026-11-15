"""Upload ingestion: decryption, multi-format loading and 26-channel harmonization.

The public entry points are intentionally ordered:

``decrypt_if_needed`` -> ``load_any_eeg_bytes`` -> ``harmonize_to_26_channels``

Every expected ingestion failure raises ``ValueError`` so the API can return an
explicit ``Unscored`` response instead of a generic server error.
"""

from __future__ import annotations

import io
import logging
import re
import tempfile
from pathlib import Path
from typing import Any

import h5py
import mne
import numpy as np
from cryptography.fernet import Fernet, InvalidToken
from scipy.io import loadmat

from app.eeg.schema import EXPECTED_CHANNELS

logger = logging.getLogger(__name__)

_NINETEEN_1020 = (
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
)
_KNOWN_CHANNEL_COUNTS = {19, 26, 32, 64, 128, 256}
_CORE_FRONTAL = {"Fp1", "Fp2", "F3", "F4", "Fz"}
_CORE_POSTERIOR = {"O1", "O2", "P3", "P4", "Pz"}
_TARGET_BY_NORMALIZED = {re.sub(r"[^a-z0-9]", "", channel.lower()): channel for channel in EXPECTED_CHANNELS}
_ALIASES = {
    "t3": "T7",
    "t4": "T8",
    "t5": "P7",
    "t6": "P8",
}
_SFREQ_KEYS = {
    "fs",
    "sfreq",
    "srate",
    "samplingrate",
    "samplerate",
    "samplingfrequency",
    "frequency",
    "hz",
}
_LABEL_KEYS = {
    "labels",
    "label",
    "channels",
    "channel",
    "chnames",
    "channelnames",
    "chanlocs",
    "electrodes",
    "clab",
    "names",
}
_DATA_KEYS = {
    "data",
    "eeg",
    "signal",
    "signals",
    "raw",
    "recording",
    "x",
    "array",
}
_MAT_SIGNATURE = b"MATLAB"
_HDF5_SIGNATURE = b"\x89HDF\r\n\x1a\n"
_FERNET_PREFIX = b"gAAAA"


def decrypt_if_needed(raw_bytes: bytes, key: str | None = None) -> bytes:
    """Decrypt a Fernet-encrypted upload when ``EEG_ENCRYPTION_KEY`` is set.

    Plain EEG/MAT payloads pass through unchanged. A payload that looks like a
    Fernet token but has no usable key raises ``ValueError``.
    """
    if not raw_bytes:
        raise ValueError("The uploaded file is empty.")

    fernet: Fernet | None = None
    if key:
        try:
            fernet = Fernet(key.encode("utf-8"))
        except (TypeError, ValueError) as exc:
            raise ValueError("EEG_ENCRYPTION_KEY is not a valid Fernet key.") from exc

    if fernet is not None:
        try:
            return fernet.decrypt(raw_bytes)
        except InvalidToken:
            pass

    if raw_bytes.startswith(_FERNET_PREFIX):
        raise ValueError(
            "The uploaded file is encrypted. Configure a valid EEG_ENCRYPTION_KEY "
            "on the backend to decrypt it."
        )
    return raw_bytes


def _suffix_from_name(filename: str | None) -> str:
    return Path(filename or "").suffix.lower()


def _is_hdf5(payload: bytes) -> bool:
    return payload.find(_HDF5_SIGNATURE, 0, 1024) >= 0


def _sniff_suffix(raw_bytes: bytes) -> str | None:
    if len(raw_bytes) >= 8 and raw_bytes[1:8] == b"BIOSEMI":
        return ".bdf"
    if raw_bytes.startswith(b"0"):
        return ".edf"
    if raw_bytes.startswith(b"FIFF"):
        return ".fif"
    if raw_bytes.startswith(_MAT_SIGNATURE):
        return ".mat"
    if _is_hdf5(raw_bytes):
        return ".mat"
    return None


def load_any_eeg_bytes(raw_bytes: bytes, filename: str | None = None) -> mne.io.BaseRaw:
    """Load BDF, EDF, FIF, EEGLAB SET, or MAT (v5-v7.2 and v7.3) bytes."""
    suffix = _suffix_from_name(filename)
    detected = _sniff_suffix(raw_bytes)
    if detected and suffix != ".set":
        suffix = detected

    if suffix == ".mat":
        return _mat_bytes_to_raw(raw_bytes)

    if suffix in {".bdf", ".edf", ".fif", ".set"}:
        # MNE already returns these formats in volts; never rescale them.
        return _load_with_mne(raw_bytes, suffix)

    raise ValueError("Unsupported file type. Upload BDF, EDF, FIF, SET, or MAT (v5-v7.3) EEG data.")


def _load_with_mne(raw_bytes: bytes, suffix: str) -> mne.io.BaseRaw:
    with tempfile.TemporaryDirectory(prefix="attune-eeg-load-") as temp_dir:
        stem = "recording_raw" if suffix == ".fif" else "recording"
        path = Path(temp_dir) / f"{stem}{suffix}"
        path.write_bytes(raw_bytes)
        try:
            return mne.io.read_raw(path, preload=True, verbose=False)
        except Exception as exc:
            raise ValueError(
                f"Could not read the {suffix.upper()} recording. "
                "Check that the file is a complete, uncorrupted EEG file."
            ) from exc


def _normalized_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]", "", Path(key).name.lower())


def _as_scalar(value: Any) -> float | None:
    try:
        array = np.asarray(value).squeeze()
    except Exception:
        return None
    if array.ndim != 0:
        return None
    try:
        number = float(array)
    except (TypeError, ValueError):
        return None
    return number if np.isfinite(number) else None


def _decode_text(value: Any) -> str | None:
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8", errors="ignore").strip() or None
        except Exception:
            return None
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, np.bytes_):
        return bytes(value).decode("utf-8", errors="ignore").strip() or None
    if isinstance(value, np.str_):
        return str(value).strip() or None
    return None


def _coerce_labels(value: Any) -> list[str] | None:
    if value is None:
        return None

    if isinstance(value, (str, bytes, np.bytes_, np.str_)):
        text = _decode_text(value)
        return [text] if text else None
    if isinstance(value, dict):
        for field in ("labels", "label", "names", "name"):
            if field in value:
                labels = _coerce_labels(value[field])
                if labels:
                    return labels
        return None
    if hasattr(value, "_fieldnames"):
        for field in ("labels", "label", "names", "name"):
            if field in value._fieldnames:
                labels = _coerce_labels(getattr(value, field))
                if labels:
                    return labels
        return None

    if isinstance(value, np.ndarray):
        if value.dtype.kind in {"U", "S"}:
            labels = [_decode_text(item) for item in value.reshape(-1)]
            valid = [label for label in labels if label]
            return valid or None
        if value.dtype == object:
            labels = []
            for item in value.reshape(-1):
                if hasattr(item, "_fieldnames") or isinstance(item, dict):
                    nested = _coerce_labels(item)
                    if nested and len(nested) == 1:
                        labels.append(nested[0])
                    elif nested:
                        return nested
                else:
                    text = _decode_text(item)
                    if text:
                        labels.append(text)
            return labels or None
        return _decode_char_matrix(value)

    if isinstance(value, (list, tuple)):
        labels = [label for item in value if (label := _decode_text(item))]
        return labels or None

    return None


def _iter_mat_entries(value: Any, key: str, depth: int = 0):
    if depth > 10:
        return
    if isinstance(value, dict):
        for child_key, child in value.items():
            if not str(child_key).startswith("__"):
                yield from _iter_mat_entries(child, str(child_key), depth + 1)
        return
    if hasattr(value, "_fieldnames"):
        for field in value._fieldnames:
            yield from _iter_mat_entries(getattr(value, field), field, depth + 1)
        return
    if isinstance(value, np.ndarray) and value.dtype == object and value.size <= 10_000:
        yield key, value
        for item in value.reshape(-1):
            if hasattr(item, "_fieldnames"):
                yield from _iter_mat_entries(item, key, depth + 1)
        return
    yield key, value


def _mat_entries(payload: bytes) -> list[tuple[str, Any]]:
    if _is_hdf5(payload):
        return _h5_entries(payload)
    try:
        mat = loadmat(
            io.BytesIO(payload),
            squeeze_me=True,
            struct_as_record=False,
            chars_as_strings=True,
        )
    except NotImplementedError:
        return _h5_entries(payload)
    except Exception as exc:
        raise ValueError("Could not parse the MAT file.") from exc

    return list(_iter_mat_entries(mat, "root"))


def _find_sfreq(entries: list[tuple[str, Any]]) -> float | None:
    for key, value in entries:
        if _normalized_key(key) in _SFREQ_KEYS:
            number = _as_scalar(value)
            if number is not None and 1.0 <= number <= 100_000.0:
                return number
    return None


def _find_labels(entries: list[tuple[str, Any]]) -> list[str] | None:
    for key, value in entries:
        normalized = _normalized_key(key)
        if normalized in _LABEL_KEYS or "label" in normalized or "chan" in normalized:
            labels = _coerce_labels(value)
            if labels and len(labels) >= 2:
                return labels
    return None


def _candidate_score(key: str, array: np.ndarray) -> int:
    normalized = _normalized_key(key)
    score = int(array.size)
    if normalized in _DATA_KEYS:
        score *= 10
    if array.shape[0] in _KNOWN_CHANNEL_COUNTS or array.shape[1] in _KNOWN_CHANNEL_COUNTS:
        score *= 2
    return score


def _select_mat_array(entries: list[tuple[str, Any]]) -> np.ndarray:
    candidates: list[tuple[int, np.ndarray]] = []
    for key, value in entries:
        if not isinstance(value, np.ndarray):
            continue
        if not np.issubdtype(value.dtype, np.number):
            continue
        if value.ndim not in {2, 3} or min(value.shape) < 2:
            continue
        candidates.append((_candidate_score(key, value), value))

    if not candidates:
        raise ValueError("No numeric EEG data array was found in the MAT file.")
    return max(candidates, key=lambda item: item[0])[1]


def _normalize_mat_array(
    array: np.ndarray,
    labels: list[str] | None,
) -> tuple[np.ndarray, list[str] | None]:
    data = np.asarray(array, dtype=np.float64)

    if data.ndim == 3:
        if labels and data.shape[1] == len(labels):
            data = np.concatenate([data[index] for index in range(data.shape[0])], axis=1)
        elif labels and data.shape[0] == len(labels):
            data = np.concatenate([data[:, :, index] for index in range(data.shape[2])], axis=1)
        elif data.shape[1] in _KNOWN_CHANNEL_COUNTS:
            data = np.concatenate([data[index] for index in range(data.shape[0])], axis=1)
        elif data.shape[0] in _KNOWN_CHANNEL_COUNTS:
            data = np.concatenate([data[:, :, index] for index in range(data.shape[2])], axis=1)
        else:
            raise ValueError("Could not determine the channel axis in the MAT data array.")

    if data.ndim != 2:
        raise ValueError("The MAT file does not contain a two-dimensional EEG array.")

    if labels:
        if data.shape[0] == len(labels):
            return data, labels
        if data.shape[1] == len(labels):
            return data.T, labels
        raise ValueError(f"Found {len(labels)} channel labels but data shape {data.shape} does not match.")

    if data.shape[0] in _KNOWN_CHANNEL_COUNTS:
        return data, None
    if data.shape[1] in _KNOWN_CHANNEL_COUNTS:
        return data.T, None
    raise ValueError(
        f"Could not determine the channel axis in data shape {data.shape}. "
        "Provide named channels or a 19/26-channel array."
    )


def _default_labels(channel_count: int) -> list[str] | None:
    if channel_count == 19:
        return list(_NINETEEN_1020)
    if channel_count == 26:
        return list(EXPECTED_CHANNELS)
    return None


def _scale_mat_units(data: np.ndarray) -> np.ndarray:
    """Convert MAT EEG amplitudes from V, mV, µV, nV or ADC-like units to volts."""
    eeg_data = np.asarray(data, dtype=np.float64)
    if not np.any(np.isfinite(eeg_data)):
        raise ValueError("The EEG data contains no finite values.")

    med_ptp = float(np.nanmedian(np.ptp(eeg_data, axis=-1)))
    if med_ptp > 5000.0:
        # ADC counts/nanovolts: normalize the constant scale to a typical 50 µV
        # resting EEG standard deviation. This preserves relative bandpower/PLV.
        return 50e-6 * (eeg_data / (float(np.nanstd(eeg_data)) + 1e-12))
    if med_ptp > 1.0:
        return eeg_data * 1e-6
    if med_ptp > 1e-3:
        return eeg_data * 1e-3
    return eeg_data


def _raw_from_array(
    data: np.ndarray,
    labels: list[str] | None,
    sfreq: float | None,
) -> mne.io.BaseRaw:
    if labels is None:
        labels = _default_labels(data.shape[0])
    if labels is None:
        raise ValueError("Channel names are required for recordings with more than 26 channels.")
    if len(labels) != data.shape[0]:
        raise ValueError("Channel label count does not match the EEG data array.")

    if sfreq is None:
        sfreq = 128.0 if len(labels) == 19 else 250.0
    if not 1.0 <= sfreq <= 100_000.0:
        raise ValueError("The sampling rate in the MAT file is invalid.")

    info = mne.create_info(list(labels), float(sfreq), ch_types="eeg")
    return mne.io.RawArray(data, info, verbose=False)


def _mat_bytes_to_raw(raw_bytes: bytes) -> mne.io.BaseRaw:
    entries = _mat_entries(raw_bytes)
    array = _select_mat_array(entries)
    labels = _find_labels(entries)
    data, labels = _normalize_mat_array(array, labels)
    data = _scale_mat_units(data)
    return _raw_from_array(data, labels, _find_sfreq(entries))


def _iter_h5_datasets(group: h5py.Group, prefix: str = ""):
    for name, item in group.items():
        path = f"{prefix}/{name}" if prefix else name
        if isinstance(item, h5py.Dataset):
            yield path, item
        elif isinstance(item, h5py.Group):
            yield from _iter_h5_datasets(item, path)


def _h5_char_text(value: Any) -> str | None:
    array = np.asarray(value)
    if array.ndim == 0:
        return None
    codes = [int(code) for code in array.reshape(-1) if int(code) != 0]
    text = "".join(chr(code) for code in codes).strip()
    return text or None


def _h5_reference_value(handle: h5py.File, reference: Any, depth: int = 0) -> Any:
    if depth > 8 or not reference:
        return None
    try:
        item = handle[reference]
    except Exception:
        return None
    if isinstance(item, h5py.Dataset):
        try:
            value = item[()]
        except Exception:
            return None
        matlab_class = item.attrs.get("MATLAB_class")
        if isinstance(matlab_class, bytes):
            matlab_class = matlab_class.decode("ascii", errors="ignore")
        if matlab_class == "char":
            return _h5_char_text(value)
        return value
    if isinstance(item, h5py.Group):
        return {name: _h5_reference_value(handle, child.ref, depth + 1) for name, child in item.items()}
    return None


def _h5_entries(payload: bytes) -> list[tuple[str, Any]]:
    entries: list[tuple[str, Any]] = []
    try:
        with h5py.File(io.BytesIO(payload), "r") as handle:
            for path, dataset in _iter_h5_datasets(handle):
                try:
                    value = dataset[()]
                except Exception:
                    continue
                if h5py.check_dtype(ref=dataset.dtype) is not None:
                    value = np.asarray(
                        [
                            _h5_reference_value(handle, reference)
                            for reference in np.asarray(value).reshape(-1)
                        ],
                        dtype=object,
                    )
                entries.append((path, value))
    except Exception as exc:
        raise ValueError("Could not parse the MAT v7.3 file.") from exc
    return entries


def _char_label_score(labels: list[str]) -> int:
    if len(labels) < 2 or len(labels) > 512:
        return -1
    if not all(re.fullmatch(r"[A-Za-z0-9 _.-]+", label) for label in labels):
        return -1

    score = 0
    if len(labels) in _KNOWN_CHANNEL_COUNTS:
        score += 100
    for label in labels:
        normalized = _normalize_label(label)
        if normalized and normalized in _TARGET_BY_NORMALIZED:
            score += 20
        elif len(label) <= 8:
            score += 2
        else:
            score -= 4
    return score


def _decode_char_matrix(value: np.ndarray) -> list[str] | None:
    if value.ndim != 2 or not np.issubdtype(value.dtype, np.number):
        return None

    candidates: list[list[str]] = []
    for matrix in (value, value.T):
        labels: list[str] = []
        for row in matrix:
            text = "".join(chr(int(code)) for code in row if int(code) != 0).strip()
            if text:
                labels.append(text)
        candidates.append(labels)

    scored = [(score, labels) for labels in candidates if (score := _char_label_score(labels)) > 0]
    if not scored:
        return None
    return max(scored, key=lambda item: item[0])[1]


def _normalize_label(label: str) -> str | None:
    normalized = re.sub(r"[^a-z0-9]", "", str(label).lower())
    if normalized.startswith("eeg"):
        normalized = normalized[3:]
    for suffix in ("ref", "average", "avg", "le", "m1", "m2", "a1", "a2"):
        if normalized.endswith(suffix) and normalized[: -len(suffix)]:
            normalized = normalized[: -len(suffix)]
            break
    if normalized in _ALIASES:
        return re.sub(r"[^a-z0-9]", "", _ALIASES[normalized].lower())
    return normalized or None


def harmonize_to_26_channels(raw: mne.io.BaseRaw) -> mne.io.BaseRaw:
    """Map 19/26/>26-channel named recordings onto the TDBRAIN 26-channel order.

    Missing target channels (for example FC/CP channels in a standard 19-channel
    recording) are interpolated from the standard 10-20 montage. Recordings that
    lack both frontal and posterior core electrodes raise ``ValueError``.
    """
    mapped: dict[str, int] = {}
    for index, channel in enumerate(raw.ch_names):
        normalized = _normalize_label(channel)
        if normalized is None:
            continue
        target = _TARGET_BY_NORMALIZED.get(normalized)
        if target and target not in mapped:
            mapped[target] = index

    available = set(mapped)
    if not available.intersection(_CORE_FRONTAL) or not available.intersection(_CORE_POSTERIOR):
        missing_frontal = sorted(_CORE_FRONTAL - available)
        missing_posterior = sorted(_CORE_POSTERIOR - available)
        raise ValueError(
            "Missing core frontal/posterior electrodes. "
            f"Frontal missing: {', '.join(missing_frontal) or 'none'}; "
            f"posterior missing: {', '.join(missing_posterior) or 'none'}."
        )

    if len(mapped) < 4:
        raise ValueError("Too few recognizable 10-20 channels were found in the recording.")

    source = raw.get_data()
    sfreq = float(raw.info["sfreq"])
    if source.shape[1] == 0:
        raise ValueError("The recording contains no samples.")

    data = np.zeros((len(EXPECTED_CHANNELS), source.shape[1]), dtype=np.float64)
    for target, source_index in mapped.items():
        data[EXPECTED_CHANNELS.index(target)] = source[source_index]

    info = mne.create_info(list(EXPECTED_CHANNELS), sfreq, ch_types="eeg")
    harmonized = mne.io.RawArray(data, info, verbose=False)

    missing = [channel for channel in EXPECTED_CHANNELS if channel not in mapped]
    if not missing:
        return harmonized

    try:
        montage = mne.channels.make_standard_montage("standard_1020")
        harmonized.set_montage(
            montage,
            match_case=False,
            on_missing="ignore",
            verbose=False,
        )
        harmonized.info["bads"] = missing
        harmonized.interpolate_bads(reset_bads=True, verbose=False)
    except Exception as exc:
        raise ValueError(
            "Could not interpolate the missing channels needed for the 26-channel model."
        ) from exc

    return harmonized
