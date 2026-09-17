# THE KITCHEN — Cookbook + Kitchen Inventory

A personal, black-and-white, single-user cookbook and kitchen inventory site.
Static HTML/CSS/vanilla JS, backed by Back4App (Parse).

## Files

```
/
├── index.html              Landing page → links to Cookbook / Inventory
├── cookbook.html            Recipe browsing, search, filters, detail modal
├── inventory.html           Inventory catalog, summary strip, shelf views
├── admin.html                Login + dashboard (inventory, recipe, layout,
│                              and grocery-location CRUD)
├── groceries.html            PIN-gated shopping list (add items / check off)
├── css/
│   └── styles.css            The entire design system (CSS variables at top)
├── js/
│   ├── config.js              Back4App keys, site copy, controlled vocab — edit here
│   ├── parse.js                Parse SDK init + admin & grocery session helpers
│   ├── utils.js                 Ingredient matching, formatting, toasts, modals
│   ├── cookbook.js              Cookbook page logic
│   ├── inventory.js             Inventory page logic
│   ├── admin.js                  Admin login + CRUD logic
│   ├── groceries.js              Grocery list page logic (PIN gate + both views)
│   ├── storage-layout.js         Doll-house grid: shared by Admin → Layout,
│   │                              the item form's location/shelf picker,
│   │                              and the Inventory mini-map
│   ├── cloud-code-additions.js  Back4App Cloud Code to paste in (NOT part of the static site)
│   └── seed.js                   Optional: sample data, run once from the console
└── README.md
```

## How the Back4App connection works

`js/config.js` holds the Back4App **App ID** and **JavaScript Key**. These are
the public client keys — they're meant to ship in frontend code, the same way
they'd appear in any Parse-backed app. `js/parse.js` calls `Parse.initialize()`
with them once, and every page loads `parse.js` after the Parse SDK `<script>`
tag. If you ever need to point this at a different Back4App app, `config.js`
is the only file to touch.

## How admin authentication works

1. `admin.html` shows a login form first — never the dashboard.
2. On submit, the frontend calls the existing Cloud Function:
   `Parse.Cloud.run("adminLogin", { username, password })`.
   The frontend never contains the password itself — only the Cloud Function
   (server-side) knows `zeebug` / `oatmeal`.
3. On success, the returned `token` is stored in `sessionStorage` (not
   `localStorage`, so it clears when the tab closes) and the dashboard shows.
4. Every admin write (`js/admin.js`) sends that token along as `adminToken`
   on the Cloud Function call — see `runAdminCloud()` in `js/parse.js`.

### Important security note — read this before using it for real

The **original** `adminLogin` function only checks a username/password and
returns a string token. It does **not**, by itself, make it safe to let the
browser write directly to your `InventoryItem`/`Recipe` classes — a token
like `"closet-admin-1234"` can't be verified by anything, so a client-side
check alone is not real security.

`cloud-code-additions.js` fixes this properly:

- `adminLogin` now also saves an `AdminSession` record (token + 12-hour
  expiry) using the Master Key, so the token becomes something the server
  can actually check.
- New Cloud Functions (`adminCreateInventoryItem`, `adminUpdateInventoryItem`,
  `adminDeleteInventoryItem`, `adminCreateRecipe`, `adminUpdateRecipe`,
  `adminDeleteRecipe`) each call a `requireAdmin()` helper first, which looks
  up the session by token and rejects the request if it's missing or expired.
- All admin CRUD in the frontend goes through these functions rather than
  writing to Parse directly, so the Master Key never leaves the server.

**You still need to do one thing in the Back4App dashboard**: set
`InventoryItem`, `Recipe`, `StorageLayout`, `GroceryItem`, and
`GroceryLocation`'s Class-Level Permissions to **Public Read**, with **no
public write/update/delete**. That closes the last gap — right now, anyone
with your App ID/JS Key could otherwise write to those classes directly
through the client SDK, bypassing the site entirely. Cookbook, Inventory,
and Groceries only ever read, so read access can safely stay public.

Do not deploy this as "secure" without applying `cloud-code-additions.js`
and locking down those permissions — as shipped, the original `adminLogin`
alone does not protect the database.

## Parse classes to create in Back4App

**InventoryItem**
```
name            String
variant         String   (optional — e.g. "Roma", "Cherry" for a Tomato)
category        String
location        String
shelf           String
quantity        Number
unit            String
level           String
notes           String
expirationDate  Date
```

