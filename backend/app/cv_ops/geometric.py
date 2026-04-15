"""Geometric transforms."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float, clamp_int


def apply_resize(bgr: np.ndarray, params: dict) -> np.ndarray:
    mode = str(params.get("mode", "scale"))
    if mode == "absolute":
        w = clamp_int(params.get("width", 320), 1, 8192)
        h = clamp_int(params.get("height", 240), 1, 8192)
        return cv2.resize(bgr, (w, h), interpolation=cv2.INTER_AREA)
    scale = clamp_float(params.get("scale", 0.5), 0.05, 8.0)
    h, w = bgr.shape[:2]
    return cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def apply_rotate(bgr: np.ndarray, params: dict) -> np.ndarray:
    angle = float(params.get("angle_deg", 15))
    scale = clamp_float(params.get("scale", 1.0), 0.1, 4.0)
    h, w = bgr.shape[:2]
    center = (w / 2, h / 2)
    m = cv2.getRotationMatrix2D(center, angle, scale)
    return cv2.warpAffine(bgr, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def apply_pyr_down(bgr: np.ndarray, _params: dict) -> np.ndarray:
    return cv2.pyrDown(bgr)


def apply_pyr_up(bgr: np.ndarray, _params: dict) -> np.ndarray:
    return cv2.pyrUp(bgr)


def apply_crop_fraction(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Crop using fractional rect (0–1)."""
    x0 = clamp_float(params.get("x0", 0.0), 0.0, 1.0)
    y0 = clamp_float(params.get("y0", 0.0), 0.0, 1.0)
    x1 = clamp_float(params.get("x1", 1.0), 0.0, 1.0)
    y1 = clamp_float(params.get("y1", 1.0), 0.0, 1.0)
    h, w = bgr.shape[:2]
    xa, xb = int(x0 * w), int(x1 * w)
    ya, yb = int(y0 * h), int(y1 * h)
    if xb <= xa or yb <= ya:
        return bgr
    return bgr[ya:yb, xa:xb].copy()


def validate_resize(p: dict) -> dict:
    mode = str(p.get("mode", "scale"))
    if mode == "absolute":
        return {
            "mode": "absolute",
            "width": clamp_int(p.get("width", 320), 1, 8192),
            "height": clamp_int(p.get("height", 240), 1, 8192),
        }
    return {"mode": "scale", "scale": clamp_float(p.get("scale", 0.5), 0.05, 8.0)}


def validate_rotate(p: dict) -> dict:
    return {
        "angle_deg": float(p.get("angle_deg", 15)),
        "scale": clamp_float(p.get("scale", 1.0), 0.1, 4.0),
    }


def validate_crop(p: dict) -> dict:
    return {
        "x0": clamp_float(p.get("x0", 0.0), 0.0, 1.0),
        "y0": clamp_float(p.get("y0", 0.0), 0.0, 1.0),
        "x1": clamp_float(p.get("x1", 1.0), 0.0, 1.0),
        "y1": clamp_float(p.get("y1", 1.0), 0.0, 1.0),
    }


GEOMETRIC_SPECS: list[dict] = [
    {
        "id": "resize",
        "label": "Resize",
        "category": "geometric",
        "description": "Scale by factor or absolute width/height.",
        "default_params": {"mode": "scale", "scale": 0.5},
        "apply": apply_resize,
        "validate_params": validate_resize,
    },
    {
        "id": "rotate",
        "label": "Rotate",
        "category": "geometric",
        "description": "Rotate around center (reflect border).",
        "default_params": {"angle_deg": 15, "scale": 1.0},
        "apply": apply_rotate,
        "validate_params": validate_rotate,
    },
    {
        "id": "pyramid_down",
        "label": "Pyramid down",
        "category": "geometric",
        "description": "Gaussian pyramid reduce (½ size).",
        "default_params": {},
        "apply": apply_pyr_down,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "pyramid_up",
        "label": "Pyramid up",
        "category": "geometric",
        "description": "Gaussian pyramid expand (2× size).",
        "default_params": {},
        "apply": apply_pyr_up,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "crop_fraction",
        "label": "Crop (fractions)",
        "category": "geometric",
        "description": "Crop using normalized coordinates x0,y0,x1,y1 in [0,1].",
        "default_params": {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.9},
        "apply": apply_crop_fraction,
        "validate_params": validate_crop,
    },
]
