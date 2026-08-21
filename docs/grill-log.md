# Win Matrix rebuild - Claude Code grill log

Continues numbering from the Claude Design sessions (Q1-Q15 in decisions.md, Q16-Q26 in the design grill log). This session starts at Q27.

## 2026-08-21_1848 - Exploration before questioning

- F1: Supabase CLI (npx supabase 2.115.0) is already authenticated as org MrJohnWilkinson (jarbcutaweiuyyfbylcr).
- F2: Four projects exist. ACTIVE: tqczsjbroclihyshzmlc (recordbreaker-matrix-codex), iqpgwghkglromogsbayw (recordbreaker-matrix-claude). INACTIVE: yoiomqcpkrkkbsbmecdt, kzdopazubsvrihksgbcm (activity-logger).
- F3: `supabase projects` has list/create/api-keys/delete only. No pause. Pausing is a dashboard action.
- F4: gh CLI authenticated as MrJohnWilkinson; GitHub Pages deploy is autonomous.
- F5: Handoff bundle is complete and self-consistent: 4 screens, decisions.md, PROJECT-RECORD.md, brief, _ds Modernist tokens.
- F6: Old build (recordbreaker-matrix-codex) is React 19 + Vite + TS + Playwright + 6 edge functions. That is the bloat being discarded.

## 2026-08-21_1852 - Q27 answered: b

- Q27 = b: John pauses iqpgwghkglromogsbayw; Claude Code creates a new free-plan project.
- Project name fixed by John: `recordbreaker-matrix-claude-2026-08-21_1852`.
- Region should match prior projects: ap-southeast-2 (Sydney).
- G1 remains open until John confirms the pause completed.

## 2026-08-21_1905 - Q28 answered: b

- Q28 = b: Vite + TypeScript, no UI framework, generated Supabase types, Vitest on scoring.
- Hard exclusions agreed: no router, no state library, no PWA, no idb, no monorepo packages.
- Target shape: ~12 source files (domain/, data/, ui/render, screens/, theme.css, migrations).
- John supplied a G1-G19 guardrail list from another build thread, asking whether it aligns.

## 2026-08-21_1915 - Q29/Q30 answered, full bundle read completed

- Q29 = a: ship the whole designed surface, built in one-workflow-at-a-time order.
- Q30 = a: email plus password, confirmation off. No SMTP, no DNS. Magic link deferred to a later config swap.
- Guardrails rewritten as R1-R8 (one engine / one door / one job per file / design is a picture / one layer per change / nothing speculative / one workflow at a time / one gate).
- Full read now done: all 4 .dc.html screens, styles.css, _ds_bundle.js.

### Findings from the full read

- F7: `_ds_bundle.js` is an empty stub. Nothing to port; exclude it.
- F8: styles.css imports Archivo from Google Fonts; zero radius, 2px rules, flush-left labels.
- F9: prototype scoring in Win Matrix agrees with the brief formulas. Use as cross-check, not source (R4).
- F10: `activeOn` supports ONE archive span per op (archivedFrom + resumedFrom). D9 implies repeatable cycles. GAP.
- F11: Display `avg()` ignores windowReady and averages raw; Matrix blanks until the window fills. INCONSISTENT.
- F12: Display `myDayScore` returns 0 with no ops; Matrix `dailyScore` returns null. INCONSISTENT.
- F13: share URL in the dialog is fake (`winmatrix.app/s/...`). Real scheme undecided.
- F15: Display fabricates other people's op marks with 8 random cells. Needs real full-depth data.
- F16: Display polls localStorage every 2.5s. Production: Supabase realtime.

### Conflicts against the handoff README

- C1: Q30 = a changes the Login screen flow from magic link to password. Sanctioned deviation, recorded.
- C2: README forbids rendering or screenshotting the designs unless John asks. Honoured; will ask before visual verification.
- C3: No other conflict. README explicitly permits any implementation technology.

## 2026-08-21_1926 - Q31 and Q32 answered

- Q31 = a: share link is an open invite. Any signed-in person who opens it receives a grant at the link's depth. Sharer sees the grant list. Revoke deferred (Q8).
- Q31 nuance ruling: each grant stores its own depth, fixed at claim time. Re-claiming at a higher depth raises the grant; it never lowers it. Downgrade needs revoke.
- Q32 = b: owner's client upserts a `daily_scores` row via the one TypeScript engine. Summary grants read `daily_scores` only; full grants also read `ops` and `entries`. Absent row = 0 (D5).
- Q32 caveat accepted by John: b is the right trade, not textbook. Trigger-based c stays the documented upgrade path; only the daily formula would ever be duplicated in SQL.
- Q32 design obligation: ONE `recomputeRange(from, to)` in the data layer, called by every mutation (entry edit, archive date change, start date change, op delete). Property test asserts stored rows equal engine output.
- Standing rulings from the full read: F11/F12 resolved in favour of the Matrix behaviour (blank until window fills; null not 0 with no ops). F7: `_ds_bundle.js` excluded.

