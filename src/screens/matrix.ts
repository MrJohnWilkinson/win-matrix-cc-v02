// The Matrix: daily entry + op management. Visuals follow docs/design/Win Matrix.dc.html; every number
// comes from src/domain/scoring (R1); every write goes through src/data/store (R2).

import '../theme.css'
import { clampToViewport, delegate, html, renderInto, when, type Html } from '../ui/render'
import { applyTheme, toggleTheme } from '../ui/theme'
import { accountMenuView, navView } from '../ui/nav'
import { ensureProfile, requireSession, signOut, updateProfile } from '../data/auth'
import { addOp, deleteOp, loadOwn, repairRecent, reorderOps, setEntry, startDateChanged, updateOp, type OwnData } from '../data/store'
import { ensureSharingSettings, getOrCreateInviteLink, loadGrantsForOwner, publicUrl, resetInviteLink, setGrantDepth, setPaused, setPublicDepth, shareUrl, type OwnerGrant, type SharingSettings } from '../data/sharing'
import type { EntryState, GrantDepth, IsoDate, Op, Profile } from '../domain/model'
import { addDays, dayOfWeek, isValidIso, isWeekend, todayIso } from '../domain/dates'
import { archiveFrom, archivesInFuture, isArchivedOn, restoreFrom } from '../domain/archive'
import { dailyScore, formatScore, isActiveOn, nextState, opAverage, overallAverage, tone, windowDates, windowReady } from '../domain/scoring'

type Win = 'r1' | 'r7' | 'r28'
// Non-semantic tag palette (A5): 9 muted hues, never W-green, C-amber, Bye-teal or accent red.
const SWATCHES = ['#339af0', '#3b5bdb', '#7048e8', '#9c36b5', '#d6336c', '#f783ac', '#a5673f', '#6c757d', 'var(--color-text)']
const HDR = 132, AVGH = 34
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STATE_NAME: Record<EntryState, string> = { W: 'WIN', C: 'CHANGE — make it easier or remove it', B: 'BYE — not required' }

interface State {
  profile: Profile
  email: string
  data: OwnData
  win: Win
  today: IsoDate
  account: boolean
  menu: { id: string; x: number; y: number } | null
  add: { name: string; note: string; colour: string } | null
  arch: { id: string; mode: 'archive' | 'restore'; date: IsoDate } | null
  del: string | null
  share: { settings: SharingSettings | null; link: string | null; grants: OwnerGrant[]; copied: boolean; copiedPub: boolean } | null
  error: string | null
}

const root = document.getElementById('app')!
let S: State
let paint: { state: EntryState | undefined; future: boolean } | null = null

// ---------------------------------------------------------------- derived helpers

const start = () => S.profile.startDate
/** Columns: active today, or archived from a future date (still a live column, on notice). */
const columnOps = () => S.data.ops.filter((o) => isActiveOn(o, S.today, start()) || archivesInFuture(o, S.today) !== null)
const archivedNow = () => S.data.ops.filter((o) => isArchivedOn(o, S.today))

function visibleDates(): IsoDate[] {
  const n = S.win === 'r1' ? 1 : S.win === 'r7' ? 7 : 28
  const dates: IsoDate[] = []
  for (let i = n - 1; i >= 0; i--) { const d = addDays(S.today, -i); if (d >= start()) dates.push(d) }
  if (S.win !== 'r1') dates.push(addDays(S.today, 1), addDays(S.today, 2)) // two dimmed rows for planned Byes
  return dates
}

function label(iso: IsoDate): string { const [, m, d] = iso.split('-'); return `${Number(d)} ${MON[Number(m) - 1]}` }

// ---------------------------------------------------------------- view

