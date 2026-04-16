"""Top-hat and black-hat morphology — isolate bright/dark details vs background."""

from __future__ import annotations

from app.cv_ops.morphology_ops import apply_morph, validate_morph

MORPH_HAT_SPECS: list[dict] = [
    {
        "id": "morph_tophat",
        "label": "Top-hat",
        "category": "morphology",
        "description": (
            "Top-hat: image − opening (bright details smaller than the structuring element)."
        ),
        "default_params": {"ksize": 5, "kernel_shape": "rect"},
        "apply": lambda img, par: apply_morph(img, par, "tophat"),
        "validate_params": validate_morph,
    },
    {
        "id": "morph_blackhat",
        "label": "Black-hat",
        "category": "morphology",
        "description": (
            "Black-hat: closing − image (dark details smaller than the structuring element)."
        ),
        "default_params": {"ksize": 5, "kernel_shape": "rect"},
        "apply": lambda img, par: apply_morph(img, par, "blackhat"),
        "validate_params": validate_morph,
    },
]
