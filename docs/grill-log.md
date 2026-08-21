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

## 2026-08-21_1954 - Build progress

- G1 cleared: iqpgwghkglromogsbayw and tqczsjbroclihyshzmlc both INACTIVE. A separate `win-matrix-v2-codex` project (xpagxbjjiuudkbwxhpdt) is ACTIVE - John's parallel Codex build, untouched.
- Supabase project created: `recordbreaker-matrix-claude-2026-08-21_1852`, ref `mzwuxjxtigapyoiqcrta`, ap-southeast-2. DB password in the session scratchpad `win-matrix-db-password.env` (John to save in KeePass).
- Local repo at `2026-08-21_1519_win matrix/win-matrix-cc-v02/`, 2 commits. `npm run check` green: 32 engine tests, typecheck, build.
- B1/B2 still open: PAT cannot see win-matrix-cc-v02; push and Pages wait on that.

## 2026-08-21_2007 - Build complete locally; browser verification done (Q35 = a)

- Supabase `mzwuxjxtigapyoiqcrta`: schema + RLS + 2 RPCs pushed (2 migrations), auth config pushed (email+password, confirmations off), storage.vector disabled for free tier.
- Seeded Mim / Rob / Kate (wm-test-*@example.com, password winmatrix-test-2026) with 60 days of history, cross-grants, a display token, and a board config.
- Verified in Chrome against the live project: sign-in, matrix render, cell cycling, future-row byes, share dialog (reuses the link at that depth), op menu, archive-from-past-date and restore (history before the change stays counted), add op, delete op with confirm, composer with depth-gated chips, display by token with featured layout, live broadcast update (display flashed + moved within 1s), claim link as Kate (redirect to login, return, grant created, notice shown), display token minting, light theme.
- Bugs found and fixed during verification: dialog click guard swallowed inner clicks; claim_share OUT-column name collision; full-grid boards now refetch behind a broadcast.
- Known polish item: the owner's ops list on the display can clip a partial row at some viewport sizes (cap is by size class, not by measured height).
- 5 commits local. B1 still open (PAT cannot see win-matrix-cc-v02), so push + Pages deploy wait on John. Then: repo variables VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, Pages source = GitHub Actions.

## 2026-08-21_2031 - DEPLOYED

- B1/B2 cleared: John minted a scoped PAT (Contents/Variables/Workflows rw; Actions/Pages/Metadata ro; no Administration), flipped the repo public, set Pages source = GitHub Actions himself.
- Pushed to `MrJohnWilkinson/win-matrix-cc-v02`. Repo variables VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY set. Workflow run 32472898886 succeeded.
- Live: https://mrjohnwilkinson.github.io/win-matrix-cc-v02/ - sign-in, matrix (7 cols, Today 67), display by token all verified in Chrome on the production URL, zero console errors.
- Test users Mim/Rob/Kate left in place for John's first look; `npm run seed -- --clean` removes them (needs the seed env from the scratchpad).
- Follow-ups (not blocking): display ops-list partial-row clip; share-grant list/revoke (Q8 deferred); magic link via SMTP later (Q30); custom domain CNAME when wanted (Q33).

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

## 2026-08-21_2112 - Audit against the bundle and inputs (Fable session)

- Fixed: `archiveFrom` inside a closed span un-archived earlier history (D9); test added.
- Fixed: `display_snapshot` returned boards the composer had hidden; now filtered server-side.
- Fixed: realtime channels were public. Scores now broadcast from a `daily_scores` trigger on private `scores:{ownerId}` channels gated by RLS on `realtime.messages`. Verified: owner and grant holder receive, a non-grant user and the anon key are refused.
- Consequence: the anonymous display has no user JWT and cannot join a private channel. It polls `display_snapshot` every 10s and flashes on change. Restoring sub-second wall updates means anonymous sign-in for the display (new auth users per wall device, `claim_share` must reject anonymous users) - John's call, not taken here.
- Fixed: Supabase default privileges gave `anon` EXECUTE on `viewer_depth` and `claim_share`; revoked. Anon can call `display_snapshot` only, verified.
- Added: `src/data/store.test.ts`, the Q32 obligation - stored `daily_scores` rows equal engine output across 40 random grids and their mutations. 35 tests.
- Seed password moved to `SEED_PASSWORD`; production test users recreated with a new password held in the scratchpad seed env (copy to KeePass). The value published in this log at 2026-08-21_2031 no longer works.
- Docs: `CLAUDE.md` named a non-existent `src/data/scores.ts` as the writer; corrected. Design grill log Q16-Q26 copied to `docs/design-grill-log.md`. `docs/design/` now carries `support.js` and the original `_ds/` folder name so the screens open. C1 recorded in `decisions.md`. PROJECT-RECORD kept verbatim with a one-line pointer to what changed.
- Numbering note: there is no F14 in this log; findings run F7-F13, F15, F16.
- Open, not changed: DC2 says each user's own timezone, the build uses the device date (`profiles` has no timezone); the wall display makes that visible when it sits in another zone. Guardrail drift flagged, no action: `matrix.ts` carries five workflows (R3); `loadGrantsForOwner` and `ENTRY_STATES` unused (R6); `tsconfig` includes `src` only so `npm run check` never typechecks `scripts/` (R8); `.btn-primary` text is `#fff` where Modernist uses `var(--color-bg)`, and the `--color-accent-2-*` ramp was dropped.

## 2026-08-21_2153 - Design project re-imported via the Claude Design MCP

- Pulled the live project `faf009b5` (13 files). Against the 18:43 export only three differed: `Scoreboard Display.dc.html` (Q27, every tile element centred), `PROJECT-RECORD.md` (Q27 sentence, Q16-Q27 note), the design grill log (entries 21:06-21:45, Q27-Q29), plus a rewritten design `CLAUDE.md`.
- Ported Q27 into `src/screens/display.ts`: name row, TODAY block, ops list, "+N more", averages and last-7 strip all centre. Five style values, no logic change.
- Copies refreshed under `docs/design/`; the design `CLAUDE.md` is stored as `docs/design/handoff-instructions.md` so it is not auto-loaded over this repo's rules. `docs/design-grill-log.md` carries the new entries.
- Design Q27-Q29 numbers collide with this log's Q27-Q29 (different questions); the design log's prefix "design" disambiguates when cited.

## 2026-08-21_2229 - Design project re-pulled (Win Matrix, CLAUDE.md, AGENTS.md)

- `Win Matrix.dc.html` unchanged since the 2153 pull; no code to port.
- Design `CLAUDE.md` gained a "Bundle version" header, marks A1/A2 done, and pins Supabase refs per build: this repo = `mzwuxjxtigapyoiqcrta` (matches `.env`), Codex = `xpagxbjjiuudkbwxhpdt` (never written by this repo). `AGENTS.md` is its declared identical copy. Stored as `docs/design/handoff-instructions.md`.
- Its "Lucide icons" and "magic link" rules remain superseded here by R1-R8 and C1.
- The project also now holds `uploads/Screenshot 2026-08-21 221429.png`; not imported (not part of the selection).
