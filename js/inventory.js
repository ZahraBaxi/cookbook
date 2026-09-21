/**
 * inventory.js
 * -----------------------------------------------------------------------
 * Powers inventory.html: loads InventoryItem records, renders the
 * summary strip, location views (grouped by shelf for Pantry/Fridge),
 * and search/filter.
 * -----------------------------------------------------------------------
 */

let allItems = []; // Food items only (itemType !== "Appliance")
let allAppliances = [];
let activeLocation = "All";
let invSearchQuery = "";
let activeShelfFilter = null; // { location, shelf } | null — set by tapping the mini-map
let storageLayouts = {}; // location -> { rows, cols, zones } — see storage-layout.js

const InventoryItemClass = Parse.Object.extend("InventoryItem");

// Fallback shelf order for items whose location has no configured Layout
// yet (e.g. imported/legacy data) — once a Layout exists, shelf order
// instead follows the zones' actual top-to-bottom, left-to-right order.
const FRIDGE_SHELF_ORDER = ["Top", "Middle", "Bottom", "Crisper", "Door", "Other"];
const PANTRY_SHELF_ORDER = ["Shelf 1", "Shelf 2", "Shelf 3", "Shelf 4", "Other"];

function shelfOrderFor(location) {
  const layout = storageLayouts[location];
  if (layout && layout.zones && layout.zones.length) {
    return sortedZones(layout).map((z) => z.name);
  }
  if (location === "Pantry") return PANTRY_SHELF_ORDER;
  return FRIDGE_SHELF_ORDER;
}

