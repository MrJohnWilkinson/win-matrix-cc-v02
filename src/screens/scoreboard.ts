// Scoreboard composer (D7): choose whose boards show on the display, what from each, and how they
// share the glass. Also the landing page for share-link claims (Q31, `?claim=`). Visuals follow
// docs/design/Scoreboard.dc.html.

import '../theme.css'
import { delegate, html, renderInto, when, type Html } from '../ui/render'
import { applyTheme, toggleTheme } from '../ui/theme'
import { accountMenuView, navView } from '../ui/nav'
import { arrange, previewNumeral } from '../ui/layout'
import { ensureProfile, requireSession, signOut, updateProfile } from '../data/auth'
import { loadBoardConfig, loadOwn, saveBoardConfig, startDateChanged, type OwnData } from '../data/store'
import { claimShare, loadSharedBoards, type SharedBoard } from '../data/sharing'
import { displayUrl, getOrCreateDisplayToken } from '../data/display'
import { subscribeScores } from '../data/live'
import type { BoardItem, IsoDate, Profile } from '../domain/model'
import { isValidIso, todayIso } from '../domain/dates'
import { boardStats } from '../domain/board'
import { formatScore, tone } from '../domain/scoring'

interface State {
  profile: Profile
  email: string
  own: OwnData
  shared: SharedBoard[]
  items: BoardItem[]
  today: IsoDate
  account: boolean
  notice: string | null
  error: string | null
}

const root = document.getElementById('app')!
let S: State

/** Config rows must cover exactly: my board + every board I have a grant for, in saved order. */
function reconcile(items: BoardItem[], me: string, shared: SharedBoard[]): BoardItem[] {
  const valid = new Set([me, ...shared.map((b) => b.ownerId)])
  const kept = items.filter((i) => valid.has(i.ownerId))
  const have = new Set(kept.map((i) => i.ownerId))
  if (!have.has(me)) kept.unshift({ ownerId: me, show: true, featured: true, avg7: true, avg28: true, last7: true, ops: true, mode: 'both' })
  for (const b of shared) if (!have.has(b.ownerId)) kept.push({ ownerId: b.ownerId, show: true, featured: false, avg7: true, avg28: true, last7: true, ops: false, mode: 'both' })
  return kept
}

function board(ownerId: string): { name: string; depth: string; full: boolean; src: Parameters<typeof boardStats>[0] } | null {
  if (ownerId === S.profile.id) return { name: S.profile.name, depth: 'Your board', full: true, src: { startDate: S.profile.startDate, scores: {}, ops: S.own.ops, entries: S.own.entries } }
  const b = S.shared.find((x) => x.ownerId === ownerId)
  if (!b) return null
  return { name: b.name, depth: b.depth === 'full' ? 'Full grid' : 'Summary', full: b.depth === 'full', src: { startDate: b.startDate, scores: b.scores, ops: b.ops, entries: b.entries } }
}

function shownItems(): BoardItem[] {
  const shown = S.items.filter((i) => i.show && board(i.ownerId))
  const f = shown.findIndex((i) => i.featured)
  if (f > 0) shown.unshift(shown.splice(f, 1)[0]!)
  return shown
}

// ---------------------------------------------------------------- view

function view(): Html {
  const shown = shownItems()
  const featured = shown.length > 0 && shown[0]!.featured
  const arr = arrange(shown.length, featured)
  return html`
    <div style="min-height: 100vh; display: flex; flex-direction: column;">
      ${navView({ page: 'scoreboard', userName: S.profile.name, actions: html`<button class="btn btn-primary" data-act="open-display">Open display</button>` })}
      ${when(S.account, () => accountMenuView({ email: S.email, name: S.profile.name, startDate: S.profile.startDate }))}
      <div style="display: flex; align-items: baseline; gap: 20px; padding: 16px 24px; border-bottom: 2px solid var(--color-divider); flex-wrap: wrap;">
        <h2 style="margin: 0; font-size: 26px;">Compose your display</h2>
        <div style="font-size: 13px; color: var(--color-neutral-700); max-width: 620px; text-wrap: pretty;">The display is glass — no controls, nothing to touch. It updates itself whenever anyone records. You decide here whose boards show, what from each, and how they share the screen.</div>
      </div>
      ${when(S.notice, () => html`<div style="padding: 10px 24px; border-bottom: 1px solid var(--color-divider); font-size: 13px;"><span class="sq sq-8 sq-accent" style="margin-right: 8px;"></span>${S.notice}</div>`)}
      ${when(S.error, () => html`<div class="error" style="padding: 8px 24px;">${S.error}</div>`)}
      <div style="flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(660px, 1fr)); align-items: start;">
        <div style="border-right: 2px solid var(--color-divider); border-bottom: 2px solid var(--color-divider); overflow-x: auto;">
          ${S.items.map((it, i) => rowView(it, i))}
          <div style="padding: 14px 24px; font-size: 12px; color: var(--color-neutral-600); max-width: 480px; text-wrap: pretty;">Each person granted their own depth when they shared — summary boards can't show op detail. Access comes from their share link.</div>
        </div>
        <div style="padding: 24px; position: sticky; top: 0;">
          <div class="kicker" style="margin-bottom: 10px;">Arrangement — ${shown.length} on the glass</div>
          <div style="aspect-ratio: 16 / 9; background: var(--color-divider); border: 2px solid var(--color-divider); display: grid; gap: 2px; grid-template-columns: ${arr.cols}; grid-template-rows: ${arr.rows};">
            ${shown.map((it, i) => { const b = board(it.ownerId)!; const t = boardStats(b.src, S.today).today; return html`
              <div style="grid-column: ${arr.spans[i]}; background: var(--color-bg); padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;">
                <span style="font: 800 9px var(--font-heading); letter-spacing: 0.12em; text-transform: uppercase;">${b.name}</span>
                <span class="tone-${tone(t)}" style="font: 800 ${previewNumeral(shown.length, featured, i)}px var(--font-heading); line-height: 1;">${formatScore(t)}</span>
              </div>` })}
            ${when(shown.length === 0, () => html`<div style="background: var(--color-bg); display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--color-neutral-600);">Nothing selected</div>`)}
          </div>
          <div style="font-size: 12px; color: var(--color-neutral-600); margin-top: 10px; text-wrap: pretty;">One board owns the whole grid; several divide it. Content steps the type scale — it never stretches. The display rebalances live.</div>
        </div>
      </div>
    </div>`
}

