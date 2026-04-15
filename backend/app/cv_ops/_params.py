"""Shared parameter helpers."""

from __future__ import annotations


def odd_kernel(k: int, lo: int = 1, hi: int = 31) -> int:
    k = int(k)
    if k % 2 == 0:
        k += 1
    return max(lo, min(hi, k))


def clamp_int(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, int(v)))


def clamp_float(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(v)))
