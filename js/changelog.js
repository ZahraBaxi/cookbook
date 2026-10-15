/**
 * changelog.js
 * -----------------------------------------------------------------------
 * Plain data, read by updates.html. Add a new entry to the TOP of
 * CHANGELOG each time something ships — no build step, just edit this
 * array by hand (or ask Claude to add an entry after a round of changes).
 * -----------------------------------------------------------------------
 */

const CHANGELOG = [
  {
    version: "v1.8.5",
    date: "2026-10-15",
    changes: [
      "Changed: the Meal Prep page now says plainly when the latest Cloud Code has not been deployed yet, instead of only showing the raw error.",
    ],
  },
  {
    version: "v1.8.4",
    date: "2026-10-14",
    changes: [
      "Added: the Admin page now checks whether the Cloud Code on Back4App matches the site and shows a note if it is out of date or not deployed. That is the usual reason a save fails with Invalid function.",
    ],
  },
  {
    version: "v1.8.3",
    date: "2026-10-14",
    changes: [
      "Fixed: when the grocery store order can't be saved, the list used to snap back with only a brief message. Now a red note stays above the list and says why, including a reminder to redeploy Cloud Code if the save function is missing.",
    ],
  },
  {
    version: "v1.8.2",
    date: "2026-10-14",
    changes: [
      "Fixed: Add prep on the Meal Prep page now saves and shows up on the page. The page reads the plan through a Cloud Function, so it no longer depends on the class being set to public read in Back4App.",
      "Changed: Meal Prep errors now say what went wrong, and an ended sign-in asks you to sign in again.",
    ],
  },
  {
    version: "v1.8.1",
    date: "2026-10-14",
    changes: [
      "Fixed: the Cookbook (and other pages) failed to load with a starRating is not defined error. A cleanup of the old PIN code in v1.8.0 removed a few shared helpers by mistake. They are back.",
    ],
  },
  {
    version: "v1.8.0",
    date: "2026-10-14",
    changes: [
      "Fixed: signing in and then opening Practice or Growth no longer signs you back out.",
      "Changed: one sign-in for the whole site. Everyone can view every page. Editing anything needs the Admin sign-in.",
      "Removed: the grocery PIN and the inventory PIN. Groceries and Inventory now show Sign in to edit, which takes you to Admin and brings you straight back to the same page.",
      "Changed: Today, Practice, and Growth can be viewed without signing in. Editing needs sign-in, and the Journal stays private until you sign in.",
    ],
  },
  {
    version: "v1.7.1",
    date: "2026-10-14",
    changes: [
      "Fixed: the nav was crowded and wrapping onto two lines. It is now grouped into five items: Kitchen (Cookbook, Inventory, Groceries, Meal Prep), Plants, Wishlist, Life (Today, Practice, Growth), and Admin. Kitchen and Life open as dropdowns, and open out flat in the phone menu.",
      "Fixed: dragging grocery stores to reorder them in Admin. Dragging now follows the pointer reliably, shows a line where the store will land, and the save error now says what went wrong.",
    ],
  },
  {
    version: "v1.7.0",
    date: "2026-10-13",
    changes: [
      "Changed: Urban Monk Rule is no longer a separate app. Its chapters are now three regular Common Place pages: Today (home, calendar, work, journal, progress), Practice (dharma, movement, place, presence, attention, joy, stewardship), and Growth (learning, reading, craft, sourdough, tea, watchlist). Each has the site header, nav, and footer, with a row of section tabs.",
      "Changed: one login. The notebook's own sign-up and login are gone. These pages open with the same Admin sign-in as the rest of the site, and show a short sign-in prompt if you are not signed in.",
      "Changed: the notebook's data now goes through the site's private Cloud Functions, so the journal and everything else stays private instead of publicly readable.",
      "Changed: nav and home hub now have Today, Practice, and Growth. The nav fits ten links, with the hamburger menu under 960px wide.",
      "Removed: the notebook's Plants and Wishlist chapters, since the site already has its own Plants and Wishlist pages. Sourdough and tea recipes stay in their own chapters and were not added to the Cookbook.",
    ],
  },
  {
    version: "v1.6.1",
    date: "2026-10-13",
    changes: [
      "Changed: Urban Monk Rule is now a real Common Place page at monk.html instead of a separate app. It has the site header, nav link, page header, and footer like every other page.",
      "Changed: the notebook now uses the site's fonts, colors, buttons, inputs, and popups, and its login is a card on the page instead of a full-screen takeover.",
      "Changed: the nav now fits eight links, with a hamburger menu on screens under 860px wide.",
      "Kept: the same Back4App database and saved data, with no changes to how the notebook stores anything.",
    ],
  },
  {
    version: "v1.6.0",
    date: "2026-10-13",
    changes: [
      "Added: Urban Monk Rule, the digital field notebook, now lives inside Common Place at monk/index.html. All of its chapters (rhythm, dharma, journal, learning, reading, and the rest) came over unchanged, with the same accounts and saved data.",
      "Added: Urban Monk Rule card on the home hub, and a Back to Common Place link on its login screen, sidebar, and mobile menu.",
      "Changed: the notebook's on-screen title is now Urban Monk Rule so it does not clash with the site name.",
    ],
  },
  {
    version: "v1.5.0",
    date: "2026-10-13",
    changes: [
      "Added: Meal Prep page. Log what you prepped and which day (two entries cover a split like half Saturday, half Sunday), and list the easy meals each prep makes, like quesadillas for lunch or curry for dinner.",
      "Added: a Ready to eat view that groups the prepped meals by breakfast, lunch, and dinner. Tick a meal off when it is eaten.",
      "Added: Reset week button to clear everything and start the next week fresh.",
      "Added: Meal Prep in the nav and as a card on the home hub.",
    ],
  },
  {
    version: "v1.4.0",
    date: "2026-10-13",
    changes: [
      "Changed: site renamed from Zahra's Space to Common Place, in the nav, page titles, footer, and README.",
      "Changed: the home page is now a hub with a card for each section (Cookbook, Inventory, Groceries, Plants, Wishlist) instead of three buttons.",
    ],
  },
  {
    version: "v1.3.0",
    date: "2026-10-13",
    changes: [
      "Added: reorder grocery stores in Admin > Groceries. Drag a store by its grip handle, or use the up and down arrows on a phone.",
      "Changed: the grocery list (shopping, checkout, and store filters) now follows that same store order instead of alphabetical. Stores with no saved order fall to the bottom. No store always comes last.",
    ],
  },
  {
    version: "v1.2.0",
    date: "2026-10-10",
    changes: [
      "Added: Wishlist page — future appliances/furniture/etc. with link, price, store, extensible type tags, and a savings tracker showing how much you've set aside toward each.",
      "Added: \"To Use\" flag on Inventory items (going bad, sitting too long...) — recipes that use flagged items float to the top of Cookbook with a note on why, to reduce food waste.",
      "Changed: PIN entry is now four separate digit boxes with auto-advance, paste support, and auto-submit.",
      "Changed: all system icons are now Font Awesome, solid black (lock/unlock, links, etc.).",
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-09-20",
    changes: [
      "Added: quick-edit for Inventory items via a separate PIN — update quantity/level/location/shelf or mark an item finished in a couple of taps, e.g. after scanning a QR code taped to a shelf.",
      "Added: inventory.html?item=&lt;id&gt; deep-links straight to that item's quick-edit modal.",
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-09-20",
    changes: [
      "Fixed: hidden buttons using the .btn class weren't actually hiding (CSS specificity conflict) — affected Lock/Unlock and other hidden buttons site-wide.",
      "Fixed: Cloud Code was missing recipeType, difficulty, and requiresRecipes fields — those values may not have been saving.",
      "Added: Plants tab (public, no login) — watering schedule with weather-based adjustments for outdoor plants.",
      "Added: checkboxes now black & white instead of default blue.",
      "Added: optional link field on grocery items.",
      "Added: local (offline) checklist on the grocery list for people without the PIN, with an option to move checked items to Checkout once unlocked.",
      "Added: 'date added' shown on Inventory items.",
      "Added: editing an item before finishing a duplicate merge, instead of merging as-is.",
      "Changed: site name to \"Zahra's Space.\"",
    ],
  },
  {
    version: "v0.9.0",
    date: "2026-09-19",
    changes: [
      "Added: Appliances as a separate item type in Inventory, with recipes able to require specific appliances.",
      "Added: per-store shareable grocery list links and multi-select store filters.",
      "Added: Plants tracker in Admin with Open-Meteo weather integration.",
      "Added: bulk-select + delete in Admin Inventory and Recipes.",
    ],
  },
  {
    version: "v0.8.0",
    date: "2026-09-17",
    changes: [
      "Added: Grocery list checkout pile — checking off an item moves it to Checkout, then \"Put Away\" logs it straight into Inventory.",
      "Added: low-stock suggestions on the grocery list, with a one-tap \"Finished\" to remove from Inventory.",
      "Fixed: the grocery PIN was a confusing inline form — now a proper modal.",
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-09-16",
    changes: [
      "Added: groceries.html — a shareable, PIN-gated shopping list with bulk-bin support.",
      "Added: British/American ingredient alias dictionary for recipe matching.",
      "Added: optional \"Type\" field on Inventory items (e.g. Roma vs. Cherry tomato) that plays nicely with duplicate detection.",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-09-10",
    changes: [
      "Added: visual \"doll house\" storage layout editor for Fridge/Freezer/Pantry.",
      "Fixed: ingredient matching that missed common cases like \"oil for frying\" or multi-word alternatives.",
      "Added: Similar Inventory Items and Needed for Recipes duplicate/gap detection in Admin.",
    ],
  },
];