**Recipe**
```
title           String
description     String
category        String
recipeType      String   ("Meal", "Component", "From Scratch", "Preserve", "Baking", or "Project")
difficulty      Number   (1–5, optional)
servings        Number
prepTime        Number
cookTime        Number
instructions    String
notes           String
tags            Array
ingredients     Array   (see structure below)
requiresRecipes Array   (titles of other Recipe records this one depends on — see below)
```

`ingredients` is an array of objects:
```json
[{ "name": "soy sauce", "quantity": "2", "unit": "tbsp", "optional": false }]
```

`requiresRecipes` is an array of recipe title strings — e.g. Kake Udon's
`requiresRecipes` is `["Homemade Udon Noodles", "Homemade Awase Dashi"]`.
The Cookbook resolves these by matching titles (same normalization as
ingredient matching) and recursively checks each required recipe's own
readiness — so "Kake Udon" can correctly report "missing potato starch"
even though potato starch never appears in Kake Udon's own ingredient
list, only in Homemade Udon Noodles'.

**StorageLayout** (one record per location, created automatically the
first time you save a zone in Admin → Layout)
```
location    String   ("Fridge", "Freezer", "Pantry", "Counter", "Other")
rows        Number
cols        Number
zones       Array    (see structure below)
```

`zones` is an array of objects, each a rectangle of grid cells:
```json
[{ "id": "zone-...", "name": "Top Shelf", "type": "Shelf",
   "rowStart": 0, "rowEnd": 0, "colStart": 0, "colEnd": 3 }]
```

**AdminSession** (created automatically the first time `adminLogin` runs,
once `cloud-code-additions.js` is deployed)
```
token       String
username    String
expiresAt   Date
```

**GroceryLocation** (managed in Admin → Groceries — the places you shop)
```
name          String   (e.g. "Sac Central Farmers Market")
emoji         String   (e.g. "🥕")
hasBulkBins   Boolean  (shows a "bulk section" checkbox on items added for this location)
```

**GroceryItem** (added/edited/removed from groceries.html)
```
name        String
category    String   (reuses the same categories as InventoryItem)
location    String   (a GroceryLocation's name, or blank for "no specific store")
bulk        Boolean  (this item is in that location's bulk bin section)
status      String   ("list" — still need it — or "checkedOut" — bought,
                      not yet put away. Missing/undefined counts as "list"
                      for older records saved before this field existed.)
```

**GrocerySession** (created automatically the first time `groceryLogin`
runs — same idea as AdminSession, but for the grocery PIN, not the admin
password)
```
token       String
expiresAt   Date
```

Back4App auto-creates classes and columns the first time data is saved with
the Master Key, so once `cloud-code-additions.js` is deployed and you save
your first item through the Admin page, the schema appears on its own — no
manual column setup required. If you'd rather set columns up ahead of time,
use the field lists above.

## Recipe types and dependencies

The Cookbook's second filter row (ALL · MEAL · COMPONENT · FROM SCRATCH ·
PRESERVE · BAKING · PROJECT) filters on `recipeType`, independent of the
category/tag filter above it. Use "Component" for foundational things like
dashi or stock, "Project" for multi-hour undertakings like homemade udon,
and "Meal" for anything you'd actually plate and eat. Filtering by
Component or Project is effectively your "Kitchen Projects" list.

In the Admin recipe form, "Requires (comma-separated recipe titles)" links
a recipe to the other recipes it depends on. Type the other recipe's exact
title (matching is forgiving about case/whitespace, same as ingredient
matching). The recipe detail view shows a "Requires" section listing each
dependency's own READY/NOT READY status, and the overall status tag folds
in whatever's missing from the whole dependency tree — not just this
recipe's own ingredient list.

Recipes also have an optional 1–5 "Difficulty" rating, shown as stars
(★★★☆☆) on cards and in the detail view. And every recipe detail view has
a "Used By" section — the reverse of Requires — automatically listing
every other recipe that depends on it. No extra data entry needed: it's
computed by scanning all recipes' `requiresRecipes` for this one's title.
So Homemade Udon Noodles' detail view will show "Used By: Classic Kake
Udon, Yaki Udon, Tanuki Udon, Cold Zaru Udon, Nabe" automatically as you
add recipes that require it. The Indian batch follows the same pattern —
Homemade Paneer's detail view will show "Used By: Palak Paneer, Matar
Paneer, Paneer Tikka, Shahi Paneer" once all four are added.

## Visual storage layout ("Admin → Layout")

