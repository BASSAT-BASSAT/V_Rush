"""FastAPI application — KernelLab."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.api.routes import router
from app.config import settings

app = FastAPI(
    title="KernelLab",
    version="0.2.0",
    description="Classical CV preprocessing playground",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": "kernellab"}


def _mount_frontend_dist() -> None:
    """Serve Vite build from STATIC_ROOT when set (production / Docker)."""
    raw = os.getenv("STATIC_ROOT", "").strip()
    if not raw:
        return
    root = Path(raw).resolve()
    if not root.is_dir():
        return
    index = root / "index.html"
    if not index.is_file():
        return
    app.mount("/", StaticFiles(directory=str(root), html=True), name="frontend")


_mount_frontend_dist()
