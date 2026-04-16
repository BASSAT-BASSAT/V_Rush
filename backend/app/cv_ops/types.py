"""Shared types for CV operations."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass(frozen=True)
class OpSpec:
    id: str
    label: str
    category: str
    description: str
    default_params: dict[str, Any]
    apply: Callable[[np.ndarray, dict[str, Any]], np.ndarray]
    validate_params: Callable[[dict[str, Any]], dict[str, Any]]
    """Returns normalized params; raises ValueError on invalid input."""
    output_kind: str = "spatial"  # spatial | spectrum
    param_help: dict[str, str] = field(default_factory=dict)  # param name -> UI/API help
    detail_doc: str = ""  # longer explanation for Reference UI
