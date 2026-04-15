"""Color space and channel operations."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float


def apply_to_grayscale(bgr: np.ndarray, _params: dict) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def apply_bgr_to_hsv_and_back(bgr: np.ndarray, _params: dict) -> np.ndarray:
    """Round-trip through HSV (lossless enough for 8-bit)."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)


def apply_bgr_to_lab_and_back(bgr: np.ndarray, _params: dict) -> np.ndarray:
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def apply_bgr_to_ycrcb_and_back(bgr: np.ndarray, _params: dict) -> np.ndarray:
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)


def apply_channel_gains(bgr: np.ndarray, params: dict) -> np.ndarray:
    b_gain = clamp_float(params.get("b", 1.0), 0.0, 4.0)
    g_gain = clamp_float(params.get("g", 1.0), 0.0, 4.0)
    r_gain = clamp_float(params.get("r", 1.0), 0.0, 4.0)
    f = bgr.astype(np.float32)
    f[:, :, 0] *= b_gain
    f[:, :, 1] *= g_gain
    f[:, :, 2] *= r_gain
    return np.clip(f, 0, 255).astype(np.uint8)


def validate_gains(p: dict) -> dict:
    return {
        "b": clamp_float(p.get("b", 1.0), 0.0, 4.0),
        "g": clamp_float(p.get("g", 1.0), 0.0, 4.0),
        "r": clamp_float(p.get("r", 1.0), 0.0, 4.0),
    }


COLOR_SPECS: list[dict] = [
    {
        "id": "to_grayscale",
        "label": "Grayscale",
        "category": "color",
        "description": "Convert to grayscale and back to 3-channel for display.",
        "default_params": {},
        "apply": apply_to_grayscale,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "color_hsv_roundtrip",
        "label": "HSV round-trip",
        "category": "color",
        "description": "BGR → HSV → BGR (useful to verify color pipeline).",
        "default_params": {},
        "apply": apply_bgr_to_hsv_and_back,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "color_lab_roundtrip",
        "label": "LAB round-trip",
        "category": "color",
        "description": "BGR → LAB → BGR.",
        "default_params": {},
        "apply": apply_bgr_to_lab_and_back,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "color_ycrcb_roundtrip",
        "label": "YCrCb round-trip",
        "category": "color",
        "description": "BGR → YCrCb → BGR.",
        "default_params": {},
        "apply": apply_bgr_to_ycrcb_and_back,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "channel_gains",
        "label": "Channel gains (BGR)",
        "category": "color",
        "description": "Multiply B, G, R channels.",
        "default_params": {"b": 1.0, "g": 1.0, "r": 1.0},
        "apply": apply_channel_gains,
        "validate_params": validate_gains,
    },
]
