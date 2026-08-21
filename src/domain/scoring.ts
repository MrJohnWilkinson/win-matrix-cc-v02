// The one scoring engine (R1). Formulas verified against the live Google Sheets; see docs/brief.md
// "Scoring semantics". Pure functions over plain data. No Date objects, no I/O.
//
//   daily       = wins / (active ops − byes) × 100        (C and blank count in the denominator only)
//   overall avg = mean of daily scores, window = yesterday back N days; blank until the window is full
//   per-op avg  = wins / (window days − byes) × 100       over the days the op was active
//   85 rule     : ≥ 85 good, ≤ 84 flag

import type { DailyScores, Entries, IsoDate, Op, ScoreTone } from './model'
import { addDays, datesEndingAt } from './dates'

export const THRESHOLD = 85

/** Is the op counted on this day? Before the user's start date nothing counts (D5). Archive periods exclude days (D9). */
export function isActiveOn(op: Op, iso: IsoDate, startDate: IsoDate): boolean {
  if (iso < startDate) return false
  for (const p of op.archive) {
    if (iso >= p.from && (p.to === null || iso < p.to)) return false
  }
  return true
}

/** Ops active on the given day, in sort order. */
export function activeOps(ops: readonly Op[], iso: IsoDate, startDate: IsoDate): Op[] {
  return ops.filter((op) => isActiveOn(op, iso, startDate))
}

/**
 * Daily score for one day. null when the day is before the start date or when no op counts
 * (no active ops, or every active op is a bye). An untouched day with active ops scores 0 (D5).
 */
export function dailyScore(ops: readonly Op[], entries: Entries, iso: IsoDate, startDate: IsoDate): number | null {
  if (iso < startDate) return null
  const day = entries[iso] ?? {}
  let counted = 0
  let wins = 0
  for (const op of ops) {
    if (!isActiveOn(op, iso, startDate)) continue
    const state = day[op.id]
    if (state === 'B') continue
    counted++
    if (state === 'W') wins++
  }
  return counted === 0 ? null : (wins / counted) * 100
}

/** The averages stay blank until the sheet is older than the window (brief). */
export function windowReady(len: number, today: IsoDate, startDate: IsoDate): boolean {
  return startDate <= addDays(today, -len)
}

/** Window of `len` days ending yesterday, newest first. */
export function windowDates(len: number, today: IsoDate): IsoDate[] {
  return datesEndingAt(addDays(today, -1), len)
}

/**
 * Overall rolling average: mean of the daily scores across the window ending yesterday.
 * `lookup` returns the daily score for a date (null = no score that day, skipped).
 * Returns null until the window is full or when no day in the window has a score.
 */
export function rollingAverage(
  lookup: (iso: IsoDate) => number | null,
  len: number,
  today: IsoDate,
  startDate: IsoDate,
): number | null {
  if (!windowReady(len, today, startDate)) return null
  let sum = 0
  let n = 0
  for (const iso of windowDates(len, today)) {
    const v = lookup(iso)
    if (v === null) continue
    sum += v
    n++
  }
  return n === 0 ? null : sum / n
}

/** Overall rolling average computed straight from ops and entries (own board). */
export function overallAverage(ops: readonly Op[], entries: Entries, len: number, today: IsoDate, startDate: IsoDate): number | null {
  return rollingAverage((iso) => dailyScore(ops, entries, iso, startDate), len, today, startDate)
}

/**
 * Overall rolling average from stored daily scores (someone else's board, Q32).
 * A date with no row is an untouched day and scores 0 (D5), provided it is on or after the start date.
 */
export function averageFromDailyScores(scores: DailyScores, len: number, today: IsoDate, startDate: IsoDate): number | null {
  return rollingAverage((iso) => (iso < startDate ? null : (iso in scores ? scores[iso]! : 0)), len, today, startDate)
}

/** Per-op window average: wins / (active window days − byes) × 100. null until the window is full or no day counts. */
export function opAverage(op: Op, entries: Entries, len: number, today: IsoDate, startDate: IsoDate): number | null {
  if (!windowReady(len, today, startDate)) return null
  let counted = 0
  let wins = 0
  for (const iso of windowDates(len, today)) {
    if (!isActiveOn(op, iso, startDate)) continue
    const state = entries[iso]?.[op.id]
    if (state === 'B') continue
    counted++
    if (state === 'W') wins++
  }
  return counted === 0 ? null : (wins / counted) * 100
}

/** Daily scores for every day from `from` to `to` inclusive; what the owner's client stores (Q32). */
export function dailyScoresForRange(ops: readonly Op[], entries: Entries, from: IsoDate, to: IsoDate, startDate: IsoDate): DailyScores {
  const out: DailyScores = {}
  for (let iso = from; iso <= to; iso = addDays(iso, 1)) {
    out[iso] = dailyScore(ops, entries, iso, startDate)
  }
  return out
}

export function tone(v: number | null): ScoreTone {
  if (v === null) return 'none'
  return v >= THRESHOLD ? 'good' : 'bad'
}

export function formatScore(v: number | null): string {
  return v === null ? '—' : String(Math.round(v))
}

/** Click cycle on a matrix cell. Past/today: blank → W → C → B → blank. Future days take byes only (planned byes, D9). */
export function nextState(current: 'W' | 'C' | 'B' | undefined, isFuture: boolean): 'W' | 'C' | 'B' | undefined {
  if (isFuture) return current === 'B' ? undefined : 'B'
  switch (current) {
    case undefined: return 'W'
    case 'W': return 'C'
    case 'C': return 'B'
    case 'B': return undefined
  }
}
