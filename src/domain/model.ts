// Domain model. Plain data, no behaviour, no I/O. Every screen and the data layer speak these types.

/** Calendar day in the device's local zone, `YYYY-MM-DD`. Compared as strings. */
export type IsoDate = string

/** The three recorded states (D6). Absent = untracked. */
export type EntryState = 'W' | 'C' | 'B'

/** A closed or open stretch during which an op is archived (D9). `to` null = still archived. */
export interface ArchivePeriod {
  from: IsoDate
  to: IsoDate | null
}

export interface Op {
  id: string
  name: string
  /** Non-semantic colour tag hex (A5). */
  colour: string
  /** Free-text note: targets, days, e.g. "mwf" (DC6). */
  note: string
  sort: number
  archive: ArchivePeriod[]
}

/** entries[date][opId] = state. Missing key = untracked. */
export type Entries = Record<IsoDate, Record<string, EntryState>>

/** Daily scores by date, as stored for sharing (Q32). null = no score that day. */
export type DailyScores = Record<IsoDate, number | null>

export type ScoreTone = 'good' | 'bad' | 'none'

/** What a viewer may see. Viewers only ever see effective grants (effective_depth). */
export type ShareDepth = 'summary' | 'full'

/** Owner-side setting per person and for the public page (S1, S12). `off` = revoked, still listed. */
export type GrantDepth = ShareDepth | 'off'

export interface Profile {
  id: string
  name: string
  startDate: IsoDate
}

/** One tile on the composer / display, in the user's chosen order. */
export interface BoardItem {
  /** Owner user id; the user's own id for their own board. */
  ownerId: string
  show: boolean
  featured: boolean
  avg7: boolean
  avg28: boolean
  last7: boolean
  ops: boolean
  /** Ops-panel filter, own board only (A6/D7). */
  mode: 'not-done' | 'done' | 'both'
}
