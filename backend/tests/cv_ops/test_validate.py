"""Pipeline validation."""

from __future__ import annotations

import pytest
from app.cv_ops.validate import validate_pipeline


def test_rejects_unknown_op() -> None:
    with pytest.raises(ValueError, match="Unknown"):
        validate_pipeline([{"op": "not_a_real_op", "params": {}}])


def test_dedupes_identical_consecutive() -> None:
    v = validate_pipeline(
        [
            {"op": "gaussian_blur", "params": {"ksize": 5, "sigma": 0}},
            {"op": "gaussian_blur", "params": {"ksize": 5, "sigma": 0}},
        ]
    )
    assert len(v.steps) == 1
    assert any("duplicate" in w.lower() for w in v.warnings)


def test_valid_chain() -> None:
    v = validate_pipeline(
        [
            {"op": "to_grayscale", "params": {}},
            {"op": "gaussian_blur", "params": {"ksize": 5}},
        ]
    )
    assert len(v.steps) == 2


def test_unsharp_mask_mode_validation() -> None:
    v = validate_pipeline(
        [
            {
                "op": "unsharp_mask",
                "params": {"mode": "unknown", "amount": 10, "edge_source": "bad"},
            }
        ]
    )
    p = v.steps[0][1]
    assert p["mode"] == "additive"
    assert p["amount"] == 5.0
    assert p["edge_source"] == "sobel"


def test_frequency_band_validation() -> None:
    v = validate_pipeline(
        [
            {
                "op": "frequency_butterworth_bandpass",
                "params": {"center_frequency": -2, "bandwidth": 0, "order": 50},
            }
        ]
    )
    p = v.steps[0][1]
    assert p["center_frequency"] >= 1.0
    assert p["bandwidth"] >= 1.0
    assert p["order"] == 10
