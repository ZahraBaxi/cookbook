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
 *
 * A grocery item's lifecycle: "list" (still need it) -> checking it off
 * moves it to "checkedOut" (bought, not yet put away) -> "Put away" in
 * the Checkout tab turns it into a real InventoryItem and removes it
 * from the grocery list entirely.
 * -----------------------------------------------------------------------
 */

const GroceryItemClass = Parse.Object.extend("GroceryItem");
const GroceryLocationClass = Parse.Object.extend("GroceryLocation");
const InventoryItemClass = Parse.Object.extend("InventoryItem");

let groceryLocations = [];
let groceryItems = [];
let lowStockItems = [];
let storageLayouts = {}; // location -> { rows, cols, zones } — see storage-layout.js, used by the put-away picker
let activeCheckLocation = "All";
let editingGroceryItemId = null; // set while the Add form is editing an existing item
let putawayGroceryItem = null; // the checked-out GroceryItem currently being put away

const activeGroceryItems = () => groceryItems.filter((i) => (i.get("status") || "list") === "list");
const checkedOutGroceryItems = () => groceryItems.filter((i) => i.get("status") === "checkedOut");

/* ---------------------------------------------------------------------
 * Lock / unlock UI state. Reading the list never depends on this —
 * loadGroceryData() runs unconditionally on page load. This only
 * controls whether the editable Add/Check-off/Checkout UI is shown.
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
    const [locations, items, inventory] = await Promise.all([
      new Parse.Query(GroceryLocationClass).ascending("name").limit(200).find(),
      new Parse.Query(GroceryItemClass).ascending("category").limit(1000).find(),
      new Parse.Query(InventoryItemClass).ascending("name").limit(2000).find(),
    ]);
    groceryLocations = locations;
    groceryItems = items;
    lowStockItems = inventory.filter((i) => CONFIG.LOW_LEVELS.includes(i.get("level")));

    populateCategorySelect();
    populateLocationSelect();
    renderReadonlyList();
    renderLowStockList();
    renderAddList();
    renderCheckLocationFilter();
    renderCheckList();
    renderCheckoutList();
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
 * Low stock suggestions — inventory items running low, shown as quick
 * "add to list" candidates right where you're already building the
 * list. "Finished" removes the item from Inventory entirely (it's used
 * up, not just low) without a separate trip to Admin.
 * ------------------------------------------------------------------- */

const LOW_STOCK_COLLAPSE_KEY = "kitchen_grocery_low_stock_collapsed";

function setupLowStockToggle() {
  const toggleBtn = document.getElementById("toggle-low-stock");
  const bodyEl = document.getElementById("low-stock-list");
  function apply() {
    const collapsed = localStorage.getItem(LOW_STOCK_COLLAPSE_KEY) === "1";
    bodyEl.hidden = collapsed;
    toggleBtn.textContent = collapsed ? "SHOW" : "HIDE";
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));
  }
  toggleBtn.addEventListener("click", () => {
    const collapsed = localStorage.getItem(LOW_STOCK_COLLAPSE_KEY) === "1";
    localStorage.setItem(LOW_STOCK_COLLAPSE_KEY, collapsed ? "0" : "1");
    apply();
  });
  apply();
}

