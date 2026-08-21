// Pins the sheet formulas (docs/brief.md, "Scoring semantics"). If one of these fails, the product rule changed.

import { describe, expect, it } from 'vitest'
import type { Entries, Op } from './model'
import { addDays, dateRange, dayOfWeek, isValidIso, toIso, fromIso } from './dates'
import {
  averageFromDailyScores, dailyScore, dailyScoresForRange, isActiveOn, nextState,
  opAverage, overallAverage, rollingAverage, tone, windowDates, windowReady,
} from './scoring'
import { archiveFrom, archivesInFuture, isArchivedOn, restoreFrom } from './archive'

const op = (id: string, archive: Op['archive'] = []): Op => ({ id, name: id, colour: '#000', note: '', sort: 0, archive })
const OPS = [op('a'), op('b'), op('c'), op('d')]
const START = '2026-06-01'
const TODAY = '2026-08-21'

describe('dates', () => {
  it('round-trips and adds days across a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(toIso(fromIso('2026-08-21'))).toBe('2026-08-21')
  })
  it('knows the weekday and validates strings', () => {
    expect(dayOfWeek('2026-08-21')).toBe(5) // Friday
    expect(isValidIso('2026-02-30')).toBe(false)
    expect(isValidIso('2026-02-28')).toBe(true)
  })
  it('builds inclusive ranges oldest first', () => {
    expect(dateRange('2026-08-20', '2026-08-22')).toEqual(['2026-08-20', '2026-08-21', '2026-08-22'])
    expect(dateRange('2026-08-22', '2026-08-20')).toEqual([])
  })
})

describe('dailyScore', () => {
  it('wins over counted ops × 100; C and blank count in the denominator only', () => {
    const e: Entries = { [TODAY]: { a: 'W', b: 'W', c: 'C' } } // d blank
    expect(dailyScore(OPS, e, TODAY, START)).toBe(50)
  })
  it('byes leave the denominator', () => {
    const e: Entries = { [TODAY]: { a: 'W', b: 'W', c: 'B', d: 'C' } }
    expect(dailyScore(OPS, e, TODAY, START)).toBeCloseTo(66.667, 2)
  })
  it('all byes → no score', () => {
    const e: Entries = { [TODAY]: { a: 'B', b: 'B', c: 'B', d: 'B' } }
    expect(dailyScore(OPS, e, TODAY, START)).toBeNull()
  })
  it('untouched day with active ops scores 0 (D5)', () => {
    expect(dailyScore(OPS, {}, TODAY, START)).toBe(0)
  })
  it('before the start date → no score', () => {
    expect(dailyScore(OPS, {}, '2026-05-31', START)).toBeNull()
  })
  it('no ops → no score', () => {
    expect(dailyScore([], {}, TODAY, START)).toBeNull()
  })
  it('all wins → 100', () => {
    const e: Entries = { [TODAY]: { a: 'W', b: 'W', c: 'W', d: 'W' } }
    expect(dailyScore(OPS, e, TODAY, START)).toBe(100)
  })
})

