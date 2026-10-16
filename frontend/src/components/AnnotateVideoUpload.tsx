import { useCallback, useRef, useState } from 'react'

type Props = {
  disabled: boolean
  extracting: boolean
  progress: string
  samplingReady: boolean
  sampleFps: number
  maxFrames: number
  onConfirmSampling: () => void
  onFile: (file: File) => void
  onNeedSamplingFirst: () => void
}

export function AnnotateVideoUpload({
  disabled,
  extracting,
  progress,
  samplingReady,
  sampleFps,
  maxFrames,
  onConfirmSampling,
  onFile,
  onNeedSamplingFirst,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const acceptFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled || extracting) return
      if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) {
        return
      }
      if (!samplingReady) {
        onNeedSamplingFirst()
        return
      }
      onFile(file)
    },
    [disabled, extracting, samplingReady, onFile, onNeedSamplingFirst],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      acceptFile(e.dataTransfer.files[0])
    },
    [acceptFile],
  )

  return (
    <div className="annotate-upload">
      <div className="annotate-upload__step annotate-upload__step--sampling">
        <div className="annotate-upload__step-head">
          <span className="annotate-upload__step-num">1</span>
          <div>
            <strong>Set sampling before you upload</strong>
            <p className="panel-hint annotate-upload__step-desc">
              Frame rate and cap are fixed when the video is processed. Defaults are{' '}
              <strong>{sampleFps} FPS</strong> and <strong>{maxFrames} frames</strong> until you
              change them.
            </p>
          </div>
        </div>
        {!samplingReady && (
          <button type="button" className="btn btn--sm" onClick={onConfirmSampling}>
            I&apos;ve set sampling — enable upload
          </button>
        )}
        {samplingReady && (
          <p className="annotate-upload__ready" role="status">
            Sampling locked in for next upload · {sampleFps} FPS · max {maxFrames} frames
          </p>
        )}
      </div>

      <div className="annotate-upload__step">
        <div className="annotate-upload__step-head">
          <span className="annotate-upload__step-num">2</span>
          <strong>Upload video</strong>
        </div>
        <div
          className={`annotate-upload__dropzone${
            dragOver ? ' annotate-upload__dropzone--over' : ''
          }${!samplingReady ? ' annotate-upload__dropzone--locked' : ''}${
            extracting ? ' annotate-upload__dropzone--busy' : ''
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (!samplingReady) onNeedSamplingFirst()
              else inputRef.current?.click()
            }
          }}
          onClick={() => {
            if (!samplingReady) {
              onNeedSamplingFirst()
              return
            }
            inputRef.current?.click()
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            if (e.currentTarget === e.target) setDragOver(false)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          aria-disabled={disabled || extracting || !samplingReady}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*,.mp4,.mov,.webm,.mkv,.avi"
            className="annotate-upload__input"
            disabled={disabled || extracting}
            onChange={(e) => {
              acceptFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="annotate-upload__icon" aria-hidden>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 16V4m0 0l-4 4m4-4l4 4M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {extracting ? (
            <>
              <p className="annotate-upload__title">Extracting frames…</p>
              <p className="annotate-upload__sub">{progress || 'Please wait'}</p>
              <div className="annotate-upload__progress" aria-hidden>
                <span className="annotate-upload__progress-bar" />
              </div>
            </>
          ) : !samplingReady ? (
            <>
              <p className="annotate-upload__title">Complete step 1 first</p>
              <p className="annotate-upload__sub">
                Adjust sample FPS and max frames, then confirm before choosing a video.
              </p>
            </>
          ) : (
            <>
              <p className="annotate-upload__title">Drop video here or click to browse</p>
              <p className="annotate-upload__sub">MP4, MOV, WebM · processed in your browser</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
