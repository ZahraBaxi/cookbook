/**
 * cloud-code-additions.js
 * -----------------------------------------------------------------------
 * NOT part of the static GitHub Pages site. This is Back4App Cloud Code —
 * paste it into your existing cloud/main.js (or wherever `adminLogin`
 * currently lives) in the Back4App dashboard, then deploy.
 *
 * WHAT'S PRESERVED:
 *   adminLogin's username/password check is unchanged. zeebug / oatmeal
 *   still authenticate exactly as before.
 *
 * WHAT'S ADDED:
 *   1. adminLogin now also writes a short-lived AdminSession record
 *      (token + expiry) using the Master Key, instead of just minting an
 *      unverifiable string. This is what makes the token checkable.
 *   2. A requireAdmin() helper that every write function calls first —
 *      it looks up the AdminSession by token and rejects if it's
 *      missing/expired. This is the actual server-side authorization
 *      the brief asked for: the frontend can send whatever it wants,
 *      but only a token that matches a real, unexpired session saved
 *      during adminLogin will be accepted.
 *   3. CRUD Cloud Functions for InventoryItem and Recipe, plus a
 *      whole-record upsert (adminSaveStorageLayout) for StorageLayout —
 *      the visual doll-house grid used in Admin → Layout. All of them
 *      use the Master Key internally (so they work regardless of
 *      Class-Level Permissions) but are gated by requireAdmin().
 *   4. A separate, much lighter PIN gate for the grocery list
 *      (groceries.html) — groceryLogin checks a 4-digit PIN (not the
 *      admin password) and writes a GrocerySession record; adding/
 *      removing grocery items goes through requireGroceryAccess()
 *      instead of requireAdmin(). This is intentionally low-stakes,
 *      the same spirit as the housewarming site's shared password —
 *      meant to keep casual visitors out, not withstand a determined
 *      attacker. The list of shopping locations (name + emoji) is
 *      still admin-only to edit, via requireAdmin() as usual.
 *
 * ONE MORE STEP ON THE BACK4APP DASHBOARD:
 *   Set InventoryItem, Recipe, StorageLayout, GroceryItem, and
 *   GroceryLocation's Class-Level Permissions to "Public Read" and NO
 *   public write/update/delete. That way even if someone got hold of
 *   your App ID/JS Key (which are meant to be public), they still can't
 *   write directly through the client SDK — every write has to go
 *   through these Cloud Functions, which check the admin session or
 *   grocery PIN session as appropriate.
 * -----------------------------------------------------------------------
 */

const ADMIN_USERNAME = "zeebug";
const ADMIN_PASSWORD = "oatmeal";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const GROCERY_PIN = "1234"; // change this to whatever you want people to enter
const GROCERY_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days — low-stakes, meant to stay unlocked on your phone

const AdminSession = Parse.Object.extend("AdminSession");
const InventoryItem = Parse.Object.extend("InventoryItem");
const Recipe = Parse.Object.extend("Recipe");
const StorageLayout = Parse.Object.extend("StorageLayout");
const GrocerySession = Parse.Object.extend("GrocerySession");
const GroceryItem = Parse.Object.extend("GroceryItem");
const GroceryLocation = Parse.Object.extend("GroceryLocation");
const Plant = Parse.Object.extend("Plant");

Parse.Cloud.define("adminLogin", async (request) => {
  const { username, password } = request.params;

  if (!username || !password) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      "username and password are required"
    );
  }

  const usernameOk = username === ADMIN_USERNAME;
  const passwordOk = password === ADMIN_PASSWORD;

  if (!usernameOk || !passwordOk) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      "unauthorized"
    );
  }

  const token = "closet-admin-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);

  const session = new AdminSession();
  session.set("token", token);
  session.set("username", username);
  session.set("expiresAt", new Date(Date.now() + SESSION_TTL_MS));
  await session.save(null, { useMasterKey: true });

  return { token };
});

/**
 * Throws unless `adminToken` matches a real, unexpired AdminSession.
 * Every admin write function calls this first.
 */
async function requireAdmin(adminToken) {
  if (!adminToken) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Missing admin token.");
  }
  const query = new Parse.Query(AdminSession);
  query.equalTo("token", adminToken);
  const session = await query.first({ useMasterKey: true });
  if (!session) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Invalid admin session.");
  }
  if (session.get("expiresAt") < new Date()) {
    await session.destroy({ useMasterKey: true });
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Admin session expired. Please sign in again.");
  }
  return session;
}

const INVENTORY_FIELDS = ["name", "variant", "category", "location", "shelf", "quantity", "unit", "level", "notes", "itemType"];

function applyInventoryFields(item, params) {
  INVENTORY_FIELDS.forEach((field) => {
    if (params[field] !== undefined) item.set(field, params[field]);
  });
  if (params.expirationDate) {
    item.set("expirationDate", new Date(params.expirationDate));
  } else if (params.expirationDate === null) {
    item.unset("expirationDate");
  }
}

