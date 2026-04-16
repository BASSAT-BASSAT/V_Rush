"""FastAPI application — V-Rush."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Local dev: load ``backend/.env`` so SUPABASE_JWT_SECRET matches deployment (Vercel injects env vars).
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.api.routes import router
from app.config import settings

app = FastAPI(
    title="V-Rush",
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

app.include_router(router, prefix="/api")
# Stripped paths for hosts (e.g. Vercel Services ``routePrefix: /api``) that forward ``/api/ops`` as ``/ops``.
app.include_router(router, prefix="")
# ``GET /health`` is provided by ``router`` (``api_health``) on the no-prefix mount; keep for Docker probes.


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
