"""MobileSAM op with mocked encoder/decoder sessions (no weights, no torch)."""

from __future__ import annotations

import numpy as np
import pytest
from app.cv_ops.executor import execute_pipeline
from app.cv_ops.mobile_sam import (
    mobile_sam_segment_step,
    set_model_for_testing,
    validate_mobile_sam_params,
)
from app.cv_ops.validate import validate_pipeline


class _FakeEncoder:
    """Returns zero embeddings of the canonical MobileSAM shape."""

    def __init__(self) -> None:
        self.last_feeds: dict[str, np.ndarray] | None = None

    def run(
        self, output_names: list[str] | None, feeds: dict[str, np.ndarray]
    ) -> list[np.ndarray]:
        self.last_feeds = feeds
        return [np.zeros((1, 256, 64, 64), dtype=np.float32)]


class _FakeDecoder:
    """Returns a synthetic (1, 1, h, w) logit mask that's positive inside a central rect."""

    def __init__(self, h: int, w: int) -> None:
        self.h = h
        self.w = w
        self.last_feeds: dict[str, np.ndarray] | None = None

    def run(
        self, output_names: list[str] | None, feeds: dict[str, np.ndarray]
    ) -> list[np.ndarray]:
        self.last_feeds = feeds
        orig = feeds["orig_im_size"]
        hh = int(orig[0])
        ww = int(orig[1])
        mask = np.full((1, 1, hh, ww), -5.0, dtype=np.float32)
        y1, y2 = hh // 4, (3 * hh) // 4
        x1, x2 = ww // 4, (3 * ww) // 4
        mask[0, 0, y1:y2, x1:x2] = 5.0
        iou = np.array([[0.73]], dtype=np.float32)
        return [mask, iou]


def _install(h: int = 64, w: int = 64) -> tuple[_FakeEncoder, _FakeDecoder]:
    enc = _FakeEncoder()
    dec = _FakeDecoder(h, w)
    set_model_for_testing((enc, dec))
    return enc, dec


def test_validate_rejects_bad_prompt_type() -> None:
    with pytest.raises(ValueError, match="prompt_type"):
        validate_mobile_sam_params({"prompt_type": "scribble"})


def test_validate_rejects_bad_output_mode() -> None:
    with pytest.raises(ValueError, match="output"):
        validate_mobile_sam_params({"output": "foo"})


def test_validate_clamps_fractions_and_labels() -> None:
    v = validate_mobile_sam_params(
        {
            "prompt_type": "point",
            "point_x_frac": 5.0,
            "point_y_frac": -1.0,
            "point_label": 9,
            "output": "cutout",
        }
    )
    assert v["point_x_frac"] == 1.0
    assert v["point_y_frac"] == 0.0
    assert v["point_label"] == 1
    assert v["output"] == "cutout"


def test_validate_fixes_inverted_box() -> None:
    v = validate_mobile_sam_params(
        {
            "prompt_type": "box",
            "box_x1_frac": 0.6,
            "box_x2_frac": 0.1,
            "box_y1_frac": 0.4,
            "box_y2_frac": 0.2,
        }
    )
    assert v["box_x2_frac"] > v["box_x1_frac"]
    assert v["box_y2_frac"] > v["box_y1_frac"]


def test_point_prompt_produces_mask() -> None:
    _install(64, 64)
    try:
        img = np.full((64, 64, 3), 120, dtype=np.uint8)
        params = validate_mobile_sam_params({"prompt_type": "point", "output": "overlay"})
        out, dets = mobile_sam_segment_step(img, params)
        assert out.shape == img.shape
        assert out.dtype == np.uint8
        assert len(dets) == 1
        assert dets[0]["label"] == "sam-mask"
        assert dets[0]["area_px"] > 0
        assert 0.0 <= dets[0]["confidence"] <= 1.0
    finally:
        set_model_for_testing(None)


def test_box_prompt_sends_two_points() -> None:
    _, dec = _install(48, 80)
    try:
        img = np.full((48, 80, 3), 50, dtype=np.uint8)
        params = validate_mobile_sam_params(
            {
                "prompt_type": "box",
                "box_x1_frac": 0.1,
                "box_y1_frac": 0.2,
                "box_x2_frac": 0.9,
                "box_y2_frac": 0.8,
                "output": "mask",
            }
        )
        out, dets = mobile_sam_segment_step(img, params)
        assert out.shape == img.shape
        assert dets[0]["area_px"] > 0
        assert dec.last_feeds is not None
        coords = dec.last_feeds["point_coords"]
        labels = dec.last_feeds["point_labels"]
        assert coords.shape == (1, 2, 2)
        assert labels.shape == (1, 2)
        assert labels[0, 0] == 2.0
        assert labels[0, 1] == 3.0
    finally:
        set_model_for_testing(None)


def test_cutout_output_zeros_background() -> None:
    _install(32, 32)
    try:
        img = np.full((32, 32, 3), 200, dtype=np.uint8)
        params = validate_mobile_sam_params({"prompt_type": "point", "output": "cutout"})
        out, _ = mobile_sam_segment_step(img, params)
        # corners are outside the 1/4..3/4 rect -> should be zero
        assert out[0, 0].sum() == 0
        assert out[0, -1].sum() == 0
        # center is inside the mask -> original value survives
        assert out[16, 16].sum() > 0
    finally:
        set_model_for_testing(None)


def test_mask_output_is_bw() -> None:
    _install(40, 40)
    try:
        img = np.full((40, 40, 3), 77, dtype=np.uint8)
        params = validate_mobile_sam_params({"prompt_type": "point", "output": "mask"})
        out, _ = mobile_sam_segment_step(img, params)
        vals = np.unique(out)
        assert set(vals.tolist()).issubset({0, 255})
    finally:
        set_model_for_testing(None)


def test_execute_pipeline_routes_mobile_sam() -> None:
    _install(32, 32)
    try:
        img = np.full((32, 32, 3), 100, dtype=np.uint8)
        raw = [
            {
                "op": "mobile_sam",
                "params": {"prompt_type": "point", "output": "overlay"},
            }
        ]
        v = validate_pipeline(raw)
        r = execute_pipeline(img, v)
        assert r.image_bgr.shape == img.shape
        assert len(r.detections) == 1
        assert r.detections[0]["label"] == "sam-mask"
    finally:
        set_model_for_testing(None)
