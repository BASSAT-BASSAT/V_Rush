import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  clamp01,
  emitSamParamsJson,
  parseSamParamsJson,
  type SamOutputMode,
  type SamPromptType,
} from '../lib/samParams'
import { cutMaskInsideBlackLine, cutMaskOutsideBlackLine } from '../lib/cutOutsideStroke'
import {
  composeBrushCutout,
  createFullKeepMask,
  keepMaskHasDiscard,
  resetKeepMaskFull,
} from '../lib/brushCutout'
import {
  canvasToSourceAlignedFile,
  composeMobileSamPreview,
  drawDataUrlToCanvas,
  loadImageElement,
  pngBase64ToDataUrl,
} from '../lib/samMaskCompose'
import { ZoomableFrame } from './ZoomableFrame'

/** One undo step: SAM mask (image pixels) + black stroke overlay (CSS pixels). */
interface BrushUndoFrame {
  mask: ImageData
  overlay: ImageData
}

export interface SamStepHandle {
  stepIndex: number
  paramsJson: string
  onChangeParamsJson: (json: string) => void
}

interface Props {
  beforeUrl: string | null
  afterSrc: string | null
  lastKind: string | null
  samStep?: SamStepHandle | null
  /** Raw mask PNG from last process (MobileSAM); enables brush refine. */
  samMaskPngBase64?: string | null
  /** BGR pipeline image into MobileSAM — same WxH as mask. */
  samSubjectPngBase64?: string | null
  samOutputMode?: SamOutputMode | null
  resultWidth?: number | null
  resultHeight?: number | null
  /** Current studio source file — used so “Use as source” keeps the same filename extension / encoding. */
  sourceFile?: File | null
  onApplyRefinedImage?: (file: File) => void
  /** When manual mask refinement is active, the composed preview (PNG data URL); null otherwise — for download. */
  onRefinedAfterDataUrlChange?: (dataUrl: string | null) => void
}

