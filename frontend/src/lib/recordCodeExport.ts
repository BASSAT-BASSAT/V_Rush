import { getSupabase } from './supabase'

/** Bump `profiles.code_export_count` for the signed-in user (no-op if no Supabase / no session). */
export async function recordCodeExport(): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  if (!url) return

  try {
    const sb = getSupabase()
    const {
      data: { session },
    } = await sb.auth.getSession()
    if (!session?.user) return

    const { error } = await sb.rpc('increment_code_export_count')
    if (error) {
      console.warn('recordCodeExport:', error.message)
    }
  } catch (e) {
    console.warn('recordCodeExport:', e)
  }
}
