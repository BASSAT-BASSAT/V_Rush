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
