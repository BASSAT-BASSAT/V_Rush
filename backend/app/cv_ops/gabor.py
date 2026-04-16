"""Gabor filter bank — oriented band-pass filtering for texture and edges."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float, odd_kernel


def _to_bgr_mag(mag: np.ndarray) -> np.ndarray:
    mag = cv2.normalize(np.abs(mag), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.cvtColor(mag, cv2.COLOR_GRAY2BGR)


def apply_gabor(bgr: np.ndarray, params: dict) -> np.ndarray:
    k = odd_kernel(int(params.get("ksize", 21)), 5, 51)
    sigma = clamp_float(params.get("sigma", 4.0), 0.5, 20.0)
    theta = clamp_float(params.get("theta_deg", 0.0), 0.0, 180.0)
    lambd = clamp_float(params.get("lambda", 10.0), 1.0, 100.0)
    gamma = clamp_float(params.get("gamma", 0.5), 0.1, 2.0)
    psi = clamp_float(params.get("psi_deg", 0.0), -180.0, 180.0)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    kern = cv2.getGaborKernel(
        (k, k),
        sigma,
        np.deg2rad(theta),
        lambd,
        gamma,
        np.deg2rad(psi),
        ktype=cv2.CV_32F,
    )
    resp = cv2.filter2D(gray, cv2.CV_32F, kern)
    return _to_bgr_mag(resp)


def validate_gabor(p: dict) -> dict:
    return {
        "ksize": odd_kernel(int(p.get("ksize", 21)), 5, 51),
        "sigma": clamp_float(p.get("sigma", 4.0), 0.5, 20.0),
        "theta_deg": clamp_float(p.get("theta_deg", 0.0), 0.0, 180.0),
        "lambda": clamp_float(p.get("lambda", 10.0), 1.0, 100.0),
        "gamma": clamp_float(p.get("gamma", 0.5), 0.1, 2.0),
        "psi_deg": clamp_float(p.get("psi_deg", 0.0), -180.0, 180.0),
    }


GABOR_SPECS: list[dict] = [
    {
        "id": "gabor",
        "label": "Gabor filter",
        "category": "texture",
        "description": (
            "Real Gabor response (abs normalized); σ, θ, λ, γ, ψ per OpenCV getGaborKernel."
        ),
        "default_params": {
            "ksize": 21,
            "sigma": 4.0,
            "theta_deg": 0.0,
            "lambda": 10.0,
            "gamma": 0.5,
            "psi_deg": 0.0,
        },
        "apply": apply_gabor,
        "validate_params": validate_gabor,
    },
]