Parse.Cloud.define("adminCreateInventoryItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const item = new InventoryItem();
  applyInventoryFields(item, request.params);
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

Parse.Cloud.define("adminUpdateInventoryItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(InventoryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  applyInventoryFields(item, request.params);
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

Parse.Cloud.define("adminDeleteInventoryItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(InventoryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  await item.destroy({ useMasterKey: true });
  return { success: true };
});

const RECIPE_FIELDS = ["title", "description", "category", "recipeType", "difficulty", "servings", "prepTime", "cookTime", "instructions", "notes"];

function applyRecipeFields(recipe, params) {
  RECIPE_FIELDS.forEach((field) => {
    if (params[field] !== undefined) recipe.set(field, params[field]);
  });
  if (params.tags !== undefined) recipe.set("tags", params.tags);
  if (params.ingredients !== undefined) recipe.set("ingredients", params.ingredients);
  if (params.requiresRecipes !== undefined) recipe.set("requiresRecipes", params.requiresRecipes);
  if (params.requiredAppliances !== undefined) recipe.set("requiredAppliances", params.requiredAppliances);
}

Parse.Cloud.define("adminCreateRecipe", async (request) => {
  await requireAdmin(request.params.adminToken);
  const recipe = new Recipe();
  applyRecipeFields(recipe, request.params);
  await recipe.save(null, { useMasterKey: true });
  return recipe.toJSON();
});

Parse.Cloud.define("adminUpdateRecipe", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(Recipe);
  const recipe = await query.get(request.params.id, { useMasterKey: true });
  applyRecipeFields(recipe, request.params);
  await recipe.save(null, { useMasterKey: true });
  return recipe.toJSON();
});

Parse.Cloud.define("adminDeleteRecipe", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(Recipe);
  const recipe = await query.get(request.params.id, { useMasterKey: true });
  await recipe.destroy({ useMasterKey: true });
  return { success: true };
});

/**
 * Visual "doll house" storage layout (Admin → Layout). One StorageLayout
 * record per location (Fridge/Freezer/Pantry/Counter/Other), holding its
 * grid size and the list of named zones drawn on it. The frontend always
 * sends the *whole* layout for a location — this upserts it wholesale
 * rather than diffing individual zones, which keeps the client-side grid
 * editor simple (it just mutates a local object and re-saves it).
 */
Parse.Cloud.define("adminSaveStorageLayout", async (request) => {
  await requireAdmin(request.params.adminToken);
  const { location, rows, cols, zones } = request.params;
  if (!location) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, "location is required");
  }
  const query = new Parse.Query(StorageLayout);
  query.equalTo("location", location);
  let layout = await query.first({ useMasterKey: true });
  if (!layout) {
    layout = new StorageLayout();
    layout.set("location", location);
  }
  layout.set("rows", rows || 1);
  layout.set("cols", cols || 1);
  layout.set("zones", Array.isArray(zones) ? zones : []);
  await layout.save(null, { useMasterKey: true });
  return layout.toJSON();
});

/* ============================================================
   Grocery list — PIN-gated, separate from admin login
   ============================================================ */

Parse.Cloud.define("groceryLogin", async (request) => {
  const { pin } = request.params;
  if (pin !== GROCERY_PIN) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Incorrect PIN.");
  }
  const token = "grocery-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  const session = new GrocerySession();
  session.set("token", token);
  session.set("expiresAt", new Date(Date.now() + GROCERY_SESSION_TTL_MS));
  await session.save(null, { useMasterKey: true });
  return { token };
});

/**
 * Throws unless `groceryToken` matches a real, unexpired GrocerySession.
 * Deliberately separate from requireAdmin() — this is a much lower bar
 * (a shared 4-digit PIN, not a username/password), on purpose, so it's
 * easy to hand to someone else without giving them full admin access.
 */
async function requireGroceryAccess(groceryToken) {
  if (!groceryToken) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Missing grocery access token.");
  }
  const query = new Parse.Query(GrocerySession);
  query.equalTo("token", groceryToken);
  const session = await query.first({ useMasterKey: true });
  if (!session) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Invalid grocery session.");
  }
  if (session.get("expiresAt") < new Date()) {
    await session.destroy({ useMasterKey: true });
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Grocery session expired. Please enter the PIN again.");
  }
  return session;
}

const GROCERY_ITEM_FIELDS = ["name", "category", "location", "bulk", "status", "url"];

function applyGroceryItemFields(item, params) {
  GROCERY_ITEM_FIELDS.forEach((field) => {
    if (params[field] !== undefined) item.set(field, params[field]);
  });
}

