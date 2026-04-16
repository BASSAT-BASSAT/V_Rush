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

export async function fetchSegmentationStatus(accessToken?: string | null): Promise<{
  provider: string
  configured: boolean
  message: string
}> {
  const url = `${base()}/api/segmentation/status`
  const res = await fetch(url, { headers: authHeaders(accessToken) })
  if (!res.ok) throw new Error(await readApiError(res, 'Segmentation status'))
  return res.json() as Promise<{ provider: string; configured: boolean; message: string }>
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
    const err = await res.json().catch(() => ({}))
    const d = err && typeof err === 'object' && 'detail' in err ? (err as { detail: unknown }).detail : res.statusText
    const msg = typeof d === 'string' ? d : JSON.stringify(d)
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return res.json() as Promise<ProcessResponse>
}
