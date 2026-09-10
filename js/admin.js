/**
 * admin.js
 * -----------------------------------------------------------------------
 * Powers admin.html: login against the `adminLogin` Cloud Function,
 * then inventory + recipe CRUD through admin-only Cloud Functions that
 * validate the session token server-side (see README for what exists
 * today vs. what Cloud Code still needs).
 * -----------------------------------------------------------------------
 */

const InventoryItemClass = Parse.Object.extend("InventoryItem");
const RecipeClass = Parse.Object.extend("Recipe");

let adminInventoryItems = [];
let adminRecipes = [];
let editingItemId = null;
let editingRecipeId = null;
let pendingConfirmAction = null; // async function to run when the shared confirm modal is confirmed
let currentSimilarIngredientGroups = [];
let currentSimilarTagGroups = [];

/* ---------------------------------------------------------------------
 * Login
 * ------------------------------------------------------------------- */

function showDashboard() {
  document.getElementById("admin-login-screen").hidden = true;
  document.getElementById("admin-dashboard").hidden = false;
  document.getElementById("admin-username-display").textContent = sessionStorage.getItem(CONFIG.ADMIN_USER_KEY) || "";
  loadAdminInventory();
  loadAdminRecipes();
}

function showLogin() {
  document.getElementById("admin-dashboard").hidden = true;
  document.getElementById("admin-login-screen").hidden = false;
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value;
  const errorEl = document.getElementById("admin-login-error");
  errorEl.classList.remove("admin-error--visible");

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SIGNING IN…";

  try {
    const result = await Parse.Cloud.run("adminLogin", { username, password });
    if (result && result.token) {
      setAdminSession(result.token, username);
      document.getElementById("admin-password").value = "";
      showDashboard();
    } else {
      throw new Error("No token returned");
    }
  } catch (err) {
    errorEl.classList.add("admin-error--visible");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "SIGN IN";
  }
}

function handleLogout() {
  clearAdminSession();
  showLogin();
  showToast("Signed out.");
}

/* ---------------------------------------------------------------------
 * Tabs
 * ------------------------------------------------------------------- */

function initTabs() {
  const tabInventory = document.getElementById("tab-inventory");
  const tabRecipes = document.getElementById("tab-recipes");
  const panelInventory = document.getElementById("panel-inventory");
  const panelRecipes = document.getElementById("panel-recipes");

  function activate(tab) {
    const inv = tab === "inventory";
    tabInventory.setAttribute("aria-selected", String(inv));
    tabRecipes.setAttribute("aria-selected", String(!inv));
    panelInventory.hidden = !inv;
    panelRecipes.hidden = inv;
  }

  tabInventory.addEventListener("click", () => activate("inventory"));
  tabRecipes.addEventListener("click", () => activate("recipes"));
}

/* ---------------------------------------------------------------------
 * Inventory admin list
 * ------------------------------------------------------------------- */

