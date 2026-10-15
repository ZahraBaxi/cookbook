# TASKS

## OF HIGHER IMPORTANCE and still open
Not started
- **grocery.html diy map** polygon tool for stores to pick sections of 
  where what is for a map on where to find the section like produce, bulk, 
  dairy etc? 



## Still open: Map page (favorite places)
Not started. Planned design, so nothing gets re-explained:
- **map.html**, black & white minimal map (Leaflet + free grayscale tiles,
  no API key; or standard tiles with a CSS grayscale filter).
- **Place types are extensible**: a PlaceType class (name + emoji) managed
  in Admin, same pattern as grocery locations. Emoji are user-chosen but
  rendered black & white with a CSS grayscale/contrast filter (these are
  content, not system icons, so they stay emoji rather than Font Awesome).
- **Place** class: name, type, address, lat/lng (geocoded once when the
  place is added in Admin using the free Nominatim service), notes.
- **Directions + hidden home address**: the home address must stay out of
  the public repo, same idea as PARTY_SECRETS in main.js Section 2. Plan:
  a Cloud Function `getHomeAddress` gated by the existing admin
  username/password (zeebug/oatmeal -> adminLogin -> requireAdmin), with
  the address stored only in Cloud Code. map.html shows a small login
  prompt; once authenticated, each place gets a "Get directions" link
  (Google Maps URL from home address to the place). Place addresses
  themselves are public; only YOUR home address is gated.
- Needs a Back4App Cloud Code redeploy + Public Read on the new classes.

## Done
- **grocery admin reorder** (v1.3.0). Admin > Groceries: drag stores by the
  grip handle (or use the arrows) to set the order. Saved as `sortOrder` on
  GroceryLocation and used across groceries.html. Needs a Cloud Code redeploy
  (adds `adminReorderGroceryLocations`, new stores get the next sortOrder).
- **name change of site** (v1.4.0). Renamed to Common Place and the home
  page is now a card hub. Titles come from `SITE_TITLE` in config.js.
- **meal prep** (v1.5.0). mealprep.html: log prep by day, list the easy
  meals each prep makes, tick them off, and reset the week. Reading is
  public, editing needs the admin session (sign in on admin.html in the
  same tab). Needs a Cloud Code redeploy (mealPrepFind, adminSaveMealPrepEntry,
  adminDeleteMealPrepEntry, adminResetMealPrep). No class permission
  change needed (v1.8.2 reads it through mealPrepFind).
- **urban monk rule project** (v1.7.0). No longer separate. Its chapters
  are now three site pages with the shared header, nav, and footer:
  today.html (home, calendar, work, journal, progress), practice.html
  (dharma, movement, place, presence, attention, joy, stewardship), and
  growth.html (learning, reading, craft, sourdough, tea, watchlist). One
  login: the Admin sign-in. Its Plants and Wishlist chapters were removed
  (the site has its own), and nothing was added to the Cookbook.
  Needs a Cloud Code redeploy (monkFind, adminMonkCreate,
  adminMonkUpdate, adminMonkDelete) and, in Back4App, every Monk* class set
  to no public read and no public write. Existing notebook data is kept and
  shows up as is. Old MonkPlant and MonkWishlistItem rows are untouched but
  no longer shown.

- **nav and grocery reorder fixes** (v1.7.1). Nav grouped into Kitchen and
  Life dropdowns so it fits on one line. Grocery store drag reorder
  rewritten. If dragging still snaps back and the toast mentions an
  invalid function, Cloud Code needs a redeploy (adminReorderGroceryLocations).

- **one login, no pins** (v1.8.0, patched in v1.8.1 to restore shared helpers). Everything is viewable by anyone and
  editable only with the Admin sign-in. Grocery and inventory PINs are gone.
  Today, Practice, and Growth are viewable signed out; the Journal needs
  sign-in. Fixed the log-out when opening Practice or Growth (it was
  triggered by the notebook functions not being deployed yet).
  Deploy: paste the complete main.js from the hand-off (Section 1 Common
  Place + Section 2 housewarming getPartyDetails) into Back4App, Deploy.
  Keep main.js out of the public repo (it has the party address/password).

- **grocery reorder not moving** (v1.8.3). The moves work on screen, but
  the order only sticks once Cloud Code has adminReorderGroceryLocations
  (from main.js). Until then the list goes back and shows a red note
  saying why.

- **Cloud Code version check** (v1.8.4). Admin shows a note if the deployed
  main.js is not the same release as the site. Every release that changes
  it bumps CLOUD_CODE_VERSION in it.

## Notes
- Everything is verified by code review only (syntax, tag/brace balance,
  id cross-references, cloud-function parity) — a real pass on a physical
  phone is still worth doing.
- Working files only persist when saved to /mnt/user-data/outputs; the
  build environment has reset mid-session more than once.
