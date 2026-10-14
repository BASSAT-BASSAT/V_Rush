export interface ExtractFramesOptions {
  sampleFps: number
  maxFrames: number
  /** JPEG quality 0–1 when encoding frames. */
  jpegQuality?: number
  onProgress?: (done: number, total: number) => void
}

export interface ExtractedFrame {
  frameIndex: number
  timestampSec: number
  blob: Blob
  width: number
  height: number
  objectUrl: string
}

function waitForEvent(target: HTMLVideoElement, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('Failed to load video'))
    }
    const cleanup = () => {
      target.removeEventListener(name, onOk)
      target.removeEventListener('error', onErr)
    }
    target.addEventListener(name, onOk, { once: true })
    target.addEventListener('error', onErr, { once: true })
  })
}

/**
 * Sample frames from a video file in the browser (no server upload of full video).
 */
export async function extractVideoFrames(
  file: File,
  options: ExtractFramesOptions,
): Promise<{ frames: ExtractedFrame[]; durationSec: number; width: number; height: number }> {
  const sampleFps = Math.max(0.1, Math.min(30, options.sampleFps))
  const maxFrames = Math.max(1, Math.min(500, options.maxFrames))
  const jpegQuality = options.jpegQuality ?? 0.85

  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = objectUrl

  try {
    await waitForEvent(video, 'loadedmetadata')
    const durationSec = Number.isFinite(video.duration) ? video.duration : 0
    const width = video.videoWidth
    const height = video.videoHeight
    if (width < 1 || height < 1) {
      throw new Error('Video has no readable dimensions')
    }

    const interval = 1 / sampleFps
    const timestamps: number[] = []
    if (durationSec <= 0) {
      timestamps.push(0)
    } else {
      for (let t = 0; t < durationSec && timestamps.length < maxFrames; t += interval) {
        timestamps.push(t)
      }
      if (timestamps.length === 0) timestamps.push(0)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D unavailable')

    const frames: ExtractedFrame[] = []
    const total = timestamps.length

    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i]
      video.currentTime = Math.min(t, Math.max(0, durationSec - 0.001))
      await waitForEvent(video, 'seeked')
      ctx.drawImage(video, 0, 0, width, height)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Frame encode failed'))),
          'image/jpeg',
          jpegQuality,
        )
      })
      const frameUrl = URL.createObjectURL(blob)
      frames.push({
        frameIndex: i,
        timestampSec: t,
        blob,
        width,
        height,
        objectUrl: frameUrl,
      })
      options.onProgress?.(i + 1, total)
    }

    return { frames, durationSec, width, height }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}