function view(): Html {
  const ops = columnOps()
  const t = dailyScore(S.data.ops, S.data.entries, S.today, start())
  const a7 = overallAverage(S.data.ops, S.data.entries, 7, S.today, start())
  const a28 = overallAverage(S.data.ops, S.data.entries, 28, S.today, start())
  const gridCols = `150px 90px repeat(${ops.length}, 46px)`
  const stat = (k: string, v: number | null) => html`
    <div style="padding: 20px 24px; ${k === 'Today' ? '' : 'border-left: 1px solid var(--color-divider);'}">
      <div class="kicker">${k}</div>
      <div class="tone-${tone(v)}" style="font: 800 44px var(--font-heading); letter-spacing: -0.02em;">${formatScore(v)}</div>
    </div>`

  return html`
    <div style="height: 100vh; display: flex; flex-direction: column;">
      ${navView({ page: 'matrix', userName: S.profile.name, actions: html`
        <button class="btn btn-secondary" data-act="open-add">+ Add op</button>
        <button class="btn btn-primary" data-act="open-share">Share score</button>` })}
      ${when(S.account, () => accountMenuView({ email: S.email, name: S.profile.name, startDate: S.profile.startDate }))}

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1.6fr; border-bottom: 2px solid var(--color-divider);">
        ${stat('Today', t)}${stat('7-day avg', a7)}${stat('28-day avg', a28)}
        <div style="padding: 20px 24px; border-left: 1px solid var(--color-divider); display: flex; flex-direction: column; justify-content: center; gap: 4px;">
          <div class="kicker kicker-accent">The 85 rule</div>
          <div style="font-size: 13px; line-height: 1.45; max-width: 420px; text-wrap: pretty;">Keep every op at 85 or better. If one slips under, make it easier or remove it. Focus on the wins.</div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 20px; padding: 12px 24px; border-bottom: 1px solid var(--color-divider); flex-wrap: wrap;">
        <div style="display: inline-flex; border: 1px solid var(--color-divider);">
          ${(['r1', 'r7', 'r28'] as Win[]).map((w) => html`
            <button data-act="win" data-win="${w}" style="all: unset; box-sizing: border-box; padding: 8px 14px; font: 600 12px var(--font-heading); letter-spacing: 0.05em; cursor: pointer; border-right: 1px solid var(--color-divider); background: ${w === S.win ? 'var(--color-text)' : 'transparent'}; color: ${w === S.win ? 'var(--color-bg)' : 'var(--color-text)'};">${w === 'r1' ? 'TODAY' : w === 'r7' ? 'ROLL 7' : 'ROLL 28'}</button>`)}
        </div>
        <div style="display: flex; align-items: center; gap: 14px; font-size: 11px; letter-spacing: 0.04em;">
          <span style="display: inline-flex; align-items: center; gap: 6px;" title="Win — you did it"><span class="sq sq-12 st-W"></span>W WIN</span>
          <span style="display: inline-flex; align-items: center; gap: 6px;" title="Change — not done: make it easier or remove it"><span class="sq sq-12 st-C"></span>C CHANGE</span>
          <span style="display: inline-flex; align-items: center; gap: 6px;" title="Bye — not required today"><span class="sq sq-12 st-B"></span>B BYE</span>
        </div>
        <div style="margin-left: auto; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-neutral-600);">Click to cycle · Drag to paint a run</div>
      </div>

      ${when(S.error, () => html`<div class="error" style="padding: 8px 24px;">${S.error}</div>`)}

      ${when(ops.length === 0, () => html`
        <div class="empty">
          <span class="sq sq-14 sq-accent"></span>
          <h2>Add your first op</h2>
          <p>An op is anything you want to do most days. Start it easy — you can make it harder once it holds 85.</p>
          <button class="btn btn-primary" style="margin-top: 8px;" data-act="open-add">+ Add op</button>
        </div>`)}

      ${when(ops.length > 0, () => gridView(ops, gridCols, a7, a28))}
      ${when(S.menu, () => menuView())}
      ${when(S.arch, () => archView())}
      ${when(S.del, () => delView())}
      ${when(S.share, () => shareView())}
      ${when(S.add, () => addView())}
    </div>`
}

