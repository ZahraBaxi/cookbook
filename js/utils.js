/**
 * utils.js
 * -----------------------------------------------------------------------
 * Shared helpers used across cookbook.js, inventory.js, and admin.js:
 * ingredient/inventory normalization + matching, formatting, toasts,
 * and small DOM helpers.
 * -----------------------------------------------------------------------
 */

/* ---------------------------------------------------------------------
 * Text normalization + fuzzy-ish ingredient matching
 * ------------------------------------------------------------------- */

// Words that don't help identify an ingredient — brand-y filler and
// common prep descriptors. Stripping these lets "soy sauce" match
// "Kikkoman Soy Sauce" and "shiitake" match "Dynasty Dried Shiitake".
const STOPWORDS = new Set([
  "fresh", "dried", "chopped", "sliced", "minced", "diced", "grated",
  "large", "small", "medium", "organic", "raw", "cooked", "ripe",
  "of", "the", "a", "an", "and", "or", "to", "taste", "optional",
]);

function normalizeText(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stemToken)
    .join(" ")
    .trim();
}

// Naive plural stemming so "carrot" and "carrots" (or "potato"/"potatoes")
// normalize to the same key. Deliberately conservative — skips short
// words and words ending "ss" (glass, class) to avoid mis-stemming.
function stemToken(tok) {
  if (tok.length > 3 && tok.endsWith("ies")) return tok.slice(0, -3) + "y";
  if (tok.length > 3 && tok.endsWith("es") && !tok.endsWith("ses")) return tok.slice(0, -2);
  if (tok.length > 3 && tok.endsWith("s") && !tok.endsWith("ss")) return tok.slice(0, -1);
  return tok;
}

function tokenize(str) {
  return normalizeText(str).split(/\s+/).filter(Boolean);
}

/**
 * Returns true if `ingredientName` reasonably refers to `inventoryName`.
 * Matching is intentionally simple: normalize both strings, then check
 * whether every meaningful token in the (usually short) ingredient name
 * appears somewhere in the (usually longer, branded) inventory name, or
 * vice versa for very short inventory names. This handles:
 *   "soy sauce"  -> "Kikkoman Soy Sauce"
 *   "shiitake"   -> "Dynasty Dried Shiitake"
 *   "rice vinegar" -> "Marukan Rice Vinegar"
 * without an external API or heavy fuzzy-matching library.
 */
function ingredientMatchesInventoryItem(ingredientName, inventoryName) {
  const a = tokenize(ingredientName);
  const b = tokenize(inventoryName);
  if (a.length === 0 || b.length === 0) return false;

  const bSet = new Set(b);
  const overlap = a.filter((tok) => bSet.has(tok) || b.some((t) => t.includes(tok) || tok.includes(t)));

  // Require most of the ingredient's own tokens to be present. For a
  // single-word ingredient ("shiitake"), require that one word to hit.
  const requiredHits = Math.max(1, Math.ceil(a.length * 0.6));
  return overlap.length >= requiredHits;
}

/**
 * Given a recipe's ingredients array and the full inventory list,
 * returns a status per ingredient: { ingredient, have, matchedItem }
 */
function computeIngredientAvailability(ingredients, inventoryItems) {
  return (ingredients || []).map((ing) => {
    const matched = inventoryItems.find((item) =>
      ingredientMatchesInventoryItem(ing.name, item.get("name"))
    );
    return {
      ingredient: ing,
      have: !!matched,
      matchedItem: matched || null,
    };
  });
}

/**
 * Summarizes a recipe's readiness given ingredient availability.
 * Optional ingredients don't count against "ready to make".
 */
function summarizeAvailability(availabilityList) {
  const required = availabilityList.filter((a) => !a.ingredient.optional);
  const missing = required.filter((a) => !a.have);
  return {
    ready: missing.length === 0,
    missingCount: missing.length,
    totalRequired: required.length,
  };
}

/* ---------------------------------------------------------------------
 * Recipe dependencies ("requires" other recipes as components)
 * ------------------------------------------------------------------- */

function findRecipeByTitle(title, allRecipes) {
  const key = normalizeText(title);
  if (!key) return null;
  return allRecipes.find((r) => normalizeText(r.get("title")) === key) || null;
}

/**
 * Reverse of `requiresRecipes` — every recipe that lists `recipe`'s title as
 * a dependency. Powers the "Used By" section (Kake Udon, Yaki Udon, Nabe
 * all show up under Homemade Udon Noodles) without storing the link twice.
 */
function findRecipesThatUse(recipe, allRecipes) {
  const key = normalizeText(recipe.get("title"));
  return allRecipes.filter((r) => (r.get("requiresRecipes") || []).some((t) => normalizeText(t) === key));
}

