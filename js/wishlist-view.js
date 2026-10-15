/**
 * wishlist-view.js — public, read-only wishlist (WishlistItem is Public
 * Read; editing + adding savings happens in Admin -> Wishlist).
 */

const WishlistItemClass = Parse.Object.extend("WishlistItem");
let wishlistItems = [];
let activeWishlistTags = new Set(); // empty = show everything

function formatMoney(n) {
  return "$" + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function renderWishlistFilter() {
  const container = document.getElementById("wishlist-tag-filter");
  const tags = [...new Set(wishlistItems.flatMap((i) => i.get("tags") || []))].sort((a, b) => a.localeCompare(b));
  const chips = [{ key: "__all__", label: "All" }, ...tags.map((t) => ({ key: t, label: t }))];
  container.innerHTML = chips
    .map(({ key, label }) => {
      const active = key === "__all__" ? activeWishlistTags.size === 0 : activeWishlistTags.has(key);
      return `<button type="button" class="filter-chip" data-tag-key="${escapeHtml(key)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
    })
    .join("");
  container.querySelectorAll("[data-tag-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-tag-key");
      if (key === "__all__") activeWishlistTags.clear();
      else if (activeWishlistTags.has(key)) activeWishlistTags.delete(key);
      else activeWishlistTags.add(key);
      renderWishlist();
    });
  });
}

function renderWishlist() {
  renderWishlistFilter();
  const container = document.getElementById("wishlist-view-list");
  const items = wishlistItems.filter((i) => activeWishlistTags.size === 0 || (i.get("tags") || []).some((t) => activeWishlistTags.has(t)));

  const totalPrice = items.reduce((s, i) => s + (i.get("price") || 0), 0);
  const totalSaved = items.reduce((s, i) => s + Math.min(i.get("saved") || 0, i.get("price") || 0), 0);
  document.getElementById("wishlist-summary").textContent = items.length
    ? `${formatMoney(totalSaved)} saved of ${formatMoney(totalPrice)} across ${items.length} item${items.length === 1 ? "" : "s"}.`
    : "";

  if (items.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">Nothing here yet.</p>`;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const price = item.get("price") || 0;
      const saved = item.get("saved") || 0;
      const pct = price > 0 ? Math.min(100, Math.round((saved / price) * 100)) : 0;
      const remaining = Math.max(0, price - saved);
      const tags = (item.get("tags") || []).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("");
      return `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(item.get("name"))}${item.get("url") ? ` <a href="${escapeHtml(item.get("url"))}" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i></a>` : ""}</div>
          <div class="missing-ingredient-row__recipes">${tags}${escapeHtml(item.get("store") || "")}${item.get("notes") ? " · " + escapeHtml(item.get("notes")) : ""}</div>
          <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress__bar" style="width:${pct}%"></div></div>
          <div class="missing-ingredient-row__recipes">${formatMoney(saved)} of ${formatMoney(price)} saved${remaining > 0 ? ` — ${formatMoney(remaining)} to go` : " — fully funded"}</div>
        </div>
      </div>`;
    })
    .join("");
}

async function loadWishlistView() {
  try {
    wishlistItems = await new Parse.Query(WishlistItemClass).ascending("name").limit(500).find();
    renderWishlist();
  } catch (err) {
    console.error(err);
    document.getElementById("wishlist-view-list").innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load the wishlist.</p></div>`;
  }
}

document.addEventListener("DOMContentLoaded", loadWishlistView);
