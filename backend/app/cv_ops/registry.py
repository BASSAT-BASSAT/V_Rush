"""Register all operations."""

from __future__ import annotations

from typing import Any

from app.cv_ops.color import COLOR_SPECS
from app.cv_ops.denoise import DENOISE_SPECS
from app.cv_ops.dog import DOG_SPECS
from app.cv_ops.edges import EDGES_SPECS
from app.cv_ops.fourier import FOURIER_SPECS
from app.cv_ops.gabor import GABOR_SPECS
from app.cv_ops.geometric import GEOMETRIC_SPECS
from app.cv_ops.glcm import GLCM_SPECS
from app.cv_ops.intensity import INTENSITY_SPECS
from app.cv_ops.lbp import LBP_SPECS
from app.cv_ops.linear import LINEAR_SPECS
from app.cv_ops.log import LOG_SPECS
from app.cv_ops.morph_hat import MORPH_HAT_SPECS
from app.cv_ops.morphology_ops import MORPH_SPECS
from app.cv_ops.noise import NOISE_SPECS
from app.cv_ops.param_help import OP_PARAM_HELP
from app.cv_ops.types import OpSpec

_RAW: list[dict[str, Any]] = (
    INTENSITY_SPECS
    + COLOR_SPECS
    + LINEAR_SPECS
    + EDGES_SPECS
    + LOG_SPECS
    + DOG_SPECS
    + MORPH_SPECS
    + MORPH_HAT_SPECS
    + GEOMETRIC_SPECS
    + NOISE_SPECS
    + DENOISE_SPECS
    + FOURIER_SPECS
    + LBP_SPECS
    + GLCM_SPECS
    + GABOR_SPECS
)


def _build() -> dict[str, OpSpec]:
    out: dict[str, OpSpec] = {}
    for raw in _RAW:
        oid = raw["id"]
        if oid in out:
            raise ValueError(f"Duplicate op id: {oid}")
        apply_fn = raw["apply"]
        param_help = {**OP_PARAM_HELP.get(oid, {}), **raw.get("param_help", {})}
        out[oid] = OpSpec(
            id=oid,
            label=raw["label"],
            category=raw["category"],
            description=raw["description"],
            default_params=dict(raw["default_params"]),
            apply=apply_fn,
            validate_params=raw["validate_params"],
            output_kind=str(raw.get("output_kind", "spatial")),
            param_help=param_help,
            detail_doc=str(raw.get("detail_doc", "")),
        )
    return out


OPERATIONS: dict[str, OpSpec] = _build()


def list_ops_public() -> list[dict[str, Any]]:
    """Serializable op list for GET /api/ops."""
    items = []
    for spec in sorted(OPERATIONS.values(), key=lambda s: (s.category, s.label)):
        detail = spec.detail_doc.strip() or spec.description
        items.append(
            {
                "id": spec.id,
                "label": spec.label,
                "category": spec.category,
                "description": spec.description,
                "default_params": spec.default_params,
                "output_kind": spec.output_kind,
                "param_help": spec.param_help,
                "detail_doc": detail,
            }
        )
    return items
