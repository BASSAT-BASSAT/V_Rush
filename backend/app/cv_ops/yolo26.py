"""YOLO26n (Ultralytics) object detection — COCO classes on current BGR after prior steps."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.cv_ops.coco80 import COCO_NAME_TO_ID, COCO80_NAMES

# Lazy singleton — avoid import-time torch/ultralytics cost for tests that mock
_model = None


def _get_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
        except ImportError as e:
            raise RuntimeError(
                "The ultralytics package is not installed on this server. "
                "Install backend dependencies (e.g. pip install -e backend or uv sync in backend/) "
                "including ultralytics and PyTorch."
            ) from e

        _model = YOLO("yolo26n.pt")
    return _model


def set_model_for_testing(model: Any | None) -> None:
    """Replace or clear the cached model (tests only)."""
    global _model
    _model = model


def _clamp_int(x: Any, lo: int, hi: int, default: int) -> int:
    try:
        v = int(x)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


def _clamp_float(x: Any, lo: float, hi: float, default: float) -> float:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return default
    if v != v:  # NaN
        return default
    return max(lo, min(hi, v))


def validate_yolo26_params(p: dict) -> dict:
    conf = _clamp_float(p.get("conf", 0.25), 0.0, 1.0, 0.25)
    max_det = _clamp_int(p.get("max_det", 100), 1, 300, 100)
    draw = p.get("draw", True)
    if not isinstance(draw, bool):
        draw = bool(draw)

    raw_classes = p.get("classes")
    classes: list[int] | None = None
    if raw_classes is not None:
        if not isinstance(raw_classes, list):
            raise ValueError("classes must be a list of COCO class names or integer ids")
        if len(raw_classes) == 0:
            classes = None
        else:
            # Resolve names/ids without loading YOLO (no ultralytics import).
            out_ids: set[int] = set()
            for item in raw_classes:
                if isinstance(item, int):
                    if item < 0 or item >= len(COCO80_NAMES):
                        raise ValueError(f"Invalid class id {item} (use 0–{len(COCO80_NAMES) - 1})")
                    out_ids.add(item)
                elif isinstance(item, str):
                    key = item.strip().lower()
                    if key not in COCO_NAME_TO_ID:
                        raise ValueError(f"Unknown COCO class name: {item!r}")
                    out_ids.add(COCO_NAME_TO_ID[key])
                else:
                    raise ValueError("Each class must be an int id or string name")
            classes = sorted(out_ids)

    return {"conf": conf, "max_det": max_det, "draw": draw, "classes": classes}


def yolo26_detect_step(bgr: np.ndarray, params: dict) -> tuple[np.ndarray, list[dict[str, Any]]]:
    """Run inference; returns (possibly annotated BGR image, detection list)."""
    model = _get_model()
    conf = float(params["conf"])
    max_det = int(params["max_det"])
    draw = bool(params["draw"])
    classes = params.get("classes")

    kwargs: dict[str, Any] = {"conf": conf, "max_det": max_det, "verbose": False}
    if classes is not None:
        kwargs["classes"] = classes

    results = model(bgr, **kwargs)
    r0 = results[0]

    detections: list[dict[str, Any]] = []
    if r0.boxes is not None and len(r0.boxes) > 0:
        for box in r0.boxes:
            cls_id = int(box.cls[0].item())
            score = float(box.conf[0].item())
            xyxy = [float(x) for x in box.xyxy[0].tolist()]
            label = str(model.names[cls_id])
            detections.append(
                {
                    "label": label,
                    "confidence": score,
                    "bbox": xyxy,
                }
            )

    if draw:
        plotted = r0.plot()
        out = np.asarray(plotted)
        if out.ndim == 2:
            out = cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)
        elif out.shape[2] == 4:
            out = cv2.cvtColor(out, cv2.COLOR_RGBA2BGR)
        return out.astype(np.uint8), detections

    return bgr.copy(), detections


def apply_yolo26_detect(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Registry apply: image only (detections are merged in executor)."""
    img, _ = yolo26_detect_step(bgr, params)
    return img


YOLO26_SPECS: list[dict] = [
    {
        "id": "yolo26_detect",
        "label": "YOLO26 detect (COCO)",
        "category": "detection",
        "description": (
            "COCO object detection (YOLO26n). Uses the image after the steps above this one."
        ),
        "default_params": {"conf": 0.25, "classes": [], "max_det": 100, "draw": True},
        "apply": apply_yolo26_detect,
        "validate_params": validate_yolo26_params,
        "output_kind": "spatial",
        "detail_doc": (
            "Ultralytics YOLO26n trained on COCO (~80 classes). This step sees whatever BGR image "
            "the pipeline has produced so far — put preprocessing **above** this step to detect on "
            "denoised, resized, or enhanced images. Bboxes use pixel coords for that frame. "
            "AGPL-3.0 applies to Ultralytics; confirm licensing for your use case."
        ),
    },
]