function gridView(ops: Op[], gridCols: string, a7: number | null, a28: number | null): Html {
  const avgRow = (lbl: string, len: number, total: number | null, rule: string, top: number) => html`
    <div style="display: grid; grid-template-columns: ${gridCols}; align-items: stretch; height: ${AVGH}px; background: var(--color-surface); border-bottom: ${rule}; position: sticky; top: ${top}px; z-index: 4;">
      <div style="display: flex; align-items: center; padding-left: 10px; font: 600 12px var(--font-heading); letter-spacing: 0.03em;">${lbl}</div>
      <div class="tone-${tone(total)}" style="display: flex; align-items: center; justify-content: flex-end; padding-right: 12px; font: 800 14px var(--font-heading);">${formatScore(total)}</div>
      ${ops.map((op) => { const v = windowReady(len, S.today, start()) ? opAverage(op, S.data.entries, len, S.today, start()) : null; return html`
        <div class="tone-${tone(v)}" style="display: flex; align-items: center; justify-content: center; border-left: 1px solid var(--grid-line); font: 800 13px var(--font-heading);">${formatScore(v)}</div>` })}
    </div>`

  return html`
    <div style="flex: 1; min-height: 0; overflow: auto; padding: 0 24px 32px;" data-scroll="grid">
      <div style="display: grid; grid-template-columns: ${gridCols}; position: sticky; top: 0; z-index: 5; background: var(--color-bg); border-bottom: 2px solid var(--color-divider); align-items: end;">
        <div class="kicker" style="padding: 8px 12px 10px 10px; letter-spacing: 0.1em;">Day</div>
        <div class="kicker" style="padding: 8px 12px 10px 0; letter-spacing: 0.1em; text-align: right;">Score</div>
        ${ops.map((op) => html`
          <button data-act="op-menu" data-id="${op.id}" title="Edit this op${op.note ? ' · ' + op.note : ''}${archivesInFuture(op, S.today) ? ' · archives ' + label(archivesInFuture(op, S.today)!) : ''}" style="all: unset; box-sizing: border-box; height: 130px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 8px; padding: 8px 0 10px; cursor: pointer; border-left: 1px solid var(--grid-line-strong);">
            <span style="writing-mode: vertical-rl; transform: rotate(180deg); font: 600 12px var(--font-heading); letter-spacing: 0.02em; white-space: nowrap; max-height: 86px; overflow: hidden;">${op.name}</span>
            <span class="sq sq-8" style="background: ${op.colour};"></span>
          </button>`)}
      </div>
      ${avgRow('7-day avg', 7, a7, '1px solid var(--row-line)', HDR)}
      ${avgRow('28-day avg', 28, a28, '2px solid var(--color-divider)', HDR + AVGH + 1)}
      ${visibleDates().map((iso) => rowView(iso, ops, gridCols))}
      ${when(archivedNow().length, () => html`
        <div style="display: flex; align-items: center; gap: 12px; padding: 14px 0; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-neutral-600); flex-wrap: wrap;">
          Archived:
          ${archivedNow().map((o) => html`<button class="btn btn-ghost" style="font-size: 11px;" data-act="open-restore" data-id="${o.id}">${o.name} — restore</button>`)}
        </div>`)}
    </div>`
}

