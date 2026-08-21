// Calendar helpers over IsoDate strings. Local zone only (DC2). Pure.

import type { IsoDate } from './model'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date of a Date object. */
export function toIso(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Noon local, so DST shifts never move the calendar day. */
export function fromIso(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIso(now)
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = fromIso(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: IsoDate): number {
  return fromIso(iso).getDay()
}

export function isWeekend(iso: IsoDate): boolean {
  const dow = dayOfWeek(iso)
  return dow === 0 || dow === 6
}

/** `len` dates ending at `end`, newest first. */
export function datesEndingAt(end: IsoDate, len: number): IsoDate[] {
  const out: IsoDate[] = []
  for (let i = 0; i < len; i++) out.push(addDays(end, -i))
  return out
}

/** Inclusive range, oldest first. Empty when from > to. */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function isValidIso(s: string): s is IsoDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && toIso(fromIso(s)) === s
}
