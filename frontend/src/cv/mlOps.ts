/**
 * Operation ids that rely on ML model weights (ONNX) and live in the
 * "Deep Learning Lab" route. Everything else is classical OpenCV and
 * lives in the main Studio.
 *
 * Keep this list small and explicit — new ML ops should be added here so the
 * Classical Studio and ML Lab palettes stay cleanly separated.
 */
export const ML_OP_IDS: ReadonlySet<string> = new Set([
  'yolo26_detect',
  'mobile_sam',
])

export function isMlOp(id: string): boolean {
  return ML_OP_IDS.has(id)
}
