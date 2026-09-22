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
const GroceryLocationClass = Parse.Object.extend("GroceryLocation");

let adminInventoryItems = [];
let adminRecipes = [];
let selectedInventoryIds = new Set();
let selectedRecipeIds = new Set();
let activeInventoryTypeFilter = "All";
let pendingMergeDeletions = []; // ids to delete after the current item-form save finishes (see confirmMergeInventoryGroup)
let pendingMergeLabel = "";
let editingItemId = null;
let editingRecipeId = null;
let pendingConfirmAction = null; // async function to run when the shared confirm modal is confirmed
let currentSimilarIngredientGroups = [];
let currentSimilarTagGroups = [];
let currentSimilarInventoryGroups = [];
let storageLayouts = {}; // location -> { objectId, rows, cols, zones } — see storage-layout.js
let zoneModalContext = null; // { location, zone|null, rect|null, onSaved } — see storage-layout.js
let groceryLocations = []; // GroceryLocation records (name + emoji) — managed here, used by groceries.html
let editingGroceryLocationId = null;
let plants = [];
let editingPlantId = null;
let cachedWeather = null; // { recentRainIn, recentMaxTempAvgF } | null — fetched once per admin session

/* ---------------------------------------------------------------------
 * Admin UI preferences — purely local (localStorage), not synced to
 * Parse. Remembers which "Needed for Recipes"/"Similar Inventory Items"
 * sections you've collapsed, and which specific rows you've dismissed
 * with "IGNORE" (a false positive that isn't actually missing/a
 * duplicate), so the noise doesn't come back every reload.
 * ------------------------------------------------------------------- */

const ADMIN_UI_PREFS_KEY = "kitchen_admin_ui_prefs";

function loadAdminUiPrefs() {
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem(ADMIN_UI_PREFS_KEY)) || {};
  } catch (err) {
    prefs = {};
  }
  prefs.collapsed = prefs.collapsed || {};
  prefs.ignoredMissing = prefs.ignoredMissing || [];
  prefs.ignoredSimilarInventory = prefs.ignoredSimilarInventory || [];
  return prefs;
}

function saveAdminUiPrefs() {
  localStorage.setItem(ADMIN_UI_PREFS_KEY, JSON.stringify(adminUiPrefs));
}

let adminUiPrefs = loadAdminUiPrefs();

/**
 * Wires a section's collapse/expand toggle button and remembers the
 * choice under `prefKey`. Call once per section at setup time; render
 * functions should call applyCollapsedState(prefKey) again after
 * re-rendering the section's body (e.g. after a data reload), since
 * that replaces the body's `hidden` state along with its content.
 */
function setupCollapsibleSection(prefKey, toggleBtnId) {
  const toggleBtn = document.getElementById(toggleBtnId);
  toggleBtn.addEventListener("click", () => {
    adminUiPrefs.collapsed[prefKey] = !adminUiPrefs.collapsed[prefKey];
    saveAdminUiPrefs();
    applyCollapsedState(prefKey, toggleBtnId);
  });
  applyCollapsedState(prefKey, toggleBtnId);
}

function applyCollapsedState(prefKey, toggleBtnId) {
  const toggleBtn = document.getElementById(toggleBtnId);
  const bodyEl = toggleBtn.closest(".admin-missing-section").querySelector(":scope > :not(.admin-missing-section__header)");
  const collapsed = !!adminUiPrefs.collapsed[prefKey];
  bodyEl.hidden = collapsed;
  toggleBtn.textContent = collapsed ? "SHOW" : "HIDE";
  toggleBtn.setAttribute("aria-expanded", String(!collapsed));
}

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
  const tabs = {
    inventory: { tab: document.getElementById("tab-inventory"), panel: document.getElementById("panel-inventory") },
    recipes: { tab: document.getElementById("tab-recipes"), panel: document.getElementById("panel-recipes") },
    layout: { tab: document.getElementById("tab-layout"), panel: document.getElementById("panel-layout") },
    groceries: { tab: document.getElementById("tab-groceries"), panel: document.getElementById("panel-groceries") },
    plants: { tab: document.getElementById("tab-plants"), panel: document.getElementById("panel-plants") },
  };

  function activate(name) {
    Object.entries(tabs).forEach(([key, { tab, panel }]) => {
      const active = key === name;
      tab.setAttribute("aria-selected", String(active));
      panel.hidden = !active;
    });
    if (name === "layout") activateLayoutTab();
    if (name === "groceries") loadGroceryLocations();
    if (name === "plants") activatePlantsTab();
  }

  tabs.inventory.tab.addEventListener("click", () => activate("inventory"));
  tabs.recipes.tab.addEventListener("click", () => activate("recipes"));
  tabs.layout.tab.addEventListener("click", () => activate("layout"));
  tabs.groceries.tab.addEventListener("click", () => activate("groceries"));
  tabs.plants.tab.addEventListener("click", () => activate("plants"));
}

/* ---------------------------------------------------------------------
 * Inventory admin list
 * ------------------------------------------------------------------- */

