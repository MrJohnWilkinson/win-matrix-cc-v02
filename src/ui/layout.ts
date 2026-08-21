// Wall arrangement: Swiss modular grid that rebalances at any board count. Shared by the composer's
// preview and the display so the two never disagree (docs/design/Scoreboard*.dc.html).

export type SizeClass = 'xl' | 'lg' | 'md' | 'sm'

export interface Arrangement {
  cols: string
  rows: string
  /** grid-column per tile, in display order (featured first). */
  spans: string[]
  sizes: SizeClass[]
}

export function arrange(n: number, featured: boolean): Arrangement {
  if (n === 0) return { cols: '1fr', rows: '1fr', spans: [], sizes: [] }
  if (featured && n > 1) {
    const below = n - 1
    const colsBelow = below <= 3 ? below : Math.ceil(below / 2)
    return {
      cols: `repeat(${colsBelow}, 1fr)`,
      rows: below <= 3 ? '1.35fr 1fr' : '1.35fr 1fr 1fr',
      spans: ['1 / -1', ...Array<string>(below).fill('auto')],
      sizes: [n <= 4 ? 'xl' : 'lg', ...Array<SizeClass>(below).fill(colsBelow <= 2 ? 'lg' : colsBelow === 3 ? 'md' : 'sm')],
    }
  }
  const cols = n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : n <= 6 ? 3 : 4
  const size: SizeClass = cols === 1 ? 'xl' : cols === 2 ? 'lg' : cols === 3 ? 'md' : 'sm'
  return { cols: `repeat(${cols}, 1fr)`, rows: `repeat(${Math.ceil(n / cols)}, 1fr)`, spans: Array<string>(n).fill('auto'), sizes: Array<SizeClass>(n).fill(size) }
}

/** Phone (M8): tiles stack one per row, at least 170px tall, and the page scrolls. */
export function arrangePhone(n: number, featured: boolean): Arrangement {
  if (n === 0) return { cols: '1fr', rows: '1fr', spans: [], sizes: [] }
  const sizes = Array<SizeClass>(n).fill(n <= 2 ? 'md' : 'sm')
  if (featured) sizes[0] = n <= 3 ? 'lg' : 'md'
  return { cols: '1fr', rows: `repeat(${n}, minmax(170px, 1fr))`, spans: Array<string>(n).fill('auto'), sizes }
}

/** Preview numeral size per tile, from the design's composer preview. */
export function previewNumeral(n: number, featured: boolean, index: number): number {
  if (featured && n > 1) {
    const below = n - 1, colsBelow = below <= 3 ? below : Math.ceil(below / 2)
    return index === 0 ? 34 : colsBelow <= 2 ? 24 : 18
  }
  const cols = n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : n <= 6 ? 3 : 4
  return cols === 1 ? 40 : cols === 2 ? 26 : cols === 3 ? 20 : 15
}
