import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { readDroppedItems, readFileList } from '../lib/readDroppedFiles'

export type DatasetMode = 'studio' | 'matcher'

/**
 * One image in the tray. `path` is the folder-relative path (from a folder
 * drop / picker) or the plain filename for flat multi-drops. `url` is a
 * blob URL created once at add-time so thumbnails and pickers don't keep
 * re-creating object URLs on every render.
 */
interface DatasetImage {
  id: string
  file: File
  path: string
  url: string
}

interface BaseProps {
  disabled?: boolean
  /** Optional collapsed / open starting state. Defaults to open. */
  defaultOpen?: boolean
}

interface StudioProps extends BaseProps {
  mode: 'studio'
  onPick: (file: File) => void
  activeFile?: File | null
}

interface MatcherProps extends BaseProps {
  mode: 'matcher'
  onPickSlot: (slot: 'A' | 'B', file: File) => void
  activeFileA?: File | null
  activeFileB?: File | null
}

export type DatasetTrayProps = StudioProps | MatcherProps

interface FolderEntry {
  name: string
  fullPath: string
  fileCount: number
  totalBytes: number
}

interface ListingResult {
  dirs: FolderEntry[]
  files: DatasetImage[]
}

/**
 * Split the flat `datasetImages` list into "subfolders directly under cwd"
 * plus "files directly under cwd" — mirrors the shape `DatasetsPage` uses
 * for Kaggle listings so the UI can feel identical between the two.
 */
