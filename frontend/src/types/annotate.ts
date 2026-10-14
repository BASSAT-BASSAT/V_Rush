export type BoxSource = 'yolo26' | 'manual'

export interface AnnotationBox {
  id: string
  className: string
  reidId: string
  bbox: [number, number, number, number]
  confidence: number | null
  source: BoxSource
  /** Deprecated: captions are stored on ReIdIdentity only; kept for legacy loads. */
  caption: string
}

export interface ReIdIdentity {
  id: string
  displayName: string
  className: string
  color: string
  caption: string
}

export interface AnnotatedFrame {
  frameIndex: number
  timestampSec: number
  /** Runtime object URL or data URL for display; not persisted in project meta. */
  imageUrl: string
  width: number
  height: number
  boxes: AnnotationBox[]
}

export interface VideoAnnotationProject {
  id: string
  videoName: string
  width: number
  height: number
  durationSec: number
  sampleFps: number
  targetClasses: string[]
  identities: Record<string, ReIdIdentity>
  frames: AnnotatedFrame[]
  updatedAt: string
}

export interface ProjectListItem {
  id: string
  videoName: string
  frameCount: number
  boxCount: number
  identityCount: number
  updatedAt: string
}

export const REID_COLOR_PALETTE: string[] = [
  '#ff3838',
  '#ff9d38',
  '#ffe138',
  '#3dff6e',
  '#38d9ff',
  '#386bff',
  '#a338ff',
  '#ff38d4',
  '#38ffd9',
  '#c4ff38',
  '#ff6b6b',
  '#4ecdc4',
]
