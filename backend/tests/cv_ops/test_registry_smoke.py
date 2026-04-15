"""Every registered op runs on a small synthetic BGR image."""

from __future__ import annotations

import numpy as np
import pytest
from app.cv_ops.registry import OPERATIONS


@pytest.mark.parametrize("op_id", sorted(OPERATIONS.keys()))
def test_op_runs(op_id: str) -> None:
    spec = OPERATIONS[op_id]
    img = np.random.default_rng(42).integers(0, 255, size=(32, 48, 3), dtype=np.uint8)
    params = spec.validate_params(dict(spec.default_params))
    out = spec.apply(img.copy(), params)
    assert out.dtype == np.uint8
    assert out.ndim == 3
    if op_id not in {"resize", "pyramid_down", "pyramid_up", "crop_fraction"}:
        assert out.shape == img.shape
