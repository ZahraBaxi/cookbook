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
  SITE_TITLE: "Zahra's Space",
  HOME_SUBTITLE: "My digital inventory & lists for my home.",
  COOKBOOK_SUBTITLE: "Recipes from my kitchen.",
  INVENTORY_SUBTITLE: "What's in the kitchen.",
  MAIN_SITE_URL: "https://zahrabaxi.com",

  // Plants — used to fetch recent weather (Open-Meteo, free, no API key)
  // to nudge outdoor plants' watering schedule. Change to your own
  // coordinates if this ever moves. Defaults to Sacramento, CA.
  WEATHER_LATITUDE: 38.58,
  WEATHER_LONGITUDE: -121.49,
  // If it's rained at least this much (inches) over the last few days,
  // push an outdoor plant's next watering out by WATER_ADJUST_RAIN_DAYS.
  WATER_ADJUST_RAIN_THRESHOLD_IN: 0.2,
  WATER_ADJUST_RAIN_DAYS: 2,
  // If it's been at least this hot (°F, average daily high) with no rain,
  // pull an outdoor plant's next watering in by WATER_ADJUST_HEAT_DAYS.
  WATER_ADJUST_HEAT_THRESHOLD_F: 90,
  WATER_ADJUST_HEAT_DAYS: 1,

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

  // Inventory items are either "Food" (uses the doll-house location/shelf
  // picker below) or "Appliance" (uses a plain free-text location instead,
  // e.g. "On top of fridge" — appliances don't live in the Fridge/Freezer/
  // Pantry grid system at all).
  ITEM_TYPES: ["Food", "Appliance"],

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