async function loadAdminInventory() {
  const listEl = document.getElementById("admin-inventory-list");
  listEl.innerHTML = `<div class="loading-row">Loading…</div>`;
  try {
    adminInventoryItems = await new Parse.Query(InventoryItemClass).ascending("name").limit(2000).find();
    renderInventoryTypeFilter();
    renderAdminInventoryList();
    renderMissingIngredients();
    renderSimilarInventory();
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load inventory.</p></div>`;
  }
}

function renderInventoryTypeFilter() {
  const row = document.getElementById("admin-inventory-type-filter");
  row.innerHTML = "";
  ["All", ...CONFIG.ITEM_TYPES].forEach((type) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-chip";
    btn.textContent = type === "All" ? "ALL" : `${type.toUpperCase()}S`;
    btn.setAttribute("aria-pressed", String(type === activeInventoryTypeFilter));
    btn.addEventListener("click", () => {
      activeInventoryTypeFilter = type;
      row.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      renderAdminInventoryList();
    });
    row.appendChild(btn);
  });
}

/* ---------------------------------------------------------------------
 * Similar inventory items — same idea as the "Similar Ingredient
 * Names"/"Similar Tags" tools under Recipes, but for actual InventoryItem
 * records. Catches things like "Tomato" and "Tomatoes" ending up as two
 * separate rows — easy to do from repeated manual entry, or importing a
 * written shopping/pantry list — which then silently double-count on the
 * "Needed for Recipes" report and the Layout mini-map.
 * ------------------------------------------------------------------- */

function computeSimilarInventoryGroups() {
  const items = adminInventoryItems.filter((i) => i.get("name"));
  const used = new Set(); // objectIds already placed in a group
  const rawGroups = []; // { items: InventoryItem[], fuzzy: boolean, reason: "exact"|"type"|"words" }

  // Tier 1 — exact match: same normalized name AND same normalized Type.
  // Two different Types of the same base name ("Tomato"/Roma vs
  // "Tomato"/Cherry) are treated as deliberately distinct, not
  // duplicates — that's the whole point of the Type field — so they're
  // never grouped here even though the base name matches.
  const exactMap = new Map();
  items.forEach((item) => {
    const nameKey = normalizeText(item.get("name"));
    if (!nameKey) return;
    const key = nameKey + "::" + normalizeText(item.get("variant") || "");
    if (!exactMap.has(key)) exactMap.set(key, []);
    exactMap.get(key).push(item);
  });
  exactMap.forEach((group) => {
    if (group.length < 2) return;
    group.forEach((i) => used.add(i.id));
    rawGroups.push({ items: group, fuzzy: false, reason: "exact" });
  });

  // Tier 2 — same base name, but Type set on only one side ("Tomato" vs
  // "Tomato" / Roma). Worth a look — maybe the untyped one is really an
  // old-style duplicate that should have been given the same Type, or
  // merged in — but NOT when both sides have a Type and they differ
  // (that's the explicit "these are different" signal, respected as-is).
  const remaining1 = items.filter((i) => !used.has(i.id));
  const byName = new Map();
  remaining1.forEach((item) => {
    const nameKey = normalizeText(item.get("name"));
    if (!nameKey) return;
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(item);
  });
  byName.forEach((group) => {
    if (group.length < 2) return;
    const untyped = group.filter((i) => !normalizeText(i.get("variant") || ""));
    const typed = group.filter((i) => normalizeText(i.get("variant") || ""));
    if (!untyped.length || !typed.length) return; // all untyped (tier 1 already caught exact dupes) or all distinctly typed — leave alone
    untyped.forEach((u) => {
      typed.forEach((t) => {
        rawGroups.push({ items: [u, t], fuzzy: true, reason: "type" });
        used.add(u.id);
        used.add(t.id);
      });
    });
  });

  // Tier 3 — fuzzy: one item's whole set of words (name + Type together)
  // is contained in another's ("Cabbage" inside "Napa Cabbage", "Milk"
  // inside "Whole Milk"). Lower confidence on purpose — a plain onion and
  // a green onion are genuinely different things despite one containing
  // the other's word — so these are still surfaced for a human to judge,
  // not folded in as certain duplicates.
  const remaining2 = items.filter((i) => !used.has(i.id));
  const paired = new Set();
  for (let i = 0; i < remaining2.length; i++) {
    if (paired.has(remaining2[i].id)) continue;
    const tokensI = new Set(tokenize(inventoryItemMatchText(remaining2[i])));
    if (!tokensI.size) continue;
    for (let j = i + 1; j < remaining2.length; j++) {
      if (paired.has(remaining2[j].id)) continue;
      const tokensJ = new Set(tokenize(inventoryItemMatchText(remaining2[j])));
      if (!tokensJ.size || tokensI.size === tokensJ.size) continue;
      const [smaller, larger] = tokensI.size < tokensJ.size ? [tokensI, tokensJ] : [tokensJ, tokensI];
      const isSubset = [...smaller].every((tok) => larger.has(tok));
      if (!isSubset) continue;
      rawGroups.push({ items: [remaining2[i], remaining2[j]], fuzzy: true, reason: "words" });
      paired.add(remaining2[i].id);
      paired.add(remaining2[j].id);
      break;
    }
  }

  return rawGroups
    .map(({ items: groupItems, fuzzy, reason }) => {
      // Canonical = whichever record has the most useful data to keep —
      // higher quantity, then has notes, then the longer/more descriptive
      // label ("Napa Cabbage" over "Cabbage", "Tomato — Roma" over "Tomato").
      const sorted = [...groupItems].sort((a, b) => {
        return (
          (b.get("quantity") || 0) - (a.get("quantity") || 0) ||
          (b.get("notes") ? 1 : 0) - (a.get("notes") ? 1 : 0) ||
          (inventoryItemLabel(b) || "").length - (inventoryItemLabel(a) || "").length
        );
      });
      return { canonical: sorted[0], duplicates: sorted.slice(1), fuzzy, reason };
    })
    .sort((a, b) => (inventoryItemLabel(a.canonical) || "").localeCompare(inventoryItemLabel(b.canonical) || ""));
}

/**
 * A stable identifier for a similar-inventory group, used to remember an
 * "IGNORE" dismissal across reloads/re-renders. Based on the actual
 * item ids involved (sorted so order doesn't matter), not the names —
 * names can change on edit, but this pairing of specific items is what
 * the person is actually saying "not a duplicate" about.
 */
function similarInventoryGroupKey(group) {
  return [group.canonical.id, ...group.duplicates.map((d) => d.id)].sort().join("|");
}

function renderSimilarInventory() {
  const container = document.getElementById("similar-inventory-list");
  if (!container) return;

  currentSimilarInventoryGroups = computeSimilarInventoryGroups().filter(
    (g) => !adminUiPrefs.ignoredSimilarInventory.includes(similarInventoryGroupKey(g))
  );
  if (currentSimilarInventoryGroups.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">No similar inventory items found.</p>`;
    return;
  }

  const tagText = { type: "different type?", words: "possible" };

  container.innerHTML = currentSimilarInventoryGroups
    .map((g, idx) => {
      const location = [g.canonical.get("location"), g.canonical.get("shelf")].filter(Boolean).join(" · ");
      const detail = `Also listed as: ${g.duplicates.map((i) => inventoryItemLabel(i)).join(", ")}${location ? ` — ${location}` : ""}`;
      const tag = tagText[g.reason];
      return `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(inventoryItemLabel(g.canonical))}${tag ? ` <span class="missing-ingredient-row__tag">${tag}</span>` : ""}</div>
          <div class="missing-ingredient-row__recipes">${escapeHtml(detail)}</div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
          <button type="button" class="btn btn--ghost btn--small" data-ignore-inventory-group="${idx}">IGNORE</button>
          <button type="button" class="btn btn--small btn--primary" data-merge-inventory-group="${idx}">MERGE</button>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-merge-inventory-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-merge-inventory-group"), 10);
      confirmMergeInventoryGroup(currentSimilarInventoryGroups[idx]);
    });
  });

  container.querySelectorAll("[data-ignore-inventory-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-ignore-inventory-group"), 10);
      const key = similarInventoryGroupKey(currentSimilarInventoryGroups[idx]);
      adminUiPrefs.ignoredSimilarInventory.push(key);
      saveAdminUiPrefs();
      showToast("Dismissed — won't show this pairing again.");
      renderSimilarInventory();
    });
  });
}

function confirmMergeInventoryGroup(group) {
  const keepName = inventoryItemLabel(group.canonical);
  const dropNames = group.duplicates.map((i) => inventoryItemLabel(i)).join(", ");
  let warning = "";
  if (group.reason === "type") {
    warning = " One of these has no Type set and the other is typed — double check whether the untyped one should really be merged into this one (same specific type) rather than kept as a separate, more generic batch.";
  } else if (group.reason === "words") {
    warning = ` These were flagged as only POSSIBLY the same thing (one name's words are contained in the other's) — double check "${dropNames}" is really the same item and not a genuinely different ingredient before merging.`;
  }
  openConfirmModal(
    "Merge duplicate inventory items?",
    `Opens "${keepName}" for editing — update the quantity/level here if the amounts should combine (e.g. you had a little cilantro left, then bought more) — then Save. Saving will also remove ${group.duplicates.length === 1 ? "the other entry" : "the other entries"}: ${dropNames}.${warning}`,
    "CONTINUE",
    () => {
      pendingMergeDeletions = group.duplicates.map((d) => d.id);
      pendingMergeLabel = keepName;
      openItemForm(group.canonical.id);
      showToast(`Editing "${keepName}" — Save will also remove: ${dropNames}`);
    }
  );
}

/* ---------------------------------------------------------------------
 * "Needed for recipes" — ingredients used across all recipes that don't
 * currently match anything in inventory, so it's fast to add just what
 * you went out and bought for a specific recipe.
 * ------------------------------------------------------------------- */

function computeMissingIngredients() {
  const missingMap = new Map(); // normalized name -> { key, name, recipes: Set, requiredSomewhere: boolean }
  adminRecipes.forEach((recipe) => {
    (recipe.get("ingredients") || []).forEach((ing) => {
      if (!ing.name) return;
      const { have } = matchIngredientAgainstInventory(ing.name, adminInventoryItems);
      if (have) return;
      const key = normalizeText(ing.name);
      if (!key) return;
      if (!missingMap.has(key)) {
        missingMap.set(key, { key, name: ing.name, recipes: new Set(), requiredSomewhere: false });
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

  const missing = computeMissingIngredients().filter((entry) => !adminUiPrefs.ignoredMissing.includes(entry.key));
  if (missing.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Every recipe ingredient is covered by your current inventory.</p>`;
    return;
  }

  container.innerHTML = missing
    .map((entry) => {
      // "milk or coconut milk" -> add just "milk" by default, not the whole phrase.
      const addName = ingredientAlternatives(entry.name)[0];
      return `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(titleCase(entry.name))}${entry.requiredSomewhere ? "" : ' <span class="missing-ingredient-row__tag">optional</span>'}</div>
          <div class="missing-ingredient-row__recipes">${escapeHtml(Array.from(entry.recipes).join(", "))}</div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
          <button type="button" class="btn btn--ghost btn--small" data-ignore-missing="${escapeHtml(entry.key)}">IGNORE</button>
          <button type="button" class="btn btn--small btn--primary" data-add-missing="${escapeHtml(addName)}">+ ADD</button>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-add-missing]").forEach((btn) => {
    btn.addEventListener("click", () => openItemForm(null, btn.getAttribute("data-add-missing")));
  });

  container.querySelectorAll("[data-ignore-missing]").forEach((btn) => {
    btn.addEventListener("click", () => {
      adminUiPrefs.ignoredMissing.push(btn.getAttribute("data-ignore-missing"));
      saveAdminUiPrefs();
      showToast("Dismissed — won't show this one again.");
      renderMissingIngredients();
    });
  });
}

function renderAdminInventoryList() {
  const listEl = document.getElementById("admin-inventory-list");
  const query = document.getElementById("admin-inventory-search").value.trim().toLowerCase();
  const filtered = adminInventoryItems.filter((item) => {
    if (activeInventoryTypeFilter !== "All" && (item.get("itemType") || "Food") !== activeInventoryTypeFilter) return false;
    if (!query) return true;
    return [item.get("name"), item.get("variant"), item.get("category"), item.get("location")].filter(Boolean).join(" ").toLowerCase().includes(query);
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
        <label class="checkbox-field"><input type="checkbox" class="bulk-select" data-select-item="${item.id}" ${selectedInventoryIds.has(item.id) ? "checked" : ""} /></label>
        <div class="admin-row__title">${escapeHtml(inventoryItemLabel(item))}</div>
        <div>${escapeHtml(item.get("category") || "")}</div>
        <div>${escapeHtml(item.get("location") || "")}${item.get("shelf") ? " · " + escapeHtml(item.get("shelf")) : ""}</div>
        <div>${escapeHtml((item.get("level") || "").toUpperCase())}</div>
        <div class="admin-row__actions">
          <button class="btn btn--ghost btn--small" data-edit-item="${item.id}">EDIT</button>
        </div>
      </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-select-item]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-select-item");
      if (cb.checked) selectedInventoryIds.add(id);
      else selectedInventoryIds.delete(id);
      updateInventoryBulkToolbar();
    });
  });

  listEl.querySelectorAll("[data-edit-item]").forEach((btn) => {
    btn.addEventListener("click", () => openItemForm(btn.getAttribute("data-edit-item")));
  });

  updateInventoryBulkToolbar();
}

function updateInventoryBulkToolbar() {
  const deleteBtn = document.getElementById("inventory-delete-selected-btn");
  deleteBtn.textContent = `DELETE SELECTED (${selectedInventoryIds.size})`;
  deleteBtn.disabled = selectedInventoryIds.size === 0;

  const visibleIds = Array.from(document.querySelectorAll("#admin-inventory-list [data-select-item]")).map((cb) => cb.getAttribute("data-select-item"));
  const selectAll = document.getElementById("inventory-select-all");
  selectAll.checked = visibleIds.length > 0 && visibleIds.every((id) => selectedInventoryIds.has(id));
}

function handleInventorySelectAllChange(e) {
  const visibleCheckboxes = document.querySelectorAll("#admin-inventory-list [data-select-item]");
  visibleCheckboxes.forEach((cb) => {
    cb.checked = e.target.checked;
    const id = cb.getAttribute("data-select-item");
    if (e.target.checked) selectedInventoryIds.add(id);
    else selectedInventoryIds.delete(id);
  });
  updateInventoryBulkToolbar();
}

function handleDeleteSelectedInventory() {
  const count = selectedInventoryIds.size;
  if (count === 0) return;
  openConfirmModal(
    `Delete ${count} item${count === 1 ? "" : "s"}?`,
    "This can't be undone.",
    "DELETE",
    async () => {
      for (const id of selectedInventoryIds) {
        await runAdminCloud("adminDeleteInventoryItem", { id });
      }
      selectedInventoryIds.clear();
      showToast(`Deleted ${count} item${count === 1 ? "" : "s"}.`);
      await loadAdminInventory();
    }
  );
}

/* ---------------------------------------------------------------------
 * Inventory item form
 * ------------------------------------------------------------------- */

function populateCategorySelect() {
  const categorySelect = document.getElementById("item-category");
  categorySelect.innerHTML = CONFIG.INVENTORY_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

/* ---------------------------------------------------------------------
 * Location/shelf picker — the "doll house" grid replaces the old
 * Location + Shelf dropdowns entirely. It reads/writes the same two
 * hidden fields (#item-location, #item-shelf) the rest of the form and
 * the Cloud Functions already expect, so nothing downstream changes.
 * ------------------------------------------------------------------- */

function setLocationPickerValue(location, shelf) {
  document.getElementById("item-location").value = location || "";
  document.getElementById("item-shelf").value = shelf || "";
  document.getElementById("item-location-picker-label").textContent = location ? (shelf ? `${location} · ${shelf}` : location) : "Not set";
}

async function openLocationPickerModal() {
  storageLayouts = await loadStorageLayouts();
  renderLocationPickerDollhouse();
  openModal(document.getElementById("location-picker-modal-overlay"));
}

function renderLocationPickerDollhouse() {
  document.getElementById("location-picker-breadcrumb").innerHTML = "";
  document.getElementById("location-picker-grid-wrap").hidden = true;
  const container = document.getElementById("location-picker-dollhouse");
  container.hidden = false;
  renderDollhouse(container, { layouts: storageLayouts, onSelect: renderLocationPickerGrid });
}

function renderLocationPickerGrid(location) {
  document.getElementById("location-picker-dollhouse").hidden = true;
  document.getElementById("location-picker-grid-wrap").hidden = false;

  const breadcrumb = document.getElementById("location-picker-breadcrumb");
  breadcrumb.innerHTML = `<button type="button" class="btn btn--ghost btn--small" id="location-picker-back-btn">← LOCATIONS</button>`;
  breadcrumb.querySelector("#location-picker-back-btn").addEventListener("click", renderLocationPickerDollhouse);

  const layout = storageLayouts[location];
  renderStorageGrid(document.getElementById("location-picker-grid"), {
    layout,
    mode: "pick",
    onZoneClick: (zone) => {
      setLocationPickerValue(location, zone.name);
      closeModal(document.getElementById("location-picker-modal-overlay"));
    },
  });

  document.getElementById("location-picker-no-shelf-btn").onclick = () => {
    setLocationPickerValue(location, "");
    closeModal(document.getElementById("location-picker-modal-overlay"));
  };
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

function applyItemTypeVisibility(itemType) {
  const isAppliance = itemType === "Appliance";
  document.getElementById("item-food-fields").style.display = isAppliance ? "none" : "contents";
  document.getElementById("item-appliance-fields").hidden = !isAppliance;
  document.getElementById("item-variant-label").innerHTML = isAppliance
    ? 'Brand/model <span style="color:var(--color-text-secondary); font-weight:400;">(optional)</span>'
    : 'Type <span style="color:var(--color-text-secondary); font-weight:400;">(optional)</span>';
  document.getElementById("item-variant").placeholder = isAppliance ? "e.g. Ninja, KitchenAid, Instant Pot Duo" : "e.g. Roma, Cherry, Heirloom";
}

function renderItemTypeSelector(selected) {
  const container = document.getElementById("item-type-selector");
  container.innerHTML = "";
  CONFIG.ITEM_TYPES.forEach((type) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-chip";
    btn.textContent = type.toUpperCase();
    btn.setAttribute("aria-pressed", String(type === selected));
    btn.addEventListener("click", () => {
      document.getElementById("item-type").value = type;
      container.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      applyItemTypeVisibility(type);
    });
    container.appendChild(btn);
  });
}

function openItemForm(itemId, prefillName) {
  editingItemId = itemId || null;
  const form = document.getElementById("item-form");
  form.reset();
  populateCategorySelect();

  const item = itemId ? adminInventoryItems.find((i) => i.id === itemId) : null;
  const itemType = item ? item.get("itemType") || "Food" : "Food";

  document.getElementById("item-modal-title").textContent = item ? "Edit item" : "Add item";
  document.getElementById("item-delete-btn").hidden = !item;

  document.getElementById("item-type").value = itemType;
  renderItemTypeSelector(itemType);
  applyItemTypeVisibility(itemType);

  if (item) {
    document.getElementById("item-name").value = item.get("name") || "";
    document.getElementById("item-variant").value = item.get("variant") || "";
    document.getElementById("item-category").value = item.get("category") || CONFIG.INVENTORY_CATEGORIES[0];
    if (itemType === "Appliance") {
      document.getElementById("item-appliance-location").value = item.get("location") || "";
      setLocationPickerValue(null, null);
    } else {
      setLocationPickerValue(item.get("location"), item.get("shelf"));
    }
    document.getElementById("item-quantity").value = item.get("quantity") ?? "";
    document.getElementById("item-unit").value = item.get("unit") || "";
    const exp = item.get("expirationDate");
    document.getElementById("item-expiration").value = exp ? new Date(exp).toISOString().slice(0, 10) : "";
    document.getElementById("item-notes").value = item.get("notes") || "";
    document.getElementById("item-level").value = item.get("level") || "Full";
    renderLevelSelector(item.get("level") || "Full");
  } else {
    setLocationPickerValue(null, null);
    document.getElementById("item-appliance-location").value = "";
    document.getElementById("item-level").value = "Full";
    renderLevelSelector("Full");
    document.getElementById("item-variant").value = "";
    if (prefillName) {
      document.getElementById("item-name").value = titleCase(prefillName);
    }
  }

  openModal(document.getElementById("item-modal-overlay"));
}

async function handleItemFormSubmit(e) {
  e.preventDefault();

  const itemType = document.getElementById("item-type").value;
  const isAppliance = itemType === "Appliance";

  if (!isAppliance && !document.getElementById("item-location").value) {
    showToast("Pick a spot for this item first.", "error");
    return;
  }
  if (isAppliance && !document.getElementById("item-appliance-location").value.trim()) {
    showToast("Add a location for this appliance first.", "error");
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SAVING…";

  const payload = isAppliance
    ? {
        name: document.getElementById("item-name").value.trim(),
        variant: document.getElementById("item-variant").value.trim(),
        itemType: "Appliance",
        category: "",
        location: document.getElementById("item-appliance-location").value.trim(),
        shelf: "",
        quantity: parseFloat(document.getElementById("item-quantity").value) || 0,
        unit: document.getElementById("item-unit").value.trim(),
        level: "",
        notes: document.getElementById("item-notes").value.trim(),
        expirationDate: null,
      }
    : {
        name: document.getElementById("item-name").value.trim(),
        variant: document.getElementById("item-variant").value.trim(),
        itemType: "Food",
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
    if (pendingMergeDeletions.length) {
      for (const dupId of pendingMergeDeletions) {
        await runAdminCloud("adminDeleteInventoryItem", { id: dupId });
      }
      showToast(`Merged into "${pendingMergeLabel}".`);
      pendingMergeDeletions = [];
      pendingMergeLabel = "";
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
 * Layout tab — the "doll house" grid editor for cupboards/fridge/etc.
 * Every location renders expanded, side by side, all editable at once —
 * a straight-on cutaway of the whole kitchen rather than one-at-a-time
 * drill-in. See storage-layout.js for the grid rendering + drag-to-draw.
 * ------------------------------------------------------------------- */

async function activateLayoutTab() {
  storageLayouts = await loadStorageLayouts();
  renderAllLayouts();
}

function renderAllLayouts() {
  const container = document.getElementById("layout-all");
  container.className = "layout-all";
  container.innerHTML = "";
  CONFIG.INVENTORY_LOCATIONS.forEach((location) => {
    container.appendChild(buildLocationEditorBlock(location));
  });
}

function buildLocationEditorBlock(location) {
  const block = document.createElement("div");
  block.className = "storage-editor";

  const head = document.createElement("div");
  head.className = "storage-editor__head";
  head.innerHTML = `<h2 style="font-size:var(--step-medium);">${escapeHtml(location.toUpperCase())}</h2>`;

  const resizeWrap = document.createElement("div");
  resizeWrap.className = "storage-editor__resize";
  const layout = storageLayouts[location];
  resizeWrap.innerHTML = `
    <label>Rows</label>
    <input type="number" min="1" max="12" value="${layout.rows}" class="layout-rows-input" />
    <label>Cols</label>
    <input type="number" min="1" max="12" value="${layout.cols}" class="layout-cols-input" />
    <button type="button" class="btn btn--ghost btn--small layout-resize-btn">RESIZE</button>
  `;
  head.appendChild(resizeWrap);
  block.appendChild(head);

  const gridEl = document.createElement("div");
  block.appendChild(gridEl);

  const hint = document.createElement("p");
  hint.className = "storage-editor__hint";
  hint.textContent = "Drag across empty cells to mark a new zone. Click a zone to rename, retype, or delete it.";
  block.appendChild(hint);

  function renderGrid() {
    renderStorageGrid(gridEl, {
      layout: storageLayouts[location],
      mode: "edit",
      onDraw: (rect) => openZoneModal(location, null, rect, renderGrid),
      onZoneClick: (zone) => openZoneModal(location, zone, null, renderGrid),
    });
  }
  renderGrid();

  resizeWrap.querySelector(".layout-resize-btn").addEventListener("click", async () => {
    const rows = Math.max(1, parseInt(resizeWrap.querySelector(".layout-rows-input").value, 10) || 1);
    const cols = Math.max(1, parseInt(resizeWrap.querySelector(".layout-cols-input").value, 10) || 1);
    const layoutObj = storageLayouts[location];
    const kept = (layoutObj.zones || []).filter((z) => z.rowEnd < rows && z.colEnd < cols);
    const droppedCount = layoutObj.zones.length - kept.length;
    layoutObj.rows = rows;
    layoutObj.cols = cols;
    layoutObj.zones = kept;
    try {
      await saveLayoutFor(location);
      renderGrid();
      showToast(droppedCount ? `Resized — ${droppedCount} zone(s) outside the new size were removed.` : "Resized.");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Couldn't resize.", "error");
    }
  });

  return block;
}

async function saveLayoutFor(location) {
  const layout = storageLayouts[location];
  const saved = await runAdminCloud("adminSaveStorageLayout", {
    location,
    rows: layout.rows,
    cols: layout.cols,
    zones: layout.zones,
  });
  layout.objectId = saved.objectId;
}

function openZoneModal(location, zone, rect, onSaved) {
  zoneModalContext = { location, zone, rect, onSaved };
  const typeSelect = document.getElementById("zone-type");
  typeSelect.innerHTML = CONFIG.STORAGE_ZONE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
  document.getElementById("zone-modal-title").textContent = zone ? "Edit zone" : "New zone";
  document.getElementById("zone-name").value = zone ? zone.name : "";
  typeSelect.value = zone ? zone.type : CONFIG.STORAGE_ZONE_TYPES[0];
  document.getElementById("zone-delete-btn").hidden = !zone;
  openModal(document.getElementById("zone-modal-overlay"));
}

async function handleZoneFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("zone-name").value.trim();
  if (!name) return;
  const type = document.getElementById("zone-type").value;
  const { location, zone, rect, onSaved } = zoneModalContext;
  const layout = storageLayouts[location];

  if (zone) {
    const existing = layout.zones.find((z) => z.id === zone.id);
    existing.name = name;
    existing.type = type;
  } else {
    layout.zones.push({
      id: "zone-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      name,
      type,
      ...rect,
    });
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SAVING…";
  try {
    await saveLayoutFor(location);
    closeModal(document.getElementById("zone-modal-overlay"));
    if (onSaved) onSaved();
    showToast("Zone saved.");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't save zone.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "SAVE";
  }
}

function handleZoneDeleteClick() {
  if (!zoneModalContext || !zoneModalContext.zone) return;
  const { location, zone, onSaved } = zoneModalContext;
  openConfirmModal(
    "Delete this zone?",
    `"${zone.name}" will be removed from the layout. Items already tagged with it keep their text label but the zone won't show on the map anymore.`,
    "DELETE",
    async () => {
      const layout = storageLayouts[location];
      layout.zones = layout.zones.filter((z) => z.id !== zone.id);
      await saveLayoutFor(location);
      closeModal(document.getElementById("zone-modal-overlay"));
      if (onSaved) onSaved();
      showToast("Zone deleted.");
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
        <label class="checkbox-field"><input type="checkbox" class="bulk-select" data-select-recipe="${r.id}" ${selectedRecipeIds.has(r.id) ? "checked" : ""} /></label>
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

  listEl.querySelectorAll("[data-select-recipe]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-select-recipe");
      if (cb.checked) selectedRecipeIds.add(id);
      else selectedRecipeIds.delete(id);
      updateRecipeBulkToolbar();
    });
  });

  listEl.querySelectorAll("[data-edit-recipe]").forEach((btn) => {
    btn.addEventListener("click", () => openRecipeForm(btn.getAttribute("data-edit-recipe")));
  });

  updateRecipeBulkToolbar();
}

