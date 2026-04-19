"""API schemas for KernelLab."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PipelineStepIn(BaseModel):
    op: str
    params: dict[str, Any] = Field(default_factory=dict)


class OpInfo(BaseModel):
    id: str
    label: str
    category: str
    description: str
    default_params: dict[str, Any]
    output_kind: str = "spatial"
    param_help: dict[str, str] = Field(default_factory=dict)
    detail_doc: str = ""


class OpsListResponse(BaseModel):
    ops: list[OpInfo]


class DetectionItem(BaseModel):
    label: str
    confidence: float
    bbox: list[float] = Field(
        ...,
        description="Axis-aligned box [x1, y1, x2, y2] in pixels for the image YOLO saw.",
        min_length=4,
        max_length=4,
    )


class ImageStats(BaseModel):
    histogram_gray: list[int] = Field(..., description="256-bin luma histogram.")
    histogram_rgb: dict[str, list[int]] = Field(
        ..., description='Per-channel 256-bin histograms: {"r", "g", "b"}.'
    )
    mean: list[float] = Field(
        ..., min_length=3, max_length=3, description="Mean per channel [r,g,b]."
    )
    std: list[float] = Field(..., min_length=3, max_length=3)
    min: list[int] = Field(..., min_length=3, max_length=3)
    max: list[int] = Field(..., min_length=3, max_length=3)
    width: int
    height: int


class ProcessResponse(BaseModel):
    image_base64: str
    mime: str = "image/png"
    warnings: list[str] = Field(default_factory=list)
    width: int
    height: int
    pipeline_applied: list[dict[str, Any]]
    last_output_kind: str = "spatial"
    detections: list[DetectionItem] = Field(default_factory=list)
    before_stats: ImageStats | None = None
    after_stats: ImageStats | None = None


# =========================
# MATCHER ( /match )
# =========================

class MatchOptions(BaseModel):
    algo: str = Field(default="sift", description="One of: sift, orb, akaze, brisk")
    matcher: str = Field(default="bf", description="One of: bf, flann")
    use_ratio_test: bool = True
    ratio: float = Field(default=0.75, ge=0.5, le=0.95)
    top_n: int = Field(default=50, ge=1, le=1000)
    max_features: int = Field(default=2000, ge=0, le=20000)
    estimate_homography: bool = True
    ransac_thresh: float = Field(default=4.0, ge=0.5, le=20.0)
    overlay: bool = False
    overlay_alpha: float = Field(default=0.5, ge=0.0, le=1.0)


class MatchStats(BaseModel):
    keypoints_a: int
    keypoints_b: int
    raw_matches: int
    good_matches: int
    inliers: int
    inlier_ratio: float
    avg_distance: float
    elapsed_ms: float
    algo: str
    matcher: str


class MatchResponse(BaseModel):
    match_image_base64: str
    overlay_image_base64: str | None = None
    mime: str = "image/png"
    width: int
    height: int
    homography: list[list[float]] | None = None
    stats: MatchStats
    warnings: list[str] = Field(default_factory=list)


class MatcherAlgoInfo(BaseModel):
    id: str
    label: str
    kind: str  # currently always "classical"
    descriptor: str
    sub: str


class MatcherCapabilities(BaseModel):
    algos: list[MatcherAlgoInfo]


# =========================
# KAGGLE ( /kaggle/* )
# =========================

class KaggleFileInfo(BaseModel):
    path: str = Field(..., description="File path inside the dataset")
    size: int = Field(default=0, description="File size in bytes (0 if unknown)")
    is_image: bool = False
    is_archive: bool = False


class KaggleFileListResponse(BaseModel):
    owner: str
    name: str
    files: list[KaggleFileInfo]


class KaggleImageResponse(BaseModel):
    image_base64: str
    mime: str = "image/png"
    width: int
    height: int
    path: str


class KaggleDatasetSummary(BaseModel):
    ref: str = Field(..., description='"owner/name" slug')
    title: str
    subtitle: str = ""
    last_updated: str = ""
    download_count: int = 0
    vote_count: int = 0
    url: str = ""


class KaggleSearchResponse(BaseModel):
    query: str
    datasets: list[KaggleDatasetSummary]
