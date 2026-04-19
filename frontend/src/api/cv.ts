import type {
  KaggleCreds,
  KaggleFileListResponse,
  KaggleImageResponse,
  KaggleSearchResponse,
  MatchOptions,
  MatchResponse,
  OpInfo,
  ProcessResponse,
} from '../types/cv'

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

// =========================
// MATCHER ( /api/match )
// =========================

export async function matchImages(
  imageA: File,
  imageB: File,
  options: MatchOptions,
  accessToken?: string | null,
): Promise<MatchResponse> {
  const form = new FormData()
  form.append('image_a', imageA)
  form.append('image_b', imageB)
  form.append('options', JSON.stringify(options))
  const res = await fetch(`${base()}/api/match`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: form,
  })
  if (!res.ok) throw new Error(await readApiError(res, 'Failed to match images'))
  return res.json() as Promise<MatchResponse>
}

// =========================
// KAGGLE ( /api/kaggle/* )
// =========================

function kaggleHeaders(creds: KaggleCreds, accessToken?: string | null): HeadersInit {
  const h: Record<string, string> = {
    'X-Kaggle-Username': creds.username,
    'X-Kaggle-Key': creds.key,
  }
  if (accessToken) h.Authorization = `Bearer ${accessToken}`
  return h
}

export async function listKaggleFiles(
  slug: string,
  creds: KaggleCreds,
  accessToken?: string | null,
): Promise<KaggleFileListResponse> {
  const [owner, name] = slug.split('/')
  if (!owner || !name) {
    throw new Error('Dataset slug must look like "owner/dataset-name".')
  }
  const url = `${base()}/api/kaggle/datasets/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/files`
  const res = await fetch(url, { headers: kaggleHeaders(creds, accessToken) })
  if (!res.ok) throw new Error(await readApiError(res, 'Failed to list Kaggle files'))
  return res.json() as Promise<KaggleFileListResponse>
}

export async function getKaggleFile(
  slug: string,
  path: string,
  creds: KaggleCreds,
  accessToken?: string | null,
): Promise<KaggleImageResponse> {
  const [owner, name] = slug.split('/')
  if (!owner || !name) {
    throw new Error('Dataset slug must look like "owner/dataset-name".')
  }
  const url = `${base()}/api/kaggle/datasets/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/file?path=${encodeURIComponent(path)}`
  const res = await fetch(url, { headers: kaggleHeaders(creds, accessToken) })
  if (!res.ok) throw new Error(await readApiError(res, 'Failed to download Kaggle file'))
  return res.json() as Promise<KaggleImageResponse>
}

export async function searchKaggleDatasets(
  query: string,
  creds: KaggleCreds,
  page = 1,
  accessToken?: string | null,
): Promise<KaggleSearchResponse> {
  const url = `${base()}/api/kaggle/search?q=${encodeURIComponent(query)}&page=${page}`
  const res = await fetch(url, { headers: kaggleHeaders(creds, accessToken) })
  if (!res.ok) throw new Error(await readApiError(res, 'Failed to search Kaggle')) 
  return res.json() as Promise<KaggleSearchResponse>
}

/** Convert a base64 image payload into a File for upload to /api/process or /api/match. */
export function base64ToFile(base64: string, filename: string, mime = 'image/png'): File {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}