function rowView(iso: IsoDate, ops: Op[], gridCols: string): Html {
  const isToday = iso === S.today, future = iso > S.today, wknd = isWeekend(iso)
  const sc = future ? null : dailyScore(S.data.ops, S.data.entries, iso, start())
  return html`
    <div style="display: grid; grid-template-columns: ${gridCols}; align-items: stretch; height: 36px; background: ${isToday ? 'var(--tint-today)' : wknd ? 'var(--color-surface)' : 'transparent'}; box-shadow: ${isToday ? 'inset 3px 0 0 var(--color-accent)' : 'none'}; opacity: ${future ? '0.55' : '1'}; border-bottom: 1px solid var(--row-line);">
      <div style="display: flex; align-items: center; gap: 8px; padding: 0 12px 0 10px; font-size: 12px;">
        <span style="width: 34px; font-weight: 800; font-family: var(--font-heading); color: ${isToday ? 'var(--color-accent)' : wknd ? 'var(--color-neutral-500)' : 'var(--color-text)'};">${DOW[dayOfWeek(iso)]}</span>
        <span style="color: var(--color-neutral-700);">${label(iso)}</span>
        <span style="font: 800 9px var(--font-heading); letter-spacing: 0.08em; color: var(--color-accent);">${isToday ? 'TODAY' : future ? 'PLAN' : ''}</span>
      </div>
      <div class="tone-${tone(sc)}" style="display: flex; align-items: center; justify-content: flex-end; padding-right: 12px; font: 800 14px var(--font-heading);">${future ? '' : formatScore(sc)}</div>
      ${ops.map((op) => {
        const active = isActiveOn(op, iso, start())
        const cur = active ? S.data.entries[iso]?.[op.id] : undefined
        const title = `${op.name}${op.note ? ` (${op.note})` : ''} · ${label(iso)}${!active ? ' — not active this day' : cur ? ' — ' + STATE_NAME[cur] : future ? ' — click to plan a Bye' : ' — untracked'}`
        return html`
          <div style="padding: 3px; border-left: 1px solid var(--grid-line);">
            <button data-act="cell" data-iso="${iso}" data-id="${op.id}" data-active="${active ? '1' : ''}" data-future="${future ? '1' : ''}" title="${title}" class="${cur ? 'st-' + cur : ''}" style="all: unset; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font: 800 12px var(--font-heading); cursor: ${active ? 'pointer' : 'default'}; user-select: none; ${cur ? `background: var(--st-${cur === 'W' ? 'win' : cur === 'C' ? 'change' : 'bye'}); color: var(--st-${cur === 'W' ? 'win' : cur === 'C' ? 'change' : 'bye'}-fg);` : `color: ${active ? 'var(--color-text)' : 'var(--color-neutral-500)'}; box-shadow: ${active ? 'inset 0 0 0 1px color-mix(in srgb, var(--color-text) 15%, transparent)' : 'none'};`} opacity: ${active ? '1' : '0.4'};">${active ? (cur ?? '') : '·'}</button>
          </div>`
      })}
    </div>`
}

function swatches(selected: string, act: string): Html {
  return html`<div class="swatches">${SWATCHES.map((c) => html`<button class="swatch" data-act="${act}" data-colour="${c}" aria-pressed="${c === selected}" style="background: ${c};" title="Colour tag"></button>`)}</div>`
}

function menuView(): Html {
  const op = S.data.ops.find((o) => o.id === S.menu!.id)
  if (!op) return html``
  return html`
    <div class="scrim" data-act="close-menu"></div>
    <div class="popover" style="left: ${S.menu!.x}px; top: ${S.menu!.y}px;">
      <div class="field"><label>Op name</label><input class="input" data-act="rename-op" data-key="rename-op" value="${op.name}" maxlength="80"></div>
      <div class="field"><label>Note — targets, days, e.g. "mwf" or "10 min"</label><input class="input" data-act="note-op" data-key="note-op" value="${op.note}" placeholder="Optional"></div>
      <div><div class="swatch-label">Colour tag</div>${swatches(op.colour, 'colour-op')}</div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary" style="flex: 1;" data-act="move" data-dir="-1">◀ Move</button>
        <button class="btn btn-secondary" style="flex: 1;" data-act="move" data-dir="1">Move ▶</button>
      </div>
      <div style="display: flex; gap: 8px; border-top: 1px solid var(--color-divider); padding-top: 12px;">
        <button class="btn btn-secondary" style="flex: 1;" data-act="open-archive">Archive…</button>
        <button class="btn btn-ghost" style="flex: 1;" data-act="open-delete">Delete…</button>
      </div>
    </div>`
}

