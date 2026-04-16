"""Intensity and histogram operations."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float, clamp_int, odd_kernel


def apply_normalize_minmax(bgr: np.ndarray, params: dict) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    out = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def apply_equalize_hist(bgr: np.ndarray, _params: dict) -> np.ndarray:
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycrcb)
    y2 = cv2.equalizeHist(y)
    merged = cv2.merge((y2, cr, cb))
    return cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)


def apply_clahe(bgr: np.ndarray, params: dict) -> np.ndarray:
    clip = clamp_float(params.get("clip_limit", 2.0), 0.1, 40.0)
    gs = clamp_int(params.get("tile_grid_size", 8), 2, 32)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    lab_l, a, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(gs, gs))
    l2 = clahe.apply(lab_l)
    merged = cv2.merge((l2, a, b_ch))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def apply_gamma(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Apply V_out = (V_in/255)^gamma * 255. gamma > 1 darkens; gamma < 1 brightens."""
    g = clamp_float(params.get("gamma", 1.0), 0.1, 5.0)
    table = (np.linspace(0, 1, 256) ** g * 255).astype(np.uint8)
    return cv2.LUT(bgr, table)


def apply_invert(bgr: np.ndarray, _params: dict) -> np.ndarray:
    return cv2.bitwise_not(bgr)


_LOG256 = float(np.log(256.0))  # log(1 + 255)


def apply_log_transform(bgr: np.ndarray, _params: dict) -> np.ndarray:
    """s = 255 * log(1+x) / log(256), per channel, x in [0,255]."""
    x = bgr.astype(np.float32)
    s = 255.0 * np.log1p(x) / _LOG256
    return np.clip(s, 0, 255).astype(np.uint8)


def apply_inverse_log_transform(bgr: np.ndarray, _params: dict) -> np.ndarray:
    """Inverse of apply_log_transform: x = exp(s/255 * log(256)) - 1."""
    s = bgr.astype(np.float32)
    r = np.exp(s / 255.0 * _LOG256) - 1.0
    return np.clip(r, 0, 255).astype(np.uint8)


def apply_threshold_binary(bgr: np.ndarray, params: dict) -> np.ndarray:
    t = clamp_int(params.get("thresh", 127), 0, 255)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, t, 255, cv2.THRESH_BINARY)
    return cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR)


def apply_threshold_otsu(bgr: np.ndarray, _params: dict) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR)


def apply_threshold_adaptive_mean(bgr: np.ndarray, params: dict) -> np.ndarray:
    bs = odd_kernel(int(params.get("block_size", 11)), 3, 99)
    c = clamp_int(params.get("C", 2), -20, 20)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    bw = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, bs, c)
    return cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR)


def apply_threshold_adaptive_gaussian(bgr: np.ndarray, params: dict) -> np.ndarray:
    bs = odd_kernel(int(params.get("block_size", 11)), 3, 99)
    c = clamp_int(params.get("C", 2), -20, 20)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    bw = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, bs, c)
    return cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR)


def validate_gamma(p: dict) -> dict:
    return {"gamma": clamp_float(p.get("gamma", 1.0), 0.1, 5.0)}


def validate_clahe(p: dict) -> dict:
    return {
        "clip_limit": clamp_float(p.get("clip_limit", 2.0), 0.1, 40.0),
        "tile_grid_size": clamp_int(p.get("tile_grid_size", 8), 2, 32),
    }


def validate_threshold_binary(p: dict) -> dict:
    return {"thresh": clamp_int(p.get("thresh", 127), 0, 255)}


def validate_adaptive(p: dict) -> dict:
    return {
        "block_size": odd_kernel(int(p.get("block_size", 11)), 3, 99),
        "C": clamp_int(p.get("C", 2), -20, 20),
    }


INTENSITY_SPECS: list[dict] = [
    {
        "id": "normalize_minmax",
        "label": "Normalize (min-max)",
        "category": "intensity",
        "description": "Normalize luminance to full 0–255 range (via Y channel path).",
        "default_params": {},
        "apply": apply_normalize_minmax,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "equalize_histogram",
        "label": "Histogram equalize",
        "category": "intensity",
        "description": "Equalize Y channel in YCrCb.",
        "default_params": {},
        "apply": apply_equalize_hist,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "clahe",
        "label": "CLAHE",
        "category": "intensity",
        "description": "Contrast Limited Adaptive Histogram Equalization (LAB L channel).",
        "default_params": {"clip_limit": 2.0, "tile_grid_size": 8},
        "apply": apply_clahe,
        "validate_params": validate_clahe,
    },
    {
        "id": "gamma",
        "label": "Gamma correction",
        "category": "intensity",
        "description": "Per-channel V^gamma: gamma>1 darkens, gamma<1 brightens (linear at 1).",
        "default_params": {"gamma": 1.0},
        "apply": apply_gamma,
        "validate_params": validate_gamma,
    },
    {
        "id": "invert",
        "label": "Invert",
        "category": "intensity",
        "description": "Bitwise NOT on BGR.",
        "default_params": {},
        "apply": apply_invert,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "log_transform",
        "label": "Log transform (spatial)",
        "category": "intensity",
        "description": (
            "Compress dynamic range: s = 255·log(1+x)/log(256) per channel (inverse: inverse_log_transform)."
        ),
        "default_params": {},
        "apply": apply_log_transform,
        "validate_params": lambda p: dict(p),
        "detail_doc": (
            "Classic log compression on uint8 BGR: maps [0,255] monotonically to [0,255] with "
            "stronger boost to dark regions. Pair with inverse_log_transform to expand back "
            "without intermediate normalization."
        ),
    },
    {
        "id": "inverse_log_transform",
        "label": "Inverse log transform (spatial)",
        "category": "intensity",
        "description": "Exact inverse of log_transform on uint8 BGR.",
        "default_params": {},
        "apply": apply_inverse_log_transform,
        "validate_params": lambda p: dict(p),
        "detail_doc": (
            "Recovers linear intensities from images produced by log_transform: "
            "x = exp(s/255·log(256)) − 1, clipped to 8-bit. Use immediately after log_transform "
            "for a round-trip; other edits in between break the inverse relationship."
        ),
    },
    {
        "id": "threshold_binary",
        "label": "Threshold (binary)",
        "category": "intensity",
        "description": "Fixed global threshold on grayscale.",
        "default_params": {"thresh": 127},
        "apply": apply_threshold_binary,
        "validate_params": validate_threshold_binary,
    },
    {
        "id": "threshold_otsu",
        "label": "Threshold (Otsu)",
        "category": "intensity",
        "description": "Otsu automatic threshold.",
        "default_params": {},
        "apply": apply_threshold_otsu,
        "validate_params": lambda p: dict(p),
    },
    {
        "id": "threshold_adaptive_mean",
        "label": "Adaptive threshold (mean)",
        "category": "intensity",
        "description": "Adaptive threshold with local mean.",
        "default_params": {"block_size": 11, "C": 2},
        "apply": apply_threshold_adaptive_mean,
        "validate_params": validate_adaptive,
    },
    {
        "id": "threshold_adaptive_gaussian",
        "label": "Adaptive threshold (Gaussian)",
        "category": "intensity",
        "description": "Adaptive threshold with Gaussian-weighted sum.",
        "default_params": {"block_size": 11, "C": 2},
        "apply": apply_threshold_adaptive_gaussian,
        "validate_params": validate_adaptive,
    },
]
