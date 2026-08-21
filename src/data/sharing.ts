// Sharing (D7, D8, Q31, S1-S12): the standing invite link, sharing settings, per-person grants, and
// reading the boards I have been granted. Visibility is decided server-side (effective_depth): a
// viewer's queries only ever return effective grants, so off and paused boards vanish silently.

import { newToken, supabase } from './client'
import { rowsToEntries } from './store'
import type { DailyScores, Entries, GrantDepth, IsoDate, Op, ShareDepth } from '../domain/model'
import { addDays, todayIso } from '../domain/dates'

export interface SharingSettings { paused: boolean; publicToken: string; publicDepth: GrantDepth }
export interface OwnerGrant { viewerId: string; viewerName: string; depth: GrantDepth; createdAt: string }
export interface Grant { ownerId: string; viewerId: string; depth: ShareDepth; createdAt: string }

/** One board I may see: the owner's identity, my depth, their recent scores, and the grid if full. */
export interface SharedBoard {
  ownerId: string
  name: string
  startDate: IsoDate
  depth: ShareDepth
  scores: DailyScores
  ops: Op[] | null
  entries: Entries | null
}

const base = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`
export function shareUrl(token: string): string { return `${base()}scoreboard.html?claim=${token}` }
export function publicUrl(token: string): string { return `${base()}display.html?p=${token}` }

// ---------------------------------------------------------------- owner side

/** The owner's sharing settings; the row (and the public token) is minted on first use. */
export async function ensureSharingSettings(ownerId: string): Promise<SharingSettings> {
  const existing = await supabase.from('sharing_settings').select('paused, public_token, public_depth').eq('owner_id', ownerId).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return { paused: existing.data.paused, publicToken: existing.data.public_token, publicDepth: existing.data.public_depth as GrantDepth }
  const row = { owner_id: ownerId, paused: false, public_token: newToken(), public_depth: 'off' }
  const { error } = await supabase.from('sharing_settings').insert(row)
  if (error) throw error
  return { paused: false, publicToken: row.public_token, publicDepth: 'off' }
}

export async function setPaused(ownerId: string, paused: boolean): Promise<void> {
  const { error } = await supabase.from('sharing_settings').update({ paused, updated_at: new Date().toISOString() }).eq('owner_id', ownerId)
  if (error) throw error
}

export async function setPublicDepth(ownerId: string, depth: GrantDepth): Promise<void> {
  const { error } = await supabase.from('sharing_settings').update({ public_depth: depth, updated_at: new Date().toISOString() }).eq('owner_id', ownerId)
  if (error) throw error
}

export async function setGrantDepth(ownerId: string, viewerId: string, depth: GrantDepth): Promise<void> {
  const { error } = await supabase.from('share_grants').update({ depth }).eq('owner_id', ownerId).eq('viewer_id', viewerId)
  if (error) throw error
}

/** The one standing invite link (S3); minted on first use. Joiners land at Summary (S5). */
export async function getOrCreateInviteLink(ownerId: string): Promise<string> {
  const existing = await supabase.from('share_links').select('token').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data.token
  return insertLink(ownerId)
}

/** New link for new joiners; the old one stops working. Existing grants are untouched (S3, S11). */
export async function resetInviteLink(ownerId: string): Promise<string> {
  const del = await supabase.from('share_links').delete().eq('owner_id', ownerId)
  if (del.error) throw del.error
  return insertLink(ownerId)
}

async function insertLink(ownerId: string): Promise<string> {
  const token = newToken()
  const { error } = await supabase.from('share_links').insert({ token, owner_id: ownerId })
  if (error) throw error
  return token
}

/** Grants where I am the owner: who can see me, including people set to Off (S2). */
export async function loadGrantsForOwner(ownerId: string): Promise<OwnerGrant[]> {
  const { data, error } = await supabase.from('share_grants').select('viewer_id, depth, created_at').eq('owner_id', ownerId).order('created_at')
  if (error) throw error
  const ids = data.map((g) => g.viewer_id)
  const names = new Map<string, string>()
  if (ids.length) {
    const p = await supabase.from('profiles').select('id, name').in('id', ids)
    if (p.error) throw p.error
    p.data.forEach((r) => names.set(r.id, r.name))
  }
  return data.map((g) => ({ viewerId: g.viewer_id, viewerName: names.get(g.viewer_id) ?? 'Someone', depth: g.depth as GrantDepth, createdAt: g.created_at }))
}

// ---------------------------------------------------------------- viewer side

/** Claim a link as the signed-in user. `depth` is null when the owner is not sharing with me right now. */
export async function claimShare(token: string): Promise<{ ownerId: string; ownerName: string; depth: ShareDepth | null }> {
  const { data, error } = await supabase.rpc('claim_share', { p_token: token })
  if (error) throw error
  const row = data[0]
  if (!row) throw new Error('Claim returned no grant')
  return { ownerId: row.grant_owner_id, ownerName: row.grant_owner_name, depth: (row.grant_depth as ShareDepth | null) ?? null }
}

/** Effective grants where I am the viewer: the boards available to my composer. */
export async function loadGrantsForViewer(viewerId: string): Promise<Grant[]> {
  const { data, error } = await supabase.from('share_grants').select('owner_id, viewer_id, depth, created_at').eq('viewer_id', viewerId).order('created_at')
  if (error) throw error
  return data.map((g) => ({ ownerId: g.owner_id, viewerId: g.viewer_id, depth: g.depth as ShareDepth, createdAt: g.created_at }))
}

/** Load every board granted to me, with the last ~40 days of scores and, where full, the grid. */
export async function loadSharedBoards(viewerId: string): Promise<SharedBoard[]> {
  const grants = await loadGrantsForViewer(viewerId)
  if (!grants.length) return []
  const ids = grants.map((g) => g.ownerId)
  const fullIds = grants.filter((g) => g.depth === 'full').map((g) => g.ownerId)
  const from = addDays(todayIso(), -40)
  const [profiles, scores, ops, entries] = await Promise.all([
    supabase.from('profiles').select('id, name, start_date').in('id', ids),
    supabase.from('daily_scores').select('owner_id, day, score').in('owner_id', ids).gte('day', from),
    fullIds.length ? supabase.from('ops').select('id, owner_id, name, colour, note, sort, archive').in('owner_id', fullIds).order('sort') : Promise.resolve({ data: [], error: null }),
    fullIds.length ? supabase.from('entries').select('owner_id, op_id, day, state').in('owner_id', fullIds).gte('day', from) : Promise.resolve({ data: [], error: null }),
  ])
  for (const r of [profiles, scores, ops, entries]) if (r.error) throw r.error
  const byOwner = <T extends { owner_id: string }>(rows: T[]): Map<string, T[]> => {
    const m = new Map<string, T[]>()
    rows.forEach((r) => { (m.get(r.owner_id) ?? m.set(r.owner_id, []).get(r.owner_id)!).push(r) })
    return m
  }
  const scoreRows = byOwner(scores.data ?? []), opRows = byOwner(ops.data ?? []), entryRows = byOwner(entries.data ?? [])
  return grants.flatMap((g) => {
    const p = profiles.data?.find((x) => x.id === g.ownerId)
    if (!p) return []
    const sc: DailyScores = {}
    for (const r of scoreRows.get(g.ownerId) ?? []) sc[r.day] = r.score
    const full = g.depth === 'full'
    return [{
      ownerId: g.ownerId, name: p.name, startDate: p.start_date, depth: g.depth, scores: sc,
      ops: full ? (opRows.get(g.ownerId) ?? []).map((r) => ({ id: r.id, name: r.name, colour: r.colour, note: r.note, sort: r.sort, archive: Array.isArray(r.archive) ? (r.archive as unknown as Op['archive']) : [] })) : null,
      entries: full ? rowsToEntries(entryRows.get(g.ownerId) ?? []) : null,
    }]
  })
}
