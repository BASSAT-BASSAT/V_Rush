/** Convert pixel bbox [x1,y1,x2,y2] to crop_fraction params for the given image size. */

export function bboxToCropFraction(
  bbox: readonly [number, number, number, number],
  width: number,
  height: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const [bx1, by1, bx2, by2] = bbox
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  let x0 = clamp(bx1 / width)
  let y0 = clamp(by1 / height)
  let x1 = clamp(bx2 / width)
  let y1 = clamp(by2 / height)
  if (x1 <= x0) {
    const m = (x0 + x1) / 2
    x0 = clamp(m - 1e-4)
    x1 = clamp(m + 1e-4)
  }
  if (y1 <= y0) {
    const m = (y0 + y1) / 2
    y0 = clamp(m - 1e-4)
    y1 = clamp(m + 1e-4)
  }
  return { x0, y0, x1, y1 }
}