async function loadInventoryData() {
  const resultsEl = document.getElementById("inventory-results");
  try {
    const [allInventory, layouts] = await Promise.all([
      new Parse.Query(InventoryItemClass).ascending("name").limit(2000).find(),
      loadStorageLayouts(),
    ]);
    storageLayouts = layouts;
    allItems = allInventory.filter((i) => (i.get("itemType") || "Food") !== "Appliance");
    allAppliances = allInventory.filter((i) => i.get("itemType") === "Appliance");
    renderSummary();
    renderMiniMap();
    renderLocationFilters();
    renderInventory();
    renderApplianceList();
  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load the inventory.</p><p>${escapeHtml(err.message || "Check your connection and try again.")}</p></div>`;
  }
}

/* ---------------------------------------------------------------------
 * Mini-map — read-only doll house grids per location, with an item
 * count per zone. Tapping a zone filters the list below to just that
 * shelf/drawer/bin; tapping it again (or Clear) clears the filter.
 * ------------------------------------------------------------------- */

function itemCountsByZone(location) {
  const counts = {};
  allItems
    .filter((i) => i.get("location") === location)
    .forEach((i) => {
      const shelf = i.get("shelf") || "Other";
      counts[shelf] = (counts[shelf] || 0) + 1;
    });
  return counts;
}

function renderMiniMap() {
  const container = document.getElementById("mini-map-locations");
  if (!container) return;
  container.innerHTML = "";

  CONFIG.INVENTORY_LOCATIONS.forEach((location) => {
    const layout = storageLayouts[location];
    if (!layout || !layout.zones || !layout.zones.length) return; // nothing configured yet — skip

    const wrap = document.createElement("div");
    wrap.className = "mini-map-location";
    wrap.innerHTML = `<div class="mini-map-location__title">${escapeHtml(location)}</div>`;
    const gridEl = document.createElement("div");
    wrap.appendChild(gridEl);
    container.appendChild(wrap);

    renderStorageGrid(gridEl, {
      layout,
      mode: "view",
      itemCounts: itemCountsByZone(location),
      highlightZoneId: activeShelfFilter && activeShelfFilter.location === location
        ? (layout.zones.find((z) => z.name === activeShelfFilter.shelf) || {}).id
        : null,
      onZoneClick: (zone) => {
        if (activeShelfFilter && activeShelfFilter.location === location && activeShelfFilter.shelf === zone.name) {
          activeShelfFilter = null;
        } else {
          activeShelfFilter = { location, shelf: zone.name };
        }
        renderMiniMap();
        renderInventory();
      },
    });
  });
}

function renderSummary() {
  const strip = document.getElementById("summary-strip");
  const counts = { Fridge: 0, Freezer: 0, Pantry: 0 };
  let low = 0;
  allItems.forEach((item) => {
    const loc = item.get("location");
    if (counts[loc] !== undefined) counts[loc] += 1;
    if (CONFIG.LOW_LEVELS.includes(item.get("level"))) low += 1;
  });

  const cells = [
    ["FRIDGE", counts.Fridge],
    ["FREEZER", counts.Freezer],
    ["PANTRY", counts.Pantry],
    ["LOW", low],
  ];

  strip.innerHTML = cells
    .map(
      ([label, value]) => `
      <div class="summary-cell">
        <div class="summary-cell__label">${label}</div>
        <div class="summary-cell__value">${value}</div>
      </div>`
    )
    .join("");
}

function renderLocationFilters() {
  const row = document.getElementById("location-filter-row");
  const options = ["All", "Fridge", "Freezer", "Pantry"];
  row.innerHTML = "";
  options.forEach((loc) => {
    const btn = document.createElement("button");
    btn.className = "filter-chip";
    btn.type = "button";
    btn.textContent = loc.toUpperCase();
    btn.setAttribute("aria-pressed", String(loc === activeLocation));
    btn.addEventListener("click", () => {
      activeLocation = loc;
      row.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      renderInventory();
    });
    row.appendChild(btn);
  });
}

function itemMatchesSearch(item) {
  if (!invSearchQuery) return true;
  const q = invSearchQuery.toLowerCase();
  const haystack = [item.get("name"), item.get("variant"), item.get("category"), item.get("notes"), item.get("shelf")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function itemMatchesShelfFilter(item) {
  if (!activeShelfFilter) return true;
  return item.get("location") === activeShelfFilter.location && (item.get("shelf") || "") === activeShelfFilter.shelf;
}

function renderItemCard(item) {
  const low = CONFIG.LOW_LEVELS.includes(item.get("level"));
  const qtyParts = [item.get("quantity"), item.get("unit")].filter((v) => v !== undefined && v !== null && v !== "");
  const expiration = item.get("expirationDate");

  return `
    <div class="item-card ${low ? "item-card--low" : ""}">
      <div class="item-card__name">${escapeHtml(inventoryItemLabel(item))}</div>
      <div class="item-card__category">${escapeHtml(item.get("category") || "")}</div>
      <div class="item-card__meta">
        <span>${escapeHtml(qtyParts.join(" "))}</span>
        <span class="item-card__level">${escapeHtml((item.get("level") || "").toUpperCase())}</span>
      </div>
      ${expiration ? `<div class="item-card__expiry">Expires ${formatDate(expiration)}</div>` : ""}
      ${item.get("notes") ? `<div class="item-card__expiry">${escapeHtml(item.get("notes"))}</div>` : ""}
      <div class="item-card__expiry">Added ${formatDate(item.createdAt)}</div>
      <button type="button" class="btn btn--ghost btn--small" data-quick-edit="${item.id}" style="margin-top:0.6rem; width:100%;" ${isInventoryUnlocked() ? "" : "hidden"}>EDIT</button>
    </div>`;
}

function renderGroupedByShelf(items, shelfOrder, sectionTitle) {
  const groups = {};
  items.forEach((item) => {
    const shelf = item.get("shelf") || "Other";
    if (!groups[shelf]) groups[shelf] = [];
    groups[shelf].push(item);
  });

  const orderedShelves = [
    ...shelfOrder.filter((s) => groups[s]),
    ...Object.keys(groups).filter((s) => !shelfOrder.includes(s)),
  ];

  const shelfHtml = orderedShelves
    .map(
      (shelf) => `
      <div class="shelf-group">
        <div class="shelf-group__title">${escapeHtml(shelf.toUpperCase())}</div>
        <div class="item-grid">${groups[shelf].map(renderItemCard).join("")}</div>
      </div>`
    )
    .join("");

  return `<div class="inventory-section"><div class="inventory-section__title">${sectionTitle}</div>${shelfHtml}</div>`;
}

function renderFlatSection(items, sectionTitle) {
  return `<div class="inventory-section"><div class="inventory-section__title">${sectionTitle}</div><div class="item-grid">${items.map(renderItemCard).join("")}</div></div>`;
}

function renderInventory() {
  const resultsEl = document.getElementById("inventory-results");

  if (allItems.length === 0) {
    resultsEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">The kitchen is empty.</p><p>Add your first item from the Admin page.</p></div>`;
    return;
  }

  const filtered = allItems.filter(itemMatchesSearch).filter(itemMatchesShelfFilter);
  const byLocation = (loc) => filtered.filter((i) => i.get("location") === loc);

  const filterBanner = activeShelfFilter
    ? `<div class="toolbar--secondary"><span class="toolbar__label">Showing: ${escapeHtml(activeShelfFilter.location)} · ${escapeHtml(activeShelfFilter.shelf)}</span> <button type="button" class="btn btn--ghost btn--small" id="clear-shelf-filter-btn">CLEAR</button></div>`
    : "";

  let sectionsHtml = "";

  if (activeLocation === "All") {
    if (byLocation("Fridge").length) sectionsHtml += renderGroupedByShelf(byLocation("Fridge"), shelfOrderFor("Fridge"), "FRIDGE");
    if (byLocation("Freezer").length) sectionsHtml += renderGroupedByShelf(byLocation("Freezer"), shelfOrderFor("Freezer"), "FREEZER");
    if (byLocation("Pantry").length) sectionsHtml += renderGroupedByShelf(byLocation("Pantry"), shelfOrderFor("Pantry"), "PANTRY");
    const other = filtered.filter((i) => !["Fridge", "Freezer", "Pantry"].includes(i.get("location")));
    if (other.length) sectionsHtml += renderFlatSection(other, "OTHER");
  } else if (activeLocation === "Fridge" || activeLocation === "Freezer") {
    sectionsHtml = filtered.length ? renderGroupedByShelf(filtered, shelfOrderFor(activeLocation), activeLocation.toUpperCase()) : "";
  } else if (activeLocation === "Pantry") {
    sectionsHtml = filtered.length ? renderGroupedByShelf(filtered, shelfOrderFor("Pantry"), "PANTRY") : "";
  }

  if (!sectionsHtml) {
    resultsEl.innerHTML = filterBanner + `<div class="empty-state"><p class="empty-state__title">Nothing found.</p><p>Try a different search or view.</p></div>`;
  } else {
    resultsEl.innerHTML = filterBanner + sectionsHtml;
  }

  const clearBtn = document.getElementById("clear-shelf-filter-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      activeShelfFilter = null;
      renderMiniMap();
      renderInventory();
    });
  }

  resultsEl.querySelectorAll("[data-quick-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openQuickEditModal(btn.getAttribute("data-quick-edit")));
  });
}

