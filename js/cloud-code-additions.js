/**
 * cloud-code-additions.js
 * -----------------------------------------------------------------------
 * NOT part of the static GitHub Pages site. This is Back4App Cloud Code.
 *
 * This is SECTION 1 of the full main.js (the Common Place code). The live
 * main.js also has SECTION 2, the housewarming site's getPartyDetails, which
 * is kept out of this public repo on purpose because it holds the party
 * address and password. Always deploy the complete main.js that comes with
 * each release, not this file on its own.
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
 *   4. Grocery list and inventory quick-edit editing use the same admin
 *      session as everything else. There are no PINs. Viewing stays public.
 * -----------------------------------------------------------------------
 */

const ADMIN_USERNAME = "zeebug";
const ADMIN_PASSWORD = "oatmeal";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours



const AdminSession = Parse.Object.extend("AdminSession");
const InventoryItem = Parse.Object.extend("InventoryItem");
const Recipe = Parse.Object.extend("Recipe");
const StorageLayout = Parse.Object.extend("StorageLayout");
const GroceryItem = Parse.Object.extend("GroceryItem");
const GroceryLocation = Parse.Object.extend("GroceryLocation");
const Plant = Parse.Object.extend("Plant");
const BugReport = Parse.Object.extend("BugReport");
const WishlistItem = Parse.Object.extend("WishlistItem");
const MealPrepEntry = Parse.Object.extend("MealPrepEntry");

// Bump this with every release. The Admin page compares it with the site's
// version so you can tell at a glance whether the latest Cloud Code is live.
const CLOUD_CODE_VERSION = "v1.8.6";

Parse.Cloud.define("commonPlaceVersion", async () => ({ version: CLOUD_CODE_VERSION }));

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

const INVENTORY_FIELDS = ["name", "variant", "category", "location", "shelf", "quantity", "unit", "level", "notes", "itemType", "toUse", "toUseReason"];

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
   Grocery list — anyone can view it; editing needs the admin session
   (the one site sign-in). Every grocery write function below calls
   requireAdmin() first.
   ============================================================ */

const GROCERY_ITEM_FIELDS = ["name", "category", "location", "bulk", "status", "url"];

function applyGroceryItemFields(item, params) {
  GROCERY_ITEM_FIELDS.forEach((field) => {
    if (params[field] !== undefined) item.set(field, params[field]);
  });
}