function renderLowStockList() {
  const container = document.getElementById("low-stock-list");
  document.getElementById("low-stock-section").hidden = lowStockItems.length === 0;
  if (lowStockItems.length === 0) return;

  container.innerHTML = lowStockItems
    .map(
      (item) => `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(inventoryItemLabel(item))} <span class="missing-ingredient-row__tag">${escapeHtml((item.get("level") || "").toUpperCase())}</span></div>
          <div class="missing-ingredient-row__recipes">${escapeHtml([item.get("location"), item.get("shelf")].filter(Boolean).join(" · "))}</div>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn--ghost btn--small" data-finished-item="${item.id}">FINISHED</button>
          <button type="button" class="btn btn--small btn--primary" data-quick-add="${item.id}">+ ADD TO LIST</button>
        </div>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-quick-add]").forEach((btn) => {
    btn.addEventListener("click", () => quickAddLowStockItem(btn.getAttribute("data-quick-add")));
  });
  container.querySelectorAll("[data-finished-item]").forEach((btn) => {
    btn.addEventListener("click", () => markInventoryItemFinished(btn.getAttribute("data-finished-item")));
  });
}

async function quickAddLowStockItem(inventoryItemId) {
  const item = lowStockItems.find((i) => i.id === inventoryItemId);
  if (!item) return;
  try {
    await runGroceryCloud("groceryCreateItem", {
      name: item.get("name"),
      category: item.get("category") || CONFIG.INVENTORY_CATEGORIES[0],
      location: "",
      bulk: false,
      status: "list",
    });
    showToast(`Added "${item.get("name")}" to the list.`);
    await loadGroceryData();
  } catch (err) {
    console.error(err);
    if (!handleGroceryAuthError(err)) showToast(err.message || "Couldn't add that item.", "error");
  }
}

function markInventoryItemFinished(inventoryItemId) {
  const item = lowStockItems.find((i) => i.id === inventoryItemId);
  if (!item) return;
  if (!window.confirm(`Remove "${inventoryItemLabel(item)}" from Inventory? This can't be undone.`)) return;
  runGroceryCloud("groceryDeleteInventoryItem", { id: inventoryItemId })
    .then(() => {
      showToast(`Removed "${item.get("name")}" from Inventory.`);
      lowStockItems = lowStockItems.filter((i) => i.id !== inventoryItemId);
      renderLowStockList();
    })
    .catch((err) => {
      console.error(err);
      if (!handleGroceryAuthError(err)) showToast(err.message || "Couldn't remove that item.", "error");
    });
}

/* ---------------------------------------------------------------------
 * Read-only view — visible to everyone, no PIN required. Only shows
 * items still actively needed (not yet bought/checked off).
 * ------------------------------------------------------------------- */

function renderReadonlyList() {
  const container = document.getElementById("grocery-readonly-list");
  const items = activeGroceryItems();
  if (items.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Nothing on the list right now.</p>`;
    return;
  }

  const byLocation = new Map();
  items.forEach((item) => {
    const key = item.get("location") || "";
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push(item);
  });

  const sections = Array.from(byLocation.entries()).sort(([a], [b]) => locationLabel(a).localeCompare(locationLabel(b)));

  container.innerHTML = sections
    .map(([location, locationItems]) => {
      const rows = locationItems
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
  const items = activeGroceryItems();
  if (items.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Nothing on the list yet — add something above.</p>`;
    return;
  }

  const byLocation = new Map();
  items.forEach((item) => {
    const key = item.get("location") || "";
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push(item);
  });

  const sections = Array.from(byLocation.entries()).sort(([a], [b]) => locationLabel(a).localeCompare(locationLabel(b)));

  container.innerHTML = sections
    .map(([location, locationItems]) => {
      const rows = locationItems
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
      await runGroceryCloud("groceryCreateItem", { ...payload, status: "list" });
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
 * Check off (at the store — requires unlocking). Checking a box doesn't
 * delete the item — it moves to the Checkout pile until it's put away.
 * ------------------------------------------------------------------- */

function renderCheckLocationFilter() {
  const container = document.getElementById("grocery-check-location-filter");
  const items = activeGroceryItems();
  const locationsInUse = [...new Set(items.map((i) => i.get("location") || ""))];
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
  const filtered = activeGroceryItems().filter((item) => activeCheckLocation === "All" || (item.get("location") || "") === activeCheckLocation);

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
      if (checkbox.checked) checkOffGroceryItem(checkbox.getAttribute("data-check-item"));
    });
  });
}

async function checkOffGroceryItem(id) {
  try {
    await runGroceryCloud("groceryUpdateItem", { id, status: "checkedOut" });
    showToast("Got it — moved to Checkout.");
    await loadGroceryData();
  } catch (err) {
    console.error(err);
    if (!handleGroceryAuthError(err)) showToast(err.message || "Couldn't check that off.", "error");
  }
}

/* ---------------------------------------------------------------------
 * Checkout: bought but not yet put away. "Put away" opens a form (same
 * fields as the admin item form) that creates the real InventoryItem and
 * removes this grocery entry entirely.
 * ------------------------------------------------------------------- */

