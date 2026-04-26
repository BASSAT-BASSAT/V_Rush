"""DFT / FFT-based visualization and frequency-domain filtering."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv_ops._params import clamp_float, clamp_int


def _gray_float(bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)


def _pad_dft(gray: np.ndarray) -> np.ndarray:
    h, w = gray.shape
    ph, pw = cv2.getOptimalDFTSize(h), cv2.getOptimalDFTSize(w)
    return cv2.copyMakeBorder(gray, 0, ph - h, 0, pw - w, cv2.BORDER_CONSTANT)


def _spectrum_to_bgr(gray_u8: np.ndarray, spectrum_display: str) -> np.ndarray:
    if spectrum_display == "gray":
        return cv2.cvtColor(gray_u8, cv2.COLOR_GRAY2BGR)
    return cv2.applyColorMap(gray_u8, cv2.COLORMAP_JET)


def apply_dft_magnitude_spectrum(bgr: np.ndarray, params: dict) -> np.ndarray:
    """Log magnitude of shifted DFT; optional JET colormap or grayscale."""
    sd = str(params.get("spectrum_display", "jet")).lower()
    gray = _gray_float(bgr)
    padded = _pad_dft(gray)
    dft = cv2.dft(padded, flags=cv2.DFT_COMPLEX_OUTPUT)
    shifted = np.fft.fftshift(dft)
    mag = cv2.magnitude(shifted[:, :, 0], shifted[:, :, 1])
    mag = np.log(mag + 1e-6)
    mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return _spectrum_to_bgr(mag, sd)


def apply_dft_phase_spectrum(bgr: np.ndarray, params: dict) -> np.ndarray:
    sd = str(params.get("spectrum_display", "jet")).lower()
    gray = _gray_float(bgr)
    padded = _pad_dft(gray)
    dft = cv2.dft(padded, flags=cv2.DFT_COMPLEX_OUTPUT)
    shifted = np.fft.fftshift(dft)
    phase = np.arctan2(shifted[:, :, 1], shifted[:, :, 0])
    ph = cv2.normalize(phase, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return _spectrum_to_bgr(ph, sd)


def _distance_grid(shape: tuple[int, int]) -> np.ndarray:
    h, w = shape
    cy, cx = h // 2, w // 2
    y, x = np.ogrid[:h, :w]
    return np.sqrt((x - cx) ** 2 + (y - cy) ** 2).astype(np.float32)


def _gaussian_mask(shape: tuple[int, int], sigma: float, *, high_pass: bool) -> np.ndarray:
    d = _distance_grid(shape)
    g = np.exp(-(d**2) / (2 * sigma**2)).astype(np.float32)
    if high_pass:
        return (1.0 - g).astype(np.float32)
    return g


def _gaussian_band_mask(
    shape: tuple[int, int], center_frequency: float, bandwidth: float, *, reject: bool
) -> np.ndarray:
    d = _distance_grid(shape)
    bw = max(bandwidth, 1e-6)
    band = np.exp(-((d - center_frequency) ** 2) / (2 * bw**2)).astype(np.float32)
    if reject:
        return (1.0 - band).astype(np.float32)
    return band


def _ideal_mask(shape: tuple[int, int], d0: float, *, high_pass: bool) -> np.ndarray:
    d = _distance_grid(shape)
    m = (d <= d0).astype(np.float32)
    if high_pass:
        return (1.0 - m).astype(np.float32)
    return m


def _ideal_band_mask(
    shape: tuple[int, int], center_frequency: float, bandwidth: float, *, reject: bool
) -> np.ndarray:
    d = _distance_grid(shape)
    half_bw = max(bandwidth / 2.0, 0.5)
    lo = max(center_frequency - half_bw, 0.0)
    hi = center_frequency + half_bw
    pass_band = ((d >= lo) & (d <= hi)).astype(np.float32)
    if reject:
        return (1.0 - pass_band).astype(np.float32)
    return pass_band


def _butterworth_mask(
    shape: tuple[int, int], d0: float, order: int, *, high_pass: bool
) -> np.ndarray:
    d = _distance_grid(shape)
    # Low-pass Butterworth: 1 / (1 + (D/D0)^(2n)); d0 already clamped >= 1.
    lp = 1.0 / (1.0 + (d / max(d0, 1e-6)) ** (2 * order))
    lp = lp.astype(np.float32)
    if high_pass:
        return (1.0 - lp).astype(np.float32)
    return lp


def _butterworth_band_mask(
    shape: tuple[int, int],
    center_frequency: float,
    bandwidth: float,
    order: int,
    *,
    reject: bool,
) -> np.ndarray:
    d = _distance_grid(shape)
    bw = max(bandwidth, 1e-6)
    denom = (d**2) - (center_frequency**2)
    denom = np.where(np.abs(denom) < 1e-6, np.sign(denom) * 1e-6 + 1e-6, denom)
    core = np.abs((d * bw) / denom) ** (2 * order)
    reject_mask = 1.0 / (1.0 + core)
    reject_mask = reject_mask.astype(np.float32)
    if reject:
        return reject_mask
    return (1.0 - reject_mask).astype(np.float32)


def _apply_freq_mask(bgr: np.ndarray, mask: np.ndarray, *, oh: int, ow: int) -> np.ndarray:
    gray = _gray_float(bgr)
    padded = _pad_dft(gray)
    dft = cv2.dft(padded, flags=cv2.DFT_COMPLEX_OUTPUT)
    shifted = np.fft.fftshift(dft)
    shifted[:, :, 0] *= mask
    shifted[:, :, 1] *= mask
    unshifted = np.fft.ifftshift(shifted)
    img = cv2.idft(unshifted)
    img = cv2.magnitude(img[:, :, 0], img[:, :, 1])
    img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    img = img[:oh, :ow]
    return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)


def _padded_shape(bgr: np.ndarray) -> tuple[int, int, int, int]:
    oh, ow = bgr.shape[:2]
    ph = cv2.getOptimalDFTSize(oh)
    pw = cv2.getOptimalDFTSize(ow)
    return oh, ow, ph, pw


def _freq_filter_spatial(bgr: np.ndarray, params: dict, *, high_pass: bool) -> np.ndarray:
    max_sig = min(bgr.shape[0], bgr.shape[1]) / 2
    sigma = clamp_float(params.get("sigma_frequency", 30.0), 1.0, max_sig)
    oh, ow, ph, pw = _padded_shape(bgr)
    mask = _gaussian_mask((ph, pw), sigma, high_pass=high_pass)
    return _apply_freq_mask(bgr, mask, oh=oh, ow=ow)


def apply_frequency_gaussian_lp(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_filter_spatial(bgr, params, high_pass=False)


def apply_frequency_gaussian_hp(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_filter_spatial(bgr, params, high_pass=True)


def _cutoff(params: dict, bgr: np.ndarray) -> float:
    max_d0 = max(1.0, min(bgr.shape[0], bgr.shape[1]) / 2)
    return clamp_float(params.get("cutoff_frequency", 30.0), 1.0, max_d0)


def _freq_ideal(bgr: np.ndarray, params: dict, *, high_pass: bool) -> np.ndarray:
    d0 = _cutoff(params, bgr)
    oh, ow, ph, pw = _padded_shape(bgr)
    mask = _ideal_mask((ph, pw), d0, high_pass=high_pass)
    return _apply_freq_mask(bgr, mask, oh=oh, ow=ow)


def _freq_butterworth(bgr: np.ndarray, params: dict, *, high_pass: bool) -> np.ndarray:
    d0 = _cutoff(params, bgr)
    order = clamp_int(params.get("order", 2), 1, 10)
    oh, ow, ph, pw = _padded_shape(bgr)
    mask = _butterworth_mask((ph, pw), d0, order, high_pass=high_pass)
    return _apply_freq_mask(bgr, mask, oh=oh, ow=ow)


def _band_center(params: dict, bgr: np.ndarray) -> float:
    max_c = max(1.0, min(bgr.shape[0], bgr.shape[1]) / 2)
    return clamp_float(params.get("center_frequency", 30.0), 1.0, max_c)


def _band_width(params: dict, bgr: np.ndarray) -> float:
    max_bw = max(1.0, min(bgr.shape[0], bgr.shape[1]) / 2)
    return clamp_float(params.get("bandwidth", 20.0), 1.0, max_bw)


def _freq_ideal_band(bgr: np.ndarray, params: dict, *, reject: bool) -> np.ndarray:
    center = _band_center(params, bgr)
    width = _band_width(params, bgr)
    oh, ow, ph, pw = _padded_shape(bgr)
    mask = _ideal_band_mask((ph, pw), center, width, reject=reject)
    return _apply_freq_mask(bgr, mask, oh=oh, ow=ow)


def _freq_gaussian_band(bgr: np.ndarray, params: dict, *, reject: bool) -> np.ndarray:
    center = _band_center(params, bgr)
    width = _band_width(params, bgr)
    oh, ow, ph, pw = _padded_shape(bgr)
    mask = _gaussian_band_mask((ph, pw), center, width, reject=reject)
    return _apply_freq_mask(bgr, mask, oh=oh, ow=ow)


def _freq_butterworth_band(bgr: np.ndarray, params: dict, *, reject: bool) -> np.ndarray:
    center = _band_center(params, bgr)
    width = _band_width(params, bgr)
    order = clamp_int(params.get("order", 2), 1, 10)
    oh, ow, ph, pw = _padded_shape(bgr)
    mask = _butterworth_band_mask((ph, pw), center, width, order, reject=reject)
    return _apply_freq_mask(bgr, mask, oh=oh, ow=ow)


def apply_frequency_ideal_lp(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_ideal(bgr, params, high_pass=False)


def apply_frequency_ideal_hp(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_ideal(bgr, params, high_pass=True)


def apply_frequency_butterworth_lp(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_butterworth(bgr, params, high_pass=False)


def apply_frequency_butterworth_hp(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_butterworth(bgr, params, high_pass=True)


def apply_frequency_ideal_bandpass(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_ideal_band(bgr, params, reject=False)


def apply_frequency_ideal_bandreject(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_ideal_band(bgr, params, reject=True)


def apply_frequency_gaussian_bandpass(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_gaussian_band(bgr, params, reject=False)


def apply_frequency_gaussian_bandreject(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_gaussian_band(bgr, params, reject=True)


def apply_frequency_butterworth_bandpass(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_butterworth_band(bgr, params, reject=False)


def apply_frequency_butterworth_bandreject(bgr: np.ndarray, params: dict) -> np.ndarray:
    return _freq_butterworth_band(bgr, params, reject=True)


def validate_sigma_frq(p: dict) -> dict:
    return {"sigma_frequency": clamp_float(p.get("sigma_frequency", 30.0), 1.0, 2000.0)}


def validate_cutoff(p: dict) -> dict:
    return {"cutoff_frequency": clamp_float(p.get("cutoff_frequency", 30.0), 1.0, 2000.0)}


def validate_cutoff_order(p: dict) -> dict:
    return {
        "cutoff_frequency": clamp_float(p.get("cutoff_frequency", 30.0), 1.0, 2000.0),
        "order": clamp_int(p.get("order", 2), 1, 10),
    }


def validate_band(p: dict) -> dict:
    return {
        "center_frequency": clamp_float(p.get("center_frequency", 30.0), 1.0, 2000.0),
        "bandwidth": clamp_float(p.get("bandwidth", 20.0), 1.0, 2000.0),
    }


def validate_band_order(p: dict) -> dict:
    return {
        "center_frequency": clamp_float(p.get("center_frequency", 30.0), 1.0, 2000.0),
        "bandwidth": clamp_float(p.get("bandwidth", 20.0), 1.0, 2000.0),
        "order": clamp_int(p.get("order", 2), 1, 10),
    }


def validate_spectrum_display(p: dict) -> dict:
    raw = str(p.get("spectrum_display", "jet")).lower()
    sd = "gray" if raw == "gray" else "jet"
    return {"spectrum_display": sd}


FOURIER_SPECS: list[dict] = [
    {
        "id": "dft_magnitude_spectrum",
        "label": "DFT magnitude (spectrum view)",
        "category": "fourier",
        "description": "Log magnitude of 2D DFT (visualization, not spatial image).",
        "default_params": {"spectrum_display": "jet"},
        "apply": apply_dft_magnitude_spectrum,
        "validate_params": validate_spectrum_display,
        "output_kind": "spectrum",
        "detail_doc": (
            "Shows the magnitude of the 2D discrete Fourier transform after fftshift, with "
            "log scaling: log(|F| + eps) then min-max to 8-bit. Low frequencies appear at the "
            "center after shifting. Use spectrum_display \"gray\" for true grayscale; \"jet\" "
            "applies a false-color map to emphasize weak vs strong bins."
        ),
        "param_help": {
            "spectrum_display": (
                "\"jet\" (default) false-color visualization, or \"gray\" for grayscale output."
            ),
        },
    },
    {
        "id": "dft_phase_spectrum",
        "label": "DFT phase (spectrum view)",
        "category": "fourier",
        "description": "Phase of 2D DFT (visualization).",
        "default_params": {"spectrum_display": "jet"},
        "apply": apply_dft_phase_spectrum,
        "validate_params": validate_spectrum_display,
        "output_kind": "spectrum",
        "detail_doc": (
            "Phase angle atan2(imag, real) of the complex spectrum after fftshift, normalized "
            "to 0–255 for display. This is not the spatial image; it encodes where each "
            "frequency component sits in the complex plane."
        ),
        "param_help": {
            "spectrum_display": (
                "\"jet\" (default) false-color visualization, or \"gray\" for grayscale output."
            ),
        },
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
        "detail_doc": (
            "Applies a Gaussian low-pass mask centered on DC in the shifted spectrum, then "
            "inverse DFT. sigma_frequency controls the cutoff (wider mask = more low "
            "frequencies kept). Output is a real spatial magnitude image as BGR."
        ),
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
        "detail_doc": (
            "Uses 1 minus a Gaussian centered on DC so low frequencies are attenuated and "
            "edges/detail are emphasized. Inverse DFT returns a spatial high-pass result."
        ),
    },
    {
        "id": "frequency_ideal_lowpass",
        "label": "Ideal low-pass (frequency)",
        "category": "fourier",
        "description": (
            "Hard-cutoff disk mask in frequency domain: pass frequencies within radius D0."
        ),
        "default_params": {"cutoff_frequency": 30.0},
        "apply": apply_frequency_ideal_lp,
        "validate_params": validate_cutoff,
        "output_kind": "spatial",
        "detail_doc": (
            "Builds a binary mask that is 1 inside a disk of radius cutoff_frequency around DC "
            "and 0 outside, multiplies the shifted spectrum, then inverse DFT. The sharp cutoff "
            "produces visible ringing artifacts (Gibbs phenomenon) in the spatial output — it is "
            "useful as a teaching reference but Butterworth/Gaussian are preferred in practice."
        ),
    },
    {
        "id": "frequency_ideal_highpass",
        "label": "Ideal high-pass (frequency)",
        "category": "fourier",
        "description": "High-pass via 1−ideal disk mask in frequency domain.",
        "default_params": {"cutoff_frequency": 30.0},
        "apply": apply_frequency_ideal_hp,
        "validate_params": validate_cutoff,
        "output_kind": "spatial",
        "detail_doc": (
            "Inverse of the ideal low-pass: zeros out a disk of radius cutoff_frequency around "
            "DC and keeps everything else. Emphasizes edges and fine detail but, like its "
            "low-pass counterpart, introduces ringing due to the hard boundary in frequency."
        ),
    },
    {
        "id": "frequency_butterworth_lowpass",
        "label": "Butterworth low-pass (frequency)",
        "category": "fourier",
        "description": (
            "Butterworth low-pass H = 1/(1 + (D/D0)^(2n)) applied in the frequency domain."
        ),
        "default_params": {"cutoff_frequency": 30.0, "order": 2},
        "apply": apply_frequency_butterworth_lp,
        "validate_params": validate_cutoff_order,
        "output_kind": "spatial",
        "detail_doc": (
            "Applies the Butterworth transfer function H(u,v) = 1 / (1 + (D/D0)^(2n)) to the "
            "shifted spectrum, then inverse DFT. cutoff_frequency sets D0 (the -3 dB-like "
            "radius), and order controls how sharp the transition is: n=1 is very smooth (close "
            "to Gaussian), higher n approaches the ideal filter with more ringing."
        ),
    },
    {
        "id": "frequency_butterworth_highpass",
        "label": "Butterworth high-pass (frequency)",
        "category": "fourier",
        "description": "High-pass via 1−Butterworth mask in frequency domain.",
        "default_params": {"cutoff_frequency": 30.0, "order": 2},
        "apply": apply_frequency_butterworth_hp,
        "validate_params": validate_cutoff_order,
        "output_kind": "spatial",
        "detail_doc": (
            "High-pass counterpart built as 1 minus the Butterworth low-pass. Low frequencies "
            "near DC are smoothly attenuated and higher frequencies pass through. Increase "
            "order for a steeper low/high transition; decrease it for a gentler roll-off."
        ),
    },
    {
        "id": "frequency_ideal_bandpass",
        "label": "Ideal band-pass (frequency)",
        "category": "fourier",
        "description": "Pass only a hard annulus around center_frequency.",
        "default_params": {"center_frequency": 30.0, "bandwidth": 20.0},
        "apply": apply_frequency_ideal_bandpass,
        "validate_params": validate_band,
        "output_kind": "spatial",
        "detail_doc": (
            "Builds a binary annulus mask (ring) around DC and keeps only frequencies within "
            "that band. center_frequency is ring radius, bandwidth is ring thickness. Because "
            "the transition is hard-edged, spatial ringing is expected."
        ),
    },
    {
        "id": "frequency_ideal_bandreject",
        "label": "Ideal band-reject (frequency)",
        "category": "fourier",
        "description": "Reject a hard annulus around center_frequency.",
        "default_params": {"center_frequency": 30.0, "bandwidth": 20.0},
        "apply": apply_frequency_ideal_bandreject,
        "validate_params": validate_band,
        "output_kind": "spatial",
        "detail_doc": (
            "Inverse of ideal band-pass: zeros out frequencies in an annulus and keeps low + "
            "high frequencies outside it. Useful to suppress a narrow radial band but still "
            "prone to Gibbs ringing due to abrupt boundaries."
        ),
    },
    {
        "id": "frequency_gaussian_bandpass",
        "label": "Gaussian band-pass (frequency)",
        "category": "fourier",
        "description": "Gaussian ring pass filter around center_frequency.",
        "default_params": {"center_frequency": 30.0, "bandwidth": 20.0},
        "apply": apply_frequency_gaussian_bandpass,
        "validate_params": validate_band,
        "output_kind": "spatial",
        "detail_doc": (
            "Uses a smooth Gaussian ring in frequency space centered at center_frequency. "
            "bandwidth controls spread of the ring. This produces a softer transition than "
            "ideal band-pass, usually with less ringing."
        ),
    },
    {
        "id": "frequency_gaussian_bandreject",
        "label": "Gaussian band-reject (frequency)",
        "category": "fourier",
        "description": "Gaussian notch ring reject around center_frequency.",
        "default_params": {"center_frequency": 30.0, "bandwidth": 20.0},
        "apply": apply_frequency_gaussian_bandreject,
        "validate_params": validate_band,
        "output_kind": "spatial",
        "detail_doc": (
            "Complement of Gaussian band-pass: smoothly attenuates frequencies near the chosen "
            "ring and keeps frequencies far from that band. Preferred over ideal reject when "
            "you want fewer spatial artifacts."
        ),
    },
    {
        "id": "frequency_butterworth_bandpass",
        "label": "Butterworth band-pass (frequency)",
        "category": "fourier",
        "description": "Butterworth ring pass with tunable order.",
        "default_params": {"center_frequency": 30.0, "bandwidth": 20.0, "order": 2},
        "apply": apply_frequency_butterworth_bandpass,
        "validate_params": validate_band_order,
        "output_kind": "spatial",
        "detail_doc": (
            "Band-pass Butterworth response centered at center_frequency with finite "
            "bandwidth. order controls transition steepness: low order gives smooth roll-off, "
            "high order approaches ideal ring behavior."
        ),
    },
    {
        "id": "frequency_butterworth_bandreject",
        "label": "Butterworth band-reject (frequency)",
        "category": "fourier",
        "description": "Butterworth ring reject with tunable order.",
        "default_params": {"center_frequency": 30.0, "bandwidth": 20.0, "order": 2},
        "apply": apply_frequency_butterworth_bandreject,
        "validate_params": validate_band_order,
        "output_kind": "spatial",
        "detail_doc": (
            "Band-reject Butterworth filter that suppresses a ring around center_frequency. "
            "Compared with ideal reject, order lets you tune between gentle attenuation and a "
            "sharper notch."
        ),
    },
]
