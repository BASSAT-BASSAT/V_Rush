from __future__ import annotations

import cv2
import numpy as np

from app.processing.encode_image import encode_bgr_for_download


def test_encode_defaults_to_png() -> None:
    img = np.zeros((8, 8, 3), dtype=np.uint8)
    data, mime = encode_bgr_for_download(img, filename="x.bin", content_type="application/octet-stream")
    assert mime == "image/png"
    arr = np.frombuffer(data, dtype=np.uint8)
    assert cv2.imdecode(arr, cv2.IMREAD_COLOR) is not None


def test_encode_respects_jpeg_filename() -> None:
    img = np.zeros((8, 8, 3), dtype=np.uint8)
    img[:, :] = (10, 120, 240)
    data, mime = encode_bgr_for_download(img, filename="photo.JPEG", content_type=None)
    assert mime == "image/jpeg"
    arr = np.frombuffer(data, dtype=np.uint8)
    back = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    assert back is not None
    assert back.shape == (8, 8, 3)


def test_encode_respects_webp_extension() -> None:
    img = np.zeros((8, 8, 3), dtype=np.uint8)
    data, mime = encode_bgr_for_download(img, filename="a.webp", content_type=None)
    assert mime == "image/webp"
    arr = np.frombuffer(data, dtype=np.uint8)
    assert cv2.imdecode(arr, cv2.IMREAD_COLOR) is not None


def test_encode_content_type_when_no_extension() -> None:
    img = np.zeros((4, 4, 3), dtype=np.uint8)
    data, mime = encode_bgr_for_download(img, filename="blob", content_type="image/webp")
    assert mime == "image/webp"
    assert len(data) > 0
