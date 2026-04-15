"""Gradient and edge detectors."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_int


def _to_bgr_mag(mag: np.ndarray) -> np.ndarray:
    mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.cvtColor(mag, cv2.COLOR_GRAY2BGR)


def apply_sobel_magnitude(bgr: np.ndarray, params: dict) -> np.ndarray:
    k = clamp_int(params.get("ksize", 3), 1, 7)
    if k % 2 == 0:
        k += 1
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=k)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=k)
    mag = cv2.magnitude(gx, gy)
    return _to_bgr_mag(mag)


def apply_scharr_magnitude(bgr: np.ndarray, _params: dict) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gx = cv2.Scharr(gray, cv2.CV_32F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_32F, 0, 1)
    mag = cv2.magnitude(gx, gy)
    return _to_bgr_mag(mag)


def apply_laplacian(bgr: np.ndarray, params: dict) -> np.ndarray:
    k = clamp_int(params.get("ksize", 3), 1, 7)
    if k % 2 == 0:
        k += 1
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=k)
    lap = np.abs(lap)
    return _to_bgr_mag(lap)


def apply_canny(bgr: np.ndarray, params: dict) -> np.ndarray:
    t1 = clamp_int(params.get("threshold1", 50), 0, 255)
    t2 = clamp_int(params.get("threshold2", 150), 0, 255)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, t1, t2)
    return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)


EDGES_SPECS: list[dict] = [
    {
        "id": "sobel_magnitude",
        "label": "Sobel gradient magnitude",
        "category": "edges",
        "description": "Gradient magnitude from Sobel.",
        "default_params": {"ksize": 3},
        "apply": apply_sobel_magnitude,
        "validate_params": lambda p: {"ksize": clamp_int(p.get("ksize", 3), 1, 7) | 1},
    },
    {
        "id": "scharr_magnitude",
        "label": "Scharr gradient magnitude",
        "category": "edges",
        "description": "More accurate 3×3 derivatives.",
        "default_params": {},
        "apply": apply_scharr_magnitude,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "laplacian",
        "label": "Laplacian",
        "category": "edges",
        "description": "2nd derivative (abs shown).",
        "default_params": {"ksize": 3},
        "apply": apply_laplacian,
        "validate_params": lambda p: {"ksize": clamp_int(p.get("ksize", 3), 1, 7) | 1},
    },
    {
        "id": "canny",
        "label": "Canny edges",
        "category": "edges",
        "description": "Canny edge detector.",
        "default_params": {"threshold1": 50, "threshold2": 150},
        "apply": apply_canny,
        "validate_params": lambda p: {
            "threshold1": clamp_int(p.get("threshold1", 50), 0, 255),
            "threshold2": clamp_int(p.get("threshold2", 150), 0, 255),
        },
    },
]
