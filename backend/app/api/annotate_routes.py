"""Video annotation API: YOLO frame detect + optional local disk project storage."""

from __future__ import annotations

import base64
import json
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth_deps import require_user
from app.config import settings
from app.cv_ops.yolo26 import validate_yolo26_params, yolo26_detect_step
from app.processing.io_image import ImageDecodeError, decode_image_bytes
from app.schemas import (
    AnnotateCapabilitiesResponse,
    AnnotateDetectResponse,
    AnnotationProjectPayload,
    AnnotationProjectSaveResponse,
    AnnotationProjectSummary,
    DetectionItem,
)

router = APIRouter(prefix="/annotate", tags=["annotate"])


def _local_annotations_enabled() -> bool:
    flag = os.getenv("ENABLE_LOCAL_ANNOTATIONS", "").strip().lower()
    if flag in ("1", "true", "yes"):
        return True
    # Default on when explicitly configured via directory env.
    return bool(os.getenv("LOCAL_ANNOTATIONS_DIR", "").strip())


def _local_annotations_root() -> Path:
    raw = os.getenv("LOCAL_ANNOTATIONS_DIR", "").strip()
    if raw:
        return Path(raw).resolve()
    backend_dir = Path(__file__).resolve().parent.parent.parent
    return (backend_dir / "annotations").resolve()


def _project_dir(project_id: str) -> Path:
    safe = project_id.replace("..", "").replace("/", "").replace("\\", "")
    if not safe:
        raise HTTPException(status_code=400, detail="Invalid project id")
    return _local_annotations_root() / safe


