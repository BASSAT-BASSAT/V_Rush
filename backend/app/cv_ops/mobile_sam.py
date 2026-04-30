"""MobileSAM (Segment Anything, mobile-distilled) via ONNX Runtime.

Runs as two ONNX sessions:

* ``mobile_sam_encoder.onnx`` — tiny ViT image encoder, input ``(1,3,1024,1024) float32``,
  output ``image_embeddings (1,256,64,64) float32``.
* ``mobile_sam_decoder.onnx`` — prompt decoder. Inputs follow the ``SamOnnxModel`` export
  convention:

  * ``image_embeddings (1,256,64,64) float32``
  * ``point_coords (1, N, 2) float32`` — coords in the 1024×1024 input space.
  * ``point_labels (1, N) float32`` — 1=fg, 0=bg, 2=box top-left, 3=box bottom-right.
  * ``mask_input (1,1,256,256) float32`` — zeros.
  * ``has_mask_input (1,) float32`` — 0.0.
  * ``orig_im_size (2,) float32`` — ``[h, w]`` of the *original* image.

  Output is a single mask ``(1,1,H,W) float32`` (logits) because the export used
  ``return_single_mask=True``; the accompanying ``iou_predictions (1,1)`` is kept.

If either ONNX file is absent, running the op raises a clear error asking the user to
export the weights (one-time, instructions in the README).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol

import cv2
import numpy as np

from app.cv_ops._params import clamp_float, clamp_int

_MODEL_INPUT_SIZE = 1024
_ENCODER_FILENAME = "mobile_sam_encoder.onnx"
_DECODER_FILENAME = "mobile_sam_decoder.onnx"

# ImageNet-style normalization used by SAM/MobileSAM.
_PIXEL_MEAN = np.array([123.675, 116.28, 103.53], dtype=np.float32)
_PIXEL_STD = np.array([58.395, 57.12, 57.375], dtype=np.float32)


class _SessionLike(Protocol):
    def run(
        self, output_names: list[str] | None, feeds: dict[str, np.ndarray]
    ) -> list[np.ndarray]: ...


_enc_session: _SessionLike | None = None
_dec_session: _SessionLike | None = None
_enc_input_name: str | None = None


def _resolve(name: str) -> Path:
    """Look for a weight file relative to ``backend/`` (works on Vercel/Docker/local)."""
    here = Path(__file__).resolve()
    # app/cv_ops/mobile_sam.py -> app/cv_ops -> app -> backend
    backend_dir = here.parent.parent.parent
    candidates = [
        backend_dir / name,
        Path.cwd() / name,
        backend_dir.parent / name,
    ]
    for c in candidates:
        if c.is_file():
            return c
    return candidates[0]


def _get_sessions() -> tuple[_SessionLike, _SessionLike]:
    global _enc_session, _dec_session, _enc_input_name
    if _enc_session is not None and _dec_session is not None:
        return _enc_session, _dec_session

    try:
        import onnxruntime as ort
    except ImportError as e:
        raise RuntimeError(
            "The onnxruntime package is not installed on this server. "
            "Install backend dependencies (e.g. pip install -e backend or uv sync in backend/)."
        ) from e

    enc_path = _resolve(_ENCODER_FILENAME)
    dec_path = _resolve(_DECODER_FILENAME)
    missing = [p for p in (enc_path, dec_path) if not p.is_file()]
    if missing:
        raise RuntimeError(
            "MobileSAM ONNX weights not found: "
            + ", ".join(str(m) for m in missing)
            + ". Export once locally (see README section 'MobileSAM export') "
            "and commit backend/mobile_sam_encoder.onnx + backend/mobile_sam_decoder.onnx."
        )

    enc = ort.InferenceSession(str(enc_path), providers=["CPUExecutionProvider"])
    dec = ort.InferenceSession(str(dec_path), providers=["CPUExecutionProvider"])
    _enc_session = enc
    _dec_session = dec
    _enc_input_name = enc.get_inputs()[0].name
    return enc, dec


def set_model_for_testing(
    sessions: tuple[_SessionLike, _SessionLike] | None,
    encoder_input_name: str = "image",
) -> None:
    """Replace or clear cached encoder/decoder sessions (tests only)."""
    global _enc_session, _dec_session, _enc_input_name
    if sessions is None:
        _enc_session = None
        _dec_session = None
        _enc_input_name = None
    else:
        _enc_session, _dec_session = sessions
        _enc_input_name = encoder_input_name


# ---- params ----


_VALID_PROMPTS = {"point", "box"}
_VALID_OUTPUTS = {"overlay", "cutout", "mask"}


def validate_mobile_sam_params(p: dict) -> dict:
    prompt_type = str(p.get("prompt_type", "point")).lower()
    if prompt_type not in _VALID_PROMPTS:
        raise ValueError(f"prompt_type must be one of {sorted(_VALID_PROMPTS)}")

    output = str(p.get("output", "overlay")).lower()
    if output not in _VALID_OUTPUTS:
        raise ValueError(f"output must be one of {sorted(_VALID_OUTPUTS)}")

    out = {
        "prompt_type": prompt_type,
        "output": output,
        "point_x_frac": clamp_float(p.get("point_x_frac", 0.5), 0.0, 1.0),
        "point_y_frac": clamp_float(p.get("point_y_frac", 0.5), 0.0, 1.0),
        "point_label": clamp_int(p.get("point_label", 1), 0, 1),
        "box_x1_frac": clamp_float(p.get("box_x1_frac", 0.2), 0.0, 1.0),
        "box_y1_frac": clamp_float(p.get("box_y1_frac", 0.2), 0.0, 1.0),
        "box_x2_frac": clamp_float(p.get("box_x2_frac", 0.8), 0.0, 1.0),
        "box_y2_frac": clamp_float(p.get("box_y2_frac", 0.8), 0.0, 1.0),
    }
    if out["box_x2_frac"] <= out["box_x1_frac"]:
        out["box_x2_frac"] = min(1.0, out["box_x1_frac"] + 0.05)
    if out["box_y2_frac"] <= out["box_y1_frac"]:
        out["box_y2_frac"] = min(1.0, out["box_y1_frac"] + 0.05)
    return out


# ---- preprocessing ----


def _preprocess_sam(bgr: np.ndarray) -> tuple[np.ndarray, float, tuple[int, int]]:
    """Scale longest side to 1024, right/bottom-pad with 0, normalize, NCHW float32."""
    h, w = bgr.shape[:2]
    ratio = _MODEL_INPUT_SIZE / max(h, w)
    new_w = int(round(w * ratio))
    new_h = int(round(h * ratio))
    resized = cv2.resize(bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32)
    rgb = (rgb - _PIXEL_MEAN) / _PIXEL_STD

    canvas = np.zeros((_MODEL_INPUT_SIZE, _MODEL_INPUT_SIZE, 3), dtype=np.float32)
    canvas[:new_h, :new_w, :] = rgb
    arr = np.transpose(canvas, (2, 0, 1))  # HWC -> CHW
    arr = np.expand_dims(arr, 0).astype(np.float32)  # NCHW
    return np.ascontiguousarray(arr), ratio, (new_w, new_h)


def _build_prompt(
    params: dict, orig_hw: tuple[int, int], scale: float
) -> tuple[np.ndarray, np.ndarray]:
    """Returns ``(point_coords, point_labels)`` in 1024×1024 input coords.

    * point: shape (1,1,2) + labels (1,1)
    * box: shape (1,2,2) + labels (1,2) = [2,3]
    """
    h, w = orig_hw
    if params["prompt_type"] == "point":
        x = float(params["point_x_frac"]) * w * scale
        y = float(params["point_y_frac"]) * h * scale
        coords = np.array([[[x, y]]], dtype=np.float32)
        labels = np.array([[int(params["point_label"])]], dtype=np.float32)
        return coords, labels

    x1 = float(params["box_x1_frac"]) * w * scale
    y1 = float(params["box_y1_frac"]) * h * scale
    x2 = float(params["box_x2_frac"]) * w * scale
    y2 = float(params["box_y2_frac"]) * h * scale
    coords = np.array([[[x1, y1], [x2, y2]]], dtype=np.float32)
    labels = np.array([[2.0, 3.0]], dtype=np.float32)
    return coords, labels


# ---- output rendering ----


_MASK_COLOR_BGR = np.array([255, 80, 200], dtype=np.uint8)  # magenta-ish


def _render_output(bgr: np.ndarray, mask: np.ndarray, mode: str) -> np.ndarray:
    """``mask`` is a (H, W) uint8 0/255 binary mask at the original image resolution."""
    if mode == "mask":
        mono = mask.copy()
        return cv2.cvtColor(mono, cv2.COLOR_GRAY2BGR)

    if mode == "cutout":
        cutout = bgr.copy()
        cutout[mask == 0] = 0
        return cutout

    # overlay (default)
    overlay = bgr.copy()
    color_layer = np.zeros_like(bgr)
    color_layer[mask > 0] = _MASK_COLOR_BGR
    overlay = cv2.addWeighted(overlay, 1.0, color_layer, 0.45, 0)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, contours, -1, (255, 255, 255), 2, lineType=cv2.LINE_AA)
    return overlay


def _mask_bbox(mask: np.ndarray) -> list[float]:
    ys, xs = np.where(mask > 0)
    if ys.size == 0:
        return [0.0, 0.0, 0.0, 0.0]
    return [float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())]


# ---- main entry points ----


def mobile_sam_segment_step(
    bgr: np.ndarray, params: dict
) -> tuple[np.ndarray, list[dict[str, Any]], np.ndarray]:
    """Run MobileSAM encoder+decoder; returns (rendered BGR, detections-like, binary mask uint8 H×W)."""
    enc_sess, dec_sess = _get_sessions()
    enc_input = _enc_input_name or "image"

    orig_h, orig_w = bgr.shape[:2]
    tensor, scale, _ = _preprocess_sam(bgr)

    embedding = enc_sess.run(None, {enc_input: tensor})[0]
    point_coords, point_labels = _build_prompt(params, (orig_h, orig_w), scale)

    dec_feeds: dict[str, np.ndarray] = {
        "image_embeddings": embedding.astype(np.float32),
        "point_coords": point_coords,
        "point_labels": point_labels,
        "mask_input": np.zeros((1, 1, 256, 256), dtype=np.float32),
        "has_mask_input": np.zeros((1,), dtype=np.float32),
        "orig_im_size": np.array([orig_h, orig_w], dtype=np.float32),
    }

    dec_outputs = dec_sess.run(None, dec_feeds)
    mask_logits = np.asarray(dec_outputs[0])
    iou_pred = float(np.asarray(dec_outputs[1]).flatten()[0]) if len(dec_outputs) > 1 else 0.0

    # Squeeze to 2D (H, W) at original image size.
    while mask_logits.ndim > 2:
        mask_logits = mask_logits[0]
    if mask_logits.shape[:2] != (orig_h, orig_w):
        mask_logits = cv2.resize(
            mask_logits.astype(np.float32), (orig_w, orig_h), interpolation=cv2.INTER_LINEAR
        )
    mask_u8 = (mask_logits > 0.0).astype(np.uint8) * 255

    rendered = _render_output(bgr, mask_u8, params["output"])

    area_px = int((mask_u8 > 0).sum())
    detection = {
        "label": "sam-mask",
        "confidence": max(0.0, min(1.0, iou_pred)),
        "bbox": _mask_bbox(mask_u8),
        "class_id": -1,
        "area_px": area_px,
    }
    return rendered, [detection], mask_u8


def apply_mobile_sam(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Registry ``apply``: image only (detections merged by executor)."""
    img, _, _ = mobile_sam_segment_step(bgr, params)
    return img


MOBILE_SAM_SPECS: list[dict] = [
    {
        "id": "mobile_sam",
        "label": "MobileSAM segment",
        "category": "segmentation",
        "description": (
            "Segment-Anything mask from a point or box prompt (MobileSAM via ONNX Runtime). "
            "Click the image in the studio to drop a foreground point."
        ),
        "default_params": {
            "prompt_type": "point",
            "point_x_frac": 0.5,
            "point_y_frac": 0.5,
            "point_label": 1,
            "box_x1_frac": 0.2,
            "box_y1_frac": 0.2,
            "box_x2_frac": 0.8,
            "box_y2_frac": 0.8,
            "output": "overlay",
        },
        "apply": apply_mobile_sam,
        "validate_params": validate_mobile_sam_params,
        "output_kind": "spatial",
        "detail_doc": (
            "MobileSAM (Zhang et al. 2023) is a distilled Segment Anything model with a ~5M "
            "parameter ViT encoder — small enough to bundle in a Vercel Python Function. Given "
            "either a foreground point (+ optional background points) or a bounding box, it "
            "produces a single binary mask over the input image. We render the mask as an "
            "overlay, a cutout, or a plain black/white image. Licensing: MobileSAM weights are "
            "Apache 2.0."
        ),
    },
]
