// Sharing-controls end-to-end against the LIVE project (S1-S12), using the seeded users.
// Run: `npx vite-node scripts/e2e-sharing.ts` with SEED_PASSWORD in the environment. Leaves the seed state as it found it.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/data/database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const PASSWORD = process.env.SEED_PASSWORD
if (!url || !key || !PASSWORD) { console.error('Need .env (VITE_*) and SEED_PASSWORD.'); process.exit(1) }

const anon = createClient<Database>(url, key, { auth: { persistSession: false } })
async function as(name: 'mim' | 'rob' | 'kate') {
  const c = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: `wm-test-${name}@example.com`, password: PASSWORD! })
  if (error) throw error
  return { c, id: data.user.id }
}

let failed = 0
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failed++
}
const isNotFound = (e: unknown) => /not found/i.test(String((e as { message?: string })?.message ?? e))

const mim = await as('mim'), rob = await as('rob'), kate = await as('kate')
const viewable = async (who: { c: typeof mim.c }, owner: string) => {
  const g = await who.c.from('share_grants').select('depth').eq('owner_id', owner)
  const sc = await who.c.from('daily_scores').select('day').eq('owner_id', owner).limit(1)
  return { grant: g.data?.[0]?.depth ?? null, scores: (sc.data?.length ?? 0) > 0 }
}

// Owner side
const settings = await mim.c.from('sharing_settings').select('*').eq('owner_id', mim.id).single()
check('Mim has sharing settings, public on at summary', settings.data?.public_depth === 'summary' && settings.data.paused === false)
const grants = await mim.c.from('share_grants').select('viewer_id, depth').eq('owner_id', mim.id)
check('Mim sees her two grants (Rob full, Kate summary)', grants.data?.length === 2)
const robGrants = await rob.c.from('share_grants').select('viewer_id, depth').eq('owner_id', rob.id)
check('Rob sees Kate listed at Off (S2)', robGrants.data?.some((g) => g.viewer_id === kate.id && g.depth === 'off') === true)

// Kate cannot see Rob (off)
let v = await viewable(kate, rob.id)
check('Kate (Off) cannot see Rob: no grant row, no scores (S7)', v.grant === null && !v.scores)

// Set Kate off on Mim, then back
let baseline = await viewable(kate, mim.id)
check('Kate sees Mim at summary before revoke', baseline.grant === 'summary' && baseline.scores)
let r = await mim.c.from('share_grants').update({ depth: 'off' }).eq('owner_id', mim.id).eq('viewer_id', kate.id)
check('Owner may set a grant Off (S1)', !r.error, r.error?.message)
v = await viewable(kate, mim.id)
check('After Off: Mim vanishes for Kate', v.grant === null && !v.scores)
r = await mim.c.from('share_grants').update({ depth: 'summary' }).eq('owner_id', mim.id).eq('viewer_id', kate.id)
v = await viewable(kate, mim.id)
check('Restore to Summary is one write and Mim is back', !r.error && v.grant === 'summary' && v.scores)

// Viewer may not change their own depth
r = await kate.c.from('share_grants').update({ depth: 'full' }).eq('owner_id', mim.id).eq('viewer_id', kate.id)
v = await viewable(kate, mim.id)
check('Viewer cannot raise own depth', v.grant === 'summary')

// Pause all
r = await mim.c.from('sharing_settings').update({ paused: true }).eq('owner_id', mim.id)
check('Owner may pause (S9)', !r.error, r.error?.message)
v = await viewable(rob, mim.id)
check('Paused: Rob (full) loses Mim silently (S10)', v.grant === null && !v.scores)
const ops = await rob.c.from('ops').select('id').eq('owner_id', mim.id)
check('Paused: Rob cannot read Mim ops either', (ops.data?.length ?? 0) === 0)
let snapAnon = await anon.rpc('display_snapshot', { p_token: 'seed-mim-display-0001' })
const boards = ((snapAnon.data as { boards?: { id: string }[] } | null)?.boards ?? []).map((b) => b.id)
check("Mim's own display still shows her own board while paused", boards.includes(mim.id))
let pub = await anon.rpc('public_snapshot', { p_token: 'seed-mim-public-000001' })
check('Paused: public page is not found (S12 gated by Pause-all)', !!pub.error && isNotFound(pub.error))
r = await mim.c.from('sharing_settings').update({ paused: false }).eq('owner_id', mim.id)
v = await viewable(rob, mim.id)
check('Unpause: Rob sees Mim at full again', v.grant === 'full' && v.scores)

