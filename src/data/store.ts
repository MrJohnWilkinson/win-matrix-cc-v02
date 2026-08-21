// Own data: ops, entries, board config, and the derived daily_scores (Q32). The ONLY writer of
// daily_scores is recomputeRange, and every mutation here funnels through it (R2, R5).

import { supabase } from './client'
import type { Json } from './database.types'
import type { ArchivePeriod, BoardItem, DailyScores, Entries, EntryState, IsoDate, Op } from '../domain/model'
import { addDays, todayIso } from '../domain/dates'
import { dailyScoresForRange } from '../domain/scoring'

export interface OwnData { ops: Op[]; entries: Entries }

/** Days of history the derived table is kept honest for on load (28-day window + 2 planned days + slack). */
const REPAIR_DAYS = 40

function rowToOp(r: { id: string; name: string; colour: string; note: string; sort: number; archive: unknown }): Op {
  return { id: r.id, name: r.name, colour: r.colour, note: r.note, sort: r.sort, archive: Array.isArray(r.archive) ? (r.archive as ArchivePeriod[]) : [] }
}

export function rowsToEntries(rows: readonly { op_id: string; day: string; state: string }[]): Entries {
  const out: Entries = {}
  for (const r of rows) (out[r.day] ??= {})[r.op_id] = r.state as EntryState
  return out
}

/** Load every op and every entry for the owner. Entries are small (one row per op per day). */
export async function loadOwn(ownerId: string): Promise<OwnData> {
  const [ops, entries] = await Promise.all([
    supabase.from('ops').select('id, name, colour, note, sort, archive').eq('owner_id', ownerId).order('sort'),
    supabase.from('entries').select('op_id, day, state').eq('owner_id', ownerId),
  ])
  if (ops.error) throw ops.error
  if (entries.error) throw entries.error
  return { ops: ops.data.map(rowToOp), entries: rowsToEntries(entries.data) }
}

// ---------------------------------------------------------------- daily_scores (derived)

/**
 * Recompute and store daily scores for [from, to]. Pure engine output, never hand-set.
 * The database broadcasts the change to live subscribers (trigger broadcast_scores).
 */
