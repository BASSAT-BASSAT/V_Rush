/**
 * Manual segmentation: treat black pixels on `overlayCanvas` as a wall, flood-fill
 * from the image border, and zero the binary mask everywhere that is "outside"
 * the closed region (everything not reachable from the edge without crossing black).
 */

function dilateBinary(w: Uint8Array, mw: number, mh: number, iterations: number): Uint8Array {
  let cur = new Uint8Array(w)
  for (let it = 0; it < iterations; it++) {
    const next = new Uint8Array(cur)
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const i = y * mw + x
        if (cur[i]) continue
        let hit = false
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || nx >= mw || ny < 0 || ny >= mh) continue
            if (cur[ny * mw + nx]) {
              next[i] = 1
              hit = true
            }
          }
        }
      }
    }
    cur = next
  }
  return cur
}

/** 4-neighbour flood from border cells, not crossing `wall`. */
function floodOutsideFromBorder(wall: Uint8Array, mw: number, mh: number): Uint8Array {
  const outside = new Uint8Array(mw * mh)
  const q: number[] = []
  const tryPush = (i: number) => {
    if (wall[i] || outside[i]) return
    outside[i] = 1
    q.push(i)
  }
  for (let x = 0; x < mw; x++) {
    tryPush(x)
    tryPush((mh - 1) * mw + x)
  }
  for (let y = 0; y < mh; y++) {
    tryPush(y * mw)
    tryPush(y * mw + (mw - 1))
  }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]!
    const x = i % mw
    const y = Math.floor(i / mw)
    if (x > 0) tryPush(i - 1)
    if (x < mw - 1) tryPush(i + 1)
    if (y > 0) tryPush(i - mw)
    if (y < mh - 1) tryPush(i + mw)
  }
  return outside
}

export type CutOutsideResult = { ok: true } | { ok: false; reason: string }

/**
 * Downsample overlay strokes to mask resolution, dilate slightly to close gaps,
 * flood "outside" from edges, then set mask alpha to 0 wherever outside.
 */
export function cutMaskOutsideBlackLine(
  maskCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
): CutOutsideResult {
  const mw = maskCanvas.width
  const mh = maskCanvas.height
  const ow = overlayCanvas.width
  const oh = overlayCanvas.height
  if (mw < 2 || mh < 2) return { ok: false, reason: 'Mask is not ready.' }
  if (ow < 2 || oh < 2) return { ok: false, reason: 'Preview is not ready — run the pipeline first.' }

  const tmp = document.createElement('canvas')
  tmp.width = mw
  tmp.height = mh
  const t = tmp.getContext('2d')
  if (!t) return { ok: false, reason: 'Could not create scratch canvas.' }

  t.fillStyle = '#ffffff'
  t.fillRect(0, 0, mw, mh)
  t.drawImage(overlayCanvas, 0, 0, ow, oh, 0, 0, mw, mh)
  const d = t.getImageData(0, 0, mw, mh).data

  const wall = new Uint8Array(mw * mh)
  let anyStroke = false
  for (let i = 0; i < mw * mh; i++) {
    const o = i * 4
    const r = d[o]
    const g = d[o + 1]
    const b = d[o + 2]
    const a = d[o + 3]
    if (a > 40 && r + g + b < 220) {
      wall[i] = 1
      anyStroke = true
    }
  }
  if (!anyStroke) {
    return { ok: false, reason: 'Draw a black outline around what you want to keep, then apply again.' }
  }

  const wallThick = dilateBinary(wall, mw, mh, 2)
  const outside = floodOutsideFromBorder(wallThick, mw, mh)

  const mctx = maskCanvas.getContext('2d')
  if (!mctx) return { ok: false, reason: 'Could not read mask.' }
  const md = mctx.getImageData(0, 0, mw, mh)
  for (let i = 0; i < mw * mh; i++) {
    if (!outside[i]) continue
    const o = i * 4
    md.data[o] = 0
    md.data[o + 1] = 0
    md.data[o + 2] = 0
    md.data[o + 3] = 255
  }
  mctx.putImageData(md, 0, 0)
  return { ok: true }
}

/**
 * Same stroke interpretation as {@link cutMaskOutsideBlackLine}, but zeros the mask
 * inside the closed black line (enclosed region), not outside.
 */
export function cutMaskInsideBlackLine(
  maskCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
): CutOutsideResult {
  const mw = maskCanvas.width
  const mh = maskCanvas.height
  const ow = overlayCanvas.width
  const oh = overlayCanvas.height
  if (mw < 2 || mh < 2) return { ok: false, reason: 'Mask is not ready.' }
  if (ow < 2 || oh < 2) return { ok: false, reason: 'Preview is not ready — run the pipeline first.' }

  const tmp = document.createElement('canvas')
  tmp.width = mw
  tmp.height = mh
  const t = tmp.getContext('2d')
  if (!t) return { ok: false, reason: 'Could not create scratch canvas.' }

  t.fillStyle = '#ffffff'
  t.fillRect(0, 0, mw, mh)
  t.drawImage(overlayCanvas, 0, 0, ow, oh, 0, 0, mw, mh)
  const d = t.getImageData(0, 0, mw, mh).data

  const wall = new Uint8Array(mw * mh)
  let anyStroke = false
  for (let i = 0; i < mw * mh; i++) {
    const o = i * 4
    const r = d[o]
    const g = d[o + 1]
    const b = d[o + 2]
    const a = d[o + 3]
    if (a > 40 && r + g + b < 220) {
      wall[i] = 1
      anyStroke = true
    }
  }
  if (!anyStroke) {
    return { ok: false, reason: 'Draw a black outline around what you want to remove, then apply again.' }
  }

  const wallThick = dilateBinary(wall, mw, mh, 2)
  const outside = floodOutsideFromBorder(wallThick, mw, mh)

  const mctx = maskCanvas.getContext('2d')
  if (!mctx) return { ok: false, reason: 'Could not read mask.' }
  const md = mctx.getImageData(0, 0, mw, mh)
  for (let i = 0; i < mw * mh; i++) {
    if (outside[i] || wallThick[i]) continue
    const o = i * 4
    md.data[o] = 0
    md.data[o + 1] = 0
    md.data[o + 2] = 0
    md.data[o + 3] = 255
  }
  mctx.putImageData(md, 0, 0)
  return { ok: true }
}
