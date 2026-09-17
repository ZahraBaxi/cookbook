/**
 * groceries.js
 * -----------------------------------------------------------------------
 * Powers groceries.html. The list itself is visible to EVERYONE, no PIN
 * needed — that's the point, so it's easy to send a family member a link
 * and have them see what to pick up. The 4-digit PIN (see runGroceryCloud
 * / groceryLogin in parse.js + Cloud Code) only gates adding/editing/
 * checking off items; it's deliberately much lighter than the admin
 * login. Shopping locations (name + emoji + whether they have a bulk bin
 * section) are read here but only editable from Admin → Groceries.
 * -----------------------------------------------------------------------
 */

const GroceryItemClass = Parse.Object.extend("GroceryItem");
const GroceryLocationClass = Parse.Object.extend("GroceryLocation");

let groceryLocations = [];
let groceryItems = [];
let activeCheckLocation = "All";
let editingGroceryItemId = null; // set while the Add form is editing an existing item

/* ---------------------------------------------------------------------
 * Lock / unlock UI state. Reading the list never depends on this —
 * loadGroceryData() runs unconditionally on page load. This only
 * controls whether the editable Add/Check-off UI is shown.
 * ------------------------------------------------------------------- */

function showUnlockedView() {
  document.getElementById("grocery-readonly-view").hidden = true;
  document.getElementById("grocery-editor-view").hidden = false;
  document.getElementById("grocery-unlock-toggle-btn").hidden = true;
  document.getElementById("grocery-lock-btn").hidden = false;
  document.getElementById("grocery-pin-form").hidden = true;
}

function showLockedView() {
  document.getElementById("grocery-readonly-view").hidden = false;
  document.getElementById("grocery-editor-view").hidden = true;
  document.getElementById("grocery-unlock-toggle-btn").hidden = false;
  document.getElementById("grocery-lock-btn").hidden = true;
}

function handleUnlockToggleClick() {
  const form = document.getElementById("grocery-pin-form");
  form.hidden = !form.hidden;
  if (!form.hidden) document.getElementById("grocery-pin-input").focus();
}

function handlePinCancelClick() {
  const form = document.getElementById("grocery-pin-form");
  form.hidden = true;
  document.getElementById("grocery-pin-input").value = "";
  document.getElementById("grocery-pin-error").classList.remove("admin-error--visible");
}

async function handlePinSubmit(e) {
  e.preventDefault();
  const pin = document.getElementById("grocery-pin-input").value.trim();
  const errorEl = document.getElementById("grocery-pin-error");
  errorEl.classList.remove("admin-error--visible");

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "CHECKING…";

  try {
    const result = await Parse.Cloud.run("groceryLogin", { pin });
    if (result && result.token) {
      setGrocerySession(result.token);
      document.getElementById("grocery-pin-input").value = "";
      showUnlockedView();
    } else {
      throw new Error("No token returned");
    }
  } catch (err) {
    errorEl.classList.add("admin-error--visible");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "UNLOCK";
  }
}

function handleLockClick() {
  clearGrocerySession();
  showLockedView();
  showToast("Locked.");
}

/**
 * If a Cloud Function call fails because the grocery session is missing/
 * expired, send the person back to the locked view with a clear reason
 * instead of leaving them stuck looking at a generic error toast.
 */
function handleGroceryAuthError(err) {
  if (err && err.code === Parse.Error.INVALID_SESSION_TOKEN) {
    clearGrocerySession();
    showLockedView();
    showToast("Session expired — unlock with the PIN again.", "error");
    return true;
  }
  return false;
}

/* ---------------------------------------------------------------------
 * Loading + shared setup
 * ------------------------------------------------------------------- */

async function loadGroceryData() {
  try {
    [groceryLocations, groceryItems] = await Promise.all([
      new Parse.Query(GroceryLocationClass).ascending("name").limit(200).find(),
      new Parse.Query(GroceryItemClass).ascending("category").limit(1000).find(),
    ]);
    populateCategorySelect();
    populateLocationSelect();
    renderReadonlyList();
    renderAddList();
    renderCheckLocationFilter();
    renderCheckList();
  } catch (err) {
    console.error(err);
    showToast("Couldn't load the grocery list — check your connection.", "error");
  }
}

