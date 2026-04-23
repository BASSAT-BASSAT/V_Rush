"""End-to-end executor."""

from __future__ import annotations

import numpy as np
from app.cv_ops.executor import execute_pipeline
from app.cv_ops.validate import validate_pipeline


def test_frequency_lp_roundtrip_shape() -> None:
    img = np.ones((64, 64, 3), dtype=np.uint8) * 128
    raw = [{"op": "frequency_gaussian_lowpass", "params": {"sigma_frequency": 20.0}}]
    v = validate_pipeline(raw)
    r = execute_pipeline(img, v)
    assert r.image_bgr.shape == img.shape


def _run_single_op(op: str, params: dict) -> np.ndarray:
    img = np.ones((64, 64, 3), dtype=np.uint8) * 128
    v = validate_pipeline([{"op": op, "params": params}])
    return execute_pipeline(img, v).image_bgr


def test_frequency_ideal_lowpass_shape() -> None:
    out = _run_single_op("frequency_ideal_lowpass", {"cutoff_frequency": 20.0})
    assert out.shape == (64, 64, 3)
    assert out.dtype == np.uint8


def test_frequency_ideal_highpass_shape() -> None:
    out = _run_single_op("frequency_ideal_highpass", {"cutoff_frequency": 20.0})
    assert out.shape == (64, 64, 3)
    assert out.dtype == np.uint8


def test_frequency_butterworth_lowpass_shape() -> None:
    out = _run_single_op(
        "frequency_butterworth_lowpass", {"cutoff_frequency": 20.0, "order": 2}
    )
    assert out.shape == (64, 64, 3)
    assert out.dtype == np.uint8


def test_frequency_butterworth_highpass_shape() -> None:
    out = _run_single_op(
        "frequency_butterworth_highpass", {"cutoff_frequency": 20.0, "order": 3}
    )
    assert out.shape == (64, 64, 3)
    assert out.dtype == np.uint8
