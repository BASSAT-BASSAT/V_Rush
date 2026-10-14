"""Annotate API tests."""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from app.cv_ops.yolo26 import set_model_for_testing
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _make_fake_output(
    boxes: list[tuple[float, float, float, float, float, int]],
) -> np.ndarray:
    arr = np.zeros((1, 300, 6), dtype=np.float32)
    for i, (x1, y1, x2, y2, conf, cid) in enumerate(boxes[:300]):
        arr[0, i] = [x1, y1, x2, y2, conf, cid]
    return arr


class _FakeSession:
    def __init__(self, output: np.ndarray) -> None:
        self._output = output

    def run(
        self, output_names: list[str] | None, feeds: dict[str, np.ndarray]
    ) -> list[np.ndarray]:
        return [self._output]


def test_annotate_capabilities() -> None:
    r = client.get("/api/annotate/capabilities")
    assert r.status_code == 200
    body = r.json()
    assert "local_disk_enabled" in body


def test_annotate_detect_mocked(png_bytes_simple: bytes) -> None:
    fake_out = _make_fake_output([(100.0, 100.0, 300.0, 300.0, 0.95, 0)])
    set_model_for_testing(_FakeSession(fake_out))
    try:
        r = client.post(
            "/api/annotate/detect",
            files={"file": ("t.png", png_bytes_simple, "image/png")},
            data={"conf": "0.25", "max_det": "10", "classes": json.dumps(["person"])},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["width"] == 64
        assert body["height"] == 64
        assert len(body["detections"]) == 1
        assert body["detections"][0]["label"] == "person"
    finally:
        set_model_for_testing(None)


def test_annotate_local_save_list_delete(png_bytes_simple: bytes, tmp_path: Path) -> None:
    os.environ["ENABLE_LOCAL_ANNOTATIONS"] = "1"
    os.environ["LOCAL_ANNOTATIONS_DIR"] = str(tmp_path)

    import base64

    b64 = base64.b64encode(png_bytes_simple).decode("ascii")
    payload = {
        "id": "test-proj-1",
        "videoName": "clip.mp4",
        "width": 64,
        "height": 64,
        "durationSec": 1.0,
        "sampleFps": 1.0,
        "targetClasses": ["person"],
        "identities": {
            "person_1": {
                "id": "person_1",
                "displayName": "Person 1",
                "className": "person",
                "color": "#ff3838",
                "caption": "Red hoodie",
            }
        },
        "frames": [
            {
                "frameIndex": 0,
                "timestampSec": 0.0,
                "imageBase64": b64,
                "mime": "image/png",
                "boxes": [
                    {
                        "id": "b1",
                        "className": "person",
                        "reidId": "person_1",
                        "bbox": [10.0, 10.0, 40.0, 40.0],
                        "confidence": 0.9,
                        "source": "yolo26",
                        "caption": "entering",
                    }
                ],
            }
        ],
    }

    r = client.post("/api/annotate/local/save", json=payload)
    assert r.status_code == 200
    assert r.json()["saved"] is True

    r = client.get("/api/annotate/local/list")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["id"] == "test-proj-1"
    assert items[0]["boxCount"] == 1

    r = client.get("/api/annotate/local/test-proj-1")
    assert r.status_code == 200
    got = r.json()
    assert got["videoName"] == "clip.mp4"
    assert len(got["frames"]) == 1
    assert got["frames"][0]["imageBase64"]

    r = client.delete("/api/annotate/local/test-proj-1")
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    r = client.get("/api/annotate/local/list")
    assert r.json() == []