Instead of a hardcoded text list of shelves, each location's storage is a
grid you lay out yourself. In Admin → Layout, click a location (Fridge,
Freezer, Pantry, Counter, Other) to open its grid, then click-drag across
empty cells to mark a new zone — a shelf, drawer, door bin, or basket —
and name it. Click an existing zone to rename, retype, or delete it.
"Rows"/"Cols" resizes the grid; shrinking it drops any zones that no
longer fit (you'll get a toast saying how many).

This replaces the old Location/Shelf dropdowns everywhere:

- **Item form (Admin → Inventory → Add/Edit item)**: "Where is it?" opens
  the same doll-house — pick a location, then tap a zone (or "use this
  location, no specific shelf" if you haven't carved it up yet).
- **Inventory page**: a read-only mini-map sits above the item list for
  any location with zones configured, showing each zone's item count.
  Tapping a zone filters the list to just that shelf/drawer/bin.

Layouts are per-location StorageLayout records (see the class definition
above) and are shared across everyone viewing the public site — since
Inventory reads them without logging in, they're plain "Public Read"
data like InventoryItem and Recipe, not admin-only. Only Admin → Layout
can write them, via `adminSaveStorageLayout`.

A location with no zones yet just doesn't show a mini-map on Inventory
and offers only "no specific shelf" in the item-form picker — nothing
breaks, it just isn't subdivided until you draw something.

## Grocery list (groceries.html)

The list itself is visible to EVERYONE who opens the page — no PIN
needed. That's deliberate: send a family member the link and they can see
exactly what to pick up without you having to share any credentials. The
PIN only gates *adding, editing, or checking off* items, via a small
"🔓 Unlock to edit" toggle that reveals an inline PIN field. It's a much
lighter 4-digit gate (hardcoded as `"1234"` in Cloud Code — see
`GROCERY_PIN` in `cloud-code-additions.js`, change it to whatever you
want) than the admin username/password, on purpose, so it's easy to hand
off without giving out full admin access. Entering the PIN saves a token
to `localStorage` (not `sessionStorage`, unlike admin) so it stays
unlocked across app restarts on a phone — reasonable for a shopping list,
which isn't sensitive data.

Once unlocked, three tabs on the same `GroceryItem` list:

- **Add to list** — a "low stock — need to buy?" panel up top surfaces
  any Inventory item at a low level (same `CONFIG.LOW_LEVELS` used for the
  low-stock badge on Inventory), each with a one-tap "+ Add to List"
  button and a "Finished" button that deletes it from Inventory outright
  (for when it's fully used up, not just running low). That panel
  remembers whether you've collapsed it (localStorage). Below that, the
  usual add form (item name, category, which store to get it from, and a
  "bulk bin section" checkbox that only appears for stores marked as
  having one) plus everything currently on the list, grouped by store,
  each with Edit and Remove buttons. Edit reuses the same form — it fills
  in that item's current values and switches to "Save Changes." Remove
  deletes the item outright (different from checking it off — see below).
- **Check off** — filter chips for each store you've shopped at, then a
  checklist grouped by category. Checking a box does NOT delete the item —
  it moves it to the Checkout tab (`status: "checkedOut"`), since you've
  bought it but haven't put it away yet.
- **Checkout** — everything you've bought but not yet put away. "Put
  away" opens the exact same kind of form as adding an item in
  Admin → Inventory: name/type, category, the visual location/shelf
  picker (same doll-house component as Admin → Layout), quantity, unit,
  level, expiration date, and notes. Submitting creates the real
  `InventoryItem` and removes the grocery entry for good — one call
  (`groceryCheckoutToInventory`) does both. "↩ Back to list" undoes an
  accidental check-off.

**Shopping locations** (name + emoji + whether they have a bulk bin
section, e.g. "🥕 Sac Central Farmers Market") are managed separately, in
Admin → Groceries, under your normal admin login — so setting up *where*
you shop (and which of those places have bulk bins) is an admin task,
while day-to-day list-building/checking-off/putting-away only needs the
PIN. **Categories** reuse the exact same list as InventoryItem (Produce,
Dairy, Protein, Grains, etc.) rather than a separate config, so the two
stay consistent.

Like the housewarming site's shared password, the PIN is meant to keep
casual visitors from editing the list, not to withstand a determined
attacker — `GroceryItem`/`GroceryLocation` are Public Read like everything
else here, which is exactly what makes the no-PIN read-only view possible
in the first place.

**Worth knowing**: putting an item away and marking a low-stock item
"finished" both touch `InventoryItem` (`groceryCheckoutToInventory` and
`groceryDeleteInventoryItem`), gated by the grocery PIN rather than full
admin login. That's a deliberate trade-off — the everyday "I'm putting
groceries away" task shouldn't require a separate admin session — but it
does mean anyone with the grocery PIN can create or delete Inventory
records this way, not just manage the grocery list. If that's more access
than you want to hand out with the PIN, the fix is to require the admin
login for those two actions instead — say so and I can change it.

## How recipe-to-inventory matching works

`js/utils.js` → `ingredientMatchesInventoryItem()`. It strips filler words
("fresh", "chopped", "to taste", etc.), tokenizes both the recipe ingredient
name and the inventory item name, and checks whether most of the ingredient's
words appear in the inventory name (matching substrings too, so "shiitake"
matches inside "Dynasty Dried Shiitake"). No external API, nothing exotic —
just enough normalization to handle real pantry names.

A few other things happen before that comparison:

- **"X or Y" alternatives** ("milk or coconut milk") are split into
  separate options first — having any ONE in stock counts as available,
  rather than scoring the whole phrase as one bag of words (which used to
  silently demand most of both alternatives at once on longer lists).
- **Purpose clauses** ("oil, FOR FRYING") are stripped before matching, so
  the extra words don't count against the match the way the actual
  ingredient word does.
- **A synonym/abbreviation dictionary** (`INGREDIENT_ALIASES` near the top
  of `js/utils.js`) rewrites known aliases to one canonical form before
  anything else happens — "AP flour"/"plain flour"/"all purpose flour",
  British ↔ American pairs (aubergine/eggplant, courgette/zucchini,
  coriander/cilantro, mince/ground beef, stock/broth, and more), spelling
  variants (yoghurt/yogurt, chilli/chili), and so on. It's intentionally
  conservative — it only merges things that really are the same product,
  never close-but-different ones (salted vs. unsalted butter stay
  separate) — and it's a plain array, so adding another pair you hit is a
  one-line edit.

This same normalization also powers the two duplicate-detection tools
under Admin → Inventory ("Needed for Recipes" and "Similar Inventory
Items"), since they all route through the same `normalizeText()`.

### The optional Type field

Inventory items have an optional **Type** field, separate from Name —
e.g. `name: "Tomato"`, `variant: "Roma"`. This exists so a generic recipe
ingredient ("tomato") still matches ANY typed tomato in stock, while
"Similar Inventory Items" doesn't nag you to merge "Tomato / Roma" and
"Tomato / Cherry" into one — those are deliberately different, not a
typo. It only flags a "different type?" pair when one entry has no Type
set at all (ambiguous — might really be the same thing as a typed one),
and never flags two entries that both have an explicit, different Type.

## Deploying to GitHub Pages

1. Create a new GitHub repo and push everything in this folder to it
   (keep the file structure as-is — `index.html` at the repo root).
2. In the repo's **Settings → Pages**, set the source to the `main` branch,
   root folder.
3. Wait a minute for GitHub to build it, then visit the URL GitHub gives you.
4. In the Back4App dashboard, add that GitHub Pages URL (and
   `http://localhost:...` if you test locally) to your app's **Security →
   Allowed Origins / CORS** settings if your app restricts them.

No build step, no dependencies to install — it's plain HTML/CSS/JS plus the
Parse SDK loaded from a CDN.

## Adding your first inventory items and recipes

1. Deploy `cloud-code-additions.js` in the Back4App dashboard (Cloud Code
   section), and set the two Class-Level Permissions described above.
2. Visit `admin.html` on your deployed site and sign in as `zeebug`.
3. Use **+ ADD ITEM** / **+ ADD RECIPE** to create real entries, or run the
   optional seed script:
   - Log into `admin.html`.
   - Open devtools console on that page.
   - Paste the contents of `js/seed.js`, then run `seedDatabase()`.
   - This adds ~18 sample inventory items and 6 sample recipes based on a
     real pantry, deliberately leaving a couple of ingredients (like fresh
     scallions) missing so you can see both the "READY TO MAKE" and
     "MISSING INGREDIENT" states.
4. Reload `cookbook.html` / `inventory.html` to see the data.

## Notes

- Everything is mobile-first where it matters most: the Inventory page for
  standing in the kitchen, and the recipe detail view for cooking from a
  phone propped on the counter.
- Low-stock items are marked with typography and a border weight, not color,
  per the black-and-white brief.
- Empty states, search-with-no-results, and error states all use inline
  messaging — no `alert()` calls anywhere.
