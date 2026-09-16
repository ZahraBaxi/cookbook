/**
 * storage-layout.js
 * -----------------------------------------------------------------------
 * Shared "doll house" visual storage layout: a grid of cells per location
 * (Fridge, Freezer, Pantry, Counter, Other) that can be carved into named
 * zones (shelves, drawers, bins). Backed by the StorageLayout Parse class
 * (one record per location: { location, rows, cols, zones }).
 *
 * Used by:
 *   - admin.js   → editable grid (draw zones, resize, delete) + the
 *                  location/shelf picker inside the item form
 *   - inventory.js → read-only grid with item counts, clickable to filter
 *
 * A "zone" is a rectangle of grid cells:
 *   { id, name, type, rowStart, rowEnd, colStart, colEnd }  (0-indexed, inclusive)
 * -----------------------------------------------------------------------
 */

const StorageLayoutClass = Parse.Object.extend("StorageLayout");

/**
 * Loads every StorageLayout record and returns a plain map:
 *   { Fridge: { objectId, rows, cols, zones }, ... }
 * Locations with no saved record yet fall back to CONFIG.STORAGE_GRID_DEFAULTS
 * with an empty zones array, so the grid still renders before anything's
 * been configured.
 */
async function loadStorageLayouts() {
  const map = {};
  CONFIG.INVENTORY_LOCATIONS.forEach((loc) => {
    const def = CONFIG.STORAGE_GRID_DEFAULTS[loc] || { rows: 3, cols: 3 };
    map[loc] = { objectId: null, rows: def.rows, cols: def.cols, zones: [] };
  });
  try {
    const records = await new Parse.Query(StorageLayoutClass).limit(100).find();
    records.forEach((rec) => {
      const loc = rec.get("location");
      if (!map[loc]) return;
      map[loc] = {
        objectId: rec.id,
        rows: rec.get("rows") || map[loc].rows,
        cols: rec.get("cols") || map[loc].cols,
        zones: rec.get("zones") || [],
      };
    });
  } catch (err) {
    console.error("Couldn't load storage layouts", err);
  }
  return map;
}

function sortedZones(layout) {
  return [...(layout.zones || [])].sort((a, b) => a.rowStart - b.rowStart || a.colStart - b.colStart);
}

function zoneAt(layout, row, col) {
  return (layout.zones || []).find((z) => row >= z.rowStart && row <= z.rowEnd && col >= z.colStart && col <= z.colEnd);
}

function rectOverlapsAnyZone(layout, rect, ignoreZoneId) {
  return (layout.zones || []).some((z) => {
    if (ignoreZoneId && z.id === ignoreZoneId) return false;
    const rowOverlap = rect.rowStart <= z.rowEnd && rect.rowEnd >= z.rowStart;
    const colOverlap = rect.colStart <= z.colEnd && rect.colEnd >= z.colStart;
    return rowOverlap && colOverlap;
  });
}

/**
 * Renders the "doll house" overview: one box per configured location,
 * proportioned roughly to its grid's rows/cols so a Fridge box reads
 * taller than a Counter box. Purely CSS/DOM, no external drawing.
 *
 * opts:
 *   layouts       - map from loadStorageLayouts()
 *   onSelect(loc) - called when a box is clicked
 *   itemCounts    - optional { location: count } shown under the label
 */
function renderDollhouse(container, { layouts, onSelect, itemCounts }) {
  container.innerHTML = "";
  container.className = "dollhouse";
  CONFIG.INVENTORY_LOCATIONS.forEach((loc) => {
    const layout = layouts[loc];
    const box = document.createElement("button");
    box.type = "button";
    box.className = "dollhouse-box";
    const ratio = layout.cols ? layout.rows / layout.cols : 1;
    box.style.setProperty("--dh-ratio", ratio);
    const count = itemCounts ? itemCounts[loc] || 0 : null;
    box.innerHTML = `
      <span class="dollhouse-box__grid" aria-hidden="true">${"▢".repeat(Math.min(layout.zones.length || 1, 6))}</span>
      <span class="dollhouse-box__label">${escapeHtml(loc.toUpperCase())}</span>
      ${itemCounts ? `<span class="dollhouse-box__count">${count} item${count === 1 ? "" : "s"}</span>` : ""}
    `;
    box.addEventListener("click", () => onSelect(loc));
    container.appendChild(box);
  });
}

/**
 * Renders one location's grid. Always shows existing zones as labeled
 * overlays. Behavior depends on mode:
 *   "edit" - click-drag empty cells to draw a new zone (fires onDraw with
 *            the rect); click an existing zone to fire onZoneClick (admin
 *            uses this to open the edit/delete popover).
 *   "pick" - click an existing zone fires onZoneClick(zone). Empty cells
 *            do nothing (nowhere to put an item without a named zone).
 *   "view" - read-only; click a zone fires onZoneClick(zone) if provided
 *            (inventory.js uses this to filter). Can show itemCounts.
 */
