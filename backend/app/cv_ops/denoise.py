"""Denoising."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float, clamp_int


def apply_nl_means_gray(bgr: np.ndarray, params: dict) -> np.ndarray:
    h = clamp_float(params.get("h", 10), 1, 40)
    template = clamp_int(params.get("template_window_size", 7), 3, 21) | 1
    search = clamp_int(params.get("search_window_size", 21), 3, 41) | 1
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    out = cv2.fastNlMeansDenoising(gray, None, h, template, search)
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def apply_nl_means_color(bgr: np.ndarray, params: dict) -> np.ndarray:
    h = clamp_float(params.get("h", 10), 1, 40)
    hc = clamp_float(params.get("h_color", 10), 1, 40)
    template = clamp_int(params.get("template_window_size", 7), 3, 21) | 1
    search = clamp_int(params.get("search_window_size", 21), 3, 41) | 1
    return cv2.fastNlMeansDenoisingColored(bgr, None, h, hc, template, search)


def validate_nl_gray(p: dict) -> dict:
    return {
        "h": clamp_float(p.get("h", 10), 1, 40),
        "template_window_size": clamp_int(p.get("template_window_size", 7), 3, 21) | 1,
        "search_window_size": clamp_int(p.get("search_window_size", 21), 3, 41) | 1,
    }


def validate_nl_color(p: dict) -> dict:
    base = validate_nl_gray(p)
    base["h_color"] = clamp_float(p.get("h_color", 10), 1, 40)
    return base


DENOISE_SPECS: list[dict] = [
    {
        "id": "nl_means_gray",
        "label": "Non-local means (gray)",
        "category": "denoise",
        "description": "fastNlMeansDenoising on luminance.",
        "default_params": {"h": 10, "template_window_size": 7, "search_window_size": 21},
        "apply": apply_nl_means_gray,
        "validate_params": validate_nl_gray,
    },
    {
        "id": "nl_means_color",
        "label": "Non-local means (color)",
        "category": "denoise",
        "description": "fastNlMeansDenoisingColored.",
        "default_params": {
            "h": 10,
            "h_color": 10,
            "template_window_size": 7,
            "search_window_size": 21,
        },
        "apply": apply_nl_means_color,
        "validate_params": validate_nl_color,
    },
]
