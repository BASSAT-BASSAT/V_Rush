"""Human-readable help for each operation (params + reference copy).

Merged into OpSpec: OP_PARAM_HELP supplies JSON key hints; OP_DETAIL_DOC supplies
longer Reference text when a spec omits its own ``detail_doc``.
"""

from __future__ import annotations

# op_id -> param_name -> short explanation (palette + API hints)
OP_PARAM_HELP: dict[str, dict[str, str]] = {
    # —— Intensity ——
    "normalize_minmax": {},
    "equalize_histogram": {},
    "clahe": {
        "clip_limit": (
            "CLAHE clipping limit; higher = stronger local contrast (can amplify noise). Typical 1–4."
        ),
        "tile_grid_size": "Side length in pixels of each histogram tile (square grid). Smaller tiles = more local adaptation.",
    },
    "gamma": {
        "gamma": "Output ≈ input^γ on 8-bit channels. γ<1 brightens mid-tones, γ>1 darkens, γ=1 unchanged.",
    },
    "invert": {},
    "log_transform": {},
    "inverse_log_transform": {},
    "threshold_binary": {
        "thresh": "Fixed threshold on grayscale (0–255): pixels above → 255, below → 0; output 3-channel BGR.",
    },
    "threshold_otsu": {},
    "adaptive_mean": {
        "block_size": "Odd neighborhood size (pixels) for the local mean. Larger = smoother threshold surface.",
        "C": "Constant subtracted from the local mean before comparison; more positive → fewer white pixels.",
    },
    "adaptive_gaussian": {
        "block_size": "Odd window size for Gaussian-weighted local mean.",
        "C": "Subtracted from the weighted sum; tunes how aggressive the binarization is.",
    },
    "solarize": {
        "threshold": "Intensity threshold: values below stay as-is; at/above are reflected as 255−I (per channel LUT).",
    },
    "posterize": {
        "levels": "Number of discrete intensity levels per channel (2–64); lower = more banding.",
    },
    "threshold_ext": {
        "threshold": "Grayscale threshold for TRUNC or TOZERO modes.",
        "mode": '"truncate" (THRESH_TRUNC) caps highs at T, or "tozero" (THRESH_TOZERO) zeros below T.',
    },
    # —— Color ——
    "to_grayscale": {},
    "color_hsv_roundtrip": {},
    "color_lab_roundtrip": {},
    "color_ycrcb_roundtrip": {},
    "channel_gains": {
        "b": "Multiply blue channel (BGR order). 1.0 = no change.",
        "g": "Multiply green channel.",
        "r": "Multiply red channel.",
    },
    "extract_channel": {
        "channel": "0=blue, 1=green, 2=red; single channel replicated to 3 BGR planes for display.",
    },
    "brightness_contrast": {
        "contrast": "Linear gain α in out = clip(α·src + β); 1.0 = unity contrast.",
        "brightness": "Additive offset β (−100 to 100) added after scaling.",
    },
    "color_threshold": {
        "min_blue": "Lower bound for B channel (inclusive).",
        "max_blue": "Upper bound for B channel (inclusive).",
        "min_green": "Lower bound for G channel.",
        "max_green": "Upper bound for G channel.",
        "min_red": "Lower bound for R channel.",
        "max_red": "Upper bound for R channel.",
    },
    # —— Linear ——
    "gaussian_blur": {
        "ksize": "Odd aperture size (pixels). Larger = stronger blur.",
        "sigma": "Gaussian σ; 0 lets OpenCV derive σ from ksize.",
    },
    "box_blur": {"ksize": "Odd kernel; each output pixel is the mean of a k×k neighborhood."},
    "median_blur": {
        "ksize": "Odd aperture; output is the median of the neighborhood (good for salt-and-pepper).",
    },
    "bilateral_filter": {
        "d": "Pixel neighborhood diameter; larger = stronger smoothing (slower).",
        "sigma_color": "How far colors are mixed in color space (larger = more mixing).",
        "sigma_space": "How far pixels influence each other spatially.",
    },
    "unsharp_mask": {
        "mode": '"additive" -> out = original + amount*edge, "multiplicative" -> out = original*(1 + amount*edge_norm).',
        "amount": "Sharpening gain applied to the edge mask.",
        "edge_source": '"sobel" gradient magnitude, "laplacian" second derivative, or "canny" binary edge map.',
        "canny_t1": "Lower Canny threshold used only when edge_source='canny'.",
        "canny_t2": "Upper Canny threshold used only when edge_source='canny'.",
    },
    # —— Edges ——
    "sobel_magnitude": {
        "ksize": "Sobel aperture: 1, 3, 5, or 7 (odd).",
    },
    "scharr_magnitude": {},
    "laplacian": {
        "ksize": "Aperture for discrete Laplacian (odd); often 3.",
    },
    "canny": {
        "threshold1": "Lower hysteresis threshold; weak edges above this can attach to strong edges.",
        "threshold2": "Upper threshold; strong edges must exceed this.",
    },
    "prewitt": {},
    "roberts": {},
    "directional_gradient": {
        "axis": '"x" for vertical edges (dx), "y" for horizontal edges (dy), via Sobel.',
        "ksize": "Sobel aperture (odd, 1–7).",
    },
    "log": {
        "sigma": "Gaussian blur σ before Laplacian; larger = blob/edge response at coarser scale.",
        "laplacian_ksize": "Discrete Laplacian kernel size (odd); typically 3.",
    },
    "dog": {
        "sigma1": "Narrower Gaussian (smaller σ).",
        "sigma2": "Wider Gaussian; must be > sigma1; difference emphasizes mid-frequency detail.",
    },
    # —— Texture ——
    "lbp": {},
    "glcm_contrast": {
        "patch_size": "Odd window used for each local GLCM; automatically limited to image size.",
        "levels": "Quantization levels for co-occurrence (8–64); lower = faster, coarser texture stats.",
    },
    "gabor": {
        "ksize": "Gabor kernel size (odd, pixels).",
        "sigma": "Gaussian envelope standard deviation in the filter plane.",
        "theta_deg": "Orientation of the normal to parallel stripes (degrees → radians in OpenCV).",
        "lambda": "Wavelength of the sinusoidal factor (OpenCV λ).",
        "gamma": "Spatial aspect ratio of the Gaussian (ellipticity).",
        "psi_deg": "Phase offset of the cosine factor inside the envelope.",
    },
    # —— Morphology ——
    "morph_erode": {
        "ksize": "Odd size of the structuring element (pixels).",
        "kernel_shape": '"rect", "ellipse", or "cross".',
    },
    "morph_dilate": {
        "ksize": "Odd structuring element size.",
        "kernel_shape": '"rect", "ellipse", or "cross".',
    },
    "morph_open": {
        "ksize": "Odd structuring element size.",
        "kernel_shape": "Shape of the structuring element.",
    },
    "morph_close": {
        "ksize": "Odd structuring element size.",
        "kernel_shape": "Shape of the structuring element.",
    },
    "morph_gradient": {
        "ksize": "Odd structuring element size.",
        "kernel_shape": "Shape of the structuring element.",
    },
    "morph_tophat": {
        "ksize": "Odd structuring element; sets scale of bright details extracted.",
        "kernel_shape": "Structuring element shape.",
    },
    "morph_blackhat": {
        "ksize": "Odd structuring element; sets scale of dark details extracted.",
        "kernel_shape": "Structuring element shape.",
    },
    # —— Geometric ——
    "flip": {
        "mode": '"horizontal" (lr), "vertical" (ud), or "both".',
    },
    "translate": {
        "tx": "Shift in pixels along x (positive = right). Clamped to image width.",
        "ty": "Shift in pixels along y (positive = down). Clamped to image height.",
    },
    "shear": {
        "shear_x": "Horizontal shear coefficient in the affine matrix (see warpAffine).",
        "shear_y": "Vertical shear coefficient.",
    },
    "resize": {
        "mode": '"scale" uses relative factor, "absolute" uses width/height in pixels.',
        "scale": "Isotropic scale factor when mode=scale (e.g. 0.5 = half size).",
        "width": "Target width when mode=absolute.",
        "height": "Target height when mode=absolute.",
    },
    "rotate": {
        "angle_deg": "Counter-clockwise rotation about image center.",
        "scale": "Isotropic scale applied with the rotation matrix.",
    },
    "pyramid_down": {},
    "pyramid_up": {},
    "crop_fraction": {
        "x0": "Left crop edge as fraction of width [0,1].",
        "y0": "Top crop edge as fraction of height [0,1].",
        "x1": "Right crop edge as fraction of width (must be > x0).",
        "y1": "Bottom crop edge as fraction of height (must be > y0).",
    },
    # —— Noise / denoise ——
    "add_gaussian_noise": {
        "sigma": "Std dev of Gaussian noise per channel (0 = skip).",
    },
    "add_salt_pepper": {
        "ratio": "Fraction of pixels randomized (half salt, half pepper).",
    },
    "nl_means_gray": {
        "h": "Filter strength for luminance; higher = more denoising.",
        "template_window_size": "Patch size for similarity (odd).",
        "search_window_size": "Neighborhood searched for similar patches (odd).",
    },
    "nl_means_color": {
        "h": "Luminance component filter strength.",
        "h_color": "Color component strength for chrominance.",
        "template_window_size": "Patch size (odd).",
        "search_window_size": "Search window size (odd).",
    },
    # —— Fourier (defaults also in spec param_help) ——
    "dft_magnitude_spectrum": {
        "spectrum_display": '"jet" false-color or "gray" grayscale spectrum.',
    },
    "dft_phase_spectrum": {
        "spectrum_display": '"jet" or "gray" for phase visualization.',
    },
    "frequency_gaussian_lowpass": {
        "sigma_frequency": "Gaussian width in frequency bins (centered on DC); larger = milder blur.",
    },
    "frequency_gaussian_highpass": {
        "sigma_frequency": "Controls high-pass width; smaller σ keeps more high frequencies (sharper, noisier).",
    },
    "frequency_ideal_lowpass": {
        "cutoff_frequency": "Radius D0 (in frequency bins) of the pass disk centered on DC; smaller = stronger blur.",
    },
    "frequency_ideal_highpass": {
        "cutoff_frequency": "Radius D0 of the stopped disk centered on DC; larger = more low frequencies removed.",
    },
    "frequency_butterworth_lowpass": {
        "cutoff_frequency": "Butterworth cutoff radius D0 (frequency bins) where H ≈ 0.5; smaller = stronger blur.",
        "order": "Filter order n (1–10); higher = sharper transition closer to an ideal filter (more ringing).",
    },
    "frequency_butterworth_highpass": {
        "cutoff_frequency": "Butterworth high-pass cutoff radius D0; larger = more low frequencies removed.",
        "order": "Filter order n (1–10); higher = sharper low-to-high transition (more ringing).",
    },
    "frequency_ideal_bandpass": {
        "center_frequency": "Radius of the ring center in frequency bins from DC.",
        "bandwidth": "Ring thickness in frequency bins.",
    },
    "frequency_ideal_bandreject": {
        "center_frequency": "Radius of rejected ring center in frequency bins from DC.",
        "bandwidth": "Ring thickness to attenuate.",
    },
    "frequency_gaussian_bandpass": {
        "center_frequency": "Center of Gaussian ring in frequency bins.",
        "bandwidth": "Gaussian spread (sigma) around the ring center.",
    },
    "frequency_gaussian_bandreject": {
        "center_frequency": "Center of Gaussian notch ring in frequency bins.",
        "bandwidth": "Width of frequencies attenuated around the ring center.",
    },
    "frequency_butterworth_bandpass": {
        "center_frequency": "Butterworth ring center frequency in bins.",
        "bandwidth": "Band width around center frequency.",
        "order": "Filter order n (1–10); higher gives steeper transition.",
    },
    "frequency_butterworth_bandreject": {
        "center_frequency": "Butterworth reject ring center frequency in bins.",
        "bandwidth": "Rejected band width around center frequency.",
        "order": "Filter order n (1–10); higher gives steeper notch edges.",
    },
    # —— Detection (YOLO26) ——
    "yolo26_detect": {
        "conf": "Minimum confidence in [0, 1]. Higher = fewer boxes.",
        "classes": 'Optional COCO filter, e.g. ["person"] or [0]; omit or [] for all classes.',
        "max_det": "Upper bound on how many boxes are returned.",
        "draw": "Draw boxes and labels on the pipeline image for the preview.",
    },
    # —— Segmentation ——
    "kmeans": {
        "k": "Number of clusters (dominant colors) in [2, 32]. Small k = strong posterization.",
    },
    "watershed": {
        "threshold": (
            "Seed threshold (0–255) passed to Otsu's INV binarization. Usually 127 works; "
            "tune if objects are very dark or very bright."
        ),
    },
    "grabcut": {
        "iterations": "GrabCut iterations (1–10). More iterations = cleaner mask, slower.",
        "margin_percent": (
            "Inset of the rectangle prompt on each side, as a percent of image size (1–40). "
            "10% works well for centered subjects; reduce for larger subjects."
        ),
    },
    "connected_blobs": {
        "threshold": "Grayscale threshold (1–254) for binarization before blob labelling.",
    },
    "mobile_sam": {
        "prompt_type": '"point" (single click) or "box" (rectangle).',
        "point_x_frac": "Foreground point x as a fraction of image width (0–1). Ignored for box prompts.",
        "point_y_frac": "Foreground point y as a fraction of image height (0–1). Ignored for box prompts.",
        "point_label": "1 = foreground point, 0 = background point (subtract from mask).",
        "box_x1_frac": "Left edge of box prompt as x-fraction (0–1).",
        "box_y1_frac": "Top edge of box prompt as y-fraction (0–1).",
        "box_x2_frac": "Right edge of box prompt as x-fraction (0–1).",
        "box_y2_frac": "Bottom edge of box prompt as y-fraction (0–1).",
        "output": '"overlay" (translucent color + contour), "cutout" (mask as alpha), or "mask" (B/W only).',
    },
}

