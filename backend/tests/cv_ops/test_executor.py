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
