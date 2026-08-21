// Wall display (Q34): pure glass. Opens by token (`?key=`), no sign-in, no controls until the mouse
// moves. The same page is the public page (S12) when opened with `?p=`: one board, no composer links. Tile content centres at every board count (Q27). Swiss modular grid from src/ui/layout; numbers from src/domain/board. Anonymous, so no
// private realtime channel: a 10s poll of display_snapshot keeps it current. Visuals follow docs/design/Scoreboard Display.dc.html.

import '../theme.css'
import { delegate, html, renderInto, when, type Html } from '../ui/render'
import { applyTheme, themeLabel, toggleTheme } from '../ui/theme'
import { arrange, type SizeClass } from '../ui/layout'
import { fetchDisplaySnapshot, fetchPublicSnapshot, type DisplaySnapshot } from '../data/display'
import type { BoardItem, EntryState, IsoDate } from '../domain/model'
import { todayIso } from '../domain/dates'
import { boardStats, inMode } from '../domain/board'
import { formatScore, tone } from '../domain/scoring'

interface State {
  snap: DisplaySnapshot | null
  today: IsoDate
  scale: number
  ctl: boolean
  flash: Record<string, number>   // ownerId → last update ms
  error: string | null
}

const SCALE_KEY = 'wm-display-scale'
const SIZES: Record<SizeClass, Record<string, number>> = {
  xl: { num: 250, kick: 18, label: 22, avg: 44, cell: 20, dow: 13, sq: 64, mk: 40, op: 21, pad: 48, gap: 20 },
  lg: { num: 160, kick: 15, label: 18, avg: 32, cell: 16, dow: 11, sq: 52, mk: 30, op: 17, pad: 36, gap: 14 },
  md: { num: 110, kick: 13, label: 15, avg: 24, cell: 13, dow: 10, sq: 42, mk: 24, op: 14, pad: 28, gap: 12 },
  sm: { num: 74, kick: 11, label: 12, avg: 18, cell: 11, dow: 9, sq: 33, mk: 18, op: 12, pad: 20, gap: 9 },
}

const root = document.getElementById('app')!
const params = new URLSearchParams(location.search)
const token = params.get('key') ?? ''
const publicToken = params.get('p') ?? ''
let stored = 1
try { stored = parseFloat(localStorage.getItem(SCALE_KEY) ?? '1') || 1 } catch { /* private mode */ }
const S: State = { snap: null, today: todayIso(), scale: Math.min(2.2, Math.max(0.6, stored)), ctl: false, flash: {}, error: null }
let ctlTimer: number | undefined

function shown(): { item: BoardItem; board: DisplaySnapshot['boards'][number] }[] {
  if (!S.snap) return []
  const by = new Map(S.snap.boards.map((b) => [b.ownerId, b]))
  const list = S.snap.items.filter((i) => i.show && by.has(i.ownerId)).map((item) => ({ item, board: by.get(item.ownerId)! }))
  // Boards with no config row yet (claimed after the composer was last saved) still show.
  const configured = new Set(list.map((x) => x.item.ownerId))
  for (const b of S.snap.boards) if (!configured.has(b.ownerId) && !S.snap.items.some((i) => i.ownerId === b.ownerId)) list.push({ item: { ownerId: b.ownerId, show: true, featured: false, avg7: true, avg28: true, last7: true, ops: b.ownerId === S.snap.owner.id, mode: 'both' }, board: b })
  const f = list.findIndex((x) => x.item.featured)
  if (f > 0) list.unshift(list.splice(f, 1)[0]!)
  return list
}

function cellStyle(state: EntryState | undefined): string {
  return state ? `` : 'background: transparent; color: var(--color-text); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-text) 25%, transparent);'
}

