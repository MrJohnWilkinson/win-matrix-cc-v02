// Q32 obligation: rows stored in daily_scores equal the engine's output. Supabase is replaced by an
// in-memory table so the single writer (recomputeRange) is exercised through the real mutations.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entries, EntryState, Op } from '../domain/model'
import { addDays, todayIso } from '../domain/dates'
import { dailyScoresForRange } from '../domain/scoring'

const stored = new Map<string, number | null>()   // day -> score, for the one owner under test

vi.mock('./client', () => {
  const ok = <T,>(data: T) => Promise.resolve({ data, error: null })
  const table = (name: string) => {
    const q = {
      upsert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        if (name === 'daily_scores') for (const r of Array.isArray(rows) ? rows : [rows]) stored.set(r.day as string, r.score as number | null)
        return ok(null)
      },
      delete: () => q, update: () => q, eq: () => q,
      lt: (_col: string, day: string) => { if (name === 'daily_scores') for (const k of [...stored.keys()]) if (k < day) stored.delete(k); return ok(null) },
      then: (res: (v: { data: null; error: null }) => unknown) => res({ data: null, error: null }),
    }
    return q
  }
  return { supabase: { from: table } }
})

import { recomputeRange, setEntry, startDateChanged, type OwnData } from './store'

const OWNER = 'owner'
const TODAY = todayIso()
const STATES: (EntryState | undefined)[] = ['W', 'W', 'C', 'B', undefined]

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 }
}

function randomData(r: () => number, start: string): OwnData {
  const ops: Op[] = Array.from({ length: 1 + Math.floor(r() * 6) }, (_, i) => ({
    id: `op${i}`, name: `Op ${i}`, colour: '#000', note: '', sort: i,
    archive: r() < 0.3 ? [{ from: addDays(TODAY, -Math.floor(r() * 30)), to: r() < 0.5 ? null : addDays(TODAY, -Math.floor(r() * 10)) }] : [],
  }))
  const entries: Entries = {}
  for (let d = 45; d >= -2; d--) {
    const day = addDays(TODAY, -d)
    if (day < start) continue
    for (const op of ops) { const st = STATES[Math.floor(r() * STATES.length)]; if (st) (entries[day] ??= {})[op.id] = st }
  }
  return { ops, entries }
}

function round(v: number | null): number | null { return v === null ? null : Math.round(v * 1000) / 1000 }

function expectStoredMatchesEngine(data: OwnData, start: string): void {
  const engine = dailyScoresForRange(data.ops, data.entries, start, addDays(TODAY, 2), start)
  for (const [day, score] of stored) expect(score, day).toBe(round(engine[day] ?? null))
  expect([...stored.keys()].every((d) => d >= start)).toBe(true)
}

beforeEach(() => stored.clear())

describe('daily_scores round trip (Q32)', () => {
  it('stored rows equal engine output for many random grids and mutations', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      stored.clear()
      const r = rng(seed)
      const start = addDays(TODAY, -40 - Math.floor(r() * 10))
      const data = randomData(r, start)
      await recomputeRange(OWNER, data, start, addDays(TODAY, -40), addDays(TODAY, 2))
      expectStoredMatchesEngine(data, start)
      for (let k = 0; k < 15; k++) {
        const op = data.ops[Math.floor(r() * data.ops.length)]!
        const day = addDays(TODAY, -Math.floor(r() * 30))
        await setEntry(OWNER, data, start, op.id, day, STATES[Math.floor(r() * STATES.length)])
        expectStoredMatchesEngine(data, start)
      }
      const newStart = addDays(start, Math.floor(r() * 10) - 3)
      await startDateChanged(OWNER, data, start, newStart)
      expectStoredMatchesEngine(data, newStart)
    }
  })

  it('never writes a row before the start date', async () => {
    const data = randomData(rng(7), addDays(TODAY, -10))
    await recomputeRange(OWNER, data, addDays(TODAY, -10), addDays(TODAY, -40), TODAY)
    expect(Math.min(...[...stored.keys()].map((d) => (d < addDays(TODAY, -10) ? 0 : 1)))).toBe(1)
  })
})
