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
 *   3. CRUD Cloud Functions for InventoryItem and Recipe, all using the
 *      Master Key internally (so they work regardless of Class-Level
 *      Permissions) but gated by requireAdmin().
 *
 * ONE MORE STEP ON THE BACK4APP DASHBOARD:
 *   Set InventoryItem and Recipe's Class-Level Permissions to
 *   "Public Read" and NO public write/update/delete. That way even if
 *   someone got hold of your App ID/JS Key (which are meant to be
 *   public), they still can't write directly through the client SDK —
 *   every write has to go through these Cloud Functions, which check
 *   the admin session.
 * -----------------------------------------------------------------------
 */

const ADMIN_USERNAME = "zeebug";
const ADMIN_PASSWORD = "oatmeal";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const AdminSession = Parse.Object.extend("AdminSession");
const InventoryItem = Parse.Object.extend("InventoryItem");
const Recipe = Parse.Object.extend("Recipe");

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

const INVENTORY_FIELDS = ["name", "category", "location", "shelf", "quantity", "unit", "level", "notes"];

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