function view(): Html {
  if (S.error) return html`<div style="height: 100vh; background: var(--color-bg); color: var(--color-text);"><div class="empty"><span class="sq sq-14 sq-accent"></span><h2>Display not available</h2><p>${S.error}</p></div></div>`
  const list = shown()
  const n = list.length
  const featured = n > 0 && list[0]!.item.featured
  const arr = arrange(n, featured)
  const f = Math.max(0.35, Math.min(3, Math.min(window.innerHeight / 1080, window.innerWidth / 1920) * S.scale))
  const sz = (cls: SizeClass, k: string) => Math.max(8, Math.round(SIZES[cls][k]! * f))
  const now = Date.now()

  return html`
    <div style="height: 100vh; background: var(--color-divider); border: 2px solid var(--color-divider); box-sizing: border-box; display: grid; gap: 2px; grid-template-columns: ${arr.cols}; grid-template-rows: ${arr.rows}; cursor: ${S.ctl ? 'default' : 'none'}; user-select: none;">
      ${list.map(({ item, board }, i) => {
        const cls = arr.sizes[i]!, s = (k: string) => sz(cls, k)
        const isMe = board.ownerId === S.snap!.owner.id
        const st = boardStats({ startDate: board.startDate, scores: board.scores, ops: board.ops, entries: board.entries }, S.today)
        const recent = (S.flash[board.ownerId] ?? 0) > now - 5000
        const canOps = item.ops && board.depth === 'full' && st.opsToday
        const opsAll = canOps ? st.opsToday!.filter((o) => inMode(o.state, isMe ? item.mode : 'both')) : []
        const opsCap = cls === 'xl' ? 8 : cls === 'lg' ? 6 : 4
        const opsList = isMe ? opsAll.slice(0, opsCap) : []
        const marks = !isMe && canOps ? opsAll : []
        const mk = (state: EntryState | undefined, size: number, font: number) => html`<span class="${state ? 'st-' + state : ''}" style="width: ${size}px; height: ${size}px; flex: none; display: inline-flex; align-items: center; justify-content: center; font: 800 ${font}px var(--font-heading); ${cellStyle(state)}">${state ?? ''}</span>`
        return html`
          <div style="grid-column: ${arr.spans[i]}; background: var(--color-bg); color: var(--color-text); padding: ${s('pad')}px; display: flex; flex-direction: column; overflow: hidden; outline: ${recent ? '3px solid var(--color-accent)' : 'none'}; outline-offset: -3px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
              <span class="sq sq-10 sq-accent"></span>
              <span style="font: 800 ${s('label')}px var(--font-heading); letter-spacing: 0.14em; text-transform: uppercase;">${board.name}</span>
              <span class="sq sq-accent" style="width: 9px; height: 9px; display: ${recent ? 'inline-block' : 'none'}; animation: livepulse 1.2s infinite;"></span>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 0;">
              <div style="flex: none; text-align: center;">
                <div style="font-size: ${s('kick')}px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-neutral-600);">Today</div>
                <div class="tone-${tone(st.today)}" style="font: 800 ${s('num')}px var(--font-heading); line-height: 0.95; letter-spacing: -0.03em;">${formatScore(st.today)}</div>
              </div>
              ${when(marks.length, () => html`<div style="flex: none; display: flex; gap: 2px; margin-top: ${s('gap')}px; flex-wrap: wrap;">${marks.map((m) => mk(m.state, s('mk'), s('cell')))}</div>`)}
              ${when(opsList.length, () => html`
                <div style="flex: 0 1 auto; min-height: 0; overflow: hidden; margin-top: ${s('gap')}px;">
                  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px;">
                    ${opsList.map((o) => html`<div style="display: flex; align-items: center; gap: 8px; font-size: ${s('op')}px;">${mk(o.state, s('mk'), s('cell'))}<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${o.name}</span></div>`)}
                  </div>
                  ${when(opsAll.length > opsCap, () => html`<div style="font-size: ${s('kick')}px; letter-spacing: 0.08em; color: var(--color-neutral-600); margin-top: 4px; text-align: center;">+ ${opsAll.length - opsCap} MORE</div>`)}
                </div>`)}
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: ${s('gap')}px;">
              ${when(item.avg7 || item.avg28, () => html`
                <div style="display: flex; gap: 32px; align-items: baseline;">
                  ${when(item.avg7, () => html`<div style="display: flex; gap: 10px; align-items: baseline;"><span style="font-size: ${s('kick')}px; letter-spacing: 0.12em; color: var(--color-neutral-600);">7-DAY</span><span class="tone-${tone(st.avg7)}" style="font: 800 ${s('avg')}px var(--font-heading);">${formatScore(st.avg7)}</span></div>`)}
                  ${when(item.avg28, () => html`<div style="display: flex; gap: 10px; align-items: baseline;"><span style="font-size: ${s('kick')}px; letter-spacing: 0.12em; color: var(--color-neutral-600);">28-DAY</span><span class="tone-${tone(st.avg28)}" style="font: 800 ${s('avg')}px var(--font-heading);">${formatScore(st.avg28)}</span></div>`)}
                </div>`)}
              ${when(item.last7, () => html`
                <div style="display: flex; gap: 2px;">
                  ${st.last7.map((d) => html`
                    <div style="width: ${s('sq')}px; padding: 5px 0; background: var(--color-surface); display: flex; flex-direction: column; align-items: center; gap: 1px;">
                      <span style="font-size: ${s('dow')}px; color: var(--color-neutral-500);">${d.dow}</span>
                      <span class="tone-${tone(d.score)}" style="font: 800 ${s('cell')}px var(--font-heading);">${formatScore(d.score)}</span>
                    </div>`)}
                </div>`)}
            </div>
          </div>`
      })}
      ${when(n === 0 && S.snap, () => html`
        <div style="background: var(--color-bg); color: var(--color-text); display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 48px; gap: 8px;">
          <span class="sq sq-14 sq-accent"></span>
          <div style="font: 800 28px var(--font-heading);">Nothing on display</div>
          ${when(!publicToken, () => html`<div style="font-size: 14px; color: var(--color-neutral-600);">Compose your board in the <a href="./scoreboard.html">scoreboard composer</a>.</div>`)}
        </div>`)}
      ${when(!S.snap, () => html`<div style="background: var(--color-bg); color: var(--color-text); display: flex; align-items: center; justify-content: center;"><span class="kicker">Loading…</span></div>`)}
      ${when(S.ctl, () => html`
        <div style="position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 60; display: flex; align-items: center; gap: 2px; background: var(--color-elev); border: 1px solid var(--color-divider); box-shadow: var(--shadow-lg); padding: 4px;">
          <button class="ctl" data-act="scale" data-d="-0.1" title="Smaller" style="width: 40px; font-size: 15px;">A−</button>
          <span style="min-width: 58px; text-align: center; font: 600 12px var(--font-heading); letter-spacing: 0.04em; color: var(--color-neutral-600);">${Math.round(S.scale * 100)}%</span>
          <button class="ctl" data-act="scale" data-d="0.1" title="Bigger" style="width: 40px; font-size: 18px;">A+</button>
          <button class="ctl ctl-text" data-act="scale-reset" title="Reset to 100%">RESET</button>
          <button class="ctl ctl-text" data-act="theme" title="Switch theme">${themeLabel()}</button>
        </div>
        ${when(!publicToken, () => html`<a href="./scoreboard.html" title="Back to the scoreboard composer" style="position: fixed; right: 20px; bottom: 28px; z-index: 60; display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 14px; background: var(--color-elev); border: 1px solid var(--color-divider); box-shadow: var(--shadow-lg); font: 600 11px var(--font-heading); letter-spacing: 0.06em; color: var(--color-neutral-600); text-decoration: none;"><span class="sq sq-8 sq-accent"></span>COMPOSE</a>`)}`)}
    </div>
    <style>
      @keyframes livepulse { 0% { opacity: 1; } 50% { opacity: 0.2; } 100% { opacity: 1; } }
      .ctl { all: unset; box-sizing: border-box; height: 36px; display: inline-flex; align-items: center; justify-content: center; font: 800 15px var(--font-heading); cursor: pointer; color: var(--color-text); }
      .ctl:hover { background: color-mix(in srgb, var(--color-text) 8%, transparent); }
      .ctl-text { padding: 0 12px; font: 600 11px var(--font-heading); letter-spacing: 0.05em; color: var(--color-neutral-600); border-left: 1px solid var(--color-divider); }
    </style>`
}

