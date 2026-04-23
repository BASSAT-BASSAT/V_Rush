/**
 * Utilities for extracting image files from user uploads — whether that's a
 * flat multi-file drop, a folder drop (DataTransfer + webkitGetAsEntry), or
 * a folder picked via `<input type="file" webkitdirectory>`.
 *
 * Non-image entries are silently dropped; the caller always gets a flat list
 * of `{ file, path }` pairs where `path` is the folder-relative location
 * (falls back to the plain filename if no folder context is available).
 *
 * The `webkitGetAsEntry` API is non-standard but implemented by every
 * evergreen browser (Chromium, Firefox, Safari). We feature-detect it and
 * fall back to the flat `DataTransfer.files` list if a browser surprises us.
 */

export interface ReadFile {
  file: File
  path: string
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i

function looksLikeImage(file: File, path?: string): boolean {
  if (file.type && file.type.startsWith('image/')) return true
  const name = path ?? file.name
  return IMAGE_EXT_RE.test(name)
}

// A minimal structural view of the non-standard FileSystem API surface we
// actually use, so we don't have to lean on `any` or pull lib.dom.d.ts types
// that aren't uniformly available.
interface FsEntryBase {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath?: string
}

interface FsFileEntry extends FsEntryBase {
  isFile: true
  file: (success: (file: File) => void, err?: (e: unknown) => void) => void
}

interface FsDirReader {
  readEntries: (
    success: (entries: FsEntryBase[]) => void,
    err?: (e: unknown) => void,
  ) => void
}

interface FsDirectoryEntry extends FsEntryBase {
  isDirectory: true
  createReader: () => FsDirReader
}

type FsEntry = FsFileEntry | FsDirectoryEntry | FsEntryBase

function entryIsFile(e: FsEntry): e is FsFileEntry {
  return e.isFile === true
}
function entryIsDir(e: FsEntry): e is FsDirectoryEntry {
  return e.isDirectory === true
}

function entryToFile(entry: FsFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (f) => resolve(f),
      () => resolve(null),
    )
  })
}

function readAllEntries(reader: FsDirReader): Promise<FsEntryBase[]> {
  return new Promise((resolve, reject) => {
    const collected: FsEntryBase[] = []
    const pump = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(collected)
          } else {
            collected.push(...batch)
            pump()
          }
        },
        (err) => reject(err),
      )
    }
    pump()
  })
}

async function walkEntry(entry: FsEntry, basePath: string): Promise<ReadFile[]> {
  if (entryIsFile(entry)) {
    const file = await entryToFile(entry)
    if (!file) return []
    const path = basePath ? `${basePath}/${entry.name}` : entry.name
    return looksLikeImage(file, path) ? [{ file, path }] : []
  }

  if (entryIsDir(entry)) {
    const reader = entry.createReader()
    let entries: FsEntryBase[]
    try {
      entries = await readAllEntries(reader)
    } catch {
      return []
    }
    const here = basePath ? `${basePath}/${entry.name}` : entry.name
    const nested = await Promise.all(entries.map((e) => walkEntry(e as FsEntry, here)))
    return nested.flat()
  }

  return []
}

/**
 * Read a `DataTransferItemList` from a drop event. Supports folder drops on
 * browsers that expose `webkitGetAsEntry` (Chromium, Firefox, Safari) and
 * falls back to the flat file list otherwise.
 */
export async function readDroppedItems(dt: DataTransfer): Promise<ReadFile[]> {
  const items = dt.items
  const canEntry =
    items && items.length > 0 &&
    typeof (items[0] as unknown as { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry ===
      'function'

  if (canEntry) {
    const entries: FsEntry[] = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i] as unknown as {
        kind: string
        webkitGetAsEntry: () => FsEntry | null
      }
      if (it.kind !== 'file') continue
      const entry = it.webkitGetAsEntry()
      if (entry) entries.push(entry)
    }
    const results = await Promise.all(entries.map((e) => walkEntry(e, '')))
    return results.flat()
  }

  // Legacy / Safari-on-iPad path: flat file list only, no folder structure.
  return readFileList(dt.files)
}

/**
 * Convert a FileList (e.g. from `<input type="file" multiple webkitdirectory>`)
 * into the same `{ file, path }` shape as folder drops.
 */
export function readFileList(list: FileList | null): ReadFile[] {
  if (!list) return []
  const out: ReadFile[] = []
  for (let i = 0; i < list.length; i++) {
    const f = list[i]
    // `webkitRelativePath` is the folder-relative path when the input has the
    // `webkitdirectory` attribute; empty string for a plain multi-file pick.
    const path =
      (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    if (!looksLikeImage(f, path)) continue
    out.push({ file: f, path })
  }
  return out
}
