"""DFT / FFT-based visualization and frequency-domain filtering."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float


def _gray_float(bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)


def _pad_dft(gray: np.ndarray) -> np.ndarray:
    h, w = gray.shape
    ph, pw = cv2.getOptimalDFTSize(h), cv2.getOptimalDFTSize(w)
    return cv2.copyMakeBorder(gray, 0, ph - h, 0, pw - w, cv2.BORDER_CONSTANT)


def apply_dft_magnitude_spectrum(bgr: np.ndarray, _params: dict) -> np.ndarray:
    """Log magnitude of shifted DFT (color-mapped for display)."""
    gray = _gray_float(bgr)
    padded = _pad_dft(gray)
    dft = cv2.dft(padded, flags=cv2.DFT_COMPLEX_OUTPUT)
    shifted = np.fft.fftshift(dft)
    mag = cv2.magnitude(shifted[:, :, 0], shifted[:, :, 1])
    mag = np.log(mag + 1e-6)
    mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.applyColorMap(mag, cv2.COLORMAP_JET)


def apply_dft_phase_spectrum(bgr: np.ndarray, _params: dict) -> np.ndarray:
    gray = _gray_float(bgr)
    padded = _pad_dft(gray)
    dft = cv2.dft(padded, flags=cv2.DFT_COMPLEX_OUTPUT)
    shifted = np.fft.fftshift(dft)
    phase = np.arctan2(shifted[:, :, 1], shifted[:, :, 0])
    ph = cv2.normalize(phase, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.applyColorMap(ph, cv2.COLORMAP_JET)


def _gaussian_mask(shape: tuple[int, int], sigma: float, *, high_pass: bool) -> np.ndarray:
    h, w = shape
    cy, cx = h // 2, w // 2
    y, x = np.ogrid[:h, :w]
    g = np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma**2))
    if high_pass:
        return 1.0 - g
    return g


def _freq_filter_spatial(bgr: np.ndarray, params: dict, *, high_pass: bool) -> np.ndarray:
    max_sig = min(bgr.shape[0], bgr.shape[1]) / 2
    sigma = clamp_float(params.get("sigma_frequency", 30.0), 1.0, max_sig)
    gray = _gray_float(bgr)
    oh, ow = gray.shape
    padded = _pad_dft(gray)
    h, w = padded.shape
    dft = cv2.dft(padded, flags=cv2.DFT_COMPLEX_OUTPUT)
    shifted = np.fft.fftshift(dft)
    mask = _gaussian_mask((h, w), sigma, high_pass=high_pass).astype(np.float32)
    shifted[:, :, 0] *= mask
    shifted[:, :, 1] *= mask
    unshifted = np.fft.ifftshift(shifted)
    img = cv2.idft(unshifted)
    img = cv2.magnitude(img[:, :, 0], img[:, :, 1])
    img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    img = img[:oh, :ow]
    return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)


def apply_frequency_gaussian_lp(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_filter_spatial(bgr, params, high_pass=False)


def apply_frequency_gaussian_hp(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_filter_spatial(bgr, params, high_pass=True)


def validate_sigma_frq(p: dict) -> dict:
    return {"sigma_frequency": clamp_float(p.get("sigma_frequency", 30.0), 1.0, 2000.0)}


FOURIER_SPECS: list[dict] = [
    {
        "id": "dft_magnitude_spectrum",
        "label": "DFT magnitude (spectrum view)",
        "category": "fourier",
        "description": "Log magnitude of 2D DFT (visualization, not spatial image).",
        "default_params": {},
        "apply": apply_dft_magnitude_spectrum,
        "validate_params": lambda p: dict(p),
        "output_kind": "spectrum",
    },
    {
        "id": "dft_phase_spectrum",
        "label": "DFT phase (spectrum view)",
        "category": "fourier",
        "description": "Phase of 2D DFT (visualization).",
        "default_params": {},
        "apply": apply_dft_phase_spectrum,
        "validate_params": lambda p: dict(p),
        "output_kind": "spectrum",
    },
    {
        "id": "frequency_gaussian_lowpass",
        "label": "Gaussian low-pass (frequency)",
        "category": "fourier",
        "description": (
            "Multiply spectrum by Gaussian mask, inverse DFT to spatial grayscale (as BGR)."
        ),
        "default_params": {"sigma_frequency": 30.0},
        "apply": apply_frequency_gaussian_lp,
        "validate_params": validate_sigma_frq,
        "output_kind": "spatial",
    },
    {
        "id": "frequency_gaussian_highpass",
        "label": "Gaussian high-pass (frequency)",
        "category": "fourier",
        "description": "High-pass via 1−Gaussian mask in frequency domain.",
        "default_params": {"sigma_frequency": 30.0},
        "apply": apply_frequency_gaussian_hp,
        "validate_params": validate_sigma_frq,
        "output_kind": "spatial",
    },
]