Parse.Cloud.define("groceryCreateItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const item = new GroceryItem();
  applyGroceryItemFields(item, request.params);
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

Parse.Cloud.define("groceryUpdateItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(GroceryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  applyGroceryItemFields(item, request.params);
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

Parse.Cloud.define("groceryDeleteItem", async (request) => {
  await requireAdmin(request.params.adminToken);
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
 * fully migrated into Inventory. Gated by the admin session,
 * not full admin login — this is the everyday "I'm putting groceries
 * away" action, and requiring a separate admin session for it would
 * route around it. Worth knowing: this is
 * admin-only, so only a signed-in admin can create Inventory records this way, not
 * just Grocery ones.
 */
Parse.Cloud.define("groceryCheckoutToInventory", async (request) => {
  await requireAdmin(request.params.adminToken);
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
 * Lets the grocery page delete an InventoryItem directly —
 * used for "mark this low-stock item as finished, take it off the shelf
 * entirely" right from the grocery list, without needing a separate
 * admin login. Same trade-off noted above: admin-gated, so only a signed-in admin can touch
 * Inventory too, not just the grocery list.
 */
Parse.Cloud.define("groceryDeleteInventoryItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(InventoryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  await item.destroy({ useMasterKey: true });
  return { success: true };
});

/**
 * Shopping locations (name + emoji, e.g. "🥕 Sac Central Farmers Market")
 * are set up once in
 * Admin → Groceries, then the grocery page just picks from
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
    // New locations go to the bottom of the admin-chosen order.
    const last = await new Parse.Query(GroceryLocation).descending("sortOrder").first({ useMasterKey: true });
    const lastOrder = last && typeof last.get("sortOrder") === "number" ? last.get("sortOrder") : -1;
    location.set("sortOrder", lastOrder + 1);
  }
  if (name !== undefined) location.set("name", name);
  if (emoji !== undefined) location.set("emoji", emoji);
  if (hasBulkBins !== undefined) location.set("hasBulkBins", !!hasBulkBins);
  await location.save(null, { useMasterKey: true });
  return location.toJSON();
});

/**
 * Saves the admin-chosen order of shopping locations. `ids` is the full
 * list of GroceryLocation ids in the order they should appear; each gets
 * its index as `sortOrder`. Read-only users never see this — it only
 * changes the order stores are listed on groceries.html.
 */
Parse.Cloud.define("adminReorderGroceryLocations", async (request) => {
  await requireAdmin(request.params.adminToken);
  const ids = request.params.ids;
  if (!Array.isArray(ids)) throw new Error("ids must be an array.");
  const locations = await new Parse.Query(GroceryLocation).containedIn("objectId", ids).limit(1000).find({ useMasterKey: true });
  const byId = new Map(locations.map((l) => [l.id, l]));
  ids.forEach((id, i) => {
    const loc = byId.get(id);
    if (loc) loc.set("sortOrder", i);
  });
  await Parse.Object.saveAll(Array.from(byId.values()), { useMasterKey: true });
  return { success: true };
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

/**
 * Bug reports (bug.html) — deliberately NOT gated by any login,
 * same as a public contact form: anyone should be able to report a
 * problem without needing credentials. There's no public "read" of these
 * anywhere in the app — check them in the Back4App dashboard directly
 * (Core > Browser > BugReport), or ask Claude to build an Admin tab for
 * them if you want that later.
 */
Parse.Cloud.define("createBugReport", async (request) => {
  const { name, page, severity, description } = request.params;
  if (!description || !description.trim()) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, "Please describe the bug.");
  }
  const report = new BugReport();
  report.set("name", (name || "").trim());
  report.set("page", (page || "").trim());
  report.set("severity", severity || "Minor");
  report.set("description", description.trim());
  report.set("appVersion", request.params.appVersion || "");
  await report.save(null, { useMasterKey: true });
  return { success: true };
});

/* ============================================================
   Wishlist — future purchases with price, store, link, type tags, and
   a savings tracker. Admin-only writes; the public wishlist.html reads.
   ============================================================ */

Parse.Cloud.define("adminSaveWishlistItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const { id, name, url, price, store, tags, saved, notes } = request.params;
  let item;
  if (id) {
    item = await new Parse.Query(WishlistItem).get(id, { useMasterKey: true });
  } else {
    item = new WishlistItem();
  }
  if (name !== undefined) item.set("name", name);
  if (url !== undefined) item.set("url", url);
  if (price !== undefined) item.set("price", Number(price) || 0);
  if (store !== undefined) item.set("store", store);
  if (tags !== undefined) item.set("tags", Array.isArray(tags) ? tags : []);
  if (saved !== undefined) item.set("saved", Math.max(0, Number(saved) || 0));
  if (notes !== undefined) item.set("notes", notes);
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

// Adds (or, with a negative number, removes) money set aside toward a wishlist item.
Parse.Cloud.define("adminAddWishlistSavings", async (request) => {
  await requireAdmin(request.params.adminToken);
  const item = await new Parse.Query(WishlistItem).get(request.params.id, { useMasterKey: true });
  item.set("saved", Math.max(0, (item.get("saved") || 0) + (Number(request.params.amount) || 0)));
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

Parse.Cloud.define("adminDeleteWishlistItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const item = await new Parse.Query(WishlistItem).get(request.params.id, { useMasterKey: true });
  await item.destroy({ useMasterKey: true });
  return { success: true };
});

/* ============================================================
   Today / Practice / Growth — the personal notebook pages. Their data
   lives in classes named Monk* (MonkDay, MonkJournalEntry, ...). These
   four functions are the only way in: they check the admin session,
   work only on classes whose name starts with "Monk", and use the
   Master Key. monkFind is open to everyone (view only) except for the
   journal; the other three need the admin session. In the Back4App dashboard, set every Monk* class's
   Class-Level Permissions to NO public read and NO public write, so the
   journal and everything else is private to the admin login.
   ============================================================ */

function requireMonkClass(name) {
  if (typeof name !== "string" || !/^Monk[A-Za-z]+$/.test(name)) {
    throw new Error("Not a notebook class.");
  }
  return name;
}

function monkSafeFields(fields) {
  const clean = Object.assign({}, fields || {});
  ["objectId", "createdAt", "updatedAt", "ACL"].forEach((k) => delete clean[k]);
  return clean;
}

// Anyone can view the notebook pages, except the journal, which needs the
// admin session. Creating, updating and deleting always need it.
const MONK_PRIVATE_CLASSES = ["MonkJournalEntry"];

Parse.Cloud.define("monkFind", async (request) => {
  const className = requireMonkClass(request.params.className);
  if (MONK_PRIVATE_CLASSES.includes(className)) {
    await requireAdmin(request.params.adminToken);
  }
  const order = String(request.params.order || "");
  const out = [];
  let skip = 0;
  const limit = 1000;
  while (skip < 20000) {
    const query = new Parse.Query(className);
    order.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => {
      if (t.startsWith("-")) query.addDescending(t.slice(1));
      else query.addAscending(t);
    });
    query.limit(limit).skip(skip);
    const page = await query.find({ useMasterKey: true });
    page.forEach((o) => out.push(o.toJSON()));
    if (page.length < limit) break;
    skip += limit;
  }
  return out;
});

Parse.Cloud.define("adminMonkCreate", async (request) => {
  await requireAdmin(request.params.adminToken);
  const className = requireMonkClass(request.params.className);
  const obj = new Parse.Object(className);
  obj.set(monkSafeFields(request.params.fields));
  obj.set("owner", ADMIN_USERNAME);
  await obj.save(null, { useMasterKey: true });
  return { objectId: obj.id, createdAt: obj.createdAt };
});

Parse.Cloud.define("adminMonkUpdate", async (request) => {
  await requireAdmin(request.params.adminToken);
  const className = requireMonkClass(request.params.className);
  const obj = await new Parse.Query(className).get(request.params.objectId, { useMasterKey: true });
  obj.set(monkSafeFields(request.params.fields));
  await obj.save(null, { useMasterKey: true });
  return { updatedAt: obj.updatedAt };
});

Parse.Cloud.define("adminMonkDelete", async (request) => {
  await requireAdmin(request.params.adminToken);
  const className = requireMonkClass(request.params.className);
  const obj = await new Parse.Query(className).get(request.params.objectId, { useMasterKey: true });
  await obj.destroy({ useMasterKey: true });
  return { success: true };
});

/* ============================================================
   Meal prep — what got prepped this week, on which day, and the easy
   meals it makes ([{ name, when, done }]). Anyone can view the plan
   through mealPrepFind; every write is admin-gated here.
   ============================================================ */

// Anyone can view the plan. Read through a function so it never depends
// on Class-Level Permissions for MealPrepEntry.
Parse.Cloud.define("mealPrepFind", async () => {
  const entries = await new Parse.Query(MealPrepEntry).ascending("createdAt").limit(1000).find({ useMasterKey: true });
  return entries.map((e) => e.toJSON());
});

Parse.Cloud.define("adminSaveMealPrepEntry", async (request) => {
  await requireAdmin(request.params.adminToken);
  const { id, title, recipeId, prepDay, notes, meals } = request.params;
  let entry;
  if (id) {
    entry = await new Parse.Query(MealPrepEntry).get(id, { useMasterKey: true });
  } else {
    entry = new MealPrepEntry();
  }
  if (title !== undefined) entry.set("title", String(title));
  if (recipeId !== undefined) entry.set("recipeId", String(recipeId));
  if (prepDay !== undefined) entry.set("prepDay", String(prepDay));
  if (notes !== undefined) entry.set("notes", String(notes));
  if (meals !== undefined) {
    const clean = (Array.isArray(meals) ? meals : [])
      .map((m) => ({ name: String((m && m.name) || "").trim(), when: String((m && m.when) || "Any"), done: !!(m && m.done) }))
      .filter((m) => m.name);
    entry.set("meals", clean);
  }
  await entry.save(null, { useMasterKey: true });
  return entry.toJSON();
});

Parse.Cloud.define("adminDeleteMealPrepEntry", async (request) => {
  await requireAdmin(request.params.adminToken);
  const entry = await new Parse.Query(MealPrepEntry).get(request.params.id, { useMasterKey: true });
  await entry.destroy({ useMasterKey: true });
  return { success: true };
});

// Weekly reset: clears every entry so a new week starts empty.
Parse.Cloud.define("adminResetMealPrep", async (request) => {
  await requireAdmin(request.params.adminToken);
  const entries = await new Parse.Query(MealPrepEntry).limit(1000).find({ useMasterKey: true });
  await Parse.Object.destroyAll(entries, { useMasterKey: true });
  return { success: true, removed: entries.length };
});

/* ============================================================
   Inventory quick-edit — for scanning a QR code on a shelf and fixing
   that one item's quantity/level/location in a couple of taps. Needs
   the admin session (the one site sign-in), like every other edit.
   ============================================================ */

/**
 * Deliberately narrower than adminUpdateInventoryItem — only the fields
 * a quick shelf-side edit actually needs (quantity, unit, level,
 * location, shelf, notes). Renaming an item, changing its category, or
 * switching Food/Appliance still requires full admin login.
 */
const INVENTORY_QUICK_EDIT_FIELDS = ["quantity", "unit", "level", "location", "shelf", "notes"];

Parse.Cloud.define("inventoryQuickUpdateItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(InventoryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  INVENTORY_QUICK_EDIT_FIELDS.forEach((field) => {
    if (request.params[field] !== undefined) item.set(field, request.params[field]);
  });
  await item.save(null, { useMasterKey: true });
  return item.toJSON();
});

Parse.Cloud.define("inventoryQuickDeleteItem", async (request) => {
  await requireAdmin(request.params.adminToken);
  const query = new Parse.Query(InventoryItem);
  const item = await query.get(request.params.id, { useMasterKey: true });
  await item.destroy({ useMasterKey: true });
  return { success: true };
});