async function loadAdminInventory() {
  const listEl = document.getElementById("admin-inventory-list");
  listEl.innerHTML = `<div class="loading-row">Loading…</div>`;
  try {
    adminInventoryItems = await new Parse.Query(InventoryItemClass).ascending("name").limit(2000).find();
    renderAdminInventoryList();
    renderMissingIngredients();
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load inventory.</p></div>`;
  }
}

/* ---------------------------------------------------------------------
 * "Needed for recipes" — ingredients used across all recipes that don't
 * currently match anything in inventory, so it's fast to add just what
 * you went out and bought for a specific recipe.
 * ------------------------------------------------------------------- */

function computeMissingIngredients() {
  const missingMap = new Map(); // normalized name -> { name, recipes: Set, requiredSomewhere: boolean }
  adminRecipes.forEach((recipe) => {
    (recipe.get("ingredients") || []).forEach((ing) => {
      if (!ing.name) return;
      const alreadyHave = adminInventoryItems.some((item) => ingredientMatchesInventoryItem(ing.name, item.get("name")));
      if (alreadyHave) return;
      const key = normalizeText(ing.name);
      if (!key) return;
      if (!missingMap.has(key)) {
        missingMap.set(key, { name: ing.name, recipes: new Set(), requiredSomewhere: false });
      }
      const entry = missingMap.get(key);
      entry.recipes.add(recipe.get("title"));
      if (!ing.optional) entry.requiredSomewhere = true;
    });
  });
  return Array.from(missingMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function renderMissingIngredients() {
  const container = document.getElementById("missing-ingredients-list");
  if (!container) return;

  if (adminRecipes.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Add some recipes to see what's needed here.</p>`;
    return;
  }

  const missing = computeMissingIngredients();
  if (missing.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Every recipe ingredient is covered by your current inventory.</p>`;
    return;
  }

  container.innerHTML = missing
    .map(
      (entry) => `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(titleCase(entry.name))}${entry.requiredSomewhere ? "" : ' <span class="missing-ingredient-row__tag">optional</span>'}</div>
          <div class="missing-ingredient-row__recipes">${escapeHtml(Array.from(entry.recipes).join(", "))}</div>
        </div>
        <button type="button" class="btn btn--small btn--primary" data-add-missing="${escapeHtml(entry.name)}">+ ADD</button>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-add-missing]").forEach((btn) => {
    btn.addEventListener("click", () => openItemForm(null, btn.getAttribute("data-add-missing")));
  });
}

