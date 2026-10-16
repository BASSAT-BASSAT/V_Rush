"""Validation for dataset-relative file paths (SSRF / path traversal hardening)."""

from __future__ import annotations

import re

_DATASET_FILE_PATH_RE = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._\-/]{0,511}$"
)

_FORBIDDEN_SUBSTRINGS = ("..", "://", "\\", "\0", "@", "%2f", "%2F", "%5c", "%5C")


class KagglePathError(ValueError):
    """User-supplied path is not a safe in-dataset relative path."""


def validate_dataset_file_path(file_path: str) -> str:
    """Return a normalized relative path inside a Kaggle dataset listing."""
    path = file_path.strip()
    if not path:
        raise KagglePathError("file path is required")

    lowered = path.lower()
    for bad in _FORBIDDEN_SUBSTRINGS:
        if bad in lowered:
            raise KagglePathError("invalid file path")

    if path.startswith(("/", ".")):
        raise KagglePathError("invalid file path")

    if not _DATASET_FILE_PATH_RE.match(path):
        raise KagglePathError("invalid file path")

    return path