function updateRecipeBulkToolbar() {
  const deleteBtn = document.getElementById("recipe-delete-selected-btn");
  deleteBtn.textContent = `DELETE SELECTED (${selectedRecipeIds.size})`;
  deleteBtn.disabled = selectedRecipeIds.size === 0;

  const visibleIds = Array.from(document.querySelectorAll("#admin-recipe-list [data-select-recipe]")).map((cb) => cb.getAttribute("data-select-recipe"));
  const selectAll = document.getElementById("recipe-select-all");
  selectAll.checked = visibleIds.length > 0 && visibleIds.every((id) => selectedRecipeIds.has(id));
}

function handleRecipeSelectAllChange(e) {
  const visibleCheckboxes = document.querySelectorAll("#admin-recipe-list [data-select-recipe]");
  visibleCheckboxes.forEach((cb) => {
    cb.checked = e.target.checked;
    const id = cb.getAttribute("data-select-recipe");
    if (e.target.checked) selectedRecipeIds.add(id);
    else selectedRecipeIds.delete(id);
  });
  updateRecipeBulkToolbar();
}

function handleDeleteSelectedRecipes() {
  const count = selectedRecipeIds.size;
  if (count === 0) return;
  openConfirmModal(
    `Delete ${count} recipe${count === 1 ? "" : "s"}?`,
    "This can't be undone — useful if you're clearing things out to start a section of the cookbook from scratch.",
    "DELETE",
    async () => {
      for (const id of selectedRecipeIds) {
        await runAdminCloud("adminDeleteRecipe", { id });
      }
      selectedRecipeIds.clear();
      showToast(`Deleted ${count} recipe${count === 1 ? "" : "s"}.`);
      await loadAdminRecipes();
    }
  );
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
    document.getElementById("recipe-appliances").value = (recipe.get("requiredAppliances") || []).join(", ");
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
    requiredAppliances: document.getElementById("recipe-appliances").value.split(",").map((t) => t.trim()).filter(Boolean),
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
 * Grocery shopping locations (Admin → Groceries) — the emoji-tagged
 * places you shop, e.g. "🥕 Sac Central Farmers Market". Managed here
 * under full admin login; the actual shopping list (add items, check
 * off) lives on the separate, PIN-gated groceries.html.
 * ------------------------------------------------------------------- */

async function loadGroceryLocations() {
  const listEl = document.getElementById("grocery-locations-list");
  listEl.innerHTML = `<div class="loading-row">Loading…</div>`;
  try {
    groceryLocations = await new Parse.Query(GroceryLocationClass).ascending("name").limit(200).find();
    renderGroceryLocationsList();
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load locations.</p></div>`;
  }
}

function renderGroceryLocationsList() {
  const listEl = document.getElementById("grocery-locations-list");
  if (groceryLocations.length === 0) {
    listEl.innerHTML = `<p class="admin-missing-empty">No locations yet — add the places you shop.</p>`;
    return;
  }

  listEl.innerHTML = groceryLocations
    .map(
      (loc) => `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(loc.get("emoji") || "")} ${escapeHtml(loc.get("name") || "")}</div>
          ${loc.get("hasBulkBins") ? `<div class="missing-ingredient-row__recipes">Has a bulk bin section</div>` : ""}
        </div>
        <button type="button" class="btn btn--ghost btn--small" data-edit-grocery-location="${loc.id}">EDIT</button>
      </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-edit-grocery-location]").forEach((btn) => {
    btn.addEventListener("click", () => openGroceryLocationModal(btn.getAttribute("data-edit-grocery-location")));
  });
}