/* ---------------------------------------------------------------------
 * Copy Inventory — builds a plain-text summary of everything currently
 * in stock, grouped the same way the page displays it, for pasting into
 * ChatGPT/Claude/anywhere else to ask "what can I make with this?"
 * ------------------------------------------------------------------- */

function describeItemForExport(item) {
  const parts = [inventoryItemLabel(item)];
  const qty = [item.get("quantity"), item.get("unit")].filter((v) => v !== undefined && v !== null && v !== "").join(" ");
  if (qty) parts.push(`(${qty})`);
  if (CONFIG.LOW_LEVELS.includes(item.get("level"))) parts.push("— running low");
  if (item.get("notes")) parts.push(`[${item.get("notes")}]`);
  return parts.join(" ");
}

function buildFoodExportLines() {
  const lines = [];
  CONFIG.INVENTORY_LOCATIONS.forEach((location) => {
    const itemsHere = allItems.filter((i) => i.get("location") === location);
    if (!itemsHere.length) return;

    lines.push(location.toUpperCase());
    const shelfOrder = shelfOrderFor(location);
    const grouped = {};
    const noShelf = [];
    itemsHere.forEach((item) => {
      const shelf = item.get("shelf");
      if (shelf) {
        (grouped[shelf] = grouped[shelf] || []).push(item);
      } else {
        noShelf.push(item);
      }
    });

    const shelfNames = [...new Set([...shelfOrder, ...Object.keys(grouped)])].filter((s) => grouped[s] && grouped[s].length);
    shelfNames.forEach((shelf) => {
      lines.push(`  ${shelf}:`);
      grouped[shelf].forEach((item) => lines.push(`    - ${describeItemForExport(item)}`));
    });
    if (noShelf.length) {
      lines.push(`  (no shelf noted):`);
      noShelf.forEach((item) => lines.push(`    - ${describeItemForExport(item)}`));
    }
    lines.push("");
  });

  const knownLocations = new Set(CONFIG.INVENTORY_LOCATIONS);
  const other = allItems.filter((i) => !knownLocations.has(i.get("location")));
  if (other.length) {
    lines.push("OTHER");
    other.forEach((item) => lines.push(`  - ${describeItemForExport(item)}`));
    lines.push("");
  }
  return lines;
}