function listingForPath(all: DatasetImage[], cwd: string): ListingResult {
  const prefix = cwd ? `${cwd}/` : ''
  const dirAcc = new Map<string, { files: number; bytes: number }>()
  const files: DatasetImage[] = []

  for (const img of all) {
    if (cwd && !img.path.startsWith(prefix)) continue
    const rest = img.path.slice(prefix.length)
    if (!rest) continue
    const slash = rest.indexOf('/')
    if (slash === -1) {
      files.push(img)
    } else {
      const dirName = rest.slice(0, slash)
      const cur = dirAcc.get(dirName) || { files: 0, bytes: 0 }
      cur.files++
      cur.bytes += img.file.size
      dirAcc.set(dirName, cur)
    }
  }

  const dirs: FolderEntry[] = Array.from(dirAcc.entries())
    .map(([name, c]) => ({
      name,
      fullPath: prefix + name,
      fileCount: c.files,
      totalBytes: c.bytes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  files.sort((a, b) => a.path.localeCompare(b.path))
  return { dirs, files }
}

function formatBytes(n: number): string {
  if (!n || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`
}

/**
 * A reusable "folder / dataset" tray with the same browsing UX as the
 * Kaggle `DatasetsPage`: folder tiles + file tiles + breadcrumbs. Items can
 * be added by drag-dropping a folder, multi-selecting files, or picking a
 * folder with the `webkitdirectory` input.
 *
 * Studio mode  → clicking a file tile loads it as the Studio source.
 * Matcher mode → each file tile exposes A / B shortcut buttons.
 *
 * The list is kept in this component's local state — navigating to another
 * page unmounts the tray and drops every blob URL, so nothing persists.
 */
export function DatasetTray(props: DatasetTrayProps) {
  const { disabled, defaultOpen } = props
  const reduced = useReducedMotion()

  const [datasetImages, setDatasetImages] = useState<DatasetImage[]>([])
  const urlCache = useRef<Map<string, string>>(new Map())

  const signatureOf = (f: File, path: string) => `${path}|${f.size}|${f.lastModified}`

  const addDatasetFiles = useCallback(
    (items: { file: File; path: string }[]): { added: number; skipped: number } => {
      let added = 0
      let skipped = 0
      setDatasetImages((prev) => {
        const seen = new Set(prev.map((d) => signatureOf(d.file, d.path)))
        const next: DatasetImage[] = [...prev]
        for (const it of items) {
          const sig = signatureOf(it.file, it.path)
          if (seen.has(sig)) {
            skipped += 1
            continue
          }
          seen.add(sig)
          const id =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`
          const url = URL.createObjectURL(it.file)
          urlCache.current.set(id, url)
          next.push({ id, file: it.file, path: it.path, url })
          added += 1
        }
        return next
      })
      return { added, skipped }
    },
    [],
  )

  const removeDatasetImage = useCallback((id: string) => {
    setDatasetImages((prev) => prev.filter((d) => d.id !== id))
    const url = urlCache.current.get(id)
    if (url) {
      URL.revokeObjectURL(url)
      urlCache.current.delete(id)
    }
  }, [])

  const clearDataset = useCallback(() => {
    for (const url of urlCache.current.values()) URL.revokeObjectURL(url)
    urlCache.current.clear()
    setDatasetImages([])
  }, [])

  // Revoke every live blob URL when the tray unmounts (route change, etc.).
  useEffect(() => {
    const cache = urlCache.current
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url)
      cache.clear()
    }
  }, [])

  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [open, setOpen] = useState<boolean>(defaultOpen ?? true)
  const [cwd, setCwd] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  // If the folder the user was browsing disappears (e.g. cleared all), drop
  // back to root so the UI doesn't stick on a non-existent path.
  useEffect(() => {
    if (!cwd) return
    const stillExists = datasetImages.some(
      (d) => d.path === cwd || d.path.startsWith(`${cwd}/`),
    )
    if (!stillExists) {
      const id = window.setTimeout(() => setCwd(''), 0)
      return () => window.clearTimeout(id)
    }
  }, [datasetImages, cwd])

  useEffect(() => {
    if (!status) return
    const t = window.setTimeout(() => setStatus(null), 3200)
    return () => window.clearTimeout(t)
  }, [status])

  const announce = useCallback((added: number, skipped: number) => {
    if (added === 0 && skipped === 0) {
      setStatus('No images found in that upload.')
    } else if (added === 0) {
      setStatus(`${skipped} duplicate${skipped === 1 ? '' : 's'} skipped.`)
    } else if (skipped === 0) {
      setStatus(`Added ${added} image${added === 1 ? '' : 's'}.`)
    } else {
      setStatus(`Added ${added}, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}.`)
    }
  }, [])

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return
      const items = await readDroppedItems(e.dataTransfer)
      const { added, skipped } = addDatasetFiles(items)
      announce(added, skipped)
    },
    [addDatasetFiles, announce, disabled],
  )

  const onPickFiles = useCallback(
    (list: FileList | null) => {
      if (disabled) return
      const items = readFileList(list)
      const { added, skipped } = addDatasetFiles(items)
      announce(added, skipped)
    },
    [addDatasetFiles, announce, disabled],
  )

  const listing = useMemo(() => listingForPath(datasetImages, cwd), [datasetImages, cwd])

  const crumbs = useMemo(() => {
    if (!cwd) return []
    const parts = cwd.split('/')
    return parts.map((name, i) => ({
      name,
      fullPath: parts.slice(0, i + 1).join('/'),
    }))
  }, [cwd])

  const activeA = props.mode === 'matcher' ? props.activeFileA ?? null : null
  const activeB = props.mode === 'matcher' ? props.activeFileB ?? null : null
  const activeStudio = props.mode === 'studio' ? props.activeFile ?? null : null

  const totalLabel = useMemo(() => {
    if (datasetImages.length === 0) return 'Dataset — empty'
    return `Dataset · ${datasetImages.length} image${datasetImages.length === 1 ? '' : 's'}`
  }, [datasetImages.length])

  return (
    <section
      className={`dataset-tray${dragOver ? ' dataset-tray--drag' : ''}${disabled ? ' dataset-tray--disabled' : ''}`}
      aria-label="Image dataset tray"
    >
      <header className="dataset-tray__head">
        <button
          type="button"
          className="dataset-tray__title"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="dataset-tray__chevron" aria-hidden>
            {open ? '▾' : '▸'}
          </span>
          <span className="dataset-tray__title-text">{totalLabel}</span>
        </button>
        <div className="dataset-tray__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Pick one or more image files"
          >
            Add files
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => folderInputRef.current?.click()}
            disabled={disabled}
            title="Pick a folder — every image inside is loaded"
          >
            Add folder
          </button>
          {datasetImages.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm dataset-tray__clear"
              onClick={() => {
                clearDataset()
                setCwd('')
              }}
              disabled={disabled}
              title="Remove every image from the tray"
            >
              Clear all
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onPickFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          accept="image/*"
          hidden
          multiple
          {...({ webkitdirectory: '', directory: '' } as unknown as Record<string, string>)}
          onChange={(e) => {
            onPickFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </header>

      <AnimatePresence initial={false}>
        {status && (
          <motion.p
            key={status}
            className="dataset-tray__status"
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {status}
          </motion.p>
        )}
      </AnimatePresence>

      {open && (
        <div
          className="dataset-tray__zone"
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setDragOver(true)
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            if (!disabled) setDragOver(true)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setDragOver(false)
          }}
          onDrop={onDrop}
        >
          {datasetImages.length === 0 ? (
            <div className="dataset-tray__empty">
              <p className="dataset-tray__empty-lead">
                Drop a folder or multiple images here
              </p>
              <p className="dataset-tray__empty-sub">
                {props.mode === 'matcher'
                  ? 'Then send any pair into slot A / B with one click.'
                  : 'Then click any thumbnail to load it as the Studio source.'}
              </p>
            </div>
          ) : (
            <>
              <nav className="datasets__crumbs dataset-tray__crumbs" aria-label="Folder path">
                <button
                  type="button"
                  className={`datasets__crumb${cwd === '' ? ' datasets__crumb--on' : ''}`}
                  onClick={() => setCwd('')}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden>
                    <path
                      d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>dataset</span>
                </button>
                {crumbs.map((c, i) => (
                  <span key={c.fullPath} className="datasets__crumb-row">
                    <span className="datasets__crumb-sep" aria-hidden>/</span>
                    <button
                      type="button"
                      className={`datasets__crumb${i === crumbs.length - 1 ? ' datasets__crumb--on' : ''}`}
                      onClick={() => setCwd(c.fullPath)}
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
                {cwd !== '' && (
                  <button
                    type="button"
                    className="datasets__crumb datasets__crumb--up"
                    onClick={() =>
                      setCwd(crumbs.length > 1 ? crumbs[crumbs.length - 2].fullPath : '')
                    }
                    title="Up one folder"
                  >
                    ↑ up
                  </button>
                )}
              </nav>

              {listing.dirs.length === 0 && listing.files.length === 0 ? (
                <p className="panel-hint">This folder is empty.</p>
              ) : (
                <div className="datasets__file-grid dataset-tray__grid">
                  <AnimatePresence initial={false}>
                    {listing.dirs.map((d) => (
                      <motion.button
                        key={`dir:${d.fullPath}`}
                        type="button"
                        className="datasets__file datasets__file--folder"
                        onClick={() => setCwd(d.fullPath)}
                        disabled={disabled}
                        title={`Open ${d.fullPath}/`}
                        layout
                        initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
                        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                      >
                        <span
                          className="datasets__file-icon datasets__file-icon--folder"
                          aria-hidden
                        >
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                            <path
                              d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span className="datasets__file-name">{d.name}/</span>
                        <span className="datasets__file-size">
                          {d.fileCount} file{d.fileCount === 1 ? '' : 's'}
                          {d.totalBytes > 0 ? ` · ${formatBytes(d.totalBytes)}` : ''}
                        </span>
                        <span className="datasets__file-badge datasets__file-badge--folder">
                          folder
                        </span>
                      </motion.button>
                    ))}
                    {listing.files.map((img) => (
                      <DatasetFileTile
                        key={`file:${img.id}`}
                        img={img}
                        mode={props.mode}
                        disabled={disabled}
                        activeStudio={activeStudio}
                        activeA={activeA}
                        activeB={activeB}
                        onPickStudio={
                          props.mode === 'studio'
                            ? () => props.onPick(img.file)
                            : undefined
                        }
                        onPickA={
                          props.mode === 'matcher'
                            ? () => props.onPickSlot('A', img.file)
                            : undefined
                        }
                        onPickB={
                          props.mode === 'matcher'
                            ? () => props.onPickSlot('B', img.file)
                            : undefined
                        }
                        onRemove={() => removeDatasetImage(img.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

interface DatasetFileTileProps {
  img: DatasetImage
  mode: DatasetMode
  disabled?: boolean
  activeStudio?: File | null
  activeA?: File | null
  activeB?: File | null
  onPickStudio?: () => void
  onPickA?: () => void
  onPickB?: () => void
  onRemove: () => void
}

function DatasetFileTile({
  img,
  mode,
  disabled,
  activeStudio,
  activeA,
  activeB,
  onPickStudio,
  onPickA,
  onPickB,
  onRemove,
}: DatasetFileTileProps) {
  const reduced = useReducedMotion()
  const isActiveStudio = mode === 'studio' && activeStudio === img.file
  const isActiveA = mode === 'matcher' && activeA === img.file
  const isActiveB = mode === 'matcher' && activeB === img.file

  const baseClasses = [
    'datasets__file',
    'dataset-tray__file',
    isActiveStudio ? 'datasets__file--active' : '',
    isActiveA ? 'datasets__file--slot-a' : '',
    isActiveB ? 'datasets__file--slot-b' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const basename = img.path.split('/').pop() || img.path

  // The tile itself is only a button in Studio mode — clicking picks the
  // image. In Matcher mode the tile is static and the A/B buttons drive it.
  const Container = mode === 'studio' ? motion.button : motion.div

  const tileProps =
    mode === 'studio'
      ? {
          type: 'button' as const,
          onClick: () => onPickStudio?.(),
          disabled,
          title: `Use ${img.path} as source`,
        }
      : { title: img.path }

  return (
    <Container
      className={baseClasses}
      layout
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.98 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      {...tileProps}
    >
      <div className="dataset-tray__file-thumb-wrap">
        <img src={img.url} alt="" className="dataset-tray__file-thumb" loading="lazy" />
        {(isActiveStudio || isActiveA || isActiveB) && (
          <span className="dataset-tray__file-flag" aria-hidden>
            {isActiveStudio ? 'Active' : isActiveA ? 'A' : 'B'}
          </span>
        )}
      </div>
      <span className="datasets__file-name">{basename}</span>
      <span className="datasets__file-size">{formatBytes(img.file.size)}</span>
      <span className="datasets__file-badge">image</span>
      {isActiveA && <span className="datasets__file-slot datasets__file-slot--a">A</span>}
      {isActiveB && <span className="datasets__file-slot datasets__file-slot--b">B</span>}

      {mode === 'matcher' && (
        <div className="dataset-tray__file-split">
          <button
            type="button"
            className={`dataset-tray__slot dataset-tray__slot--a${isActiveA ? ' dataset-tray__slot--on' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onPickA?.()
            }}
            disabled={disabled}
            title="Use as image A"
          >
            → A
          </button>
          <button
            type="button"
            className={`dataset-tray__slot dataset-tray__slot--b${isActiveB ? ' dataset-tray__slot--on' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onPickB?.()
            }}
            disabled={disabled}
            title="Use as image B"
          >
            → B
          </button>
        </div>
      )}

      <button
        type="button"
        className="dataset-tray__file-remove"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        disabled={disabled}
        aria-label={`Remove ${basename} from dataset`}
        title="Remove from dataset"
      >
        ×
      </button>
    </Container>
  )
}