describe('archive spans (D9)', () => {
  it('excludes the op from the archive date, past or future', () => {
    const o = op('x', [{ from: '2026-08-10', to: null }])
    expect(isActiveOn(o, '2026-08-09', START)).toBe(true)
    expect(isActiveOn(o, '2026-08-10', START)).toBe(false)
    expect(isActiveOn(o, '2026-08-21', START)).toBe(false)
  })
  it('restore re-includes from the restore date', () => {
    const o = op('x', [{ from: '2026-08-10', to: '2026-08-15' }])
    expect(isActiveOn(o, '2026-08-14', START)).toBe(false)
    expect(isActiveOn(o, '2026-08-15', START)).toBe(true)
  })
  it('supports repeated cycles', () => {
    let periods = archiveFrom([], '2026-07-01')
    periods = restoreFrom(periods, '2026-07-10')
    periods = archiveFrom(periods, '2026-08-01')
    periods = restoreFrom(periods, '2026-08-05')
    const o = op('x', periods)
    expect(periods).toEqual([{ from: '2026-07-01', to: '2026-07-10' }, { from: '2026-08-01', to: '2026-08-05' }])
    expect(isActiveOn(o, '2026-07-05', START)).toBe(false)
    expect(isActiveOn(o, '2026-07-20', START)).toBe(true)
    expect(isActiveOn(o, '2026-08-03', START)).toBe(false)
    expect(isActiveOn(o, '2026-08-06', START)).toBe(true)
  })
  it('archiving earlier than an existing open period collapses it', () => {
    const periods = archiveFrom([{ from: '2026-08-10', to: null }], '2026-08-01')
    expect(periods).toEqual([{ from: '2026-08-01', to: null }])
  })
  it('archiving inside a closed period keeps its start (history stays archived)', () => {
    const periods = archiveFrom([{ from: '2026-01-01', to: '2026-03-01' }], '2026-02-01')
    expect(periods).toEqual([{ from: '2026-01-01', to: null }])
    expect(archiveFrom([{ from: '2026-01-01', to: '2026-03-01' }], '2026-03-01')).toEqual([{ from: '2026-01-01', to: '2026-03-01' }, { from: '2026-03-01', to: null }])
  })
  it('restoring before a period removes it', () => {
    expect(restoreFrom([{ from: '2026-08-10', to: null }], '2026-08-01')).toEqual([])
  })
  it('daily score drops the archived op from the denominator', () => {
    const ops = [op('a'), op('b'), op('c', [{ from: '2026-08-20', to: null }])]
    const e: Entries = { '2026-08-19': { a: 'W' }, '2026-08-21': { a: 'W' } }
    expect(dailyScore(ops, e, '2026-08-19', START)).toBeCloseTo(33.333, 2)
    expect(dailyScore(ops, e, '2026-08-21', START)).toBe(50)
  })
  it('reports archived-now and future-archive separately', () => {
    const now = op('x', [{ from: '2026-08-01', to: null }])
    const later = op('y', [{ from: '2026-09-01', to: null }])
    expect(isArchivedOn(now, TODAY)).toBe(true)
    expect(isArchivedOn(later, TODAY)).toBe(false)
    expect(archivesInFuture(later, TODAY)).toBe('2026-09-01')
    expect(archivesInFuture(now, TODAY)).toBeNull()
  })
})

describe('windows', () => {
  it('window = yesterday back N days', () => {
    expect(windowDates(3, TODAY)).toEqual(['2026-08-20', '2026-08-19', '2026-08-18'])
  })
  it('averages stay blank until the sheet is older than the window', () => {
    expect(windowReady(7, TODAY, '2026-08-14')).toBe(true)
    expect(windowReady(7, TODAY, '2026-08-15')).toBe(false)
    expect(windowReady(28, TODAY, '2026-07-24')).toBe(true)
    expect(windowReady(28, TODAY, '2026-07-25')).toBe(false)
  })
})

describe('overallAverage', () => {
  it('is the mean of the daily scores in the window, today excluded', () => {
    const ops = [op('a'), op('b')]
    const e: Entries = {}
    // 7 days ending yesterday: alternate 100 and 50; today is 0 and must not count.
    windowDates(7, TODAY).forEach((iso, i) => { e[iso] = i % 2 === 0 ? { a: 'W', b: 'W' } : { a: 'W' } })
    e[TODAY] = {}
    // 4 days at 100, 3 days at 50 → 550/7
    expect(overallAverage(ops, e, 7, TODAY, START)).toBeCloseTo(550 / 7, 5)
  })
  it('skips days with no score (all byes) rather than counting them as 0', () => {
    const ops = [op('a')]
    const e: Entries = {}
    windowDates(7, TODAY).forEach((iso, i) => { e[iso] = i === 0 ? { a: 'B' } : { a: 'W' } })
    expect(overallAverage(ops, e, 7, TODAY, START)).toBe(100)
  })
  it('counts untouched days as 0', () => {
    const ops = [op('a')]
    const e: Entries = {}
    windowDates(7, TODAY).forEach((iso, i) => { if (i < 6) e[iso] = { a: 'W' } }) // one day untouched
    expect(overallAverage(ops, e, 7, TODAY, START)).toBeCloseTo(600 / 7, 5)
  })
  it('is null before the window is full', () => {
    expect(overallAverage(OPS, {}, 7, TODAY, '2026-08-16')).toBeNull()
  })
  it('rollingAverage is null when no day in the window has a score', () => {
    expect(rollingAverage(() => null, 7, TODAY, START)).toBeNull()
  })
})