/**
 * Recursively determines whether a recipe can be made, given both its own
 * ingredients AND every recipe it `requires` (e.g. Kake Udon requires
 * Homemade Udon Noodles + Homemade Awase Dashi). Missing raw ingredients
 * bubble all the way up, so a "Kake Udon" status can say "missing potato
 * starch" instead of just "missing homemade udon".
 *
 * Returns:
 *   {
 *     ready: boolean,
 *     ownAvailability: [...],           // this recipe's own ingredient list, HAVE/MISSING
 *     missingIngredients: [{ name, optional, forRecipeTitle }],  // flattened, whole tree
 *     components: [{ title, found, ready, missingIngredients }], // one entry per `requires` link
 *   }
 */
function computeRecipeReadiness(recipe, allRecipes, inventoryItems, visitedTitles) {
  const visited = visitedTitles ? new Set(visitedTitles) : new Set();
  const titleKey = normalizeText(recipe.get("title"));

  if (visited.has(titleKey)) {
    return {
      ready: false,
      ownAvailability: [],
      missingIngredients: [{ name: `${recipe.get("title")} (circular dependency)`, optional: false, forRecipeTitle: recipe.get("title") }],
      components: [],
    };
  }
  visited.add(titleKey);

  const ownAvailability = computeIngredientAvailability(recipe.get("ingredients"), inventoryItems);
  const ownMissing = ownAvailability
    .filter((a) => !a.have && !a.ingredient.optional)
    .map((a) => ({ name: a.ingredient.name, optional: false, forRecipeTitle: recipe.get("title") }));

  const requiresList = recipe.get("requiresRecipes") || [];
  const components = requiresList.map((reqTitle) => {
    const reqRecipe = findRecipeByTitle(reqTitle, allRecipes);
    if (!reqRecipe) {
      return {
        title: reqTitle,
        found: false,
        ready: false,
        missingIngredients: [{ name: `${reqTitle} (recipe not found)`, optional: false, forRecipeTitle: reqTitle }],
      };
    }
    const sub = computeRecipeReadiness(reqRecipe, allRecipes, inventoryItems, visited);
    return { title: reqRecipe.get("title"), found: true, ready: sub.ready, missingIngredients: sub.missingIngredients };
  });

  const missingIngredients = [...ownMissing, ...components.flatMap((c) => c.missingIngredients)];
  const ready = ownMissing.length === 0 && components.every((c) => c.ready);

  return { ready, ownAvailability, missingIngredients, components };
}

/* ---------------------------------------------------------------------
 * Formatting helpers
 * ------------------------------------------------------------------- */

function formatTime(prepTime, cookTime) {
  const total = (Number(prepTime) || 0) + (Number(cookTime) || 0);
  if (!total) return null;
  return `${total} MIN`;
}

function formatDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isExpiringSoon(date, days = 5) {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return false;
  const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff <= days;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function titleCase(str) {
  return (str || "").replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

/**
 * Renders a 1–5 difficulty rating as filled/empty stars, e.g. starRating(3) -> "★★★☆☆".
 * Returns "" for an unset/invalid rating so callers can just check truthiness.
 */
function starRating(n, max = 5) {
  const level = Math.max(0, Math.min(max, Math.round(Number(n) || 0)));
  if (!level) return "";
  return "★".repeat(level) + "☆".repeat(max - level);
}

/* ---------------------------------------------------------------------
 * Toast notifications (replaces ugly browser alerts)
 * ------------------------------------------------------------------- */

function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/* ---------------------------------------------------------------------
 * Simple accessible modal helper
 * ------------------------------------------------------------------- */

let lastFocusedBeforeModal = null;

function openModal(modalEl) {
  lastFocusedBeforeModal = document.activeElement;
  modalEl.classList.add("modal--open");
  modalEl.removeAttribute("aria-hidden");
  document.body.classList.add("no-scroll");
  const focusTarget = modalEl.querySelector("[data-autofocus]") || modalEl.querySelector("button, input, textarea, select, a[href]");
  if (focusTarget) focusTarget.focus();

  function trapFocus(e) {
    if (e.key === "Escape") {
      closeModal(modalEl);
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  modalEl._trapFocus = trapFocus;
  modalEl.addEventListener("keydown", trapFocus);
}

function closeModal(modalEl) {
  modalEl.classList.remove("modal--open");
  modalEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  if (modalEl._trapFocus) {
    modalEl.removeEventListener("keydown", modalEl._trapFocus);
    modalEl._trapFocus = null;
  }
  if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
}

/* ---------------------------------------------------------------------
 * Mobile nav toggle (shared across pages)
 * ------------------------------------------------------------------- */

function initNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");
  if (!toggle || !menu) return;
  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("nav-links--open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function applySiteCopy() {
  document.querySelectorAll("[data-site-title]").forEach((el) => (el.textContent = CONFIG.SITE_TITLE));
  document.title = document.title.replace("THE KITCHEN", CONFIG.SITE_TITLE);
}

document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  applySiteCopy();
});
