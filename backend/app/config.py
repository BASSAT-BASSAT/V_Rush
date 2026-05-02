"""Application configuration from environment."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _parse_cors() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [x.strip() for x in raw.split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    max_image_bytes: int = int(os.getenv("MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
    max_image_dimension: int = int(os.getenv("MAX_IMAGE_DIMENSION", "8192"))
    cors_origins: list[str] = field(default_factory=_parse_cors)


settings = Settings()
