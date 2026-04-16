"""Local Binary Patterns (LBP) — local texture coding from neighbor comparisons."""

from __future__ import annotations

import cv2
import numpy as np


def _lbp8(gray: np.ndarray) -> np.ndarray:
    """8-neighbor LBP (3×3), neighbors ordered clockwise from top-left."""
    padded = np.pad(gray.astype(np.int16), 1, mode="edge")
    c = padded[1:-1, 1:-1]
    bits = [
        padded[0:-2, 0:-2] >= c,
        padded[0:-2, 1:-1] >= c,
        padded[0:-2, 2:] >= c,
        padded[1:-1, 2:] >= c,
        padded[2:, 2:] >= c,
        padded[2:, 1:-1] >= c,
        padded[2:, 0:-2] >= c,
        padded[1:-1, 0:-2] >= c,
    ]
    code = np.zeros_like(c, dtype=np.uint8)
    for i, b in enumerate(bits):
        code |= b.astype(np.uint8) << i
    return code


def apply_lbp(bgr: np.ndarray, _params: dict) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    lbp = _lbp8(gray)
    return cv2.cvtColor(lbp, cv2.COLOR_GRAY2BGR)


def validate_lbp(p: dict) -> dict:
    return dict(p)


LBP_SPECS: list[dict] = [
    {
        "id": "lbp",
        "label": "Local Binary Patterns (LBP)",
        "category": "texture",
        "description": (
            "8-bit LBP per pixel (3×3 neighborhood, clockwise from top-left)."
        ),
        "default_params": {},
        "apply": apply_lbp,
        "validate_params": validate_lbp,
    },
]
