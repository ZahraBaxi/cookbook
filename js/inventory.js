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
    [allItems, storageLayouts] = await Promise.all([
      new Parse.Query(InventoryItemClass).ascending("name").limit(2000).find(),
      loadStorageLayouts(),
    ]);
    renderSummary();
    renderMiniMap();
    renderLocationFilters();
    renderInventory();
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

function buildInventoryExportText() {
  const lines = [`Current kitchen inventory (as of ${new Date().toLocaleDateString()}):`, ""];

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
  }

  return lines.join("\n").trim();
}

async function handleCopyInventoryClick() {
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

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("inventory-search").addEventListener("input", (e) => {
    invSearchQuery = e.target.value.trim();
    renderInventory();
  });
  document.getElementById("copy-inventory-btn").addEventListener("click", handleCopyInventoryClick);
  loadInventoryData();
});
