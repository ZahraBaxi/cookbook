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

/**
 * Known ingredient abbreviations/synonyms, applied as whole-phrase text
 * substitutions BEFORE tokenizing, so "AP flour" and "all purpose flour"
 * — or "confectioners' sugar" and "powdered sugar" — collapse to the
 * exact same normalized text and therefore match each other. Patterns
 * run against an already-lowercased string; periods/apostrophes/hyphens
 * are handled per-pattern rather than stripped globally first, since
 * stripping punctuation before this step would turn "a.p. flour" into
 * "a p flour" and break the very abbreviation it's meant to catch.
 *
 * This list is intentionally about IDENTITY synonyms only — genuinely
 * interchangeable names for the same product — not close-but-different
 * variants. "Salted" vs "unsalted" butter and "light" vs "dark" brown
 * sugar are deliberately left alone, since a recipe calling for one
 * usually does mean that one specifically.
 *
 * Add more over time as you hit them — each entry is just
 * [pattern, canonical replacement text].
 */
const INGREDIENT_ALIASES = [
  // Flours & starches
  [/\ba\.?\s?p\.?\s+flour\b/g, "all purpose flour"],
  [/\bself[\s-]?rising\s+flour\b/g, "self rising flour"],
  [/\bself[\s-]?raising\s+flour\b/g, "self rising flour"],
  [/\bcorn\s?starch\b/g, "cornstarch"],
  [/\btapioca\s+flour\b/g, "tapioca starch"],
  [/\b00\s+flour\b/g, "tipo 00 flour"],
  [/\btipo\s+00\s+flour\b/g, "tipo 00 flour"],

  // Sugars
  [/\bconfectioners?'?\s+sugar\b/g, "powdered sugar"],
  [/\bicing\s+sugar\b/g, "powdered sugar"],
  [/\b10x\s+sugar\b/g, "powdered sugar"],
  [/\bwhite\s+sugar\b/g, "granulated sugar"],
  [/\bcaster\s+sugar\b/g, "superfine sugar"],

  // Leavening & salt
  [/\bbicarbonate\s+of\s+soda\b/g, "baking soda"],
  [/\bbicarb\s+soda\b/g, "baking soda"],
  [/\bsodium\s+bicarbonate\b/g, "baking soda"],
  [/\biodi[sz]ed\s+salt\b/g, "table salt"],

  // Fats & oils
  [/\bveg(?:etable)?\.?\s+oil\b/g, "vegetable oil"],
  [/\bevoo\b/g, "extra virgin olive oil"],

  // Dairy
  [/\bhalf\s*(?:&|and)\s*half\b/g, "half and half"],
  [/\bheavy\s+whipping\s+cream\b/g, "heavy cream"],
  [/\bwhipping\s+cream\b/g, "heavy cream"],

  // Vinegar & acids
  [/\bacv\b/g, "apple cider vinegar"],
  [/\brice\s+wine\s+vinegar\b/g, "rice vinegar"],

  // Aromatics & produce
  [/\bscallions?\b/g, "green onions"],
  [/\bspring\s+onions?\b/g, "green onions"],
  [/\bcoriander\s+leaves\b/g, "cilantro"],
  [/\bcapsicum\b/g, "bell pepper"],
  [/\baubergine\b/g, "eggplant"],
  [/\bcourgette\b/g, "zucchini"],

  // Chilies & spice shorthand
  [/\bchil[ei]\s+flakes\b/g, "red pepper flakes"],
  [/\bcrushed\s+red\s+pepper(?:\s+flakes)?\b/g, "red pepper flakes"],
  [/\bmonosodium\s+glutamate\b/g, "msg"],

  // Common protein/other shorthand
  [/\bgr(?:ound)?\.?\s+beef\b/g, "ground beef"],
  [/\bpowd(?:er(?:ed)?)?\.?\s+sugar\b/g, "powdered sugar"],

  // --- British <-> American -------------------------------------------
  // Same conservative rule as above: only pairs that really are the same
  // product under a different name. Skipped some famous false friends on
  // purpose because they're too ambiguous to blanket-replace safely —
  // UK "chips" (fries) vs "crisps" (US chips) would corrupt "chocolate
  // chips"/"potato chips" if merged automatically; UK "biscuit" (cookie)
  // vs US "biscuit" (a completely different baked good) is unresolvable
  // by text alone; "pudding" is used two different ways even within UK
  // English. Add narrower rules yourself if you hit a specific case.
  [/\bplain\s+flour\b/g, "all purpose flour"],
  [/\bcornflour\b/g, "cornstarch"], // UK cornflour = US cornstarch (NOT the same as US "corn flour")
  [/\byoghurt\b/g, "yogurt"],
  [/\bchillies\b/g, "chilies"],
  [/\bchilli\b/g, "chili"],
  [/\bprawns?\b/g, "shrimp"],
  [/\brocket\b/g, "arugula"],
  [/\bswedes?\b/g, "rutabaga"], // the vegetable, not the country
  [/\bcoriander\b(?!\s+seeds?)/g, "cilantro"], // UK "coriander" = the leaf; "coriander seeds" is a different, distinct spice — left alone
  [/\bdouble\s+cream\b/g, "heavy cream"],
  [/\bsingle\s+cream\b/g, "light cream"],
  [/\bicing\b/g, "frosting"], // runs after the "icing sugar" rule above, so that phrase is already consumed by then
  [/\bstock\b/g, "broth"],
  [/\bbouillon\b/g, "broth"],
  [/\bsultanas?\b/g, "golden raisins"],
  [/\bbroad\s+beans?\b/g, "fava beans"],
  [/\bmange\s?tout\b/g, "snow peas"],
  [/\bmangetout\b/g, "snow peas"],
  [/\bpak\s?choi\b/g, "bok choy"],
  [/\bpak\s?choy\b/g, "bok choy"],
  [/\bgarbanzo\s+beans?\b/g, "chickpeas"],
  [/\bblack\s+treacle\b/g, "molasses"],
  [/\bstreaky\s+bacon\b/g, "bacon"],
  [/\bback\s+bacon\b/g, "canadian bacon"],
  [/\b(beef|pork|lamb|turkey|chicken)\s+mince\b/g, "ground $1"],
  [/\bminced\s+(beef|pork|lamb|turkey|chicken)\b/g, "ground $1"],
];

function applyIngredientAliases(str) {
  return INGREDIENT_ALIASES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), str);
}

