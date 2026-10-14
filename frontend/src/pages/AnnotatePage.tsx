import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnnotateCanvas } from '../components/AnnotateCanvas'
import {
  deleteLocalAnnotationProject,
  fetchAnnotateCapabilities,
  listLocalAnnotationProjects,
  saveLocalAnnotationProject,
  type AnnotationProjectSummary,
} from '../api/cv'
import { useAuth } from '../hooks/useAuth'
import { detectAndMergeFrame } from '../lib/annotateDetect'
import {
  countBoxes,
  deleteProjectFromIndexedDb,
  downloadAndPurgeProject,
  listProjectsFromIndexedDb,
  loadProjectFromIndexedDb,
  newProjectId,
  revokeProjectFrameUrls,
  saveProjectToIndexedDb,
  verifyProjectInIndexedDb,
} from '../lib/annotationStorage'
import {
  createIdentity,
  identityHotkeyBadge,
  identityHotkeyIndex,
  pruneUnusedIdentities,
} from '../lib/reidHelpers'
import { extractVideoFrames } from '../lib/videoFrames'
import { COCO80_CLASS_NAMES } from '../lib/coco80'
import type { AnnotatedFrame, AnnotationBox, ReIdIdentity, VideoAnnotationProject } from '../types/annotate'

const QUICK_CLASSES = ['person', 'car', 'dog', 'cat', 'bicycle', 'bus']

