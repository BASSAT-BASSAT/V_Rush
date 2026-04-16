"""Mathematical morphology."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import odd_kernel

MORPH_NAMES = {
    "erode": cv2.MORPH_ERODE,
    "dilate": cv2.MORPH_DILATE,
    "open": cv2.MORPH_OPEN,
    "close": cv2.MORPH_CLOSE,
    "gradient": cv2.MORPH_GRADIENT,
    "tophat": cv2.MORPH_TOPHAT,
    "blackhat": cv2.MORPH_BLACKHAT,
}


def _get_kernel(params: dict) -> np.ndarray:
    k = odd_kernel(int(params.get("ksize", 5)), 3, 31)
    shape = str(params.get("kernel_shape", "rect"))
    if shape == "ellipse":
        return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    if shape == "cross":
        return cv2.getStructuringElement(cv2.MORPH_CROSS, (k, k))
    return cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))


def apply_morph(bgr: np.ndarray, params: dict, op_name: str) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    kernel = _get_kernel(params)
    op = MORPH_NAMES[op_name]
    out = cv2.morphologyEx(gray, op, kernel)
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def validate_morph(p: dict) -> dict:
    return {
        "ksize": odd_kernel(int(p.get("ksize", 5)), 3, 31),
        "kernel_shape": str(p.get("kernel_shape", "rect")),
    }


def make_morph_spec(op_name: str, label: str, desc: str) -> dict:
    return {
        "id": f"morph_{op_name}",
        "label": label,
        "category": "morphology",
        "description": desc,
        "default_params": {"ksize": 5, "kernel_shape": "rect"},
        "apply": lambda img, par, n=op_name: apply_morph(img, par, n),
        "validate_params": validate_morph,
    }


MORPH_SPECS: list[dict] = [
    make_morph_spec("erode", "Erode", "Erosion (min filter)."),
    make_morph_spec("dilate", "Dilate", "Dilation (max filter)."),
    make_morph_spec("open", "Open", "Opening (remove small bright spots)."),
    make_morph_spec("close", "Close", "Closing (fill small dark holes)."),
    make_morph_spec("gradient", "Morph gradient", "Difference dilate−erode."),
]
