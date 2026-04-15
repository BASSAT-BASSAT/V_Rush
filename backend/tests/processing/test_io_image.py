from __future__ import annotations

import cv2
import numpy as np
import pytest
from app.processing.io_image import ImageDecodeError, decode_image_bytes


def test_decode_valid_png(png_bytes_simple: bytes) -> None:
    d = decode_image_bytes(png_bytes_simple, max_bytes=1_000_000, max_dimension=4096)
    assert d.width == 64
    assert d.height == 64
    assert d.bgr.shape == (64, 64, 3)


def test_rejects_oversized_bytes() -> None:
    with pytest.raises(ImageDecodeError, match="maximum upload"):
        decode_image_bytes(b"x" * 100, max_bytes=10, max_dimension=4096)


def test_rejects_invalid_image() -> None:
    with pytest.raises(ImageDecodeError, match="decode"):
        decode_image_bytes(b"not an image", max_bytes=1000, max_dimension=4096)


def test_rejects_too_large_dimensions() -> None:
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    data = buf.tobytes()
    with pytest.raises(ImageDecodeError, match="dimension"):
        decode_image_bytes(data, max_bytes=10_000_000, max_dimension=50)
