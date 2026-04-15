"""Human-readable help for each operation and its JSON params (API + UI)."""

from __future__ import annotations

# op_id -> param_name -> short explanation
OP_PARAM_HELP: dict[str, dict[str, str]] = {
    "normalize_minmax": {},
    "equalize_histogram": {},
    "clahe": {
        "clip_limit": (
            "CLAHE contrast clipping limit; higher = stronger local contrast (can amplify noise)."
        ),
        "tile_grid_size": "Grid cell size for local histogram equalization (pixels per tile side).",
    },
    "gamma": {
        "gamma": (
            "Power-law V^γ per channel: γ>1 darkens mid-tones, γ<1 brightens, γ=1 is linear."
        ),
    },
    "invert": {},
    "threshold_binary": {
        "thresh": "Grayscale threshold 0–255; pixels above → white, below → black.",
    },
    "threshold_otsu": {},
    "threshold_adaptive_mean": {
        "block_size": "Odd window size for local mean (neighborhood size in pixels).",
        "C": "Constant subtracted from the mean before comparison (fine-tunes boundary).",
    },
    "threshold_adaptive_gaussian": {
        "block_size": "Odd window size for weighted local neighborhood.",
        "C": "Constant subtracted from the weighted sum (fine-tunes boundary).",
    },
    "to_grayscale": {},
    "color_hsv_roundtrip": {},
    "color_lab_roundtrip": {},
    "color_ycrcb_roundtrip": {},
    "channel_gains": {
        "b": "Multiplier for the blue channel (BGR order).",
        "g": "Multiplier for the green channel.",
        "r": "Multiplier for the red channel.",
    },
    "gaussian_blur": {
        "ksize": "Odd kernel width/height in pixels; larger = stronger low-pass blur.",
        "sigma": "Gaussian standard deviation; 0 means derive from ksize.",
    },
    "box_blur": {
        "ksize": "Odd kernel size; normalized averaging over a k×k square.",
    },
    "median_blur": {
        "ksize": (
            "Odd aperture size; each pixel becomes neighborhood median (good for salt-and-pepper)."
        ),
    },
    "bilateral_filter": {
        "d": "Diameter of pixel neighborhood; larger = stronger edge-aware smoothing.",
        "sigma_color": "Filter sigma in color space; larger = more mixing of nearby colors.",
        "sigma_space": "Filter sigma in coordinate space; larger = influence of farther pixels.",
    },
    "unsharp_mask": {
        "sigma": "Gaussian blur sigma used to build the low-frequency component.",
        "amount": "Strength of sharpening (weight on high-frequency detail added back).",
    },
    "sobel_magnitude": {
        "ksize": "Derivative aperture: 1, 3, 5, or 7.",
    },
    "scharr_magnitude": {},
    "laplacian": {
        "ksize": "Second-derivative aperture size (odd, typically 3).",
    },
    "canny": {
        "threshold1": "First hysteresis threshold (lower of the two).",
        "threshold2": "Second hysteresis threshold (edges stronger than this are strong edges).",
    },
    "morph_erode": {
        "ksize": "Odd structuring element size (pixels).",
        "kernel_shape": "rect (default), ellipse, or cross.",
    },
    "morph_dilate": {
        "ksize": "Odd structuring element size (pixels).",
        "kernel_shape": "rect, ellipse, or cross.",
    },
    "morph_open": {
        "ksize": "Odd structuring element size (pixels).",
        "kernel_shape": "rect, ellipse, or cross.",
    },
    "morph_close": {
        "ksize": "Odd structuring element size (pixels).",
        "kernel_shape": "rect, ellipse, or cross.",
    },
    "morph_gradient": {
        "ksize": "Odd structuring element size (pixels).",
        "kernel_shape": "rect, ellipse, or cross.",
    },
    "morph_tophat": {
        "ksize": "Odd structuring element size (pixels).",
        "kernel_shape": "rect, ellipse, or cross.",
    },
    "morph_blackhat": {
        "ksize": "Odd structuring element size (pixels).",
        "kernel_shape": "rect, ellipse, or cross.",
    },
    "resize": {
        "mode": 'Either "scale" (relative) or "absolute" (explicit width/height).',
        "scale": "Scale factor relative to current size (mode=scale).",
        "width": "Target width in pixels (mode=absolute).",
        "height": "Target height in pixels (mode=absolute).",
    },
    "rotate": {
        "angle_deg": "Counter-clockwise rotation in degrees about image center.",
        "scale": "Isotropic scale applied with the rotation.",
    },
    "pyramid_down": {},
    "pyramid_up": {},
    "crop_fraction": {
        "x0": "Left edge of crop as fraction of width [0,1].",
        "y0": "Top edge of crop as fraction of height [0,1].",
        "x1": "Right edge of crop as fraction of width [0,1].",
        "y1": "Bottom edge of crop as fraction of height [0,1].",
    },
    "add_gaussian_noise": {
        "sigma": "Standard deviation of additive Gaussian noise (per channel, 0 = none).",
    },
    "add_salt_pepper": {
        "ratio": "Fraction of pixels corrupted (half salt, half pepper).",
    },
    "nl_means_gray": {
        "h": "Filter strength; higher = more denoising (may blur detail).",
        "template_window_size": "Patch size for similarity (odd).",
        "search_window_size": "Search region size for similar patches (odd).",
    },
    "nl_means_color": {
        "h": "Luminance filter strength.",
        "h_color": "Color component strength for chrominance denoising.",
        "template_window_size": "Patch size for similarity (odd).",
        "search_window_size": "Search region size (odd).",
    },
    "dft_magnitude_spectrum": {},
    "dft_phase_spectrum": {},
    "frequency_gaussian_lowpass": {
        "sigma_frequency": (
            "Gaussian width in frequency bins; larger keeps more lows → stronger spatial blur."
        ),
    },
    "frequency_gaussian_highpass": {
        "sigma_frequency": ("High-pass Gaussian width; smaller σ → more highs (sharper, noisier)."),
    },
}