function openGroceryLocationModal(locationId) {
  editingGroceryLocationId = locationId || null;
  const location = locationId ? groceryLocations.find((l) => l.id === locationId) : null;

  document.getElementById("grocery-location-modal-title").textContent = location ? "Edit location" : "New location";
  document.getElementById("grocery-location-emoji").value = location ? location.get("emoji") || "" : "";
  document.getElementById("grocery-location-name").value = location ? location.get("name") || "" : "";
  document.getElementById("grocery-location-bulk").checked = location ? !!location.get("hasBulkBins") : false;
  document.getElementById("grocery-location-delete-btn").hidden = !location;

  openModal(document.getElementById("grocery-location-modal-overlay"));
}

async function handleGroceryLocationFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("grocery-location-name").value.trim();
  if (!name) return;
  const emoji = document.getElementById("grocery-location-emoji").value.trim();
  const hasBulkBins = document.getElementById("grocery-location-bulk").checked;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SAVING…";
  try {
    await runAdminCloud("adminSaveGroceryLocation", { id: editingGroceryLocationId, name, emoji, hasBulkBins });
    closeModal(document.getElementById("grocery-location-modal-overlay"));
    showToast("Location saved.");
    await loadGroceryLocations();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't save location.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "SAVE";
  }
}

function handleGroceryLocationDeleteClick() {
  if (!editingGroceryLocationId) return;
  const id = editingGroceryLocationId;
  const location = groceryLocations.find((l) => l.id === id);
  openConfirmModal(
    "Delete this location?",
    `"${location ? location.get("name") : "This location"}" will no longer show up as an option on the grocery list. Items already added under it keep their text label but won't be grouped under it anymore.`,
    "DELETE",
    async () => {
      await runAdminCloud("adminDeleteGroceryLocation", { id });
      showToast("Location deleted.");
      closeModal(document.getElementById("grocery-location-modal-overlay"));
      await loadGroceryLocations();
    }
  );
}

