# TASKS

## Done
Everything requested so far has been built. This file exists so future
work doesn't get lost between sessions — add new items here as they come
up, remove them once shipped.

## Still open: mobile-first CSS pass
Partial progress made throughout (tab wrapping, row wrapping, modal
padding, nav height, the [hidden]+.btn specificity fix). Worth a
dedicated visual pass on an actual phone once there's a moment — nothing
so far has been checked in a live browser, only by code review (syntax,
tag balance, cloud function parity, id cross-references). Particularly
worth checking:
- The new Inventory quick-edit modal (quantity/level/location/shelf) —
  built mobile-first in intent, but unverified in a real viewport.
- plants.html / updates.html / bug.html, all new this round.
