/**
 * config.js
 * -----------------------------------------------------------------------
 * Single place to configure the site. Edit values here — nowhere else.
 * -----------------------------------------------------------------------
 */

const CONFIG = {
  // Back4App / Parse credentials.
  // These are the public "client" keys — safe to ship in frontend JS.
  // NEVER put the Master Key or the admin password here.
  PARSE_APP_ID: "rLyvaf4wL6oXTKqKyOXLLHjQJWBAU2aJqmOb08Pg",
  PARSE_JS_KEY: "LM8BtYFmmRMJFNQilQzhJNBCyXCg9bnJgvOyvk9b",
  PARSE_SERVER_URL: "https://parseapi.back4app.com/",

  // Site copy — change wording here and it updates everywhere.
  SITE_TITLE: "Zahra's Kitchen",
  HOME_SUBTITLE: "My digital inventory and lists for my kitchen.",
  COOKBOOK_SUBTITLE: "Recipes from my kitchen.",
  INVENTORY_SUBTITLE: "What's in the kitchen.",
  MAIN_SITE_URL: "https://zahrabaxi.com",

  // sessionStorage key used to hold the admin session token.
  // The token proves a successful adminLogin call; it is not a secret
  // credential itself, but it is still scoped to the browser session.
  ADMIN_TOKEN_KEY: "kitchen_admin_token",
  ADMIN_USER_KEY: "kitchen_admin_user",
  GROCERY_TOKEN_KEY: "kitchen_grocery_token",

  // Controlled vocabulary. Recipes can still use free-form categories/tags —
  // this list only drives the Inventory admin dropdowns and filter chips.
  INVENTORY_CATEGORIES: [
    "Produce", "Dairy", "Protein", "Grains", "Pantry", "Japanese", "Korean",
    "Sauces", "Spices", "Tea", "Frozen", "Snacks", "Baking", "Other",
  ],
  INVENTORY_LOCATIONS: ["Fridge", "Freezer", "Pantry", "Counter", "Other"],

  // Visual layout ("doll house") defaults. Each location gets a grid of
  // cells that admin can carve into named zones (shelves, drawers, bins)
  // in Admin → Layout. These row/col counts are only the STARTING size
  // for a location the first time its layout is opened — admin can
  // resize from there, and the chosen size + zones are saved to the
  // StorageLayout class so they persist and don't reset on reload.
  STORAGE_GRID_DEFAULTS: {
    Fridge: { rows: 6, cols: 4 },
    Freezer: { rows: 4, cols: 3 },
    Pantry: { rows: 6, cols: 4 },
    Counter: { rows: 2, cols: 5 },
    Other: { rows: 3, cols: 3 },
  },
  // Kinds of zone admin can label a selection of cells as — purely
  // descriptive, shown as a small tag under the zone name.
  STORAGE_ZONE_TYPES: ["Shelf", "Drawer", "Door Bin", "Basket", "Bin", "Other"],
  LEVELS: ["Full", "3/4", "Half", "1/4", "Low", "Empty"],
  LOW_LEVELS: ["1/4", "Low", "Empty"],

  // Suggested recipe filter chips. Recipes may carry other categories/tags
  // too — this list just seeds the toolbar with common ones.
  RECIPE_FILTERS: [
    "All", "Japanese", "Korean", "Indian", "Vietnamese", "Baking",
    "Breakfast", "Lunch", "Dinner", "Dessert", "Tea", "Vegetarian",
    "Quick", "Seasonal",
  ],

  // Recipe type — separate from category/tags. Distinguishes a finished
  // dish from the components and projects that feed into it.
  RECIPE_TYPES: ["Meal", "Component", "From Scratch", "Preserve", "Baking", "Project"],
  RECIPE_TYPE_FILTERS: ["All", "Meal", "Component", "From Scratch", "Preserve", "Baking", "Project"],
};
