import type { SamOutputMode } from './samParams'

/** BGR tint used by backend `_MASK_COLOR_BGR` → RGB for canvas. */
const MASK_RGB = { r: 200, g: 80, b: 255 }

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** Draw a PNG data URL (no `data:` prefix required — pass full data URL) onto canvas at native size. */
export async function drawDataUrlToCanvas(dataUrl: string, canvas: HTMLCanvasElement): Promise<void> {
  const img = await loadImageElement(dataUrl)
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
}

/** Build `data:image/png;base64,...` from raw base64 payload (no prefix). */
export function pngBase64ToDataUrl(b64: string): string {
  return `data:image/png;base64,${b64}`
}

/**
 * Composite MobileSAM-style preview (mirrors backend `mobile_sam._render_output` closely).
 */
export function composeMobileSamPreview(
  subjectCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  mode: SamOutputMode,
): string {
  const w = maskCanvas.width
  const h = maskCanvas.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  const mctx = maskCanvas.getContext('2d')
  if (!ctx || !mctx) return ''
  const maskData = mctx.getImageData(0, 0, w, h).data

  const maskAt = (i: number) => {
    const v = maskData[i * 4]
    return v > 128 ? 255 : 0
  }

  if (mode === 'mask') {
    const imgData = ctx.createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      const v = maskAt(i) > 0 ? 255 : 0
      const o = i * 4
      imgData.data[o] = v
      imgData.data[o + 1] = v
      imgData.data[o + 2] = v
      imgData.data[o + 3] = 255
    }
    ctx.putImageData(imgData, 0, 0)
    return out.toDataURL('image/png')
  }

  ctx.drawImage(subjectCanvas, 0, 0)
  const pix = ctx.getImageData(0, 0, w, h)

  if (mode === 'cutout') {
    for (let i = 0; i < w * h; i++) {
      if (maskAt(i) === 0) {
        const o = i * 4
        pix.data[o] = 0
        pix.data[o + 1] = 0
        pix.data[o + 2] = 0
      }
    }
    ctx.putImageData(pix, 0, 0)
    return out.toDataURL('image/png')
  }

  // overlay
  const { r: tr, g: tg, b: tb } = MASK_RGB
  for (let i = 0; i < w * h; i++) {
    if (maskAt(i) === 0) continue
    const o = i * 4
    pix.data[o] = clampByte(pix.data[o] + tr * 0.45)
    pix.data[o + 1] = clampByte(pix.data[o + 1] + tg * 0.45)
    pix.data[o + 2] = clampByte(pix.data[o + 2] + tb * 0.45)
  }
  ctx.putImageData(pix, 0, 0)
  return out.toDataURL('image/png')
}

export async function canvasToPngFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
  if (!blob) throw new Error('Could not encode PNG')
  return new File([blob], filename, { type: 'image/png' })
}
