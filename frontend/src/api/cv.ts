import type { OpInfo, ProcessResponse } from '../types/cv'

const base = () => (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

function authHeaders(accessToken?: string | null): HeadersInit {
  if (!accessToken) return {}
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchOps(accessToken?: string | null): Promise<OpInfo[]> {
  const res = await fetch(`${base()}/api/ops`, { headers: authHeaders(accessToken) })
  if (!res.ok) throw new Error(`Failed to load ops: ${res.statusText}`)
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
    const err = await res.json().catch(() => ({}))
    const d = err && typeof err === 'object' && 'detail' in err ? (err as { detail: unknown }).detail : res.statusText
    const msg = typeof d === 'string' ? d : JSON.stringify(d)
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return res.json() as Promise<ProcessResponse>
}
