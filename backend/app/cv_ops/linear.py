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


def _edge_mask_u8(bgr: np.ndarray, params: dict) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    source = str(params.get("edge_source", "sobel")).lower()
    if source == "laplacian":
        lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
        edge = cv2.convertScaleAbs(lap)
    elif source == "canny":
        t1 = clamp_int(params.get("canny_t1", 50), 1, 254)
        t2 = clamp_int(params.get("canny_t2", 150), 2, 255)
        t2 = max(t2, t1 + 1)
        edge = cv2.Canny(gray, t1, t2)
    else:
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        mag = cv2.magnitude(gx, gy)
        edge = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return edge


def apply_unsharp_mask(bgr: np.ndarray, params: dict) -> np.ndarray:
    mode = str(params.get("mode", "additive")).lower()
    amount = clamp_float(params.get("amount", 1.0), 0.0, 5.0)
    if mode not in {"additive", "multiplicative"}:
        mode = "additive"
    edge = _edge_mask_u8(bgr, params)
    edge_bgr = cv2.cvtColor(edge, cv2.COLOR_GRAY2BGR).astype(np.float32)
    src = bgr.astype(np.float32)
    if mode == "multiplicative":
        gain = 1.0 + amount * (edge_bgr / 255.0)
        out = src * gain
    else:
        out = src + amount * edge_bgr
    return np.clip(out, 0, 255).astype(np.uint8)


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
        "description": "Sharpen original image using an edge mask blend.",
        "default_params": {"mode": "additive", "amount": 1.0, "edge_source": "sobel"},
        "apply": apply_unsharp_mask,
        "validate_params": lambda p: {
            "mode": (
                str(p.get("mode", "additive")).lower()
                if str(p.get("mode", "additive")).lower() in {"additive", "multiplicative"}
                else "additive"
            ),
            "amount": clamp_float(p.get("amount", 1.0), 0.0, 5.0),
            "edge_source": (
                str(p.get("edge_source", "sobel")).lower()
                if str(p.get("edge_source", "sobel")).lower() in {"sobel", "laplacian", "canny"}
                else "sobel"
            ),
            "canny_t1": clamp_int(p.get("canny_t1", 50), 1, 254),
            "canny_t2": clamp_int(p.get("canny_t2", 150), 2, 255),
        },
    },
]