function populateCategorySelect() {
  document.getElementById("grocery-item-category").innerHTML = CONFIG.INVENTORY_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function populateLocationSelect() {
  const select = document.getElementById("grocery-item-location");
  const previousValue = select.value;
  const options = [`<option value="">No specific store</option>`];
  groceryLocations.forEach((loc) => {
    const label = [loc.get("emoji"), loc.get("name")].filter(Boolean).join(" ");
    options.push(`<option value="${escapeHtml(loc.get("name"))}">${escapeHtml(label)}</option>`);
  });
  select.innerHTML = options.join("");
  if ([...select.options].some((o) => o.value === previousValue)) select.value = previousValue;
  updateBulkFieldVisibility();
}

function locationLabel(name) {
  if (!name) return "No specific store";
  const loc = groceryLocations.find((l) => l.get("name") === name);
  return loc ? [loc.get("emoji"), loc.get("name")].filter(Boolean).join(" ") : name;
}

function locationHasBulkBins(name) {
  const loc = groceryLocations.find((l) => l.get("name") === name);
  return !!(loc && loc.get("hasBulkBins"));
}

function itemDisplayLine(item) {
  return item.get("bulk") ? `${item.get("name")} 🫙 bulk` : item.get("name");
}

/**
 * Shows/hides the "this is in the bulk bin section" checkbox in the Add
 * form depending on whether the currently-selected store actually has a
 * bulk section — set per-location in Admin → Groceries. Unchecks it
 * automatically when hidden so a stale bulk flag can't sneak through if
 * you pick a bulk-bin store, check it, then switch to a store without one.
 */
function updateBulkFieldVisibility() {
  const location = document.getElementById("grocery-item-location").value;
  const field = document.getElementById("grocery-item-bulk-field");
  const hasBulk = locationHasBulkBins(location);
  field.hidden = !hasBulk;
  if (!hasBulk) document.getElementById("grocery-item-bulk").checked = false;
}

/* ---------------------------------------------------------------------
 * Read-only view — visible to everyone, no PIN required
 * ------------------------------------------------------------------- */

function renderReadonlyList() {
  const container = document.getElementById("grocery-readonly-list");
  if (groceryItems.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Nothing on the list right now.</p>`;
    return;
  }

  const byLocation = new Map();
  groceryItems.forEach((item) => {
    const key = item.get("location") || "";
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push(item);
  });

  const sections = Array.from(byLocation.entries()).sort(([a], [b]) => locationLabel(a).localeCompare(locationLabel(b)));

  container.innerHTML = sections
    .map(([location, items]) => {
      const rows = items
        .map(
          (item) => `
        <div class="missing-ingredient-row">
          <div>
            <div class="missing-ingredient-row__name">${escapeHtml(itemDisplayLine(item))}</div>
            <div class="missing-ingredient-row__recipes">${escapeHtml(item.get("category") || "")}</div>
          </div>
        </div>`
        )
        .join("");
      return `
        <div class="admin-missing-section">
          <div class="admin-missing-section__title">${escapeHtml(locationLabel(location).toUpperCase())}</div>
          ${rows}
        </div>`;
    })
    .join("");
}

/* ---------------------------------------------------------------------
 * Add to list (editable — requires unlocking)
 * ------------------------------------------------------------------- */

function renderAddList() {
  const container = document.getElementById("grocery-add-list");
  if (groceryItems.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Nothing on the list yet — add something above.</p>`;
    return;
  }

  const byLocation = new Map();
  groceryItems.forEach((item) => {
    const key = item.get("location") || "";
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push(item);
  });

  const sections = Array.from(byLocation.entries()).sort(([a], [b]) => locationLabel(a).localeCompare(locationLabel(b)));

  container.innerHTML = sections
    .map(([location, items]) => {
      const rows = items
        .map(
          (item) => `
        <div class="missing-ingredient-row">
          <div>
            <div class="missing-ingredient-row__name">${escapeHtml(itemDisplayLine(item))}</div>
            <div class="missing-ingredient-row__recipes">${escapeHtml(item.get("category") || "")}</div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button type="button" class="btn btn--ghost btn--small" data-edit-item="${item.id}">EDIT</button>
            <button type="button" class="btn btn--ghost btn--small" data-remove-item="${item.id}">REMOVE</button>
          </div>
        </div>`
        )
        .join("");
      return `
        <div class="admin-missing-section">
          <div class="admin-missing-section__title">${escapeHtml(locationLabel(location).toUpperCase())}</div>
          ${rows}
        </div>`;
    })
    .join("");

  container.querySelectorAll("[data-remove-item]").forEach((btn) => {
    btn.addEventListener("click", () => removeGroceryItem(btn.getAttribute("data-remove-item"), "Removed."));
  });
  container.querySelectorAll("[data-edit-item]").forEach((btn) => {
    btn.addEventListener("click", () => startEditingGroceryItem(btn.getAttribute("data-edit-item")));
  });
}

function startEditingGroceryItem(id) {
  const item = groceryItems.find((i) => i.id === id);
  if (!item) return;

  editingGroceryItemId = id;
  document.getElementById("grocery-item-name").value = item.get("name") || "";
  document.getElementById("grocery-item-category").value = item.get("category") || CONFIG.INVENTORY_CATEGORIES[0];
  document.getElementById("grocery-item-location").value = item.get("location") || "";
  updateBulkFieldVisibility();
  document.getElementById("grocery-item-bulk").checked = !!item.get("bulk");

  document.getElementById("grocery-add-submit-btn").textContent = "SAVE CHANGES";
  document.getElementById("grocery-add-cancel-edit-btn").hidden = false;
  document.getElementById("grocery-item-name").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEditingGroceryItem() {
  editingGroceryItemId = null;
  document.getElementById("grocery-add-form").reset();
  populateCategorySelect();
  populateLocationSelect();
  document.getElementById("grocery-add-submit-btn").textContent = "ADD TO LIST";
  document.getElementById("grocery-add-cancel-edit-btn").hidden = true;
}

async function handleAddFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("grocery-item-name").value.trim();
  if (!name) return;

  const location = document.getElementById("grocery-item-location").value;
  const payload = {
    name,
    category: document.getElementById("grocery-item-category").value,
    location,
    bulk: locationHasBulkBins(location) ? document.getElementById("grocery-item-bulk").checked : false,
  };

  const submitBtn = document.getElementById("grocery-add-submit-btn");
  const wasEditing = !!editingGroceryItemId;
  submitBtn.disabled = true;
  submitBtn.textContent = wasEditing ? "SAVING…" : "ADDING…";
  try {
    if (wasEditing) {
      await runGroceryCloud("groceryUpdateItem", { id: editingGroceryItemId, ...payload });
      showToast(`Saved "${name}".`);
    } else {
      await runGroceryCloud("groceryCreateItem", payload);
      showToast(`Added "${name}".`);
    }
    cancelEditingGroceryItem();
    document.getElementById("grocery-item-name").focus();
    await loadGroceryData();
  } catch (err) {
    console.error(err);
    if (!handleGroceryAuthError(err)) showToast(err.message || "Couldn't save that item.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = wasEditing ? "SAVE CHANGES" : "ADD TO LIST";
  }
}

/* ---------------------------------------------------------------------
 * Check off (at the store — requires unlocking)
 * ------------------------------------------------------------------- */

function renderCheckLocationFilter() {
  const container = document.getElementById("grocery-check-location-filter");
  const locationsInUse = [...new Set(groceryItems.map((i) => i.get("location") || ""))];
  const chips = ["All", ...locationsInUse.sort((a, b) => locationLabel(a).localeCompare(locationLabel(b)))];

  container.innerHTML = chips
    .map((loc) => {
      const label = loc === "All" ? "All" : locationLabel(loc);
      const isActive = activeCheckLocation === loc;
      return `<button type="button" class="filter-chip" data-location="${escapeHtml(loc)}" aria-pressed="${isActive}">${escapeHtml(label)}</button>`;
    })
    .join("");

  container.querySelectorAll("[data-location]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCheckLocation = btn.getAttribute("data-location");
      renderCheckLocationFilter();
      renderCheckList();
    });
  });
}

