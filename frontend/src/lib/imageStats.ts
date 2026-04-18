import type { ImageStats } from '../types/cv'

/** Decode a File/Blob to an off-screen HTMLImageElement. */
async function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    if (typeof source !== 'string') {
      // Give the browser a tick so decode() has committed.
      queueMicrotask(() => URL.revokeObjectURL(url))
    }
  }
}

function computeStatsFromImageData(data: Uint8ClampedArray, width: number, height: number): ImageStats {
  const histR = new Array<number>(256).fill(0)
  const histG = new Array<number>(256).fill(0)
  const histB = new Array<number>(256).fill(0)
  const histGray = new Array<number>(256).fill(0)

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sum2R = 0
  let sum2G = 0
  let sum2B = 0
  let minR = 255
  let minG = 255
  let minB = 255
  let maxR = 0
  let maxG = 0
  let maxB = 0

  const n = width * height
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    histR[r]++
    histG[g]++
    histB[b]++
    // OpenCV luminance (Y = 0.299 R + 0.587 G + 0.114 B).
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    histGray[y]++

    sumR += r
    sumG += g
    sumB += b
    sum2R += r * r
    sum2G += g * g
    sum2B += b * b
    if (r < minR) minR = r
    if (g < minG) minG = g
    if (b < minB) minB = b
    if (r > maxR) maxR = r
    if (g > maxG) maxG = g
    if (b > maxB) maxB = b
  }

  const meanR = sumR / n
  const meanG = sumG / n
  const meanB = sumB / n
  const varR = Math.max(0, sum2R / n - meanR * meanR)
  const varG = Math.max(0, sum2G / n - meanG * meanG)
  const varB = Math.max(0, sum2B / n - meanB * meanB)

  return {
    histogram_gray: histGray,
    histogram_rgb: { r: histR, g: histG, b: histB },
    mean: [meanR, meanG, meanB],
    std: [Math.sqrt(varR), Math.sqrt(varG), Math.sqrt(varB)],
    min: [minR, minG, minB],
    max: [maxR, maxG, maxB],
    width,
    height,
  }
}

/** Compute stats from a File / Blob. Downsamples to max 1024×1024 for speed. */
export async function computeImageStats(source: Blob, maxDim = 1024): Promise<ImageStats> {
  const img = await loadImage(source)
  const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * ratio))
  const h = Math.max(1, Math.round(img.naturalHeight * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  return computeStatsFromImageData(imageData.data, w, h)
}
