/**
 * Client-side outline cutout (no SAM): binary keep-mask + compose to black outside discarded regions.
 */

/** Create a full keep-mask (all pixels kept). */
export function createFullKeepMask(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, width)
  c.height = Math.max(1, height)
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  return c
}

/** Reset keep-mask to full coverage (all keep). */
export function resetKeepMaskFull(mask: HTMLCanvasElement): void {
  const ctx = mask.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, mask.width, mask.height)
}

/**
 * Compose cutout: copy source RGB where keep-mask > 128, else black.
 * Returns a PNG data URL.
 */
export function composeBrushCutout(
  sourceCanvas: HTMLCanvasElement,
  keepMask: HTMLCanvasElement,
): string {
  const w = Math.min(sourceCanvas.width, keepMask.width)
  const h = Math.min(sourceCanvas.height, keepMask.height)
  if (w < 1 || h < 1) return ''

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  const mctx = keepMask.getContext('2d')
  if (!ctx || !mctx) return ''

  ctx.drawImage(sourceCanvas, 0, 0)
  const pix = ctx.getImageData(0, 0, w, h)
  const maskData = mctx.getImageData(0, 0, w, h).data

  for (let i = 0; i < w * h; i++) {
    const a = maskData[i * 4 + 3] ?? 0
    const v = maskData[i * 4] ?? 0
    if (a < 128 || v < 128) {
      const o = i * 4
      pix.data[o] = 0
      pix.data[o + 1] = 0
      pix.data[o + 2] = 0
      pix.data[o + 3] = 255
    }
  }
  ctx.putImageData(pix, 0, 0)
  return out.toDataURL('image/png')
}

/** True if any mask pixel was zeroed (cut applied). */
export function keepMaskHasDiscard(keepMask: HTMLCanvasElement): boolean {
  const ctx = keepMask.getContext('2d')
  if (!ctx || keepMask.width < 1 || keepMask.height < 1) return false
  const { data } = ctx.getImageData(0, 0, keepMask.width, keepMask.height)
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i] ?? 255) < 128) return true
  }
  return false
}