function renderAdminInventoryList() {
  const listEl = document.getElementById("admin-inventory-list");
  const query = document.getElementById("admin-inventory-search").value.trim().toLowerCase();
  const filtered = adminInventoryItems.filter((item) => {
    if (!query) return true;
    return [item.get("name"), item.get("category"), item.get("location")].filter(Boolean).join(" ").toLowerCase().includes(query);
  });

  if (adminInventoryItems.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">The kitchen is empty.</p><p>Add the first item to get started.</p></div>`;
    return;
  }
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Nothing found.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map(
      (item) => `
      <div class="admin-row">
        <div class="admin-row__title">${escapeHtml(item.get("name"))}</div>
        <div>${escapeHtml(item.get("category") || "")}</div>
        <div>${escapeHtml(item.get("location") || "")}${item.get("shelf") ? " · " + escapeHtml(item.get("shelf")) : ""}</div>
        <div>${escapeHtml((item.get("level") || "").toUpperCase())}</div>
        <div class="admin-row__actions">
          <button class="btn btn--ghost btn--small" data-edit-item="${item.id}">EDIT</button>
        </div>
      </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-edit-item]").forEach((btn) => {
    btn.addEventListener("click", () => openItemForm(btn.getAttribute("data-edit-item")));
  });
}

/* ---------------------------------------------------------------------
 * Inventory item form
 * ------------------------------------------------------------------- */

function populateCategoryAndLocationSelects() {
  const categorySelect = document.getElementById("item-category");
  categorySelect.innerHTML = CONFIG.INVENTORY_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");

  const locationSelect = document.getElementById("item-location");
  locationSelect.innerHTML = CONFIG.INVENTORY_LOCATIONS.map((l) => `<option value="${l}">${l}</option>`).join("");
}

function updateShelfOptions() {
  const location = document.getElementById("item-location").value;
  const shelfSelect = document.getElementById("item-shelf");
  const options = CONFIG.SHELF_OPTIONS[location] || ["Other"];
  const current = shelfSelect.value;
  shelfSelect.innerHTML = options.map((s) => `<option value="${s}">${s}</option>`).join("");
  if (options.includes(current)) shelfSelect.value = current;
}

function renderLevelSelector(selected) {
  const container = document.getElementById("item-level-selector");
  container.innerHTML = "";
  CONFIG.LEVELS.forEach((level) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-chip";
    btn.textContent = level.toUpperCase();
    btn.setAttribute("aria-pressed", String(level === selected));
    btn.addEventListener("click", () => {
      document.getElementById("item-level").value = level;
      container.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
    });
    container.appendChild(btn);
  });
}

function openItemForm(itemId, prefillName) {
  editingItemId = itemId || null;
  const form = document.getElementById("item-form");
  form.reset();
  populateCategoryAndLocationSelects();

  const item = itemId ? adminInventoryItems.find((i) => i.id === itemId) : null;

  document.getElementById("item-modal-title").textContent = item ? "Edit item" : "Add item";
  document.getElementById("item-delete-btn").hidden = !item;

  if (item) {
    document.getElementById("item-name").value = item.get("name") || "";
    document.getElementById("item-category").value = item.get("category") || CONFIG.INVENTORY_CATEGORIES[0];
    document.getElementById("item-location").value = item.get("location") || CONFIG.INVENTORY_LOCATIONS[0];
    updateShelfOptions();
    document.getElementById("item-shelf").value = item.get("shelf") || "Other";
    document.getElementById("item-quantity").value = item.get("quantity") ?? "";
    document.getElementById("item-unit").value = item.get("unit") || "";
    const exp = item.get("expirationDate");
    document.getElementById("item-expiration").value = exp ? new Date(exp).toISOString().slice(0, 10) : "";
    document.getElementById("item-notes").value = item.get("notes") || "";
    document.getElementById("item-level").value = item.get("level") || "Full";
    renderLevelSelector(item.get("level") || "Full");
  } else {
    updateShelfOptions();
    document.getElementById("item-level").value = "Full";
    renderLevelSelector("Full");
    if (prefillName) {
      document.getElementById("item-name").value = titleCase(prefillName);
    }
  }

  openModal(document.getElementById("item-modal-overlay"));
}

async function handleItemFormSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SAVING…";

  const payload = {
    name: document.getElementById("item-name").value.trim(),
    category: document.getElementById("item-category").value,
    location: document.getElementById("item-location").value,
    shelf: document.getElementById("item-shelf").value,
    quantity: parseFloat(document.getElementById("item-quantity").value) || 0,
    unit: document.getElementById("item-unit").value.trim(),
    level: document.getElementById("item-level").value,
    notes: document.getElementById("item-notes").value.trim(),
    expirationDate: document.getElementById("item-expiration").value || null,
  };

  try {
    if (editingItemId) {
      await runAdminCloud("adminUpdateInventoryItem", { id: editingItemId, ...payload });
      showToast("Item updated.");
    } else {
      await runAdminCloud("adminCreateInventoryItem", payload);
      showToast("Item added.");
    }
    closeModal(document.getElementById("item-modal-overlay"));
    await loadAdminInventory();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't save item.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "SAVE";
  }
}

function handleItemDeleteClick() {
  if (!editingItemId) return;
  const id = editingItemId;
  openConfirmModal(
    "Are you sure?",
    "This item will be permanently removed from the inventory.",
    "DELETE",
    async () => {
      await runAdminCloud("adminDeleteInventoryItem", { id });
      showToast("Item removed.");
      closeModal(document.getElementById("item-modal-overlay"));
      await loadAdminInventory();
    }
  );
}

/* ---------------------------------------------------------------------
 * Recipe admin list
 * ------------------------------------------------------------------- */

async function loadAdminRecipes() {
  const listEl = document.getElementById("admin-recipe-list");
  listEl.innerHTML = `<div class="loading-row">Loading…</div>`;
  try {
    adminRecipes = await new Parse.Query(RecipeClass).ascending("title").limit(1000).find();
    renderAdminRecipeList();
    renderMissingIngredients();
    renderSimilarIngredients();
    renderSimilarTags();
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load recipes.</p></div>`;
  }
}

