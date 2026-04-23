"""Pipeline validation: params, soft warnings, deduplication."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.cv_ops.registry import OPERATIONS


@dataclass
class ValidatedPipeline:
    steps: list[tuple[str, dict]]
    warnings: list[str] = field(default_factory=list)


def validate_pipeline(raw_steps: list[dict]) -> ValidatedPipeline:
    """Validate op ids and params; emit warnings for redundancy and ordering hints."""
    warnings: list[str] = []
    steps: list[tuple[str, dict]] = []

    if not isinstance(raw_steps, list):
        raise ValueError("pipeline must be a JSON array")

    seen_equalize = False
    seen_clahe = False

    for i, step in enumerate(raw_steps):
        if not isinstance(step, dict):
            raise ValueError(f"pipeline[{i}] must be an object")
        op_id = step.get("op")
        if not op_id or not isinstance(op_id, str):
            raise ValueError(f"pipeline[{i}].op is required")
        if op_id not in OPERATIONS:
            raise ValueError(f"Unknown operation: {op_id}")

        spec = OPERATIONS[op_id]
        raw_params = step.get("params") or {}
        if not isinstance(raw_params, dict):
            raise ValueError(f"pipeline[{i}].params must be an object")

        try:
            params = spec.validate_params(raw_params)
        except Exception as e:
            raise ValueError(f"Invalid params for {op_id}: {e}") from e

        # Soft warnings
        if op_id == "equalize_histogram":
            if seen_equalize:
                warnings.append("Repeated histogram equalization is usually redundant.")
            seen_equalize = True
        if op_id == "clahe":
            if seen_clahe:
                warnings.append("Multiple CLAHE steps in a row may over-amplify noise.")
            if seen_equalize:
                warnings.append("CLAHE after global histogram equalize: consider using only one.")
            seen_clahe = True

        if i > 0:
            prev_id = steps[-1][0]
            if prev_id.startswith("frequency_") and op_id == "gaussian_blur":
                warnings.append(
                    "Spatial blur after frequency-domain filter: order may affect interpretation."
                )

        # Dedupe identical consecutive steps
        if steps and steps[-1][0] == op_id and steps[-1][1] == params:
            warnings.append(f"Skipped duplicate consecutive step: {op_id}")
            continue

        steps.append((op_id, params))

    return ValidatedPipeline(steps=steps, warnings=warnings)