/* ---------------------------------------------------------------------
 * Plants — location + watering schedule (Admin → Plants). Outdoor
 * plants' next-due date gets nudged by recent weather from Open-Meteo
 * (free, no API key, called directly from the browser — see
 * fetchRecentWeather below). This is a rough heuristic, not a precision
 * irrigation system: it just pushes the date out after real rain, and
 * pulls it in after a hot dry stretch, using the thresholds in
 * CONFIG.WATER_ADJUST_*.
 * ------------------------------------------------------------------- */

async function activatePlantsTab() {
  const weatherEl = document.getElementById("weather-summary");
  weatherEl.textContent = "Checking recent weather…";
  const [plantRecords, weather] = await Promise.all([
    new Parse.Query(Parse.Object.extend("Plant")).ascending("name").limit(200).find(),
    cachedWeather ? Promise.resolve(cachedWeather) : fetchRecentWeather(),
  ]);
  plants = plantRecords;
  cachedWeather = weather;

  if (weather) {
    weatherEl.textContent = `Last few days near you: ${weather.recentRainIn.toFixed(2)}" rain, ${Math.round(weather.recentMaxTempAvgF)}°F avg high. ${weatherNote(weather)}`;
  } else {
    weatherEl.textContent = "Couldn't reach the weather service — outdoor plants are showing their un-adjusted schedule.";
  }

  renderPlantsList();
}

