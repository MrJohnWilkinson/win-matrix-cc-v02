// Minimal render helper: HTML-string views, one root, delegated events. Replaces the design runtime.
// Pattern per screen: `view(state) => Html`, `renderInto(root, view(state))`, events via data-act attributes.

/** A trusted HTML fragment. Interpolating a Frag inside html`` is safe; interpolating a string escapes it. */
export class Frag {
  constructor(public readonly s: string) {}
  toString(): string { return this.s }
}
export type Html = Frag

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c] ?? c)
}

function stringify(v: unknown): string {
  if (v instanceof Frag) return v.s
  if (Array.isArray(v)) return v.map(stringify).join('')
  if (v === null || v === undefined || v === false || v === true) return ''
  return esc(v)
}

/** Tagged template. Strings and numbers are escaped; Frag values and arrays of Frag are inserted as-is. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  let out = ''
  strings.forEach((s, i) => { out += s; if (i < values.length) out += stringify(values[i]) })
  return new Frag(out)
}

/** Wrap a string you know is safe HTML. */
export function raw(s: string): Html { return new Frag(s) }
/** Conditional fragment. */
export function when(cond: unknown, f: () => Html): Html { return cond ? f() : new Frag('') }

/**
 * Re-render the root, preserving focus on the element with the same data-key and scroll on data-scroll
 * containers.
 */
export function renderInto(root: HTMLElement, h: Html): void {
  const active = document.activeElement as HTMLElement | null
  const key = active && root.contains(active) ? active.getAttribute('data-key') : null
  const scrolls = new Map<string, number>()
  root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => scrolls.set(el.dataset.scroll!, el.scrollTop))
  root.innerHTML = h.s
  scrolls.forEach((top, id) => { const el = root.querySelector<HTMLElement>(`[data-scroll="${id}"]`); if (el) el.scrollTop = top })
  if (key) {
    const next = root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)
    if (next) {
      next.focus({ preventScroll: true })
      if (next instanceof HTMLInputElement && next.type === 'text') { const n = next.value.length; next.setSelectionRange(n, n) }
    }
  }
}

export type Handler = (el: HTMLElement, ev: Event) => void

/** Delegate `type` events on the root to the nearest ancestor with data-act; dispatch to handlers[act]. */
export function delegate(root: HTMLElement, type: string, handlers: Record<string, Handler>): void {
  root.addEventListener(type, (ev) => {
    const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-act]')
    if (!el || !root.contains(el)) return
    // A backdrop's action fires only on the backdrop itself; clicks inside the dialog it holds are not dismissals.
    if (el.classList.contains('dialog-backdrop') && ev.target !== el) return
    const fn = handlers[el.dataset.act!]
    if (fn) fn(el, ev)
  })
}

/** Viewport-clamped popover position. */
export function clampToViewport(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: Math.max(8, Math.min(x, window.innerWidth - w - 8)), y: Math.max(8, Math.min(y, window.innerHeight - h - 8)) }
}