## 2026-08-21_1930 - Q33 answered: a

- Q33 = a: GitHub Pages on the GitHub domain. Four static pages: index.html (login), matrix.html, scoreboard.html, display.html. No router.
- Share link: `https://mrjohnwilkinson.github.io/win-matrix/scoreboard.html?claim={token}`. Token = random 16-char id on a `share_links` row (owner, depth).
- Signed-out claim redirects to login, then returns to complete the claim.
- Repo: `win-matrix`, public, under MrJohnWilkinson.
- John's concern answered: live updates and midnight rollover come from Supabase realtime and the client clock, not hosting. Custom domain later = one CNAME; issued share links would need re-sharing after the move.

## 2026-08-21_1932 - Q34 answered: b

- Q34 = b: wall display opens by token URL, `display.html?key={token}`, no sign-in on the display device.
- Rulings taken without a question: DC2 "today" = device local date, entries store plain YYYY-MM-DD; no sample data in production, seed script for a test account only.
- Design consequence: `display_tokens` table (token, owner). One read-only SECURITY DEFINER RPC `display_snapshot(token)` returns names, board_config, daily_scores, and full-depth ops/entries where granted. Anon role gets EXECUTE on that function only; no anon table policies.
- Live updates on the display: owner clients broadcast on a per-owner realtime channel after each upsert; the display subscribes to the channels the snapshot names. Fallback poll every 30s.
- Composer's "Open display" button mints the token on first use and opens the URL. Token rotation deferred.

## 2026-08-21_1933 - Q35 answered: a

- Q35 = a: full end-to-end verification in Chrome against the deployed app. Throwaway test accounts created in the new project, deleted afterwards.

## 2026-08-21_1938 - Q36/Q37 resolved by John's repo; visibility = a

- John created `https://github.com/MrJohnWilkinson/win-matrix-cc-v02` (private). Visibility ruling = a: John makes it PUBLIC so GitHub Pages works on the Free plan.
- B1 open: John's fine-grained PAT must be granted access to `win-matrix-cc-v02` (Contents, Pages, Workflows, Administration: read/write) before Claude Code can push.
- Local clone: `2026-08-21_1519_win matrix/win-matrix-cc-v02/`. Deploy: GitHub Actions builds and publishes Pages on push to main.
- Q37 = a: local build starts now; Supabase project creation waits on G1 (pause of iqpgwghkglromogsbayw); push waits on B1.
- Share-link host therefore becomes `https://mrjohnwilkinson.github.io/win-matrix-cc-v02/`.

## Open gates (John)

- G1: pause Supabase project iqpgwghkglromogsbayw in the dashboard.
- B1: grant the PAT access to win-matrix-cc-v02.
- B2: flip win-matrix-cc-v02 to public.

## Running decision register (this session)

- Q27 = b - new project `recordbreaker-matrix-claude-2026-08-21_1852`, ap-southeast-2. John pauses iqpgwghkglromogsbayw (G1, still open).
- Q28 = b - Vite + TypeScript, no UI framework, generated Supabase types, Vitest on scoring. No router, state lib, PWA, idb, monorepo.
- Q29 = a - whole designed surface ships, one workflow at a time.
- Q30 = a - email + password, confirmation off. Login screen deviates from magic link (C1, sanctioned).
- Q31 = a - open invite share link, grant binds at claim.
- Q32 = b - client-computed `daily_scores` table, single recompute choke point.
- Guardrails R1-R8 replace G1-G19; to be saved as repo CLAUDE.md.
- C2 standing: no rendering or screenshots of the design files unless John asks.
- Q33 = a - GitHub Pages, four static pages, `?claim={token}` share link, repo `win-matrix`.
- Q34 = b - display token URL, `display_snapshot(token)` RPC, per-owner broadcast channel for live updates.
- Q35 = a - full browser E2E verification of the built app; test accounts cleaned up after.
- Q36/Q37 - repo `win-matrix-cc-v02` (public), Actions to Pages; build starts before gates clear.
