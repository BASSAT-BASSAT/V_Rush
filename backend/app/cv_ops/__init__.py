"""Classical CV operation registry and pipeline execution."""

from app.cv_ops.executor import execute_pipeline
from app.cv_ops.registry import OPERATIONS, list_ops_public
from app.cv_ops.validate import validate_pipeline

__all__ = ["OPERATIONS", "execute_pipeline", "list_ops_public", "validate_pipeline"]
