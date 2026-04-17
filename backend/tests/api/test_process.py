"""API integration tests."""

from __future__ import annotations

import base64
import json

import cv2
import numpy as np
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health() -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("app") == "kernellab"


def test_get_ops() -> None:
    r = client.get("/api/ops")
    assert r.status_code == 200
    data = r.json()
    assert "ops" in data
    assert len(data["ops"]) > 10
    ids = {o["id"] for o in data["ops"]}
    assert "gaussian_blur" in ids
    assert "dft_magnitude_spectrum" in ids
    assert "yolo26_detect" in ids


def test_post_process_gaussian(png_bytes_simple: bytes) -> None:
    pipeline = json.dumps([{"op": "gaussian_blur", "params": {"ksize": 5, "sigma": 1.0}}])
    r = client.post(
        "/api/process",
        files={"file": ("t.png", png_bytes_simple, "image/png")},
        data={"pipeline": pipeline},
    )
    assert r.status_code == 200
    body = r.json()
    raw = base64.b64decode(body["image_base64"])
    dec = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    assert dec is not None
    assert body["width"] == dec.shape[1]
    assert isinstance(body.get("detections"), list)


def test_post_process_invalid_pipeline(png_bytes_simple: bytes) -> None:
    r = client.post(
        "/api/process",
        files={"file": ("t.png", png_bytes_simple, "image/png")},
        data={"pipeline": "not json"},
    )
    assert r.status_code == 400
