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

export interface ProcessResponse {
  image_base64: string
  mime: string
  warnings: string[]
  width: number
  height: number
  pipeline_applied: { op: string; params: Record<string, unknown> }[]
  last_output_kind: string
}

export interface PipelineStepUI {
  key: string
  op: string
  paramsJson: string
}
