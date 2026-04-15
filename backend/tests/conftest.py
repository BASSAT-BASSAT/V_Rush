"""Shared pytest fixtures."""

from __future__ import annotations

import os

# API routes require a Bearer token unless auth is disabled (see app.auth_deps).
os.environ.setdefault("KERNELLAB_AUTH_DISABLED", "1")

import cv2
import numpy as np
import pytest


@pytest.fixture
def white_canvas_200() -> np.ndarray:
    return np.ones((200, 200, 3), dtype=np.uint8) * 255


@pytest.fixture
def png_bytes_simple() -> bytes:
    img = np.ones((64, 64, 3), dtype=np.uint8) * 255
    cv2.rectangle(img, (10, 10), (50, 50), (0, 0, 0), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()
