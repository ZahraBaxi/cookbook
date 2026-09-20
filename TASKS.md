# TASKS — queued for next session

Not started yet. Everything else requested has been built (see chat/README).
Written here so nothing gets lost or re-explained from scratch.

## 1. Local "mental checklist" for non-logged-in grocery viewers
On groceries.html's read-only view, let an unauthenticated visitor tap
items to check them off LOCALLY (localStorage only, a plain array of
checked GroceryItem ids — not sent to the server, since they have no
write access). Checked items should look visually checked-off (e.g.
strikethrough) but stay in the list. If they then unlock with the PIN,
show a prompt: "Add your N selected items to checkout?" — on confirm,
call groceryUpdateItem for each with status: "checkedOut" (reuse the
existing Checkout pile machinery), then clear the local selection.
- Needs: a local storage key (e.g. kitchen_grocery_local_checks), a
  render tweak to renderReadonlyList() for the checked visual state and
  click handling, and a small confirm UI wired into handlePinSubmit's
  success path (check localStorage for any local picks before/after
  unlocking and prompt then).

## 2. Inventory quick-edit via PIN (QR-code friendly)
A lightweight PIN gate on inventory.html (same UX pattern as groceries.html
— public read-only browsing already works, add an "Unlock to edit" modal)
that lets someone quickly update a SINGLE item's quantity/level, mark it
finished (delete), or change its location/shelf — optimized for: scan a
QR code stuck on a shelf/bin -> land on that specific item pre-loaded ->
one or two taps -> done. Needs real mobile-first layout (large touch
targets, minimal scrolling to the relevant controls).
- Needs: new Cloud Functions gated by a NEW lightweight session (mirror
  GrocerySession/groceryLogin exactly, but call it InventorySession /
  inventoryLogin so it's a separate PIN from groceries) —
  inventoryUpdateItemQuick(id, quantity/level/location/shelf) and
  inventoryDeleteItem(id) (or just reuse groceryToken/requireGroceryAccess
  if one shared "editing PIN" across groceries+inventory quick-edit is
  preferred — ask the user which they want before building, since it
  changes the security model).
- QR angle: each item's URL would be like inventory.html?item=<id> to
  deep-link straight to it. Generating/printing actual QR codes is out of
  scope for the web app itself — can mention a free QR generator (e.g.
  api.qrserver.com) that takes a URL and returns a PNG, so the user can
  make their own labels, but confirm this is wanted before building.

## 3. Footer version number + changelog + bug reports
- Add a version string (e.g. semantic-ish "v1.4.0" or a date-based one)
  to CONFIG, shown in the footer, linking to updates.html.
- updates.html: a simple static-feeling page (could be hand-maintained
  markdown-like content in a JS array, similar to CONFIG) listing each
  version: date published, and a bullet list of fixes/changes. Since this
  project doesn't have a build step, simplest approach is a plain JS array
  in a new js/changelog.js file that updates.html reads and renders —
  means updating that array by hand after each round of changes (I can
  keep it in sync going forward as we ship things, if the user wants).
- bug.html: a form (name/description/severity, maybe a page-it-happened-on
  field) that submits to a new BugReport Parse class via a new Cloud
  Function (adminOnly to READ the reports back, but the SUBMIT action
  itself needs to be doable by anyone with no login — so either a fully
  open, ungated createBugReport Cloud Function with light server-side
  validation/rate-limiting considerations, or route it through the
  grocery-style PIN — recommend fully open since bug reports from anyone
  are a feature, not a risk, similar to how a public contact form works).
- Footer order requested: copyright, made-by link, report a bug, update
  version — rebuild the data-site-footer HTML string in js/utils.js
  applySiteCopy() to match that order once the version/updates/bug
  pieces above exist.

## 4. Full mobile-first CSS pass
Partial progress already made (tab wrapping, row wrapping, modal padding,
nav height, the [hidden] specificity bug). Still worth a dedicated pass
once the above pages exist, especially:
- The new inventory quick-edit flow (#2) needs to be mobile-first from
  day one, not retrofitted.
- Re-check all new pages (plants.html, updates.html, bug.html) once built
  against a real phone viewport, not just code review.
- Consider bumping small touch targets (.btn--small is 36px min-height;
  44px is the usual recommended minimum) if the user finds them fiddly
  on a real phone.

## Open questions to ask the user before starting #2 in particular
- Should inventory quick-edit share the SAME PIN as groceries, or a
  separate one? (Affects whether it's one login for both lightweight
  areas, or two PINs to remember.)
- Do they want actual QR code images generated/downloadable from the
  admin panel (e.g. one per item, printable), or are they generating/
  printing those themselves elsewhere and just need the URL scheme to
  exist?
