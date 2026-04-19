# -*- coding: utf-8 -*-
"""Local feature matchers: SIFT / ORB / AKAZE / BRISK + BF/FLANN + RANSAC homography.

Pure functions; the FastAPI route in ``app/api/match_routes.py`` orchestrates them.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np

Algo = Literal["sift", "orb", "akaze", "brisk", "disk", "aliked"]
MatcherKind = Literal["bf", "flann"]


# Float-descriptor algos use NORM_L2 + KDTree FLANN; binary algos use HAMMING + LSH FLANN.
_BINARY_ALGOS: set[str] = {"orb", "brisk"}
# Deep CNN-based algos always produce float descriptors and are matched with L2.
_DEEP_ALGOS: set[str] = {"disk", "aliked"}


def _is_binary(algo: str) -> bool:
    return algo in _BINARY_ALGOS


def _is_deep(algo: str) -> bool:
    return algo in _DEEP_ALGOS


def _make_detector(algo: str, *, max_features: int) -> cv2.Feature2D:
    """Build the OpenCV detector/descriptor for ``algo``.

    ``max_features`` only applies where the OpenCV constructor exposes it
    (SIFT, ORB). AKAZE and BRISK don't take an upper bound so we trim later.
    """
    a = algo.lower()
    if a == "sift":
        # SIFT is float128 descriptors; nfeatures=0 means unbounded.
        return cv2.SIFT_create(nfeatures=int(max_features) if max_features > 0 else 0)
    if a == "orb":
        return cv2.ORB_create(nfeatures=int(max_features) if max_features > 0 else 2000)
    if a == "akaze":
        return cv2.AKAZE_create()
    if a == "brisk":
        return cv2.BRISK_create()
    raise ValueError(f"Unknown algorithm: {algo}")


def _make_matcher(matcher: str, algo: str) -> cv2.DescriptorMatcher:
    m = matcher.lower()
    binary = _is_binary(algo)
    if m == "bf":
        norm = cv2.NORM_HAMMING if binary else cv2.NORM_L2
        # crossCheck=False because we use knnMatch+ratio test below.
        return cv2.BFMatcher(norm, crossCheck=False)
    if m == "flann":
        if binary:
            # LSH index for binary descriptors (ORB / BRISK).
            index_params = dict(
                algorithm=6,  # FLANN_INDEX_LSH
                table_number=6,
                key_size=12,
                multi_probe_level=1,
            )
        else:
            # KDTree for float descriptors (SIFT / AKAZE float).
            index_params = dict(algorithm=1, trees=5)  # FLANN_INDEX_KDTREE
        search_params = dict(checks=50)
        return cv2.FlannBasedMatcher(index_params, search_params)
    raise ValueError(f"Unknown matcher: {matcher}")


@dataclass
class DetectResult:
    keypoints: list[cv2.KeyPoint]
    descriptors: np.ndarray | None


def detect_and_describe(bgr: np.ndarray, algo: str, *, max_features: int = 0) -> DetectResult:
    a = algo.lower()
    if _is_deep(a):
        # Lazy import so the slim Vercel build that lacks kornia/torch still loads.
        from app.cv_ops.deep_matchers import detect_and_describe_deep

        out = detect_and_describe_deep(bgr, a, max_features=max_features or 2048)
        return DetectResult(keypoints=out.keypoints, descriptors=out.descriptors)

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    det = _make_detector(a, max_features=max_features)
    kps, desc = det.detectAndCompute(gray, None)
    if desc is None:
        return DetectResult(keypoints=list(kps or []), descriptors=None)
    # AKAZE descriptors are sometimes float, sometimes binary depending on config; for binary
    # algos we make sure descriptor dtype matches what the matcher expects.
    if _is_binary(algo) and desc.dtype != np.uint8:
        desc = desc.astype(np.uint8)
    elif not _is_binary(algo) and desc.dtype != np.float32:
        desc = desc.astype(np.float32)
    return DetectResult(keypoints=list(kps), descriptors=desc)


@dataclass
class MatchResult:
    """Final filtered matches plus diagnostics."""

    good: list[cv2.DMatch]
    raw_count: int


def match_descriptors(
    desc_a: np.ndarray | None,
    desc_b: np.ndarray | None,
    *,
    matcher: str,
    algo: str,
    use_ratio_test: bool,
    ratio: float,
) -> MatchResult:
    if desc_a is None or desc_b is None or len(desc_a) < 2 or len(desc_b) < 2:
        return MatchResult(good=[], raw_count=0)

    m = _make_matcher(matcher, algo)
    # knnMatch with k=2 lets us apply Lowe's ratio test (or fall back to nearest only).
    try:
        knn = m.knnMatch(desc_a, desc_b, k=2)
    except cv2.error:
        # FLANN+LSH can occasionally throw on tiny descriptor sets; fall back to BF.
        bf = _make_matcher("bf", algo)
        knn = bf.knnMatch(desc_a, desc_b, k=2)

    raw_count = sum(1 for pair in knn if pair)
    good: list[cv2.DMatch] = []

    if use_ratio_test:
        r = float(max(0.5, min(0.95, ratio)))
        for pair in knn:
            if len(pair) < 2:
                continue
            best, second = pair[0], pair[1]
            if best.distance < r * second.distance:
                good.append(best)
    else:
        for pair in knn:
            if pair:
                good.append(pair[0])

    good.sort(key=lambda d: d.distance)
    return MatchResult(good=good, raw_count=raw_count)


@dataclass
class HomographyResult:
    H: np.ndarray | None
    inlier_mask: np.ndarray | None  # uint8 0/1, length == len(matches)
    inliers: int
    total: int


def estimate_homography(
    matches: list[cv2.DMatch],
    kp_a: list[cv2.KeyPoint],
    kp_b: list[cv2.KeyPoint],
    *,
    ransac_thresh: float = 4.0,
) -> HomographyResult:
    if len(matches) < 4:
        return HomographyResult(H=None, inlier_mask=None, inliers=0, total=len(matches))

    src = np.float32([kp_a[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
    dst = np.float32([kp_b[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
    H, mask = cv2.findHomography(src, dst, cv2.RANSAC, float(max(0.5, ransac_thresh)))
    if H is None or mask is None:
        return HomographyResult(H=None, inlier_mask=None, inliers=0, total=len(matches))
    flat = mask.ravel().astype(np.uint8)
    return HomographyResult(H=H, inlier_mask=flat, inliers=int(flat.sum()), total=len(matches))


def draw_matches(
    img_a: np.ndarray,
    kp_a: list[cv2.KeyPoint],
    img_b: np.ndarray,
    kp_b: list[cv2.KeyPoint],
    matches: list[cv2.DMatch],
    *,
    inlier_mask: np.ndarray | None,
    top_n: int,
) -> np.ndarray:
    """Side-by-side render with colored match lines.

    When ``inlier_mask`` is provided, inliers are drawn green and outliers are skipped
    (only inliers are passed through). Otherwise we use a vivid violet/cyan accent.
    """
    n = max(0, int(top_n))
    if inlier_mask is not None and len(inlier_mask) == len(matches):
        kept = [m for m, ok in zip(matches, inlier_mask) if ok]
    else:
        kept = list(matches)

    if n > 0:
        kept = kept[:n]

    # ``cv2.drawMatches`` expects single-channel mask of len == matches length we pass in.
    out = cv2.drawMatches(
        img_a,
        kp_a,
        img_b,
        kp_b,
        kept,
        None,
        matchColor=(180, 90, 255) if inlier_mask is None else (60, 220, 130),
        singlePointColor=(255, 200, 80),
        flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS,
    )
    return out


def warp_overlay(
    img_a: np.ndarray,
    img_b: np.ndarray,
    H: np.ndarray,
    *,
    alpha: float = 0.5,
) -> np.ndarray:
    """Warp A into B's frame and alpha-blend the two."""
    h, w = img_b.shape[:2]
    warped = cv2.warpPerspective(img_a, H, (w, h))
    a = float(max(0.0, min(1.0, alpha)))
    blended = cv2.addWeighted(warped, a, img_b, 1.0 - a, 0)
    return blended
