# TASKS — queued for next session

## Done since this file was created
- Local "mental checklist" for non-logged-in grocery viewers (localStorage,
  strikethrough on check, prompts to move to Checkout on PIN unlock).
- Footer version number + updates.html (changelog) + bug.html (bug report
  form -> new BugReport class via createBugReport Cloud Function, fully
  public/ungated, same spirit as a contact form).
- Fixed a systemic [hidden] + .btn CSS specificity bug affecting hidden
  buttons site-wide (was the real cause of the Lock/Unlock both showing).

## Still not started

### Inventory quick-edit via PIN (QR-code friendly)
A lightweight PIN gate on inventory.html (same pattern as groceries.html)
to quickly update a single item's quantity/level, mark it finished
(delete), or move its location/shelf — optimized for: scan a QR code on
a shelf -> land on that item pre-loaded -> one or two taps -> done.
Needs real mobile-first layout.

Open questions before starting (please answer, or I'll pick a default
and note it):
1. Should this reuse the SAME PIN as groceries.html (one PIN for both
   lightweight areas), or a separate PIN just for inventory edits?
   Inventory edits touch real stock data, groceries is more disposable —
   leaning toward keeping them separate unless you'd rather remember one
   PIN. Default if unanswered: separate PIN (new InventorySession class,
   mirrors GrocerySession/groceryLogin exactly).
2. Do you want the app to generate/display an actual scannable QR code
   image (e.g. one per item, printable from Admin), or do you just need
   the URL scheme (inventory.html?item=<id>) to exist so you can make
   your own labels elsewhere? Default if unanswered: just the URL scheme
   for now — QR image generation via a free service (api.qrserver.com)
   can be added after if wanted.

### Full mobile-first CSS pass
Partial progress already made (tab wrapping, row wrapping, modal padding,
nav height, the [hidden] fix). Worth a dedicated pass once the inventory
quick-edit page above exists (build it mobile-first from day one), plus
a real look at plants.html/updates.html/bug.html on an actual phone —
everything so far has only been checked by code review (tag balance,
syntax, id cross-references), not visually in a live browser.