function renderAdminRecipeList() {
  const listEl = document.getElementById("admin-recipe-list");
  const query = document.getElementById("admin-recipe-search").value.trim().toLowerCase();
  const filtered = adminRecipes.filter((r) => {
    if (!query) return true;
    return [r.get("title"), r.get("category")].filter(Boolean).join(" ").toLowerCase().includes(query);
  });

  if (adminRecipes.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">No recipes yet.</p><p>Add the first one to get started.</p></div>`;
    return;
  }
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Nothing found.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map(
      (r) => `
      <div class="admin-row">
        <div class="admin-row__title">${escapeHtml(r.get("title"))}</div>
        <div>${escapeHtml(r.get("category") || "")}</div>
        <div>${escapeHtml(r.get("recipeType") || "Meal")}</div>
        <div>${r.get("servings") ? "Serves " + r.get("servings") : ""}</div>
        <div class="admin-row__actions">
          <button class="btn btn--ghost btn--small" data-edit-recipe="${r.id}">EDIT</button>
        </div>
      </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-edit-recipe]").forEach((btn) => {
    btn.addEventListener("click", () => openRecipeForm(btn.getAttribute("data-edit-recipe")));
  });
}

/* ---------------------------------------------------------------------
 * Similar ingredient names — across all recipes, ingredients whose
 * names normalize to the same key (e.g. "carrot" / "carrots", "Dried
 * Shiitake Mushrooms" / "shiitake mushrooms") but aren't spelled
 * identically. Merging rewrites every occurrence to one spelling, which
 * also cleans up "Needed for Recipes" duplicates.
 * ------------------------------------------------------------------- */

function computeSimilarIngredientGroups() {
  const groups = new Map(); // normalized key -> { variants: Map(rawName -> count), recipeIds: Set }
  adminRecipes.forEach((recipe) => {
    (recipe.get("ingredients") || []).forEach((ing) => {
      if (!ing || !ing.name) return;
      const key = normalizeText(ing.name);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, { variants: new Map(), recipeIds: new Set() });
      const g = groups.get(key);
      g.variants.set(ing.name, (g.variants.get(ing.name) || 0) + 1);
      g.recipeIds.add(recipe.id);
    });
  });

  return Array.from(groups.entries())
    .filter(([, g]) => g.variants.size > 1)
    .map(([key, g]) => {
      // Canonical = most-used spelling; ties broken toward the longer,
      // more descriptive variant.
      const sorted = Array.from(g.variants.entries()).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
      return { key, canonical: sorted[0][0], variants: Array.from(g.variants.keys()), recipeCount: g.recipeIds.size };
    })
    .sort((a, b) => a.canonical.localeCompare(b.canonical));
}

function renderSimilarIngredients() {
  const container = document.getElementById("similar-ingredients-list");
  if (!container) return;

  currentSimilarIngredientGroups = computeSimilarIngredientGroups();
  if (currentSimilarIngredientGroups.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">No similar ingredient names found.</p>`;
    return;
  }

  container.innerHTML = currentSimilarIngredientGroups
    .map(
      (g, idx) => `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(titleCase(g.canonical))}</div>
          <div class="missing-ingredient-row__recipes">Variants: ${escapeHtml(g.variants.join(", "))} — used across ${g.recipeCount} recipe${g.recipeCount === 1 ? "" : "s"}</div>
        </div>
        <button type="button" class="btn btn--small btn--primary" data-merge-ingredient-group="${idx}">MERGE</button>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-merge-ingredient-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-merge-ingredient-group"), 10);
      confirmMergeIngredientGroup(currentSimilarIngredientGroups[idx]);
    });
  });
}

function confirmMergeIngredientGroup(group) {
  const canonicalDisplay = titleCase(group.canonical);
  openConfirmModal(
    "Merge ingredient names?",
    `This will rename ${group.variants.join(", ")} to "${canonicalDisplay}" across ${group.recipeCount} recipe${group.recipeCount === 1 ? "" : "s"}. This can't be undone.`,
    "MERGE",
    async () => {
      const affected = adminRecipes.filter((r) => (r.get("ingredients") || []).some((ing) => ing && normalizeText(ing.name) === group.key));
      for (const recipe of affected) {
        const newIngredients = (recipe.get("ingredients") || []).map((ing) =>
          ing && normalizeText(ing.name) === group.key ? { ...ing, name: canonicalDisplay } : ing
        );
        await runAdminCloud("adminUpdateRecipe", { id: recipe.id, ingredients: newIngredients });
      }
      showToast(`Merged into "${canonicalDisplay}".`);
      await loadAdminRecipes();
    }
  );
}

