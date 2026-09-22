# TASKS

Nothing queued right now — everything requested has been built. Add new
items here as they come up.

## Mobile-first CSS pass — completed by code audit
Systematically swept every `display: flex` rule in css/styles.css and
every inline flex style across the HTML/JS. Found and fixed real gaps:
- `.form-actions` (used by nearly every modal in the app: item form,
  recipe form, zone editor, plant editor, grocery location editor,
  quick-edit) had no flex-wrap — 3-button rows could overflow on a
  narrow phone instead of wrapping.
- `.admin-missing-section__header`, `.ingredient-list li`,
  `.component-row__head`, `.storage-editor__resize`, and the small
  button-group rows in Admin/Groceries (EDIT+REMOVE, IGNORE+MERGE, etc.)
  had the same gap.
- The `[hidden]` + `.btn` CSS specificity bug from earlier (hidden
  buttons not actually hiding) — same root-cause category as these.
- Added `overflow-x: hidden` on `html` (not `body`, to avoid breaking
  the sticky nav header) as a defense-in-depth safety net.

This was all verified by code review (grep/awk sweep of every flex
container, brace balance, tag balance, id cross-references) — NOT by
looking at it in an actual browser on an actual phone. That's the one
honest gap left: a real visual pass on a physical device would still be
worth doing whenever there's a chance, since code review catches
structural issues but not, e.g., font sizing that just looks off, or
touch targets that are technically fine but feel cramped in practice.
