// Auth: email + password, confirmations off (Q30). Session handling for the three signed-in pages.

import type { Session } from '@supabase/supabase-js'
import { supabase } from './client'
import { todayIso } from '../domain/dates'
import type { Profile } from '../domain/model'

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Redirect to login when signed out, preserving the current page as the return target. */
export async function requireSession(): Promise<Session> {
  const s = await getSession()
  if (s) return s
  const back = encodeURIComponent(location.pathname.split('/').pop()! + location.search)
  location.replace(`./index.html?next=${back}`)
  return new Promise(() => {}) // never resolves; navigation is under way
}

/** Display name defaults from the email (Q15). */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'You'
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60) || 'You'
}

/** Fetch the profile, creating it on first sign-in with today's local date as the start date (D5). */
export async function ensureProfile(session: Session): Promise<Profile> {
  const { data } = await supabase.from('profiles').select('id, name, start_date').eq('id', session.user.id).maybeSingle()
  if (data) return { id: data.id, name: data.name, startDate: data.start_date }
  const fresh = { id: session.user.id, name: nameFromEmail(session.user.email ?? ''), start_date: todayIso() }
  const { error } = await supabase.from('profiles').insert(fresh)
  if (error) throw error
  return { id: fresh.id, name: fresh.name, startDate: fresh.start_date }
}

export async function updateProfile(id: string, patch: Partial<Pick<Profile, 'name' | 'startDate'>>): Promise<void> {
  const row: { name?: string; start_date?: string } = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.startDate !== undefined) row.start_date = patch.startDate
  const { error } = await supabase.from('profiles').update(row).eq('id', id)
  if (error) throw error
}
