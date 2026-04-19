export interface OpInfo {
  id: string
  label: string
  category: string
  description: string
  default_params: Record<string, unknown>
  output_kind: string
  /** Maps JSON param keys to short explanations */
  param_help: Record<string, string>
  /** Longer explanation for Reference (falls back to description when empty on server) */
  detail_doc: string
}

export interface DetectionItem {
  label: string
  confidence: number
  /** [x1, y1, x2, y2] pixels — same coordinate space as the returned image (after pipeline / YOLO). */
  bbox: [number, number, number, number]
}

export interface ImageStats {
  /** 256-bin histogram on the luma channel. */
  histogram_gray: number[]
  /** Per-channel 256-bin histograms. */
  histogram_rgb: { r: number[]; g: number[]; b: number[] }
  /** Mean per channel, in [r, g, b] order. */
  mean: [number, number, number]
  std: [number, number, number]
  min: [number, number, number]
  max: [number, number, number]
  width: number
  height: number
}

export interface ProcessResponse {
  image_base64: string
  mime: string
  warnings: string[]
  width: number
  height: number
  pipeline_applied: { op: string; params: Record<string, unknown> }[]
  last_output_kind: string
  /** Present when the backend returns detection results (e.g. after yolo26_detect). */
  detections?: DetectionItem[]
  /** Pixel statistics of the uploaded image before the pipeline. */
  before_stats?: ImageStats | null
  /** Pixel statistics of the processed output. */
  after_stats?: ImageStats | null
}

export interface PipelineStepUI {
  key: string
  op: string
  paramsJson: string
}

// =========================
// MATCHER
// =========================

export type MatcherAlgo = 'sift' | 'orb' | 'akaze' | 'brisk'
export type MatcherKind = 'bf' | 'flann'

export interface MatchOptions {
  algo: MatcherAlgo
  matcher: MatcherKind
  use_ratio_test: boolean
  ratio: number
  top_n: number
  max_features: number
  estimate_homography: boolean
  ransac_thresh: number
  overlay: boolean
  overlay_alpha: number
}

export interface MatchStats {
  keypoints_a: number
  keypoints_b: number
  raw_matches: number
  good_matches: number
  inliers: number
  inlier_ratio: number
  avg_distance: number
  elapsed_ms: number
  algo: string
  matcher: string
}

export interface MatchResponse {
  match_image_base64: string
  overlay_image_base64: string | null
  mime: string
  width: number
  height: number
  homography: number[][] | null
  stats: MatchStats
  warnings: string[]
}

// =========================
// KAGGLE
// =========================

export interface KaggleCreds {
  username: string
  key: string
}

export interface KaggleFileInfo {
  path: string
  size: number
  is_image: boolean
  is_archive?: boolean
}

export interface KaggleFileListResponse {
  owner: string
  name: string
  files: KaggleFileInfo[]
}

export interface KaggleImageResponse {
  image_base64: string
  mime: string
  width: number
  height: number
  path: string
}

export interface KaggleDatasetSummary {
  ref: string
  title: string
  subtitle: string
  last_updated: string
  download_count: number
  vote_count: number
  url: string
}

export interface KaggleSearchResponse {
  query: string
  datasets: KaggleDatasetSummary[]
}

/** Payload handed to PipelinePage / MatcherPage via router state. */
export interface PreloadedImageState {
  /** Slot to populate when arriving on the matcher page. */
  slot?: 'A' | 'B'
  /** Original filename to use when reconstructing a File. */
  filename: string
  /** Mime type of the image bytes (e.g. "image/png"). */
  mime: string
  /** Base64-encoded bytes (no data: prefix). */
  base64: string
}

/** Two images sent at once to the matcher (slot A + slot B). */
export interface PreloadedPairState {
  a: { filename: string; mime: string; base64: string }
  b: { filename: string; mime: string; base64: string }
}