function archView(): Html {
  const a = S.arch!, op = S.data.ops.find((o) => o.id === a.id)
  if (!op) return html``
  const archive = a.mode === 'archive'
  return html`
    <div class="dialog-backdrop" data-act="close-arch">
      <div class="dialog">
        <div class="dialog-title">${archive ? 'Archive' : 'Restore'} ${op.name}</div>
        <div class="dialog-body">${archive ? 'Pick any date — past or future.' : 'Pick the date it comes back.'} Scores respect the dates — history before the change stays counted.</div>
        <div class="field"><label>Effective from</label><input class="input" type="date" data-act="arch-date" data-key="arch-date" value="${a.date}"></div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" data-act="close-arch">Cancel</button>
          <button class="btn btn-primary" data-act="confirm-arch">${archive ? 'Archive' : 'Restore'}</button>
        </div>
      </div>
    </div>`
}

function delView(): Html {
  const op = S.data.ops.find((o) => o.id === S.del)
  if (!op) return html``
  return html`
    <div class="dialog-backdrop" data-act="close-del">
      <div class="dialog">
        <div class="dialog-title">Delete ${op.name}?</div>
        <div class="dialog-body">Deleting removes the op and its whole history, and past scores recompute. Archiving keeps history — usually the better move.</div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" data-act="close-del">Cancel</button>
          <button class="btn btn-primary" data-act="confirm-del">Delete op</button>
        </div>
      </div>
    </div>`
}

function shareView(): Html {
  const sh = S.share!
  const st = sh.settings
  const seg = (act: string, cur: string, keys: readonly (readonly [string, string])[], viewer = '') => html`
    <div class="seg">${keys.map(([k, lbl]) => html`<button class="seg-btn ${k === cur ? (k === 'off' ? 'seg-on-muted' : k === 'live' ? 'seg-on-ink' : 'seg-on') : ''}" data-act="${act}" data-v="${k}" data-viewer="${viewer}">${lbl}</button>`)}</div>`
  const DEPTHS = [['off', 'OFF'], ['summary', 'SUMMARY'], ['full', 'FULL']] as const
  const joined = (iso: string) => { const [, m, d] = iso.slice(0, 10).split('-'); return `Joined ${Number(d)} ${MON[Number(m) - 1]}` }
  const row = (name: string, sub: string, dim: boolean, copy: Html, control: Html) => html`
    <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-divider);">
      <div style="flex: 1; min-width: 0; opacity: ${dim ? '0.5' : '1'};">
        <div style="font: 700 13px var(--font-heading);">${name}</div>
        <div style="font-size: 11px; color: var(--color-neutral-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sub}</div>
      </div>
      ${copy}${control}
    </div>`
  return html`
    <div class="dialog-backdrop" data-act="close-share">
      <div class="dialog" style="width: min(640px, 100%); max-height: calc(100vh - 64px); overflow: auto;">
        <div class="dialog-title">Sharing</div>
        ${when(!st, () => html`<div class="kicker">Loading…</div>`)}
        ${when(st, () => { const p = st!.paused, pub = st!.publicDepth, pubUrl = publicUrl(st!.publicToken); return html`
          <div style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border: 2px solid ${p ? 'var(--color-accent)' : 'var(--color-divider)'};">
            <div style="flex: 1; min-width: 0;">
              <div style="font: 800 13px var(--font-heading);">${p ? 'Sharing is paused' : 'Pause all sharing'}</div>
              <div style="font-size: 12px; color: var(--color-neutral-700); text-wrap: pretty;">${p ? 'Nobody can see your board right now - it simply disappears from their scoreboards. Everything below is kept.' : 'Go dark for everyone at once. Your list below is kept exactly as it is.'}</div>
            </div>
            ${seg('share-pause', p ? 'paused' : 'live', [['live', 'LIVE'], ['paused', 'PAUSED']])}
          </div>
          <div>
            <div class="kicker" style="margin-bottom: 8px;">Invite link</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input class="input" readonly value="${sh.link ?? 'Preparing link…'}" style="flex: 1;">
              <button class="btn btn-primary" data-act="copy-link" ${sh.link ? '' : 'disabled'}>${sh.copied ? 'Copied' : 'Copy link'}</button>
              <button class="btn btn-secondary" data-act="reset-link" title="New link - the old one stops working">Reset</button>
            </div>
            <ul style="margin: 10px 0 0; padding-left: 16px; font-size: 12px; line-height: 1.6; color: var(--color-neutral-700);">
              <li>Anyone with this link signs in and joins your list below, at Summary.</li>
              <li>Reset makes a new link - the old one stops working.</li>
              <li>People already on your list keep access - set them Off below.</li>
            </ul>
          </div>
          <div style="opacity: ${p ? '0.45' : '1'};">
            <div class="kicker" style="padding-bottom: 8px; border-bottom: 2px solid var(--color-divider);">Who sees your board</div>
            ${row('Public page', pub === 'off' ? 'Anyone with the link - no sign-in needed' : pubUrl, pub === 'off',
              when(pub !== 'off', () => html`<button class="btn btn-ghost" style="flex: none;" data-act="copy-public">${sh.copiedPub ? 'Copied' : 'Copy'}</button>`),
              seg('public-depth', pub, DEPTHS))}
            ${sh.grants.map((g) => row(g.viewerName, joined(g.createdAt), g.depth === 'off', html``, seg('grant-depth', g.depth, DEPTHS, g.viewerId)))}
            ${when(!sh.grants.length, () => html`<div style="padding: 10px 0; font-size: 12px; color: var(--color-neutral-600);">Nobody yet. Send the invite link above.</div>`)}
          </div>` })}
        <div class="dialog-actions"><button class="btn btn-secondary" data-act="close-share">Done</button></div>
      </div>
    </div>`
}

