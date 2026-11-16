"""Generate a deterministic, explicitly synthetic MAT recording for browser tests."""

import argparse
import sys
from pathlib import Path

import numpy as np
from scipy.io import savemat

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.eeg.schema import EXPECTED_CHANNELS


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    output = parser.parse_args().output
    output.parent.mkdir(parents=True, exist_ok=True)
    samples = 2000
    rng = np.random.default_rng(2026)
    time = np.arange(samples) / 250
    data = rng.normal(0, 10e-6, (len(EXPECTED_CHANNELS), samples))
    data += 5e-6 * np.sin(2 * np.pi * 10 * time)
    savemat(
        output, {"EEG": {"data": data, "srate": 250.0, "labels": np.asarray(EXPECTED_CHANNELS, dtype=object)}}
    )


if __name__ == "__main__":
    main()
