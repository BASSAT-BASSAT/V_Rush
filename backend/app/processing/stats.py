"""Per-image histogram and pixel statistics for the Studio before/after panel."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def image_stats(bgr: np.ndarray) -> dict[str, Any]:
    """Return grayscale + per-channel 256-bin histograms and pixel-value summaries.

    Shape of the returned dict matches ``ImageStats`` in ``schemas.py``.
    """
    if bgr.ndim != 3 or bgr.shape[2] != 3:
        raise ValueError(f"image_stats expects BGR uint8 HWC, got shape {bgr.shape}")

    b, g, r = cv2.split(bgr)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    def _hist(ch: np.ndarray) -> list[int]:
        h = cv2.calcHist([ch], [0], None, [256], [0, 256])
        return h.astype(np.int64).flatten().tolist()

    return {
        "histogram_gray": _hist(gray),
        "histogram_rgb": {"r": _hist(r), "g": _hist(g), "b": _hist(b)},
        "mean": [float(r.mean()), float(g.mean()), float(b.mean())],
        "std": [float(r.std()), float(g.std()), float(b.std())],
        "min": [int(r.min()), int(g.min()), int(b.min())],
        "max": [int(r.max()), int(g.max()), int(b.max())],
        "width": int(bgr.shape[1]),
        "height": int(bgr.shape[0]),
    }
