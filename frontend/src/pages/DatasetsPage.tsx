import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getKaggleFile, listKaggleFiles } from '../api/cv'
import { useAuth } from '../hooks/useAuth'
import { clearKaggleCreds, loadKaggleCreds, saveKaggleCreds } from '../lib/kaggleCreds'
import type {
  KaggleCreds,
  KaggleFileInfo,
  KaggleFileListResponse,
  KaggleImageResponse,
  PreloadedImageState,
  PreloadedPairState,
} from '../types/cv'

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

interface FolderEntry {
  name: string
  /** Full path from dataset root (no trailing slash). */
  fullPath: string
  fileCount: number
  imageCount: number
  totalBytes: number
}

/** Split the flat file list into "subfolders directly under cwd" + "files directly under cwd". */
function listingForPath(
  allFiles: KaggleFileInfo[],
  cwd: string,
): { dirs: FolderEntry[]; files: KaggleFileInfo[] } {
  const prefix = cwd ? `${cwd}/` : ''
  const dirAcc = new Map<string, { files: number; images: number; bytes: number }>()
  const files: KaggleFileInfo[] = []

  for (const f of allFiles) {
    if (cwd && !f.path.startsWith(prefix)) continue
    const rest = f.path.slice(prefix.length)
    if (!rest) continue
    const slash = rest.indexOf('/')
    if (slash === -1) {
      files.push(f)
    } else {
      const dirName = rest.slice(0, slash)
      const cur = dirAcc.get(dirName) || { files: 0, images: 0, bytes: 0 }
      cur.files++
      if (f.is_image) cur.images++
      cur.bytes += f.size
      dirAcc.set(dirName, cur)
    }
  }

  const dirs: FolderEntry[] = Array.from(dirAcc.entries())
    .map(([name, c]) => ({
      name,
      fullPath: prefix + name,
      fileCount: c.files,
      imageCount: c.images,
      totalBytes: c.bytes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  files.sort((a, b) => a.path.localeCompare(b.path))
  return { dirs, files }
}

const SAMPLE_SLUGS = [
  'andrewmvd/dog-and-cat-detection',
  'puneet6060/intel-image-classification',
  'splcher/animefacedataset',
]

type PickMode = 'single' | 'pair'
type SlotKey = 'A' | 'B'

interface LoadedImage {
  base64: string
  mime: string
  width: number
  height: number
  src: string
  path: string
  filename: string
}

function imageFromKaggleResponse(file: KaggleFileInfo, res: KaggleImageResponse): LoadedImage {
  return {
    base64: res.image_base64,
    mime: res.mime,
    width: res.width,
    height: res.height,
    src: `data:${res.mime};base64,${res.image_base64}`,
    path: file.path,
    filename: file.path.split('/').pop() || 'kaggle-image',
  }
}

export function DatasetsPage() {
  const navigate = useNavigate()
  const { bypass, session, accessToken } = useAuth()

  // ----- credentials state -------------------------------------------------
  const [credsLoading, setCredsLoading] = useState(true)
  const [creds, setCreds] = useState<KaggleCreds | null>(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [savingCreds, setSavingCreds] = useState(false)
  const [credsError, setCredsError] = useState<string | null>(null)
  const [credsMessage, setCredsMessage] = useState<string | null>(null)

  // ----- browse state ------------------------------------------------------
  const [slug, setSlug] = useState('')
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [files, setFiles] = useState<KaggleFileListResponse | null>(null)
  /** Current folder inside the dataset, '' = root. */
  const [cwd, setCwd] = useState('')

  // ----- picker state ------------------------------------------------------
  const [pickMode, setPickMode] = useState<PickMode>('single')

  // single-pick: one preview pane
  const [active, setActive] = useState<LoadedImage | null>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [activeLoading, setActiveLoading] = useState(false)
  const [activeError, setActiveError] = useState<string | null>(null)

  // pair-pick: A + B slots
  const [slotA, setSlotA] = useState<LoadedImage | null>(null)
  const [slotB, setSlotB] = useState<LoadedImage | null>(null)
  const [pairLoading, setPairLoading] = useState<SlotKey | null>(null)
  const [pairError, setPairError] = useState<string | null>(null)

  const userId = session?.user?.id ?? null
  const connected = !!creds

  // ----- load existing creds ----------------------------------------------
  useEffect(() => {
    if (bypass) {
      navigate('/', { replace: true })
      return
    }
    if (!userId) return
    let cancelled = false
    setCredsLoading(true)
    loadKaggleCreds(userId)
      .then((c) => {
        if (cancelled) return
        setCreds(c)
        if (c) {
          setUsernameInput(c.username)
          setKeyInput('')
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setCredsError(e instanceof Error ? e.message : 'Failed to load credentials')
      })
      .finally(() => {
        if (!cancelled) setCredsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bypass, navigate, userId])

  const onSaveCreds = useCallback(async () => {
    if (!userId) return
    const u = usernameInput.trim()
    const k = keyInput.trim()
    if (!u || !k) {
      setCredsError('Both Kaggle username and API key are required.')
      return
    }
    setSavingCreds(true)
    setCredsError(null)
    setCredsMessage(null)
    try {
      await saveKaggleCreds(userId, { username: u, key: k })
      setCreds({ username: u, key: k })
      setKeyInput('')
      setCredsMessage('Kaggle account connected.')
    } catch (e) {
      setCredsError(e instanceof Error ? e.message : 'Failed to save credentials')
    } finally {
      setSavingCreds(false)
    }
  }, [userId, usernameInput, keyInput])

  const onDisconnect = useCallback(async () => {
    if (!userId) return
    setSavingCreds(true)
    setCredsError(null)
    setCredsMessage(null)
    try {
      await clearKaggleCreds(userId)
      setCreds(null)
      setKeyInput('')
      setFiles(null)
      setCwd('')
      setActive(null)
      setActivePath(null)
      setSlotA(null)
      setSlotB(null)
      setCredsMessage('Disconnected.')
    } catch (e) {
      setCredsError(e instanceof Error ? e.message : 'Failed to disconnect')
    } finally {
      setSavingCreds(false)
    }
  }, [userId])

  // ----- browse dataset ---------------------------------------------------
  const browseDataset = useCallback(
    async (target: string) => {
      if (!creds) {
        setBrowseError('Connect your Kaggle account first.')
        return
      }
      const cleaned = target
        .trim()
        .replace(/^https?:\/\/(www\.)?kaggle\.com\/datasets\//, '')
        .replace(/\/$/, '')
      if (!cleaned.includes('/')) {
        setBrowseError('Use the form "owner/dataset-name".')
        return
      }
      setBrowseLoading(true)
      setBrowseError(null)
      setFiles(null)
      setCwd('')
      setActive(null)
      setActivePath(null)
      setActiveError(null)
      setSlotA(null)
      setSlotB(null)
      setPairError(null)
      try {
        const res = await listKaggleFiles(cleaned, creds, accessToken)
        setFiles(res)
        setSlug(`${res.owner}/${res.name}`)
        if (res.files.length === 0) {
          setBrowseError('Dataset has no files (or none visible to your account).')
        }
      } catch (e) {
        setBrowseError(e instanceof Error ? e.message : 'Failed to load dataset')
      } finally {
        setBrowseLoading(false)
      }
    },
    [creds, accessToken],
  )

  // ----- load one image (used by both modes) ------------------------------
  const fetchImage = useCallback(
    async (file: KaggleFileInfo): Promise<LoadedImage> => {
      if (!creds || !files) throw new Error('No dataset loaded')
      const res = await getKaggleFile(`${files.owner}/${files.name}`, file.path, creds, accessToken)
      return imageFromKaggleResponse(file, res)
    },
    [creds, files, accessToken],
  )

  // ----- single-mode pick -------------------------------------------------
  const pickSingle = useCallback(
    async (file: KaggleFileInfo) => {
      setActivePath(file.path)
      setActive(null)
      setActiveError(null)
      if (!file.is_image) {
        setActiveError(
          file.is_archive
            ? 'This is an archive (zip / tar). Kaggle does not stream files inside an archive — pick a dataset that lists loose images.'
            : 'Only image files can be opened in V-Rush (jpg / png / webp / bmp / tif).',
        )
        return
      }
      setActiveLoading(true)
      try {
        const img = await fetchImage(file)
        setActive(img)
      } catch (e) {
        setActiveError(e instanceof Error ? e.message : 'Failed to load image')
      } finally {
        setActiveLoading(false)
      }
    },
    [fetchImage],
  )

  // ----- pair-mode pick (cycles: empty → A → B → cleared) -----------------
  const pickPair = useCallback(
    async (file: KaggleFileInfo) => {
      if (!file.is_image) {
        setPairError(
          file.is_archive
            ? 'Archives can\u2019t be opened directly. Pick a dataset that lists loose images.'
            : 'Only image files can be sent to the Matcher.',
        )
        return
      }
      setPairError(null)

      // If the file is already in a slot, clicking again removes it.
      if (slotA?.path === file.path) {
        setSlotA(null)
        return
      }
      if (slotB?.path === file.path) {
        setSlotB(null)
        return
      }

      const targetSlot: SlotKey = slotA ? 'B' : 'A'
      setPairLoading(targetSlot)
      try {
        const img = await fetchImage(file)
        if (targetSlot === 'A') setSlotA(img)
        else setSlotB(img)
      } catch (e) {
        setPairError(e instanceof Error ? e.message : 'Failed to load image')
      } finally {
        setPairLoading(null)
      }
    },
    [fetchImage, slotA, slotB],
  )

  // ----- send to other pages ----------------------------------------------
  const sendSingleTo = useCallback(
    (target: '/studio' | '/lab' | '/match', slot?: SlotKey) => {
      if (!active) return
      const state: PreloadedImageState = {
        slot,
        filename: active.filename,
        mime: active.mime,
        base64: active.base64,
      }
      navigate(target, { state })
    },
    [active, navigate],
  )

  const sendPairToMatcher = useCallback(() => {
    if (!slotA || !slotB) return
    const state: PreloadedPairState = {
      a: { filename: slotA.filename, mime: slotA.mime, base64: slotA.base64 },
      b: { filename: slotB.filename, mime: slotB.mime, base64: slotB.base64 },
    }
    navigate('/match', { state })
  }, [slotA, slotB, navigate])

  // ----- folder navigation -------------------------------------------------
  const listing = useMemo(
    () => (files ? listingForPath(files.files, cwd) : { dirs: [], files: [] }),
    [files, cwd],
  )

  const crumbs = useMemo(() => {
    if (!cwd) return []
    const parts = cwd.split('/')
    return parts.map((name, i) => ({ name, fullPath: parts.slice(0, i + 1).join('/') }))
  }, [cwd])

  // ----- file grid --------------------------------------------------------
  const filesGrid = useMemo(() => {
    if (!files) return null

    const renderFolder = (d: FolderEntry) => (
      <button
        key={`dir:${d.fullPath}`}
        type="button"
        className="datasets__file datasets__file--folder"
        onClick={() => setCwd(d.fullPath)}
        title={`Open ${d.fullPath}/`}
      >
        <span className="datasets__file-icon datasets__file-icon--folder" aria-hidden>
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
          {d.imageCount > 0 ? ` · ${d.imageCount} img` : ''}
          {d.totalBytes > 0 ? ` · ${formatBytes(d.totalBytes)}` : ''}
        </span>
        <span className="datasets__file-badge datasets__file-badge--folder">folder</span>
      </button>
    )

    const renderFile = (f: KaggleFileInfo) => {
      const basename = f.path.split('/').pop() || f.path
      const inA = slotA?.path === f.path
      const inB = slotB?.path === f.path
      const inSingle = activePath === f.path
      const isLoadingThis =
        (pickMode === 'single' && activeLoading && inSingle) ||
        (pickMode === 'pair' && pairLoading !== null && (inA || inB || (!slotA && !slotB)))
      const cls = [
        'datasets__file',
        inSingle && pickMode === 'single' ? 'datasets__file--active' : '',
        inA ? 'datasets__file--slot-a' : '',
        inB ? 'datasets__file--slot-b' : '',
        f.is_archive ? 'datasets__file--archive' : '',
        !f.is_image && !f.is_archive ? 'datasets__file--other' : '',
      ]
        .filter(Boolean)
        .join(' ')
      return (
        <button
          key={`file:${f.path}`}
          type="button"
          className={cls}
          onClick={() => (pickMode === 'single' ? void pickSingle(f) : void pickPair(f))}
          disabled={isLoadingThis}
          title={f.path}
        >
          <span className="datasets__file-icon">
            {basename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}
          </span>
          <span className="datasets__file-name">{basename}</span>
          <span className="datasets__file-size">{formatBytes(f.size)}</span>
          {f.is_image && <span className="datasets__file-badge">image</span>}
          {f.is_archive && (
            <span className="datasets__file-badge datasets__file-badge--warn">archive</span>
          )}
          {inA && <span className="datasets__file-slot datasets__file-slot--a">A</span>}
          {inB && <span className="datasets__file-slot datasets__file-slot--b">B</span>}
        </button>
      )
    }

    return (
      <div className="datasets__file-grid">
        {listing.dirs.map(renderFolder)}
        {listing.files.map(renderFile)}
        {listing.dirs.length === 0 && listing.files.length === 0 && (
          <p className="panel-hint">This folder is empty.</p>
        )}
      </div>
    )
  }, [files, listing, slotA, slotB, activePath, pickMode, activeLoading, pairLoading, pickSingle, pickPair])

  if (bypass) return null

  const onlyArchives =
    !!files && files.files.length > 0 && files.files.every((f) => f.is_archive)

  return (
    <div className="datasets">
      <header className="datasets__hero">
        <h1 className="datasets__title">
          Pull images straight from <span className="datasets__title-accent">Kaggle</span>
        </h1>
        <p className="datasets__lede">
          Connect your Kaggle account once, then browse any public dataset by slug and send a
          file straight into Studio or the Matcher. Your API key is stored privately on
          your profile (RLS-protected) and only sent with your own requests.
        </p>
      </header>

      {/* ----- connect ----- */}
      <section className="dock-panel datasets__panel">
        <h2 className="dock-panel__title">
          <span className="dock-panel__dot dock-panel__dot--violet" />
          Connect your Kaggle account
          <span className="datasets__status-wrap">
            <span className={`datasets__status ${connected ? 'datasets__status--on' : 'datasets__status--off'}`}>
              {connected ? `Connected as ${creds?.username}` : 'Not connected'}
            </span>
          </span>
        </h2>

        {credsError && <div className="banner banner--error">{credsError}</div>}
        {credsMessage && <div className="banner banner--ok">{credsMessage}</div>}

        <p className="datasets__hint">
          Generate an API token from{' '}
          <a href="https://www.kaggle.com/settings" target="_blank" rel="noopener noreferrer">
            kaggle.com/settings
          </a>
          {' '}— click <em>"Create New Token"</em>. It downloads a <code>kaggle.json</code> file
          with your username and key.
        </p>

        <div className="datasets__row">
          <label className="datasets__field">
            <span className="datasets__label">Kaggle username</span>
            <input
              type="text"
              className="datasets__input"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="your-kaggle-username"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              disabled={savingCreds || credsLoading}
            />
          </label>
          <label className="datasets__field">
            <span className="datasets__label">API key {connected && <em>(leave blank to keep current)</em>}</span>
            <input
              type="password"
              className="datasets__input"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={connected ? '••••••••••••••••••••••••••••••' : '32-character API key'}
              autoComplete="off"
              spellCheck={false}
              maxLength={256}
              disabled={savingCreds || credsLoading}
            />
          </label>
        </div>

        <div className="datasets__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={savingCreds || credsLoading || !usernameInput.trim() || !keyInput.trim()}
            onClick={() => void onSaveCreds()}
          >
            {savingCreds ? 'Saving…' : connected ? 'Update credentials' : 'Connect'}
          </button>
          {connected && (
            <button type="button" className="btn btn--ghost" disabled={savingCreds} onClick={() => void onDisconnect()}>
              Disconnect
            </button>
          )}
        </div>
      </section>

      {/* ----- browse ----- */}
      <section className="dock-panel datasets__panel">
        <h2 className="dock-panel__title">
          <span className="dock-panel__dot dock-panel__dot--cyan" />
          Browse a dataset
        </h2>

        <p className="datasets__hint">
          Paste any public dataset slug (e.g. <code>andrewmvd/dog-and-cat-detection</code>)
          or a full <code>kaggle.com/datasets/...</code> URL. Datasets that publish a single
          archive (.zip) can be browsed but individual files cannot be streamed — pick one
          that lists loose images.
        </p>

        <div className="datasets__row datasets__row--browse">
          <input
            type="text"
            className="datasets__input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="owner/dataset-name"
            disabled={browseLoading || !connected}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void browseDataset(slug)
            }}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!connected || browseLoading || !slug.trim()}
            onClick={() => void browseDataset(slug)}
          >
            {browseLoading ? 'Loading…' : 'List files'}
          </button>
        </div>

        <div className="datasets__actions">
          {SAMPLE_SLUGS.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!connected || browseLoading}
              onClick={() => {
                setSlug(s)
                void browseDataset(s)
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {browseError && <div className="banner banner--error">{browseError}</div>}

        {files && files.files.length > 0 && (
          <>
            {onlyArchives && (
              <div className="banner banner--warn">
                This dataset only exposes archives. Open it on{' '}
                <a
                  href={`https://www.kaggle.com/datasets/${files.owner}/${files.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kaggle.com
                </a>{' '}
                to verify, or pick a dataset that lists loose images.
              </div>
            )}

            {/* ----- pick mode tabs ----- */}
            <div className="datasets__mode">
              <button
                type="button"
                className={`datasets__mode-tab${pickMode === 'single' ? ' datasets__mode-tab--on' : ''}`}
                onClick={() => setPickMode('single')}
                disabled={activeLoading}
              >
                <span className="datasets__mode-title">Pick one image</span>
                <span className="datasets__mode-sub">Send to Studio (Local · Deep) or one Matcher slot</span>
              </button>
              <button
                type="button"
                className={`datasets__mode-tab${pickMode === 'pair' ? ' datasets__mode-tab--on' : ''}`}
                onClick={() => setPickMode('pair')}
                disabled={pairLoading !== null}
              >
                <span className="datasets__mode-title">Pick two for the Matcher</span>
                <span className="datasets__mode-sub">Click two images — they fill slots A &amp; B, then open both at once</span>
              </button>
            </div>

            <p className="datasets__hint">
              Found <strong>{files.files.length}</strong> files in{' '}
              <code>{files.owner}/{files.name}</code>.
              {pickMode === 'single'
                ? ' Click an image to preview it, or open a folder to drill in.'
                : ' Click an image to fill slot A, then another to fill slot B. Click again to clear.'}
            </p>

            <nav className="datasets__crumbs" aria-label="Folder path">
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
                <span>{files.owner}/{files.name}</span>
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
                  onClick={() => setCwd(crumbs.length > 1 ? crumbs[crumbs.length - 2].fullPath : '')}
                  title="Up one folder"
                >
                  ↑ up
                </button>
              )}
            </nav>

            {filesGrid}
          </>
        )}
      </section>

      {/* ----- single-mode preview & actions ----- */}
      {pickMode === 'single' && activePath && (
        <section className="datasets__sheet">
          <div className="datasets__sheet-head">
            <p className="datasets__sheet-name">{activePath}</p>
            <span className="datasets__sheet-meta">
              {active && <span>{active.width} × {active.height}</span>}
            </span>
          </div>

          {activeError && <div className="banner banner--error">{activeError}</div>}
          {activeLoading && <p className="panel-hint">Fetching the image from Kaggle…</p>}

          {active && (
            <>
              <img className="datasets__thumb" src={active.src} alt={active.path} />
              <p className="datasets__sheet-prompt">
                <strong>Got it!</strong> Where do you want to use this image?
              </p>
              <div className="datasets__sheet-actions">
                <button type="button" className="btn btn--primary" onClick={() => sendSingleTo('/studio')}>
                  Use in Studio · Local
                </button>
                <button type="button" className="btn" onClick={() => sendSingleTo('/lab')}>
                  Use in Studio · Deep
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => sendSingleTo('/match', 'A')}>
                  Add to Matcher · A
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => sendSingleTo('/match', 'B')}>
                  Add to Matcher · B
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ----- pair-mode preview & actions ----- */}
      {pickMode === 'pair' && (slotA || slotB || pairLoading) && (
        <section className="datasets__sheet">
          <div className="datasets__sheet-head">
            <p className="datasets__sheet-name">Matcher pair</p>
            <span className="datasets__sheet-meta">
              <span>
                {slotA && slotB ? '2 / 2' : slotA || slotB ? '1 / 2' : '0 / 2'} selected
              </span>
            </span>
          </div>

          {pairError && <div className="banner banner--error">{pairError}</div>}

          <div className="datasets__pair">
            <div className="datasets__pair-slot">
              <span className="datasets__pair-tag datasets__pair-tag--a">A</span>
              {pairLoading === 'A' ? (
                <p className="panel-hint">Loading…</p>
              ) : slotA ? (
                <>
                  <img className="datasets__pair-thumb" src={slotA.src} alt={slotA.path} />
                  <p className="datasets__pair-name" title={slotA.path}>{slotA.filename}</p>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setSlotA(null)}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <p className="datasets__pair-empty">Click any image above</p>
              )}
            </div>

            <div className="datasets__pair-slot">
              <span className="datasets__pair-tag datasets__pair-tag--b">B</span>
              {pairLoading === 'B' ? (
                <p className="panel-hint">Loading…</p>
              ) : slotB ? (
                <>
                  <img className="datasets__pair-thumb" src={slotB.src} alt={slotB.path} />
                  <p className="datasets__pair-name" title={slotB.path}>{slotB.filename}</p>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setSlotB(null)}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <p className="datasets__pair-empty">Click another image above</p>
              )}
            </div>
          </div>

          <div className="datasets__sheet-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!slotA || !slotB}
              onClick={sendPairToMatcher}
            >
              Open both in Matcher
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!slotA && !slotB}
              onClick={() => {
                setSlotA(null)
                setSlotB(null)
              }}
            >
              Clear
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
