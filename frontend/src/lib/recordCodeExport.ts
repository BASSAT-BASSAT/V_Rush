import { invokeProfileRpc } from './supabaseProfileRpc'

/** Bump ``profiles.code_export_count`` (Copy / Download Python). */
export async function recordCodeExport(accessToken?: string | null): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  if (!url) return false

  try {
    return await invokeProfileRpc('increment_code_export_count', {}, accessToken)
  } catch (e) {
    console.warn('recordCodeExport:', e)
    return false
  }
}
