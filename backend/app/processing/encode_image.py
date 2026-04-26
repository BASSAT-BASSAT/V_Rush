"""Encode BGR images for API responses, matching the source format when sensible."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Final

import cv2
import numpy as np

_JPEG_EXTS: Final[frozenset[str]] = frozenset({"jpg", "jpeg", "jpe"})
_WEBP_EXTS: Final[frozenset[str]] = frozenset({"webp"})
_PNG_EXTS: Final[frozenset[str]] = frozenset({"png"})


def _suffix_from_name(name: str | None) -> str | None:
    if not name:
        return None
    base = os.path.basename(name.replace("\\", "/"))
    if "." not in base:
        return None
    return base.rsplit(".", 1)[-1].lower()


def _mime_from_content_type(content_type: str | None) -> str | None:
    if not content_type:
        return None
    main = content_type.split(";", 1)[0].strip().lower()
    if main in {"image/jpg", "image/jpeg", "image/pjpeg"}:
        return "image/jpeg"
    if main == "image/webp":
        return "image/webp"
    if main == "image/png":
        return "image/png"
    return None


@dataclass(frozen=True)
class _EncodeSpec:
    imencode_ext: str
    mime: str
    imwrite_params: list[int]


def _pick_spec(filename: str | None, content_type: str | None) -> _EncodeSpec:
    suf = _suffix_from_name(filename)
    if suf in _JPEG_EXTS:
        return _EncodeSpec(
            ".jpg",
            "image/jpeg",
            [int(cv2.IMWRITE_JPEG_QUALITY), 92],
        )
    if suf in _WEBP_EXTS:
        return _EncodeSpec(
            ".webp",
            "image/webp",
            [int(cv2.IMWRITE_WEBP_QUALITY), 90],
        )
    if suf in _PNG_EXTS:
        return _EncodeSpec(".png", "image/png", [])

    ct = _mime_from_content_type(content_type)
    if ct == "image/jpeg":
        return _EncodeSpec(".jpg", "image/jpeg", [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if ct == "image/webp":
        return _EncodeSpec(".webp", "image/webp", [int(cv2.IMWRITE_WEBP_QUALITY), 90])
    if ct == "image/png":
        return _EncodeSpec(".png", "image/png", [])

    return _EncodeSpec(".png", "image/png", [])


def encode_bgr_for_download(
    bgr: np.ndarray,
    *,
    filename: str | None = None,
    content_type: str | None = None,
) -> tuple[bytes, str]:
    """Return encoded bytes and MIME type, preferring JPEG/WebP/PNG based on filename then Content-Type."""
    spec = _pick_spec(filename, content_type)
    ok, buf = cv2.imencode(spec.imencode_ext, bgr, spec.imwrite_params)
    if ok:
        return buf.tobytes(), spec.mime
    if spec.imencode_ext != ".png":
        ok2, buf2 = cv2.imencode(".png", bgr)
        if ok2:
            return buf2.tobytes(), "image/png"
    raise RuntimeError(f"Failed to encode image as {spec.mime}")
