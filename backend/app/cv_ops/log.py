"""Laplacian of Gaussian (LoG) — blob / edge emphasis via Gaussian smoothing then Laplacian."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float, odd_kernel


def _to_bgr_mag(mag: np.ndarray) -> np.ndarray:
    mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.cvtColor(mag, cv2.COLOR_GRAY2BGR)


def apply_log(bgr: np.ndarray, params: dict) -> np.ndarray:
    sigma = clamp_float(params.get("sigma", 1.4), 0.1, 10.0)
    lap_k = odd_kernel(int(params.get("laplacian_ksize", 3)), 1, 7)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (0, 0), sigmaX=sigma, sigmaY=sigma)
    lap = cv2.Laplacian(blurred, cv2.CV_32F, ksize=lap_k)
    lap = np.abs(lap)
    return _to_bgr_mag(lap)


def validate_log(p: dict) -> dict:
    return {
        "sigma": clamp_float(p.get("sigma", 1.4), 0.1, 10.0),
        "laplacian_ksize": odd_kernel(int(p.get("laplacian_ksize", 3)), 1, 7),
    }


LOG_SPECS: list[dict] = [
    {
        "id": "log",
        "label": "Laplacian of Gaussian (LoG)",
        "category": "edges",
        "description": "Gaussian blur then Laplacian (abs); emphasizes blobs and edges at scale σ.",
        "default_params": {"sigma": 1.4, "laplacian_ksize": 3},
        "apply": apply_log,
        "validate_params": validate_log,
    },
]