function renderStorageGrid(container, { layout, mode, onDraw, onZoneClick, itemCounts, highlightZoneId }) {
  container.innerHTML = "";
  container.className = "storage-grid";
  container.style.setProperty("--rows", layout.rows);
  container.style.setProperty("--cols", layout.cols);

  // Base cell layer — only receives pointer events where no zone sits on top.
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const cell = document.createElement("div");
      cell.className = "storage-cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.style.gridRow = `${r + 1} / ${r + 2}`;
      cell.style.gridColumn = `${c + 1} / ${c + 2}`;
      container.appendChild(cell);
    }
  }

  // Zone overlays, painted after (and therefore visually on top of) cells.
  (layout.zones || []).forEach((zone) => {
    const el = document.createElement(mode === "view" && !onZoneClick ? "div" : "button");
    if (el.tagName === "BUTTON") el.type = "button";
    el.className = "storage-zone" + (highlightZoneId === zone.id ? " storage-zone--highlight" : "");
    el.style.gridRow = `${zone.rowStart + 1} / ${zone.rowEnd + 2}`;
    el.style.gridColumn = `${zone.colStart + 1} / ${zone.colEnd + 2}`;
    const count = itemCounts ? itemCounts[zone.name] || 0 : null;
    el.innerHTML = `
      <span class="storage-zone__name">${escapeHtml(zone.name)}</span>
      <span class="storage-zone__type">${escapeHtml(zone.type || "")}</span>
      ${itemCounts ? `<span class="storage-zone__count">${count}</span>` : ""}
    `;
    if (el.tagName === "BUTTON") {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onZoneClick) onZoneClick(zone);
      });
    }
    container.appendChild(el);
  });

  // The pointer-drag handlers below are bound once per DOM node (see the
  // "already bound" check further down), but this function gets called
  // again on the SAME node every time a zone is added/edited/deleted or
  // the grid resizes. Stash the latest layout/onDraw on the node itself so
  // those already-bound handlers always act on current data.
  container._storageGridLayout = layout;
  container._storageGridOnDraw = onDraw;

  if (mode !== "edit" || !onDraw) return;
  if (container._storageGridDragBound) return;
  container._storageGridDragBound = true;

  let dragStart = null;
  let previewEl = null;

  function currentLayout() {
    return container._storageGridLayout;
  }

  function cellFromEvent(e) {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const cell = target && target.closest(".storage-cell");
    if (!cell || !container.contains(cell)) return null;
    return { row: parseInt(cell.dataset.row, 10), col: parseInt(cell.dataset.col, 10) };
  }

  function clampRect(a, b) {
    let rowStart = Math.min(a.row, b.row);
    let rowEnd = Math.max(a.row, b.row);
    let colStart = Math.min(a.col, b.col);
    let colEnd = Math.max(a.col, b.col);
    // Shrink the box so it never crosses into an already-occupied cell.
    while (rowEnd > rowStart && rectOverlapsAnyZone(currentLayout(), { rowStart, rowEnd, colStart, colEnd })) rowEnd--;
    while (colEnd > colStart && rectOverlapsAnyZone(currentLayout(), { rowStart, rowEnd, colStart, colEnd })) colEnd--;
    return { rowStart, rowEnd, colStart, colEnd };
  }

  function updatePreview(rect) {
    if (!previewEl) {
      previewEl = document.createElement("div");
      previewEl.className = "storage-zone storage-zone--preview";
      container.appendChild(previewEl);
    }
    previewEl.style.gridRow = `${rect.rowStart + 1} / ${rect.rowEnd + 2}`;
    previewEl.style.gridColumn = `${rect.colStart + 1} / ${rect.colEnd + 2}`;
  }

  function endDrag(rect) {
    if (previewEl) {
      previewEl.remove();
      previewEl = null;
    }
    dragStart = null;
    if (rect && !rectOverlapsAnyZone(currentLayout(), rect)) container._storageGridOnDraw(rect);
  }

  container.addEventListener("pointerdown", (e) => {
    const cell = cellFromEvent(e);
    if (!cell || zoneAt(currentLayout(), cell.row, cell.col)) return;
    dragStart = cell;
    updatePreview(clampRect(cell, cell));
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener("pointermove", (e) => {
    if (!dragStart) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    updatePreview(clampRect(dragStart, cell));
  });
  container.addEventListener("pointerup", (e) => {
    if (!dragStart) return;
    const cell = cellFromEvent(e) || dragStart;
    endDrag(clampRect(dragStart, cell));
  });
  container.addEventListener("pointercancel", () => endDrag(null));
}
