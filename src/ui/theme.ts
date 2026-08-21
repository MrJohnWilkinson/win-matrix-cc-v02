// Per-device theme (Q2). Dark is the default. Stored in localStorage `wm-theme`; never server-side.

export type Theme = 'dark' | 'light'
const KEY = 'wm-theme'

export function currentTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export function applyTheme(t: Theme = currentTheme()): void {
  document.body.dataset.theme = t
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem(KEY, next) } catch { /* private mode */ }
  applyTheme(next)
  return next
}

/** Label for the toggle button: names the theme you would switch TO. */
export function themeLabel(): string {
  return currentTheme() === 'dark' ? 'Light' : 'Dark'
}