function addView(): Html {
  const a = S.add!
  return html`
    <div class="dialog-backdrop" data-act="close-add">
      <form class="dialog" data-act="submit-add">
        <div class="dialog-title">New op</div>
        <div class="dialog-body">Start it easy. You can make it harder once it holds 85.</div>
        <div class="field"><label>Op name</label><input class="input" name="name" data-key="add-name" value="${a.name}" placeholder="e.g. Walk 10 min" maxlength="80" required autofocus></div>
        <div class="field"><label>Note — optional</label><input class="input" name="note" data-key="add-note" value="${a.note}" placeholder="e.g. mwf"></div>
        <div><div class="swatch-label">Colour tag</div>${swatches(a.colour, 'colour-add')}</div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" type="button" data-act="close-add">Cancel</button>
          <button class="btn btn-primary" type="submit">Add it</button>
        </div>
      </form>
    </div>`
}

// ---------------------------------------------------------------- actions

const render = () => renderInto(root, view())
const scrollToToday = () => { const el = root.querySelector<HTMLElement>('[data-scroll="grid"]'); if (el) el.scrollTop = el.scrollHeight }

async function run(fn: () => Promise<void>): Promise<void> {
  try { S.error = null; await fn() } catch (e) { S.error = e instanceof Error ? e.message : String(e) }
  render()
}

function readAddForm(): void {
  const f = root.querySelector<HTMLFormElement>('form[data-act="submit-add"]')
  if (!f || !S.add) return
  S.add.name = (f.elements.namedItem('name') as HTMLInputElement).value
  S.add.note = (f.elements.namedItem('note') as HTMLInputElement).value
}

