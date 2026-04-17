"""YOLO26 op with mocked model (no weight download)."""

from __future__ import annotations

import numpy as np
from app.cv_ops.executor import execute_pipeline
from app.cv_ops.validate import validate_pipeline
from app.cv_ops.yolo26 import set_model_for_testing, yolo26_detect_step


class _Scalar:
    def __init__(self, v: float | int) -> None:
        self._v = float(v)

    def item(self) -> float:
        return self._v


class _XY:
    def tolist(self) -> list[float]:
        return [10.0, 10.0, 50.0, 50.0]


class _FakeBox:
    cls = [_Scalar(0)]
    conf = [_Scalar(0.95)]
    xyxy = [_XY()]


class _FakeBoxes:
    def __init__(self, items: list) -> None:
        self._items = items

    def __len__(self) -> int:
        return len(self._items)

    def __iter__(self):
        return iter(self._items)


class _FakeResult:
    def __init__(self, with_boxes: bool = True) -> None:
        self.boxes: _FakeBoxes | None = _FakeBoxes([_FakeBox()]) if with_boxes else None

    def plot(self) -> np.ndarray:
        return np.full((64, 64, 3), 200, dtype=np.uint8)


class _FakeModel:
    names = {0: "person"}

    def __call__(self, bgr, **kwargs):
        return [_FakeResult()]


def test_yolo26_detect_step_mocked() -> None:
    set_model_for_testing(_FakeModel())
    try:
        img = np.zeros((64, 64, 3), dtype=np.uint8)
        params = {"conf": 0.25, "max_det": 10, "draw": True, "classes": None}
        out, dets = yolo26_detect_step(img, params)
        assert out.shape == (64, 64, 3)
        assert len(dets) == 1
        assert dets[0]["label"] == "person"
        assert len(dets[0]["bbox"]) == 4
    finally:
        set_model_for_testing(None)


def test_execute_pipeline_yolo_last_detections() -> None:
    set_model_for_testing(_FakeModel())
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
    set_model_for_testing(_FakeModel())
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