function normalizeText(str) {
  return applyIngredientAliases((str || "").toLowerCase())
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
/**
 * The text used to represent an inventory item for matching/searching —
 * name plus optional type ("Tomato" + "Roma" -> "Tomato Roma"), so a
 * generic recipe ingredient ("tomato") still matches a specifically-typed
 * item, while inventoryItemLabel() below keeps them visually distinct.
 */
function inventoryItemMatchText(item) {
  return [item.get("name"), item.get("variant")].filter(Boolean).join(" ");
}

/**
 * Display label for an inventory item — "Tomato — Roma" when a type is
 * set, just "Tomato" otherwise.
 */
function inventoryItemLabel(item) {
  const variant = item.get("variant");
  return variant ? `${item.get("name")} — ${variant}` : item.get("name") || "";
}

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
 * Strips a trailing purpose/usage clause — "oil FOR FRYING", "butter, for
 * greasing the pan", "rice, for serving" — down to just the ingredient
 * itself. Without this, descriptive tail words ("frying", "greasing",
 * "serving") count against the match-token ratio the same as the actual
 * ingredient word, so a plain on-hand item like Olive Oil could register
 * as "missing" purely because the recipe noted what the oil was for.
 */
function stripPurposeClause(name) {
  return (name || "").replace(/[,(]?\s*\bfor\b\s+.+$/i, "").trim();
}

/**
 * Splits an ingredient name written as alternatives — "milk or coconut
 * milk", "cabbage or cucumber or daikon", "citrus juice (yuzu or lemon)" —
 * into its individual options. Falls back to [name] when there's no "or".
 *
 * This matters because ingredientMatchesInventoryItem() above scores a
 * match by what fraction of an ingredient's own words show up in a single
 * inventory item name. Fed the whole alternatives phrase as one bag of
 * words, that fraction silently demands most of BOTH options at once
 * ("citrus", "juice", "yuzu", AND "lemon") instead of treating them as
 * genuine alternatives — so having just lemon, or just yuzu juice, could
 * fail to register as "have" even though either one is exactly what the
 * recipe means. Splitting first and checking each option independently
 * gives real OR semantics: any ONE alternative in stock counts as having it.
 */
function ingredientAlternatives(name) {
  if (!name) return [];
  // Split on "or" FIRST, then clean each resulting piece — cleaning the
  // whole string before splitting would let a purpose clause on the first
  // alternative ("oil FOR FRYING or ghee") swallow every alternative after
  // it, since "for ... " strips to the end of whatever string it's run on.
  const parts = name
    .split(/\s+or\s+/i)
    .map((p) => stripPurposeClause(p.replace(/[()]/g, "")).trim())
    .filter(Boolean);
  return parts.length ? parts : [name];
}

/**
 * Checks one recipe ingredient against the full inventory, honoring "X or
 * Y" alternatives (see ingredientAlternatives above) — having ANY ONE
 * alternative in stock counts as available.
 */
function matchIngredientAgainstInventory(ingredientName, inventoryItems) {
  for (const alt of ingredientAlternatives(ingredientName)) {
    const matchedItem = inventoryItems.find((item) => ingredientMatchesInventoryItem(alt, inventoryItemMatchText(item)));
    if (matchedItem) return { have: true, matchedItem, matchedAlternative: alt };
  }
  return { have: false, matchedItem: null, matchedAlternative: null };
}

/**
 * Given a recipe's ingredients array and the full inventory list,
 * returns a status per ingredient: { ingredient, have, matchedItem, matchedAlternative }
 */
function computeIngredientAvailability(ingredients, inventoryItems) {
  return (ingredients || []).map((ing) => {
    const match = matchIngredientAgainstInventory(ing.name, inventoryItems);
    return {
      ingredient: ing,
      have: match.have,
      matchedItem: match.matchedItem,
      matchedAlternative: match.matchedAlternative,
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

  document.querySelectorAll("[data-home-subtitle]").forEach((el) => (el.textContent = CONFIG.HOME_SUBTITLE));

  document.querySelectorAll("[data-site-footer]").forEach((el) => {
    el.innerHTML = `${escapeHtml(CONFIG.SITE_TITLE)}. &copy; 2026, made with &lt;3 by zahra using html, css, js, and sparkle dust. A project within <a href="${CONFIG.MAIN_SITE_URL}" target="_blank" rel="noopener">${escapeHtml(CONFIG.MAIN_SITE_LABEL)}</a>.`;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  applySiteCopy();
});