export function BeforeAfter({
  beforeUrl,
  afterSrc,
  lastKind,
  samStep,
  samMaskPngBase64 = null,
  samSubjectPngBase64 = null,
  samOutputMode = null,
  resultWidth = null,
  resultHeight = null,
  sourceFile = null,
  onApplyRefinedImage,
  onRefinedAfterDataUrlChange,
}: Props) {
  const [mode, setMode] = useState<'split' | 'slider'>('split')
  const [slider, setSlider] = useState(50)

  /** Standalone outline cutout (no SAM). Draw loop → Cut outside / inside. */
  const [manualBrushOn, setManualBrushOn] = useState(false)
  const [manualBrushRadius, setManualBrushRadius] = useState(14)
  const [manualCutoutUrl, setManualCutoutUrl] = useState<string | null>(null)
  const [manualCutHint, setManualCutHint] = useState<string | null>(null)
  const [manualCursor, setManualCursor] = useState<{ x: number; y: number } | null>(null)
  const manualSourceRef = useRef<HTMLCanvasElement | null>(null)
  const manualMaskRef = useRef<HTMLCanvasElement | null>(null)
  const manualStrokeOverlayRef = useRef<HTMLCanvasElement | null>(null)
  const manualBeforeWrapRef = useRef<HTMLDivElement | null>(null)
  const manualUndoStack = useRef<BrushUndoFrame[]>([])
  const manualPainting = useRef(false)
  const manualLastCss = useRef<{ x: number; y: number } | null>(null)
  const manualPaintedInStroke = useRef(false)
  const manualCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null)

  const samActive = Boolean(samStep && beforeUrl && !manualBrushOn)
  const sam = useMemo(
    () => (samStep ? parseSamParamsJson(samStep.paramsJson) : null),
    [samStep],
  )

  const frameRef = useRef<HTMLDivElement | null>(null)
  const [dragBox, setDragBox] = useState<{ x: number; y: number } | null>(null)
  const [ghost, setGhost] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null,
  )
  const pointerCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null)

  const releaseSamPointerCapture = useCallback(() => {
    const c = pointerCaptureRef.current
    pointerCaptureRef.current = null
    if (!c) return
    try {
      if (c.el.hasPointerCapture(c.pointerId)) c.el.releasePointerCapture(c.pointerId)
    } catch {
      /* already released */
    }
  }, [])

  const pushSam = useCallback(
    (next: ReturnType<typeof parseSamParamsJson>) => {
      if (!samStep) return
      samStep.onChangeParamsJson(emitSamParamsJson(next))
    },
    [samStep],
  )

  const fracFromEvent = useCallback(
    (e: React.PointerEvent<HTMLElement>, el: HTMLElement | null): { fx: number; fy: number } | null => {
      if (!el) return null
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      return {
        fx: clamp01((e.clientX - rect.left) / rect.width),
        fy: clamp01((e.clientY - rect.top) / rect.height),
      }
    },
    [],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!samActive || !sam) return
      const el = e.currentTarget
      const pt = fracFromEvent(e, el)
      if (!pt) return
      try {
        el.setPointerCapture(e.pointerId)
        pointerCaptureRef.current = { el, pointerId: e.pointerId }
      } catch {
        pointerCaptureRef.current = null
      }
      if (sam.prompt_type === 'point') {
        pushSam({
          ...sam,
          point_x_frac: pt.fx,
          point_y_frac: pt.fy,
          point_label: e.shiftKey ? 0 : 1,
        })
      } else {
        setDragBox({ x: pt.fx, y: pt.fy })
        setGhost({ x1: pt.fx, y1: pt.fy, x2: pt.fx, y2: pt.fy })
      }
    },
    [samActive, sam, fracFromEvent, pushSam],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!samActive || !sam || !dragBox || sam.prompt_type !== 'box') return
      const pt = fracFromEvent(e, e.currentTarget)
      if (!pt) return
      setGhost({
        x1: Math.min(dragBox.x, pt.fx),
        y1: Math.min(dragBox.y, pt.fy),
        x2: Math.max(dragBox.x, pt.fx),
        y2: Math.max(dragBox.y, pt.fy),
      })
    },
    [samActive, sam, dragBox, fracFromEvent],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!samActive || !sam || !dragBox || sam.prompt_type !== 'box') {
        releaseSamPointerCapture()
        return
      }
      const pt = fracFromEvent(e, e.currentTarget)
      const end = pt ?? { fx: dragBox.x, fy: dragBox.y }
      const x1 = Math.min(dragBox.x, end.fx)
      const y1 = Math.min(dragBox.y, end.fy)
      const x2 = Math.max(dragBox.x, end.fx)
      const y2 = Math.max(dragBox.y, end.fy)
      if (x2 - x1 > 0.005 && y2 - y1 > 0.005) {
        pushSam({
          ...sam,
          box_x1_frac: x1,
          box_y1_frac: y1,
          box_x2_frac: x2,
          box_y2_frac: y2,
        })
      }
      setDragBox(null)
      setGhost(null)
      releaseSamPointerCapture()
    },
    [samActive, sam, dragBox, fracFromEvent, pushSam, releaseSamPointerCapture],
  )

  const onPointerCancel = useCallback(() => {
    setDragBox(null)
    setGhost(null)
    releaseSamPointerCapture()
  }, [releaseSamPointerCapture])

  const onLostPointerCapture = useCallback(() => {
    setDragBox(null)
    setGhost(null)
    pointerCaptureRef.current = null
  }, [])

  const activeBox =
    ghost ??
    (sam?.prompt_type === 'box'
      ? {
          x1: sam.box_x1_frac,
          y1: sam.box_y1_frac,
          x2: sam.box_x2_frac,
          y2: sam.box_y2_frac,
        }
      : null)

  // --- Standalone Manual Brush (no SAM): outline → cut outside / inside ---
  const ensureManualCanvases = useCallback(async (): Promise<{
    source: HTMLCanvasElement
    mask: HTMLCanvasElement
  } | null> => {
    if (!beforeUrl) return null
    const img = await loadImageElement(beforeUrl)
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (w < 1 || h < 1) return null
    if (!manualSourceRef.current) manualSourceRef.current = document.createElement('canvas')
    const source = manualSourceRef.current
    if (source.width !== w || source.height !== h) {
      source.width = w
      source.height = h
      source.getContext('2d')?.drawImage(img, 0, 0)
    }
    if (
      !manualMaskRef.current ||
      manualMaskRef.current.width !== w ||
      manualMaskRef.current.height !== h
    ) {
      manualMaskRef.current = createFullKeepMask(w, h)
      manualUndoStack.current = []
    }
    return { source, mask: manualMaskRef.current }
  }, [beforeUrl])

  const ensureManualStrokeOverlayFit = useCallback(() => {
    const wrap = manualBeforeWrapRef.current
    const canvas = manualStrokeOverlayRef.current
    if (!wrap || !canvas) return
    const w = Math.max(1, Math.round(wrap.clientWidth))
    const h = Math.max(1, Math.round(wrap.clientHeight))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }, [])

  const recomposeManualCutout = useCallback(() => {
    const source = manualSourceRef.current
    const mask = manualMaskRef.current
    if (!source || !mask || mask.width < 1) return
    if (!keepMaskHasDiscard(mask)) {
      setManualCutoutUrl(null)
      return
    }
    setManualCutoutUrl(composeBrushCutout(source, mask))
  }, [])

  const pushManualUndo = useCallback(() => {
    const mask = manualMaskRef.current
    const mctx = mask?.getContext('2d')
    if (!mask || !mctx || mask.width < 1) return
    ensureManualStrokeOverlayFit()
    const oc = manualStrokeOverlayRef.current
    const octx = oc?.getContext('2d')
    const maskSnap = mctx.getImageData(0, 0, mask.width, mask.height)
    const overlaySnap =
      oc && octx && oc.width > 0 && oc.height > 0
        ? octx.getImageData(0, 0, oc.width, oc.height)
        : new ImageData(1, 1)
    manualUndoStack.current.push({ mask: maskSnap, overlay: overlaySnap })
    if (manualUndoStack.current.length > 12) manualUndoStack.current.shift()
  }, [ensureManualStrokeOverlayFit])

  const resetManualBrushState = useCallback(() => {
    manualSourceRef.current = null
    manualMaskRef.current = null
    manualUndoStack.current = []
    manualLastCss.current = null
    setManualCutoutUrl(null)
    setManualCutHint(null)
    setManualCursor(null)
    const oc = manualStrokeOverlayRef.current
    if (oc) oc.getContext('2d')?.clearRect(0, 0, oc.width, oc.height)
  }, [])

  useEffect(() => {
    resetManualBrushState()
    setManualBrushOn(false)
  }, [beforeUrl, resetManualBrushState])

  useEffect(() => {
    if (!manualBrushOn || !beforeUrl) return
    let cancelled = false
    void (async () => {
      const pair = await ensureManualCanvases()
      if (cancelled || !pair) return
      if (manualUndoStack.current.length === 0) {
        ensureManualStrokeOverlayFit()
        const mctx = pair.mask.getContext('2d')
        const oc = manualStrokeOverlayRef.current
        const octx = oc?.getContext('2d')
        if (mctx) {
          manualUndoStack.current.push({
            mask: mctx.getImageData(0, 0, pair.mask.width, pair.mask.height),
            overlay:
              oc && octx && oc.width > 0
                ? octx.getImageData(0, 0, oc.width, oc.height)
                : new ImageData(1, 1),
          })
        }
      }
      recomposeManualCutout()
    })()
    return () => {
      cancelled = true
    }
  }, [manualBrushOn, beforeUrl, ensureManualCanvases, ensureManualStrokeOverlayFit, recomposeManualCutout])

  useEffect(() => {
    if (!manualCutHint) return
    const t = window.setTimeout(() => setManualCutHint(null), 8000)
    return () => window.clearTimeout(t)
  }, [manualCutHint])

  useEffect(() => {
    if (!manualBrushOn) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === '[') {
        e.preventDefault()
        setManualBrushRadius((r) => Math.max(4, r - 4))
      } else if (e.key === ']') {
        e.preventDefault()
        setManualBrushRadius((r) => Math.min(48, r + 4))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [manualBrushOn])

  const releaseManualCapture = useCallback(() => {
    const c = manualCaptureRef.current
    manualCaptureRef.current = null
    if (!c) return
    try {
      if (c.el.hasPointerCapture(c.pointerId)) c.el.releasePointerCapture(c.pointerId)
    } catch {
      /* */
    }
  }, [])

  /** Black outline strokes on overlay; apply Cut outside/inside to update the mask. */
  const paintManualOutlineAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = manualStrokeOverlayRef.current
      if (!canvas) return
      ensureManualStrokeOverlayFit()
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const octx = canvas.getContext('2d')
      if (!octx) return
      const x = clientX - rect.left
      const y = clientY - rect.top
      const lineW = Math.max(2, manualBrushRadius)
      octx.save()
      octx.fillStyle = '#000000'
      octx.strokeStyle = '#000000'
      octx.lineWidth = lineW
      octx.lineCap = 'round'
      octx.lineJoin = 'round'
      if (manualLastCss.current == null) {
        octx.beginPath()
        octx.arc(x, y, lineW / 2, 0, Math.PI * 2)
        octx.fill()
      } else {
        octx.beginPath()
        octx.moveTo(manualLastCss.current.x, manualLastCss.current.y)
        octx.lineTo(x, y)
        octx.stroke()
      }
      octx.restore()
      manualLastCss.current = { x, y }
      manualPaintedInStroke.current = true
    },
    [manualBrushRadius, ensureManualStrokeOverlayFit],
  )

  const onManualPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!manualBrushOn || e.button !== 0) return
      e.preventDefault()
      const el = e.currentTarget
      try {
        el.setPointerCapture(e.pointerId)
        manualCaptureRef.current = { el, pointerId: e.pointerId }
      } catch {
        manualCaptureRef.current = null
      }
      manualLastCss.current = null
      ensureManualStrokeOverlayFit()
      manualPainting.current = true
      paintManualOutlineAt(e.clientX, e.clientY)
    },
    [manualBrushOn, paintManualOutlineAt, ensureManualStrokeOverlayFit],
  )

  const onManualPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!manualBrushOn) return
      const canvas = manualStrokeOverlayRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        setManualCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
      if (!manualPainting.current) return
      paintManualOutlineAt(e.clientX, e.clientY)
    },
    [manualBrushOn, paintManualOutlineAt],
  )

  const onManualPointerUp = useCallback(() => {
    if (manualPainting.current && manualPaintedInStroke.current) {
      pushManualUndo()
    }
    manualPainting.current = false
    manualPaintedInStroke.current = false
    manualLastCss.current = null
    releaseManualCapture()
  }, [pushManualUndo, releaseManualCapture])

  const onManualPointerLeave = useCallback(() => {
    setManualCursor(null)
  }, [])

  const applyManualCutOutside = useCallback(() => {
    setManualCutHint(null)
    const mask = manualMaskRef.current
    const oc = manualStrokeOverlayRef.current
    if (!mask || !oc) return
    const res = cutMaskOutsideBlackLine(mask, oc)
    if (!res.ok) {
      setManualCutHint(res.reason)
      return
    }
    ensureManualStrokeOverlayFit()
    oc.getContext('2d')?.clearRect(0, 0, oc.width, oc.height)
    pushManualUndo()
    recomposeManualCutout()
  }, [ensureManualStrokeOverlayFit, pushManualUndo, recomposeManualCutout])

  const applyManualCutInside = useCallback(() => {
    setManualCutHint(null)
    const mask = manualMaskRef.current
    const oc = manualStrokeOverlayRef.current
    if (!mask || !oc) return
    const res = cutMaskInsideBlackLine(mask, oc)
    if (!res.ok) {
      setManualCutHint(res.reason)
      return
    }
    ensureManualStrokeOverlayFit()
    oc.getContext('2d')?.clearRect(0, 0, oc.width, oc.height)
    pushManualUndo()
    recomposeManualCutout()
  }, [ensureManualStrokeOverlayFit, pushManualUndo, recomposeManualCutout])

  const undoManualBrush = useCallback(() => {
    const mask = manualMaskRef.current
    const mctx = mask?.getContext('2d')
    if (!mask || !mctx || manualUndoStack.current.length < 2) return
    manualUndoStack.current.pop()
    const prev = manualUndoStack.current[manualUndoStack.current.length - 1]
    if (prev) mctx.putImageData(prev.mask, 0, 0)
    ensureManualStrokeOverlayFit()
    const oc = manualStrokeOverlayRef.current
    const octx = oc?.getContext('2d')
    if (octx && prev && oc) {
      if (prev.overlay.width <= 1 && prev.overlay.height <= 1) {
        octx.clearRect(0, 0, oc.width, oc.height)
      } else if (prev.overlay.width === oc.width && prev.overlay.height === oc.height) {
        octx.putImageData(prev.overlay, 0, 0)
      } else {
        octx.clearRect(0, 0, oc.width, oc.height)
      }
    }
    recomposeManualCutout()
  }, [ensureManualStrokeOverlayFit, recomposeManualCutout])

  const clearManualBrush = useCallback(() => {
    const mask = manualMaskRef.current
    if (!mask) return
    resetKeepMaskFull(mask)
    ensureManualStrokeOverlayFit()
    const oc = manualStrokeOverlayRef.current
    oc?.getContext('2d')?.clearRect(0, 0, oc.width, oc.height)
    pushManualUndo()
    recomposeManualCutout()
  }, [ensureManualStrokeOverlayFit, pushManualUndo, recomposeManualCutout])

  const applyManualAsSource = useCallback(async () => {
    if (!onApplyRefinedImage || !manualCutoutUrl) return
    try {
      const out = document.createElement('canvas')
      await drawDataUrlToCanvas(manualCutoutUrl, out)
      const f = await canvasToSourceAlignedFile(out, sourceFile ?? null)
      onApplyRefinedImage(f)
      setManualBrushOn(false)
    } catch {
      /* parent may toast */
    }
  }, [onApplyRefinedImage, manualCutoutUrl, sourceFile])

  // --- Mask refine (MobileSAM) — offscreen canvases via refs (not useMemo) for eslint immutability ---
  const maskCanvasElRef = useRef<HTMLCanvasElement | null>(null)
  const subjectCanvasElRef = useRef<HTMLCanvasElement | null>(null)
  const ensureOffscreenCanvases = useCallback((): {
    mask: HTMLCanvasElement
    subject: HTMLCanvasElement
  } | null => {
    if (typeof document === 'undefined') return null
    if (!maskCanvasElRef.current) maskCanvasElRef.current = document.createElement('canvas')
    if (!subjectCanvasElRef.current) subjectCanvasElRef.current = document.createElement('canvas')
    return { mask: maskCanvasElRef.current, subject: subjectCanvasElRef.current }
  }, [])

  const refineAvailable = Boolean(
    samMaskPngBase64 && resultWidth && resultHeight && samOutputMode && afterSrc,
  )

  const [refinedAfterUrl, setRefinedAfterUrl] = useState<string | null>(null)
  const [brushRadius, setBrushRadius] = useState(14)
  const [refineHint, setRefineHint] = useState<string | null>(null)
  const [cutHint, setCutHint] = useState<string | null>(null)
  const undoStack = useRef<BrushUndoFrame[]>([])
  const afterImgWrapRef = useRef<HTMLDivElement | null>(null)
  const brushOverlayRef = useRef<HTMLCanvasElement | null>(null)
  const lastBrushCss = useRef<{ x: number; y: number } | null>(null)
  const brushCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null)
  const brushPainting = useRef(false)

  const releaseBrushCapture = useCallback(() => {
    const c = brushCaptureRef.current
    brushCaptureRef.current = null
    if (!c) return
    try {
      if (c.el.hasPointerCapture(c.pointerId)) c.el.releasePointerCapture(c.pointerId)
    } catch {
      /* */
    }
  }, [])

  const brushPaintedInStroke = useRef(false)

  const ensureBrushOverlayFit = useCallback(() => {
    const wrap = afterImgWrapRef.current
    const canvas = brushOverlayRef.current
    if (!wrap || !canvas) return
    const w = Math.max(1, Math.round(wrap.clientWidth))
    const h = Math.max(1, Math.round(wrap.clientHeight))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }, [])

  const recomposeFromMasks = useCallback(() => {
    const c = ensureOffscreenCanvases()
    if (!c || !samOutputMode) return
    const { mask, subject } = c
    if (mask.width === 0 || mask.height === 0) return
    try {
      if (samOutputMode === 'mask') {
        setRefinedAfterUrl(composeMobileSamPreview(mask, mask, 'mask'))
        return
      }
      if (subject.width === 0 || subject.height === 0) return
      setRefinedAfterUrl(composeMobileSamPreview(subject, mask, samOutputMode))
    } catch {
      setRefinedAfterUrl(null)
    }
  }, [ensureOffscreenCanvases, samOutputMode])

  useEffect(() => {
    if (manualBrushOn && manualCutoutUrl) {
      onRefinedAfterDataUrlChange?.(manualCutoutUrl)
      return
    }
    onRefinedAfterDataUrlChange?.(refineAvailable ? refinedAfterUrl : null)
  }, [
    manualBrushOn,
    manualCutoutUrl,
    refineAvailable,
    refinedAfterUrl,
    onRefinedAfterDataUrlChange,
  ])

  const initialUndoSeededRef = useRef(false)

  useEffect(() => {
    if (!refineAvailable || !samMaskPngBase64 || !resultWidth || !resultHeight || !samOutputMode) {
      undoStack.current = []
      const t = window.setTimeout(() => {
        setRefinedAfterUrl(null)
        setRefineHint(null)
      }, 0)
      return () => window.clearTimeout(t)
    }

    let cancelled = false
    ;(async () => {
      const pair = ensureOffscreenCanvases()
      if (!pair) return
      const { mask: maskCanvas, subject: subjectCanvas } = pair
      try {
        initialUndoSeededRef.current = false
        await drawDataUrlToCanvas(pngBase64ToDataUrl(samMaskPngBase64), maskCanvas)
        if (cancelled) return
        let subjectReady = false
        if (samSubjectPngBase64) {
          await drawDataUrlToCanvas(pngBase64ToDataUrl(samSubjectPngBase64), subjectCanvas)
          subjectReady =
            subjectCanvas.width === resultWidth && subjectCanvas.height === resultHeight
        } else if (beforeUrl) {
          try {
            const img = await loadImageElement(beforeUrl)
            if (img.naturalWidth === resultWidth && img.naturalHeight === resultHeight) {
              subjectCanvas.width = img.naturalWidth
              subjectCanvas.height = img.naturalHeight
              subjectCanvas.getContext('2d')?.drawImage(img, 0, 0)
              subjectReady = true
            }
          } catch {
            subjectReady = false
          }
        }
        if (cancelled) return
        if (!subjectReady && samOutputMode !== 'mask') {
          setRefineHint(
            'Overlay/cutout brush preview needs the SAM subject frame from the server (reload after deploy).',
          )
        } else {
          setRefineHint(null)
        }
        undoStack.current = []
        recomposeFromMasks()
      } catch {
        if (!cancelled) {
          setRefinedAfterUrl(null)
          setRefineHint('Could not load mask for refinement.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    refineAvailable,
    samMaskPngBase64,
    samSubjectPngBase64,
    samOutputMode,
    resultWidth,
    resultHeight,
    afterSrc,
    beforeUrl,
    recomposeFromMasks,
    ensureOffscreenCanvases,
  ])

  /** Seed undo stack once the mask exists and the After pane has laid out (overlay canvas size). */
  useLayoutEffect(() => {
    if (!refineAvailable) {
      initialUndoSeededRef.current = false
      return
    }
    if (initialUndoSeededRef.current || undoStack.current.length > 0) return
    const c = ensureOffscreenCanvases()
    if (!c || !c.mask.width || !c.mask.height) return
    ensureBrushOverlayFit()
    const mctx = c.mask.getContext('2d')
    const oc = brushOverlayRef.current
    const octx = oc?.getContext('2d')
    if (!mctx) return
    const overlaySnap =
      oc && octx && oc.width > 0 && oc.height > 0
        ? octx.getImageData(0, 0, oc.width, oc.height)
        : new ImageData(1, 1)
    undoStack.current.push({
      mask: mctx.getImageData(0, 0, c.mask.width, c.mask.height),
      overlay: overlaySnap,
    })
    initialUndoSeededRef.current = true
  }, [refineAvailable, refinedAfterUrl, afterSrc, ensureOffscreenCanvases, ensureBrushOverlayFit])

  const pushUndoBrushState = useCallback(() => {
    const c = ensureOffscreenCanvases()
    if (!c) return
    const { mask } = c
    const mctx = mask.getContext('2d')
    if (!mctx || mask.width === 0) return
    ensureBrushOverlayFit()
    const oc = brushOverlayRef.current
    const octx = oc?.getContext('2d')
    const maskSnap = mctx.getImageData(0, 0, mask.width, mask.height)
    const overlaySnap =
      oc && octx && oc.width > 0 && oc.height > 0
        ? octx.getImageData(0, 0, oc.width, oc.height)
        : new ImageData(1, 1)
    undoStack.current.push({ mask: maskSnap, overlay: overlaySnap })
    if (undoStack.current.length > 12) undoStack.current.shift()
  }, [ensureOffscreenCanvases, ensureBrushOverlayFit])

  /** Black strokes on overlay only; use "Cut outside line" to apply segmentation. */
  const paintEraseAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = brushOverlayRef.current
      if (!canvas) return
      ensureBrushOverlayFit()
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const octx = canvas.getContext('2d')
      if (octx) {
        const x = clientX - rect.left
        const y = clientY - rect.top
        const lineW = Math.max(2, brushRadius)
        octx.save()
        octx.fillStyle = '#000000'
        octx.strokeStyle = '#000000'
        octx.lineWidth = lineW
        octx.lineCap = 'round'
        octx.lineJoin = 'round'
        if (lastBrushCss.current == null) {
          octx.beginPath()
          octx.arc(x, y, lineW / 2, 0, Math.PI * 2)
          octx.fill()
        } else {
          octx.beginPath()
          octx.moveTo(lastBrushCss.current.x, lastBrushCss.current.y)
          octx.lineTo(x, y)
          octx.stroke()
        }
        octx.restore()
        lastBrushCss.current = { x, y }
      }
      brushPaintedInStroke.current = true
    },
    [brushRadius, ensureBrushOverlayFit],
  )

  const applyCutOutsideLine = useCallback(() => {
    setCutHint(null)
    const c = ensureOffscreenCanvases()
    const oc = brushOverlayRef.current
    if (!c || !oc) return
    const res = cutMaskOutsideBlackLine(c.mask, oc)
    if (!res.ok) {
      setCutHint(res.reason)
      return
    }
    ensureBrushOverlayFit()
    oc.getContext('2d')?.clearRect(0, 0, oc.width, oc.height)
    pushUndoBrushState()
    recomposeFromMasks()
  }, [ensureOffscreenCanvases, ensureBrushOverlayFit, pushUndoBrushState, recomposeFromMasks])

  const applyCutInsideLine = useCallback(() => {
    setCutHint(null)
    const c = ensureOffscreenCanvases()
    const oc = brushOverlayRef.current
    if (!c || !oc) return
    const res = cutMaskInsideBlackLine(c.mask, oc)
    if (!res.ok) {
      setCutHint(res.reason)
      return
    }
    ensureBrushOverlayFit()
    oc.getContext('2d')?.clearRect(0, 0, oc.width, oc.height)
    pushUndoBrushState()
    recomposeFromMasks()
  }, [ensureOffscreenCanvases, ensureBrushOverlayFit, pushUndoBrushState, recomposeFromMasks])

  useEffect(() => {
    if (!cutHint) return
    const t = window.setTimeout(() => setCutHint(null), 8000)
    return () => window.clearTimeout(t)
  }, [cutHint])

  const onBrushPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!refineAvailable || e.button !== 0) return
      const el = e.currentTarget
      try {
        el.setPointerCapture(e.pointerId)
        brushCaptureRef.current = { el, pointerId: e.pointerId }
      } catch {
        brushCaptureRef.current = null
      }
      lastBrushCss.current = null
      ensureBrushOverlayFit()
      brushPainting.current = true
      paintEraseAt(e.clientX, e.clientY)
    },
    [refineAvailable, paintEraseAt, ensureBrushOverlayFit],
  )

  const onBrushPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!brushPainting.current || !refineAvailable) return
      paintEraseAt(e.clientX, e.clientY)
    },
    [refineAvailable, paintEraseAt],
  )

  const onBrushPointerUp = useCallback(() => {
    if (brushPainting.current && brushPaintedInStroke.current) {
      pushUndoBrushState()
    }
    brushPainting.current = false
    brushPaintedInStroke.current = false
    lastBrushCss.current = null
    releaseBrushCapture()
  }, [pushUndoBrushState, releaseBrushCapture])

  const onBrushLostCapture = useCallback(() => {
    brushPainting.current = false
    lastBrushCss.current = null
    brushCaptureRef.current = null
  }, [])

  const undoMask = useCallback(() => {
    const c = ensureOffscreenCanvases()
    if (!c || undoStack.current.length < 2) return
    const { mask } = c
    undoStack.current.pop()
    const prev = undoStack.current[undoStack.current.length - 1]
    const mctx = mask.getContext('2d')
    if (mctx && prev) {
      mctx.putImageData(prev.mask, 0, 0)
    }
    ensureBrushOverlayFit()
    const oc = brushOverlayRef.current
    const octx = oc?.getContext('2d')
    if (octx && prev && oc) {
      if (prev.overlay.width <= 1 && prev.overlay.height <= 1) {
        octx.clearRect(0, 0, oc.width, oc.height)
      } else if (prev.overlay.width === oc.width && prev.overlay.height === oc.height) {
        octx.putImageData(prev.overlay, 0, 0)
      } else {
        octx.clearRect(0, 0, oc.width, oc.height)
      }
    }
    recomposeFromMasks()
  }, [recomposeFromMasks, ensureOffscreenCanvases, ensureBrushOverlayFit])

  const resetMask = useCallback(() => {
    const c = ensureOffscreenCanvases()
    if (!c || !samMaskPngBase64) return
    const { mask } = c
    void (async () => {
      initialUndoSeededRef.current = false
      await drawDataUrlToCanvas(pngBase64ToDataUrl(samMaskPngBase64), mask)
      undoStack.current = []
      ensureBrushOverlayFit()
      const oc = brushOverlayRef.current
      const octx = oc?.getContext('2d')
      if (oc && octx) octx.clearRect(0, 0, oc.width, oc.height)
      const mctx = mask.getContext('2d')
      if (mctx && mask.width > 0) {
        ensureBrushOverlayFit()
        const octx2 = brushOverlayRef.current?.getContext('2d')
        const oc2 = brushOverlayRef.current
        undoStack.current.push({
          mask: mctx.getImageData(0, 0, mask.width, mask.height),
          overlay:
            oc2 && octx2 && oc2.width > 0
              ? octx2.getImageData(0, 0, oc2.width, oc2.height)
              : new ImageData(1, 1),
        })
      }
      recomposeFromMasks()
      initialUndoSeededRef.current = true
    })()
  }, [samMaskPngBase64, recomposeFromMasks, ensureOffscreenCanvases, ensureBrushOverlayFit])

  const applyRefinedAsSource = useCallback(async () => {
    const c = ensureOffscreenCanvases()
    if (!onApplyRefinedImage || !c || !samOutputMode) return
    const { mask, subject } = c
    try {
      const out = document.createElement('canvas')
      out.width = mask.width
      out.height = mask.height
      const ctx = out.getContext('2d')
      if (!ctx) return
      if (samOutputMode === 'mask') {
        const url = composeMobileSamPreview(mask, mask, 'mask')
        await drawDataUrlToCanvas(url, out)
      } else if (subject.width > 0) {
        const url = composeMobileSamPreview(subject, mask, samOutputMode)
        await drawDataUrlToCanvas(url, out)
      } else {
        const url = composeMobileSamPreview(mask, mask, 'mask')
        await drawDataUrlToCanvas(url, out)
      }
      const f = await canvasToSourceAlignedFile(out, sourceFile ?? null)
      onApplyRefinedImage(f)
    } catch {
      /* toast from parent if needed */
    }
  }, [onApplyRefinedImage, samOutputMode, sourceFile, ensureOffscreenCanvases])

  const displayAfterSrc = (manualBrushOn && manualCutoutUrl ? manualCutoutUrl : null) ?? refinedAfterUrl ?? afterSrc

  const refinePaintActive = refineAvailable && !manualBrushOn

  const renderSamOverlay = () => {
    if (!samActive || !sam) return null
    return (
      <>
        <div className="before-after__sam-badge" aria-hidden>
          SAM prompt
        </div>
        {sam.prompt_type === 'point' && (
          <span
            className={`before-after__sam-dot ${
              sam.point_label === 1
                ? 'before-after__sam-dot--fg'
                : 'before-after__sam-dot--bg'
            }`}
            style={{
              left: `${sam.point_x_frac * 100}%`,
              top: `${sam.point_y_frac * 100}%`,
            }}
            aria-hidden
          />
        )}
        {activeBox && (
          <span
            className="before-after__sam-box"
            style={{
              left: `${activeBox.x1 * 100}%`,
              top: `${activeBox.y1 * 100}%`,
              width: `${(activeBox.x2 - activeBox.x1) * 100}%`,
              height: `${(activeBox.y2 - activeBox.y1) * 100}%`,
            }}
            aria-hidden
          />
        )}
      </>
    )
  }

  if (!beforeUrl) {
    return <div className="before-after before-after--empty">Load an image to compare</div>
  }

  return (
    <div className="before-after">
      <div className="before-after__toolbar">
        <div className="seg">
          <button
            type="button"
            className={mode === 'split' ? 'seg__btn seg__btn--on' : 'seg__btn'}
            onClick={() => setMode('split')}
          >
            Side by side
          </button>
          <button
            type="button"
            className={mode === 'slider' ? 'seg__btn seg__btn--on' : 'seg__btn'}
            onClick={() => setMode('slider')}
          >
            Slider
          </button>
        </div>
        <div className="seg seg--compact" role="group" aria-label="Manual brush">
          <button
            type="button"
            className={manualBrushOn ? 'seg__btn seg__btn--on' : 'seg__btn'}
            aria-pressed={manualBrushOn}
            onClick={() => setManualBrushOn((v) => !v)}
            title="Draw a closed outline, then Cut outside or inside — no SAM required"
          >
            Manual Brush
          </button>
        </div>
        {lastKind && (
          <span className="before-after__badge" title="Output of last operation">
            last: {lastKind}
          </span>
        )}
      </div>

      {manualBrushOn && (
        <div className="before-after__manual-brush-bar" role="region" aria-label="Manual Brush cutout">
          <span className="before-after__manual-brush-title">Manual Brush — no SAM</span>
          <span className="before-after__manual-brush-sub">
            Draw a closed <strong>black outline</strong> on Before. <strong>Cut outside line</strong> zeros
            everything outside the loop; <strong>Cut inside line</strong> zeros everything inside. Close small
            gaps so regions do not leak to the edge. Use <kbd>[</kbd> <kbd>]</kbd> for brush size.
          </span>
          <label className="before-after__mask-refine-field">
            <span>Brush</span>
            <input
              type="range"
              min={4}
              max={48}
              value={manualBrushRadius}
              onChange={(e) => setManualBrushRadius(Number(e.target.value))}
            />
          </label>
          <button type="button" className="btn btn--primary btn--sm" onClick={applyManualCutOutside}>
            Cut outside line
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={applyManualCutInside}>
            Cut inside line
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={undoManualBrush}>
            Undo
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearManualBrush}>
            Reset
          </button>
          {onApplyRefinedImage && (
            <button
              type="button"
              className="btn btn--sm"
              disabled={!manualCutoutUrl}
              onClick={() => void applyManualAsSource()}
            >
              Use as source
            </button>
          )}
          {manualCutHint && <p className="before-after__mask-refine-hint">{manualCutHint}</p>}
        </div>
      )}

      {samActive && sam && samStep && (
        <div className="before-after__sam-bar" role="toolbar" aria-label="MobileSAM prompt">
          <span className="before-after__sam-bar-title">
            SAM <span className="before-after__sam-bar-step">step {samStep.stepIndex}</span>
          </span>
          <div className="seg" role="radiogroup" aria-label="Prompt type">
            {(['point', 'box'] as SamPromptType[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={sam.prompt_type === t}
                className={sam.prompt_type === t ? 'seg__btn seg__btn--on' : 'seg__btn'}
                onClick={() => pushSam({ ...sam, prompt_type: t })}
              >
                {t === 'point' ? 'Point' : 'Box'}
              </button>
            ))}
          </div>
          {sam.prompt_type === 'point' && (
            <div className="seg seg--compact" role="radiogroup" aria-label="Point polarity">
              <button
                type="button"
                role="radio"
                aria-checked={sam.point_label === 1}
                className={
                  sam.point_label === 1 ? 'seg__btn seg__btn--on' : 'seg__btn'
                }
                onClick={() => pushSam({ ...sam, point_label: 1 })}
                title="Click = foreground (include)"
              >
                Foreground
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={sam.point_label === 0}
                className={
                  sam.point_label === 0 ? 'seg__btn seg__btn--on' : 'seg__btn'
                }
                onClick={() => pushSam({ ...sam, point_label: 0 })}
                title="Shift+click = background (exclude)"
              >
                Background
              </button>
            </div>
          )}
          <div className="seg seg--compact" role="radiogroup" aria-label="Output mode">
            {(['overlay', 'cutout', 'mask'] as SamOutputMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={sam.output === m}
                className={sam.output === m ? 'seg__btn seg__btn--on' : 'seg__btn'}
                onClick={() => pushSam({ ...sam, output: m })}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="before-after__sam-legend">
            {sam.prompt_type === 'point' ? (
              <>
                <kbd>Click</kbd> foreground · <kbd>Shift</kbd>+<kbd>click</kbd> background
              </>
            ) : (
              <>
                <kbd>Drag</kbd> a box over the subject
              </>
            )}
          </span>
        </div>
      )}

      {refineAvailable && onApplyRefinedImage && !manualBrushOn && (
        <div className="before-after__mask-refine-bar" role="region" aria-label="Mask refinement">
          <span className="before-after__mask-refine-title">Manual segmentation (after SAM)</span>
          <span className="before-after__mask-refine-sub">
            Draw a closed <strong>black outline</strong>. <strong>Cut outside line</strong> removes everything
            outside the loop from the mask; <strong>Cut inside line</strong> removes everything inside (like
            punching a hole). Close small gaps so regions do not leak to the edge. Pan/zoom stays off while
            brushing.
          </span>
          <label className="before-after__mask-refine-field">
            <span>Brush</span>
            <input
              type="range"
              min={4}
              max={48}
              value={brushRadius}
              onChange={(e) => setBrushRadius(Number(e.target.value))}
            />
          </label>
          <button type="button" className="btn btn--primary btn--sm" onClick={applyCutOutsideLine}>
            Cut outside line
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={applyCutInsideLine}>
            Cut inside line
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={undoMask}>
            Undo
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetMask}>
            Reset mask
          </button>
          <button type="button" className="btn btn--sm" onClick={() => void applyRefinedAsSource()}>
            Use as source
          </button>
          {cutHint && <p className="before-after__mask-refine-hint">{cutHint}</p>}
          {refineHint && <p className="before-after__mask-refine-hint">{refineHint}</p>}
        </div>
      )}

      {mode === 'split' ? (
        <div className="before-after__viewport">
          <div className="before-after__split">
            <figure>
              <figcaption>
                Before{' '}
                {manualBrushOn ? (
                  <span className="before-after__manual-brush-hint">(draw outline on image)</span>
                ) : (
                  samActive && <span className="before-after__sam-hint">(click / drag to prompt SAM)</span>
                )}
              </figcaption>
              {manualBrushOn ? (
                <div
                  ref={manualBeforeWrapRef}
                  className="before-after__img-wrap before-after__img-wrap--manual-brush"
                >
                  <img src={beforeUrl} alt="Original" draggable={false} />
                  <canvas
                    ref={manualStrokeOverlayRef}
                    className="before-after__brush-overlay before-after__manual-stroke-overlay"
                    aria-label="Draw outline around subject"
                    onPointerDown={onManualPointerDown}
                    onPointerMove={onManualPointerMove}
                    onPointerUp={onManualPointerUp}
                    onPointerCancel={onManualPointerUp}
                    onPointerLeave={onManualPointerLeave}
                    onLostPointerCapture={onManualPointerUp}
                  />
                  {manualCursor && (
                    <span
                      className="before-after__manual-brush-cursor"
                      style={{
                        left: manualCursor.x,
                        top: manualCursor.y,
                        width: manualBrushRadius,
                        height: manualBrushRadius,
                      }}
                      aria-hidden
                    />
                  )}
                </div>
              ) : samActive ? (
                <div
                  ref={frameRef}
                  className={`before-after__img-wrap before-after__img-wrap--sam before-after__img-wrap--sam-${sam?.prompt_type ?? 'point'}`}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                  onLostPointerCapture={onLostPointerCapture}
                >
                  <img src={beforeUrl} alt="Original" draggable={false} />
                  {renderSamOverlay()}
                </div>
              ) : (
                <ZoomableFrame className="before-after__zoom">
                  <div className="before-after__img-wrap">
                    <img src={beforeUrl} alt="Original" draggable={false} />
                  </div>
                </ZoomableFrame>
              )}
            </figure>
            <figure>
              <figcaption>After</figcaption>
              {displayAfterSrc ? (
                <ZoomableFrame className="before-after__zoom" disabled={refinePaintActive}>
                  <div
                    ref={afterImgWrapRef}
                    className={`before-after__img-wrap before-after__img-wrap--reveal${refinePaintActive ? ' before-after__img-wrap--refine' : ''}`}
                  >
                    <img
                      src={displayAfterSrc}
                      alt="Processed"
                      draggable={false}
                      style={refinePaintActive ? { pointerEvents: 'none' } : undefined}
                    />
                    {refinePaintActive && (
                      <canvas
                        ref={brushOverlayRef}
                        className="before-after__brush-overlay"
                        aria-label="Mask brush"
                        onPointerDown={onBrushPointerDown}
                        onPointerMove={onBrushPointerMove}
                        onPointerUp={onBrushPointerUp}
                        onPointerCancel={onBrushPointerUp}
                        onLostPointerCapture={onBrushLostCapture}
                      />
                    )}
                  </div>
                </ZoomableFrame>
              ) : (
                <div className="before-after__placeholder">
                  {manualBrushOn
                    ? 'Draw outline on Before, then Cut outside or inside'
                    : 'Run pipeline'}
                </div>
              )}
            </figure>
          </div>
        </div>
      ) : (
        <div className="before-after__slider-wrap">
          <div className="before-after__viewport before-after__viewport--slider">
            <div
              ref={samActive ? frameRef : undefined}
              className={`before-after__compare${
                samActive ? ` before-after__compare--sam before-after__compare--sam-${sam?.prompt_type ?? 'point'}` : ''
              }`}
              onPointerDown={samActive ? onPointerDown : undefined}
              onPointerMove={samActive ? onPointerMove : undefined}
              onPointerUp={samActive ? onPointerUp : undefined}
              onPointerCancel={samActive ? onPointerCancel : undefined}
              onLostPointerCapture={samActive ? onLostPointerCapture : undefined}
            >
              <img
                src={beforeUrl}
                alt=""
                className="before-after__layer before-after__layer--base"
                draggable={false}
              />
              {displayAfterSrc && (
                <img
                  src={displayAfterSrc}
                  alt=""
                  className="before-after__layer before-after__layer--top"
                  style={{ clipPath: `inset(0 0 0 ${slider}%)` }}
                />
              )}
              {renderSamOverlay()}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
            className="before-after__range"
            disabled={!displayAfterSrc}
          />
        </div>
      )}
    </div>
  )
}
