"""Classical segmentation operations: k-means, watershed, GrabCut, connected components.

SLIC superpixels (from the source snippet) is omitted because it lives in
``cv2.ximgproc``, which isn't shipped in ``opencv-python-headless`` (the wheel used
on Vercel). A Docker image with ``opencv-contrib-python-headless`` could add it later.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_int

# Deterministic palette seed so "same params -> same colors" in the debugger.
_COLOR_RNG_SEED = 1337


def _palette(n: int, seed: int = _COLOR_RNG_SEED) -> np.ndarray:
    rng = np.random.default_rng(seed)
    colors = rng.integers(32, 255, size=(max(1, n), 3), dtype=np.uint8)
    return colors


# ---- K-Means (color quantization) ----------------------------------------


def apply_kmeans(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Reduce the image to K dominant colors via k-means clustering."""
    k = clamp_int(params.get("k", 4), 2, 32)
    attempts = 10
    data = bgr.reshape((-1, 3)).astype(np.float32)

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, label, center = cv2.kmeans(data, k, None, criteria, attempts, cv2.KMEANS_PP_CENTERS)

    center = np.uint8(center)
    res = center[label.flatten()]
    return res.reshape(bgr.shape)


def validate_kmeans(p: dict) -> dict:
    return {"k": clamp_int(p.get("k", 4), 2, 32)}


# ---- Watershed ------------------------------------------------------------


def apply_watershed(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Separate touching objects via topographic flooding (distance-transform markers)."""
    thresh_val = clamp_int(params.get("threshold", 127), 1, 254)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    _, thresh = cv2.threshold(
        gray, thresh_val, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    kernel = np.ones((3, 3), np.uint8)
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)

    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist_transform, 0.7 * dist_transform.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)
    unknown = cv2.subtract(opening, sure_fg)

    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(bgr, markers)

    unique_markers = np.unique(markers)
    colors = _palette(len(unique_markers))

    seg = np.zeros_like(bgr)
    for i, m in enumerate(unique_markers):
        if m <= 1:
            continue
        seg[markers == m] = colors[i]
    return cv2.addWeighted(bgr, 0.5, seg, 0.5, 0)


def validate_watershed(p: dict) -> dict:
    return {"threshold": clamp_int(p.get("threshold", 127), 1, 254)}


# ---- GrabCut --------------------------------------------------------------


def apply_grabcut(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Extract the central foreground with a margin-based rectangle prompt."""
    iter_count = clamp_int(params.get("iterations", 5), 1, 10)
    margin = clamp_int(params.get("margin_percent", 10), 1, 40)

    h, w = bgr.shape[:2]
    mx, my = int(w * margin / 100), int(h * margin / 100)
    rect_w = max(1, w - 2 * mx)
    rect_h = max(1, h - 2 * my)
    rect = (mx, my, rect_w, rect_h)

    mask = np.zeros(bgr.shape[:2], np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    cv2.grabCut(bgr, mask, rect, bgd_model, fgd_model, iter_count, cv2.GC_INIT_WITH_RECT)
    mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype("uint8")
    return bgr * mask2[:, :, np.newaxis]


def validate_grabcut(p: dict) -> dict:
    return {
        "iterations": clamp_int(p.get("iterations", 5), 1, 10),
        "margin_percent": clamp_int(p.get("margin_percent", 10), 1, 40),
    }


# ---- Connected components (blob labeling) ---------------------------------


def apply_connected_components(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Label distinct islands of bright pixels after thresholding."""
    thresh_val = clamp_int(params.get("threshold", 127), 1, 254)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY)

    num_labels, labels = cv2.connectedComponents(binary)
    colors = _palette(num_labels)
    colors[0] = [0, 0, 0]  # background stays black
    return colors[labels]


def validate_connected_components(p: dict) -> dict:
    return {"threshold": clamp_int(p.get("threshold", 127), 1, 254)}


SEGMENTATION_SPECS: list[dict] = [
    {
        "id": "kmeans",
        "label": "K-Means quantization",
        "category": "segmentation",
        "description": "Reduce the image to K dominant colors via clustering in RGB space.",
        "default_params": {"k": 4},
        "apply": apply_kmeans,
        "validate_params": validate_kmeans,
        "output_kind": "spatial",
        "detail_doc": (
            "Flattens pixels to a (H*W, 3) array and runs OpenCV's k-means with k-means++ "
            "seeding (10 attempts). Each pixel is replaced by its cluster center. Small k "
            "gives a poster-like effect; k=8..16 is a good general-purpose range. Input is "
            "BGR uint8; output is the same shape."
        ),
    },
    {
        "id": "watershed",
        "label": "Watershed segmentation",
        "category": "segmentation",
        "description": "Split touching bright objects via distance-transform markers + flooding.",
        "default_params": {"threshold": 127},
        "apply": apply_watershed,
        "validate_params": validate_watershed,
        "output_kind": "spatial",
        "detail_doc": (
            "Otsu-thresholds (INV) the luma at ``threshold``, opens with a 3x3 kernel to "
            "drop noise, builds sure-foreground from a distance-transform peak, labels "
            "connected components as markers, and runs ``cv2.watershed``. The result is "
            "blended 50/50 with the input so edges are visible."
        ),
    },
    {
        "id": "grabcut",
        "label": "GrabCut (FG extraction)",
        "category": "segmentation",
        "description": "Extract a central foreground object using a margin-based rectangle prompt.",
        "default_params": {"iterations": 5, "margin_percent": 10},
        "apply": apply_grabcut,
        "validate_params": validate_grabcut,
        "output_kind": "spatial",
        "detail_doc": (
            "Runs ``cv2.grabCut`` with ``GC_INIT_WITH_RECT`` using a rectangle inset by "
            "``margin_percent`` on each side. Pixels outside the rect are treated as "
            "background. Good default for centered subjects; for off-center subjects use "
            "the MobileSAM op instead. Iterations trade quality for speed."
        ),
    },
    {
        "id": "connected_blobs",
        "label": "Connected components",
        "category": "segmentation",
        "description": "Label distinct islands of bright pixels after thresholding.",
        "default_params": {"threshold": 127},
        "apply": apply_connected_components,
        "validate_params": validate_connected_components,
        "output_kind": "spatial",
        "detail_doc": (
            "Thresholds the luma at ``threshold`` and labels 4-connected blobs via "
            "``cv2.connectedComponents``. Each blob gets a stable random color (seeded). "
            "Useful for counting objects or visualizing a binary segmentation."
        ),
    },
]
