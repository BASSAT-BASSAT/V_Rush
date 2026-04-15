"""Linear and edge-preserving smoothing + sharpening."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float, clamp_int, odd_kernel


def apply_gaussian_blur(bgr: np.ndarray, params: dict) -> np.ndarray:
    k = odd_kernel(int(params.get("ksize", 5)))
    sigma = float(params.get("sigma", 0))
    return cv2.GaussianBlur(bgr, (k, k), sigmaX=sigma)


def apply_box_blur(bgr: np.ndarray, params: dict) -> np.ndarray:
    k = odd_kernel(int(params.get("ksize", 5)))
    return cv2.blur(bgr, (k, k))


def apply_median_blur(bgr: np.ndarray, params: dict) -> np.ndarray:
    k = odd_kernel(int(params.get("ksize", 5)), 3, 11)
    return cv2.medianBlur(bgr, k)


def apply_bilateral(bgr: np.ndarray, params: dict) -> np.ndarray:
    d = clamp_int(params.get("d", 9), 1, 25)
    sc = clamp_float(params.get("sigma_color", 75), 1, 200)
    ss = clamp_float(params.get("sigma_space", 75), 1, 200)
    return cv2.bilateralFilter(bgr, d, sc, ss)


def apply_unsharp_mask(bgr: np.ndarray, params: dict) -> np.ndarray:
    sigma = clamp_float(params.get("sigma", 1.0), 0.1, 10.0)
    amount = clamp_float(params.get("amount", 1.0), 0.0, 5.0)
    blurred = cv2.GaussianBlur(bgr, (0, 0), sigmaX=sigma)
    return cv2.addWeighted(bgr, 1.0 + amount, blurred, -amount, 0)


LINEAR_SPECS: list[dict] = [
    {
        "id": "gaussian_blur",
        "label": "Gaussian blur",
        "category": "linear",
        "description": "Gaussian low-pass filter.",
        "default_params": {"ksize": 5, "sigma": 0},
        "apply": apply_gaussian_blur,
        "validate_params": lambda p: {
            "ksize": odd_kernel(int(p.get("ksize", 5))),
            "sigma": float(p.get("sigma", 0)),
        },
    },
    {
        "id": "box_blur",
        "label": "Box blur",
        "category": "linear",
        "description": "Normalized box filter.",
        "default_params": {"ksize": 5},
        "apply": apply_box_blur,
        "validate_params": lambda p: {"ksize": odd_kernel(int(p.get("ksize", 5)))},
    },
    {
        "id": "median_blur",
        "label": "Median blur",
        "category": "linear",
        "description": "Median filter (salt-and-pepper reduction).",
        "default_params": {"ksize": 5},
        "apply": apply_median_blur,
        "validate_params": lambda p: {"ksize": odd_kernel(int(p.get("ksize", 5)), 3, 11)},
    },
    {
        "id": "bilateral_filter",
        "label": "Bilateral filter",
        "category": "linear",
        "description": "Edge-preserving smoothing.",
        "default_params": {"d": 9, "sigma_color": 75, "sigma_space": 75},
        "apply": apply_bilateral,
        "validate_params": lambda p: {
            "d": clamp_int(p.get("d", 9), 1, 25),
            "sigma_color": clamp_float(p.get("sigma_color", 75), 1, 200),
            "sigma_space": clamp_float(p.get("sigma_space", 75), 1, 200),
        },
    },
    {
        "id": "unsharp_mask",
        "label": "Unsharp mask",
        "category": "linear",
        "description": "Sharpen via Gaussian unsharp mask.",
        "default_params": {"sigma": 1.0, "amount": 1.0},
        "apply": apply_unsharp_mask,
        "validate_params": lambda p: {
            "sigma": clamp_float(p.get("sigma", 1.0), 0.1, 10.0),
            "amount": clamp_float(p.get("amount", 1.0), 0.0, 5.0),
        },
    },
]
