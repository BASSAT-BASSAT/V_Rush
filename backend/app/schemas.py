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


class ProcessResponse(BaseModel):
    image_base64: str
    mime: str = "image/png"
    warnings: list[str] = Field(default_factory=list)
    width: int
    height: int
    pipeline_applied: list[dict[str, Any]]
    last_output_kind: str = "spatial"
    detections: list[DetectionItem] = Field(default_factory=list)