function rowView(it: BoardItem, i: number): Html {
  const b = board(it.ownerId)
  if (!b) return html``
  const chip = (k: 'avg7' | 'avg28' | 'last7' | 'ops', lbl: string, ok: boolean) => {
    const on = ok && it[k]
    return html`<button data-act="chip" data-i="${i}" data-k="${k}" title="${ok ? 'Show this element' : `Not shared — ${b.name} granted summary only`}" style="all: unset; box-sizing: border-box; width: 100%; display: inline-flex; justify-content: flex-start; padding: 5px 10px; font: 600 10px var(--font-heading); letter-spacing: 0.06em; cursor: ${ok ? 'pointer' : 'not-allowed'}; border: 1px solid var(--color-divider); background: ${on ? 'var(--color-accent)' : 'transparent'}; color: ${on ? '#ffffff' : 'var(--color-neutral-600)'}; opacity: ${ok ? '1' : '0.35'};">${lbl}</button>`
  }
  const isMe = it.ownerId === S.profile.id
  return html`
    <div style="display: grid; grid-template-columns: 18px 88px 88px 1fr auto; gap: 10px 14px; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--color-divider); opacity: ${it.show ? '1' : '0.5'};">
      <button data-act="show" data-i="${i}" title="Show on display" style="all: unset; box-sizing: border-box; width: 18px; height: 18px; border: 1.5px solid var(--color-divider); background: ${it.show ? 'var(--color-accent)' : 'transparent'}; display: inline-flex; align-items: center; justify-content: center; color: #fff; font: 800 12px var(--font-heading); cursor: pointer;">${it.show ? '✓' : ''}</button>
      <span style="font: 800 15px var(--font-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.name}</span>
      <span style="font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-500);">${b.depth}</span>
      <div style="display: grid; grid-template-columns: repeat(4, 104px); gap: 6px;">
        ${chip('avg7', '7-DAY AVG', true)}${chip('avg28', '28-DAY AVG', true)}${chip('last7', 'LAST 7 DAYS', true)}${chip('ops', 'OP DETAIL', b.full)}
      </div>
      <div style="display: flex; gap: 4px; align-items: center; justify-self: end;">
        <button data-act="feature" data-i="${i}" title="The featured board takes the dominant band of the grid" style="all: unset; box-sizing: border-box; padding: 4px 10px; font: 600 10px var(--font-heading); letter-spacing: 0.06em; cursor: pointer; border: 1px solid ${it.featured ? 'var(--color-accent)' : 'var(--color-divider)'}; color: ${it.featured ? 'var(--color-accent)' : 'var(--color-neutral-600)'};">FEATURE</button>
        <button class="btn btn-icon btn-secondary" style="width: 28px; height: 28px;" data-act="move" data-i="${i}" data-dir="-1" title="Move up">↑</button>
        <button class="btn btn-icon btn-secondary" style="width: 28px; height: 28px;" data-act="move" data-i="${i}" data-dir="1" title="Move down">↓</button>
      </div>
      ${when(isMe && it.show && it.ops, () => html`
        <div style="grid-column: 2 / 4; align-self: center;"><span style="font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-500);">Your ops panel shows</span></div>
        <div style="grid-column: 4 / 5; display: grid; grid-template-columns: repeat(4, 104px); gap: 6px;">
          ${(['not-done', 'done', 'both'] as const).map((m) => html`
            <button data-act="mode" data-i="${i}" data-mode="${m}" style="all: unset; box-sizing: border-box; width: 100%; display: inline-flex; justify-content: flex-start; padding: 5px 10px; font: 600 10px var(--font-heading); letter-spacing: 0.06em; cursor: pointer; border: 1px solid var(--color-divider); background: ${it.mode === m ? 'var(--color-accent)' : 'transparent'}; color: ${it.mode === m ? '#ffffff' : 'var(--color-neutral-600)'};">${m.replace('-', ' ').toUpperCase()}</button>`)}
        </div>`)}
    </div>`
}