/**
 * Open-Meteo: free, no API key, CORS-enabled for direct browser calls.
 * Pulls the last few days of daily rainfall + high temp for the
 * configured location (see CONFIG.WEATHER_LATITUDE/LONGITUDE).
 */
async function fetchRecentWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.WEATHER_LATITUDE}&longitude=${CONFIG.WEATHER_LONGITUDE}&daily=precipitation_sum,temperature_2m_max&past_days=5&forecast_days=1&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather request failed");
    const data = await res.json();
    const rain = (data.daily.precipitation_sum || []).reduce((sum, v) => sum + (v || 0), 0);
    const temps = data.daily.temperature_2m_max || [];
    const avgTemp = temps.length ? temps.reduce((sum, v) => sum + (v || 0), 0) / temps.length : null;
    return { recentRainIn: rain, recentMaxTempAvgF: avgTemp };
  } catch (err) {
    console.error("Weather fetch failed", err);
    return null;
  }
}

function weatherNote(weather) {
  if (weather.recentRainIn >= CONFIG.WATER_ADJUST_RAIN_THRESHOLD_IN) return "Outdoor plants' next watering is pushed out.";
  if (weather.recentMaxTempAvgF >= CONFIG.WATER_ADJUST_HEAT_THRESHOLD_F) return "Hot and dry — outdoor plants' next watering is pulled in.";
  return "No adjustment needed for outdoor plants right now.";
}

