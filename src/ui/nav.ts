// Shared top bar for the signed-in pages. Signed-in name + account menu on every page (Q14, Q15).

import { html, when, type Html } from './render'
import { themeLabel } from './theme'

export type Page = 'matrix' | 'scoreboard'

export interface NavProps {
  page: Page
  userName: string | null
  /** Page-specific buttons rendered between the theme toggle and the account button. */
  actions?: Html
}

export function navView(p: NavProps): Html {
  return html`
    <div class="nav">
      <div class="nav-brand"><span class="sq sq-14 sq-accent"></span>WIN MATRIX</div>
      <div class="nav-links">
        <a href="./matrix.html" ${p.page === 'matrix' ? 'aria-current="page"' : ''}>MATRIX</a>
        <a href="./scoreboard.html" ${p.page === 'scoreboard' ? 'aria-current="page"' : ''}>SCOREBOARD</a>
      </div>
      <button class="btn btn-secondary" data-act="theme" title="Switch theme">${themeLabel()}</button>
      ${p.actions ?? ''}
      ${when(p.userName, () => html`
        <button class="btn btn-ghost nav-user" data-act="account" title="Account" style="color: var(--color-text);">
          <span class="sq sq-8 sq-good"></span>${p.userName}
        </button>`)}
      ${when(!p.userName, () => html`<a class="btn btn-ghost" href="./index.html">Sign in</a>`)}
    </div>`
}

export interface AccountMenuProps { email: string; name: string; startDate: string }

/** The account popover: display name, start date, log out. Opened by data-act="account". */
export function accountMenuView(a: AccountMenuProps): Html {
  return html`
    <div class="scrim" data-act="account-close"></div>
    <div class="popover" style="right: 16px; top: 60px;">
      <div class="kicker">Signed in · ${a.email}</div>
      <div class="field">
        <label>Display name — shown on scoreboards</label>
        <input class="input" data-act="rename-user" data-key="rename-user" value="${a.name}" maxlength="60">
      </div>
      <div class="field">
        <label>Start date — scoring counts from here</label>
        <input class="input" type="date" data-act="set-start" data-key="set-start" value="${a.startDate}">
      </div>
      <button class="btn btn-secondary" data-act="logout">Log out</button>
    </div>`
}
