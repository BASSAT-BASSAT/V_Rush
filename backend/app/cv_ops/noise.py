"""Synthetic noise (for testing denoisers)."""

from __future__ import annotations

import numpy as np

from app.cv_ops._params import clamp_float


def apply_gaussian_noise(bgr: np.ndarray, params: dict) -> np.ndarray:
    sigma = clamp_float(params.get("sigma", 15), 0.0, 100.0)
    noise = np.random.default_rng().normal(0, sigma, bgr.shape).astype(np.float32)
    out = bgr.astype(np.float32) + noise
    return np.clip(out, 0, 255).astype(np.uint8)


def apply_salt_pepper(bgr: np.ndarray, params: dict) -> np.ndarray:
    ratio = clamp_float(params.get("ratio", 0.02), 0.0, 0.5)
    out = bgr.copy()
    rng = np.random.default_rng()
    rnd = rng.random(bgr.shape[:2])
    salt = rnd < ratio / 2
    pepper = rnd >= 1.0 - ratio / 2
    out[salt] = 255
    out[pepper] = 0
    return out


NOISE_SPECS: list[dict] = [
    {
        "id": "add_gaussian_noise",
        "label": "Add Gaussian noise",
        "category": "noise",
        "description": "Additive Gaussian noise (testing).",
        "default_params": {"sigma": 15},
        "apply": apply_gaussian_noise,
        "validate_params": lambda p: {"sigma": clamp_float(p.get("sigma", 15), 0.0, 100.0)},
    },
    {
        "id": "add_salt_pepper",
        "label": "Salt & pepper",
        "category": "noise",
        "description": "Random salt and pepper noise.",
        "default_params": {"ratio": 0.02},
        "apply": apply_salt_pepper,
        "validate_params": lambda p: {"ratio": clamp_float(p.get("ratio", 0.02), 0.0, 0.5)},
    },
]
