# Win Matrix rebuild — resolved decisions (grill session, 2026-08-21)

Supersedes the handoff's open items. Codes preserved from review chat.

## Inferred questions (reconstructed after the session was lost)
The original grill questions were lost with the interrupted chat; these are inferred from the recorded answers. Confidence marked per question — treat `[low]` ones as unverified; the answer stands even if the question framing is off.

- Q1: How should the design system relate to Modernist, given Modernist is light-only? (extend it vs. fork vs. second system)
- Q2: Which theme is the default, and where does the theme choice live?
- Q3: What is the accent colour in each theme, and do score colours follow it?
- Q4: Which score windows does the app support? (the handoff also had Week / Month)
- Q5: What does onboarding look like for a new user? → superseded by Q13
- Q6: How does archiving an op affect history and scores? (confirmed: archive/unarchive from any past or future date; scores respect the spans)
- Q7: Where does the per-op note (DC6) get entered and shown?
- Q8: How do share grants get listed and revoked? (answer: deferred; dialog copy fixed)
- Q9: Is this a prototype or a usable app, and what backend? (confirmed: usable app, Supabase backend)
- Q10: Which device targets are in scope?
- Q11: How should sample/demo data behave? [low]
- Q12: Does the composer keep its print copy?
- Q13: (follow-up to Q5) Does a first-run flow exist at all? (answer: no — matrix opens usable, empty state prompts)
- Q14: Is a login page in scope, and what auth method?
- Q15: Where does the user edit their display name?

## Theme
- Q1/O1: Modernist extended with a derived dark theme; one token vocabulary.
- Q2/O1: dark default everywhere; per-device toggle (`wm-theme`).
- Q3/O1: Modernist red #ec3013 accent in both themes; scores keep their own green/amber semantics.

## Scope
- Q4/O1: windows = Today / Roll 7 / Roll 28 only.
- Q5 superseded by Q13: NO onboarding flow. Matrix opens usable on first login; empty state prompts first op; start date defaults to first login day (D5).
- Q6/O1: date-based archive per D9 (archivedFrom / resumedFrom spans; scores respect spans).
- Q7/O1: per-op note field in op menu (DC6 day-one).
- Q8/O1: share grants list/revoke deferred at the time; SUPERSEDED by the sharing-controls session below - now built.
- Q9: NOT a prototype — fully usable. All own data persists locally (ops, entries, user, config, theme). Backend = Supabase, set up before coding; sample sharers stand in visually until then.
- Q10/O1: desktop + wall display. AMENDED 2026-08-22: phone layout built - see Mobile pass below. Composer stays desktop-only.
- Q11/O1: sample scores move both ways realistically; live flash kept.
- Q12/O1: composer print copy dropped.
- Q14/O1: Login page in scope; nav shows signed-in name + logout on every page. AMENDED: auth is email + password, not magic link (build grill Q30 = a, deviation C1).
- Q15/O1: display name edited in nav account menu; defaults from email.

## Fixes carried from review (A-codes)
- C1 (build session, Q30): Login is email + password with confirmations off, not the magic link named in Q14; magic link is a later config swap. See `grill-log.md`.
- A4: 85-rule copy — "make it easier or remove it" (CORRECTED 2026-08-21: "rather than abandoning it" was wrong advice; a change signal means make it easier, or remove it).
- A5: colour tags non-semantic (no W-green / C-amber reuse).
- A6: ops-panel mode control only on the user's OWN board (D7).
- A8: delete op requires confirm.
- A9/A10: sticky offsets derived, bloat files excluded.

## Sharing controls (grill session, 2026-08-21 evening)

Model: one standing invite link + People panel in the Share dialog on the matrix.

- S1/O1: per-person control OFF / SUMMARY / FULL (ordered least to most shared); Off = revoked.
- S2/O1: revoked people stay listed as Off - restoring is one click.
- S3/O1: reset link is future-only: new URL for new joiners; existing grants keep access (explainer bullets in-dialog).
- S4/O1: depths stay Summary / Full only (no new tiers).
- S5/O1: link joiners land at Summary by default.
- S6/O1: everything lives in the one Share dialog ("Sharing"), opened from the matrix nav button.
- S7/O1: cut-offs and downgrades are silent - the board vanishes from the viewer's picker and tiles; no tombstone.
- S8/O2: each row shows the joined date; no last-viewed tracking.
- S9/O2: master Pause-all switch (LIVE/PAUSED) - hides the board from everyone, keeps every setting.
- S10/O1: paused = the same silent vanish, everywhere.
- S11/O1: reset link needs no confirmation (low stakes per S3).
- S12/O2: public no-login page = pinned first row of the People list, same OFF/SUMMARY/FULL control, off by default, its own URL (independent of the invite link), gated by Pause-all.

## Mobile pass (grill session, 2026-08-22)

- M1: phone journeys = daily entry, adding ops from an invite link, read-only scoreboard glance. Composer and op management stay desktop.
- M2: the matrix keeps ops-as-columns on phone - NO transpose, same mental model everywhere. Day + Score columns pin (position: sticky, left offsets); the ops area scrolls horizontally.
- M3: CSS scroll-snap (x proximity) settles flicks on column edges; no paging, no dots, no JS.
- M4: no custom Roll-N window; the picked window persists per device (wm-window in localStorage); Roll 7 default everywhere.
- M5: nav wraps to two rows on phone (Wrap = default). A Hamburger variant exists behind the mobileNav prop: one-row nav, theme + share in a panel.
- M6: + Add op moved OUT of the nav into the grid on all screens: a ghost dashed "+" column after the last op header. Empty-state CTA kept for new users.
- M7: phone sizing - 44px cells/rows (min tap target), day col 100px, score 48px; stats band 3-across with the 85-rule spanning full-width below; drag-to-paint hint hidden on phone.
- M8: Login stacks single-column under 640px. Display stacks tiles one per row (min 170px, page scrolls), type scales from phone width (vw/430) instead of the 1920 wall formula, and tap reveals the controls. Rows/avg/today grid backgrounds sized width: max-content so tints run the full scroll width.

## Storage keys
`wm-theme`, `wm-user` {name,email,start}, `wm-ops`, `wm-entries`, `wm-sharing` {paused,linkId,publicId,publicDepth,grants}, `wm-board-config`, `wm-display-scale`, `wm-window` (per-device window choice).

## Screens
Login.dc.html · Win Matrix.dc.html · Scoreboard.dc.html · Scoreboard Display.dc.html
