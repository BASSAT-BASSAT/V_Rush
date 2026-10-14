import type {
  AnnotatedFrame,
  AnnotationBox,
  ProjectListItem,
  ReIdIdentity,
  VideoAnnotationProject,
} from '../types/annotate'

const DB_NAME = 'vrush_video_annotations'
const DB_VERSION = 1
const STORE_PROJECTS = 'projects'
const STORE_FRAMES = 'frameBlobs'

interface StoredProjectMeta {
  id: string
  videoName: string
  width: number
  height: number
  durationSec: number
  sampleFps: number
  targetClasses: string[]
  identities: Record<string, ReIdIdentity>
  updatedAt: string
  frameCount: number
}

interface StoredFrameMeta {
  frameIndex: number
  timestampSec: number
  width: number
  height: number
  boxes: AnnotationBox[]
}

interface StoredProjectRow {
  id: string
  meta: StoredProjectMeta
  frames: StoredFrameMeta[]
}

function frameKey(projectId: string, frameIndex: number): string {
  return `${projectId}:${frameIndex}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_FRAMES)) {
        db.createObjectStore(STORE_FRAMES)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export function newProjectId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function countBoxes(frames: AnnotatedFrame[]): number {
  return frames.reduce((n, f) => n + f.boxes.length, 0)
}

/** Captions live on Re-ID identities only; merge legacy per-box text once, then clear box fields. */
export function normalizeProjectCaptions(project: VideoAnnotationProject): VideoAnnotationProject {
  const identities = { ...project.identities }
  for (const frame of project.frames) {
    for (const box of frame.boxes) {
      const ident = identities[box.reidId]
      if (!ident || !box.caption.trim()) continue
      if (!ident.caption.trim()) {
        identities[box.reidId] = { ...ident, caption: box.caption.trim() }
      }
    }
  }
  const frames = project.frames.map((f) => ({
    ...f,
    boxes: f.boxes.map((b) => ({ ...b, caption: '' })),
  }))
  return { ...project, identities, frames }
}

export interface ReidCropInstance {
  frameIndex: number
  timestampSec: number
  frameFile: string
  bbox: [number, number, number, number]
  boxId: string
}

export interface ReidCropEntry {
  reidId: string
  displayName: string
  caption: string
  className: string
  color: string
  instances: ReidCropInstance[]
}

/** Per-identity list of frame paths + bboxes for cropping pipelines. */
export function buildReidCropIndex(project: VideoAnnotationProject): Record<string, ReidCropEntry> {
  const index: Record<string, ReidCropEntry> = {}
  for (const [id, ident] of Object.entries(project.identities)) {
    index[id] = {
      reidId: id,
      displayName: ident.displayName,
      caption: ident.caption,
      className: ident.className,
      color: ident.color,
      instances: [],
    }
  }
  for (const f of project.frames) {
    const frameFile = `frames/frame_${String(f.frameIndex).padStart(6, '0')}.jpg`
    for (const b of f.boxes) {
      const entry = index[b.reidId]
      if (!entry) continue
      entry.instances.push({
        frameIndex: f.frameIndex,
        timestampSec: f.timestampSec,
        frameFile,
        bbox: b.bbox,
        boxId: b.id,
      })
    }
  }
  return index
}

function boxForExport(box: AnnotationBox): Omit<AnnotationBox, 'caption'> {
  const { caption: _omit, ...rest } = box
  return rest
}

export async function saveProjectToIndexedDb(project: VideoAnnotationProject): Promise<void> {
  project = normalizeProjectCaptions(project)
  // IndexedDB transactions auto-close when the sync stack ends — load blobs before opening tx.
  const frameBlobs: Array<{ key: string; blob: Blob }> = []
  for (const f of project.frames) {
    const blob = await objectUrlToBlob(f.imageUrl)
    frameBlobs.push({ key: frameKey(project.id, f.frameIndex), blob })
  }

  const meta: StoredProjectMeta = {
    id: project.id,
    videoName: project.videoName,
    width: project.width,
    height: project.height,
    durationSec: project.durationSec,
    sampleFps: project.sampleFps,
    targetClasses: project.targetClasses,
    identities: project.identities,
    updatedAt: project.updatedAt,
    frameCount: project.frames.length,
  }
  const framesMeta: StoredFrameMeta[] = project.frames.map((f) => ({
    frameIndex: f.frameIndex,
    timestampSec: f.timestampSec,
    width: f.width,
    height: f.height,
    boxes: f.boxes,
  }))
  const row: StoredProjectRow = { id: project.id, meta, frames: framesMeta }

  const db = await openDb()
  const tx = db.transaction([STORE_PROJECTS, STORE_FRAMES], 'readwrite')
  tx.objectStore(STORE_PROJECTS).put(row)
  const frameStore = tx.objectStore(STORE_FRAMES)
  for (const { key, blob } of frameBlobs) {
    frameStore.put(blob, key)
  }
  await txDone(tx)
  db.close()
}

/** Verify project round-trips in IndexedDB (dev sanity check after save). */
export async function verifyProjectInIndexedDb(
  projectId: string,
  expectedFrameCount: number,
  expectedBoxCount: number,
): Promise<{ ok: boolean; message: string }> {
  const loaded = await loadProjectFromIndexedDb(projectId)
  if (!loaded) {
    return { ok: false, message: 'Save failed: project not found in browser storage.' }
  }
  const boxes = countBoxes(loaded.frames)
  if (loaded.frames.length !== expectedFrameCount) {
    return {
      ok: false,
      message: `Save incomplete: expected ${expectedFrameCount} frames, found ${loaded.frames.length}.`,
    }
  }
  if (boxes !== expectedBoxCount) {
    return {
      ok: false,
      message: `Save incomplete: expected ${expectedBoxCount} boxes, found ${boxes}.`,
    }
  }
  return {
    ok: true,
    message: `Saved ${loaded.frames.length} frames and ${boxes} boxes to browser storage.`,
  }
}

async function objectUrlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const res = await fetch(url)
    return await res.blob()
  }
  throw new Error('Unsupported image URL for storage')
}

export async function listProjectsFromIndexedDb(): Promise<ProjectListItem[]> {
  const db = await openDb()
  const tx = db.transaction(STORE_PROJECTS, 'readonly')
  const store = tx.objectStore(STORE_PROJECTS)
  const items: ProjectListItem[] = await new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => {
      const docs = (req.result as StoredProjectRow[]) ?? []
      resolve(
        docs.map((d) => ({
          id: d.id,
          videoName: d.meta.videoName,
          frameCount: d.meta.frameCount,
          boxCount: d.frames.reduce((n, fr) => n + fr.boxes.length, 0),
          identityCount: Object.keys(d.meta.identities).length,
          updatedAt: d.meta.updatedAt,
        })),
      )
    }
    req.onerror = () => reject(req.error ?? new Error('Failed to list projects'))
  })
  await txDone(tx)
  db.close()
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadProjectFromIndexedDb(projectId: string): Promise<VideoAnnotationProject | null> {
  const db = await openDb()
  const tx = db.transaction([STORE_PROJECTS, STORE_FRAMES], 'readonly')
  const doc = await new Promise<StoredProjectRow | null>((resolve, reject) => {
    const req = tx.objectStore(STORE_PROJECTS).get(projectId)
    req.onsuccess = () => resolve((req.result as StoredProjectRow) ?? null)
    req.onerror = () => reject(req.error)
  })
  if (!doc) {
    await txDone(tx)
    db.close()
    return null
  }

  const frameStore = tx.objectStore(STORE_FRAMES)
  const frames: AnnotatedFrame[] = []
  for (const fm of doc.frames) {
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const req = frameStore.get(frameKey(projectId, fm.frameIndex))
      req.onsuccess = () => resolve((req.result as Blob) ?? null)
      req.onerror = () => reject(req.error)
    })
    if (!blob) continue
    const imageUrl = URL.createObjectURL(blob)
    frames.push({
      frameIndex: fm.frameIndex,
      timestampSec: fm.timestampSec,
      imageUrl,
      width: fm.width,
      height: fm.height,
      boxes: fm.boxes,
    })
  }
  await txDone(tx)
  db.close()

  frames.sort((a, b) => a.frameIndex - b.frameIndex)
  return normalizeProjectCaptions({
    id: doc.meta.id,
    videoName: doc.meta.videoName,
    width: doc.meta.width,
    height: doc.meta.height,
    durationSec: doc.meta.durationSec,
    sampleFps: doc.meta.sampleFps,
    targetClasses: doc.meta.targetClasses,
    identities: doc.meta.identities,
    frames,
    updatedAt: doc.meta.updatedAt,
  })
}

export async function deleteProjectFromIndexedDb(projectId: string): Promise<void> {
  const db = await openDb()
  const doc = await new Promise<StoredProjectRow | null>((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly')
    const req = tx.objectStore(STORE_PROJECTS).get(projectId)
    req.onsuccess = () => resolve((req.result as StoredProjectRow) ?? null)
    req.onerror = () => reject(req.error)
  })

  const tx = db.transaction([STORE_PROJECTS, STORE_FRAMES], 'readwrite')
  tx.objectStore(STORE_PROJECTS).delete(projectId)
  if (doc) {
    const frameStore = tx.objectStore(STORE_FRAMES)
    for (const f of doc.frames) {
      frameStore.delete(frameKey(projectId, f.frameIndex))
    }
  }
  await txDone(tx)
  db.close()
}

function yoloLine(box: AnnotationBox, classNames: string[], w: number, h: number): string {
  const idx = classNames.indexOf(box.className.toLowerCase())
  const classId = idx >= 0 ? idx : 0
  const [x1, y1, x2, y2] = box.bbox
  const cx = ((x1 + x2) / 2) / w
  const cy = ((y1 + y2) / 2) / h
  const bw = (x2 - x1) / w
  const bh = (y2 - y1) / h
  return `${classId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${bw.toFixed(6)} ${bh.toFixed(6)}`
}

/** Build export JSON + sidecar files for zip. */
export async function buildExportFiles(
  project: VideoAnnotationProject,
): Promise<Record<string, Uint8Array>> {
  project = normalizeProjectCaptions(project)
  const classSet = new Set<string>()
  for (const f of project.frames) {
    for (const b of f.boxes) classSet.add(b.className.toLowerCase())
  }
  const classNames = [...classSet].sort()

  const exportDoc = {
    id: project.id,
    videoName: project.videoName,
    width: project.width,
    height: project.height,
    durationSec: project.durationSec,
    sampleFps: project.sampleFps,
    targetClasses: project.targetClasses,
    identities: project.identities,
    frames: project.frames.map((f) => ({
      frameIndex: f.frameIndex,
      timestampSec: f.timestampSec,
      width: f.width,
      height: f.height,
      boxes: f.boxes.map(boxForExport),
    })),
    updatedAt: project.updatedAt,
    exportFormat: 'vrush-reid-v1',
    captionScope: 'identity',
  }

  const files: Record<string, Uint8Array> = {}
  const enc = new TextEncoder()
  files['annotations.json'] = enc.encode(JSON.stringify(exportDoc, null, 2))
  files['identities.json'] = enc.encode(JSON.stringify(project.identities, null, 2))
  files['reid_index.json'] = enc.encode(
    JSON.stringify(
      {
        captionScope: 'identity',
        identities: buildReidCropIndex(project),
      },
      null,
      2,
    ),
  )

  for (const f of project.frames) {
    const lines = f.boxes.map((b) => yoloLine(b, classNames, f.width, f.height))
    const labelPath = `labels/frame_${String(f.frameIndex).padStart(6, '0')}.txt`
    files[labelPath] = enc.encode(lines.join('\n'))
    const blob = await objectUrlToBlob(f.imageUrl)
    const buf = new Uint8Array(await blob.arrayBuffer())
    files[`frames/frame_${String(f.frameIndex).padStart(6, '0')}.jpg`] = buf
  }

  return files
}

// --- minimal ZIP (stored, no compression) ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipStore(files: Record<string, Uint8Array>): Uint8Array {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const [name, data] of Object.entries(files)) {
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(data)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint16(6, 0, true)
    view.setUint16(8, 0, true)
    view.setUint16(10, 0, true)
    view.setUint16(12, 0, true)
    view.setUint32(14, crc, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, nameBytes.length, true)
    view.setUint16(28, 0, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    parts.push(local)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cdView = new DataView(cd.buffer)
    cdView.setUint32(0, 0x02014b50, true)
    cdView.setUint16(4, 20, true)
    cdView.setUint16(6, 20, true)
    cdView.setUint16(8, 0, true)
    cdView.setUint16(10, 0, true)
    cdView.setUint16(12, 0, true)
    cdView.setUint16(14, 0, true)
    cdView.setUint32(16, crc, true)
    cdView.setUint32(20, data.length, true)
    cdView.setUint32(24, data.length, true)
    cdView.setUint16(28, nameBytes.length, true)
    cdView.setUint16(30, 0, true)
    cdView.setUint16(32, 0, true)
    cdView.setUint16(34, 0, true)
    cdView.setUint16(36, 0, true)
    cdView.setUint32(38, 0, true)
    cdView.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const centralStart = offset
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, central.length, true)
  endView.setUint16(10, central.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, centralStart, true)
  endView.setUint16(20, 0, true)

  const total =
    parts.reduce((s, p) => s + p.length, 0) + centralSize + end.length
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  for (const c of central) {
    out.set(c, pos)
    pos += c.length
  }
  out.set(end, pos)
  return out
}

export async function downloadProjectZip(
  project: VideoAnnotationProject,
  filename?: string,
): Promise<void> {
  const files = await buildExportFiles(project)
  const zip = zipStore(files)
  const blob = new Blob([new Uint8Array(zip)], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `vrush-annotate-${project.id.slice(0, 8)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadAndPurgeProject(
  project: VideoAnnotationProject,
  options: { purgeFromIndexedDb: boolean },
): Promise<void> {
  await downloadProjectZip(project)
  if (options.purgeFromIndexedDb) {
    await deleteProjectFromIndexedDb(project.id)
  }
}

export function revokeProjectFrameUrls(project: VideoAnnotationProject | null): void {
  if (!project) return
  for (const f of project.frames) {
    if (f.imageUrl.startsWith('blob:')) URL.revokeObjectURL(f.imageUrl)
  }
}