/* ---------------------------------------------------------------------
 * Similar tags — same idea, for the free-text tags array. Catches
 * case/whitespace variants like "Quick" / "quick" that would otherwise
 * split the Cookbook's filter chips.
 * ------------------------------------------------------------------- */

function normalizeTag(tag) {
  return (tag || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function computeSimilarTagGroups() {
  const groups = new Map(); // normalized key -> { variants: Map(rawTag -> count), recipeIds: Set }
  adminRecipes.forEach((recipe) => {
    (recipe.get("tags") || []).forEach((tag) => {
      if (!tag) return;
      const key = normalizeTag(tag);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, { variants: new Map(), recipeIds: new Set() });
      const g = groups.get(key);
      g.variants.set(tag, (g.variants.get(tag) || 0) + 1);
      g.recipeIds.add(recipe.id);
    });
  });

  return Array.from(groups.entries())
    .filter(([, g]) => g.variants.size > 1)
    .map(([key, g]) => ({ key, canonical: key, variants: Array.from(g.variants.keys()), recipeCount: g.recipeIds.size }))
    .sort((a, b) => a.canonical.localeCompare(b.canonical));
}

function renderSimilarTags() {
  const container = document.getElementById("similar-tags-list");
  if (!container) return;

  currentSimilarTagGroups = computeSimilarTagGroups();
  if (currentSimilarTagGroups.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">No similar tags found.</p>`;
    return;
  }

  container.innerHTML = currentSimilarTagGroups
    .map(
      (g, idx) => `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(g.canonical)}</div>
          <div class="missing-ingredient-row__recipes">Variants: ${escapeHtml(g.variants.join(", "))} — used across ${g.recipeCount} recipe${g.recipeCount === 1 ? "" : "s"}</div>
        </div>
        <button type="button" class="btn btn--small btn--primary" data-merge-tag-group="${idx}">MERGE</button>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-merge-tag-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-merge-tag-group"), 10);
      confirmMergeTagGroup(currentSimilarTagGroups[idx]);
    });
  });
}

function confirmMergeTagGroup(group) {
  openConfirmModal(
    "Merge tags?",
    `This will rewrite ${group.variants.join(", ")} to "${group.canonical}" across ${group.recipeCount} recipe${group.recipeCount === 1 ? "" : "s"}. This can't be undone.`,
    "MERGE",
    async () => {
      const affected = adminRecipes.filter((r) => (r.get("tags") || []).some((t) => normalizeTag(t) === group.key));
      for (const recipe of affected) {
        const newTags = Array.from(new Set((recipe.get("tags") || []).map((t) => (normalizeTag(t) === group.key ? group.canonical : t))));
        await runAdminCloud("adminUpdateRecipe", { id: recipe.id, tags: newTags });
      }
      showToast(`Merged into "${group.canonical}".`);
      await loadAdminRecipes();
    }
  );
}

/* ---------------------------------------------------------------------
 * Recipe form (with dynamic ingredient rows)
 * ------------------------------------------------------------------- */

function addIngredientRow(ingredient = { name: "", quantity: "", unit: "", optional: false }) {
  const container = document.getElementById("ingredient-rows");
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <div class="field">
      <label class="visually-hidden">Ingredient name</label>
      <input type="text" placeholder="Ingredient" class="ing-name" value="${escapeHtml(ingredient.name)}" />
    </div>
    <div class="field">
      <label class="visually-hidden">Quantity</label>
      <input type="text" placeholder="Qty" class="ing-quantity" value="${escapeHtml(ingredient.quantity)}" />
    </div>
    <div class="field">
      <label class="visually-hidden">Unit</label>
      <input type="text" placeholder="Unit" class="ing-unit" value="${escapeHtml(ingredient.unit)}" />
    </div>
    <label class="checkbox-field">
      <input type="checkbox" class="ing-optional" ${ingredient.optional ? "checked" : ""} />
      Optional
    </label>
    <button type="button" class="btn btn--ghost btn--small ing-remove">REMOVE</button>
  `;
  row.querySelector(".ing-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function getIngredientsFromForm() {
  return Array.from(document.querySelectorAll("#ingredient-rows .ingredient-row"))
    .map((row) => ({
      name: row.querySelector(".ing-name").value.trim(),
      quantity: row.querySelector(".ing-quantity").value.trim(),
      unit: row.querySelector(".ing-unit").value.trim(),
      optional: row.querySelector(".ing-optional").checked,
    }))
    .filter((ing) => ing.name);
}

function openRecipeForm(recipeId) {
  editingRecipeId = recipeId || null;
  const form = document.getElementById("recipe-form");
  form.reset();
  document.getElementById("ingredient-rows").innerHTML = "";

  const typeSelect = document.getElementById("recipe-type");
  typeSelect.innerHTML = CONFIG.RECIPE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");

  const recipe = recipeId ? adminRecipes.find((r) => r.id === recipeId) : null;
  document.getElementById("recipe-form-modal-title").textContent = recipe ? "Edit recipe" : "Add recipe";
  document.getElementById("recipe-delete-btn").hidden = !recipe;

  if (recipe) {
    document.getElementById("recipe-title").value = recipe.get("title") || "";
    document.getElementById("recipe-description").value = recipe.get("description") || "";
    document.getElementById("recipe-category").value = recipe.get("category") || "";
    typeSelect.value = recipe.get("recipeType") || "Meal";
    document.getElementById("recipe-difficulty").value = recipe.get("difficulty") || "";
    document.getElementById("recipe-tags").value = (recipe.get("tags") || []).join(", ");
    document.getElementById("recipe-requires").value = (recipe.get("requiresRecipes") || []).join(", ");
    document.getElementById("recipe-servings").value = recipe.get("servings") || "";
    document.getElementById("recipe-prep").value = recipe.get("prepTime") || "";
    document.getElementById("recipe-cook").value = recipe.get("cookTime") || "";
    document.getElementById("recipe-instructions").value = recipe.get("instructions") || "";
    document.getElementById("recipe-notes").value = recipe.get("notes") || "";
    const ingredients = recipe.get("ingredients") || [];
    if (ingredients.length) {
      ingredients.forEach(addIngredientRow);
    } else {
      addIngredientRow();
    }
  } else {
    typeSelect.value = "Meal";
    addIngredientRow();
  }

  openModal(document.getElementById("recipe-form-modal-overlay"));
}

async function handleRecipeFormSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SAVING…";

  const payload = {
    title: document.getElementById("recipe-title").value.trim(),
    description: document.getElementById("recipe-description").value.trim(),
    category: document.getElementById("recipe-category").value.trim(),
    recipeType: document.getElementById("recipe-type").value,
    difficulty: parseInt(document.getElementById("recipe-difficulty").value, 10) || null,
    tags: document.getElementById("recipe-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
    requiresRecipes: document.getElementById("recipe-requires").value.split(",").map((t) => t.trim()).filter(Boolean),
    servings: parseInt(document.getElementById("recipe-servings").value, 10) || null,
    prepTime: parseInt(document.getElementById("recipe-prep").value, 10) || null,
    cookTime: parseInt(document.getElementById("recipe-cook").value, 10) || null,
    instructions: document.getElementById("recipe-instructions").value.trim(),
    notes: document.getElementById("recipe-notes").value.trim(),
    ingredients: getIngredientsFromForm(),
  };

  try {
    if (editingRecipeId) {
      await runAdminCloud("adminUpdateRecipe", { id: editingRecipeId, ...payload });
      showToast("Recipe updated.");
    } else {
      await runAdminCloud("adminCreateRecipe", payload);
      showToast("Recipe added.");
    }
    closeModal(document.getElementById("recipe-form-modal-overlay"));
    await loadAdminRecipes();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't save recipe.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "SAVE";
  }
}

function handleRecipeDeleteClick() {
  if (!editingRecipeId) return;
  const id = editingRecipeId;
  openConfirmModal(
    "Are you sure?",
    "This recipe will be permanently deleted.",
    "DELETE",
    async () => {
      await runAdminCloud("adminDeleteRecipe", { id });
      showToast("Recipe deleted.");
      closeModal(document.getElementById("recipe-form-modal-overlay"));
      await loadAdminRecipes();
    }
  );
}

/* ---------------------------------------------------------------------
 * Shared confirm modal — used for deletes and for merges. Whatever
 * opened it sets pendingConfirmAction; the confirm button just runs it.
 * ------------------------------------------------------------------- */

function openConfirmModal(title, body, confirmLabel, action) {
  pendingConfirmAction = action;
  document.getElementById("confirm-modal-title").textContent = title;
  document.getElementById("confirm-modal-body").textContent = body;
  document.getElementById("confirm-modal-confirm").textContent = confirmLabel;
  openModal(document.getElementById("confirm-modal-overlay"));
}

async function handleConfirmModalConfirm() {
  if (!pendingConfirmAction) return;
  const confirmBtn = document.getElementById("confirm-modal-confirm");
  const originalLabel = confirmBtn.textContent;
  confirmBtn.disabled = true;
  confirmBtn.textContent = "WORKING…";

  try {
    await pendingConfirmAction();
    closeModal(document.getElementById("confirm-modal-overlay"));
  } catch (err) {
    console.error(err);
    showToast(err.message || "Something went wrong.", "error");
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalLabel;
    pendingConfirmAction = null;
  }
}

/* ---------------------------------------------------------------------
 * Wire everything up
 * ------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initTabs();

  document.getElementById("admin-login-form").addEventListener("submit", handleLogin);
  document.getElementById("admin-logout-btn").addEventListener("click", handleLogout);

  // Inventory
  document.getElementById("add-inventory-btn").addEventListener("click", () => openItemForm(null));
  document.getElementById("item-form").addEventListener("submit", handleItemFormSubmit);
  document.getElementById("item-cancel-btn").addEventListener("click", () => closeModal(document.getElementById("item-modal-overlay")));
  document.getElementById("item-modal-close").addEventListener("click", () => closeModal(document.getElementById("item-modal-overlay")));
  document.getElementById("item-delete-btn").addEventListener("click", handleItemDeleteClick);
  document.getElementById("item-location").addEventListener("change", updateShelfOptions);
  document.getElementById("admin-inventory-search").addEventListener("input", renderAdminInventoryList);

  // Recipes
  document.getElementById("add-recipe-btn").addEventListener("click", () => openRecipeForm(null));
  document.getElementById("recipe-form").addEventListener("submit", handleRecipeFormSubmit);
  document.getElementById("recipe-cancel-btn").addEventListener("click", () => closeModal(document.getElementById("recipe-form-modal-overlay")));
  document.getElementById("recipe-form-modal-close").addEventListener("click", () => closeModal(document.getElementById("recipe-form-modal-overlay")));
  document.getElementById("recipe-delete-btn").addEventListener("click", handleRecipeDeleteClick);
  document.getElementById("add-ingredient-row").addEventListener("click", () => addIngredientRow());
  document.getElementById("admin-recipe-search").addEventListener("input", renderAdminRecipeList);

  // Confirm modal
  document.getElementById("confirm-modal-confirm").addEventListener("click", handleConfirmModalConfirm);
  document.getElementById("confirm-modal-cancel").addEventListener("click", () => {
    pendingConfirmAction = null;
    closeModal(document.getElementById("confirm-modal-overlay"));
  });
  document.getElementById("confirm-modal-close").addEventListener("click", () => {
    pendingConfirmAction = null;
    closeModal(document.getElementById("confirm-modal-overlay"));
  });

  if (isAdminLoggedIn()) {
    showDashboard();
  } else {
    showLogin();
  }
});
