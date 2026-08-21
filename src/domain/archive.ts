// Archive span edits (D9). Pure: return a new period list, never mutate.

import type { ArchivePeriod, IsoDate, Op } from './model'

/** Archive from `from` onward. Any later or overlapping periods collapse into one open period. */
export function archiveFrom(periods: readonly ArchivePeriod[], from: IsoDate): ArchivePeriod[] {
  const kept = periods.filter((p) => p.to !== null && p.to <= from)
  return [...kept, { from, to: null }]
}

/** Bring the op back from `from` onward: close the period that covers or follows `from`. */
export function restoreFrom(periods: readonly ArchivePeriod[], from: IsoDate): ArchivePeriod[] {
  const out: ArchivePeriod[] = []
  for (const p of periods) {
    if (p.from >= from) continue                        // a period entirely after the restore date vanishes
    if (p.to === null || p.to > from) out.push({ from: p.from, to: from })
    else out.push(p)
  }
  return out
}

/** Archived on this day, with no scheduled return before it. */
export function isArchivedOn(op: Op, iso: IsoDate): boolean {
  return op.archive.some((p) => iso >= p.from && (p.to === null || iso < p.to))
}

/** Archived from a future date: still a live column today, but the column is on notice. */
export function archivesInFuture(op: Op, today: IsoDate): IsoDate | null {
  const next = op.archive.filter((p) => p.from > today).sort((a, b) => (a.from < b.from ? -1 : 1))[0]
  return next ? next.from : null
}