Parse.Cloud.define("groceryCreateItem", async (request) => {
  await requireGroceryAccess(request.params.groceryToken);
  const item = new GroceryItem();
  applyGroceryItemFields(item, request.params);
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

Parse.Cloud.define("groceryUpdateItem", async (request) => {
  await requireGroceryAccess(request.params.groceryToken);
  const query = new Parse.Query(GroceryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  applyGroceryItemFields(item, request.params);
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

Parse.Cloud.define("groceryDeleteItem", async (request) => {
  await requireGroceryAccess(request.params.groceryToken);
  const query = new Parse.Query(GroceryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  await item.destroy({ useMasterKey: true });
  return { success: true };
});

/**
 * "Put away" a checked-out grocery item: creates the real InventoryItem
 * with whatever details were filled in (location, shelf, quantity, unit,
 * level, expiration, notes — the exact same fields as the admin item
 * form), then removes it from the grocery list entirely since it's now
 * fully migrated into Inventory. Deliberately gated by the grocery PIN,
 * not full admin login — this is the everyday "I'm putting groceries
 * away" action, and requiring a separate admin session for it would
 * defeat the point of the lighter PIN. Worth knowing: this does mean
 * anyone with the grocery PIN can create Inventory records this way, not
 * just Grocery ones.
 */
Parse.Cloud.define("groceryCheckoutToInventory", async (request) => {
  await requireGroceryAccess(request.params.groceryToken);
  const { groceryItemId } = request.params;

  const item = new InventoryItem();
  applyInventoryFields(item, request.params);
  await item.save(null, { useMasterKey: true });

  if (groceryItemId) {
    const groceryQuery = new Parse.Query(GroceryItem);
    const groceryItem = await groceryQuery.get(groceryItemId, { useMasterKey: true });
    await groceryItem.destroy({ useMasterKey: true });
  }

  return item.toJSON();
});

/**
 * Lets the grocery-PIN-gated pages delete an InventoryItem directly —
 * used for "mark this low-stock item as finished, take it off the shelf
 * entirely" right from the grocery list, without needing a separate
 * admin login. Same trade-off noted above: the grocery PIN can now touch
 * Inventory too, not just the grocery list.
 */
Parse.Cloud.define("groceryDeleteInventoryItem", async (request) => {
  await requireGroceryAccess(request.params.groceryToken);
  const query = new Parse.Query(InventoryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  await item.destroy({ useMasterKey: true });
  return { success: true };
});

/**
 * Shopping locations (name + emoji, e.g. "🥕 Sac Central Farmers Market")
 * are admin-managed, NOT grocery-PIN managed — set up once in
 * Admin → Groceries, then everyone with the grocery PIN just picks from
 * the list. Upserts by id: pass no id to create, an id to edit.
 * `hasBulkBins` marks a location as having a bulk-bin section, which is
 * what lets the "Bulk section" checkbox show up when adding an item
 * tagged to that location.
 */
Parse.Cloud.define("adminSaveGroceryLocation", async (request) => {
  await requireAdmin(request.params.adminToken);
  const { id, name, emoji, hasBulkBins } = request.params;
  let location;
  if (id) {
    location = await new Parse.Query(GroceryLocation).get(id, { useMasterKey: true });
  } else {
    location = new GroceryLocation();
  }
  if (name !== undefined) location.set("name", name);
  if (emoji !== undefined) location.set("emoji", emoji);
  if (hasBulkBins !== undefined) location.set("hasBulkBins", !!hasBulkBins);
  await location.save(null, { useMasterKey: true });
  return location.toJSON();
});

Parse.Cloud.define("adminDeleteGroceryLocation", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(GroceryLocation);
  const location = await query.get(request.params.id, { useMasterKey: true });
  await location.destroy({ useMasterKey: true });
  return { success: true };
});

/* ============================================================
   Plants — location + watering schedule. Admin-only (not shared like
   groceries); the weather-based schedule adjustment itself happens
   client-side (Open-Meteo, no key needed), Cloud Code just stores the
   plant's own data (name, location, indoor/outdoor, baseline watering
   frequency, last watered date, notes).
   ============================================================ */

Parse.Cloud.define("adminSavePlant", async (request) => {
  await requireAdmin(request.params.adminToken);
  const { id, name, location, isOutdoor, baseWaterDays, notes } = request.params;
  let plant;
  if (id) {
    plant = await new Parse.Query(Plant).get(id, { useMasterKey: true });
  } else {
    plant = new Plant();
  }
  if (name !== undefined) plant.set("name", name);
  if (location !== undefined) plant.set("location", location);
  if (isOutdoor !== undefined) plant.set("isOutdoor", !!isOutdoor);
  if (baseWaterDays !== undefined) plant.set("baseWaterDays", Number(baseWaterDays) || 7);
  if (notes !== undefined) plant.set("notes", notes);
  if (!plant.get("lastWatered")) plant.set("lastWatered", new Date());
  await plant.save(null, { useMasterKey: true });
  return plant.toJSON();
});

Parse.Cloud.define("adminLogPlantWatering", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(Plant);
  const plant = await query.get(request.params.id, { useMasterKey: true });
  plant.set("lastWatered", new Date());
  await plant.save(null, { useMasterKey: true });
  return plant.toJSON();
});

Parse.Cloud.define("adminDeletePlant", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(Plant);
  const plant = await query.get(request.params.id, { useMasterKey: true });
  await plant.destroy({ useMasterKey: true });
  return { success: true };
});