/**
 * Returns { nextDue: Date, adjustedDays: number, note: string } for one
 * plant. Indoor plants never get a weather adjustment (adjustedDays 0).
 */
function computePlantSchedule(plant, weather) {
  const lastWatered = plant.get("lastWatered") ? new Date(plant.get("lastWatered")) : new Date();
  const baseDays = plant.get("baseWaterDays") || 7;
  let adjustedDays = 0;
  let note = "";

  if (plant.get("isOutdoor") && weather) {
    if (weather.recentRainIn >= CONFIG.WATER_ADJUST_RAIN_THRESHOLD_IN) {
      adjustedDays = CONFIG.WATER_ADJUST_RAIN_DAYS;
      note = `Recent rain (${weather.recentRainIn.toFixed(2)}") — pushed out ${adjustedDays}d`;
    } else if (weather.recentMaxTempAvgF >= CONFIG.WATER_ADJUST_HEAT_THRESHOLD_F) {
      adjustedDays = -CONFIG.WATER_ADJUST_HEAT_DAYS;
      note = `Hot & dry (avg ${Math.round(weather.recentMaxTempAvgF)}°F) — pulled in ${Math.abs(adjustedDays)}d`;
    }
  }

  const nextDue = new Date(lastWatered);
  nextDue.setDate(nextDue.getDate() + baseDays + adjustedDays);
  return { lastWatered, nextDue, adjustedDays, note };
}

