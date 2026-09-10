/**
 * cookbook.js
 * -----------------------------------------------------------------------
 * Powers cookbook.html: loads recipes + inventory from Back4App, renders
 * the searchable/filterable recipe grid, and the recipe detail modal
 * with live ingredient-availability status.
 * -----------------------------------------------------------------------
 */

let allRecipes = [];
let allInventoryItems = [];
let activeFilter = "All";
let activeType = "All";
let searchQuery = "";

const Recipe = Parse.Object.extend("Recipe");
const InventoryItem = Parse.Object.extend("InventoryItem");

async function loadCookbookData() {
  const resultsEl = document.getElementById("recipe-results");
  try {
    const [recipes, items] = await Promise.all([
      new Parse.Query(Recipe).ascending("title").limit(1000).find(),
      new Parse.Query(InventoryItem).limit(1000).find(),
    ]);
    allRecipes = recipes;
    allInventoryItems = items;
    renderFilterChips();
    renderTypeChips();
    renderRecipes();
  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load the cookbook.</p><p>${escapeHtml(err.message || "Check your connection and try again.")}</p></div>`;
  }
}

function renderFilterChips() {
  const row = document.getElementById("filter-row");
  const chipMap = new Map(); // lowercase key -> display label, so "Dinner" (a suggested chip) and
                              // "dinner" (an actual tag) collapse into one chip instead of two.

  CONFIG.RECIPE_FILTERS.forEach((f) => {
    if (f.toLowerCase() === "all") return;
    chipMap.set(f.toLowerCase(), f);
  });

  allRecipes.forEach((r) => {
    const cat = r.get("category");
    if (cat) {
      const key = cat.toLowerCase();
      if (!chipMap.has(key)) chipMap.set(key, titleCase(cat));
    }
    (r.get("tags") || []).forEach((t) => {
      if (!t) return;
      const key = t.toLowerCase();
      if (!chipMap.has(key)) chipMap.set(key, titleCase(t));
    });
  });

  const priorityIndex = (label) => {
    const idx = CONFIG.RECIPE_FILTERS.findIndex((f) => f.toLowerCase() === label.toLowerCase());
    return idx === -1 ? CONFIG.RECIPE_FILTERS.length : idx;
  };

  const chips = ["All", ...Array.from(chipMap.values()).sort((a, b) => priorityIndex(a) - priorityIndex(b) || a.localeCompare(b))];

  row.innerHTML = "";
  chips.forEach((chip) => {
    const btn = document.createElement("button");
    btn.className = "filter-chip";
    btn.type = "button";
    btn.textContent = chip.toUpperCase();
    btn.setAttribute("aria-pressed", String(chip === activeFilter));
    btn.addEventListener("click", () => {
      activeFilter = chip;
      row.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      renderRecipes();
    });
    row.appendChild(btn);
  });
}

function recipeMatchesFilter(recipe) {
  if (activeFilter === "All") return true;
  const cat = (recipe.get("category") || "").toLowerCase();
  const tags = (recipe.get("tags") || []).map((t) => t.toLowerCase());
  return cat === activeFilter.toLowerCase() || tags.includes(activeFilter.toLowerCase());
}

function renderTypeChips() {
  const row = document.getElementById("type-filter-row");
  row.innerHTML = "";
  CONFIG.RECIPE_TYPE_FILTERS.forEach((type) => {
    const btn = document.createElement("button");
    btn.className = "filter-chip";
    btn.type = "button";
    btn.textContent = type.toUpperCase();
    btn.setAttribute("aria-pressed", String(type === activeType));
    btn.addEventListener("click", () => {
      activeType = type;
      row.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      renderRecipes();
    });
    row.appendChild(btn);
  });
}

function recipeMatchesType(recipe) {
  if (activeType === "All") return true;
  const type = recipe.get("recipeType") || "Meal";
  return type.toLowerCase() === activeType.toLowerCase();
}

function recipeMatchesSearch(recipe) {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  const haystack = [
    recipe.get("title"),
    recipe.get("category"),
    ...(recipe.get("tags") || []),
    ...(recipe.get("ingredients") || []).map((i) => i.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function renderRecipes() {
  const resultsEl = document.getElementById("recipe-results");
  const filtered = allRecipes.filter((r) => recipeMatchesFilter(r) && recipeMatchesType(r) && recipeMatchesSearch(r));

  if (allRecipes.length === 0) {
    resultsEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">No recipes yet.</p><p>Add your first one from the Admin page.</p></div>`;
    return;
  }
  if (filtered.length === 0) {
    resultsEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Nothing found.</p><p>Try a different search or filter.</p></div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "recipe-grid";

  filtered.forEach((recipe) => {
    const readiness = computeRecipeReadiness(recipe, allRecipes, allInventoryItems);
    const ready = readiness.ready;
    const missingCount = readiness.missingIngredients.length;
    const timeLabel = formatTime(recipe.get("prepTime"), recipe.get("cookTime"));
    const type = recipe.get("recipeType") || "Meal";
    const stars = starRating(recipe.get("difficulty"));

    const card = document.createElement("button");
    card.type = "button";
    card.className = "recipe-card";
    card.innerHTML = `
      <div class="recipe-card__meta">${escapeHtml((recipe.get("category") || "RECIPE").toUpperCase())}${timeLabel ? " · " + timeLabel : ""} · ${escapeHtml(type.toUpperCase())}${stars ? ` · ${stars}` : ""}</div>
      <div class="recipe-card__title">${escapeHtml(recipe.get("title") || "Untitled")}</div>
      <div class="recipe-card__desc">${escapeHtml(recipe.get("description") || "")}</div>
      <span class="status-tag ${ready ? "status-tag--ready" : ""}">${ready ? "READY TO MAKE" : `MISSING ${missingCount} INGREDIENT${missingCount === 1 ? "" : "S"}`}</span>
    `;
    card.addEventListener("click", () => openRecipeDetail(recipe));
    grid.appendChild(card);
  });

  resultsEl.innerHTML = "";
  resultsEl.appendChild(grid);
}

function openRecipeDetail(recipe) {
  const overlay = document.getElementById("recipe-modal-overlay");
  const content = document.getElementById("recipe-modal-content");
  const readiness = computeRecipeReadiness(recipe, allRecipes, allInventoryItems);
  const ready = readiness.ready;
  const missingCount = readiness.missingIngredients.length;

  const metaParts = [];
  if (recipe.get("category")) metaParts.push(escapeHtml(recipe.get("category").toUpperCase()));
  metaParts.push(escapeHtml((recipe.get("recipeType") || "Meal").toUpperCase()));
  if (recipe.get("prepTime")) metaParts.push(`PREP ${recipe.get("prepTime")} MIN`);
  if (recipe.get("cookTime")) metaParts.push(`COOK ${recipe.get("cookTime")} MIN`);
  if (recipe.get("servings")) metaParts.push(`SERVES ${recipe.get("servings")}`);
  const stars = starRating(recipe.get("difficulty"));
  if (stars) metaParts.push(stars);

  const usedBy = findRecipesThatUse(recipe, allRecipes);

  const ingredientRows = readiness.ownAvailability
    .map(({ ingredient, have }) => {
      const qty = [ingredient.quantity, ingredient.unit].filter(Boolean).join(" ");
      return `
        <li>
          <span>${escapeHtml([qty, ingredient.name].filter(Boolean).join(" "))}${ingredient.optional ? " (optional)" : ""}</span>
          <span class="ingredient-status ${have ? "ingredient-status--have" : "ingredient-status--missing"}">${have ? "✓ HAVE" : "— MISSING"}</span>
        </li>`;
    })
    .join("");

  const componentRows = readiness.components
    .map((c) => {
      const missingText = c.missingIngredients.map((m) => m.name).join(", ");
      return `
        <li class="component-row">
          <div class="component-row__head">
            <span class="component-row__title">${escapeHtml(c.title)}</span>
            <span class="ingredient-status ${c.ready ? "ingredient-status--have" : "ingredient-status--missing"}">${c.ready ? "✓ READY" : "— NOT READY"}</span>
          </div>
          ${!c.ready ? `<div class="component-row__missing">Missing: ${escapeHtml(missingText)}</div>` : ""}
        </li>`;
    })
    .join("");

  content.innerHTML = `
    <h2 id="recipe-modal-title">${escapeHtml(recipe.get("title") || "Untitled")}</h2>
    <div class="recipe-detail__meta">${metaParts.join('<span aria-hidden="true">·</span>')}</div>
    ${recipe.get("description") ? `<p>${escapeHtml(recipe.get("description"))}</p>` : ""}
    <div class="recipe-detail__status">
      <span class="status-tag ${ready ? "status-tag--ready" : ""}">${ready ? "READY TO MAKE" : `MISSING ${missingCount} INGREDIENT${missingCount === 1 ? "" : "S"}`}</span>
    </div>
    ${componentRows ? `<h3 class="recipe-detail__section-title">Requires</h3><ul class="component-list">${componentRows}</ul>` : ""}
    ${usedBy.length ? `<h3 class="recipe-detail__section-title">Used By</h3><p class="recipe-detail__notes">${escapeHtml(usedBy.map((r) => r.get("title")).join(", "))}</p>` : ""}
    <h3 class="recipe-detail__section-title">Ingredients</h3>
    <ul class="ingredient-list">${ingredientRows || "<li>No ingredients listed.</li>"}</ul>
    ${recipe.get("instructions") ? `<h3 class="recipe-detail__section-title">Instructions</h3><div class="recipe-detail__instructions">${escapeHtml(recipe.get("instructions"))}</div>` : ""}
    ${recipe.get("notes") ? `<h3 class="recipe-detail__section-title">Notes</h3><p class="recipe-detail__notes">${escapeHtml(recipe.get("notes"))}</p>` : ""}
  `;

  openModal(overlay);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("cookbook-subtitle").textContent = CONFIG.COOKBOOK_SUBTITLE;

  const searchInput = document.getElementById("recipe-search");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderRecipes();
  });

  const overlay = document.getElementById("recipe-modal-overlay");
  document.getElementById("recipe-modal-close").addEventListener("click", () => closeModal(overlay));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay);
  });

  loadCookbookData();
});
