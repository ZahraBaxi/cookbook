/**
 * inventory.js
 * -----------------------------------------------------------------------
 * Powers inventory.html: loads InventoryItem records, renders the
 * summary strip, location views (grouped by shelf for Pantry/Fridge),
 * and search/filter.
 * -----------------------------------------------------------------------
 */

let allItems = [];
let activeLocation = "All";
let invSearchQuery = "";

const InventoryItemClass = Parse.Object.extend("InventoryItem");

const FRIDGE_SHELF_ORDER = ["Top", "Middle", "Bottom", "Crisper", "Door", "Other"];
const PANTRY_SHELF_ORDER = ["Shelf 1", "Shelf 2", "Shelf 3", "Shelf 4", "Other"];

async function loadInventoryData() {
  const resultsEl = document.getElementById("inventory-results");
  try {
    allItems = await new Parse.Query(InventoryItemClass).ascending("name").limit(2000).find();
    renderSummary();
    renderLocationFilters();
    renderInventory();
  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load the inventory.</p><p>${escapeHtml(err.message || "Check your connection and try again.")}</p></div>`;
  }
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
  const haystack = [item.get("name"), item.get("category"), item.get("notes"), item.get("shelf")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function renderItemCard(item) {
  const low = CONFIG.LOW_LEVELS.includes(item.get("level"));
  const qtyParts = [item.get("quantity"), item.get("unit")].filter((v) => v !== undefined && v !== null && v !== "");
  const expiration = item.get("expirationDate");

  return `
    <div class="item-card ${low ? "item-card--low" : ""}">
      <div class="item-card__name">${escapeHtml(item.get("name"))}</div>
      <div class="item-card__category">${escapeHtml(item.get("category") || "")}</div>
      <div class="item-card__meta">
        <span>${escapeHtml(qtyParts.join(" "))}</span>
        <span class="item-card__level">${escapeHtml((item.get("level") || "").toUpperCase())}</span>
      </div>
      ${expiration ? `<div class="item-card__expiry">Expires ${formatDate(expiration)}</div>` : ""}
      ${item.get("notes") ? `<div class="item-card__expiry">${escapeHtml(item.get("notes"))}</div>` : ""}
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

  const filtered = allItems.filter(itemMatchesSearch);
  const byLocation = (loc) => filtered.filter((i) => i.get("location") === loc);

  let html = "";

  if (activeLocation === "All") {
    if (byLocation("Fridge").length) html += renderGroupedByShelf(byLocation("Fridge"), FRIDGE_SHELF_ORDER, "FRIDGE");
    if (byLocation("Freezer").length) html += renderGroupedByShelf(byLocation("Freezer"), FRIDGE_SHELF_ORDER, "FREEZER");
    if (byLocation("Pantry").length) html += renderGroupedByShelf(byLocation("Pantry"), PANTRY_SHELF_ORDER, "PANTRY");
    const other = filtered.filter((i) => !["Fridge", "Freezer", "Pantry"].includes(i.get("location")));
    if (other.length) html += renderFlatSection(other, "OTHER");
  } else if (activeLocation === "Fridge" || activeLocation === "Freezer") {
    html = filtered.length ? renderGroupedByShelf(filtered, FRIDGE_SHELF_ORDER, activeLocation.toUpperCase()) : "";
  } else if (activeLocation === "Pantry") {
    html = filtered.length ? renderGroupedByShelf(filtered, PANTRY_SHELF_ORDER, "PANTRY") : "";
  }

  if (!html) {
    resultsEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Nothing found.</p><p>Try a different search or view.</p></div>`;
    return;
  }

  resultsEl.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("inventory-search").addEventListener("input", (e) => {
    invSearchQuery = e.target.value.trim();
    renderInventory();
  });
  loadInventoryData();
});