function applyCell(iso: IsoDate, opId: string, state: EntryState | undefined): void {
  // Optimistic: update local data and re-render, then persist. Errors surface in the banner.
  const day = (S.data.entries[iso] ??= {})
  if (state) day[opId] = state; else delete day[opId]
  render()
  void setEntry(S.profile.id, S.data, start(), opId, iso, state).catch((e) => { S.error = String(e?.message ?? e); render() })
}

delegate(root, 'click', {
  theme: () => { toggleTheme(); render() },
  account: () => { S.account = !S.account; render() },
  'account-close': () => { S.account = false; render() },
  logout: () => void signOut().then(() => location.replace('./index.html')),
  win: (el) => { S.win = el.dataset.win as Win; render(); scrollToToday() },
  'open-add': () => { S.add = { name: '', note: '', colour: SWATCHES[1]! }; S.account = false; render() },
  'close-add': () => { S.add = null; render() },
  'colour-add': (el) => { readAddForm(); S.add!.colour = el.dataset.colour!; render() },
  'op-menu': (el, ev) => {
    const me = ev as MouseEvent
    const { x, y } = clampToViewport(me.clientX - 40, me.clientY + 12, 300, 420)
    S.menu = { id: el.dataset.id!, x, y }; render()
  },
  'close-menu': () => { S.menu = null; render() },
  'colour-op': (el) => void run(() => updateOp(S.profile.id, S.data, start(), S.menu!.id, { colour: el.dataset.colour! })),
  move: (el) => void run(async () => {
    const ops = columnOps(), i = ops.findIndex((o) => o.id === S.menu!.id), j = i + Number(el.dataset.dir)
    if (i < 0 || j < 0 || j >= ops.length) return
    await reorderOps(S.data, ops[i]!, ops[j]!)
  }),
  'open-archive': () => { S.arch = { id: S.menu!.id, mode: 'archive', date: S.today }; S.menu = null; render() },
  'open-restore': (el) => { S.arch = { id: el.dataset.id!, mode: 'restore', date: S.today }; render() },
  'close-arch': () => { S.arch = null; render() },
  'confirm-arch': () => void run(async () => {
    const a = S.arch!, op = S.data.ops.find((o) => o.id === a.id)
    if (!op || !isValidIso(a.date)) return
    const archive = a.mode === 'archive' ? archiveFrom(op.archive, a.date) : restoreFrom(op.archive, a.date)
    S.arch = null
    await updateOp(S.profile.id, S.data, start(), op.id, { archive })
  }),
  'open-delete': () => { S.del = S.menu!.id; S.menu = null; render() },
  'close-del': () => { S.del = null; render() },
  'confirm-del': () => void run(async () => { const id = S.del!; S.del = null; await deleteOp(S.profile.id, S.data, start(), id) }),
  'open-share': () => {
    S.share = { settings: null, link: null, grants: [], copied: false, copiedPub: false }; S.account = false; render()
    void loadShare()
  },
  'close-share': () => { S.share = null; render() },
  'copy-link': () => { if (!S.share?.link) return; void navigator.clipboard?.writeText(S.share.link); S.share.copied = true; render() },
  'copy-public': () => { if (!S.share?.settings) return; void navigator.clipboard?.writeText(publicUrl(S.share.settings.publicToken)); S.share.copiedPub = true; render() },
  'reset-link': () => void run(async () => { const t = await resetInviteLink(S.profile.id); if (S.share) { S.share.link = shareUrl(t); S.share.copied = false } }),
  'share-pause': (el) => void run(async () => { const paused = el.dataset.v === 'paused'; if (S.share?.settings) S.share.settings.paused = paused; await setPaused(S.profile.id, paused) }),
  'public-depth': (el) => void run(async () => { const d = el.dataset.v as GrantDepth; if (S.share?.settings) { S.share.settings.publicDepth = d; S.share.copiedPub = false } await setPublicDepth(S.profile.id, d) }),
  'grant-depth': (el) => void run(async () => {
    const d = el.dataset.v as GrantDepth, viewer = el.dataset.viewer!
    const g = S.share?.grants.find((x) => x.viewerId === viewer)
    if (g) g.depth = d
    await setGrantDepth(S.profile.id, viewer, d)
  }),
})