export async function recomputeRange(ownerId: string, data: OwnData, startDate: IsoDate, from: IsoDate, to: IsoDate): Promise<DailyScores> {
  if (from < startDate) from = startDate
  if (from > to) return {}
  const scores = dailyScoresForRange(data.ops, data.entries, from, to, startDate)
  const rows = Object.entries(scores).map(([day, score]) => ({ owner_id: ownerId, day, score: score === null ? null : Math.round(score * 1000) / 1000, updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('daily_scores').upsert(rows, { onConflict: 'owner_id,day' })
  if (error) throw error
  return scores
}

/** On every load: repair the recent window so shared boards never drift (Q32 mitigation). */
export async function repairRecent(ownerId: string, data: OwnData, startDate: IsoDate): Promise<void> {
  const today = todayIso()
  await recomputeRange(ownerId, data, startDate, addDays(today, -REPAIR_DAYS), addDays(today, 2))
}

/** Rows before the start date are meaningless once the start date moves later; clear them. */
async function clearBefore(ownerId: string, day: IsoDate): Promise<void> {
  const { error } = await supabase.from('daily_scores').delete().eq('owner_id', ownerId).lt('day', day)
  if (error) throw error
}

// ---------------------------------------------------------------- mutations (each ends in recomputeRange)

export async function setEntry(ownerId: string, data: OwnData, startDate: IsoDate, opId: string, day: IsoDate, state: EntryState | undefined): Promise<void> {
  if (state) {
    const { error } = await supabase.from('entries').upsert({ owner_id: ownerId, op_id: opId, day, state, updated_at: new Date().toISOString() }, { onConflict: 'op_id,day' })
    if (error) throw error
    ;(data.entries[day] ??= {})[opId] = state
  } else {
    const { error } = await supabase.from('entries').delete().eq('op_id', opId).eq('day', day)
    if (error) throw error
    if (data.entries[day]) delete data.entries[day][opId]
  }
  await recomputeRange(ownerId, data, startDate, day, day)
}

export async function addOp(ownerId: string, data: OwnData, startDate: IsoDate, input: { name: string; colour: string; note: string }): Promise<Op> {
  const sort = data.ops.reduce((m, o) => Math.max(m, o.sort), -1) + 1
  const { data: row, error } = await supabase.from('ops').insert({ owner_id: ownerId, name: input.name, colour: input.colour, note: input.note, sort }).select('id, name, colour, note, sort, archive').single()
  if (error) throw error
  const op = rowToOp(row)
  data.ops.push(op)
  // A new op changes every day's denominator from the start date on.
  const today = todayIso()
  await recomputeRange(ownerId, data, startDate, addDays(today, -REPAIR_DAYS), addDays(today, 2))
  return op
}

export async function updateOp(ownerId: string, data: OwnData, startDate: IsoDate, opId: string, patch: Partial<Pick<Op, 'name' | 'colour' | 'note' | 'archive'>>): Promise<void> {
  const op = data.ops.find((o) => o.id === opId)
  if (!op) return
  const row: { name?: string; colour?: string; note?: string; archive?: Json } = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.colour !== undefined) row.colour = patch.colour
  if (patch.note !== undefined) row.note = patch.note
  if (patch.archive !== undefined) row.archive = patch.archive as unknown as Json
  const { error } = await supabase.from('ops').update(row).eq('id', opId)
  if (error) throw error
  Object.assign(op, patch)
  if (patch.archive !== undefined) {
    const today = todayIso()
    await recomputeRange(ownerId, data, startDate, addDays(today, -REPAIR_DAYS), addDays(today, 2))
  }
}

export async function deleteOp(ownerId: string, data: OwnData, startDate: IsoDate, opId: string): Promise<void> {
  const { error } = await supabase.from('ops').delete().eq('id', opId)
  if (error) throw error
  data.ops = data.ops.filter((o) => o.id !== opId)
  for (const day of Object.keys(data.entries)) delete data.entries[day]?.[opId]
  const today = todayIso()
  await recomputeRange(ownerId, data, startDate, addDays(today, -REPAIR_DAYS), addDays(today, 2))
}

/** Swap sort positions of two ops. Sort order never changes a score, so no recompute. */
export async function reorderOps(data: OwnData, a: Op, b: Op): Promise<void> {
  const [sa, sb] = [a.sort, b.sort]
  a.sort = sb; b.sort = sa
  data.ops.sort((x, y) => x.sort - y.sort)
  const [ra, rb] = await Promise.all([
    supabase.from('ops').update({ sort: a.sort }).eq('id', a.id),
    supabase.from('ops').update({ sort: b.sort }).eq('id', b.id),
  ])
  if (ra.error) throw ra.error
  if (rb.error) throw rb.error
}

/** Start date moved: everything from the earlier of old/new needs recomputing; rows before the new start go. */
export async function startDateChanged(ownerId: string, data: OwnData, oldStart: IsoDate, newStart: IsoDate): Promise<void> {
  if (newStart > oldStart) await clearBefore(ownerId, newStart)
  const today = todayIso()
  await recomputeRange(ownerId, data, newStart, oldStart < newStart ? oldStart : newStart, addDays(today, 2))
}

// ---------------------------------------------------------------- board config

export async function loadBoardConfig(ownerId: string): Promise<BoardItem[]> {
  const { data, error } = await supabase.from('board_config').select('items').eq('owner_id', ownerId).maybeSingle()
  if (error) throw error
  return Array.isArray(data?.items) ? (data.items as unknown as BoardItem[]) : []
}

export async function saveBoardConfig(ownerId: string, items: BoardItem[]): Promise<void> {
  const { error } = await supabase.from('board_config').upsert({ owner_id: ownerId, items: items as unknown as Json, updated_at: new Date().toISOString() })
  if (error) throw error
}