function buildApplianceExportLines() {
  if (allAppliances.length === 0) return [];
  const lines = [];
  [...allAppliances]
    .sort((a, b) => (a.get("name") || "").localeCompare(b.get("name") || ""))
    .forEach((item) => {
      const label = inventoryItemLabel(item);
      const location = item.get("location") ? ` [${item.get("location")}]` : "";
      const notes = item.get("notes") ? ` — ${item.get("notes")}` : "";
      lines.push(`  - ${label}${location}${notes}`);
    });
  lines.push("");
  return lines;
}

function buildInventoryExportText() {
  const includeFood = document.getElementById("copy-include-food").checked;
  const includeAppliances = document.getElementById("copy-include-appliances").checked;
  const lines = [`Current kitchen inventory (as of ${new Date().toLocaleDateString()}):`, ""];

  if (includeFood) {
    lines.push("== FOOD ==", "");
    lines.push(...buildFoodExportLines());
  }
  if (includeAppliances) {
    lines.push("== APPLIANCES ==", "");
    lines.push(...buildApplianceExportLines());
  }

  return lines.join("\n").trim();
}

async function handleCopyInventoryClick() {
  if (!document.getElementById("copy-include-food").checked && !document.getElementById("copy-include-appliances").checked) {
    showToast("Pick Food, Appliances, or both first.", "error");
    return;
  }
  const text = buildInventoryExportText();
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied!");
  } catch (err) {
    console.error(err);
    // Clipboard API can be blocked in some contexts (non-HTTPS, older
    // browsers, permissions) — fall back to a manual-copy prompt.
    window.prompt("Couldn't auto-copy — copy this manually:", text);
  }
}

/* ---------------------------------------------------------------------
 * Appliances — a simple flat list, separate from the food/shelf system
 * entirely (appliances don't live in the Fridge/Freezer/Pantry grid).
 * ------------------------------------------------------------------- */

function renderApplianceList() {
  const container = document.getElementById("appliance-results");
  const query = (document.getElementById("appliance-search").value || "").trim().toLowerCase();
  const filtered = allAppliances.filter((item) => {
    if (!query) return true;
    return [item.get("name"), item.get("variant"), item.get("location"), item.get("notes")].filter(Boolean).join(" ").toLowerCase().includes(query);
  });

  if (allAppliances.length === 0) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state__title">No appliances listed yet.</p></div>`;
    return;
  }
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state__title">Nothing found.</p></div>`;
    return;
  }

  container.innerHTML = [...filtered]
    .sort((a, b) => (a.get("name") || "").localeCompare(b.get("name") || ""))
    .map(
      (item) => `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(inventoryItemLabel(item))}</div>
          <div class="missing-ingredient-row__recipes">${escapeHtml(item.get("location") || "")}${item.get("notes") ? " · " + escapeHtml(item.get("notes")) : ""}</div>
        </div>
      </div>`
    )
    .join("");
}