function renderCheckoutList() {
  const container = document.getElementById("grocery-checkout-list");
  const items = checkedOutGroceryItems();
  if (items.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Nothing waiting to be put away.</p>`;
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(itemDisplayLine(item))}</div>
          <div class="missing-ingredient-row__recipes">${escapeHtml([item.get("category"), locationLabel(item.get("location"))].filter(Boolean).join(" · "))}</div>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn--ghost btn--small" data-back-to-list="${item.id}">↩ BACK TO LIST</button>
          <button type="button" class="btn btn--small btn--primary" data-put-away="${item.id}">PUT AWAY</button>
        </div>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-put-away]").forEach((btn) => {
    btn.addEventListener("click", () => openPutawayModal(btn.getAttribute("data-put-away")));
  });
  container.querySelectorAll("[data-back-to-list]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await runGroceryCloud("groceryUpdateItem", { id: btn.getAttribute("data-back-to-list"), status: "list" });
        showToast("Moved back to the list.");
        await loadGroceryData();
      } catch (err) {
        console.error(err);
        if (!handleGroceryAuthError(err)) showToast(err.message || "Couldn't move that back.", "error");
      }
    });
  });
}

/* ---------------------------------------------------------------------
 * Put-away modal — mirrors the admin item form: name/type/category,
 * the same visual location/shelf picker, quantity/unit/level/expiration/
 * notes. Submitting creates the InventoryItem and removes the grocery
 * entry via the single groceryCheckoutToInventory call.
 * ------------------------------------------------------------------- */

function populatePutawayCategorySelect() {
  document.getElementById("putaway-category").innerHTML = CONFIG.INVENTORY_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function renderPutawayLevelSelector(selected) {
  const container = document.getElementById("putaway-level-selector");
  container.innerHTML = "";
  CONFIG.LEVELS.forEach((level) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-chip";
    btn.textContent = level.toUpperCase();
    btn.setAttribute("aria-pressed", String(level === selected));
    btn.addEventListener("click", () => {
      document.getElementById("putaway-level").value = level;
      container.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
    });
    container.appendChild(btn);
  });
}

function setPutawayLocationPickerValue(location, shelf) {
  document.getElementById("putaway-location").value = location || "";
  document.getElementById("putaway-shelf").value = shelf || "";
  document.getElementById("putaway-location-picker-label").textContent = location ? (shelf ? `${location} · ${shelf}` : location) : "Not set";
}

async function openPutawayLocationPickerModal() {
  storageLayouts = await loadStorageLayouts();
  renderPutawayLocationPickerDollhouse();
  openModal(document.getElementById("putaway-location-picker-modal-overlay"));
}

function renderPutawayLocationPickerDollhouse() {
  document.getElementById("putaway-location-picker-breadcrumb").innerHTML = "";
  document.getElementById("putaway-location-picker-grid-wrap").hidden = true;
  const container = document.getElementById("putaway-location-picker-dollhouse");
  container.hidden = false;
  renderDollhouse(container, { layouts: storageLayouts, onSelect: renderPutawayLocationPickerGrid });
}

function renderPutawayLocationPickerGrid(location) {
  document.getElementById("putaway-location-picker-dollhouse").hidden = true;
  document.getElementById("putaway-location-picker-grid-wrap").hidden = false;

  const breadcrumb = document.getElementById("putaway-location-picker-breadcrumb");
  breadcrumb.innerHTML = `<button type="button" class="btn btn--ghost btn--small" id="putaway-location-picker-back-btn">← LOCATIONS</button>`;
  breadcrumb.querySelector("#putaway-location-picker-back-btn").addEventListener("click", renderPutawayLocationPickerDollhouse);

  const layout = storageLayouts[location];
  renderStorageGrid(document.getElementById("putaway-location-picker-grid"), {
    layout,
    mode: "pick",
    onZoneClick: (zone) => {
      setPutawayLocationPickerValue(location, zone.name);
      closeModal(document.getElementById("putaway-location-picker-modal-overlay"));
    },
  });

  document.getElementById("putaway-location-picker-no-shelf-btn").onclick = () => {
    setPutawayLocationPickerValue(location, "");
    closeModal(document.getElementById("putaway-location-picker-modal-overlay"));
  };
}

function openPutawayModal(groceryItemId) {
  const item = groceryItems.find((i) => i.id === groceryItemId);
  if (!item) return;
  putawayGroceryItem = item;

  document.getElementById("putaway-form").reset();
  populatePutawayCategorySelect();
  document.getElementById("putaway-name").value = item.get("name") || "";
  document.getElementById("putaway-variant").value = "";
  document.getElementById("putaway-category").value = item.get("category") || CONFIG.INVENTORY_CATEGORIES[0];
  setPutawayLocationPickerValue(null, null);
  document.getElementById("putaway-quantity").value = "";
  document.getElementById("putaway-unit").value = "";
  document.getElementById("putaway-expiration").value = "";
  document.getElementById("putaway-notes").value = "";
  document.getElementById("putaway-level").value = "Full";
  renderPutawayLevelSelector("Full");

  openModal(document.getElementById("putaway-modal-overlay"));
}

async function handlePutawayFormSubmit(e) {
  e.preventDefault();
  if (!putawayGroceryItem) return;

  if (!document.getElementById("putaway-location").value) {
    showToast("Pick a spot for this item first.", "error");
    return;
  }

  const payload = {
    groceryItemId: putawayGroceryItem.id,
    name: document.getElementById("putaway-name").value.trim(),
    variant: document.getElementById("putaway-variant").value.trim(),
    category: document.getElementById("putaway-category").value,
    location: document.getElementById("putaway-location").value,
    shelf: document.getElementById("putaway-shelf").value,
    quantity: document.getElementById("putaway-quantity").value ? Number(document.getElementById("putaway-quantity").value) : undefined,
    unit: document.getElementById("putaway-unit").value.trim(),
    level: document.getElementById("putaway-level").value,
    notes: document.getElementById("putaway-notes").value.trim(),
    expirationDate: document.getElementById("putaway-expiration").value || null,
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SAVING…";
  try {
    await runGroceryCloud("groceryCheckoutToInventory", payload);
    closeModal(document.getElementById("putaway-modal-overlay"));
    showToast(`Put away — "${payload.name}" is now in Inventory.`);
    putawayGroceryItem = null;
    await loadGroceryData();
  } catch (err) {
    console.error(err);
    if (!handleGroceryAuthError(err)) showToast(err.message || "Couldn't add that to Inventory.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "ADD TO INVENTORY";
  }
}

/* ---------------------------------------------------------------------
 * Shared: removing an item outright (the "Remove" button in Add view —
 * for taking something off the list entirely, not the same as checking
 * it off, which moves it to Checkout instead of deleting it)
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
    renderCheckoutList();
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
  const tabs = {
    add: { tab: document.getElementById("tab-grocery-add"), panel: document.getElementById("panel-grocery-add") },
    check: { tab: document.getElementById("tab-grocery-check"), panel: document.getElementById("panel-grocery-check") },
    checkout: { tab: document.getElementById("tab-grocery-checkout"), panel: document.getElementById("panel-grocery-checkout") },
  };

  function activate(name) {
    Object.entries(tabs).forEach(([key, { tab, panel }]) => {
      const active = key === name;
      tab.setAttribute("aria-selected", String(active));
      panel.hidden = !active;
    });
  }

  tabs.add.tab.addEventListener("click", () => activate("add"));
  tabs.check.tab.addEventListener("click", () => activate("check"));
  tabs.checkout.tab.addEventListener("click", () => activate("checkout"));
}

document.addEventListener("DOMContentLoaded", () => {
  initGroceryTabs();
  setupLowStockToggle();
  document.getElementById("grocery-unlock-toggle-btn").addEventListener("click", handleUnlockToggleClick);
  document.getElementById("grocery-pin-cancel-btn").addEventListener("click", handlePinCancelClick);
  document.getElementById("grocery-pin-form").addEventListener("submit", handlePinSubmit);
  document.getElementById("grocery-lock-btn").addEventListener("click", handleLockClick);
  document.getElementById("grocery-add-form").addEventListener("submit", handleAddFormSubmit);
  document.getElementById("grocery-add-cancel-edit-btn").addEventListener("click", cancelEditingGroceryItem);
  document.getElementById("grocery-item-location").addEventListener("change", updateBulkFieldVisibility);

  document.getElementById("putaway-form").addEventListener("submit", handlePutawayFormSubmit);
  document.getElementById("putaway-cancel-btn").addEventListener("click", () => closeModal(document.getElementById("putaway-modal-overlay")));
  document.getElementById("putaway-modal-close").addEventListener("click", () => closeModal(document.getElementById("putaway-modal-overlay")));
  document.getElementById("putaway-location-picker-btn").addEventListener("click", openPutawayLocationPickerModal);
  document.getElementById("putaway-location-picker-modal-close").addEventListener("click", () => closeModal(document.getElementById("putaway-location-picker-modal-overlay")));

  // The list itself is always visible — this only decides whether the
  // editable Add/Check-off/Checkout UI shows up alongside it.
  if (isGroceryUnlocked()) {
    showUnlockedView();
  } else {
    showLockedView();
  }
  loadGroceryData();
});
