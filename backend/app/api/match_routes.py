"""V-Rush API: local feature matcher endpoint."""

from __future__ import annotations

import base64
import json
import time
from typing import Any

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth_deps import require_user
from app.config import settings
from app.cv_ops.deep_matchers import DeepMatcherUnavailable, deep_matchers_available
from app.cv_ops.matchers import (
    detect_and_describe,
    draw_matches,
    estimate_homography,
    match_descriptors,
    warp_overlay,
)
from app.processing.io_image import ImageDecodeError, decode_image_bytes
from app.schemas import (
    MatchOptions,
    MatchResponse,
    MatchStats,
    MatcherAlgoInfo,
    MatcherCapabilities,
)

router = APIRouter(tags=["matcher"])


_CLASSICAL_ALGOS = {"sift", "orb", "akaze", "brisk"}
_DEEP_ALGOS = {"disk", "aliked"}
_ALLOWED_ALGOS = _CLASSICAL_ALGOS | _DEEP_ALGOS
_ALLOWED_MATCHERS = {"bf", "flann"}


def _png_b64(bgr) -> str:
    ok, buf = cv2.imencode(".png", bgr)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode image")
    return base64.b64encode(buf.tobytes()).decode("ascii")


@router.post("/match", response_model=MatchResponse)
async def match_images(
    _user_id: str = Depends(require_user),
    image_a: UploadFile = File(...),
    image_b: UploadFile = File(...),
    options: str = Form(default="{}"),
) -> MatchResponse:
    """Detect features in two images and visualize matches between them."""

    try:
        opts_raw: dict[str, Any] = json.loads(options or "{}")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid options JSON: {e}") from e

    try:
        opts = MatchOptions(**opts_raw)
    except Exception as e:  # noqa: BLE001 - re-raise as 400
        raise HTTPException(status_code=400, detail=f"Invalid options: {e}") from e

    if opts.algo.lower() not in _ALLOWED_ALGOS:
        raise HTTPException(status_code=400, detail=f"Unsupported algorithm: {opts.algo}")
    if opts.matcher.lower() not in _ALLOWED_MATCHERS:
        raise HTTPException(status_code=400, detail=f"Unsupported matcher: {opts.matcher}")

    a_bytes = await image_a.read()
    b_bytes = await image_b.read()

    try:
        dec_a = decode_image_bytes(
            a_bytes,
            max_bytes=settings.max_image_bytes,
            max_dimension=settings.max_image_dimension,
        )
        dec_b = decode_image_bytes(
            b_bytes,
            max_bytes=settings.max_image_bytes,
            max_dimension=settings.max_image_dimension,
        )
    except ImageDecodeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    warnings: list[str] = []
    t0 = time.perf_counter()

    try:
        a = detect_and_describe(dec_a.bgr, opts.algo, max_features=opts.max_features)
        b = detect_and_describe(dec_b.bgr, opts.algo, max_features=opts.max_features)
    except DeepMatcherUnavailable as e:
        # Friendly 503 instead of a 500 stack trace when kornia/torch are missing.
        raise HTTPException(status_code=503, detail=str(e)) from e

    if not a.keypoints or not b.keypoints:
        warnings.append("One of the images produced no keypoints; try another algorithm.")

    mr = match_descriptors(
        a.descriptors,
        b.descriptors,
        matcher=opts.matcher,
        algo=opts.algo,
        use_ratio_test=opts.use_ratio_test,
        ratio=opts.ratio,
    )

    homography = None
    inlier_mask = None
    inliers = 0
    if opts.estimate_homography and len(mr.good) >= 4:
        hr = estimate_homography(
            mr.good,
            a.keypoints,
            b.keypoints,
            ransac_thresh=opts.ransac_thresh,
        )
        if hr.H is not None:
            homography = hr.H.tolist()
            inlier_mask = hr.inlier_mask
            inliers = hr.inliers
        else:
            warnings.append("RANSAC could not find a stable homography.")

    match_img = draw_matches(
        dec_a.bgr,
        a.keypoints,
        dec_b.bgr,
        b.keypoints,
        mr.good,
        inlier_mask=inlier_mask,
        top_n=opts.top_n,
    )

    overlay_b64: str | None = None
    if opts.overlay and homography is not None:
        try:
            ov = warp_overlay(
                dec_a.bgr,
                dec_b.bgr,
                hr.H,  # type: ignore[union-attr]
                alpha=opts.overlay_alpha,
            )
            overlay_b64 = _png_b64(ov)
        except cv2.error as e:
            warnings.append(f"Overlay failed: {e}")

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    avg_distance = (
        float(sum(d.distance for d in mr.good) / len(mr.good)) if mr.good else 0.0
    )
    inlier_ratio = (inliers / len(mr.good)) if mr.good else 0.0

    stats = MatchStats(
        keypoints_a=len(a.keypoints),
        keypoints_b=len(b.keypoints),
        raw_matches=mr.raw_count,
        good_matches=len(mr.good),
        inliers=inliers,
        inlier_ratio=round(inlier_ratio, 4),
        avg_distance=round(avg_distance, 4),
        elapsed_ms=round(elapsed_ms, 2),
        algo=opts.algo,
        matcher=opts.matcher,
    )

    h, w = match_img.shape[:2]
    return MatchResponse(
        match_image_base64=_png_b64(match_img),
        overlay_image_base64=overlay_b64,
        mime="image/png",
        width=w,
        height=h,
        homography=homography,
        stats=stats,
        warnings=warnings,
    )


