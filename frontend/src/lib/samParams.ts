export type SamPromptType = 'point' | 'box'
export type SamOutputMode = 'overlay' | 'cutout' | 'mask'

export interface SamParamsState {
  prompt_type: SamPromptType
  point_x_frac: number
  point_y_frac: number
  point_label: 0 | 1
  box_x1_frac: number
  box_y1_frac: number
  box_x2_frac: number
  box_y2_frac: number
  output: SamOutputMode
}

export const SAM_DEFAULTS: SamParamsState = {
  prompt_type: 'point',
  point_x_frac: 0.5,
  point_y_frac: 0.5,
  point_label: 1,
  box_x1_frac: 0.2,
  box_y1_frac: 0.2,
  box_x2_frac: 0.8,
  box_y2_frac: 0.8,
  output: 'overlay',
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function parseSamParamsJson(json: string): SamParamsState {
  try {
    const p = JSON.parse(json) as Record<string, unknown>
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return { ...SAM_DEFAULTS }
    const prompt_type: SamPromptType = p.prompt_type === 'box' ? 'box' : 'point'
    const output: SamOutputMode =
      p.output === 'cutout' ? 'cutout' : p.output === 'mask' ? 'mask' : 'overlay'
    return {
      prompt_type,
      point_x_frac: clamp01(num(p.point_x_frac, SAM_DEFAULTS.point_x_frac)),
      point_y_frac: clamp01(num(p.point_y_frac, SAM_DEFAULTS.point_y_frac)),
      point_label: p.point_label === 0 ? 0 : 1,
      box_x1_frac: clamp01(num(p.box_x1_frac, SAM_DEFAULTS.box_x1_frac)),
      box_y1_frac: clamp01(num(p.box_y1_frac, SAM_DEFAULTS.box_y1_frac)),
      box_x2_frac: clamp01(num(p.box_x2_frac, SAM_DEFAULTS.box_x2_frac)),
      box_y2_frac: clamp01(num(p.box_y2_frac, SAM_DEFAULTS.box_y2_frac)),
      output,
    }
  } catch {
    return { ...SAM_DEFAULTS }
  }
}

export function emitSamParamsJson(state: SamParamsState): string {
  return JSON.stringify(
    {
      prompt_type: state.prompt_type,
      point_x_frac: Number(state.point_x_frac.toFixed(4)),
      point_y_frac: Number(state.point_y_frac.toFixed(4)),
      point_label: state.point_label,
      box_x1_frac: Number(state.box_x1_frac.toFixed(4)),
      box_y1_frac: Number(state.box_y1_frac.toFixed(4)),
      box_x2_frac: Number(state.box_x2_frac.toFixed(4)),
      box_y2_frac: Number(state.box_y2_frac.toFixed(4)),
      output: state.output,
    },
    null,
    2,
  )
}
