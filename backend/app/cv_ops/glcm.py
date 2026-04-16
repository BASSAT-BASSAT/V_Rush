"""Gray-Level Co-occurrence Matrix (GLCM) — local contrast from horizontal co-occurrences."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_int, odd_kernel


def _patch_contrast_horizontal(patch: np.ndarray, levels: int) -> float:
    """Contrast feature from symmetric horizontal GLCM at one distance (quantized levels)."""
    if patch.shape[0] < 2 or patch.shape[1] < 2:
        return 0.0
    g = (patch.astype(np.float32) / 255.0 * (levels - 1)).astype(np.int32)
    g = np.clip(g, 0, levels - 1)
    a = g[:, :-1].ravel()
    b = g[:, 1:].ravel()
    hist = np.bincount(a * levels + b, minlength=levels * levels).reshape(levels, levels)
    hist = hist + hist.T
    s = float(hist.sum())
    if s <= 0:
        return 0.0
    p = hist / s
    ii, jj = np.indices((levels, levels))
    return float(np.sum(p * (ii - jj) ** 2))


def apply_glcm_contrast(bgr: np.ndarray, params: dict) -> np.ndarray:
    patch_req = odd_kernel(int(params.get("patch_size", 15)), 5, 51)
    levels = clamp_int(params.get("levels", 16), 8, 64)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    patch = min(patch_req, h, w)
    if patch % 2 == 0:
        patch -= 1
    patch = max(3, patch)
    patch = min(patch, h, w)
    if patch < 3 or h < 2 or w < 2:
        flat = cv2.normalize(gray.astype(np.float32), None, 0, 255, cv2.NORM_MINMAX).astype(
            np.uint8
        )
        return cv2.cvtColor(flat, cv2.COLOR_GRAY2BGR)

    max_cells = 128
    ny = min(max_cells, max(1, h - patch + 1))
    nx = min(max_cells, max(1, w - patch + 1))
    grid = np.zeros((ny, nx), dtype=np.float32)
    for gy in range(ny):
        y0 = 0 if ny == 1 else int(round(gy * (h - patch) / (ny - 1)))
        y0 = max(0, min(h - patch, y0))
        for gx in range(nx):
            x0 = 0 if nx == 1 else int(round(gx * (w - patch) / (nx - 1)))
            x0 = max(0, min(w - patch, x0))
            sl = gray[y0 : y0 + patch, x0 : x0 + patch]
            grid[gy, gx] = _patch_contrast_horizontal(sl, levels)
    up = cv2.resize(grid, (w, h), interpolation=cv2.INTER_LINEAR)
    out = cv2.normalize(up, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def validate_glcm(p: dict) -> dict:
    return {
        "patch_size": odd_kernel(int(p.get("patch_size", 15)), 5, 51),
        "levels": clamp_int(p.get("levels", 16), 8, 64),
    }


GLCM_SPECS: list[dict] = [
    {
        "id": "glcm_contrast",
        "label": "GLCM contrast (local)",
        "category": "texture",
        "description": "Sliding-window GLCM contrast (horizontal pairs), upsampled to image size.",
        "default_params": {"patch_size": 15, "levels": 16},
        "apply": apply_glcm_contrast,
        "validate_params": validate_glcm,
    },
]
