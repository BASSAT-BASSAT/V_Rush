"""V-Rush API: Kaggle dataset proxy endpoints (per-user credentials)."""

from __future__ import annotations

import base64
import re

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.auth_deps import require_user
from app.config import settings
from app.integrations.kaggle import (
    KaggleAuthError,
    KaggleCreds,
    KaggleError,
    KaggleNotFound,
    download_dataset_file,
    list_dataset_files,
    search_datasets,
)
from app.processing.encode_image import encode_bgr_for_download
from app.processing.io_image import ImageDecodeError, decode_image_bytes
from app.schemas import (
    KaggleDatasetSummary,
    KaggleFileInfo,
    KaggleFileListResponse,
    KaggleImageResponse,
    KaggleSearchResponse,
)

router = APIRouter(prefix="/kaggle", tags=["kaggle"])

# Slug-safe to keep weird URL characters out of upstream calls.
_SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,99}$")


def _kaggle_creds(
    x_kaggle_username: str | None = Header(default=None, alias="X-Kaggle-Username"),
    x_kaggle_key: str | None = Header(default=None, alias="X-Kaggle-Key"),
) -> KaggleCreds:
    if not x_kaggle_username or not x_kaggle_key:
        raise HTTPException(
            status_code=400,
            detail=(
                "Missing Kaggle credentials. Open the Datasets page and connect your "
                "Kaggle account first (X-Kaggle-Username / X-Kaggle-Key)."
            ),
        )
    return KaggleCreds(username=x_kaggle_username.strip(), key=x_kaggle_key.strip())


def _validate_slug(part: str, label: str) -> None:
    if not _SLUG_RE.match(part):
        raise HTTPException(status_code=400, detail=f"Invalid {label}: {part!r}")


def _map_kaggle_error(e: Exception) -> HTTPException:
    if isinstance(e, KaggleAuthError):
        return HTTPException(status_code=401, detail=str(e))
    if isinstance(e, KaggleNotFound):
        return HTTPException(status_code=404, detail=str(e))
    if isinstance(e, KaggleError):
        return HTTPException(status_code=502, detail=str(e))
    return HTTPException(status_code=500, detail=str(e))


@router.get("/datasets/{owner}/{name}/files", response_model=KaggleFileListResponse)
def list_files(
    owner: str,
    name: str,
    _user_id: str = Depends(require_user),
    creds: KaggleCreds = Depends(_kaggle_creds),
) -> KaggleFileListResponse:
    _validate_slug(owner, "owner")
    _validate_slug(name, "dataset name")
    try:
        files = list_dataset_files(owner, name, creds)
    except Exception as e:  # noqa: BLE001
        raise _map_kaggle_error(e) from e

    return KaggleFileListResponse(
        owner=owner,
        name=name,
        files=[KaggleFileInfo(**f) for f in files],
    )


@router.get("/datasets/{owner}/{name}/file", response_model=KaggleImageResponse)
def get_file(
    owner: str,
    name: str,
    path: str = Query(..., description="File path inside the dataset"),
    _user_id: str = Depends(require_user),
    creds: KaggleCreds = Depends(_kaggle_creds),
) -> KaggleImageResponse:
    """Download one image file and return it as base64 (JPEG/WebP/PNG when supported).

    The bytes are re-decoded through ``decode_image_bytes`` to enforce the same
    size / dimension limits as the rest of the API.
    """
    _validate_slug(owner, "owner")
    _validate_slug(name, "dataset name")

    if not path or ".." in path:
        raise HTTPException(status_code=400, detail="Invalid file path")

    try:
        data = download_dataset_file(
            owner,
            name,
            path,
            creds,
            max_bytes=settings.max_image_bytes,
        )
    except Exception as e:  # noqa: BLE001
        raise _map_kaggle_error(e) from e

    try:
        decoded = decode_image_bytes(
            data,
            max_bytes=settings.max_image_bytes,
            max_dimension=settings.max_image_dimension,
        )
    except ImageDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Selected file is not a supported image: {e}",
        ) from e

    try:
        out_bytes, out_mime = encode_bgr_for_download(decoded.bgr, filename=path, content_type=None)
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Failed to encode image") from None
    b64 = base64.b64encode(out_bytes).decode("ascii")

    return KaggleImageResponse(
        image_base64=b64,
        mime=out_mime,
        width=decoded.width,
        height=decoded.height,
        path=path,
    )


@router.get("/search", response_model=KaggleSearchResponse)
def search(
    q: str = Query(..., min_length=1, max_length=200, description="Search terms"),
    page: int = Query(1, ge=1, le=200),
    _user_id: str = Depends(require_user),
    creds: KaggleCreds = Depends(_kaggle_creds),
) -> KaggleSearchResponse:
    try:
        items = search_datasets(q, creds, page=page)
    except Exception as e:  # noqa: BLE001
        raise _map_kaggle_error(e) from e

    return KaggleSearchResponse(
        query=q,
        datasets=[KaggleDatasetSummary(**i) for i in items],
    )
