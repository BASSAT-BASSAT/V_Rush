import { detectFrameForAnnotation } from '../api/cv'
import type { AnnotatedFrame, AnnotationBox, VideoAnnotationProject } from '../types/annotate'
import {
  assignReidFromPreviousFrame,
  assignReidFromReferenceBoxes,
  clampBbox,
  createIdentity,
  pruneUnusedIdentities,
} from './reidHelpers'

export interface DetectFrameOptions {
  conf: number
  maxDet: number
  targetClasses: string[]
  propagateReid: boolean
  accessToken?: string | null
}

function detectionsToBoxes(
  frame: AnnotatedFrame,
  dets: Array<{ bbox: [number, number, number, number]; className: string; confidence: number }>,
  identities: VideoAnnotationProject['identities'],
  prevBoxes: AnnotationBox[] | undefined,
  defaultClass: string,
  propagateReid: boolean,
): { boxes: AnnotationBox[]; identities: VideoAnnotationProject['identities'] } {
  if (dets.length === 0) {
    return { boxes: [], identities }
  }

  if (propagateReid && prevBoxes && prevBoxes.length > 0) {
    const assigned = assignReidFromPreviousFrame(dets, prevBoxes, identities, defaultClass)
    return { boxes: assigned.boxes, identities: assigned.identities }
  }

  // Re-run YOLO on a frame that already has boxes — refresh bbox, keep box id + corrected reidId.
  if (frame.boxes.length > 0) {
    const assigned = assignReidFromReferenceBoxes(dets, frame.boxes, identities, defaultClass, {
      preserveMatchedBoxes: true,
    })
    return { boxes: assigned.boxes, identities: assigned.identities }
  }

  let nextIdentities = identities
  const boxes = dets.map((d) => {
    const ident = createIdentity(d.className, nextIdentities)
    nextIdentities = { ...nextIdentities, [ident.id]: ident }
    return {
      id: `box_${frame.frameIndex}_${Math.random().toString(36).slice(2, 7)}`,
      className: d.className,
      reidId: ident.id,
      bbox: d.bbox,
      confidence: d.confidence,
      source: 'yolo26' as const,
      caption: '',
    }
  })
  return { boxes, identities: nextIdentities }
}

/** Run YOLO on one frame and return an updated project (immutable). */
export async function detectAndMergeFrame(
  project: VideoAnnotationProject,
  arrayIndex: number,
  options: DetectFrameOptions,
): Promise<VideoAnnotationProject> {
  const frame = project.frames[arrayIndex]
  if (!frame) {
    throw new Error(`Frame index ${arrayIndex} is out of range`)
  }

  const blobRes = await fetch(frame.imageUrl)
  if (!blobRes.ok) {
    throw new Error(`Could not read frame ${frame.frameIndex} image for detection`)
  }
  const blob = await blobRes.blob()
  if (blob.size < 1) {
    throw new Error(`Frame ${frame.frameIndex} image is empty`)
  }

  const mime = blob.type || 'image/jpeg'
  const ext = mime.includes('png') ? 'png' : 'jpg'
  const file = new File([blob], `frame_${frame.frameIndex}.${ext}`, { type: mime })

  const classes = options.targetClasses.length > 0 ? options.targetClasses : ['person']
  const res = await detectFrameForAnnotation(
    file,
    { conf: options.conf, maxDet: options.maxDet, classes },
    options.accessToken,
  )

  const dets = res.detections.map((d) => ({
    bbox: clampBbox(
      [d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3]] as [number, number, number, number],
      frame.width,
      frame.height,
    ),
    className: d.label.toLowerCase(),
    confidence: d.confidence,
  }))

  const prev = arrayIndex > 0 ? project.frames[arrayIndex - 1]?.boxes : undefined
  const { boxes, identities } = detectionsToBoxes(
    frame,
    dets,
    project.identities,
    prev,
    classes[0] ?? 'person',
    options.propagateReid,
  )

  const frames = project.frames.map((f) =>
    f.frameIndex === frame.frameIndex ? { ...f, boxes } : f,
  )

  const merged: VideoAnnotationProject = {
    ...project,
    identities,
    frames,
    updatedAt: new Date().toISOString(),
  }
  return {
    ...merged,
    identities: pruneUnusedIdentities(merged.frames, merged.identities),
  }
}
