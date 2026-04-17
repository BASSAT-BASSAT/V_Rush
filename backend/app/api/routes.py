"""V-Rush API: operations list and process."""

from __future__ import annotations

import base64
import json
import os
from typing import Any

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth_deps import require_user
from app.config import settings
from app.cv_ops.executor import execute_pipeline
from app.cv_ops.registry import list_ops_public
from app.cv_ops.validate import validate_pipeline
from app.processing.io_image import ImageDecodeError, decode_image_bytes
from app.schemas import OpInfo, OpsListResponse, ProcessResponse

# Routes are defined without ``/api`` in the path; ``main`` mounts this router twice:
# ``prefix="/api"`` → ``/api/ops`` (browser, local dev behind proxy)
# ``prefix=""``     → ``/ops`` (Vercel Services often forwards the path *after* ``/api`` only)
router = APIRouter(tags=["cv"])


@router.get("/health")
def api_health() -> dict[str, str]:
    """Same payload as ``GET /health``; use when the API is only routed under ``/api`` (e.g. Vercel Services)."""
    return {"status": "ok", "app": "kernellab"}


@router.get("/segmentation/status")
def segmentation_status(_user_id: str = Depends(require_user)) -> dict[str, Any]:
    """Spike: hosted segmentation is optional; keys stay server-side when wired."""
    provider = os.getenv("SEGMENTATION_PROVIDER", "").strip() or "none"
    has_url = bool(os.getenv("SEGMENTATION_API_URL", "").strip())
    has_key = bool(os.getenv("SEGMENTATION_API_KEY", "").strip())
    return {
        "provider": provider,
        "configured": has_url and has_key,
        "message": (
            "Set SEGMENTATION_API_URL and SEGMENTATION_API_KEY on the server to enable a hosted "
            "segmentation provider (e.g. Replicate, Hugging Face Inference). Self-hosting large SAM "
            "variants is GPU-heavy; an API is usually cheaper at small scale."
        ),
    }


@router.get("/ops", response_model=OpsListResponse)
def get_ops(_user_id: str = Depends(require_user)) -> OpsListResponse:
    raw = list_ops_public()
    ops = [OpInfo(**item) for item in raw]
    return OpsListResponse(ops=ops)


@router.post("/process", response_model=ProcessResponse)
async def process_image(
    _user_id: str = Depends(require_user),
    file: UploadFile = File(...),
    pipeline: str = Form(default="[]"),
) -> ProcessResponse:
    try:
        raw_steps: list[dict[str, Any]] = json.loads(pipeline)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid pipeline JSON: {e}") from e

    data = await file.read()
    try:
        decoded = decode_image_bytes(
            data,
            max_bytes=settings.max_image_bytes,
            max_dimension=settings.max_image_dimension,
        )
    except ImageDecodeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        validated = validate_pipeline(raw_steps)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    result = execute_pipeline(decoded.bgr, validated)
    h, w = result.image_bgr.shape[:2]

    ok, buf = cv2.imencode(".png", result.image_bgr)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode output image")
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")

    applied = [{"op": oid, "params": dict(params)} for oid, params in validated.steps]

    return ProcessResponse(
        image_base64=b64,
        mime="image/png",
        warnings=result.warnings,
        width=w,
        height=h,
        pipeline_applied=applied,
        last_output_kind=result.last_output_kind,
    )