function renderPlantsList() {
  const container = document.getElementById("plants-list");
  if (plants.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">No plants yet — add the first one.</p>`;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const withSchedule = plants.map((plant) => ({ plant, schedule: computePlantSchedule(plant, cachedWeather) }));
  withSchedule.sort((a, b) => a.schedule.nextDue - b.schedule.nextDue);

  container.innerHTML = withSchedule
    .map(({ plant, schedule }) => {
      const dueDate = new Date(schedule.nextDue);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
      const dueText = daysUntil < 0 ? `OVERDUE by ${Math.abs(daysUntil)}d` : daysUntil === 0 ? "DUE TODAY" : `due in ${daysUntil}d`;
      const lastWateredText = schedule.lastWatered.toLocaleDateString();
      const indoorOutdoor = plant.get("isOutdoor") ? "Outdoor" : "Indoor";

      return `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(plant.get("name"))} <span class="missing-ingredient-row__tag">${dueText}</span></div>
          <div class="missing-ingredient-row__recipes">${escapeHtml(plant.get("location") || "")} · ${indoorOutdoor} · last watered ${escapeHtml(lastWateredText)}${schedule.note ? " · " + escapeHtml(schedule.note) : ""}</div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
          <button type="button" class="btn btn--ghost btn--small" data-edit-plant="${plant.id}">EDIT</button>
          <button type="button" class="btn btn--small btn--primary" data-water-plant="${plant.id}">💧 WATERED TODAY</button>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-edit-plant]").forEach((btn) => {
    btn.addEventListener("click", () => openPlantModal(btn.getAttribute("data-edit-plant")));
  });
  container.querySelectorAll("[data-water-plant]").forEach((btn) => {
    btn.addEventListener("click", () => handleWaterPlant(btn.getAttribute("data-water-plant")));
  });
}

async function handleWaterPlant(id) {
  try {
    await runAdminCloud("adminLogPlantWatering", { id });
    showToast("Logged — watered today.");
    await activatePlantsTab();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't log watering.", "error");
  }
}

function renderPlantOutdoorSelector(selected) {
  const container = document.getElementById("plant-outdoor-selector");
  container.innerHTML = "";
  [
    { label: "Indoor", value: "false" },
    { label: "Outdoor", value: "true" },
  ].forEach(({ label, value }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-chip";
    btn.textContent = label.toUpperCase();
    btn.setAttribute("aria-pressed", String(value === selected));
    btn.addEventListener("click", () => {
      document.getElementById("plant-is-outdoor").value = value;
      container.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
    });
    container.appendChild(btn);
  });
}

function openPlantModal(plantId) {
  editingPlantId = plantId || null;
  const plant = plantId ? plants.find((p) => p.id === plantId) : null;

  document.getElementById("plant-modal-title").textContent = plant ? "Edit plant" : "New plant";
  document.getElementById("plant-name").value = plant ? plant.get("name") || "" : "";
  document.getElementById("plant-location").value = plant ? plant.get("location") || "" : "";
  document.getElementById("plant-water-days").value = plant ? plant.get("baseWaterDays") || 7 : 7;
  document.getElementById("plant-notes").value = plant ? plant.get("notes") || "" : "";
  const isOutdoor = plant ? String(!!plant.get("isOutdoor")) : "false";
  document.getElementById("plant-is-outdoor").value = isOutdoor;
  renderPlantOutdoorSelector(isOutdoor);
  document.getElementById("plant-delete-btn").hidden = !plant;

  openModal(document.getElementById("plant-modal-overlay"));
}

async function handlePlantFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("plant-name").value.trim();
  const location = document.getElementById("plant-location").value.trim();
  if (!name || !location) return;

  const payload = {
    name,
    location,
    isOutdoor: document.getElementById("plant-is-outdoor").value === "true",
    baseWaterDays: parseInt(document.getElementById("plant-water-days").value, 10) || 7,
    notes: document.getElementById("plant-notes").value.trim(),
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SAVING…";
  try {
    await runAdminCloud("adminSavePlant", { id: editingPlantId, ...payload });
    closeModal(document.getElementById("plant-modal-overlay"));
    showToast("Plant saved.");
    await activatePlantsTab();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't save plant.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "SAVE";
  }
}

function handlePlantDeleteClick() {
  if (!editingPlantId) return;
  const plant = plants.find((p) => p.id === editingPlantId);
  const id = editingPlantId;
  openConfirmModal(
    "Delete this plant?",
    `"${plant ? plant.get("name") : "This plant"}" will be removed from the watering schedule.`,
    "DELETE",
    async () => {
      await runAdminCloud("adminDeletePlant", { id });
      showToast("Plant deleted.");
      closeModal(document.getElementById("plant-modal-overlay"));
      await activatePlantsTab();
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
  document.getElementById("item-cancel-btn").addEventListener("click", () => {
    pendingMergeDeletions = [];
    pendingMergeLabel = "";
    closeModal(document.getElementById("item-modal-overlay"));
  });
  document.getElementById("item-modal-close").addEventListener("click", () => {
    pendingMergeDeletions = [];
    pendingMergeLabel = "";
    closeModal(document.getElementById("item-modal-overlay"));
  });
  document.getElementById("item-delete-btn").addEventListener("click", handleItemDeleteClick);
  document.getElementById("item-location-picker-btn").addEventListener("click", openLocationPickerModal);
  document.getElementById("location-picker-modal-close").addEventListener("click", () => closeModal(document.getElementById("location-picker-modal-overlay")));
  document.getElementById("admin-inventory-search").addEventListener("input", renderAdminInventoryList);
  document.getElementById("inventory-select-all").addEventListener("change", handleInventorySelectAllChange);
  document.getElementById("inventory-delete-selected-btn").addEventListener("click", handleDeleteSelectedInventory);

  // Layout
  document.getElementById("zone-form").addEventListener("submit", handleZoneFormSubmit);
  document.getElementById("zone-cancel-btn").addEventListener("click", () => closeModal(document.getElementById("zone-modal-overlay")));
  document.getElementById("zone-modal-close").addEventListener("click", () => closeModal(document.getElementById("zone-modal-overlay")));
  document.getElementById("zone-delete-btn").addEventListener("click", handleZoneDeleteClick);

  // Groceries (locations only — the shopping list itself is on groceries.html)
  document.getElementById("add-grocery-location-btn").addEventListener("click", () => openGroceryLocationModal(null));
  document.getElementById("grocery-location-form").addEventListener("submit", handleGroceryLocationFormSubmit);
  document.getElementById("grocery-location-cancel-btn").addEventListener("click", () => closeModal(document.getElementById("grocery-location-modal-overlay")));
  document.getElementById("grocery-location-modal-close").addEventListener("click", () => closeModal(document.getElementById("grocery-location-modal-overlay")));
  document.getElementById("grocery-location-delete-btn").addEventListener("click", handleGroceryLocationDeleteClick);

  document.getElementById("add-plant-btn").addEventListener("click", () => openPlantModal(null));
  document.getElementById("plant-form").addEventListener("submit", handlePlantFormSubmit);
  document.getElementById("plant-cancel-btn").addEventListener("click", () => closeModal(document.getElementById("plant-modal-overlay")));
  document.getElementById("plant-modal-close").addEventListener("click", () => closeModal(document.getElementById("plant-modal-overlay")));
  document.getElementById("plant-delete-btn").addEventListener("click", handlePlantDeleteClick);

  setupCollapsibleSection("missingIngredients", "toggle-missing-ingredients");
  setupCollapsibleSection("similarInventory", "toggle-similar-inventory");

  // Recipes
  document.getElementById("add-recipe-btn").addEventListener("click", () => openRecipeForm(null));
  document.getElementById("recipe-form").addEventListener("submit", handleRecipeFormSubmit);
  document.getElementById("recipe-cancel-btn").addEventListener("click", () => closeModal(document.getElementById("recipe-form-modal-overlay")));
  document.getElementById("recipe-form-modal-close").addEventListener("click", () => closeModal(document.getElementById("recipe-form-modal-overlay")));
  document.getElementById("recipe-delete-btn").addEventListener("click", handleRecipeDeleteClick);
  document.getElementById("add-ingredient-row").addEventListener("click", () => addIngredientRow());
  document.getElementById("admin-recipe-search").addEventListener("input", renderAdminRecipeList);
  document.getElementById("recipe-select-all").addEventListener("change", handleRecipeSelectAllChange);
  document.getElementById("recipe-delete-selected-btn").addEventListener("click", handleDeleteSelectedRecipes);

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
