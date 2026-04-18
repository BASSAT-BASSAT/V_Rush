"""Every registered op runs on a small synthetic BGR image."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from app.cv_ops.registry import OPERATIONS

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_MOBILE_SAM_WEIGHTS = (
    _BACKEND_DIR / "mobile_sam_encoder.onnx",
    _BACKEND_DIR / "mobile_sam_decoder.onnx",
)


@pytest.mark.parametrize("op_id", sorted(OPERATIONS.keys()))
def test_op_runs(op_id: str) -> None:
    if op_id == "mobile_sam" and not all(p.is_file() for p in _MOBILE_SAM_WEIGHTS):
        pytest.skip("MobileSAM ONNX weights not present; see README for export instructions.")

    spec = OPERATIONS[op_id]
    img = np.random.default_rng(42).integers(0, 255, size=(32, 48, 3), dtype=np.uint8)
    params = spec.validate_params(dict(spec.default_params))
    out = spec.apply(img.copy(), params)
    assert out.dtype == np.uint8
    assert out.ndim == 3
    if op_id not in {"resize", "pyramid_down", "pyramid_up", "crop_fraction"}:
        assert out.shape == img.shape
