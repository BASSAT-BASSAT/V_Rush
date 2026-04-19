import { getSupabase } from './supabase'
import type { KaggleCreds } from '../types/cv'

/**
 * Fetch the user's stored Kaggle credentials from the ``profiles`` table.
 * RLS limits SELECT to ``auth.uid() = id`` so we can safely query without a user filter.
 *
 * Returns ``null`` when the columns are unset (user hasn't connected yet).
 */
export async function loadKaggleCreds(userId: string): Promise<KaggleCreds | null> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('kaggle_username, kaggle_key')
    .eq('id', userId)
    .single()
  if (error) throw new Error(error.message)
  const username = (data?.kaggle_username ?? '').toString().trim()
  const key = (data?.kaggle_key ?? '').toString().trim()
  if (!username || !key) return null
  return { username, key }
}

export async function saveKaggleCreds(userId: string, creds: KaggleCreds): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb
    .from('profiles')
    .update({
      kaggle_username: creds.username.trim(),
      kaggle_key: creds.key.trim(),
    })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function clearKaggleCreds(userId: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb
    .from('profiles')
    .update({ kaggle_username: null, kaggle_key: null })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}
