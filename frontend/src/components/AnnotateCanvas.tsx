import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnnotationBox, ReIdIdentity } from '../types/annotate'
import { clampBbox, createIdentity, newBoxId } from '../lib/reidHelpers'

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br'

interface Props {
  imageUrl: string
  width: number
  height: number
  boxes: AnnotationBox[]
  identities: Record<string, ReIdIdentity>
  selectedBoxId: string | null
  activeReidId: string | null
  defaultClassName: string
  onBoxesChange: (boxes: AnnotationBox[]) => void
  onSelectBox: (id: string | null) => void
  /** Called when a new Re-ID identity is created while drawing a box. */
  onIdentityCreated?: (identity: ReIdIdentity) => void
}

const HANDLE = 8

function clientToImage(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const sx = canvas.width / rect.width
  const sy = canvas.height / rect.height
  return {
    x: (clientX - rect.left) * sx,
    y: (clientY - rect.top) * sy,
  }
}

function hitBox(x: number, y: number, box: AnnotationBox): boolean {
  const [x1, y1, x2, y2] = box.bbox
  return x >= x1 && x <= x2 && y >= y1 && y <= y2
}

function hitHandle(
  x: number,
  y: number,
  box: AnnotationBox,
): ResizeHandle | null {
  const [x1, y1, x2, y2] = box.bbox
  const pts: Array<{ h: ResizeHandle; px: number; py: number }> = [
    { h: 'tl', px: x1, py: y1 },
    { h: 'tr', px: x2, py: y1 },
    { h: 'bl', px: x1, py: y2 },
    { h: 'br', px: x2, py: y2 },
  ]
  for (const p of pts) {
    if (Math.abs(x - p.px) <= HANDLE && Math.abs(y - p.py) <= HANDLE) return p.h
  }
  return null
}

