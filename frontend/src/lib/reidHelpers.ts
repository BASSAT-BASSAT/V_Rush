import type { AnnotatedFrame, AnnotationBox, ReIdIdentity } from '../types/annotate'
import { REID_COLOR_PALETTE } from '../types/annotate'

export function newBoxId(): string {
  return `box_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function newReidId(className: string, existing: Record<string, ReIdIdentity>): string {
  const base = className.toLowerCase().replace(/\s+/g, '_') || 'object'
  let n = 1
  while (existing[`${base}_${n}`]) n++
  return `${base}_${n}`
}

/** Stable label from id (e.g. person_2 → Person 2), not from how many identities exist. */
export function defaultDisplayNameForReidId(id: string, fallbackIndex: number): string {
  const match = id.match(/_(\d+)$/)
  if (match) {
    return `Person ${Number.parseInt(match[1], 10)}`
  }
  return `Person ${fallbackIndex + 1}`
}

/** Drop Re-ID entries that no box on any frame references. */
export function pruneUnusedIdentities(
  frames: AnnotatedFrame[],
  identities: Record<string, ReIdIdentity>,
): Record<string, ReIdIdentity> {
  const used = new Set<string>()
  for (const frame of frames) {
    for (const box of frame.boxes) {
      used.add(box.reidId)
    }
  }
  const next: Record<string, ReIdIdentity> = {}
  for (const id of used) {
    const ident = identities[id]
    if (ident) next[id] = ident
  }
  return next
}

export function createIdentity(
  className: string,
  existing: Record<string, ReIdIdentity>,
  displayName?: string,
): ReIdIdentity {
  const id = newReidId(className, existing)
  const index = Object.keys(existing).length
  return {
    id,
    displayName: displayName ?? defaultDisplayNameForReidId(id, index),
    className: className.toLowerCase(),
    color: REID_COLOR_PALETTE[index % REID_COLOR_PALETTE.length],
    caption: '',
  }
}

export function boxIoU(a: [number, number, number, number], b: [number, number, number, number]): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1])
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1])
  const union = areaA + areaB - inter
  return union <= 0 ? 0 : inter / union
}

export function clampBbox(
  bbox: [number, number, number, number],
  w: number,
  h: number,
): [number, number, number, number] {
  const [x1, y1, x2, y2] = bbox
  const nx1 = Math.max(0, Math.min(w - 1, Math.min(x1, x2)))
  const ny1 = Math.max(0, Math.min(h - 1, Math.min(y1, y2)))
  const nx2 = Math.max(0, Math.min(w - 1, Math.max(x1, x2)))
  const ny2 = Math.max(0, Math.min(h - 1, Math.max(y1, y2)))
  return [nx1, ny1, nx2, ny2]
}

/** Match new detection boxes to previous frame boxes by IoU for Re-ID continuity. */
export function assignReidFromPreviousFrame(
  detections: Array<{ bbox: [number, number, number, number]; className: string; confidence: number }>,
  previousBoxes: AnnotationBox[],
  identities: Record<string, ReIdIdentity>,
  defaultClass: string,
  iouThreshold = 0.35,
): { boxes: AnnotationBox[]; identities: Record<string, ReIdIdentity> } {
  const nextIdentities = { ...identities }
  const usedPrev = new Set<string>()
  const boxes: AnnotationBox[] = []

  for (const det of detections) {
    let best: { box: AnnotationBox; iou: number } | null = null
    for (const pb of previousBoxes) {
      if (usedPrev.has(pb.id)) continue
      const iou = boxIoU(det.bbox, pb.bbox)
      if (iou >= iouThreshold && (!best || iou > best.iou)) {
        best = { box: pb, iou }
      }
    }

    let reidId: string
    if (best) {
      usedPrev.add(best.box.id)
      reidId = best.box.reidId
    } else {
      const ident = createIdentity(det.className || defaultClass, nextIdentities)
      nextIdentities[ident.id] = ident
      reidId = ident.id
    }

    boxes.push({
      id: newBoxId(),
      className: (det.className || defaultClass).toLowerCase(),
      reidId,
      bbox: det.bbox,
      confidence: det.confidence,
      source: 'yolo26',
      caption: '',
    })
  }

  return { boxes, identities: nextIdentities }
}
