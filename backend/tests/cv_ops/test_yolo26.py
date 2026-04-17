"""YOLO26 op with a mocked onnxruntime session (no weights, no torch)."""

from __future__ import annotations

import numpy as np
from app.cv_ops.executor import execute_pipeline
from app.cv_ops.validate import validate_pipeline
from app.cv_ops.yolo26 import set_model_for_testing, yolo26_detect_step


def _make_fake_output(
    boxes: list[tuple[float, float, float, float, float, int]],
) -> np.ndarray:
    """Build a (1, 300, 6) tensor mimicking the YOLO26 end-to-end ONNX output."""
    arr = np.zeros((1, 300, 6), dtype=np.float32)
    for i, (x1, y1, x2, y2, conf, cid) in enumerate(boxes[:300]):
        arr[0, i] = [x1, y1, x2, y2, conf, cid]
    return arr


class _FakeSession:
    def __init__(self, output: np.ndarray) -> None:
        self._output = output
        self.last_feeds: dict[str, np.ndarray] | None = None

    def run(
        self, output_names: list[str] | None, feeds: dict[str, np.ndarray]
    ) -> list[np.ndarray]:
        self.last_feeds = feeds
        return [self._output]


def test_yolo26_detect_step_mocked() -> None:
    # Class 0 = "person"; box covers a portion of the 640x640 letterboxed canvas.
    fake_out = _make_fake_output([(100.0, 100.0, 300.0, 300.0, 0.95, 0)])
    set_model_for_testing(_FakeSession(fake_out))
    try:
        img = np.zeros((64, 64, 3), dtype=np.uint8)
        params = {"conf": 0.25, "max_det": 10, "draw": True, "classes": None}
        out, dets = yolo26_detect_step(img, params)
        assert out.shape == (64, 64, 3)
        assert out.dtype == np.uint8
        assert len(dets) == 1
        assert dets[0]["label"] == "person"
        assert len(dets[0]["bbox"]) == 4
        # Boxes are clipped to the original image dimensions.
        x1, y1, x2, y2 = dets[0]["bbox"]
        assert 0 <= x1 <= 63 and 0 <= x2 <= 63
        assert 0 <= y1 <= 63 and 0 <= y2 <= 63
    finally:
        set_model_for_testing(None)


def test_execute_pipeline_yolo_last_detections() -> None:
    fake_out = _make_fake_output([(50.0, 50.0, 200.0, 200.0, 0.88, 0)])
    set_model_for_testing(_FakeSession(fake_out))
    try:
        img = np.ones((32, 32, 3), dtype=np.uint8) * 128
        raw = [
            {
                "op": "yolo26_detect",
                "params": {"conf": 0.25, "classes": [], "max_det": 50, "draw": False},
            }
        ]
        v = validate_pipeline(raw)
        r = execute_pipeline(img, v)
        assert len(r.detections) == 1
        assert r.detections[0]["label"] == "person"
    finally:
        set_model_for_testing(None)


def test_gaussian_then_yolo_order() -> None:
    fake_out = _make_fake_output([(10.0, 10.0, 100.0, 100.0, 0.7, 0)])
    set_model_for_testing(_FakeSession(fake_out))
    try:
        img = np.ones((32, 32, 3), dtype=np.uint8) * 200
        raw = [
            {"op": "gaussian_blur", "params": {"ksize": 3, "sigma": 0.8}},
            {
                "op": "yolo26_detect",
                "params": {"conf": 0.25, "classes": [], "max_det": 10, "draw": False},
            },
        ]
        v = validate_pipeline(raw)
        r = execute_pipeline(img, v)
        assert len(r.detections) == 1
    finally:
        set_model_for_testing(None)


def test_yolo26_confidence_filter() -> None:
    """Below-threshold boxes are dropped."""
    fake_out = _make_fake_output(
        [
            (10.0, 10.0, 100.0, 100.0, 0.9, 0),
            (20.0, 20.0, 120.0, 120.0, 0.1, 2),  # below conf=0.5
        ]
    )
    set_model_for_testing(_FakeSession(fake_out))
    try:
        img = np.zeros((128, 128, 3), dtype=np.uint8)
        params = {"conf": 0.5, "max_det": 10, "draw": False, "classes": None}
        _, dets = yolo26_detect_step(img, params)
        assert len(dets) == 1
        assert dets[0]["label"] == "person"
    finally:
        set_model_for_testing(None)


def test_yolo26_class_filter() -> None:
    """Only boxes in the ``classes`` list survive."""
    fake_out = _make_fake_output(
        [
            (10.0, 10.0, 100.0, 100.0, 0.9, 0),  # person
            (20.0, 20.0, 120.0, 120.0, 0.9, 2),  # car
        ]
    )
    set_model_for_testing(_FakeSession(fake_out))
    try:
        img = np.zeros((128, 128, 3), dtype=np.uint8)
        params = {"conf": 0.25, "max_det": 10, "draw": False, "classes": [2]}
        _, dets = yolo26_detect_step(img, params)
        assert len(dets) == 1
        assert dets[0]["label"] == "car"
    finally:
        set_model_for_testing(None)
