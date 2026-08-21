// Login: email + password (Q30; sanctioned deviation C1 from the magic-link design). Layout, copy, and
// the W/C/B panel follow docs/design/Login.dc.html.

import '../theme.css'
import { delegate, html, renderInto, when } from '../ui/render'
import { applyTheme, themeLabel, toggleTheme } from '../ui/theme'
import { ensureProfile, getSession, signIn, signOut, signUp } from '../data/auth'

type Mode = 'signin' | 'signup'
interface State { mode: Mode; email: string; password: string; busy: boolean; error: string | null; userName: string | null }

const root = document.getElementById('app')!
const state: State = { mode: 'signin', email: '', password: '', busy: false, error: null, userName: null }
const next = new URLSearchParams(location.search).get('next')
const target = next && /^[a-z]+\.html(\?.*)?$/.test(next) ? `./${next}` : './matrix.html'

function view(s: State) {
  return html`
    <div style="min-height: 100vh; display: flex; flex-direction: column;">
      <div class="nav">
        <div class="nav-brand"><span class="sq sq-14 sq-accent"></span>WIN MATRIX</div>
        <button class="btn btn-secondary" style="margin-left: auto;" data-act="theme">${themeLabel()}</button>
      </div>
      <div data-login-grid style="flex: 1; display: grid; grid-template-columns: minmax(360px, 560px) 1fr;">
        <div data-login-main style="padding: 56px 48px; border-right: 2px solid var(--color-divider); display: flex; flex-direction: column; gap: 24px;">
          <div>
            <div class="kicker kicker-accent" style="font-size: 11px; letter-spacing: 0.14em;">${s.userName ? 'Signed in' : s.mode === 'signin' ? 'Sign in' : 'Create account'}</div>
            <h1 style="margin: 6px 0 0; font: 800 40px var(--font-heading); letter-spacing: -0.02em;">Win Matrix</h1>
            <p style="margin: 10px 0 0; font-size: 14px; line-height: 1.5; color: var(--color-neutral-700); max-width: 400px; text-wrap: pretty;">Record wins, not losses. Keep every op at 85 or better — if one slips under, make it easier or remove it.</p>
          </div>
          ${when(!s.userName, () => html`
            <form data-act="submit" style="display: flex; flex-direction: column; gap: 14px; max-width: 400px;">
              <div class="field">
                <label>Email</label>
                <input class="input" type="email" name="email" data-key="email" value="${s.email}" placeholder="you@example.com" autocomplete="email" required>
              </div>
              <div class="field">
                <label>Password</label>
                <input class="input" type="password" name="password" data-key="password" value="${s.password}" placeholder="${s.mode === 'signup' ? 'At least 6 characters' : ''}" autocomplete="${s.mode === 'signup' ? 'new-password' : 'current-password'}" minlength="6" required>
              </div>
              ${when(s.error, () => html`<div class="error">${s.error}</div>`)}
              <button class="btn btn-primary btn-block" type="submit" ${s.busy ? 'disabled' : ''}>${s.mode === 'signin' ? 'Sign in' : 'Create account'}</button>
              <div style="font-size: 12px; color: var(--color-neutral-600); text-wrap: pretty;">
                ${s.mode === 'signin'
                  ? html`New here? <a href="#" data-act="mode-signup">Create an account</a> — it takes ten seconds.`
                  : html`Already have one? <a href="#" data-act="mode-signin">Sign in</a>.`}
              </div>
            </form>`)}
          ${when(s.userName, () => html`
            <div style="display: flex; flex-direction: column; gap: 14px; max-width: 400px; border: 2px solid var(--color-divider); padding: 20px;">
              <div style="font: 800 16px var(--font-heading);">Signed in as ${s.userName}</div>
              <a class="btn btn-primary" href="${target}" style="text-decoration: none;">Open the Matrix</a>
              <button class="btn btn-ghost" data-act="logout">Log out</button>
            </div>`)}
        </div>
        <div data-login-side style="padding: 56px 48px; display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; background: var(--color-surface);">
          <div style="display: flex; gap: 2px;">
            <span class="st-W" style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; font: 800 15px var(--font-heading);">W</span>
            <span class="st-C" style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; font: 800 15px var(--font-heading);">C</span>
            <span class="st-B" style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; font: 800 15px var(--font-heading);">B</span>
          </div>
          <div style="font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-neutral-600);">Win · Change · Bye — one tap a day per op</div>
        </div>
      </div>
    </div>`
}

const render = () => renderInto(root, view(state))

function readForm(): void {
  const f = root.querySelector('form')
  if (!f) return
  state.email = (f.elements.namedItem('email') as HTMLInputElement).value.trim()
  state.password = (f.elements.namedItem('password') as HTMLInputElement).value
}

delegate(root, 'click', {
  theme: () => { toggleTheme(); render() },
  'mode-signup': (_, ev) => { ev.preventDefault(); readForm(); state.mode = 'signup'; state.error = null; render() },
  'mode-signin': (_, ev) => { ev.preventDefault(); readForm(); state.mode = 'signin'; state.error = null; render() },
  logout: async () => { await signOut(); state.userName = null; render() },
})

delegate(root, 'submit', {
  submit: async (_, ev) => {
    ev.preventDefault()
    readForm()
    state.busy = true; state.error = null; render()
    try {
      if (state.mode === 'signup') await signUp(state.email, state.password)
      else await signIn(state.email, state.password)
      const session = await getSession()
      if (!session) throw new Error('Signed in, but no session was returned.')
      await ensureProfile(session)
      location.replace(target)
    } catch (e) {
      state.error = friendly(e)
      state.busy = false
      render()
    }
  },
})

function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/invalid login credentials/i.test(m)) return 'Email or password did not match.'
  if (/already registered/i.test(m)) return 'That email already has an account. Sign in instead.'
  if (/password/i.test(m) && /6/.test(m)) return 'Password needs at least 6 characters.'
  return m
}

applyTheme()
render()
void getSession().then(async (s) => {
  if (!s) return
  const p = await ensureProfile(s)
  state.userName = p.name
  render()
})