// Public page depths
pub = await anon.rpc('public_snapshot', { p_token: 'seed-mim-public-000001' })
let pb = (pub.data as { boards: { depth: string; ops: unknown }[]; items: { ops: boolean }[] } | null)
check('Public at summary: one board, no ops', !pub.error && pb?.boards.length === 1 && pb.boards[0]!.depth === 'summary' && pb.boards[0]!.ops === null && pb.items[0]!.ops === false)
await mim.c.from('sharing_settings').update({ public_depth: 'full' }).eq('owner_id', mim.id)
pub = await anon.rpc('public_snapshot', { p_token: 'seed-mim-public-000001' })
pb = pub.data as typeof pb
check('Public at full: ops present', !pub.error && Array.isArray(pb?.boards[0]!.ops) && pb!.items[0]!.ops === true)
await mim.c.from('sharing_settings').update({ public_depth: 'off' }).eq('owner_id', mim.id)
pub = await anon.rpc('public_snapshot', { p_token: 'seed-mim-public-000001' })
check('Public off: not found', !!pub.error && isNotFound(pub.error))
await mim.c.from('sharing_settings').update({ public_depth: 'summary' }).eq('owner_id', mim.id)

// Anon surface
const anonFns = await Promise.all([
  anon.rpc('effective_depth', { p_owner: mim.id, p_viewer: kate.id }),
  anon.rpc('viewer_depth', { p_owner: mim.id }),
  anon.rpc('claim_share', { p_token: 'seed-mim-summary-link' }),
  anon.rpc('board_json', { p_id: mim.id, p_depth: 'full', p_from: '2026-01-01', p_to: '2026-12-31' }),
])
check('Anon cannot call effective_depth / viewer_depth / claim_share / board_json', anonFns.every((x) => !!x.error))
const authBoard = await kate.c.rpc('board_json', { p_id: mim.id, p_depth: 'full', p_from: '2026-01-01', p_to: '2026-12-31' })
check('Authenticated cannot call board_json directly', !!authBoard.error)

// Invite link: claim is summary, never overrides; reset kills the old token
const claim = await kate.c.rpc('claim_share', { p_token: 'seed-mim-summary-link' })
check('Re-claim by an existing viewer leaves depth as the owner set it', !claim.error && claim.data?.[0]?.grant_depth === 'summary')
const claimOff = await kate.c.rpc('claim_share', { p_token: 'seed-rob-full-link-0001' })
check('Claim while Off returns null depth (owner wins, S2)', !claimOff.error && claimOff.data?.[0]?.grant_depth === null)
const fresh = 'e2e-reset-token-' + Math.random().toString(36).slice(2, 8)
r = await mim.c.from('share_links').delete().eq('owner_id', mim.id)
const ins = await mim.c.from('share_links').insert({ token: fresh, owner_id: mim.id })
check('Reset: owner deletes and mints a new link (S3/S11)', !r.error && !ins.error, ins.error?.message)
const old = await kate.c.rpc('claim_share', { p_token: 'seed-mim-summary-link' })
check('Old link stops working', !!old.error && isNotFound(old.error))
v = await viewable(kate, mim.id)
check('Existing grant keeps access after reset', v.grant === 'summary')
await mim.c.from('share_links').delete().eq('owner_id', mim.id)
await mim.c.from('share_links').insert({ token: 'seed-mim-summary-link', owner_id: mim.id })

console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
