# -*- coding: utf-8 -*-
"""Optional deep local feature detectors: DISK and ALIKED.

These are CNN-based detectors that produce keypoints + dense float descriptors.
They live behind an *optional* dependency (``kornia`` + ``torch``) so the slim
Vercel deploy keeps working — if those packages aren't installed, every public
helper raises :class:`DeepMatcherUnavailable` which the API translates into a
friendly 503 instead of a hard 500.

Self-host with ``pip install kornia torch torchvision`` to enable them.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np


class DeepMatcherUnavailable(RuntimeError):
    """Raised when a deep matcher is requested but its runtime is missing."""


_DEEP_ALGOS: set[str] = {"disk", "aliked"}


def is_deep_algo(algo: str) -> bool:
    return algo.lower() in _DEEP_ALGOS


# --- Lazy import + module-level cache -------------------------------------

_lock = threading.Lock()
_state: dict[str, Any] = {"checked": False, "available": False, "reason": "", "torch": None, "kornia": None}


def _probe() -> dict[str, Any]:
    """Try to import torch + kornia once; remember the outcome."""
    if _state["checked"]:
        return _state
    with _lock:
        if _state["checked"]:
            return _state
        try:
            import torch  # type: ignore[import-not-found]
            import kornia  # type: ignore[import-not-found]
            import kornia.feature  # noqa: F401  # type: ignore[import-not-found]

            _state["torch"] = torch
            _state["kornia"] = kornia
            _state["available"] = True
            _state["reason"] = ""
        except ImportError as e:
            _state["available"] = False
            _state["reason"] = (
                "DISK and ALIKED are deep-learning local matchers and require the "
                "optional `kornia` + `torch` packages on the server. "
                "Install with `pip install kornia torch torchvision` and retry "
                f"(import error: {e})."
            )
        finally:
            _state["checked"] = True
    return _state


def deep_matchers_available() -> tuple[bool, str]:
    s = _probe()
    return bool(s["available"]), str(s["reason"] or "")


# Per-process model cache (loading is expensive).
_MODELS: dict[str, Any] = {}


def _get_model(algo: str):
    s = _probe()
    if not s["available"]:
        raise DeepMatcherUnavailable(s["reason"])
    if algo in _MODELS:
        return _MODELS[algo]

    KF = s["kornia"].feature
    torch = s["torch"]
    device = torch.device("cpu")

    if algo == "disk":
        model = KF.DISK.from_pretrained("depth").to(device).eval()
    elif algo == "aliked":
        model = KF.ALIKED(
            model_name="aliked-n16",
            device=device,
            pretrained=True,
        ).eval()
    else:  # pragma: no cover - guarded by is_deep_algo
        raise DeepMatcherUnavailable(f"Unknown deep matcher: {algo}")

    _MODELS[algo] = model
    return model


# --- Public API mirroring matchers.detect_and_describe --------------------

@dataclass
class DeepDetectResult:
    keypoints: list[cv2.KeyPoint]
    descriptors: np.ndarray | None  # float32 [N, D]


def detect_and_describe_deep(
    bgr: np.ndarray,
    algo: str,
    *,
    max_features: int = 2048,
) -> DeepDetectResult:
    """Run a deep detector on a BGR image and return OpenCV-style outputs.

    The keypoints come back as :class:`cv2.KeyPoint` so the rest of the
    matching/draw pipeline doesn't need to special-case anything.
    """
    s = _probe()
    if not s["available"]:
        raise DeepMatcherUnavailable(s["reason"])
    torch = s["torch"]

    model = _get_model(algo)

    # Kornia models want RGB float tensors in [0, 1] shaped [B, C, H, W].
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    tensor = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).float() / 255.0

    n = int(max_features) if max_features and max_features > 0 else 2048

    with torch.inference_mode():
        if algo == "disk":
            (features,) = model(tensor, n=n, window_size=5)
            kp_xy = features.keypoints.detach().cpu().numpy().astype(np.float32)  # [N, 2]
            desc = features.descriptors.detach().cpu().numpy().astype(np.float32)  # [N, D]
            scores = features.detection_scores.detach().cpu().numpy().astype(np.float32)
        elif algo == "aliked":
            # ALIKED returns LAFs and descriptors; we only need keypoint xy + score.
            lafs, scores_t, descs_t = model(tensor)
            # LAF center is column 0 of the 2x3 affine; shape [B, N, 2, 3]
            centers = lafs[0, :, :, 2].detach().cpu().numpy().astype(np.float32)  # [N, 2]
            kp_xy = centers
            scores = scores_t[0].detach().cpu().numpy().astype(np.float32)
            desc = descs_t[0].detach().cpu().numpy().astype(np.float32)
        else:  # pragma: no cover
            raise DeepMatcherUnavailable(f"Unknown deep matcher: {algo}")

    if kp_xy.shape[0] > n:
        order = np.argsort(-scores)[:n]
        kp_xy = kp_xy[order]
        desc = desc[order]
        scores = scores[order]

    keypoints: list[cv2.KeyPoint] = [
        cv2.KeyPoint(float(x), float(y), 6.0, response=float(s))
        for (x, y), s in zip(kp_xy, scores)
    ]
    return DeepDetectResult(keypoints=keypoints, descriptors=desc if len(desc) else None)
