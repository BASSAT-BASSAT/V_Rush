"""Decode and validate uploaded image bytes."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


class ImageDecodeError(ValueError):
    """Raised when image bytes cannot be decoded or violate limits."""


@dataclass(frozen=True)
class DecodedImage:
    bgr: np.ndarray
    width: int
    height: int


def decode_image_bytes(
    data: bytes,
    *,
    max_bytes: int,
    max_dimension: int,
) -> DecodedImage:
    if len(data) > max_bytes:
        raise ImageDecodeError("Image exceeds maximum upload size")
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ImageDecodeError("Could not decode image")
    h, w = bgr.shape[:2]
    if w < 1 or h < 1:
        raise ImageDecodeError("Invalid image dimensions")
    if max(w, h) > max_dimension:
        raise ImageDecodeError(f"Image exceeds maximum dimension ({max_dimension}px)")
    return DecodedImage(bgr=bgr, width=w, height=h)
