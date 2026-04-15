"""Execute validated pipelines on BGR images."""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np

from app.cv_ops.registry import OPERATIONS
from app.cv_ops.validate import ValidatedPipeline


@dataclass
class ExecutionResult:
    image_bgr: np.ndarray
    warnings: list[str] = field(default_factory=list)
    last_output_kind: str = "spatial"


def execute_pipeline(bgr: np.ndarray, validated: ValidatedPipeline) -> ExecutionResult:
    out = bgr.copy()
    warnings = list(validated.warnings)
    last_kind = "spatial"

    for op_id, params in validated.steps:
        spec = OPERATIONS[op_id]
        out = spec.apply(out, params)
        last_kind = spec.output_kind

        if out.dtype != np.uint8:
            out = np.clip(out, 0, 255).astype(np.uint8)
        if out.ndim == 2:
            out = cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)

    return ExecutionResult(image_bgr=out, warnings=warnings, last_output_kind=last_kind)