// ---------------------------------------------------------------- actions

const render = () => renderInto(root, view())

function setScale(v: number): void {
  S.scale = Math.round(Math.min(2.2, Math.max(0.6, v)) * 10) / 10
  try { localStorage.setItem(SCALE_KEY, String(S.scale)) } catch { /* private mode */ }
  render()
}

delegate(root, 'click', {
  scale: (el) => setScale(S.scale + Number(el.dataset.d)),
  'scale-reset': () => setScale(1),
  theme: () => { toggleTheme(); render() },
})

window.addEventListener('mousemove', () => {
  if (!S.ctl) { S.ctl = true; render() }
  window.clearTimeout(ctlTimer)
  ctlTimer = window.setTimeout(() => { S.ctl = false; render() }, 3500)
})
window.addEventListener('keydown', (e) => { if (e.key === '+' || e.key === '=') setScale(S.scale + 0.1); else if (e.key === '-') setScale(S.scale - 0.1) })
window.addEventListener('resize', render)

async function refresh(): Promise<void> {
  try {
    const snap = publicToken ? await fetchPublicSnapshot(publicToken) : await fetchDisplaySnapshot(token)
    const prev = new Map((S.snap?.boards ?? []).map((b) => [b.ownerId, JSON.stringify(b.scores)]))
    const now = Date.now()
    for (const b of snap.boards) if (prev.has(b.ownerId) && prev.get(b.ownerId) !== JSON.stringify(b.scores)) { S.flash[b.ownerId] = now; window.setTimeout(render, 5200) }
    S.snap = snap; S.error = null
  } catch (e) {
    // Supabase errors are plain objects, not Error instances: read .message before falling back to String().
    const msg = String((e as { message?: string } | null)?.message ?? e)
    S.error = !/not found/i.test(msg) ? msg : publicToken ? "This page isn't shared right now - the owner's Public page is Off, or their sharing is paused." : 'This display link is not valid. Open the display from the scoreboard composer.'
  }
  render()
}

// ---------------------------------------------------------------- boot

applyTheme()
render()
if (!token && !publicToken) { S.error = 'No display key. Open the display from the scoreboard composer.'; render() }
else {
  void refresh()
  setInterval(() => void refresh(), 10_000)
  setInterval(() => { const t = todayIso(); if (t !== S.today) { S.today = t; render() } }, 30_000)
}
