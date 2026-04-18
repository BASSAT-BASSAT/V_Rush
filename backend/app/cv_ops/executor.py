"""Execute validated pipelines on BGR images."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from app.cv_ops.mobile_sam import mobile_sam_segment_step
from app.cv_ops.registry import OPERATIONS
from app.cv_ops.validate import ValidatedPipeline
from app.cv_ops.yolo26 import yolo26_detect_step


@dataclass
class ExecutionResult:
    image_bgr: np.ndarray
    warnings: list[str] = field(default_factory=list)
    last_output_kind: str = "spatial"
    detections: list[dict[str, Any]] = field(default_factory=list)


def execute_pipeline(bgr: np.ndarray, validated: ValidatedPipeline) -> ExecutionResult:
    out = bgr.copy()
    warnings = list(validated.warnings)
    last_kind = "spatial"
    detections: list[dict[str, Any]] = []

    for op_id, params in validated.steps:
        spec = OPERATIONS[op_id]
        if op_id == "yolo26_detect":
            out, step_det = yolo26_detect_step(out, params)
            detections = step_det
        elif op_id == "mobile_sam":
            out, step_det = mobile_sam_segment_step(out, params)
            detections = step_det
        else:
            out = spec.apply(out, params)
        last_kind = spec.output_kind

        if out.dtype != np.uint8:
            out = np.clip(out, 0, 255).astype(np.uint8)
        if out.ndim == 2:
            out = cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)

    return ExecutionResult(
        image_bgr=out,
        warnings=warnings,
        last_output_kind=last_kind,
        detections=detections,
    )
