# Ops Matrix App - Brief for Claude Design 2026-08-21_1442

Timestamp: 2026-08-21_1428 (AEST) Status: Single source of truth for the goal, references, and decisions. Deliberately silent on implementation detail. Supersedes 2026-08-21_1425_ops-matrix-app-decision-register.md.

## Goal

Recreate the Ops Matrix (renamed Win Matrix) as an application, not reinventing the system - the Google Sheets version already works and its behaviour is the specification.

The focus:

- Make it very easy for a brand-new person to start using the Ops Matrix.
- Let users share their scores with others.
- Give every user a scoreboard that updates live whenever anyone makes an update.
- The scoreboard is not competitive. It exists so users can see when others are taking good actions and inspire each other - people like to know that other people care when they succeed.

Platform intent: built on Supabase, on the free plan. The existing Supabase project (https://supabase.com/dashboard/project/iqpgwghkglromogsbayw) will be paused, not deleted, so a new free-plan project can be created for this app.

## The system in one paragraph

Each day, for each tracked item (an "op"), the user records a state. Wins divided by the ops that counted that day gives a daily percentage score. Rolling 7-day and 28-day averages, per item and overall, show trend. The guiding rule: keep every score at or above 85 - if an item sits below 85, make it easier or remove it. Measure wins, not losses; tracking itself is winning. Scores are shared to a scoreboard so others can see and be inspired.

## Scoring semantics (verified from the live sheet formulas)

Verified 2026-08-21 by exporting the sheets below and reading every formula, validation rule, and conditional-format rule. Full cell-level detail: project doc `2026-08-21_1406_ops-matrix-app-findings-and-plan.md`.

- Entry codes (sheet): `T` tick/tracking (a win, bright green), `W` winning (a win, green), `B` bye - not required today (blue), `C` change/adjust - not done, signals the plan needs changing (orange), blank - untracked.
- Daily score = (T + W) / (op count - byes) x 100. `C` and blank count in the denominator but not the numerator.
- Op count = active item columns; headers prefixed `[` are archived and excluded.
- Overall 7-day and 28-day averages = average of daily scores across the window (window = yesterday back N days).
- Per-item window averages = (T + W) / (window days - byes) x 100.
- Averages stay blank until the sheet is older than the window.
- Today Score = lookup of today's daily score.
- Colour rules: >=85 green, <=84 orange on averages; weekend rows shaded; today's row highlighted.
- Score interface block: each sheet's `Score` tab D2:D16 exposes name, 7-day avg, 28-day avg, Today, and the last 7 daily scores; the group scoreboard pulls exactly that block per player via IMPORTRANGE and flags values under 85.

## Decisions

### From John directly

- D3: No history import from the sheets. Test with generated sample data instead.
- D4: One matrix per user, one score. Items may carry a colour tag for visual grouping (e.g. morning vs evening ops). No category subtotals - the six-category setup was a later personal experiment, not the core system.
- D5: A day the user never touches scores 0, from their start date onward (matches the sheet). History stays editable and scores recompute.
- D6: Three entry states - Win, Change, Bye - plus blank. The sheet's T/W distinction collapses into Win; they scored identically and differed only in colour.
- D7: No team-scoreboard entity. Sharing is person-to-person. Each user composes their own scoreboard: they may have access to 20 people's boards but choose to display only 3. Their own panel can show tasks not done, done, or both.
- D8: The sharer chooses share depth per share. Default: summary scores (today, 7-day, 28-day, last 7 days). Optional: full task-grid detail.
- D9: Archive and unarchive take effect from any user-chosen date - past ("archive it from two weeks ago") or future ("in ten days, archive it"). Scores respect those spans. Planned future entries (e.g. Byes) are allowed.
- D10: Seeing each other's boards is enough for v1. Cheers/reactions are a later addition, not launch scope.

### Working defaults (John may veto)

- DC2: Day boundary follows each user's own timezone.
- DC3: Sharing works by link: a signed-in recipient gains access; the sharer can see and revoke grants.
- DC5: Scoring formulas are preserved exactly as verified above, including the 85-rule colouring.
- DC6: Frequency-code automation (auto-Bye from notations like `mwf`, `1/2`) is deferred; the per-item note field exists from day one so the notations still work as in the sheet.

## References

### Live spreadsheets (formulas, conditional formatting, validation)

- Fuel (the sheet exported and fully decoded; all six share this layout): https://docs.google.com/spreadsheets/d/12mEheBE8pBbmzh9Lu0AqtmB0esGqwBjw6Y6P2prGT7o/edit
    - Tabs: `Ops Matrix` (engine - codes, trails, daily scores), `Score` (published D2:E16 block), `Setup` (start date, name), plus hidden historical copies.
- Clarity, Balance and Mind Like Water: https://docs.google.com/spreadsheets/d/1DMRUfrrEDgI_Z29LaRxehcOJeWRKTkxWNwMTgCfr154/edit
- Personal Hygiene: https://docs.google.com/spreadsheets/d/1wyg0mQMnVEqIa5qswK0C9ORh4voDXzX2USvsTSxYugY/edit
- Home Refuge & Sanctuary: https://docs.google.com/spreadsheets/d/1w448iFakRjssLD0Ar9TCE23L7Q03ixbsUVKajyRkHCk/edit
- 3DVRS: https://docs.google.com/spreadsheets/d/1oyJLCpsbAPHxye77m9Uine2PMJHOEl25h-vNwVqJbv0/edit
- Connection, Privilege and Gratitude: https://docs.google.com/spreadsheets/d/18K51_vpQ5E4CkC91LnABQGtof1_MTQrNiaZ3iZxenjw/edit
- 300k Group Scoreboard (master, exported and decoded - Setup player/URL mapping, IMPORTRANGE wiring, Colours flourish): https://docs.google.com/spreadsheets/d/1ssj8k200ImcQ4cDIHMxvL_oNBTH4fNGc3GNc7VCjMPk/edit
    - Note: its Setup tab points Fuel at https://docs.google.com/spreadsheets/d/1yhQ1giFOU1byD_2qzmUjvdLqzJBttMmHM4vykEjywd0/edit - a different file id than the Fuel sheet above.
- Published read-only scoreboard (the phone-widget / wall-display surface being replaced): https://docs.google.com/spreadsheets/d/e/2PACX-1vTXb0QzWvOaRfpuGK1cNPkkqh6xR6gH7uSn1Mqcy55ubNfq7yTwpgjvIHHLhLIqS50J7E7E-BowAm31/pubhtml?gid=1536049013&single=true
- Operations Matrix v2.0 (2021 week-grid lineage; provenance only, different engine): https://docs.google.com/spreadsheets/d/16q3Wqt_hcLtgkUR5MJMa2hNnTwFJCwzkUvhdCsLBHEw/edit?gid=620731673

### recordbreaker.com.au instruction pages (philosophy and rules)

- System overview, "Win Matrix (Formerly the Ops matrix)": https://recordbreaker.com.au/record-breaker-system/
- Win Matrix setup, joining a scoreboard, widgets, W/C/B user guide: https://recordbreaker.com.au/winmatrix/
- Scoring philosophy - measure wins, the 85 rule, make activities easier, starter habits: https://recordbreaker.com.au/tips-for-success/
- Original full Ops Matrix instructions - Yes/Half/No/Credit/n-a semantics, flexible codes and targets: https://recordbreaker.com.au/elementor-432/
- Key Results Tool: https://recordbreaker.com.au/key-results-tool/
- Joining a group: https://recordbreaker.com.au/join-a-group/
- Older v1 pages: https://recordbreaker.com.au/record-breaker-system-v1/ and https://recordbreaker.com.au/key-metrics-tool-v1/
- Dead links (do not use): https://recordbreaker.com.au/opsmatrix/ and https://recordbreaker.com.au/tracker/

### Project docs

- Formula-level findings and cell references: `claude/2026-08-21_1406_ops-matrix-app-findings-and-plan.md` (its "Proposed Supabase app" section is the how, kept separate from this brief on purpose).

## Open items

- A1: John pauses Supabase project iqpgwghkglromogsbayw.
- A2: John creates the new free-plan Supabase project and provides access.

## Amendments (2026-08-21 grill session)

- 85-rule copy corrected everywhere: "make it easier or remove it" (never "rather than abandoning it").
- This copy of the brief was saved into the design project per Q17 = O3; the paragraph above already carries the correction.
