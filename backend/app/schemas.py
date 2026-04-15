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


class OpsListResponse(BaseModel):
    ops: list[OpInfo]


class ProcessResponse(BaseModel):
    image_base64: str
    mime: str = "image/png"
    warnings: list[str] = Field(default_factory=list)
    width: int
    height: int
    pipeline_applied: list[dict[str, Any]]
    last_output_kind: str = "spatial"