function renderCheckList() {
  const container = document.getElementById("grocery-check-list");
  const filtered = groceryItems.filter((item) => activeCheckLocation === "All" || (item.get("location") || "") === activeCheckLocation);

  if (filtered.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Nothing here — everything's checked off, or try a different location.</p>`;
    return;
  }

  const byCategory = new Map();
  filtered.forEach((item) => {
    const key = item.get("category") || "Other";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(item);
  });

  const sections = Array.from(byCategory.entries()).sort(([a], [b]) => a.localeCompare(b));

  container.innerHTML = sections
    .map(([category, items]) => {
      const rows = items
        .map(
          (item) => `
        <label class="missing-ingredient-row" style="cursor:pointer;">
          <span class="checkbox-field" style="gap:0.75rem;">
            <input type="checkbox" data-check-item="${item.id}" />
            <span class="missing-ingredient-row__name" style="font-weight:600;">${escapeHtml(itemDisplayLine(item))}</span>
          </span>
          <span class="missing-ingredient-row__recipes">${escapeHtml(locationLabel(item.get("location")))}</span>
        </label>`
        )
        .join("");
      return `
        <div class="admin-missing-section">
          <div class="admin-missing-section__title">${escapeHtml(category.toUpperCase())}</div>
          ${rows}
        </div>`;
    })
    .join("");

  container.querySelectorAll("[data-check-item]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) removeGroceryItem(checkbox.getAttribute("data-check-item"), "Got it — checked off.");
    });
  });
}

