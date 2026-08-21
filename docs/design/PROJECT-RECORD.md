# PROJECT-RECORD

Verbatim copy of the design bundle's record. Where it describes auth (magic link), Lucide icons, prototype seams, or a subscribing display, the build differs; `../grill-log.md` and `../decisions.md` (C1) are current.

Win Matrix - project record for the Claude Code handoff. Updated 2026-08-21 (AEST). Current state only; superseded history lives nowhere in this bundle on purpose (Q19 = O1). Spec authority: `2026-08-21_1442_ops-matrix-app-brief.md` + `decisions.md`.

## Files

- `Login.dc.html` - email magic-link sign-in (Q14); display name defaults from email (Q15); demo-session button is a prototype seam.
- `Win Matrix.dc.html` - the matrix: daily entry + op management. Ops as columns, days as rows (earliest top, today bottom, 2 dimmed future rows for planned Byes). Click cycles blank > W > C > B; drag paints a run; future cells take Byes only. Windows: Today / Roll 7 / Roll 28 (Q4). Frozen header + 7-day and 28-day per-op average rows; Score column before the ops so columns never shift. Op menu: rename, colour tag, note (DC6), reorder, archive from date (D9), delete (confirm, A8). Share dialog: summary vs full-grid depth (D8).
- `Scoreboard.dc.html` - the composer: per board show/hide, element toggles gated by granted depth, FEATURE band, reorder, ops-panel mode on the user's own board only (A6/D7). Live 16:9 arrangement preview, fixed 104px chip tracks.
- `Scoreboard Display.dc.html` - pure glass wall display: no controls, Swiss modular grid, rebalances at any board count, type steps a scale. Mouse reveals A-/A+/Reset + COMPOSE; keyboard +/-. Bottom stats anchored; mid-tile ops list clips with "+N more".
- `_ds/modernist-.../` - the bound Modernist design system; the ONLY stylesheet source (Q20).
- `support.js` - Design Component runtime (prototype plumbing; do not port).
- `decisions.md` - resolved decisions Q1-Q15 + A-codes + inferred question list.
- `2026-08-21_1705_grill-session-log.md` - Q16-Q26 audit trail (Q17 = O3 ships it).

## Theme (current scheme - no other palette applies)

- Base: Modernist (Archivo, zero radius, 2px rules, flush-left labels, Lucide icons).
- Themes: light = Modernist stock; dark = derived overrides in each screen's helmet (Q1). Dark is default; per-device toggle `wm-theme` (Q2).
- Accent: Modernist red #ec3013 in BOTH themes (Q3). Dark remaps --color-accent-600/700 to lighter steps for hover/text legibility.
- Score semantics (Q3): --score-good green / --score-bad amber, themed per ground; >=85 good, <=84 flag; never red.
- Entry states: W #2fb344 / C #f59f00 / B #17a2b8; text colours per state are in the code.
- Colour tags are non-semantic (A5): purple, blue, greys; never W-green or C-amber.
- Extension tokens beyond stock Modernist: --color-elev (elevated surface), --score-good, --score-bad, the dark override block. Carry all four into the production theme layer.

## Scoring (verified against the live sheets; full formulas in the brief)

- Daily = Wins / (active ops - Byes) x 100; C and blank count in the denominator only.
- Overall 7/28-day = average of daily scores; window = yesterday back N days.
- Per-op window avg = Wins / (window days - Byes) x 100.
- Untouched days score 0 from the start date (D5); start date defaults to first login day.
- 85-rule copy everywhere: "make it easier or remove it".

## Storage to Supabase mapping (Q22)

Prototype persists to localStorage; production moves data server-side. Auth: Supabase magic link (signInWithOtp).

- `wm-user` {name, email, start} > profiles table keyed by auth user.
- `wm-ops` > ops table: id, name, colour tag, note, archive/resume date spans (D9).
- `wm-entries` > entries table: op id, date, state (W/C/B); editable history, scores recompute (D5).
- `wm-board-config` > board_config: the user's composer settings; display subscribes instead of polling.
- `wm-theme`, `wm-display-scale` > STAY in localStorage; per-device by design (Q2).

## Prototype seams (Q24 = O3; each also has an inline PROTOTYPE SEAM comment)

- Sample data: Win Matrix `sample()` generates ops/entries > Supabase queries.
- Sample sharers: Scoreboard `PEOPLE` map > share grants (DC3; grants list/revoke UI deferred per Q8).
- Live updates: Display `_sim` interval fakes movement > Supabase realtime subscription.
- Config polling: Display `_poll` reads localStorage > realtime subscription.
- Magic link: Login `sendLink` fakes the email > Supabase auth signInWithOtp.

## Handoff notes from the design-system review

- Hoist the W/C/B hexes (inline in 3 files) to tokens: --st-win / --st-change / --st-bye.
- Swap text-glyph buttons (up/down arrows, close marks) to Lucide icons per Modernist.
- Keep the `button:focus-visible` accent ring; inline style resets must never remove it.
- Flush-left governs button labels; data-grid cells (matrix cells, stat numerals) may centre.
- Recreate visuals pixel-perfectly; do not port the DC runtime (`support.js`) or its template syntax.

## Not built yet (deliberate)

- Supabase wiring (A1/A2 pending John), share grants list/revoke (Q8), frequency-code automation (DC6 deferred), phone layout (Q10), cheers/reactions (D10).