def _require_local_disk() -> Path:
    if not _local_annotations_enabled():
        raise HTTPException(
            status_code=403,
            detail="Local annotation disk storage is disabled on this deployment.",
        )
    root = _local_annotations_root()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _load_project_json(path: Path) -> dict[str, Any] | None:
    project_file = path / "project.json"
    if not project_file.is_file():
        return None
    try:
        return json.loads(project_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


@router.get("/capabilities", response_model=AnnotateCapabilitiesResponse)
def annotate_capabilities(_user_id: str = Depends(require_user)) -> AnnotateCapabilitiesResponse:
    enabled = _local_annotations_enabled()
    return AnnotateCapabilitiesResponse(
        local_disk_enabled=enabled,
        local_annotations_dir=str(_local_annotations_root()) if enabled else None,
    )


@router.post("/detect", response_model=AnnotateDetectResponse)
async def annotate_detect(
    _user_id: str = Depends(require_user),
    file: UploadFile = File(...),
    conf: float = Form(default=0.25),
    max_det: int = Form(default=100),
    classes: str = Form(default="[]"),
) -> AnnotateDetectResponse:
    try:
        raw_classes: list[Any] = json.loads(classes)
        if not isinstance(raw_classes, list):
            raise ValueError("classes must be a JSON array")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid classes JSON: {e}") from e

    try:
        params = validate_yolo26_params(
            {"conf": conf, "max_det": max_det, "draw": False, "classes": raw_classes}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

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
        _, detections_raw = yolo26_detect_step(decoded.bgr, params)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    h, w = decoded.bgr.shape[:2]
    detections = [DetectionItem(**d) for d in detections_raw]
    return AnnotateDetectResponse(width=w, height=h, detections=detections)


@router.post("/local/save", response_model=AnnotationProjectSaveResponse)
def annotate_local_save(
    payload: AnnotationProjectPayload,
    _user_id: str = Depends(require_user),
) -> AnnotationProjectSaveResponse:
    _require_local_disk()
    proj_dir = _project_dir(payload.id)
    proj_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = proj_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    frames_meta: list[dict[str, Any]] = []
    for frame in payload.frames:
        rel_image: str | None = None
        if frame.imageBase64:
            try:
                raw = base64.b64decode(frame.imageBase64, validate=True)
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid base64 for frame {frame.frameIndex}: {e}",
                ) from e
            ext = ".jpg" if "jpeg" in frame.mime.lower() else ".png"
            fname = f"frame_{frame.frameIndex:06d}{ext}"
            (frames_dir / fname).write_bytes(raw)
            rel_image = f"frames/{fname}"
        frames_meta.append(
            {
                "frameIndex": frame.frameIndex,
                "timestampSec": frame.timestampSec,
                "imagePath": rel_image,
                "mime": frame.mime,
                "boxes": [b.model_dump() for b in frame.boxes],
            }
        )

    updated = payload.updatedAt or datetime.now(UTC).isoformat()
    doc: dict[str, Any] = {
        "id": payload.id,
        "videoName": payload.videoName,
        "width": payload.width,
        "height": payload.height,
        "durationSec": payload.durationSec,
        "sampleFps": payload.sampleFps,
        "targetClasses": payload.targetClasses,
        "identities": {k: v.model_dump() for k, v in payload.identities.items()},
        "frames": frames_meta,
        "updatedAt": updated,
    }
    (proj_dir / "project.json").write_text(json.dumps(doc, indent=2), encoding="utf-8")

    return AnnotationProjectSaveResponse(id=payload.id, saved=True, path=str(proj_dir))


@router.get("/local/list", response_model=list[AnnotationProjectSummary])
def annotate_local_list(_user_id: str = Depends(require_user)) -> list[AnnotationProjectSummary]:
    root = _require_local_disk()
    summaries: list[AnnotationProjectSummary] = []
    if not root.is_dir():
        return summaries
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        doc = _load_project_json(child)
        if not doc:
            continue
        frames = doc.get("frames") or []
        identities = doc.get("identities") or {}
        box_count = sum(len(f.get("boxes") or []) for f in frames)
        summaries.append(
            AnnotationProjectSummary(
                id=str(doc.get("id", child.name)),
                videoName=str(doc.get("videoName", child.name)),
                frameCount=len(frames),
                boxCount=box_count,
                identityCount=len(identities) if isinstance(identities, dict) else 0,
                updatedAt=doc.get("updatedAt"),
            )
        )
    return summaries


@router.get("/local/{project_id}", response_model=AnnotationProjectPayload)
def annotate_local_get(
    project_id: str,
    _user_id: str = Depends(require_user),
) -> AnnotationProjectPayload:
    _require_local_disk()
    proj_dir = _project_dir(project_id)
    doc = _load_project_json(proj_dir)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")

    frames_in: list[dict[str, Any]] = []
    for f in doc.get("frames") or []:
        image_b64: str | None = None
        mime = str(f.get("mime") or "image/jpeg")
        rel = f.get("imagePath")
        if rel:
            img_path = proj_dir / str(rel)
            if img_path.is_file():
                image_b64 = base64.b64encode(img_path.read_bytes()).decode("ascii")
        frames_in.append(
            {
                "frameIndex": f.get("frameIndex", 0),
                "timestampSec": f.get("timestampSec", 0.0),
                "imageBase64": image_b64,
                "mime": mime,
                "boxes": f.get("boxes") or [],
            }
        )

    identities_raw = doc.get("identities") or {}
    return AnnotationProjectPayload(
        id=str(doc.get("id", project_id)),
        videoName=str(doc.get("videoName", project_id)),
        width=int(doc.get("width", 0)),
        height=int(doc.get("height", 0)),
        durationSec=float(doc.get("durationSec", 0.0)),
        sampleFps=float(doc.get("sampleFps", 1.0)),
        targetClasses=list(doc.get("targetClasses") or []),
        identities=identities_raw if isinstance(identities_raw, dict) else {},
        frames=frames_in,
        updatedAt=doc.get("updatedAt"),
    )


@router.delete("/local/{project_id}")
def annotate_local_delete(
    project_id: str,
    _user_id: str = Depends(require_user),
) -> dict[str, bool]:
    _require_local_disk()
    proj_dir = _project_dir(project_id)
    if not proj_dir.is_dir():
        raise HTTPException(status_code=404, detail="Project not found")
    shutil.rmtree(proj_dir)
    return {"deleted": True}
