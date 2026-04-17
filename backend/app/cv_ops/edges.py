# -*- coding: utf-8 -*-
from __future__ import annotations

"""Gradient and edge detectors."""

import cv2
import numpy as np

from app.cv_ops._params import clamp_int


# =========================
# COMMON UTIL
# =========================

def _to_bgr_mag(mag: np.ndarray) -> np.ndarray:
    mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.cvtColor(mag, cv2.COLOR_GRAY2BGR)


# =========================
# GRADIENT-BASED EDGES
# =========================

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
    return _to_bgr_mag(np.abs(lap))


def apply_canny(bgr: np.ndarray, params: dict) -> np.ndarray:
    t1 = clamp_int(params.get("threshold1", 50), 0, 255)
    t2 = clamp_int(params.get("threshold2", 150), 0, 255)

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, t1, t2)

    return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)


# =========================
# CLASSIC EDGE OPERATORS
# =========================

def apply_prewitt(bgr: np.ndarray, params: dict) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    kx = np.array([[1, 1, 1],
                   [0, 0, 0],
                   [-1, -1, -1]], dtype=np.float32)

    ky = np.array([[-1, 0, 1],
                   [-1, 0, 1],
                   [-1, 0, 1]], dtype=np.float32)

    px = cv2.filter2D(gray, cv2.CV_32F, kx)
    py = cv2.filter2D(gray, cv2.CV_32F, ky)

    mag = np.sqrt(px**2 + py**2)
    return _to_bgr_mag(mag)


def apply_roberts(bgr: np.ndarray, params: dict) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    kx = np.array([[1, 0],
                   [0, -1]], dtype=np.float32)

    ky = np.array([[0, 1],
                   [-1, 0]], dtype=np.float32)

    rx = cv2.filter2D(gray, cv2.CV_32F, kx)
    ry = cv2.filter2D(gray, cv2.CV_32F, ky)

    mag = np.sqrt(rx**2 + ry**2)
    return _to_bgr_mag(mag)


def apply_directional_gradient(bgr: np.ndarray, params: dict) -> np.ndarray:
    direction = str(params.get("axis", "x")).lower()
    ksize = clamp_int(params.get("ksize", 3), 1, 7)

    if ksize % 2 == 0:
        ksize += 1

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    if direction == "y":
        grad = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=ksize)
    else:
        grad = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=ksize)

    return _to_bgr_mag(np.abs(grad))


# =========================
# VALIDATION
# =========================

def validate_sobel(p: dict) -> dict:
    return {"ksize": clamp_int(p.get("ksize", 3), 1, 7) | 1}


def validate_canny(p: dict) -> dict:
    return {
        "threshold1": clamp_int(p.get("threshold1", 50), 0, 255),
        "threshold2": clamp_int(p.get("threshold2", 150), 0, 255),
    }


def validate_directional(p: dict) -> dict:
    return {
        "axis": str(p.get("axis", "x")),
        "ksize": clamp_int(p.get("ksize", 3), 1, 7) | 1,
    }


# =========================
# REGISTRY (SPECS)
# =========================

EDGES_SPECS: list[dict] = [
    {
        "id": "sobel_magnitude",
        "label": "Sobel Gradient Magnitude",
        "category": "edges",
        "description": "Computes gradient magnitude using Sobel filters.",
        "default_params": {"ksize": 3},
        "apply": apply_sobel_magnitude,
        "validate_params": validate_sobel,
    },
    {
        "id": "scharr_magnitude",
        "label": "Scharr Gradient Magnitude",
        "category": "edges",
        "description": "High-precision 3x3 gradient operator.",
        "default_params": {},
        "apply": apply_scharr_magnitude,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "laplacian",
        "label": "Laplacian",
        "category": "edges",
        "description": "Second-order derivative edge detector.",
        "default_params": {"ksize": 3},
        "apply": apply_laplacian,
        "validate_params": validate_sobel,
    },
    {
        "id": "canny",
        "label": "Canny Edge Detector",
        "category": "edges",
        "description": "Multi-stage optimal edge detection.",
        "default_params": {"threshold1": 50, "threshold2": 150},
        "apply": apply_canny,
        "validate_params": validate_canny,
    },
    {
        "id": "prewitt",
        "label": "Prewitt Operator",
        "category": "edges",
        "description": "Simple gradient-based edge detector using averaging kernels.",
        "default_params": {},
        "apply": apply_prewitt,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "roberts",
        "label": "Roberts Cross",
        "category": "edges",
        "description": "Fast 2x2 edge detector for sharp transitions.",
        "default_params": {},
        "apply": apply_roberts,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "directional_gradient",
        "label": "Directional Gradient",
        "category": "edges",
        "description": "Extracts only horizontal or vertical edges.",
        "default_params": {"axis": "x", "ksize": 3},
        "apply": apply_directional_gradient,
        "validate_params": validate_directional,
    },
]