// ---------------------------------------------------------------- actions

const render = () => renderInto(root, view())

function mutate(fn: (items: BoardItem[]) => void): void {
  const items = S.items.map((i) => ({ ...i }))
  fn(items)
  S.items = items
  render()
  void saveBoardConfig(S.profile.id, items).catch((e) => { S.error = String(e?.message ?? e); render() })
}

async function run(fn: () => Promise<void>): Promise<void> {
  try { S.error = null; await fn() } catch (e) { S.error = e instanceof Error ? e.message : String(e) }
  render()
}

delegate(root, 'click', {
  theme: () => { toggleTheme(); render() },
  account: () => { S.account = !S.account; render() },
  'account-close': () => { S.account = false; render() },
  logout: () => void signOut().then(() => location.replace('./index.html')),
  'open-display': () => void run(async () => { const t = await getOrCreateDisplayToken(S.profile.id); window.open(displayUrl(t), '_blank', 'noopener') }),
  show: (el) => mutate((a) => { const it = a[Number(el.dataset.i)]!; it.show = !it.show }),
  chip: (el) => {
    const i = Number(el.dataset.i), k = el.dataset.k as 'avg7' | 'avg28' | 'last7' | 'ops'
    const b = board(S.items[i]!.ownerId)
    if (k === 'ops' && !b?.full) return
    mutate((a) => { a[i]![k] = !a[i]![k] })
  },
  feature: (el) => mutate((a) => { const i = Number(el.dataset.i), was = a[i]!.featured; a.forEach((x) => { x.featured = false }); a[i]!.featured = !was }),
  move: (el) => mutate((a) => { const i = Number(el.dataset.i), j = i + Number(el.dataset.dir); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j]!, a[i]!] }),
  mode: (el) => mutate((a) => { a[Number(el.dataset.i)]!.mode = el.dataset.mode as BoardItem['mode'] }),
})

delegate(root, 'change', {
  'rename-user': (el) => void run(async () => { const name = (el as HTMLInputElement).value.trim() || S.profile.name; S.profile.name = name; await updateProfile(S.profile.id, { name }) }),
  'set-start': (el) => void run(async () => {
    const v = (el as HTMLInputElement).value
    if (!isValidIso(v) || v === S.profile.startDate) return
    const old = S.profile.startDate
    S.profile.startDate = v
    await updateProfile(S.profile.id, { startDate: v })
    await startDateChanged(S.profile.id, S.own, old, v)
  }),
})

setInterval(() => { const t = todayIso(); if (t !== S.today) { S.today = t; render() } }, 30_000)

// ---------------------------------------------------------------- boot

applyTheme()
root.innerHTML = '<div class="empty"><div class="kicker">Loading…</div></div>'
void (async () => {
  const session = await requireSession()
  const profile = await ensureProfile(session)
  let notice: string | null = null
  const claim = new URLSearchParams(location.search).get('claim')
  if (claim) {
    try {
      const g = await claimShare(claim)
      notice = `${g.ownerName} shared their ${g.depth === 'full' ? 'full grid' : 'summary scores'} with you. Their board is on your list.`
    } catch (e) {
      notice = /not found/i.test(String(e)) ? 'That share link is not valid.' : /own share/i.test(String(e)) ? 'That is your own share link.' : `Could not claim the link: ${String((e as Error).message ?? e)}`
    }
    history.replaceState(null, '', location.pathname) // the claim is done; do not re-claim on reload
  }
  const [own, shared, saved] = await Promise.all([loadOwn(profile.id), loadSharedBoards(profile.id), loadBoardConfig(profile.id)])
  S = { profile, email: session.user.email ?? '', own, shared, items: [], today: todayIso(), account: false, notice, error: null }
  S.items = reconcile(saved, profile.id, shared)
  if (JSON.stringify(S.items) !== JSON.stringify(saved)) void saveBoardConfig(profile.id, S.items)
  render()
  // Live: the preview's numbers follow other people's writes.
  subscribeScores(shared.map((b) => b.ownerId), (e) => { const b = S.shared.find((x) => x.ownerId === e.ownerId); if (b) { b.scores[e.day] = e.score; render() } })
})().catch((e) => { root.innerHTML = `<div class="empty"><h2>Could not load</h2><p class="error">${String(e?.message ?? e)}</p></div>` })
