import { useCallback, useState } from 'react'

const ACCEPT = 'image/png,image/jpeg,image/webp'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export function FileDrop({ onFile, disabled }: Props) {
  const [drag, setDrag] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || disabled) return
      const f = files[0]
      if (!f.type.startsWith('image/')) return
      onFile(f)
    },
    [onFile, disabled],
  )

  return (
    <div
      className={`file-drop ${drag ? 'file-drop--active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <div className="file-drop__icon" aria-hidden>
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14 38h28V18l-8-8H14v28z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="rgba(94,234,212,0.06)"
          />
          <path d="M6 30h8v8H6v-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="rgba(167,139,250,0.08)" />
          <circle cx="20" cy="14" r="3" fill="currentColor" opacity="0.5" />
          <path d="M14 26l6-6 4 4 8-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
      </div>
      <p className="file-drop__lead">Drop an image here, or</p>
      <label className="file-drop__label">
        <input
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          hidden
        />
        browse
      </label>
    </div>
  )
}
