# PROJECT-RECORD

Verbatim copy of the design project's record (2026-08-21_2330 bundle "Scoreboard sharing controls"). Where it describes prototype seams or a subscribing display, the build differs; `../grill-log.md` and `../decisions.md` are current.

Win Matrix - project record for the Claude Code handoff. Updated 2026-08-21 (AEST). Current state only; superseded history lives nowhere in this bundle on purpose (Q19 = O1). Spec authority: `2026-08-21_1442_ops-matrix-app-brief.md` + `decisions.md`.

## Files

- `Login.dc.html` - sign-in page (Q14). AMENDED: production auth is email + password (build grill Q30 = a, sanctioned deviation C1 - magic link needs SMTP; password works on the free plan). Prototype UI still shows the magic-link flow; display name defaults from email (Q15); demo-session button is a prototype seam.
- `Win Matrix.dc.html` - the matrix: daily entry + op management. Ops as columns, days as rows (earliest top, today bottom, 2 dimmed future rows for planned Byes). Click cycles blank > W > C > B; drag paints a run; future cells take Byes only. Windows: Today / Roll 7 / Roll 28 (Q4). Frozen header + 7-day and 28-day per-op average rows; Score column before the ops so columns never shift. Op menu: rename, colour tag, note (DC6), reorder, archive from date (D9), delete (confirm, A8). Sharing dialog (S1-S12, supersedes Q8-deferred): Pause-all switch (silent go-dark, settings kept), invite link with copy + reset (reset is future-only; existing grants keep access; joiners land at Summary), People roster - per-person OFF/SUMMARY/FULL + joined date, revoked people stay listed as Off - and a pinned "Public page" row: a no-login public URL, off by default, same depth control, independent of the invite link, gated by Pause-all. All cut-offs are silent: the board vanishes from the viewer's picker and tiles.
- `Scoreboard.dc.html` - the composer: per board show/hide, element toggles gated by granted depth, FEATURE band, reorder, ops-panel mode on the user's own board only (A6/D7). Live 16:9 arrangement preview, fixed 104px chip tracks.
- `Scoreboard Display.dc.html` - pure glass wall display: no controls, Swiss modular grid, rebalances at any board count, type steps a scale. Mouse reveals A-/A+/Reset + COMPOSE; keyboard +/-. All tile content centre-aligned at full width, one identical layout path at every board count (Q27); bottom stats anchored; mid-tile ops list clips with "+N more".
- `_ds/modernist-.../` - the bound Modernist design system; the ONLY stylesheet source (Q20).
- `support.js` - Design Component runtime (prototype plumbing; do not port).
- `decisions.md` - resolved decisions Q1-Q15 + A-codes + inferred question list.
- `2026-08-21_1705_grill-session-log.md` - Q16-Q27 audit trail (Q17 = O3 ships it). Early entries describe defects found THEN fixed; the resolutions further down each thread are current.

## Theme (current scheme - no other palette applies)

- Base: Modernist (Archivo, zero radius, 2px rules, flush-left labels). Icons: existing text glyphs stay - no Lucide/icon package (R6 nothing speculative, Q28 no extra dependencies; overrides Modernist's Lucide guidance).
- Themes: light = Modernist stock; dark = derived overrides in each screen's helmet (Q1). Dark is default; per-device toggle `wm-theme` (Q2).
- Accent: Modernist red #ec3013 in BOTH themes (Q3). Dark remaps --color-accent-600/700 to lighter steps for hover/text legibility.
- Score semantics (Q3): --score-good green / --score-bad amber, themed per ground; >=85 good, <=84 flag; never red.
- Entry states: W #2fb344 / C #f59f00 / B #17a2b8; text colours per state are in the code.
- Colour tags are non-semantic (A5): 9 muted hues (sky, indigo, violet, purple, magenta, rose, umber, slate, ink); never W-green, C-amber, Bye-teal or accent red.
- Extension tokens beyond stock Modernist: --color-elev (elevated surface), --score-good, --score-bad, the dark override block. Carry all four into the production theme layer.

## Scoring (verified against the live sheets; full formulas in the brief)

- Daily = Wins / (active ops - Byes) x 100; C and blank count in the denominator only.
- Overall 7/28-day = average of daily scores; window = yesterday back N days.
- Per-op window avg = Wins / (window days - Byes) x 100.
- Untouched days score 0 from the start date (D5); start date defaults to first login day.
- 85-rule copy everywhere: "make it easier or remove it".

## Storage to Supabase mapping (Q22)

Prototype persists to localStorage; production moves data server-side. Auth: Supabase email + password (C1; not magic link).

- `wm-user` {name, email, start} > profiles table keyed by auth user.
- `wm-ops` > ops table: id, name, colour tag, note, archive/resume date spans (D9).
- `wm-entries` > entries table: op id, date, state (W/C/B); editable history, scores recompute (D5).
- `wm-sharing` {paused, linkId, publicId, publicDepth, grants[]} > share_grants table + a sharing_settings row (S1-S12).
- `wm-board-config` > board_config: the user's composer settings; display subscribes instead of polling.
- `wm-theme`, `wm-display-scale` > STAY in localStorage; per-device by design (Q2).

## Prototype seams (Q24 = O3; each also has an inline PROTOTYPE SEAM comment)

- Sample data: Win Matrix `sample()` generates ops/entries > Supabase queries.
- Sample sharers: Scoreboard `PEOPLE` map > share grants (DC3).
- Sample grants: Win Matrix seeds `wm-sharing.grants` (Mim/Rob/Kate/Dan/Priya/Sam) > share_grants rows created when a signed-in user opens the invite link.
- Live updates: Display `_sim` interval fakes movement > Supabase realtime subscription.
- Config polling: Display `_poll` reads localStorage > realtime subscription.
- Login: `sendLink` fakes the sign-in > Supabase email + password auth (C1).

## Handoff notes from the design-system review

- Hoist the W/C/B hexes (inline in 3 files) to tokens: --st-win / --st-change / --st-bye.
- Keep the `button:focus-visible` accent ring; inline style resets must never remove it.
- Flush-left governs button labels; data-grid cells (matrix cells, stat numerals) may centre.
- Recreate visuals pixel-perfectly; do not port the DC runtime (`support.js`) or its template syntax.

## Not built yet (deliberate)

- Supabase wiring (A1/A2 pending John), frequency-code automation (DC6 deferred), phone layout (Q10), cheers/reactions (D10), mode filters on OTHER people's tiles (Q30 - own board only per D7; filtering someone else's ops needs a permission model John is deliberately avoiding for now).
