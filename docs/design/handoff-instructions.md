# CLAUDE.md - Win Matrix implementation

(Design project's `CLAUDE.md`, identical to its `AGENTS.md`; stored here under another name so it is not auto-loaded. The repo root `CLAUDE.md` R1-R8 governs this repo. From the 2026-08-21_2330 bundle.)

CLAUDE.md and AGENTS.md are identical copies (Claude Code reads one, Codex the other). Any edit to one applies to both.

## Bundle version - read first

- This bundle supersedes the 2026-08-21 pre-21:00 export you may have started from.
- If you began on the earlier bundle: re-read this file, PROJECT-RECORD.md, and the brief in full before continuing; diff your work against them.
- The earlier CLAUDE.md carried chat-format rules (bullet grammar, reference codes, grill logging). They were never implementation instructions - drop any behaviour you adopted from them.
- Superseded specifics: Scoreboard Display tiles now centre all content (Q27), the 1406 findings doc is declared lost (Q29), Supabase refs are assigned per build (below).

Instructions for the agent implementing this handoff. Rewritten 2026-08-21 (Q28 = O1); the design-chat formatting rules that previously lived here do not apply to implementation work.

## What this project is

- Recreate the four HTML design prototypes as a real application on Supabase (free plan).
- The .dc.html files are DESIGN REFERENCES: recreate their look and behaviour in your chosen stack; never ship or port them, their template syntax, or `support.js`.

## Read in this order

1. `2026-08-21_1442_ops-matrix-app-brief.md` - goal, scoring semantics (the spec), references, D/DC decision codes.
2. `decisions.md` - resolved design decisions Q1-Q15 plus A-code fixes.
3. `PROJECT-RECORD.md` - screen-by-screen behaviour, theme tokens, localStorage-to-Supabase mapping, prototype seams, handoff notes.
4. `2026-08-21_1705_grill-session-log.md` - audit trail only (Q16+); early entries describe defects that were then fixed.

## Hard rules

- Scoring formulas in the brief are the specification; verify against it before changing any calculation.
- Every `PROTOTYPE SEAM` comment marks fake behaviour; replace each per PROJECT-RECORD's seams section.
- `wm-theme` and `wm-display-scale` stay in localStorage (per-device); all other wm-* data moves to Supabase per the mapping.
- 85-rule copy is exactly "make it easier or remove it".
- Follow PROJECT-RECORD's handoff notes: hoist W/C/B hexes to tokens, keep the focus-visible ring. Text glyphs stay - no icon package (R6/Q28). Auth is email + password, not magic link (C1).

## Working with John

- Challenge incorrect assumptions directly; state why they fail. No flattery.
- Write hyphens, never em or en dashes.
- A1/A2 are DONE: the old Supabase project is paused. This handoff feeds TWO parallel builds, each with its own free-plan Supabase project - Claude Code uses ref mzwuxjxtigapyoiqcrta, Codex uses ref xpagxbjjiuudkbwxhpdt. Use the ref for YOUR build; never write to the other.
