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
