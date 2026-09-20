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
