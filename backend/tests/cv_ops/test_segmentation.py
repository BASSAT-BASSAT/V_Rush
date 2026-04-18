"""Tests for classical segmentation ops."""

from __future__ import annotations

import numpy as np
import pytest
from app.cv_ops.segmentation import (
    SEGMENTATION_SPECS,
    apply_connected_components,
    apply_grabcut,
    apply_kmeans,
    apply_watershed,
    validate_connected_components,
    validate_grabcut,
    validate_kmeans,
    validate_watershed,
)


def _rainbow(h: int = 64, w: int = 64) -> np.ndarray:
    """Synthetic BGR image with two bright blobs on a dark background."""
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[10:28, 10:28] = (220, 40, 40)
    img[36:58, 36:58] = (40, 40, 220)
    img[12:14, 12:14] = 0  # tiny hole to stress opening
    return img


def test_kmeans_quantizes_to_k_colors() -> None:
    img = _rainbow()
    out = apply_kmeans(img, {"k": 3})
    assert out.shape == img.shape
    assert out.dtype == np.uint8
    unique_colors = {tuple(c) for c in out.reshape(-1, 3)}
    assert len(unique_colors) <= 3


def test_kmeans_params_clamped() -> None:
    assert validate_kmeans({"k": 0})["k"] == 2
    assert validate_kmeans({"k": 9999})["k"] == 32
    assert validate_kmeans({})["k"] == 4


def test_watershed_preserves_shape_and_dtype() -> None:
    img = _rainbow()
    out = apply_watershed(img, {"threshold": 127})
    assert out.shape == img.shape
    assert out.dtype == np.uint8


def test_watershed_validator_clamps_threshold() -> None:
    assert validate_watershed({"threshold": -5})["threshold"] == 1
    assert validate_watershed({"threshold": 999})["threshold"] == 254


def test_grabcut_returns_foreground_only() -> None:
    img = _rainbow()
    out = apply_grabcut(img, {"iterations": 2, "margin_percent": 10})
    assert out.shape == img.shape
    assert out.dtype == np.uint8
    border = np.concatenate([out[0, :], out[-1, :], out[:, 0], out[:, -1]])
    assert border.sum() == 0


def test_grabcut_validator_clamps() -> None:
    v = validate_grabcut({"iterations": 100, "margin_percent": 200})
    assert v["iterations"] == 10
    assert v["margin_percent"] == 40


def test_connected_components_labels_two_blobs() -> None:
    img = _rainbow()
    out = apply_connected_components(img, {"threshold": 50})
    assert out.shape == img.shape
    assert out.dtype == np.uint8
    unique_colors = {tuple(c) for c in out.reshape(-1, 3)}
    assert (0, 0, 0) in unique_colors
    assert len(unique_colors) >= 2


def test_connected_components_validator() -> None:
    assert validate_connected_components({"threshold": 42})["threshold"] == 42


@pytest.mark.parametrize("spec", SEGMENTATION_SPECS)
def test_specs_have_segmentation_category(spec: dict) -> None:
    assert spec["category"] == "segmentation"
    assert spec["output_kind"] == "spatial"
    assert callable(spec["apply"])
    assert callable(spec["validate_params"])
    normalized = spec["validate_params"](dict(spec["default_params"]))
    assert isinstance(normalized, dict)
