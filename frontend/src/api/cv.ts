import type { OpInfo, ProcessResponse } from '../types/cv'

const base = () => (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

function authHeaders(accessToken?: string | null): HeadersInit {
  if (!accessToken) return {}
  return { Authorization: `Bearer ${accessToken}` }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text()
  if (!text) return `${fallback} (${res.status} ${res.statusText})`
  try {
    const j = JSON.parse(text) as { detail?: unknown }
    const d = j.detail
    if (typeof d === 'string') return `${fallback}: ${d}`
    if (d != null) return `${fallback}: ${JSON.stringify(d)}`
  } catch {
    /* not JSON */
  }
  const clip = text.length > 280 ? `${text.slice(0, 280)}…` : text
  return `${fallback} (${res.status}): ${clip}`
}

export async function fetchOps(accessToken?: string | null): Promise<OpInfo[]> {
  const url = `${base()}/api/ops`
  const res = await fetch(url, { headers: authHeaders(accessToken) })
  if (!res.ok) throw new Error(await readApiError(res, 'Failed to load ops'))
  const data = await res.json()
  return data.ops as OpInfo[]
}

export async function processImage(
  file: File,
  pipeline: unknown[],
  accessToken?: string | null,
): Promise<ProcessResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('pipeline', JSON.stringify(pipeline))
  const res = await fetch(`${base()}/api/process`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: form,
  })
  if (!res.ok) {
    // Try to extract FastAPI's ``{ "detail": ... }`` JSON first; fall back to raw text
    // (proxies like Vercel emit plain "Bad Gateway" / "Gateway Timeout" for 5xx).
    let detail: string | null = null
    try {
      const j = (await res.clone().json()) as { detail?: unknown }
      if (typeof j?.detail === 'string') detail = j.detail
      else if (j?.detail != null) detail = JSON.stringify(j.detail)
    } catch {
      const txt = (await res.text().catch(() => '')).trim()
      if (txt) detail = txt.length > 280 ? `${txt.slice(0, 280)}…` : txt
    }

    // Tack on an actionable hint for the common 5xx shapes so users don't
    // stare at a bare "Bad Gateway".
    let hint = ''
    const usesMl = pipeline.some(
      (s) => typeof s === 'object' && s !== null && (
        (s as { op?: string }).op === 'mobile_sam' ||
        (s as { op?: string }).op === 'yolo26_detect'
      ),
    )
    if (res.status === 502 || res.status === 504) {
      hint = usesMl
        ? ' — the ML function may be cold-starting or out of memory. Wait a few seconds and try again, or run on a smaller image.'
        : ' — the backend is temporarily unreachable. Try again in a few seconds.'
    } else if (res.status === 503) {
      hint = ' — a model is not available on this server (e.g. MobileSAM ONNX weights not committed yet).'
    } else if (res.status === 413) {
      hint = ' — the image is too large for the server (see MAX_IMAGE_BYTES).'
    }

    const base = detail || res.statusText || `HTTP ${res.status}`
    throw new Error(`${base}${hint}`)
  }
  return res.json() as Promise<ProcessResponse>
}
