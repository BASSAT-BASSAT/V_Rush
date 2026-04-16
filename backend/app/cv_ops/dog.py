"""Difference of Gaussians (DoG) — band-pass emphasis by subtracting two Gaussian blurs."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float


def _to_bgr_mag(mag: np.ndarray) -> np.ndarray:
    mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.cvtColor(mag, cv2.COLOR_GRAY2BGR)


def apply_dog(bgr: np.ndarray, params: dict) -> np.ndarray:
    sigma1 = clamp_float(params.get("sigma1", 1.0), 0.1, 10.0)
    sigma2 = clamp_float(params.get("sigma2", 2.0), 0.1, 10.0)
    if sigma2 <= sigma1:
        sigma2 = sigma1 + 0.1
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g1 = cv2.GaussianBlur(gray, (0, 0), sigmaX=sigma1, sigmaY=sigma1)
    g2 = cv2.GaussianBlur(gray, (0, 0), sigmaX=sigma2, sigmaY=sigma2)
    dog = np.abs(g2 - g1)
    return _to_bgr_mag(dog)


def validate_dog(p: dict) -> dict:
    s1 = clamp_float(p.get("sigma1", 1.0), 0.1, 10.0)
    s2 = clamp_float(p.get("sigma2", 2.0), 0.1, 10.0)
    if s2 <= s1:
        s2 = min(10.0, s1 + 0.1)
    return {"sigma1": s1, "sigma2": s2}


DOG_SPECS: list[dict] = [
    {
        "id": "dog",
        "label": "Difference of Gaussians (DoG)",
        "category": "edges",
        "description": "|G(σ₂) − G(σ₁)| on luminance; band-pass at intermediate scales.",
        "default_params": {"sigma1": 1.0, "sigma2": 2.0},
        "apply": apply_dog,
        "validate_params": validate_dog,
    },
]
