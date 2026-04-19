"""Thin Kaggle REST client used by ``app/api/kaggle_routes.py``.

Kaggle's public REST API at ``https://www.kaggle.com/api/v1`` accepts HTTP
Basic auth (``username:key``). The downloads endpoint redirects to
``storage.googleapis.com`` — we follow redirects.

We never log or persist the API key; it lives only in the request scope.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

KAGGLE_API_BASE = "https://www.kaggle.com/api/v1"

IMAGE_EXTS: tuple[str, ...] = (
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
)

# Archives are listed by Kaggle but cannot be opened in V-Rush directly. We
# surface them in the file list with a helpful hint instead of crashing later.
ARCHIVE_EXTS: tuple[str, ...] = (
    ".zip",
    ".7z",
    ".rar",
    ".tar",
    ".gz",
    ".tgz",
    ".bz2",
)


class KaggleAuthError(Exception):
    """401/403 from Kaggle (bad creds or no access)."""


class KaggleNotFound(Exception):
    """404 from Kaggle (dataset or file does not exist)."""


class KaggleError(Exception):
    """Any other failure talking to Kaggle."""


@dataclass(frozen=True)
class KaggleCreds:
    username: str
    key: str

    def as_auth(self) -> tuple[str, str]:
        return (self.username, self.key)


def _check(resp: httpx.Response, *, file_path: str | None = None) -> None:
    if resp.status_code == 401 or resp.status_code == 403:
        raise KaggleAuthError(
            "Kaggle rejected the credentials. Open kaggle.com/settings, "
            "create a new API token, and paste it again on the Datasets page."
        )
    if resp.status_code == 404:
        if file_path:
            raise KaggleNotFound(
                f"Kaggle has no individual download for '{file_path}'. "
                "Many datasets are published as a single .zip — open the dataset "
                "on kaggle.com to confirm, or pick a dataset that lists loose "
                "image files (e.g. andrewmvd/dog-and-cat-detection)."
            )
        raise KaggleNotFound(
            "Kaggle returned 404 — check the dataset slug (owner/dataset-name)."
        )
    if resp.status_code >= 400:
        raise KaggleError(f"Kaggle returned {resp.status_code}: {resp.text[:200]}")


def _is_image(name: str) -> bool:
    n = name.lower()
    return n.endswith(IMAGE_EXTS)


def _is_archive(name: str) -> bool:
    n = name.lower()
    return n.endswith(ARCHIVE_EXTS)


def list_dataset_files(
    owner: str,
    name: str,
    creds: KaggleCreds,
    *,
    page_size: int = 200,
    timeout: float = 20.0,
) -> list[dict[str, Any]]:
    """Return the dataset's file metadata list.

    Each item: ``{"path": str, "size": int, "is_image": bool}``.
    """
    url = f"{KAGGLE_API_BASE}/datasets/list/{owner}/{name}"
    params = {"pageSize": page_size}
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        resp = client.get(url, params=params, auth=creds.as_auth())
    _check(resp)

    try:
        body = resp.json()
    except ValueError as e:
        raise KaggleError(f"Could not parse Kaggle response: {e}") from e

    raw = body.get("datasetFiles") if isinstance(body, dict) else None
    if not isinstance(raw, list):
        return []

    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        path = (
            item.get("name")
            or item.get("nameNullable")
            or item.get("ref")
            or ""
        )
        if not path:
            continue
        size_raw = item.get("totalBytes") or item.get("totalBytesNullable") or 0
        try:
            size = int(size_raw)
        except (TypeError, ValueError):
            size = 0
        path_str = str(path)
        out.append(
            {
                "path": path_str,
                "size": size,
                "is_image": _is_image(path_str),
                "is_archive": _is_archive(path_str),
            }
        )
    return out


def download_dataset_file(
    owner: str,
    name: str,
    file_path: str,
    creds: KaggleCreds,
    *,
    max_bytes: int,
    timeout: float = 60.0,
) -> bytes:
    """Download one file from a public Kaggle dataset.

    The Kaggle endpoint (``/datasets/download/{owner}/{slug}/{fileName}``)
    treats the file name as a single percent-encoded segment, so a path like
    ``train/cat.0.jpg`` must be sent as ``train%2Fcat.0.jpg``.

    Some datasets serve nested files via raw slashes instead — if the encoded
    form 404s we transparently retry with slashes preserved before giving up.

    Enforces ``max_bytes`` to keep us inside FastAPI/proxy limits.
    """
    if not file_path:
        raise KaggleError("file_path is required")

    encoded = quote(file_path, safe="")
    encoded_loose = quote(file_path, safe="/")

    candidates: list[str] = [
        f"{KAGGLE_API_BASE}/datasets/download/{owner}/{name}/{encoded}",
    ]
    if encoded_loose != encoded:
        candidates.append(
            f"{KAGGLE_API_BASE}/datasets/download/{owner}/{name}/{encoded_loose}"
        )

    last_404: KaggleNotFound | None = None
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for url in candidates:
            try:
                with client.stream("GET", url, auth=creds.as_auth()) as resp:
                    if resp.status_code == 404:
                        last_404 = KaggleNotFound(
                            f"Kaggle has no individual download for '{file_path}'. "
                            "This dataset is likely published as a single archive — "
                            "open it on kaggle.com to verify, or try a dataset that "
                            "lists loose image files."
                        )
                        continue
                    _check(resp, file_path=file_path)
                    chunks: list[bytes] = []
                    total = 0
                    for chunk in resp.iter_bytes(chunk_size=64 * 1024):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > max_bytes:
                            raise KaggleError(
                                f"File is larger than the {max_bytes // (1024 * 1024)} MB server limit; "
                                "pick a smaller image file."
                            )
                        chunks.append(chunk)
                    return b"".join(chunks)
            except (KaggleAuthError, KaggleError):
                raise
    if last_404 is not None:
        raise last_404
    raise KaggleError("Kaggle download failed for an unknown reason.")


def search_datasets(
    query: str,
    creds: KaggleCreds,
    *,
    page: int = 1,
    timeout: float = 20.0,
) -> list[dict[str, Any]]:
    url = f"{KAGGLE_API_BASE}/datasets/list"
    params = {"search": query, "page": page}
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        resp = client.get(url, params=params, auth=creds.as_auth())
    _check(resp)
    try:
        body = resp.json()
    except ValueError as e:
        raise KaggleError(f"Could not parse Kaggle response: {e}") from e

    if not isinstance(body, list):
        return []

    out: list[dict[str, Any]] = []
    for item in body:
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "ref": str(item.get("ref") or ""),
                "title": str(item.get("title") or item.get("titleNullable") or ""),
                "subtitle": str(item.get("subtitle") or item.get("subtitleNullable") or ""),
                "last_updated": str(item.get("lastUpdated") or ""),
                "download_count": int(item.get("downloadCount") or 0),
                "vote_count": int(item.get("voteCount") or 0),
                "url": str(item.get("url") or ""),
            }
        )
    return out
