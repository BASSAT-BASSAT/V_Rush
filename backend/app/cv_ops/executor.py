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
    # Last MobileSAM binary mask (0/255) at SAM input resolution, if mobile_sam ran.
    sam_mask_u8: np.ndarray | None = None
    # BGR image fed into the last mobile_sam step (for client-side mask refine compose).
    sam_subject_bgr: np.ndarray | None = None


def execute_pipeline(bgr: np.ndarray, validated: ValidatedPipeline) -> ExecutionResult:
    out = bgr.copy()
    warnings = list(validated.warnings)
    last_kind = "spatial"
    detections: list[dict[str, Any]] = []
    sam_mask_u8: np.ndarray | None = None
    sam_subject_bgr: np.ndarray | None = None

    for op_id, params in validated.steps:
        spec = OPERATIONS[op_id]
        if op_id == "yolo26_detect":
            out, step_det = yolo26_detect_step(out, params)
            detections = step_det
        elif op_id == "mobile_sam":
            sam_subject_bgr = out.copy()
            out, step_det, mask_u8 = mobile_sam_segment_step(out, params)
            detections = step_det
            sam_mask_u8 = mask_u8
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
        sam_mask_u8=sam_mask_u8,
        sam_subject_bgr=sam_subject_bgr,
    )