describe('averageFromDailyScores (shared boards, Q32)', () => {
  it('absent rows are untouched days and score 0 (D5)', () => {
    const scores = { '2026-08-20': 100, '2026-08-19': 100 } // other 5 days absent
    expect(averageFromDailyScores(scores, 7, TODAY, START)).toBeCloseTo(200 / 7, 5)
  })
  it('stored nulls are skipped, dates before start are skipped', () => {
    const scores = { '2026-08-20': 100, '2026-08-19': null }
    expect(averageFromDailyScores(scores, 7, TODAY, '2026-08-14')).toBeCloseTo(100 / 6, 5)
  })
  it('matches the live computation for the same data', () => {
    const ops = [op('a'), op('b', [{ from: '2026-08-18', to: null }])]
    const e: Entries = {}
    windowDates(28, TODAY).forEach((iso, i) => { e[iso] = i % 3 === 0 ? { a: 'W', b: 'C' } : i % 3 === 1 ? { a: 'W', b: 'W' } : { b: 'B' } })
    const stored = dailyScoresForRange(ops, e, addDays(TODAY, -40), TODAY, START)
    expect(averageFromDailyScores(stored, 7, TODAY, START)).toBeCloseTo(overallAverage(ops, e, 7, TODAY, START)!, 9)
    expect(averageFromDailyScores(stored, 28, TODAY, START)).toBeCloseTo(overallAverage(ops, e, 28, TODAY, START)!, 9)
  })
})

describe('opAverage', () => {
  it('wins over (window days − byes) × 100', () => {
    const o = op('a')
    const e: Entries = {}
    const days = windowDates(7, TODAY)
    e[days[0]!] = { a: 'W' }; e[days[1]!] = { a: 'W' }; e[days[2]!] = { a: 'B' }; e[days[3]!] = { a: 'C' }
    // 4 untouched/blank days + C = 5 non-win counted days, 2 wins, 1 bye → 2/6
    expect(opAverage(o, e, 7, TODAY, START)).toBeCloseTo(200 / 6, 5)
  })
  it('only counts days the op was active', () => {
    const o = op('a', [{ from: '2026-08-18', to: null }])
    const e: Entries = { '2026-08-14': { a: 'W' }, '2026-08-15': { a: 'W' }, '2026-08-16': { a: 'W' }, '2026-08-17': { a: 'C' } }
    expect(opAverage(o, e, 7, TODAY, START)).toBe(75)
  })
  it('is null until the window is full', () => {
    expect(opAverage(op('a'), {}, 28, TODAY, '2026-08-01')).toBeNull()
  })
})

describe('tone and cycle', () => {
  it('85 rule: ≥85 good, ≤84 bad, null none', () => {
    expect(tone(85)).toBe('good'); expect(tone(84.9)).toBe('bad'); expect(tone(null)).toBe('none')
  })
  it('cycles blank → W → C → B → blank; future days toggle B only', () => {
    expect(nextState(undefined, false)).toBe('W')
    expect(nextState('W', false)).toBe('C')
    expect(nextState('C', false)).toBe('B')
    expect(nextState('B', false)).toBeUndefined()
    expect(nextState(undefined, true)).toBe('B')
    expect(nextState('B', true)).toBeUndefined()
  })
})