async function blobFromImageUrl(url: string): Promise<Blob> {
  const res = await fetch(url)
  return await res.blob()
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function touchUpdated(project: VideoAnnotationProject): VideoAnnotationProject {
  return { ...project, updatedAt: new Date().toISOString() }
}

export function AnnotatePage() {
  const { accessToken } = useAuth()
  const [project, setProject] = useState<VideoAnnotationProject | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)
  const [activeReidId, setActiveReidId] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedList, setSavedList] = useState<AnnotationProjectSummary[]>([])
  const [localDisk, setLocalDisk] = useState(false)
  const [sampleFps, setSampleFps] = useState(2)
  const [maxFrames, setMaxFrames] = useState(60)
  const [conf, setConf] = useState(0.25)
  const [maxDet] = useState(50)
  const [targetClasses, setTargetClasses] = useState<string[]>(['person'])
  const [propagateReid, setPropagateReid] = useState(true)
  const [classFilter, setClassFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const currentFrame = project?.frames[frameIndex] ?? null
  const selectedBox = useMemo(
    () => currentFrame?.boxes.find((b) => b.id === selectedBoxId) ?? null,
    [currentFrame, selectedBoxId],
  )

  const identityList = useMemo(
    () => (project ? Object.values(project.identities) : []),
    [project],
  )

  const refreshSaved = useCallback(async () => {
    const idb = await listProjectsFromIndexedDb()
    setSavedList(
      idb.map((p) => ({
        id: p.id,
        videoName: p.videoName,
        frameCount: p.frameCount,
        boxCount: p.boxCount,
        identityCount: p.identityCount,
        updatedAt: p.updatedAt,
      })),
    )
    try {
      const caps = await fetchAnnotateCapabilities(accessToken)
      setLocalDisk(caps.local_disk_enabled)
      if (caps.local_disk_enabled) {
        const local = await listLocalAnnotationProjects(accessToken)
        const merged = new Map<string, AnnotationProjectSummary>()
        for (const p of idb.map((x) => ({ ...x, updatedAt: x.updatedAt }))) merged.set(p.id, p)
        for (const p of local) merged.set(p.id, p)
        setSavedList([...merged.values()].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'API unavailable'
      if (msg.includes('503') || msg.toLowerCase().includes('not configured for authentication')) {
        setError(
          'API auth is not configured. For local dev set KERNELLAB_AUTH_DISABLED=1 in backend/.env (or set SUPABASE_JWT_SECRET), then restart uvicorn.',
        )
      }
    }
  }, [accessToken])

  useEffect(() => {
    void refreshSaved()
  }, [refreshSaved])

  const setProjectSafe = useCallback((next: VideoAnnotationProject | null) => {
    revokeProjectFrameUrls(project)
    setProject(next)
    setFrameIndex(0)
    setSelectedBoxId(null)
    const firstId = next ? Object.keys(next.identities)[0] ?? null : null
    setActiveReidId(firstId)
  }, [project])

  const updateFrameBoxes = useCallback(
    (boxes: AnnotationBox[]) => {
      if (!project || !currentFrame) return
      const frames = project.frames.map((f) =>
        f.frameIndex === currentFrame.frameIndex ? { ...f, boxes } : f,
      )
      const identities = pruneUnusedIdentities(frames, project.identities)
      setProject(touchUpdated({ ...project, frames, identities }))
      setActiveReidId((prev) =>
        prev && identities[prev] ? prev : Object.keys(identities)[0] ?? null,
      )
    },
    [project, currentFrame],
  )

  const deleteSelectedBox = useCallback(() => {
    if (!selectedBoxId || !currentFrame) return
    updateFrameBoxes(currentFrame.boxes.filter((b) => b.id !== selectedBoxId))
    setSelectedBoxId(null)
    setInfoMessage('Box removed from this frame.')
  }, [selectedBoxId, currentFrame, updateFrameBoxes])

  const applyReidToSelection = useCallback(
    (reidId: string) => {
      if (!project) return
      const label = project.identities[reidId]?.displayName ?? reidId
      if (selectedBoxId && currentFrame) {
        updateFrameBoxes(
          currentFrame.boxes.map((b) => (b.id === selectedBoxId ? { ...b, reidId } : b)),
        )
        setInfoMessage(`Re-ID set to ${label} (box kept, no redraw).`)
      }
      setActiveReidId(reidId)
    },
    [project, selectedBoxId, currentFrame, updateFrameBoxes],
  )

  const detectOpts = useMemo(
    () => ({
      conf,
      maxDet,
      targetClasses,
      propagateReid,
      accessToken,
    }),
    [conf, maxDet, targetClasses, propagateReid, accessToken],
  )

  const addIdentity = useCallback(() => {
    if (!project) return
    const className = targetClasses[0] ?? 'person'
    const ident = createIdentity(className, project.identities)
    setProject(
      touchUpdated({
        ...project,
        identities: { ...project.identities, [ident.id]: ident },
      }),
    )
    setActiveReidId(ident.id)
  }, [project, targetClasses])

  const onIdentityCreated = useCallback(
    (ident: ReIdIdentity) => {
      if (!project) return
      setProject(
        touchUpdated({
          ...project,
          identities: { ...project.identities, [ident.id]: ident },
        }),
      )
      setActiveReidId(ident.id)
    },
    [project],
  )

  const onVideoSelected = useCallback(
    async (file: File) => {
      setError(null)
      setExtracting(true)
      setExtractProgress('0%')
      try {
        const { frames, durationSec, width, height } = await extractVideoFrames(file, {
          sampleFps,
          maxFrames,
          onProgress: (d, t) => setExtractProgress(`${Math.round((d / t) * 100)}%`),
        })
        const annotated: AnnotatedFrame[] = frames.map((f) => ({
          frameIndex: f.frameIndex,
          timestampSec: f.timestampSec,
          imageUrl: f.objectUrl,
          width: f.width,
          height: f.height,
          boxes: [],
        }))
        const id = newProjectId()
        const ident = createIdentity(targetClasses[0] ?? 'person', {})
        setProjectSafe({
          id,
          videoName: file.name,
          width,
          height,
          durationSec,
          sampleFps,
          targetClasses,
          identities: { [ident.id]: ident },
          frames: annotated,
          updatedAt: new Date().toISOString(),
        })
        setActiveReidId(ident.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to extract frames')
      } finally {
        setExtracting(false)
        setExtractProgress('')
      }
    },
    [sampleFps, maxFrames, targetClasses, setProjectSafe],
  )

  const runYoloCurrent = useCallback(async () => {
    if (!project) return
    setDetecting(true)
    setError(null)
    setInfoMessage(null)
    try {
      const next = await detectAndMergeFrame(project, frameIndex, detectOpts)
      setProject(next)
      const n = next.frames[frameIndex]?.boxes.length ?? 0
      setInfoMessage(
        n > 0
          ? `YOLO found ${n} box(es) on this frame.`
          : 'YOLO finished with 0 detections on this frame (try lowering conf or checking backend/yolo26n.onnx).',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed')
    } finally {
      setDetecting(false)
    }
  }, [project, frameIndex, detectOpts])

  const runYoloAll = useCallback(async () => {
    if (!project) return
    setDetecting(true)
    setError(null)
    setInfoMessage(null)
    try {
      let working = project
      const total = working.frames.length
      for (let i = 0; i < total; i++) {
        setExtractProgress(`YOLO ${i + 1} / ${total}`)
        working = await detectAndMergeFrame(working, i, detectOpts)
      }
      setProject(working)
      const boxCount = countBoxes(working.frames)
      setInfoMessage(
        boxCount > 0
          ? `YOLO all frames done: ${boxCount} total boxes. Click Save project to keep them.`
          : `YOLO ran on ${total} frames but found 0 boxes — lower conf, pick classes (e.g. person), or ensure backend has yolo26n.onnx.`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Batch detection failed'
      setError(`${msg} (partial results may be on screen — save if needed.)`)
    } finally {
      setDetecting(false)
      setExtractProgress('')
    }
  }, [project, detectOpts])

  const persistProject = useCallback(async () => {
    if (!project) return
    setSaving(true)
    setSaveMessage(null)
    setError(null)
    try {
      const next = touchUpdated(project)
      setProject(next)
      const boxCount = countBoxes(next.frames)
      await saveProjectToIndexedDb(next)
      const verify = await verifyProjectInIndexedDb(next.id, next.frames.length, boxCount)
      let diskNote = ''
      if (localDisk) {
        const framesPayload = await Promise.all(
          next.frames.map(async (f) => {
            const blob = await blobFromImageUrl(f.imageUrl)
            return {
              frameIndex: f.frameIndex,
              timestampSec: f.timestampSec,
              imageBase64: await blobToBase64(blob),
              mime: blob.type || 'image/jpeg',
              boxes: f.boxes,
            }
          }),
        )
        await saveLocalAnnotationProject(
          {
            id: next.id,
            videoName: next.videoName,
            width: next.width,
            height: next.height,
            durationSec: next.durationSec,
            sampleFps: next.sampleFps,
            targetClasses: next.targetClasses,
            identities: next.identities,
            frames: framesPayload,
            updatedAt: next.updatedAt,
          },
          accessToken,
        )
        diskNote = ' Also synced to local disk (backend/annotations/).'
      }
      if (!verify.ok) {
        setError(verify.message)
      } else {
        setSaveMessage(`${verify.message}${diskNote}`)
      }
      await refreshSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }, [project, localDisk, accessToken, refreshSaved])

  const loadSaved = useCallback(
    async (id: string) => {
      const loaded = await loadProjectFromIndexedDb(id)
      if (loaded) setProjectSafe(loaded)
    },
    [setProjectSafe],
  )

  const downloadSaved = useCallback(
    async (id: string) => {
      const loaded = await loadProjectFromIndexedDb(id)
      if (!loaded) return
      const purge = import.meta.env.PROD || !localDisk
      await downloadAndPurgeProject(loaded, { purgeFromIndexedDb: purge })
      if (localDisk) {
        try {
          await deleteLocalAnnotationProject(id, accessToken)
        } catch {
          /* */
        }
      }
      revokeProjectFrameUrls(loaded)
      if (project?.id === id) setProjectSafe(null)
      await refreshSaved()
    },
    [localDisk, accessToken, project, refreshSaved, setProjectSafe],
  )

  const deleteSaved = useCallback(
    async (id: string) => {
      await deleteProjectFromIndexedDb(id)
      if (localDisk) {
        try {
          await deleteLocalAnnotationProject(id, accessToken)
        } catch {
          /* */
        }
      }
      if (project?.id === id) setProjectSafe(null)
      await refreshSaved()
    },
    [localDisk, accessToken, project, refreshSaved, setProjectSafe],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!project) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFrameIndex((i) => Math.max(0, i - 1))
        setSelectedBoxId(null)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFrameIndex((i) => Math.min(project.frames.length - 1, i + 1))
        setSelectedBoxId(null)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedBoxId || !currentFrame) return
        e.preventDefault()
        deleteSelectedBox()
      } else if (e.key === 'Escape') {
        setSelectedBoxId(null)
      } else if (e.key === 'n' || e.key === 'N') {
        addIdentity()
      } else if (e.key === '[' || e.key === ']') {
        if (identityList.length === 0) return
        e.preventDefault()
        const selectedReid =
          selectedBoxId && currentFrame
            ? currentFrame.boxes.find((b) => b.id === selectedBoxId)?.reidId
            : null
        const curIdx = selectedReid
          ? identityList.findIndex((i) => i.id === selectedReid)
          : identityList.findIndex((i) => i.id === activeReidId)
        const base = curIdx >= 0 ? curIdx : 0
        const nextIdx =
          e.key === ']'
            ? (base + 1) % identityList.length
            : (base - 1 + identityList.length) % identityList.length
        const ident = identityList[nextIdx]
        if (ident) applyReidToSelection(ident.id)
      } else {
        const idx = identityHotkeyIndex(e.key)
        if (idx !== null) {
          const ident = identityList[idx]
          if (ident) applyReidToSelection(ident.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    project,
    selectedBoxId,
    currentFrame,
    deleteSelectedBox,
    addIdentity,
    identityList,
    applyReidToSelection,
    activeReidId,
  ])

  const filteredCoco = useMemo(() => {
    const q = classFilter.trim().toLowerCase()
    if (!q) return COCO80_CLASS_NAMES.slice(0, 24)
    return COCO80_CLASS_NAMES.filter((n) => n.toLowerCase().includes(q)).slice(0, 40)
  }, [classFilter])

  const toggleClass = (name: string) => {
    const key = name.toLowerCase()
    setTargetClasses((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key].sort(),
    )
  }

  return (
    <div className="annotate">
      <header className="annotate__hero">
        <h1 className="annotate__title">Video Re-ID Annotation</h1>
        <p className="annotate__lede">
          Upload a video, sample frames in the browser, pre-label with YOLO26, then refine boxes and
          assign per-person colors and one caption per Re-ID. Saved projects can be
          downloaded as a ZIP; on the deployed site they are removed after download.
        </p>
      </header>

      {error && <div className="banner banner--error">{error}</div>}
      {saveMessage && <div className="banner banner--ok">{saveMessage}</div>}
      {infoMessage && <div className="banner banner--ok">{infoMessage}</div>}

      <section className="dock-panel annotate__panel">
        <h2 className="dock-panel__title">
          <span className="dock-panel__dot dock-panel__dot--violet" />
          Video &amp; detection setup
        </h2>
        <div className="annotate__row">
          <label className="annotate__field">
            <span className="annotate__label">Video file</span>
            <input
              type="file"
              accept="video/*"
              disabled={extracting}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onVideoSelected(f)
              }}
            />
          </label>
          <label className="annotate__field">
            <span className="annotate__label">Sample FPS</span>
            <input
              type="number"
              min={0.25}
              max={30}
              step={0.25}
              value={sampleFps}
              onChange={(e) => setSampleFps(Number(e.target.value))}
            />
          </label>
          <label className="annotate__field">
            <span className="annotate__label">Max frames</span>
            <input
              type="number"
              min={1}
              max={500}
              value={maxFrames}
              onChange={(e) => setMaxFrames(Number(e.target.value))}
            />
          </label>
          <label className="annotate__field">
            <span className="annotate__label">conf</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={conf}
              onChange={(e) => setConf(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="annotate__chips">
          {QUICK_CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              className={`annotate__chip${targetClasses.includes(c) ? ' annotate__chip--on' : ''}`}
              onClick={() => toggleClass(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="annotate__class-pick">
          <input
            type="search"
            className="annotate__input"
            placeholder="Filter COCO classes…"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          />
          <div className="annotate__class-list">
            {filteredCoco.map((name) => (
              <button
                key={name}
                type="button"
                className={`annotate__chip annotate__chip--sm${
                  targetClasses.includes(name.toLowerCase()) ? ' annotate__chip--on' : ''
                }`}
                onClick={() => toggleClass(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="annotate__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!project || detecting}
            onClick={() => void runYoloCurrent()}
          >
            {detecting ? 'Running YOLO…' : 'YOLO current frame'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!project || detecting}
            onClick={() => void runYoloAll()}
          >
            YOLO all frames
          </button>
          <label className="annotate__check">
            <input
              type="checkbox"
              checked={propagateReid}
              onChange={(e) => setPropagateReid(e.target.checked)}
            />
            IoU Re-ID across frames
          </label>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!project || saving}
            onClick={() => void persistProject()}
          >
            {saving ? 'Saving…' : 'Save project'}
          </button>
        </div>
        {extracting && <p className="panel-hint">Extracting frames… {extractProgress}</p>}
        {detecting && extractProgress && <p className="panel-hint">{extractProgress}</p>}
      </section>

      {project && currentFrame && (
        <div className="annotate__workspace">
          <section className="annotate__main dock-panel">
            <div className="annotate__frame-strip">
              {project.frames.map((f, i) => (
                <button
                  key={f.frameIndex}
                  type="button"
                  className={`annotate__thumb${i === frameIndex ? ' annotate__thumb--on' : ''}`}
                  onClick={() => {
                    setFrameIndex(i)
                    setSelectedBoxId(null)
                  }}
                  title={`Frame ${f.frameIndex} · ${f.boxes.length} boxes`}
                >
                  <img src={f.imageUrl} alt="" />
                  <span className="annotate__thumb-badge">{f.boxes.length}</span>
                </button>
              ))}
            </div>
            <AnnotateCanvas
              imageUrl={currentFrame.imageUrl}
              width={currentFrame.width}
              height={currentFrame.height}
              boxes={currentFrame.boxes}
              identities={project.identities}
              selectedBoxId={selectedBoxId}
              activeReidId={activeReidId}
              defaultClassName={targetClasses[0] ?? 'person'}
              onBoxesChange={updateFrameBoxes}
              onSelectBox={setSelectedBoxId}
              onIdentityCreated={onIdentityCreated}
            />
            <div className="annotate__canvas-bar">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!selectedBoxId}
                onClick={deleteSelectedBox}
              >
                Delete selected box
              </button>
              <span className="panel-hint annotate__hints">
                Click a box · <kbd>1</kbd>–<kbd>9</kbd>/<kbd>0</kbd> Re-ID · <kbd>[</kbd>
                <kbd>]</kbd> cycle · <kbd>Del</kbd> delete
              </span>
            </div>
          </section>

          <aside className="annotate__dock dock-panel">
            <h3 className="annotate__dock-title">Re-ID identities</h3>
            <button type="button" className="btn btn--sm" onClick={addIdentity}>
              + New person
            </button>
            <p className="panel-hint annotate__identity-hint">
              {selectedBox
                ? 'Reassign: click a person, 1–9/0 for first ten, or [ ] to cycle everyone.'
                : 'Active for new boxes: click a person, 1–9/0 for first ten, or [ ] to cycle.'}
            </p>
            <ul className="annotate__identity-list">
              {identityList.map((ident, i) => {
                const hotkey = identityHotkeyBadge(i)
                return (
                <li key={ident.id}>
                  <button
                    type="button"
                    className={`annotate__identity${
                      selectedBox?.reidId === ident.id ? ' annotate__identity--assigned' : ''
                    }${activeReidId === ident.id ? ' annotate__identity--on' : ''}`}
                    onClick={() => applyReidToSelection(ident.id)}
                  >
                    <span className="annotate__swatch" style={{ background: ident.color }} />
                    <span>{ident.displayName}</span>
                    {hotkey ? (
                      <kbd className="annotate__kbd">{hotkey}</kbd>
                    ) : (
                      <span className="annotate__kbd annotate__kbd--muted" title="Use [ ] to cycle">
                        {i + 1}
                      </span>
                    )}
                  </button>
                  <label className="annotate__caption-field">
                    <span>Identity caption</span>
                    <textarea
                      rows={2}
                      value={ident.caption}
                      onChange={(e) => {
                        setProject(
                          touchUpdated({
                            ...project,
                            identities: {
                              ...project.identities,
                              [ident.id]: { ...ident, caption: e.target.value },
                            },
                          }),
                        )
                      }}
                    />
                  </label>
                  <input
                    type="color"
                    value={ident.color}
                    title="Identity color"
                    onChange={(e) => {
                      setProject(
                        touchUpdated({
                          ...project,
                          identities: {
                            ...project.identities,
                            [ident.id]: { ...ident, color: e.target.value },
                          },
                        }),
                      )
                    }}
                  />
                </li>
                )
              })}
            </ul>

            <h3 className="annotate__dock-title">Selected box</h3>
            {selectedBox ? (
              <div className="annotate__box-inspector">
                <label>
                  Re-ID
                  <select
                    value={selectedBox.reidId}
                    onChange={(e) => {
                      const reidId = e.target.value
                      updateFrameBoxes(
                        currentFrame.boxes.map((b) =>
                          b.id === selectedBox.id ? { ...b, reidId } : b,
                        ),
                      )
                    }}
                  >
                    {identityList.map((ident) => (
                      <option key={ident.id} value={ident.id}>
                        {ident.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                {project.identities[selectedBox.reidId]?.caption ? (
                  <p className="panel-hint">
                    Caption: {project.identities[selectedBox.reidId].caption}
                  </p>
                ) : (
                  <p className="panel-hint">Set caption under this person in Re-ID identities.</p>
                )}
                <button type="button" className="btn btn--ghost btn--sm" onClick={deleteSelectedBox}>
                  Delete box
                </button>
              </div>
            ) : (
              <p className="panel-hint">Click a box or draw a new one.</p>
            )}

            <p className="annotate__stats">
              {project.frames.length} frames · {countBoxes(project.frames)} boxes ·{' '}
              {identityList.length} identities
            </p>
          </aside>
        </div>
      )}

      <section className="dock-panel annotate__panel">
        <h2 className="dock-panel__title">
          <span className="dock-panel__dot dock-panel__dot--cyan" />
          Saved video annotations
        </h2>
        <p className="panel-hint">
          {localDisk
            ? 'Projects sync to browser storage and local disk (git clone). Download ZIP removes browser copy on production.'
            : 'Projects live in your browser until you download the ZIP (then removed on the deployed site).'}
        </p>
        {savedList.length === 0 ? (
          <p className="panel-hint">No saved projects yet.</p>
        ) : (
          <ul className="annotate__saved-list">
            {savedList.map((item) => (
              <li key={item.id} className="annotate__saved-item">
                <div>
                  <strong>{item.videoName}</strong>
                  <span className="annotate__saved-meta">
                    {item.frameCount} frames · {item.boxCount} boxes · {item.identityCount} IDs
                  </span>
                </div>
                <div className="annotate__saved-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => void loadSaved(item.id)}>
                    Open
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => void downloadSaved(item.id)}
                  >
                    Download &amp; clean
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => void deleteSaved(item.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
