// Seed generated sample data for testing (D3: no history import; test with generated data).
// Creates three test users with 60 days of history, shares between them, and a composer config.
// Run: `npm run seed` with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_PASSWORD in the environment (never in the repo).
// Remove: `npm run seed -- --clean` deletes the same users and everything under them (cascades).

import { createClient } from '@supabase/supabase-js'
import type { Entries, EntryState, Op } from '../src/domain/model'
import { addDays, isWeekend, todayIso } from '../src/domain/dates'
import { dailyScoresForRange } from '../src/domain/scoring'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_PASSWORD
if (!url || !key || !PASSWORD) { console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_PASSWORD.'); process.exit(1) }
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const USERS = [
  { email: 'wm-test-mim@example.com', name: 'Mim', base: 0.9 },
  { email: 'wm-test-rob@example.com', name: 'Rob', base: 0.82 },
  { email: 'wm-test-kate@example.com', name: 'Kate', base: 0.72 },
]
const OPS = [
  ['Wake 05:30', '#9c36b5', ''], ['Gym', '#9c36b5', 'mwf'], ['Meditate 10m', '#9c36b5', ''], ['Deep work 2h', '#3b5bdb', ''],
  ['Walk 10k', '#3b5bdb', ''], ['No sugar', '#3b5bdb', ''], ['Journal', '#6c757d', ''], ['Read 20m', '#6c757d', ''],
] as const

function hash(s: string): number { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h >>> 8) % 1000) / 1000 }

async function findUser(email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email === email)?.id ?? null
}

async function clean(): Promise<void> {
  for (const u of USERS) {
    const id = await findUser(u.email)
    if (id) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw error; console.log('deleted', u.email) }
  }
}

async function seed(): Promise<void> {
  const today = todayIso()
  const start = addDays(today, -60)
  const ids: string[] = []
  for (const u of USERS) {
    let id = await findUser(u.email)
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true })
      if (error) throw error
      id = data.user.id
    }
    ids.push(id)
    await must(admin.from('profiles').upsert({ id, name: u.name, start_date: start }))
    await must(admin.from('ops').delete().eq('owner_id', id))
    const opRows = OPS.map(([name, colour, note], i) => ({ owner_id: id!, name, colour, note, sort: i, archive: i === 7 ? [{ from: addDays(today, -10), to: null }] : [] }))
    const { data: inserted, error } = await admin.from('ops').insert(opRows).select('id, name, colour, note, sort, archive')
    if (error) throw error
    const ops: Op[] = inserted.map((r) => ({ id: r.id, name: r.name, colour: r.colour, note: r.note, sort: r.sort, archive: (r.archive as Op['archive']) ?? [] }))
    const entries: Entries = {}
    const rows: { owner_id: string; op_id: string; day: string; state: EntryState }[] = []
    for (let i = 60; i >= 0; i--) {
      const day = addDays(today, -i)
      entries[day] = {}
      ops.forEach((op, k) => {
        if (i === 0 && k > 2) return // today: only the first three recorded
        let state: EntryState | undefined
        if (isWeekend(day) && (op.note === 'mwf' || op.name === 'Deep work 2h')) state = 'B'
        else { const r = hash(u.email + day + op.id); state = r < u.base ? 'W' : r < u.base + 0.08 ? 'C' : r < u.base + 0.14 ? 'B' : undefined }
        if (state) { entries[day]![op.id] = state; rows.push({ owner_id: id!, op_id: op.id, day, state }) }
      })
    }
    await must(admin.from('entries').insert(rows))
    const scores = dailyScoresForRange(ops, entries, start, addDays(today, 2), start)
    await must(admin.from('daily_scores').upsert(Object.entries(scores).map(([day, score]) => ({ owner_id: id!, day, score }))))
    console.log('seeded', u.email, rows.length, 'entries')
  }
  // Mim shares full with Rob and summary with Kate; Rob shares summary with Mim; Kate shares full with Mim.
  const [mim, rob, kate] = ids as [string, string, string]
  await must(admin.from('share_grants').upsert([
    { owner_id: mim, viewer_id: rob, depth: 'full' }, { owner_id: mim, viewer_id: kate, depth: 'summary' },
    { owner_id: rob, viewer_id: mim, depth: 'summary' }, { owner_id: kate, viewer_id: mim, depth: 'full' },
  ]))
  await must(admin.from('share_links').upsert([{ token: 'seed-mim-summary-link', owner_id: mim, depth: 'summary' }, { token: 'seed-rob-full-link-0001', owner_id: rob, depth: 'full' }]))
  await must(admin.from('display_tokens').upsert([{ token: 'seed-mim-display-0001', owner_id: mim }]))
  await must(admin.from('board_config').upsert({ owner_id: mim, items: [
    { ownerId: mim, show: true, featured: true, avg7: true, avg28: true, last7: true, ops: true, mode: 'both' },
    { ownerId: rob, show: true, featured: false, avg7: true, avg28: true, last7: true, ops: false, mode: 'both' },
    { ownerId: kate, show: true, featured: false, avg7: true, avg28: true, last7: true, ops: true, mode: 'both' },
  ] }))
  console.log(`done. Sign in as any of ${USERS.map((u) => u.email).join(', ')} with the SEED_PASSWORD you set`)
  console.log('display: display.html?key=seed-mim-display-0001   claim as Kate: scoreboard.html?claim=seed-rob-full-link-0001')
}

async function must<T extends { error: { message: string } | null }>(p: PromiseLike<T>): Promise<void> {
  const r = await p
  if (r.error) throw new Error(r.error.message)
}

void (process.argv.includes('--clean') ? clean() : seed()).catch((e) => { console.error(e); process.exit(1) })