/** Everything the Sharing dialog shows, fetched together on open. */
async function loadShare(): Promise<void> {
  try {
    const [settings, token, grants] = await Promise.all([ensureSharingSettings(S.profile.id), getOrCreateInviteLink(S.profile.id), loadGrantsForOwner(S.profile.id)])
    if (S.share) { S.share.settings = settings; S.share.link = shareUrl(token); S.share.grants = grants; render() }
  } catch (e) { S.error = e instanceof Error ? e.message : String(e); render() }
}

delegate(root, 'change', {
  'rename-user': (el) => void run(async () => { const name = (el as HTMLInputElement).value.trim() || S.profile.name; S.profile.name = name; await updateProfile(S.profile.id, { name }) }),
  'set-start': (el) => void run(async () => {
    const v = (el as HTMLInputElement).value
    if (!isValidIso(v) || v === S.profile.startDate) return
    const old = S.profile.startDate
    S.profile.startDate = v
    await updateProfile(S.profile.id, { startDate: v })
    await startDateChanged(S.profile.id, S.data, old, v)
  }),
  'rename-op': (el) => void run(() => updateOp(S.profile.id, S.data, start(), S.menu!.id, { name: (el as HTMLInputElement).value.trim() || 'Untitled' })),
  'note-op': (el) => void run(() => updateOp(S.profile.id, S.data, start(), S.menu!.id, { note: (el as HTMLInputElement).value.trim() })),
  'arch-date': (el) => { if (S.arch) S.arch.date = (el as HTMLInputElement).value },
})

delegate(root, 'submit', {
  'submit-add': (_, ev) => { ev.preventDefault(); readAddForm(); void run(async () => {
    const a = S.add!; const name = a.name.trim(); if (!name) return
    S.add = null
    await addOp(S.profile.id, S.data, start(), { name, note: a.note.trim(), colour: a.colour })
  }) },
})

// Click cycles; mousedown + mouseover paints a run of the same state (future rows paint Byes only).
delegate(root, 'mousedown', {
  cell: (el, ev) => {
    if (!el.dataset.active) return
    ev.preventDefault()
    const iso = el.dataset.iso!, id = el.dataset.id!, future = !!el.dataset.future
    const next = nextState(S.data.entries[iso]?.[id], future)
    paint = { state: next, future }
    applyCell(iso, id, next)
  },
})
delegate(root, 'mouseover', {
  cell: (el) => {
    if (!paint || !el.dataset.active || !!el.dataset.future !== paint.future) return
    const iso = el.dataset.iso!, id = el.dataset.id!
    if (S.data.entries[iso]?.[id] === paint.state) return
    applyCell(iso, id, paint.state)
  },
})
window.addEventListener('mouseup', () => { paint = null })

// Midnight: when the local date changes, re-render (new Today row, windows shift).
setInterval(() => { const t = todayIso(); if (t !== S.today) { S.today = t; render(); scrollToToday() } }, 30_000)

// ---------------------------------------------------------------- boot

applyTheme()
root.innerHTML = '<div class="empty"><div class="kicker">Loading…</div></div>'
void (async () => {
  const session = await requireSession()
  const profile = await ensureProfile(session)
  const data = await loadOwn(profile.id)
  S = { profile, email: session.user.email ?? '', data, win: 'r7', today: todayIso(), account: false, menu: null, add: null, arch: null, del: null, share: null, error: null }
  render()
  scrollToToday()
  void repairRecent(profile.id, data, profile.startDate).catch((e) => { S.error = String(e?.message ?? e); render() })
})().catch((e) => { root.innerHTML = `<div class="empty"><h2>Could not load</h2><p class="error">${String(e?.message ?? e)}</p></div>` })
