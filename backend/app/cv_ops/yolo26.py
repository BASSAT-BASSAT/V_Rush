"""YOLO26n object detection via ONNX Runtime — COCO classes on current BGR after prior steps.

The model is exported from ``yolo26n.pt`` with Ultralytics' end-to-end ONNX format
(NMS baked in). Output shape is ``(1, 300, 6)``: ``[x1, y1, x2, y2, conf, class_id]``
in the 640x640 letterboxed input space. We unletterbox back to the original image.

No PyTorch / Ultralytics on the server — only ``onnxruntime`` + ``opencv``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol

import cv2
import numpy as np

from app.cv_ops.coco80 import COCO80_NAMES, COCO_NAME_TO_ID

_MODEL_INPUT_SIZE = 640
_MODEL_FILENAME = "yolo26n.onnx"


class _SessionLike(Protocol):
    def run(
        self, output_names: list[str] | None, feeds: dict[str, np.ndarray]
    ) -> list[np.ndarray]: ...


_session: _SessionLike | None = None
_input_name: str | None = None


def _resolve_model_path() -> Path:
    """Look for ``yolo26n.onnx`` relative to ``backend/`` (works on Vercel/Docker/local)."""
    here = Path(__file__).resolve()
    # app/cv_ops/yolo26.py -> app/cv_ops -> app -> backend
    backend_dir = here.parent.parent.parent
    candidates = [
        backend_dir / _MODEL_FILENAME,
        Path.cwd() / _MODEL_FILENAME,
        backend_dir.parent / _MODEL_FILENAME,
    ]
    for c in candidates:
        if c.is_file():
            return c
    return candidates[0]


def _get_session() -> _SessionLike:
    global _session, _input_name
    if _session is None:
        try:
            import onnxruntime as ort
        except ImportError as e:
            raise RuntimeError(
                "The onnxruntime package is not installed on this server. "
                "Install backend dependencies (e.g. pip install -e backend or uv sync in backend/)."
            ) from e

        model_path = _resolve_model_path()
        if not model_path.is_file():
            raise RuntimeError(
                f"YOLO26 ONNX weights not found at {model_path}. "
                "Export once locally with: "
                "python -c \"from ultralytics import YOLO; "
                "YOLO('yolo26n.pt').export(format='onnx', imgsz=640, opset=12, simplify=True)\" "
                "and commit backend/yolo26n.onnx."
            )

        sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        _session = sess
        _input_name = sess.get_inputs()[0].name
    return _session


def set_model_for_testing(model: _SessionLike | None, input_name: str = "images") -> None:
    """Replace or clear the cached onnxruntime session (tests only)."""
    global _session, _input_name
    _session = model
    _input_name = input_name if model is not None else None


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


def _letterbox(
    bgr: np.ndarray, new_size: int = _MODEL_INPUT_SIZE, pad_value: int = 114
) -> tuple[np.ndarray, float, tuple[int, int]]:
    """Resize + pad BGR to a square canvas, preserving aspect ratio.

    Returns ``(canvas, ratio, (pad_left, pad_top))``. ``ratio`` maps original px -> model px.
    """
    h, w = bgr.shape[:2]
    ratio = min(new_size / h, new_size / w)
    new_w = int(round(w * ratio))
    new_h = int(round(h * ratio))
    resized = cv2.resize(bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    pad_w = new_size - new_w
    pad_h = new_size - new_h
    left = pad_w // 2
    right = pad_w - left
    top = pad_h // 2
    bottom = pad_h - top
    canvas = cv2.copyMakeBorder(
        resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(pad_value,) * 3
    )
    return canvas, ratio, (left, top)


def _preprocess(bgr: np.ndarray) -> tuple[np.ndarray, float, tuple[int, int]]:
    canvas, ratio, pad = _letterbox(bgr, _MODEL_INPUT_SIZE)
    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
    arr = rgb.astype(np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))  # HWC -> CHW
    arr = np.expand_dims(arr, 0)  # NCHW
    return np.ascontiguousarray(arr), ratio, pad


def _unletterbox_xyxy(
    xyxy: np.ndarray, ratio: float, pad: tuple[int, int], orig_hw: tuple[int, int]
) -> np.ndarray:
    """Map boxes from 640x640 letterboxed space back to the original image."""
    pad_x, pad_y = pad
    out = xyxy.copy().astype(np.float32)
    out[:, [0, 2]] -= pad_x
    out[:, [1, 3]] -= pad_y
    out /= ratio
    h, w = orig_hw
    out[:, [0, 2]] = np.clip(out[:, [0, 2]], 0, w - 1)
    out[:, [1, 3]] = np.clip(out[:, [1, 3]], 0, h - 1)
    return out


_PALETTE: tuple[tuple[int, int, int], ...] = (
    (56, 56, 255),
    (151, 157, 255),
    (31, 112, 255),
    (29, 178, 255),
    (49, 210, 207),
    (10, 249, 72),
    (23, 204, 146),
    (134, 219, 61),
    (52, 147, 26),
    (187, 212, 0),
    (168, 153, 44),
    (255, 194, 0),
    (147, 69, 52),
    (255, 115, 100),
    (236, 24, 0),
    (255, 56, 132),
    (133, 0, 82),
    (255, 56, 203),
    (200, 149, 255),
    (199, 55, 255),
)


def _draw_detections(bgr: np.ndarray, detections: list[dict[str, Any]]) -> np.ndarray:
    out = bgr.copy()
    for d in detections:
        x1, y1, x2, y2 = (int(round(v)) for v in d["bbox"])
        color = _PALETTE[int(d.get("class_id", 0)) % len(_PALETTE)]
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2, lineType=cv2.LINE_AA)
        label = f"{d['label']} {d['confidence']:.2f}"
        (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        ty1 = max(0, y1 - th - baseline - 2)
        cv2.rectangle(out, (x1, ty1), (x1 + tw + 2, ty1 + th + baseline + 2), color, -1)
        cv2.putText(
            out,
            label,
            (x1 + 1, ty1 + th + 1),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
    return out


def yolo26_detect_step(bgr: np.ndarray, params: dict) -> tuple[np.ndarray, list[dict[str, Any]]]:
    """Run inference; returns (possibly annotated BGR image, detection list)."""
    session = _get_session()
    input_name = _input_name or "images"

    conf_thr = float(params["conf"])
    max_det = int(params["max_det"])
    draw = bool(params["draw"])
    class_filter = params.get("classes")

    orig_h, orig_w = bgr.shape[:2]
    tensor, ratio, pad = _preprocess(bgr)

    outputs = session.run(None, {input_name: tensor})
    raw = np.asarray(outputs[0])
    # Accept either (1, N, 6) or (N, 6).
    if raw.ndim == 3:
        raw = raw[0]
    if raw.size == 0 or raw.shape[-1] < 6:
        return (bgr.copy(), [])

    xyxy = raw[:, :4]
    scores = raw[:, 4]
    cls_ids = raw[:, 5].astype(np.int64)

    keep = scores >= conf_thr
    if class_filter is not None and len(class_filter) > 0:
        allowed = np.isin(cls_ids, np.asarray(class_filter, dtype=np.int64))
        keep &= allowed
    xyxy = xyxy[keep]
    scores = scores[keep]
    cls_ids = cls_ids[keep]

    if scores.size > max_det:
        order = np.argsort(-scores)[:max_det]
        xyxy = xyxy[order]
        scores = scores[order]
        cls_ids = cls_ids[order]

    if xyxy.size == 0:
        return (bgr.copy(), [])

    xyxy = _unletterbox_xyxy(xyxy, ratio, pad, (orig_h, orig_w))

    detections: list[dict[str, Any]] = []
    for box, score, cid in zip(xyxy, scores, cls_ids, strict=False):
        cid_int = int(cid)
        if 0 <= cid_int < len(COCO80_NAMES):
            label = COCO80_NAMES[cid_int]
        else:
            label = str(cid_int)
        detections.append(
            {
                "label": label,
                "confidence": float(score),
                "bbox": [float(box[0]), float(box[1]), float(box[2]), float(box[3])],
                "class_id": cid_int,
            }
        )

    if draw:
        return _draw_detections(bgr, detections), detections
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
            "COCO object detection (YOLO26n via ONNX Runtime). "
            "Uses the image after the steps above this one."
        ),
        "default_params": {"conf": 0.25, "classes": [], "max_det": 100, "draw": True},
        "apply": apply_yolo26_detect,
        "validate_params": validate_yolo26_params,
        "output_kind": "spatial",
        "detail_doc": (
            "YOLO26n trained on COCO (~80 classes), exported to ONNX with built-in NMS and run "
            "via onnxruntime (no PyTorch on the server). This step sees whatever BGR image the "
            "pipeline has produced so far — put preprocessing **above** this step to detect on "
            "denoised, resized, or enhanced images. Bboxes are in pixel coords for that frame. "
            "AGPL-3.0 applies to Ultralytics weights; confirm licensing for your use case."
        ),
    },
]
