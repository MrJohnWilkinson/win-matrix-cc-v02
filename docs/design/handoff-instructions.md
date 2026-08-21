# CLAUDE.md - Win Matrix implementation

(Design project's `CLAUDE.md`, stored here under another name so it is not auto-loaded; the repo root `CLAUDE.md` R1-R8 governs this repo.)

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
- Follow PROJECT-RECORD's handoff notes: hoist W/C/B hexes to tokens, Lucide icons for glyph buttons, keep the focus-visible ring.

## Working with John

- Challenge incorrect assumptions directly; state why they fail. No flattery.
- Write hyphens, never em or en dashes.
- Open items needing John: A1 pause old Supabase project, A2 create the new free-plan project.
