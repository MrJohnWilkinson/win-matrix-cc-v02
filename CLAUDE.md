# Win Matrix - rules for agents working in this repo

Spec authority, in order: `docs/brief.md` (scoring formulas, decisions D1-D10), `docs/decisions.md` (design-session rulings Q1-Q15 and amendments), `docs/design-grill-log.md` (design-session rulings Q16-Q26), `docs/grill-log.md` (build-session rulings Q27+). The design bundle under `docs/design/` is a picture of the target, never a source of logic.

## Shape
- R1 - One engine. Scoring, active-span rules, and state meanings live in `src/domain/`, stay pure, and every screen reads them.
- R2 - One door. All Supabase access lives in `src/data/`. Supabase stores and secures; it never decides product rules.
- R3 - One job per file. A module that grows a second workflow gets split.
- R4 - The design is a picture, not a program. Copy its visuals; author logic from the sheet formulas.

## Change
- R5 - One layer per change. If a change touches four places, fix the structure before shipping it.
- R6 - Nothing speculative. Add what a real journey fails without, and name what it removes.
- R7 - One workflow at a time. Finish it end to end before starting the next.

## Proof
- R8 - One gate. `npm run check` runs types, scoring tests, and build. No ceremony beyond it.

## Feature gate
Before adding anything: name the journey that breaks without it, and the complexity it removes.

## Hard exclusions (Q28)
No UI framework, no router, no state library, no PWA, no IndexedDB, no monorepo packages, no edge functions unless a journey fails without one.

## Conventions
- Dates are plain `YYYY-MM-DD` strings in the device's local calendar (DC2). Never `Date` objects across module boundaries.
- Entry states: `W` win, `C` change, `B` bye. Absent = untracked. Nothing else.
- Grant depth (owner-side, `share_grants.depth` and `sharing_settings.public_depth`): `off` | `summary` | `full`. Viewers never see `off`: every viewer-side read goes through `effective_depth` (null when off or the owner is paused), so cut-offs are silent (S7/S10).
- One invite link per owner, always joining at Summary (S3/S5); `share_links` has no depth. Reset deletes and re-mints; grants are untouched.
- Scores: `null` means "no score" (window not full, no active ops). Render `null` as a dash. Never coerce to 0 for display.
- `daily_scores` is derived. In the app only `recomputeRange` in `src/data/store.ts` writes it; `scripts/seed.ts` writes it from the same engine (`dailyScoresForRange`). `src/data/store.test.ts` proves stored rows equal engine output.
- Per-device state stays in localStorage: `wm-theme`, `wm-display-scale`, `wm-window` (M4). Everything else lives in Supabase.
- Phone breakpoint is 640px everywhere (one `matchMedia` in the matrix, one media query in `theme.css`, `innerWidth` on the display). Ops stay columns on phone; no transpose (M2).
- Timestamps in docs use `YYYY-MM-DD_HHmm`.