export function AnnotateCanvas({
  imageUrl,
  width,
  height,
  boxes,
  identities,
  selectedBoxId,
  activeReidId,
  defaultClassName,
  onBoxesChange,
  onSelectBox,
  onIdentityCreated,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [ghost, setGhost] = useState<[number, number, number, number] | null>(null)

  const dragRef = useRef<
    | {
        mode: 'draw' | 'move' | 'resize'
        boxId: string | null
        handle: ResizeHandle | null
        startX: number
        startY: number
        orig: [number, number, number, number]
      }
    | null
  >(null)

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.complete) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, width, height)

    for (const box of boxes) {
      const ident = identities[box.reidId]
      const color = ident?.color ?? '#ff3838'
      const [x1, y1, x2, y2] = box.bbox
      const isSel = box.id === selectedBoxId
      ctx.strokeStyle = color
      ctx.lineWidth = isSel ? 3 : 2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      const label = ident
        ? `${ident.displayName} (${box.className})`
        : box.className
      const cap = ident?.caption ? ` · ${ident.caption.slice(0, 40)}` : ''
      const text = `${label}${cap}`
      ctx.font = '12px system-ui, sans-serif'
      const tw = ctx.measureText(text).width
      const ty = Math.max(14, y1)
      ctx.fillStyle = color
      ctx.fillRect(x1, ty - 14, tw + 8, 16)
      ctx.fillStyle = '#fff'
      ctx.fillText(text, x1 + 4, ty - 2)

      if (isSel) {
        ctx.fillStyle = color
        for (const [hx, hy] of [
          [x1, y1],
          [x2, y1],
          [x1, y2],
          [x2, y2],
        ]) {
          ctx.fillRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE)
        }
      }
    }

    if (ghost) {
      const ident = activeReidId ? identities[activeReidId] : null
      ctx.strokeStyle = ident?.color ?? '#38d9ff'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      const [gx1, gy1, gx2, gy2] = ghost
      ctx.strokeRect(gx1, gy1, gx2 - gx1, gy2 - gy1)
      ctx.setLineDash([])
    }
  }, [boxes, identities, selectedBoxId, activeReidId, ghost, width, height])

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      drawScene()
    }
    img.src = imageUrl
    return () => {
      imgRef.current = null
    }
  }, [imageUrl, drawScene])

  useEffect(() => {
    drawScene()
  }, [drawScene])

  const updateBox = useCallback(
    (id: string, bbox: [number, number, number, number]) => {
      onBoxesChange(
        boxes.map((b) => (b.id === id ? { ...b, bbox: clampBbox(bbox, width, height) } : b)),
      )
    },
    [boxes, onBoxesChange, width, height],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return
      const canvas = canvasRef.current
      if (!canvas) return
      const { x, y } = clientToImage(e.clientX, e.clientY, canvas)
      canvas.setPointerCapture(e.pointerId)

      const selected = boxes.find((b) => b.id === selectedBoxId)
      if (selected) {
        const handle = hitHandle(x, y, selected)
        if (handle) {
          dragRef.current = {
            mode: 'resize',
            boxId: selected.id,
            handle,
            startX: x,
            startY: y,
            orig: [...selected.bbox],
          }
          return
        }
        if (hitBox(x, y, selected)) {
          dragRef.current = {
            mode: 'move',
            boxId: selected.id,
            handle: null,
            startX: x,
            startY: y,
            orig: [...selected.bbox],
          }
          return
        }
      }

      for (const b of [...boxes].reverse()) {
        if (hitBox(x, y, b)) {
          onSelectBox(b.id)
          dragRef.current = {
            mode: 'move',
            boxId: b.id,
            handle: null,
            startX: x,
            startY: y,
            orig: [...b.bbox],
          }
          return
        }
      }

      onSelectBox(null)
      dragRef.current = {
        mode: 'draw',
        boxId: null,
        handle: null,
        startX: x,
        startY: y,
        orig: [x, y, x, y],
      }
      setGhost([x, y, x, y])
    },
    [boxes, selectedBoxId, onSelectBox],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const drag = dragRef.current
      if (!canvas || !drag) return
      const { x, y } = clientToImage(e.clientX, e.clientY, canvas)

      if (drag.mode === 'draw') {
        const x1 = Math.min(drag.startX, x)
        const y1 = Math.min(drag.startY, y)
        const x2 = Math.max(drag.startX, x)
        const y2 = Math.max(drag.startY, y)
        setGhost([x1, y1, x2, y2])
        drawScene()
        return
      }

      if (drag.mode === 'move' && drag.boxId) {
        const dx = x - drag.startX
        const dy = y - drag.startY
        const [ox1, oy1, ox2, oy2] = drag.orig
        updateBox(drag.boxId, [ox1 + dx, oy1 + dy, ox2 + dx, oy2 + dy])
        return
      }

      if (drag.mode === 'resize' && drag.boxId && drag.handle) {
        let [x1, y1, x2, y2] = drag.orig
        if (drag.handle === 'tl') {
          x1 = x
          y1 = y
        } else if (drag.handle === 'tr') {
          x2 = x
          y1 = y
        } else if (drag.handle === 'bl') {
          x1 = x
          y2 = y
        } else {
          x2 = x
          y2 = y
        }
        updateBox(drag.boxId, [x1, y1, x2, y2])
      }
    },
    [updateBox, drawScene],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const drag = dragRef.current
      if (!canvas || !drag) return

      if (drag.mode === 'draw') {
        const { x, y } = clientToImage(e.clientX, e.clientY, canvas)
        const x1 = Math.min(drag.startX, x)
        const y1 = Math.min(drag.startY, y)
        const x2 = Math.max(drag.startX, x)
        const y2 = Math.max(drag.startY, y)
        if (x2 - x1 > 4 && y2 - y1 > 4) {
          let reidId = activeReidId
          if (!reidId || !identities[reidId]) {
            const ident = createIdentity(defaultClassName, identities)
            onIdentityCreated?.(ident)
            reidId = ident.id
          }
          const newBox: AnnotationBox = {
            id: newBoxId(),
            className: defaultClassName.toLowerCase(),
            reidId: reidId!,
            bbox: clampBbox([x1, y1, x2, y2], width, height),
            confidence: null,
            source: 'manual',
            caption: '',
          }
          onBoxesChange([...boxes, newBox])
          onSelectBox(newBox.id)
        }
        setGhost(null)
      }

      dragRef.current = null
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* */
      }
      drawScene()
    },
    [
      boxes,
      identities,
      activeReidId,
      defaultClassName,
      width,
      height,
      onBoxesChange,
      onSelectBox,
      onIdentityCreated,
      drawScene,
    ],
  )

  return (
    <div className="annotate-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="annotate-canvas"
        width={width}
        height={height}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Annotation canvas — drag to draw boxes"
      />
    </div>
  )
}