function initInventoryTabs() {
  const tabFood = document.getElementById("tab-inv-food");
  const tabAppliances = document.getElementById("tab-inv-appliances");
  const panelFood = document.getElementById("panel-inv-food");
  const panelAppliances = document.getElementById("panel-inv-appliances");

  function activate(name) {
    const isFood = name === "food";
    tabFood.setAttribute("aria-selected", String(isFood));
    tabAppliances.setAttribute("aria-selected", String(!isFood));
    panelFood.hidden = !isFood;
    panelAppliances.hidden = isFood;
  }

  tabFood.addEventListener("click", () => activate("food"));
  tabAppliances.addEventListener("click", () => activate("appliances"));
}

/* ---------------------------------------------------------------------
 * Quick-edit via PIN — separate from Admin login, meant for scanning a
 * QR code taped to a shelf/bin and fixing that one item's quantity/
 * level/location in a couple of taps. Browsing/searching never needs
 * this; it only gates the EDIT buttons and the quick-edit modal itself.
 * ------------------------------------------------------------------- */

let pendingQrItemId = null; // set from ?item= on load if we're locked, opened once unlocked

function updateInventoryLockUI() {
  const unlocked = isInventoryUnlocked();
  document.getElementById("inventory-unlock-toggle-btn").hidden = unlocked;
  document.getElementById("inventory-lock-btn").hidden = !unlocked;
}

function handleInventoryUnlockToggleClick() {
  document.getElementById("inventory-pin-error").classList.remove("admin-error--visible");
  document.getElementById("inventory-pin-input").value = "";
  openModal(document.getElementById("inventory-pin-modal-overlay"));
  document.getElementById("inventory-pin-input").focus();
}

async function handleInventoryPinSubmit(e) {
  e.preventDefault();
  const pin = document.getElementById("inventory-pin-input").value.trim();
  const errorEl = document.getElementById("inventory-pin-error");
  errorEl.classList.remove("admin-error--visible");

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "CHECKING…";
  try {
    const result = await Parse.Cloud.run("inventoryLogin", { pin });
    if (!result || !result.token) throw new Error("No token returned");
    setInventorySession(result.token);
    document.getElementById("inventory-pin-input").value = "";
    closeModal(document.getElementById("inventory-pin-modal-overlay"));
    updateInventoryLockUI();
    renderInventory();
    if (pendingQrItemId) {
      const id = pendingQrItemId;
      pendingQrItemId = null;
      openQuickEditModal(id);
    }
  } catch (err) {
    errorEl.classList.add("admin-error--visible");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "UNLOCK";
  }
}

function handleInventoryLockClick() {
  clearInventorySession();
  updateInventoryLockUI();
  renderInventory();
  showToast("Locked.");
}

function handleInventoryAuthError(err) {
  if (err && err.code === Parse.Error.INVALID_SESSION_TOKEN) {
    clearInventorySession();
    updateInventoryLockUI();
    showToast("Session expired — unlock with the PIN again.", "error");
    return true;
  }
  return false;
}

let quickEditItemId = null;

function populateQuickEditLocationSelect(currentLocation) {
  const select = document.getElementById("quick-edit-location");
  select.innerHTML = CONFIG.INVENTORY_LOCATIONS.map((loc) => `<option value="${loc}">${loc}</option>`).join("");
  select.value = currentLocation || CONFIG.INVENTORY_LOCATIONS[0];
}

function populateQuickEditShelfSelect(location, currentShelf) {
  const select = document.getElementById("quick-edit-shelf");
  const shelves = shelfOrderFor(location);
  const options = ["", ...shelves];
  select.innerHTML = options.map((s) => `<option value="${escapeHtml(s)}">${s ? escapeHtml(s) : "No specific shelf"}</option>`).join("");
  select.value = shelves.includes(currentShelf) ? currentShelf : "";
}

function renderQuickEditLevelSelector(selected) {
  const container = document.getElementById("quick-edit-level-selector");
  container.innerHTML = "";
  CONFIG.LEVELS.forEach((level) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-chip";
    btn.textContent = level.toUpperCase();
    btn.dataset.level = level;
    btn.setAttribute("aria-pressed", String(level === selected));
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
    });
    container.appendChild(btn);
  });
}

