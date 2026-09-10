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
  SITE_TITLE: "THE KITCHEN",
  COOKBOOK_SUBTITLE: "Recipes from my kitchen.",
  INVENTORY_SUBTITLE: "What's in the kitchen.",

  // sessionStorage key used to hold the admin session token.
  // The token proves a successful adminLogin call; it is not a secret
  // credential itself, but it is still scoped to the browser session.
  ADMIN_TOKEN_KEY: "kitchen_admin_token",
  ADMIN_USER_KEY: "kitchen_admin_user",

  // Controlled vocabulary. Recipes can still use free-form categories/tags —
  // this list only drives the Inventory admin dropdowns and filter chips.
  INVENTORY_CATEGORIES: [
    "Produce", "Dairy", "Protein", "Grains", "Pantry", "Japanese", "Korean",
    "Sauces", "Spices", "Tea", "Frozen", "Snacks", "Baking", "Other",
  ],
  INVENTORY_LOCATIONS: ["Fridge", "Freezer", "Pantry", "Counter", "Other"],
  SHELF_OPTIONS: {
    Pantry: ["Shelf 1", "Shelf 2", "Shelf 3", "Shelf 4", "Other"],
    Fridge: ["Top", "Middle", "Bottom", "Door", "Crisper", "Other"],
    Freezer: ["Top", "Bottom", "Door", "Other"],
    Counter: ["Other"],
    Other: ["Other"],
  },
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