# Longer Reference text when spec has no detail_doc (or empty). Multi-paragraph welcome.
OP_DETAIL_DOC: dict[str, str] = {
    "normalize_minmax": (
        "Converts the image to grayscale, applies min–max normalization so the darkest pixel becomes "
        "0 and the brightest 255, then expands back to three identical BGR channels. Use when you want "
        "full dynamic range without changing color ratios (color is discarded)."
    ),
    "equalize_histogram": (
        "Runs histogram equalization on the luminance (Y) channel in YCrCb while preserving chroma, "
        "then converts back to BGR. Often improves global contrast on underexposed images; can amplify "
        "noise in flat regions."
    ),
    "clahe": (
        "Contrast Limited Adaptive Histogram Equalization on the L channel in LAB space. clip_limit caps "
        "how much each tile can amplify contrast; tile_grid_size sets local neighborhood size. Good for "
        "uneven lighting without blowing out small hot spots as much as global equalize."
    ),
    "gamma": (
        "Applies a per-channel LUT: output ≈ (input/255)^γ × 255. Values below 1 brighten shadows; above "
        "1 darken mid-tones. This is independent per BGR channel in the implementation."
    ),
    "invert": "Bitwise NOT on each 8-bit channel (photographic negative).",
    "log_transform": (
        "Compresses dynamic range with a log-like curve so dark regions gain more separation. Inverse "
        "is available as inverse_log_transform for experimentation (not necessarily a perfect inverse "
        "for all images)."
    ),
    "inverse_log_transform": "Approximately reverses the app’s log transform using an exponential LUT.",
    "threshold_binary": (
        "Single global threshold on grayscale: above thresh → white, below → black. Output is 3-channel "
        "BGR with identical bands for compatibility with the rest of the pipeline."
    ),
    "threshold_otsu": "Otsu’s method chooses a threshold by minimizing intra-class variance on the gray histogram.",
    "adaptive_mean": (
        "Each pixel is compared to the mean of an odd block_size neighborhood, minus C. Handles uneven "
        "illumination better than global threshold; block_size should be larger than the features you "
        "want to segment."
    ),
    "adaptive_gaussian": (
        "Like adaptive mean but weights neighbors with a Gaussian window. Often smoother boundaries than "
        "plain mean when lighting gradients are present."
    ),
    "solarize": (
        "Solarization: builds a LUT that inverts intensities at or above the threshold (film-style "
        "sabattier effect). Lower threshold affects more of the image."
    ),
    "posterize": (
        "Quantizes each channel to `levels` steps by flooring to the nearest step. Fewer levels produce "
        "strong poster/banding art effects."
    ),
    "threshold_ext": (
        "Uses OpenCV THRESH_TRUNC (cap at threshold) or THRESH_TOZERO (zero below threshold) on "
        "grayscale, then expands to BGR. Mode is chosen with the `mode` parameter."
    ),
    "to_grayscale": "BGR to single-channel gray, then replicated to BGR for display.",
    "color_hsv_roundtrip": "Sanity / color-space path: BGR→HSV→BGR without intentional edits.",
    "color_lab_roundtrip": "BGR→LAB→BGR round-trip; small numerical differences are possible.",
    "color_ycrcb_roundtrip": "BGR→YCrCb→BGR round-trip; useful before/after luma-only ops in other tools.",
    "channel_gains": (
        "Multiplies B, G, R by separate gains (order is BGR). Values above 1 clip at 255; use for simple "
        "white balance or creative tinting."
    ),
    "extract_channel": (
        "Selects one BGR plane (0=B, 1=G, 2=R), displays it as a gray image copied to all three channels "
        "so the pipeline stays BGR."
    ),
    "brightness_contrast": (
        "cv2.convertScaleAbs: out = saturate_round(α·src + β). contrast is α, brightness is β. Clipping "
        "is per-channel."
    ),
    "color_threshold": (
        "cv2.inRange keeps pixels whose B, G, R values all lie within the min/max boxes (inclusive). "
        "Useful for crude color segmentation (e.g. green screen rough mask)."
    ),
    "gaussian_blur": (
        "Separable Gaussian blur. sigma=0 means OpenCV derives σ from ksize. Reduces noise and detail; "
        "larger ksize or σ = stronger low-pass."
    ),
    "box_blur": "Normalized box filter (mean); cheaper than Gaussian but stronger block artifacts.",
    "median_blur": (
        "Replaces each pixel with the median of an odd k×k window. Excellent for salt-and-pepper noise; "
        "preserves edges better than linear blur for impulse noise."
    ),
    "bilateral_filter": (
        "Edge-preserving smoothing: combines domain (distance) and range (color similarity) Gaussians. "
        "Slower than Gaussian blur but keeps sharp boundaries."
    ),
    "unsharp_mask": (
        "Edge-mask sharpening with two selectable formulas. additive mode computes out = original + "
        "amount * edge(original), while multiplicative mode computes out = original * (1 + amount * "
        "edge_norm(original)). edge_source chooses Sobel, Laplacian, or Canny as the mask generator."
    ),
    "sobel_magnitude": (
        "Sobel gradients Gx, Gy on grayscale, then magnitude sqrt(Gx²+Gy²), normalized for display as BGR. "
        "ksize sets derivative aperture."
    ),
    "scharr_magnitude": "3×3 Scharr derivatives (more accurate than 3×3 Sobel for the same size), magnitude shown.",
    "laplacian": (
        "Second derivative on grayscale (sign discarded in display via magnitude in this app). Sensitive "
        "to noise; often combine with Gaussian pre-blur elsewhere in the pipeline."
    ),
    "canny": (
        "Canny edge detector: gradient magnitude, non-max suppression, hysteresis with two thresholds. "
        "threshold2 should usually be higher than threshold1."
    ),
    "prewitt": "Prewitt operator magnitude (3×3 separable kernels), normalized for visualization.",
    "roberts": "Roberts cross operator on 2×2 neighborhoods; fast coarse edges.",
    "directional_gradient": (
        "Sobel along x or y only; absolute response shown. Use axis=\"x\" or \"y\" and ksize for aperture."
    ),
    "log": (
        "Laplacian of Gaussian: Gaussian blur at σ then Laplacian; magnitude shown. Responds to blobs "
        "and edges at a scale set by σ."
    ),
    "dog": (
        "Difference of Gaussians: |G(σ₂) − G(σ₁)| on luminance. Band-pass emphasis between two scales; "
        "increase separation between σ₁ and σ₂ for coarser features."
    ),
    "lbp": (
        "Classic 8-neighbor LBP: compare each neighbor to the center, pack 8 bits clockwise from top-left. "
        "Output is a texture label map (0–255) expanded to BGR."
    ),
    "glcm_contrast": (
        "For a grid of overlapping windows, computes GLCM contrast from horizontal pairs on quantized "
        "gray levels, then resizes the contrast map to full image size. Higher values indicate stronger "
        "local intensity contrast / texture."
    ),
    "gabor": (
        "Real Gabor filter: Gaussian envelope × cosine; orientation theta_deg, wavelength lambda, aspect "
        "gamma, phase psi_deg. Response magnitude is normalized for display. Tune theta to align with "
        "expected edge direction."
    ),
    "morph_erode": "Morphological erosion: local minimum under the structuring element (shrinks bright regions).",
    "morph_dilate": "Morphological dilation: local maximum (expands bright regions).",
    "morph_open": "Opening = erode then dilate; removes small bright specks smaller than the kernel.",
    "morph_close": "Closing = dilate then erode; fills small dark holes smaller than the kernel.",
    "morph_gradient": "Morphological gradient = dilate − erode (edge strength of the foreground at scale ksize).",
    "morph_tophat": "Top-hat = image − opening; highlights small bright details relative to the background.",
    "morph_blackhat": "Black-hat = closing − image; highlights small dark details.",
    "flip": "cv2.flip with code 1 (horizontal), 0 (vertical), or -1 (both).",
    "translate": "Integer pixel shift via affine warp; border not padded beyond image size (shift wraps within same canvas).",
    "shear": "Affine shear with coefficients shear_x, shear_y on normalized coordinates.",
    "resize": (
        "Either relative scale (same aspect) or absolute width×height. Uses INTER_AREA interpolation "
        "suited for downscaling."
    ),
    "rotate": (
        "Rotation about image center with optional uniform scale; border uses reflect padding. Angle is "
        "degrees counter-clockwise."
    ),
    "pyramid_down": "One level of Gaussian pyramid reduction (~half size).",
    "pyramid_up": "One level of pyramid expansion (~double size).",
    "crop_fraction": (
        "Crops using normalized [0,1] rectangle edges; invalid boxes (x1≤x0 or y1≤y0) return the original image."
    ),
    "add_gaussian_noise": "Adds Gaussian noise independently per BGR channel.",
    "add_salt_pepper": "Randomly sets a fraction of pixels to 0 or 255.",
    "nl_means_gray": (
        "Non-local means denoising on grayscale conversion. h controls denoising strength; larger windows "
        "find more matches but cost more time."
    ),
    "nl_means_color": "OpenCV fastNlMeansDenoisingColored with separate h and h_color.",
    "kmeans": (
        "Flattens pixels to (H·W, 3) and runs k-means (k-means++ seeding, 10 attempts) in RGB. "
        "Each pixel is replaced by its cluster center — a fast color-quantization / poster effect. "
        "Small k (2–6) for posterization, 8–16 for palette extraction."
    ),
    "watershed": (
        "Seeds a topographic flood: Otsu-threshold (inverted) on luma, morphological open, "
        "distance-transform peak as sure-foreground, connected-component labels as markers, "
        "cv2.watershed for the flood. The labeled regions are blended 50/50 with the source so "
        "edges are visible. Best for separating touching bright objects on a dark background."
    ),
    "grabcut": (
        "Graph-cut foreground extraction (Rother et al. 2004). A rectangle inset by "
        "margin_percent is treated as 'probably foreground', everything outside as background. "
        "Alternates Gaussian Mixture Model fitting and min-cut until convergence. Best for "
        "centered subjects; for anywhere-in-image prompts use the MobileSAM op instead."
    ),
    "connected_blobs": (
        "Thresholds the luma and labels 4-connected components. Each blob gets a stable "
        "pseudo-random color (background is black). Useful for counting objects or verifying "
        "that a prior thresholding step produced the expected islands."
    ),
    "mobile_sam": (
        "MobileSAM (Zhang et al. 2023) is a distilled Segment Anything model with a tiny ViT "
        "encoder. Runs as two ONNX sessions: a ~40 MB encoder turns the image into a 256-channel "
        "embedding, and a ~2 MB decoder combines that embedding with a point or box prompt to "
        "produce a mask. Click on the image in the studio to drop a foreground point; shift+click "
        "for a background point; drag for a box. Output can be an overlay, a cutout, or a raw "
        "black-and-white mask."
    ),
}