# Static catalog used by the frontend to render algorithm pills with the right
# label, kind ("classical" / "deep") and per-algo blurb.
_ALGO_CATALOG: list[MatcherAlgoInfo] = [
    MatcherAlgoInfo(
        id="sift",
        label="SIFT",
        kind="classical",
        descriptor="float (128-d)",
        sub="Scale-Invariant Feature Transform — gold standard, slowest but most robust to scale + rotation.",
    ),
    MatcherAlgoInfo(
        id="orb",
        label="ORB",
        kind="classical",
        descriptor="binary (256-bit)",
        sub="Oriented FAST + BRIEF — extremely fast, rotation invariant, weak under big scale changes.",
    ),
    MatcherAlgoInfo(
        id="akaze",
        label="AKAZE",
        kind="classical",
        descriptor="float (M-LDB)",
        sub="Accelerated KAZE in nonlinear scale space — sharper edges than SIFT, similar accuracy.",
    ),
    MatcherAlgoInfo(
        id="brisk",
        label="BRISK",
        kind="classical",
        descriptor="binary (512-bit)",
        sub="Multi-scale FAST corners with rotation-invariant binary descriptor — fast and free.",
    ),
    MatcherAlgoInfo(
        id="disk",
        label="DISK",
        kind="deep",
        descriptor="float (128-d, learned)",
        sub="Learned local features (Tyszkiewicz et al. 2020). Stronger under heavy viewpoint / illumination change.",
    ),
    MatcherAlgoInfo(
        id="aliked",
        label="ALIKED",
        kind="deep",
        descriptor="float (128-d, learned)",
        sub="ALIKED-N16 — lighter deep detector with deformable descriptors, fast on CPU.",
    ),
]


@router.get("/match/algos", response_model=MatcherCapabilities)
def match_algos() -> MatcherCapabilities:
    """Return which local matchers this build supports.

    Classical algos (SIFT/ORB/AKAZE/BRISK) are always available via OpenCV.
    Deep algos (DISK/ALIKED) require the optional ``kornia`` + ``torch``
    install — ``deep_available`` flips on once those packages are present.
    """
    deep_ok, deep_reason = deep_matchers_available()
    return MatcherCapabilities(
        algos=_ALGO_CATALOG,
        deep_available=deep_ok,
        deep_reason=deep_reason,
    )
