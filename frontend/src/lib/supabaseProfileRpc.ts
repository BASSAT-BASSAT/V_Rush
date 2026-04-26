/**
 * Call Supabase PostgREST RPCs as the signed-in user.
 * Pass ``accessToken`` from the app shell when available; ``getSession()`` can lag behind React.
 */
import { getSupabase } from './supabase'

async function bearerForRpc(accessToken?: string | null): Promise<string | null> {
  if (accessToken?.trim()) return accessToken.trim()
  try {
    const sb = getSupabase()
    const { data } = await sb.auth.getSession()
    const t = data.session?.access_token
    if (t) return t
    const { data: refreshed } = await sb.auth.refreshSession()
    return refreshed.session?.access_token ?? null
  } catch {
    return null
  }
}

export async function invokeProfileRpc(
  fn: string,
  body: Record<string, unknown>,
  accessToken?: string | null,
): Promise<boolean> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!baseUrl || !anonKey) {
    if (import.meta.env.DEV) {
      console.warn('invokeProfileRpc: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    }
    return false
  }

  const token = await bearerForRpc(accessToken)
  if (!token) return false

  const res = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.warn(`invokeProfileRpc: RPC ${fn} failed`, res.status, detail || res.statusText)
    return false
  }
  return true
}