/* ---------------------------------------------------------------------
 * Shared: removing an item (used by both "Remove" in Add view and
 * checking a box in Check-off view — either way, it's off the list)
 * ------------------------------------------------------------------- */

async function removeGroceryItem(id, toastMessage) {
  try {
    await runGroceryCloud("groceryDeleteItem", { id });
    if (editingGroceryItemId === id) cancelEditingGroceryItem();
    groceryItems = groceryItems.filter((i) => i.id !== id);
    renderReadonlyList();
    renderAddList();
    renderCheckLocationFilter();
    renderCheckList();
    showToast(toastMessage);
  } catch (err) {
    console.error(err);
    if (!handleGroceryAuthError(err)) showToast(err.message || "Couldn't remove that item.", "error");
  }
}

/* ---------------------------------------------------------------------
 * Tabs + wiring
 * ------------------------------------------------------------------- */

function initGroceryTabs() {
  const tabAdd = document.getElementById("tab-grocery-add");
  const tabCheck = document.getElementById("tab-grocery-check");
  const panelAdd = document.getElementById("panel-grocery-add");
  const panelCheck = document.getElementById("panel-grocery-check");

  function activate(name) {
    const isAdd = name === "add";
    tabAdd.setAttribute("aria-selected", String(isAdd));
    tabCheck.setAttribute("aria-selected", String(!isAdd));
    panelAdd.hidden = !isAdd;
    panelCheck.hidden = isAdd;
  }

  tabAdd.addEventListener("click", () => activate("add"));
  tabCheck.addEventListener("click", () => activate("check"));
}

document.addEventListener("DOMContentLoaded", () => {
  initGroceryTabs();
  document.getElementById("grocery-unlock-toggle-btn").addEventListener("click", handleUnlockToggleClick);
  document.getElementById("grocery-pin-cancel-btn").addEventListener("click", handlePinCancelClick);
  document.getElementById("grocery-pin-form").addEventListener("submit", handlePinSubmit);
  document.getElementById("grocery-lock-btn").addEventListener("click", handleLockClick);
  document.getElementById("grocery-add-form").addEventListener("submit", handleAddFormSubmit);
  document.getElementById("grocery-add-cancel-edit-btn").addEventListener("click", cancelEditingGroceryItem);
  document.getElementById("grocery-item-location").addEventListener("change", updateBulkFieldVisibility);

  // The list itself is always visible — this only decides whether the
  // editable Add/Check-off UI shows up alongside it.
  if (isGroceryUnlocked()) {
    showUnlockedView();
  } else {
    showLockedView();
  }
  loadGroceryData();
});
