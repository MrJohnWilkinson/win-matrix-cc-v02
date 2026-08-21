// Wall display (Q34) and public page (S12): display tokens, and the two anonymous snapshot RPCs.

import { newToken, supabase } from './client'
import { rowsToEntries } from './store'
import type { BoardItem, IsoDate, Op, ShareDepth } from '../domain/model'
import type { SharedBoard } from './sharing'

export interface DisplaySnapshot {
  owner: { id: string; name: string; startDate: IsoDate }
  items: BoardItem[]
  boards: SharedBoard[]
}

export function displayUrl(token: string): string {
  const base = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`
  return `${base}display.html?key=${token}`
}

/** The owner's single display token, minted on first use. */
export async function getOrCreateDisplayToken(ownerId: string): Promise<string> {
  const existing = await supabase.from('display_tokens').select('token').eq('owner_id', ownerId).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data.token
  const token = newToken()
  const { error } = await supabase.from('display_tokens').insert({ token, owner_id: ownerId })
  if (error) throw error
  return token
}

interface RawBoard {
  id: string; depth: ShareDepth; name: string; startDate: IsoDate
  scores: Record<string, number | null>
  ops: { id: string; name: string; colour: string; note: string; sort: number; archive: Op['archive'] }[] | null
  entries: { opId: string; day: string; state: string }[] | null
}

export async function fetchDisplaySnapshot(token: string): Promise<DisplaySnapshot> {
  const { data, error } = await supabase.rpc('display_snapshot', { p_token: token })
  if (error) throw error
  return toSnapshot(data)
}

/** The public page: one board, off by default, gated by the owner's depth and Pause-all (S12). */
export async function fetchPublicSnapshot(token: string): Promise<DisplaySnapshot> {
  const { data, error } = await supabase.rpc('public_snapshot', { p_token: token })
  if (error) throw error
  return toSnapshot(data)
}

function toSnapshot(data: unknown): DisplaySnapshot {
  const raw = data as { owner: DisplaySnapshot['owner']; items: BoardItem[]; boards: RawBoard[] }
  return {
    owner: raw.owner,
    items: Array.isArray(raw.items) ? raw.items : [],
    boards: (raw.boards ?? []).map((b) => ({
      ownerId: b.id, name: b.name, startDate: b.startDate, depth: b.depth, scores: b.scores ?? {},
      ops: b.ops ? b.ops.map((o) => ({ ...o, archive: Array.isArray(o.archive) ? o.archive : [] })) : null,
      entries: b.entries ? rowsToEntries(b.entries.map((e) => ({ op_id: e.opId, day: e.day, state: e.state }))) : null,
    })),
  }
}
