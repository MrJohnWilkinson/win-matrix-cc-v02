// Board stats for the scoreboard and the wall: the same numbers whether the board is your own (ops +
// entries on hand) or someone else's (stored daily scores only). Pure.

import type { DailyScores, Entries, EntryState, IsoDate, Op } from './model'
import { addDays, dayOfWeek } from './dates'
import { activeOps, averageFromDailyScores, dailyScore, overallAverage } from './scoring'

export interface BoardSource {
  startDate: IsoDate
  scores: DailyScores
  /** Present only at full depth (or for your own board). */
  ops: Op[] | null
  entries: Entries | null
}

export interface BoardStats {
  today: number | null
  avg7: number | null
  avg28: number | null
  /** The last 7 days ending yesterday, oldest first. */
  last7: { iso: IsoDate; dow: string; score: number | null }[]
  /** Today's per-op states at full depth; null at summary depth. */
  opsToday: { id: string; name: string; state: EntryState | undefined }[] | null
}

const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Score for one day from stored rows: absent row on/after start = untouched day = 0 (D5). */
export function storedDayScore(scores: DailyScores, iso: IsoDate, startDate: IsoDate): number | null {
  if (iso < startDate) return null
  return iso in scores ? scores[iso]! : 0
}

export function boardStats(src: BoardSource, today: IsoDate): BoardStats {
  const live = src.ops !== null && src.entries !== null
  const day = (iso: IsoDate) => (live ? dailyScore(src.ops!, src.entries!, iso, src.startDate) : storedDayScore(src.scores, iso, src.startDate))
  const last7: BoardStats['last7'] = []
  for (let k = 7; k >= 1; k--) { const iso = addDays(today, -k); last7.push({ iso, dow: DOW1[dayOfWeek(iso)]!, score: day(iso) }) }
  return {
    today: day(today),
    avg7: live ? overallAverage(src.ops!, src.entries!, 7, today, src.startDate) : averageFromDailyScores(src.scores, 7, today, src.startDate),
    avg28: live ? overallAverage(src.ops!, src.entries!, 28, today, src.startDate) : averageFromDailyScores(src.scores, 28, today, src.startDate),
    last7,
    opsToday: live ? activeOps(src.ops!, today, src.startDate).map((o) => ({ id: o.id, name: o.name, state: src.entries![today]?.[o.id] })) : null,
  }
}

/** Ops-panel filter on the owner's own tile (D7): what counts as done. */
export function inMode(state: EntryState | undefined, mode: 'not-done' | 'done' | 'both'): boolean {
  if (mode === 'both') return true
  const done = state === 'W' || state === 'B'
  return mode === 'done' ? done : !done
}