function openQuickEditModal(itemId) {
  if (!isInventoryUnlocked()) {
    pendingQrItemId = itemId;
    handleInventoryUnlockToggleClick();
    return;
  }
  const item = allItems.find((i) => i.id === itemId);
  if (!item) return;

  quickEditItemId = itemId;
  document.getElementById("quick-edit-modal-title").textContent = inventoryItemLabel(item);
  document.getElementById("quick-edit-quantity").value = item.get("quantity") ?? "";
  document.getElementById("quick-edit-unit").value = item.get("unit") || "";
  renderQuickEditLevelSelector(item.get("level") || "Full");
  populateQuickEditLocationSelect(item.get("location"));
  populateQuickEditShelfSelect(item.get("location") || CONFIG.INVENTORY_LOCATIONS[0], item.get("shelf"));

  document.getElementById("quick-edit-location").onchange = () => {
    populateQuickEditShelfSelect(document.getElementById("quick-edit-location").value, "");
  };

  openModal(document.getElementById("quick-edit-modal-overlay"));
}

async function handleQuickEditFormSubmit(e) {
  e.preventDefault();
  if (!quickEditItemId) return;

  const levelBtn = document.querySelector("#quick-edit-level-selector .filter-chip[aria-pressed='true']");
  const payload = {
    id: quickEditItemId,
    quantity: parseFloat(document.getElementById("quick-edit-quantity").value) || 0,
    unit: document.getElementById("quick-edit-unit").value.trim(),
    level: levelBtn ? levelBtn.dataset.level : "Full",
    location: document.getElementById("quick-edit-location").value,
    shelf: document.getElementById("quick-edit-shelf").value,
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "SAVING…";
  try {
    await runInventoryCloud("inventoryQuickUpdateItem", payload);
    closeModal(document.getElementById("quick-edit-modal-overlay"));
    showToast("Saved.");
    quickEditItemId = null;
    await loadInventoryData();
  } catch (err) {
    console.error(err);
    if (!handleInventoryAuthError(err)) showToast(err.message || "Couldn't save.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "SAVE";
  }
}

async function handleQuickEditFinishedClick() {
  if (!quickEditItemId) return;
  const item = allItems.find((i) => i.id === quickEditItemId);
  if (!window.confirm(`Remove "${item ? inventoryItemLabel(item) : "this item"}" from Inventory? This can't be undone.`)) return;

  try {
    await runInventoryCloud("inventoryQuickDeleteItem", { id: quickEditItemId });
    closeModal(document.getElementById("quick-edit-modal-overlay"));
    showToast("Removed.");
    quickEditItemId = null;
    await loadInventoryData();
  } catch (err) {
    console.error(err);
    if (!handleInventoryAuthError(err)) showToast(err.message || "Couldn't remove.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initInventoryTabs();
  document.getElementById("inventory-search").addEventListener("input", (e) => {
    invSearchQuery = e.target.value.trim();
    renderInventory();
  });
  document.getElementById("appliance-search").addEventListener("input", renderApplianceList);
  document.getElementById("copy-inventory-btn").addEventListener("click", handleCopyInventoryClick);

  document.getElementById("inventory-unlock-toggle-btn").addEventListener("click", handleInventoryUnlockToggleClick);
  document.getElementById("inventory-pin-modal-close").addEventListener("click", () => closeModal(document.getElementById("inventory-pin-modal-overlay")));
  document.getElementById("inventory-pin-form").addEventListener("submit", handleInventoryPinSubmit);
  document.getElementById("inventory-lock-btn").addEventListener("click", handleInventoryLockClick);
  updateInventoryLockUI();

  document.getElementById("quick-edit-form").addEventListener("submit", handleQuickEditFormSubmit);
  document.getElementById("quick-edit-modal-close").addEventListener("click", () => closeModal(document.getElementById("quick-edit-modal-overlay")));
  document.getElementById("quick-edit-finished-btn").addEventListener("click", handleQuickEditFinishedClick);

  // A link like inventory.html?item=<id> (e.g. from a QR code taped to a
  // shelf) opens straight to that item's quick-edit modal once unlocked;
  // if locked, it prompts for the PIN first and opens it right after.
  const itemParam = new URLSearchParams(window.location.search).get("item");

  loadInventoryData().then(() => {
    if (itemParam) openQuickEditModal(itemParam);
  });
});
